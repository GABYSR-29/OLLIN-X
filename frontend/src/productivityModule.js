/**
 * Módulo de cálculo de productividad.
 * Lógica matemática pura. No conoce Three.js ni React.
 * Preparado para IA, ROI y punto de equilibrio.
 */

export const METODOS_PRODUCTIVIDAD = {
  POR_EMPLEADO: 'por_empleado',
  POR_HORA: 'por_hora',
  POR_UNIDAD_RECURSO: 'por_unidad_recurso',
  TOTAL_FACTORES: 'total_factores',
  GENERAL: 'general',
};

export const METODO_LABELS = {
  [METODOS_PRODUCTIVIDAD.POR_EMPLEADO]: 'Productividad por empleado',
  [METODOS_PRODUCTIVIDAD.POR_HORA]: 'Productividad por hora',
  [METODOS_PRODUCTIVIDAD.POR_UNIDAD_RECURSO]: 'Productividad por unidad de recurso',
  [METODOS_PRODUCTIVIDAD.TOTAL_FACTORES]: 'Productividad total de factores',
  [METODOS_PRODUCTIVIDAD.GENERAL]: 'Productividad general',
};

/**
 * Calcula métricas base de una estación.
 * @param {Object} station
 * @returns {{ produccionTotal, horasTrabajadas, costoTotal, costoPorUnidad, divisionPorCero }}
 */
export function calcBaseMetrics(station) {
  const cantidad = Math.max(0, Number(station.cantidadTrabajadores) || 0);
  const salario = Math.max(0, Number(station.salarioPorHora) || 0);
  const prodPorMin = Math.max(0, Number(station.produccionPorMinutoPorTrabajador) || 0);
  const tiempoMin = Math.max(0, Number(station.tiempoProduccionMinutos) || 0);
  const recursos = Math.max(0, Number(station.recursosUtilizados) || 0);

  const produccionTotal = cantidad * prodPorMin * tiempoMin;
  const horasTrabajadas = tiempoMin / 60;
  const costoTotal = cantidad * salario * horasTrabajadas;

  let costoPorUnidad = 0;
  let divisionPorCero = false;

  if (produccionTotal > 0) {
    costoPorUnidad = costoTotal / produccionTotal;
  } else {
    divisionPorCero = true;
  }

  return {
    produccionTotal,
    horasTrabajadas,
    costoTotal,
    costoPorUnidad,
    divisionPorCero,
    cantidad,
    recursos,
  };
}

/**
 * Aplica el método de productividad seleccionado.
 * @param {Object} base - resultado de calcBaseMetrics
 * @param {string} metodo
 * @returns {{ valor: number, divisionPorCero: boolean }}
 */
export function calcProductividad(base, metodo) {
  const { produccionTotal, horasTrabajadas, cantidad, recursos } = base;

  if (produccionTotal <= 0 || !Number.isFinite(produccionTotal)) {
    return { valor: 0, divisionPorCero: true };
  }

  switch (metodo) {
    case METODOS_PRODUCTIVIDAD.POR_EMPLEADO:
      if (cantidad <= 0) return { valor: 0, divisionPorCero: true };
      return { valor: produccionTotal / cantidad, divisionPorCero: false };

    case METODOS_PRODUCTIVIDAD.POR_HORA:
      if (horasTrabajadas <= 0) return { valor: 0, divisionPorCero: true };
      return { valor: produccionTotal / horasTrabajadas, divisionPorCero: false };

    case METODOS_PRODUCTIVIDAD.POR_UNIDAD_RECURSO:
      if (recursos <= 0) return { valor: 0, divisionPorCero: true };
      return { valor: produccionTotal / recursos, divisionPorCero: false };

    case METODOS_PRODUCTIVIDAD.TOTAL_FACTORES:
      if (cantidad + recursos <= 0) return { valor: 0, divisionPorCero: true };
      return { valor: produccionTotal / (cantidad + recursos), divisionPorCero: false };

    case METODOS_PRODUCTIVIDAD.GENERAL:
      if (recursos <= 0) return { valor: 0, divisionPorCero: true };
      return { valor: produccionTotal / recursos, divisionPorCero: false };

    default:
      return { valor: produccionTotal, divisionPorCero: false };
  }
}

/**
 * Calcula todas las métricas de una estación.
 */
export function calcStationFull(station) {
  const base = calcBaseMetrics(station);
  const metodo = station.metodoProductividadSeleccionado || METODOS_PRODUCTIVIDAD.POR_EMPLEADO;
  const prod = calcProductividad(base, metodo);

  return {
    ...base,
    productividadResultado: prod.valor,
    productividadDivisionPorCero: prod.divisionPorCero,
    metodoProductividadSeleccionado: metodo,
  };
}
