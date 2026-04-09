import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createSimulationEngine } from './simulationEngine';
import './App.css';

function cicloYBottleneck(e1, e2, e3) {
  const mov = 1;
  const total = 3 * mov + e1 + e2 + e3;
  const tiempos = [e1, e2, e3];
  const idx = tiempos.indexOf(Math.max(...tiempos));
  return { totalCycleTime: total, bottleneck: `Estación ${idx + 1}` };
}

const CONFIG_DEFAULT = { e1: 2, e2: 4, e3: 3 };

const METRICAS_INICIALES = {
  piezasProducidas: 0,
  sumaTiemposCicloReal: 0,
  cantidadCiclosCompletados: 0,
  util1: 0,
  util2: 0,
  util3: 0,
  estacionCritica: '-',
};

export default function App() {
  const containerRef = useRef(null);

  const [configAntes, setConfigAntes] = useState({ ...CONFIG_DEFAULT });
  const [configDespues, setConfigDespues] = useState({ e1: 3, e2: 5, e3: 4 });
  const [startTimeAntes, setStartTimeAntes] = useState(null);
  const [startTimeDespues, setStartTimeDespues] = useState(null);
  const [metricasAntes, setMetricasAntes] = useState({ ...METRICAS_INICIALES });
  const [metricasDespues, setMetricasDespues] = useState({ ...METRICAS_INICIALES });

  const { totalCycleTime: tiempoTotalAntes, bottleneck: cuelloAntes } =
    cicloYBottleneck(configAntes.e1, configAntes.e2, configAntes.e3);
  const { totalCycleTime: tiempoTotalDespues, bottleneck: cuelloDespues } =
    cicloYBottleneck(configDespues.e1, configDespues.e2, configDespues.e3);

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
    configAntes: configAntes,
    configDespues: configDespues,
  });
  controlRef.current.configAntes = configAntes;
  controlRef.current.configDespues = configDespues;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);

    const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 1000);
    camera.position.set(0, 10, 24);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    const w = Math.max(container.clientWidth || 1, 1);
    const h = Math.max(container.clientHeight || 1, 1);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(0, 15, 10);
    dir.castShadow = true;
    scene.add(dir);

    const floorGeom = new THREE.PlaneGeometry(24, 24);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.8, metalness: 0.1 });
    const boxGeom = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x3498db });
    const stationX = [-4, 0, 4];

    function buildGroup(offsetX, floorColor = 0x2d5a27) {
      const g = new THREE.Group();
      g.position.x = offsetX;
      const floor = new THREE.Mesh(floorGeom, floorMat.clone());
      floor.material.color.setHex(floorColor);
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      g.add(floor);
      for (let i = 0; i < 3; i++) {
        const box = new THREE.Mesh(boxGeom, boxMat);
        box.position.set(stationX[i], 0.75, 0);
        box.castShadow = true;
        box.receiveShadow = true;
        g.add(box);
      }
      return g;
    }

    const groupAntes = buildGroup(-10);
    const groupDespues = buildGroup(10, 0x1a4a1a);
    scene.add(groupAntes);
    scene.add(groupDespues);

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

      const { engineAntes, engineDespues, configAntes: cfgA, configDespues: cfgD } = controlRef.current;

      const shouldUpdateMetrics = now - lastMetricsUpdate >= METRICS_INTERVAL_MS;

      if (engineAntes) {
        const config = { e1: cfgA.e1, e2: cfgA.e2, e3: cfgA.e3 };
        const { removedIds, newPieceIds } = engineAntes.update(delta, nowSec, config);
        removedIds.forEach((id) => removePiece(groupAntes, pieceMeshesAntes, id));
        newPieceIds.forEach((id) => createPiece(groupAntes, pieceMeshesAntes, id, 0));
        const state = engineAntes.getState();
        syncMeshes(groupAntes, pieceMeshesAntes, state, 0);
        if (shouldUpdateMetrics) setMetricasAntes(metricsFromEngine(state.metrics));
      }

      if (engineDespues) {
        const config = { e1: cfgD.e1, e2: cfgD.e2, e3: cfgD.e3 };
        const { removedIds, newPieceIds } = engineDespues.update(delta, nowSec, config);
        removedIds.forEach((id) => removePiece(groupDespues, pieceMeshesDespues, id));
        newPieceIds.forEach((id) => createPiece(groupDespues, pieceMeshesDespues, id, 0.5));
        const state = engineDespues.getState();
        syncMeshes(groupDespues, pieceMeshesDespues, state, 0.5);
        if (shouldUpdateMetrics) setMetricasDespues(metricsFromEngine(state.metrics));
      }

      if (shouldUpdateMetrics && (engineAntes || engineDespues)) lastMetricsUpdate = now;

      renderer.render(scene, camera);
    }
    animate();

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
      if (animationId !== null) cancelAnimationFrame(animationId);
      pieceMeshesAntes.forEach((m) => { m.geometry?.dispose(); m.material?.dispose(); });
      pieceMeshesDespues.forEach((m) => { m.geometry?.dispose(); m.material?.dispose(); });
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      floorGeom.dispose();
      floorMat.dispose();
      boxGeom.dispose();
      boxMat.dispose();
      sphereGeom.dispose();
    };
  }, []);

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

  return (
    <div className="app-layout">
      <header className="config-section">
        <fieldset>
          <legend>Antes</legend>
          <label>E1 (s): <input type="number" min="0.5" step="0.5" value={configAntes.e1} onChange={(e) => setConfigAntes((c) => ({ ...c, e1: Number(e.target.value) || 0.5 }))} /></label>
          <label>E2 (s): <input type="number" min="0.5" step="0.5" value={configAntes.e2} onChange={(e) => setConfigAntes((c) => ({ ...c, e2: Number(e.target.value) || 0.5 }))} /></label>
          <label>E3 (s): <input type="number" min="0.5" step="0.5" value={configAntes.e3} onChange={(e) => setConfigAntes((c) => ({ ...c, e3: Number(e.target.value) || 0.5 }))} /></label>
          <button type="button" onClick={handleIniciarAntes}>Iniciar Antes</button>
        </fieldset>
        <fieldset>
          <legend>Después</legend>
          <label>E1 (s): <input type="number" min="0.5" step="0.5" value={configDespues.e1} onChange={(e) => setConfigDespues((c) => ({ ...c, e1: Number(e.target.value) || 0.5 }))} /></label>
          <label>E2 (s): <input type="number" min="0.5" step="0.5" value={configDespues.e2} onChange={(e) => setConfigDespues((c) => ({ ...c, e2: Number(e.target.value) || 0.5 }))} /></label>
          <label>E3 (s): <input type="number" min="0.5" step="0.5" value={configDespues.e3} onChange={(e) => setConfigDespues((c) => ({ ...c, e3: Number(e.target.value) || 0.5 }))} /></label>
          <button type="button" onClick={handleIniciarDespues}>Iniciar Después</button>
        </fieldset>
      </header>

      <main className="scene-section">
        <div ref={containerRef} className="scene-container" />
      </main>

      <footer className="metrics-section">
        <div className="metrics-row">
          <div className="metrics-block">
            <h3 className="metrics-panel-title">Antes</h3>
            <div className="info-row"><strong>Ciclo:</strong> {tiempoTotalAntes.toFixed(1)} s · <strong>Cuello:</strong> {cuelloAntes}</div>
            <div><strong>Piezas:</strong> {metricasAntes.piezasProducidas}</div>
            <div><strong>Promedio ciclo:</strong> {tiempoPromedioAntes.toFixed(2)} s</div>
            <div><strong>Throughput:</strong> {throughputAntes.toFixed(2)} piezas/min</div>
            <div>Util E1: {metricasAntes.util1.toFixed(1)}% | E2: {metricasAntes.util2.toFixed(1)}% | E3: {metricasAntes.util3.toFixed(1)}%</div>
            <div><strong>Crítica:</strong> {metricasAntes.estacionCritica}</div>
          </div>
          <div className="metrics-block">
            <h3 className="metrics-panel-title">Después</h3>
            <div className="info-row"><strong>Ciclo:</strong> {tiempoTotalDespues.toFixed(1)} s · <strong>Cuello:</strong> {cuelloDespues}</div>
            <div><strong>Piezas:</strong> {metricasDespues.piezasProducidas}</div>
            <div><strong>Promedio ciclo:</strong> {tiempoPromedioDespues.toFixed(2)} s</div>
            <div><strong>Throughput:</strong> {throughputDespues.toFixed(2)} piezas/min</div>
            <div>Util E1: {metricasDespues.util1.toFixed(1)}% | E2: {metricasDespues.util2.toFixed(1)}% | E3: {metricasDespues.util3.toFixed(1)}%</div>
            <div><strong>Crítica:</strong> {metricasDespues.estacionCritica}</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
