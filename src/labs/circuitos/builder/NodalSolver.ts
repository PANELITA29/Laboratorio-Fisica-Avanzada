export type SandboxComponentType =
  | 'battery'
  | 'resistor'
  | 'bulb'
  | 'buzzer'
  | 'switch'
  | 'pushbutton'
  | 'fuse'
  | 'ammeter';

export type ChargeFlowDisplayMode = 'electrons' | 'conventional' | 'arrows';
export type CircuitVisualStyle = 'realistic' | 'schematic';

export interface SandboxComponent {
  id: string;
  type: SandboxComponentType;
  label: string;
  /** Posición X en el lienzo (px, ajustada a rejilla) */
  x: number;
  /** Posición Y en el lienzo (px, ajustada a rejilla) */
  y: number;
  /** Rotación en grados: 0 | 90 | 180 | 270 */
  rotation: 0 | 90 | 180 | 270;
  /** Voltaje nominal en V (solo para battery: 0.5V a 48V) */
  voltage?: number;
  /** Resistencia nominal en Ω (para resistor, bulb, buzzer) */
  resistance?: number;
  /** Potencia máxima antes de fundirse en W (por defecto 15W para bombilla) */
  maxWatts?: number;
  /** Corriente nominal de disparo en A (por defecto 2.0A para fusible) */
  maxCurrentAmps?: number;
  /** Estado cerrado/abierto para interruptor unipolar (switch) */
  isClosed?: boolean;
  /** Estado presionado para pulsador momentáneo (pushbutton) */
  isPressed?: boolean;
  /** Estado de daño térmico por sobrecarga (>15W) */
  isBurnedOut?: boolean;
  /** Estado de fusible fundido (>maxCurrentAmps) */
  isBlown?: boolean;
}

export interface SandboxWire {
  id: string;
  /** Formato: `${componentId}:A` o `${componentId}:B` */
  fromTerminal: string;
  /** Formato: `${componentId}:A` o `${componentId}:B` */
  toTerminal: string;
}

export interface VoltmeterProbes {
  enabled: boolean;
  redTerminal: string | null;
  blackTerminal: string | null;
}

export interface ElectricalNode {
  id: string;
  voltage: number;
  terminals: string[];
}

export interface SolvedBranch {
  id: string;
  fromNode: string;
  toNode: string;
  component: SandboxComponent;
  /** Corriente convencional de terminal A hacia terminal B (A) */
  current: number;
  /** Caída de tensión V(A) - V(B) (V) */
  voltageDrop: number;
  /** Potencia disipada o entregada en vatios (W) */
  power: number;
  /** Nivel de brillo normalizado [0..1.5] para bombillas */
  brightness: number;
  /** Indica si la rama forma parte de un lazo en cortocircuito */
  isShortPath: boolean;
  /** Indica si este paso supera la potencia máxima nominal (>15W) */
  willBurnOut: boolean;
  /** Indica si este paso supera la corriente nominal del fusible (>2A) */
  willBlowFuse: boolean;
}

export interface WireCurrentState {
  wireId: string;
  nodeId: string;
  voltage: number;
  /** Corriente estimada que circula por este cable de unión (de fromTerminal a toTerminal) */
  current: number;
  isShortPath: boolean;
}

export interface NodalSolverResult {
  nodes: Record<string, ElectricalNode>;
  terminalToNode: Record<string, string>;
  branches: Record<string, SolvedBranch>;
  wireStates: Record<string, WireCurrentState>;
  isShortCircuit: boolean;
  shortCircuitMessage: string | null;
  burnedComponentIds: string[];
  blownFuseIds: string[];
  activeBuzzerIds: string[];
  totalSourceCurrent: number;
  totalPowerDissipated: number;
  voltmeterReading: number | null;
}

export interface EiaColorBand {
  nameEs: string;
  hex: string;
}

const EIA_DIGIT_COLORS: Array<{ nameEs: string; hex: string }> = [
  { nameEs: 'Negro', hex: '#18181B' },
  { nameEs: 'Marrón', hex: '#78350F' },
  { nameEs: 'Rojo', hex: '#DC2626' },
  { nameEs: 'Naranja', hex: '#EA580C' },
  { nameEs: 'Amarillo', hex: '#EAB308' },
  { nameEs: 'Verde', hex: '#16A34A' },
  { nameEs: 'Azul', hex: '#2563EB' },
  { nameEs: 'Violeta', hex: '#7C3AED' },
  { nameEs: 'Gris', hex: '#64748B' },
  { nameEs: 'Blanco', hex: '#F8FAFC' },
];

/**
 * Convierte coordenadas del lienzo 2D (920x520, origen superior-izquierdo)
 * a coordenadas del banco de prototipado 3D (plano X-Z, centro en 0,0,0).
 */
export function canvasToWorld3D(x: number, y: number, yHeight = 0): { x: number; y: number; z: number } {
  return {
    x: Number(((x - 460) / 20).toFixed(3)),
    y: yHeight,
    z: Number(((y - 260) / 20).toFixed(3)),
  };
}

/**
 * Convierte coordenadas del mundo 3D (plano X-Z) de vuelta al espacio de rejilla del taller (920x520).
 */
export function world3DToCanvas(worldX: number, worldZ: number, snapGrid = 20): { x: number; y: number } {
  const rawX = 460 + worldX * 20;
  const rawY = 260 + worldZ * 20;
  const clampedX = Math.max(60, Math.min(860, rawX));
  const clampedY = Math.max(60, Math.min(460, rawY));
  return {
    x: Math.round(clampedX / snapGrid) * snapGrid,
    y: Math.round(clampedY / snapGrid) * snapGrid,
  };
}

/**
 * Calcula automáticamente las 4 bandas de color EIA para cualquier resistencia (1Ω a 10kΩ).
 */
export function getEia4Bands(ohms: number): [EiaColorBand, EiaColorBand, EiaColorBand, EiaColorBand] {
  const clamped = Math.max(1, Math.min(100000, Math.round(ohms)));
  if (clamped < 10) {
    const d1 = clamped;
    return [
      EIA_DIGIT_COLORS[d1] || EIA_DIGIT_COLORS[1],
      EIA_DIGIT_COLORS[0],
      { nameEs: 'Plata (×0.1)', hex: '#94A3B8' },
      { nameEs: 'Oro (±5%)', hex: '#D97706' },
    ];
  }
  const str = String(clamped);
  const d1 = Number(str[0]) || 1;
  const d2 = Number(str[1]) || 0;
  const multiplierExp = Math.max(0, Math.min(9, str.length - 2));
  return [
    EIA_DIGIT_COLORS[d1],
    EIA_DIGIT_COLORS[d2],
    EIA_DIGIT_COLORS[multiplierExp],
    { nameEs: 'Oro (±5%)', hex: '#D97706' },
  ];
}

/**
 * Resuelve un sistema lineal A * x = b mediante eliminación gaussiana con pivoteo parcial.
 */
export function solveLinearSystemGaussian(matrixA: number[][], vectorB: number[]): number[] {
  const n = vectorB.length;
  if (n === 0) return [];
  const A = matrixA.map((row) => [...row]);
  const b = [...vectorB];

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(A[col][col]);
    for (let row = col + 1; row < n; row++) {
      const absVal = Math.abs(A[row][col]);
      if (absVal > maxVal) {
        maxVal = absVal;
        maxRow = row;
      }
    }

    if (maxVal < 1e-12) {
      continue;
    }

    if (maxRow !== col) {
      const tmpRow = A[col];
      A[col] = A[maxRow];
      A[maxRow] = tmpRow;
      const tmpB = b[col];
      b[col] = b[maxRow];
      b[maxRow] = tmpB;
    }

    const pivot = A[col][col];
    for (let row = col + 1; row < n; row++) {
      const factor = A[row][col] / pivot;
      if (Math.abs(factor) < 1e-15) continue;
      for (let k = col; k < n; k++) {
        A[row][k] -= factor * A[col][k];
      }
      b[row] -= factor * b[col];
    }
  }

  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = b[i];
    for (let j = i + 1; j < n; j++) {
      sum -= A[i][j] * x[j];
    }
    const diag = A[i][i];
    x[i] = Math.abs(diag) > 1e-12 ? sum / diag : 0;
  }
  return x;
}

/**
 * Devuelve la resistencia efectiva de un componente cuando está cerrado/activo,
 * o null si el componente está abierto (interruptor abierto, bombilla fundida, fusible quemado).
 */
export function getEffectiveResistance(comp: SandboxComponent): number | null {
  if (comp.isBurnedOut || comp.isBlown) return null;

  switch (comp.type) {
    case 'switch':
      return comp.isClosed ? 0.001 : null;
    case 'pushbutton':
      return comp.isPressed ? 0.001 : null;
    case 'fuse':
      return 0.005;
    case 'ammeter':
      return 0.001;
    case 'resistor':
      return Math.max(0.1, comp.resistance ?? 10);
    case 'bulb':
      return Math.max(0.5, comp.resistance ?? 10);
    case 'buzzer':
      return Math.max(1, comp.resistance ?? 25);
    case 'battery':
      // Resistencia interna parásita muy baja para condicionamiento numérico MNA
      return 0.002;
    default:
      return 10;
  }
}

/**
 * Motor Matemático MNA (Modified Nodal Analysis) para topologías arbitrarias de circuitos DC.
 */
export function solveSandboxCircuit(
  components: SandboxComponent[],
  wires: SandboxWire[],
  options?: {
    isRunning?: boolean;
    voltmeter?: VoltmeterProbes;
  }
): NodalSolverResult {
  const isRunning = options?.isRunning ?? true;
  const allTerminals: string[] = [];

  for (const comp of components) {
    allTerminals.push(`${comp.id}:A`, `${comp.id}:B`);
  }

  // Union-Find para agrupar terminales unidos por cables ideales (resistencia 0)
  const parent: Record<string, string> = {};
  for (const t of allTerminals) {
    parent[t] = t;
  }

  const findRoot = (t: string): string => {
    if (!(t in parent)) {
      parent[t] = t;
      return t;
    }
    let root = t;
    while (parent[root] !== root) {
      root = parent[root];
    }
    let curr = t;
    while (curr !== root) {
      const nxt = parent[curr];
      parent[curr] = root;
      curr = nxt;
    }
    return root;
  };

  const unionTerminals = (t1: string, t2: string) => {
    const r1 = findRoot(t1);
    const r2 = findRoot(t2);
    if (r1 !== r2) {
      parent[r2] = r1;
    }
  };

  for (const w of wires) {
    if (w.fromTerminal && w.toTerminal) {
      unionTerminals(w.fromTerminal, w.toTerminal);
    }
  }

  // Construir mapa de Nodos Eléctricos (N0, N1, N2...)
  const rootToNodeId: Record<string, string> = {};
  const nodes: Record<string, ElectricalNode> = {};
  const terminalToNode: Record<string, string> = {};
  let nodeCounter = 0;

  for (const t of allTerminals) {
    const r = findRoot(t);
    if (!rootToNodeId[r]) {
      const nId = `N${nodeCounter++}`;
      rootToNodeId[r] = nId;
      nodes[nId] = { id: nId, voltage: 0, terminals: [] };
    }
    const nId = rootToNodeId[r];
    nodes[nId].terminals.push(t);
    terminalToNode[t] = nId;
  }

  const branches: Record<string, SolvedBranch> = {};
  const wireStates: Record<string, WireCurrentState> = {};

  if (!isRunning || components.length === 0) {
    for (const comp of components) {
      const nA = terminalToNode[`${comp.id}:A`] ?? 'N0';
      const nB = terminalToNode[`${comp.id}:B`] ?? 'N0';
      branches[comp.id] = {
        id: comp.id,
        fromNode: nA,
        toNode: nB,
        component: comp,
        current: 0,
        voltageDrop: 0,
        power: 0,
        brightness: 0,
        isShortPath: false,
        willBurnOut: false,
        willBlowFuse: false,
      };
    }
    for (const w of wires) {
      const nId = terminalToNode[w.fromTerminal] ?? 'N0';
      wireStates[w.id] = {
        wireId: w.id,
        nodeId: nId,
        voltage: 0,
        current: 0,
        isShortPath: false,
      };
    }
    return {
      nodes,
      terminalToNode,
      branches,
      wireStates,
      isShortCircuit: false,
      shortCircuitMessage: null,
      burnedComponentIds: [],
      blownFuseIds: [],
      activeBuzzerIds: [],
      totalSourceCurrent: 0,
      totalPowerDissipated: 0,
      voltmeterReading:
        options?.voltmeter?.enabled &&
        options.voltmeter.redTerminal &&
        options.voltmeter.blackTerminal
          ? 0
          : null,
    };
  }

  // Filtrar componentes activos (cerrados y no fundidos)
  const activeComponents: Array<{
    comp: SandboxComponent;
    nodeA: string;
    nodeB: string;
    resistance: number;
  }> = [];

  for (const comp of components) {
    const nA = terminalToNode[`${comp.id}:A`];
    const nB = terminalToNode[`${comp.id}:B`];
    const rEff = getEffectiveResistance(comp);
    if (nA && nB && rEff !== null) {
      activeComponents.push({ comp, nodeA: nA, nodeB: nB, resistance: rEff });
    }
  }

  // Encontrar subgrafos conexos para fijar un nodo de tierra (0 V) en cada subgrafo con batería
  const adj: Record<string, Set<string>> = {};
  for (const nId of Object.keys(nodes)) {
    adj[nId] = new Set();
  }
  for (const item of activeComponents) {
    if (item.nodeA !== item.nodeB) {
      adj[item.nodeA]?.add(item.nodeB);
      adj[item.nodeB]?.add(item.nodeA);
    }
  }

  const visitedNodes = new Set<string>();
  const groundNodes = new Set<string>();

  for (const startNode of Object.keys(nodes)) {
    if (visitedNodes.has(startNode)) continue;
    const queue = [startNode];
    const compNodes: string[] = [];
    visitedNodes.add(startNode);
    while (queue.length > 0) {
      const curr = queue.shift()!;
      compNodes.push(curr);
      for (const nb of adj[curr] ?? []) {
        if (!visitedNodes.has(nb)) {
          visitedNodes.add(nb);
          queue.push(nb);
        }
      }
    }
    // Preferir como tierra el terminal negativo (A) de la primera batería en este subgrafo
    let chosenGround = compNodes[0];
    for (const item of activeComponents) {
      if (item.comp.type === 'battery' && compNodes.includes(item.nodeA)) {
        chosenGround = item.nodeA;
        break;
      }
    }
    groundNodes.add(chosenGround);
  }

  // Construir matriz nodal de conductancias G * V = I_inj (con modelo Norton de alta precisión para baterías)
  const nonGroundNodeIds = Object.keys(nodes).filter((nId) => !groundNodes.has(nId));
  const nodeIndexMap: Record<string, number> = {};
  nonGroundNodeIds.forEach((nId, idx) => {
    nodeIndexMap[nId] = idx;
  });

  const N = nonGroundNodeIds.length;
  const G = Array.from({ length: N }, () => new Array<number>(N).fill(0));
  const I_vec = new Array<number>(N).fill(0);

  // Regularización mínima de conductancia a tierra (Gmin = 1e-9 S) para evitar subgrafos flotantes singulares
  for (let i = 0; i < N; i++) {
    G[i][i] += 1e-9;
  }

  for (const item of activeComponents) {
    const { comp, nodeA, nodeB, resistance } = item;
    if (nodeA === nodeB) continue;

    const g = 1 / resistance;
    const idxA = nodeIndexMap[nodeA];
    const idxB = nodeIndexMap[nodeB];

    if (idxA !== undefined) G[idxA][idxA] += g;
    if (idxB !== undefined) G[idxB][idxB] += g;
    if (idxA !== undefined && idxB !== undefined) {
      G[idxA][idxB] -= g;
      G[idxB][idxA] -= g;
    }

    if (comp.type === 'battery') {
      // Terminal A es (-) y Terminal B es (+): la fuente impulsa potencial de A hacia B (V_B - V_A = E)
      const emf = Math.max(0.5, Math.min(48, comp.voltage ?? 9));
      const iNorton = emf * g;
      if (idxB !== undefined) I_vec[idxB] += iNorton;
      if (idxA !== undefined) I_vec[idxA] -= iNorton;
    }
  }

  const solvedVoltages = solveLinearSystemGaussian(G, I_vec);
  nonGroundNodeIds.forEach((nId, idx) => {
    nodes[nId].voltage = solvedVoltages[idx] ?? 0;
  });

  // Evaluar ramas, detectar cortocircuitos, fusibles fundidos y sobrecarga térmica
  let isShortCircuit = false;
  let shortCircuitMessage: string | null = null;
  const burnedComponentIds: string[] = [];
  const blownFuseIds: string[] = [];
  const activeBuzzerIds: string[] = [];
  const shortPathBranchIds = new Set<string>();

  let totalSourceCurrent = 0;
  let totalPowerDissipated = 0;

  // Primera pasada: calcular corrientes y detectar si hay un fusible que se funde o un cortocircuito directo
  for (const comp of components) {
    const nA = terminalToNode[`${comp.id}:A`] ?? 'N0';
    const nB = terminalToNode[`${comp.id}:B`] ?? 'N0';
    const vA = nodes[nA]?.voltage ?? 0;
    const vB = nodes[nB]?.voltage ?? 0;
    const rEff = getEffectiveResistance(comp);

    let current = 0;
    let voltageDrop = vA - vB;
    let power = 0;

    if (rEff !== null) {
      if (comp.type === 'battery') {
        const emf = Math.max(0.5, Math.min(48, comp.voltage ?? 9));
        // En una batería donde A es (-) y B es (+), la corriente que sale por B (+) es (emf - (vB - vA)) / rEff
        if (nA === nB) {
          // Terminales A y B unidos directamente con un cable
          current = emf / rEff;
        } else {
          current = (emf - (vB - vA)) / rEff;
        }
        voltageDrop = vB - vA;
        power = Math.abs(emf * current);
      } else {
        // Corriente convencional desde A hacia B: I = (V_A - V_B) / R
        current = nA === nB ? 0 : (vA - vB) / rEff;
        voltageDrop = vA - vB;
        power = current * current * rEff;
      }
    }

    // Limpiar ruido numérico menor a 1e-6 A
    if (Math.abs(current) < 1e-6) {
      current = 0;
      power = 0;
    }

    // Verificar fusible
    const fuseLimit = comp.maxCurrentAmps ?? 2.0;
    const willBlowFuse = comp.type === 'fuse' && !comp.isBlown && Math.abs(current) > fuseLimit;
    if (willBlowFuse) {
      blownFuseIds.push(comp.id);
    }

    // Verificar sobrecarga térmica en bombilla (>15W por defecto)
    const maxWatts = comp.maxWatts ?? 15.0;
    const willBurnOut = comp.type === 'bulb' && !comp.isBurnedOut && power > maxWatts;
    if (willBurnOut) {
      burnedComponentIds.push(comp.id);
    }

    // Verificar cortocircuito en batería (corriente > 60A implica R_ext < ~0.15Ω sin carga real)
    if (comp.type === 'battery' && Math.abs(current) > 60) {
      isShortCircuit = true;
      shortPathBranchIds.add(comp.id);
    }

    const brightness =
      comp.type === 'bulb' && !comp.isBurnedOut && !willBurnOut
        ? Math.min(1.5, Math.max(0, power / maxWatts))
        : 0;

    if (comp.type === 'buzzer' && Math.abs(current) >= 0.02 && !isShortCircuit) {
      activeBuzzerIds.push(comp.id);
    }

    if (comp.type === 'battery' && current > 0) {
      totalSourceCurrent += current;
    } else if (comp.type !== 'battery') {
      totalPowerDissipated += power;
    }

    branches[comp.id] = {
      id: comp.id,
      fromNode: nA,
      toNode: nB,
      component: comp,
      current,
      voltageDrop,
      power,
      brightness,
      isShortPath: false,
      willBurnOut,
      willBlowFuse,
    };
  }

  // Si se detectó cortocircuito franco, marcar las ramas de baja impedancia con corriente extrema y fijar el mensaje requerido
  if (isShortCircuit) {
    shortCircuitMessage = '¡Cortocircuito detectado! La batería se está sobrecalentando';
    for (const b of Object.values(branches)) {
      if (Math.abs(b.current) > 60) {
        b.isShortPath = true;
        shortPathBranchIds.add(b.id);
      }
    }
  }

  // Calcular la corriente que fluye por cada cable (SandboxWire) mediante conservación de corriente en el árbol de cada nodo
  for (const w of wires) {
    const nId = terminalToNode[w.fromTerminal] ?? 'N0';
    const nodeV = nodes[nId]?.voltage ?? 0;

    // Aproximación limpia: obtener la corriente del componente conectado al extremo fromTerminal o toTerminal
    const [fromCompId, fromPin] = w.fromTerminal.split(':');
    const [toCompId, toPin] = w.toTerminal.split(':');
    const branchFrom = branches[fromCompId];
    const branchTo = branches[toCompId];

    let wireCurrent = 0;
    if (branchFrom && Math.abs(branchFrom.current) > 1e-5) {
      // Para una batería, la corriente convencional sale por B y entra por A.
      // Para una carga pasiva, la corriente convencional entra por A (V_A > V_B) y sale por B.
      if (branchFrom.component.type === 'battery') {
        wireCurrent = fromPin === 'B' ? branchFrom.current : -branchFrom.current;
      } else {
        wireCurrent = fromPin === 'B' ? branchFrom.current : -branchFrom.current;
      }
    } else if (branchTo && Math.abs(branchTo.current) > 1e-5) {
      if (branchTo.component.type === 'battery') {
        wireCurrent = toPin === 'A' ? branchTo.current : -branchTo.current;
      } else {
        wireCurrent = toPin === 'A' ? branchTo.current : -branchTo.current;
      }
    }

    const isWireShort =
      isShortCircuit &&
      (shortPathBranchIds.has(fromCompId) || shortPathBranchIds.has(toCompId));

    wireStates[w.id] = {
      wireId: w.id,
      nodeId: nId,
      voltage: nodeV,
      current: wireCurrent,
      isShortPath: isWireShort,
    };
  }

  // Calcular lectura del voltímetro de sondas libres (ΔV = V_roja - V_negra)
  let voltmeterReading: number | null = null;
  if (
    options?.voltmeter?.enabled &&
    options.voltmeter.redTerminal &&
    options.voltmeter.blackTerminal
  ) {
    const redNode = terminalToNode[options.voltmeter.redTerminal];
    const blackNode = terminalToNode[options.voltmeter.blackTerminal];
    if (redNode && blackNode && nodes[redNode] && nodes[blackNode]) {
      voltmeterReading = isShortCircuit
        ? 0
        : Number((nodes[redNode].voltage - nodes[blackNode].voltage).toFixed(3));
    } else {
      voltmeterReading = 0;
    }
  }

  return {
    nodes,
    terminalToNode,
    branches,
    wireStates,
    isShortCircuit,
    shortCircuitMessage,
    burnedComponentIds,
    blownFuseIds,
    activeBuzzerIds,
    totalSourceCurrent,
    totalPowerDissipated,
    voltmeterReading,
  };
}

export type SandboxPresetId =
  | 'simple-bulb'
  | 'voltage-divider'
  | 'wheatstone'
  | 'parallel-fuse';

export function createSandboxPreset(presetId: SandboxPresetId): {
  components: SandboxComponent[];
  wires: SandboxWire[];
  voltmeter: VoltmeterProbes;
} {
  if (presetId === 'voltage-divider') {
    const components: SandboxComponent[] = [
      {
        id: 'bat-1',
        type: 'battery',
        label: 'Batería',
        x: 180,
        y: 260,
        rotation: 270,
        voltage: 12,
      },
      {
        id: 'sw-1',
        type: 'switch',
        label: 'SW1',
        x: 340,
        y: 120,
        rotation: 0,
        isClosed: true,
      },
      {
        id: 'res-1',
        type: 'resistor',
        label: 'R1',
        x: 560,
        y: 120,
        rotation: 0,
        resistance: 100,
      },
      {
        id: 'res-2',
        type: 'resistor',
        label: 'R2',
        x: 700,
        y: 260,
        rotation: 90,
        resistance: 200,
      },
      {
        id: 'amm-1',
        type: 'ammeter',
        label: 'Amperímetro',
        x: 440,
        y: 400,
        rotation: 180,
      },
    ];
    const wires: SandboxWire[] = [
      { id: 'w-1', fromTerminal: 'bat-1:B', toTerminal: 'sw-1:A' },
      { id: 'w-2', fromTerminal: 'sw-1:B', toTerminal: 'res-1:A' },
      { id: 'w-3', fromTerminal: 'res-1:B', toTerminal: 'res-2:A' },
      { id: 'w-4', fromTerminal: 'res-2:B', toTerminal: 'amm-1:A' },
      { id: 'w-5', fromTerminal: 'amm-1:B', toTerminal: 'bat-1:A' },
    ];
    return {
      components,
      wires,
      voltmeter: {
        enabled: true,
        redTerminal: 'res-2:A',
        blackTerminal: 'res-2:B',
      },
    };
  }

  if (presetId === 'wheatstone') {
    const components: SandboxComponent[] = [
      {
        id: 'bat-1',
        type: 'battery',
        label: 'Fuente DC',
        x: 480,
        y: 440,
        rotation: 180,
        voltage: 12,
      },
      {
        id: 'res-1',
        type: 'resistor',
        label: 'R1',
        x: 340,
        y: 100,
        rotation: 0,
        resistance: 100,
      },
      {
        id: 'res-2',
        type: 'resistor',
        label: 'R2',
        x: 620,
        y: 100,
        rotation: 0,
        resistance: 100,
      },
      {
        id: 'res-3',
        type: 'resistor',
        label: 'R3',
        x: 340,
        y: 340,
        rotation: 0,
        resistance: 100,
      },
      {
        id: 'res-4',
        type: 'resistor',
        label: 'R4',
        x: 620,
        y: 340,
        rotation: 0,
        resistance: 100,
      },
      {
        id: 'amm-bridge',
        type: 'ammeter',
        label: 'Galvanómetro',
        x: 480,
        y: 220,
        rotation: 90,
      },
    ];
    const wires: SandboxWire[] = [
      { id: 'w-1', fromTerminal: 'bat-1:B', toTerminal: 'res-3:A' },
      { id: 'w-2', fromTerminal: 'res-3:A', toTerminal: 'res-1:A' },
      { id: 'w-3', fromTerminal: 'res-1:B', toTerminal: 'res-2:A' },
      { id: 'w-4', fromTerminal: 'res-3:B', toTerminal: 'res-4:A' },
      { id: 'w-5', fromTerminal: 'res-1:B', toTerminal: 'amm-bridge:A' },
      { id: 'w-6', fromTerminal: 'amm-bridge:B', toTerminal: 'res-3:B' },
      { id: 'w-7', fromTerminal: 'res-2:B', toTerminal: 'res-4:B' },
      { id: 'w-8', fromTerminal: 'res-4:B', toTerminal: 'bat-1:A' },
    ];
    return {
      components,
      wires,
      voltmeter: {
        enabled: true,
        redTerminal: 'res-1:B',
        blackTerminal: 'res-3:B',
      },
    };
  }

  if (presetId === 'parallel-fuse') {
    const components: SandboxComponent[] = [
      {
        id: 'bat-1',
        type: 'battery',
        label: 'Batería',
        x: 160,
        y: 260,
        rotation: 270,
        voltage: 12,
      },
      {
        id: 'fuse-1',
        type: 'fuse',
        label: 'Fusible',
        x: 320,
        y: 120,
        rotation: 0,
        maxCurrentAmps: 2.0,
        isBlown: false,
      },
      {
        id: 'sw-1',
        type: 'switch',
        label: 'Interruptor',
        x: 520,
        y: 120,
        rotation: 0,
        isClosed: true,
      },
      {
        id: 'bulb-1',
        type: 'bulb',
        label: 'Bombilla',
        x: 460,
        y: 260,
        rotation: 0,
        resistance: 12,
        maxWatts: 15,
      },
      {
        id: 'res-1',
        type: 'resistor',
        label: 'R Carga',
        x: 460,
        y: 400,
        rotation: 0,
        resistance: 24,
      },
      {
        id: 'amm-1',
        type: 'ammeter',
        label: 'I_Total',
        x: 720,
        y: 260,
        rotation: 90,
      },
    ];
    const wires: SandboxWire[] = [
      { id: 'w-1', fromTerminal: 'bat-1:B', toTerminal: 'fuse-1:A' },
      { id: 'w-2', fromTerminal: 'fuse-1:B', toTerminal: 'sw-1:A' },
      { id: 'w-3', fromTerminal: 'sw-1:B', toTerminal: 'bulb-1:A' },
      { id: 'w-4', fromTerminal: 'sw-1:B', toTerminal: 'res-1:A' },
      { id: 'w-5', fromTerminal: 'bulb-1:B', toTerminal: 'amm-1:A' },
      { id: 'w-6', fromTerminal: 'res-1:B', toTerminal: 'amm-1:A' },
      { id: 'w-7', fromTerminal: 'amm-1:B', toTerminal: 'bat-1:A' },
    ];
    return {
      components,
      wires,
      voltmeter: {
        enabled: true,
        redTerminal: 'bulb-1:A',
        blackTerminal: 'bulb-1:B',
      },
    };
  }

  // Por defecto: 'simple-bulb' (Batería 9V + Interruptor + Bombilla 10Ω + Amperímetro en Serie)
  const components: SandboxComponent[] = [
    {
      id: 'bat-1',
      type: 'battery',
      label: 'Batería',
      x: 200,
      y: 260,
      rotation: 270,
      voltage: 9,
    },
    {
      id: 'sw-1',
      type: 'switch',
      label: 'Interruptor',
      x: 440,
      y: 120,
      rotation: 0,
      isClosed: true,
    },
    {
      id: 'bulb-1',
      type: 'bulb',
      label: 'Bombilla',
      x: 680,
      y: 260,
      rotation: 90,
      resistance: 10,
      maxWatts: 15,
    },
    {
      id: 'amm-1',
      type: 'ammeter',
      label: 'Amperímetro',
      x: 440,
      y: 400,
      rotation: 180,
    },
  ];
  const wires: SandboxWire[] = [
    { id: 'w-1', fromTerminal: 'bat-1:B', toTerminal: 'sw-1:A' },
    { id: 'w-2', fromTerminal: 'sw-1:B', toTerminal: 'bulb-1:A' },
    { id: 'w-3', fromTerminal: 'bulb-1:B', toTerminal: 'amm-1:A' },
    { id: 'w-4', fromTerminal: 'amm-1:B', toTerminal: 'bat-1:A' },
  ];
  return {
    components,
    wires,
    voltmeter: {
      enabled: true,
      redTerminal: 'bulb-1:A',
      blackTerminal: 'bulb-1:B',
    },
  };
}
