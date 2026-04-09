import { useId } from 'react';
import '../App.css';

/** Config interna sigue en segundos; la UI de estos campos usa minutos. */
const SECONDS_PER_MINUTE = 60;
const TIME_FIELDS_MINUTES_UI = new Set(['processTime', 'queueTime']);

const LABELS = {
  operators: 'Número de operadores',
  costPerHour: 'Costo por hora por operador ($)',
  capacity: 'Capacidad (kg/h)',
  processTime: 'Tiempo de proceso (min)',
  energy: 'Consumo energético (kWh)',
  efficiency: 'Eficiencia (%)',
  queueTime: 'Tiempo de espera (min)',
};

/** Textos de ayuda bajo cada campo (solo UI). */
const FIELD_HINTS = {
  processOrder:
    'Define el orden en el flujo de producción. Determina en qué posición se ejecuta esta máquina.',
  operators:
    'Cantidad de personas asignadas a esta estación. Puede influir en la capacidad y velocidad del proceso.',
  costPerHour:
    'Costo asociado a cada operador por hora. Se utiliza para calcular el gasto operativo.',
  capacity:
    'Cantidad máxima que esta máquina puede procesar por hora. Un valor bajo puede generar cuellos de botella.',
  processTime:
    'Tiempo que tarda cada unidad en procesarse. Valores altos pueden ralentizar toda la línea.',
  energy:
    'Energía consumida por la máquina durante su operación. Impacta directamente en los costos.',
  efficiency:
    'Nivel de rendimiento de la máquina. Valores bajos simulan fallos, pausas o pérdida de productividad.',
  queueTime:
    'Tiempo que el material permanece en espera antes de procesarse. Puede indicar ineficiencias o saturación.',
};

const TIME_FIELD_PLACEHOLDER = 'Ej: 2 o 1.5';

/** Valor del input en minutos; vacío si no hay tiempo guardado (0 s) para mostrar placeholder. */
function minutesFieldDisplayValue(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return '';
  return s / SECONDS_PER_MINUTE;
}

function minutesInputToSeconds(minutesRaw) {
  const m = parseFloat(String(minutesRaw).replace(',', '.'));
  if (!Number.isFinite(m)) return 0;
  return Math.max(0, m * SECONDS_PER_MINUTE);
}

export default function MachineConfigModal({
  open,
  title = 'Configuración de máquina',
  draft,
  processOrder = 1,
  onChange,
  onChangeOrder,
  onSave,
  onCancel,
}) {
  const formUid = useId();

  if (!open || !draft) return null;

  function setField(key, value) {
    if (TIME_FIELDS_MINUTES_UI.has(key)) {
      onChange({ ...draft, [key]: minutesInputToSeconds(value) });
      return;
    }
    const n = key === 'operators' ? parseInt(value, 10) : parseFloat(value);
    onChange({ ...draft, [key]: Number.isFinite(n) ? n : 0 });
  }

  return (
    <div className="machine-modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="machine-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="machine-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="machine-modal-title">{title}</h2>
        <div className="machine-modal-fields">
          <label className="machine-modal-field">
            <span>Orden de proceso</span>
            <input
              type="number"
              step="1"
              min="1"
              value={processOrder ?? 1}
              onChange={(e) => onChangeOrder?.(Math.max(1, parseInt(e.target.value || '1', 10)))}
              aria-describedby={`${formUid}-hint-processOrder`}
            />
            <p id={`${formUid}-hint-processOrder`} className="machine-modal-field-hint">
              {FIELD_HINTS.processOrder}
            </p>
          </label>
          {Object.entries(LABELS).map(([key, label]) => {
            const intKey = key === 'operators';
            const displayMinutes = TIME_FIELDS_MINUTES_UI.has(key);
            const inputValue = displayMinutes ? minutesFieldDisplayValue(draft[key]) : draft[key] ?? '';
            const hintId = `${formUid}-hint-${key}`;

            if (displayMinutes) {
              return (
                <label key={key} className="machine-modal-field machine-modal-field--time-min">
                  <span>{label}</span>
                  <div className="machine-modal-time-input-row">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      inputMode="decimal"
                      placeholder={TIME_FIELD_PLACEHOLDER}
                      value={inputValue}
                      onChange={(e) => setField(key, e.target.value)}
                      aria-describedby={hintId}
                    />
                    <span className="machine-modal-time-unit" aria-hidden="true">
                      min
                    </span>
                  </div>
                  <p id={hintId} className="machine-modal-field-hint">
                    {FIELD_HINTS[key]}
                  </p>
                </label>
              );
            }

            return (
              <label key={key} className="machine-modal-field">
                <span>{label}</span>
                <input
                  type="number"
                  step={intKey ? '1' : 'any'}
                  min="0"
                  value={inputValue}
                  onChange={(e) => setField(key, e.target.value)}
                  aria-describedby={hintId}
                />
                <p id={hintId} className="machine-modal-field-hint">
                  {FIELD_HINTS[key]}
                </p>
              </label>
            );
          })}
        </div>
        <div className="machine-modal-actions">
          <button type="button" className="machine-modal-btn secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="machine-modal-btn primary" onClick={onSave}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
