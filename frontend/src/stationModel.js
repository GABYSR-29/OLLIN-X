/**
 * Modelo de datos de estaciones de producción.
 * No conoce Three.js ni React. Integra productividad y catálogo.
 */

import { METODOS_PRODUCTIVIDAD } from './productivityModule';
import { TIPOS_MAQUINA } from './machineCatalog';

let nextStationId = 1;

const DEFAULTS = {
  cantidadTrabajadores: 1,
  salarioPorHora: 150,
  produccionPorMinutoPorTrabajador: 2,
  tiempoProduccionMinutos: 60,
  unidadesObjetivo: 100,
  recursosUtilizados: 1,
  metodoProductividadSeleccionado: METODOS_PRODUCTIVIDAD.POR_EMPLEADO,
};

/**
 * Crea una estación con valores por defecto.
 */
export function createStation(config = {}) {
  const id = config.id ?? `station-${nextStationId++}`;
  return {
    id,
    nombre: config.nombre ?? 'Estación',
    tipoMaquina: config.tipoMaquina ?? TIPOS_MAQUINA.MEZCLADO,
    modelo3DReferencia: config.modelo3DReferencia ?? null,
    posicion: config.posicion ?? { x: 0, y: 0, z: 0 },
    activa: config.activa ?? true,
    escenario: config.escenario ?? 'antes',

    cantidadTrabajadores: config.cantidadTrabajadores ?? DEFAULTS.cantidadTrabajadores,
    salarioPorHora: config.salarioPorHora ?? DEFAULTS.salarioPorHora,
    produccionPorMinutoPorTrabajador: config.produccionPorMinutoPorTrabajador ?? DEFAULTS.produccionPorMinutoPorTrabajador,
    tiempoProduccionMinutos: config.tiempoProduccionMinutos ?? DEFAULTS.tiempoProduccionMinutos,
    unidadesObjetivo: config.unidadesObjetivo ?? DEFAULTS.unidadesObjetivo,
    recursosUtilizados: config.recursosUtilizados ?? DEFAULTS.recursosUtilizados,

    produccionTotal: 0,
    costoTotal: 0,
    costoPorUnidad: 0,
    horasTrabajadas: 0,
    productividadResultado: 0,
    metodoProductividadSeleccionado: config.metodoProductividadSeleccionado ?? DEFAULTS.metodoProductividadSeleccionado,
  };
}

/**
 * Valida y sanitiza un valor numérico.
 */
function safeNum(val, min = 0, def = 0) {
  const n = Number(val);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, n);
}

/**
 * Actualiza campos de una estación.
 */
export function updateStation(station, updates) {
  if (!station) return station;

  const keys = [
    'nombre', 'tipoMaquina', 'modelo3DReferencia', 'posicion', 'activa', 'escenario',
    'cantidadTrabajadores', 'salarioPorHora', 'produccionPorMinutoPorTrabajador',
    'tiempoProduccionMinutos', 'unidadesObjetivo', 'recursosUtilizados',
    'metodoProductividadSeleccionado',
  ];

  keys.forEach((k) => {
    if (updates[k] === undefined) return;
    if (k === 'posicion') {
      station.posicion = { ...station.posicion, ...updates.posicion };
    } else if (k === 'cantidadTrabajadores' || k === 'recursosUtilizados' || k === 'unidadesObjetivo') {
      station[k] = Math.floor(safeNum(updates[k], 0, station[k]));
    } else if (['salarioPorHora', 'produccionPorMinutoPorTrabajador', 'tiempoProduccionMinutos'].includes(k)) {
      station[k] = safeNum(updates[k], 0, station[k]);
    } else {
      station[k] = updates[k];
    }
  });

  return station;
}
