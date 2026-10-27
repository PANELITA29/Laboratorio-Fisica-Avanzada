import { CelestialBody, SpacePresetId } from './space-engine';

export interface SpaceChallenge {
  id: string;
  presetId: SpacePresetId;
  titleEs: string;
  titleEn: string;
  descriptionEs: string;
  descriptionEn: string;
  hintEs: string;
  hintEn: string;
  points: number;
}

export const SPACE_CHALLENGES: SpaceChallenge[] = [
  {
    id: 'space-1',
    presetId: 'geostationary',
    titleEs: 'Reto Espacial 1: Inserción Orbital Circular a 1.5 R⊕',
    titleEn: 'Space Challenge 1: Circular Orbital Insertion at 1.5 R⊕',
    descriptionEs:
      'Ajusta el Factor de Velocidad de Inserción para colocar el satélite en una órbita circular estable a 1.5 radios terrestres (r = 9.0 u) sin colisionar ni superar la velocidad de escape.',
    descriptionEn:
      'Tune the Insertion Velocity Factor to place the satellite into a stable circular orbit at 1.5 Earth radii (r = 9.0 u) without colliding or exceeding escape velocity.',
    hintEs: 'Para una órbita circular perfecta, la fuerza centrípeta iguala a la gravitación: v_c = √(G·M / r). Ajusta el Factor de Velocidad a 1.00x (±0.04x).',
    hintEn: 'For a perfect circular orbit, centripetal force equals gravity: v_c = √(G·M / r). Set the Insertion Velocity Factor to 1.00x (±0.04x).',
    points: 300,
  },
  {
    id: 'space-2',
    presetId: 'lagrange',
    titleEs: 'Reto Espacial 2: Coreografía de 3 Cuerpos de Lagrange',
    titleEn: 'Space Challenge 2: 3-Body Lagrangian Choreography',
    descriptionEs:
      'Estabiliza un sistema de tres estrellas con masas iguales (M₁ = M₂ = M₃) en configuración equilátera homográfica de Lagrange manteniendo la simetría orbital.',
    descriptionEn:
      'Stabilize a three-star system of equal masses (M₁ = M₂ = M₃) in a Lagrangian equilateral homographic choreography while preserving orbital symmetry.',
    hintEs: 'Carga el montaje "Coreografía 3 Cuerpos" y ajusta el Factor de Velocidad de Inserción a 1.00x (±0.05x) con G = 1.0 para equilibrar la atracción mutua.',
    hintEn: 'Load the "3-Body Choreography" preset and set the Insertion Velocity Factor to 1.00x (±0.05x) with G = 1.0 to balance mutual attraction.',
    points: 350,
  },
];

export interface SpaceValidationResult {
  passed: boolean;
  messageEs: string;
  messageEn: string;
}

/**
 * Valida el Reto Espacial 1:
 * - Preset 'geostationary' activo
 * - Factor de velocidad cercano a 1.00 (excentricidad e < 0.08) y radio orbital cercano a 9.0 u (1.5 R_E)
 */
export function validateSpaceChallenge1(
  preset: SpacePresetId,
  insertionFactor: number,
  bodies: CelestialBody[]
): SpaceValidationResult {
  if (preset !== 'geostationary') {
    return {
      passed: false,
      messageEs: 'Primero selecciona el escenario "Órbita Geoestacionaria (Reto 1)" usando el botón "Cargar Montaje Base".',
      messageEn: 'First select the "Circular Orbit 1.5 R⊕ (Challenge 1)" preset using the "Load Base Setup" button.',
    };
  }

  const earth = bodies.find((b) => b.id === 'earth');
  const sat = bodies.find((b) => b.id === 'satellite');
  if (!earth || !sat) {
    return {
      passed: false,
      messageEs: 'No se encontró el satélite en escena.',
      messageEn: 'Satellite not found in the scene.',
    };
  }

  const dx = sat.position.x - earth.position.x;
  const dz = sat.position.z - earth.position.z;
  const r = Math.sqrt(dx * dx + dz * dz);

  // Velocidad de escape es sqrt(2) * v_c ≈ 1.414 * v_c
  if (insertionFactor >= 1.38) {
    return {
      passed: false,
      messageEs: `Factor ${insertionFactor.toFixed(2)}x cercano o superior a la velocidad de escape (√2 · v_c). El satélite escapará al espacio profundo.`,
      messageEn: `Factor ${insertionFactor.toFixed(2)}x is near or above escape velocity (√2 · v_c). The satellite will escape into deep space.`,
    };
  }

  if (insertionFactor <= 0.78 || r < 5.5) {
    return {
      passed: false,
      messageEs: `Velocidad insuficiente (${insertionFactor.toFixed(2)}x). La órbita decae hacia la atmósfera terrestre.`,
      messageEn: `Insufficient velocity (${insertionFactor.toFixed(2)}x). The orbit decays toward Earth's atmosphere.`,
    };
  }

  if (Math.abs(insertionFactor - 1.0) <= 0.05 && Math.abs(r - 9.0) <= 1.2) {
    return {
      passed: true,
      messageEs: `¡Inserción Orbital Exitosa! Satélite estabilizado a r = ${r.toFixed(2)} u (1.50 R⊕) con excentricidad casi nula (v = ${insertionFactor.toFixed(2)} v_c).`,
      messageEn: `Orbital Insertion Successful! Satellite stabilized at r = ${r.toFixed(2)} u (1.50 R⊕) with near-zero eccentricity (v = ${insertionFactor.toFixed(2)} v_c).`,
    };
  }

  return {
    passed: false,
    messageEs: `Órbita elíptica detectada (Factor = ${insertionFactor.toFixed(2)}x, r = ${r.toFixed(1)} u). Ajusta el factor a 1.00x para circularizar a 1.5 R⊕.`,
    messageEn: `Elliptical orbit detected (Factor = ${insertionFactor.toFixed(2)}x, r = ${r.toFixed(1)} u). Tune factor to 1.00x to circularize at 1.5 R⊕.`,
  };
}

/**
 * Valida el Reto Espacial 2:
 * - Preset 'lagrange' activo
 * - Tres cuerpos de masas iguales con distancias mutuas equilibradas y factor de velocidad 1.00 ± 0.06
 */
export function validateSpaceChallenge2(
  preset: SpacePresetId,
  insertionFactor: number,
  bodies: CelestialBody[]
): SpaceValidationResult {
  if (preset !== 'lagrange' || bodies.length < 3) {
    return {
      passed: false,
      messageEs: 'Carga primero el montaje "Coreografía 3 Cuerpos (Reto 2)" para iniciar la prueba de Lagrange.',
      messageEn: 'First load the "3-Body Choreography (Challenge 2)" setup to test the Lagrangian solution.',
    };
  }

  const d12 = Math.hypot(
    bodies[0].position.x - bodies[1].position.x,
    bodies[0].position.z - bodies[1].position.z
  );
  const d23 = Math.hypot(
    bodies[1].position.x - bodies[2].position.x,
    bodies[1].position.z - bodies[2].position.z
  );
  const d31 = Math.hypot(
    bodies[2].position.x - bodies[0].position.x,
    bodies[2].position.z - bodies[0].position.z
  );

  const avgDist = (d12 + d23 + d31) / 3;
  const maxDev = Math.max(Math.abs(d12 - avgDist), Math.abs(d23 - avgDist), Math.abs(d31 - avgDist));

  if (Math.abs(insertionFactor - 1.0) <= 0.06 && maxDev < avgDist * 0.25 && avgDist > 8 && avgDist < 35) {
    return {
      passed: true,
      messageEs: `¡Solución de Lagrange Verificada! Los 3 cuerpos mantienen un triángulo equilátero estable de lado L = ${avgDist.toFixed(1)} u.`,
      messageEn: `Lagrangian Solution Verified! All 3 bodies maintain a stable equilateral triangle of side L = ${avgDist.toFixed(1)} u.`,
    };
  }

  return {
    passed: false,
    messageEs: `Inestabilidad de tres cuerpos detectada (Factor = ${insertionFactor.toFixed(2)}x). Ajusta el Factor de Velocidad a 1.00x y reinicia la órbita.`,
    messageEn: `Three-body instability detected (Factor = ${insertionFactor.toFixed(2)}x). Set Insertion Velocity Factor to 1.00x and reset the orbit.`,
  };
}
