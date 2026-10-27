import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stepRK4Pendulum,
  computeMechanicsEnergetics,
  validateMechanicsChallenge1,
  validateMechanicsChallenge2,
  PendulumState,
  MechanicsParameters,
} from './mechanics-engine';

test('RK4 pendulum integration conserves mechanical energy when damping is zero', () => {
  const params: MechanicsParameters = {
    length: 1.0,
    mass: 2.0,
    gravity: 9.81,
    damping: 0.0,
    couplingSpring: 0.0,
  };
  let state: PendulumState = {
    theta: 0.4,
    omega: 0.0,
    phi: 0,
    phiDot: 0,
    theta2: 0,
    omega2: 0,
  };

  const initialE = computeMechanicsEnergetics(state, params).totalEnergy;
  for (let i = 0; i < 300; i++) {
    state = stepRK4Pendulum(state, params, 0.01);
  }
  const finalE = computeMechanicsEnergetics(state, params).totalEnergy;
  assert.ok(Math.abs(finalE - initialE) < 1e-4);
});

test('Seconds pendulum challenge validation at L = 1.00m and g = 9.81m/s2', () => {
  const resPass = validateMechanicsChallenge1({
    length: 1.0,
    mass: 1.0,
    gravity: 9.81,
    damping: 0,
    couplingSpring: 0,
  });
  assert.equal(resPass.passed, true);

  const resFail = validateMechanicsChallenge1({
    length: 2.5,
    mass: 1.0,
    gravity: 9.81,
    damping: 0,
    couplingSpring: 0,
  });
  assert.equal(resFail.passed, false);
});

test('Coupled resonance challenge validation', () => {
  const resPass = validateMechanicsChallenge2('coupled-resonance', {
    length: 1.5,
    mass: 2.0,
    gravity: 9.81,
    damping: 0.0,
    couplingSpring: 2.5,
  });
  assert.equal(resPass.passed, true);
});
