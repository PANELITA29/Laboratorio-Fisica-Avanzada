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
  scaleCentralBodyMass,
  triggerPlanetaryCollisionCourse,
  detectAndResolveCollisions,
} from './space-engine';

test('Black Hole conversion, mass scaling, and Supernova planetary collision detection', () => {
  const solarBodies = createSpacePreset('solar', 1.0, 1.0);
  const bhBodies = convertCentralBodyToBlackHole(solarBodies, true);
  assert.equal(bhBodies[0].isBlackHole, true);
  assert.ok(bhBodies[0].mass > solarBodies[0].mass);

  // Cambiar la masa del Agujero Negro mediante las barras de simulación conserva isBlackHole=true y escala su masa
  const heavierBhBodies = scaleCentralBodyMass(bhBodies, 2.2, true);
  assert.equal(heavierBhBodies[0].isBlackHole, true);
  assert.ok(heavierBhBodies[0].mass > bhBodies[0].mass);
  assert.equal(heavierBhBodies.length, solarBodies.length);

  // Cambiar parámetros keplerianos con isBlackHole=true mantiene el Agujero Negro en lugar de regresar al Sol
  const keplerBh = createKeplerianCustomSystem({
    centralMassSolar: 1.8,
    semiMajorAxisAU: 1.4,
    eccentricity: 0.35,
    isHohmannTransferActive: false,
    G: 1.5,
    isBlackHole: true,
  });
  assert.equal(keplerBh[0].isBlackHole, true);

  const restoredBodies = convertCentralBodyToBlackHole(heavierBhBodies, false);
  assert.equal(restoredBodies[0].isBlackHole, false);

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

import { useLabGlobalStore } from '../../store/useLabGlobalStore';

test('Global Zustand store (useLabGlobalStore) preserves mass, gravity, and Black Hole state without erroneous resets', () => {
  const store = useLabGlobalStore.getState();
  store.setSpaceCentralMass(2.1);
  store.setSpaceGravityG(1.65);
  store.setSpaceBlackHole(true);

  const afterBh = useLabGlobalStore.getState().spaceLab;
  assert.equal(afterBh.isBlackHole, true);
  assert.equal(afterBh.centralMassSolar, 2.1);
  assert.equal(afterBh.gravityG, 1.65);
  assert.equal(afterBh.bodies[0].isBlackHole, true);

  // Cambiar gravedad o velocidad de inserción con el Agujero Negro activo NO reinicia la masa ni desactiva el Agujero Negro
  store.setSpaceGravityG(1.85);
  store.setSpaceInsertionFactor(1.15);

  const afterSliders = useLabGlobalStore.getState().spaceLab;
  assert.equal(afterSliders.isBlackHole, true);
  assert.equal(afterSliders.centralMassSolar, 2.1);
  assert.equal(afterSliders.gravityG, 1.85);
  assert.equal(afterSliders.bodies[0].isBlackHole, true);
});

import * as THREE from 'three';
import {
  computeRelativisticAndTidalMetrics,
  spawnCustomPlanetOnPlane,
  injectBinarySchwarzschildSpaghettificationProbe,
  computeSchwarzschildRadius,
} from './space-engine';
import { deformPlanetGeometryForSpaghettification } from './SpaceScene3D';

test('Binary Black Holes preset, 3D Tidal Spaghettification across Schwarzschild Radius, Relativistic Time Dilation, and Click-to-Spawn Planets', () => {
  const binaryBodies = createSpacePreset('binary-bh', 1.0, 1.0);
  assert.equal(binaryBodies.filter((b) => b.isBlackHole).length, 2);

  // Verificar dilatación temporal gravitatoria (dτ/dt < 1) y elongación de marea (λ >= 1)
  const relMetrics = computeRelativisticAndTidalMetrics(binaryBodies, 1.2);
  assert.ok(relMetrics.properTimeRate > 0 && relMetrics.properTimeRate < 1.0);
  assert.ok(relMetrics.lorentzGamma >= 1.0);
  assert.ok(relMetrics.maxTidalStretch >= 1.0);

  // Inyectar sonda directamente dentro del Radio de Schwarzschild (r <= r_s) del Agujero Negro Binario
  const crossingBodies = injectBinarySchwarzschildSpaghettificationProbe(binaryBodies, 1.2);
  const crossingMetrics = computeRelativisticAndTidalMetrics(crossingBodies, 1.2);
  assert.equal(crossingMetrics.isCrossingSchwarzschild, true);
  assert.equal(crossingMetrics.spaghettificationRegime, 'schwarzschild-spaghettification');
  assert.ok(crossingMetrics.horizonDistanceRatio <= 1.0);
  assert.ok(crossingMetrics.maxTidalStretch >= 3.4);
  assert.ok(crossingMetrics.lorentzGamma >= 5.0);

  const probeState = crossingMetrics.tidalByBodyId['probe-schwarzschild'];
  assert.ok(probeState);
  assert.equal(probeState.crossedSchwarzschild, true);
  assert.ok(probeState.vertexPinchIntensity >= 0.65);

  // Verificar deformación real de vértices en THREE.BufferGeometry (Espaguetización de malla 3D)
  const sphereGeo = new THREE.SphereGeometry(1.15, 16, 14);
  const posAttr = sphereGeo.attributes.position as THREE.BufferAttribute;
  const basePositions = new Float32Array(posAttr.array as Float32Array);
  deformPlanetGeometryForSpaghettification(
    sphereGeo,
    basePositions,
    1.15,
    probeState.stretchFactor,
    probeState.vertexPinchIntensity,
    1.5
  );
  let maxLongitudinalX = 0;
  for (let i = 0; i < posAttr.count; i++) {
    maxLongitudinalX = Math.max(maxLongitudinalX, Math.abs(posAttr.getX(i)));
  }
  assert.ok(maxLongitudinalX > 1.15 * 1.8);
  assert.ok(computeSchwarzschildRadius(780, 1.0, true) >= 4.4);

  // Verificar creador de planetas con clic en el plano orbital 3D (y = 0)
  const withSpawned = spawnCustomPlanetOnPlane(binaryBodies, 19.5, -14.0, 1.2, 1.0);
  assert.equal(withSpawned.length, binaryBodies.length + 1);
  const newest = withSpawned[withSpawned.length - 1];
  assert.equal(newest.position.x, 19.5);
  assert.equal(newest.position.z, -14.0);
  assert.ok(Math.hypot(newest.velocity.x, newest.velocity.z) > 0.5);
});






