const { optimizeRoutes } = require('./optimizerClient.js');

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const getOrderWeight = (order) => {
  return toNumber(
    order?.cargo_details?.total_weight_kg ??
      order?.cargo_details?.total_kilos ??
      order?.cargoDetails?.totalWeightKg ??
      order?.cargoDetails?.totalKilos ??
      0
  );
};

const getOrderPallets = (order) => {
  return toNumber(
    order?.cargo_details?.total_spaces ??
      order?.cargo_details?.pallets ??
      order?.cargoDetails?.totalSpaces ??
      order?.cargoDetails?.pallets ??
      0
  );
};

const buildCurrentLoadByRun = (runs = [], orders = [], assignments = []) => {
  const orderMap = new Map(orders.map((order) => [Number(order.id), order]));
  const loadMap = new Map();

  for (const run of runs) {
    const runId = Number(run.id);
    if (!Number.isFinite(runId)) continue;
    loadMap.set(runId, { kilos: 0, pallets: 0 });
  }

  for (const assignment of assignments) {
    const runId = Number(assignment?.run_id ?? assignment?.runId);
    const orderId = Number(assignment?.order_id ?? assignment?.orderId);
    if (!Number.isFinite(runId) || !Number.isFinite(orderId)) continue;

    const order = orderMap.get(orderId);
    if (!order) continue;

    const load = loadMap.get(runId) || { kilos: 0, pallets: 0 };
    load.kilos += getOrderWeight(order);
    load.pallets += getOrderPallets(order);
    loadMap.set(runId, load);
  }

  return loadMap;
};

const canFitIntoRun = (run, nextLoad) => {
  const maxPayload = toNumber(run?.maxPayload, 0);
  const maxPallets = toNumber(run?.maxPallets, 0);

  const hasWeightCap = maxPayload > 0;
  const hasPalletCap = maxPallets > 0;

  if (!hasWeightCap && !hasPalletCap) {
    return true;
  }

  if (hasWeightCap && nextLoad.kilos > maxPayload) {
    return false;
  }

  if (hasPalletCap && nextLoad.pallets > maxPallets) {
    return false;
  }

  return true;
};

const planAssignmentsGreedy = ({ runs = [], orders = [], assignments = [] }) => {
  const normalizedRuns = runs
    .map((run) => ({ ...run, id: Number(run.id) }))
    .filter((run) => Number.isFinite(run.id));

  const normalizedOrders = orders
    .map((order) => ({ ...order, id: Number(order.id) }))
    .filter((order) => Number.isFinite(order.id));

  const currentLoad = buildCurrentLoadByRun(normalizedRuns, normalizedOrders, assignments);
  const newAssignments = [];

  let runCursor = 0;
  for (const order of normalizedOrders) {
    if (normalizedRuns.length === 0) break;

    const orderLoad = {
      kilos: getOrderWeight(order),
      pallets: getOrderPallets(order),
    };

    let assigned = false;
    for (let offset = 0; offset < normalizedRuns.length; offset++) {
      const runIndex = (runCursor + offset) % normalizedRuns.length;
      const run = normalizedRuns[runIndex];
      const current = currentLoad.get(run.id) || { kilos: 0, pallets: 0 };
      const nextLoad = {
        kilos: current.kilos + orderLoad.kilos,
        pallets: current.pallets + orderLoad.pallets,
      };

      if (!canFitIntoRun(run, nextLoad)) {
        continue;
      }

      currentLoad.set(run.id, nextLoad);
      newAssignments.push({ run_id: run.id, order_id: order.id });
      runCursor = (runIndex + 1) % normalizedRuns.length;
      assigned = true;
      break;
    }

    if (!assigned) {
      // If no run can fit constraints, skip this order to avoid hard failure.
      continue;
    }
  }

  return newAssignments;
};

const solveOrToolsPlan = async (payload = {}) => {
  // Compatibility mode: if payload already matches optimizer microservice schema.
  if (Array.isArray(payload.vehicles) && Array.isArray(payload.jobs) && Array.isArray(payload.matrix)) {
    const optimizerResult = await optimizeRoutes(payload);

    const assignments = [];
    for (const route of optimizerResult?.routes || []) {
      for (const stop of route?.stops || []) {
        if (!stop?.job_id) continue;
        const runId = Number(String(route.vehicle_id).replace(/[^\d-]/g, ''));
        const orderId = Number(String(stop.job_id).replace(/[^\d-]/g, ''));
        if (Number.isFinite(runId) && Number.isFinite(orderId)) {
          assignments.push({ run_id: runId, order_id: orderId });
        }
      }
    }

    return { assignments, source: 'optimizer-service' };
  }

  const runs = Array.isArray(payload.runs) ? payload.runs : [];
  const orders = Array.isArray(payload.orders) ? payload.orders : [];
  const existingAssignments = Array.isArray(payload.assignments) ? payload.assignments : [];

  const assignments = planAssignmentsGreedy({
    runs,
    orders,
    assignments: existingAssignments,
  });

  return {
    assignments,
    message:
      assignments.length > 0
        ? `Suggested ${assignments.length} assignments.`
        : 'No feasible assignments found for current runs/orders.',
    source: 'backend-greedy',
  };
};

module.exports = {
  solveOrToolsPlan,
};
