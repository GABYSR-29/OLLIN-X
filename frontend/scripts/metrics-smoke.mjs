/**
 * Caso de prueba documentado para validar métricas (no forma parte del build).
 * Ejecutar: node scripts/metrics-smoke.mjs
 */
import { buildSceneSimulationState } from '../src/sceneSimulation.js';

const cfg = {
  capacity: 10,
  processTime: 20,
  queueTime: 5,
  efficiency: 80,
  operators: 2,
  costPerHour: 50,
  energy: 4,
};

const machine = {
  id: 'test-1',
  type: 'recolbolsa',
  position: [0, 0, 0],
  processOrder: 1,
  config: cfg,
};

const state = buildSceneSimulationState([machine], [{ ...machine, id: 'test-1-after' }]);

function print(label, snap) {
  const active = snap.stages.filter((s) => s.machine);
  console.log(`\n=== ${label} ===`);
  console.log('Tiempos por estación activa (s):', active.map((s) => ({ estación: s.stageIndex + 1, s: s.stageTime })));
  console.log('Ciclo total (s):', snap.cycle.totalCycleTime, 'Cuello:', snap.cycle.bottleneck);
  console.log('Totales:', snap.totals);
}

print('Antes', state.antes);
print('Después (misma config, otro id)', state.despues);
