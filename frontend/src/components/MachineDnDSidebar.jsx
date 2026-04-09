import { useState, useEffect, useMemo } from 'react';
import {
  MACHINE_TYPES,
  MACHINE_TYPE_ORDER,
  DRAG_MIME,
  CUSTOMIZABLE_MACHINE_TYPE,
} from '../machineTypes';
import '../App.css';

const LS_CUSTOM_MACHINE_NAME = 'customMachineName';

function readStoredCustomName() {
  try {
    const v = localStorage.getItem(LS_CUSTOM_MACHINE_NAME);
    if (v == null) return null;
    const t = String(v).trim();
    return t.length > 0 ? t : null;
  } catch {
    return null;
  }
}

export default function MachineDnDSidebar({
  collapsed,
  onToggleCollapsed,
  selectedMachineId,
  machines,
  onSelectMachine,
  onEditConfig,
  onMoveOrderUp,
  onMoveOrderDown,
  onDeleteMachine,
  scenarioName,
  onScenarioNameChange,
  onSaveScenario,
  savedScenarios,
  onLoadScenario,
  onDeleteScenario,
  activeScenarioId,
}) {
  function handleDragStart(e, type) {
    e.dataTransfer.setData(DRAG_MIME, type);
    e.dataTransfer.setData('text/plain', type);
    e.dataTransfer.effectAllowed = 'copy';
    document.body.style.cursor = 'grabbing';
  }

  function handleDragEnd() {
    document.body.style.cursor = '';
  }

  function formatDate(iso) {
    if (!iso) return '-';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return String(iso);
    }
  }

  const defaultCustomLabel = MACHINE_TYPES[CUSTOMIZABLE_MACHINE_TYPE].label;
  const [savedCustomName, setSavedCustomName] = useState(() => readStoredCustomName());
  const [draftCustomName, setDraftCustomName] = useState(
    () => readStoredCustomName() ?? defaultCustomLabel
  );

  const effectiveCustomLabel = savedCustomName ?? defaultCustomLabel;

  const selectedMachine = useMemo(
    () => (machines ?? []).find((m) => m.id === selectedMachineId) ?? null,
    [machines, selectedMachineId]
  );

  useEffect(() => {
    if (selectedMachine?.type === CUSTOMIZABLE_MACHINE_TYPE) {
      setDraftCustomName(effectiveCustomLabel);
    }
  }, [selectedMachineId, selectedMachine?.type, effectiveCustomLabel]);

  function handleSaveCustomName() {
    const t = String(draftCustomName ?? '').trim();
    if (!t) return;
    try {
      localStorage.setItem(LS_CUSTOM_MACHINE_NAME, t);
      setSavedCustomName(t);
    } catch {
      /* ignore quota / private mode */
    }
  }

  function labelForMachineType(type) {
    if (type === CUSTOMIZABLE_MACHINE_TYPE) return effectiveCustomLabel;
    return MACHINE_TYPES[type]?.label ?? type;
  }

  return (
    <aside className={`machine-dnd-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <button
        type="button"
        className="machine-dnd-collapse-toggle"
        onClick={onToggleCollapsed}
        title={collapsed ? 'Expandir' : 'Colapsar'}
        aria-expanded={!collapsed}
      >
        {collapsed ? '⟩' : '⟨'}
      </button>
      {!collapsed && (
        <>
          <div className="machine-dnd-header">
            <h3>Máquinas 3D</h3>
            <p className="machine-dnd-hint">Arrastra a la escena</p>
          </div>
          <ul className="machine-dnd-list">
            {MACHINE_TYPE_ORDER.map((type) => {
              const spec = MACHINE_TYPES[type];
              return (
                <li key={type}>
                  <div
                    className="machine-dnd-item"
                    draggable
                    onDragStart={(e) => handleDragStart(e, type)}
                    onDragEnd={handleDragEnd}
                  >
                    <span className="machine-dnd-icon" aria-hidden>
                      {spec.icon}
                    </span>
                    <span className="machine-dnd-label">{labelForMachineType(type)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
          {machines?.length > 0 && (
            <div className="machine-dnd-placed">
              <h4>En escena</h4>
              <ul>
                {machines.map((m) => (
                  <li key={m.id}>
                    <div className="machine-dnd-placed-row">
                      <button
                        type="button"
                        className={`machine-dnd-placed-btn ${selectedMachineId === m.id ? 'active' : ''}`}
                        onClick={() => onSelectMachine(m.id)}
                      >
                        {`E${m.processOrder ?? '-'} · ${labelForMachineType(m.type)}`}
                      </button>
                      <button
                        type="button"
                        className="machine-dnd-delete-btn"
                        title="Eliminar máquina"
                        onClick={() => onDeleteMachine?.(m.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {selectedMachineId && (
                <>
                  <button type="button" className="machine-dnd-edit-btn" onClick={onEditConfig}>
                    Editar configuración
                  </button>
                  <button type="button" className="machine-dnd-edit-btn" onClick={onMoveOrderUp}>
                    Subir orden
                  </button>
                  <button type="button" className="machine-dnd-edit-btn" onClick={onMoveOrderDown}>
                    Bajar orden
                  </button>
                  {selectedMachine?.type === CUSTOMIZABLE_MACHINE_TYPE && (
                    <div className="machine-dnd-custom-name">
                      <label className="machine-dnd-custom-name-label" htmlFor="ollinx-custom-machine-name">
                        Nombre
                      </label>
                      <input
                        id="ollinx-custom-machine-name"
                        type="text"
                        className="machine-dnd-custom-name-input"
                        value={draftCustomName}
                        onChange={(e) => setDraftCustomName(e.target.value)}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="machine-dnd-edit-btn machine-dnd-custom-name-save"
                        disabled={!String(draftCustomName ?? '').trim()}
                        onClick={handleSaveCustomName}
                      >
                        Guardar nombre
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <div className="machine-scenarios">
            <h4>Escenarios</h4>
            <div className="machine-scenarios-save">
              <input
                type="text"
                value={scenarioName}
                onChange={(e) => onScenarioNameChange(e.target.value)}
                placeholder="Nombre del escenario"
              />
              <button type="button" className="machine-dnd-edit-btn" onClick={onSaveScenario}>
                Guardar escenario
              </button>
            </div>
            <ul className="machine-scenarios-list">
              {(savedScenarios ?? []).map((s) => (
                <li
                  key={s.id}
                  className={`machine-scenarios-item ${activeScenarioId === s.id ? 'active' : ''}`}
                >
                  <div className="machine-scenarios-meta">
                    <strong>{s.name}</strong>
                    <span>{formatDate(s.createdAt)}</span>
                    {activeScenarioId === s.id && <em>Activo</em>}
                  </div>
                  <button type="button" className="machine-dnd-edit-btn" onClick={() => onLoadScenario(s.id)}>
                    Cargar
                  </button>
                  <button
                    type="button"
                    className="machine-dnd-edit-btn machine-dnd-edit-btn-danger"
                    onClick={() => onDeleteScenario?.(s.id)}
                  >
                    Eliminar escenario
                  </button>
                </li>
              ))}
              {(savedScenarios ?? []).length === 0 && (
                <li className="machine-scenarios-empty">Sin escenarios guardados</li>
              )}
            </ul>
          </div>
        </>
      )}
    </aside>
  );
}
