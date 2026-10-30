import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSpacePreset,
  stepVerletIntegration,
  computeSpacetimeCurvatureDepth,
  computeSystemEnergetics,
} from './space-engine';
import { validateSpaceChallenge1, validateSpaceChallenge2 } from './space-challenges';

test('Velocity Verlet integrator preserves circular orbit radius and total mechanical energy', () => {
  let bodies = createSpacePreset('geostationary', 1.0, 1.0);
  const initialEnergy = computeSystemEnergetics(bodies, 1.0);
  assert.ok(Math.abs(initialEnergy.primaryOrbitalRadius - 9.0) < 0.01);

  for (let step = 0; step < 200; step++) {
    bodies = stepVerletIntegration(bodies, 0.02, 1.0);
  }

  const finalEnergy = computeSystemEnergetics(bodies, 1.0);
  // El radio orbital circular a 1.5 R_E (9.0 u) se mantiene estable
  assert.ok(Math.abs(finalEnergy.primaryOrbitalRadius - 9.0) < 0.35);
  // La energía total se conserva con alta precisión
  const relEnergyDrift = Math.abs(finalEnergy.totalEnergy - initialEnergy.totalEnergy) / Math.abs(initialEnergy.totalEnergy);
  assert.ok(relEnergyDrift < 0.02);
});

test('Einsteinian spacetime curvature depth is deeper near massive stars', () => {
  const bodies = createSpacePreset('solar', 1.0, 1.0);
  const depthAtSun = computeSpacetimeCurvatureDepth(0, 0, bodies, 1.0);
  const depthFarAway = computeSpacetimeCurvatureDepth(30, 30, bodies, 1.0);
  assert.ok(depthAtSun < depthFarAway);
  assert.ok(depthAtSun < -3.0);
});

test('Space Challenges 1 and 2 algorithmic validation', () => {
  const geoBodies = createSpacePreset('geostationary', 1.0, 1.0);
  assert.equal(validateSpaceChallenge1('geostationary', 1.0, geoBodies).passed, true);
  assert.equal(validateSpaceChallenge1('geostationary', 1.45, geoBodies).passed, false);

  let lagrangeBodies = createSpacePreset('lagrange', 1.0, 1.0);
  for (let i = 0; i < 50; i++) {
    lagrangeBodies = stepVerletIntegration(lagrangeBodies, 0.02, 1.0);
  }
  assert.equal(validateSpaceChallenge2('lagrange', 1.0, lagrangeBodies).passed, true);
  assert.equal(validateSpaceChallenge2('lagrange', 0.65, lagrangeBodies).passed, false);
});

import {
  computeKeplerAndHohmannAnalytics,
  createKeplerianCustomSystem,
} from './space-engine';

test('Kepler Laws (1st, 2nd, 3rd), Escape Velocity, and Hohmann Transfer analytics', () => {
  // Tierra: M = 1 M☉, a = 1 UA, e = 0 -> T = 1.00 año, v_esc ≈ 42.1 km/s
  const earthMetrics = computeKeplerAndHohmannAnalytics({
    centralMassSolar: 1.0,
    semiMajorAxisAU: 1.0,
    eccentricity: 0.0,
    targetOrbitAU: 1.524,
  });
  assert.ok(Math.abs(earthMetrics.orbitalPeriodYears - 1.0) < 0.001);
  assert.ok(Math.abs(earthMetrics.escapeVelocityKmS - 29.78 * Math.SQRT2) < 0.1);
  assert.ok(earthMetrics.hohmannDeltaV1KmS > 2.5 && earthMetrics.hohmannDeltaV1KmS < 3.5);
  assert.ok(earthMetrics.hohmannTransferTimeYears > 0.65 && earthMetrics.hohmannTransferTimeYears < 0.75);

  // Con excentricidad e = 0.5, la velocidad en perihelio supera a la velocidad en afelio (2ª Ley de Kepler)
  const eccentricMetrics = computeKeplerAndHohmannAnalytics({
    centralMassSolar: 1.0,
    semiMajorAxisAU: 2.0,
    eccentricity: 0.5,
  });
  assert.ok(eccentricMetrics.perihelionVelocityKmS > eccentricMetrics.aphelionVelocityKmS * 2.5);
  assert.ok(Math.abs(eccentricMetrics.perihelionAU - 1.0) < 0.001);
  assert.ok(Math.abs(eccentricMetrics.aphelionAU - 3.0) < 0.001);

  const customBodies = createKeplerianCustomSystem({
    centralMassSolar: 1.2,
    semiMajorAxisAU: 1.0,
    eccentricity: 0.3,
    isHohmannTransferActive: true,
  });
  assert.equal(customBodies.length, 3);
});

import {
  createSpacetimeShaderMesh,
  updateSpacetimeShaderUniforms,
  SPACETIME_VERTEX_SHADER,
  SPACETIME_FRAGMENT_SHADER,
} from './SpaceScene3D';

test('SpaceScene3D custom GLSL ShaderMaterial initializes uniforms and updates N-body masses', () => {
  assert.ok(SPACETIME_VERTEX_SHADER.includes('uBodyMasses'));
  assert.ok(SPACETIME_FRAGMENT_SHADER.includes('vWorldXZ'));

  const handle = createSpacetimeShaderMesh(false);
  assert.ok(handle.mesh);
  assert.ok(handle.material.uniforms.uBodyCount);

  const bodies = createSpacePreset('solar', 1.0, 1.0);
  updateSpacetimeShaderUniforms(handle, bodies, 1.2, 2.5, 3.2);

  assert.equal(handle.material.uniforms.uBodyCount.value, bodies.length);
  assert.equal(handle.material.uniforms.uG.value, 1.2);
  assert.equal(handle.material.uniforms.uTime.value, 2.5);
});

import {
  convertCentralBodyToBlackHole,
  triggerPlanetaryCollisionCourse,
  detectAndResolveCollisions,
} from './space-engine';

test('Black Hole conversion and Supernova planetary collision detection', () => {
  const solarBodies = createSpacePreset('solar', 1.0, 1.0);
  const bhBodies = convertCentralBodyToBlackHole(solarBodies, true);
  assert.equal(bhBodies[0].isBlackHole, true);
  assert.ok(bhBodies[0].mass > solarBodies[0].mass);

  const restoredBodies = convertCentralBodyToBlackHole(bhBodies, false);
  assert.equal(restoredBodies[0].isBlackHole, false);
  assert.equal(restoredBodies[0].mass, solarBodies[0].mass);

  // Provocar colisión planetaria total y verificar que se activa allOrbitersCollided (Supernova)
  let crashingBodies = triggerPlanetaryCollisionCourse(bhBodies);
  let supernovaTriggered = false;

  for (let step = 0; step < 300; step++) {
    crashingBodies = stepVerletIntegration(crashingBodies, 0.025, 1.0);
    const col = detectAndResolveCollisions(crashingBodies);
    if (col.collisions.length > 0) {
      crashingBodies = col.bodies;
      if (col.allOrbitersCollided) {
        supernovaTriggered = true;
        break;
      }
    }
  }

  assert.equal(supernovaTriggered, true);
  assert.equal(crashingBodies.length, 1);
});


