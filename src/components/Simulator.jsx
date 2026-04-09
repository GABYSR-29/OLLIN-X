import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { createSimulationEngine } from '../simulationEngine';
import { createStationsManager } from '../stationsManager';
import { MACHINE_CATALOG } from '../machineCatalog';
import { METODO_LABELS } from '../productivityModule';
import { exportScenario, importScenario, saveToStorage, loadFromStorage } from '../scenarioManager';
import '../App.css';

function cicloYBottleneck(e1, e2, e3) {
  const mov = 1;
  const total = 3 * mov + e1 + e2 + e3;
  const tiempos = [e1, e2, e3];
  const idx = tiempos.indexOf(Math.max(...tiempos));
  return { totalCycleTime: total, bottleneck: `Estación ${idx + 1}` };
}

const METRICAS_INICIALES = {
  piezasProducidas: 0,
  sumaTiemposCicloReal: 0,
  cantidadCiclosCompletados: 0,
  util1: 0,
  util2: 0,
  util3: 0,
  estacionCritica: '-',
};

export default function Simulator() {
  const navigate = useNavigate();
  const containerRef = useRef(null);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };
  const [startTimeAntes, setStartTimeAntes] = useState(null);
  const [startTimeDespues, setStartTimeDespues] = useState(null);
  const [metricasAntes, setMetricasAntes] = useState({ ...METRICAS_INICIALES });
  const [metricasDespues, setMetricasDespues] = useState({ ...METRICAS_INICIALES });
  const [configVersion, setConfigVersion] = useState(0);
  const [selectedStation, setSelectedStation] = useState(null);
  const [escenarioActivo, setEscenarioActivo] = useState('antes');
  const [placementMode, setPlacementMode] = useState(null);
  const placementModeRef = useRef(null);
  placementModeRef.current = placementMode;
  const [scenarioName, setScenarioName] = useState('');

  const stationsManagerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const raycasterRef = useRef(null);
  const mouseRef = useRef(new THREE.Vector2());

  if (!stationsManagerRef.current) stationsManagerRef.current = createStationsManager();

  const sm = stationsManagerRef.current;
  const stationsAntes = sm.getStations('antes');
  const stationsDespues = sm.getStations('despues');

  const effectiveAntes = sm.getEffectiveConfig('antes') ?? { e1: 9999, e2: 9999, e3: 9999 };
  const effectiveDespues = sm.getEffectiveConfig('despues') ?? { e1: 9999, e2: 9999, e3: 9999 };

  const { totalCycleTime: tiempoTotalAntes, bottleneck: cuelloAntes } =
    cicloYBottleneck(effectiveAntes.e1, effectiveAntes.e2, effectiveAntes.e3);
  const { totalCycleTime: tiempoTotalDespues, bottleneck: cuelloDespues } =
    cicloYBottleneck(effectiveDespues.e1, effectiveDespues.e2, effectiveDespues.e3);

  const totalesAntes = sm.getSimulationTotals('antes');
  const totalesDespues = sm.getSimulationTotals('despues');

  const tiempoPromedioAntes =
    metricasAntes.cantidadCiclosCompletados > 0
      ? metricasAntes.sumaTiemposCicloReal / metricasAntes.cantidadCiclosCompletados
      : 0;
  const tiempoPromedioDespues =
    metricasDespues.cantidadCiclosCompletados > 0
      ? metricasDespues.sumaTiemposCicloReal / metricasDespues.cantidadCiclosCompletados
      : 0;
  const elapsedAntes = startTimeAntes ? (Date.now() - startTimeAntes) / 1000 : 0;
  const elapsedDespues = startTimeDespues ? (Date.now() - startTimeDespues) / 1000 : 0;
  const throughputAntes = elapsedAntes > 0 ? metricasAntes.piezasProducidas / (elapsedAntes / 60) : 0;
  const throughputDespues = elapsedDespues > 0 ? metricasDespues.piezasProducidas / (elapsedDespues / 60) : 0;

  const controlRef = useRef({
    engineAntes: null,
    engineDespues: null,
    groupAntes: null,
    groupDespues: null,
    stationMeshesAntes: new Map(),
    stationMeshesDespues: new Map(),
  });

  const selectedStationData = selectedStation
    ? sm.getStation(selectedStation.simId, selectedStation.stationId)
    : null;

  useEffect(() => {
    const unsub = sm.subscribe(() => setConfigVersion((v) => v + 1));
    return unsub;
  }, [sm]);

  function handleUpdateStation(simId, idOrIndex, updates) {
    sm.updateStation(simId, idOrIndex, updates);
  }

  function handleSelectMachine(machineType) {
    setPlacementMode(machineType);
    setSelectedStation(null);
  }

  function handleExportScenario() {
    const json = exportScenario(stationsAntes, stationsDespues, scenarioName || 'Escenario');
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ollinx-${(scenarioName || 'escenario').replace(/\s/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportScenario() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        const res = importScenario(r.result);
        if (res.ok) {
          sm.setStations('antes', res.antes);
          sm.setStations('despues', res.despues);
          setScenarioName(res.nombre ?? '');
          setConfigVersion((v) => v + 1);
        } else {
          alert('Error al importar: ' + (res.error ?? ''));
        }
      };
      r.readAsText(f);
    };
    input.click();
  }

  function handleSaveToStorage(key) {
    const ok = saveToStorage(key, { antes: stationsAntes, despues: stationsDespues, nombre: scenarioName || key });
    if (ok) alert('Guardado como ' + key);
    else alert('Error al guardar');
  }

  function handleLoadFromStorage(key) {
    const res = loadFromStorage(key);
    if (res?.ok) {
      sm.setStations('antes', res.antes);
      sm.setStations('despues', res.despues);
      setScenarioName(res.nombre ?? key);
      setConfigVersion((v) => v + 1);
    } else {
      alert('No se encontró el escenario');
    }
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 1000);
    camera.position.set(0, 10, 24);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    const w = Math.max(container.clientWidth || 1, 1);
    const h = Math.max(container.clientHeight || 1, 1);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    raycasterRef.current = raycaster;
    mouseRef.current = mouse;

    const floorGeom = new THREE.PlaneGeometry(24, 24);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.8, metalness: 0.1 });
    const boxGeom = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const stationX = [-4, 0, 4];

    function buildGroup(offsetX, floorColor = 0x2d5a27) {
      const g = new THREE.Group();
      g.position.x = offsetX;
      const floor = new THREE.Mesh(floorGeom, floorMat.clone());
      floor.material.color.setHex(floorColor);
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      floor.userData = { type: 'floor', simId: offsetX < 0 ? 'antes' : 'despues' };
      g.add(floor);
      return g;
    }

    const groupAntes = buildGroup(-10);
    const groupDespues = buildGroup(10, 0x1a4a1a);
    scene.add(groupAntes);
    scene.add(groupDespues);
    controlRef.current.groupAntes = groupAntes;
    controlRef.current.groupDespues = groupDespues;

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(0, 15, 10);
    dir.castShadow = true;
    scene.add(dir);

    const stationMeshesAntes = controlRef.current.stationMeshesAntes;
    const stationMeshesDespues = controlRef.current.stationMeshesDespues;
    const colors = { mezclado: 0x3498db, horneado: 0xe74c3c, empaque: 0x2ecc71, personalizada: 0x9b59b6 };

    function syncStationMeshes(group, map, stations, simId) {
      const ids = new Set(stations.map((s) => s.id));
      map.forEach((mesh, id) => {
        if (!ids.has(id)) {
          group.remove(mesh);
          mesh.geometry?.dispose();
          mesh.material?.dispose();
          map.delete(id);
        }
      });
      stations.forEach((st, i) => {
        let mesh = map.get(st.id);
        if (!mesh) {
          mesh = new THREE.Mesh(boxGeom, new THREE.MeshStandardMaterial({
            color: colors[st.tipoMaquina] ?? 0x3498db,
            roughness: 0.6,
            metalness: 0.2,
          }));
          mesh.position.set(stationX[i] ?? st.posicion?.x ?? 0, 0.75, st.posicion?.z ?? 0);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.userData = { type: 'station', simId, stationId: st.id };
          group.add(mesh);
          map.set(st.id, mesh);
        } else {
          mesh.position.x = stationX[i] ?? st.posicion?.x ?? 0;
          mesh.position.z = st.posicion?.z ?? 0;
        }
      });
    }

    const sphereGeom = new THREE.SphereGeometry(0.3, 20, 20);
    const pieceMeshesAntes = new Map();
    const pieceMeshesDespues = new Map();

    function createPiece(grupo, map, id, hue = 0) {
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(((id * 0.07) + hue) % 1, 0.8, 0.5),
      });
      const mesh = new THREE.Mesh(sphereGeom.clone(), mat);
      mesh.castShadow = true;
      grupo.add(mesh);
      map.set(id, mesh);
    }

    function removePiece(grupo, map, id) {
      const mesh = map.get(id);
      if (mesh) {
        grupo.remove(mesh);
        mesh.geometry?.dispose();
        mesh.material?.dispose();
        map.delete(id);
      }
    }

    function syncMeshes(grupo, map, state, hue) {
      const ids = new Set(state.pieces.map((p) => p.id));
      map.forEach((mesh, id) => {
        if (!ids.has(id)) {
          grupo.remove(mesh);
          mesh.geometry?.dispose();
          mesh.material?.dispose();
          map.delete(id);
        }
      });
      state.pieces.forEach((p) => {
        let mesh = map.get(p.id);
        if (!mesh) {
          createPiece(grupo, map, p.id, hue);
          mesh = map.get(p.id);
        }
        if (mesh) mesh.position.set(p.x, p.y, p.z);
      });
    }

    function metricsFromEngine(metrics) {
      const total = metrics.tiempoTotal;
      const ocup = metrics.tiempoOcupada;
      const util1 = total[0] > 0 ? (ocup[0] / total[0]) * 100 : 0;
      const util2 = total[1] > 0 ? (ocup[1] / total[1]) * 100 : 0;
      const util3 = total[2] > 0 ? (ocup[2] / total[2]) * 100 : 0;
      const utils = [util1, util2, util3];
      const idx = utils.indexOf(Math.max(...utils));
      return {
        piezasProducidas: metrics.piezasProducidas,
        sumaTiemposCicloReal: metrics.sumaTiemposCicloReal,
        cantidadCiclosCompletados: metrics.cantidadCiclosCompletados,
        util1,
        util2,
        util3,
        estacionCritica: idx >= 0 ? `Estación ${idx + 1}` : '-',
      };
    }

    controlRef.current.startAntes = () => {
      pieceMeshesAntes.forEach((m) => {
        groupAntes.remove(m);
        m.geometry?.dispose();
        m.material?.dispose();
      });
      pieceMeshesAntes.clear();
      const engine = createSimulationEngine();
      engine.init();
      controlRef.current.engineAntes = engine;
    };

    controlRef.current.startDespues = () => {
      pieceMeshesDespues.forEach((m) => {
        groupDespues.remove(m);
        m.geometry?.dispose();
        m.material?.dispose();
      });
      pieceMeshesDespues.clear();
      const engine = createSimulationEngine();
      engine.init();
      controlRef.current.engineDespues = engine;
    };

    controlRef.current.syncStationMeshes = () => {
      const stationsA = stationsManagerRef.current.getStations('antes');
      const stationsD = stationsManagerRef.current.getStations('despues');
      syncStationMeshes(groupAntes, stationMeshesAntes, stationsA, 'antes');
      syncStationMeshes(groupDespues, stationMeshesDespues, stationsD, 'despues');
    };

    let lastTime = 0;
    let animationId = null;
    let lastMetricsUpdate = 0;
    const METRICS_INTERVAL_MS = 500;

    function animate() {
      animationId = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = lastTime > 0 ? (now - lastTime) / 1000 : 0;
      lastTime = now;
      const nowSec = now / 1000;
      const { engineAntes, engineDespues } = controlRef.current;
      const shouldUpdateMetrics = now - lastMetricsUpdate >= METRICS_INTERVAL_MS;

      if (engineAntes) {
        const config = stationsManagerRef.current?.getEffectiveConfig('antes') ?? { e1: 9999, e2: 9999, e3: 9999 };
        const { removedIds, newPieceIds } = engineAntes.update(delta, nowSec, config);
        removedIds.forEach((id) => removePiece(groupAntes, pieceMeshesAntes, id));
        newPieceIds.forEach((id) => createPiece(groupAntes, pieceMeshesAntes, id, 0));
        const state = engineAntes.getState();
        syncMeshes(groupAntes, pieceMeshesAntes, state, 0);
        if (shouldUpdateMetrics) setMetricasAntes(metricsFromEngine(state.metrics));
      }

      if (engineDespues) {
        const config = stationsManagerRef.current?.getEffectiveConfig('despues') ?? { e1: 9999, e2: 9999, e3: 9999 };
        const { removedIds, newPieceIds } = engineDespues.update(delta, nowSec, config);
        removedIds.forEach((id) => removePiece(groupDespues, pieceMeshesDespues, id));
        newPieceIds.forEach((id) => createPiece(groupDespues, pieceMeshesDespues, id, 0.5));
        const state = engineDespues.getState();
        syncMeshes(groupDespues, pieceMeshesDespues, state, 0.5);
        if (shouldUpdateMetrics) setMetricasDespues(metricsFromEngine(state.metrics));
      }

      if (shouldUpdateMetrics && (controlRef.current.engineAntes || controlRef.current.engineDespues)) lastMetricsUpdate = now;
      renderer.render(scene, camera);
    }
    animate();

    function onPointerClick(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const all = [...groupAntes.children, ...groupDespues.children];
      const intersects = raycaster.intersectObjects(all, true);
      if (intersects.length === 0) return;
      const hit = intersects[0];
      const ud = hit.object.userData;
      if (ud?.type === 'station') {
        setSelectedStation({ simId: ud.simId, stationId: ud.stationId });
        setPlacementMode(null);
      } else if (ud?.type === 'floor') {
        const pm = placementModeRef.current;
        if (pm) {
          const world = hit.point;
          const simId = ud.simId;
          const parent = hit.object.parent;
          const localX = parent ? world.x - parent.position.x : world.x;
          stationsManagerRef.current.addStation(simId, pm, { x: localX, y: 0, z: world.z });
          setPlacementMode(null);
        }
      }
    }
    renderer.domElement.addEventListener('pointerdown', onPointerClick);

    function onResize() {
      if (!containerRef.current) return;
      const c = containerRef.current;
      const w = Math.max(c.clientWidth || 1, 1);
      const h = Math.max(c.clientHeight || 1, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerClick);
      if (animationId !== null) cancelAnimationFrame(animationId);
      pieceMeshesAntes.forEach((m) => { m.geometry?.dispose(); m.material?.dispose(); });
      pieceMeshesDespues.forEach((m) => { m.geometry?.dispose(); m.material?.dispose(); });
      stationMeshesAntes.forEach((m) => { m.geometry?.dispose(); m.material?.dispose(); });
      stationMeshesDespues.forEach((m) => { m.geometry?.dispose(); m.material?.dispose(); });
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      floorGeom.dispose();
      floorMat.dispose();
      boxGeom.dispose();
      sphereGeom.dispose();
      sceneRef.current = null;
      cameraRef.current = null;
    };
  }, []);

  useEffect(() => {
    controlRef.current.syncStationMeshes?.();
  }, [configVersion]);

  function handleIniciarAntes() {
    controlRef.current.startAntes?.();
    setStartTimeAntes(Date.now());
    setMetricasAntes({ ...METRICAS_INICIALES });
  }

  function handleIniciarDespues() {
    controlRef.current.startDespues?.();
    setStartTimeDespues(Date.now());
    setMetricasDespues({ ...METRICAS_INICIALES });
  }

  function StationConfigPanel({ station, simId }) {
    if (!station) return null;
    const calcs = sm.getStationCalculations(station) ?? {};
    const divZero = calcs.divisionPorCero ?? calcs.productividadDivisionPorCero;
    return (
      <div className="station-config-panel">
        <h4>{station.nombre}</h4>
        <div className="station-config-fields">
          <label>Trabajadores <input type="number" min="0" step="1" value={station.cantidadTrabajadores} onChange={(e) => handleUpdateStation(simId, station.id, { cantidadTrabajadores: e.target.value })} /></label>
          <label>$ /h <input type="number" min="0" step="10" value={station.salarioPorHora} onChange={(e) => handleUpdateStation(simId, station.id, { salarioPorHora: e.target.value })} /></label>
          <label>Prod/min trab. <input type="number" min="0" step="0.1" value={station.produccionPorMinutoPorTrabajador} onChange={(e) => handleUpdateStation(simId, station.id, { produccionPorMinutoPorTrabajador: e.target.value })} /></label>
          <label>Tiempo prod (min) <input type="number" min="0" step="1" value={station.tiempoProduccionMinutos} onChange={(e) => handleUpdateStation(simId, station.id, { tiempoProduccionMinutos: e.target.value })} /></label>
          <label>Unidades objetivo <input type="number" min="0" step="1" value={station.unidadesObjetivo} onChange={(e) => handleUpdateStation(simId, station.id, { unidadesObjetivo: e.target.value })} /></label>
          <label>Recursos util. <input type="number" min="0" step="0.1" value={station.recursosUtilizados} onChange={(e) => handleUpdateStation(simId, station.id, { recursosUtilizados: e.target.value })} /></label>
        </div>
        <label className="full-width">
          Método productividad
          <select value={station.metodoProductividadSeleccionado} onChange={(e) => handleUpdateStation(simId, station.id, { metodoProductividadSeleccionado: e.target.value })}>
            {Object.entries(METODO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        {divZero && <div className="div-zero-warn">Advertencia: posible división por cero</div>}
        <div className="station-results">
          <div>Prod. total: {calcs.produccionTotal?.toFixed(0) ?? calcs.produccionTotalPorMinuto?.toFixed(1) ?? 0}</div>
          <div>Costo total: ${calcs.costoTotal?.toFixed(2) ?? calcs.costoTotalPorHora?.toFixed(2) ?? 0}</div>
          <div>Costo/unidad: ${calcs.costoPorUnidad?.toFixed(2) ?? calcs.costoPorProducto?.toFixed(2) ?? 0}</div>
          <div>Productividad: {calcs.productividadResultado?.toFixed(2) ?? 0}</div>
        </div>
      </div>
    );
  }

  const diffProd = totalesAntes && totalesDespues ? totalesDespues.produccionPorMinuto - totalesAntes.produccionPorMinuto : 0;
  const diffCosto = totalesAntes && totalesDespues ? totalesDespues.costoPorProducto - totalesAntes.costoPorProducto : 0;

  return (
    <div className="app-layout">
      <aside className="side-panel">
        <div className="simulator-header">
          <button type="button" className="logout-btn" onClick={handleLogout}>
            <i className="fas fa-sign-out-alt"></i> Cerrar sesión
          </button>
        </div>
        <h3>Catálogo de máquinas</h3>
        <div className="machine-catalog">
          {MACHINE_CATALOG.map((m) => (
            <button key={m.id} type="button" className={`machine-btn ${placementMode === m.id ? 'active' : ''}`} onClick={() => handleSelectMachine(m.id)}>
              {m.nombre}
            </button>
          ))}
        </div>
        <p className="hint">{placementMode ? `Modo colocación: haz clic en el suelo del escenario para colocar` : 'Selecciona una máquina para colocar, o haz clic en una estación existente para configurarla'}</p>

        <div className="escenario-selector">
          <label><input type="radio" name="escenario" checked={escenarioActivo === 'antes'} onChange={() => setEscenarioActivo('antes')} /> Antes</label>
          <label><input type="radio" name="escenario" checked={escenarioActivo === 'despues'} onChange={() => setEscenarioActivo('despues')} /> Después</label>
        </div>

        {selectedStationData ? (
          <StationConfigPanel station={selectedStationData} simId={selectedStation.simId} />
        ) : (
          <div className="quick-config">
            <h4>Configuración rápida</h4>
            {(escenarioActivo === 'antes' ? stationsAntes : stationsDespues).slice(0, 3).map((st, i) => (
              <div key={st.id} className="station-config-row">
                <span className="station-label">{st.nombre}</span>
                <button type="button" className="select-btn" onClick={() => setSelectedStation({ simId: escenarioActivo, stationId: st.id })}>Configurar</button>
                <label>Trab. <input type="number" min="0" value={st.cantidadTrabajadores} onChange={(e) => handleUpdateStation(escenarioActivo, st.id, { cantidadTrabajadores: e.target.value })} style={{ width: 48 }} /></label>
                <label>Prod <input type="number" min="0" step="0.1" value={st.produccionPorMinutoPorTrabajador} onChange={(e) => handleUpdateStation(escenarioActivo, st.id, { produccionPorMinutoPorTrabajador: e.target.value })} style={{ width: 48 }} /></label>
              </div>
            ))}
          </div>
        )}

        <div className="scenario-actions">
          <h4>Escenarios</h4>
          <input type="text" placeholder="Nombre" value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} />
          <button type="button" onClick={handleExportScenario}>Exportar JSON</button>
          <button type="button" onClick={handleImportScenario}>Importar JSON</button>
          <div>
            <button type="button" onClick={() => handleSaveToStorage('A')}>Guardar A</button>
            <button type="button" onClick={() => handleSaveToStorage('B')}>Guardar B</button>
            <button type="button" onClick={() => handleSaveToStorage('C')}>Guardar C</button>
          </div>
          <div>
            <button type="button" onClick={() => handleLoadFromStorage('A')}>Cargar A</button>
            <button type="button" onClick={() => handleLoadFromStorage('B')}>Cargar B</button>
            <button type="button" onClick={() => handleLoadFromStorage('C')}>Cargar C</button>
          </div>
        </div>
      </aside>

      <div className="main-area">
        <header className="config-section">
          <fieldset>
            <legend>Antes</legend>
            <button type="button" onClick={handleIniciarAntes}>Iniciar simulación</button>
          </fieldset>
          <fieldset>
            <legend>Después</legend>
            <button type="button" onClick={handleIniciarDespues}>Iniciar simulación</button>
          </fieldset>
        </header>

        <main className="scene-section">
          <div ref={containerRef} className="scene-container" />
        </main>

        <footer className="metrics-section">
          <div className="metrics-row">
            <div className="metrics-block">
              <h3 className="metrics-panel-title">Antes</h3>
              <div className="info-row">
                <strong>Ciclo:</strong> {tiempoTotalAntes >= 9999 ? '—' : `${tiempoTotalAntes.toFixed(1)} s`} · <strong>Cuello:</strong> {cuelloAntes}
              </div>
              {totalesAntes && (
                <div className="metrics-industrial">
                  <div><strong>Prod/min:</strong> {totalesAntes.produccionPorMinuto.toFixed(2)}</div>
                  <div><strong>Prod/hora:</strong> {totalesAntes.produccionPorHora.toFixed(0)}</div>
                  <div><strong>Costo/hora:</strong> ${totalesAntes.costoTotalPorHora.toFixed(2)}</div>
                  <div><strong>Costo/producto:</strong> ${totalesAntes.costoPorProducto.toFixed(2)}</div>
                </div>
              )}
              <div><strong>Piezas:</strong> {metricasAntes.piezasProducidas}</div>
              <div><strong>Throughput:</strong> {throughputAntes.toFixed(2)} piezas/min</div>
              <div><strong>Crítica:</strong> {metricasAntes.estacionCritica}</div>
            </div>
            <div className="metrics-block">
              <h3 className="metrics-panel-title">Después</h3>
              <div className="info-row">
                <strong>Ciclo:</strong> {tiempoTotalDespues >= 9999 ? '—' : `${tiempoTotalDespues.toFixed(1)} s`} · <strong>Cuello:</strong> {cuelloDespues}
              </div>
              {totalesDespues && (
                <div className="metrics-industrial">
                  <div><strong>Prod/min:</strong> {totalesDespues.produccionPorMinuto.toFixed(2)}</div>
                  <div><strong>Prod/hora:</strong> {totalesDespues.produccionPorHora.toFixed(0)}</div>
                  <div><strong>Costo/hora:</strong> ${totalesDespues.costoTotalPorHora.toFixed(2)}</div>
                  <div><strong>Costo/producto:</strong> ${totalesDespues.costoPorProducto.toFixed(2)}</div>
                </div>
              )}
              <div><strong>Piezas:</strong> {metricasDespues.piezasProducidas}</div>
              <div><strong>Throughput:</strong> {throughputDespues.toFixed(2)} piezas/min</div>
              <div><strong>Crítica:</strong> {metricasDespues.estacionCritica}</div>
              {totalesAntes && totalesDespues && (
                <div className="metrics-diff">
                  <div className={diffProd >= 0 ? 'improve' : 'worse'}>Δ Prod: {diffProd >= 0 ? '+' : ''}{diffProd.toFixed(2)}</div>
                  <div className={diffCosto <= 0 ? 'improve' : 'worse'}>Δ Costo/prod: {diffCosto >= 0 ? '+' : ''}{diffCosto.toFixed(2)}</div>
                </div>
              )}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
