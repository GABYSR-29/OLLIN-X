import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { batidoraModelSpec } from './BatidoraModel.jsx';
import { brazorobotModelSpec } from './BrazorobotModel.jsx';
import { recolbolsaModelSpec } from './RecolbolsaModel.jsx';
import { ventiladorModelSpec } from './VentiladorModel.jsx';

/** Misma forma que RecolbolsaModel / VentiladorModel (id, url, position, scale). */
const EXTRA_DECOR_SPECS = [
  { id: 'materia', url: '/models/materia.glb', position: [6, 0, 0], scale: 1 },
  { id: 'lavado', url: '/models/lavado.glb', position: [8, 0, 0], scale: 1 },
  { id: 'freidora', url: '/models/freidora.glb', position: [10, 0, 0], scale: 1 },
  { id: 'condimento', url: '/models/condimento.glb', position: [12, 0, 0], scale: 1 },
  { id: 'fermentado', url: '/models/fermentado.glb', position: [14, 0, 0], scale: 1 },
  { id: 'horno', url: '/models/horno.glb', position: [16, 0, 0], scale: 1 },
  { id: 'molde', url: '/models/molde.glb', position: [18, 0, 0], scale: 1 },
  { id: 'cortadora', url: '/models/cortadora.glb', position: [20, 0, 0], scale: 1 },
];

const SPECS = [
  batidoraModelSpec,
  recolbolsaModelSpec,
  ventiladorModelSpec,
  brazorobotModelSpec,
  ...EXTRA_DECOR_SPECS,
];

function disposeObject3D(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => m?.dispose?.());
    }
  });
}

/**
 * Carga los GLB decorativos en la escena Three.js existente (equivalente a useGLTF + primitivas).
 * @param {THREE.Scene} scene
 * @returns {Promise<{ roots: THREE.Group[], dispose: () => void }>}
 */
export function loadGlbDecorModels(scene) {
  const loader = new GLTFLoader();
  const roots = [];

  return Promise.all(
    SPECS.map(
      (spec) =>
        new Promise((resolve, reject) => {
          loader.load(
            spec.url,
            (gltf) => {
              const root = gltf.scene;
              root.position.set(spec.position[0], spec.position[1], spec.position[2]);
              const s = spec.scale ?? 1;
              root.scale.setScalar(s);
              root.userData = { type: 'glbDecor', id: spec.id };
              root.traverse((child) => {
                if (child.isMesh) {
                  child.castShadow = true;
                  child.receiveShadow = true;
                }
              });
              scene.add(root);
              roots.push(root);
              resolve();
            },
            undefined,
            (err) => {
              console.warn(`[loadGlbDecor] No se pudo cargar ${spec.url}:`, err?.message || err);
              resolve();
            }
          );
        })
    )
  ).then(() => ({
    roots,
    dispose: () => {
      roots.forEach((root) => {
        scene.remove(root);
        disposeObject3D(root);
      });
      roots.length = 0;
    },
  }));
}
