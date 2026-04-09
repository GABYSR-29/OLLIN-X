import {
  finiteNonNegative,
  safeDivide,
  sanitizeTotalsSnapshot,
  sanitizeCycleSnapshot,
} from './simulationMetricsGuards.js';

const STATION_DISABLED_TIME = 9999;
const ENERGY_COST_PER_UNIT = 1;
/** Coherente con el piso de `normalizeEfficiency`: evita división por cero y tiempos "deshabilitados" artificiales. */
const MIN_COMBINED_EFFICIENCY = 0.01;
/** Evita ciclo efectivo 0 cuando falta capacidad/tiempos en UI; mantiene métricas acotadas sin anular toda la línea. */
const MIN_STAGE_TIME_SECONDS = 0.5;

export function deepCopy(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeEfficiency(raw) {
  const val = toFiniteNumber(raw, 1);
  if (val <= 0) return 0.01;
  if (val <= 1) return val;
  return val / 100;
}

function normalizePos(p) {
  if (Array.isArray(p) && p.length >= 3) return [toFiniteNumber(p[0]), toFiniteNumber(p[1]), toFiniteNumber(p[2])];
  return [toFiniteNumber(p?.x), toFiniteNumber(p?.y), toFiniteNumber(p?.z)];
}

export function sortMachinesByProcessOrder(machines) {
  return [...machines].sort((a, b) => {
    const orderA = toFiniteNumber(a?.processOrder, Number.MAX_SAFE_INTEGER);
    const orderB = toFiniteNumber(b?.processOrder, Number.MAX_SAFE_INTEGER);
    if (orderA !== orderB) return orderA - orderB;
    const [ax] = normalizePos(a?.position);
    const [bx] = normalizePos(b?.position);
    return ax - bx;
  });
}

export function normalizeProcessOrder(machines) {
  return sortMachinesByProcessOrder(machines).map((m, idx) => ({ ...m, processOrder: idx + 1 }));
}

function machineOperators(cfg) {
  const raw = cfg?.operators ?? cfg?.operatorCount;
  return Math.max(0, Math.floor(toFiniteNumber(raw, 1)));
}

function machineCostPerHour(cfg) {
  return Math.max(0, toFiniteNumber(cfg?.costPerHour, 50));
}

/**
 * Producción por minuto (modelo de negocio): (capacidad / tiempo_proceso_seg) × operadores.
 * Evita división por cero en tiempo de proceso.
 */
function productionPerMinuteFromMachine(machine) {
  const cfg = machine?.config ?? {};
  const capacity = Math.max(0, toFiniteNumber(cfg.capacity, 0));
  const processSeconds = Math.max(0, toFiniteNumber(cfg.processTime, 0));
  const denom = Math.max(processSeconds, 1e-9);
  const ops = machineOperators(cfg);
  const raw = safeDivide(capacity * ops, denom, 0);
  return finiteNonNegative(raw, 0);
}

function timePerPieceFromMachine(machine) {
  const cfg = machine?.config ?? {};
  // processTime y queueTime están siempre en segundos (el modal muestra minutos y convierte al guardar).
  // Solo eficiencia técnica afecta tiempos de ciclo visual/simulación (sin skillLevel ni operadores).
  const processSeconds = Math.max(0, toFiniteNumber(cfg.processTime, 0));
  const queueSeconds = Math.max(0, toFiniteNumber(cfg.queueTime, 0));
  const capacityPerHour = Math.max(0, toFiniteNumber(cfg.capacity, 0));
  const efficiency = normalizeEfficiency(cfg.efficiency);
  const combinedEfficiency = Math.min(1.6, Math.max(MIN_COMBINED_EFFICIENCY, efficiency));
  const productionCapacityPerHour = capacityPerHour * combinedEfficiency;
  const adjustedProcessSeconds = processSeconds / combinedEfficiency;
  const baseSeconds = adjustedProcessSeconds + queueSeconds;
  const capacitySeconds =
    productionCapacityPerHour > 1e-12 ? safeDivide(3600, productionCapacityPerHour, 0) : 0;
  const effective = Math.max(
    finiteNonNegative(baseSeconds, 0),
    finiteNonNegative(capacitySeconds, 0)
  );
  if (!Number.isFinite(effective)) return STATION_DISABLED_TIME;
  return Math.max(MIN_STAGE_TIME_SECONDS, effective);
}

function buildScenarioStages(machines) {
  const ordered = sortMachinesByProcessOrder(
    machines.filter((m) => m?.id && m?.type && m?.config)
  );
  return [0, 1, 2].map((idx) => {
    const machine = ordered[idx] ?? null;
    const stageTime = machine ? timePerPieceFromMachine(machine) : STATION_DISABLED_TIME;
    const energy = Math.max(0, toFiniteNumber(machine?.config?.energy, 0));
    return { machine, stageTime, energy, stageIndex: idx };
  });
}

function cycleAndBottleneck(stages) {
  const activeStages = stages.filter((s) => s.machine);
  if (activeStages.length === 0) {
    return { totalCycleTime: STATION_DISABLED_TIME, bottleneck: '-' };
  }
  const times = activeStages.map((s) =>
    Number.isFinite(s.stageTime) ? s.stageTime : STATION_DISABLED_TIME
  );
  const disabled = times.some((t) => t >= STATION_DISABLED_TIME);
  let bottleneckStage = activeStages[0];
  for (const s of activeStages) {
    const st = Number.isFinite(s.stageTime) ? s.stageTime : 0;
    const bt = Number.isFinite(bottleneckStage.stageTime) ? bottleneckStage.stageTime : 0;
    if (st > bt) bottleneckStage = s;
  }
  const lineSum = disabled
    ? STATION_DISABLED_TIME
    : finiteNonNegative(
        times.reduce((sum, t) => sum + finiteNonNegative(t, 0), 0) + activeStages.length,
        STATION_DISABLED_TIME
      );
  return {
    totalCycleTime: lineSum,
    bottleneck: `Estación ${Number(bottleneckStage.stageIndex ?? 0) + 1}`,
  };
}

function totalsFromStages(stages) {
  const activeStages = stages.filter((s) => s.machine);
  if (activeStages.length === 0) {
    return sanitizeTotalsSnapshot({
      produccionPorMinuto: 0,
      produccionPorHora: 0,
      costoTotalPorHora: 0,
      costoPorProducto: 0,
    });
  }
  const rates = activeStages.map((s) => productionPerMinuteFromMachine(s.machine));
  const safeRates = rates.map((r) => finiteNonNegative(r, 0));
  const prodPerMin =
    safeRates.length > 0 ? Math.min(...safeRates) : 0;
  const prodPerHour = finiteNonNegative(prodPerMin * 60, 0);
  const laborCostPerHour = finiteNonNegative(
    activeStages.reduce((sum, s) => {
      const cfg = s.machine.config ?? {};
      const term = machineOperators(cfg) * machineCostPerHour(cfg);
      return sum + finiteNonNegative(term, 0);
    }, 0),
    0
  );
  const energyCostPerHour = finiteNonNegative(
    activeStages.reduce(
      (sum, s) => sum + finiteNonNegative(s.energy, 0) * ENERGY_COST_PER_UNIT,
      0
    ),
    0
  );
  const costoTotalPorHora = finiteNonNegative(laborCostPerHour + energyCostPerHour, 0);
  const costoPorProducto = safeDivide(laborCostPerHour, prodPerHour, 0);
  return sanitizeTotalsSnapshot({
    produccionPorMinuto: prodPerMin,
    produccionPorHora: prodPerHour,
    costoTotalPorHora,
    costoPorProducto,
  });
}

function buildScenarioState(machines) {
  const stages = buildScenarioStages(machines);
  const config = {
    e1: finiteNonNegative(stages[0].stageTime, STATION_DISABLED_TIME),
    e2: finiteNonNegative(stages[1].stageTime, STATION_DISABLED_TIME),
    e3: finiteNonNegative(stages[2].stageTime, STATION_DISABLED_TIME),
  };
  const cycle = sanitizeCycleSnapshot(cycleAndBottleneck(stages));
  const totals = totalsFromStages(stages);
  return { config, cycle, totals, stages };
}

/**
 * Clona la línea "Antes" hacia "Después": mismas posiciones locales en el piso de Después.
 * La separación visual Antes vs Después la aporta el grupo 3D (offsets distintos), no desplazamientos aquí.
 */
export function deriveAfterSimulationMachines(baseMachines) {
  const ordered = normalizeProcessOrder(baseMachines.filter((m) => m?.id && m?.type && m?.config));
  return ordered.map((raw, idx) => {
    const m = deepCopy(raw);
    const [x, y, z] = normalizePos(m.position);
    return {
      ...m,
      id: `${m.id}__after`,
      sourceId: m.id,
      simId: 'despues',
      processOrder: idx + 1,
      position: [x, y, z],
    };
  });
}

export function buildSceneSimulationState(antesMachines, despuesMachines) {
  return {
    antes: buildScenarioState(antesMachines),
    despues: buildScenarioState(despuesMachines),
  };
}
