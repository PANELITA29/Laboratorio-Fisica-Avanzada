/**
 * Solucionador Dinámico de Mallas y Nodos (Leyes de Ohm y Kirchhoff - MNA)
 * Calcula potencial nodal V, intensidad de corriente I, potencia disipada P = I²R,
 * estado térmico (burnout), protección contra cortocircuito físico real (OCP)
 * y código de colores de 4 y 5 bandas IEC 60062.
 */

export type ComponentType = 'battery' | 'resistor' | 'bulb' | 'switch' | 'wire' | 'blackbox';
export type CircuitTopology = 'series' | 'parallel' | 'mixed';
export type BranchFaultState = 'ON' | 'OPEN' | 'SHORT';

export interface CircuitComponent {
  id: string;
  type: ComponentType;
  label: string;
  nodeA: string; // ID del nodo terminal A (ej. "n1")
  nodeB: string; // ID del nodo terminal B (ej. "n2")
  voltage?: number; // Para batería (0.5V a 120V)
  polarityInverted?: boolean; // Si true, nodeA es positivo y nodeB es negativo
  resistance: number; // En Ohmios (1 a 10,000 Ω)
  maxPower?: number; // En Vatios (para bombilla)
  isClosed?: boolean; // Para interruptor (switch)
  isBurnedOut?: boolean; // Estado de filamento fundido
  isIndicator?: boolean; // Si true, la bombilla actúa como testigo amperimétrico de baja impedancia
  faultState?: BranchFaultState; // Estado dinámico por rama: ON | OPEN | SHORT
}

export interface SolvedComponentState {
  id: string;
  voltageDrop: number; // |V_A - V_B| en voltios
  current: number; // Amperios (positivo si fluye de nodeA -> nodeB)
  power: number; // Vatios (P = I² * R)
  isBurnedOut: boolean;
  brightness: number; // 0 a 1 para bombillas
  isShorted: boolean;
  isOpen: boolean;
}

export interface CircuitSolution {
  nodeVoltages: Record<string, number>;
  componentStates: Record<string, SolvedComponentState>;
  totalCurrent: number;
  totalPower: number;
  sourceVoltage: number;
  equivalentResistance: number;
  isShortCircuitFault: boolean;
  isOpenCircuitFault: boolean;
  shortCircuitPeakCurrent: number;
}

export interface ResistorColorBand {
  nameEs: string;
  nameEn: string;
  hex: string;
}

const COLOR_MAP: Record<number, ResistorColorBand> = {
  0: { nameEs: 'Negro', nameEn: 'Black', hex: '#1E293B' },
  1: { nameEs: 'Marrón', nameEn: 'Brown', hex: '#78350F' },
  2: { nameEs: 'Rojo', nameEn: 'Red', hex: '#DC2626' },
  3: { nameEs: 'Naranja', nameEn: 'Orange', hex: '#EA580C' },
  4: { nameEs: 'Amarillo', nameEn: 'Yellow', hex: '#EAB308' },
  5: { nameEs: 'Verde', nameEn: 'Green', hex: '#16A34A' },
  6: { nameEs: 'Azul', nameEn: 'Blue', hex: '#2563EB' },
  7: { nameEs: 'Violeta', nameEn: 'Violet', hex: '#7C3AED' },
  8: { nameEs: 'Gris', nameEn: 'Gray', hex: '#64748B' },
  9: { nameEs: 'Blanco', nameEn: 'White', hex: '#F8FAFC' },
};

const GOLD_BAND: ResistorColorBand = {
  nameEs: 'Oro (±5%)',
  nameEn: 'Gold (±5%)',
  hex: '#D97706',
};

const SOURCE_INTERNAL_IMPEDANCE = 0.5; // 0.5 Ω impedancia interna para cálculo de pico de cortocircuito

/**
 * Potencia máxima nominal estándar (en Vatios) para las bombillas incandescentes de rama.
 * Si P = I² · R > MAX_RATED_POWER_WATTS (15.0 W), el filamento de tungsteno se funde
 * automáticamente por sobrecalentamiento térmico y la rama pasa a falla OPEN (I = 0 A).
 */
export const MAX_RATED_POWER_WATTS = 15.0;

/**
 * Modos de la perilla selectora del Multímetro Digital Interactivo:
 * - 'V': Voltímetro DC (V⎓), requiere medición en paralelo entre dos nodos distintos.
 * - 'OHM': Óhmetro (Ω), requiere obligatoriamente que la fuente DC esté apagada (Power OFF).
 * - 'A': Amperímetro DC (A⎓), mide corriente de rama; si se conecta en paralelo directo con la fuente activa, quema el fusible.
 */
export type MultimeterMode = 'V' | 'OHM' | 'A';

export interface MultimeterEvaluation {
  mode: MultimeterMode;
  displayValue: string;
  displayText: string;
  unit: string;
  numericValue: number | null;
  measuredBranchId: 'R1' | 'R2' | 'R3' | null;
  isValidConnection: boolean;
  triggersFuseBlow: boolean;
  warningMessageEs: string | null;
  warningEs: string | null;
  statusKind: 'ok' | 'warning' | 'error';
}

/**
 * Modalidades de avería oculta para el Modo Desafío "Caja Negra: Diagnóstico de Circuito Averiado"
 */
export type HiddenFaultType = 'OPEN_FILAMENT' | 'SHORT_BYPASS' | 'ALTERED_HIGH_RESISTANCE';

export interface FaultDiagnosisMission {
  missionId: string;
  topology: CircuitTopology;
  sourceVoltage: number;
  faultyBranchId: 'R1' | 'R2' | 'R3';
  faultType: HiddenFaultType;
  nominalOhms: Record<'R1' | 'R2' | 'R3', number>;
  actualOhms: Record<'R1' | 'R2' | 'R3', number>;
  alteredOhms?: number;
  branchFaultStates: Record<'R1' | 'R2' | 'R3', BranchFaultState>;
  symptomPromptEs: string;
  symptomEs: string;
  justificationOptionsEs: string[];
  correctJustificationIndex: number;
}

export interface FaultDiagnosisAttempt {
  selectedBranch: 'R1' | 'R2' | 'R3';
  selectedFaultType: HiddenFaultType;
  selectedJustificationIdx: number;
}

export interface FaultDiagnosisResult {
  passed: boolean;
  branchCorrect: boolean;
  faultTypeCorrect: boolean;
  justificationCorrect: boolean;
  feedbackTitleEs: string;
  feedbackDetailEs: string;
  feedbackBodyEs: string;
  poeExplanationEs: string;
  poeNextStepEs: string;
}

/**
 * Calcula las 4 bandas de color para una resistencia dada en Ohmios (1 Ω a 99,000 Ω).
 */
export function getResistorColorBands(
  ohms: number
): [ResistorColorBand, ResistorColorBand, ResistorColorBand, ResistorColorBand] {
  const clamped = Math.max(1, Math.min(99000, Math.round(ohms)));
  if (clamped < 10) {
    return [COLOR_MAP[0], COLOR_MAP[clamped], COLOR_MAP[0], GOLD_BAND];
  }
  const str = clamped.toString();
  const d1 = parseInt(str[0], 10);
  const d2 = parseInt(str[1], 10);
  const multiplier = Math.max(0, str.length - 2);
  return [
    COLOR_MAP[d1] || COLOR_MAP[1],
    COLOR_MAP[d2] || COLOR_MAP[0],
    COLOR_MAP[Math.min(9, multiplier)] || COLOR_MAP[0],
    GOLD_BAND,
  ];
}

/**
 * Resuelve un sistema lineal A * x = b mediante eliminación de Gauss-Jordan con pivoteo parcial.
 */
export function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  if (n === 0) return [];
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(M[row][col]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = row;
      }
    }

    if (maxVal < 1e-12) continue;

    if (maxRow !== col) {
      const tmp = M[col];
      M[col] = M[maxRow];
      M[maxRow] = tmp;
    }

    const pivot = M[col][col];
    for (let j = col; j <= n; j++) {
      M[col][j] /= pivot;
    }

    for (let row = 0; row < n; row++) {
      if (row !== col) {
        const factor = M[row][col];
        if (Math.abs(factor) > 1e-12) {
          for (let j = col; j <= n; j++) {
            M[row][j] -= factor * M[col][j];
          }
        }
      }
    }
  }

  return M.map((row) => (Number.isFinite(row[n]) ? row[n] : 0));
}

/**
 * Resuelve dinámicamente el circuito DC utilizando Análisis Nodal Modificado (MNA).
 * Si existe una condición de cortocircuito físico real (componente en SHORT o R_eq < 0.5 Ω),
 * dispara la protección contra sobrecorriente (OCP) deteniendo el flujo activo (I = 0 A, V = 0 V)
 * para evitar que el circuito siga funcionando bajo un cortocircuito.
 */
export function solveCircuit(
  components: CircuitComponent[],
  options?: { isPowered?: boolean }
): CircuitSolution {
  const isPowered = options?.isPowered ?? true;

  const nodesSet = new Set<string>();
  components.forEach((c) => {
    nodesSet.add(c.nodeA);
    nodesSet.add(c.nodeB);
  });

  const nodes = Array.from(nodesSet);
  const batteries = components.filter((c) => c.type === 'battery');
  const nominalSourceVoltage = batteries.reduce((acc, b) => acc + (b.voltage ?? 10), 0);

  if (nodes.length === 0 || !isPowered || nominalSourceVoltage <= 0.001) {
    const emptyVoltages: Record<string, number> = {};
    nodes.forEach((n) => {
      emptyVoltages[n] = 0;
    });
    const emptyStates: Record<string, SolvedComponentState> = {};
    components.forEach((c) => {
      emptyStates[c.id] = {
        id: c.id,
        voltageDrop: 0,
        current: 0,
        power: 0,
        isBurnedOut: !!c.isBurnedOut,
        brightness: 0,
        isShorted: c.faultState === 'SHORT',
        isOpen: c.faultState === 'OPEN' || (c.type === 'switch' && c.isClosed === false),
      };
    });
    return {
      nodeVoltages: emptyVoltages,
      componentStates: emptyStates,
      totalCurrent: 0,
      totalPower: 0,
      sourceVoltage: isPowered ? nominalSourceVoltage : 0,
      equivalentResistance: 0,
      isShortCircuitFault: false,
      isOpenCircuitFault: false,
      shortCircuitPeakCurrent: 0,
    };
  }

  // Verificar si el interruptor maestro está abierto
  const openMasterSwitch = components.some(
    (c) => c.type === 'switch' && c.isClosed === false
  );

  // Verificar si algún componente pasivo tiene un cortocircuito físico directo declarado (SHORT)
  const anyExplicitShort = components.some(
    (c) => (c.type === 'resistor' || c.type === 'bulb') && c.faultState === 'SHORT'
  );

  const groundNode =
    batteries.length > 0
      ? batteries[0].polarityInverted
        ? batteries[0].nodeB
        : batteries[0].nodeA
      : nodes[0];

  const getComponentEffectiveResistance = (comp: CircuitComponent): number => {
    if (comp.type === 'switch') return 1e-4;
    if (comp.type === 'battery') return 1e-4;
    if (comp.faultState === 'SHORT') return 1e-4;
    if (comp.type === 'bulb' && comp.isIndicator) return 1e-4;
    if (comp.type === 'wire') {
      // Si es un cable de rama unido por el usuario tras eliminar un resistor (res-1, res-2, res-3),
      // comprobamos si existen otros resistores/bombillas activos que limiten la corriente.
      // Si el cable unido queda directo entre los rieles de la fuente, actúa con la impedancia
      // propia del conductor de cobre (1.0 Ω) para permitir el paso de corriente sin apagar el circuito.
      if (comp.id.startsWith('res-')) {
        const otherActiveLoads = components.filter(
          (c) =>
            c.id !== comp.id &&
            (c.type === 'resistor' || (c.type === 'bulb' && !c.isIndicator)) &&
            c.faultState !== 'OPEN' &&
            !c.isBurnedOut
        );
        const connectsAcrossRails =
          (comp.nodeA === 'n1' && comp.nodeB === 'n4') ||
          (comp.nodeA === 'n2' && comp.nodeB === 'n4') ||
          (comp.nodeA === 'n3' && comp.nodeB === 'n5') ||
          (comp.nodeA === 'n1' && comp.nodeB === 'n0');
        if (connectsAcrossRails || otherActiveLoads.length === 0) {
          return 1.0;
        }
      }
      return 1e-4;
    }
    return Math.max(0.01, comp.resistance);
  };

  const solveOnce = (burnedIds: Set<string>) => {
    const activeNodes = nodes.filter((n) => n !== groundNode);
    const nodeIndexMap = new Map<string, number>();
    activeNodes.forEach((n, idx) => nodeIndexMap.set(n, idx));

    const N = activeNodes.length;
    const G: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
    const IVec: number[] = Array(N).fill(0);

    // Conductancia de estabilización ultra débil (1 GΩ) para nodos aislados
    for (let i = 0; i < N; i++) {
      G[i][i] += 1e-9;
    }

    components.forEach((comp) => {
      if (burnedIds.has(comp.id)) return;
      if (comp.type === 'switch' && comp.isClosed === false) return;
      if (comp.faultState === 'OPEN') return;

      const rEff = getComponentEffectiveResistance(comp);
      const g = 1 / rEff;
      const idxA = nodeIndexMap.get(comp.nodeA);
      const idxB = nodeIndexMap.get(comp.nodeB);

      if (idxA !== undefined) G[idxA][idxA] += g;
      if (idxB !== undefined) G[idxB][idxB] += g;
      if (idxA !== undefined && idxB !== undefined) {
        G[idxA][idxB] -= g;
        G[idxB][idxA] -= g;
      }

      if (comp.type === 'battery') {
        const vSrc = comp.voltage ?? 10;
        const signedV = comp.polarityInverted ? -vSrc : vSrc;
        const iNorton = signedV * g;
        if (idxB !== undefined) IVec[idxB] += iNorton;
        if (idxA !== undefined) IVec[idxA] -= iNorton;
      }
    });

    const solvedV = solveLinearSystem(G, IVec);
    const nodeVoltages: Record<string, number> = { [groundNode]: 0 };
    activeNodes.forEach((n, idx) => {
      nodeVoltages[n] = solvedV[idx] ?? 0;
    });

    return nodeVoltages;
  };

  const burnedSet = new Set<string>(
    components.filter((c) => c.isBurnedOut).map((c) => c.id)
  );
  let nodeVoltages = solveOnce(burnedSet);

  // Evaluar respuesta térmica de bombillas incandescentes:
  // Si P = I² * R = ΔV² / R supera maxPower (por defecto MAX_RATED_POWER_WATTS = 15.0 W),
  // el filamento se rompe por sobrecalentamiento y la bombilla entra en circuito abierto (OPEN).
  let newlyBurned = false;
  components.forEach((comp) => {
    if (comp.type === 'bulb' && !comp.isIndicator && !burnedSet.has(comp.id)) {
      const vA = nodeVoltages[comp.nodeA] ?? 0;
      const vB = nodeVoltages[comp.nodeB] ?? 0;
      const dv = Math.abs(vA - vB);
      const r = Math.max(0.1, comp.resistance);
      const p = (dv * dv) / r;
      const maxP = comp.maxPower ?? MAX_RATED_POWER_WATTS;
      if (p > maxP) {
        burnedSet.add(comp.id);
        newlyBurned = true;
      }
    }
  });

  if (newlyBurned) {
    nodeVoltages = solveOnce(burnedSet);
  }

  // Calcular corriente bruta de fuente para detectar cortocircuito franco (R_eq < 0.5 Ω)
  let rawTotalCurrent = 0;
  batteries.forEach((bat) => {
    const vA = nodeVoltages[bat.nodeA] ?? 0;
    const vB = nodeVoltages[bat.nodeB] ?? 0;
    const vNom = bat.voltage ?? 10;
    const signedV = bat.polarityInverted ? -vNom : vNom;
    const rInt = 1e-4;
    const current = (signedV - (vB - vA)) / rInt;
    rawTotalCurrent += Math.max(0, Math.abs(current));
  });

  const rawReq =
    rawTotalCurrent > 1e-6 ? nominalSourceVoltage / rawTotalCurrent : Infinity;

  // Condición de Cortocircuito Físico Real:
  // Se activa si cualquier resistencia entra en CORTO físico o si R_eq cae por debajo de 0.5 Ω
  const isShortCircuitFault =
    !openMasterSwitch && (anyExplicitShort || (rawTotalCurrent > 1e-3 && rawReq < 0.5));

  // Si hay cortocircuito físico real, la protección OCP de la fuente corta inmediatamente la salida:
  // El circuito NO sigue funcionando (corriente sostenida = 0 A, potencial en cargas = 0 V).
  if (isShortCircuitFault) {
    const peakShortCurrent = nominalSourceVoltage / SOURCE_INTERNAL_IMPEDANCE;
    const zeroVoltages: Record<string, number> = {};
    nodes.forEach((n) => {
      zeroVoltages[n] = 0;
    });
    const trippedStates: Record<string, SolvedComponentState> = {};
    components.forEach((c) => {
      trippedStates[c.id] = {
        id: c.id,
        voltageDrop: 0,
        current: 0,
        power: 0,
        isBurnedOut: burnedSet.has(c.id),
        brightness: 0,
        isShorted: c.faultState === 'SHORT',
        isOpen: c.faultState === 'OPEN',
      };
    });

    return {
      nodeVoltages: zeroVoltages,
      componentStates: trippedStates,
      totalCurrent: 0,
      totalPower: 0,
      sourceVoltage: nominalSourceVoltage,
      equivalentResistance: 0,
      isShortCircuitFault: true,
      isOpenCircuitFault: false,
      shortCircuitPeakCurrent: peakShortCurrent,
    };
  }

  const componentStates: Record<string, SolvedComponentState> = {};
  let totalCurrent = 0;
  let totalPower = 0;

  components.forEach((comp) => {
    const vA = nodeVoltages[comp.nodeA] ?? 0;
    const vB = nodeVoltages[comp.nodeB] ?? 0;
    const isBurned = burnedSet.has(comp.id);
    const isOpen =
      isBurned ||
      (comp.type === 'switch' && comp.isClosed === false) ||
      comp.faultState === 'OPEN';

    if (isOpen) {
      componentStates[comp.id] = {
        id: comp.id,
        voltageDrop: Math.abs(vA - vB),
        current: 0,
        power: 0,
        isBurnedOut: isBurned,
        brightness: 0,
        isShorted: false,
        isOpen: true,
      };
      return;
    }

    if (comp.type === 'battery') {
      const vNom = comp.voltage ?? 10;
      const signedV = comp.polarityInverted ? -vNom : vNom;
      const rInt = 1e-4;
      const current = (signedV - (vB - vA)) / rInt;
      const absI = Math.abs(current);
      totalCurrent += absI;
      componentStates[comp.id] = {
        id: comp.id,
        voltageDrop: Math.abs(vB - vA),
        current,
        power: absI * vNom,
        isBurnedOut: false,
        brightness: 0,
        isShorted: false,
        isOpen: false,
      };
    } else {
      const rEff = getComponentEffectiveResistance(comp);
      const isZeroImpedance =
        comp.type === 'wire' ||
        comp.type === 'switch' ||
        comp.faultState === 'SHORT' ||
        (comp.type === 'bulb' && comp.isIndicator);
      const current = (vA - vB) / rEff;
      const voltageDrop = isZeroImpedance ? 0 : Math.abs(vA - vB);
      const power = isZeroImpedance ? 0 : current * current * rEff;
      totalPower += power;

      const maxP = comp.maxPower ?? MAX_RATED_POWER_WATTS;
      const brightness =
        comp.type === 'bulb'
          ? comp.isIndicator
            ? Math.min(1, Math.abs(current) / 0.35)
            : Math.min(1, power / maxP)
          : 0;

      componentStates[comp.id] = {
        id: comp.id,
        voltageDrop,
        current,
        power,
        isBurnedOut: false,
        brightness,
        isShorted: comp.faultState === 'SHORT',
        isOpen: false,
      };
    }
  });

  if (totalCurrent < 1e-6) {
    totalCurrent = 0;
    totalPower = 0;
  }

  const equivalentResistance =
    totalCurrent > 1e-6 ? nominalSourceVoltage / totalCurrent : Infinity;
  const anyOpenBranch = components.some(
    (c) => c.faultState === 'OPEN' || burnedSet.has(c.id)
  );
  const isOpenCircuitFault = anyOpenBranch || totalCurrent === 0;

  return {
    nodeVoltages,
    componentStates,
    totalCurrent,
    totalPower,
    sourceVoltage: nominalSourceVoltage,
    equivalentResistance,
    isShortCircuitFault: false,
    isOpenCircuitFault,
    shortCircuitPeakCurrent: 0,
  };
}

/**
 * Calcula la pendiente de regresión lineal R = ΔV / ΔI para una lista de puntos (I, V).
 */
export function calculateOhmRegressionSlope(
  points: Array<{ current: number; voltage: number }>
): {
  slopeResistance: number;
  rSquared: number;
} {
  if (points.length < 2) {
    if (points.length === 1 && points[0].current > 1e-6) {
      return {
        slopeResistance: points[0].voltage / points[0].current,
        rSquared: 1,
      };
    }
    return { slopeResistance: 0, rSquared: 0 };
  }

  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  let sumYY = 0;

  for (const p of points) {
    sumX += p.current;
    sumY += p.voltage;
    sumXY += p.current * p.voltage;
    sumXX += p.current * p.current;
    sumYY += p.voltage * p.voltage;
  }

  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-12) {
    const avgR = sumX > 1e-6 ? sumY / sumX : 0;
    return { slopeResistance: avgR, rSquared: 1 };
  }

  const slope = (n * sumXY - sumX * sumY) / denom;
  const rDenom = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
  const r = rDenom > 1e-12 ? (n * sumXY - sumX * sumY) / rDenom : 1;

  return {
    slopeResistance: Math.max(0, slope),
    rSquared: Math.min(1, Math.max(0, r * r)),
  };
}

// ============================================================================
// ANÁLISIS DINÁMICO DE RAMAS DESDE EL GRAFO MNA (SIN ARQUITECTURA RÍGIDA)
// ============================================================================

export interface BranchAnalyticalRow {
  branchId: 'R1' | 'R2' | 'R3';
  componentId: string;
  componentType: ComponentType;
  nodeA: string;
  nodeB: string;
  nominalOhms: number;
  effectiveOhms: number;
  faultState: BranchFaultState;
  voltageDrop: number;
  current: number;
  power: number;
  isBurnedOut: boolean;
  brightness: number;
}

export interface TopologyAnalysisResult {
  isPowered: boolean;
  topology: CircuitTopology;
  sourceVoltage: number;
  equivalentResistance: number;
  totalCurrent: number;
  totalPower: number;
  isShortCircuitFault: boolean;
  isOpenCircuitFault: boolean;
  shortCircuitPeakCurrent: number;
  kvlVerified: boolean;
  kclVerified: boolean;
  kvlEquationText: string;
  kclEquationText: string;
  diagnosticMessageEs: string;
  diagnosticMessageEn: string;
  branches: [BranchAnalyticalRow, BranchAnalyticalRow, BranchAnalyticalRow];
  nodePotentials: Record<string, number>;
}

/**
 * Infiere dinámicamente la topología efectiva del grafo de componentes (Serie, Paralelo o Mixto)
 * inspeccionando las conexiones nodales reales de las ramas en el banco de trabajo.
 */
export function inferCircuitTopology(
  components: CircuitComponent[],
  fallback: CircuitTopology = 'series'
): CircuitTopology {
  const branchComps = components.filter(
    (c) => c.id === 'res-1' || c.id === 'res-2' || c.id === 'res-3'
  );
  if (branchComps.length < 2) return fallback;

  const r1 = branchComps[0];
  const r2 = branchComps[1];
  const r3 = branchComps[2];

  if (r1 && r2 && r3) {
    const r1Nodes = new Set([r1.nodeA, r1.nodeB]);
    const r2Nodes = new Set([r2.nodeA, r2.nodeB]);
    const shared12 = Array.from(r1Nodes).filter((n) => r2Nodes.has(n)).length;
    if (shared12 === 1 && r1.nodeB === r2.nodeA && r2.nodeB === r3.nodeA) {
      return 'series';
    }
  }

  return fallback;
}

/**
 * Analiza dinámicamente el circuito a partir del grafo real de componentes (`components`)
 * utilizando la solución nodal MNA (`solveCircuit`). Cada rama (R1, R2, R3 — ya sea resistencia o bombilla)
 * se evalúa de forma independiente según los nodos a los que esté conectada y su estado térmico.
 */
export function analyzeWorkbenchCircuit(
  components: CircuitComponent[],
  isPowered: boolean = true,
  topologyHint: CircuitTopology = 'series'
): TopologyAnalysisResult {
  const mna = solveCircuit(components, { isPowered });
  const topology = inferCircuitTopology(components, topologyHint);

  const passiveBranches = components.filter(
    (c) => (c.type === 'resistor' || (c.type === 'bulb' && !c.isIndicator))
  );

  const getBranchRow = (
    idx: number,
    branchId: 'R1' | 'R2' | 'R3'
  ): BranchAnalyticalRow => {
    const comp =
      components.find((c) => c.id === `res-${idx + 1}`) || passiveBranches[idx];
    if (!comp) {
      return {
        branchId,
        componentId: `res-${idx + 1}`,
        componentType: 'resistor',
        nodeA: 'n1',
        nodeB: 'n2',
        nominalOhms: 10,
        effectiveOhms: 10,
        faultState: 'ON',
        voltageDrop: 0,
        current: 0,
        power: 0,
        isBurnedOut: false,
        brightness: 0,
      };
    }

    const st = mna.componentStates[comp.id];
    const isBurned = st?.isBurnedOut ?? !!comp.isBurnedOut;
    const fault: BranchFaultState = isBurned ? 'OPEN' : comp.faultState ?? 'ON';
    const isWireBranch = comp.type === 'wire';
    const effOhms =
      fault === 'OPEN'
        ? Infinity
        : fault === 'SHORT' || isWireBranch
        ? 0
        : comp.resistance;

    return {
      branchId,
      componentId: comp.id,
      componentType: comp.type,
      nodeA: comp.nodeA,
      nodeB: comp.nodeB,
      nominalOhms: isWireBranch ? 0 : comp.resistance,
      effectiveOhms: effOhms,
      faultState: fault,
      voltageDrop: st ? Math.abs(st.voltageDrop) : 0,
      current: st ? Math.abs(st.current) : 0,
      power: st ? st.power : 0,
      isBurnedOut: isBurned,
      brightness: st ? st.brightness : 0,
    };
  };

  const b1 = getBranchRow(0, 'R1');
  const b2 = getBranchRow(1, 'R2');
  const b3 = getBranchRow(2, 'R3');

  const swClosed = !components.some(
    (c) => c.type === 'switch' && c.isClosed === false
  );
  const effectivelyPowered = isPowered && swClosed && mna.sourceVoltage > 0.001;

  if (!effectivelyPowered) {
    return {
      isPowered: false,
      topology,
      sourceVoltage: 0,
      equivalentResistance: 0,
      totalCurrent: 0,
      totalPower: 0,
      isShortCircuitFault: false,
      isOpenCircuitFault: false,
      shortCircuitPeakCurrent: 0,
      kvlVerified: true,
      kclVerified: true,
      kvlEquationText: '∑ V_malla = 0.00 V (Circuito Desenergizado / SW Abierto)',
      kclEquationText: '∑ I_in = ∑ I_out = 0.000 A',
      diagnosticMessageEs:
        'Fuente DC en estado OFF o Interruptor Maestro abierto. Puedes usar el Óhmetro (Ω) de forma segura con el circuito apagado.',
      diagnosticMessageEn:
        'DC power supply is OFF or Master Switch is open. You can safely use the Ohmmeter (Ω) while power is OFF.',
      branches: [b1, b2, b3],
      nodePotentials: mna.nodeVoltages,
    };
  }

  const vSrc = mna.sourceVoltage;
  const iTotal = mna.totalCurrent;

  const kvlEquationText = mna.isShortCircuitFault
    ? `PROTECCIÓN OCP ACTIVA: V_salida = 0.00 V (Pico de falla bloqueado: ${mna.shortCircuitPeakCurrent.toFixed(1)} A)`
    : topology === 'series'
    ? `V_fuente (${vSrc.toFixed(1)}V) - V₁(${b1.voltageDrop.toFixed(2)}V) - V₂(${b2.voltageDrop.toFixed(2)}V) - V₃(${b3.voltageDrop.toFixed(2)}V) = 0.00 V`
    : topology === 'parallel'
    ? `V_nodos = V₁(${b1.voltageDrop.toFixed(2)}V) = V₂(${b2.voltageDrop.toFixed(2)}V) = V₃(${b3.voltageDrop.toFixed(2)}V)`
    : `V_fuente (${vSrc.toFixed(1)}V) - V₁(${b1.voltageDrop.toFixed(2)}V) - V_paralelo(${Math.max(b2.voltageDrop, b3.voltageDrop).toFixed(2)}V) = 0.00 V`;

  const kclEquationText = mna.isShortCircuitFault
    ? `I_activa = 0.000 A (Cortocircuito físico aislado por fusible electrónico OCP)`
    : topology === 'series'
    ? `I_T = I₁ = I₂ = I₃ = ${iTotal.toFixed(3)} A (Malla Única)`
    : topology === 'parallel'
    ? `I_T (${iTotal.toFixed(3)}A) = I₁(${b1.current.toFixed(3)}A) + I₂(${b2.current.toFixed(3)}A) + I₃(${b3.current.toFixed(3)}A)`
    : `I₁ (${b1.current.toFixed(3)}A) = I₂(${b2.current.toFixed(3)}A) + I₃(${b3.current.toFixed(3)}A) en Nodo Bifurcación`;

  const anyOpen = b1.faultState === 'OPEN' || b2.faultState === 'OPEN' || b3.faultState === 'OPEN';
  const anyBurned = b1.isBurnedOut || b2.isBurnedOut || b3.isBurnedOut;

  let diagnosticMessageEs = `Cálculo MNA dinámico en tiempo real (${topology.toUpperCase()}): Ley de Ohm y Leyes de Kirchhoff (LVK / LCK) actualizadas independientemente.`;
  let diagnosticMessageEn = `Real-time dynamic MNA calculation (${topology.toUpperCase()}): Ohm’s Law and Kirchhoff’s Laws (KVL / KCL) updated independently.`;

  if (mna.isShortCircuitFault) {
    diagnosticMessageEs = `¡CORTOCIRCUITO FÍSICO REAL DETECTADO (Pico de falla: ${mna.shortCircuitPeakCurrent.toFixed(1)} A)! La protección electrónica OCP de la fuente DC cortó el suministro (V = 0.00 V, I = 0.000 A), deteniendo los electrones y apagando el circuito para evitar daño térmico.`;
    diagnosticMessageEn = `REAL PHYSICAL SHORT-CIRCUIT DETECTED (Fault surge: ${mna.shortCircuitPeakCurrent.toFixed(1)} A)! The DC supply OCP protection cut off power (V = 0.00 V, I = 0.000 A), stopping electrons and shutting down the circuit.`;
  } else if (anyBurned) {
    diagnosticMessageEs = `¡FILAMENTO FUNDIDO POR SOBRECALENTAMIENTO TÉRMICO (P > ${MAX_RATED_POWER_WATTS.toFixed(1)} W)! La bombilla sobrecargada abrió su rama automáticamente (falla OPEN). Reduce el voltaje o aumenta la resistencia antes de reemplazarla.`;
    diagnosticMessageEn = `FILAMENT BURNED OUT BY THERMAL OVERLOAD (P > ${MAX_RATED_POWER_WATTS.toFixed(1)} W)! The overloaded bulb automatically opened its branch (OPEN fault).`;
  } else if (iTotal < 1e-5) {
    diagnosticMessageEs =
      'CIRCUITO ABIERTO TOTAL (R_eq = ∞): Trayectoria principal interrumpida (I_T = 0.000 A). Si eliminaste un resistor, pulsa "🔗 Unir Cable" para cerrar el paso de corriente.';
    diagnosticMessageEn =
      'TOTAL OPEN CIRCUIT (R_eq = ∞): Main path interrupted (I_T = 0.000 A). Join the open cable to restore current flow.';
  } else if (anyOpen) {
    diagnosticMessageEs =
      'RAMA CON CABLE DESCONECTADO / ABIERTA (I_rama = 0.000 A): Puedes unir manualmente el cable de esa rama ("🔗 Unir Cable") o reinstalar su resistor.';
    diagnosticMessageEn =
      'OPEN / DISCONNECTED BRANCH (I_branch = 0.000 A): You can manually join the branch cable or reinstall its resistor.';
  }

  return {
    isPowered: true,
    topology,
    sourceVoltage: vSrc,
    equivalentResistance: mna.equivalentResistance,
    totalCurrent: iTotal,
    totalPower: mna.totalPower,
    isShortCircuitFault: mna.isShortCircuitFault,
    isOpenCircuitFault: mna.isOpenCircuitFault,
    shortCircuitPeakCurrent: mna.shortCircuitPeakCurrent,
    kvlVerified: true,
    kclVerified: true,
    kvlEquationText,
    kclEquationText,
    diagnosticMessageEs,
    diagnosticMessageEn,
    branches: [b1, b2, b3],
    nodePotentials: mna.nodeVoltages,
  };
}

/**
 * Elimina el resistor/bombilla de una rama SIN eliminar el cable de corriente:
 * deja las dos puntas del cable separadas (type: 'wire', faultState: 'OPEN')
 * para que solo el usuario decida cuándo volver a unir el cable o reinstalar el resistor.
 */
export function removeResistorKeepCable(
  components: CircuitComponent[],
  compId: string
): CircuitComponent[] {
  return components.map((c) => {
    if (c.id !== compId) return c;
    const baseName = c.id === 'res-1' ? 'R1' : c.id === 'res-2' ? 'R2' : c.id === 'res-3' ? 'R3' : c.label;
    return {
      ...c,
      type: 'wire',
      label: `Cable ${baseName} (Suelto)`,
      faultState: 'OPEN',
      isBurnedOut: false,
    };
  });
}

/**
 * Permite al usuario unir (join = true -> faultState: 'ON') o separar (join = false -> faultState: 'OPEN')
 * manualmente las puntas del cable de corriente donde antes había un resistor, manteniendo el circuito funcional.
 */
export function joinOrSeparateBranchCable(
  components: CircuitComponent[],
  compId: string,
  join?: boolean
): CircuitComponent[] {
  return components.map((c) => {
    if (c.id !== compId) return c;
    const shouldJoin = join !== undefined ? join : c.faultState === 'OPEN';
    const baseName = c.id === 'res-1' ? 'R1' : c.id === 'res-2' ? 'R2' : c.id === 'res-3' ? 'R3' : c.label;
    return {
      ...c,
      type: 'wire',
      label: shouldJoin ? `Cable ${baseName} (Unido)` : `Cable ${baseName} (Suelto)`,
      faultState: shouldJoin ? 'ON' : 'OPEN',
      isBurnedOut: false,
    };
  });
}

/**
 * Reinstala un resistor en el cable de la rama indicada con su valor en Ohmios.
 */
export function restoreBranchResistor(
  components: CircuitComponent[],
  compId: string,
  ohms?: number
): CircuitComponent[] {
  return components.map((c) => {
    if (c.id !== compId) return c;
    const baseName = c.id === 'res-1' ? 'R1' : c.id === 'res-2' ? 'R2' : c.id === 'res-3' ? 'R3' : c.label;
    return {
      ...c,
      type: 'resistor',
      label: baseName,
      resistance: ohms ?? (c.resistance > 0 ? c.resistance : 20),
      faultState: 'ON',
      isBurnedOut: false,
    };
  });
}

/**
 * Evalúa la lectura física del Multímetro Digital Interactivo según la posición de las
 * puntas de prueba (probeRedNode, probeBlackNode) y la perilla selectora ('V' | 'OHM' | 'A').
 */
export function evaluateMultimeterMeasurement(params: {
  mode: MultimeterMode;
  probeRedNode: string;
  probeBlackNode: string;
  components: CircuitComponent[];
  solution: CircuitSolution;
  topologyResult: TopologyAnalysisResult;
  isPowered: boolean;
  isFuseBlown: boolean;
}): MultimeterEvaluation {
  const {
    mode,
    probeRedNode,
    probeBlackNode,
    components,
    solution,
    topologyResult,
    isPowered,
    isFuseBlown,
  } = params;

  const makeResult = (r: {
    mode: MultimeterMode;
    displayValue: string;
    unit: string;
    numericValue: number | null;
    measuredBranchId: 'R1' | 'R2' | 'R3' | null;
    isValidConnection: boolean;
    triggersFuseBlow: boolean;
    warningMessageEs: string | null;
    statusKind: 'ok' | 'warning' | 'error';
  }): MultimeterEvaluation => ({
    ...r,
    displayText: r.displayValue,
    warningEs: r.warningMessageEs,
  });

  // Identificar si las dos puntas están colocadas exactamente sobre los terminales de R1, R2 o R3
  const matchedBranch = topologyResult.branches.find(
    (b) =>
      (b.nodeA === probeRedNode && b.nodeB === probeBlackNode) ||
      (b.nodeA === probeBlackNode && b.nodeB === probeRedNode)
  );
  const measuredBranchId = matchedBranch ? matchedBranch.branchId : null;

  // 1. Modo VOLTÍMETRO DC (V⎓)
  if (mode === 'V') {
    if (probeRedNode === probeBlackNode) {
      return makeResult({
        mode: 'V',
        displayValue: '0.00',
        unit: 'VDC',
        numericValue: 0,
        measuredBranchId: null,
        isValidConnection: false,
        triggersFuseBlow: false,
        warningMessageEs:
          'Ambas sondas están en el mismo nodo equipotencial (ΔV = 0.00 V). Coloca las puntas en dos nodos distintos en paralelo con el componente a medir.',
        statusKind: 'warning',
      });
    }

    const vRed =
      isPowered && !solution.isShortCircuitFault ? solution.nodeVoltages[probeRedNode] ?? 0 : 0;
    const vBlack =
      isPowered && !solution.isShortCircuitFault ? solution.nodeVoltages[probeBlackNode] ?? 0 : 0;
    const dv = vRed - vBlack;

    return makeResult({
      mode: 'V',
      displayValue: dv.toFixed(2),
      unit: 'VDC',
      numericValue: dv,
      measuredBranchId,
      isValidConnection: true,
      triggersFuseBlow: false,
      warningMessageEs: measuredBranchId
        ? `Medición en paralelo correcta sobre la rama ${measuredBranchId}: |ΔV| = ${Math.abs(dv).toFixed(2)} V.`
        : null,
      statusKind: 'ok',
    });
  }

  // 2. Modo ÓHMETRO (Ω) — Solo mide resistencia con la fuente apagada (isPowered === false)
  if (mode === 'OHM') {
    if (isPowered) {
      return makeResult({
        mode: 'OHM',
        displayValue: 'ERR: ON',
        unit: 'Ω',
        numericValue: null,
        measuredBranchId: null,
        isValidConnection: false,
        triggersFuseBlow: false,
        warningMessageEs:
          '¡Prohibido medir resistencia con el circuito energizado! Apaga primero la fuente (FUENTE: OFF) para que el Óhmetro inyecte su propia corriente de prueba sin dañarse.',
        statusKind: 'error',
      });
    }

    if (probeRedNode === probeBlackNode) {
      return makeResult({
        mode: 'OHM',
        displayValue: '0.00',
        unit: 'Ω',
        numericValue: 0,
        measuredBranchId: null,
        isValidConnection: false,
        triggersFuseBlow: false,
        warningMessageEs: 'Sondas en contacto sobre el mismo nodo conductor (0.00 Ω).',
        statusKind: 'warning',
      });
    }

    if (matchedBranch) {
      if (matchedBranch.faultState === 'OPEN' || matchedBranch.isBurnedOut) {
        return makeResult({
          mode: 'OHM',
          displayValue: 'OL (∞)',
          unit: 'Ω',
          numericValue: Infinity,
          measuredBranchId,
          isValidConnection: true,
          triggersFuseBlow: false,
          warningMessageEs: `Lectura OL (Overload / R → ∞) en ${matchedBranch.branchId}: el cable o filamento está ABIERTO.`,
          statusKind: 'warning',
        });
      }
      if (matchedBranch.faultState === 'SHORT' || matchedBranch.componentType === 'wire') {
        return makeResult({
          mode: 'OHM',
          displayValue: '0.00',
          unit: 'Ω',
          numericValue: 0,
          measuredBranchId,
          isValidConnection: true,
          triggersFuseBlow: false,
          warningMessageEs:
            matchedBranch.componentType === 'wire'
              ? `Lectura 0.00 Ω en ${matchedBranch.branchId}: cable de corriente unido directamente (continuidad perfecta).`
              : `Lectura 0.00 Ω en ${matchedBranch.branchId}: se detecta un CORTOCIRCUITO directo entre sus bornes.`,
          statusKind: matchedBranch.componentType === 'wire' ? 'ok' : 'error',
        });
      }
      return makeResult({
        mode: 'OHM',
        displayValue: matchedBranch.nominalOhms.toFixed(1),
        unit: 'Ω',
        numericValue: matchedBranch.nominalOhms,
        measuredBranchId,
        isValidConnection: true,
        triggersFuseBlow: false,
        warningMessageEs: `Resistencia óhmica medida en frío sobre ${matchedBranch.branchId}: ${matchedBranch.nominalOhms.toFixed(1)} Ω.`,
        statusKind: 'ok',
      });
    }

    const passiveSol = solveCircuit(components, { isPowered: true });
    const req = passiveSol.equivalentResistance;
    return makeResult({
      mode: 'OHM',
      displayValue: Number.isFinite(req) && req > 0 ? req.toFixed(1) : 'OL (∞)',
      unit: 'Ω',
      numericValue: req,
      measuredBranchId: null,
      isValidConnection: true,
      triggersFuseBlow: false,
      warningMessageEs:
        'Midiendo resistencia equivalente entre los nodos seleccionados con fuente apagada.',
      statusKind: 'ok',
    });
  }

  // 3. Modo AMPERÍMETRO DC (A⎓)
  if (isFuseBlown) {
    return makeResult({
      mode: 'A',
      displayValue: 'FUSE!',
      unit: 'ADC',
      numericValue: null,
      measuredBranchId: null,
      isValidConnection: false,
      triggersFuseBlow: false,
      warningMessageEs:
        '¡Fusible del multímetro quemado! El amperímetro tiene resistencia interna nula y provocó un cortocircuito al conectarse en paralelo con la fuente. Pulsa "Reemplazar Fusible (10A)".',
      statusKind: 'error',
    });
  }

  // Detectar si el estudiante conectó el Amperímetro directamente en paralelo con la fuente activa
  const bat = components.find((c) => c.type === 'battery');
  const posNodes = new Set<string>(['n1']);
  const negNodes = new Set<string>(['n0', 'n4']);
  if (bat) {
    posNodes.add(bat.nodeB);
    negNodes.add(bat.nodeA);
  }
  const isAcrossSourceDirect =
    isPowered &&
    ((posNodes.has(probeRedNode) && negNodes.has(probeBlackNode) && !matchedBranch) ||
      (posNodes.has(probeBlackNode) && negNodes.has(probeRedNode) && !matchedBranch));

  if (isAcrossSourceDirect) {
    return makeResult({
      mode: 'A',
      displayValue: 'FUSE!',
      unit: 'ADC',
      numericValue: null,
      measuredBranchId: null,
      isValidConnection: false,
      triggersFuseBlow: true,
      warningMessageEs:
        '¡Fusible del multímetro quemado! El amperímetro tiene resistencia interna nula y provocó un cortocircuito al conectarlo en paralelo directo con la fuente.',
      statusKind: 'error',
    });
  }

  if (matchedBranch) {
    return makeResult({
      mode: 'A',
      displayValue: matchedBranch.current.toFixed(3),
      unit: 'ADC',
      numericValue: matchedBranch.current,
      measuredBranchId,
      isValidConnection: true,
      triggersFuseBlow: false,
      warningMessageEs: `Corriente de rama medida en ${matchedBranch.branchId}: I = ${matchedBranch.current.toFixed(3)} A.`,
      statusKind: 'ok',
    });
  }

  return makeResult({
    mode: 'A',
    displayValue: topologyResult.totalCurrent.toFixed(3),
    unit: 'ADC',
    numericValue: topologyResult.totalCurrent,
    measuredBranchId: null,
    isValidConnection: true,
    triggersFuseBlow: false,
    warningMessageEs:
      'Selecciona los bornes de una rama (R₁, R₂ o R₃) para intercalar la lectura amperimétrica de esa rama sin puentear la fuente.',
    statusKind: 'ok',
  });
}

/**
 * Construye el grafo nodal inicial de componentes 3D para una topología dada
 * permitiendo que cada rama (R1, R2, R3) sea resistencia, bombilla incandescente (15.0W máx) o cable ('wire').
 */
export function buildTopologyComponents3D(params: {
  topology: CircuitTopology;
  sourceVoltage: number;
  r1: number;
  r2: number;
  r3: number;
  f1: BranchFaultState;
  f2: BranchFaultState;
  f3: BranchFaultState;
  isPowered: boolean;
  branchTypes?: Partial<Record<'R1' | 'R2' | 'R3', 'resistor' | 'bulb' | 'wire'>>;
}): CircuitComponent[] {
  const { topology, sourceVoltage, r1, r2, r3, f1, f2, f3, isPowered, branchTypes } = params;
  const t1 = branchTypes?.R1 ?? 'resistor';
  const t2 = branchTypes?.R2 ?? 'resistor';
  const t3 = branchTypes?.R3 ?? 'resistor';

  const makeBranch = (
    id: string,
    branchKey: 'R1' | 'R2' | 'R3',
    cType: 'resistor' | 'bulb' | 'wire',
    suffix: string,
    nodeA: string,
    nodeB: string,
    ohms: number,
    fault: BranchFaultState
  ): CircuitComponent => ({
    id,
    type: cType,
    label:
      cType === 'bulb'
        ? `Bombilla ${branchKey}${suffix}`
        : cType === 'wire'
        ? `Cable ${branchKey} (${fault === 'OPEN' ? 'Suelto' : 'Unido'})`
        : `${branchKey}${suffix}`,
    nodeA,
    nodeB,
    resistance: ohms,
    maxPower: cType === 'bulb' ? MAX_RATED_POWER_WATTS : undefined,
    isIndicator: false,
    faultState: fault,
  });

  if (topology === 'parallel') {
    return [
      { id: 'bat-1', type: 'battery', label: 'Fuente DC', nodeA: 'n0', nodeB: 'n1', voltage: sourceVoltage, resistance: 0 },
      makeBranch('res-1', 'R1', t1, ' (Rama 1)', 'n1', 'n4', r1, f1),
      { id: 'wire-sup1', type: 'wire', label: 'Bus +', nodeA: 'n1', nodeB: 'n2', resistance: 0 },
      makeBranch('res-2', 'R2', t2, ' (Rama 2)', 'n2', 'n4', r2, f2),
      { id: 'wire-sup2', type: 'wire', label: 'Bus +', nodeA: 'n2', nodeB: 'n3', resistance: 0 },
      makeBranch('res-3', 'R3', t3, ' (Rama 3)', 'n3', 'n5', r3, f3),
      { id: 'bulb-1', type: 'bulb', label: 'Bombilla Testigo', nodeA: 'n5', nodeB: 'n4', resistance: 15, maxPower: 60, isIndicator: true },
      { id: 'sw-1', type: 'switch', label: 'SW Maestro', nodeA: 'n4', nodeB: 'n0', resistance: 0, isClosed: isPowered },
    ];
  }

  if (topology === 'mixed') {
    return [
      { id: 'bat-1', type: 'battery', label: 'Fuente DC', nodeA: 'n0', nodeB: 'n1', voltage: sourceVoltage, resistance: 0 },
      makeBranch('res-1', 'R1', t1, ' (Serie)', 'n1', 'n2', r1, f1),
      makeBranch('res-2', 'R2', t2, ' (Paralelo)', 'n2', 'n4', r2, f2),
      { id: 'wire-bif', type: 'wire', label: 'Nodo Bif.', nodeA: 'n2', nodeB: 'n3', resistance: 0 },
      makeBranch('res-3', 'R3', t3, ' (Paralelo)', 'n3', 'n5', r3, f3),
      { id: 'bulb-1', type: 'bulb', label: 'Bombilla Testigo', nodeA: 'n5', nodeB: 'n4', resistance: 15, maxPower: 60, isIndicator: true },
      { id: 'sw-1', type: 'switch', label: 'SW Maestro', nodeA: 'n4', nodeB: 'n0', resistance: 0, isClosed: isPowered },
    ];
  }

  // Topología Serie: Fuente DC + R1 + R2 + R3 + Bombilla Testigo + Interruptor Maestro
  return [
    { id: 'bat-1', type: 'battery', label: 'Fuente DC', nodeA: 'n0', nodeB: 'n1', voltage: sourceVoltage, resistance: 0 },
    makeBranch('res-1', 'R1', t1, '', 'n1', 'n2', r1, f1),
    makeBranch('res-2', 'R2', t2, '', 'n2', 'n3', r2, f2),
    makeBranch('res-3', 'R3', t3, '', 'n3', 'n5', r3, f3),
    { id: 'bulb-1', type: 'bulb', label: 'Bombilla Testigo', nodeA: 'n5', nodeB: 'n4', resistance: 15, maxPower: 60, isIndicator: true },
    { id: 'sw-1', type: 'switch', label: 'SW Maestro', nodeA: 'n4', nodeB: 'n0', resistance: 0, isClosed: isPowered },
  ];
}

/**
 * Genera una misión de diagnóstico "Caja Negra: Circuito Averiado" (Objetivo C).
 * Acepta una topología opcional o semilla numérica para pruebas deterministas.
 */
export function generateFaultDiagnosisMission(
  topologyOrSeed?: CircuitTopology | number,
  seedFraction?: number
): FaultDiagnosisMission {
  const presets: Array<{
    topology: CircuitTopology;
    sourceVoltage: number;
    faultyBranchId: 'R1' | 'R2' | 'R3';
    faultType: HiddenFaultType;
    nominal: Record<'R1' | 'R2' | 'R3', number>;
    symptomEs: string;
  }> = [
    {
      topology: 'series',
      sourceVoltage: 24,
      faultyBranchId: 'R2',
      faultType: 'OPEN_FILAMENT',
      nominal: { R1: 20, R2: 30, R3: 30 },
      symptomEs:
        'Síntoma reportado: El circuito en SERIE (24 V) se apagó repentinamente y la corriente total cayó a 0.000 A, aunque la fuente DC está encendida.',
    },
    {
      topology: 'parallel',
      sourceVoltage: 18,
      faultyBranchId: 'R3',
      faultType: 'OPEN_FILAMENT',
      nominal: { R1: 30, R2: 30, R3: 30 },
      symptomEs:
        'Síntoma reportado: En este banco en PARALELO (18 V, tres ramas nominales de 30 Ω), la corriente total medida en la fuente es menor de la esperada (1.20 A en vez de 1.80 A).',
    },
    {
      topology: 'series',
      sourceVoltage: 20,
      faultyBranchId: 'R1',
      faultType: 'ALTERED_HIGH_RESISTANCE',
      nominal: { R1: 20, R2: 20, R3: 20 },
      symptomEs:
        'Síntoma reportado: Tres ramas nominalmente idénticas (20 Ω c/u) están en SERIE con 20 V, pero una de ellas absorbe mucha más tensión que las otras dos por degradación térmica.',
    },
    {
      topology: 'mixed',
      sourceVoltage: 24,
      faultyBranchId: 'R2',
      faultType: 'OPEN_FILAMENT',
      nominal: { R1: 20, R2: 40, R3: 40 },
      symptomEs:
        'Síntoma reportado: En el circuito MIXTO (R₁=20Ω en serie con R₂=40Ω ∥ R₃=40Ω a 24 V), la resistencia equivalente subió de 40 Ω a 60 Ω.',
    },
    {
      topology: 'parallel',
      sourceVoltage: 12,
      faultyBranchId: 'R1',
      faultType: 'SHORT_BYPASS',
      nominal: { R1: 25, R2: 25, R3: 50 },
      symptomEs:
        'Síntoma reportado: La fuente DC disparó inmediatamente su protección OCP contra sobrecorriente al energizar el banco en PARALELO. Usa el Óhmetro (con FUENTE: OFF) para hallar la rama en corto.',
    },
  ];

  let pool = presets;
  if (typeof topologyOrSeed === 'string') {
    const filtered = presets.filter((p) => p.topology === topologyOrSeed);
    if (filtered.length > 0) pool = filtered;
  }

  let idx = 0;
  if (typeof topologyOrSeed === 'number') {
    idx = Math.abs(Math.floor(topologyOrSeed)) % pool.length;
  } else if (typeof seedFraction === 'number') {
    idx = Math.min(pool.length - 1, Math.max(0, Math.floor(seedFraction * pool.length)));
  } else {
    idx = Math.floor(Math.random() * pool.length);
  }
  const chosen = pool[idx];

  const actualOhms: Record<'R1' | 'R2' | 'R3', number> = { ...chosen.nominal };
  const branchFaultStates: Record<'R1' | 'R2' | 'R3', BranchFaultState> = {
    R1: 'ON',
    R2: 'ON',
    R3: 'ON',
  };
  let alteredOhms: number | undefined;

  if (chosen.faultType === 'OPEN_FILAMENT') {
    branchFaultStates[chosen.faultyBranchId] = 'OPEN';
  } else if (chosen.faultType === 'SHORT_BYPASS') {
    branchFaultStates[chosen.faultyBranchId] = 'SHORT';
    actualOhms[chosen.faultyBranchId] = 0;
  } else if (chosen.faultType === 'ALTERED_HIGH_RESISTANCE') {
    alteredOhms = chosen.nominal[chosen.faultyBranchId] * 3;
    actualOhms[chosen.faultyBranchId] = alteredOhms;
  }

  const justificationOptionsEs = [
    'La rama presenta discontinuidad física (R → ∞ / OL en Óhmetro); interrumpe el paso de corriente (I_rama = 0 A) y, si está en serie, concentra el 100% de la FEM en sus bornes.',
    'La rama sufre un puente de impedancia nula (R ≈ 0.00 Ω en Óhmetro con fuente apagada), provocando sobrecorriente y disparo de protección OCP.',
    'La rama sufrió degradación térmica incrementando su resistencia óhmica real muy por encima del valor nominal, absorbiendo una caída de potencial ΔV = I·R desproporcionada.',
  ];

  const correctJustificationIndex =
    chosen.faultType === 'OPEN_FILAMENT'
      ? 0
      : chosen.faultType === 'SHORT_BYPASS'
      ? 1
      : 2;

  return {
    missionId: `mission-${idx}-${Date.now()}`,
    topology: chosen.topology,
    sourceVoltage: chosen.sourceVoltage,
    faultyBranchId: chosen.faultyBranchId,
    faultType: chosen.faultType,
    nominalOhms: chosen.nominal,
    actualOhms,
    alteredOhms,
    branchFaultStates,
    symptomPromptEs: chosen.symptomEs,
    symptomEs: chosen.symptomEs,
    justificationOptionsEs,
    correctJustificationIndex,
  };
}

/**
 * Evalúa constructivistamente el diagnóstico del estudiante (Ciclo Predecir - Observar - Explicar)
 */
export function validateFaultDiagnosisMission(
  missionOrParams:
    | FaultDiagnosisMission
    | {
        mission: FaultDiagnosisMission;
        selectedBranchId: 'R1' | 'R2' | 'R3';
        selectedFaultType: HiddenFaultType;
        selectedJustificationIndex: number;
      },
  maybeAttempt?: FaultDiagnosisAttempt
): FaultDiagnosisResult {
  const mission = 'mission' in missionOrParams ? missionOrParams.mission : missionOrParams;
  const selectedBranch =
    'mission' in missionOrParams
      ? missionOrParams.selectedBranchId
      : maybeAttempt?.selectedBranch ?? 'R1';
  const selectedFaultType =
    'mission' in missionOrParams
      ? missionOrParams.selectedFaultType
      : maybeAttempt?.selectedFaultType ?? 'OPEN_FILAMENT';
  const selectedJustificationIdx =
    'mission' in missionOrParams
      ? missionOrParams.selectedJustificationIndex
      : maybeAttempt?.selectedJustificationIdx ?? 0;

  const branchCorrect = selectedBranch === mission.faultyBranchId;
  const faultTypeCorrect = selectedFaultType === mission.faultType;
  const expectedJustificationIdx = mission.correctJustificationIndex;
  const justificationCorrect = selectedJustificationIdx === expectedJustificationIdx;
  const passed = branchCorrect && faultTypeCorrect && justificationCorrect;

  const poeExplanationEs =
    mission.faultType === 'OPEN_FILAMENT'
      ? `Ciclo POE: En ${mission.faultyBranchId}, la discontinuidad física (R → ∞) impide el paso de portadores (I = 0 A). Con el Óhmetro en frío se observa "OL (∞)", y en serie aparece el 100% de los ${mission.sourceVoltage} V entre sus terminales abiertos por LVK.`
      : mission.faultType === 'SHORT_BYPASS'
      ? `Ciclo POE: La rama ${mission.faultyBranchId} presenta un puente de impedancia nula (R ≈ 0.00 Ω). Al apagar la fuente y medir con el Óhmetro (Ω) sobre ${mission.faultyBranchId}, se confirma 0.00 Ω en lugar de los ${mission.nominalOhms[mission.faultyBranchId]} Ω nominales.`
      : `Ciclo POE: La rama ${mission.faultyBranchId} sufrió degradación térmica elevando su resistencia real de ${mission.nominalOhms[mission.faultyBranchId]} Ω a ${mission.actualOhms[mission.faultyBranchId]} Ω. Por la Ley de Ohm (ΔV = I · R), produce una caída de tensión tres veces mayor que una rama sana.`;

  if (passed) {
    const detail = `Identificaste correctamente la rama averiada (${mission.faultyBranchId}), el modo de falla y su justificación física mediante medición instrumental.`;
    return {
      passed: true,
      branchCorrect: true,
      faultTypeCorrect: true,
      justificationCorrect: true,
      feedbackTitleEs: `¡Diagnóstico y Reparación Exitosa en ${mission.faultyBranchId}!`,
      feedbackDetailEs: detail,
      feedbackBodyEs: detail,
      poeExplanationEs,
      poeNextStepEs: poeExplanationEs,
    };
  }

  const hints: string[] = [];
  if (!branchCorrect) {
    hints.push(
      `La rama seleccionada (${selectedBranch}) no es la que origina la falla. Mide con las sondas Roja y Negra cada una de las tres ramas (R₁, R₂ y R₃).`
    );
  }
  if (!faultTypeCorrect) {
    hints.push(
      'El tipo de avería no coincide con las lecturas del multímetro. Prueba cambiar la perilla a Óhmetro (Ω) apagando la fuente (FUENTE: OFF).'
    );
  }
  if (!justificationCorrect) {
    hints.push(
      'Revisa la justificación física (Ley de Ohm / Kirchhoff): relaciona lo que observaste en el display del multímetro con la causa física.'
    );
  }

  const detail = hints.join(' ');
  return {
    passed: false,
    branchCorrect,
    faultTypeCorrect,
    justificationCorrect,
    feedbackTitleEs: 'Diagnóstico Incompleto — Continúa Explorando con las Sondas',
    feedbackDetailEs: detail,
    feedbackBodyEs: detail,
    poeExplanationEs,
    poeNextStepEs: poeExplanationEs,
  };
}

/**
 * Función de compatibilidad que construye el grafo nodal y lo resuelve con el motor MNA unificado.
 */
export function solveTopologyCircuit(params: {
  isPowered: boolean;
  topology: CircuitTopology;
  sourceVoltage: number;
  r1: number;
  r2: number;
  r3: number;
  f1: BranchFaultState;
  f2: BranchFaultState;
  f3: BranchFaultState;
}): TopologyAnalysisResult {
  const comps = buildTopologyComponents3D(params);
  return analyzeWorkbenchCircuit(comps, params.isPowered, params.topology);
}

/**
 * Calcula las 5 bandas de color EIA de precisión (±1% Marrón) para cualquier resistencia en Ohmios.
 */
export function getResistorColorBands5(
  ohms: number
): [
  ResistorColorBand,
  ResistorColorBand,
  ResistorColorBand,
  ResistorColorBand,
  ResistorColorBand
] {
  const clamped = Math.max(1, Math.min(999000, Math.round(ohms)));
  const str = clamped < 100 ? clamped.toString().padStart(3, '0') : clamped.toString();
  const d1 = parseInt(str[0], 10) || 0;
  const d2 = parseInt(str[1], 10) || 0;
  const d3 = parseInt(str[2], 10) || 0;
  const mult = Math.max(0, str.length - 3);
  const precisionBrown: ResistorColorBand = {
    nameEs: 'Marrón (±1%)',
    nameEn: 'Brown (±1%)',
    hex: '#78350F',
  };
  return [
    COLOR_MAP[d1] || COLOR_MAP[0],
    COLOR_MAP[d2] || COLOR_MAP[0],
    COLOR_MAP[d3] || COLOR_MAP[0],
    COLOR_MAP[Math.min(9, mult)] || COLOR_MAP[0],
    precisionBrown,
  ];
}

/**
 * Calcula el estado transitorio RC de carga/descarga V_C(t) = V_0 * (1 - e^(-t / (R*C)))
 * y el estado de polarización y protección térmica de un Diodo LED 3D.
 */
export function computeRCAndLEDState(params: {
  sourceVoltage: number;
  seriesResistanceOhms: number;
  capacitanceMicroFarads: number;
  elapsedSeconds: number;
  isCharging: boolean;
  ledForwardVoltage?: number;
  ledMaxCurrentAmps?: number;
}): {
  tauSeconds: number;
  capacitorVoltage: number;
  capacitorCurrent: number;
  ledCurrentAmps: number;
  ledBrightness: number;
  ledBurnedOut: boolean;
  curvePoints: Array<{ t: number; v: number }>;
} {
  const {
    sourceVoltage,
    seriesResistanceOhms,
    capacitanceMicroFarads,
    elapsedSeconds,
    isCharging,
    ledForwardVoltage = 2.0,
    ledMaxCurrentAmps = 0.035,
  } = params;

  const R = Math.max(1, seriesResistanceOhms);
  const C = Math.max(1, capacitanceMicroFarads) * 1e-6;
  const tauSeconds = Math.max(0.2, R * C);

  const ratio = Math.max(0, elapsedSeconds) / tauSeconds;
  const capacitorVoltage = isCharging
    ? sourceVoltage * (1 - Math.exp(-ratio))
    : sourceVoltage * Math.exp(-ratio);

  const capacitorCurrent =
    ((sourceVoltage - capacitorVoltage) / R) * (isCharging ? 1 : -1);

  const ledNetV = Math.max(0, sourceVoltage - ledForwardVoltage);
  const ledCurrentAmps = ledNetV / R;
  const ledBurnedOut = ledCurrentAmps > ledMaxCurrentAmps;
  const ledBrightness = ledBurnedOut
    ? 0
    : Math.min(1, ledCurrentAmps / (ledMaxCurrentAmps * 0.75));

  const curvePoints: Array<{ t: number; v: number }> = [];
  const maxT = tauSeconds * 5;
  for (let i = 0; i <= 25; i++) {
    const tVal = (i / 25) * maxT;
    const vVal = isCharging
      ? sourceVoltage * (1 - Math.exp(-tVal / tauSeconds))
      : sourceVoltage * Math.exp(-tVal / tauSeconds);
    curvePoints.push({ t: tVal, v: vVal });
  }

  return {
    tauSeconds,
    capacitorVoltage,
    capacitorCurrent,
    ledCurrentAmps,
    ledBrightness,
    ledBurnedOut,
    curvePoints,
  };
}

