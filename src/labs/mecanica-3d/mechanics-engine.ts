/**
 * Motor Físico del Laboratorio 3: Dinámica Clásica, Osciladores Acoplados y Ondas 3D.
 * Implementa Integración Numérica de Runge-Kutta de 4to Orden (RK4) para conservar energía
 * y resolver ecuaciones diferenciales no lineales de péndulos amortiguados y ondas 3D.
 */

export type MechanicsPresetId = 'simple-pendulum' | 'foucault-3d' | 'coupled-resonance' | 'wave-interference';

export interface PendulumState {
  theta: number; // Ángulo polar respecto a la vertical (radianes)
  omega: number; // Velocidad angular d(theta)/dt (rad/s)
  phi: number; // Ángulo azimutal (para precesión 3D / Foucault)
  phiDot: number; // Velocidad azimutal (rad/s)
  theta2: number; // Segundo péndulo para resonancia acoplada
  omega2: number;
}

export interface MechanicsParameters {
  length: number; // Longitud de la cuerda L (m), 0.5 a 5.0
  mass: number; // Masa de la esfera m (kg), 0.5 a 10.0
  gravity: number; // Gravedad g (m/s²),ej. Tierra 9.81, Luna 1.62, Júpiter 24.79
  damping: number; // Coeficiente de amortiguamiento b (0 a 0.5)
  couplingSpring: number; // Constante elástica de acoplamiento k_c (N/m)
}

export interface MechanicsEnergetics {
  kineticEnergy: number; // K = ½ m v² (Joules)
  potentialEnergy: number; // U = m g L (1 - cos θ) + ½ k_c Δx² (Joules)
  totalEnergy: number; // E = K + U (Joules)
  theoreticalPeriod: number; // T = 2π √(L / g) (segundos)
  linearSpeed: number; // v = L |ω| (m/s)
}

/**
 * Integra un paso dt mediante Runge-Kutta de 4to Orden (RK4) para el sistema de péndulos 3D / acoplados:
 * d²θ₁/dt² = -(g/L) sin(θ₁) - (b/m) ω₁ + (k_c / m) (sin(θ₂) - sin(θ₁))
 * d²θ₂/dt² = -(g/L) sin(θ₂) - (b/m) ω₂ - (k_c / m) (sin(θ₂) - sin(θ₁))
 */
export function stepRK4Pendulum(
  state: PendulumState,
  params: MechanicsParameters,
  dt: number
): PendulumState {
  const { length, mass, gravity, damping, couplingSpring } = params;
  const L = Math.max(0.25, length);
  const m = Math.max(0.1, mass);

  const derivatives = (s: PendulumState) => {
    const couplingTerm = (couplingSpring / m) * (Math.sin(s.theta2) - Math.sin(s.theta));
    const alpha1 = -(gravity / L) * Math.sin(s.theta) - (damping / m) * s.omega + couplingTerm;
    const alpha2 = -(gravity / L) * Math.sin(s.theta2) - (damping / m) * s.omega2 - couplingTerm;
    return {
      dTheta: s.omega,
      dOmega: alpha1,
      dPhi: s.phiDot,
      dPhiDot: 0,
      dTheta2: s.omega2,
      dOmega2: alpha2,
    };
  };

  const k1 = derivatives(state);

  const s2: PendulumState = {
    theta: state.theta + 0.5 * dt * k1.dTheta,
    omega: state.omega + 0.5 * dt * k1.dOmega,
    phi: state.phi + 0.5 * dt * k1.dPhi,
    phiDot: state.phiDot,
    theta2: state.theta2 + 0.5 * dt * k1.dTheta2,
    omega2: state.omega2 + 0.5 * dt * k1.dOmega2,
  };
  const k2 = derivatives(s2);

  const s3: PendulumState = {
    theta: state.theta + 0.5 * dt * k2.dTheta,
    omega: state.omega + 0.5 * dt * k2.dOmega,
    phi: state.phi + 0.5 * dt * k2.dPhi,
    phiDot: state.phiDot,
    theta2: state.theta2 + 0.5 * dt * k2.dTheta2,
    omega2: state.omega2 + 0.5 * dt * k2.dOmega2,
  };
  const k3 = derivatives(s3);

  const s4: PendulumState = {
    theta: state.theta + dt * k3.dTheta,
    omega: state.omega + dt * k3.dOmega,
    phi: state.phi + dt * k3.dPhi,
    phiDot: state.phiDot,
    theta2: state.theta2 + dt * k3.dTheta2,
    omega2: state.omega2 + dt * k3.dOmega2,
  };
  const k4 = derivatives(s4);

  return {
    theta: state.theta + (dt / 6) * (k1.dTheta + 2 * k2.dTheta + 2 * k3.dTheta + k4.dTheta),
    omega: state.omega + (dt / 6) * (k1.dOmega + 2 * k2.dOmega + 2 * k3.dOmega + k4.dOmega),
    phi: state.phi + (dt / 6) * (k1.dPhi + 2 * k2.dPhi + 2 * k3.dPhi + k4.dPhi),
    phiDot: state.phiDot,
    theta2: state.theta2 + (dt / 6) * (k1.dTheta2 + 2 * k2.dTheta2 + 2 * k3.dTheta2 + k4.dTheta2),
    omega2: state.omega2 + (dt / 6) * (k1.dOmega2 + 2 * k2.dOmega2 + 2 * k3.dOmega2 + k4.dOmega2),
  };
}

/**
 * Calcula las energías instantáneas (Cinética K, Potencial Gravitatoria + Elástica U y Total E)
 * y el período teórico de pequeñas oscilaciones T = 2π √(L / g).
 */
export function computeMechanicsEnergetics(
  state: PendulumState,
  params: MechanicsParameters,
  includeCoupled: boolean = false
): MechanicsEnergetics {
  const { length: L, mass: m, gravity: g, couplingSpring: kc } = params;

  const v1 = L * state.omega;
  const k1 = 0.5 * m * v1 * v1;
  const u1 = m * g * L * (1 - Math.cos(state.theta));

  let kineticEnergy = k1;
  let potentialEnergy = u1;

  if (includeCoupled) {
    const v2 = L * state.omega2;
    kineticEnergy += 0.5 * m * v2 * v2;
    potentialEnergy += m * g * L * (1 - Math.cos(state.theta2));
    const dx = L * (Math.sin(state.theta2) - Math.sin(state.theta));
    potentialEnergy += 0.5 * kc * dx * dx;
  }

  const theoreticalPeriod = g > 0.01 ? 2 * Math.PI * Math.sqrt(L / g) : 0;

  return {
    kineticEnergy,
    potentialEnergy,
    totalEnergy: kineticEnergy + potentialEnergy,
    theoreticalPeriod,
    linearSpeed: Math.abs(v1),
  };
}

export interface MechanicsChallenge {
  id: string;
  titleEs: string;
  titleEn: string;
  descriptionEs: string;
  descriptionEn: string;
  hintEs: string;
  hintEn: string;
  points: number;
}

export const MECHANICS_CHALLENGES: MechanicsChallenge[] = [
  {
    id: 'mech-1',
    titleEs: 'Reto Mecánico 1: Reloj de Péndulo de Segundos (T = 2.00 s)',
    titleEn: 'Mechanics Challenge 1: Seconds Pendulum Clock (T = 2.00 s)',
    descriptionEs:
      'Calibra la longitud L del péndulo bajo gravedad terrestre (g = 9.81 m/s²) para que su período de oscilación sea exactamente T = 2.00 s ± 0.04 s.',
    descriptionEn:
      'Calibrate the pendulum length L under Earth gravity (g = 9.81 m/s²) so its oscillation period is exactly T = 2.00 s ± 0.04 s.',
    hintEs: 'Despeja L de la ecuación T = 2π √(L / g) → L = g · (T / 2π)² ≈ 0.99 m (ajusta L a 1.00 m con g = 9.81 m/s²).',
    hintEn: 'Solve for L from T = 2π √(L / g) → L = g · (T / 2π)² ≈ 0.99 m (set L to 1.00 m at g = 9.81 m/s²).',
    points: 250,
  },
  {
    id: 'mech-2',
    titleEs: 'Reto Mecánico 2: Transferencia por Resonancia Acoplada',
    titleEn: 'Mechanics Challenge 2: Coupled Resonance Energy Transfer',
    descriptionEs:
      'Activa el modo "Resonancia Acoplada 3D" con amortiguamiento nulo (b = 0.00) y constante de resorte k_c ≥ 2.0 N/m para observar el batimiento armónico entre ambos osciladores.',
    descriptionEn:
      'Activate "3D Coupled Resonance" mode with zero damping (b = 0.00) and spring constant k_c ≥ 2.0 N/m to observe harmonic beat transfer between both oscillators.',
    hintEs: 'Selecciona el escenario "Resonancia Acoplada", pon el Amortiguamiento (b) en 0.00 y el Acoplamiento Elástico (k_c) en al menos 2.0 N/m.',
    hintEn: 'Select "Coupled Resonance", set Damping (b) to 0.00 and Spring Coupling (k_c) to at least 2.0 N/m.',
    points: 300,
  },
];

export function validateMechanicsChallenge1(params: MechanicsParameters): {
  passed: boolean;
  messageEs: string;
  messageEn: string;
} {
  const T = 2 * Math.PI * Math.sqrt(params.length / params.gravity);
  if (Math.abs(params.gravity - 9.81) > 0.5) {
    return {
      passed: false,
      messageEs: `Asegúrate de estar en Gravedad Terrestre (g = 9.81 m/s²). Actual: ${params.gravity.toFixed(2)} m/s².`,
      messageEn: `Make sure Earth Gravity (g = 9.81 m/s²) is selected. Current: ${params.gravity.toFixed(2)} m/s².`,
    };
  }
  if (Math.abs(T - 2.0) <= 0.04) {
    return {
      passed: true,
      messageEs: `¡Péndulo de Huygens Calibrado! Período exacto T = ${T.toFixed(3)} s con longitud L = ${params.length.toFixed(2)} m.`,
      messageEn: `Huygens Pendulum Calibrated! Exact period T = ${T.toFixed(3)} s with length L = ${params.length.toFixed(2)} m.`,
    };
  }
  return {
    passed: false,
    messageEs: `Período actual T = ${T.toFixed(2)} s. Ajusta la longitud L (actual ${params.length.toFixed(2)} m) hasta obtener 2.00 s.`,
    messageEn: `Current period T = ${T.toFixed(2)} s. Adjust length L (current ${params.length.toFixed(2)} m) until you reach 2.00 s.`,
  };
}

export function validateMechanicsChallenge2(
  preset: MechanicsPresetId,
  params: MechanicsParameters
): {
  passed: boolean;
  messageEs: string;
  messageEn: string;
} {
  if (preset !== 'coupled-resonance') {
    return {
      passed: false,
      messageEs: 'Selecciona primero el montaje "Resonancia Acoplada 3D" en los escenarios.',
      messageEn: 'First select the "3D Coupled Resonance" preset.',
    };
  }
  if (params.damping > 0.01) {
    return {
      passed: false,
      messageEs: `Reduce el coeficiente de amortiguamiento b a 0.00 (actual: ${params.damping.toFixed(2)}) para conservar la energía mecánica.`,
      messageEn: `Reduce damping coefficient b to 0.00 (current: ${params.damping.toFixed(2)}) to conserve mechanical energy.`,
    };
  }
  if (params.couplingSpring < 1.8) {
    return {
      passed: false,
      messageEs: `Aumenta la constante de resorte acoplado k_c a ≥ 2.0 N/m (actual: ${params.couplingSpring.toFixed(1)} N/m).`,
      messageEn: `Increase coupled spring constant k_c to ≥ 2.0 N/m (current: ${params.couplingSpring.toFixed(1)} N/m).`,
    };
  }
  return {
    passed: true,
    messageEs: `¡Transferencia por Resonancia Verificada! Modos normales simétrico y antisimétrico activos con k_c = ${params.couplingSpring.toFixed(1)} N/m.`,
    messageEn: `Resonance Transfer Verified! Symmetric and antisymmetric normal modes active with k_c = ${params.couplingSpring.toFixed(1)} N/m.`,
  };
}
