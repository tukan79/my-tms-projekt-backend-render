from uuid import UUID

from fastapi.testclient import TestClient

import app as optimizer_app
client = TestClient(optimizer_app.app)


def _base_payload():
    return {
        "vehicles": [{"id": "truck-1", "capacity": 10, "start_index": 0, "end_index": 0}],
        "jobs": [{"id": "stop-a", "demand": 3, "location_index": 1, "service": 5}],
        "matrix": [[0, 10], [10, 0]],
        "options": {"time_limit_ms": 2000, "return_to_depot": True},
    }


def test_health_ok():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_optimize_without_auth_token_env_allows_request(monkeypatch):
    monkeypatch.setattr(optimizer_app, "AUTH_TOKEN", None)
    response = client.post("/optimize/routes", json=_base_payload())
    assert response.status_code == 200


def test_auth_required_missing_header_returns_401(monkeypatch):
    monkeypatch.setattr(optimizer_app, "AUTH_TOKEN", "secret-token")
    response = client.post("/optimize/routes", json=_base_payload())
    assert response.status_code == 401
    assert response.json()["detail"] == "Missing Authorization header"


def test_auth_required_invalid_token_returns_403(monkeypatch):
    monkeypatch.setattr(optimizer_app, "AUTH_TOKEN", "secret-token")
    response = client.post(
        "/optimize/routes",
        headers={"Authorization": "Bearer wrong-token"},
        json=_base_payload(),
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Invalid token"


def test_auth_required_valid_token_returns_200(monkeypatch):
    monkeypatch.setattr(optimizer_app, "AUTH_TOKEN", "secret-token")
    response = client.post(
        "/optimize/routes",
        headers={"Authorization": "Bearer secret-token"},
        json=_base_payload(),
    )
    assert response.status_code == 200


def test_validation_matrix_not_rectangular_returns_422():
    payload = _base_payload()
    payload["matrix"] = [[0, 1], [1]]
    response = client.post("/optimize/routes", json=payload)
    assert response.status_code == 422


def test_validation_time_limit_too_low_returns_422():
    payload = _base_payload()
    payload["options"]["time_limit_ms"] = 10
    response = client.post("/optimize/routes", json=payload)
    assert response.status_code == 422


def test_no_solution_when_demand_exceeds_capacity_returns_422():
    payload = _base_payload()
    payload["vehicles"][0]["capacity"] = 1
    payload["jobs"][0]["demand"] = 5
    response = client.post("/optimize/routes", json=payload)
    assert response.status_code == 422
    assert response.json()["detail"] == "No solution found"


def test_happy_path_response_shape_and_uuid():
    response = client.post("/optimize/routes", json=_base_payload())
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "optimal"
    assert isinstance(body["routes"], list)
    assert len(body["routes"]) >= 1
    assert body["total_distance"] >= 0
    assert body["total_duration"] >= 0
    UUID(body["request_id"])


def test_service_time_affects_stop_departure():
    response = client.post("/optimize/routes", json=_base_payload())
    assert response.status_code == 200
    body = response.json()
    route = body["routes"][0]
    job_stop = next(stop for stop in route["stops"] if stop["job_id"] == "stop-a")
    assert job_stop["departure_min"] - job_stop["arrival_min"] == 5


def test_request_id_is_unique_per_call():
    first = client.post("/optimize/routes", json=_base_payload())
    second = client.post("/optimize/routes", json=_base_payload())
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["request_id"] != second.json()["request_id"]
