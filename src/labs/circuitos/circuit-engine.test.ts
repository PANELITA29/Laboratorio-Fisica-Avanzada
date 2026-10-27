import test from 'node:test';
import assert from 'node:assert/strict';
import {
  solveCircuit,
  getResistorColorBands,
  calculateOhmRegressionSlope,
  CircuitComponent,
} from './circuit-engine';
import { validateChallenge1, validateChallenge2 } from './circuit-challenges';

test('Ohm Law simple loop: 10V battery + 100 Ohm resistor yields 0.1A and 1W', () => {
  const components: CircuitComponent[] = [
    { id: 'bat1', type: 'battery', label: 'V1', nodeA: 'n0', nodeB: 'n1', voltage: 10, resistance: 0 },
    { id: 'res1', type: 'resistor', label: 'R1', nodeA: 'n1', nodeB: 'n0', resistance: 100 },
  ];
  const sol = solveCircuit(components);
  const resState = sol.componentStates['res1'];
  assert.ok(resState);
  assert.ok(Math.abs(resState.voltageDrop - 10) < 0.01);
  assert.ok(Math.abs(resState.current - 0.1) < 0.001);
  assert.ok(Math.abs(resState.power - 1.0) < 0.01);
});

test('Kirchhoff Voltage Divider (Challenge 1): 20V source with 300 Ohm series resistor and 100 Ohm bulb gives 5.0V across bulb', () => {
  const components: CircuitComponent[] = [
    { id: 'bat1', type: 'battery', label: 'V1', nodeA: 'n0', nodeB: 'n1', voltage: 20, resistance: 0 },
    { id: 'res1', type: 'resistor', label: 'R1', nodeA: 'n1', nodeB: 'n2', resistance: 300 },
    { id: 'bulb1', type: 'bulb', label: 'B1', nodeA: 'n2', nodeB: 'n0', resistance: 100, maxPower: 25 },
  ];
  const sol = solveCircuit(components);
  const bulbState = sol.componentStates['bulb1'];
  assert.ok(Math.abs(bulbState.voltageDrop - 5.0) < 0.02);

  const check = validateChallenge1(components, sol);
  assert.equal(check.passed, true);
});

test('Bulb burnout protection triggers when power exceeds maxPower', () => {
  const components: CircuitComponent[] = [
    { id: 'bat1', type: 'battery', label: 'V1', nodeA: 'n0', nodeB: 'n1', voltage: 100, resistance: 0 },
    { id: 'bulb1', type: 'bulb', label: 'B1', nodeA: 'n1', nodeB: 'n0', resistance: 10, maxPower: 25 },
  ];
  const sol = solveCircuit(components);
  assert.equal(sol.componentStates['bulb1'].isBurnedOut, true);
  assert.equal(sol.componentStates['bulb1'].current, 0);
});

test('4-Band resistor color code computes IEC 60062 bands accurately for 470 Ohm and 1000 Ohm', () => {
  const bands470 = getResistorColorBands(470);
  assert.equal(bands470[0].nameEn, 'Yellow');
  assert.equal(bands470[1].nameEn, 'Violet');
  assert.equal(bands470[2].nameEn, 'Brown');

  const bands1000 = getResistorColorBands(1000);
  assert.equal(bands1000[0].nameEn, 'Brown');
  assert.equal(bands1000[1].nameEn, 'Black');
  assert.equal(bands1000[2].nameEn, 'Red');
});

test('Ohm regression slope & Challenge 2 Black Box validation', () => {
  const points = [
    { current: 0.01, voltage: 4.7 },
    { current: 0.02, voltage: 9.4 },
    { current: 0.04, voltage: 18.8 },
  ];
  const reg = calculateOhmRegressionSlope(points);
  assert.ok(Math.abs(reg.slopeResistance - 470) < 0.1);
  assert.ok(reg.rSquared > 0.999);

  const comps: CircuitComponent[] = [
    { id: 'bb', type: 'blackbox', label: 'Caja Negra', nodeA: 'n1', nodeB: 'n0', resistance: 470 },
  ];
  assert.equal(validateChallenge2(comps, 3, 470).passed, true);
  assert.equal(validateChallenge2(comps, 2, 470).passed, false);
  assert.equal(validateChallenge2(comps, 3, 220).passed, false);
});

import {
  solveTopologyCircuit,
  analyzeWorkbenchCircuit,
  buildTopologyComponents3D,
  getResistorColorBands5,
  computeRCAndLEDState,
} from './circuit-engine';

test('QuantumLabs Topology Solver: Series, Parallel, and Mixed (R1 + R2||R3) analytical equilibrium', () => {
  // 1. Serie: 24V con R1=10, R2=20, R3=30 -> Req = 60 Ω, I = 0.4 A
  const ser = solveTopologyCircuit({
    isPowered: true,
    topology: 'series',
    sourceVoltage: 24,
    r1: 10,
    r2: 20,
    r3: 30,
    f1: 'ON',
    f2: 'ON',
    f3: 'ON',
  });
  assert.ok(Math.abs(ser.equivalentResistance - 60) < 0.01);
  assert.ok(Math.abs(ser.totalCurrent - 0.4) < 0.001);
  assert.equal(ser.kvlVerified, true);

  // 2. Paralelo: 12V con R1=30, R2=30, R3=30 -> Req = 10 Ω, I = 1.2 A
  const par = solveTopologyCircuit({
    isPowered: true,
    topology: 'parallel',
    sourceVoltage: 12,
    r1: 30,
    r2: 30,
    r3: 30,
    f1: 'ON',
    f2: 'ON',
    f3: 'ON',
  });
  assert.ok(Math.abs(par.equivalentResistance - 10) < 0.01);
  assert.ok(Math.abs(par.totalCurrent - 1.2) < 0.001);

  // 3. Mixto: R1=10 en serie con (R2=20 || R3=20 = 10) -> Req = 20 Ω, 20V -> I = 1.0 A
  const mix = solveTopologyCircuit({
    isPowered: true,
    topology: 'mixed',
    sourceVoltage: 20,
    r1: 10,
    r2: 20,
    r3: 20,
    f1: 'ON',
    f2: 'ON',
    f3: 'ON',
  });
  assert.ok(Math.abs(mix.equivalentResistance - 20) < 0.01);
  assert.ok(Math.abs(mix.totalCurrent - 1.0) < 0.001);
  assert.ok(Math.abs(mix.branches[0].voltageDrop - 10) < 0.01);
  assert.ok(Math.abs(mix.branches[1].voltageDrop - 10) < 0.01);
});

test('QuantumLabs Fault Injection: OPEN and SHORT branch states trip OCP cutoff (totalCurrent = 0)', () => {
  const openSeries = solveTopologyCircuit({
    isPowered: true,
    topology: 'series',
    sourceVoltage: 18,
    r1: 10,
    r2: 20,
    r3: 30,
    f1: 'ON',
    f2: 'OPEN',
    f3: 'ON',
  });
  assert.equal(openSeries.isOpenCircuitFault, true);
  assert.equal(openSeries.totalCurrent, 0);
  assert.ok(Math.abs(openSeries.branches[1].voltageDrop - 18) < 0.001);

  const shortParallel = solveTopologyCircuit({
    isPowered: true,
    topology: 'parallel',
    sourceVoltage: 12,
    r1: 10,
    r2: 20,
    r3: 30,
    f1: 'SHORT',
    f2: 'ON',
    f3: 'ON',
  });
  assert.equal(shortParallel.isShortCircuitFault, true);
  assert.equal(shortParallel.totalCurrent, 0);
  assert.equal(shortParallel.totalPower, 0);
  assert.ok((shortParallel.shortCircuitPeakCurrent ?? 0) >= 20);

  // Dynamic MNA workbench verification: modifying R1, R2, R3 independently updates Ohm & Kirchhoff
  const comps = buildTopologyComponents3D({
    topology: 'series',
    sourceVoltage: 24,
    r1: 20,
    r2: 30,
    r3: 50,
    f1: 'ON',
    f2: 'ON',
    f3: 'ON',
    isPowered: true,
  });
  const initialDiag = analyzeWorkbenchCircuit(comps, true, 'series');
  assert.ok(Math.abs(initialDiag.equivalentResistance - 100) < 0.05);
  assert.ok(Math.abs(initialDiag.totalCurrent - 0.24) < 0.005);

  // Independently drag/modify R2 from 30 Ω to 50 Ω -> Req becomes 120 Ω, I becomes 0.20 A
  const updatedComps = comps.map((c) => (c.id === 'res-2' ? { ...c, resistance: 50 } : c));
  const updatedDiag = analyzeWorkbenchCircuit(updatedComps, true, 'series');
  assert.ok(Math.abs(updatedDiag.equivalentResistance - 120) < 0.05);
  assert.ok(Math.abs(updatedDiag.totalCurrent - 0.20) < 0.005);
  assert.ok(Math.abs(updatedDiag.branches[1].voltageDrop - 10) < 0.05);

  // Shorting R2 triggers physical OCP cutoff: active current drops to 0.000 A
  const shortedComps = updatedComps.map((c) => (c.id === 'res-2' ? { ...c, faultState: 'SHORT' as const } : c));
  const shortedDiag = analyzeWorkbenchCircuit(shortedComps, true, 'series');
  assert.equal(shortedDiag.isShortCircuitFault, true);
  assert.equal(shortedDiag.totalCurrent, 0);
  assert.equal(shortedDiag.totalPower, 0);
  assert.ok((shortedDiag.shortCircuitPeakCurrent ?? 0) >= 20);
});

test('5-Band precision EIA color code and RC + LED transient state', () => {
  const bands5 = getResistorColorBands5(470);
  assert.equal(bands5.length, 5);
  assert.equal(bands5[0].nameEn, 'Yellow');
  assert.equal(bands5[1].nameEn, 'Violet');
  assert.equal(bands5[2].nameEn, 'Black');

  const rc = computeRCAndLEDState({
    sourceVoltage: 12,
    seriesResistanceOhms: 1000,
    capacitanceMicroFarads: 1000,
    elapsedSeconds: 1.0,
    isCharging: true,
  });
  // En t = tau (1.0 s), V_c = V_0 * (1 - e^-1) ≈ 0.6321 * 12 ≈ 7.585 V
  assert.ok(Math.abs(rc.capacitorVoltage - 12 * (1 - Math.exp(-1))) < 0.05);
  assert.equal(rc.ledBurnedOut, false);
});

