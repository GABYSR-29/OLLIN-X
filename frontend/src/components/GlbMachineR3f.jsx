import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei/core/Gltf.js';
import { MACHINE_TYPES } from '../machineTypes';

/** Lado máximo del AABB en unidades de escena tras normalizar (mismo orden de magnitud para todos los GLB). */
const NORMALIZED_TARGET_MAX_DIM = 2;
/** Escala visual global sobre el modelo ya normalizado (no afecta posiciones ni lógica del simulador). */
const VISUAL_MODEL_SCALE_BOOST = 1.3;

function applyMeshEmissiveForSelection(clone, { selected, selectionColor }) {
  clone.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach((mat) => {
      if (!mat.userData._ollinxEmissiveSaved) {
        mat.userData._ollinxEmissiveSaved = {
          emissive: mat.emissive ? mat.emissive.clone() : new THREE.Color(0),
          emissiveIntensity: mat.emissiveIntensity ?? 0,
        };
      }
      const s = mat.userData._ollinxEmissiveSaved;
      if (selected) {
        if (!mat.emissive) mat.emissive = new THREE.Color(selectionColor);
        else mat.emissive.setHex(selectionColor);
        mat.emissiveIntensity = 0.62;
      } else {
        mat.emissive.copy(s.emissive);
        mat.emissiveIntensity = s.emissiveIntensity;
      }
    });
  });
}

/** useGLTF solo con URL válida; el padre valida el tipo antes de montar el hijo. */
function GlbMachineInner({ machine, selected, onSelect, selectionColor = 0x2563eb, url }) {
  const { scene } = useGLTF(url);

  const clone = useMemo(() => {
    const c = scene.clone(true);
    const spec = MACHINE_TYPES[machine.type];
    const specScale = spec?.scale ?? 1;
    c.userData = { type: 'glbMachine', machineId: machine.id, machineType: machine.type };
    c.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.userData = {
          ...child.userData,
          type: 'glbMachineMesh',
          machineId: machine.id,
          machineType: machine.type,
        };
      }
    });

    let meshCount = 0;
    c.traverse((child) => {
      if (child.isMesh || child.isSkinnedMesh) meshCount += 1;
    });
    // GLB vacío o sin geometría exportada: sin mallas no hay nada que renderizar (p. ej. placeholder de 132 B).
    if (meshCount === 0) {
      if (import.meta.env?.DEV) {
        console.warn('[Ollinx] GLB sin mallas visibles; usando marcador hasta reemplazar el archivo:', url);
      }
      const geom = new THREE.BoxGeometry(1.2, 1.2, 1.2);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x64748b,
        metalness: 0.15,
        roughness: 0.65,
      });
      const ph = new THREE.Mesh(geom, mat);
      ph.position.set(0, 0.6, 0);
      ph.castShadow = true;
      ph.receiveShadow = true;
      ph.userData = {
        type: 'glbMachineMesh',
        machineId: machine.id,
        machineType: machine.type,
        ollinxGeometryPlaceholder: true,
      };
      c.add(ph);
    }

    c.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(c);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (Number.isFinite(maxDim) && maxDim > 1e-6) {
      const uniform = (NORMALIZED_TARGET_MAX_DIM / maxDim) * specScale * VISUAL_MODEL_SCALE_BOOST;
      c.scale.set(uniform, uniform, uniform);
    } else {
      c.scale.setScalar(specScale * VISUAL_MODEL_SCALE_BOOST);
    }

    c.updateMatrixWorld(true);
    const boxAfterScale = new THREE.Box3().setFromObject(c);
    const minY = boxAfterScale.min.y;
    if (Number.isFinite(minY)) {
      c.position.y -= minY;
      c.position.y += 0.01;
    }

    return c;
  }, [scene, machine.id, machine.type, url]);

  const pos = machine.position;
  const rawPosition = pos?.length === 3 ? pos : [pos?.x ?? 0, pos?.y ?? 0, pos?.z ?? 0];
  const position = [rawPosition[0], rawPosition[1], rawPosition[2]];
  const lastPaintKeyRef = useRef('');

  useFrame(() => {
    const key = `${selected ? 1 : 0}_${selectionColor}`;
    if (key === lastPaintKeyRef.current) return;
    lastPaintKeyRef.current = key;
    applyMeshEmissiveForSelection(clone, { selected, selectionColor });
  });

  // El `position` en <primitive> pisa clone.position en cada frame; el offset al suelo vive en clone.position.y.
  return (
    <group position={position}>
      <primitive
        object={clone}
        onPointerDown={(e) => {
          e.stopPropagation();
          onSelect({ id: machine.id, simId: machine.simId });
        }}
      />
    </group>
  );
}

export default function GlbMachineR3f(props) {
  const m = props.machine;
  if (!m?.id || !m?.type || !m?.config) return null;
  const spec = MACHINE_TYPES[m.type];
  if (!spec?.url) return null;
  return <GlbMachineInner {...props} url={spec.url} />;
}
