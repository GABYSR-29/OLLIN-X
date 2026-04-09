/**
 * Capa de validación numérica para métricas derivadas del simulador.
 * No altera la lógica de negocio; solo asegura salidas finitas y operaciones seguras.
 */

export function finiteNonNegative(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

/** Cociente seguro: nunca NaN ni Infinity por división. */
export function safeDivide(numerator, denominator, fallback = 0) {
  const a = Number(numerator);
  const b = Number(denominator);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return fallback;
  const q = a / b;
  return Number.isFinite(q) ? q : fallback;
}

/**
 * Garantiza objeto de totales con cuatro claves numéricas finitas ≥ 0.
 */
export function sanitizeTotalsSnapshot(raw) {
  const pm = finiteNonNegative(raw?.produccionPorMinuto, 0);
  const ph = finiteNonNegative(raw?.produccionPorHora, 0);
  const ch = finiteNonNegative(raw?.costoTotalPorHora, 0);
  const cp = finiteNonNegative(raw?.costoPorProducto, 0);
  return {
    produccionPorMinuto: pm,
    produccionPorHora: ph,
    costoTotalPorHora: ch,
    costoPorProducto: cp,
  };
}

export function sanitizeCycleSnapshot(raw) {
  const t = Number(raw?.totalCycleTime);
  const bottleneck = typeof raw?.bottleneck === 'string' && raw.bottleneck.trim() !== ''
    ? raw.bottleneck
    : '-';
  return {
    totalCycleTime: Number.isFinite(t) ? t : 9999,
    bottleneck,
  };
}
