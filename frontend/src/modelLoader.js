/**
 * Cargador de modelos 3D (GLTF/GLB). Fallback a geometría básica.
 * Responsable de: carga GLTF, instanciación, caché.
 * No conoce React. Usado por la escena 3D.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const cache = new Map();

/**
 * Crea geometría de fallback (box) para una máquina.
 */
function createFallbackGeometry(tipoMaquina) {
  const geom = new THREE.BoxGeometry(1.2, 1.2, 1.2);
  const color = { mezclado: 0x3498db, horneado: 0xe74c3c, empaque: 0x2ecc71, personalizada: 0x9b59b6 }[tipoMaquina] ?? 0x3498db;
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2 });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.isFallback = true;
  return mesh;
}

/**
 * Carga modelo GLTF/GLB o devuelve fallback.
 * @param {string|null} path - Ruta al modelo o null para fallback
 * @param {string} tipoMaquina - Tipo para fallback
 * @returns {Promise<THREE.Object3D>}
 */
export function loadMachineModel(path, tipoMaquina = 'mezclado') {
  if (!path) return Promise.resolve(createFallbackGeometry(tipoMaquina));

  const cached = cache.get(path);
  if (cached) return Promise.resolve(cached.clone());

  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      path,
      (gltf) => {
        const model = gltf.scene;
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        cache.set(path, model);
        resolve(model.clone());
      },
      undefined,
      () => {
        resolve(createFallbackGeometry(tipoMaquina));
      }
    );
  });
}

/**
 * Crea mesh para una estación (usa caché para fallback).
 */
export function createStationMesh(tipoMaquina, path = null) {
  return loadMachineModel(path, tipoMaquina);
}
