import { useRef, useLayoutEffect, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from '@react-three/drei/core/OrbitControls.js';
import GlbMachineR3f from './GlbMachineR3f';

const METRICS_INTERVAL_MS = 500;
const MOVE_DURATION_MS = 1000;
/** Plano del simulador (ancho X × profundidad Z); solo visual, no altera posiciones de máquinas. */
const SIM_FLOOR_WIDTH = 150;
const SIM_FLOOR_DEPTH = 80;
/**
 * Centros en X de groupAntes / groupDespues: separación >= ancho del piso + hueco para dos bloques claros.
 * Las posiciones locales de cada máquina siguen siendo las de "Antes"; deriveAfter no las desplaza.
 */
const SIM_INTER_SCENARIO_GAP = 10;
const SIM_SCENARIO_CENTER_SEP = SIM_FLOOR_WIDTH + SIM_INTER_SCENARIO_GAP;
const GROUP_OFFSET = {
  antes: -SIM_SCENARIO_CENTER_SEP / 2,
  despues: SIM_SCENARIO_CENTER_SEP / 2,
};
const SIM_BACKGROUND = '#9BA5AF';
const SIM_FLOOR_COLOR = '#adb5bd';
const SIM_GRID_DIVISIONS = 30;
const SIM_GRID_COLOR_MAIN = '#9ca3af';
const SIM_GRID_COLOR_FADE = '#e5e7eb';
/** Vista inicial: encuadra el plano rectangular; no altera lógica ni posiciones de máquinas. */
const SIM_CAMERA_INITIAL_POSITION = [0, 90, 90];
const SIM_ORBIT_MIN_DISTANCE = 50;
const SIM_ORBIT_MAX_DISTANCE = 300;
/** Pieza animada en el flujo 3D (solo visual). */
const SIM_FLOW_PIECE_RADIUS = 2;
const SIM_FLOW_PIECE_SEGMENTS = 32;
/** Dirección del ArrowHelper (-Y): punta hacia la esfera desde encima. */
const FLOW_PIECE_ARROW_DIR = new THREE.Vector3(0, -1, 0);
const SIM_FLOW_ARROW_LENGTH = 5.5;
const SIM_FLOW_ARROW_HEAD_LENGTH = 2.0;
const SIM_FLOW_ARROW_HEAD_WIDTH = 1.0;
/** Separa el origen de la flecha del centro de la esfera (más alto = indicador más externo). */
const SIM_FLOW_ARROW_Y_LIFT = 15.5;

function SimulatorFloorGrid() {
  const grid = useMemo(
    () =>
      new THREE.GridHelper(
        SIM_FLOOR_WIDTH,
        SIM_GRID_DIVISIONS,
        SIM_GRID_COLOR_MAIN,
        SIM_GRID_COLOR_FADE
      ),
    []
  );
  // GridHelper es cuadrado; se escala en Z para coincidir con el plano rectangular 150×80.
  return (
    <group scale={[1, 1, SIM_FLOOR_DEPTH / SIM_FLOOR_WIDTH]}>
      <primitive object={grid} position={[0, 0.02, 0]} />
    </group>
  );
}
/** Tope de etapas en el motor de flujo 3D (debe coincidir con índices de estación usados en el ciclo). */
const MAX_SIM_STATIONS = 3;

function normalizePos(p) {
  if (Array.isArray(p) && p.length >= 3) return [Number(p[0]) || 0, Number(p[1]) || 0, Number(p[2]) || 0];
  return [Number(p?.x) || 0, Number(p?.y) || 0, Number(p?.z) || 0];
}

function orderedStations(machines) {
  return [...machines]
    .filter((m) => m?.id && m?.type && m?.config)
    .sort((a, b) => (Number(a.processOrder) || 9999) - (Number(b.processOrder) || 9999));
}

function stageProcessMs(machine) {
  // El usuario configura segundos; internamente simulamos en milisegundos.
  const processMs = Math.max(100, Number(machine?.config?.processTime ?? 0) * 1000);
  const queueMs = Math.max(0, Number(machine?.config?.queueTime ?? 0) * 1000);
  return processMs + queueMs;
}

function buildFlowMetrics(flow, activeStationCount) {
  const n = Math.min(Math.max(activeStationCount, 0), MAX_SIM_STATIONS);
  const total = flow.totalTime;
  const ocup = flow.occupiedTime;
  const utils = [];
  for (let i = 0; i < n; i += 1) {
    const t = total[i] ?? 0;
    const o = ocup[i] ?? 0;
    utils.push(t > 0 ? (o / t) * 100 : 0);
  }
  let idx = -1;
  if (utils.length > 0) {
    const maxU = Math.max(...utils);
    idx = utils.indexOf(maxU);
  }
  const slot = (i) => (i < n ? utils[i] : null);
  return {
    piezasProducidas: flow.piezasProducidas,
    sumaTiemposCicloReal: flow.sumaTiemposCicloReal,
    cantidadCiclosCompletados: flow.cantidadCiclosCompletados,
    util1: slot(0),
    util2: slot(1),
    util3: slot(2),
    estacionCritica: idx >= 0 ? `Estación ${idx + 1}` : '-',
  };
}

function resetFlow(flow, stationCount) {
  const n = Math.min(Math.max(stationCount, 0), MAX_SIM_STATIONS);
  flow.running = true;
  flow.currentStage = 0;
  flow.mode = 'processing';
  flow.stageElapsedMs = 0;
  flow.moveElapsedMs = 0;
  flow.fromStage = 0;
  flow.toStage = 0;
  flow.piezasProducidas = 0;
  flow.sumaTiemposCicloReal = 0;
  flow.cantidadCiclosCompletados = 0;
  flow.totalTime = Array.from({ length: n }, () => 0);
  flow.occupiedTime = Array.from({ length: n }, () => 0);
  flow.cycleStartMs = performance.now();
}

function updateFlow(flow, stations, deltaMs, nowMs) {
  if (!flow.running || stations.length === 0) return;
  const active = Math.min(stations.length, MAX_SIM_STATIONS);
  while (flow.totalTime.length < active) {
    flow.totalTime.push(0);
    flow.occupiedTime.push(0);
  }
  for (let i = 0; i < active; i += 1) {
    flow.totalTime[i] += deltaMs / 1000;
  }
  if (flow.mode === 'processing') {
    if (flow.currentStage < active) flow.occupiedTime[flow.currentStage] += deltaMs / 1000;
    flow.stageElapsedMs += deltaMs;
    const current = stations[flow.currentStage];
    const stageMs = current ? stageProcessMs(current) : Infinity;
    if (flow.stageElapsedMs >= stageMs) {
      if (flow.currentStage >= stations.length - 1) {
        flow.piezasProducidas += 1;
        flow.cantidadCiclosCompletados += 1;
        flow.sumaTiemposCicloReal += (nowMs - flow.cycleStartMs) / 1000;
        flow.currentStage = 0;
        flow.mode = 'processing';
        flow.stageElapsedMs = 0;
        flow.cycleStartMs = nowMs;
      } else {
        flow.fromStage = flow.currentStage;
        flow.toStage = flow.currentStage + 1;
        flow.mode = 'moving';
        flow.moveElapsedMs = 0;
      }
    }
  } else {
    flow.moveElapsedMs += deltaMs;
    if (flow.moveElapsedMs >= MOVE_DURATION_MS) {
      flow.currentStage = flow.toStage;
      flow.mode = 'processing';
      flow.stageElapsedMs = 0;
    }
  }
}

function applyPieceTransform(mesh, flow, stations) {
  if (!mesh) return;
  if (!flow.running || stations.length === 0) {
    mesh.visible = false;
    return;
  }
  mesh.visible = true;
  const posFromMachine = (machine) => {
    const [x, y, z] = normalizePos(machine.position);
    return new THREE.Vector3(x, y + 1.6, z);
  };
  if (flow.mode === 'processing') {
    const st = stations[Math.min(flow.currentStage, stations.length - 1)];
    const p = posFromMachine(st);
    mesh.position.copy(p);
  } else {
    const from = posFromMachine(stations[flow.fromStage]);
    const to = posFromMachine(stations[flow.toStage]);
    const u = THREE.MathUtils.clamp(flow.moveElapsedMs / MOVE_DURATION_MS, 0, 1);
    mesh.position.lerpVectors(from, to, u);
  }
}

function syncFlowPieceArrow(arrowHelper, pieceMesh) {
  if (!arrowHelper) return;
  if (!pieceMesh || !pieceMesh.visible) {
    arrowHelper.visible = false;
    return;
  }
  arrowHelper.visible = true;
  arrowHelper.position.copy(pieceMesh.position);
  arrowHelper.position.y += SIM_FLOW_ARROW_Y_LIFT;
}

function SimulationCore({
  controlRef,
  setMetricasAntes,
  setMetricasDespues,
  machinesAntes,
  machinesDespues,
  selectedBeforeId,
  selectedAfterId,
  onSelectBefore,
  onSelectAfter,
  simulationPaused,
  speedMultiplier = 1,
}) {
  const groupAntes = useRef(null);
  const groupDespues = useRef(null);
  const floorAntes = useRef(null);
  const floorDespues = useRef(null);
  const pieceAntesRef = useRef(null);
  const pieceDespuesRef = useRef(null);

  const materialAntes = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ec4899',
        roughness: 0.65,
        metalness: 0.08,
      }),
    []
  );
  const materialDespues = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#8b5cf6',
        roughness: 0.65,
        metalness: 0.08,
      }),
    []
  );

  const arrowAntes = useMemo(() => {
    const h = new THREE.ArrowHelper(
      FLOW_PIECE_ARROW_DIR,
      new THREE.Vector3(0, 0, 0),
      SIM_FLOW_ARROW_LENGTH,
      0xec4899,
      SIM_FLOW_ARROW_HEAD_LENGTH,
      SIM_FLOW_ARROW_HEAD_WIDTH
    );
    h.setLength(6.5, 2.1,2.3);
    h.frustumCulled = false;
    h.renderOrder = 15;
    return h;
  }, []);
  const arrowDespues = useMemo(() => {
    const h = new THREE.ArrowHelper(
      FLOW_PIECE_ARROW_DIR,
      new THREE.Vector3(0, 0, 0),
      SIM_FLOW_ARROW_LENGTH,
      0x8b5cf6,
      SIM_FLOW_ARROW_HEAD_LENGTH,
      SIM_FLOW_ARROW_HEAD_WIDTH
    );
    h.setLength(6.5, 2.1, 2.3);
    h.frustumCulled = false;
    h.renderOrder = 15;
    return h;
  }, []);

  useEffect(() => {
    return () => {
      materialAntes.dispose();
      materialDespues.dispose();
      arrowAntes.dispose();
      arrowDespues.dispose();
    };
  }, [materialAntes, materialDespues, arrowAntes, arrowDespues]);
  const { camera, gl } = useThree();
  const cameraRef = useRef(camera);
  const glRef = useRef(gl);
  cameraRef.current = camera;
  glRef.current = gl;
  const mouse = useRef(new THREE.Vector2());
  const raycaster = useRef(new THREE.Raycaster());
  const lastTime = useRef(0);
  const lastMetricsUpdate = useRef(0);
  const pausePerfStartRef = useRef(null);
  const wasPausedRef = useRef(false);
  const flowAntes = useRef({
    running: false, currentStage: 0, mode: 'processing', stageElapsedMs: 0, moveElapsedMs: 0,
    fromStage: 0, toStage: 0, cycleStartMs: 0, piezasProducidas: 0, sumaTiemposCicloReal: 0,
    cantidadCiclosCompletados: 0, totalTime: [], occupiedTime: [],
  });
  const flowDespues = useRef({
    running: false, currentStage: 0, mode: 'processing', stageElapsedMs: 0, moveElapsedMs: 0,
    fromStage: 0, toStage: 0, cycleStartMs: 0, piezasProducidas: 0, sumaTiemposCicloReal: 0,
    cantidadCiclosCompletados: 0, totalTime: [], occupiedTime: [],
  });
  const machinesAntesRef = useRef(machinesAntes);
  const machinesDespuesRef = useRef(machinesDespues);
  machinesAntesRef.current = machinesAntes;
  machinesDespuesRef.current = machinesDespues;

  useLayoutEffect(() => {
    const attach = () => {
      const ga = groupAntes.current;
      const gd = groupDespues.current;
      if (!ga || !gd) return false;
      controlRef.current.groupAntes = ga;
      controlRef.current.groupDespues = gd;

      controlRef.current.startAntes = () => {
        wasPausedRef.current = false;
        pausePerfStartRef.current = null;
        resetFlow(flowAntes.current, orderedStations(machinesAntesRef.current).length);
      };
      controlRef.current.startDespues = () => {
        wasPausedRef.current = false;
        pausePerfStartRef.current = null;
        resetFlow(flowDespues.current, orderedStations(machinesDespuesRef.current).length);
      };

      controlRef.current.raycastFloors = (clientX, clientY) => {
        const g = glRef.current;
        const cam = cameraRef.current;
        if (!g?.domElement || !cam) return null;
        const canvas = g.domElement;
        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;
        const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
        mouse.current.set(ndcX, ndcY);
        raycaster.current.setFromCamera(mouse.current, cam);
        const floors = [floorAntes.current, floorDespues.current].filter(Boolean);
        const hits = raycaster.current.intersectObjects(floors, false);
        if (hits.length === 0) return null;
        const hit = hits[0];
        const floor = hit.object;
        const parent = floor.parent;
        const simId = floor.userData.simId;
        const world = hit.point;
        const localX = world.x - parent.position.x;
        return { simId, localX, z: world.z, parent };
      };
      return true;
    };

    let raf = requestAnimationFrame(function tryAttach() {
      if (!attach()) raf = requestAnimationFrame(tryAttach);
    });

    return () => {
      cancelAnimationFrame(raf);
    };
  }, [controlRef]);

  useEffect(() => {
    if (simulationPaused) {
      pausePerfStartRef.current = performance.now();
      wasPausedRef.current = true;
      return;
    }
    if (wasPausedRef.current && pausePerfStartRef.current != null) {
      const drift = performance.now() - pausePerfStartRef.current;
      flowAntes.current.cycleStartMs += drift;
      flowDespues.current.cycleStartMs += drift;
      pausePerfStartRef.current = null;
      wasPausedRef.current = false;
    }
  }, [simulationPaused]);

  // Cámara fija: sin autoenfoque para evitar saltos de UX.
  useEffect(() => {
    camera.position.set(
      SIM_CAMERA_INITIAL_POSITION[0],
      SIM_CAMERA_INITIAL_POSITION[1],
      SIM_CAMERA_INITIAL_POSITION[2]
    );
    camera.near = 0.05;
    camera.far = 2000;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera]);

  useFrame(() => {
    const nowMs = performance.now();
    const deltaMs = lastTime.current > 0 ? nowMs - lastTime.current : 0;
    lastTime.current = nowMs;
    const stationsAntes = orderedStations(machinesAntes);
    const stationsDespues = orderedStations(machinesDespues);

    if (simulationPaused) {
      applyPieceTransform(pieceAntesRef.current, flowAntes.current, stationsAntes);
      applyPieceTransform(pieceDespuesRef.current, flowDespues.current, stationsDespues);
      syncFlowPieceArrow(arrowAntes, pieceAntesRef.current);
      syncFlowPieceArrow(arrowDespues, pieceDespuesRef.current);
      return;
    }

    const shouldUpdateMetrics = nowMs - lastMetricsUpdate.current >= METRICS_INTERVAL_MS;
    // Acelera solo el avance temporal del flujo 3D (equivalente a tiempo / velocidad en animación).
    const k = Number(speedMultiplier);
    const flowDeltaMs = deltaMs * (Number.isFinite(k) && k > 0 ? k : 1);
    updateFlow(flowAntes.current, stationsAntes, flowDeltaMs, nowMs);
    updateFlow(flowDespues.current, stationsDespues, flowDeltaMs, nowMs);
    applyPieceTransform(pieceAntesRef.current, flowAntes.current, stationsAntes);
    applyPieceTransform(pieceDespuesRef.current, flowDespues.current, stationsDespues);
    syncFlowPieceArrow(arrowAntes, pieceAntesRef.current);
    syncFlowPieceArrow(arrowDespues, pieceDespuesRef.current);

    if (shouldUpdateMetrics) {
      const nAntes = Math.min(stationsAntes.length, MAX_SIM_STATIONS);
      const nDespues = Math.min(stationsDespues.length, MAX_SIM_STATIONS);
      setMetricasAntes(buildFlowMetrics(flowAntes.current, nAntes));
      setMetricasDespues(buildFlowMetrics(flowDespues.current, nDespues));
      lastMetricsUpdate.current = nowMs;
    }
  });

  return (
    <>
      <ambientLight intensity={0.72} />
      <hemisphereLight skyColor="#eef2f7" groundColor="#b8bec8" intensity={0.45} />
      <directionalLight position={[8, 18, 12]} intensity={1.05} castShadow />
      <group ref={groupAntes} position={[GROUP_OFFSET.antes, 0, 0]}>
        <mesh
          ref={floorAntes}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
          userData={{ type: 'floor', simId: 'antes' }}
          onPointerDown={(e) => {
            // Click en suelo de "Antes": limpia solo selección de esa vista.
            e.stopPropagation();
            onSelectBefore(null);
          }}
        >
          <planeGeometry args={[SIM_FLOOR_WIDTH, SIM_FLOOR_DEPTH]} />
          <meshStandardMaterial color={SIM_FLOOR_COLOR} roughness={0.85} metalness={0.08} />
        </mesh>
        <SimulatorFloorGrid />
        {/* Suspense solo en GLB: si no, el Suspense del Canvas oculta piso + esferas hasta que carguen todos los modelos. */}
        <Suspense fallback={null}>
          {machinesAntes
            .filter((m) => m?.id && m?.type && m?.config)
            .map((m) => (
              <GlbMachineR3f
                key={m.id}
                machine={m}
                selected={selectedBeforeId === m.id}
                onSelect={(sel) => onSelectBefore(sel.id)}
                selectionColor={0x2563eb}
              />
            ))}
        </Suspense>
        <mesh
          visible={false}
          frustumCulled={false}
          renderOrder={10}
          material={materialAntes}
          ref={(obj) => {
            pieceAntesRef.current = obj;
            if (obj) obj.material = materialAntes;
          }}
        >
          <sphereGeometry args={[SIM_FLOW_PIECE_RADIUS, SIM_FLOW_PIECE_SEGMENTS, SIM_FLOW_PIECE_SEGMENTS]} />
        </mesh>
        <primitive object={arrowAntes} />
      </group>
      <group ref={groupDespues} position={[GROUP_OFFSET.despues, 0, 0]}>
        <mesh
          ref={floorDespues}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
          userData={{ type: 'floor', simId: 'despues' }}
          onPointerDown={(e) => {
            // Click en suelo de "Después": limpia solo selección de esa vista.
            e.stopPropagation();
            onSelectAfter(null);
          }}
        >
          <planeGeometry args={[SIM_FLOOR_WIDTH, SIM_FLOOR_DEPTH]} />
          <meshStandardMaterial color={SIM_FLOOR_COLOR} roughness={0.85} metalness={0.08} />
        </mesh>
        <SimulatorFloorGrid />
        <Suspense fallback={null}>
          {machinesDespues
            .filter((m) => m?.id && m?.type && m?.config)
            .map((m) => (
              <GlbMachineR3f
                key={m.id}
                machine={m}
                selected={selectedAfterId === m.id}
                onSelect={(sel) => onSelectAfter(sel.id)}
                selectionColor={0xa855f7}
              />
            ))}
        </Suspense>
        <mesh
          visible={false}
          frustumCulled={false}
          renderOrder={10}
          material={materialDespues}
          ref={(obj) => {
            pieceDespuesRef.current = obj;
            if (obj) obj.material = materialDespues;
          }}
        >
          <sphereGeometry args={[SIM_FLOW_PIECE_RADIUS, SIM_FLOW_PIECE_SEGMENTS, SIM_FLOW_PIECE_SEGMENTS]} />
        </mesh>
        <primitive object={arrowDespues} />
      </group>
    </>
  );
}

export function SimulatorCanvas({
  machinesAntes,
  machinesDespues,
  selectedBeforeId,
  selectedAfterId,
  onSelectBefore,
  onSelectAfter,
  controlRef,
  setMetricasAntes,
  setMetricasDespues,
  canvasClassName,
  simulationPaused = false,
  speedMultiplier = 1,
}) {
  return (
    <Canvas
      className={canvasClassName}
      style={{ width: '100%', height: '100%', display: 'block' }}
      shadows
      camera={{
        fov: 56,
        position: SIM_CAMERA_INITIAL_POSITION,
        near: 0.05,
        far: 2000,
      }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl, camera }) => {
        gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        camera.lookAt(0, 0, 0);
      }}
    >
      <color attach="background" args={[SIM_BACKGROUND]} />
      {/* Suspense solo alrededor de GLB está dentro de SimulationCore; aquí no, para no ocuitar piso/esferas. */}
      <SimulationCore
        controlRef={controlRef}
        setMetricasAntes={setMetricasAntes}
        setMetricasDespues={setMetricasDespues}
        machinesAntes={machinesAntes}
        machinesDespues={machinesDespues}
        selectedBeforeId={selectedBeforeId}
        selectedAfterId={selectedAfterId}
        onSelectBefore={onSelectBefore}
        onSelectAfter={onSelectAfter}
        simulationPaused={simulationPaused}
        speedMultiplier={speedMultiplier}
      />
      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        enableRotate
        target={[0, 0, 0]}
        minDistance={SIM_ORBIT_MIN_DISTANCE}
        maxDistance={SIM_ORBIT_MAX_DISTANCE}
        maxPolarAngle={Math.PI / 2.05}
      />
    </Canvas>
  );
}
