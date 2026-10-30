import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PAYLOAD_CATALOG,
  GRAVITY_PRESETS,
  EXOTIC_ENVIRONMENT_PRESETS,
  getPayloadById,
  computeForcesAndAcceleration,
  computeEnvironmentDiagnostics,
  computeExoticTrajectoryPreview,
  simulateFullTrajectory,
  evaluateTargetHit,
  findNearestTrajectorySample,
  SimulationParams2D,
} from './PhysicsEngine2D';

function createBaseParams(overrides?: Partial<SimulationParams2D>): SimulationParams2D {
  const cannonball = getPayloadById('cannonball');
  return {
    v0: 40,
    angleDeg: 45,
    h0: 5,
    gravity: 9.81,
    airDensity: 1.225,
    isVacuum: false,
    windSpeed: 0,
    massKg: cannonball.massKg,
    diameterM: cannonball.diameterM,
    dragCoeff: cannonball.dragCoeff,
    payloadId: 'cannonball',
    ...overrides,
  };
}

test('Catalog contains all 8 required payloads and 6 gravity environments (including Space / Zero-G)', () => {
  assert.equal(PAYLOAD_CATALOG.length, 8);
  assert.equal(GRAVITY_PRESETS.length, 6);
  assert.equal(EXOTIC_ENVIRONMENT_PRESETS.length, 5);

  const spacePreset = GRAVITY_PRESETS.find((p) => p.id === 'space');
  assert.ok(spacePreset);
  assert.equal(spacePreset.gravityMs2, 0);
  assert.equal(spacePreset.defaultAirDensityKgM3, 0);

  const piano = getPayloadById('piano');
  assert.equal(piano.massKg, 400.0);
  assert.equal(piano.diameterM, 1.60);
  assert.equal(piano.dragCoeff, 1.05);
  assert.equal(piano.iconEmoji, '🎹');

  const watermelon = getPayloadById('watermelon');
  assert.equal(watermelon.massKg, 4.5);
  assert.equal(watermelon.diameterM, 0.28);
  assert.equal(watermelon.dragCoeff, 0.44);
  assert.equal(watermelon.iconEmoji, '🍉');
});

test('Independent Planetary Scenarios (Mars & Zero-G Space) work with any payload and clamp strictly at y >= 0', () => {
  const mars = GRAVITY_PRESETS.find((p) => p.id === 'mars')!;
  for (const id of ['cannonball', 'watermelon', 'piano'] as const) {
    const spec = getPayloadById(id);
    const traj = simulateFullTrajectory(
      createBaseParams({
        gravity: mars.gravityMs2,
        airDensity: mars.defaultAirDensityKgM3,
        isVacuum: false,
        payloadId: id,
        massKg: spec.massKg,
        diameterM: spec.diameterM,
        dragCoeff: spec.dragCoeff,
      })
    );
    assert.ok(traj.rangeM > 0);
    assert.equal(traj.samples[traj.samples.length - 1].y, 0);
    for (const sample of traj.samples) {
      assert.ok(sample.y >= 0, `Mars trajectory sample y must be >= 0, got ${sample.y}`);
    }
  }

  // Zero-G space flight should integrate cleanly without NaN and maintain y >= 0
  const zeroGTraj = simulateFullTrajectory(
    createBaseParams({
      gravity: 0,
      airDensity: 0,
      isVacuum: true,
      v0: 30,
      angleDeg: 25,
      h0: 5,
    })
  );
  assert.equal(Number.isFinite(zeroGTraj.rangeM), true);
  assert.ok(zeroGTraj.rangeM > 100);
  for (const sample of zeroGTraj.samples) {
    assert.ok(sample.y >= 0);
  }
});

test('Galileo Vacuum Equivalence: Cannonball, Piano, Watermelon and Paper Plane have identical range and flight time when isVacuum = true', () => {
  const payloads = ['cannonball', 'piano', 'watermelon', 'paper-plane'] as const;
  const results = payloads.map((id) => {
    const spec = getPayloadById(id);
    return simulateFullTrajectory(
      createBaseParams({
        isVacuum: true,
        payloadId: id,
        massKg: spec.massKg,
        diameterM: spec.diameterM,
        dragCoeff: spec.dragCoeff,
      })
    );
  });

  const reference = results[0];
  // Compare against analytical parabola solution
  assert.ok(
    Math.abs(reference.rangeM - reference.analyticalVacuumRangeM) < 0.02,
    `Expected RK4 vacuum range ${reference.rangeM} to match analytical ${reference.analyticalVacuumRangeM}`
  );
  assert.ok(
    Math.abs(reference.maxHeightM - reference.analyticalVacuumMaxHeightM) < 0.02,
    `Expected RK4 vacuum apex ${reference.maxHeightM} to match analytical ${reference.analyticalVacuumMaxHeightM}`
  );

  for (const res of results) {
    assert.ok(Math.abs(res.rangeM - reference.rangeM) < 1e-6);
    assert.ok(Math.abs(res.flightTimeS - reference.flightTimeS) < 1e-6);
    assert.ok(Math.abs(res.maxHeightM - reference.maxHeightM) < 1e-6);
    // Mechanical energy is strictly conserved in vacuum
    assert.ok(
      Math.abs(res.initialMechanicalEnergyJ - res.finalMechanicalEnergyJ) /
        res.initialMechanicalEnergyJ <
        1e-4
    );
  }
});

test('Rayleigh Aerodynamic Drag separates trajectories by ballistic coefficient and dissipates thermal energy', () => {
  const cannonballSpec = getPayloadById('cannonball');
  const watermelonSpec = getPayloadById('watermelon');
  const paperPlaneSpec = getPayloadById('paper-plane');

  const cannonRes = simulateFullTrajectory(
    createBaseParams({
      isVacuum: false,
      payloadId: 'cannonball',
      massKg: cannonballSpec.massKg,
      diameterM: cannonballSpec.diameterM,
      dragCoeff: cannonballSpec.dragCoeff,
    })
  );

  const watermelonRes = simulateFullTrajectory(
    createBaseParams({
      isVacuum: false,
      payloadId: 'watermelon',
      massKg: watermelonSpec.massKg,
      diameterM: watermelonSpec.diameterM,
      dragCoeff: watermelonSpec.dragCoeff,
    })
  );

  const paperRes = simulateFullTrajectory(
    createBaseParams({
      isVacuum: false,
      payloadId: 'paper-plane',
      massKg: paperPlaneSpec.massKg,
      diameterM: paperPlaneSpec.diameterM,
      dragCoeff: paperPlaneSpec.dragCoeff,
    })
  );

  assert.ok(
    cannonRes.rangeM > watermelonRes.rangeM,
    'Cannonball should travel farther than watermelon in air'
  );
  assert.ok(
    watermelonRes.rangeM > paperRes.rangeM,
    'Watermelon should travel farther than ultralight paper plane in air'
  );
  assert.ok(
    watermelonRes.thermalDissipatedJ > 0,
    'Aerodynamic drag must dissipate mechanical energy into thermal energy'
  );
});

test('Wind speed modifies horizontal range as expected (headwind vs tailwind)', () => {
  const duck = getPayloadById('rubber-duck');
  const noWind = simulateFullTrajectory(
    createBaseParams({
      payloadId: 'rubber-duck',
      massKg: duck.massKg,
      diameterM: duck.diameterM,
      dragCoeff: duck.dragCoeff,
      windSpeed: 0,
    })
  );
  const headwind = simulateFullTrajectory(
    createBaseParams({
      payloadId: 'rubber-duck',
      massKg: duck.massKg,
      diameterM: duck.diameterM,
      dragCoeff: duck.dragCoeff,
      windSpeed: -12,
    })
  );
  const tailwind = simulateFullTrajectory(
    createBaseParams({
      payloadId: 'rubber-duck',
      massKg: duck.massKg,
      diameterM: duck.diameterM,
      dragCoeff: duck.dragCoeff,
      windSpeed: 12,
    })
  );

  assert.ok(headwind.rangeM < noWind.rangeM, 'Headwind must reduce horizontal range');
  assert.ok(tailwind.rangeM > noWind.rangeM, 'Tailwind must increase horizontal range');
});

test('Ground impact interpolation prevents negative Y tunneling and zero-velocity guard avoids NaN', () => {
  const zeroCheck = computeForcesAndAcceleration(0, 0, createBaseParams({ windSpeed: 0 }));
  assert.equal(Number.isNaN(zeroCheck.ax), false);
  assert.equal(Number.isNaN(zeroCheck.ay), false);
  assert.equal(zeroCheck.dragMagnitude, 0);

  const trajectory = simulateFullTrajectory(createBaseParams({ h0: 12, v0: 35, angleDeg: 38 }));
  const lastSample = trajectory.samples[trajectory.samples.length - 1];
  assert.equal(lastSample.y, 0);
  for (const s of trajectory.samples) {
    assert.ok(s.y >= 0, `Sample Y must never be negative, got ${s.y}`);
  }
});

test('Target evaluation awards 3 stars on bullseye and Socratic feedback on miss', () => {
  const trajectory = simulateFullTrajectory(createBaseParams({ isVacuum: false, windSpeed: -10 }));
  const bullseyeTarget = {
    distanceX: trajectory.rangeM,
    radiusM: 4,
    elevationY: 0,
    levelNumber: 1,
    windChallengeSpeed: -10,
  };

  const hitEval = evaluateTargetHit(trajectory, bullseyeTarget);
  assert.equal(hitEval.hit, true);
  assert.equal(hitEval.stars, 3);
  assert.equal(hitEval.awardedPoints, 150);

  const farTarget = {
    distanceX: trajectory.rangeM + 35,
    radiusM: 4,
    elevationY: 0,
    levelNumber: 2,
    windChallengeSpeed: -10,
  };
  const missEval = evaluateTargetHit(trajectory, farTarget);
  assert.equal(missEval.hit, false);
  assert.equal(missEval.stars, 0);
  assert.ok(missEval.socraticFeedbackEs.includes('viento en contra'));

  const probeHit = findNearestTrajectorySample([trajectory], trajectory.apexX, trajectory.maxHeightM, 5);
  assert.ok(probeHit !== null);
  assert.ok(Math.abs(probeHit.sample.y - trajectory.maxHeightM) < 1.0);
});

test('Exotic manual environments (Venus 65 kg/m³, Titan 5.3 kg/m³, Micro-g) remain RK4-stable and match terminal velocity physics', () => {
  const paper = getPayloadById('paper-plane');
  const venusDiag = computeEnvironmentDiagnostics({
    massKg: paper.massKg,
    diameterM: paper.diameterM,
    dragCoeff: paper.dragCoeff,
    gravity: 8.87,
    airDensity: 65.0,
    isVacuum: false,
  });

  assert.ok(venusDiag.terminalVelocityMs !== null && venusDiag.terminalVelocityMs > 0);
  assert.equal(venusDiag.aerodynamicRegimeEs, 'Régimen Supercrítico Viscoso');

  // Launch ultralight 5g paper plane at 60 m/s into Venus 65 kg/m³ supercritical CO2
  const venusPaperTraj = simulateFullTrajectory(
    createBaseParams({
      v0: 60,
      angleDeg: 45,
      h0: 10,
      gravity: 8.87,
      airDensity: 65.0,
      isVacuum: false,
      payloadId: 'paper-plane',
      massKg: paper.massKg,
      diameterM: paper.diameterM,
      dragCoeff: paper.dragCoeff,
    })
  );

  assert.equal(Number.isFinite(venusPaperTraj.rangeM), true);
  assert.equal(Number.isFinite(venusPaperTraj.impactSpeedMs), true);
  assert.ok(venusPaperTraj.rangeM > 0 && venusPaperTraj.rangeM < 5);

  // Vacuum diagnostics should return null terminalVelocityMs
  const vacDiag = computeEnvironmentDiagnostics({
    massKg: paper.massKg,
    diameterM: paper.diameterM,
    dragCoeff: paper.dragCoeff,
    gravity: 0.28,
    airDensity: 0,
    isVacuum: true,
  });
  assert.equal(vacDiag.terminalVelocityMs, null);
  assert.equal(vacDiag.aerodynamicRegimeEs, 'Vacío Balístico Ideal (ρ = 0)');
});

test('Manual (g, ρ) slider sweeps via computeExoticTrajectoryPreview produce monotonic range and drag loss behavior', () => {
  const watermelon = getPayloadById('watermelon');
  const gValues = [1.35, 3.71, 9.81, 24.79, 60.0];
  const gRanges = gValues.map(
    (g) =>
      computeExoticTrajectoryPreview(
        createBaseParams({
          payloadId: 'watermelon',
          massKg: watermelon.massKg,
          diameterM: watermelon.diameterM,
          dragCoeff: watermelon.dragCoeff,
          gravity: g,
          airDensity: 1.225,
          isVacuum: false,
        })
      ).trajectory.rangeM
  );

  for (let i = 1; i < gRanges.length; i++) {
    assert.ok(
      gRanges[i] < gRanges[i - 1],
      `Expected higher gravity (${gValues[i]} m/s²) to yield shorter range (${gRanges[i]} < ${gRanges[i - 1]})`
    );
  }

  const rhoValues = [0, 0.5, 1.225, 5.3, 25.0, 65.0];
  const rhoPreviews = rhoValues.map((rho) =>
    computeExoticTrajectoryPreview(
      createBaseParams({
        payloadId: 'watermelon',
        massKg: watermelon.massKg,
        diameterM: watermelon.diameterM,
        dragCoeff: watermelon.dragCoeff,
        gravity: 9.81,
        airDensity: rho,
        isVacuum: rho === 0,
      })
    )
  );

  assert.ok(rhoPreviews[0].dragRangeLossM < 0.05, 'Zero air density should have negligible drag loss');
  for (let i = 1; i < rhoPreviews.length; i++) {
    assert.ok(
      rhoPreviews[i].trajectory.rangeM < rhoPreviews[i - 1].trajectory.rangeM,
      `Expected higher air density (${rhoValues[i]} kg/m³) to reduce range`
    );
    assert.ok(
      rhoPreviews[i].dragRangeLossM > rhoPreviews[i - 1].dragRangeLossM,
      `Expected higher air density (${rhoValues[i]} kg/m³) to increase drag loss`
    );
  }
});

