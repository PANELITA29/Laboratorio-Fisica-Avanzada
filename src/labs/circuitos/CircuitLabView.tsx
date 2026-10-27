import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Zap,
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
} from 'lucide-react';
import { Language, dictionary } from '../../assets/js/i18n';
import { audioSynth } from '../../assets/js/audio-synth';
import { TelemetryItem } from '../../assets/js/report-generator';
import {
  CircuitComponent,
  ComponentType,
  CircuitTopology,
  BranchFaultState,
  solveCircuit,
  analyzeWorkbenchCircuit,
  buildTopologyComponents3D,
  getResistorColorBands,
  getResistorColorBands5,
  calculateOhmRegressionSlope,
  computeRCAndLEDState,
} from './circuit-engine';
import {
  CIRCUIT_CHALLENGES,
  validateChallenge1,
  validateChallenge2,
  ValidationResult,
} from './circuit-challenges';
import { CircuitWorkbench3D } from './CircuitWorkbench3D';

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

export const CircuitLabView: React.FC<CircuitLabViewProps> = ({
  lang,
  onUpdateTelemetry,
  completedChallenges,
  onCompleteChallenge,
  externalResistorSync,
}) => {
  const t = dictionary[lang];

  const [activeSubTab, setActiveSubTab] = useState<'sandbox' | 'challenges'>('sandbox');
  const [viewDimension, setViewDimension] = useState<'3d' | '2d'>('3d');
  const [components, setComponents] = useState<CircuitComponent[]>(() => createCircuitPreset('ohm'));
  const [selectedId, setSelectedId] = useState<string>('res-1');
  const [flowMode, setFlowMode] = useState<'electrons' | 'conventional'>('electrons');

  // === ESTADO DINÁMICO BASADO EN GRAFO DE COMPONENTES (SIN ARQUITECTURA RÍGIDA) ===
  const [isPowered, setIsPowered] = useState<boolean>(true);
  const [topology, setTopology] = useState<CircuitTopology>('series');
  const [eiaBandMode, setEiaBandMode] = useState<4 | 5>(4);

  // Modo Transitorio RC + Diodo LED 3D
  const [rcModeActive, setRcModeActive] = useState<boolean>(false);
  const [capacitanceUF, setCapacitanceUF] = useState<number>(470);
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

  const setR1 = (ohms: number) => updateComponentById('res-1', { resistance: ohms });
  const setR2 = (ohms: number) => updateComponentById('res-2', { resistance: ohms });
  const setR3 = (ohms: number) => updateComponentById('res-3', { resistance: ohms });
  const setF1 = (fault: BranchFaultState) => updateComponentById('res-1', { faultState: fault });
  const setF2 = (fault: BranchFaultState) => updateComponentById('res-2', { faultState: fault });
  const setF3 = (fault: BranchFaultState) => updateComponentById('res-3', { faultState: fault });
  const setSourceVoltage = (v: number) => {
    if (compBat) updateComponentById(compBat.id, { voltage: v });
  };

  // Sincronización desde la Calculadora EIA de Código de Colores
  useEffect(() => {
    if (!externalResistorSync) return;
    const clamped = Math.max(1, Math.min(1000, Math.round(externalResistorSync.ohms)));
    if (externalResistorSync.target === 'R1') setR1(clamped);
    if (externalResistorSync.target === 'R2') setR2(clamped);
    if (externalResistorSync.target === 'R3') setR3(clamped);
  }, [externalResistorSync]);

  // Terminales del Multímetro Flotante (Rojo V+ y Negro COM)
  const [probeRedNode, setProbeRedNode] = useState<string>('n3');
  const [probeBlackNode, setProbeBlackNode] = useState<string>('n5');

  const [recordedPoints, setRecordedPoints] = useState<Array<{ current: number; voltage: number }>>([
    { current: 0.01, voltage: 4.7 },
    { current: 0.02, voltage: 9.4 },
    { current: 0.03, voltage: 14.1 },
  ]);

  const [newCompType, setNewCompType] = useState<ComponentType>('resistor');
  const [newNodeA, setNewNodeA] = useState<string>('n2');
  const [newNodeB, setNewNodeB] = useState<string>('n4');

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

  // Reconfigura únicamente el cableado entre nodos cuando el usuario cambia explícitamente de Topología (Serie / Paralelo / Mixto)
  const applyTopologyRewiring = (nextTop: CircuitTopology) => {
    setTopology(nextTop);
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
      });
      return built;
    });
  };

  // Sincronizar audio procedural
  useEffect(() => {
    audioSynth.updateCircuitHum(isPowered ? topologyResult.totalCurrent : 0);
    if (topologyResult.isShortCircuitFault) {
      audioSynth.playShortCircuitAlarm();
    }
    const burnedCount = Object.values(solution.componentStates).filter((s) => s.isBurnedOut).length;
    if (burnedCount > prevBurnoutCountRef.current) {
      audioSynth.playBurnoutSound();
    }
    prevBurnoutCountRef.current = burnedCount;

    return () => {
      audioSynth.stopCircuitHum();
    };
  }, [solution, topologyResult, isPowered]);

  // Exportar telemetría en vivo hacia el Generador de Informes Científicos y Tutor IA
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

  // Renderizado del Canvas 2D interactivo a 60 FPS cuando se selecciona Esquemático 2D
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

      components.forEach((comp) => {
        const posA = NODE_POSITIONS[comp.nodeA];
        const posB = NODE_POSITIONS[comp.nodeB];
        if (!posA || !posB) return;

        const state = solution.componentStates[comp.id];
        const isSelected = comp.id === selectedComponent?.id;
        const mx = (posA.x + posB.x) / 2;
        const my = (posA.y + posB.y) / 2;

        ctx.strokeStyle = isSelected ? '#22D3EE' : '#475569';
        ctx.lineWidth = isSelected ? 4 : 3;
        ctx.beginPath();
        ctx.moveTo(posA.x, posA.y);
        ctx.lineTo(posB.x, posB.y);
        ctx.stroke();

        const current = isPowered ? state?.current ?? 0 : 0;
        if (Math.abs(current) > 0.0005 && !state?.isBurnedOut) {
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
          const bands = getResistorColorBands(comp.resistance);
          ctx.fillStyle = '#FEF3C7';
          ctx.strokeStyle = isSelected ? '#22D3EE' : '#D97706';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(-42, -16, 84, 32, 8);
          ctx.fill();
          ctx.stroke();

          const bandOffsets = [-24, -10, 4, 22];
          bands.forEach((b, idx) => {
            ctx.fillStyle = b.hex;
            ctx.fillRect(bandOffsets[idx], -15, 7, 30);
          });

          ctx.fillStyle = '#E2E8F0';
          ctx.font = 'bold 11px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${comp.resistance} Ω`, 0, -24);
        } else if (comp.type === 'bulb') {
          const isBurned = state?.isBurnedOut ?? false;
          const brightness = isPowered ? state?.brightness ?? 0 : 0;

          ctx.fillStyle = isBurned ? '#1E293B' : brightness > 0.05 ? '#FEF08A' : '#0F172A';
          ctx.strokeStyle = isBurned ? '#EF4444' : isSelected ? '#22D3EE' : '#FACC15';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, 22, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        ctx.restore();
      });

      Object.entries(NODE_POSITIONS).forEach(([nodeId, pos]) => {
        const vNode = isPowered ? solution.nodeVoltages[nodeId] ?? 0 : 0;
        ctx.save();
        ctx.fillStyle = '#0F172A';
        ctx.strokeStyle = '#22D3EE';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#94A3B8';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${nodeId.toUpperCase()} (${vNode.toFixed(1)}V)`, pos.x, pos.y + 24);
        ctx.restore();
      });

      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animId);
  }, [viewDimension, components, solution, selectedComponent, flowMode, isPowered]);

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
      maxPower: newCompType === 'bulb' ? 25 : undefined,
      isClosed: newCompType === 'switch' ? true : undefined,
    };

    setComponents((prev) => [...prev, newComp]);
    setSelectedId(id);
  };

  const handleRecordPoint = () => {
    const v = Math.abs(multimeterVoltage);
    const i = solution.totalCurrent;
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
    setComponents(next);
    setSelectedId(next[1]?.id || next[0]?.id || '');
    if (preset === 'parallel') setTopology('parallel');
    else if (preset === 'mixed') setTopology('mixed');
    else setTopology('series');
  };

  const hasBurnedBulb = Object.values(solution.componentStates).some((s) => s.isBurnedOut);
  const currentQuestion = QUANTUM_DEFENSE_QUIZ[activeQuizIdx];
  const quizCorrectCount = Object.entries(quizAnswers).filter(
    ([qIdx, ans]) => QUANTUM_DEFENSE_QUIZ[Number(qIdx)]?.correctIndex === ans
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Sub-Navigation & QuantumLabs Topology/Power Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[#0D1322] border border-slate-800/90">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">
            MÓDULO 1 · QUANTUMLABS 3D DC WORKBENCH & KIRCHHOFF SOLVER
          </span>
          <h2 className="text-xl font-bold text-white">{t.circuitTitle}</h2>
          <p className="text-xs text-slate-400">{t.circuitSubtitle}</p>
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
            <span>{isPowered ? 'FUENTE: ON' : 'FUENTE: OFF'}</span>
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

          {/* Tabs Sandbox / Challenges */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#07090E] border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveSubTab('sandbox')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeSubTab === 'challenges'
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>{t.challengesTab}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Burnout Warning Banner */}
      {hasBurnedBulb && (
        <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 flex items-center justify-between gap-4 text-xs text-rose-200">
          <div className="flex items-center gap-2.5">
            <Flame className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{t.burnoutWarning}</span>
          </div>
          <button
            type="button"
            onClick={() =>
              setComponents((prev) =>
                prev.map((c) => ({
                  ...c,
                  isBurnedOut: false,
                  voltage: c.type === 'battery' ? 15 : c.voltage,
                }))
              )
            }
            className="px-3 py-1 rounded-md bg-rose-500 text-slate-950 font-semibold hover:bg-rose-400 transition-colors shrink-0 cursor-pointer"
          >
            Reparar Filamento
          </button>
        </div>
      )}

      {/* Challenges Panel */}
      {activeSubTab === 'challenges' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {CIRCUIT_CHALLENGES.map((ch) => {
            const isDone = !!completedChallenges[ch.id];
            const fb = validationFeedback[ch.id];
            return (
              <div
                key={ch.id}
                className="p-5 rounded-xl bg-[#0D1322] border border-slate-800 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs font-mono">
                    <span className="text-cyan-400">{ch.points} PTS</span>
                    <span className={isDone ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                      {isDone ? `● ${t.challengeCompleted}` : `▲ ${t.challengePending}`}
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-base font-bold text-white">
                    {lang === 'es' ? ch.titleEs : ch.titleEn}
                  </h3>
                  <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                    {lang === 'es' ? ch.descriptionEs : ch.descriptionEn}
                  </p>
                  <p className="mt-2 p-2.5 rounded-lg bg-[#07090E] border border-slate-800/80 text-[11px] font-mono text-slate-400">
                    {lang === 'es' ? ch.hintEs : ch.hintEn}
                  </p>

                  {ch.requiresInput && (
                    <div className="mt-3">
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
                      className={`mt-3 p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
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
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
                  >
                    {t.loadChallengeSetup}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleValidateChallenge(ch.id)}
                    className="flex-1 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    {t.validateChallenge}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Split Console: Left 3D Workbench + Zone 2 Multimeter | Right Zone 1 Controls & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Interactive 3D WebGL Workbench + Zona 2 (LCD Multimeter & Analytical Table) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-xl bg-[#0D1322] border border-slate-800 overflow-hidden">
            {/* Canvas Top Toolbar */}
            <div className="px-4 py-3 bg-[#090D16] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
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

              <div className="flex flex-wrap items-center gap-2">
                {/* 4 vs 5 Band EIA Toggle on 3D Resistors */}
                <button
                  type="button"
                  onClick={() => setEiaBandMode((m) => (m === 4 ? 5 : 4))}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-cyan-300 border border-slate-700 cursor-pointer"
                >
                  EIA: {eiaBandMode} Bandas
                </button>

                {/* RC + LED 3D Mode Toggle */}
                <button
                  type="button"
                  onClick={() => setRcModeActive((v) => !v)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-colors cursor-pointer ${
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
                    loadPreset('ohm');
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t.resetSim}</span>
                </button>
              </div>
            </div>

            {/* Interactive 3D WebGL Workbench or 2D Schematic Canvas */}
            <div className="relative w-full aspect-[16/9] bg-[#070B14]">
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
                  onSelectComponent={(id) => setSelectedId(id)}
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
                  data-testid="circuit-canvas"
                  className="w-full h-full object-contain cursor-pointer"
                />
              )}
            </div>

            {/* Preset & Component Selector Bar Under Canvas */}
            <div className="px-4 py-3 bg-[#090D16] border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
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
                {components.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
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

          {/* ZONA 2: Multímetro Digital LCD, Banner Diagnóstico y Tabla Analítica por Rama */}
          <div className="p-5 rounded-xl bg-[#0D1322] border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">
                  ZONA 2 · Multímetro Digital LCD y Verificación de Kirchhoff (LVK / LCK)
                </h3>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono">
                <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300">
                  ● LVK: Equilibrio
                </span>
                <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                  ● LCK: Conservación
                </span>
              </div>
            </div>

            {/* LCD Matrix Display Readouts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-[#050811] border border-slate-800">
                <span className="text-[10px] font-mono text-slate-400 block uppercase">
                  RESISTENCIA EQ (R_eq)
                </span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-mono font-bold text-cyan-300 tabular-nums">
                    {Number.isFinite(topologyResult.equivalentResistance)
                      ? topologyResult.equivalentResistance.toFixed(2)
                      : '∞'}
                  </span>
                  <span className="text-xs font-mono text-slate-400">Ω</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#050811] border border-slate-800">
                <span className="text-[10px] font-mono text-slate-400 block uppercase">
                  CORRIENTE TOTAL (I_T)
                </span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span
                    data-testid="ammeter-readout"
                    className="text-2xl font-mono font-bold text-amber-400 tabular-nums"
                  >
                    {topologyResult.totalCurrent.toFixed(3)}
                  </span>
                  <span className="text-xs font-mono text-slate-400">A</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#050811] border border-slate-800">
                <span className="text-[10px] font-mono text-slate-400 block uppercase">
                  POTENCIA JOULE (P_T)
                </span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-mono font-bold text-emerald-400 tabular-nums">
                    {topologyResult.totalPower.toFixed(2)}
                  </span>
                  <span className="text-xs font-mono text-slate-400">W</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#050811] border border-slate-800">
                <span className="text-[10px] font-mono text-slate-400 block uppercase">
                  SONDAS V+ / COM (ΔV)
                </span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span
                    data-testid="multimeter-readout"
                    className="text-2xl font-mono font-bold text-white tabular-nums"
                  >
                    {multimeterVoltage.toFixed(2)}
                  </span>
                  <span className="text-xs font-mono text-cyan-400">VDC</span>
                </div>
              </div>
            </div>

            {/* Natural Language Diagnostic Banner */}
            <div
              className={`p-3 rounded-lg border text-xs font-mono flex items-center justify-between gap-3 ${
                topologyResult.isShortCircuitFault
                  ? 'bg-rose-950/60 border-rose-500 text-rose-200'
                  : topologyResult.isOpenCircuitFault
                  ? 'bg-amber-950/60 border-amber-500 text-amber-200'
                  : 'bg-[#070B14] border-slate-800 text-cyan-200'
              }`}
            >
              <span>
                {lang === 'es'
                  ? topologyResult.diagnosticMessageEs
                  : topologyResult.diagnosticMessageEn}
              </span>
              <span className="shrink-0 text-[11px] text-slate-400">
                {topologyResult.kvlEquationText}
              </span>
            </div>

            {/* Analytical Breakdown Table Per Branch (R1, R2, R3) */}
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#090D16] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Rama</th>
                    <th className="py-2 px-3">R Nominal</th>
                    <th className="py-2 px-3">Caída V_k</th>
                    <th className="py-2 px-3">Corriente I_k</th>
                    <th className="py-2 px-3">Potencia P_k</th>
                    <th className="py-2 px-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 bg-[#070A12]">
                  {topologyResult.branches.map((b) => (
                    <tr key={b.branchId}>
                      <td className="py-2 px-3 font-bold text-cyan-300">{b.branchId}</td>
                      <td className="py-2 px-3 text-slate-200">{b.nominalOhms} Ω</td>
                      <td className="py-2 px-3 text-amber-300">{b.voltageDrop.toFixed(2)} V</td>
                      <td className="py-2 px-3 text-sky-300">{b.current.toFixed(3)} A</td>
                      <td className="py-2 px-3 text-emerald-300">{b.power.toFixed(2)} W</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            b.faultState === 'ON'
                              ? 'bg-emerald-950 text-emerald-300'
                              : b.faultState === 'OPEN'
                              ? 'bg-amber-950 text-amber-300'
                              : 'bg-rose-950 text-rose-300'
                          }`}
                        >
                          {b.faultState}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Multimeter Probe Terminal Selectors */}
            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <label htmlFor="probe-red" className="block text-[11px] text-rose-400 font-mono mb-1">
                  Sonda 3D Roja (V+)
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
                  Sonda 3D Negra (COM)
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
            </div>
          </div>
        </div>

        {/* Right 5 Cols: ZONA 1 (Controles V, R1..R3, Fallas ON/ABRIR/CORTO) + Inspector MNA + ZONA 3 (2 Gráficas) */}
        <div className="lg:col-span-5 space-y-4">
          {/* ZONA 1: Controles de Fuente DC (0-48V), Resistencias R1..R3 (1-100Ω) y Modos de Falla */}
          <div className="p-5 rounded-xl bg-[#0D1322] border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">
                  ZONA 1 · Banco de Control DC y Simulación de Fallas
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
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setSourceVoltage(v);
                }}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            {/* R1, R2, R3 Sliders (1 - 100 Ω) + ON / ABRIR / CORTO Fault Switches */}
            {(
              [
                { id: 'R1', compId: 'res-1', val: r1, setVal: setR1, fault: f1, setFault: setF1 },
                { id: 'R2', compId: 'res-2', val: r2, setVal: setR2, fault: f2, setFault: setF2 },
                { id: 'R3', compId: 'res-3', val: r3, setVal: setR3, fault: f3, setFault: setF3 },
              ] as const
            ).map((branch) => (
              <div
                key={branch.id}
                className="p-3 rounded-lg bg-[#07090E] border border-slate-800/90 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor={`slider-${branch.id}`}
                    className="text-xs font-mono font-bold text-cyan-300"
                  >
                    Resistencia {branch.id}: {branch.val} Ω
                  </label>

                  {/* Fault Mode Buttons: ON / ABRIR / CORTO */}
                  <div className="flex items-center gap-1">
                    {(
                      [
                        { state: 'ON', label: 'ON', title: 'Operación normal de la resistencia' },
                        { state: 'OPEN', label: 'ABRIR', title: 'Cortar / abrir la pata de la resistencia (R → ∞)' },
                        { state: 'SHORT', label: 'CORTO', title: 'Cortocircuito físico real (dispara protección OCP y detiene el circuito)' },
                      ] as Array<{ state: BranchFaultState; label: string; title: string }>
                    ).map((btn) => (
                      <button
                        key={btn.state}
                        type="button"
                        title={btn.title}
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
                </div>

                <input
                  id={`slider-${branch.id}`}
                  type="range"
                  min={1}
                  max={100}
                  step={1}
                  value={Math.min(100, branch.val)}
                  onChange={(e) => {
                    const nextVal = parseInt(e.target.value, 10);
                    branch.setVal(nextVal);
                  }}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            ))}

            {/* Explicación Física Interactiva: MNA Dinámico, Circuito Abierto (ABRIR) y Cortocircuito Físico Real (CORTO) */}
            <div className="p-3.5 rounded-xl bg-[#070B14] border border-slate-800 space-y-2.5 text-[11px] leading-relaxed">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono font-bold text-cyan-300">
                  🔬 Motor MNA Dinámico: Ajuste en Mesa 3D y Protección de Cortocircuito Real
                </span>
                {(f1 !== 'ON' || f2 !== 'ON' || f3 !== 'ON') && (
                  <button
                    type="button"
                    onClick={() => {
                      setF1('ON');
                      setF2('ON');
                      setF3('ON');
                    }}
                    className="px-2 py-0.5 rounded bg-cyan-500 text-slate-950 font-mono font-bold text-[10px] cursor-pointer"
                  >
                    Restaurar R₁, R₂, R₃ a ON
                  </button>
                )}
              </div>
              <p className="text-slate-300">
                <strong className="text-cyan-300">1. Arrastre 3D Dinámico (Ley de Ohm y Kirchhoff):</strong>{' '}
                Arrastra cualquier resistencia (<span className="font-mono">R₁, R₂, R₃</span>) en la mesa 3D hacia los lados para variar su resistencia en vivo, o jálala hacia afuera de los postes para desconectarla físicamente (<span className="font-mono">ABRIR</span>).
              </p>
              <p className="text-slate-300">
                <strong className="text-rose-400">2. Cortocircuito Físico Real (CORTO / Protección OCP):</strong>{' '}
                En condiciones de cortocircuito físico real (<span className="font-mono">CORTO</span> o <span className="font-mono">R_eq → 0 Ω</span>), la fuente DC activa de inmediato su <strong>Protección contra Sobrecorriente (OCP)</strong>, cortando la salida (<span className="font-mono">V = 0.00 V, I = 0.000 A</span>), apagando la bombilla y deteniendo los electrones para impedir que el sistema siga operando en falla.
              </p>
              <div className="pt-1 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setF1('OPEN');
                    setF2('ON');
                    setF3('ON');
                  }}
                  className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-200 font-mono text-[10px] cursor-pointer"
                >
                  ✂️ Probar: Cortar R₁ (ABRIR)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setF1('SHORT');
                    setF2('ON');
                    setF3('ON');
                  }}
                  className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/50 text-rose-200 font-mono text-[10px] cursor-pointer"
                >
                  ⚡ Probar: Cortocircuito Físico (OCP)
                </button>
              </div>
            </div>

            {/* Optional RC + LED 3D Sandbox Controls */}
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
                    <span className="text-cyan-300 font-bold">
                      {rcState.capacitorVoltage.toFixed(2)} V
                    </span>
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
          </div>

          {/* ZONA 3: Dos Gráficas Dinámicas a 60 FPS (V vs. I + Hipérbola I vs. R_eq) */}
          <div className="p-5 rounded-xl bg-[#0D1322] border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span>ZONA 3 · Osciloscopio Dual (V vs. I &amp; Hipérbola I vs. R)</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Pendiente R_reg = {regression.slopeResistance.toFixed(1)} Ω · Punto de operación en vivo
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Gráfica 1: Voltaje vs Corriente (Ley de Ohm Lineal) */}
              <div className="p-2.5 rounded-lg bg-[#07090E] border border-slate-800">
                <span className="text-[10px] font-mono text-cyan-300 block mb-1">
                  1. Linealidad V vs. I (Pendiente = R_eq)
                </span>
                <svg viewBox="0 0 220 130" className="w-full h-28">
                  <line x1="28" y1="12" x2="28" y2="110" stroke="#334155" strokeWidth="1" />
                  <line x1="28" y1="110" x2="205" y2="110" stroke="#334155" strokeWidth="1" />
                  <line
                    x1="28"
                    y1="110"
                    x2="195"
                    y2="20"
                    stroke="#06B6D4"
                    strokeWidth="2"
                    strokeDasharray="3 2"
                  />
                  {/* Punto de operación móvil */}
                  {(() => {
                    const normV = Math.min(1, topologyResult.sourceVoltage / 48);
                    const cx = 28 + normV * 165;
                    const cy = 110 - normV * 88;
                    return <circle cx={cx} cy={cy} r="5" fill="#F59E0B" stroke="#FFF" strokeWidth="1.5" />;
                  })()}
                </svg>
              </div>

              {/* Gráfica 2: Corriente vs Resistencia (Hipérbola I = V / R) */}
              <div className="p-2.5 rounded-lg bg-[#07090E] border border-slate-800">
                <span className="text-[10px] font-mono text-purple-300 block mb-1">
                  2. Hipérbola I vs. R_eq (I = V / R)
                </span>
                <svg viewBox="0 0 220 130" className="w-full h-28">
                  <line x1="28" y1="12" x2="28" y2="110" stroke="#334155" strokeWidth="1" />
                  <line x1="28" y1="110" x2="205" y2="110" stroke="#334155" strokeWidth="1" />
                  <path
                    d="M 35 18 Q 55 92 200 104"
                    fill="none"
                    stroke="#A855F7"
                    strokeWidth="2"
                  />
                  {(() => {
                    const reqClamped = Number.isFinite(topologyResult.equivalentResistance)
                      ? Math.min(150, Math.max(5, topologyResult.equivalentResistance))
                      : 150;
                    const normR = (reqClamped - 5) / 145;
                    const cx = 35 + normR * 160;
                    const cy = 106 - (1 - normR) ** 2.2 * 84;
                    return <circle cx={cx} cy={cy} r="5" fill="#22D3EE" stroke="#FFF" strokeWidth="1.5" />;
                  })()}
                </svg>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRecordPoint}
                className="flex-1 py-1.5 px-3 rounded-lg bg-cyan-500 text-slate-950 font-semibold text-xs hover:bg-cyan-400 transition-colors cursor-pointer"
              >
                {t.recordDataPoint} ({recordedPoints.length})
              </button>
              <button
                type="button"
                onClick={() => setRecordedPoints([])}
                className="py-1.5 px-3 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {t.clearGraphData}
              </button>
            </div>
          </div>

          {/* Inspector Individual MNA (Para Reto 1 Divisor y Reto 2 Caja Negra) */}
          {selectedComponent && (
            <div className="p-4 rounded-xl bg-[#0D1322] border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-white">
                  {t.selectedCompTitle}: {selectedComponent.label}
                </span>
                <span className="text-[11px] font-mono text-cyan-400 uppercase">
                  {selectedComponent.type}
                </span>
              </div>

              {(selectedComponent.type === 'resistor' || selectedComponent.type === 'bulb') && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label htmlFor="resistance-slider" className="text-slate-300">
                      {t.resistanceLabel}
                    </label>
                    <span className="font-mono font-bold text-cyan-300">
                      {selectedComponent.resistance} Ω
                    </span>
                  </div>
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

                  {selectedComponent.type === 'resistor' && (
                    <div className="mt-2 grid grid-cols-4 gap-1">
                      {(eiaBandMode === 5
                        ? getResistorColorBands5(selectedComponent.resistance).slice(0, 4)
                        : getResistorColorBands(selectedComponent.resistance)
                      ).map((band, i) => (
                        <div
                          key={i}
                          className="p-1 rounded bg-[#07090E] border border-slate-800 text-center"
                        >
                          <div
                            className="w-full h-2.5 rounded-sm mb-0.5"
                            style={{ backgroundColor: band.hex }}
                          />
                          <span className="text-[9px] font-mono text-slate-300 block truncate">
                            {lang === 'es' ? band.nameEs : band.nameEn}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedComponent.type === 'battery' && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label htmlFor="battery-voltage-slider" className="text-slate-300">
                      {t.voltageLabel}
                    </label>
                    <span className="font-mono font-bold text-amber-400">
                      {(selectedComponent.voltage ?? 10).toFixed(1)} V
                    </span>
                  </div>
                  <input
                    id="battery-voltage-slider"
                    type="range"
                    min={0.5}
                    max={60}
                    step={0.5}
                    value={selectedComponent.voltage ?? 10}
                    onChange={(e) =>
                      updateSelectedComponent({ voltage: parseFloat(e.target.value) })
                    }
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>
              )}

              <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-slate-800">
                <span className="text-slate-400">
                  ΔV: {(solution.componentStates[selectedComponent.id]?.voltageDrop ?? 0).toFixed(2)}V · I:{' '}
                  {Math.abs(solution.componentStates[selectedComponent.id]?.current ?? 0).toFixed(3)}A
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddComponent}
                    className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nodo</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Eliminar componente"
                    onClick={() => {
                      if (components.length <= 2) return;
                      setComponents((prev) => prev.filter((c) => c.id !== selectedComponent.id));
                    }}
                    className="text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ZONA 4: Módulo de Evaluación y Defensa Científica (10 Preguntas Interactivas con Píldoras 1..10) */}
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

        {/* Navigation Pills 1..10 */}
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

        {/* Current Question Card */}
        {currentQuestion && (
          <div className="p-4 rounded-xl bg-[#07090E] border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-cyan-400">
              <span>
                PREGUNTA {currentQuestion.id} DE 10 · {currentQuestion.category.toUpperCase()}
              </span>
            </div>
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
    </div>
  );
};
