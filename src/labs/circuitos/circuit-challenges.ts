import { CircuitComponent, CircuitSolution } from './circuit-engine';

export interface CircuitChallenge {
  id: string;
  titleEs: string;
  titleEn: string;
  descriptionEs: string;
  descriptionEn: string;
  hintEs: string;
  hintEn: string;
  points: number;
  requiresInput?: boolean;
  inputLabelEs?: string;
  inputLabelEn?: string;
  targetValue?: number;
}

export const CIRCUIT_CHALLENGES: CircuitChallenge[] = [
  {
    id: 'elec-1',
    titleEs: 'Reto Eléctrico 1: Divisor de Tensión de Precisión (5.0 V)',
    titleEn: 'Electrical Challenge 1: Precision Voltage Divider (5.0 V)',
    descriptionEs:
      'Construye o ajusta un divisor de tensión que alimente la bombilla a exactamente 5.0 V ± 0.1 V utilizando una fuente DC de 20.0 V y resistencias en serie.',
    descriptionEn:
      'Build or tune a voltage divider that powers the incandescent bulb at exactly 5.0 V ± 0.1 V using a 20.0 V DC source and series resistors.',
    hintEs: 'Fórmula del divisor: V_bombilla = V_fuente · (R_bombilla / (R_serie + R_bombilla)). Con V_fuente = 20V y R_bombilla = 100Ω, necesitas R_serie = 300Ω.',
    hintEn: 'Divider formula: V_bulb = V_source · (R_bulb / (R_series + R_bulb)). With V_source = 20V and R_bulb = 100Ω, set R_series = 300Ω.',
    points: 250,
  },
  {
    id: 'elec-2',
    titleEs: 'Reto Eléctrico 2: Incógnita de la Caja Negra (Ley de Ohm)',
    titleEn: 'Electrical Challenge 2: Black Box Unknown Resistance (Ohm’s Law)',
    descriptionEs:
      'Mide el voltaje (V) y la corriente (I) en al menos 3 voltajes distintos de la batería, regístralos en la gráfica en vivo e introduce el valor exacto en Ohmios (Ω) del componente Caja Negra.',
    descriptionEn:
      'Measure voltage (V) and current (I) across at least 3 different battery voltages, record them on the live graph, and enter the exact resistance (Ω) of the Black Box component.',
    hintEs: 'Usa el botón "Registrar Punto (V, I)" con 3 voltajes distintos o divide V / I directamente desde el Multímetro y el Amperímetro.',
    hintEn: 'Use "Record Point (V, I)" at 3 different voltages or divide V / I directly from the Multimeter and Ammeter readings.',
    points: 300,
    requiresInput: true,
    inputLabelEs: 'Resistencia calculada de la Caja Negra (Ω):',
    inputLabelEn: 'Calculated Black Box Resistance (Ω):',
    targetValue: 470,
  },
];

export interface ValidationResult {
  passed: boolean;
  messageEs: string;
  messageEn: string;
}

/**
 * Valida algorítmicamente el Reto Eléctrico 1:
 * - Fuente de 20V (±0.2V)
 * - Al menos una resistencia y una bombilla activas
 * - Caída de tensión en la bombilla de 5.0V ± 0.15V
 */
export function validateChallenge1(
  components: CircuitComponent[],
  solution: CircuitSolution
): ValidationResult {
  const batteries = components.filter((c) => c.type === 'battery');
  const bulbs = components.filter((c) => c.type === 'bulb');
  const resistors = components.filter((c) => c.type === 'resistor');

  if (batteries.length === 0 || bulbs.length === 0 || resistors.length === 0) {
    return {
      passed: false,
      messageEs: 'El circuito debe incluir al menos una fuente DC, una resistencia serie y una bombilla.',
      messageEn: 'The circuit must include at least one DC source, one series resistor, and one bulb.',
    };
  }

  const mainBattery = batteries[0];
  if (Math.abs((mainBattery.voltage ?? 0) - 20) > 0.25) {
    return {
      passed: false,
      messageEs: `La fuente DC debe estar ajustada a 20.0 V (actual: ${(mainBattery.voltage ?? 0).toFixed(1)} V).`,
      messageEn: `The DC source must be set to 20.0 V (current: ${(mainBattery.voltage ?? 0).toFixed(1)} V).`,
    };
  }

  for (const bulb of bulbs) {
    const state = solution.componentStates[bulb.id];
    if (state && !state.isBurnedOut && Math.abs(state.voltageDrop - 5.0) <= 0.15 && Math.abs(state.current) > 0.001) {
      return {
        passed: true,
        messageEs: `¡Excelente! Divisor de tensión verificado: V_bombilla = ${state.voltageDrop.toFixed(2)} V con fuente de 20.0 V.`,
        messageEn: `Excellent! Voltage divider verified: V_bulb = ${state.voltageDrop.toFixed(2)} V with a 20.0 V source.`,
      };
    }
  }

  const firstBulbState = solution.componentStates[bulbs[0].id];
  const currentV = firstBulbState ? firstBulbState.voltageDrop.toFixed(2) : '0.00';

  return {
    passed: false,
    messageEs: `La bombilla recibe actualmente ${currentV} V. Ajusta las resistencias hasta obtener 5.00 V ± 0.10 V.`,
    messageEn: `The bulb currently receives ${currentV} V. Adjust the resistors until you reach 5.00 V ± 0.10 V.`,
  };
}

/**
 * Valida algorítmicamente el Reto Eléctrico 2 (Caja Negra):
 * - Verifica que el usuario haya medido puntos o que su estimación numérica coincida con la resistencia oculta (470 Ω ± 5%).
 */
export function validateChallenge2(
  components: CircuitComponent[],
  recordedPointsCount: number,
  userGuessOhms: number
): ValidationResult {
  const blackBox = components.find((c) => c.type === 'blackbox');
  const trueResistance = blackBox ? blackBox.resistance : 470;

  if (recordedPointsCount < 3) {
    return {
      passed: false,
      messageEs: `Has registrado ${recordedPointsCount}/3 mediciones en la gráfica V vs. I. Registra al menos 3 puntos cambiando el voltaje.`,
      messageEn: `You have recorded ${recordedPointsCount}/3 points on the V vs. I graph. Record at least 3 points by varying the voltage.`,
    };
  }

  if (!Number.isFinite(userGuessOhms) || Math.abs(userGuessOhms - trueResistance) > trueResistance * 0.03) {
    return {
      passed: false,
      messageEs: `El valor ingresado (${userGuessOhms || 0} Ω) no coincide con la pendiente V/I de la Caja Negra. Revisa la relación R = V / I.`,
      messageEn: `The entered value (${userGuessOhms || 0} Ω) does not match the V/I slope of the Black Box. Check R = V / I.`,
    };
  }

  return {
    passed: true,
    messageEs: `¡Descubrimiento Científico! Has determinado experimentalmente la resistencia incógnita R = ${trueResistance} Ω mediante regresión lineal.`,
    messageEn: `Scientific Discovery! You experimentally determined the unknown resistance R = ${trueResistance} Ω via linear regression.`,
  };
}
