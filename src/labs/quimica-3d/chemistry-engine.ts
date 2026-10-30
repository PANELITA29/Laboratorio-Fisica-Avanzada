/**
 * Motor Estequiométrico, Termoquímico y de Dinámica Molecular de Gases Ideales 3D
 * Módulo 05 — Laboratorio de Química Computacional 3D (Inspirado en PhET, ChemCollective y MolView)
 */

export type ChemistryWorkbenchMode = 'reactor' | 'gases';

export type ReactionPresetId =
  | 'alkali-explosion'
  | 'oxyhydrogen-detonation'
  | 'acid-base-neutralization'
  | 'thermite-aluminothermic'
  | 'elephant-toothpaste';

export type PhysicalStateSymbol = '(s)' | '(l)' | '(g)' | '(aq)';

export interface ChemicalSpecies {
  formula: string;
  displayFormula: string;
  nameEs: string;
  nameEn: string;
  coefficient: number;
  state: PhysicalStateSymbol;
  molarMassGPerMol: number;
  colorHex: string;
  isGasEvolution?: boolean;
  isPrecipitate?: boolean;
}

export interface ReactionPresetDefinition {
  id: ReactionPresetId;
  code: string;
  titleEs: string;
  titleEn: string;
  categoryEs: string;
  categoryEn: string;
  equationPlain: string;
  reactantA: ChemicalSpecies;
  reactantB: ChemicalSpecies;
  products: ChemicalSpecies[];
  catalyst?: {
    formula: string;
    nameEs: string;
    eaReductionFactor: number;
  };
  enthalpyKJPerMol: number; // ΔH° en kJ por mol de avance de reacción (ξ = 1 mol)
  activationEnergyKJ: number; // Ea en kJ/mol sin catalizador
  ignitionTempK: number; // Temperatura mínima para iniciar/acelerar o detonar
  criticalExplosionTempK: number; // Umbral térmico de fractura del matraz (K)
  canDetonateExothermically: boolean;
  defaultMolesA: number;
  defaultMolesB: number;
  defaultTempK: number;
  descriptionEs: string;
  descriptionEn: string;
}

export interface StoichiometryResult {
  presetId: ReactionPresetId;
  molesA: number;
  molesB: number;
  massAGrams: number;
  massBGrams: number;
  extentOfReactionMoles: number; // Avance estequiométrico ξ (mol)
  limitingReactant: 'A' | 'B' | 'estequiometrico';
  limitingFormula: string;
  excessFormula: string;
  excessMolesRemaining: number;
  excessMassRemainingGrams: number;
  productsFormed: Array<{
    formula: string;
    displayFormula: string;
    nameEs: string;
    state: PhysicalStateSymbol;
    molesFormed: number;
    massGrams: number;
    gasVolumeLitersSTP: number;
  }>;
  totalGasMolesFormed: number;
  heatReleasedKJ: number; // Positivo si libera calor (exotérmica), negativo si absorbe
  adiabaticTempFinalK: number;
  EffectiveActivationEnergyKJ: number;
  reactionRateFactor: number; // 0..1+ basado en Arrhenius simplificado
  resultingPH: number;
  phIndicatorColorHex: string;
  phClassificationEs: string;
  isBoiling: boolean;
  isThermalRunawayExplosion: boolean;
  explosionReasonEs: string | null;
}

export type GasSpeciesId = 'He' | 'N2' | 'O2' | 'CO2' | 'H2_O2_mix';

export interface GasSpeciesDefinition {
  id: GasSpeciesId;
  formula: string;
  nameEs: string;
  nameEn: string;
  molarMassKgPerMol: number;
  molarMassGPerMol: number;
  atomCount: 1 | 2 | 3;
  primaryColorHex: string;
  secondaryColorHex: string;
  particleRadiusScale: number;
  vanDerWaalsA: number; // L²·atm/mol²
  vanDerWaalsB: number; // L/mol
  isReactiveMixture?: boolean;
}

export interface IdealGasStateMetrics {
  speciesId: GasSpeciesId;
  molesN: number;
  temperatureK: number;
  temperatureCelsius: number;
  volumeLiters: number;
  idealPressureAtm: number;
  idealPressureKPa: number;
  realVanDerWaalsPressureAtm: number;
  rmsSpeedMetersPerSec: number;
  mostProbableSpeedMetersPerSec: number;
  meanSpeedMetersPerSec: number;
  averageKineticEnergyJoulesPerMol: number;
  wallCollisionFrequencyScale: number;
  maxSafePressureAtm: number;
  pressureRatioToLimit: number;
  isOverpressureExploded: boolean;
  isReactiveDetonated: boolean;
  explosionReasonEs: string | null;
  maxwellBoltzmannCurve: Array<{ speedMs: number; probabilityDensity: number }>;
}

export const R_GAS_CONSTANT_LATM = 0.082057; // L·atm/(mol·K)
export const R_GAS_CONSTANT_JOULES = 8.31446; // J/(mol·K)
export const MAX_VESSEL_PRESSURE_ATM = 25.0; // Límite estructural del cilindro 3D
export const MAX_REACTOR_TEMP_K = 850.0; // Límite térmico del vidrio borosilicato 3D

export const REACTION_PRESETS: Record<ReactionPresetId, ReactionPresetDefinition> = {
  'alkali-explosion': {
    id: 'alkali-explosion',
    code: 'RX-01',
    titleEs: 'Explosión Alcalina Exotérmica (Sodio + Agua)',
    titleEn: 'Exothermic Alkali Explosion (Sodium + Water)',
    categoryEs: 'Redox Exotérmica Violenta',
    categoryEn: 'Violent Exothermic Redox',
    equationPlain: '2 Na(s) + 2 H₂O(l) → 2 NaOH(aq) + H₂(g)↑',
    reactantA: {
      formula: 'Na',
      displayFormula: 'Na(s)',
      nameEs: 'Sodio Metálico Alcalino',
      nameEn: 'Alkali Metallic Sodium',
      coefficient: 2,
      state: '(s)',
      molarMassGPerMol: 22.99,
      colorHex: '#cbd5e1',
    },
    reactantB: {
      formula: 'H2O',
      displayFormula: 'H₂O(l)',
      nameEs: 'Agua Desionizada',
      nameEn: 'Deionized Water',
      coefficient: 2,
      state: '(l)',
      molarMassGPerMol: 18.015,
      colorHex: '#38bdf8',
    },
    products: [
      {
        formula: 'NaOH',
        displayFormula: 'NaOH(aq)',
        nameEs: 'Hidróxido de Sodio Acuoso',
        nameEn: 'Aqueous Sodium Hydroxide',
        coefficient: 2,
        state: '(aq)',
        molarMassGPerMol: 40.0,
        colorHex: '#a855f7',
      },
      {
        formula: 'H2',
        displayFormula: 'H₂(g)↑',
        nameEs: 'Gas Hidrógeno Inflamable',
        nameEn: 'Flammable Hydrogen Gas',
        coefficient: 1,
        state: '(g)',
        molarMassGPerMol: 2.016,
        colorHex: '#f43f5e',
        isGasEvolution: true,
      },
    ],
    enthalpyKJPerMol: -368.6,
    activationEnergyKJ: 18.0,
    ignitionTempK: 295,
    criticalExplosionTempK: 520,
    canDetonateExothermically: true,
    defaultMolesA: 1.2,
    defaultMolesB: 2.5,
    defaultTempK: 298,
    descriptionEs:
      'El sodio metálico reduce violentamente el agua liberando hidrógeno gaseoso H₂(g) y gran calor (−368.6 kJ/mol). La solución se torna fuertemente alcalina (pH > 13, violeta fenolftaleína/universal). Si se dosifica demasiado sodio o se calienta, el H₂ detona fracturando el matraz 3D.',
    descriptionEn:
      'Metallic sodium violently reduces water releasing hydrogen gas H₂(g) and intense heat (−368.6 kJ/mol). The solution turns strongly alkaline (pH > 13). Excess sodium triggers thermal detonation.',
  },
  'oxyhydrogen-detonation': {
    id: 'oxyhydrogen-detonation',
    code: 'RX-02',
    titleEs: 'Síntesis Detonante de Agua (Gas Tonante Oxi-Hidrógeno)',
    titleEn: 'Detonating Water Synthesis (Oxy-Hydrogen Gas)',
    categoryEs: 'Combustión / Detonación en Fase Gas',
    categoryEn: 'Gas-Phase Combustion / Detonation',
    equationPlain: '2 H₂(g) + O₂(g) → 2 H₂O(g)',
    reactantA: {
      formula: 'H2',
      displayFormula: 'H₂(g)',
      nameEs: 'Hidrógeno Molecular',
      nameEn: 'Molecular Hydrogen',
      coefficient: 2,
      state: '(g)',
      molarMassGPerMol: 2.016,
      colorHex: '#f43f5e',
    },
    reactantB: {
      formula: 'O2',
      displayFormula: 'O₂(g)',
      nameEs: 'Oxígeno Molecular',
      nameEn: 'Molecular Oxygen',
      coefficient: 1,
      state: '(g)',
      molarMassGPerMol: 31.998,
      colorHex: '#38bdf8',
    },
    products: [
      {
        formula: 'H2O',
        displayFormula: 'H₂O(g)',
        nameEs: 'Vapor de Agua Sobrecalentado',
        nameEn: 'Superheated Water Vapor',
        coefficient: 2,
        state: '(g)',
        molarMassGPerMol: 18.015,
        colorHex: '#60a5fa',
        isGasEvolution: true,
      },
    ],
    catalyst: {
      formula: 'Pt',
      nameEs: 'Esponja de Platino (Pt)',
      eaReductionFactor: 0.35,
    },
    enthalpyKJPerMol: -483.6,
    activationEnergyKJ: 75.0,
    ignitionTempK: 420,
    criticalExplosionTempK: 680,
    canDetonateExothermically: true,
    defaultMolesA: 2.0,
    defaultMolesB: 1.0,
    defaultTempK: 310,
    descriptionEs:
      'Mezcla estequiométrica 2:1 de H₂ y O₂. Requiere superar la barrera de energía de activación Ea (mediante calentador térmico o catalizador de Platino Pt) para liberar −483.6 kJ/mol en una onda de choque supersónica.',
    descriptionEn:
      'Stoichiometric 2:1 mixture of H₂ and O₂. Requires overcoming activation energy Ea (via thermal heating or Pt catalyst) to release −483.6 kJ/mol.',
  },
  'acid-base-neutralization': {
    id: 'acid-base-neutralization',
    code: 'RX-03',
    titleEs: 'Neutralización Ácido-Base con Indicador Universal pH',
    titleEn: 'Acid-Base Neutralization with Universal pH Indicator',
    categoryEs: 'Equilibrio Iónico & Titulación Estequiométrica',
    categoryEn: 'Ionic Equilibrium & Stoichiometric Titration',
    equationPlain: 'HCl(aq) + NaOH(aq) → NaCl(aq) + H₂O(l)',
    reactantA: {
      formula: 'HCl',
      displayFormula: 'HCl(aq)',
      nameEs: 'Ácido Clorhídrico Fuerte',
      nameEn: 'Strong Hydrochloric Acid',
      coefficient: 1,
      state: '(aq)',
      molarMassGPerMol: 36.46,
      colorHex: '#ef4444',
    },
    reactantB: {
      formula: 'NaOH',
      displayFormula: 'NaOH(aq)',
      nameEs: 'Hidróxido de Sodio Fuerte',
      nameEn: 'Strong Sodium Hydroxide',
      coefficient: 1,
      state: '(aq)',
      molarMassGPerMol: 40.0,
      colorHex: '#a855f7',
    },
    products: [
      {
        formula: 'NaCl',
        displayFormula: 'NaCl(aq)',
        nameEs: 'Cloruro de Sodio Acuoso',
        nameEn: 'Aqueous Sodium Chloride',
        coefficient: 1,
        state: '(aq)',
        molarMassGPerMol: 58.44,
        colorHex: '#10b981',
      },
      {
        formula: 'H2O',
        displayFormula: 'H₂O(l)',
        nameEs: 'Agua Líquida Neutra',
        nameEn: 'Neutral Liquid Water',
        coefficient: 1,
        state: '(l)',
        molarMassGPerMol: 18.015,
        colorHex: '#34d399',
      },
    ],
    enthalpyKJPerMol: -57.3,
    activationEnergyKJ: 8.0,
    ignitionTempK: 273,
    criticalExplosionTempK: 850,
    canDetonateExothermically: false,
    defaultMolesA: 1.5,
    defaultMolesB: 1.0,
    defaultTempK: 298,
    descriptionEs:
      'Reacción equimolar 1:1 entre un ácido fuerte (HCl) y una base fuerte (NaOH). El indicador universal vira desde rojo carmesí (pH < 2, exceso de HCl) hasta verde esmeralda exacto en el punto de equivalencia (pH = 7.00) y violeta profundo (pH > 12, exceso de NaOH).',
    descriptionEn:
      'Equimolar 1:1 reaction between strong acid (HCl) and strong base (NaOH). Universal indicator transitions from crimson (pH < 2) to emerald green at equivalence (pH = 7.00) and deep violet (pH > 12).',
  },
  'thermite-aluminothermic': {
    id: 'thermite-aluminothermic',
    code: 'RX-04',
    titleEs: 'Reacción Aluminotérmica de Termita (Fundición de Hierro)',
    titleEn: 'Aluminothermic Thermite Reaction (Molten Iron)',
    categoryEs: 'Metalurgia Redox de Ultra-Alta Temperatura',
    categoryEn: 'Ultra-High Temperature Redox Metallurgy',
    equationPlain: 'Fe₂O₃(s) + 2 Al(s) → 2 Fe(l) + Al₂O₃(s)',
    reactantA: {
      formula: 'Fe2O3',
      displayFormula: 'Fe₂O₃(s)',
      nameEs: 'Óxido Férrico (Hematita)',
      nameEn: 'Ferric Oxide (Hematite)',
      coefficient: 1,
      state: '(s)',
      molarMassGPerMol: 159.69,
      colorHex: '#b45309',
    },
    reactantB: {
      formula: 'Al',
      displayFormula: 'Al(s)',
      nameEs: 'Polvo de Aluminio Metálico',
      nameEn: 'Metallic Aluminum Powder',
      coefficient: 2,
      state: '(s)',
      molarMassGPerMol: 26.98,
      colorHex: '#94a3b8',
    },
    products: [
      {
        formula: 'Fe',
        displayFormula: 'Fe(l)',
        nameEs: 'Hierro Fundido Incandescente',
        nameEn: 'Incandescent Molten Iron',
        coefficient: 2,
        state: '(l)',
        molarMassGPerMol: 55.845,
        colorHex: '#f59e0b',
        isPrecipitate: true,
      },
      {
        formula: 'Al2O3',
        displayFormula: 'Al₂O₃(s)',
        nameEs: 'Escoria de Óxido de Aluminio',
        nameEn: 'Aluminum Oxide Slag',
        coefficient: 1,
        state: '(s)',
        molarMassGPerMol: 101.96,
        colorHex: '#f8fafc',
        isPrecipitate: true,
      },
    ],
    catalyst: {
      formula: 'Mg',
      nameEs: 'Cinta de Magnesio Ignitora (Mg)',
      eaReductionFactor: 0.45,
    },
    enthalpyKJPerMol: -851.5,
    activationEnergyKJ: 145.0,
    ignitionTempK: 550,
    criticalExplosionTempK: 850,
    canDetonateExothermically: true,
    defaultMolesA: 1.0,
    defaultMolesB: 2.0,
    defaultTempK: 300,
    descriptionEs:
      'El aluminio reduce el óxido de hierro liberando una entalpía extrema de −851.5 kJ/mol. Posee una alta barrera de activación Ea; una vez alcanzada la temperatura de ignición (o activada la cinta de Magnesio), funde el hierro y supera los 850 K haciendo estallar el reactor de vidrio.',
    descriptionEn:
      'Aluminum reduces iron oxide releasing an extreme enthalpy of −851.5 kJ/mol. Once ignited via heat or Mg ribbon, molten iron exceeds 850 K and shatters the borosilicate reactor.',
  },
  'elephant-toothpaste': {
    id: 'elephant-toothpaste',
    code: 'RX-05',
    titleEs: 'Descomposición Catalítica de Peróxido (Espuma Exotérmica)',
    titleEn: 'Catalytic Peroxide Decomposition (Exothermic Foam)',
    categoryEs: 'Catálisis Homogénea & Cinética Química',
    categoryEn: 'Homogeneous Catalysis & Chemical Kinetics',
    equationPlain: '2 H₂O₂(aq) + KI(aq) → 2 H₂O(l) + O₂(g)↑ + KI(aq)',
    reactantA: {
      formula: 'H2O2',
      displayFormula: 'H₂O₂(aq)',
      nameEs: 'Peróxido de Hidrógeno Concentrado (30%)',
      nameEn: 'Concentrated Hydrogen Peroxide (30%)',
      coefficient: 2,
      state: '(aq)',
      molarMassGPerMol: 34.014,
      colorHex: '#38bdf8',
    },
    reactantB: {
      formula: 'H2O',
      displayFormula: 'Tensioactivo(aq)',
      nameEs: 'Solución Tensioactiva Captadora',
      nameEn: 'Surfactant Trapping Solution',
      coefficient: 1,
      state: '(aq)',
      molarMassGPerMol: 18.015,
      colorHex: '#06b6d4',
    },
    products: [
      {
        formula: 'H2O',
        displayFormula: 'H₂O(l)',
        nameEs: 'Agua Líquida y Vapor',
        nameEn: 'Liquid Water & Steam',
        coefficient: 2,
        state: '(l)',
        molarMassGPerMol: 18.015,
        colorHex: '#22d3ee',
      },
      {
        formula: 'O2',
        displayFormula: 'O₂(g)↑',
        nameEs: 'Espuma de Oxígeno Molecular',
        nameEn: 'Molecular Oxygen Foam',
        coefficient: 1,
        state: '(g)',
        molarMassGPerMol: 31.998,
        colorHex: '#ec4899',
        isGasEvolution: true,
      },
    ],
    catalyst: {
      formula: 'KI',
      nameEs: 'Yoduro de Potasio (KI)',
      eaReductionFactor: 0.25,
    },
    enthalpyKJPerMol: -196.1,
    activationEnergyKJ: 75.0,
    ignitionTempK: 310,
    criticalExplosionTempK: 820,
    canDetonateExothermically: false,
    defaultMolesA: 2.4,
    defaultMolesB: 1.5,
    defaultTempK: 298,
    descriptionEs:
      'El peróxido de hidrógeno se descompone lentamente por sí solo (Ea = 75 kJ/mol), pero al inyectar el catalizador Yoduro de Potasio (KI) la barrera cae drásticamente liberando columnas de espuma de O₂(g) y −196.1 kJ/mol.',
    descriptionEn:
      'Hydrogen peroxide decomposes slowly on its own (Ea = 75 kJ/mol), but adding Potassium Iodide (KI) catalyst drops the barrier, erupting O₂(g) foam and releasing −196.1 kJ/mol.',
  },
};

export const GAS_SPECIES_CATALOG: Record<GasSpeciesId, GasSpeciesDefinition> = {
  He: {
    id: 'He',
    formula: 'He',
    nameEs: 'Helio Monoatómico (Gas Noble)',
    nameEn: 'Monatomic Helium (Noble Gas)',
    molarMassKgPerMol: 0.0040026,
    molarMassGPerMol: 4.0026,
    atomCount: 1,
    primaryColorHex: '#fbbf24',
    secondaryColorHex: '#fde68a',
    particleRadiusScale: 0.72,
    vanDerWaalsA: 0.0346,
    vanDerWaalsB: 0.0238,
  },
  N2: {
    id: 'N2',
    formula: 'N₂',
    nameEs: 'Nitrógeno Diatómico (N≡N)',
    nameEn: 'Diatomic Nitrogen (N≡N)',
    molarMassKgPerMol: 0.0280134,
    molarMassGPerMol: 28.0134,
    atomCount: 2,
    primaryColorHex: '#38bdf8',
    secondaryColorHex: '#0284c7',
    particleRadiusScale: 1.0,
    vanDerWaalsA: 1.37,
    vanDerWaalsB: 0.0387,
  },
  O2: {
    id: 'O2',
    formula: 'O₂',
    nameEs: 'Oxígeno Diatómico Paramagnético (O=O)',
    nameEn: 'Paramagnetic Diatomic Oxygen (O=O)',
    molarMassKgPerMol: 0.0319988,
    molarMassGPerMol: 31.9988,
    atomCount: 2,
    primaryColorHex: '#f43f5e',
    secondaryColorHex: '#e11d48',
    particleRadiusScale: 1.05,
    vanDerWaalsA: 1.382,
    vanDerWaalsB: 0.0319,
  },
  CO2: {
    id: 'CO2',
    formula: 'CO₂',
    nameEs: 'Dióxido de Carbono Triatómico (O=C=O)',
    nameEn: 'Triatomic Carbon Dioxide (O=C=O)',
    molarMassKgPerMol: 0.04401,
    molarMassGPerMol: 44.01,
    atomCount: 3,
    primaryColorHex: '#a855f7',
    secondaryColorHex: '#f43f5e',
    particleRadiusScale: 1.25,
    vanDerWaalsA: 3.64,
    vanDerWaalsB: 0.0427,
  },
  H2_O2_mix: {
    id: 'H2_O2_mix',
    formula: '2H₂ + O₂',
    nameEs: 'Mezcla Reactiva Detonante (2H₂ + O₂)',
    nameEn: 'Reactive Detonating Mixture (2H₂ + O₂)',
    molarMassKgPerMol: 0.01201, // Masa molar media ponderada (2*2.016 + 32)/3 = 12.01 g/mol
    molarMassGPerMol: 12.01,
    atomCount: 2,
    primaryColorHex: '#ec4899',
    secondaryColorHex: '#38bdf8',
    particleRadiusScale: 0.88,
    vanDerWaalsA: 0.68,
    vanDerWaalsB: 0.028,
    isReactiveMixture: true,
  },
};

/**
 * Devuelve el color hexadecimal y clasificación de un valor de pH (0..14)
 * usando la escala de Indicador Universal de Yamada.
 */
export function getUniversalIndicatorColor(ph: number): {
  colorHex: string;
  labelEs: string;
} {
  const clamped = Math.max(0, Math.min(14, ph));
  if (clamped < 2.0) return { colorHex: '#ef4444', labelEs: 'Ácido Fuerte (Rojo Intenso)' };
  if (clamped < 4.5) return { colorHex: '#f97316', labelEs: 'Ácido Moderado (Naranja)' };
  if (clamped < 6.5) return { colorHex: '#eab308', labelEs: 'Ácido Débil (Amarillo)' };
  if (clamped <= 7.5) return { colorHex: '#10b981', labelEs: 'Neutro Exacto (Verde Esmeralda)' };
  if (clamped < 9.5) return { colorHex: '#06b6d4', labelEs: 'Base Débil (Cian Turquesa)' };
  if (clamped < 11.8) return { colorHex: '#3b82f6', labelEs: 'Base Moderada (Azul Cobalto)' };
  return { colorHex: '#a855f7', labelEs: 'Base Fuerte Alcalina (Violeta)' };
}

/**
 * Calcula toda la estequiometría, reactivo limitante, reactivo en exceso,
 * calor liberado Q, pH resultante y condiciones de explosión del Reactor Químico 3D.
 */
export function computeReactionStoichiometry(params: {
  presetId: ReactionPresetId;
  molesA: number;
  molesB: number;
  temperatureK: number;
  catalystActive: boolean;
}): StoichiometryResult {
  const preset = REACTION_PRESETS[params.presetId];
  const nA = Math.max(0, params.molesA);
  const nB = Math.max(0, params.molesB);
  const tempK = Math.max(250, Math.min(1500, params.temperatureK));

  const nuA = preset.reactantA.coefficient;
  const nuB = preset.reactantB.coefficient;

  const ratioA = nA / nuA;
  const ratioB = nB / nuB;

  const eps = 1e-3;
  let limitingReactant: 'A' | 'B' | 'estequiometrico' = 'estequiometrico';
  let extentXi = 0;

  if (nA <= 0 || nB <= 0) {
    extentXi = 0;
    limitingReactant = nA <= 0 ? 'A' : 'B';
  } else if (Math.abs(ratioA - ratioB) <= eps) {
    extentXi = ratioA;
    limitingReactant = 'estequiometrico';
  } else if (ratioA < ratioB) {
    extentXi = ratioA;
    limitingReactant = 'A';
  } else {
    extentXi = ratioB;
    limitingReactant = 'B';
  }

  // Factor cinético de activación térmica + catalizador
  const effectiveEa =
    preset.catalyst && params.catalystActive
      ? preset.activationEnergyKJ * preset.catalyst.eaReductionFactor
      : preset.activationEnergyKJ;

  // Factor de rapidez de reacción (Arrhenius normalizado para visualización interactiva)
  const tempThresholdRatio = tempK / preset.ignitionTempK;
  const catalystBoost = preset.catalyst && params.catalystActive ? 1.85 : 1.0;
  const rawRate =
    Math.exp(-effectiveEa / (0.08 * tempK)) * tempThresholdRatio * catalystBoost;
  const reactionRateFactor =
    nA > 0 && nB > 0 ? Math.max(0.08, Math.min(2.5, rawRate)) : 0;

  // Si la reacción tiene alta barrera Ea (ej. Termita u Oxi-Hidrógeno) y no se ha superado ignición ni catalizador,
  // el avance efectivo es parcial hasta que el usuario calienta o activa el catalizador.
  const requiresIgnitionGate =
    preset.activationEnergyKJ >= 70 &&
    tempK < preset.ignitionTempK &&
    !(preset.catalyst && params.catalystActive);

  const effectiveExtentXi = requiresIgnitionGate ? extentXi * 0.05 : extentXi;

  const consumedA = effectiveExtentXi * nuA;
  const consumedB = effectiveExtentXi * nuB;

  const remA = Math.max(0, nA - consumedA);
  const remB = Math.max(0, nB - consumedB);

  const limitingFormula =
    limitingReactant === 'A'
      ? preset.reactantA.displayFormula
      : limitingReactant === 'B'
      ? preset.reactantB.displayFormula
      : `${preset.reactantA.displayFormula} & ${preset.reactantB.displayFormula} (Exacto)`;

  const excessFormula =
    limitingReactant === 'A'
      ? preset.reactantB.displayFormula
      : limitingReactant === 'B'
      ? preset.reactantA.displayFormula
      : 'Ninguno (Proporción Estequiométrica)';

  const excessMolesRemaining =
    limitingReactant === 'A' ? remB : limitingReactant === 'B' ? remA : 0;
  const excessMassRemainingGrams =
    limitingReactant === 'A'
      ? remB * preset.reactantB.molarMassGPerMol
      : limitingReactant === 'B'
      ? remA * preset.reactantA.molarMassGPerMol
      : 0;

  let totalGasMolesFormed = 0;
  const productsFormed = preset.products.map((prod) => {
    const molesFormed = effectiveExtentXi * prod.coefficient;
    const massGrams = molesFormed * prod.molarMassGPerMol;
    const gasVolumeLitersSTP = prod.state === '(g)' ? molesFormed * 22.414 : 0;
    if (prod.state === '(g)') {
      totalGasMolesFormed += molesFormed;
    }
    return {
      formula: prod.formula,
      displayFormula: prod.displayFormula,
      nameEs: prod.nameEs,
      state: prod.state,
      molesFormed,
      massGrams,
      gasVolumeLitersSTP,
    };
  });

  // Calor liberado Q = ξ * (-ΔH°) en kJ (positivo cuando ΔH° < 0 exotérmica)
  const heatReleasedKJ = effectiveExtentXi * -preset.enthalpyKJPerMol;

  // Elevación térmica adiabática efectiva en el reactor (capacidad calorífica efectiva ~ 1.45 kJ/K)
  const deltaTempK = Math.max(-40, Math.min(950, heatReleasedKJ / 1.45));
  const adiabaticTempFinalK = tempK + deltaTempK;

  // Cálculo riguroso de pH en volumen acuoso de referencia V_sol = 1.0 L
  let resultingPH = 7.0;
  if (params.presetId === 'acid-base-neutralization') {
    const netAcidMoles = nA - nB;
    if (Math.abs(netAcidMoles) <= 0.02) {
      resultingPH = 7.0;
    } else if (netAcidMoles > 0) {
      const hConc = Math.min(10, netAcidMoles / 1.0);
      resultingPH = Math.max(0.2, 7.0 - Math.min(6.8, 5.2 + Math.log10(1 + hConc * 8)));
    } else {
      const ohConc = Math.min(10, -netAcidMoles / 1.0);
      resultingPH = Math.min(13.8, 7.0 + Math.min(6.8, 5.2 + Math.log10(1 + ohConc * 8)));
    }
  } else if (params.presetId === 'alkali-explosion') {
    const naohFormed = effectiveExtentXi * 2;
    if (naohFormed > 0.001) {
      resultingPH = Math.min(13.9, 11.5 + Math.log10(1 + naohFormed * 10));
    }
  } else if (params.presetId === 'elephant-toothpaste') {
    resultingPH = 6.2; // Ligeramente ácido por el peróxido hasta descomposición
  } else {
    resultingPH = 7.0;
  }

  const indicator = getUniversalIndicatorColor(resultingPH);
  const isBoiling = adiabaticTempFinalK >= 373.15;

  // Condición de Explosión Térmica / Detonación 3D del Reactor
  let isThermalRunawayExplosion = false;
  let explosionReasonEs: string | null = null;

  if (adiabaticTempFinalK >= MAX_REACTOR_TEMP_K) {
    isThermalRunawayExplosion = true;
    explosionReasonEs = `Sobrecarga térmica crítica (${adiabaticTempFinalK.toFixed(0)} K > ${MAX_REACTOR_TEMP_K} K): fractura explosiva del vidrio borosilicato.`;
  } else if (
    preset.canDetonateExothermically &&
    adiabaticTempFinalK >= preset.criticalExplosionTempK &&
    effectiveExtentXi >= 0.65
  ) {
    isThermalRunawayExplosion = true;
    explosionReasonEs = `Detonación exotérmica violenta (${heatReleasedKJ.toFixed(1)} kJ liberados a ${adiabaticTempFinalK.toFixed(0)} K): onda de choque por ignición rápida.`;
  }

  return {
    presetId: params.presetId,
    molesA: nA,
    molesB: nB,
    massAGrams: nA * preset.reactantA.molarMassGPerMol,
    massBGrams: nB * preset.reactantB.molarMassGPerMol,
    extentOfReactionMoles: effectiveExtentXi,
    limitingReactant,
    limitingFormula,
    excessFormula,
    excessMolesRemaining,
    excessMassRemainingGrams,
    productsFormed,
    totalGasMolesFormed,
    heatReleasedKJ,
    adiabaticTempFinalK,
    EffectiveActivationEnergyKJ: effectiveEa,
    reactionRateFactor,
    resultingPH,
    phIndicatorColorHex: indicator.colorHex,
    phClassificationEs: indicator.labelEs,
    isBoiling,
    isThermalRunawayExplosion,
    explosionReasonEs,
  };
}

/**
 * Calcula las propiedades termodinámicas y cinéticas de la Cámara de Gases Ideales 3D (PV = nRT)
 * incluyendo distribución de velocidades de Maxwell-Boltzmann y ruptura por sobrepresión.
 */
export function computeIdealGasMetrics(params: {
  speciesId: GasSpeciesId;
  molesN: number;
  temperatureK: number;
  volumeLiters: number;
  sparkIgnited?: boolean;
}): IdealGasStateMetrics {
  const species = GAS_SPECIES_CATALOG[params.speciesId];
  const n = Math.max(0.1, Math.min(20.0, params.molesN));
  const T = Math.max(100, Math.min(1200, params.temperatureK));
  const V = Math.max(1.5, Math.min(30.0, params.volumeLiters));

  // Si es la mezcla reactiva 2H2 + O2 y se activa la chispa o T >= 620 K, ocurre detonación exotérmica
  const isReactiveDetonated = Boolean(
    species.isReactiveMixture && (params.sparkIgnited || T >= 620) && n >= 1.2
  );

  const effectiveTempK = isReactiveDetonated ? T + 680 : T;

  // Ecuación de Estado del Gas Ideal: P = n * R * T / V
  const idealPressureAtm = (n * R_GAS_CONSTANT_LATM * effectiveTempK) / V;
  const idealPressureKPa = idealPressureAtm * 101.325;

  // Ecuación de Van der Waals para comparación científica real: (P + a*n²/V²)(V - n*b) = nRT
  const effectiveVolume = Math.max(0.5, V - n * species.vanDerWaalsB);
  const realVanDerWaalsPressureAtm = Math.max(
    0.1,
    (n * R_GAS_CONSTANT_LATM * effectiveTempK) / effectiveVolume -
      (species.vanDerWaalsA * n * n) / (V * V)
  );

  // Velocidades moleculares según teoría cinética de Maxwell-Boltzmann
  // v_rms = sqrt(3 * R * T / M), v_mp = sqrt(2 * R * T / M), v_mean = sqrt(8 * R * T / (pi * M))
  const M = species.molarMassKgPerMol;
  const rmsSpeedMetersPerSec = Math.sqrt((3 * R_GAS_CONSTANT_JOULES * effectiveTempK) / M);
  const mostProbableSpeedMetersPerSec = Math.sqrt(
    (2 * R_GAS_CONSTANT_JOULES * effectiveTempK) / M
  );
  const meanSpeedMetersPerSec = Math.sqrt(
    (8 * R_GAS_CONSTANT_JOULES * effectiveTempK) / (Math.PI * M)
  );

  // Energía cinética traslacional media por mol: K = (3/2) R T
  const averageKineticEnergyJoulesPerMol = 1.5 * R_GAS_CONSTANT_JOULES * effectiveTempK;

  // Frecuencia relativa de colisiones contra las paredes: Z_wall ∝ (n / V) * v_mean
  const wallCollisionFrequencyScale = (n / V) * (meanSpeedMetersPerSec / 400);

  const pressureRatioToLimit = idealPressureAtm / MAX_VESSEL_PRESSURE_ATM;
  const isOverpressureExploded =
    idealPressureAtm > MAX_VESSEL_PRESSURE_ATM || isReactiveDetonated;

  let explosionReasonEs: string | null = null;
  if (isReactiveDetonated) {
    explosionReasonEs = `Ignición detonante de mezcla 2H₂ + O₂ → 2H₂O(g): sobrepresión instantánea de ${idealPressureAtm.toFixed(1)} atm (> ${MAX_VESSEL_PRESSURE_ATM} atm).`;
  } else if (idealPressureAtm > MAX_VESSEL_PRESSURE_ATM) {
    explosionReasonEs = `Ruptura mecánica del cilindro por sobrepresión (${idealPressureAtm.toFixed(2)} atm supera el límite estructural de ${MAX_VESSEL_PRESSURE_ATM} atm).`;
  }

  // Curva de distribución de rapidez de Maxwell-Boltzmann f(v) para graficar en el panel
  const maxwellBoltzmannCurve: Array<{ speedMs: number; probabilityDensity: number }> = [];
  const maxSpeedPlot = 2600;
  const steps = 26;
  for (let i = 0; i <= steps; i++) {
    const v = (i / steps) * maxSpeedPlot;
    const aFactor = M / (2 * R_GAS_CONSTANT_JOULES * effectiveTempK);
    const prob =
      4 *
      Math.PI *
      Math.pow(aFactor / Math.PI, 1.5) *
      v *
      v *
      Math.exp(-aFactor * v * v) *
      1000;
    maxwellBoltzmannCurve.push({
      speedMs: Math.round(v),
      probabilityDensity: Number(prob.toFixed(4)),
    });
  }

  return {
    speciesId: params.speciesId,
    molesN: n,
    temperatureK: effectiveTempK,
    temperatureCelsius: effectiveTempK - 273.15,
    volumeLiters: V,
    idealPressureAtm,
    idealPressureKPa,
    realVanDerWaalsPressureAtm,
    rmsSpeedMetersPerSec,
    mostProbableSpeedMetersPerSec,
    meanSpeedMetersPerSec,
    averageKineticEnergyJoulesPerMol,
    wallCollisionFrequencyScale,
    maxSafePressureAtm: MAX_VESSEL_PRESSURE_ATM,
    pressureRatioToLimit,
    isOverpressureExploded,
    isReactiveDetonated,
    explosionReasonEs,
    maxwellBoltzmannCurve,
  };
}

/**
 * Retos Experimentales Guiados del Módulo 05 — Química 3D
 */
export interface ChemistryChallengeDefinition {
  id: string;
  code: string;
  mode: ChemistryWorkbenchMode;
  titleEs: string;
  titleEn: string;
  goalEs: string;
  goalEn: string;
  formulaHint: string;
  points: number;
}

export const CHEMISTRY_CHALLENGES: ChemistryChallengeDefinition[] = [
  {
    id: 'chem-neutralization-ph7',
    code: 'RETO-Q01',
    mode: 'reactor',
    titleEs: 'Titulación Estequiométrica Exacta (pH = 7.00)',
    titleEn: 'Exact Stoichiometric Titration (pH = 7.00)',
    goalEs:
      'Selecciona la reacción «RX-03 Neutralización Ácido-Base (HCl + NaOH)» y calibra los moles de HCl(aq) y NaOH(aq) con al menos 1.5 mol cada uno para alcanzar el punto de equivalencia neutro exacto (pH = 7.00 ± 0.15, verde esmeralda) sin reactivo en exceso.',
    goalEn:
      'Select reaction RX-03 Acid-Base Neutralization and calibrate HCl and NaOH moles (>= 1.5 mol each) to reach exact neutral equivalence (pH = 7.00 ± 0.15).',
    formulaHint: 'n(HCl) = n(NaOH) ≥ 1.50 mol ⇒ pH = 7.00',
    points: 200,
  },
  {
    id: 'chem-gas-compression-18atm',
    code: 'RETO-Q02',
    mode: 'gases',
    titleEs: 'Compresión Termodinámica de Alta Presión (16 – 22 atm)',
    titleEn: 'High-Pressure Thermodynamic Compression (16 – 22 atm)',
    goalEs:
      'En la «Cámara de Gases Ideales 3D (PV = nRT)», ajusta el volumen del pistón V, los moles n y la temperatura T para sostener una presión entre 16.0 atm y 22.0 atm con una velocidad cuadrática media v_rms ≥ 900 m/s sin hacer estallar el cilindro (< 25 atm).',
    goalEn:
      'In the 3D Ideal Gas Chamber, adjust piston volume V, moles n, and temperature T to sustain pressure between 16.0 and 22.0 atm with v_rms ≥ 900 m/s without exploding (< 25 atm).',
    formulaHint: 'P = n·R·T / V ∈ [16, 22] atm  |  v_rms = √(3RT/M) ≥ 900 m/s',
    points: 250,
  },
  {
    id: 'chem-exothermic-detonation',
    code: 'RETO-Q03',
    mode: 'reactor',
    titleEs: 'Ignición Aluminotérmica o Detonación Alcalina (> 400 kJ)',
    titleEn: 'Aluminothermic Ignition or Alkali Detonation (> 400 kJ)',
    goalEs:
      'En el «Reactor Químico 3D», provoca una reacción ultracalórica liberando Q ≥ 400 kJ (por ejemplo, Termita Fe₂O₃ + 2Al con cinta de Magnesio o Sodio + Agua a alta carga molar) hasta superar el umbral crítico y desencadenar la explosión 3D del reactor.',
    goalEn:
      'In the 3D Chemical Reactor, trigger an ultracaloric reaction releasing Q ≥ 400 kJ until exceeding the critical threshold and shattering the 3D reactor.',
    formulaHint: 'Q = ξ · |ΔH°| ≥ 400 kJ  ∧  T_final ≥ T_crítica',
    points: 250,
  },
];

export function validateChemistryChallenge(
  challengeId: string,
  mode: ChemistryWorkbenchMode,
  stoichiometry: StoichiometryResult,
  gasMetrics: IdealGasStateMetrics
): { passed: boolean; feedbackEs: string } {
  if (challengeId === 'chem-neutralization-ph7') {
    if (mode !== 'reactor' || stoichiometry.presetId !== 'acid-base-neutralization') {
      return {
        passed: false,
        feedbackEs:
          'Cambia al modo «Reactor Químico 3D» y selecciona la reacción «RX-03 Neutralización Ácido-Base (HCl + NaOH)».',
      };
    }
    const phOk = Math.abs(stoichiometry.resultingPH - 7.0) <= 0.15;
    const molesOk = stoichiometry.molesA >= 1.5 && stoichiometry.molesB >= 1.5;
    if (phOk && molesOk) {
      return {
        passed: true,
        feedbackEs: `¡Punto de equivalencia verificado! n(HCl) = ${stoichiometry.molesA.toFixed(2)} mol, n(NaOH) = ${stoichiometry.molesB.toFixed(2)} mol, pH = ${stoichiometry.resultingPH.toFixed(2)} (Verde Esmeralda).`,
      };
    }
    return {
      passed: false,
      feedbackEs: `Estado actual: pH = ${stoichiometry.resultingPH.toFixed(2)}, n(HCl) = ${stoichiometry.molesA.toFixed(2)} mol, n(NaOH) = ${stoichiometry.molesB.toFixed(2)} mol. Iguala ambos reactivos a ≥ 1.50 mol.`,
    };
  }

  if (challengeId === 'chem-gas-compression-18atm') {
    if (mode !== 'gases') {
      return {
        passed: false,
        feedbackEs: 'Cambia al modo «Cámara de Gases Ideales 3D (PV = nRT)» para realizar este reto.',
      };
    }
    if (gasMetrics.isOverpressureExploded) {
      return {
        passed: false,
        feedbackEs: `El cilindro estalló por sobrepresión (${gasMetrics.idealPressureAtm.toFixed(1)} atm > 25 atm). Reconstruye la cámara y mantén P entre 16 y 22 atm.`,
      };
    }
    const pOk = gasMetrics.idealPressureAtm >= 16.0 && gasMetrics.idealPressureAtm <= 22.0;
    const vOk = gasMetrics.rmsSpeedMetersPerSec >= 900;
    if (pOk && vOk) {
      return {
        passed: true,
        feedbackEs: `¡Estado termodinámico validado! P = ${gasMetrics.idealPressureAtm.toFixed(2)} atm, v_rms = ${gasMetrics.rmsSpeedMetersPerSec.toFixed(0)} m/s sin fractura del cilindro.`,
      };
    }
    return {
      passed: false,
      feedbackEs: `Lectura actual: P = ${gasMetrics.idealPressureAtm.toFixed(2)} atm (meta: 16–22 atm) y v_rms = ${gasMetrics.rmsSpeedMetersPerSec.toFixed(0)} m/s (meta: ≥ 900 m/s).`,
    };
  }

  if (challengeId === 'chem-exothermic-detonation') {
    if (mode !== 'reactor') {
      return {
        passed: false,
        feedbackEs: 'Cambia al modo «Reactor Químico 3D» para realizar la detonación exotérmica.',
      };
    }
    if (stoichiometry.heatReleasedKJ >= 400 && stoichiometry.isThermalRunawayExplosion) {
      return {
        passed: true,
        feedbackEs: `¡Detonación termoquímica completada! Se liberaron Q = ${stoichiometry.heatReleasedKJ.toFixed(1)} kJ alcanzando T = ${stoichiometry.adiabaticTempFinalK.toFixed(0)} K.`,
      };
    }
    return {
      passed: false,
      feedbackEs: `Calor liberado actual: Q = ${stoichiometry.heatReleasedKJ.toFixed(1)} kJ (meta: ≥ 400 kJ con explosión térmica activa). Aumenta los moles o activa la ignición/catalizador.`,
    };
  }

  return { passed: false, feedbackEs: 'Reto no reconocido.' };
}
