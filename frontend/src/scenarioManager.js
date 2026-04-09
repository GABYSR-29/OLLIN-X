/**
 * Sistema de escenarios guardados.
 * Exportar/Importar configuración en JSON. No conoce Three.js ni React.
 */

const STORAGE_KEY = 'ollinx-scenarios';
const VERSION = 1;

export function exportScenario(stationsAntes, stationsDespues, nombre = 'Escenario') {
  const data = {
    version: VERSION,
    nombre,
    fecha: new Date().toISOString(),
    antes: stationsAntes.map(sanitizeForExport),
    despues: stationsDespues.map(sanitizeForExport),
  };
  return JSON.stringify(data, null, 2);
}

function sanitizeForExport(st) {
  return {
    id: st.id,
    nombre: st.nombre,
    tipoMaquina: st.tipoMaquina,
    posicion: { ...st.posicion },
    activa: st.activa,
    cantidadTrabajadores: st.cantidadTrabajadores,
    salarioPorHora: st.salarioPorHora,
    produccionPorMinutoPorTrabajador: st.produccionPorMinutoPorTrabajador,
    tiempoProduccionMinutos: st.tiempoProduccionMinutos,
    unidadesObjetivo: st.unidadesObjetivo,
    recursosUtilizados: st.recursosUtilizados,
    metodoProductividadSeleccionado: st.metodoProductividadSeleccionado,
  };
}

export function importScenario(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data.version || data.version > VERSION) return { ok: false, error: 'Versión no soportada' };
    const antes = (data.antes ?? []).map(restoreStation);
    const despues = (data.despues ?? []).map(restoreStation);
    return { ok: true, antes, despues, nombre: data.nombre ?? 'Importado' };
  } catch (e) {
    return { ok: false, error: e.message || 'JSON inválido' };
  }
}

function restoreStation(obj) {
  return {
    id: obj.id ?? `station-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    nombre: obj.nombre ?? 'Estación',
    tipoMaquina: obj.tipoMaquina ?? 'mezclado',
    modelo3DReferencia: obj.modelo3DReferencia ?? null,
    posicion: obj.posicion ?? { x: 0, y: 0, z: 0 },
    activa: obj.activa ?? true,
    escenario: obj.escenario ?? 'antes',
    cantidadTrabajadores: obj.cantidadTrabajadores ?? 1,
    salarioPorHora: obj.salarioPorHora ?? 150,
    produccionPorMinutoPorTrabajador: obj.produccionPorMinutoPorTrabajador ?? 2,
    tiempoProduccionMinutos: obj.tiempoProduccionMinutos ?? 60,
    unidadesObjetivo: obj.unidadesObjetivo ?? 100,
    recursosUtilizados: obj.recursosUtilizados ?? 1,
    metodoProductividadSeleccionado: obj.metodoProductividadSeleccionado ?? 'por_empleado',
  };
}

export function saveToStorage(key, scenario) {
  try {
    const json = typeof scenario === 'string' ? scenario : exportScenario(scenario.antes, scenario.despues, scenario.nombre);
    localStorage.setItem(`${STORAGE_KEY}-${key}`, json);
    return true;
  } catch {
    return false;
  }
}

export function loadFromStorage(key) {
  try {
    const json = localStorage.getItem(`${STORAGE_KEY}-${key}`);
    if (!json) return { ok: false, error: 'No encontrado' };
    return importScenario(json);
  } catch (e) {
    return { ok: false, error: e.message ?? 'Error' };
  }
}

export function listStoredScenarios() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(STORAGE_KEY + '-')) keys.push(k.replace(STORAGE_KEY + '-', ''));
  }
  return keys;
}
