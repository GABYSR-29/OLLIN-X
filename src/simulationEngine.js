/**
 * Motor de simulación discreta por eventos.
 * Responsable de: spawn, estados de piezas, colas, ocupación de estaciones y métricas.
 * No conoce Three.js ni React.
 */

const TIEMPO_MOVIMIENTO = 1;
const INTERVALO_SPAWN = 3;
/** Separación entre piezas en cola; colas crecen en -Z por estación */
const OFFSET_COLA = 1.6;
const STATION_POSITIONS = [-4, 0, 4];
const Y_PIEZAS = 1.5;

export function createSimulationEngine() {
  let stationOccupiedBy = { 1: null, 2: null, 3: null };
  let stationQueues = { 1: [], 2: [], 3: [] };
  let pieces = [];
  let nextSpawnTime = 0;
  let nextId = 0;
  let tiempoTotal = [0, 0, 0];
  let tiempoOcupada = [0, 0, 0];
  let piezasProducidas = 0;
  let sumaTiemposCicloReal = 0;
  let cantidadCiclosCompletados = 0;

  function init(config = {}) {
    stationOccupiedBy = { 1: null, 2: null, 3: null };
    stationQueues = { 1: [], 2: [], 3: [] };
    pieces = [];
    nextSpawnTime = 0;
    nextId = 0;
    tiempoTotal = [0, 0, 0];
    tiempoOcupada = [0, 0, 0];
    piezasProducidas = 0;
    sumaTiemposCicloReal = 0;
    cantidadCiclosCompletados = 0;
  }

  function reset() {
    init();
  }

  function spawnPieza(nowSec, tiempos) {
    const estacionLibre = stationOccupiedBy[1] === null;
    const pieza = {
      id: nextId,
      estacionActual: 1,
      tiempoRestante: estacionLibre ? tiempos[0] : 0,
      estado: estacionLibre ? 'procesando' : 'esperando',
      moveProgress: 0,
      fromStation: 1,
      targetStation: 1,
      cycleStartTime: estacionLibre ? nowSec : 0,
    };
    pieces.push(pieza);
    if (estacionLibre) {
      stationOccupiedBy[1] = nextId;
    } else {
      stationQueues[1].push(nextId);
    }
    nextId += 1;
  }

  /**
   * Posiciones para renderizado. Colas crecen hacia atrás (-Z) por estación
   * para evitar amontonamiento y mostrar el cuello de botella visualmente.
   */
  function computePiecePosition(p) {
    const baseX = (s) => STATION_POSITIONS[s - 1];
    if (p.estado === 'procesando') {
      return { x: baseX(p.estacionActual), y: Y_PIEZAS, z: 0 };
    }
    if (p.estado === 'esperando') {
      const cola = stationQueues[p.estacionActual];
      const idx = cola.indexOf(p.id);
      const offsetZ = (idx + 1) * OFFSET_COLA;
      return { x: baseX(p.estacionActual), y: Y_PIEZAS, z: -offsetZ };
    }
    const fromX = baseX(p.fromStation);
    const toX = baseX(p.targetStation);
    const u = Math.min(1, p.moveProgress);
    const x = fromX + (toX - fromX) * u;
    return { x, y: Y_PIEZAS, z: 0 };
  }

  /**
   * Avanza la simulación un paso.
   * @param {number} delta - Segundos transcurridos
   * @param {number} nowSec - Tiempo actual en segundos
   * @param {{ e1: number, e2: number, e3: number }} config - Tiempos por estación
   * @returns {{ removedIds: number[], newPieceIds: number[] }}
   */
  function update(delta, nowSec, config) {
    const tiempos = [config.e1, config.e2, config.e3];
    const removedIds = [];
    const newPieceIds = [];

    if (nowSec >= nextSpawnTime) {
      spawnPieza(nowSec, tiempos);
      newPieceIds.push(nextId - 1);
      nextSpawnTime = nowSec + INTERVALO_SPAWN;
    }

    for (let s = 1; s <= 3; s++) {
      tiempoTotal[s - 1] += delta;
      if (stationOccupiedBy[s] !== null) tiempoOcupada[s - 1] += delta;
    }

    const toRemove = [];
    pieces.forEach((p) => {
      if (p.estado !== 'procesando') return;
      p.tiempoRestante -= delta;
      if (p.tiempoRestante > 0) return;

      const s = p.estacionActual;
      stationOccupiedBy[s] = null;

      if (s === 3) {
        piezasProducidas += 1;
        sumaTiemposCicloReal += nowSec - p.cycleStartTime;
        cantidadCiclosCompletados += 1;
        removedIds.push(p.id);
        toRemove.push(p);
      } else {
        const siguienteEstacion = s + 1;
        const cola = stationQueues[s];
        if (cola.length > 0) {
          const siguienteId = cola.shift();
          const siguiente = pieces.find((x) => x.id === siguienteId);
          if (siguiente) {
            siguiente.estado = 'procesando';
            siguiente.tiempoRestante = tiempos[s - 1];
            stationOccupiedBy[s] = siguienteId;
            if (s === 1) siguiente.cycleStartTime = nowSec;
          }
        }
        p.estado = 'moviendo';
        p.fromStation = s;
        p.targetStation = siguienteEstacion;
        p.moveProgress = 0;
        p.estacionActual = siguienteEstacion;
      }
    });

    pieces = pieces.filter((p) => !toRemove.includes(p));

    pieces.forEach((p) => {
      if (p.estado !== 'moviendo') return;
      p.moveProgress += delta / TIEMPO_MOVIMIENTO;
      if (p.moveProgress < 1) return;

      p.moveProgress = 1;
      const t = p.targetStation;
      const ocupada = stationOccupiedBy[t] !== null;

      if (ocupada) {
        p.estado = 'esperando';
        stationQueues[t].push(p.id);
      } else {
        p.estado = 'procesando';
        p.tiempoRestante = tiempos[t - 1];
        stationOccupiedBy[t] = p.id;
        if (t === 1) p.cycleStartTime = nowSec;
      }
    });

    return { removedIds, newPieceIds };
  }

  /**
   * Devuelve el estado actual para renderizado y métricas.
   */
  function getState() {
    const piecesForRender = pieces.map((p) => ({
      id: p.id,
      ...computePiecePosition(p),
    }));
    const primera = pieces[0];
    return {
      pieces: piecesForRender,
      primeraPiezaEstacion: primera ? primera.estacionActual : '-',
      metrics: {
        piezasProducidas,
        sumaTiemposCicloReal,
        cantidadCiclosCompletados,
        tiempoTotal: [...tiempoTotal],
        tiempoOcupada: [...tiempoOcupada],
      },
    };
  }

  return {
    init,
    reset,
    update,
    getState,
  };
}
