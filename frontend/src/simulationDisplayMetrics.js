/**
 * Une la métrica “en fórmula” (sceneSimulation) con la métrica “en tiempo real”
 * del flujo 3D cuando la simulación está activa, para que dashboard y paneles
 * reflejen el mismo comportamiento que las alertas basadas en throughput.
 */

const CICLO_SENTINEL = 9999;

function finite(n, fb = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fb;
}

/**
 * @returns {{ produccionPorMinuto, produccionPorHora, costoTotalPorHora, costoPorProducto, cicloSeg, cuello }}
 */
export function buildDisplayScenarioMetrics({
  totales,
  metricas,
  elapsedSec,
  simulationActive,
  tiempoTotalCicloFormula,
  cuelloFormula,
  /** Si el ciclo agregado viene como “deshabilitado” pero hay tiempos de etapa válidos, Úsese esta suma aproximada. */
  cicloFallbackSec = null,
}) {
  const costoHora = finite(totales?.costoTotalPorHora, 0);
  let pm = finite(totales?.produccionPorMinuto, 0);
  let ph = finite(totales?.produccionPorHora, 0);

  const el = finite(elapsedSec, 0);
  const piezas = finite(metricas?.piezasProducidas, 0);

  if (simulationActive && el > 0.5) {
    const livePm = piezas / (el / 60);
    if (Number.isFinite(livePm) && livePm > 0) {
      pm = livePm;
      ph = pm * 60;
    }
  }

  let cicloSeg = finite(tiempoTotalCicloFormula, CICLO_SENTINEL);
  const ciclos = finite(metricas?.cantidadCiclosCompletados, 0);
  const sumaReal = finite(metricas?.sumaTiemposCicloReal, 0);
  if (
    simulationActive &&
    ciclos > 0 &&
    sumaReal > 0 &&
    (!Number.isFinite(cicloSeg) || cicloSeg >= CICLO_SENTINEL)
  ) {
    cicloSeg = sumaReal / ciclos;
  } else if (
    (!Number.isFinite(cicloSeg) || cicloSeg >= CICLO_SENTINEL) &&
    cicloFallbackSec != null &&
    Number.isFinite(cicloFallbackSec) &&
    cicloFallbackSec > 0 &&
    cicloFallbackSec < CICLO_SENTINEL
  ) {
    cicloSeg = cicloFallbackSec;
  }

  if (
    pm < 1e-9 &&
    cicloSeg > 0 &&
    cicloSeg < CICLO_SENTINEL &&
    (!simulationActive || piezas < 1)
  ) {
    const fromCycle = 60 / cicloSeg;
    if (Number.isFinite(fromCycle) && fromCycle > 0) {
      pm = fromCycle;
      ph = pm * 60;
    }
  }

  const costoProd = ph > 1e-12 ? costoHora / ph : finite(totales?.costoPorProducto, 0);

  const cuello =
    simulationActive && piezas > 0 && typeof metricas?.estacionCritica === 'string'
      ? metricas.estacionCritica
      : cuelloFormula;

  return {
    produccionPorMinuto: finite(pm, 0),
    produccionPorHora: finite(ph, 0),
    costoTotalPorHora: finite(costoHora, 0),
    costoPorProducto: finite(costoProd, 0),
    cicloSeg: finite(cicloSeg, CICLO_SENTINEL),
    cuello: cuello || '-',
  };
}
