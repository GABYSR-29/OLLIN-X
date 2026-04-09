import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { SimulatorCanvas } from './SimulatorWorld';
import MachineDnDSidebar from './MachineDnDSidebar';
import MachineConfigModal from './MachineConfigModal';
import AnalyticsDashboard from './AnalyticsDashboard';
import {
  createDefaultMachineConfig,
  DRAG_MIME,
  MACHINE_TYPES,
  normalizeMachineConfig,
} from '../machineTypes';
import {
  buildSceneSimulationState,
  deepCopy,
  deriveAfterSimulationMachines,
  normalizeProcessOrder,
} from '../sceneSimulation';
import { buildDisplayScenarioMetrics } from '../simulationDisplayMetrics';

const CICLO_UI_SENTINEL = 9999;

function cicloFallbackFromStages(scenario) {
  const stages = scenario?.stages || [];
  const act = stages.filter((s) => s.machine);
  if (act.length === 0) return null;
  let sum = 0;
  for (const s of act) {
    const t = Number(s.stageTime);
    if (!Number.isFinite(t) || t <= 0 || t >= CICLO_UI_SENTINEL) return null;
    sum += t;
  }
  return sum + act.length;
}
import '../App.css';

const METRICAS_INICIALES = {
  piezasProducidas: 0,
  sumaTiemposCicloReal: 0,
  cantidadCiclosCompletados: 0,
  /** null = estación no configurada en la línea (evita “fantasma” 0%). */
  util1: null,
  util2: null,
  util3: null,
  estacionCritica: '-',
};
const SCENARIOS_STORAGE_KEY = 'ollinx_scenarios_v1';

/** Reloj solo visual (segundos de “tiempo simulado” en pantalla; no conectado al motor 3D ni a sceneSimulation). */
function formatSimClock(totalSeconds) {
  const s = Math.floor(Math.max(0, Number(totalSeconds) || 0));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function normalizePos(p) {
  if (Array.isArray(p) && p.length >= 3) return [p[0], p[1], p[2]];
  return [p?.x ?? 0, p?.y ?? 0, p?.z ?? 0];
}

export default function Simulator() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const [startTimeAntes, setStartTimeAntes] = useState(null);
  const [startTimeDespues, setStartTimeDespues] = useState(null);
  const [metricasAntes, setMetricasAntes] = useState({ ...METRICAS_INICIALES });
  const [metricasDespues, setMetricasDespues] = useState({ ...METRICAS_INICIALES });

  const [machinesAntes, setMachinesAntes] = useState([]);
  const [machinesDespues, setMachinesDespues] = useState([]);
  const [machineModal, setMachineModal] = useState(null);
  const [selectedBeforeId, setSelectedBeforeId] = useState(null);
  const [selectedAfterId, setSelectedAfterId] = useState(null);
  const [activeContext, setActiveContext] = useState('antes');
  const [dndSidebarCollapsed, setDndSidebarCollapsed] = useState(false);
  const [simulationActive, setSimulationActive] = useState(false);
  const [simulationPaused, setSimulationPaused] = useState(false);
  /** Solo animación / motor del flujo 3D (delta en useFrame); no altera fórmulas de sceneSimulation. */
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  /** Contador visual de “tiempo de simulación” (mm:ss); avanza con velocidad; independiente del motor. */
  const [simTime, setSimTime] = useState(0);
  const pauseStartedAtRef = useRef(null);
  const pausedMsAccumulatedRef = useRef(0);

  useEffect(() => {
    console.log('Velocidad simulación:', speedMultiplier);
  }, [speedMultiplier]);

  useEffect(() => {
    if (!simulationActive || simulationPaused) return undefined;
    const id = setInterval(() => {
      setSimTime((prev) => prev + speedMultiplier);
    }, 1000);
    return () => clearInterval(id);
  }, [simulationActive, simulationPaused, speedMultiplier]);

  function deactivateSimulation() {
    pauseStartedAtRef.current = null;
    pausedMsAccumulatedRef.current = 0;
    setSimulationPaused(false);
    setSimulationActive(false);
    setSimTime(0);
  }

  function effectiveElapsedSec(startTs) {
    if (startTs == null) return 0;
    const now = Date.now();
    const activePauseMs =
      pauseStartedAtRef.current != null ? now - pauseStartedAtRef.current : 0;
    return Math.max(
      0,
      (now - startTs - pausedMsAccumulatedRef.current - activePauseMs) / 1000
    );
  }

  function handlePausarSimulacion() {
    if (!simulationActive || simulationPaused) return;
    pauseStartedAtRef.current = Date.now();
    setSimulationPaused(true);
  }

  function handleReanudarSimulacion() {
    if (!simulationPaused) return;
    if (pauseStartedAtRef.current != null) {
      pausedMsAccumulatedRef.current += Date.now() - pauseStartedAtRef.current;
      pauseStartedAtRef.current = null;
    }
    setSimulationPaused(false);
  }
  const [savedScenarios, setSavedScenarios] = useState([]);
  const [scenarioName, setScenarioName] = useState('');
  const [activeScenarioId, setActiveScenarioId] = useState(null);
  const [scenarioSwitchFx, setScenarioSwitchFx] = useState(false);
  const [scenarioToast, setScenarioToast] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const fxTimeoutRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const dashboardRef = useRef(null);
  const machinesAntesNorm = useMemo(() => normalizeProcessOrder(machinesAntes), [machinesAntes]);
  const machinesDespuesNorm = useMemo(() => normalizeProcessOrder(machinesDespues), [machinesDespues]);
  const machinesDespuesView = machinesDespuesNorm;

  const cloneAntesToDespues = (nextAntesMachines) => {
    const cloned = deriveAfterSimulationMachines(deepCopy(nextAntesMachines));
    setMachinesDespues(cloned);
    return cloned;
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SCENARIOS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setSavedScenarios(parsed);
    } catch {}
  }, []);

  const persistScenarios = (nextScenarios) => {
    setSavedScenarios(nextScenarios);
    try {
      localStorage.setItem(SCENARIOS_STORAGE_KEY, JSON.stringify(nextScenarios));
    } catch {}
  };

  const activeScenario = useMemo(
    () => savedScenarios.find((s) => s.id === activeScenarioId) ?? null,
    [savedScenarios, activeScenarioId]
  );
  const activeScenarioName = activeScenario?.name ?? 'Escenario nuevo (no guardado)';

  useEffect(() => {
    return () => {
      if (fxTimeoutRef.current) clearTimeout(fxTimeoutRef.current);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const updateAntesMachines = (updater) => {
    setMachinesAntes((prev) => normalizeProcessOrder(updater(prev)));
  };

  const updateDespuesMachines = (updater) => {
    setMachinesDespues((prev) => normalizeProcessOrder(updater(prev)));
  };

  const simulationState = useMemo(
    () => buildSceneSimulationState(machinesAntesNorm, machinesDespuesView),
    [machinesAntesNorm, machinesDespuesView]
  );
  const effectiveAntes = simulationState.antes.config;
  const effectiveDespues = simulationState.despues.config;
  const tiempoTotalAntes = simulationState.antes.cycle.totalCycleTime;
  const tiempoTotalDespues = simulationState.despues.cycle.totalCycleTime;
  const cuelloAntes = simulationState.antes.cycle.bottleneck;
  const cuelloDespues = simulationState.despues.cycle.bottleneck;
  const totalesAntes = simulationState.antes.totals;
  const totalesDespues = simulationState.despues.totals;

  const cicloFallbackAntes = useMemo(
    () => cicloFallbackFromStages(simulationState.antes),
    [simulationState.antes]
  );
  const cicloFallbackDespues = useMemo(
    () => cicloFallbackFromStages(simulationState.despues),
    [simulationState.despues]
  );

  const elapsedAntes = effectiveElapsedSec(startTimeAntes);
  const elapsedDespues = effectiveElapsedSec(startTimeDespues);
  const throughputAntes = elapsedAntes > 0 ? metricasAntes.piezasProducidas / (elapsedAntes / 60) : 0;
  const throughputDespues = elapsedDespues > 0 ? metricasDespues.piezasProducidas / (elapsedDespues / 60) : 0;

  const uiAntes = useMemo(
    () =>
      buildDisplayScenarioMetrics({
        totales: totalesAntes,
        metricas: metricasAntes,
        elapsedSec: elapsedAntes,
        simulationActive,
        tiempoTotalCicloFormula: tiempoTotalAntes,
        cuelloFormula: cuelloAntes,
        cicloFallbackSec: cicloFallbackAntes,
      }),
    [
      totalesAntes,
      metricasAntes,
      elapsedAntes,
      simulationActive,
      tiempoTotalAntes,
      cuelloAntes,
      cicloFallbackAntes,
      simulationPaused,
    ]
  );

  const uiDespues = useMemo(
    () =>
      buildDisplayScenarioMetrics({
        totales: totalesDespues,
        metricas: metricasDespues,
        elapsedSec: elapsedDespues,
        simulationActive,
        tiempoTotalCicloFormula: tiempoTotalDespues,
        cuelloFormula: cuelloDespues,
        cicloFallbackSec: cicloFallbackDespues,
      }),
    [
      totalesDespues,
      metricasDespues,
      elapsedDespues,
      simulationActive,
      tiempoTotalDespues,
      cuelloDespues,
      cicloFallbackDespues,
      simulationPaused,
    ]
  );

  const totalesAntesVista = useMemo(
    () => ({
      produccionPorMinuto: uiAntes.produccionPorMinuto,
      produccionPorHora: uiAntes.produccionPorHora,
      costoTotalPorHora: uiAntes.costoTotalPorHora,
      costoPorProducto: uiAntes.costoPorProducto,
    }),
    [uiAntes]
  );
  const totalesDespuesVista = useMemo(
    () => ({
      produccionPorMinuto: uiDespues.produccionPorMinuto,
      produccionPorHora: uiDespues.produccionPorHora,
      costoTotalPorHora: uiDespues.costoTotalPorHora,
      costoPorProducto: uiDespues.costoPorProducto,
    }),
    [uiDespues]
  );

  const controlRef = useRef({
    engineAntes: null,
    engineDespues: null,
    groupAntes: null,
    groupDespues: null,
    configAntes: null,
    configDespues: null,
  });

  function handleDragOverCanvas(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  function handleDropCanvas(e) {
    e.preventDefault();
    const raw = e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData('text/plain');
    const type = String(raw || '').trim();
    if (!type || !MACHINE_TYPES[type]) return;
    const hit = controlRef.current.raycastFloors?.(e.clientX, e.clientY);
    if (!hit) return;
    const id = crypto.randomUUID();
    const px = Number(hit.localX);
    const pz = Number(hit.z);
    const position = [
      Number.isFinite(px) ? px : 0,
      0,
      Number.isFinite(pz) ? pz : 0,
    ];
    const config = createDefaultMachineConfig();
    const targetScenario = 'antes';
    const nextOrder = machinesAntesNorm.length + 1;
    const newMachine = {
      id,
      type,
      position,
      simId: targetScenario,
      processOrder: nextOrder,
      config,
    };
    deactivateSimulation();
    updateAntesMachines((prev) => {
      return [...prev, newMachine];
    });
    setSelectedBeforeId(id);
    setMachineModal({
      machineId: id,
      simId: targetScenario,
      draft: normalizeMachineConfig(config),
      processOrder: nextOrder,
      isNew: true,
    });
  }

  function handleMachineModalSave() {
    if (!machineModal) return;
    const { machineId, draft, processOrder, simId } = machineModal;
    const nextConfig = normalizeMachineConfig(draft);
    if (simId === 'antes') deactivateSimulation();
    const setter = simId === 'despues' ? updateDespuesMachines : updateAntesMachines;
    setter((prev) => prev.map((m) => (m.id === machineId ? { ...m, config: nextConfig, processOrder: processOrder ?? m.processOrder } : m)));
    setMachineModal(null);
  }

  function handleMachineModalCancel() {
    if (!machineModal) return;
    const { machineId, isNew, simId } = machineModal;
    if (isNew) {
      if (simId === 'antes') deactivateSimulation();
      const setter = simId === 'despues' ? updateDespuesMachines : updateAntesMachines;
      setter((prev) => prev.filter((m) => m.id !== machineId));
      if (simId === 'antes') setSelectedBeforeId((cur) => (cur === machineId ? null : cur));
      else setSelectedAfterId((cur) => (cur === machineId ? null : cur));
    }
    setMachineModal(null);
  }

  function handleEditGlbConfig() {
    const selectedSimId = activeContext === 'despues' ? 'despues' : 'antes';
    const selectedId = selectedSimId === 'despues' ? selectedAfterId : selectedBeforeId;
    if (!selectedId) return;
    const list = selectedSimId === 'despues' ? machinesDespuesNorm : machinesAntesNorm;
    const m = list.find((x) => x.id === selectedId);
    if (!m) return;
    setMachineModal({
      machineId: m.id,
      simId: selectedSimId,
      draft: normalizeMachineConfig(m.config),
      processOrder: m.processOrder ?? 1,
      isNew: false,
    });
  }

  function handleRecrearDespuesDesdeAntes() {
    const cloned = cloneAntesToDespues(machinesAntesNorm);
    setSelectedAfterId(cloned[0]?.id ?? null);
  }

  function handleGuardarEscenario() {
    const name = scenarioName.trim() || `Escenario ${savedScenarios.length + 1}`;
    const scenario = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
      antes: deepCopy(machinesAntesNorm),
      despues: deepCopy(machinesDespuesNorm),
    };
    const next = [scenario, ...savedScenarios];
    persistScenarios(next);
    setActiveScenarioId(scenario.id);
    setScenarioToast(`Escenario "${name}" guardado correctamente`);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setScenarioToast(''), 2200);
    setScenarioName('');
  }

  function triggerScenarioSwitchFeedback(name) {
    setScenarioSwitchFx(true);
    if (fxTimeoutRef.current) clearTimeout(fxTimeoutRef.current);
    fxTimeoutRef.current = setTimeout(() => setScenarioSwitchFx(false), 320);
    setScenarioToast(`Escenario "${name}" cargado correctamente`);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setScenarioToast(''), 2200);
  }

  function handleCargarEscenario(scenarioId) {
    const scenario = savedScenarios.find((s) => s.id === scenarioId);
    if (!scenario) return;
    const nextAntes = normalizeProcessOrder(deepCopy(scenario.antes ?? []));
    const nextDespues = normalizeProcessOrder(deepCopy(scenario.despues ?? []));
    setMachinesAntes(nextAntes);
    setMachinesDespues(nextDespues);
    setSelectedBeforeId(null);
    setSelectedAfterId(null);
    setActiveContext('antes');
    deactivateSimulation();
    setActiveScenarioId(scenario.id);
    triggerScenarioSwitchFeedback(scenario.name);
  }

  function showToast(message, ms = 1800) {
    setScenarioToast(message);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setScenarioToast(''), ms);
  }

  function handleEliminarMaquina(machineId) {
    if (!machineId) return;
    const isDespues = activeContext === 'despues';
    const setter = isDespues ? updateDespuesMachines : updateAntesMachines;
    setter((prev) => prev.filter((m) => m.id !== machineId));
    if (isDespues) setSelectedAfterId((cur) => (cur === machineId ? null : cur));
    else setSelectedBeforeId((cur) => (cur === machineId ? null : cur));
    showToast('Máquina eliminada');
  }

  function handleEliminarEscenario(scenarioId) {
    const scenario = savedScenarios.find((s) => s.id === scenarioId);
    if (!scenario) return;
    const ok = window.confirm(`¿Seguro que deseas eliminar el escenario "${scenario.name}"?`);
    if (!ok) return;
    const next = savedScenarios.filter((s) => s.id !== scenarioId);
    persistScenarios(next);
    if (activeScenarioId === scenarioId) {
      setActiveScenarioId(null);
      setMachinesAntes([]);
      setMachinesDespues([]);
      setSelectedBeforeId(null);
      setSelectedAfterId(null);
      deactivateSimulation();
      setActiveContext('antes');
      setMetricasAntes({ ...METRICAS_INICIALES });
      setMetricasDespues({ ...METRICAS_INICIALES });
    }
    showToast('Escenario eliminado');
  }

  function handleSimularProcesos() {
    const workingAfter = machinesDespuesNorm;
    pauseStartedAtRef.current = null;
    pausedMsAccumulatedRef.current = 0;
    setSimulationPaused(false);
    setSimTime(0);
    setSimulationActive(true);
    controlRef.current.startAntes?.(effectiveAntes);
    controlRef.current.startDespues?.(buildSceneSimulationState(machinesAntesNorm, workingAfter).despues.config);
    setStartTimeAntes(Date.now());
    setStartTimeDespues(Date.now());
    setMetricasAntes({ ...METRICAS_INICIALES });
    setMetricasDespues({ ...METRICAS_INICIALES });
  }

  async function handleExportarPdf() {
    if (!dashboardRef.current || isExportingPdf) return;
    try {
      setIsExportingPdf(true);
      const canvas = await html2canvas(dashboardRef.current, {
        backgroundColor: '#0f172a',
        scale: 2,
        useCORS: true,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const dateStr = new Date().toLocaleString();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 12;

      pdf.setFontSize(14);
      pdf.text('OLLINX - Reporte de Simulación', margin, 14);
      pdf.setFontSize(10);
      pdf.text(`Escenario: ${activeScenarioName}`, margin, 20);
      pdf.text(`Fecha: ${dateStr}`, margin, 25);

      const rows = [
        ['Métrica', 'Antes', 'Después'],
        ['Prod/min', (totalesAntesVista?.produccionPorMinuto ?? 0).toFixed(2), (totalesDespuesVista?.produccionPorMinuto ?? 0).toFixed(2)],
        ['Prod/hora', (totalesAntesVista?.produccionPorHora ?? 0).toFixed(2), (totalesDespuesVista?.produccionPorHora ?? 0).toFixed(2)],
        ['Costo/hora', `$${(totalesAntesVista?.costoTotalPorHora ?? 0).toFixed(2)}`, `$${(totalesDespuesVista?.costoTotalPorHora ?? 0).toFixed(2)}`],
        ['Costo/producto', `$${(totalesAntesVista?.costoPorProducto ?? 0).toFixed(2)}`, `$${(totalesDespuesVista?.costoPorProducto ?? 0).toFixed(2)}`],
      ];
      let y = 32;
      pdf.setFontSize(9);
      rows.forEach((r, idx) => {
        pdf.text(String(r[0]), margin, y);
        pdf.text(String(r[1]), margin + 60, y);
        pdf.text(String(r[2]), margin + 110, y);
        if (idx === 0) pdf.line(margin, y + 2, pageWidth - margin, y + 2);
        y += 6;
      });

      const maxImgW = pageWidth - margin * 2;
      const imgH = (canvas.height * maxImgW) / canvas.width;
      const imgY = y + 4;
      pdf.addImage(imgData, 'PNG', margin, imgY, maxImgW, Math.min(imgH, 150));

      pdf.save(`reporte-${activeScenarioName.replace(/\s+/g, '-').toLowerCase()}.pdf`);
      showToast('Reporte PDF generado');
    } catch {
      showToast('No se pudo exportar el PDF');
    } finally {
      setIsExportingPdf(false);
    }
  }

  useEffect(() => {
    function onKey(ev) {
      const targetSimId = activeContext === 'despues' ? 'despues' : 'antes';
      const selectedId = targetSimId === 'despues' ? selectedAfterId : selectedBeforeId;
      if (!selectedId) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const step = 0.15;
      let dx = 0;
      let dz = 0;
      if (ev.key === 'ArrowLeft') dx = -step;
      if (ev.key === 'ArrowRight') dx = step;
      if (ev.key === 'ArrowUp') dz = -step;
      if (ev.key === 'ArrowDown') dz = step;
      if (!dx && !dz) return;
      ev.preventDefault();
      const setter = targetSimId === 'despues' ? updateDespuesMachines : updateAntesMachines;
      if (targetSimId === 'antes') deactivateSimulation();
      setter((prev) =>
        prev.map((m) => {
          if (m.id !== selectedId) return m;
          const [x, y, z] = normalizePos(m.position);
          return { ...m, position: [x + dx, y, z + dz] };
        })
      );
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeContext, selectedBeforeId, selectedAfterId]);

  function moveSelectedOrder(direction) {
    const isDespues = activeContext === 'despues';
    const selectedId = isDespues ? selectedAfterId : selectedBeforeId;
    if (!selectedId) return;
    const base = isDespues ? machinesDespuesNorm : machinesAntesNorm;
    const ordered = [...base].sort((a, b) => (a.processOrder ?? 999) - (b.processOrder ?? 999));
    const idx = ordered.findIndex((m) => m.id === selectedId);
    if (idx < 0) return;
    const target = idx + direction;
    if (target < 0 || target >= ordered.length) return;
    const tmp = ordered[idx].processOrder;
    ordered[idx].processOrder = ordered[target].processOrder;
    ordered[target].processOrder = tmp;
    if (!isDespues) deactivateSimulation();
    (isDespues ? updateDespuesMachines : updateAntesMachines)(() => ordered);
  }

  const sidebarIsAfter = activeContext === 'despues';
  const sidebarMachines = sidebarIsAfter ? machinesDespuesNorm : machinesAntesNorm;

  const rawDiffProd =
    totalesAntes && totalesDespues
      ? totalesDespuesVista.produccionPorMinuto - totalesAntesVista.produccionPorMinuto
      : 0;
  const rawDiffCosto =
    totalesAntes && totalesDespues
      ? totalesDespuesVista.costoPorProducto - totalesAntesVista.costoPorProducto
      : 0;
  const diffProd = Number.isFinite(rawDiffProd) ? rawDiffProd : 0;
  const diffCosto = Number.isFinite(rawDiffCosto) ? rawDiffCosto : 0;

  const buildCriticalAlerts = (totales, metricas, cuello, throughput) => {
    const alerts = [];
    if (!totales) return ['⚠️ Sin datos suficientes para diagnóstico'];
    alerts.push(`⚠️ Cuello actual: ${cuello || metricas?.estacionCritica || '-'}`);
    const ppm = Number(totales.produccionPorMinuto);
    const cpu = Number(totales.costoPorProducto);
    const thr = Number(throughput);
    if (Number.isFinite(ppm) && ppm <= 0.05) alerts.push('⚠️ Producción por minuto muy baja');
    if (Number.isFinite(thr) && thr <= 0.1) alerts.push('⚠️ Throughput bajo');
    if (Number.isFinite(cpu) && cpu >= 10) alerts.push('⚠️ Costo por producto alto');
    const utilVals = [metricas?.util1, metricas?.util2, metricas?.util3].filter(
      (u) => u !== null && u !== undefined && Number.isFinite(Number(u))
    );
    const utilMax = utilVals.length ? Math.max(...utilVals.map(Number)) : 0;
    if (utilMax >= 95) alerts.push('⚠️ Estación saturada (utilización >95%)');
    return alerts.length > 0 ? alerts : ['✅ Sin alertas críticas'];
  };

  const alertsAntes = buildCriticalAlerts(totalesAntesVista, metricasAntes, uiAntes.cuello, throughputAntes);
  const alertsDespues = buildCriticalAlerts(totalesDespuesVista, metricasDespues, uiDespues.cuello, throughputDespues);

  return (
    <div className="app-layout">
      <MachineDnDSidebar
        collapsed={dndSidebarCollapsed}
        onToggleCollapsed={() => setDndSidebarCollapsed((c) => !c)}
        selectedMachineId={sidebarIsAfter ? selectedAfterId : selectedBeforeId}
        machines={sidebarMachines}
        onSelectMachine={(id) => {
          if (sidebarIsAfter) {
            setSelectedAfterId(id);
          } else {
            setSelectedBeforeId(id);
          }
        }}
        onEditConfig={handleEditGlbConfig}
        onMoveOrderUp={() => moveSelectedOrder(-1)}
        onMoveOrderDown={() => moveSelectedOrder(1)}
        onDeleteMachine={handleEliminarMaquina}
        scenarioName={scenarioName}
        onScenarioNameChange={setScenarioName}
        onSaveScenario={handleGuardarEscenario}
        savedScenarios={savedScenarios}
        onLoadScenario={handleCargarEscenario}
        onDeleteScenario={handleEliminarEscenario}
        activeScenarioId={activeScenarioId}
      />

      <MachineConfigModal
        open={!!machineModal}
        title={machineModal?.isNew ? 'Nueva máquina' : 'Configuración de máquina'}
        draft={machineModal?.draft}
        processOrder={machineModal?.processOrder ?? 1}
        onChange={(d) => setMachineModal((prev) => (prev ? { ...prev, draft: d } : null))}
        onChangeOrder={(order) => setMachineModal((prev) => (prev ? { ...prev, processOrder: order } : null))}
        onSave={handleMachineModalSave}
        onCancel={handleMachineModalCancel}
      />

      <div className={`main-area simulator-main-extended ${scenarioSwitchFx ? 'scenario-switch-fx' : ''}`}>
        <header className="simulator-top-bar">
          <div className="scenario-active-label">
            {`Escenario activo: ${activeScenario?.name ?? 'Sin seleccionar'}`}
          </div>
          <div
            className={`context-badge ${activeContext === 'despues' ? 'despues' : 'antes'}`}
            aria-live="polite"
          >
            {`Editando: ${activeContext === 'despues' ? 'Después' : 'Antes'}`}
          </div>
          <div className="sim-speed-controls" role="group" aria-label="Velocidad de animación del flujo 3D">
            <span className="sim-speed-label">Velocidad</span>
            {[1, 2, 5].map((s) => (
              <button
                key={s}
                type="button"
                className={`sim-speed-btn${speedMultiplier === s ? ' is-active' : ''}`}
                onClick={() => setSpeedMultiplier(s)}
              >
                {s}x
              </button>
            ))}
          </div>
          <div className="sim-clock-cluster" aria-live="polite">
            <span className="sim-clock-line">
              <span aria-hidden="true">⏱️</span>{' '}
              <span className="sim-clock-digits">{formatSimClock(simTime)}</span>
              <span className="sim-clock-suffix"> min</span>
            </span>
            <span className="sim-clock-speed-hint">Velocidad: {speedMultiplier}x</span>
            {simulationActive && !simulationPaused ? (
              <span className="sim-live-badge" aria-label="Simulación en curso">
                ● Simulando
              </span>
            ) : null}
          </div>
          <div className="sim-top-sim-controls">
            <button type="button" className="sim-btn-primary" onClick={handleSimularProcesos}>
              Simular procesos
            </button>
            <button
              type="button"
              className="sim-btn-primary"
              onClick={handlePausarSimulacion}
              disabled={!simulationActive || simulationPaused}
              title="Pausar simulación"
            >
              ⏸ Pausar
            </button>
            <button
              type="button"
              className="sim-btn-primary"
              onClick={handleReanudarSimulacion}
              disabled={!simulationActive || !simulationPaused}
              title="Reanudar simulación"
            >
              ▶️ Reanudar
            </button>
          </div>
          <button type="button" className="sim-btn-primary" onClick={handleRecrearDespuesDesdeAntes}>
            Recrear Después desde Antes
          </button>
          <button
            type="button"
            className="logout-btn-inline"
            style={{ marginLeft: 'auto' }}
            onClick={handleLogout}
          >
            <i className="fas fa-sign-out-alt"></i> Cerrar sesión
          </button>
        </header>

        <main
          className="scene-section scene-section--r3f"
          onDragOver={handleDragOverCanvas}
          onDrop={handleDropCanvas}
        >
          <SimulatorCanvas
            machinesAntes={machinesAntesNorm}
            machinesDespues={machinesDespuesView}
            selectedBeforeId={selectedBeforeId}
            selectedAfterId={selectedAfterId}
            onSelectBefore={(id) => {
              setActiveContext('antes');
              setSelectedBeforeId(id);
              // Evita ambigüedad visual entre vistas.
              setSelectedAfterId(null);
            }}
            onSelectAfter={(id) => {
              setActiveContext('despues');
              setSelectedAfterId(id);
              // Evita ambigüedad visual entre vistas.
              setSelectedBeforeId(null);
            }}
            controlRef={controlRef}
            setMetricasAntes={setMetricasAntes}
            setMetricasDespues={setMetricasDespues}
            canvasClassName="scene-container scene-container--r3f"
            simulationPaused={simulationPaused}
            speedMultiplier={speedMultiplier}
          />
        </main>

        <footer className="metrics-section">
          <div className="metrics-row">
            <div className="metrics-block">
              <h3 className="metrics-panel-title">Antes</h3>
              <div className="metrics-industrial">
                <div>
                  <strong>Ciclo:</strong>{' '}
                  {uiAntes.cicloSeg >= CICLO_UI_SENTINEL ? '—' : `${uiAntes.cicloSeg.toFixed(1)} s`}
                </div>
                <div><strong>Cuello:</strong> {uiAntes.cuello}</div>
                <div><strong>Prod/min:</strong> {uiAntes.produccionPorMinuto.toFixed(2)}</div>
              </div>
              <div className="critical-alerts">
                {alertsAntes.map((a) => (
                  <div key={`a-${a}`}>{a}</div>
                ))}
              </div>
            </div>
            <div className="metrics-block">
              <h3 className="metrics-panel-title">Después</h3>
              <div className="metrics-industrial">
                <div>
                  <strong>Ciclo:</strong>{' '}
                  {uiDespues.cicloSeg >= CICLO_UI_SENTINEL ? '—' : `${uiDespues.cicloSeg.toFixed(1)} s`}
                </div>
                <div><strong>Cuello:</strong> {uiDespues.cuello}</div>
                <div><strong>Prod/min:</strong> {uiDespues.produccionPorMinuto.toFixed(2)}</div>
              </div>
              <div className="critical-alerts">
                {alertsDespues.map((a) => (
                  <div key={`d-${a}`}>{a}</div>
                ))}
              </div>
              {totalesAntes && totalesDespues && (
                <div className="metrics-diff">
                  <div className={diffProd >= 0 ? 'improve' : 'worse'}>Δ Prod: {diffProd >= 0 ? '+' : ''}{diffProd.toFixed(2)}</div>
                  <div className={diffCosto <= 0 ? 'improve' : 'worse'}>Δ Costo/prod: {diffCosto >= 0 ? '+' : ''}{diffCosto.toFixed(2)}</div>
                </div>
              )}
            </div>
          </div>
        </footer>
        <AnalyticsDashboard
          totalesAntes={totalesAntesVista}
          totalesDespues={totalesDespuesVista}
          metricasAntes={metricasAntes}
          metricasDespues={metricasDespues}
          throughputAntes={throughputAntes}
          throughputDespues={throughputDespues}
          activeScenarioName={activeScenarioName}
          isUnsavedScenario={!activeScenario}
          onExportPdf={handleExportarPdf}
          isExporting={isExportingPdf}
          dashboardRef={dashboardRef}
        />
      </div>
      {scenarioToast && (
        <div className="scenario-toast" role="status" aria-live="polite">
          {scenarioToast}
        </div>
      )}
      <div className="scenario-active-sticky" aria-live="polite">
        <span className="scenario-active-sticky-badge">Activo</span>
        <span className="scenario-active-sticky-name">
          {activeScenarioName}
        </span>
      </div>
    </div>
  );
}
