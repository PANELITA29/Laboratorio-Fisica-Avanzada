import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  RotateCcw,
  Trash2,
  Plus,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Gauge,
  Sliders,
  Award,
  Box,
  BookOpen,
  Power,
  Cpu,
  HelpCircle,
  Eye,
  EyeOff,
  Lightbulb,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import { Language, dictionary } from '../../assets/js/i18n';
import { audioSynth } from '../../assets/js/audio-synth';
import { TelemetryItem } from '../../assets/js/report-generator';
import {
  CircuitComponent,
  ComponentType,
  CircuitTopology,
  BranchFaultState,
  MultimeterMode,
  MAX_RATED_POWER_WATTS,
  FaultDiagnosisMission,
  HiddenFaultType,
  solveCircuit,
  analyzeWorkbenchCircuit,
  buildTopologyComponents3D,
  getResistorColorBands,
  getResistorColorBands5,
  calculateOhmRegressionSlope,
  computeRCAndLEDState,
  evaluateMultimeterMeasurement,
  generateFaultDiagnosisMission,
  validateFaultDiagnosisMission,
  removeResistorKeepCable,
  joinOrSeparateBranchCable,
  restoreBranchResistor,
} from './circuit-engine';
import {
  CIRCUIT_CHALLENGES,
  validateChallenge1,
  validateChallenge2,
  ValidationResult,
} from './circuit-challenges';
import { CircuitWorkbench3D } from './CircuitWorkbench3D';
import { ScrollReveal } from '../../components/QuantumAnimations';
import { TourGuiado, TourStep } from '../../components/TourGuiado';

const CIRCUIT_TOUR_STEPS: TourStep[] = [
  {
    targetSelector: '[data-tour="circuits-components-3d"]',
    badgeEs: '1 · MESA 3D Y COMPONENTES',
    badgeEn: '1 · 3D WORKBENCH & COMPONENTS',
    titleEs: 'Mesa de Componentes 3D y Sondas Interactivas',
    titleEn: '3D Component Workbench & Interactive Probes',
    descriptionEs:
      'Arrastra las resistencias R₁–R₃ para variar sus ohmios, haz clic en los postes N0–N5 para colocar las sondas o une el cable manualmente si retiras un resistor.',
    descriptionEn:
      'Drag resistors R1–R3 to change ohms, click binding posts N0–N5 to place multimeter probes, or manually splice the wire if you remove a resistor.',
  },
  {
    targetSelector: '[data-tour="circuits-multimeter"]',
    badgeEs: '2 · MULTÍMETRO DIGITAL',
    badgeEn: '2 · DIGITAL MULTIMETER',
    titleEs: 'Multímetro Digital LCD (V⎓ / Ω / A⎓) y Kirchhoff',
    titleEn: 'LCD Digital Multimeter (V⎓ / Ω / A⎓) & Kirchhoff',
    descriptionEs:
      'Alterna la perilla entre Voltímetro (paralelo), Óhmetro (con fuente en OFF) y Amperímetro (en serie), y verifica la tabla analítica por rama.',
    descriptionEn:
      'Switch the dial between Voltmeter (parallel), Ohmmeter (Power OFF), and Ammeter (series), and inspect the analytical branch table.',
  },
  {
    targetSelector: '[data-tour="circuits-control-panel"]',
    badgeEs: '3 · PANEL DE CONTROL DC',
    badgeEn: '3 · DC CONTROL PANEL',
    titleEs: 'Banco de Control DC, Bombillas de 15W y Fallas',
    titleEn: 'DC Control Bank, 15W Bulbs & Faults',
    descriptionEs:
      'Regula la fuente (0–48 V), sustituye resistores por bombillas incandescentes (que se funden a >15W), quita resistores dejando el cable listo para unir o simula averías.',
    descriptionEn:
      'Adjust source voltage (0–48 V), swap resistors for 15W incandescent bulbs, remove resistors while keeping the wire ready to splice, or trigger faults.',
  },
  {
    targetSelector: '[data-tour="circuits-graphs"]',
    badgeEs: '4 · GRÁFICAS EN VIVO',
    badgeEn: '4 · LIVE OSCILLOSCOPE GRAPHS',
    titleEs: 'Osciloscopio Multicanal y Gráficas Dinámicas',
    titleEn: 'Multichannel Oscilloscope & Live Graphs',
    descriptionEs:
      'Analiza en tiempo real la recta de la Ley de Ohm (I vs V), la hipérbola I vs R, el reparto de Kirchhoff y la parábola térmica de Joule (P = V²/R).',
    descriptionEn:
      'Analyze in real time the Ohm Law line (I vs V), I vs R hyperbola, Kirchhoff branch distribution, and Joule thermal parabola (P = V²/R).',
  },
];

interface CircuitLabViewProps {
  lang: Language;
  onUpdateTelemetry: (items: TelemetryItem[]) => void;
  completedChallenges: Record<string, boolean>;
  onCompleteChallenge: (id: string, points: number) => void;
  externalResistorSync?: { target: 'R1' | 'R2' | 'R3'; ohms: number; token: number } | null;
}

const NODE_POSITIONS: Record<string, { x: number; y: number; label: string }> = {
  n1: { x: 140, y: 110, label: 'N1 (Superior Izq)' },
  n2: { x: 410, y: 110, label: 'N2 (Superior Centro)' },
  n3: { x: 680, y: 110, label: 'N3 (Superior Der)' },
  n0: { x: 140, y: 350, label: 'N0 (Tierra 0V Izq)' },
  n4: { x: 410, y: 350, label: 'N4 (Inferior Centro)' },
  n5: { x: 680, y: 350, label: 'N5 (Inferior Der)' },
};

interface QuizQuestion {
  id: number;
  category: string;
  questionEs: string;
  optionsEs: string[];
  correctIndex: number;
  explanationEs: string;
}

const QUANTUM_DEFENSE_QUIZ: QuizQuestion[] = [
  {
    id: 1,
    category: 'Ley de Ohm',
    questionEs: 'Si la fuente DC suministra 24 V a una resistencia equivalente de 12 Ω, ¿cuál es la corriente total I_T?',
    optionsEs: ['0.5 A', '2.0 A', '12.0 A', '288 A'],
    correctIndex: 1,
    explanationEs: 'Por la Ley de Ohm: I = V / R_eq = 24 V / 12 Ω = 2.00 A.',
  },
  {
    id: 2,
    category: 'Topología Serie',
    questionEs: 'En un circuito en Serie con R₁ = 10 Ω, R₂ = 20 Ω y R₃ = 30 Ω, ¿cómo es la corriente que atraviesa cada resistencia?',
    optionsEs: [
      'Mayor en R₁ por tener menor resistencia',
      'Idéntica en las tres resistencias (I_T = I₁ = I₂ = I₃)',
      'Nula en R₃',
      'Inversamente proporcional a cada resistencia',
    ],
    correctIndex: 1,
    explanationEs: 'En una malla única en serie no existen bifurcaciones; por conservación de carga (LCK), la misma corriente atraviesa todos los elementos.',
  },
  {
    id: 3,
    category: 'Diagnóstico OPEN',
    questionEs: '¿Qué ocurre en un circuito en Serie si la rama R₂ entra en falla de Circuito Abierto (ABRIR / R → ∞)?',
    optionsEs: [
      'La corriente total cae a 0.00 A y toda la tensión de la fuente cae sobre R₂ abierta',
      'La corriente se duplica en R₁ y R₃',
      'Se produce un cortocircuito en la fuente',
      'R₁ y R₃ siguen disipando potencia normal',
    ],
    correctIndex: 0,
    explanationEs: 'Al abrirse cualquier elemento en serie, se interrumpe la única trayectoria cerrada (I = 0 A) y aparece el 100% de la FEM entre los bornes abiertos.',
  },
  {
    id: 4,
    category: 'Topología Paralelo',
    questionEs: 'Tres resistencias idénticas de 30 Ω se conectan en Paralelo a 12 V. ¿Cuál es la resistencia equivalente R_eq?',
    optionsEs: ['90 Ω', '30 Ω', '10 Ω', '3 Ω'],
    correctIndex: 2,
    explanationEs: 'En paralelo: 1/R_eq = 1/30 + 1/30 + 1/30 = 3/30 ⇒ R_eq = 10 Ω (menor que cualquiera de las ramas individuales).',
  },
  {
    id: 5,
    category: 'Diagnóstico SHORT',
    questionEs: 'En un circuito en Paralelo, si la rama R₁ sufre un Cortocircuito franco (CORTO / R₁ ≈ 0 Ω), ¿qué sucede con R₂ y R₃?',
    optionsEs: [
      'Se queman por sobretensión',
      'Quedan puenteadas (V ≈ 0 V, I₂ = I₃ = 0 A) y toda la corriente de falla pasa por la rama en corto',
      'No sufren ningún cambio en su corriente',
      'Aumentan su resistencia nominal',
    ],
    correctIndex: 1,
    explanationEs: 'El cortocircuito en paralelo impone ΔV ≈ 0 V entre los nodos comunes, desviando el 100% de la corriente por la vía de impedancia nula.',
  },
  {
    id: 6,
    category: 'Topología Mixta',
    questionEs: 'En el circuito Mixto (R₁ = 10 Ω en serie con el paralelo R₂=20 Ω ∥ R₃=20 Ω), ¿cuánto vale R_eq total?',
    optionsEs: ['50 Ω', '30 Ω', '20 Ω', '15 Ω'],
    correctIndex: 2,
    explanationEs: 'El bloque paralelo vale (20×20)/(20+20) = 10 Ω. Sumando R₁ en serie: R_eq = 10 Ω + 10 Ω = 20 Ω.',
  },
  {
    id: 7,
    category: 'Ley de Joule',
    questionEs: 'Si se duplica el voltaje V aplicado a una resistencia fija R, ¿qué ocurre con la potencia térmica disipada P = V² / R?',
    optionsEs: ['Se reduce a la mitad', 'Permanece constante', 'Se duplica (×2)', 'Se cuadruplica (×4)'],
    correctIndex: 3,
    explanationEs: 'Como P = V² / R depende del cuadrado de la tensión, al duplicar V la potencia disipada por efecto Joule se multiplica por 4.',
  },
  {
    id: 8,
    category: 'Kirchhoff LVK',
    questionEs: 'La Segunda Ley de Kirchhoff (LVK: ∑ ΔV = 0 en una malla cerrada) es una consecuencia directa de:',
    optionsEs: [
      'La conservación de la energía y el carácter conservativo del campo electrostático',
      'La conservación de la masa',
      'La Tercera Ley de Kepler',
      'El efecto pelicular en alta frecuencia',
    ],
    correctIndex: 0,
    explanationEs: 'El trabajo neto por unidad de carga al recorrer un camino cerrado en régimen estacionario es cero (Conservación de la Energía).',
  },
  {
    id: 9,
    category: 'Código EIA',
    questionEs: '¿Qué valor óhmico representa una resistencia de 4 bandas con colores Amarillo, Violeta, Marrón y Oro?',
    optionsEs: ['47 Ω ±5%', '470 Ω ±5%', '4.7 kΩ ±5%', '47 kΩ ±1%'],
    correctIndex: 1,
    explanationEs: 'Amarillo (4), Violeta (7), multiplicador Marrón (×10¹) = 470 Ω con tolerancia Oro (±5%).',
  },
  {
    id: 10,
    category: 'Transitorio RC',
    questionEs: 'En un circuito RC en serie, transcurrida una constante de tiempo τ = R·C durante la carga, el condensador alcanza:',
    optionsEs: [
      'El 100% del voltaje de la fuente',
      'El 50.0% del voltaje de la fuente',
      'Aproximadamente el 63.2% del voltaje de la fuente (1 - e⁻¹)',
      '0 V',
    ],
    correctIndex: 2,
    explanationEs: 'Evaluando V_C(τ) = V₀(1 - e⁻¹) ≈ V₀(1 - 0.3679) = 63.21% de V₀.',
  },
];

export function createCircuitPreset(presetName: 'ohm' | 'divider' | 'parallel' | 'blackbox' | 'mixed'): CircuitComponent[] {
  if (presetName === 'divider') {
    return [
      { id: 'bat-1', type: 'battery', label: 'Fuente DC', nodeA: 'n0', nodeB: 'n1', voltage: 20, resistance: 0 },
      { id: 'res-1', type: 'resistor', label: 'R1', nodeA: 'n1', nodeB: 'n2', resistance: 100, faultState: 'ON' },
      { id: 'res-2', type: 'resistor', label: 'R2', nodeA: 'n2', nodeB: 'n3', resistance: 100, faultState: 'ON' },
      { id: 'res-3', type: 'resistor', label: 'R3', nodeA: 'n3', nodeB: 'n5', resistance: 100, faultState: 'ON' },
      { id: 'bulb-1', type: 'bulb', label: 'Bombilla 100Ω', nodeA: 'n5', nodeB: 'n4', resistance: 100, maxPower: 25, isIndicator: false },
      { id: 'sw-1', type: 'switch', label: 'SW Maestro', nodeA: 'n4', nodeB: 'n0', resistance: 0, isClosed: true },
    ];
  }

  if (presetName === 'parallel') {
    return buildTopologyComponents3D({
      topology: 'parallel',
      sourceVoltage: 24,
      r1: 20,
      r2: 30,
      r3: 60,
      f1: 'ON',
      f2: 'ON',
      f3: 'ON',
      isPowered: true,
    });
  }

  if (presetName === 'mixed') {
    return buildTopologyComponents3D({
      topology: 'mixed',
      sourceVoltage: 24,
      r1: 15,
      r2: 30,
      r3: 30,
      f1: 'ON',
      f2: 'ON',
      f3: 'ON',
      isPowered: true,
    });
  }

  if (presetName === 'blackbox') {
    return [
      { id: 'bat-1', type: 'battery', label: 'Fuente Variable', nodeA: 'n0', nodeB: 'n1', voltage: 9.4, resistance: 0 },
      { id: 'sw-1', type: 'switch', label: 'SW1', nodeA: 'n1', nodeB: 'n2', resistance: 0, isClosed: true },
      { id: 'wire-1', type: 'wire', label: 'W1', nodeA: 'n2', nodeB: 'n3', resistance: 0 },
      { id: 'bb-1', type: 'blackbox', label: 'Caja Negra R_x', nodeA: 'n3', nodeB: 'n5', resistance: 470 },
      { id: 'wire-2', type: 'wire', label: 'W2', nodeA: 'n5', nodeB: 'n4', resistance: 0 },
      { id: 'wire-3', type: 'wire', label: 'W3', nodeA: 'n4', nodeB: 'n0', resistance: 0 },
    ];
  }

  return buildTopologyComponents3D({
    topology: 'series',
    sourceVoltage: 24,
    r1: 20,
    r2: 30,
    r3: 50,
    f1: 'ON',
    f2: 'ON',
    f3: 'ON',
    isPowered: true,
  });
}

type CockpitTabId = 'controls' | 'multimeter' | 'diagnosis' | 'oscilloscope';

export const CircuitLabView: React.FC<CircuitLabViewProps> = ({
  lang,
  onUpdateTelemetry,
  completedChallenges,
  onCompleteChallenge,
  externalResistorSync,
}) => {
  const t = dictionary[lang];

  const [activeSubTab, setActiveSubTab] = useState<'sandbox' | 'challenges'>('sandbox');
  const [cockpitTab, setCockpitTab] = useState<CockpitTabId>('controls');
  const [viewDimension, setViewDimension] = useState<'3d' | '2d'>('3d');
  const [components, setComponents] = useState<CircuitComponent[]>(() => createCircuitPreset('ohm'));
  const [selectedId, setSelectedId] = useState<string>('res-1');
  const [flowMode, setFlowMode] = useState<'electrons' | 'conventional'>('electrons');

  // === ESTADO DINÁMICO DEL GRAFO MNA ===
  const [isPowered, setIsPowered] = useState<boolean>(true);
  const [topology, setTopology] = useState<CircuitTopology>('series');
  const [eiaBandMode, setEiaBandMode] = useState<4 | 5>(4);

  // === OBJETIVO A: MULTÍMETRO CON SONDAS INTERACTIVAS Y PERILLA SELECTORA (V / Ω / A) ===
  const [multimeterMode, setMultimeterMode] = useState<MultimeterMode>('V');
  const [isFuseBlown, setIsFuseBlown] = useState<boolean>(false);
  const [probeRedNode, setProbeRedNode] = useState<string>('n1');
  const [probeBlackNode, setProbeBlackNode] = useState<string>('n2');
  const [activeProbeTip, setActiveProbeTip] = useState<'red' | 'black'>('red');
  const [measuredBranches, setMeasuredBranches] = useState<Record<'R1' | 'R2' | 'R3', boolean>>({
    R1: false,
    R2: false,
    R3: false,
  });
  const [revealAllBranches, setRevealAllBranches] = useState<boolean>(true);
  const [activeGraphMode, setActiveGraphMode] = useState<'all' | 'vi' | 'ir' | 'power' | 'rc'>('all');
  const [showBlackBoxModal, setShowBlackBoxModal] = useState<boolean>(false);

  // === OBJETIVO C: MODO DESAFÍO "CAJA NEGRA" (DIAGNÓSTICO DE CIRCUITO AVERIADO - CICLO POE) ===
  const [diagnosisMission, setDiagnosisMission] = useState<FaultDiagnosisMission | null>(null);
  const [poePredictionText, setPoePredictionText] = useState<string>(
    'Al medir con el multímetro en paralelo (V⎓) o con fuente apagada (Ω), identificaré la rama cuya ley de Ohm diverge del valor nominal.'
  );
  const [poeSelectedBranch, setPoeSelectedBranch] = useState<'R1' | 'R2' | 'R3'>('R1');
  const [poeSelectedFault, setPoeSelectedFault] = useState<HiddenFaultType>('OPEN_FILAMENT');
  const [poeSelectedJustification, setPoeSelectedJustification] = useState<number>(0);
  const [poeFeedback, setPoeFeedback] = useState<{
    passed: boolean;
    feedbackTitleEs: string;
    feedbackBodyEs: string;
    poeNextStepEs: string;
  } | null>(null);

  // Modo Transitorio RC + Diodo LED 3D
  const [rcModeActive, setRcModeActive] = useState<boolean>(false);
  const [capacitanceUF] = useState<number>(470);
  const [rcCharging, setRcCharging] = useState<boolean>(true);
  const [rcElapsed, setRcElapsed] = useState<number>(1.2);

  // Zona 4: Evaluación de 10 preguntas
  const [activeQuizIdx, setActiveQuizIdx] = useState<number>(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});

  // Actualizador dinámico e independiente de cualquier componente en el grafo MNA
  const updateComponentById = (compId: string, patch: Partial<CircuitComponent>) => {
    setComponents((prev) =>
      prev.map((c) => (c.id === compId ? { ...c, ...patch, isBurnedOut: false } : c))
    );
  };

  // Valores derivados en tiempo real directamente desde los componentes del banco de trabajo
  const compBat = useMemo(() => components.find((c) => c.type === 'battery'), [components]);
  const compR1 = useMemo(() => components.find((c) => c.id === 'res-1'), [components]);
  const compR2 = useMemo(() => components.find((c) => c.id === 'res-2'), [components]);
  const compR3 = useMemo(() => components.find((c) => c.id === 'res-3'), [components]);

  const sourceVoltage = compBat?.voltage ?? 24;
  const r1 = compR1?.resistance ?? 20;
  const r2 = compR2?.resistance ?? 30;
  const r3 = compR3?.resistance ?? 50;
  const f1: BranchFaultState = compR1?.faultState ?? 'ON';
  const f2: BranchFaultState = compR2?.faultState ?? 'ON';
  const f3: BranchFaultState = compR3?.faultState ?? 'ON';
  const typeR1: 'bulb' | 'resistor' | 'wire' =
    compR1?.type === 'bulb' ? 'bulb' : compR1?.type === 'wire' ? 'wire' : 'resistor';
  const typeR2: 'bulb' | 'resistor' | 'wire' =
    compR2?.type === 'bulb' ? 'bulb' : compR2?.type === 'wire' ? 'wire' : 'resistor';
  const typeR3: 'bulb' | 'resistor' | 'wire' =
    compR3?.type === 'bulb' ? 'bulb' : compR3?.type === 'wire' ? 'wire' : 'resistor';

  const setR1 = (ohms: number) => updateComponentById('res-1', { resistance: ohms });
  const setR2 = (ohms: number) => updateComponentById('res-2', { resistance: ohms });
  const setR3 = (ohms: number) => updateComponentById('res-3', { resistance: ohms });
  const setF1 = (fault: BranchFaultState) => updateComponentById('res-1', { faultState: fault });
  const setF2 = (fault: BranchFaultState) => updateComponentById('res-2', { faultState: fault });
  const setF3 = (fault: BranchFaultState) => updateComponentById('res-3', { faultState: fault });
  const setSourceVoltage = (v: number) => {
    if (compBat) updateComponentById(compBat.id, { voltage: v });
  };

  // Eliminar el resistor dejando el cable de corriente en la rama para que el usuario pueda unirlo manualmente
  const handleRemoveBranchResistor = (compId: string) => {
    audioSynth.playSwitchClick(false);
    setComponents((prev) => removeResistorKeepCable(prev, compId));
  };

  // Unir o separar manualmente las dos puntas del cable de corriente donde estaba el resistor
  const handleToggleJoinBranchCable = (compId: string) => {
    const target = components.find((c) => c.id === compId);
    const willJoin = target?.faultState === 'OPEN';
    audioSynth.playSwitchClick(willJoin);
    setComponents((prev) => joinOrSeparateBranchCable(prev, compId));
  };

  // Volver a instalar el resistor en el cable de la rama
  const handleRestoreBranchResistor = (compId: string, defaultOhms = 20) => {
    audioSynth.playSwitchClick(true);
    setComponents((prev) => restoreBranchResistor(prev, compId, defaultOhms));
  };

  // Alternar entre Resistencia Cerámica y Bombilla Incandescente (Objetivo B: máx 15.0W)
  const toggleBranchBulbType = (branchId: 'R1' | 'R2' | 'R3') => {
    const compId = branchId === 'R1' ? 'res-1' : branchId === 'R2' ? 'res-2' : 'res-3';
    const currentComp = components.find((c) => c.id === compId);
    if (!currentComp) return;
    const nextType: ComponentType = currentComp.type === 'bulb' ? 'resistor' : 'bulb';
    updateComponentById(compId, {
      type: nextType,
      label: nextType === 'bulb' ? `Bombilla ${branchId}` : branchId,
      resistance: currentComp.resistance > 0 ? currentComp.resistance : 20,
      maxPower: nextType === 'bulb' ? MAX_RATED_POWER_WATTS : undefined,
      faultState: 'ON',
    });
  };

  // Sincronización desde la Calculadora EIA de Código de Colores
  useEffect(() => {
    if (!externalResistorSync) return;
    const clamped = Math.max(1, Math.min(1000, Math.round(externalResistorSync.ohms)));
    if (externalResistorSync.target === 'R1') setR1(clamped);
    if (externalResistorSync.target === 'R2') setR2(clamped);
    if (externalResistorSync.target === 'R3') setR3(clamped);
  }, [externalResistorSync]);

  const [recordedPoints, setRecordedPoints] = useState<Array<{ current: number; voltage: number }>>([
    { current: 0.08, voltage: 8.0 },
    { current: 0.16, voltage: 16.0 },
    { current: 0.24, voltage: 24.0 },
  ]);

  const [newCompType] = useState<ComponentType>('resistor');
  const [newNodeA] = useState<string>('n2');
  const [newNodeB] = useState<string>('n4');

  const [blackBoxGuess, setBlackBoxGuess] = useState<string>('470');
  const [validationFeedback, setValidationFeedback] = useState<Record<string, ValidationResult>>({});

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<number>(0);
  const prevBurnoutCountRef = useRef<number>(0);

  // Solucionador MNA Unificado y Dinámico sobre el grafo real de `components`
  const solution = useMemo(
    () => solveCircuit(components, { isPowered }),
    [components, isPowered]
  );

  const topologyResult = useMemo(
    () => analyzeWorkbenchCircuit(components, isPowered, topology),
    [components, isPowered, topology]
  );

  // Evaluación realista del Multímetro (Voltímetro V⎓, Óhmetro Ω con fuente apagada, Amperímetro A⎓ con fusible)
  const multimeterReading = useMemo(
    () =>
      evaluateMultimeterMeasurement({
        mode: multimeterMode,
        probeRedNode,
        probeBlackNode,
        components,
        solution,
        topologyResult,
        isPowered,
        isFuseBlown,
      }),
    [
      multimeterMode,
      probeRedNode,
      probeBlackNode,
      components,
      solution,
      topologyResult,
      isPowered,
      isFuseBlown,
    ]
  );

  // Disparo automático del fusible si el alumno conecta el Amperímetro en paralelo directo con la fuente activa
  useEffect(() => {
    if (multimeterReading.triggersFuseBlow && !isFuseBlown) {
      setIsFuseBlown(true);
      audioSynth.playShortCircuitAlarm();
    }
  }, [multimeterReading.triggersFuseBlow, isFuseBlown]);

  // Desbloqueo automático de la fila de la tabla cuando el alumno mide los bornes de una rama con las sondas
  useEffect(() => {
    if (isFuseBlown) return;
    if (multimeterMode === 'OHM' && isPowered) return;
    const branchMap: Array<{ id: 'R1' | 'R2' | 'R3'; comp: CircuitComponent | undefined }> = [
      { id: 'R1', comp: compR1 },
      { id: 'R2', comp: compR2 },
      { id: 'R3', comp: compR3 },
    ];
    branchMap.forEach(({ id, comp }) => {
      if (!comp) return;
      const matches =
        (probeRedNode === comp.nodeA && probeBlackNode === comp.nodeB) ||
        (probeRedNode === comp.nodeB && probeBlackNode === comp.nodeA);
      if (matches) {
        setMeasuredBranches((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
      }
    });
  }, [probeRedNode, probeBlackNode, multimeterMode, isPowered, isFuseBlown, compR1, compR2, compR3]);

  const rcState = useMemo(
    () =>
      computeRCAndLEDState({
        sourceVoltage: isPowered && !solution.isShortCircuitFault ? sourceVoltage : 0,
        seriesResistanceOhms: Math.max(10, r1 * 10),
        capacitanceMicroFarads: capacitanceUF,
        elapsedSeconds: rcElapsed,
        isCharging: rcCharging,
      }),
    [isPowered, solution.isShortCircuitFault, sourceVoltage, r1, capacitanceUF, rcElapsed, rcCharging]
  );

  const selectedComponent = useMemo(
    () => components.find((c) => c.id === selectedId) || components[0] || null,
    [components, selectedId]
  );

  const multimeterVoltage = useMemo(() => {
    if (!isPowered || solution.isShortCircuitFault) return 0;
    const vRed = solution.nodeVoltages[probeRedNode] ?? 0;
    const vBlack = solution.nodeVoltages[probeBlackNode] ?? 0;
    return vRed - vBlack;
  }, [solution, probeRedNode, probeBlackNode, isPowered]);

  const regression = useMemo(
    () => calculateOhmRegressionSlope(recordedPoints),
    [recordedPoints]
  );

  // Reconfigura el cableado entre nodos cuando el usuario cambia de Topología (Serie / Paralelo / Mixto)
  const applyTopologyRewiring = (nextTop: CircuitTopology) => {
    setTopology(nextTop);
    setDiagnosisMission(null);
    setPoeFeedback(null);
    setRevealAllBranches(true);
    setComponents((prev) => {
      const prevSw = prev.find((c) => c.id === 'sw-1');
      const built = buildTopologyComponents3D({
        topology: nextTop,
        sourceVoltage,
        r1,
        r2,
        r3,
        f1,
        f2,
        f3,
        isPowered: prevSw ? prevSw.isClosed !== false : isPowered,
        branchTypes: {
          R1: typeR1,
          R2: typeR2,
          R3: typeR3,
        },
      });
      return built;
    });
  };

  // Iniciar una nueva misión de Diagnóstico "Caja Negra" (Objetivo C)
  const handleStartDiagnosisMission = (customTopology?: CircuitTopology) => {
    const targetTop = customTopology ?? topology;
    const mission = generateFaultDiagnosisMission(targetTop);
    setTopology(mission.topology);
    setDiagnosisMission(mission);
    setShowBlackBoxModal(true);
    setPoeFeedback(null);
    setIsPowered(true);
    setRevealAllBranches(false);
    setMeasuredBranches({ R1: false, R2: false, R3: false });
    setCockpitTab('diagnosis');

    const fMap: Record<'R1' | 'R2' | 'R3', BranchFaultState> = {
      R1: 'ON',
      R2: 'ON',
      R3: 'ON',
    };
    const rMap: Record<'R1' | 'R2' | 'R3', number> = {
      R1: mission.nominalOhms.R1,
      R2: mission.nominalOhms.R2,
      R3: mission.nominalOhms.R3,
    };

    if (mission.faultType === 'OPEN_FILAMENT') {
      fMap[mission.faultyBranchId] = 'OPEN';
    } else if (mission.faultType === 'SHORT_BYPASS') {
      fMap[mission.faultyBranchId] = 'SHORT';
    } else if (mission.faultType === 'ALTERED_HIGH_RESISTANCE') {
      rMap[mission.faultyBranchId] = mission.alteredOhms ?? mission.nominalOhms[mission.faultyBranchId] * 4;
    }

    setComponents(
      buildTopologyComponents3D({
        topology: mission.topology,
        sourceVoltage: mission.sourceVoltage,
        r1: rMap.R1,
        r2: rMap.R2,
        r3: rMap.R3,
        f1: fMap.R1,
        f2: fMap.R2,
        f3: fMap.R3,
        isPowered: true,
      })
    );
  };

  // Validar y reparar la misión de Caja Negra (Ciclo POE)
  const handleValidateAndRepairDiagnosis = () => {
    if (!diagnosisMission) return;
    const result = validateFaultDiagnosisMission({
      mission: diagnosisMission,
      selectedBranchId: poeSelectedBranch,
      selectedFaultType: poeSelectedFault,
      selectedJustificationIndex: poeSelectedJustification,
    });
    setPoeFeedback(result);
    if (result.passed) {
      audioSynth.playSuccessChime();
      onCompleteChallenge('elec-poe-diagnosis', 350);
      // Reparar automáticamente el circuito a sus valores nominales sanos
      setComponents(
        buildTopologyComponents3D({
          topology: diagnosisMission.topology,
          sourceVoltage: diagnosisMission.sourceVoltage,
          r1: diagnosisMission.nominalOhms.R1,
          r2: diagnosisMission.nominalOhms.R2,
          r3: diagnosisMission.nominalOhms.R3,
          f1: 'ON',
          f2: 'ON',
          f3: 'ON',
          isPowered: true,
        })
      );
      setRevealAllBranches(true);
    }
  };

  // Colocar la sonda activa al hacer clic en un nodo 3D o 2D
  const handlePlaceActiveProbeOnNode = (nodeId: string) => {
    if (activeProbeTip === 'red') {
      setProbeRedNode(nodeId);
      setActiveProbeTip('black');
    } else {
      setProbeBlackNode(nodeId);
      setActiveProbeTip('red');
    }
  };

  // Sincronizar audio procedural
  useEffect(() => {
    audioSynth.updateCircuitHum(isPowered ? topologyResult.totalCurrent : 0);
    if (topologyResult.isShortCircuitFault) {
      audioSynth.playShortCircuitAlarm();
    }
    const burnedCount =
      Object.values(solution.componentStates).filter((s) => s.isBurnedOut).length +
      topologyResult.branches.filter((b) => b.isBurnedOut).length;
    if (burnedCount > prevBurnoutCountRef.current) {
      audioSynth.playBurnoutSound();
    }
    prevBurnoutCountRef.current = burnedCount;

    return () => {
      audioSynth.stopCircuitHum();
    };
  }, [solution, topologyResult, isPowered]);

  // Exportar telemetría en vivo
  useEffect(() => {
    onUpdateTelemetry([
      {
        label: lang === 'es' ? 'Voltaje Fuente DC' : 'DC Source Voltage',
        value: topologyResult.sourceVoltage.toFixed(2),
        unit: 'V',
      },
      {
        label: lang === 'es' ? 'Resistencia Eq (Req)' : 'Eq Resistance (Req)',
        value: Number.isFinite(topologyResult.equivalentResistance)
          ? topologyResult.equivalentResistance.toFixed(2)
          : '∞',
        unit: 'Ω',
      },
      {
        label: lang === 'es' ? 'Corriente Total (I_T)' : 'Total Current (I_T)',
        value: topologyResult.totalCurrent.toFixed(3),
        unit: 'A',
      },
      {
        label: lang === 'es' ? 'Potencia Total (P_T)' : 'Total Power (P_T)',
        value: topologyResult.totalPower.toFixed(2),
        unit: 'W',
      },
    ]);
  }, [topologyResult, lang, onUpdateTelemetry]);

  // Renderizado del Canvas 2D interactivo con Sondas Roja/Negra y Brillo Radial de Bombillas
  useEffect(() => {
    if (viewDimension !== '2d') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;

    const renderFrame = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = '#070B14';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(30, 41, 59, 0.55)';
      ctx.lineWidth = 1;
      const gridStep = 30;
      for (let x = 0; x < width; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      phaseRef.current = (phaseRef.current + 0.016) % 1000;

      const branchMapById: Record<string, (typeof topologyResult.branches)[number] | undefined> = {
        'res-1': topologyResult.branches[0],
        'res-2': topologyResult.branches[1],
        'res-3': topologyResult.branches[2],
      };

      components.forEach((comp) => {
        const posA = NODE_POSITIONS[comp.nodeA];
        const posB = NODE_POSITIONS[comp.nodeB];
        if (!posA || !posB) return;

        const state = solution.componentStates[comp.id];
        const bInfo = branchMapById[comp.id];
        const isSelected = comp.id === selectedComponent?.id;
        const mx = (posA.x + posB.x) / 2;
        const my = (posA.y + posB.y) / 2;

        ctx.strokeStyle = isSelected ? '#22D3EE' : '#475569';
        ctx.lineWidth = isSelected ? 4 : 3;
        ctx.beginPath();
        ctx.moveTo(posA.x, posA.y);
        ctx.lineTo(posB.x, posB.y);
        ctx.stroke();

        const current = isPowered ? (bInfo ? bInfo.current : state?.current ?? 0) : 0;
        const isBurned = state?.isBurnedOut || bInfo?.isBurnedOut || false;
        if (Math.abs(current) > 0.0005 && !isBurned && comp.faultState !== 'OPEN') {
          const dirSign =
            flowMode === 'electrons' ? (current > 0 ? -1 : 1) : current > 0 ? 1 : -1;
          const speed = Math.min(3.5, Math.max(0.35, Math.abs(current) * 8));
          const numParticles = 6;

          for (let i = 0; i < numParticles; i++) {
            let tFrac = ((i / numParticles) + phaseRef.current * speed * 0.25 * dirSign) % 1;
            if (tFrac < 0) tFrac += 1;

            const px = posA.x + (posB.x - posA.x) * tFrac;
            const py = posA.y + (posB.y - posA.y) * tFrac;

            ctx.save();
            ctx.fillStyle = flowMode === 'electrons' ? '#38BDF8' : '#F43F5E';
            ctx.beginPath();
            ctx.arc(px, py, 4.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }

        ctx.save();
        ctx.translate(mx, my);

        if (comp.type === 'battery') {
          ctx.fillStyle = '#0F172A';
          ctx.strokeStyle = isSelected ? '#22D3EE' : '#94A3B8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(-28, -42, 56, 84, 8);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#F59E0B';
          ctx.fillRect(-26, -40, 52, 24);

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 11px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${(comp.voltage ?? 10).toFixed(1)}V`, 0, 8);
        } else if (comp.type === 'resistor') {
          const masked = !!diagnosisMission;
          ctx.fillStyle = masked ? '#3B0764' : '#FEF3C7';
          ctx.strokeStyle = isSelected ? '#22D3EE' : '#D97706';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(-42, -16, 84, 32, 8);
          ctx.fill();
          ctx.stroke();

          if (!masked) {
            const bands = getResistorColorBands(comp.resistance);
            const bandOffsets = [-24, -10, 4, 22];
            bands.forEach((b, idx) => {
              ctx.fillStyle = b.hex;
              ctx.fillRect(bandOffsets[idx], -15, 7, 30);
            });
          }

          ctx.fillStyle = '#E2E8F0';
          ctx.font = 'bold 11px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(
            masked ? `${comp.label} (??? Ω)` : `${comp.label}: ${comp.resistance} Ω`,
            0,
            -24
          );
        } else if (comp.type === 'bulb') {
          const powerW = bInfo ? bInfo.power : state?.power ?? 0;
          const brightness = isPowered && !isBurned ? Math.min(1, powerW / MAX_RATED_POWER_WATTS) : 0;

          // Halo radial térmico proporcional a P = I² * R
          if (brightness > 0.02 && !isBurned) {
            const radius = 26 + brightness * 38;
            const grad = ctx.createRadialGradient(0, 0, 6, 0, 0, radius);
            grad.addColorStop(0, `rgba(254, 240, 138, ${0.85 * brightness})`);
            grad.addColorStop(0.5, `rgba(250, 204, 21, ${0.45 * brightness})`);
            grad.addColorStop(1, 'rgba(250, 204, 21, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.fillStyle = isBurned ? '#1E293B' : brightness > 0.05 ? '#FEF08A' : '#0F172A';
          ctx.strokeStyle = isBurned ? '#EF4444' : isSelected ? '#22D3EE' : '#FACC15';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, 22, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = isBurned ? '#FCA5A5' : '#E2E8F0';
          ctx.font = 'bold 10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(
            isBurned ? `${comp.label} [FUNDIDA]` : `💡 ${comp.label} (${powerW.toFixed(1)}W)`,
            0,
            -28
          );
        } else if (comp.type === 'wire' && comp.id.startsWith('res-')) {
          const isCableOpen = comp.faultState === 'OPEN';
          if (isCableOpen) {
            // Borrar el tramo central para mostrar las dos puntas del cable separadas
            ctx.fillStyle = '#070B14';
            ctx.fillRect(-26, -14, 52, 28);
            ctx.strokeStyle = '#F59E0B';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 3]);
            ctx.strokeRect(-26, -12, 52, 24);
            ctx.setLineDash([]);
            ctx.fillStyle = '#F97316';
            ctx.beginPath();
            ctx.arc(-16, 0, 5, 0, Math.PI * 2);
            ctx.arc(16, 0, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FDE047';
            ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('✂️ CABLE SUELTO (CLIC P/ UNIR)', 0, -18);
          } else {
            ctx.fillStyle = '#059669';
            ctx.strokeStyle = '#34D399';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(-22, -9, 44, 18, 6);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#A7F3D0';
            ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('🔗 CABLE UNIDO (0 Ω)', 0, -15);
          }
        }

        ctx.restore();
      });

      // Dibujar Nodos clickeables y Sondas Roja (V+) / Negra (COM)
      Object.entries(NODE_POSITIONS).forEach(([nodeId, pos]) => {
        const isRedHere = probeRedNode === nodeId;
        const isBlackHere = probeBlackNode === nodeId;

        ctx.save();
        ctx.fillStyle = isRedHere ? '#EF4444' : isBlackHere ? '#0284C7' : '#0F172A';
        ctx.strokeStyle = isRedHere ? '#FCA5A5' : isBlackHere ? '#7DD3FC' : '#22D3EE';
        ctx.lineWidth = isRedHere || isBlackHere ? 3.5 : 2.5;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#E2E8F0';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(nodeId.toUpperCase(), pos.x, pos.y + 25);

        if (isRedHere) {
          ctx.fillStyle = '#EF4444';
          ctx.fillRect(pos.x - 26, pos.y - 38, 52, 18);
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.fillText('SONDA V+', pos.x, pos.y - 26);
        }
        if (isBlackHere) {
          ctx.fillStyle = '#0284C7';
          ctx.fillRect(pos.x - 28, pos.y + 30, 56, 18);
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.fillText('SONDA COM', pos.x, pos.y + 42);
        }
        ctx.restore();
      });

      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animId);
  }, [
    viewDimension,
    components,
    solution,
    topologyResult,
    selectedComponent,
    flowMode,
    isPowered,
    probeRedNode,
    probeBlackNode,
    diagnosisMission,
  ]);

  // Clic en el Canvas 2D para posicionar las Sondas Roja (V+) o Negra (COM) sobre los nodos
  const handleCanvas2DClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    for (const [nodeId, pos] of Object.entries(NODE_POSITIONS)) {
      const dist = Math.hypot(clickX - pos.x, clickY - pos.y);
      if (dist <= 26) {
        handlePlaceActiveProbeOnNode(nodeId);
        return;
      }
    }

    // Permitir unir o separar el cable haciendo clic directamente sobre el punto medio en el Esquemático 2D
    for (const comp of components) {
      if (comp.type === 'wire' && comp.id.startsWith('res-')) {
        const posA = NODE_POSITIONS[comp.nodeA];
        const posB = NODE_POSITIONS[comp.nodeB];
        if (!posA || !posB) continue;
        const mx = (posA.x + posB.x) / 2;
        const my = (posA.y + posB.y) / 2;
        if (Math.hypot(clickX - mx, clickY - my) <= 34) {
          handleToggleJoinBranchCable(comp.id);
          return;
        }
      }
    }
  };

  const updateSelectedComponent = (patch: Partial<CircuitComponent>) => {
    if (!selectedComponent) return;
    setComponents((prev) =>
      prev.map((c) => (c.id === selectedComponent.id ? { ...c, ...patch, isBurnedOut: false } : c))
    );
  };

  const handleAddComponent = () => {
    if (newNodeA === newNodeB) return;
    const id = `${newCompType}-${Date.now().toString().slice(-4)}`;
    const newComp: CircuitComponent = {
      id,
      type: newCompType,
      label: `${newCompType.toUpperCase()}`,
      nodeA: newNodeA,
      nodeB: newNodeB,
      voltage: newCompType === 'battery' ? 12 : undefined,
      resistance:
        newCompType === 'resistor'
          ? 220
          : newCompType === 'bulb'
          ? 100
          : newCompType === 'blackbox'
          ? 470
          : 0,
      maxPower: newCompType === 'bulb' ? MAX_RATED_POWER_WATTS : undefined,
      isClosed: newCompType === 'switch' ? true : undefined,
    };

    setComponents((prev) => [...prev, newComp]);
    setSelectedId(id);
  };

  const handleRecordPoint = () => {
    const v = Math.abs(multimeterVoltage) > 0.01 ? Math.abs(multimeterVoltage) : topologyResult.sourceVoltage;
    const i = topologyResult.totalCurrent;
    setRecordedPoints((prev) => [
      ...prev,
      { current: Number(i.toFixed(4)), voltage: Number(v.toFixed(2)) },
    ]);
  };

  const handleValidateChallenge = (challengeId: string) => {
    if (challengeId === 'elec-1') {
      const res = validateChallenge1(components, solution);
      setValidationFeedback((prev) => ({ ...prev, [challengeId]: res }));
      if (res.passed) {
        audioSynth.playSuccessChime();
        onCompleteChallenge('elec-1', 250);
      }
    } else if (challengeId === 'elec-2') {
      const res = validateChallenge2(components, recordedPoints.length, parseFloat(blackBoxGuess));
      setValidationFeedback((prev) => ({ ...prev, [challengeId]: res }));
      if (res.passed) {
        audioSynth.playSuccessChime();
        onCompleteChallenge('elec-2', 300);
      }
    }
  };

  const loadPreset = (preset: 'ohm' | 'divider' | 'parallel' | 'blackbox' | 'mixed') => {
    const next = createCircuitPreset(preset);
    setDiagnosisMission(null);
    setShowBlackBoxModal(false);
    setPoeFeedback(null);
    setRevealAllBranches(true);
    setComponents(next);
    setSelectedId(next[1]?.id || next[0]?.id || '');
    if (preset === 'parallel') setTopology('parallel');
    else if (preset === 'mixed') setTopology('mixed');
    else setTopology('series');
  };

  const hasBurnedBulb =
    Object.values(solution.componentStates).some((s) => s.isBurnedOut) ||
    topologyResult.branches.some((b) => b.isBurnedOut);
  const currentQuestion = QUANTUM_DEFENSE_QUIZ[activeQuizIdx];
  const quizCorrectCount = Object.entries(quizAnswers).filter(
    ([qIdx, ans]) => QUANTUM_DEFENSE_QUIZ[Number(qIdx)]?.correctIndex === ans
  ).length;
  const [quizSimNotice, setQuizSimNotice] = useState<string | null>(null);

  // Coloca automáticamente las sondas Roja (V+) y Negra (COM) en los extremos de un componente
  const handleQuickProbeComponent = (targetId: string) => {
    const comp = components.find((c) => c.id === targetId);
    if (!comp) return;
    setProbeRedNode(comp.nodeA);
    setProbeBlackNode(comp.nodeB);
    setSelectedId(comp.id);
  };

  // Configura automáticamente la mesa 3D con los datos exactos de la pregunta del cuestionario
  const handleSimulateQuizQuestion = (questionId: number) => {
    setDiagnosisMission(null);
    setShowBlackBoxModal(false);
    setRevealAllBranches(true);
    setIsPowered(true);
    if (questionId === 1) {
      setComponents(
        buildTopologyComponents3D({
          topology: 'series',
          sourceVoltage: 24,
          r1: 4,
          r2: 4,
          r3: 4,
          f1: 'ON',
          f2: 'ON',
          f3: 'ON',
          isPowered: true,
        })
      );
      setTopology('series');
      setQuizSimNotice('Simulando Pregunta 1 en Mesa 3D: Fuente = 24 V y R_eq = 4 + 4 + 4 = 12 Ω → I_T = 2.000 A.');
    } else if (questionId === 2) {
      setComponents(
        buildTopologyComponents3D({
          topology: 'series',
          sourceVoltage: 24,
          r1: 10,
          r2: 20,
          r3: 30,
          f1: 'ON',
          f2: 'ON',
          f3: 'ON',
          isPowered: true,
        })
      );
      setTopology('series');
      setQuizSimNotice('Simulando Pregunta 2 en Mesa 3D: Circuito Serie con R₁=10Ω, R₂=20Ω, R₃=30Ω. ¡Observa en la tabla y gráficas que I_k es idéntica!');
    } else if (questionId === 3) {
      setComponents(
        buildTopologyComponents3D({
          topology: 'series',
          sourceVoltage: 24,
          r1: 10,
          r2: 20,
          r3: 30,
          f1: 'ON',
          f2: 'OPEN',
          f3: 'ON',
          isPowered: true,
        })
      );
      setTopology('series');
      setQuizSimNotice('Simulando Pregunta 3 en Mesa 3D: R₂ abierta (ABRIR) en Serie. La corriente cae a 0.000 A y los 24 V aparecen en R₂.');
    } else if (questionId === 4) {
      setComponents(
        buildTopologyComponents3D({
          topology: 'parallel',
          sourceVoltage: 12,
          r1: 30,
          r2: 30,
          r3: 30,
          f1: 'ON',
          f2: 'ON',
          f3: 'ON',
          isPowered: true,
        })
      );
      setTopology('parallel');
      setQuizSimNotice('Simulando Pregunta 4 en Mesa 3D: Tres resistencias de 30 Ω en Paralelo a 12 V → R_eq = 10.00 Ω.');
    } else if (questionId === 5) {
      setComponents(
        buildTopologyComponents3D({
          topology: 'parallel',
          sourceVoltage: 12,
          r1: 30,
          r2: 30,
          r3: 30,
          f1: 'SHORT',
          f2: 'ON',
          f3: 'ON',
          isPowered: true,
        })
      );
      setTopology('parallel');
      setQuizSimNotice('Simulando Pregunta 5 en Mesa 3D: Cortocircuito franco en R₁ en Paralelo → R₂ y R₃ quedan con 0 V y se activa la protección OCP.');
    } else if (questionId === 6) {
      setComponents(
        buildTopologyComponents3D({
          topology: 'mixed',
          sourceVoltage: 20,
          r1: 10,
          r2: 20,
          r3: 20,
          f1: 'ON',
          f2: 'ON',
          f3: 'ON',
          isPowered: true,
        })
      );
      setTopology('mixed');
      setQuizSimNotice('Simulando Pregunta 6 en Mesa 3D: Circuito Mixto con R₁=10Ω + (R₂=20Ω ∥ R₃=20Ω) → R_eq = 10 + 10 = 20.00 Ω.');
    } else if (questionId === 7) {
      setComponents(
        buildTopologyComponents3D({
          topology: 'series',
          sourceVoltage: 20,
          r1: 10,
          r2: 10,
          r3: 20,
          f1: 'ON',
          f2: 'ON',
          f3: 'ON',
          isPowered: true,
        })
      );
      setTopology('series');
      setQuizSimNotice('Simulando Pregunta 7: Prueba subir el Voltaje de 10 V a 20 V en el slider y observa cómo la Potencia P_T se multiplica por 4 en las gráficas.');
    } else if (questionId === 9) {
      setEiaBandMode(4);
      setR1(470);
      setQuizSimNotice('Simulando Pregunta 9: R₁ ajustada a 470 Ω (Amarillo-Violeta-Marrón-Oro).');
    } else if (questionId === 10) {
      setRcModeActive(true);
      const tau = (Math.max(10, r1 * 10) * capacitanceUF) / 1_000_000;
      setRcCharging(true);
      setRcElapsed(Number(tau.toFixed(2)));
      setQuizSimNotice('Simulando Pregunta 10: Modo RC + LED 3D activado en t = 1τ (63.2% del voltaje de la fuente).');
    } else {
      setQuizSimNotice('Observa en el Multímetro Digital y las gráficas cómo se cumple ∑ ΔV = 0 (Ley de Voltajes de Kirchhoff).');
    }
  };

  return (
    <div className="space-y-6 quantum-hero-enter">
      {/* Cabecera de Cabina de Laboratorio (Cockpit Header) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[#0D1322] border border-slate-800/90">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400">
            CONSOLA DE INGENIERÍA ELÉCTRICA · MNA DINÁMICO, TELEMETRÍA Y GRÁFICAS EN TIEMPO REAL
          </span>
          <h2 className="text-lg sm:text-xl font-bold text-white">{t.circuitTitle}</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Interruptor Maestro FUENTE: ON / OFF */}
          <button
            type="button"
            onClick={() => {
              const next = !isPowered;
              setIsPowered(next);
              audioSynth.playSwitchClick(next);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${
              isPowered
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                : 'bg-rose-500/20 border-rose-500 text-rose-300'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{isPowered ? 'FUENTE: ON' : 'FUENTE: OFF (Medir Ω)'}</span>
          </button>

          {/* Selector de Topologías 3D: Serie / Paralelo / Mixto */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#07090E] border border-slate-800">
            {(
              [
                { id: 'series', label: 'Serie' },
                { id: 'parallel', label: 'Paralelo' },
                { id: 'mixed', label: 'Mixto (R₁+R₂∥R₃)' },
              ] as Array<{ id: CircuitTopology; label: string }>
            ).map((top) => (
              <button
                key={top.id}
                type="button"
                onClick={() => applyTopologyRewiring(top.id)}
                className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors cursor-pointer ${
                  topology === top.id
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {top.label}
              </button>
            ))}
          </div>

          {/* Botón Directo a Misión Caja Negra (Objetivo C) */}
          <button
            type="button"
            onClick={() => {
              if (diagnosisMission && showBlackBoxModal) {
                setShowBlackBoxModal(false);
              } else {
                handleStartDiagnosisMission();
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${
              diagnosisMission
                ? 'bg-purple-500 text-slate-950 border-purple-300'
                : 'bg-purple-950/60 border-purple-500/50 text-purple-200 hover:bg-purple-900/60'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>🕵️ Diagnóstico Caja Negra</span>
          </button>

          {/* Tabs Sandbox / Challenges */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#07090E] border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveSubTab('sandbox')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeSubTab === 'sandbox'
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {t.sandboxTab}
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('challenges')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeSubTab === 'challenges'
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>{t.challengesTab}</span>
            </button>
          </div>

          {/* Componente TourGuiado: Se activa automáticamente al cargar el laboratorio por primera vez */}
          <TourGuiado labId="circuits" lang={lang} steps={CIRCUIT_TOUR_STEPS} />
        </div>
      </div>

      {/* Alerta Didáctica de Fusible del Multímetro Quemado (Objetivo A.3) */}
      {isFuseBlown && (
        <div
          role="alert"
          data-testid="multimeter-fuse-blown-banner"
          className="p-3.5 rounded-xl bg-rose-950/90 border-2 border-rose-500 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-100 shadow-lg"
        >
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <strong className="font-mono uppercase text-rose-300 block">
                ¡Fusible del multímetro quemado! El amperímetro tiene resistencia interna nula y provocó un cortocircuito.
              </strong>
              <span className="text-rose-200/90">
                Nunca conectes el Amperímetro (A⎓) directamente entre los bornes de la fuente activa. Para medir voltaje en paralelo cambia la perilla a V⎓.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsFuseBlown(false);
              setMultimeterMode('V');
            }}
            className="px-3 py-1.5 rounded-lg bg-rose-500 text-slate-950 font-mono font-bold hover:bg-rose-400 transition-colors shrink-0 cursor-pointer"
          >
            🔧 Reemplazar Fusible (10A) y pasar a V⎓
          </button>
        </div>
      )}

      {/* Alerta Térmica de Bombilla Fundida por superar 15.0W (Objetivo B.3) */}
      {hasBurnedBulb && (
        <div
          role="alert"
          data-testid="bulb-burnout-banner"
          className="p-3.5 rounded-xl bg-amber-950/80 border border-amber-500/60 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-100"
        >
          <div className="flex items-center gap-2.5">
            <Flame className="w-5 h-5 text-amber-400 shrink-0" />
            <span>
              <strong>¡Filamento Incandescente Fundido (Falla OPEN por Sobrecalentamiento)!</strong> La potencia disipada $P = I^2 \cdot R$ superó el límite nominal de <strong>{MAX_RATED_POWER_WATTS.toFixed(1)} W</strong>, abriendo automáticamente esa rama.
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              setComponents((prev) =>
                prev.map((c) => ({
                  ...c,
                  isBurnedOut: false,
                  faultState: c.faultState === 'OPEN' ? 'ON' : c.faultState,
                  voltage: c.type === 'battery' ? Math.min(18, c.voltage ?? 18) : c.voltage,
                }))
              )
            }
            className="px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-mono font-bold hover:bg-amber-300 transition-colors shrink-0 cursor-pointer"
          >
            💡 Reemplazar Bombilla Fundida (18V Seguro)
          </button>
        </div>
      )}

      {/* Challenges Panel */}
      {activeSubTab === 'challenges' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CIRCUIT_CHALLENGES.map((ch) => {
            const isDone = !!completedChallenges[ch.id];
            const fb = validationFeedback[ch.id];
            return (
              <div
                key={ch.id}
                className="p-4 rounded-xl bg-[#0D1322] border border-slate-800 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs font-mono">
                    <span className="text-cyan-400">{ch.points} PTS</span>
                    <span className={isDone ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                      {isDone ? `● ${t.challengeCompleted}` : `▲ ${t.challengePending}`}
                    </span>
                  </div>
                  <h3 className="mt-1 text-base font-bold text-white">
                    {lang === 'es' ? ch.titleEs : ch.titleEn}
                  </h3>
                  <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                    {lang === 'es' ? ch.descriptionEs : ch.descriptionEn}
                  </p>
                  <p className="mt-2 p-2 rounded-lg bg-[#07090E] border border-slate-800/80 text-[11px] font-mono text-slate-400">
                    {lang === 'es' ? ch.hintEs : ch.hintEn}
                  </p>

                  {ch.requiresInput && (
                    <div className="mt-2.5">
                      <label
                        htmlFor={`input-${ch.id}`}
                        className="block text-xs font-medium text-slate-300 mb-1"
                      >
                        {lang === 'es' ? ch.inputLabelEs : ch.inputLabelEn}
                      </label>
                      <input
                        id={`input-${ch.id}`}
                        type="number"
                        value={blackBoxGuess}
                        onChange={(e) => setBlackBoxGuess(e.target.value)}
                        className="w-full rounded-lg bg-[#07090E] border border-slate-700 px-3 py-1.5 text-xs font-mono text-white"
                      />
                    </div>
                  )}

                  {fb && (
                    <div
                      className={`mt-2.5 p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                        fb.passed
                          ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                          : 'bg-amber-950/50 border-amber-500/40 text-amber-200'
                      }`}
                    >
                      {fb.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <span>{lang === 'es' ? fb.messageEs : fb.messageEn}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => loadPreset(ch.id === 'elec-1' ? 'divider' : 'blackbox')}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
                  >
                    {t.loadChallengeSetup}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleValidateChallenge(ch.id)}
                    className="flex-1 px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    {t.validateChallenge}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VISUALIZACIÓN DEL CIRCUITO EN 3D / 2D A ANCHO COMPLETO DE PANTALLA (100% FULL WIDTH) */}
      <div
        data-testid="circuit-fullwidth-stage"
        data-tour="circuits-components-3d"
        className="w-full rounded-2xl bg-[#0D1322] border border-slate-800 overflow-hidden shadow-2xl"
      >
            {/* Canvas Top Toolbar */}
            <div className="px-4 py-3 bg-[#090D16] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-400">{t.flowModeLabel}:</span>
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#07090E] border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setFlowMode('electrons')}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                      flowMode === 'electrons'
                        ? 'bg-sky-500 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t.flowElectrons}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlowMode('conventional')}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                      flowMode === 'conventional'
                        ? 'bg-rose-500 text-white font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t.flowConventional}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setEiaBandMode((m) => (m === 4 ? 5 : 4))}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-cyan-300 border border-slate-700 cursor-pointer"
                >
                  EIA: {eiaBandMode} Bandas
                </button>

                <button
                  type="button"
                  onClick={() => setRcModeActive((v) => !v)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-mono border transition-colors cursor-pointer ${
                    rcModeActive
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold'
                      : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  RC + LED 3D
                </button>

                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#07090E] border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setViewDimension('3d')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                      viewDimension === '3d'
                        ? 'bg-cyan-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Box className="w-3.5 h-3.5" />
                    <span>Mesa 3D (WebGL)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewDimension('2d')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                      viewDimension === '2d'
                        ? 'bg-cyan-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Esquemático 2D</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setF1('ON');
                    setF2('ON');
                    setF3('ON');
                    setIsPowered(true);
                    setIsFuseBlown(false);
                    setDiagnosisMission(null);
                    setShowBlackBoxModal(false);
                    setRevealAllBranches(true);
                    setMeasuredBranches({ R1: false, R2: false, R3: false });
                    loadPreset('ohm');
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t.resetSim}</span>
                </button>
              </div>
            </div>

            {/* Interactive 3D WebGL Workbench or 2D Schematic Canvas (Ancho Completo Panorámico) */}
            <div className="relative w-full h-[360px] sm:h-[460px] lg:h-[540px] bg-[#070B14]">
              {viewDimension === '3d' && (
                <div className="hidden sm:flex absolute bottom-2.5 left-2.5 right-2.5 z-10 pointer-events-none flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-[#050811]/90 border border-slate-800/90 text-[11px] font-mono text-slate-300">
                  <span>
                    🎯 <strong className="text-rose-400">Clic en Poste N0..N5:</strong> Coloca Sonda{' '}
                    {activeProbeTip === 'red' ? 'Roja (V+)' : 'Negra (COM)'}
                  </span>
                  <span>
                    🖱️ <strong className="text-cyan-300">Arrastra R₁..R₃:</strong> Cambia Ω o desconecta (ABRIR)
                  </span>
                </div>
              )}
              {viewDimension === '3d' ? (
                <CircuitWorkbench3D
                  components={components}
                  solution={solution}
                  topologyResult={topologyResult}
                  eiaBandMode={eiaBandMode}
                  rcModeActive={rcModeActive}
                  ledBrightness={rcState.ledBrightness}
                  ledBurnedOut={rcState.ledBurnedOut}
                  selectedId={selectedComponent?.id || ''}
                  flowMode={flowMode}
                  probeRedNode={probeRedNode}
                  probeBlackNode={probeBlackNode}
                  activeProbeTip={activeProbeTip}
                  measuredBranches={measuredBranches}
                  revealAllBranches={revealAllBranches}
                  maskNominalValues={!!diagnosisMission}
                  onSelectComponent={(id) => setSelectedId(id)}
                  onSelectNode={(nodeId) => handlePlaceActiveProbeOnNode(nodeId)}
                  onToggleSwitch={(id) => {
                    const sw = components.find((c) => c.id === id);
                    if (sw) {
                      const nextClosed = !sw.isClosed;
                      audioSynth.playSwitchClick(nextClosed);
                      if (id === 'sw-1') {
                        setIsPowered(nextClosed);
                      }
                      setComponents((prev) =>
                        prev.map((c) => (c.id === id ? { ...c, isClosed: nextClosed } : c))
                      );
                    }
                  }}
                  onTogglePowerSupply={() => {
                    const next = !isPowered;
                    setIsPowered(next);
                    audioSynth.playSwitchClick(next);
                  }}
                  onUpdateComponent={(id, patch) => {
                    updateComponentById(id, patch);
                  }}
                />
              ) : (
                <canvas
                  ref={canvasRef}
                  width={820}
                  height={460}
                  onClick={handleCanvas2DClick}
                  data-testid="circuit-canvas"
                  className="w-full h-full object-contain cursor-pointer"
                />
              )}
            </div>

            {/* Barra de Presets Rápidos, Puntas de Sonda y Selección de Componentes */}
            <div className="px-4 py-3 bg-[#090D16] border-t border-slate-800 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-slate-400 mr-1">Presets:</span>
                  <button
                    type="button"
                    onClick={() => loadPreset('divider')}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-cyan-300 cursor-pointer"
                  >
                    {t.presetDivider}
                  </button>
                  <button
                    type="button"
                    onClick={() => loadPreset('parallel')}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-purple-300 cursor-pointer"
                  >
                    {t.presetParallel}
                  </button>
                  <button
                    type="button"
                    onClick={() => loadPreset('mixed')}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-amber-300 cursor-pointer"
                  >
                    Mixto 3D
                  </button>
                  <button
                    type="button"
                    onClick={() => loadPreset('blackbox')}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-emerald-300 cursor-pointer"
                  >
                    {t.presetBlackBox}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-mono text-slate-400">Medir rama con sondas:</span>
                  {[
                    { id: 'bat-1', label: '🔋 Fuente' },
                    { id: 'res-1', label: '📏 R₁' },
                    { id: 'res-2', label: '📏 R₂' },
                    { id: 'res-3', label: '📏 R₃' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleQuickProbeComponent(item.id)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-[11px] font-mono text-cyan-300 border border-slate-700 transition-colors cursor-pointer"
                    >
                      🎯 {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/70">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-mono text-slate-400">Punta activa al tocar poste:</span>
                  <button
                    type="button"
                    onClick={() => setActiveProbeTip('red')}
                    className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold border transition-colors cursor-pointer ${
                      activeProbeTip === 'red'
                        ? 'bg-rose-500 text-white border-rose-300'
                        : 'bg-slate-900 text-rose-300 border-slate-700'
                    }`}
                  >
                    🔴 Sonda Roja V+ ({probeRedNode.toUpperCase()})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveProbeTip('black')}
                    className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold border transition-colors cursor-pointer ${
                      activeProbeTip === 'black'
                        ? 'bg-sky-500 text-slate-950 border-sky-300'
                        : 'bg-slate-900 text-sky-300 border-slate-700'
                    }`}
                  >
                    ⚫ Sonda Negra COM ({probeBlackNode.toUpperCase()})
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {components.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                        c.id === selectedComponent?.id
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

      {/* PANELES DE INSTRUMENTACIÓN, CONTROLES DC, MULTÍMETRO Y GRÁFICAS DEBAJO DE LA MESA 3D */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda Inferior (7 Cols): ZONA 2 (Multímetro Digital LCD, Sondas, LVK/LCK y Tabla por Rama) + ZONA 3 (Gráficas en Vivo) */}
        <div className="lg:col-span-7 space-y-6">
          {/* ZONA 2: MULTÍMETRO DIGITAL LCD, SONDAS (V⎓ / Ω / A⎓), LEYES DE KIRCHHOFF (LVK / LCK) Y TABLA ANALÍTICA POR RAMA */}
          <div
            data-tour="circuits-multimeter"
            className="p-4 sm:p-5 rounded-xl bg-[#0D1322] border border-slate-800 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-cyan-400 shrink-0" />
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white">
                    ZONA 2 · Multímetro Digital LCD, Sondas ({probeRedNode.toUpperCase()} → {probeBlackNode.toUpperCase()}) y Leyes de Kirchhoff
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] font-mono">
                    <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300">
                      ● LVK: ∑ ΔV = 0
                    </span>
                    <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                      ● LCK: ∑ I_ent = ∑ I_sal
                    </span>
                  </div>
                </div>
              </div>

              {/* Perilla Selectora del Multímetro: V⎓ / Ω / A⎓ (Objetivo A.3) */}
              <div
                role="group"
                aria-label="Selector de modo del multímetro"
                className="flex items-center gap-1 p-1 rounded-lg bg-[#050811] border border-slate-800"
              >
                {(
                  [
                    { mode: 'V', label: 'V⎓ (Voltímetro)', color: 'bg-cyan-500 text-slate-950' },
                    { mode: 'OHM', label: 'Ω (Óhmetro)', color: 'bg-amber-400 text-slate-950' },
                    { mode: 'A', label: 'A⎓ (Amperímetro)', color: 'bg-rose-500 text-white' },
                  ] as Array<{ mode: MultimeterMode; label: string; color: string }>
                ).map((m) => (
                  <button
                    key={m.mode}
                    type="button"
                    data-testid={`multimeter-mode-${m.mode}`}
                    onClick={() => setMultimeterMode(m.mode)}
                    className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                      multimeterMode === m.mode
                        ? m.color
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4 Pantallas LCD de Telemetría Principal */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              <div className="p-2.5 sm:p-3 rounded-lg bg-[#050811] border-2 border-cyan-500/50">
                <span className="text-[10px] font-mono text-cyan-300 block uppercase truncate">
                  SONDAS ({multimeterMode === 'V' ? 'V⎓' : multimeterMode === 'OHM' ? 'Ω' : 'A⎓'})
                </span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span
                    data-testid="multimeter-readout"
                    className={`text-lg sm:text-2xl font-mono font-bold tabular-nums ${
                      isFuseBlown || !multimeterReading.isValidConnection
                        ? 'text-rose-400'
                        : 'text-white'
                    }`}
                  >
                    {multimeterMode === 'V' && multimeterReading.isValidConnection && !isFuseBlown
                      ? multimeterVoltage.toFixed(2)
                      : multimeterReading.displayText}
                  </span>
                  <span className="text-xs font-mono text-cyan-400">{multimeterReading.unit}</span>
                </div>
              </div>

              <div className="p-2.5 sm:p-3 rounded-lg bg-[#050811] border border-slate-800">
                <span className="text-[10px] font-mono text-slate-400 block uppercase truncate">
                  RESISTENCIA EQ (R_eq)
                </span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-lg sm:text-2xl font-mono font-bold text-cyan-300 tabular-nums">
                    {diagnosisMission && !revealAllBranches
                      ? '???'
                      : Number.isFinite(topologyResult.equivalentResistance)
                      ? topologyResult.equivalentResistance.toFixed(2)
                      : '∞'}
                  </span>
                  <span className="text-xs font-mono text-slate-400">Ω</span>
                </div>
              </div>

              <div className="p-2.5 sm:p-3 rounded-lg bg-[#050811] border border-slate-800">
                <span className="text-[10px] font-mono text-slate-400 block uppercase truncate">
                  CORRIENTE TOTAL (I_T)
                </span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span
                    data-testid="ammeter-readout"
                    className="text-lg sm:text-2xl font-mono font-bold text-amber-400 tabular-nums"
                  >
                    {topologyResult.totalCurrent.toFixed(3)}
                  </span>
                  <span className="text-xs font-mono text-slate-400">A</span>
                </div>
              </div>

              <div className="p-2.5 sm:p-3 rounded-lg bg-[#050811] border border-slate-800">
                <span className="text-[10px] font-mono text-slate-400 block uppercase truncate">
                  POTENCIA JOULE (P_T)
                </span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-lg sm:text-2xl font-mono font-bold text-emerald-400 tabular-nums">
                    {topologyResult.totalPower.toFixed(2)}
                  </span>
                  <span className="text-xs font-mono text-slate-400">W</span>
                </div>
              </div>
            </div>

            {multimeterReading.warningEs && (
              <div className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-500/50 text-amber-200 text-xs font-mono flex items-center justify-between gap-2">
                <span>⚠️ {multimeterReading.warningEs}</span>
                {multimeterMode === 'OHM' && isPowered && (
                  <button
                    type="button"
                    onClick={() => setIsPowered(false)}
                    className="px-2.5 py-1 rounded bg-amber-400 text-slate-950 font-bold text-[11px] shrink-0 cursor-pointer"
                  >
                    Apagar Fuente (OFF)
                  </button>
                )}
              </div>
            )}

            {/* Banner Diagnóstico Analítico LVK / LCK en Vivo */}
            <div
              className={`p-3 rounded-lg border text-xs font-mono space-y-1 ${
                topologyResult.isShortCircuitFault
                  ? 'bg-rose-950/70 border-rose-500/50 text-rose-200'
                  : !isPowered || topologyResult.isOpenCircuitFault
                  ? 'bg-amber-950/60 border-amber-500/40 text-amber-200'
                  : 'bg-[#070A12] border-slate-800 text-cyan-200'
              }`}
            >
              <div className="font-bold">
                {lang === 'es' ? topologyResult.diagnosticMessageEs : topologyResult.diagnosticMessageEn}
              </div>
              <div className="text-[11px] text-slate-300 flex flex-wrap items-center justify-between gap-2">
                <span>{topologyResult.kvlEquationText}</span>
                <span className="text-cyan-400">{topologyResult.kclEquationText}</span>
              </div>
            </div>

            {/* Selectores de Nodos para Sondas + Modo de Visibilidad de Tabla */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end text-xs">
              <div>
                <label htmlFor="probe-red" className="block text-[11px] text-rose-400 font-mono mb-1">
                  🔴 Sonda 3D Roja (Positivo V+)
                </label>
                <select
                  id="probe-red"
                  value={probeRedNode}
                  onChange={(e) => setProbeRedNode(e.target.value)}
                  className="w-full rounded bg-[#07090E] border border-slate-700 px-2.5 py-1.5 text-xs font-mono text-slate-200"
                >
                  {Object.keys(NODE_POSITIONS).map((n) => (
                    <option key={n} value={n}>
                      Nodo {n.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="probe-black" className="block text-[11px] text-sky-400 font-mono mb-1">
                  ⚫ Sonda 3D Negra (Tierra COM)
                </label>
                <select
                  id="probe-black"
                  value={probeBlackNode}
                  onChange={(e) => setProbeBlackNode(e.target.value)}
                  className="w-full rounded bg-[#07090E] border border-slate-700 px-2.5 py-1.5 text-xs font-mono text-slate-200"
                >
                  {Object.keys(NODE_POSITIONS).map((n) => (
                    <option key={n} value={n}>
                      Nodo {n.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => setRevealAllBranches((v) => !v)}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-cyan-300 border border-slate-700 cursor-pointer h-[34px]"
              >
                {revealAllBranches ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{revealAllBranches ? 'Modo Práctica: Ocultar no medidas' : 'Mostrar todas las ramas'}</span>
              </button>
            </div>

            {/* Tabla Analítica Completa por Rama (R1, R2, R3) */}
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#090D16] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Rama</th>
                    <th className="py-2 px-3">Valor R</th>
                    <th className="py-2 px-3">Caída V_k</th>
                    <th className="py-2 px-3">Corriente I_k</th>
                    <th className="py-2 px-3">Potencia P_k</th>
                    <th className="py-2 px-3">Estado / Sonda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 bg-[#070A12]">
                  {topologyResult.branches.map((b) => {
                    const isRevealed = revealAllBranches || measuredBranches[b.branchId];
                    const compId =
                      b.branchId === 'R1' ? 'res-1' : b.branchId === 'R2' ? 'res-2' : 'res-3';
                    const compObj = components.find((c) => c.id === compId);
                    const isProbedNow =
                      compObj &&
                      ((probeRedNode === compObj.nodeA && probeBlackNode === compObj.nodeB) ||
                        (probeRedNode === compObj.nodeB && probeBlackNode === compObj.nodeA));

                    return (
                      <tr
                        key={b.branchId}
                        className={isProbedNow ? 'bg-cyan-950/30' : undefined}
                      >
                        <td className="py-2 px-3 font-bold text-cyan-300">
                          {b.componentType === 'bulb'
                            ? `💡 ${b.branchId}`
                            : b.componentType === 'wire'
                            ? `🔗 Cable ${b.branchId}`
                            : `📏 ${b.branchId}`}
                          {isProbedNow && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[9px]">
                              SONDA
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-200">
                          {diagnosisMission && !isRevealed
                            ? '??? Ω'
                            : b.componentType === 'wire'
                            ? b.faultState === 'OPEN'
                              ? '∞ (Cable suelto)'
                              : '0 Ω (Unido)'
                            : `${b.nominalOhms} Ω`}
                        </td>
                        <td className="py-2 px-3 text-amber-300">
                          {isRevealed ? `${b.voltageDrop.toFixed(2)} V` : '🔒 Medir'}
                        </td>
                        <td className="py-2 px-3 text-sky-300">
                          {isRevealed ? `${b.current.toFixed(3)} A` : '🔒 Medir'}
                        </td>
                        <td className="py-2 px-3 text-emerald-300">
                          {isRevealed ? `${b.power.toFixed(2)} W` : '🔒 Medir'}
                        </td>
                        <td className="py-2 px-3 flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              b.isBurnedOut
                                ? 'bg-rose-500/30 text-rose-300'
                                : b.componentType === 'wire'
                                ? b.faultState === 'OPEN'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-emerald-500/20 text-emerald-300'
                                : b.faultState === 'ON'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : b.faultState === 'OPEN'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {b.isBurnedOut
                              ? 'FUNDIDA'
                              : b.componentType === 'wire'
                              ? b.faultState === 'OPEN'
                                ? 'CABLE SUELTO'
                                : 'CABLE UNIDO'
                              : b.faultState}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleQuickProbeComponent(compId)}
                            className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 text-[10px] font-bold hover:bg-cyan-500 hover:text-slate-950 transition-colors cursor-pointer"
                          >
                            Medir
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Columna Derecha (5 Cols): ZONA 1 (Banco de Control DC, Bombillas 15W, Fallas, Caja Negra) + ZONA 3 (OSCILOSCOPIO MULTICANAL Y GRÁFICAS DINÁMICAS 60 FPS) */}
        <div className="lg:col-span-5 space-y-5">
          {/* ZONA 1: CONTROLES DC, BOMBILLAS TÉRMICAS (15W) Y SIMULACIÓN DE FALLAS */}
          <div
            data-tour="circuits-control-panel"
            className="p-5 rounded-xl bg-[#0D1322] border border-slate-800 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  ZONA 1 · Banco de Control DC, Bombillas Térmicas (15W) y Fallas
                </h3>
              </div>
              <span className="text-[11px] font-mono text-cyan-400 uppercase">{topology}</span>
            </div>

            {/* Source Voltage Slider (0 - 48 V) */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="quantum-v-slider" className="text-slate-300 font-medium">
                  Voltaje Fuente DC de Sobremesa (0 – 48 V)
                </label>
                <span className="font-mono font-bold text-amber-400 tabular-nums">
                  {sourceVoltage.toFixed(1)} V
                </span>
              </div>
              <input
                id="quantum-v-slider"
                type="range"
                min={0}
                max={48}
                step={0.5}
                value={sourceVoltage}
                onChange={(e) => setSourceVoltage(parseFloat(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            {/* Ramas R1, R2, R3 con Botón de Bombilla Incandescente (Objetivo B) y Modos de Falla */}
            {(
              [
                {
                  id: 'R1' as const,
                  compId: 'res-1',
                  val: r1,
                  setVal: setR1,
                  fault: f1,
                  setFault: setF1,
                  compType: typeR1,
                  branchData: topologyResult.branches[0],
                },
                {
                  id: 'R2' as const,
                  compId: 'res-2',
                  val: r2,
                  setVal: setR2,
                  fault: f2,
                  setFault: setF2,
                  compType: typeR2,
                  branchData: topologyResult.branches[1],
                },
                {
                  id: 'R3' as const,
                  compId: 'res-3',
                  val: r3,
                  setVal: setR3,
                  fault: f3,
                  setFault: setF3,
                  compType: typeR3,
                  branchData: topologyResult.branches[2],
                },
              ]
            ).map((branch) => {
              const powerW = branch.branchData?.power ?? 0;
              const isBurned = branch.branchData?.isBurnedOut ?? false;
              const thermalPct = Math.min(100, (powerW / MAX_RATED_POWER_WATTS) * 100);

              return (
                <div
                  key={branch.id}
                  className="p-3 rounded-lg bg-[#07090E] border border-slate-800/90 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <label
                        htmlFor={`slider-${branch.id}`}
                        className="text-xs font-mono font-bold text-cyan-300"
                      >
                        {branch.compType === 'wire'
                          ? branch.fault === 'OPEN'
                            ? `✂️ Cable ${branch.id} (Sin Resistor · Suelto)`
                            : `🔗 Cable ${branch.id} (Unido Directo · 0 Ω)`
                          : branch.compType === 'bulb'
                          ? `💡 Bombilla ${branch.id}: ${diagnosisMission ? '??? Ω' : `${branch.val} Ω`}`
                          : `Resistencia ${branch.id}: ${diagnosisMission ? '??? Ω' : `${branch.val} Ω`}`}
                      </label>

                      {branch.compType !== 'wire' && (
                        <button
                          type="button"
                          data-testid={`toggle-bulb-${branch.id}`}
                          onClick={() => toggleBranchBulbType(branch.id)}
                          title="Sustituir entre Resistencia Cerámica y Bombilla Incandescente (Máx 15.0W)"
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
                            branch.compType === 'bulb'
                              ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                              : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                          }`}
                        >
                          <Lightbulb className="w-3 h-3" />
                          <span>{branch.compType === 'bulb' ? 'Bombilla 15W' : 'Usar Bombilla'}</span>
                        </button>
                      )}

                      {!diagnosisMission && branch.compType !== 'wire' && (
                        <button
                          type="button"
                          data-testid={`delete-resistor-${branch.id}`}
                          onClick={() => handleRemoveBranchResistor(branch.compId)}
                          title="Quitar el resistor dejando el cable de corriente para poder unirlo manualmente"
                          className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-950/70 hover:bg-rose-600 hover:text-white border border-rose-500/50 text-rose-300 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Quitar R</span>
                        </button>
                      )}
                    </div>

                    {!diagnosisMission && branch.compType !== 'wire' && (
                      <div className="flex items-center gap-1">
                        {(
                          [
                            { state: 'ON', label: 'ON' },
                            { state: 'OPEN', label: 'ABRIR' },
                            { state: 'SHORT', label: 'CORTO' },
                          ] as Array<{ state: BranchFaultState; label: string }>
                        ).map((btn) => (
                          <button
                            key={btn.state}
                            type="button"
                            onClick={() => branch.setFault(btn.state)}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                              branch.fault === btn.state
                                ? btn.state === 'ON'
                                  ? 'bg-emerald-500 text-slate-950'
                                  : btn.state === 'OPEN'
                                  ? 'bg-amber-500 text-slate-950'
                                  : 'bg-rose-500 text-white'
                                : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Si el usuario eliminó el resistor, el cable permanece en el circuito y solo el usuario puede unirlo o reinstalar el resistor */}
                  {branch.compType === 'wire' ? (
                    <div className="p-2.5 rounded-lg bg-[#0B1220] border border-cyan-500/30 space-y-2">
                      <p className="text-[11px] font-mono text-slate-300 leading-relaxed">
                        {branch.fault === 'OPEN'
                          ? '🔌 Resistor retirado. El cable de corriente quedó suelto en la mesa; únelo manualmente para que pase la corriente y el circuito siga funcionando.'
                          : '⚡ Cable de corriente unido directamente por el usuario. La corriente fluye por este tramo sin dejar el circuito inservible.'}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          data-testid={`join-cable-${branch.id}`}
                          onClick={() => handleToggleJoinBranchCable(branch.compId)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                            branch.fault === 'OPEN'
                              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                              : 'bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400 text-amber-200'
                          }`}
                        >
                          {branch.fault === 'OPEN'
                            ? '🔗 Unir Cable de Corriente'
                            : '✂️ Separar Puntas del Cable'}
                        </button>
                        <button
                          type="button"
                          data-testid={`restore-resistor-${branch.id}`}
                          onClick={() =>
                            handleRestoreBranchResistor(
                              branch.compId,
                              branch.id === 'R1' ? 20 : branch.id === 'R2' ? 30 : 50
                            )
                          }
                          className="py-1.5 px-3 rounded-lg bg-cyan-500/20 hover:bg-cyan-500 hover:text-slate-950 border border-cyan-400/60 text-cyan-300 text-[11px] font-mono font-bold transition-colors cursor-pointer"
                        >
                          ➕ Restaurar Resistor {branch.id}
                        </button>
                      </div>
                    </div>
                  ) : (
                    !diagnosisMission && (
                      <input
                        id={`slider-${branch.id}`}
                        type="range"
                        min={1}
                        max={100}
                        step={1}
                        value={Math.min(100, branch.val)}
                        onChange={(e) => branch.setVal(parseInt(e.target.value, 10))}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    )
                  )}

                  {/* Barra de Respuesta Térmica y Luminosa para Bombillas Incandescentes (Objetivo B) */}
                  {branch.compType === 'bulb' && (
                    <div className="pt-1 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className={isBurned ? 'text-rose-400 font-bold' : 'text-amber-300'}>
                          {isBurned
                            ? '🔥 Filamento roto por sobrecalentamiento (> 15.0 W)'
                            : `Potencia Térmica P = I²·R: ${powerW.toFixed(2)} W / ${MAX_RATED_POWER_WATTS.toFixed(1)} W`}
                        </span>
                        <span className="text-slate-400">
                          Brillo: {Math.round((branch.branchData?.brightness ?? 0) * 100)}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            isBurned
                              ? 'bg-rose-500'
                              : thermalPct > 80
                              ? 'bg-amber-400'
                              : 'bg-yellow-300'
                          }`}
                          style={{ width: `${isBurned ? 100 : thermalPct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Panel Activo de Misión "Caja Negra" (Objetivo C - Ciclo POE) */}
            {(diagnosisMission || showBlackBoxModal) && (
              <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/50 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-500/30 pb-2">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-purple-300 block">
                      CICLO PREDECIR · OBSERVAR · EXPLICAR (POE)
                    </span>
                    <h4 className="text-xs font-bold text-white">
                      🕵️ Diagnóstico de Circuito Averiado (Caja Negra)
                    </h4>
                  </div>
                  <button
                    type="button"
                    data-testid="start-poe-mission-btn"
                    onClick={() => handleStartDiagnosisMission()}
                    className="px-2.5 py-1 rounded-lg bg-purple-500 hover:bg-purple-400 text-slate-950 font-mono font-bold text-[11px] transition-colors cursor-pointer"
                  >
                    🎲 Nueva Avería
                  </button>
                </div>

                {diagnosisMission && (
                  <div className="space-y-2.5">
                    <div className="p-2.5 rounded-lg bg-[#07090E] border border-purple-500/40 text-purple-100">
                      <span className="font-mono font-bold text-purple-300 block text-[11px]">
                        📋 Síntoma Reportado ({diagnosisMission.topology.toUpperCase()}):
                      </span>
                      <p className="text-[11px] leading-relaxed mt-0.5">{diagnosisMission.symptomEs}</p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono text-cyan-300 mb-1">
                        1. PREDECIR / OBSERVAR:
                      </label>
                      <input
                        type="text"
                        value={poePredictionText}
                        onChange={(e) => setPoePredictionText(e.target.value)}
                        className="w-full rounded-lg bg-[#07090E] border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-200"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label
                          htmlFor="poe-branch-select"
                          className="block text-[11px] font-mono text-amber-300 mb-1"
                        >
                          2. Componente Averiado:
                        </label>
                        <select
                          id="poe-branch-select"
                          value={poeSelectedBranch}
                          onChange={(e) => setPoeSelectedBranch(e.target.value as 'R1' | 'R2' | 'R3')}
                          className="w-full rounded-lg bg-[#07090E] border border-slate-700 px-2.5 py-1.5 text-xs font-mono text-white"
                        >
                          <option value="R1">Rama R₁</option>
                          <option value="R2">Rama R₂</option>
                          <option value="R3">Rama R₃</option>
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="poe-fault-select"
                          className="block text-[11px] font-mono text-amber-300 mb-1"
                        >
                          3. Naturaleza de la Falla:
                        </label>
                        <select
                          id="poe-fault-select"
                          value={poeSelectedFault}
                          onChange={(e) => setPoeSelectedFault(e.target.value as HiddenFaultType)}
                          className="w-full rounded-lg bg-[#07090E] border border-slate-700 px-2.5 py-1.5 text-xs font-mono text-white"
                        >
                          <option value="OPEN_FILAMENT">Circuito Abierto (R → ∞ / OL)</option>
                          <option value="SHORT_BYPASS">Cortocircuito Interno (R ≈ 0 Ω)</option>
                          <option value="ALTERED_HIGH_RESISTANCE">Resistencia Alterada (×4 Ω)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <span className="block text-[11px] font-mono text-emerald-300 mb-1">
                        4. EXPLICAR (Justificación con Ley de Ohm y Kirchhoff):
                      </span>
                      <div className="space-y-1.5">
                        {diagnosisMission.justificationOptionsEs.map((opt, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setPoeSelectedJustification(idx)}
                            className={`w-full p-2 rounded-lg border text-left text-[11px] leading-relaxed transition-colors cursor-pointer ${
                              poeSelectedJustification === idx
                                ? 'bg-cyan-950/80 border-cyan-400 text-cyan-100 font-semibold'
                                : 'bg-[#07090E] border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <span className="font-mono font-bold text-cyan-400 mr-1.5">
                              [{String.fromCharCode(65 + idx)}]
                            </span>
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {poeFeedback && (
                      <div
                        className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                          poeFeedback.passed
                            ? 'bg-emerald-950/60 border-emerald-500 text-emerald-100'
                            : 'bg-amber-950/60 border-amber-500 text-amber-100'
                        }`}
                      >
                        <strong className="block font-mono">{poeFeedback.feedbackTitleEs}</strong>
                        <p className="text-[11px]">{poeFeedback.feedbackBodyEs}</p>
                        <p className="text-[10px] font-mono text-cyan-300 pt-1">
                          💡 {poeFeedback.poeNextStepEs}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        data-testid="repair-poe-circuit-btn"
                        onClick={handleValidateAndRepairDiagnosis}
                        className="flex-1 py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-xs transition-colors cursor-pointer"
                      >
                        🔧 Diagnosticar y Reparar Circuito
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDiagnosisMission(null);
                          setShowBlackBoxModal(false);
                          setPoeFeedback(null);
                          setRevealAllBranches(true);
                          loadPreset('ohm');
                        }}
                        className="py-2 px-3 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        Salir
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Controles Opcionales RC + LED 3D */}
            {rcModeActive && (
              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-emerald-300 flex items-center gap-1.5">
                    <Cpu className="w-4 h-4" />
                    <span>Transitorio RC + Diodo LED 3D</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setRcCharging((c) => !c)}
                    className="px-2.5 py-0.5 rounded bg-emerald-500 text-slate-950 font-mono font-bold text-[10px] cursor-pointer"
                  >
                    {rcCharging ? 'Modo: CARGA' : 'Modo: DESCARGA'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Constante τ = R·C:</span>
                    <span className="text-white font-bold">{rcState.tauSeconds.toFixed(2)} s</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Voltaje Capacitor V_C(t):</span>
                    <span className="text-cyan-300 font-bold">{rcState.capacitorVoltage.toFixed(2)} V</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <label htmlFor="rc-time-slider" className="text-slate-300">
                      Instante t en curva exponencial:
                    </label>
                    <span className="text-emerald-300">{rcElapsed.toFixed(1)} s</span>
                  </div>
                  <input
                    id="rc-time-slider"
                    type="range"
                    min={0}
                    max={Math.max(2, rcState.tauSeconds * 5)}
                    step={0.1}
                    value={rcElapsed}
                    onChange={(e) => setRcElapsed(parseFloat(e.target.value))}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Inspector Individual MNA */}
            {selectedComponent && !diagnosisMission && (
              <div className="p-3 rounded-xl bg-[#07090E] border border-slate-800 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-white">
                    {t.selectedCompTitle}: {selectedComponent.label}
                  </span>
                  <div className="flex items-center gap-2 font-mono">
                    <button
                      type="button"
                      onClick={handleAddComponent}
                      className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Nodo</span>
                    </button>
                    {selectedComponent.type === 'wire' && selectedComponent.id.startsWith('res-') ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleToggleJoinBranchCable(selectedComponent.id)}
                          className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400 text-emerald-300 text-[11px] font-bold cursor-pointer"
                        >
                          {selectedComponent.faultState === 'OPEN'
                            ? '🔗 Unir Cable'
                            : '✂️ Separar Cable'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRestoreBranchResistor(selectedComponent.id, 20)}
                          className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400 text-cyan-300 text-[11px] font-bold cursor-pointer"
                        >
                          ➕ Poner Resistor
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        aria-label="Eliminar componente conservando cable"
                        title="Retira el resistor conservando el cable de corriente para que puedas unirlo manualmente"
                        onClick={() => {
                          if (
                            selectedComponent.id.startsWith('res-') ||
                            selectedComponent.type === 'resistor' ||
                            selectedComponent.type === 'bulb'
                          ) {
                            handleRemoveBranchResistor(selectedComponent.id);
                          } else {
                            if (components.length <= 2) return;
                            setComponents((prev) =>
                              prev.filter((c) => c.id !== selectedComponent.id)
                            );
                          }
                        }}
                        className="text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="text-[10px]">Quitar R (Dejar Cable)</span>
                      </button>
                    )}
                  </div>
                </div>
                {(selectedComponent.type === 'resistor' || selectedComponent.type === 'bulb') && (
                  <input
                    id="resistance-slider"
                    type="range"
                    min={1}
                    max={1000}
                    step={1}
                    value={selectedComponent.resistance}
                    onChange={(e) =>
                      updateSelectedComponent({ resistance: parseInt(e.target.value, 10) })
                    }
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ZONA 3: CENTRO DE GRÁFICAS DINÁMICAS E INTERACTIVAS A 60 FPS (ANCHO COMPLETO DEBAJO DE LOS PANELES) */}
      <div
        data-testid="circuit-interactive-graphs"
        data-tour="circuits-graphs"
        className="w-full p-5 rounded-2xl bg-[#0D1322] border border-slate-800 space-y-4"
      >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span>ZONA 3 · Osciloscopio Multicanal y Gráficas Dinámicas en Vivo</span>
                </h3>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Pendiente R_reg = {regression.slopeResistance.toFixed(1)} Ω · R_eq actual ={' '}
                  {Number.isFinite(topologyResult.equivalentResistance)
                    ? `${topologyResult.equivalentResistance.toFixed(1)} Ω`
                    : '∞'}{' '}
                  · P_T = {topologyResult.totalPower.toFixed(2)} W
                </p>
              </div>

              {/* Filtro de Vista de Gráficas */}
              <div className="flex items-center gap-1 p-1 rounded-lg bg-[#07090E] border border-slate-800 text-[10px] font-mono">
                {(
                  [
                    { id: 'all', label: 'Todas (4)' },
                    { id: 'vi', label: 'V vs I' },
                    { id: 'ir', label: 'I vs R' },
                    { id: 'power', label: 'Potencia & LVK' },
                  ] as const
                ).map((gTab) => (
                  <button
                    key={gTab.id}
                    type="button"
                    onClick={() => setActiveGraphMode(gTab.id)}
                    className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                      activeGraphMode === gTab.id
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {gTab.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              className={`grid grid-cols-1 gap-4 ${
                activeGraphMode === 'all'
                  ? 'sm:grid-cols-2 xl:grid-cols-4'
                  : activeGraphMode === 'power'
                  ? 'sm:grid-cols-2'
                  : 'grid-cols-1'
              }`}
            >
              {/* GRÁFICA 1: Linealidad V vs. I (Ley de Ohm + Puntos Experimentales Registrados) */}
              {(activeGraphMode === 'all' || activeGraphMode === 'vi') && (
                <div className="p-3.5 rounded-xl bg-[#07090E] border border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-cyan-300 font-bold">
                      1. Linealidad I vs. V (Pendiente = 1/R_eq)
                    </span>
                    <span className="text-[10px] font-mono text-amber-300">
                      ({topologyResult.sourceVoltage.toFixed(1)}V, {topologyResult.totalCurrent.toFixed(2)}A)
                    </span>
                  </div>
                  <svg viewBox="0 0 230 135" className="w-full h-32">
                    {/* Cuadrícula */}
                    {[35, 60, 85, 110].map((gy) => (
                      <line key={gy} x1="30" y1={gy} x2="215" y2={gy} stroke="#1E293B" strokeWidth="1" />
                    ))}
                    {[65, 105, 145, 185].map((gx) => (
                      <line key={gx} x1={gx} y1="14" x2={gx} y2="112" stroke="#1E293B" strokeWidth="1" />
                    ))}
                    <line x1="30" y1="12" x2="30" y2="112" stroke="#475569" strokeWidth="1.5" />
                    <line x1="30" y1="112" x2="215" y2="112" stroke="#475569" strokeWidth="1.5" />
                    <text x="6" y="22" fill="#94A3B8" fontSize="8" fontFamily="monospace">
                      I(A)
                    </text>
                    <text x="172" y="126" fill="#94A3B8" fontSize="8" fontFamily="monospace">
                      V (0–48V)
                    </text>

                    {/* Recta de Ley de Ohm dinámica cuya pendiente se adapta a R_eq */}
                    {(() => {
                      const req = Number.isFinite(topologyResult.equivalentResistance)
                        ? Math.max(2, topologyResult.equivalentResistance)
                        : 1000;
                      const iAt48V = 48 / req;
                      const maxPlotI = Math.max(2.5, iAt48V, topologyResult.totalCurrent * 1.25);
                      const endY = Math.max(16, 112 - (iAt48V / maxPlotI) * 94);
                      const normV = Math.min(1, topologyResult.sourceVoltage / 48);
                      const curX = 30 + normV * 180;
                      const curY = Math.max(
                        16,
                        112 - (topologyResult.totalCurrent / maxPlotI) * 94
                      );

                      return (
                        <g>
                          <line
                            x1="30"
                            y1="112"
                            x2="210"
                            y2={endY}
                            stroke="#06B6D4"
                            strokeWidth="2"
                            strokeDasharray="4 2"
                          />
                          {/* Nube de Puntos Experimentales Registrados */}
                          {recordedPoints.map((pt, idx) => {
                            const px = 30 + Math.min(1, pt.voltage / 48) * 180;
                            const py = Math.max(
                              16,
                              Math.min(112, 112 - (pt.current / maxPlotI) * 94)
                            );
                            return (
                              <circle
                                key={idx}
                                cx={px}
                                cy={py}
                                r="3.2"
                                fill="#22D3EE"
                                stroke="#083344"
                                strokeWidth="1"
                              />
                            );
                          })}
                          {/* Guías punteadas al eje X e Y */}
                          <line
                            x1={curX}
                            y1={curY}
                            x2={curX}
                            y2="112"
                            stroke="#F59E0B"
                            strokeWidth="1"
                            strokeDasharray="2 2"
                          />
                          <line
                            x1="30"
                            y1={curY}
                            x2={curX}
                            y2={curY}
                            stroke="#F59E0B"
                            strokeWidth="1"
                            strokeDasharray="2 2"
                          />
                          {/* Punto de Operación en Vivo */}
                          <circle
                            cx={curX}
                            cy={curY}
                            r="5.5"
                            fill="#F59E0B"
                            stroke="#FFFFFF"
                            strokeWidth="1.5"
                          />
                          <text
                            x={Math.min(148, Math.max(34, curX - 24))}
                            y={Math.max(22, curY - 9)}
                            fill="#FEF08A"
                            fontSize="8.5"
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            ({topologyResult.sourceVoltage.toFixed(0)}V,{' '}
                            {topologyResult.totalCurrent.toFixed(2)}A)
                          </text>
                        </g>
                      );
                    })()}
                  </svg>
                </div>
              )}

              {/* GRÁFICA 2: Hipérbola I vs. R_eq (I = V / R_eq) */}
              {(activeGraphMode === 'all' || activeGraphMode === 'ir') && (
                <div
                  className={`p-3 rounded-lg bg-[#07090E] border border-slate-800 ${
                    activeGraphMode === 'ir' ? 'sm:col-span-2' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-purple-300 font-bold">
                      2. Hipérbola I vs. R_eq (I = V / R)
                    </span>
                    <span className="text-[10px] font-mono text-cyan-300">
                      R_eq ={' '}
                      {Number.isFinite(topologyResult.equivalentResistance)
                        ? `${topologyResult.equivalentResistance.toFixed(1)}Ω`
                        : '∞'}
                    </span>
                  </div>
                  <svg viewBox="0 0 230 135" className="w-full h-32">
                    {[35, 60, 85, 110].map((gy) => (
                      <line key={gy} x1="30" y1={gy} x2="215" y2={gy} stroke="#1E293B" strokeWidth="1" />
                    ))}
                    {[65, 105, 145, 185].map((gx) => (
                      <line key={gx} x1={gx} y1="14" x2={gx} y2="112" stroke="#1E293B" strokeWidth="1" />
                    ))}
                    <line x1="30" y1="12" x2="30" y2="112" stroke="#475569" strokeWidth="1.5" />
                    <line x1="30" y1="112" x2="215" y2="112" stroke="#475569" strokeWidth="1.5" />
                    <text x="6" y="22" fill="#94A3B8" fontSize="8" fontFamily="monospace">
                      I(A)
                    </text>
                    <text x="168" y="126" fill="#94A3B8" fontSize="8" fontFamily="monospace">
                      R_eq (Ω)
                    </text>

                    {/* Curva Hiperbólica Real generada con puntos de I = V / R */}
                    {(() => {
                      const vRef = Math.max(1, topologyResult.sourceVoltage);
                      const iMaxRef = Math.max(1.5, vRef / 5);
                      const pts: string[] = [];
                      for (let rSample = 5; rSample <= 150; rSample += 5) {
                        const x = 35 + ((rSample - 5) / 145) * 175;
                        const iVal = vRef / rSample;
                        const y = Math.max(16, Math.min(110, 110 - (iVal / iMaxRef) * 90));
                        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
                      }
                      const reqClamped = Number.isFinite(topologyResult.equivalentResistance)
                        ? Math.min(150, Math.max(5, topologyResult.equivalentResistance))
                        : 150;
                      const cx = 35 + ((reqClamped - 5) / 145) * 175;
                      const cy = Math.max(
                        16,
                        Math.min(110, 110 - (topologyResult.totalCurrent / iMaxRef) * 90)
                      );

                      return (
                        <g>
                          <polyline
                            fill="none"
                            stroke="#A855F7"
                            strokeWidth="2.2"
                            points={pts.join(' ')}
                          />
                          <line
                            x1={cx}
                            y1={cy}
                            x2={cx}
                            y2="112"
                            stroke="#22D3EE"
                            strokeWidth="1"
                            strokeDasharray="2 2"
                          />
                          <circle
                            cx={cx}
                            cy={cy}
                            r="5.5"
                            fill="#22D3EE"
                            stroke="#FFFFFF"
                            strokeWidth="1.5"
                          />
                          <text
                            x={Math.min(140, Math.max(34, cx - 22))}
                            y={Math.max(22, cy - 9)}
                            fill="#67E8F9"
                            fontSize="8.5"
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            (
                            {Number.isFinite(topologyResult.equivalentResistance)
                              ? `${topologyResult.equivalentResistance.toFixed(0)}Ω`
                              : '∞'}
                            , {topologyResult.totalCurrent.toFixed(2)}A)
                          </text>
                        </g>
                      );
                    })()}
                  </svg>
                </div>
              )}

              {/* GRÁFICA 3: Espectro Térmico de Potencia Joule (P₁, P₂, P₃ vs Límite 15W) */}
              {(activeGraphMode === 'all' || activeGraphMode === 'power') && (
                <div className="p-3 rounded-lg bg-[#07090E] border border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-emerald-300 font-bold">
                      3. Potencia Térmica P_k = I²·R (Límite 15W)
                    </span>
                    <span className="text-[10px] font-mono text-amber-300">
                      P_T = {topologyResult.totalPower.toFixed(1)}W
                    </span>
                  </div>
                  <svg viewBox="0 0 230 135" className="w-full h-32">
                    <line x1="30" y1="12" x2="30" y2="110" stroke="#475569" strokeWidth="1.5" />
                    <line x1="30" y1="110" x2="215" y2="110" stroke="#475569" strokeWidth="1.5" />
                    {/* Línea de Umbral de Fusión de Bombilla (15.0 W) */}
                    <line
                      x1="30"
                      y1="32"
                      x2="215"
                      y2="32"
                      stroke="#EF4444"
                      strokeWidth="1.2"
                      strokeDasharray="3 2"
                    />
                    <text x="142" y="28" fill="#FCA5A5" fontSize="7.5" fontFamily="monospace">
                      Máx Bombilla 15W
                    </text>

                    {topologyResult.branches.map((b, idx) => {
                      const maxScaleW = Math.max(20, topologyResult.totalPower, 18);
                      const barH = Math.min(92, (b.power / maxScaleW) * 92);
                      const bx = 48 + idx * 56;
                      const by = 110 - barH;
                      const barColor =
                        b.power > MAX_RATED_POWER_WATTS
                          ? '#EF4444'
                          : idx === 0
                          ? '#22D3EE'
                          : idx === 1
                          ? '#F59E0B'
                          : '#10B981';
                      return (
                        <g key={b.branchId}>
                          <rect
                            x={bx}
                            y={by}
                            width="34"
                            height={Math.max(2, barH)}
                            rx="3"
                            fill={barColor}
                            opacity="0.88"
                          />
                          <text
                            x={bx + 17}
                            y={Math.max(20, by - 4)}
                            textAnchor="middle"
                            fill="#F8FAFC"
                            fontSize="8"
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            {b.power.toFixed(1)}W
                          </text>
                          <text
                            x={bx + 17}
                            y="123"
                            textAnchor="middle"
                            fill="#CBD5E1"
                            fontSize="8.5"
                            fontFamily="monospace"
                          >
                            {b.branchId}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}

              {/* GRÁFICA 4: Balance de Tensiones de Kirchhoff (LVK: ΔV₁, ΔV₂, ΔV₃ vs V_fuente) o Curva Exponencial RC */}
              {(activeGraphMode === 'all' || activeGraphMode === 'power' || activeGraphMode === 'rc') && (
                <div className="p-3 rounded-lg bg-[#07090E] border border-slate-800">
                  {rcModeActive ? (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono text-emerald-300 font-bold">
                          4. Curva Exponencial RC V_C(t)
                        </span>
                        <span className="text-[10px] font-mono text-cyan-300">
                          τ = {rcState.tauSeconds.toFixed(2)}s
                        </span>
                      </div>
                      <svg viewBox="0 0 230 135" className="w-full h-32">
                        <line x1="30" y1="12" x2="30" y2="110" stroke="#475569" strokeWidth="1.5" />
                        <line x1="30" y1="110" x2="215" y2="110" stroke="#475569" strokeWidth="1.5" />
                        {(() => {
                          const maxT = Math.max(2, rcState.tauSeconds * 5);
                          const v0 = Math.max(1, sourceVoltage);
                          const pts: string[] = [];
                          for (let i = 0; i <= 30; i++) {
                            const tSample = (i / 30) * maxT;
                            const vc = rcCharging
                              ? v0 * (1 - Math.exp(-tSample / Math.max(0.05, rcState.tauSeconds)))
                              : v0 * Math.exp(-tSample / Math.max(0.05, rcState.tauSeconds));
                            const x = 30 + (i / 30) * 180;
                            const y = 110 - (vc / v0) * 90;
                            pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
                          }
                          const curX = 30 + Math.min(1, rcElapsed / maxT) * 180;
                          const curY = 110 - (rcState.capacitorVoltage / v0) * 90;
                          return (
                            <g>
                              <polyline
                                fill="none"
                                stroke="#10B981"
                                strokeWidth="2.2"
                                points={pts.join(' ')}
                              />
                              <circle cx={curX} cy={curY} r="5" fill="#F59E0B" stroke="#FFF" strokeWidth="1.5" />
                              <text x="40" y="24" fill="#A7F3D0" fontSize="8" fontFamily="monospace">
                                V_C({rcElapsed.toFixed(1)}s) = {rcState.capacitorVoltage.toFixed(1)}V
                              </text>
                            </g>
                          );
                        })()}
                      </svg>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono text-amber-300 font-bold">
                          4. Perfil de Voltajes LVK (ΔV_k vs V_F)
                        </span>
                        <span className="text-[10px] font-mono text-cyan-300">
                          V_F = {topologyResult.sourceVoltage.toFixed(1)}V
                        </span>
                      </div>
                      <svg viewBox="0 0 230 135" className="w-full h-32">
                        <line x1="30" y1="12" x2="30" y2="110" stroke="#475569" strokeWidth="1.5" />
                        <line x1="30" y1="110" x2="215" y2="110" stroke="#475569" strokeWidth="1.5" />
                        {[
                          { label: 'Fuente', v: topologyResult.sourceVoltage, color: '#F59E0B' },
                          { label: 'ΔV₁', v: topologyResult.branches[0]?.voltageDrop ?? 0, color: '#22D3EE' },
                          { label: 'ΔV₂', v: topologyResult.branches[1]?.voltageDrop ?? 0, color: '#A855F7' },
                          { label: 'ΔV₃', v: topologyResult.branches[2]?.voltageDrop ?? 0, color: '#10B981' },
                        ].map((item, idx) => {
                          const maxV = Math.max(12, topologyResult.sourceVoltage, 48);
                          const barH = Math.min(90, (item.v / maxV) * 90);
                          const bx = 40 + idx * 44;
                          const by = 110 - barH;
                          return (
                            <g key={item.label}>
                              <rect
                                x={bx}
                                y={by}
                                width="28"
                                height={Math.max(2, barH)}
                                rx="3"
                                fill={item.color}
                                opacity="0.88"
                              />
                              <text
                                x={bx + 14}
                                y={Math.max(20, by - 4)}
                                textAnchor="middle"
                                fill="#F8FAFC"
                                fontSize="7.5"
                                fontFamily="monospace"
                                fontWeight="bold"
                              >
                                {item.v.toFixed(1)}V
                              </text>
                              <text
                                x={bx + 14}
                                y="123"
                                textAnchor="middle"
                                fill="#CBD5E1"
                                fontSize="8"
                                fontFamily="monospace"
                              >
                                {item.label}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Botones de Registro Experimental de Puntos (V, I) y Bitácora de Mediciones */}
            <div className="space-y-2 pt-1 border-t border-slate-800/80">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleRecordPoint}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs transition-colors cursor-pointer"
                >
                  + Registrar Punto Experimental ({recordedPoints.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRecordedPoints([])}
                  className="py-1.5 px-3 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-mono text-slate-300 transition-colors cursor-pointer"
                >
                  Limpiar
                </button>
              </div>

              {recordedPoints.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-mono text-slate-400">Puntos (V, I):</span>
                  {recordedPoints.slice(-5).map((pt, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-[#07090E] border border-slate-800 text-[10px] font-mono text-cyan-300"
                    >
                      {pt.voltage.toFixed(1)}V → {pt.current.toFixed(2)}A
                    </span>
                  ))}
                </div>
              )}
            </div>
      </div>

      {/* ZONA 4: MÓDULO DE EVALUACIÓN Y DEFENSA CIENTÍFICA (10 PREGUNTAS INTERACTIVAS) */}
      <ScrollReveal direction="up" delayMs={80}>
        <section className="p-6 rounded-2xl bg-[#0D1322] border border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <HelpCircle className="w-5 h-5 text-cyan-400" />
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 block">
                  ZONA 4 · MÓDULO DE EVALUACIÓN Y DEFENSA ANTE JURADO (10 PREGUNTAS)
                </span>
                <h3 className="text-base font-bold text-white">
                  Cuestionario Interactivo de Electrodinámica, Topologías y Diagnóstico de Fallas
                </h3>
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-[#07090E] border border-slate-800 text-xs font-mono">
              <span className="text-slate-400">Aciertos: </span>
              <span className="font-bold text-emerald-400">{quizCorrectCount} / 10</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {QUANTUM_DEFENSE_QUIZ.map((q, idx) => {
              const answered = quizAnswers[idx] !== undefined;
              const isCorrect = quizAnswers[idx] === q.correctIndex;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setActiveQuizIdx(idx)}
                  className={`w-8 h-8 rounded-lg font-mono text-xs font-bold border transition-colors cursor-pointer ${
                    activeQuizIdx === idx
                      ? 'bg-cyan-500 text-slate-950 border-cyan-300'
                      : answered
                      ? isCorrect
                        ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                        : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                      : 'bg-[#07090E] border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {q.id}
                </button>
              );
            })}
          </div>

          {currentQuestion && (
            <div className="p-4 rounded-xl bg-[#07090E] border border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-cyan-400">
                <span>
                  PREGUNTA {currentQuestion.id} DE 10 · {currentQuestion.category.toUpperCase()}
                </span>
                <button
                  type="button"
                  onClick={() => handleSimulateQuizQuestion(currentQuestion.id)}
                  className="px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500 hover:text-slate-950 border border-cyan-400/60 text-cyan-200 font-mono font-bold text-[11px] transition-colors cursor-pointer"
                >
                  🔬 Simular este ejercicio en la Mesa 3D
                </button>
              </div>

              {quizSimNotice && (
                <div className="p-2.5 rounded-lg bg-cyan-950/50 border border-cyan-500/40 text-xs font-mono text-cyan-200 flex items-center justify-between gap-2">
                  <span>{quizSimNotice}</span>
                  <button
                    type="button"
                    onClick={() => setQuizSimNotice(null)}
                    className="text-[10px] text-slate-400 hover:text-white cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              <p className="text-sm font-semibold text-white">{currentQuestion.questionEs}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {currentQuestion.optionsEs.map((opt, oIdx) => {
                  const selected = quizAnswers[activeQuizIdx] === oIdx;
                  const isRight = oIdx === currentQuestion.correctIndex;
                  const hasAnswered = quizAnswers[activeQuizIdx] !== undefined;

                  return (
                    <button
                      key={oIdx}
                      type="button"
                      onClick={() => {
                        setQuizAnswers((prev) => ({ ...prev, [activeQuizIdx]: oIdx }));
                        if (oIdx === currentQuestion.correctIndex) {
                          audioSynth.playSuccessChime();
                        }
                      }}
                      className={`p-3 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                        hasAnswered && isRight
                          ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200 font-semibold'
                          : hasAnswered && selected && !isRight
                          ? 'bg-rose-950/60 border-rose-500 text-rose-200'
                          : 'bg-[#0D1322] border-slate-800 text-slate-200 hover:border-cyan-500/50'
                      }`}
                    >
                      <span className="font-mono font-bold mr-2 text-cyan-400">
                        {String.fromCharCode(65 + oIdx)}.
                      </span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>

              {quizAnswers[activeQuizIdx] !== undefined && (
                <div className="p-3 rounded-lg bg-[#0D1322] border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
                  <BookOpen className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-cyan-300">Justificación Física: </strong>
                    {currentQuestion.explanationEs}
                  </span>
                </div>
              )}
            </div>
          )}
        </section>
      </ScrollReveal>
    </div>
  );
};
