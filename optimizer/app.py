import os
import uuid
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel, Field, conlist, field_validator
from ortools.constraint_solver import pywrapcp, routing_enums_pb2

AUTH_TOKEN = os.getenv("AUTH_TOKEN")
app = FastAPI(title="TMS Optimizer", version="1.0")


# ---------------------- Models ----------------------
class Vehicle(BaseModel):
    id: str
    capacity: Optional[int] = None
    start_index: int = 0
    end_index: Optional[int] = None


class Job(BaseModel):
    id: str
    demand: Optional[int] = None
    location_index: int
    service: int = 0  # service time at location (minutes)


class Options(BaseModel):
    time_limit_ms: int = Field(2000, ge=100)
    max_vehicles: Optional[int] = None
    return_to_depot: bool = True


class OptimizeRequest(BaseModel):
    vehicles: List[Vehicle] = Field(..., min_length=1)
    jobs: List[Job] = Field(..., min_length=1)
    matrix: List[List[int]] = Field(..., min_length=1)
    options: Options = Options()

    @field_validator("matrix")
    @classmethod
    def matrix_is_rectangular(cls, v):
        if not v or not isinstance(v, list):
            raise ValueError("matrix must be a non-empty list")
        row_len = len(v[0])
        for row in v:
            if len(row) != row_len:
                raise ValueError("matrix must be rectangular")
        return v

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "vehicles": [{"id": "truck-1", "capacity": 10, "start_index": 0, "end_index": 0}],
                    "jobs": [{"id": "stop-a", "demand": 3, "location_index": 1, "service": 5}],
                    "matrix": [[0, 10], [10, 0]],
                    "options": {"time_limit_ms": 2000, "return_to_depot": True},
                }
            ]
        }
    }


class Stop(BaseModel):
    job_id: Optional[str]
    index: int
    arrival_min: int
    departure_min: int


class Route(BaseModel):
    vehicle_id: str
    stops: List[Stop]
    distance: int
    duration: int


class OptimizeResponse(BaseModel):
    status: str
    routes: List[Route]
    total_distance: int
    total_duration: int
    request_id: str


# ---------------------- Utils ----------------------
def authorize(header: Optional[str]):
    if AUTH_TOKEN is None:
        return True
    if not header:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or token != AUTH_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid token")
    return True


def build_manager(data: OptimizeRequest):
    return pywrapcp.RoutingIndexManager(
        len(data.matrix),
        len(data.vehicles),
        [v.start_index for v in data.vehicles],
        [v.end_index if v.end_index is not None else v.start_index for v in data.vehicles],
    )


def create_routing(data: OptimizeRequest, manager):
    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return data.matrix[from_node][to_node]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    # Capacity constraint if any demand present
    if any(job.demand is not None for job in data.jobs):
        demands = [0] * len(data.matrix)
        for job in data.jobs:
            demands[job.location_index] = job.demand or 0

        def demand_callback(from_index):
            node = manager.IndexToNode(from_index)
            return demands[node]

        demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
        routing.AddDimensionWithVehicleCapacity(
            demand_callback_index,
            0,
            [v.capacity or sum(demands) for v in data.vehicles],
            True,
            "Capacity",
        )

    # Service time + travel time
    service_times = [0] * len(data.matrix)
    for job in data.jobs:
        service_times[job.location_index] = job.service

    def time_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        travel = data.matrix[from_node][to_node]
        return travel + service_times[from_node]

    time_callback_index = routing.RegisterTransitCallback(time_callback)
    routing.AddDimension(
        time_callback_index,
        0,
        10_000_000,
        True,
        "Time",
    )

    # Optional: limit number of vehicles used
    if data.options.max_vehicles:
        routing.SetFixedCostOfAllVehicles(1)

    # Search params
    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    search_parameters.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    search_parameters.time_limit.FromMilliseconds(data.options.time_limit_ms)

    return routing, search_parameters, transit_callback_index, time_callback_index


def extract_solution(data: OptimizeRequest, manager, routing, solution):
    routes = []
    total_distance = 0
    total_duration = 0

    time_dimension = routing.GetDimensionOrDie("Time")

    for vehicle_idx, vehicle in enumerate(data.vehicles):
        index = routing.Start(vehicle_idx)
        if routing.IsEnd(solution.Value(routing.NextVar(index))):
            continue
        stops = []
        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            arrival = solution.Value(time_dimension.CumulVar(index))
            depart = arrival + (next((j.service for j in data.jobs if j.location_index == node), 0))
            job_id = next((j.id for j in data.jobs if j.location_index == node), None)
            stops.append(Stop(job_id=job_id, index=node, arrival_min=arrival, departure_min=depart))
            prev_index = index
            index = solution.Value(routing.NextVar(index))
            arc_dist = routing.GetArcCostForVehicle(prev_index, index, vehicle_idx)
            total_distance += arc_dist
        end_index = manager.IndexToNode(index)
        arrival_end = solution.Value(time_dimension.CumulVar(index))
        stops.append(Stop(job_id=None, index=end_index, arrival_min=arrival_end, departure_min=arrival_end))
        route_distance = routing.GetArcCostForVehicle(routing.Start(vehicle_idx), routing.End(vehicle_idx), vehicle_idx)
        route_duration = arrival_end
        total_duration += route_duration
        routes.append(Route(vehicle_id=vehicle.id, stops=stops, distance=route_distance, duration=route_duration))

    return routes, total_distance, total_duration


@app.post("/optimize/routes", response_model=OptimizeResponse)
def optimize_routes(payload: OptimizeRequest, authorization: Optional[str] = Header(None)):
    authorize(authorization)

    manager = build_manager(payload)
    routing, search_parameters, *_ = create_routing(payload, manager)
    solution = routing.SolveWithParameters(search_parameters)

    if not solution:
        raise HTTPException(status_code=422, detail="No solution found")

    routes, total_distance, total_duration = extract_solution(payload, manager, routing, solution)
    return OptimizeResponse(
        status="optimal",
        routes=routes,
        total_distance=total_distance,
        total_duration=total_duration,
        request_id=str(uuid.uuid4()),
    )


@app.get("/health")
def health():
    return {"status": "ok"}
