/**
 * Gestor central de estaciones. Integra modelo, productividad y simulación.
 * No conoce Three.js ni React. Fuente de verdad para estaciones.
 * Compatible con simulationEngine (e1, e2, e3) y productividad avanzada.
 */

import { createStation, updateStation as updateStationModel } from './stationModel';
import { calcStationFull } from './productivityModule';
import { TIPOS_MAQUINA } from './machineCatalog';

const STATION_DISABLED_TIME = 9999;
const STATION_NAMES = ['Mezclado', 'Horneado', 'Empaque'];

let stationsAntes = [];
let stationsDespues = [];
let listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn());
}

function ensureStations() {
  if (stationsAntes.length === 0) {
    stationsAntes = [
      createStation({ index: 1, nombre: STATION_NAMES[0], tipoMaquina: TIPOS_MAQUINA.MEZCLADO, escenario: 'antes', posicion: { x: -4, y: 0, z: 0 } }),
      createStation({ index: 2, nombre: STATION_NAMES[1], tipoMaquina: TIPOS_MAQUINA.HORNEADO, escenario: 'antes', posicion: { x: 0, y: 0, z: 0 } }),
      createStation({ index: 3, nombre: STATION_NAMES[2], tipoMaquina: TIPOS_MAQUINA.EMPAQUE, escenario: 'antes', posicion: { x: 4, y: 0, z: 0 } }),
    ];
  }
  if (stationsDespues.length === 0) {
    stationsDespues = [
      createStation({ index: 1, nombre: STATION_NAMES[0], tipoMaquina: TIPOS_MAQUINA.MEZCLADO, escenario: 'despues', posicion: { x: -4, y: 0, z: 0 } }),
      createStation({ index: 2, nombre: STATION_NAMES[1], tipoMaquina: TIPOS_MAQUINA.HORNEADO, escenario: 'despues', posicion: { x: 0, y: 0, z: 0 } }),
      createStation({ index: 3, nombre: STATION_NAMES[2], tipoMaquina: TIPOS_MAQUINA.EMPAQUE, escenario: 'despues', posicion: { x: 4, y: 0, z: 0 } }),
    ];
  }
}

/**
 * Tiempo efectivo (seg/pieza) para simulación. Si cantidad=0 → no produce.
 */
function getEffectiveTime(station) {
  const cantidad = station?.cantidadTrabajadores ?? 0;
  if (cantidad === 0) return STATION_DISABLED_TIME;
  const prod = cantidad * (station.produccionPorMinutoPorTrabajador ?? station.produccionPorMinuto ?? 0);
  if (prod <= 0) return STATION_DISABLED_TIME;
  return Math.max(0.1, 60 / prod);
}

function getEffectiveConfig(simId) {
  ensureStations();
  const stations = simId === 'antes' ? stationsAntes : stationsDespues;
  const first3 = stations.slice(0, 3);
  return {
    e1: getEffectiveTime(first3[0]),
    e2: getEffectiveTime(first3[1]),
    e3: getEffectiveTime(first3[2]),
  };
}

function getStationCalculations(station) {
  const s = { ...station, produccionPorMinutoPorTrabajador: station.produccionPorMinutoPorTrabajador ?? station.produccionPorMinuto };
  const full = calcStationFull(s);
  const cantidad = station?.cantidadTrabajadores ?? 0;
  const prodPorMin = cantidad * (station.produccionPorMinutoPorTrabajador ?? station.produccionPorMinuto ?? 0);
  const prodPorHora = prodPorMin * 60;
  const costoHora = cantidad * (station.salarioPorHora ?? 0);
  const costoProducto = prodPorHora > 0 ? costoHora / prodPorHora : 0;
  return {
    ...full,
    produccionTotalPorMinuto: prodPorMin,
    produccionTotalPorHora: prodPorHora,
    costoTotalPorHora: costoHora,
    costoPorProducto: costoProducto,
    tiempoPorPieza: cantidad > 0 && prodPorMin > 0 ? 60 / prodPorMin : STATION_DISABLED_TIME,
  };
}

function getStations(simId) {
  ensureStations();
  return simId === 'antes' ? [...stationsAntes] : [...stationsDespues];
}

function getStation(simId, idOrIndex) {
  ensureStations();
  const stations = simId === 'antes' ? stationsAntes : stationsDespues;
  if (typeof idOrIndex === 'number') return stations[idOrIndex - 1] ?? null;
  return stations.find((s) => s.id === idOrIndex) ?? null;
}

function getSimulationTotals(simId) {
  ensureStations();
  const stations = simId === 'antes' ? stationsAntes : stationsDespues;
  const first3 = stations.slice(0, 3);
  const calcs = first3.map(getStationCalculations);
  const minProd = Math.min(...calcs.map((c) => c.produccionTotalPorMinuto || Infinity));
  const prodLimitada = minProd === Infinity ? 0 : minProd;
  const costoTotalHora = calcs.reduce((s, c) => s + c.costoTotalPorHora, 0);
  const prodPorHora = prodLimitada * 60;
  return {
    produccionPorMinuto: prodLimitada,
    produccionPorHora: prodLimitada * 60,
    costoTotalPorHora: costoTotalHora,
    costoPorProducto: prodPorHora > 0 ? costoTotalHora / prodPorHora : 0,
    porEstacion: calcs,
  };
}

export function createStationsManager() {
  ensureStations();

  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    getStations,

    getStation,

    updateStation(simId, idOrIndex, updates) {
      const station = getStation(simId, idOrIndex);
      if (!station) return false;
      updateStationModel(station, updates);
      notify();
      return true;
    },

    addStation(simId, machineType, posicion = { x: 0, y: 0, z: 0 }) {
      ensureStations();
      const stations = simId === 'antes' ? stationsAntes : stationsDespues;
      const idx = stations.length + 1;
      const nombre = stations.length < 3 ? STATION_NAMES[stations.length] : `Estación ${idx}`;
      const st = createStation({
        nombre,
        tipoMaquina: machineType,
        escenario: simId,
        posicion: { ...posicion },
      });
      stations.push(st);
      notify();
      return st;
    },

    removeStation(simId, id) {
      const stations = simId === 'antes' ? stationsAntes : stationsDespues;
      const i = stations.findIndex((s) => s.id === id);
      if (i < 0) return false;
      stations.splice(i, 1);
      notify();
      return true;
    },

    setStations(simId, newStations) {
      if (simId === 'antes') stationsAntes = [...newStations];
      else stationsDespues = [...newStations];
      notify();
    },

    getEffectiveConfig,
    getStationCalculations,
    getSimulationTotals,
    getStationsAntes: () => getStations('antes'),
    getStationsDespues: () => getStations('despues'),
  };
}
