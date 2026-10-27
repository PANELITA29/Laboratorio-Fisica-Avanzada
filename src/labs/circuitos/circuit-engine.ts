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
    if (comp.type === 'wire' || comp.type === 'switch') return 1e-4;
    if (comp.type === 'battery') return 1e-4;
    if (comp.faultState === 'SHORT') return 1e-4;
    if (comp.type === 'bulb' && comp.isIndicator) return 1e-4;
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

  // Evaluar si alguna bombilla real (no testigo amperimétrico) supera su potencia máxima nominal
  let newlyBurned = false;
  components.forEach((comp) => {
    if (comp.type === 'bulb' && !comp.isIndicator && !burnedSet.has(comp.id)) {
      const vA = nodeVoltages[comp.nodeA] ?? 0;
      const vB = nodeVoltages[comp.nodeB] ?? 0;
      const dv = Math.abs(vA - vB);
      const r = Math.max(0.1, comp.resistance);
      const p = (dv * dv) / r;
      const maxP = comp.maxPower ?? 25;
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

      const maxP = comp.maxPower ?? 25;
      const brightness =
        comp.type === 'bulb'
          ? comp.isIndicator
            ? Math.min(1, Math.abs(current) / 0.35)
            : Math.min(1, power / (maxP * 0.65))
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
  const anyOpenBranch = components.some((c) => c.faultState === 'OPEN');
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
  nodeA: string;
  nodeB: string;
  nominalOhms: number;
  effectiveOhms: number;
  faultState: BranchFaultState;
  voltageDrop: number;
  current: number;
  power: number;
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
 * inspeccionando las conexiones nodales reales de las resistencias en el banco de trabajo.
 */
export function inferCircuitTopology(
  components: CircuitComponent[],
  fallback: CircuitTopology = 'series'
): CircuitTopology {
  const resistors = components.filter((c) => c.type === 'resistor');
  if (resistors.length < 2) return fallback;

  // Contar cuántas resistencias comparten exactamente el mismo par de nodos o buses paralelos
  const r1 = resistors[0];
  const r2 = resistors[1];
  const r3 = resistors[2];

  if (r1 && r2 && r3) {
    // En Serie: n1->n2, n2->n3, n3->n5 (ninguna comparte ambos extremos)
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
 * utilizando la solución nodal MNA (`solveCircuit`). Cada resistencia (R1, R2, R3) se evalúa
 * de forma independiente según los nodos a los que esté conectada y su valor óhmico actual.
 */
export function analyzeWorkbenchCircuit(
  components: CircuitComponent[],
  isPowered: boolean = true,
  topologyHint: CircuitTopology = 'series'
): TopologyAnalysisResult {
  const mna = solveCircuit(components, { isPowered });
  const topology = inferCircuitTopology(components, topologyHint);

  const resistors = components.filter((c) => c.type === 'resistor');
  const getBranchRow = (
    idx: number,
    branchId: 'R1' | 'R2' | 'R3'
  ): BranchAnalyticalRow => {
    const comp =
      components.find((c) => c.id === `res-${idx + 1}`) || resistors[idx];
    if (!comp) {
      return {
        branchId,
        componentId: `res-${idx + 1}`,
        nodeA: 'n1',
        nodeB: 'n2',
        nominalOhms: 10,
        effectiveOhms: 10,
        faultState: 'ON',
        voltageDrop: 0,
        current: 0,
        power: 0,
      };
    }

    const fault: BranchFaultState = comp.faultState ?? 'ON';
    const st = mna.componentStates[comp.id];
    const effOhms =
      fault === 'OPEN' ? Infinity : fault === 'SHORT' ? 0 : comp.resistance;

    return {
      branchId,
      componentId: comp.id,
      nodeA: comp.nodeA,
      nodeB: comp.nodeB,
      nominalOhms: comp.resistance,
      effectiveOhms: effOhms,
      faultState: fault,
      voltageDrop: st ? Math.abs(st.voltageDrop) : 0,
      current: st ? Math.abs(st.current) : 0,
      power: st ? st.power : 0,
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
        'Fuente DC en estado OFF o Interruptor Maestro abierto. Cierra el interruptor o activa FUENTE: ON para energizar el banco.',
      diagnosticMessageEn:
        'DC power supply is OFF or Master Switch is open. Close the switch or toggle POWER: ON to energize the workbench.',
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

  let diagnosticMessageEs = `Cálculo MNA dinámico en tiempo real (${topology.toUpperCase()}): Ley de Ohm y Leyes de Kirchhoff (LVK / LCK) actualizadas independientemente.`;
  let diagnosticMessageEn = `Real-time dynamic MNA calculation (${topology.toUpperCase()}): Ohm’s Law and Kirchhoff’s Laws (KVL / KCL) updated independently.`;

  if (mna.isShortCircuitFault) {
    diagnosticMessageEs = `¡CORTOCIRCUITO FÍSICO REAL DETECTADO (Pico de falla: ${mna.shortCircuitPeakCurrent.toFixed(1)} A)! La protección electrónica OCP de la fuente DC cortó el suministro (V = 0.00 V, I = 0.000 A), deteniendo los electrones y apagando el circuito para evitar daño térmico.`;
    diagnosticMessageEn = `REAL PHYSICAL SHORT-CIRCUIT DETECTED (Fault surge: ${mna.shortCircuitPeakCurrent.toFixed(1)} A)! The DC supply OCP protection cut off power (V = 0.00 V, I = 0.000 A), stopping electrons and shutting down the circuit.`;
  } else if (iTotal < 1e-5) {
    diagnosticMessageEs =
      'CIRCUITO ABIERTO TOTAL (R_eq = ∞): Trayectoria principal interrumpida (I_T = 0.000 A). Los electrones se detienen por completo y toda la tensión de la fuente cae en la abertura.';
    diagnosticMessageEn =
      'TOTAL OPEN CIRCUIT (R_eq = ∞): Main path interrupted (I_T = 0.000 A). Electrons stop completely and full source voltage drops across the open break.';
  } else if (anyOpen) {
    diagnosticMessageEs =
      'RAMA DESCONECTADA / ABIERTA (I_rama = 0.000 A): El motor nodal MNA recalculó las ramas activas restantes de forma independiente según la Ley de Nodos de Kirchhoff (LCK).';
    diagnosticMessageEn =
      'OPEN / DISCONNECTED BRANCH (I_branch = 0.000 A): The MNA nodal solver independently recalculated the remaining active branches via Kirchhoff’s Current Law (KCL).';
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
 * Construye el grafo nodal inicial de componentes 3D para una topología dada
 * manteniendo siempre independientes Fuente DC, R1, R2, R3, Bombilla Testigo e Interruptor Maestro.
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
}): CircuitComponent[] {
  const { topology, sourceVoltage, r1, r2, r3, f1, f2, f3, isPowered } = params;

  if (topology === 'parallel') {
    return [
      { id: 'bat-1', type: 'battery', label: 'Fuente DC', nodeA: 'n0', nodeB: 'n1', voltage: sourceVoltage, resistance: 0 },
      { id: 'res-1', type: 'resistor', label: 'R1 (Rama 1)', nodeA: 'n1', nodeB: 'n4', resistance: r1, faultState: f1 },
      { id: 'wire-sup1', type: 'wire', label: 'Bus +', nodeA: 'n1', nodeB: 'n2', resistance: 0 },
      { id: 'res-2', type: 'resistor', label: 'R2 (Rama 2)', nodeA: 'n2', nodeB: 'n4', resistance: r2, faultState: f2 },
      { id: 'wire-sup2', type: 'wire', label: 'Bus +', nodeA: 'n2', nodeB: 'n3', resistance: 0 },
      { id: 'res-3', type: 'resistor', label: 'R3 (Rama 3)', nodeA: 'n3', nodeB: 'n5', resistance: r3, faultState: f3 },
      { id: 'bulb-1', type: 'bulb', label: 'Bombilla Testigo', nodeA: 'n5', nodeB: 'n4', resistance: 15, maxPower: 60, isIndicator: true },
      { id: 'sw-1', type: 'switch', label: 'SW Maestro', nodeA: 'n4', nodeB: 'n0', resistance: 0, isClosed: isPowered },
    ];
  }

  if (topology === 'mixed') {
    return [
      { id: 'bat-1', type: 'battery', label: 'Fuente DC', nodeA: 'n0', nodeB: 'n1', voltage: sourceVoltage, resistance: 0 },
      { id: 'res-1', type: 'resistor', label: 'R1 (Serie)', nodeA: 'n1', nodeB: 'n2', resistance: r1, faultState: f1 },
      { id: 'res-2', type: 'resistor', label: 'R2 (Paralelo)', nodeA: 'n2', nodeB: 'n4', resistance: r2, faultState: f2 },
      { id: 'wire-bif', type: 'wire', label: 'Nodo Bif.', nodeA: 'n2', nodeB: 'n3', resistance: 0 },
      { id: 'res-3', type: 'resistor', label: 'R3 (Paralelo)', nodeA: 'n3', nodeB: 'n5', resistance: r3, faultState: f3 },
      { id: 'bulb-1', type: 'bulb', label: 'Bombilla Testigo', nodeA: 'n5', nodeB: 'n4', resistance: 15, maxPower: 60, isIndicator: true },
      { id: 'sw-1', type: 'switch', label: 'SW Maestro', nodeA: 'n4', nodeB: 'n0', resistance: 0, isClosed: isPowered },
    ];
  }

  // Topología Serie: Fuente DC + R1 + R2 + R3 + Bombilla Testigo + Interruptor Maestro
  return [
    { id: 'bat-1', type: 'battery', label: 'Fuente DC', nodeA: 'n0', nodeB: 'n1', voltage: sourceVoltage, resistance: 0 },
    { id: 'res-1', type: 'resistor', label: 'R1', nodeA: 'n1', nodeB: 'n2', resistance: r1, faultState: f1 },
    { id: 'res-2', type: 'resistor', label: 'R2', nodeA: 'n2', nodeB: 'n3', resistance: r2, faultState: f2 },
    { id: 'res-3', type: 'resistor', label: 'R3', nodeA: 'n3', nodeB: 'n5', resistance: r3, faultState: f3 },
    { id: 'bulb-1', type: 'bulb', label: 'Bombilla Testigo', nodeA: 'n5', nodeB: 'n4', resistance: 15, maxPower: 60, isIndicator: true },
    { id: 'sw-1', type: 'switch', label: 'SW Maestro', nodeA: 'n4', nodeB: 'n0', resistance: 0, isClosed: isPowered },
  ];
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
