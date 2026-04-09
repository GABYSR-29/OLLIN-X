/**
 * Base URL del backend (sin barra final).
 * Forzada para producción sin depender de VITE_API_URL ni runtime-config.
 */
export function getApiBaseUrl() {
  const hardcoded = 'https://ollinx-backend-1044081183690.us-central1.run.app';

  if (typeof window !== 'undefined') {
    console.log('[FIX IA] Usando backend:', hardcoded);
  }

  return hardcoded;
}

/**
 * @param {string} path - ruta que empieza con /, p.ej. /api/ai/analyze
 */
export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl();
  return base ? `${base}${p}` : p;
}
