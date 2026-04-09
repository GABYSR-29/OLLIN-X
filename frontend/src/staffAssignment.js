/**
 * Módulo de configuración industrial por estación.
 * Sistema numérico: cantidad de trabajadores, salarios, producción.
 * No conoce Three.js ni React. Preparado para simulación de ganancias, costos e IA.
 */

const STATION_DISABLED_TIME = 9999;

const STATION_NAMES = ['Mezclado', 'Horneado', 'Empaque'];
const TIPOS_PROCESO = ['mezclado', 'horneado', 'empaque'];

const DEFAULTS = {
  cantidadTrabajadores: 1,
  salarioPorHora: 150,
  produccionPorMinuto: 2,
};

let stationsAntes = null;
let stationsDespues = null;

/**
 * @typedef {Object} StationConfig
 * @property {number} index
 * @property {string} simId
 * @property {string} nombre
 * @property {string} tipoProceso
 * @property {number} cantidadTrabajadores
 * @property {number} salarioPorHora
 * @property {number} produccionPorMinuto
 */

function createStation(index, simId) {
  return {
    index,
    simId,
    nombre: STATION_NAMES[index - 1],
    tipoProceso: TIPOS_PROCESO[index - 1],
    cantidadTrabajadores: DEFAULTS.cantidadTrabajadores,
    salarioPorHora: DEFAULTS.salarioPorHora,
    produccionPorMinuto: DEFAULTS.produccionPorMinuto,
  };
}

function initStations() {
  stationsAntes = [
    createStation(1, 'antes'),
    createStation(2, 'antes'),
    createStation(3, 'antes'),
  ];
  stationsDespues = [
    createStation(1, 'despues'),
    createStation(2, 'despues'),
    createStation(3, 'despues'),
  ];
}

function getStations(simId) {
  const stations = simId === 'antes' ? stationsAntes : stationsDespues;
  return stations ? [...stations] : [];
}

function getStation(simId, index) {
  const stations = simId === 'antes' ? stationsAntes : stationsDespues;
  return stations?.find((s) => s.index === index) ?? null;
}

function updateStation(simId, stationIndex, updates) {
  const station = getStation(simId, stationIndex);
  if (!station) return false;
  if (updates.cantidadTrabajadores !== undefined)
    station.cantidadTrabajadores = Math.max(0, Math.floor(Number(updates.cantidadTrabajadores)) || 0);
  if (updates.salarioPorHora !== undefined)
    station.salarioPorHora = Math.max(0, Number(updates.salarioPorHora) || 0);
  if (updates.produccionPorMinuto !== undefined)
    station.produccionPorMinuto = Math.max(0, Number(updates.produccionPorMinuto) || 0);
  return true;
}

/**
 * Calcula métricas industriales de una estación.
 */
function getStationCalculations(station) {
  const cantidad = station?.cantidadTrabajadores ?? 0;
  if (cantidad === 0) {
    return {
      produccionTotalPorMinuto: 0,
      produccionTotalPorHora: 0,
      costoTotalPorHora: 0,
      costoPorProducto: 0,
      tiempoPorPieza: STATION_DISABLED_TIME,
    };
  }
  const prodPorMin = cantidad * (station.produccionPorMinuto ?? 0);
  const prodPorHora = prodPorMin * 60;
  const costoHora = cantidad * (station.salarioPorHora ?? 0);
  const tiempoPorPieza = prodPorMin > 0 ? 60 / prodPorMin : STATION_DISABLED_TIME;
  const costoProducto = prodPorHora > 0 ? costoHora / prodPorHora : 0;
  return {
    produccionTotalPorMinuto: prodPorMin,
    produccionTotalPorHora: prodPorHora,
    costoTotalPorHora: costoHora,
    costoPorProducto: costoProducto,
    tiempoPorPieza,
  };
}

/**
 * Tiempo efectivo de procesamiento (segundos por pieza).
 * Si cantidad = 0: estación no produce (STATION_DISABLED_TIME).
 */
function getEffectiveTime(station) {
  if (!station || (station.cantidadTrabajadores ?? 0) === 0) return STATION_DISABLED_TIME;
  const prod = station.cantidadTrabajadores * (station.produccionPorMinuto ?? 0);
  if (prod <= 0) return STATION_DISABLED_TIME;
  return Math.max(0.1, 60 / prod);
}

/**
 * Config efectiva { e1, e2, e3 } para el engine.
 */
function getEffectiveConfig(simId) {
  const stations = simId === 'antes' ? stationsAntes : stationsDespues;
  if (!stations) return null;
  return {
    e1: getEffectiveTime(stations[0]),
    e2: getEffectiveTime(stations[1]),
    e3: getEffectiveTime(stations[2]),
  };
}

/**
 * Totales por simulación (límite por cuello de botella).
 */
function getSimulationTotals(simId) {
  const stations = simId === 'antes' ? stationsAntes : stationsDespues;
  if (!stations) return null;
  const calcs = stations.map(getStationCalculations);
  const minProdPorMin = Math.min(...calcs.map((c) => c.produccionTotalPorMinuto || Infinity));
  const prodLimitada = minProdPorMin === Infinity ? 0 : minProdPorMin;
  const costoTotalHora = calcs.reduce((s, c) => s + c.costoTotalPorHora, 0);
  const prodPorHora = prodLimitada * 60;
  const costoProductoTotal = prodPorHora > 0 ? costoTotalHora / prodPorHora : 0;
  return {
    produccionPorMinuto: prodLimitada,
    produccionPorHora: prodLimitada * 60,
    costoTotalPorHora: costoTotalHora,
    costoPorProducto: costoProductoTotal,
    porEstacion: calcs,
  };
}

export function createStaffManager() {
  if (!stationsAntes || !stationsDespues) initStations();

  return {
    getStations,
    getStation,
    updateStation,
    getStationCalculations,
    getEffectiveConfig,
    getEffectiveTime,
    getSimulationTotals,
    getStationsAntes: () => getStations('antes'),
    getStationsDespues: () => getStations('despues'),
  };
}
