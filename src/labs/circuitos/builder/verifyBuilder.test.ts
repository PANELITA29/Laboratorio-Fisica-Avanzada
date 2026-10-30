import test from 'node:test';
import assert from 'node:assert/strict';
import {
  solveSandboxCircuit,
  createSandboxPreset,
  getEia4Bands,
  canvasToWorld3D,
  world3DToCanvas,
  SandboxComponent,
  SandboxWire,
} from './NodalSolver';

test('NodalSolver: Transformación bidireccional de coordenadas 2D <-> Mundo 3D sobre la protoboard', () => {
  const center3D = canvasToWorld3D(460, 260, 0.5);
  assert.deepEqual(center3D, { x: 0, y: 0.5, z: 0 });

  const point3D = canvasToWorld3D(680, 120, 0);
  assert.equal(point3D.x, 11);
  assert.equal(point3D.z, -7);

  const backTo2D = world3DToCanvas(point3D.x, point3D.z, 20);
  assert.deepEqual(backTo2D, { x: 680, y: 120 });
});

test('NodalSolver: Malla simple de 1 lazo (Batería 9V + Interruptor Cerrado + Bombilla 10Ω + Amperímetro)', () => {
  const preset = createSandboxPreset('simple-bulb');
  const res = solveSandboxCircuit(preset.components, preset.wires, {
    isRunning: true,
    voltmeter: preset.voltmeter,
  });

  assert.equal(res.isShortCircuit, false);
  assert.ok(Math.abs(res.branches['bulb-1'].current - 0.9) < 0.01, `Expected ~0.9A, got ${res.branches['bulb-1'].current}`);
  assert.ok(Math.abs(res.branches['amm-1'].current - 0.9) < 0.01);
  assert.ok(Math.abs(res.branches['bulb-1'].power - 8.1) < 0.1, `Expected ~8.1W, got ${res.branches['bulb-1'].power}`);
  assert.ok(res.voltmeterReading !== null && Math.abs(res.voltmeterReading - 9.0) < 0.05);
});

test('NodalSolver: Circuito abierto al abrir interruptor unipolar -> I = 0 A en todas las ramas', () => {
  const preset = createSandboxPreset('simple-bulb');
  const openComps = preset.components.map((c) =>
    c.id === 'sw-1' ? { ...c, isClosed: false } : c
  );
  const res = solveSandboxCircuit(openComps, preset.wires, { isRunning: true });

  assert.equal(res.isShortCircuit, false);
  assert.equal(res.branches['bulb-1'].current, 0);
  assert.equal(res.branches['amm-1'].current, 0);
  assert.equal(res.totalPowerDissipated, 0);
});

test('NodalSolver: Divisor de tensión (12V con R1=100Ω y R2=200Ω en serie -> I=0.04A, V_R2=8.0V)', () => {
  const preset = createSandboxPreset('voltage-divider');
  const res = solveSandboxCircuit(preset.components, preset.wires, {
    isRunning: true,
    voltmeter: preset.voltmeter,
  });

  assert.ok(Math.abs(res.branches['res-1'].current - 0.04) < 0.001);
  assert.ok(Math.abs(res.branches['res-2'].current - 0.04) < 0.001);
  assert.ok(Math.abs(res.branches['res-1'].voltageDrop - 4.0) < 0.02);
  assert.ok(Math.abs(res.branches['res-2'].voltageDrop - 8.0) < 0.02);
  assert.ok(res.voltmeterReading !== null && Math.abs(res.voltmeterReading - 8.0) < 0.02);
});

test('NodalSolver: Circuito de 2 mallas en paralelo con Fusible (12V, Bombilla 12Ω ∥ Resistor 24Ω -> I_T = 1.5A)', () => {
  const preset = createSandboxPreset('parallel-fuse');
  const res = solveSandboxCircuit(preset.components, preset.wires, {
    isRunning: true,
    voltmeter: preset.voltmeter,
  });

  assert.equal(res.isShortCircuit, false);
  assert.equal(res.blownFuseIds.length, 0);
  assert.ok(Math.abs(res.branches['bulb-1'].current - 1.0) < 0.02);
  assert.ok(Math.abs(res.branches['res-1'].current - 0.5) < 0.02);
  assert.ok(Math.abs(res.branches['amm-1'].current - 1.5) < 0.02);
});

test('NodalSolver: Circuito de 3 mallas (Puente de Wheatstone equilibrado y desequilibrado)', () => {
  const balanced = createSandboxPreset('wheatstone');
  const resBalanced = solveSandboxCircuit(balanced.components, balanced.wires, {
    isRunning: true,
    voltmeter: balanced.voltmeter,
  });

  // En equilibrio (R1=R2=R3=R4=100Ω), la corriente por el galvanómetro central es 0.000 A
  assert.ok(Math.abs(resBalanced.branches['amm-bridge'].current) < 1e-4);
  assert.ok(resBalanced.voltmeterReading !== null && Math.abs(resBalanced.voltmeterReading) < 1e-3);

  // Al cambiar R4 a 300Ω, el puente se desequilibra y fluye corriente por la rama central
  const unbalancedComps = balanced.components.map((c) =>
    c.id === 'res-4' ? { ...c, resistance: 300 } : c
  );
  const resUnbalanced = solveSandboxCircuit(unbalancedComps, balanced.wires, {
    isRunning: true,
    voltmeter: balanced.voltmeter,
  });
  assert.ok(Math.abs(resUnbalanced.branches['amm-bridge'].current) > 0.01);
});

test('NodalSolver: Detección de Cortocircuito Franco (Cable directo entre polos de la batería)', () => {
  const comps: SandboxComponent[] = [
    { id: 'bat-short', type: 'battery', label: 'Batería 12V', x: 100, y: 100, rotation: 0, voltage: 12 },
  ];
  const wires: SandboxWire[] = [
    { id: 'w-short', fromTerminal: 'bat-short:B', toTerminal: 'bat-short:A' },
  ];
  const res = solveSandboxCircuit(comps, wires, { isRunning: true });

  assert.equal(res.isShortCircuit, true);
  assert.equal(
    res.shortCircuitMessage,
    '¡Cortocircuito detectado! La batería se está sobrecalentando'
  );
  assert.equal(res.branches['bat-short'].isShortPath, true);
});

test('NodalSolver: Protección por Fusible (>2A dispara blownFuseIds) y Fusión Térmica de Bombilla (>15W)', () => {
  const comps: SandboxComponent[] = [
    { id: 'bat-1', type: 'battery', label: 'Batería 24V', x: 100, y: 100, rotation: 0, voltage: 24 },
    { id: 'fuse-1', type: 'fuse', label: 'Fusible 2A', x: 240, y: 100, rotation: 0, maxCurrentAmps: 2.0 },
    { id: 'bulb-1', type: 'bulb', label: 'Bombilla 8Ω', x: 380, y: 100, rotation: 0, resistance: 8, maxWatts: 15 },
  ];
  const wires: SandboxWire[] = [
    { id: 'w-1', fromTerminal: 'bat-1:B', toTerminal: 'fuse-1:A' },
    { id: 'w-2', fromTerminal: 'fuse-1:B', toTerminal: 'bulb-1:A' },
    { id: 'w-3', fromTerminal: 'bulb-1:B', toTerminal: 'bat-1:A' },
  ];

  // I = 24V / 8Ω = 3.0 A (> 2.0A del fusible) y P = 3² * 8 = 72 W (> 15W de la bombilla)
  const res = solveSandboxCircuit(comps, wires, { isRunning: true });
  assert.ok(res.blownFuseIds.includes('fuse-1'));
  assert.ok(res.burnedComponentIds.includes('bulb-1'));
});

test('NodalSolver: Código de colores EIA automático para resistencias axiales', () => {
  const bands470 = getEia4Bands(470);
  assert.equal(bands470[0].nameEs, 'Amarillo');
  assert.equal(bands470[1].nameEs, 'Violeta');
  assert.equal(bands470[2].nameEs, 'Marrón');
});
