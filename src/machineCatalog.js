/**
 * Catálogo de máquinas disponibles.
 * No conoce Three.js ni React. Usado por stationModel y UI.
 * Preparado para modelos GLTF/GLB cuando existan.
 */

export const TIPOS_MAQUINA = {
  MEZCLADO: 'mezclado',
  HORNEADO: 'horneado',
  EMPAQUE: 'empaque',
  PERSONALIZADA: 'personalizada',
};

export const MACHINE_CATALOG = [
  { id: TIPOS_MAQUINA.MEZCLADO, nombre: 'Mezclado', modelo3DPath: '/models/mezclado.glb' },
  { id: TIPOS_MAQUINA.HORNEADO, nombre: 'Horneado', modelo3DPath: '/models/horneado.glb' },
  { id: TIPOS_MAQUINA.EMPAQUE, nombre: 'Empaque', modelo3DPath: '/models/empaque.glb' },
  { id: TIPOS_MAQUINA.PERSONALIZADA, nombre: 'Máquina personalizada', modelo3DPath: null },
];

export function getMachineById(id) {
  return MACHINE_CATALOG.find((m) => m.id === id) ?? MACHINE_CATALOG[0];
}

export function getMachineModelPath(tipoMaquina) {
  const m = getMachineById(tipoMaquina);
  return m?.modelo3DPath ?? null;
}
