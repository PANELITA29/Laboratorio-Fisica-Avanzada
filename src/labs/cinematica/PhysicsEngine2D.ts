/**
 * Motor Físico Determinista 2D — Cinemática, Balística y Resistencia Aerodinámica (RK4)
 * Integra las ecuaciones diferenciales acopladas con fricción cuadrática de Rayleigh y viento.
 */

export type PayloadId =
  | 'cannonball'
  | 'piano'
  | 'watermelon'
  | 'paper-plane'
  | 'astronaut'
  | 'golfball'
  | 'rubber-duck'
  | 'custom';

export type GravityPresetId = 'earth' | 'moon' | 'mars' | 'jupiter' | 'space' | 'custom';

export interface PayloadSpec {
  id: PayloadId;
  iconEmoji: string;
  nameEs: string;
  nameEn: string;
  badgeSubtitleEs: string;
  massKg: number;
  diameterM: number;
  dragCoeff: number;
  shapeLabelEs: string;
  behaviorDescEs: string;
  color: string;
  accentColor: string;
  restitution: number;
}

export interface GravityPreset {
  id: GravityPresetId;
  iconEmoji: string;
  nameEs: string;
  nameEn: string;
  shortDescEs: string;
  gravityMs2: number;
  defaultAirDensityKgM3: number;
  skyTopColor: string;
  skyBottomColor: string;
  groundColor: string;
  horizonAccent: string;
}

export interface SimulationParams2D {
  v0: number;             // Velocidad inicial de salida (m/s), rango 1 - 120
  angleDeg: number;       // Ángulo de inclinación del cañón θ (0° - 90°)
  h0: number;             // Altura de la plataforma hidráulica (0 - 30 m)
  gravity: number;        // Aceleración gravitatoria g (m/s²), 0 en gravedad cero
  airDensity: number;     // Densidad del aire ρ (kg/m³), 0 en vacío
  isVacuum: boolean;      // Interruptor de Cámara de Vacío (fuerza ρ = 0)
  windSpeed: number;      // Velocidad horizontal del viento v_wind (m/s), + a favor, - en contra
  massKg: number;         // Masa del proyectil m (kg)
  diameterM: number;      // Diámetro transversal d (m)
  dragCoeff: number;      // Coeficiente aerodinámico Cd
  payloadId: PayloadId;
}

export interface StateVector2D {
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface TrajectorySample2D {
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  ax: number;
  ay: number;
  dragForceX: number;
  dragForceY: number;
  dragMagnitude: number;
  kineticEnergyJ: number;
  potentialEnergyJ: number;
  thermalEnergyLossJ: number;
  totalMechanicalEnergyJ: number;
}

export interface TrajectoryResult2D {
  id: string;
  label: string;
  color: string;
  params: SimulationParams2D;
  samples: TrajectorySample2D[];
  maxHeightM: number;
  apexX: number;
  apexTimeS: number;
  flightTimeS: number;
  rangeM: number;
  impactSpeedMs: number;
  impactAngleDeg: number;
  initialMechanicalEnergyJ: number;
  finalMechanicalEnergyJ: number;
  thermalDissipatedJ: number;
  analyticalVacuumRangeM: number;
  analyticalVacuumMaxHeightM: number;
  analyticalVacuumFlightTimeS: number;
}

export interface ChallengeTarget2D {
  distanceX: number;
  radiusM: number;
  elevationY: number;
  levelNumber: number;
  windChallengeSpeed: number;
}

export interface TargetEvaluationResult {
  hit: boolean;
  stars: 0 | 1 | 2 | 3;
  errorMeters: number;
  awardedPoints: number;
  headlineEs: string;
  socraticFeedbackEs: string;
}

const EPSILON_VELOCITY = 1e-6;

export const PAYLOAD_CATALOG: PayloadSpec[] = [
  {
    id: 'cannonball',
    iconEmoji: '💣',
    nameEs: 'Bala de Cañón',
    nameEn: 'Classic Cannonball',
    badgeSubtitleEs: 'Pesada / Aerodinámica',
    massKg: 17.6,
    diameterM: 0.15,
    dragCoeff: 0.47,
    shapeLabelEs: 'Esfera lisa de hierro fundido',
    behaviorDescEs: 'Impacto seco con nube de polvo densa y alta inercia balística.',
    color: '#64748B',
    accentColor: '#94A3B8',
    restitution: 0.15,
  },
  {
    id: 'piano',
    iconEmoji: '🎹',
    nameEs: 'Piano de Cola',
    nameEn: 'Grand Piano',
    badgeSubtitleEs: 'Masivo / Gran resistencia al viento',
    massKg: 400.0,
    diameterM: 1.60,
    dragCoeff: 1.05,
    shapeLabelEs: 'Cuerpo romo asimétrico',
    behaviorDescEs: 'Salto elástico cómico al tocar tierra; libera teclas y acorde disonante.',
    color: '#1E293B',
    accentColor: '#F8FAFC',
    restitution: 0.35,
  },
  {
    id: 'watermelon',
    iconEmoji: '🍉',
    nameEs: 'Sandía Gigante',
    nameEn: 'Giant Watermelon',
    badgeSubtitleEs: 'Media / Frágil al impacto',
    massKg: 4.5,
    diameterM: 0.28,
    dragCoeff: 0.44,
    shapeLabelEs: 'Esferoide orgánico',
    behaviorDescEs: 'Salpicadura roja y verde al impactar contra el suelo.',
    color: '#16A34A',
    accentColor: '#EF4444',
    restitution: 0.08,
  },
  {
    id: 'paper-plane',
    iconEmoji: '✈️',
    nameEs: 'Avión de Papel',
    nameEn: 'Paper Plane',
    badgeSubtitleEs: 'Ultraliviano / Muy afectado por el viento',
    massKg: 0.005,
    diameterM: 0.20,
    dragCoeff: 0.08,
    shapeLabelEs: 'Delta plegado ultraligero',
    behaviorDescEs: 'Casi sin inercia; el viento y la atmósfera lo frenan drásticamente.',
    color: '#F1F5F9',
    accentColor: '#38BDF8',
    restitution: 0.02,
  },
  {
    id: 'astronaut',
    iconEmoji: '🧑‍🚀',
    nameEs: 'Astronauta',
    nameEn: 'Astronaut',
    badgeSubtitleEs: 'Humanoide / Resistencia media',
    massKg: 80.0,
    diameterM: 0.60,
    dragCoeff: 0.70,
    shapeLabelEs: 'Traje EVA presurizado',
    behaviorDescEs: 'Piruetas orbitales en el aire; abre paraguas de frenado en descenso.',
    color: '#E2E8F0',
    accentColor: '#F59E0B',
    restitution: 0.2,
  },
  {
    id: 'golfball',
    iconEmoji: '⛳',
    nameEs: 'Pelota de Golf',
    nameEn: 'Golf Ball',
    badgeSubtitleEs: 'Rápida / Coeficiente Cd bajo',
    massKg: 0.046,
    diameterM: 0.043,
    dragCoeff: 0.25,
    shapeLabelEs: 'Esfera con alvéolos (dimples)',
    behaviorDescEs: 'Capa límite turbulenta que minimiza el arrastre aerodinámico.',
    color: '#F8FAFC',
    accentColor: '#22D3EE',
    restitution: 0.65,
  },
  {
    id: 'rubber-duck',
    iconEmoji: '🦆',
    nameEs: 'Patito de Goma',
    nameEn: 'Rubber Duck',
    badgeSubtitleEs: 'Liviano / Cómico',
    massKg: 0.050,
    diameterM: 0.10,
    dragCoeff: 0.55,
    shapeLabelEs: 'Elastómero hueco',
    behaviorDescEs: 'Rebote elástico amortiguado con sonido "cuac" al tocar suelo.',
    color: '#FACC15',
    accentColor: '#FB923C',
    restitution: 0.72,
  },
  {
    id: 'custom',
    iconEmoji: '⚙️',
    nameEs: 'Personalizado',
    nameEn: 'Custom Payload',
    badgeSubtitleEs: 'Configura masa, diámetro y Cd',
    massKg: 25.0,
    diameterM: 0.35,
    dragCoeff: 0.50,
    shapeLabelEs: 'Geometría parametrizable',
    behaviorDescEs: 'Abre controles manuales de masa (m), diámetro (d) y coeficiente Cd.',
    color: '#A855F7',
    accentColor: '#E879F9',
    restitution: 0.3,
  },
];

export const GRAVITY_PRESETS: GravityPreset[] = [
  {
    id: 'earth',
    iconEmoji: '🌍',
    nameEs: 'Tierra',
    nameEn: 'Earth',
    shortDescEs: 'g = 9.81 m/s² | ρ = 1.225 kg/m³',
    gravityMs2: 9.81,
    defaultAirDensityKgM3: 1.225,
    skyTopColor: '#051329',
    skyBottomColor: '#0E2A52',
    groundColor: '#13261B',
    horizonAccent: '#FACC15',
  },
  {
    id: 'moon',
    iconEmoji: '🌕',
    nameEs: 'Luna',
    nameEn: 'Moon',
    shortDescEs: 'g = 1.62 m/s² | Vacío ρ = 0',
    gravityMs2: 1.62,
    defaultAirDensityKgM3: 0.0,
    skyTopColor: '#020409',
    skyBottomColor: '#080D18',
    groundColor: '#1E2430',
    horizonAccent: '#FACC15',
  },
  {
    id: 'mars',
    iconEmoji: '🔴',
    nameEs: 'Marte',
    nameEn: 'Mars',
    shortDescEs: 'g = 3.71 m/s² | ρ = 0.020 kg/m³',
    gravityMs2: 3.71,
    defaultAirDensityKgM3: 0.020,
    skyTopColor: '#2B100A',
    skyBottomColor: '#5E2416',
    groundColor: '#3D170E',
    horizonAccent: '#FACC15',
  },
  {
    id: 'jupiter',
    iconEmoji: '🪐',
    nameEs: 'Júpiter',
    nameEn: 'Jupiter',
    shortDescEs: 'g = 24.79 m/s² | ρ = 1.326 kg/m³',
    gravityMs2: 24.79,
    defaultAirDensityKgM3: 1.326,
    skyTopColor: '#1E1409',
    skyBottomColor: '#422B13',
    groundColor: '#2B1B0D',
    horizonAccent: '#FACC15',
  },
  {
    id: 'space',
    iconEmoji: '🌌',
    nameEs: 'Espacio / Gravedad Cero',
    nameEn: 'Zero Gravity Space',
    shortDescEs: 'g = 0 m/s² | Vacío ρ = 0',
    gravityMs2: 0.0,
    defaultAirDensityKgM3: 0.0,
    skyTopColor: '#010307',
    skyBottomColor: '#050A17',
    groundColor: '#111827',
    horizonAccent: '#FACC15',
  },
  {
    id: 'custom',
    iconEmoji: '🎛️',
    nameEs: 'Manual / Exótico',
    nameEn: 'Custom Environment',
    shortDescEs: 'Sliders libres de g y ρ',
    gravityMs2: 9.81,
    defaultAirDensityKgM3: 1.225,
    skyTopColor: '#090D1A',
    skyBottomColor: '#141D33',
    groundColor: '#151C2C',
    horizonAccent: '#FACC15',
  },
];

export type ExoticEnvironmentPresetId =
  | 'titan'
  | 'venus'
  | 'super-earth'
  | 'ceres'
  | 'exo-storm';

export interface ExoticEnvironmentPreset {
  id: ExoticEnvironmentPresetId;
  nameEs: string;
  subtitleEs: string;
  gravityMs2: number;
  airDensityKgM3: number;
  skyTopColor: string;
  skyBottomColor: string;
  groundColor: string;
  horizonAccent: string;
}

export const EXOTIC_ENVIRONMENT_PRESETS: ExoticEnvironmentPreset[] = [
  {
    id: 'titan',
    nameEs: 'Titán (Saturno)',
    subtitleEs: 'Baja gravedad + atmósfera densa de N₂',
    gravityMs2: 1.35,
    airDensityKgM3: 5.30,
    skyTopColor: '#1A1305',
    skyBottomColor: '#36260A',
    groundColor: '#291D09',
    horizonAccent: '#F59E0B',
  },
  {
    id: 'venus',
    nameEs: 'Venus (92 bar)',
    subtitleEs: 'CO₂ supercrítico ultra-denso',
    gravityMs2: 8.87,
    airDensityKgM3: 65.0,
    skyTopColor: '#241404',
    skyBottomColor: '#472808',
    groundColor: '#331B07',
    horizonAccent: '#FB923C',
  },
  {
    id: 'super-earth',
    nameEs: 'Kepler-20b (Súper-Tierra)',
    subtitleEs: 'Gravedad extrema (2.9 G) y aire denso',
    gravityMs2: 28.5,
    airDensityKgM3: 3.80,
    skyTopColor: '#06181E',
    skyBottomColor: '#0E333E',
    groundColor: '#0B242B',
    horizonAccent: '#2DD4BF',
  },
  {
    id: 'ceres',
    nameEs: 'Ceres (Micro-g)',
    subtitleEs: 'Planeta enano en vacío casi absoluto',
    gravityMs2: 0.28,
    airDensityKgM3: 0.0,
    skyTopColor: '#030509',
    skyBottomColor: '#0B101B',
    groundColor: '#1E2530',
    horizonAccent: '#94A3B8',
  },
  {
    id: 'exo-storm',
    nameEs: 'HD 189733b (Exoplaneta)',
    subtitleEs: 'Gigante caliente de alta densidad',
    gravityMs2: 21.4,
    airDensityKgM3: 8.50,
    skyTopColor: '#070F26',
    skyBottomColor: '#112454',
    groundColor: '#0D1B3E',
    horizonAccent: '#38BDF8',
  },
];

export interface EnvironmentDiagnostics {
  terminalVelocityMs: number | null;
  weightNewtons: number;
  earthGravityRatio: number;
  earthDensityRatio: number;
  ballisticCoefficientKgM2: number;
  aerodynamicRegimeEs: string;
}

/**
 * Calcula métricas diagnósticas del entorno gravitatorio y aerodinámico actual
 * para el proyectil seleccionado (velocidad terminal teórica, peso efectivo, coeficiente balístico).
 */
export function computeEnvironmentDiagnostics(
  params: Pick<
    SimulationParams2D,
    'massKg' | 'gravity' | 'airDensity' | 'isVacuum' | 'dragCoeff' | 'diameterM'
  >
): EnvironmentDiagnostics {
  const safeMass = Math.max(1e-5, params.massKg);
  const safeG = Math.max(0, params.gravity);
  const effectiveRho = params.isVacuum ? 0 : Math.max(0, params.airDensity);
  const area = computeCrossSectionArea(params.diameterM);
  const safeCd = Math.max(0.001, params.dragCoeff);

  const weightNewtons = safeMass * safeG;
  const earthGravityRatio = safeG / 9.81;
  const earthDensityRatio = effectiveRho / 1.225;
  const ballisticCoefficientKgM2 = safeMass / (safeCd * area);

  let terminalVelocityMs: number | null = null;
  if (effectiveRho > 0 && params.dragCoeff > 0 && safeG > 0) {
    terminalVelocityMs = Math.sqrt((2 * safeMass * safeG) / (effectiveRho * safeCd * area));
  }

  let aerodynamicRegimeEs = 'Régimen Atmosférico Estándar';
  if (safeG <= 1e-4 && effectiveRho <= 0) {
    aerodynamicRegimeEs = 'Inercia Pura en Gravedad Cero (g = 0, ρ = 0)';
  } else if (effectiveRho <= 0) {
    aerodynamicRegimeEs = 'Vacío Balístico Ideal (ρ = 0)';
  } else if (effectiveRho < 0.15) {
    aerodynamicRegimeEs = 'Atmósfera Tenue (Baja Fricción)';
  } else if (effectiveRho <= 2.0) {
    aerodynamicRegimeEs = 'Régimen Atmosférico Estándar';
  } else if (effectiveRho <= 15.0) {
    aerodynamicRegimeEs = 'Fluido Denso / Hiperbárico';
  } else {
    aerodynamicRegimeEs = 'Régimen Supercrítico Viscoso';
  }

  return {
    terminalVelocityMs,
    weightNewtons,
    earthGravityRatio,
    earthDensityRatio,
    ballisticCoefficientKgM2,
    aerodynamicRegimeEs,
  };
}

export interface ExoticTrajectoryPreview {
  diagnostics: EnvironmentDiagnostics;
  trajectory: TrajectoryResult2D;
  dragRangeLossM: number;
  dragRangeLossPercent: number;
}

/**
 * Vincula directamente los valores manuales de gravedad (g) y densidad del aire (ρ)
 * con el integrador RK4 de PhysicsEngine2D para obtener en tiempo real la trayectoria
 * resultante, la pérdida de alcance por fricción y el diagnóstico aerodinámico.
 */
export function computeExoticTrajectoryPreview(
  params: SimulationParams2D,
  options?: { id?: string; label?: string; color?: string }
): ExoticTrajectoryPreview {
  const diagnostics = computeEnvironmentDiagnostics(params);
  const trajectory = simulateFullTrajectory(params, options);
  const vacRange = Math.max(1e-6, trajectory.analyticalVacuumRangeM);
  const dragRangeLossM = Math.max(0, vacRange - trajectory.rangeM);
  const dragRangeLossPercent = Math.min(
    100,
    Math.max(0, (dragRangeLossM / vacRange) * 100)
  );

  return {
    diagnostics,
    trajectory,
    dragRangeLossM,
    dragRangeLossPercent,
  };
}


export function getPayloadById(id: PayloadId): PayloadSpec {
  return PAYLOAD_CATALOG.find((item) => item.id === id) ?? PAYLOAD_CATALOG[0];
}

export function getGravityPresetById(id: GravityPresetId): GravityPreset {
  return GRAVITY_PRESETS.find((item) => item.id === id) ?? GRAVITY_PRESETS[0];
}

/**
 * Calcula el área transversal efectiva A = π * (d / 2)²
 */
export function computeCrossSectionArea(diameterM: number): number {
  const safeD = Math.max(0.001, diameterM);
  const radius = safeD * 0.5;
  return Math.PI * radius * radius;
}

/**
 * Calcula las fuerzas de arrastre aerodinámico cuadrático de Rayleigh y la aceleración instantánea.
 * F_drag = -0.5 * ρ * Cd * A * ||v_rel|| * v_rel
 */
export function computeForcesAndAcceleration(
  vx: number,
  vy: number,
  params: SimulationParams2D
): {
  ax: number;
  ay: number;
  dragForceX: number;
  dragForceY: number;
  dragMagnitude: number;
} {
  const safeMass = Math.max(1e-5, params.massKg);
  const safeGravity = Number.isFinite(params.gravity) ? Math.max(0, params.gravity) : 9.81;
  const effectiveRho =
    params.isVacuum || !Number.isFinite(params.airDensity) ? 0 : Math.max(0, params.airDensity);

  if (effectiveRho <= 0 || params.dragCoeff <= 0) {
    return {
      ax: 0,
      ay: -safeGravity,
      dragForceX: 0,
      dragForceY: 0,
      dragMagnitude: 0,
    };
  }

  const area = computeCrossSectionArea(params.diameterM);
  const vRelX = vx - params.windSpeed;
  const vRelY = vy;
  const vRelMagSq = vRelX * vRelX + vRelY * vRelY;
  const vRelMag = Math.sqrt(vRelMagSq);

  if (vRelMag < EPSILON_VELOCITY) {
    return {
      ax: 0,
      ay: -safeGravity,
      dragForceX: 0,
      dragForceY: 0,
      dragMagnitude: 0,
    };
  }

  const dragFactor = 0.5 * effectiveRho * params.dragCoeff * area * vRelMag;
  const dragForceX = -dragFactor * vRelX;
  const dragForceY = -dragFactor * vRelY;
  const dragMagnitude = dragFactor * vRelMag;

  const ax = dragForceX / safeMass;
  const ay = -safeGravity + dragForceY / safeMass;

  return {
    ax,
    ay,
    dragForceX,
    dragForceY,
    dragMagnitude,
  };
}

function singleStepRK4(
  state: StateVector2D,
  params: SimulationParams2D,
  dt: number
): StateVector2D {
  const f = (vx: number, vy: number) => {
    const { ax, ay } = computeForcesAndAcceleration(vx, vy, params);
    return { dx: vx, dy: vy, dvx: ax, dvy: ay };
  };

  const k1 = f(state.vx, state.vy);

  const k2 = f(
    state.vx + 0.5 * dt * k1.dvx,
    state.vy + 0.5 * dt * k1.dvy
  );

  const k3 = f(
    state.vx + 0.5 * dt * k2.dvx,
    state.vy + 0.5 * dt * k2.dvy
  );

  const k4 = f(
    state.vx + dt * k3.dvx,
    state.vy + dt * k3.dvy
  );

  const nextX = state.x + (dt / 6) * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx);
  const nextY = state.y + (dt / 6) * (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy);
  const nextVx = state.vx + (dt / 6) * (k1.dvx + 2 * k2.dvx + 2 * k3.dvx + k4.dvx);
  const nextVy = state.vy + (dt / 6) * (k1.dvy + 2 * k2.dvy + 2 * k3.dvy + k4.dvy);

  return {
    t: state.t + dt,
    x: nextX,
    y: nextY,
    vx: nextVx,
    vy: nextVy,
  };
}

/**
 * Paso de integración numérica Runge-Kutta de 4to Orden (RK4) para (x, y, vx, vy).
 * Incluye sub-paso adaptativo automático cuando la densidad del fluido (ρ) es extrema
 * y el proyectil tiene baja inercia (ej. avión de papel en la atmósfera de Venus).
 */
export function stepRK4(
  state: StateVector2D,
  params: SimulationParams2D,
  dt: number
): StateVector2D {
  const safeMass = Math.max(1e-5, params.massKg);
  const effectiveRho = params.isVacuum ? 0 : Math.max(0, params.airDensity);
  if (effectiveRho <= 0 || params.dragCoeff <= 0) {
    return singleStepRK4(state, params, dt);
  }

  const area = computeCrossSectionArea(params.diameterM);
  const vRelMag = Math.hypot(state.vx - params.windSpeed, state.vy);
  const dragRelaxationRate = (0.5 * effectiveRho * params.dragCoeff * area * vRelMag) / safeMass;
  const subSteps = Math.min(64, Math.max(1, Math.ceil((dragRelaxationRate * dt) / 0.2)));

  if (subSteps === 1) {
    return singleStepRK4(state, params, dt);
  }

  const subDt = dt / subSteps;
  let current = state;
  for (let i = 0; i < subSteps; i++) {
    current = singleStepRK4(current, params, subDt);
  }
  return current;
}

/**
 * Interpolación continua del impacto contra el suelo (y = 0) entre el estado previo (y > 0)
 * y el estado posterior (y <= 0), evitando penetración bajo el suelo.
 */
export function interpolateGroundImpact(
  prev: StateVector2D,
  curr: StateVector2D
): StateVector2D {
  if (prev.y <= 0) {
    return { ...prev, y: 0 };
  }
  const dy = prev.y - curr.y;
  if (Math.abs(dy) < 1e-12) {
    return { ...curr, y: 0 };
  }
  const fraction = Math.max(0, Math.min(1, prev.y / dy));
  return {
    t: prev.t + fraction * (curr.t - prev.t),
    x: prev.x + fraction * (curr.x - prev.x),
    y: 0,
    vx: prev.vx + fraction * (curr.vx - prev.vx),
    vy: prev.vy + fraction * (curr.vy - prev.vy),
  };
}

/**
 * Solución analítica exacta en el vacío (ρ = 0) para referencia teórica y verificación de Galileo.
 */
export function computeAnalyticalVacuumMetrics(params: SimulationParams2D): {
  rangeM: number;
  maxHeightM: number;
  flightTimeS: number;
} {
  const thetaRad = (params.angleDeg * Math.PI) / 180;
  const v0x = params.v0 * Math.cos(thetaRad);
  const v0y = params.v0 * Math.sin(thetaRad);
  const h0 = Math.max(0, params.h0);

  if (params.gravity <= 1e-4) {
    const zeroGFlightTime = v0x > 0.1 ? Math.min(6.0, 220 / v0x) : 5.0;
    const rangeM = v0x * zeroGFlightTime;
    const maxHeightM = h0 + Math.max(0, v0y * zeroGFlightTime);
    return {
      rangeM,
      maxHeightM,
      flightTimeS: zeroGFlightTime,
    };
  }

  const g = Math.max(0.01, params.gravity);
  const apexTime = Math.max(0, v0y / g);
  const maxHeightM = h0 + (v0y * v0y) / (2 * g);
  const discriminant = v0y * v0y + 2 * g * h0;
  const flightTimeS = (v0y + Math.sqrt(Math.max(0, discriminant))) / g;
  const rangeM = v0x * flightTimeS;

  return {
    rangeM,
    maxHeightM,
    flightTimeS: Math.max(apexTime, flightTimeS),
  };
}

function createSampleFromState(
  state: StateVector2D,
  params: SimulationParams2D,
  initialMechanicalEnergyJ: number
): TrajectorySample2D {
  const clampedY = Math.max(0, state.y);
  const { ax, ay, dragForceX, dragForceY, dragMagnitude } = computeForcesAndAcceleration(
    state.vx,
    state.vy,
    params
  );
  const speed = Math.hypot(state.vx, state.vy);
  const kineticEnergyJ = 0.5 * params.massKg * speed * speed;
  const potentialEnergyJ = params.massKg * Math.max(0, params.gravity) * clampedY;
  const totalMechanicalEnergyJ = kineticEnergyJ + potentialEnergyJ;
  const thermalEnergyLossJ = Math.max(0, initialMechanicalEnergyJ - totalMechanicalEnergyJ);

  return {
    t: state.t,
    x: state.x,
    y: clampedY,
    vx: state.vx,
    vy: state.vy,
    speed,
    ax,
    ay,
    dragForceX,
    dragForceY,
    dragMagnitude,
    kineticEnergyJ,
    potentialEnergyJ,
    thermalEnergyLossJ,
    totalMechanicalEnergyJ,
  };
}

/**
 * Simula la trayectoria completa del proyectil con RK4 de paso fijo y sub-muestreo limpio.
 * En cuanto la posición vertical sea y <= 0, detiene inmediatamente el cálculo en y = 0.
 */
export function simulateFullTrajectory(
  params: SimulationParams2D,
  options?: {
    id?: string;
    label?: string;
    color?: string;
    dt?: number;
    maxTimeS?: number;
  }
): TrajectoryResult2D {
  const dt = options?.dt ?? 1 / 240; // Paso interno de alta precisión (240 Hz)
  const isZeroG = params.gravity <= 1e-4;
  const maxTimeS = options?.maxTimeS ?? (isZeroG ? 6.0 : 120);
  const thetaRad = (params.angleDeg * Math.PI) / 180;
  const v0x = params.v0 * Math.cos(thetaRad);
  const v0y = params.v0 * Math.sin(thetaRad);
  const initialY = Math.max(0, params.h0);

  const initialState: StateVector2D = {
    t: 0,
    x: 0,
    y: initialY,
    vx: v0x,
    vy: v0y,
  };

  const initialMechanicalEnergyJ =
    0.5 * params.massKg * params.v0 * params.v0 +
    params.massKg * Math.max(0, params.gravity) * initialY;

  const samples: TrajectorySample2D[] = [
    createSampleFromState(initialState, params, initialMechanicalEnergyJ),
  ];

  // Si se dispara a ras de suelo (h0 = 0) con ángulo 0° y gravedad > 0, impacta en y = 0 de inmediato
  if (initialY <= 0 && v0y <= 0 && !isZeroG) {
    const impactSample = samples[0];
    return {
      id: options?.id ?? `traj-${Date.now()}`,
      label: options?.label ?? getPayloadById(params.payloadId).nameEs,
      color: options?.color ?? '#22D3EE',
      params: { ...params },
      samples,
      maxHeightM: 0,
      apexX: 0,
      apexTimeS: 0,
      flightTimeS: 0,
      rangeM: 0,
      impactSpeedMs: impactSample.speed,
      impactAngleDeg: 0,
      initialMechanicalEnergyJ,
      finalMechanicalEnergyJ: impactSample.totalMechanicalEnergyJ,
      thermalDissipatedJ: 0,
      analyticalVacuumRangeM: 0,
      analyticalVacuumMaxHeightM: 0,
      analyticalVacuumFlightTimeS: 0,
    };
  }

  let current = initialState;
  let maxHeightM = initialY;
  let apexX = 0;
  let apexTimeS = 0;
  let stepCount = 0;

  // Guardamos muestras cada ~1/60s para la lupa de telemetría y renderizado fluido
  const sampleStride = Math.max(1, Math.round((1 / 60) / dt));

  while (current.t < maxTimeS) {
    const next = stepRK4(current, params, dt);
    stepCount++;

    // Detectar paso por el ápice (cuando vy cruza de positivo a <= 0)
    if (current.vy > 0 && next.vy <= 0) {
      const vyDiff = current.vy - next.vy;
      const frac = vyDiff > 1e-12 ? current.vy / vyDiff : 0.5;
      const interpY = current.y + frac * (next.y - current.y);
      const interpX = current.x + frac * (next.x - current.x);
      const interpT = current.t + frac * (next.t - current.t);
      if (interpY > maxHeightM) {
        maxHeightM = interpY;
        apexX = interpX;
        apexTimeS = interpT;
      }
    }

    if (next.y > maxHeightM) {
      maxHeightM = next.y;
      apexX = next.x;
      apexTimeS = next.t;
    }

    // CORTE ESTRICTO EN EL SUELO (y <= 0): detener inmediatamente el cálculo en y = 0
    if (next.y <= 0) {
      const impactState = interpolateGroundImpact(current, next);
      const impactSample = createSampleFromState(
        impactState,
        params,
        initialMechanicalEnergyJ
      );
      samples.push(impactSample);
      current = impactState;
      break;
    }

    // En Gravedad Cero (g = 0), cortar limpiamente al alcanzar el borde del campo de pruebas (240 m)
    if (isZeroG && next.x >= 240) {
      samples.push(createSampleFromState(next, params, initialMechanicalEnergyJ));
      current = next;
      break;
    }

    if (stepCount % sampleStride === 0) {
      samples.push(createSampleFromState(next, params, initialMechanicalEnergyJ));
    }

    current = next;
  }

  const finalSample = samples[samples.length - 1];
  const impactAngleDeg =
    (Math.atan2(Math.abs(finalSample.vy), Math.abs(finalSample.vx)) * 180) / Math.PI;
  const analytical = computeAnalyticalVacuumMetrics(params);

  return {
    id: options?.id ?? `traj-${Date.now()}`,
    label: options?.label ?? getPayloadById(params.payloadId).nameEs,
    color: options?.color ?? '#22D3EE',
    params: { ...params },
    samples,
    maxHeightM,
    apexX,
    apexTimeS,
    flightTimeS: finalSample.t,
    rangeM: finalSample.x,
    impactSpeedMs: finalSample.speed,
    impactAngleDeg,
    initialMechanicalEnergyJ,
    finalMechanicalEnergyJ: finalSample.totalMechanicalEnergyJ,
    thermalDissipatedJ: finalSample.thermalEnergyLossJ,
    analyticalVacuumRangeM: analytical.rangeM,
    analyticalVacuumMaxHeightM: analytical.maxHeightM,
    analyticalVacuumFlightTimeS: analytical.flightTimeS,
  };
}

/**
 * Busca la muestra de trayectoria más cercana a una coordenada del mundo (worldX, worldY)
 * para la Lupa / Sonda de Telemetría Flotante.
 */
export function findNearestTrajectorySample(
  trajectories: TrajectoryResult2D[],
  worldX: number,
  worldY: number,
  maxDistanceMeters: number = 12
): {
  trajectory: TrajectoryResult2D;
  sample: TrajectorySample2D;
  distanceMeters: number;
} | null {
  let bestMatch: {
    trajectory: TrajectoryResult2D;
    sample: TrajectorySample2D;
    distanceMeters: number;
  } | null = null;

  for (const trajectory of trajectories) {
    for (const sample of trajectory.samples) {
      const dist = Math.hypot(sample.x - worldX, sample.y - worldY);
      if (dist <= maxDistanceMeters && (!bestMatch || dist < bestMatch.distanceMeters)) {
        bestMatch = {
          trajectory,
          sample,
          distanceMeters: dist,
        };
      }
    }
  }

  return bestMatch;
}

/**
 * Evalúa el resultado de un disparo en el Modo Desafío ("Tiro al Blanco / Artillería")
 * generando puntuación de 1 a 3 estrellas y retroalimentación socrática contextualizada.
 */
export function evaluateTargetHit(
  trajectory: TrajectoryResult2D,
  target: ChallengeTarget2D
): TargetEvaluationResult {
  const errorMeters = trajectory.rangeM - target.distanceX;
  const absError = Math.abs(errorMeters);
  const { params } = trajectory;

  // Bullseye perfecto (3 estrellas)
  if (absError <= target.radiusM * 0.35) {
    return {
      hit: true,
      stars: 3,
      errorMeters,
      awardedPoints: 150,
      headlineEs: '¡Impacto Directo en el Centro de la Diana! (★★★)',
      socraticFeedbackEs: `Precisión balística sobresaliente (desviación de solo ${absError.toFixed(
        2
      )} m). Equilibraste la componente horizontal v₀·cos(${params.angleDeg}°) y la pérdida térmica de ${trajectory.thermalDissipatedJ.toFixed(
        1
      )} J por arrastre aerodinámico.`,
    };
  }

  // Impacto en anillo medio (2 estrellas)
  if (absError <= target.radiusM * 0.75) {
    return {
      hit: true,
      stars: 2,
      errorMeters,
      awardedPoints: 100,
      headlineEs: '¡Blanco Alcanzado en Anillo Interior! (★★☆)',
      socraticFeedbackEs: `Impactaste a ${absError.toFixed(
        2
      )} m del centro exacto. Un micro-ajuste de ${
        errorMeters < 0 ? '+0.5 m/s en v₀' : '-0.5 m/s en v₀'
      } te dará las 3 estrellas.`,
    };
  }

  // Impacto en borde exterior (1 estrella)
  if (absError <= target.radiusM * 1.15) {
    return {
      hit: true,
      stars: 1,
      errorMeters,
      awardedPoints: 60,
      headlineEs: '¡Impacto en el Borde de la Diana! (★☆☆)',
      socraticFeedbackEs: `Tocaste el borde exterior a ${absError.toFixed(
        2
      )} m del centro. Observa cómo la fuerza de arrastre F_drag frenó el proyectil en el tramo final.`,
    };
  }

  // Fallo: análisis socrático de por qué quedó corto o se pasó
  const fellShort = errorMeters < 0;
  const hasAir = !params.isVacuum && params.airDensity > 0;
  const hasHeadwind = hasAir && params.windSpeed < -1;
  const hasTailwind = hasAir && params.windSpeed > 1;

  if (fellShort) {
    if (hasHeadwind) {
      return {
        hit: false,
        stars: 0,
        errorMeters,
        awardedPoints: 0,
        headlineEs: `Quedaste corto por ${absError.toFixed(1)} m`,
        socraticFeedbackEs: `Tu energía cinética inicial fue insuficiente para vencer la resistencia del viento en contra (${params.windSpeed.toFixed(
          1
        )} m/s). Incrementa v₀ o usa un proyectil con mayor masa inercial (como la Bala de Cañón).`,
      };
    }
    if (params.angleDeg > 52) {
      return {
        hit: false,
        stars: 0,
        errorMeters,
        awardedPoints: 0,
        headlineEs: `Disparo muy elevado: faltaron ${absError.toFixed(1)} m`,
        socraticFeedbackEs: `Con θ = ${params.angleDeg}°, invertiste demasiada velocidad en altura vertical (h_máx = ${trajectory.maxHeightM.toFixed(
          1
        )} m) y poca en avance horizontal v₀ₓ. Prueba acercarte a 42°–45°.`,
      };
    }
    if (params.angleDeg < 30) {
      return {
        hit: false,
        stars: 0,
        errorMeters,
        awardedPoints: 0,
        headlineEs: `Ángulo rasante: faltaron ${absError.toFixed(1)} m`,
        socraticFeedbackEs: `La gravedad (${params.gravity.toFixed(
          2
        )} m/s²) llevó el proyectil a tierra en solo ${trajectory.flightTimeS.toFixed(
          2
        )} s. Eleva el ángulo de inclinación θ o la velocidad inicial v₀.`,
      };
    }
    return {
      hit: false,
      stars: 0,
      errorMeters,
      awardedPoints: 0,
      headlineEs: `Quedaste corto por ${absError.toFixed(1)} m`,
      socraticFeedbackEs: hasAir
        ? `El arrastre aerodinámico disipó ${trajectory.thermalDissipatedJ.toFixed(
            1
          )} J de energía mecánica (en vacío habrías alcanzado ${trajectory.analyticalVacuumRangeM.toFixed(
            1
          )} m). Aumenta la velocidad inicial v₀.`
        : `Tu impulso inicial v₀ = ${params.v0.toFixed(
            1
          )} m/s no alcanzó la distancia de la diana (${target.distanceX.toFixed(
            1
          )} m). Incrementa v₀ o ajusta el ángulo hacia 45°.`,
    };
  } else {
    if (hasTailwind) {
      return {
        hit: false,
        stars: 0,
        errorMeters,
        awardedPoints: 0,
        headlineEs: `Te pasaste por +${absError.toFixed(1)} m`,
        socraticFeedbackEs: `El viento a favor (+${params.windSpeed.toFixed(
          1
        )} m/s) empujó horizontalmente al proyectil reduciendo su velocidad relativa. Reduce v₀ o eleva el ángulo θ.`,
      };
    }
    return {
      hit: false,
      stars: 0,
      errorMeters,
      awardedPoints: 0,
      headlineEs: `Exceso de alcance por +${absError.toFixed(1)} m`,
      socraticFeedbackEs: `La componente horizontal v₀ₓ = ${(
        params.v0 * Math.cos((params.angleDeg * Math.PI) / 180)
      ).toFixed(1)} m/s superó la posición del objetivo (${target.distanceX.toFixed(
        1
      )} m). Reduce la presión neumática v₀ o incrementa la inclinación del cañón.`,
    };
  }
}
