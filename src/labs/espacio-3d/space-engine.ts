/**
 * Motor Físico de Gravitación Universal N-Cuerpos y Relatividad General (Deformación Espacio-Temporal).
 * Implementa Integración Simpléctica de Velocity Verlet para conservación de energía orbital a largo plazo.
 */

export interface Vector3D {
  x: number;
  y: number; // En nuestro espacio 3D: X-Z es el plano orbital horizontal, Y es la vertical (curvatura relativista)
  z: number;
}

export interface CelestialBody {
  id: string;
  nameEs: string;
  nameEn: string;
  mass: number;
  radius: number;
  color: string;
  emissive?: boolean;
  position: Vector3D;
  velocity: Vector3D;
  acceleration: Vector3D;
  isFixed?: boolean;
  isBlackHole?: boolean;
  baseMass?: number;
  baseNameEs?: string;
  baseNameEn?: string;
  baseColor?: string;
  baseRadius?: number;
}

export type SpacePresetId =
  | 'solar'
  | 'earth-moon'
  | 'exoplanet'
  | 'geostationary'
  | 'lagrange'
  | 'binary-bh';

export const DEFAULT_G = 1.0;
export const SOFTENING_EPSILON = 1.6;

/**
 * Calcula las aceleraciones gravitacionales newtonianas para todos los cuerpos:
 * F_i = sum_{j != i} G * m_i * m_j * (r_j - r_i) / (|r_j - r_i|^2 + eps^2)^(3/2)
 */
export function computeGravitationalAccelerations(
  bodies: CelestialBody[],
  G: number = DEFAULT_G,
  softening: number = 0.35
): Vector3D[] {
  const n = bodies.length;
  const accels: Vector3D[] = Array.from({ length: n }, () => ({ x: 0, y: 0, z: 0 }));
  const epsSq = softening * softening;

  for (let i = 0; i < n; i++) {
    if (bodies[i].isFixed) continue;
    let ax = 0;
    let ay = 0;
    let az = 0;
    const bi = bodies[i];

    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const bj = bodies[j];
      const dx = bj.position.x - bi.position.x;
      const dy = bj.position.y - bi.position.y;
      const dz = bj.position.z - bi.position.z;

      const distSq = dx * dx + dy * dy + dz * dz + epsSq;
      const invDistCube = 1 / (distSq * Math.sqrt(distSq));
      const factor = G * bj.mass * invDistCube;

      ax += factor * dx;
      ay += factor * dy;
      az += factor * dz;
    }

    accels[i] = { x: ax, y: ay, z: az };
  }

  return accels;
}

/**
 * Avanza el sistema N-cuerpos un paso de tiempo dt mediante el integrador simpléctico Velocity Verlet:
 * 1. x(t + dt) = x(t) + v(t)*dt + 0.5*a(t)*dt^2
 * 2. a(t + dt) = F(x(t + dt)) / m
 * 3. v(t + dt) = v(t) + 0.5*(a(t) + a(t + dt))*dt
 */
export function stepVerletIntegration(
  bodies: CelestialBody[],
  dt: number,
  G: number = DEFAULT_G
): CelestialBody[] {
  const currentAccels = computeGravitationalAccelerations(bodies, G);

  // Paso 1: Actualizar posiciones
  const updatedBodies: CelestialBody[] = bodies.map((b, i) => {
    if (b.isFixed) {
      return { ...b, acceleration: { x: 0, y: 0, z: 0 } };
    }
    const a = currentAccels[i];
    return {
      ...b,
      position: {
        x: b.position.x + b.velocity.x * dt + 0.5 * a.x * dt * dt,
        y: b.position.y + b.velocity.y * dt + 0.5 * a.y * dt * dt,
        z: b.position.z + b.velocity.z * dt + 0.5 * a.z * dt * dt,
      },
      acceleration: a,
    };
  });

  // Paso 2: Evaluar nuevas aceleraciones en x(t + dt)
  const nextAccels = computeGravitationalAccelerations(updatedBodies, G);

  // Paso 3: Actualizar velocidades con el promedio de aceleraciones
  for (let i = 0; i < updatedBodies.length; i++) {
    if (updatedBodies[i].isFixed) continue;
    const a0 = currentAccels[i];
    const a1 = nextAccels[i];
    updatedBodies[i].velocity = {
      x: updatedBodies[i].velocity.x + 0.5 * (a0.x + a1.x) * dt,
      y: updatedBodies[i].velocity.y + 0.5 * (a0.y + a1.y) * dt,
      z: updatedBodies[i].velocity.z + 0.5 * (a0.z + a1.z) * dt,
    };
    updatedBodies[i].acceleration = a1;
  }

  return updatedBodies;
}

/**
 * Calcula el hundimiento relativista del espacio-tiempo z(x, z_coord) en el plano orbital:
 * y_disp(x, z) = - sum_i (G * M_i) / sqrt((x - x_i)^2 + (z - z_i)^2 + epsilon^2)
 */
export function computeSpacetimeCurvatureDepth(
  x: number,
  z: number,
  bodies: CelestialBody[],
  G: number = DEFAULT_G,
  epsilon: number = 3.2
): number {
  let totalDepth = 0;
  const epsSq = epsilon * epsilon;
  const scaleFactor = 0.022; // Escala visual calibrada para el pozo gravitacional

  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    const dx = x - b.position.x;
    const dz = z - b.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz + epsSq);
    totalDepth -= (G * b.mass * scaleFactor) / dist;
  }

  return Math.max(-14, totalDepth);
}

/**
 * Calcula la energía mecánica total del sistema (Cinética + Potencial Gravitatoria) y el radio orbital principal.
 */
export function computeSystemEnergetics(bodies: CelestialBody[], G: number = DEFAULT_G): {
  kineticEnergy: number;
  potentialEnergy: number;
  totalEnergy: number;
  primaryOrbitalRadius: number;
  primarySpeed: number;
} {
  let kineticEnergy = 0;
  let potentialEnergy = 0;

  for (let i = 0; i < bodies.length; i++) {
    const bi = bodies[i];
    const vSq = bi.velocity.x ** 2 + bi.velocity.y ** 2 + bi.velocity.z ** 2;
    kineticEnergy += 0.5 * bi.mass * vSq;

    for (let j = i + 1; j < bodies.length; j++) {
      const bj = bodies[j];
      const dx = bj.position.x - bi.position.x;
      const dy = bj.position.y - bi.position.y;
      const dz = bj.position.z - bi.position.z;
      const r = Math.sqrt(dx * dx + dy * dy + dz * dz + 0.25);
      potentialEnergy -= (G * bi.mass * bj.mass) / r;
    }
  }

  let primaryOrbitalRadius = 0;
  let primarySpeed = 0;
  if (bodies.length >= 2) {
    const center = bodies[0];
    const orbiter = bodies[bodies.length - 1];
    const dx = orbiter.position.x - center.position.x;
    const dz = orbiter.position.z - center.position.z;
    primaryOrbitalRadius = Math.sqrt(dx * dx + dz * dz);
    primarySpeed = Math.sqrt(
      orbiter.velocity.x ** 2 + orbiter.velocity.y ** 2 + orbiter.velocity.z ** 2
    );
  }

  return {
    kineticEnergy,
    potentialEnergy,
    totalEnergy: kineticEnergy + potentialEnergy,
    primaryOrbitalRadius,
    primarySpeed,
  };
}

/**
 * Crea las configuraciones astrofísicas predefinidas con velocidades orbitales analíticas v = sqrt(G*M/r).
 */
export function createSpacePreset(
  preset: SpacePresetId,
  insertionVelocityFactor: number = 1.0,
  G: number = DEFAULT_G
): CelestialBody[] {
  if (preset === 'solar') {
    const mSun = 1200;
    const rEarth = 16;
    const vEarth = Math.sqrt((G * mSun) / rEarth) * insertionVelocityFactor;
    const rMars = 24;
    const vMars = Math.sqrt((G * mSun) / rMars);

    return [
      {
        id: 'sun',
        nameEs: 'Sol',
        nameEn: 'Sun',
        mass: mSun,
        radius: 3.0,
        color: '#F59E0B',
        emissive: true,
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
        isFixed: true,
      },
      {
        id: 'earth',
        nameEs: 'Tierra',
        nameEn: 'Earth',
        mass: 18,
        radius: 1.15,
        color: '#06B6D4',
        position: { x: rEarth, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: vEarth },
        acceleration: { x: 0, y: 0, z: 0 },
      },
      {
        id: 'mars',
        nameEs: 'Marte',
        nameEn: 'Mars',
        mass: 9,
        radius: 0.85,
        color: '#EF4444',
        position: { x: -rMars, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: -vMars },
        acceleration: { x: 0, y: 0, z: 0 },
      },
    ];
  }

  if (preset === 'earth-moon') {
    const mEarth = 850;
    const rMoon = 18;
    const vMoon = Math.sqrt((G * mEarth) / rMoon);
    const rSat = 10;
    const vSat = Math.sqrt((G * mEarth) / rSat) * insertionVelocityFactor;

    return [
      {
        id: 'earth',
        nameEs: 'Tierra',
        nameEn: 'Earth',
        mass: mEarth,
        radius: 2.6,
        color: '#0284C7',
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
        isFixed: true,
      },
      {
        id: 'moon',
        nameEs: 'Luna',
        nameEn: 'Moon',
        mass: 22,
        radius: 0.9,
        color: '#94A3B8',
        position: { x: rMoon, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: vMoon },
        acceleration: { x: 0, y: 0, z: 0 },
      },
      {
        id: 'satellite',
        nameEs: 'Sonda Orbital',
        nameEn: 'Orbital Probe',
        mass: 0.5,
        radius: 0.55,
        color: '#A855F7',
        position: { x: 0, y: 0, z: rSat },
        velocity: { x: -vSat, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
      },
    ];
  }

  if (preset === 'exoplanet') {
    const mStar = 1400;
    const rHotJupiter = 11.5;
    const vHotJupiter = Math.sqrt((G * mStar) / rHotJupiter) * insertionVelocityFactor;

    return [
      {
        id: 'star',
        nameEs: 'Estrella Kepler-186',
        nameEn: 'Kepler-186 Star',
        mass: mStar,
        radius: 3.2,
        color: '#FB923C',
        emissive: true,
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
        isFixed: true,
      },
      {
        id: 'exoplanet',
        nameEs: 'Exoplaneta Gigante',
        nameEn: 'Giant Exoplanet',
        mass: 45,
        radius: 1.45,
        color: '#8B5CF6',
        position: { x: rHotJupiter, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: vHotJupiter },
        acceleration: { x: 0, y: 0, z: 0 },
      },
    ];
  }

  if (preset === 'geostationary') {
    // Reto Espacial 1: Tierra con radio R_E = 6.0 unidades -> 1.5 R_E = 9.0 unidades.
    const mEarth = 900;
    const rTarget = 9.0; // 1.5 radios terrestres (R_E = 6.0)
    const vCircular = Math.sqrt((G * mEarth) / rTarget); // Exactamente 10.0 u/s para G=1
    const vActual = vCircular * insertionVelocityFactor;

    return [
      {
        id: 'earth',
        nameEs: 'Tierra (R⊕ = 6.0 u)',
        nameEn: 'Earth (R⊕ = 6.0 u)',
        mass: mEarth,
        radius: 2.8,
        color: '#0EA5E9',
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
        isFixed: true,
      },
      {
        id: 'satellite',
        nameEs: 'Satélite a 1.5 R⊕',
        nameEn: 'Satellite at 1.5 R⊕',
        mass: 0.2,
        radius: 0.65,
        color: '#22D3EE',
        position: { x: rTarget, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: vActual },
        acceleration: { x: 0, y: 0, z: 0 },
      },
    ];
  }

  if (preset === 'binary-bh') {
    // Sistema Binario de Agujeros Negros en espiral relativista + sonda en cruce del Radio de Schwarzschild + planeta circumbinario
    const mBH = 780;
    const rBin = 6.8;
    // Dos masas iguales M orbitando su baricentro a distancia 2*rBin: F = G*M^2 / (2*rBin)^2 = M * v^2 / rBin -> v = sqrt(G*M / (4*rBin))
    const vBin = Math.sqrt((G * mBH) / (4 * rBin)) * insertionVelocityFactor;
    const rTest = 19.5;
    const vTest = Math.sqrt((G * (2 * mBH)) / rTest);

    // Sonda relativista en órbita elíptica rasante que cruza el Radio de Schwarzschild (r_s) del sistema binario
    const rProbe = 11.2;
    const vProbe = Math.sqrt((G * (2 * mBH)) / rProbe) * 0.58 * insertionVelocityFactor;

    return [
      {
        id: 'bh-alpha',
        nameEs: 'Agujero Negro Alfa',
        nameEn: 'Black Hole Alpha',
        mass: mBH,
        baseMass: mBH,
        radius: 2.25,
        baseRadius: 2.25,
        color: '#A855F7',
        baseColor: '#A855F7',
        emissive: true,
        isBlackHole: true,
        position: { x: rBin, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: vBin },
        acceleration: { x: 0, y: 0, z: 0 },
      },
      {
        id: 'bh-beta',
        nameEs: 'Agujero Negro Beta',
        nameEn: 'Black Hole Beta',
        mass: mBH,
        baseMass: mBH,
        radius: 2.25,
        baseRadius: 2.25,
        color: '#EC4899',
        baseColor: '#EC4899',
        emissive: true,
        isBlackHole: true,
        position: { x: -rBin, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: -vBin },
        acceleration: { x: 0, y: 0, z: 0 },
      },
      {
        id: 'probe-schwarzschild',
        nameEs: 'Sonda Relativista (Horizonte r_s)',
        nameEn: 'Relativistic Probe (r_s Horizon)',
        mass: 4.5,
        radius: 1.05,
        color: '#F43F5E',
        position: { x: 0, y: 0, z: rProbe },
        velocity: { x: -vProbe, y: 0, z: -vProbe * 0.35 },
        acceleration: { x: 0, y: 0, z: 0 },
      },
      {
        id: 'planet-tidal',
        nameEs: 'Exoplaneta Circumbinario',
        nameEn: 'Circumbinary Exoplanet',
        mass: 12,
        radius: 1.15,
        color: '#06B6D4',
        position: { x: 0, y: 0, z: -rTest },
        velocity: { x: vTest, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
      },
    ];
  }

  // Preset 'lagrange': Solución triangular equilátera de Lagrange para 3 cuerpos de masas iguales M = 320
  const M = 320;
  const R = 13.5; // Radio circunscrito del triángulo equilátero
  // Lado del triángulo L = sqrt(3) * R. En la solución homográfica de Lagrange: omega = sqrt(G * 3 * M / L^3)
  const L = Math.sqrt(3) * R;
  const omega = Math.sqrt((G * 3 * M) / (L * L * L));
  const vMag = omega * R * insertionVelocityFactor;

  const angles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
  const colors = ['#06B6D4', '#F59E0B', '#A855F7'];

  return angles.map((theta, idx) => ({
    id: `body-${idx + 1}`,
    nameEs: `Estrella Alfa-${idx + 1}`,
    nameEn: `Alpha Star-${idx + 1}`,
    mass: M,
    radius: 1.5,
    color: colors[idx],
    emissive: true,
    position: {
      x: R * Math.cos(theta),
      y: 0,
      z: R * Math.sin(theta),
    },
    velocity: {
      x: -vMag * Math.sin(theta),
      y: 0,
      z: vMag * Math.cos(theta),
    },
    acceleration: { x: 0, y: 0, z: 0 },
  }));
}

// ============================================================================
// QUANTUMLABS ASTRONOMY EXPANSION: LEYES DE KEPLER (1ª, 2ª, 3ª),
// EXCENTRICIDAD ORBITAL, VELOCIDAD DE ESCAPE Y TRANSFERENCIA DE HOHMANN
// ============================================================================

export interface KeplerianOrbitalMetrics {
  centralMassSolar: number; // M en Masas Solares (M☉)
  semiMajorAxisAU: number; // Semieje mayor 'a' (UA)
  eccentricity: number; // Excentricidad 'e' (0.00 a 0.85)
  perihelionAU: number; // r_p = a (1 - e)
  aphelionAU: number; // r_a = a (1 + e)
  orbitalPeriodYears: number; // 3ª Ley de Kepler: T = sqrt(a³ / M)
  perihelionVelocityKmS: number; // 2ª Ley de Kepler (máxima velocidad en perihelio)
  aphelionVelocityKmS: number; // Mínima velocidad en afelio
  escapeVelocityKmS: number; // v_esc = sqrt(2GM / r)
  arealVelocityConst: number; // dA/dt = L / (2m) constante
  hohmannDeltaV1KmS: number; // Impulso Δv₁ de inyección elíptica de Hohmann
  hohmannDeltaV2KmS: number; // Impulso Δv₂ de circularización en órbita destino
  hohmannTransferTimeYears: number; // Tiempo de vuelo T_trans = 0.5 * sqrt(a_trans³ / M)
}

/**
 * Calcula con precisión analítica las 3 Leyes de Kepler, Velocidad de Escape
 * y los impulsos Δv₁ y Δv₂ de una maniobra de Transferencia Orbital de Hohmann.
 */
export function computeKeplerAndHohmannAnalytics(params: {
  centralMassSolar: number;
  semiMajorAxisAU: number;
  eccentricity: number;
  targetOrbitAU?: number;
}): KeplerianOrbitalMetrics {
  const M = Math.max(0.1, params.centralMassSolar);
  const a = Math.max(0.2, params.semiMajorAxisAU);
  const e = Math.max(0, Math.min(0.88, params.eccentricity));
  const r2 = Math.max(a * 1.25, params.targetOrbitAU ?? a * 1.524); // Por defecto órbita tipo Marte (1.524 UA)

  const perihelionAU = a * (1 - e);
  const aphelionAU = a * (1 + e);

  // 3ª Ley de Kepler en unidades astronómicas y masas solares: T² = a³ / M
  const orbitalPeriodYears = Math.sqrt((a * a * a) / M);

  // Velocidad orbital base de la Tierra (a=1 UA, M=1 M☉) ≈ 29.78 km/s
  const V_EARTH_KMS = 29.78;
  const vCircularMean = V_EARTH_KMS * Math.sqrt(M / a);

  // Ecuación vis-viva en perihelio y afelio: v = v_c * sqrt((1+e)/(1-e)) y v_a = v_c * sqrt((1-e)/(1+e))
  const perihelionVelocityKmS = vCircularMean * Math.sqrt((1 + e) / Math.max(0.05, 1 - e));
  const aphelionVelocityKmS = vCircularMean * Math.sqrt((1 - e) / (1 + e));

  // Velocidad de escape a distancia media a: v_esc = sqrt(2) * v_circular
  const escapeVelocityKmS = Math.SQRT2 * vCircularMean;

  // 2ª Ley de Kepler: velocidad areal constante dA/dt = π * a * b / T
  const semiMinorAxisB = a * Math.sqrt(1 - e * e);
  const arealVelocityConst = (Math.PI * a * semiMinorAxisB) / Math.max(0.01, orbitalPeriodYears);

  // Maniobra de Transferencia Orbital de Hohmann desde r1 = a hasta r2 = targetOrbitAU
  const r1 = a;
  const aTransfer = 0.5 * (r1 + r2);
  const v1Circular = V_EARTH_KMS * Math.sqrt(M / r1);
  const v2Circular = V_EARTH_KMS * Math.sqrt(M / r2);

  const vTransferPerigee = V_EARTH_KMS * Math.sqrt(M * (2 / r1 - 1 / aTransfer));
  const vTransferApogee = V_EARTH_KMS * Math.sqrt(M * (2 / r2 - 1 / aTransfer));

  const hohmannDeltaV1KmS = Math.abs(vTransferPerigee - v1Circular);
  const hohmannDeltaV2KmS = Math.abs(v2Circular - vTransferApogee);
  const hohmannTransferTimeYears = 0.5 * Math.sqrt((aTransfer ** 3) / M);

  return {
    centralMassSolar: M,
    semiMajorAxisAU: a,
    eccentricity: e,
    perihelionAU,
    aphelionAU,
    orbitalPeriodYears,
    perihelionVelocityKmS,
    aphelionVelocityKmS,
    escapeVelocityKmS,
    arealVelocityConst,
    hohmannDeltaV1KmS,
    hohmannDeltaV2KmS,
    hohmannTransferTimeYears,
  };
}

/**
 * Crea un sistema planetario parametrizado por Masa estelar M, Semieje mayor a,
 * Excentricidad orbital e y opción de inyección en órbita de Transferencia de Hohmann.
 */
export function createKeplerianCustomSystem(params: {
  centralMassSolar: number;
  semiMajorAxisAU: number;
  eccentricity: number;
  isHohmannTransferActive: boolean;
  G?: number;
  isBlackHole?: boolean;
}): CelestialBody[] {
  const G = params.G ?? DEFAULT_G;
  const mSun = 1000 * Math.max(0.2, params.centralMassSolar);
  const aScene = 14 * Math.max(0.4, params.semiMajorAxisAU);
  const e = Math.max(0, Math.min(0.85, params.eccentricity));

  // Si está activo el Agujero Negro, usar su masa relativista efectiva para la órbita inicial
  const effectiveCentralMass = params.isBlackHole ? mSun * 1.85 : mSun;

  // Colocar el planeta en su perihelio r_p = a * (1 - e)
  const rPeri = aScene * (1 - e);
  // Por la ecuación Vis-Viva en el perihelio: v_p = sqrt(G * M * (1 + e) / (a * (1 - e)))
  let vPeri = Math.sqrt(((G * effectiveCentralMass) / aScene) * ((1 + e) / Math.max(0.08, 1 - e)));

  const rOuterMars = aScene * 1.52;
  const vOuterMars = Math.sqrt((G * effectiveCentralMass) / rOuterMars);

  // Si se activa la maniobra de Hohmann, inyectar el planeta/sonda en la elipse de transferencia hacia rOuterMars
  if (params.isHohmannTransferActive) {
    const aTrans = 0.5 * (rPeri + rOuterMars);
    vPeri = Math.sqrt(G * effectiveCentralMass * (2 / rPeri - 1 / aTrans));
  }

  const baseBodies: CelestialBody[] = [
    {
      id: 'sun',
      nameEs: `Sol (${params.centralMassSolar.toFixed(1)} M☉)`,
      nameEn: `Sun (${params.centralMassSolar.toFixed(1)} M☉)`,
      mass: mSun,
      radius: Math.min(4.2, 2.5 * Math.cbrt(params.centralMassSolar)),
      color: '#F59E0B',
      emissive: true,
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      acceleration: { x: 0, y: 0, z: 0 },
      isFixed: true,
    },
    {
      id: 'planet-kepler',
      nameEs: params.isHohmannTransferActive ? 'Sonda Hohmann' : `Planeta (e=${e.toFixed(2)})`,
      nameEn: params.isHohmannTransferActive ? 'Hohmann Probe' : `Planet (e=${e.toFixed(2)})`,
      mass: 15,
      radius: 1.15,
      color: '#06B6D4',
      position: { x: rPeri, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: vPeri },
      acceleration: { x: 0, y: 0, z: 0 },
    },
    {
      id: 'mars-target',
      nameEs: 'Órbita Destino (Marte)',
      nameEn: 'Target Orbit (Mars)',
      mass: 8,
      radius: 0.9,
      color: '#EF4444',
      position: { x: -rOuterMars, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: -vOuterMars },
      acceleration: { x: 0, y: 0, z: 0 },
    },
  ];

  return params.isBlackHole
    ? convertCentralBodyToBlackHole(baseBodies, true)
    : baseBodies;
}

// ============================================================================
// COLISIONES PLANETARIAS, SUPERNOVA CATACLÍSMICA Y AGUJERO NEGRO RELATIVISTA
// ============================================================================

export interface PlanetaryCollisionEvent {
  position: Vector3D;
  survivorId: string;
  absorbedId: string;
  absorbedNameEs: string;
  absorbedNameEn: string;
  energyReleasedGJ: number;
}

export interface CollisionStepResult {
  bodies: CelestialBody[];
  collisions: PlanetaryCollisionEvent[];
  allOrbitersCollided: boolean;
}

/**
 * Transforma el astro central entre una estrella/planeta convencional y un
 * Agujero Negro de Kerr-Schwarzschild con horizonte de sucesos y disco de acreción.
 */
export function convertCentralBodyToBlackHole(
  bodies: CelestialBody[],
  enableBlackHole: boolean
): CelestialBody[] {
  if (bodies.length === 0) return bodies;

  const isBinarySystem = bodies.some((b) => b.id === 'bh-alpha' || b.id === 'bh-beta');
  if (isBinarySystem && enableBlackHole) {
    return bodies.map((b) =>
      b.id === 'bh-alpha' || b.id === 'bh-beta' ? { ...b, isBlackHole: true } : b
    );
  }

  return bodies.map((b, idx) => {
    if (idx !== 0 && !b.id.startsWith('bh-')) return b;

    const origMass = b.baseMass ?? b.mass;
    const origNameEs = b.baseNameEs ?? b.nameEs;
    const origNameEn = b.baseNameEn ?? b.nameEn;
    const origColor = b.baseColor ?? b.color;
    const origRadius = b.baseRadius ?? b.radius;

    if (enableBlackHole) {
      const solarEquiv = origMass / 1000;
      const scaledBhRadius = Math.max(1.8, Math.min(4.6, 2.8 * Math.cbrt(origMass / 1200)));
      return {
        ...b,
        baseMass: origMass,
        baseNameEs: origNameEs,
        baseNameEn: origNameEn,
        baseColor: origColor,
        baseRadius: origRadius,
        isBlackHole: true,
        nameEs: b.id.startsWith('bh-')
          ? b.nameEs
          : `Agujero Negro (${solarEquiv.toFixed(1)} M☉)`,
        nameEn: b.id.startsWith('bh-')
          ? b.nameEn
          : `Black Hole (${solarEquiv.toFixed(1)} M☉)`,
        mass: b.id.startsWith('bh-') ? origMass : origMass * 1.85,
        radius: b.id.startsWith('bh-') ? origRadius : scaledBhRadius,
        color: '#A855F7',
        emissive: true,
      };
    }

    return {
      ...b,
      isBlackHole: false,
      mass: origMass,
      nameEs: origNameEs,
      nameEn: origNameEn,
      color: origColor,
      radius: origRadius,
    };
  });
}

/**
 * Actualiza en tiempo real la masa y el radio del astro central (Sol o Agujero Negro)
 * sin perder el modo Agujero Negro ni destruir los planetas actualmente en órbita.
 */
export function scaleCentralBodyMass(
  bodies: CelestialBody[],
  centralMassSolar: number,
  isBlackHole: boolean
): CelestialBody[] {
  if (bodies.length === 0) return bodies;
  const clampedSolar = Math.max(0.2, centralMassSolar);
  const isBinarySystem = bodies.some((b) => b.id === 'bh-alpha' || b.id === 'bh-beta');

  if (isBinarySystem) {
    const binMass = 780 * clampedSolar;
    const binRadius = Math.max(1.6, Math.min(3.4, 2.25 * Math.cbrt(clampedSolar)));
    return bodies.map((b) => {
      if (b.id === 'bh-alpha' || b.id === 'bh-beta') {
        return {
          ...b,
          mass: binMass,
          baseMass: binMass,
          radius: binRadius,
          baseRadius: binRadius,
          isBlackHole: true,
        };
      }
      return b;
    });
  }

  const newBaseMass = 1200 * clampedSolar;
  const newBaseRadius = Math.min(4.2, 2.6 * Math.cbrt(clampedSolar));

  const updated = bodies.map((b, idx) => {
    if (idx !== 0) return b;
    return {
      ...b,
      baseMass: newBaseMass,
      baseRadius: newBaseRadius,
      baseNameEs: `Sol (${clampedSolar.toFixed(1)} M☉)`,
      baseNameEn: `Sun (${clampedSolar.toFixed(1)} M☉)`,
      baseColor: '#F59E0B',
      mass: newBaseMass,
      radius: newBaseRadius,
      nameEs: `Sol (${clampedSolar.toFixed(1)} M☉)`,
      nameEn: `Sun (${clampedSolar.toFixed(1)} M☉)`,
    };
  });

  return convertCentralBodyToBlackHole(updated, isBlackHole);
}

/**
 * Configura todos los planetas en órbita en una trayectoria de caída en espiral
 * hacia el centro gravitacional para provocar la colisión planetaria total y detonar una Supernova.
 */
export function triggerPlanetaryCollisionCourse(bodies: CelestialBody[]): CelestialBody[] {
  if (bodies.length <= 1) return bodies;
  const center = bodies[0].position;

  return bodies.map((b, idx) => {
    if (idx === 0 && b.isFixed) return b;
    const dx = center.x - b.position.x;
    const dy = center.y - b.position.y;
    const dz = center.z - b.position.z;
    const dist = Math.hypot(dx, dy, dz) || 1;
    // Impulso centrípeto directo hacia el astro central con un ligero momento angular residual
    const inwardSpeed = 11.5;
    return {
      ...b,
      velocity: {
        x: (dx / dist) * inwardSpeed + b.velocity.x * 0.12,
        y: (dy / dist) * inwardSpeed,
        z: (dz / dist) * inwardSpeed + b.velocity.z * 0.12,
      },
    };
  });
}

/**
 * Detecta colisiones físicas entre cuerpos celestes cuando |r_i - r_j| <= r_i + r_j.
 * Fusiona masa y momento lineal de forma inelástica y determina si TODOS los planetas
 * han colisionado (condición de masa crítica para detonar la Supernova).
 */
export function detectAndResolveCollisions(bodies: CelestialBody[]): CollisionStepResult {
  if (bodies.length <= 1) {
    return { bodies, collisions: [], allOrbitersCollided: false };
  }

  const nextBodies: CelestialBody[] = bodies.map((b) => ({
    ...b,
    position: { ...b.position },
    velocity: { ...b.velocity },
    acceleration: { ...b.acceleration },
  }));

  const removedIndices = new Set<number>();
  const collisions: PlanetaryCollisionEvent[] = [];

  for (let i = 0; i < nextBodies.length; i++) {
    if (removedIndices.has(i)) continue;
    for (let j = i + 1; j < nextBodies.length; j++) {
      if (removedIndices.has(j)) continue;

      const bi = nextBodies[i];
      const bj = nextBodies[j];
      const dx = bj.position.x - bi.position.x;
      const dy = bj.position.y - bi.position.y;
      const dz = bj.position.z - bi.position.z;
      const dist = Math.hypot(dx, dy, dz);

      // Para un Agujero Negro, el Horizonte de Schwarzschild (r_s) permite que una sonda cruce r <= r_s
      // y experimente espaguetización 3D antes de ser absorbida al caer en el núcleo interno (r <= 0.52 * r_s).
      const isBhPair = bi.isBlackHole && bj.isBlackHole;
      const hasSingleBh = (bi.isBlackHole || bj.isBlackHole) && !isBhPair;
      const bhBody = bi.isBlackHole ? bi : bj.isBlackHole ? bj : null;
      const bhRs = bhBody ? computeSchwarzschildRadius(bhBody.mass, DEFAULT_G, true) : 0;
      const collisionThreshold = hasSingleBh
        ? Math.max(
            Math.max(bi.radius, bj.radius) * 0.95 + Math.min(bi.radius, bj.radius) * 0.35,
            bhRs * 0.52
          )
        : (bi.radius + bj.radius) * (isBhPair ? 1.15 : 1.05);

      if (dist <= collisionThreshold) {
        // El cuerpo con mayor masa (o fijo) sobrevive y absorbe al menor
        const iSurvives = bi.isFixed || (!bj.isFixed && bi.mass >= bj.mass);
        const survivorIdx = iSurvives ? i : j;
        const absorbedIdx = iSurvives ? j : i;

        const survivor = nextBodies[survivorIdx];
        const absorbed = nextBodies[absorbedIdx];

        const relVx = absorbed.velocity.x - survivor.velocity.x;
        const relVy = absorbed.velocity.y - survivor.velocity.y;
        const relVz = absorbed.velocity.z - survivor.velocity.z;
        const relSpeedSq = relVx * relVx + relVy * relVy + relVz * relVz;
        const reducedMass = (survivor.mass * absorbed.mass) / Math.max(1e-5, survivor.mass + absorbed.mass);
        const energyReleasedGJ = 0.5 * reducedMass * relSpeedSq + survivor.mass * absorbed.mass * 0.25;

        const totalMass = survivor.mass + absorbed.mass;
        if (!survivor.isFixed) {
          survivor.velocity = {
            x: (survivor.mass * survivor.velocity.x + absorbed.mass * absorbed.velocity.x) / totalMass,
            y: (survivor.mass * survivor.velocity.y + absorbed.mass * absorbed.velocity.y) / totalMass,
            z: (survivor.mass * survivor.velocity.z + absorbed.mass * absorbed.velocity.z) / totalMass,
          };
          survivor.position = {
            x: (survivor.mass * survivor.position.x + absorbed.mass * absorbed.position.x) / totalMass,
            y: (survivor.mass * survivor.position.y + absorbed.mass * absorbed.position.y) / totalMass,
            z: (survivor.mass * survivor.position.z + absorbed.mass * absorbed.position.z) / totalMass,
          };
        }

        survivor.mass = totalMass;
        survivor.radius = Math.min(4.6, Math.cbrt(survivor.radius ** 3 + absorbed.radius ** 3 * 0.65));

        collisions.push({
          position: { ...absorbed.position },
          survivorId: survivor.id,
          absorbedId: absorbed.id,
          absorbedNameEs: absorbed.nameEs,
          absorbedNameEn: absorbed.nameEn,
          energyReleasedGJ,
        });

        removedIndices.add(absorbedIdx);
        if (absorbedIdx === i) break;
      }
    }
  }

  if (collisions.length === 0) {
    return { bodies, collisions: [], allOrbitersCollided: false };
  }

  const remaining = nextBodies.filter((_, idx) => !removedIndices.has(idx));
  const nonBhOrbiters = remaining.filter((b, idx) => !b.isBlackHole && !(idx === 0 && b.isFixed));
  const allOrbitersCollided = remaining.length <= 1 || nonBhOrbiters.length === 0;

  return {
    bodies: remaining,
    collisions,
    allOrbitersCollided,
  };
}

// ============================================================================
// ESPAGUETIZACIÓN 3D (DEFORMACIÓN DE MALLA EN RADIO DE SCHWARZSCHILD r_s),
// DILATACIÓN TEMPORAL RELATIVISTA Y CREADOR INTERACTIVO DE PLANETAS CON CLIC
// ============================================================================

/**
 * Calcula el Radio de Schwarzschild efectivo r_s = 2 G M / c_eff² en unidades del escenario 3D.
 * Escala con la raíz cúbica de la masa (acotado entre 4.4 u y 6.8 u) para que coincida con el
 * horizonte visual del Agujero Negro y no engulla las órbitas planetarias exteriores (r = 11..24 u).
 */
export function computeSchwarzschildRadius(
  mass: number,
  G: number = DEFAULT_G,
  isBlackHole: boolean = true
): number {
  if (isBlackHole) {
    const scaled = 4.4 * Math.cbrt(Math.max(0.5, (G * mass) / 720));
    return Math.max(4.4, Math.min(6.8, scaled));
  }
  return Math.max(0.65, Math.min(2.4, (2 * G * mass) / 2400));
}

export interface BodyTidalState {
  stretchFactor: number; // Factor longitudinal de estiramiento mareal
  transverseScale: number; // Compresión transversal (1 / sqrt(stretchFactor)) para conservar volumen
  vertexPinchIntensity: number; // [0..1] Intensidad de deformación de vértices 3D en r <= r_s
  tidalHeatingTempK: number; // Temperatura de incandescencia por fricción de marea (K)
  distanceToHorizonRatio: number; // r / r_s (<= 1.0 significa que cruzó el Radio de Schwarzschild)
  crossedSchwarzschild: boolean; // true cuando el cuerpo cruza r <= r_s de un Agujero Negro
  attractorId: string;
  attractorPosition: Vector3D;
  dirX: number;
  dirY: number;
  dirZ: number;
}

export interface RelativisticSystemTelemetry {
  schwarzschildRadiusU: number;
  closestDistanceU: number;
  horizonDistanceRatio: number; // r / r_s
  isCrossingSchwarzschild: boolean; // true si algún objeto está dentro o cruzando r <= r_s
  isBinaryBlackHoleSystem: boolean;
  spaghettificationRegime: 'nominal' | 'roche-tidal' | 'schwarzschild-spaghettification';
  closestBodyNameEs: string;
  closestBodyNameEn: string;
  properTimeRate: number; // dτ / dt = sqrt(1 - r_s / r)
  lorentzGamma: number; // γ = 1 / sqrt(1 - r_s / r)
  gravitationalRedshiftZ: number; // z = γ - 1
  maxTidalStretch: number;
  maxTidalHeatingK: number;
  tidalByBodyId: Record<string, BodyTidalState>;
}

/**
 * Calcula en cada fotograma:
 * 1) El estiramiento mareal y deformación de malla 3D (espaguetización) ΔF_T ∝ 2 G M R_p / r³ sobre cada objeto,
 *    con transición suave en el límite de Roche (r < 2.1 * r_s) y amplificación al cruzar el Radio de Schwarzschild (r <= r_s).
 * 2) La dilatación temporal relativista dτ/dt = sqrt(1 - r_s/r) del reloj propio de la sonda frente al observador lejano.
 */
export function computeRelativisticAndTidalMetrics(
  bodies: CelestialBody[],
  G: number = DEFAULT_G
): RelativisticSystemTelemetry {
  const tidalByBodyId: Record<string, BodyTidalState> = {};
  if (bodies.length === 0) {
    return {
      schwarzschildRadiusU: 0,
      closestDistanceU: 16,
      horizonDistanceRatio: 10,
      isCrossingSchwarzschild: false,
      isBinaryBlackHoleSystem: false,
      spaghettificationRegime: 'nominal',
      closestBodyNameEs: 'Sonda',
      closestBodyNameEn: 'Probe',
      properTimeRate: 1.0,
      lorentzGamma: 1.0,
      gravitationalRedshiftZ: 0,
      maxTidalStretch: 1.0,
      maxTidalHeatingK: 290,
      tidalByBodyId,
    };
  }

  // Identificar los pozos gravitatorios principales (Agujeros Negros o el cuerpo más masivo)
  const blackHoles = bodies.filter((b) => b.isBlackHole);
  const attractors = blackHoles.length > 0 ? blackHoles : [bodies[0]];
  const hasBlackHole = blackHoles.length > 0;
  const isBinaryBlackHoleSystem = blackHoles.length >= 2;

  let minRatioDist = 999;
  let effectiveRs = 0.65;
  let closestDist = 16;
  let maxTidalStretch = 1.0;
  let maxTidalHeatingK = 290;
  let closestBodyNameEs = bodies[bodies.length - 1]?.nameEs ?? 'Sonda';
  let closestBodyNameEn = bodies[bodies.length - 1]?.nameEn ?? 'Probe';

  for (const b of bodies) {
    if (b.isBlackHole || (b === bodies[0] && b.isFixed)) {
      tidalByBodyId[b.id] = {
        stretchFactor: 1.0,
        transverseScale: 1.0,
        vertexPinchIntensity: 0,
        tidalHeatingTempK: 290,
        distanceToHorizonRatio: 99,
        crossedSchwarzschild: false,
        attractorId: b.id,
        attractorPosition: { ...b.position },
        dirX: 1,
        dirY: 0,
        dirZ: 0,
      };
      continue;
    }

    // Buscar el Agujero Negro (en el sistema binario o individual) con menor razón r / r_s y mayor tensor de marea
    let bestAttractor = attractors[0];
    let maxTidalGradient = -1;
    let bestDx = 1;
    let bestDy = 0;
    let bestDz = 0;
    let bestDist = 16;

    for (const att of attractors) {
      if (att.id === b.id) continue;
      const dx = att.position.x - b.position.x;
      const dy = att.position.y - b.position.y;
      const dz = att.position.z - b.position.z;
      const dist = Math.max(0.85, Math.hypot(dx, dy, dz));
      const grad = (G * att.mass) / (dist * dist * dist);
      if (grad > maxTidalGradient) {
        maxTidalGradient = grad;
        bestAttractor = att;
        bestDx = dx / dist;
        bestDy = dy / dist;
        bestDz = dz / dist;
        bestDist = dist;
      }
    }

    // Radio de Schwarzschild r_s del Agujero Negro dominante
    const baseRs = computeSchwarzschildRadius(bestAttractor.mass, G, Boolean(bestAttractor.isBlackHole));
    const rs = isBinaryBlackHoleSystem ? Math.min(7.4, baseRs * 1.12) : baseRs;
    const ratioToRs = bestDist / rs;
    const crossedSchwarzschild = Boolean(bestAttractor.isBlackHole) && ratioToRs <= 1.0;

    if (ratioToRs < minRatioDist) {
      minRatioDist = ratioToRs;
      effectiveRs = rs;
      closestDist = bestDist;
      closestBodyNameEs = b.nameEs;
      closestBodyNameEn = b.nameEn;
    }

    // Deformación de marea acotada a la zona de Roche (ratioToRs < 2.2) para que planetas lejanos mantengan su forma esférica
    let rawStretch = 1.0;
    let vertexPinchIntensity = 0;

    if (bestAttractor.isBlackHole) {
      if (ratioToRs < 2.25) {
        const rocheFactor = Math.max(0, Math.min(1.0, (2.25 - ratioToRs) / 1.25));
        rawStretch = 1.0 + Math.pow(rocheFactor, 1.6) * 0.95;
      }
      if (ratioToRs < 1.65) {
        const penetration = Math.max(0, Math.min(1.0, (1.65 - ratioToRs) / 0.95));
        vertexPinchIntensity = Math.pow(penetration, 1.35) * 0.72;
        if (ratioToRs <= 1.0) {
          // Al cruzar r <= r_s: elongación relativista controlada (3.4x a 4.2x en telemetría)
          const horizonDepth = Math.max(0, Math.min(1.0, (1.0 - ratioToRs) / 0.55));
          rawStretch = Math.max(rawStretch, 3.4 + horizonDepth * 0.8);
          vertexPinchIntensity = Math.min(1.0, 0.68 + horizonDepth * 0.32);
        }
      }
    } else {
      // Estrella normal: marea sutil sólo muy cerca de la corona estelar
      rawStretch =
        1.0 +
        0.18 *
          ((G * bestAttractor.mass * Math.max(0.75, b.radius)) / Math.pow(Math.max(3.5, bestDist), 2.8));
    }

    const stretchFactor = Math.min(4.2, Math.max(1.0, rawStretch));
    const transverseScale = 1.0 / Math.sqrt(stretchFactor);
    const tidalHeatingTempK = Math.round(
      290 + Math.pow(Math.max(0, stretchFactor - 1.0), 1.65) * (crossedSchwarzschild ? 3800 : 1650)
    );

    if (stretchFactor > maxTidalStretch) {
      maxTidalStretch = stretchFactor;
    }
    if (tidalHeatingTempK > maxTidalHeatingK) {
      maxTidalHeatingK = tidalHeatingTempK;
    }

    tidalByBodyId[b.id] = {
      stretchFactor,
      transverseScale,
      vertexPinchIntensity,
      tidalHeatingTempK,
      distanceToHorizonRatio: ratioToRs,
      crossedSchwarzschild,
      attractorId: bestAttractor.id,
      attractorPosition: { ...bestAttractor.position },
      dirX: bestDx,
      dirY: bestDy,
      dirZ: bestDz,
    };
  }

  // Si sólo hay agujeros negros (ej. colapsaron todos los planetas o binario puro), evaluar entre ellos
  if (minRatioDist === 999 && attractors.length >= 1) {
    effectiveRs = computeSchwarzschildRadius(attractors[0].mass, G, hasBlackHole);
    if (attractors.length >= 2) {
      const dx = attractors[1].position.x - attractors[0].position.x;
      const dz = attractors[1].position.z - attractors[0].position.z;
      closestDist = Math.max(effectiveRs * 1.12, Math.hypot(dx, dz));
      minRatioDist = closestDist / effectiveRs;
    } else {
      closestDist = effectiveRs * 3.5;
      minRatioDist = 3.5;
    }
  }

  const isCrossingSchwarzschild = hasBlackHole && minRatioDist <= 1.0;
  const spaghettificationRegime: RelativisticSystemTelemetry['spaghettificationRegime'] =
    isCrossingSchwarzschild
      ? 'schwarzschild-spaghettification'
      : maxTidalStretch >= 1.28 || minRatioDist <= 2.2
      ? 'roche-tidal'
      : 'nominal';

  // Factor de dilatación temporal relativista de Schwarzschild: dτ = dt * sqrt(1 - r_s / r)
  // Cuando el objeto cruza r <= r_s, el tiempo propio medido desde el infinito se ralentiza hasta casi congelarse (dτ/dt -> 0.035)
  const metricTerm = isCrossingSchwarzschild
    ? Math.max(0.0012, 0.015 * Math.max(0.1, minRatioDist))
    : Math.max(0.0025, 1.0 - effectiveRs / Math.max(effectiveRs * 1.004, closestDist));
  const properTimeRate = Math.sqrt(metricTerm);
  const lorentzGamma = 1.0 / properTimeRate;
  const gravitationalRedshiftZ = lorentzGamma - 1.0;

  return {
    schwarzschildRadiusU: effectiveRs,
    closestDistanceU: closestDist,
    horizonDistanceRatio: minRatioDist,
    isCrossingSchwarzschild,
    isBinaryBlackHoleSystem,
    spaghettificationRegime,
    closestBodyNameEs,
    closestBodyNameEn,
    properTimeRate,
    lorentzGamma,
    gravitationalRedshiftZ,
    maxTidalStretch,
    maxTidalHeatingK,
    tidalByBodyId,
  };
}

/**
 * Inyecta o redirige una Sonda Relativista en trayectoria de cruce directo por el Radio de Schwarzschild (r_s)
 * de un sistema de Agujeros Negros Binarios para observar en vivo la espaguetización 3D de su malla y el congelamiento del reloj propio.
 */
export function injectBinarySchwarzschildSpaghettificationProbe(
  bodies: CelestialBody[],
  G: number = DEFAULT_G
): CelestialBody[] {
  const hasBinary =
    bodies.some((b) => b.id === 'bh-alpha') && bodies.some((b) => b.id === 'bh-beta');
  const baseBodies = hasBinary ? [...bodies] : createSpacePreset('binary-bh', 1.0, G);

  const bhAlpha = baseBodies.find((b) => b.id === 'bh-alpha') ?? baseBodies[0];
  const rs = Math.min(7.4, computeSchwarzschildRadius(bhAlpha.mass, G, true) * 1.12);

  // Colocar la sonda justo en el umbral del Radio de Schwarzschild (r ≈ 0.86 * r_s) de Agujero Negro Alfa
  // con velocidad tangencial sub-orbital para que cruce el horizonte exhibiendo espaguetización 3D controlada
  const offsetAngle = Math.PI * 0.25;
  const targetR = rs * 0.86;
  const px = bhAlpha.position.x + Math.cos(offsetAngle) * targetR;
  const pz = bhAlpha.position.z + Math.sin(offsetAngle) * targetR;

  const vLocal = Math.sqrt((G * bhAlpha.mass) / Math.max(2.0, targetR)) * 0.62;
  const vx = bhAlpha.velocity.x - Math.sin(offsetAngle) * vLocal;
  const vz = bhAlpha.velocity.z + Math.cos(offsetAngle) * vLocal;

  const probeBody: CelestialBody = {
    id: 'probe-schwarzschild',
    nameEs: 'Sonda Horizonte r_s (Espaguetizada)',
    nameEn: 'Horizon Probe r_s (Spaghettified)',
    mass: 4.5,
    radius: 1.15,
    color: '#F43F5E',
    position: { x: px, y: 0, z: pz },
    velocity: { x: vx, y: 0, z: vz },
    acceleration: { x: 0, y: 0, z: 0 },
  };

  const filtered = baseBodies.filter((b) => b.id !== 'probe-schwarzschild');
  return [...filtered, probeBody];
}

const SPAWN_PLANET_PALETTE = [
  '#38BDF8',
  '#34D399',
  '#F472B6',
  '#FBBF24',
  '#A78BFA',
  '#FB7185',
  '#2DD4BF',
];

/**
 * Crea e inyecta un nuevo planeta/exoplaneta en las coordenadas (x, z) del plano orbital 3D
 * con velocidad tangencial analítica v = factor * sqrt(G * M_central / r).
 */
export function spawnCustomPlanetOnPlane(
  bodies: CelestialBody[],
  x: number,
  z: number,
  G: number = DEFAULT_G,
  insertionFactor: number = 1.0
): CelestialBody[] {
  // Calcular baricentro y masa atractiva dominante
  let totalMass = 0;
  let cmX = 0;
  let cmZ = 0;
  let cmVx = 0;
  let cmVz = 0;

  const heavyBodies = bodies.filter((b) => b.mass >= 150);
  const refSet = heavyBodies.length > 0 ? heavyBodies : bodies;

  for (const b of refSet) {
    totalMass += b.mass;
    cmX += b.position.x * b.mass;
    cmZ += b.position.z * b.mass;
    cmVx += b.velocity.x * b.mass;
    cmVz += b.velocity.z * b.mass;
  }

  if (totalMass > 0) {
    cmX /= totalMass;
    cmZ /= totalMass;
    cmVx /= totalMass;
    cmVz /= totalMass;
  } else {
    totalMass = 1000;
  }

  const dx = x - cmX;
  const dz = z - cmZ;
  const r = Math.max(4.5, Math.hypot(dx, dz));
  const ux = dx / r;
  const uz = dz / r;

  // Velocidad tangencial perpendicular al vector radial (-uz, ux) en el plano X-Z
  const vCirc = Math.sqrt((G * totalMass) / r) * insertionFactor;
  const vx = cmVx - uz * vCirc;
  const vz = cmVz + ux * vCirc;

  const customIndex = bodies.filter((b) => b.id.startsWith('custom-planet-')).length + 1;
  const color = SPAWN_PLANET_PALETTE[(customIndex - 1) % SPAWN_PLANET_PALETTE.length];
  const newPlanet: CelestialBody = {
    id: `custom-planet-${Date.now()}-${customIndex}`,
    nameEs: `Exoplaneta K-${customIndex}`,
    nameEn: `Exoplanet K-${customIndex}`,
    mass: 14 + (customIndex % 4) * 6,
    radius: 0.95 + (customIndex % 3) * 0.18,
    color,
    position: { x: cmX + ux * r, y: 0, z: cmZ + uz * r },
    velocity: { x: vx, y: 0, z: vz },
    acceleration: { x: 0, y: 0, z: 0 },
  };

  return [...bodies, newPlanet];
}



