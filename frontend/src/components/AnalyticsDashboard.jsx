import { useCallback, useState } from 'react';
import { getApiBaseUrl } from '../config/api';

function fmt(value, digits = 2, suffix = '') {
  const n = Number(value);
  if (!Number.isFinite(n)) return `- ${suffix}`.trim();
  return `${n.toFixed(digits)}${suffix}`;
}

function diffMeta(before, after) {
  const b = Number.isFinite(Number(before)) ? Number(before) : 0;
  const a = Number.isFinite(Number(after)) ? Number(after) : 0;
  const diff = a - b;
  const pct =
    b !== 0 && Number.isFinite(b) && Number.isFinite(diff) ? (diff / b) * 100 : 0;
  const tone = diff > 0 ? 'improve' : diff < 0 ? 'worse' : 'neutral';
  return { diff, pct, tone };
}

function ComparisonRow({ label, before, after, unit = '', invert = false }) {
  const b = Number.isFinite(Number(before)) ? Number(before) : 0;
  const a = Number.isFinite(Number(after)) ? Number(after) : 0;
  const max = Math.max(Math.abs(b), Math.abs(a), 1);
  const beforeWidth = `${(Math.abs(b) / max) * 100}%`;
  const afterWidth = `${(Math.abs(a) / max) * 100}%`;
  const meta = diffMeta(b, a);
  const tone = invert
    ? meta.diff < 0 ? 'improve' : meta.diff > 0 ? 'worse' : 'neutral'
    : meta.tone;

  return (
    <div className="analytics-row">
      <div className="analytics-row-head">
        <strong>{label}</strong>
        <span className={`analytics-diff ${tone}`}>
          {`${meta.diff >= 0 ? '+' : ''}${fmt(meta.diff, 2, unit)} (${meta.pct >= 0 ? '+' : ''}${fmt(meta.pct, 1, '%')})`}
        </span>
      </div>
      <div className="analytics-values">
        <span>{`Antes: ${fmt(b, 2, unit)}`}</span>
        <span>{`Después: ${fmt(a, 2, unit)}`}</span>
      </div>
      <div className="analytics-bars">
        <div className="analytics-bar-track">
          <div className="analytics-bar before" style={{ width: beforeWidth }} />
        </div>
        <div className="analytics-bar-track">
          <div className="analytics-bar after" style={{ width: afterWidth }} />
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsDashboard({
  totalesAntes,
  totalesDespues,
  metricasAntes,
  metricasDespues,
  throughputAntes,
  throughputDespues,
  activeScenarioName,
  isUnsavedScenario,
  onExportPdf,
  isExporting,
  dashboardRef,
}) {
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState('');

  const buildPayload = useCallback(() => {
    return {
      escenario: activeScenarioName,
      totalesAntes: totalesAntes ?? null,
      totalesDespues: totalesDespues ?? null,
      metricasAntes: metricasAntes ?? null,
      metricasDespues: metricasDespues ?? null,
      throughputAntes,
      throughputDespues,
      leyendaDashboard: {
        verde: 'Mejora o impacto positivo: más producción/throughput es bueno; en costos, menor valor es bueno.',
        rojo: 'Empeoramiento o impacto negativo según esa misma lógica.',
        gris: 'Sin cambio o variación neutra entre Antes y Después.',
        porcentajes:
          'Los porcentajes indican la variación respecto al valor Antes: ((Después − Antes) / Antes) × 100 cuando Antes ≠ 0.',
      },
    };
  }, [
    activeScenarioName,
    totalesAntes,
    totalesDespues,
    metricasAntes,
    metricasDespues,
    throughputAntes,
    throughputDespues,
  ]);

  const handleAnalyzeAi = useCallback(async () => {
    setAiError('');
    setAiAnalysis('');
    setAiOpen(true);
    setAiLoading(true);
    try {
      const viteEnv = import.meta.env.VITE_API_URL || '';
      const apiBase = getApiBaseUrl();
      const targetUrl = apiBase
        ? `${String(apiBase).replace(/\/$/, '')}/api/ai/analyze`
        : '/api/ai/analyze';

      console.log('[OllinX IA] ENV VITE_API_URL (build):', viteEnv || '(vacío)');
      console.log(
        '[OllinX IA] window.__OLLINX_API_BASE__:',
        typeof window !== 'undefined' && window.__OLLINX_API_BASE__
          ? window.__OLLINX_API_BASE__
          : '(vacío)'
      );
      console.log(
        '[OllinX IA] DEBUG API_URL (efectiva = VITE_API_URL || __OLLINX_API_BASE__ || ""):',
        apiBase || '(vacío → /api relativo)'
      );

      let res;
      try {
        res = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: buildPayload() }),
        });
      } catch {
        throw new Error(
          'Error de conexión con el servidor. Comprueba que el backend esté accesible, CORS y PUBLIC_API_URL / VITE_API_URL.'
        );
      }

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const backendMsg =
          typeof body.message === 'string' && body.message.trim() !== ''
            ? body.message
            : null;
        if (res.status === 503 && backendMsg) {
          throw new Error(backendMsg);
        }
        if (res.status === 404 && !apiBase && import.meta.env.PROD) {
          throw new Error(
            'La petición no llegó al backend (404). Revisa que /runtime-config.js cargue desde la raíz y configura PUBLIC_API_URL o VITE_API_URL en el servicio del frontend (Cloud Run).'
          );
        }
        throw new Error(
          backendMsg ||
            `Error ${res.status}: respuesta no válida del servidor de análisis.`
        );
      }
      const text = body.analysis != null ? String(body.analysis).trim() : '';
      if (!text) {
        throw new Error('Respuesta sin análisis.');
      }
      setAiAnalysis(text);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'No se pudo obtener el análisis.');
    } finally {
      setAiLoading(false);
    }
  }, [buildPayload]);

  return (
    <section className="analytics-dashboard" ref={dashboardRef}>
      <div className="analytics-header">
        <div className="analytics-header-main">
          <h3>Dashboard Analítico</h3>
          <p>Comparador visual de rendimiento Antes vs Después</p>
          <div className={`analytics-scenario-tag ${isUnsavedScenario ? 'unsaved' : ''}`}>
            {`Escenario: ${activeScenarioName}`}
          </div>
        </div>
        <div className="analytics-header-actions">
          <button
            type="button"
            className="analytics-ai-btn"
            onClick={handleAnalyzeAi}
            disabled={aiLoading}
          >
            {aiLoading ? 'Analizando…' : 'Analizar con IA'}
          </button>
          <button type="button" className="analytics-export-btn" onClick={onExportPdf} disabled={isExporting}>
            {isExporting ? 'Exportando...' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      <div className="analytics-grid">
        <ComparisonRow
          label="Producción por minuto"
          before={totalesAntes?.produccionPorMinuto}
          after={totalesDespues?.produccionPorMinuto}
        />
        <ComparisonRow
          label="Producción por hora"
          before={totalesAntes?.produccionPorHora}
          after={totalesDespues?.produccionPorHora}
        />
        <ComparisonRow
          label="Costo por hora"
          before={totalesAntes?.costoTotalPorHora}
          after={totalesDespues?.costoTotalPorHora}
          unit="$"
          invert
        />
        <ComparisonRow
          label="Costo por producto"
          before={totalesAntes?.costoPorProducto}
          after={totalesDespues?.costoPorProducto}
          unit="$"
          invert
        />
        <ComparisonRow
          label="Throughput (piezas/min)"
          before={throughputAntes}
          after={throughputDespues}
        />
        <ComparisonRow
          label="Piezas producidas"
          before={metricasAntes?.piezasProducidas}
          after={metricasDespues?.piezasProducidas}
          unit=""
        />
      </div>

      {aiOpen && (
        <div className="ai-modal-backdrop" role="presentation" onClick={() => !aiLoading && setAiOpen(false)}>
          <div
            className="ai-modal"
            role="dialog"
            aria-labelledby="ai-modal-title"
            aria-busy={aiLoading}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ai-modal-header">
              <h4 id="ai-modal-title">Análisis con IA</h4>
              <button
                type="button"
                className="ai-modal-close"
                onClick={() => setAiOpen(false)}
                disabled={aiLoading}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <div className="ai-modal-body">
              {aiLoading && <p className="ai-modal-status">Generando explicación…</p>}
              {aiError && <p className="ai-modal-error">{aiError}</p>}
              {!aiLoading && aiAnalysis && (
                <pre className="ai-analysis-text">{aiAnalysis}</pre>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
