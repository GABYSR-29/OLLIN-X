/** Tipos de máquinas GLB (sidebar drag & drop) — independiente de métricas del simulador. */
export const DEFAULT_MACHINE_CONFIG = {
  capacity: 0,
  processTime: 0,
  energy: 0,
  efficiency: 1,
  queueTime: 0,
  operators: 1,
  costPerHour: 50,
};

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Garantiza todas las claves de config (evita borradores parciales del modal). Migra operatorCount → operators. */
export function normalizeMachineConfig(raw) {
  const m = raw && typeof raw === 'object' ? raw : {};
  const operatorsSrc = m.operators != null ? m.operators : m.operatorCount;
  return {
    capacity: num(m.capacity, DEFAULT_MACHINE_CONFIG.capacity),
    processTime: num(m.processTime, DEFAULT_MACHINE_CONFIG.processTime),
    energy: num(m.energy, DEFAULT_MACHINE_CONFIG.energy),
    efficiency: num(m.efficiency, DEFAULT_MACHINE_CONFIG.efficiency),
    queueTime: num(m.queueTime, DEFAULT_MACHINE_CONFIG.queueTime),
    operators: Math.max(0, Math.floor(num(operatorsSrc, DEFAULT_MACHINE_CONFIG.operators))),
    costPerHour: Math.max(0, num(m.costPerHour, DEFAULT_MACHINE_CONFIG.costPerHour)),
  };
}

export function createDefaultMachineConfig() {
  return { ...DEFAULT_MACHINE_CONFIG };
}

export const MACHINE_TYPES = {
  recolbolsa: {
    id: 'recolbolsa',
    url: '/models/recolbolsa.glb',
    label: 'Empaquetado',
    scale: 4,
    icon: '📦​',
  },
  ventilador: {
    id: 'ventilador',
    url: '/models/ventilador.glb',
    label: 'Enfriamiento',
    scale: 4,
    icon: '❄️​',
  },
  batidora: {
    id: 'batidora',
    url: '/models/mezclar.glb',
    label: 'Batidora',
    scale: 5,
    icon: '🥣​',
  },
  /** Único tipo con nombre editable en UI (sidebar); identificación por key `brazorobot`. */
  brazorobot: {
    id: 'brazorobot',
    url: '/models/personalizar_maquina.glb',
    label: 'Personalizar máquina',
    scale: 6,
    icon: '⌬',
  },
  materia: {
    id: 'materia',
    url: '/models/materia.glb',
    label: 'Materia Prima',
    scale: 4,
    icon: '🚚',
  },
  lavado: {
    id: 'lavado',
    url: '/models/lavado.glb',
    label: 'Lavado',
    scale: 5,
    icon: '🫧​',
  },
  freidora: {
    id: 'freidora',
    url: '/models/freidora.glb',
    label: 'Freidora',
    scale: 5,
    icon: '🔆​',
  },
  condimento: {
    id: 'condimento',
    url: '/models/condimento.glb',
    label: 'Condimentación',
    scale: 3,
    icon: '🧂​',
  },
  fermentado: {
    id: 'fermentado',
    url: '/models/fermentado.glb',
    label: 'Fermentado',
    scale: 4,
    icon: '♨️',
  },
  horno: {
    id: 'horno',
    url: '/models/horno.glb',
    label: 'Horneado',
    scale: 5,
    icon: '​🔥​',
  },
  molde: {
    id: 'molde',
    url: '/models/molde.glb',
    label: 'Moldeado',
    scale: 4,
    icon: '​🧩',
  },
  cortadora: {
    id: 'cortadora',
    url: '/models/cortadora.glb',
    label: 'Cortadora',
    scale: 4,
    icon: '🔪',
  },
};

export const MACHINE_TYPE_ORDER = [
  'recolbolsa',
  'ventilador',
  'batidora',
  'brazorobot',
  'materia',
  'lavado',
  'freidora',
  'condimento',
  'fermentado',
  'horno',
  'molde',
  'cortadora',
];

export const DRAG_MIME = 'application/x-ollinx-machine-type';

/** Tipo de máquina cuyo nombre puede personalizarse (localStorage); no altera simulación. */
export const CUSTOMIZABLE_MACHINE_TYPE = 'brazorobot';
