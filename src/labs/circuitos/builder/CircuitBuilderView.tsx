import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCw,
  Trash2,
  Plus,
  Zap,
  Flame,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Cable,
  Gauge,
  Volume2,
  VolumeX,
  Check,
  X,
  Sliders,
  Sparkles,
  Wrench,
  Eye,
  Box,
  Camera,
  Columns,
} from 'lucide-react';
import { Language } from '../../../assets/js/i18n';
import { audioSynth } from '../../../assets/js/audio-synth';
import {
  SandboxComponent,
  SandboxComponentType,
  SandboxWire,
  VoltmeterProbes,
  ChargeFlowDisplayMode,
  CircuitVisualStyle,
  SandboxPresetId,
  solveSandboxCircuit,
  createSandboxPreset,
  getEia4Bands,
} from './NodalSolver';
import { SandboxWorkbench3D, CameraPreset3D } from './SandboxWorkbench3D';

interface CircuitBuilderViewProps {
  lang: Language;
}

interface ToolboxItemSpec {
  type: SandboxComponentType;
  category: 'sources' | 'loads' | 'control' | 'instruments';
  titleEs: string;
  titleEn: string;
  subtitleEs: string;
  badge: string;
}

const TOOLBOX_ITEMS: ToolboxItemSpec[] = [
  {
    type: 'battery',
    category: 'sources',
    titleEs: 'Batería / Pila DC',
    titleEn: 'DC Battery',
    subtitleEs: '0.5 V – 48.0 V (Por defecto 9V)',
    badge: '9.0 V',
  },
  {
    type: 'resistor',
    category: 'loads',
    titleEs: 'Resistencia Axial',
    titleEn: 'Axial Resistor',
    subtitleEs: '1 Ω – 10 kΩ · Bandas EIA',
    badge: '10 Ω',
  },
  {
    type: 'bulb',
    category: 'loads',
    titleEs: 'Bombilla Incandescente',
    titleEn: 'Incandescent Bulb',
    subtitleEs: 'Brillo P = I²·R (Máx 15W)',
    badge: '15 W',
  },
  {
    type: 'buzzer',
    category: 'loads',
    titleEs: 'Zumbador / Buzzer',
    titleEn: 'Audio Buzzer',
    subtitleEs: 'Onda sónica Web Audio API',
    badge: '25 Ω',
  },
  {
    type: 'switch',
    category: 'control',
    titleEs: 'Interruptor Unipolar',
    titleEn: 'SPST Switch',
    subtitleEs: 'Alterna ABIERTO / CERRADO',
    badge: 'SPST',
  },
  {
    type: 'pushbutton',
    category: 'control',
    titleEs: 'Pulsador (Push Button)',
    titleEn: 'Push Button',
    subtitleEs: 'Cierra al mantener presionado',
    badge: 'NO',
  },
  {
    type: 'fuse',
    category: 'control',
    titleEs: 'Fusible de Protección',
    titleEn: 'Safety Fuse',
    subtitleEs: 'Se funde si I > I_nominal',
    badge: '2.0 A',
  },
  {
    type: 'ammeter',
    category: 'instruments',
    titleEs: 'Amperímetro de Rama',
    titleEn: 'Series Ammeter',
    subtitleEs: 'Mide corriente I (A) en serie',
    badge: 'A⎓',
  },
];

const SNAP_GRID = 20;
const TERMINAL_OFFSET = 56;

function snapToGrid(val: number): number {
  return Math.round(val / SNAP_GRID) * SNAP_GRID;
}

/**
 * Calcula las coordenadas exactas (x, y) en el lienzo de los terminales A y B de un componente
 * considerando su posición central y rotación (0, 90, 180, 270).
 */
export function getComponentTerminalCoords(comp: SandboxComponent): {
  A: { x: number; y: number };
  B: { x: number; y: number };
} {
  const rad = (comp.rotation * Math.PI) / 180;
  const dx = Math.cos(rad) * TERMINAL_OFFSET;
  const dy = Math.sin(rad) * TERMINAL_OFFSET;
  return {
    A: { x: Math.round(comp.x - dx), y: Math.round(comp.y - dy) },
    B: { x: Math.round(comp.x + dx), y: Math.round(comp.y + dy) },
  };
}

export const CircuitBuilderView: React.FC<CircuitBuilderViewProps> = ({ lang }) => {
  const initialPreset = useMemo(() => createSandboxPreset('simple-bulb'), []);

  const [components, setComponents] = useState<SandboxComponent[]>(initialPreset.components);
  const [wires, setWires] = useState<SandboxWire[]>(initialPreset.wires);
  const [voltmeter, setVoltmeter] = useState<VoltmeterProbes>(initialPreset.voltmeter);

  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [workspaceDimension, setWorkspaceDimension] = useState<'3d' | 'split' | '2d'>('3d');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('perspective');
  const [cameraResetToken, setCameraResetToken] = useState<number>(0);
  const [visualStyle, setVisualStyle] = useState<CircuitVisualStyle>('realistic');
  const [flowMode, setFlowMode] = useState<ChargeFlowDisplayMode>('electrons');
  const [drawerOpen, setDrawerOpen] = useState<boolean>(true);
  const [audioMuted, setAudioMuted] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<SandboxPresetId>('simple-bulb');

  const [selectedCompId, setSelectedCompId] = useState<string | null>('bulb-1');
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [wiringMode, setWiringMode] = useState<boolean>(false);
  const [pendingTerminal, setPendingTerminal] = useState<string | null>(null);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(null);
  const [probePlacementTarget, setProbePlacementTarget] = useState<'red' | 'black' | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState<boolean>(false);

  // Estado de arrastre de componentes en el lienzo
  const [draggingComp, setDraggingComp] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<number>(0);

  // Resolver el grafo nodal en tiempo real
  const solverResult = useMemo(
    () =>
      solveSandboxCircuit(components, wires, {
        isRunning,
        voltmeter,
      }),
    [components, wires, isRunning, voltmeter]
  );

  // Aplicar automáticamente rotura de fusibles o quemado térmico de bombillas cuando el solver lo detecta
  useEffect(() => {
    if (!isRunning) return;
    const { blownFuseIds, burnedComponentIds } = solverResult;
    if (blownFuseIds.length === 0 && burnedComponentIds.length === 0) return;

    const timer = window.setTimeout(() => {
      if (blownFuseIds.length > 0 || burnedComponentIds.length > 0) {
        if (!audioMuted) {
          audioSynth.playBurnoutSound();
        }
        setComponents((prev) =>
          prev.map((c) => {
            if (blownFuseIds.includes(c.id)) {
              return { ...c, isBlown: true };
            }
            if (burnedComponentIds.includes(c.id)) {
              return { ...c, isBurnedOut: true };
            }
            return c;
          })
        );
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [solverResult, isRunning, audioMuted]);

  // Efecto sonoro para Zumbador (Buzzer) y alarma de cortocircuito
  useEffect(() => {
    if (!isRunning || audioMuted) {
      audioSynth.stopCircuitHum();
      return;
    }
    if (solverResult.isShortCircuit) {
      audioSynth.playShortCircuitAlarm();
    } else if (solverResult.activeBuzzerIds.length > 0) {
      audioSynth.updateCircuitHum(0.85);
    } else {
      audioSynth.stopCircuitHum();
    }
    return () => {
      audioSynth.stopCircuitHum();
    };
  }, [solverResult.isShortCircuit, solverResult.activeBuzzerIds.length, isRunning, audioMuted]);

  // Mapa rápido de coordenadas de cada terminal `${comp.id}:A` y `${comp.id}:B`
  const terminalCoordsMap = useMemo(() => {
    const map: Record<string, { x: number; y: number; compId: string; pin: 'A' | 'B' }> = {};
    for (const c of components) {
      const coords = getComponentTerminalCoords(c);
      map[`${c.id}:A`] = { ...coords.A, compId: c.id, pin: 'A' };
      map[`${c.id}:B`] = { ...coords.B, compId: c.id, pin: 'B' };
    }
    return map;
  }, [components]);

  const selectedComponent = useMemo(
    () => components.find((c) => c.id === selectedCompId) ?? null,
    [components, selectedCompId]
  );

  // Atajos de teclado: R para rotar 90°, Delete/Backspace para eliminar componente o cable seleccionado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'r' || e.key === 'R') {
        if (selectedCompId) {
          e.preventDefault();
          setComponents((prev) =>
            prev.map((c) =>
              c.id === selectedCompId
                ? { ...c, rotation: (((c.rotation + 90) % 360) as 0 | 90 | 180 | 270) }
                : c
            )
          );
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedWireId) {
          e.preventDefault();
          setWires((prev) => prev.filter((w) => w.id !== selectedWireId));
          setSelectedWireId(null);
        } else if (selectedCompId) {
          e.preventDefault();
          setComponents((prev) => prev.filter((c) => c.id !== selectedCompId));
          setWires((prev) =>
            prev.filter(
              (w) =>
                !w.fromTerminal.startsWith(`${selectedCompId}:`) &&
                !w.toTerminal.startsWith(`${selectedCompId}:`)
            )
          );
          setSelectedCompId(null);
        }
      } else if (e.key === 'Escape') {
        setPendingTerminal(null);
        setProbePlacementTarget(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCompId, selectedWireId]);

  // Animación a 60 FPS de partículas de corriente sobre el Canvas superpuesto
  useEffect(() => {
    const canvas = particleCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;

    const renderParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (isRunning && !solverResult.isShortCircuit) {
        phaseRef.current = (phaseRef.current + 0.016) % 1000;
      } else if (isRunning && solverResult.isShortCircuit) {
        phaseRef.current = (phaseRef.current + 0.045) % 1000;
      }

      const drawSegmentParticles = (
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        currentAmps: number,
        isShort: boolean
      ) => {
        if (Math.abs(currentAmps) < 0.001) return;
        const dist = Math.hypot(x2 - x1, y2 - y1);
        if (dist < 12) return;

        // Dirección física: electrones van en sentido opuesto a la corriente convencional
        const sign =
          flowMode === 'electrons'
            ? currentAmps > 0
              ? -1
              : 1
            : currentAmps > 0
            ? 1
            : -1;

        const speed = isShort
          ? 4.2
          : Math.min(3.5, Math.max(0.28, Math.log10(1 + Math.abs(currentAmps) * 6) * 1.4));

        const count = Math.max(3, Math.min(9, Math.round(dist / 36)));
        const angle = Math.atan2(y2 - y1, x2 - x1) + (sign < 0 ? Math.PI : 0);

        for (let i = 0; i < count; i++) {
          let t = ((i / count) + phaseRef.current * speed * 0.25 * sign) % 1;
          if (t < 0) t += 1;

          const px = x1 + (x2 - x1) * t;
          const py = y1 + (y2 - y1) * t;

          ctx.save();
          if (flowMode === 'arrows') {
            ctx.translate(px, py);
            ctx.rotate(angle);
            ctx.fillStyle = isShort ? '#EF4444' : '#F59E0B';
            ctx.beginPath();
            ctx.moveTo(6, 0);
            ctx.lineTo(-5, -4);
            ctx.lineTo(-5, 4);
            ctx.closePath();
            ctx.fill();
          } else {
            ctx.fillStyle = isShort
              ? '#EF4444'
              : flowMode === 'electrons'
              ? '#38BDF8'
              : '#F59E0B';
            ctx.beginPath();
            ctx.arc(px, py, isShort ? 4.5 : 3.8, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      };

      // 1. Partículas sobre cada componente activo
      for (const comp of components) {
        const branch = solverResult.branches[comp.id];
        if (!branch || Math.abs(branch.current) < 0.001) continue;
        const coords = getComponentTerminalCoords(comp);
        // En una batería la corriente convencional fluye internamente de A (-) hacia B (+)
        // En cargas pasivas la corriente convencional fluye de A hacia B cuando branch.current > 0
        drawSegmentParticles(
          coords.A.x,
          coords.A.y,
          coords.B.x,
          coords.B.y,
          branch.current,
          branch.isShortPath
        );
      }

      // 2. Partículas sobre cada cable conductor
      for (const w of wires) {
        const p1 = terminalCoordsMap[w.fromTerminal];
        const p2 = terminalCoordsMap[w.toTerminal];
        const wState = solverResult.wireStates[w.id];
        if (!p1 || !p2 || !wState || Math.abs(wState.current) < 0.001) continue;
        drawSegmentParticles(
          p1.x,
          p1.y,
          p2.x,
          p2.y,
          wState.current,
          wState.isShortPath
        );
      }

      if (isRunning) {
        animId = requestAnimationFrame(renderParticles);
      }
    };

    renderParticles();
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [components, wires, solverResult, isRunning, flowMode, terminalCoordsMap]);

  // Convertir coordenadas de cliente (mouse/touch) al espacio SVG 920x520
  const clientToCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 460, y: 260 };
    const rect = svg.getBoundingClientRect();
    const scaleX = 920 / Math.max(1, rect.width);
    const scaleY = 520 / Math.max(1, rect.height);
    return {
      x: Math.max(40, Math.min(880, (clientX - rect.left) * scaleX)),
      y: Math.max(40, Math.min(480, (clientY - rect.top) * scaleY)),
    };
  }, []);

  // Añadir un nuevo componente desde el Toolbox Drawer al centro de la mesa (o en posición libre)
  const handleAddComponent = (type: SandboxComponentType, customPos?: { x: number; y: number }) => {
    const count = components.filter((c) => c.type === type).length + 1;
    const id = `${type}-${Date.now().toString().slice(-4)}-${count}`;
    const offset = ((components.length % 5) - 2) * 20;
    const x = snapToGrid(customPos?.x ?? 460 + offset);
    const y = snapToGrid(customPos?.y ?? 260 + offset);

    const labelMap: Record<SandboxComponentType, string> = {
      battery: `Batería ${count}`,
      resistor: `R${count}`,
      bulb: `Bombilla ${count}`,
      buzzer: `Buzzer ${count}`,
      switch: `SW${count}`,
      pushbutton: `Pulsador ${count}`,
      fuse: `Fusible ${count}`,
      ammeter: `Amperímetro ${count}`,
    };

    const newComp: SandboxComponent = {
      id,
      type,
      label: labelMap[type],
      x,
      y,
      rotation: 0,
      voltage: type === 'battery' ? 9 : undefined,
      resistance:
        type === 'resistor'
          ? 10
          : type === 'bulb'
          ? 10
          : type === 'buzzer'
          ? 25
          : undefined,
      maxWatts: type === 'bulb' ? 15 : undefined,
      maxCurrentAmps: type === 'fuse' ? 2.0 : undefined,
      isClosed: type === 'switch' ? true : undefined,
      isPressed: type === 'pushbutton' ? false : undefined,
      isBurnedOut: false,
      isBlown: false,
    };

    if (!audioMuted) audioSynth.playSwitchClick(true);
    setComponents((prev) => [...prev, newComp]);
    setSelectedCompId(id);
    setSelectedWireId(null);
  };

  // Conectar dos terminales con un cable conductor
  const handleTerminalSelect = (terminalId: string) => {
    // Si estamos colocando una sonda del voltímetro
    if (probePlacementTarget === 'red') {
      setVoltmeter((prev) => ({ ...prev, enabled: true, redTerminal: terminalId }));
      setProbePlacementTarget(null);
      return;
    }
    if (probePlacementTarget === 'black') {
      setVoltmeter((prev) => ({ ...prev, enabled: true, blackTerminal: terminalId }));
      setProbePlacementTarget(null);
      return;
    }

    if (!pendingTerminal) {
      setPendingTerminal(terminalId);
      return;
    }

    if (pendingTerminal === terminalId) {
      setPendingTerminal(null);
      return;
    }

    // Evitar cables duplicados entre los mismos dos terminales
    const alreadyExists = wires.some(
      (w) =>
        (w.fromTerminal === pendingTerminal && w.toTerminal === terminalId) ||
        (w.fromTerminal === terminalId && w.toTerminal === pendingTerminal)
    );

    if (!alreadyExists) {
      const newWire: SandboxWire = {
        id: `wire-${Date.now().toString().slice(-5)}`,
        fromTerminal: pendingTerminal,
        toTerminal: terminalId,
      };
      if (!audioMuted) audioSynth.playSwitchClick(true);
      setWires((prev) => [...prev, newWire]);
    }
    setPendingTerminal(null);
  };

  // Cargar un circuito preconfigurado (Preset)
  const handleLoadPreset = (presetId: SandboxPresetId) => {
    const preset = createSandboxPreset(presetId);
    setActivePreset(presetId);
    setComponents(preset.components);
    setWires(preset.wires);
    setVoltmeter(preset.voltmeter);
    setSelectedCompId(preset.components[0]?.id ?? null);
    setSelectedWireId(null);
    setPendingTerminal(null);
    setConfirmClearOpen(false);
  };

  // Inyectar demostración rápida de cortocircuito para aprendizaje
  const handleTriggerShortCircuitDemo = () => {
    const comps: SandboxComponent[] = [
      {
        id: 'bat-short',
        type: 'battery',
        label: 'Batería 12V',
        x: 320,
        y: 260,
        rotation: 270,
        voltage: 12,
      },
      {
        id: 'sw-short',
        type: 'switch',
        label: 'SW Corto',
        x: 560,
        y: 260,
        rotation: 90,
        isClosed: true,
      },
    ];
    const demoWires: SandboxWire[] = [
      { id: 'w-s1', fromTerminal: 'bat-short:B', toTerminal: 'sw-short:A' },
      { id: 'w-s2', fromTerminal: 'sw-short:B', toTerminal: 'bat-short:A' },
    ];
    setComponents(comps);
    setWires(demoWires);
    setSelectedCompId('sw-short');
    setSelectedWireId(null);
    setPendingTerminal(null);
  };

  // Actualizar propiedad del componente seleccionado
  const updateSelectedComponent = (patch: Partial<SandboxComponent>) => {
    if (!selectedCompId) return;
    setComponents((prev) =>
      prev.map((c) => (c.id === selectedCompId ? { ...c, ...patch } : c))
    );
  };

  // Eliminar componente seleccionado
  const handleDeleteSelectedComponent = () => {
    if (!selectedCompId) return;
    setComponents((prev) => prev.filter((c) => c.id !== selectedCompId));
    setWires((prev) =>
      prev.filter(
        (w) =>
          !w.fromTerminal.startsWith(`${selectedCompId}:`) &&
          !w.toTerminal.startsWith(`${selectedCompId}:`)
      )
    );
    setSelectedCompId(null);
  };

  return (
    <div className="space-y-4" data-testid="circuit-sandbox-builder">
      {/* BARRA SUPERIOR DE CONTROLES DE SIMULACIÓN */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-3.5 rounded-xl bg-[#0B101E] border border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle Menú Lateral (Toolbox Drawer) */}
          <button
            type="button"
            data-testid="toolbox-drawer-toggle"
            onClick={() => setDrawerOpen((prev) => !prev)}
            className="touch-target flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111827] hover:bg-slate-800 border border-slate-700 text-xs font-mono font-semibold text-slate-200 transition-colors cursor-pointer"
          >
            {drawerOpen ? <ChevronLeft className="w-4 h-4 text-cyan-400" /> : <ChevronRight className="w-4 h-4 text-cyan-400" />}
            <span>{drawerOpen ? 'Ocultar Componentes' : 'Mostrar Componentes'}</span>
          </button>

          {/* Play / Pause */}
          <button
            type="button"
            data-testid="builder-play-pause"
            onClick={() => setIsRunning((prev) => !prev)}
            className={`touch-target flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${
              isRunning
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                : 'bg-amber-500/20 border-amber-400 text-amber-300'
            }`}
          >
            {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isRunning ? 'SIMULACIÓN: ACTIVA' : 'SIMULACIÓN: PAUSADA'}</span>
          </button>

          {/* Selector de Dimensión: Mesa 3D WebGL / Vista Dividida / Esquemático 2D */}
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#070A12] border border-slate-800">
            <button
              type="button"
              data-testid="builder-dimension-3d"
              onClick={() => setWorkspaceDimension('3d')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-bold whitespace-nowrap transition-colors cursor-pointer ${
                workspaceDimension === '3d'
                  ? 'bg-cyan-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>Mesa 3D (WebGL)</span>
            </button>
            <button
              type="button"
              data-testid="builder-dimension-split"
              onClick={() => setWorkspaceDimension('split')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                workspaceDimension === 'split'
                  ? 'bg-cyan-400 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>3D + Plano 2D</span>
            </button>
            <button
              type="button"
              data-testid="builder-dimension-2d"
              onClick={() => setWorkspaceDimension('2d')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                workspaceDimension === '2d'
                  ? 'bg-cyan-400 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Plano 2D</span>
            </button>
          </div>

          {/* Switch Vista Realista / Símbolo Esquemático */}
          <button
            type="button"
            data-testid="builder-style-toggle"
            onClick={() =>
              setVisualStyle((prev) => (prev === 'realistic' ? 'schematic' : 'realistic'))
            }
            className="touch-target flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111827] hover:bg-slate-800 border border-slate-700 text-xs font-mono font-semibold text-cyan-300 transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>
              {visualStyle === 'realistic'
                ? 'Vista: Realista 3D/EIA'
                : 'Vista: Esquemático IEEE/IEC'}
            </span>
          </button>

          {/* Selector de Flujo de Carga */}
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#070A12] border border-slate-800">
            {(
              [
                { id: 'electrons', label: 'Electrones (e⁻)' },
                { id: 'conventional', label: 'Convencional (I)' },
                { id: 'arrows', label: 'Flechas' },
              ] as Array<{ id: ChargeFlowDisplayMode; label: string }>
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setFlowMode(mode.id)}
                className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  flowMode === mode.id
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Presets, Modo Cableado, Audio y Limpiar Mesa */}
        <div className="flex flex-wrap items-center gap-2 max-w-full">
          <select
            aria-label="Circuitos de ejemplo"
            data-testid="builder-preset-select"
            value={activePreset}
            onChange={(e) => handleLoadPreset(e.target.value as SandboxPresetId)}
            className="touch-target w-full sm:w-auto max-w-full rounded-lg bg-[#111827] border border-slate-700 px-2.5 py-1.5 text-xs font-mono text-slate-200"
          >
            <option value="simple-bulb">Preset: Lazo Simple con Bombilla (9V)</option>
            <option value="voltage-divider">Preset: Divisor de Tensión (2 Resistencias)</option>
            <option value="parallel-fuse">Preset: Paralelo con Interruptor y Fusible (2A)</option>
            <option value="wheatstone">Preset: Puente de Wheatstone (3 Mallas)</option>
          </select>

          <button
            type="button"
            data-testid="builder-short-demo-btn"
            onClick={handleTriggerShortCircuitDemo}
            className="touch-target flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-900/80 border border-rose-500/50 text-rose-200 text-xs font-mono font-semibold transition-colors cursor-pointer"
            title="Simular qué ocurre al conectar ambos polos de la batería sin carga"
          >
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span>Probar Corto</span>
          </button>

          <button
            type="button"
            onClick={() => setAudioMuted((prev) => !prev)}
            className="touch-target p-2 rounded-lg bg-[#111827] border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
            title={audioMuted ? 'Activar sonido' : 'Silenciar sonido'}
          >
            {audioMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>

          {!confirmClearOpen ? (
            <button
              type="button"
              data-testid="builder-clear-btn"
              onClick={() => setConfirmClearOpen(true)}
              className="touch-target flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/70 border border-slate-700 hover:border-rose-500/60 text-xs font-mono text-slate-300 hover:text-rose-200 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpiar Mesa</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 p-1 rounded-lg bg-rose-950/90 border border-rose-500 text-xs font-mono">
              <span className="px-2 text-rose-200">¿Vaciar mesa?</span>
              <button
                type="button"
                data-testid="builder-confirm-clear-btn"
                onClick={() => {
                  setComponents([]);
                  setWires([]);
                  setSelectedCompId(null);
                  setSelectedWireId(null);
                  setPendingTerminal(null);
                  setConfirmClearOpen(false);
                }}
                className="px-2.5 py-1 rounded bg-rose-500 text-slate-950 font-bold cursor-pointer"
              >
                Sí, vaciar
              </button>
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="px-2 py-1 rounded bg-slate-800 text-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* BANNER DE ALERTA DE CORTOCIRCUITO FRANCO */}
      {solverResult.isShortCircuit && (
        <div
          role="alert"
          data-testid="builder-short-circuit-alert"
          className="p-4 rounded-xl bg-rose-950/90 border-2 border-rose-500 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-100 shadow-lg"
        >
          <div className="flex items-center gap-3">
            <Flame className="w-6 h-6 text-rose-400 shrink-0 animate-pulse" />
            <div>
              <strong className="text-sm font-mono uppercase text-rose-300 block">
                {solverResult.shortCircuitMessage}
              </strong>
              <span className="text-rose-200/90">
                Existe un camino de resistencia nula entre los bornes positivo (+) y negativo (-) de la batería. Abre el interruptor o inserta una carga resistiva / fusible en serie.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              // Si hay un interruptor cerrado, abrirlo; si no, eliminar el último cable
              const closedSw = components.find((c) => c.type === 'switch' && c.isClosed);
              if (closedSw) {
                setComponents((prev) =>
                  prev.map((c) => (c.id === closedSw.id ? { ...c, isClosed: false } : c))
                );
              } else if (wires.length > 0) {
                setWires((prev) => prev.slice(0, -1));
              }
            }}
            className="touch-target px-3.5 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 font-mono font-bold transition-colors cursor-pointer"
          >
            🔧 Cortar Paso de Corriente Ahora
          </button>
        </div>
      )}

      {/* CONTENEDOR PRINCIPAL: TOOLBOX DRAWER LATERAL + ÁREA DE TRABAJO (SANDBOX CANVAS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* A. MENÚ LATERAL DE COMPONENTES (TOOLBOX DRAWER) */}
        {drawerOpen && (
          <aside
            data-testid="builder-toolbox-drawer"
            className="lg:col-span-3 p-3.5 rounded-xl bg-[#0B101E] border border-slate-800 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 block">
                  TOOLBOX DRAWER 3D · PHET / TINKERCAD
                </span>
                <h3 className="text-sm font-bold text-white">Almacén de Componentes 3D</h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Clic o Arrastrar</span>
            </div>

            {/* Herramienta de Cableado Directo y Sondas de Voltímetro */}
            <div className="space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Conexiones e Instrumentación
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="toolbox-wire-mode-btn"
                  onClick={() => {
                    setWiringMode((prev) => !prev);
                    setPendingTerminal(null);
                  }}
                  className={`touch-target flex items-center justify-center gap-1.5 p-2.5 rounded-lg border text-xs font-mono font-semibold transition-colors cursor-pointer ${
                    wiringMode || pendingTerminal
                      ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-bold'
                      : 'bg-[#111827] hover:bg-slate-800 border-slate-700 text-cyan-300'
                  }`}
                >
                  <Cable className="w-4 h-4" />
                  <span>{wiringMode ? 'Cableando...' : 'Cable Conductor'}</span>
                </button>

                <button
                  type="button"
                  data-testid="toolbox-voltmeter-toggle"
                  onClick={() =>
                    setVoltmeter((prev) => ({
                      ...prev,
                      enabled: !prev.enabled,
                    }))
                  }
                  className={`touch-target flex items-center justify-center gap-1.5 p-2.5 rounded-lg border text-xs font-mono font-semibold transition-colors cursor-pointer ${
                    voltmeter.enabled
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-[#111827] hover:bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  <Gauge className="w-4 h-4" />
                  <span>Voltímetro V⎓</span>
                </button>
              </div>
            </div>

            {/* Tarjetas de Componentes Arrastrables y Clickeables */}
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {TOOLBOX_ITEMS.map((item) => (
                <div
                  key={item.type}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/x-sandbox-component', item.type);
                  }}
                  onClick={() => handleAddComponent(item.type)}
                  data-testid={`toolbox-add-${item.type}`}
                  className="group p-2.5 rounded-xl bg-[#111827]/90 hover:bg-slate-800/90 border border-slate-800 hover:border-cyan-500/50 flex items-center justify-between gap-2.5 transition-all cursor-pointer select-none"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                        {lang === 'es' ? item.titleEs : item.titleEn}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-cyan-300">
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{item.subtitleEs}</p>
                  </div>
                  <span className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-300 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-colors shrink-0">
                    <Plus className="w-4 h-4" />
                  </span>
                </div>
              ))}
            </div>

            <div className="p-2.5 rounded-lg bg-[#070A12] border border-slate-800/80 text-[11px] text-slate-400 space-y-1 font-mono">
              <div className="text-cyan-300 font-semibold">💡 Guía Rápida de Cableado:</div>
              <div>1. Haz clic en cualquier terminal circular (A o B) y luego en otro terminal para tender un cable.</div>
              <div>2. Arrastra componentes libremente; los cables se estiran automáticamente.</div>
              <div>3. Pulsa <kbd className="px-1 py-0.5 rounded bg-slate-800 text-white">R</kbd> para rotar 90° o <kbd className="px-1 py-0.5 rounded bg-slate-800 text-white">Supr</kbd> para borrar.</div>
            </div>
          </aside>
        )}

        {/* B. ÁREA DE TRABAJO INTERACTIVA (SANDBOX CANVAS / GRID) + INSPECTOR */}
        <div className={`${drawerOpen ? 'lg:col-span-9' : 'lg:col-span-12'} space-y-3`}>
          {/* Contenedor del Lienzo con Rejilla Milimetrada */}
          <div
            className="relative rounded-xl bg-[#070B14] border border-slate-800 overflow-hidden select-none shadow-2xl"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const compType = e.dataTransfer.getData(
                'application/x-sandbox-component'
              ) as SandboxComponentType;
              if (compType) {
                const pos = clientToCanvasCoords(e.clientX, e.clientY);
                handleAddComponent(compType, pos);
              }
            }}
          >
            {/* Cinta informativa superior dentro del lienzo */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-[#0B101E]/90 border-b border-slate-800/80 text-xs font-mono">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-cyan-400 font-semibold">
                  NODOS: {Object.keys(solverResult.nodes).length}
                </span>
                <span className="text-slate-300">
                  I_Fuente: <strong className="text-amber-300">{solverResult.totalSourceCurrent.toFixed(3)} A</strong>
                </span>
                <span className="text-slate-300">
                  P_Disipada: <strong className="text-emerald-300">{solverResult.totalPowerDissipated.toFixed(2)} W</strong>
                </span>
                {pendingTerminal && (
                  <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400 text-cyan-200 animate-pulse">
                    🔌 Conectando desde {pendingTerminal} → Haz clic en otro terminal (Esc para cancelar)
                  </span>
                )}
                {probePlacementTarget && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400 text-amber-200">
                    🎯 Haz clic en cualquier terminal para fijar la Sonda {probePlacementTarget === 'red' ? 'Roja (V+)' : 'Negra (COM)'}
                  </span>
                )}
              </div>

              {/* Widget de Voltímetro Digital Integrado */}
              {voltmeter.enabled && (
                <div
                  data-testid="builder-voltmeter-widget"
                  className="flex flex-wrap items-center gap-2 px-2.5 py-1 rounded-lg bg-[#070A12] border border-emerald-500/40"
                >
                  <span className="text-[11px] font-bold text-emerald-400">
                    VOLTÍMETRO ΔV ={' '}
                    {solverResult.voltmeterReading !== null
                      ? `${solverResult.voltmeterReading.toFixed(2)} V`
                      : '---'}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setProbePlacementTarget((prev) => (prev === 'red' ? null : 'red'))
                    }
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                      probePlacementTarget === 'red'
                        ? 'bg-rose-500 text-slate-950 border-rose-300'
                        : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
                    }`}
                  >
                    🔴 V+ ({voltmeter.redTerminal ?? 'Ninguno'})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setProbePlacementTarget((prev) => (prev === 'black' ? null : 'black'))
                    }
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                      probePlacementTarget === 'black'
                        ? 'bg-sky-400 text-slate-950 border-sky-200'
                        : 'bg-slate-900 border-sky-500/40 text-sky-300'
                    }`}
                  >
                    ⚫ COM ({voltmeter.blackTerminal ?? 'Ninguno'})
                  </button>
                </div>
              )}
            </div>

            {/* Barra de Presets de Cámara 3D cuando el Banco 3D está visible */}
            {workspaceDimension !== '2d' && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-[#080D18] border-b border-slate-800/80 text-[11px] font-mono">
                <div className="flex items-center gap-2 text-cyan-300 font-semibold">
                  <Camera className="w-3.5 h-3.5 text-cyan-400" />
                  <span>CÁMARA DE BANCO ÓPTICO 3D:</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'perspective', label: 'Perspectiva 3D' },
                      { id: 'isometric', label: 'Isométrica' },
                      { id: 'top', label: 'Cenital (Plano)' },
                      { id: 'front', label: 'Frontal' },
                    ] as Array<{ id: CameraPreset3D; label: string }>
                  ).map((cam) => (
                    <button
                      key={cam.id}
                      type="button"
                      data-testid={`builder-cam-${cam.id}`}
                      onClick={() => {
                        setCameraPreset(cam.id);
                        setCameraResetToken((t) => t + 1);
                      }}
                      className={`px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                        cameraPreset === cam.id
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 font-bold'
                          : 'bg-[#0F172A] border-slate-700 text-slate-300 hover:text-white'
                      }`}
                    >
                      {cam.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ESCENA 3D WEBGL (THREE.JS) + ESQUEMÁTICO SINCRONIZADO */}
            <div
              className={
                workspaceDimension === 'split'
                  ? 'grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0 xl:divide-x divide-slate-800'
                  : 'block'
              }
            >
              {workspaceDimension !== '2d' && (
                <SandboxWorkbench3D
                  components={components}
                  wires={wires}
                  solverResult={solverResult}
                  voltmeter={voltmeter}
                  isRunning={isRunning}
                  flowMode={flowMode}
                  visualStyle={visualStyle}
                  selectedCompId={selectedCompId}
                  selectedWireId={selectedWireId}
                  pendingTerminal={pendingTerminal}
                  probePlacementTarget={probePlacementTarget}
                  cameraPreset={cameraPreset}
                  cameraResetToken={cameraResetToken}
                  onSelectComponent={(id) => setSelectedCompId(id)}
                  onSelectWire={(id) => setSelectedWireId(id)}
                  onTerminalSelect={handleTerminalSelect}
                  onMoveComponent={(id, nx, ny) => {
                    setComponents((prev) =>
                      prev.map((c) => (c.id === id ? { ...c, x: nx, y: ny } : c))
                    );
                  }}
                  onToggleSwitch={(id) => {
                    setComponents((prev) =>
                      prev.map((c) => {
                        if (c.id === id && c.type === 'switch') {
                          const nextState = !c.isClosed;
                          if (!audioMuted) audioSynth.playSwitchClick(nextState);
                          return { ...c, isClosed: nextState };
                        }
                        return c;
                      })
                    );
                  }}
                  onPressPushbutton={(id, pressed) => {
                    setComponents((prev) =>
                      prev.map((c) =>
                        c.id === id && c.type === 'pushbutton' ? { ...c, isPressed: pressed } : c
                      )
                    );
                  }}
                  onDropNewComponent={(type, cx, cy) => handleAddComponent(type, { x: cx, y: cy })}
                  onCancelPending={() => {
                    setPendingTerminal(null);
                    setProbePlacementTarget(null);
                  }}
                />
              )}

              {/* Área gráfica interactiva SVG + Canvas de partículas (visible en 2D/Split o como minimapa de precisión debajo de 3D) */}
              <div
                className={
                  workspaceDimension === '3d'
                    ? 'border-t border-slate-800/90 bg-[#050811] p-2.5'
                    : 'relative w-full aspect-[920/520] min-h-[360px]'
                }
              >
                {workspaceDimension === '3d' && (
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1 text-[11px] font-mono text-slate-400">
                    <span className="text-cyan-300 font-semibold">
                      📐 PLANO SINCRONIZADO DE BORNES Y NODOS (Haz clic en cualquier borne A/B en 3D o aquí para cablear rápido)
                    </span>
                    <span>Sincronización Bidireccional 3D ↔ 2D en Tiempo Real</span>
                  </div>
                )}
                <div
                  className={
                    workspaceDimension === '3d'
                      ? 'relative w-full max-h-[210px] aspect-[920/520] mx-auto rounded-lg border border-slate-800/80 overflow-hidden'
                      : 'relative w-full h-full'
                  }
                >
                  <svg
                    ref={svgRef}
                    viewBox="0 0 920 520"
                    data-testid="builder-sandbox-svg"
                    className="w-full h-full block touch-none"
                onPointerMove={(e) => {
                  const pt = clientToCanvasCoords(e.clientX, e.clientY);
                  setPointerPos(pt);
                  if (draggingComp) {
                    setComponents((prev) =>
                      prev.map((c) =>
                        c.id === draggingComp.id
                          ? {
                              ...c,
                              x: snapToGrid(pt.x - draggingComp.offsetX),
                              y: snapToGrid(pt.y - draggingComp.offsetY),
                            }
                          : c
                      )
                    );
                  }
                }}
                onPointerUp={() => {
                  if (draggingComp) setDraggingComp(null);
                  // Soltar cualquier pulsador momentáneo activo al soltar el puntero
                  setComponents((prev) =>
                    prev.map((c) =>
                      c.type === 'pushbutton' && c.isPressed ? { ...c, isPressed: false } : c
                    )
                  );
                }}
                onClick={(e) => {
                  if (e.target === svgRef.current) {
                    setPendingTerminal(null);
                    setSelectedWireId(null);
                  }
                }}
              >
                <defs>
                  <pattern
                    id="sandbox-mm-grid"
                    width={SNAP_GRID}
                    height={SNAP_GRID}
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d={`M ${SNAP_GRID} 0 L 0 0 0 ${SNAP_GRID}`}
                      fill="none"
                      stroke="rgba(51, 65, 85, 0.35)"
                      strokeWidth="1"
                    />
                  </pattern>
                  <radialGradient id="bulb-glow-grad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgba(254, 240, 138, 0.95)" />
                    <stop offset="55%" stopColor="rgba(250, 204, 21, 0.45)" />
                    <stop offset="100%" stopColor="rgba(250, 204, 21, 0)" />
                  </radialGradient>
                </defs>

                {/* Fondo con rejilla milimetrada */}
                <rect width="920" height="520" fill="url(#sandbox-mm-grid)" />

                {/* 1. CABLES CONDUCTORES (JUMPER WIRES) */}
                {wires.map((w) => {
                  const p1 = terminalCoordsMap[w.fromTerminal];
                  const p2 = terminalCoordsMap[w.toTerminal];
                  if (!p1 || !p2) return null;
                  const wState = solverResult.wireStates[w.id];
                  const isSelected = selectedWireId === w.id;
                  const isShort = wState?.isShortPath ?? false;

                  return (
                    <g
                      key={w.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedWireId(w.id);
                        setSelectedCompId(null);
                      }}
                      className="cursor-pointer"
                    >
                      {/* Línea gruesa invisible para facilitar clic táctil */}
                      <line
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke="transparent"
                        strokeWidth={16}
                      />
                      <line
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke={
                          isShort
                            ? '#EF4444'
                            : isSelected
                            ? '#22D3EE'
                            : '#10B981'
                        }
                        strokeWidth={isSelected || isShort ? 5 : 3.5}
                        strokeLinecap="round"
                      />
                    </g>
                  );
                })}

                {/* Cable elástico en construcción cuando hay un terminal pendiente */}
                {pendingTerminal &&
                  terminalCoordsMap[pendingTerminal] &&
                  pointerPos && (
                    <line
                      x1={terminalCoordsMap[pendingTerminal].x}
                      y1={terminalCoordsMap[pendingTerminal].y}
                      x2={pointerPos.x}
                      y2={pointerPos.y}
                      stroke="#22D3EE"
                      strokeWidth={3}
                      strokeDasharray="6 4"
                      pointerEvents="none"
                    />
                  )}

                {/* 2. COMPONENTES DEL CIRCUITO */}
                {components.map((comp) => {
                  const branch = solverResult.branches[comp.id];
                  const isSelected = comp.id === selectedCompId;
                  const coords = getComponentTerminalCoords(comp);
                  const nodeA = solverResult.terminalToNode[`${comp.id}:A`] ?? 'N?';
                  const nodeB = solverResult.terminalToNode[`${comp.id}:B`] ?? 'N?';
                  const currentA = branch?.current ?? 0;
                  const powerW = branch?.power ?? 0;
                  const brightness = branch?.brightness ?? 0;

                  return (
                    <g key={comp.id}>
                      {/* Grupo rotado y trasladado al centro del componente */}
                      <g
                        transform={`translate(${comp.x}, ${comp.y}) rotate(${comp.rotation})`}
                        data-testid={`sandbox-comp-${comp.id}`}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          setSelectedCompId(comp.id);
                          setSelectedWireId(null);

                          if (comp.type === 'pushbutton') {
                            setComponents((prev) =>
                              prev.map((c) =>
                                c.id === comp.id ? { ...c, isPressed: true } : c
                              )
                            );
                          }

                          const pt = clientToCanvasCoords(e.clientX, e.clientY);
                          setDraggingComp({
                            id: comp.id,
                            offsetX: pt.x - comp.x,
                            offsetY: pt.y - comp.y,
                          });
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          // Si es un interruptor unipolar, permitir conmutar con clic rápido si no se arrastró
                          if (comp.type === 'switch') {
                            if (!audioMuted) audioSynth.playSwitchClick(!comp.isClosed);
                            setComponents((prev) =>
                              prev.map((c) =>
                                c.id === comp.id ? { ...c, isClosed: !c.isClosed } : c
                              )
                            );
                          }
                        }}
                        className="cursor-grab active:cursor-grabbing"
                      >
                        {/* Halo de selección */}
                        {isSelected && (
                          <rect
                            x={-60}
                            y={-34}
                            width={120}
                            height={68}
                            rx={12}
                            fill="rgba(34, 211, 238, 0.07)"
                            stroke="#22D3EE"
                            strokeWidth={1.8}
                            strokeDasharray="4 3"
                          />
                        )}

                        {/* Patillas conductoras hacia los terminales A (-56,0) y B (+56,0) */}
                        <line
                          x1={-TERMINAL_OFFSET}
                          y1={0}
                          x2={-34}
                          y2={0}
                          stroke="#94A3B8"
                          strokeWidth={3.5}
                        />
                        <line
                          x1={34}
                          y1={0}
                          x2={TERMINAL_OFFSET}
                          y2={0}
                          stroke="#94A3B8"
                          strokeWidth={3.5}
                        />

                        {/* RENDERIZADO SEGÚN TIPO Y ESTILO (REALISTA vs ESQUEMÁTICO IEEE/IEC) */}
                        {comp.type === 'battery' && (
                          <g>
                            {visualStyle === 'realistic' ? (
                              <>
                                <rect
                                  x={-36}
                                  y={-20}
                                  width={72}
                                  height={40}
                                  rx={7}
                                  fill="#0F172A"
                                  stroke={branch?.isShortPath ? '#EF4444' : '#F59E0B'}
                                  strokeWidth={2.5}
                                />
                                <rect x={12} y={-18} width={22} height={36} rx={4} fill="#D97706" />
                                <text x={-16} y={5} fill="#94A3B8" fontSize="13" fontFamily="monospace" fontWeight="bold">
                                  -
                                </text>
                                <text x={18} y={5} fill="#FFF" fontSize="13" fontFamily="monospace" fontWeight="bold">
                                  +
                                </text>
                              </>
                            ) : (
                              <>
                                <rect x={-34} y={-22} width={68} height={44} fill="#070B14" />
                                <line x1={-10} y1={-14} x2={-10} y2={14} stroke="#94A3B8" strokeWidth={3.5} />
                                <line x1={8} y1={-22} x2={8} y2={22} stroke="#F59E0B" strokeWidth={3.5} />
                                <text x={-22} y={-10} fill="#94A3B8" fontSize="11" fontFamily="monospace">-</text>
                                <text x={15} y={-10} fill="#F59E0B" fontSize="11" fontFamily="monospace">+</text>
                              </>
                            )}
                          </g>
                        )}

                        {comp.type === 'resistor' && (
                          <g>
                            {visualStyle === 'realistic' ? (
                              <>
                                <rect
                                  x={-34}
                                  y={-14}
                                  width={68}
                                  height={28}
                                  rx={8}
                                  fill="#FDE68A"
                                  stroke="#B45309"
                                  strokeWidth={2}
                                />
                                {getEia4Bands(comp.resistance ?? 10).map((band, idx) => (
                                  <rect
                                    key={idx}
                                    x={-22 + idx * 13}
                                    y={-13}
                                    width={6}
                                    height={26}
                                    fill={band.hex}
                                  />
                                ))}
                              </>
                            ) : (
                              <>
                                <rect x={-34} y={-16} width={68} height={32} fill="#070B14" />
                                <polyline
                                  points="-34,0 -24,-12 -12,12 0,-12 12,12 24,-12 34,0"
                                  fill="none"
                                  stroke="#38BDF8"
                                  strokeWidth={3}
                                  strokeLinejoin="round"
                                />
                              </>
                            )}
                          </g>
                        )}

                        {comp.type === 'bulb' && (
                          <g>
                            {/* Resplandor dinámico proporcional a P = I² * R */}
                            {brightness > 0.02 && !comp.isBurnedOut && (
                              <circle
                                cx={0}
                                cy={0}
                                r={28 + brightness * 36}
                                fill="url(#bulb-glow-grad)"
                                pointerEvents="none"
                              />
                            )}
                            <circle
                              cx={0}
                              cy={0}
                              r={22}
                              fill={
                                comp.isBurnedOut
                                  ? '#1E293B'
                                  : brightness > 0.05
                                  ? '#FEF08A'
                                  : '#0F172A'
                              }
                              stroke={
                                comp.isBurnedOut
                                  ? '#EF4444'
                                  : brightness > 0.05
                                  ? '#FACC15'
                                  : '#64748B'
                              }
                              strokeWidth={2.5}
                            />
                            {visualStyle === 'schematic' ? (
                              <>
                                <line x1={-12} y1={-12} x2={12} y2={12} stroke="#94A3B8" strokeWidth={2.5} />
                                <line x1={-12} y1={12} x2={12} y2={-12} stroke="#94A3B8" strokeWidth={2.5} />
                              </>
                            ) : (
                              <path
                                d={
                                  comp.isBurnedOut
                                    ? 'M -12 8 L -4 -6 M 4 -6 L 12 8'
                                    : 'M -12 8 Q 0 -16 12 8'
                                }
                                fill="none"
                                stroke={comp.isBurnedOut ? '#EF4444' : '#B45309'}
                                strokeWidth={2.5}
                              />
                            )}
                          </g>
                        )}

                        {comp.type === 'buzzer' && (
                          <g>
                            <rect
                              x={-28}
                              y={-20}
                              width={56}
                              height={40}
                              rx={10}
                              fill="#0F172A"
                              stroke={
                                solverResult.activeBuzzerIds.includes(comp.id)
                                  ? '#22D3EE'
                                  : '#64748B'
                              }
                              strokeWidth={2.5}
                            />
                            <circle cx={0} cy={0} r={10} fill="#1E293B" stroke="#38BDF8" strokeWidth={2} />
                            {solverResult.activeBuzzerIds.includes(comp.id) && (
                              <circle
                                cx={0}
                                cy={0}
                                r={26}
                                fill="none"
                                stroke="#22D3EE"
                                strokeWidth={1.5}
                                strokeDasharray="3 3"
                              />
                            )}
                          </g>
                        )}

                        {comp.type === 'switch' && (
                          <g>
                            <rect x={-34} y={-18} width={68} height={36} rx={6} fill="#0F172A" stroke="#475569" strokeWidth={1.5} />
                            <circle cx={-22} cy={0} r={5} fill="#CBD5E1" />
                            <circle cx={22} cy={0} r={5} fill="#CBD5E1" />
                            <line
                              x1={-22}
                              y1={0}
                              x2={comp.isClosed ? 22 : 16}
                              y2={comp.isClosed ? 0 : -18}
                              stroke={comp.isClosed ? '#10B981' : '#F59E0B'}
                              strokeWidth={4}
                              strokeLinecap="round"
                            />
                          </g>
                        )}

                        {comp.type === 'pushbutton' && (
                          <g>
                            <rect x={-32} y={-18} width={64} height={36} rx={6} fill="#0F172A" stroke="#475569" strokeWidth={1.5} />
                            <circle cx={-20} cy={0} r={4.5} fill="#CBD5E1" />
                            <circle cx={20} cy={0} r={4.5} fill="#CBD5E1" />
                            <line
                              x1={-20}
                              y1={comp.isPressed ? 0 : -10}
                              x2={20}
                              y2={comp.isPressed ? 0 : -10}
                              stroke={comp.isPressed ? '#10B981' : '#38BDF8'}
                              strokeWidth={3.5}
                            />
                            <line
                              x1={0}
                              y1={comp.isPressed ? -10 : -18}
                              x2={0}
                              y2={comp.isPressed ? 0 : -10}
                              stroke="#38BDF8"
                              strokeWidth={3}
                            />
                          </g>
                        )}

                        {comp.type === 'fuse' && (
                          <g>
                            <rect
                              x={-32}
                              y={-14}
                              width={64}
                              height={28}
                              rx={6}
                              fill="#0F172A"
                              stroke={comp.isBlown ? '#EF4444' : '#38BDF8'}
                              strokeWidth={2}
                            />
                            {comp.isBlown ? (
                              <>
                                <line x1={-26} y1={0} x2={-6} y2={-5} stroke="#EF4444" strokeWidth={2.5} />
                                <line x1={6} y1={5} x2={26} y2={0} stroke="#EF4444" strokeWidth={2.5} />
                              </>
                            ) : (
                              <path
                                d="M -28 0 Q -14 -8 0 0 T 28 0"
                                fill="none"
                                stroke="#34D399"
                                strokeWidth={2.5}
                              />
                            )}
                          </g>
                        )}

                        {comp.type === 'ammeter' && (
                          <g>
                            <rect
                              x={-36}
                              y={-20}
                              width={72}
                              height={40}
                              rx={8}
                              fill="#0B132B"
                              stroke="#22D3EE"
                              strokeWidth={2.2}
                            />
                            <g transform={`rotate(${-comp.rotation})`}>
                              <text
                                x={0}
                                y={4}
                                textAnchor="middle"
                                fill="#22D3EE"
                                fontSize="11"
                                fontFamily="monospace"
                                fontWeight="bold"
                              >
                                {Math.abs(currentA).toFixed(2)}A
                              </text>
                            </g>
                          </g>
                        )}
                      </g>

                      {/* Etiqueta superior e inferior del componente (con offset adaptado si es vertical u horizontal) */}
                      <text
                        x={comp.x}
                        y={
                          comp.rotation === 90 || comp.rotation === 270
                            ? comp.y - 74
                            : comp.y - 36
                        }
                        textAnchor="middle"
                        fill="#F8FAFC"
                        fontSize="11"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {comp.label}{' '}
                        {comp.type === 'battery'
                          ? `(${comp.voltage ?? 9}V)`
                          : comp.type === 'resistor' || comp.type === 'bulb'
                          ? `(${comp.resistance ?? 10}Ω)`
                          : comp.type === 'fuse'
                          ? `(${comp.maxCurrentAmps ?? 2}A)`
                          : ''}
                      </text>

                      <text
                        x={comp.x}
                        y={
                          comp.rotation === 90 || comp.rotation === 270
                            ? comp.y + 80
                            : comp.y + 44
                        }
                        textAnchor="middle"
                        fill={
                          comp.isBurnedOut || comp.isBlown
                            ? '#EF4444'
                            : '#94A3B8'
                        }
                        fontSize="10"
                        fontFamily="monospace"
                      >
                        {comp.isBurnedOut
                          ? '🔥 QUEMADA (>15W)'
                          : comp.isBlown
                          ? '💥 FUSIBLE FUNDIDO'
                          : comp.type === 'switch'
                          ? comp.isClosed
                            ? 'CERRADO (ON)'
                            : 'ABIERTO (OFF)'
                          : `I=${Math.abs(currentA).toFixed(2)}A · P=${powerW.toFixed(1)}W`}
                      </text>

                      {/* PINES DE CONEXIÓN INTERACTIVOS: TERMINAL A Y TERMINAL B */}
                      {(['A', 'B'] as const).map((pin) => {
                        const tId = `${comp.id}:${pin}`;
                        const pt = coords[pin];
                        const isPending = pendingTerminal === tId;
                        const isRedProbe = voltmeter.enabled && voltmeter.redTerminal === tId;
                        const isBlackProbe = voltmeter.enabled && voltmeter.blackTerminal === tId;
                        const nodeLabel = pin === 'A' ? nodeA : nodeB;

                        return (
                          <g
                            key={tId}
                            data-testid={`terminal-${tId}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTerminalSelect(tId);
                            }}
                            className="cursor-pointer"
                          >
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={14}
                              fill="transparent"
                            />
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={isPending ? 9 : 7}
                              fill={
                                isPending
                                  ? '#22D3EE'
                                  : isRedProbe
                                  ? '#EF4444'
                                  : isBlackProbe
                                  ? '#0284C7'
                                  : '#0F172A'
                              }
                              stroke={
                                isPending
                                  ? '#FFFFFF'
                                  : isRedProbe
                                  ? '#FCA5A5'
                                  : isBlackProbe
                                  ? '#7DD3FC'
                                  : '#38BDF8'
                              }
                              strokeWidth={2.5}
                            />
                            <text
                              x={pt.x}
                              y={pt.y - 11}
                              textAnchor="middle"
                              fill="#94A3B8"
                              fontSize="9"
                              fontFamily="monospace"
                            >
                              {nodeLabel}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
              </svg>

              {/* Canvas superpuesto a 60 FPS para el flujo de electrones / corriente */}
              <canvas
                ref={particleCanvasRef}
                width={920}
                height={520}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
                </div>
              </div>
            </div>
          </div>

          {/* MINI INSPECTOR INTERACTIVO DE COMPONENTE O CABLE */}
          {selectedComponent && (
            <div
              data-testid="builder-component-inspector"
              className="p-4 rounded-xl bg-[#0B101E] border border-cyan-500/40 flex flex-wrap items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">
                    INSPECTOR DE COMPONENTE SELECCIONADO
                  </span>
                </div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{selectedComponent.label}</span>
                  <span className="text-xs font-mono text-slate-400">
                    (ID: {selectedComponent.id} · Rotación: {selectedComponent.rotation}°)
                  </span>
                </div>
              </div>

              {/* Controles de valor según el tipo de componente */}
              <div className="flex flex-wrap items-center gap-4">
                {selectedComponent.type === 'battery' && (
                  <div className="flex items-center gap-2.5">
                    <label className="text-xs font-mono text-slate-300">
                      Voltaje DC (0.5V – 48V):
                    </label>
                    <input
                      type="range"
                      min={0.5}
                      max={48}
                      step={0.5}
                      value={selectedComponent.voltage ?? 9}
                      onChange={(e) =>
                        updateSelectedComponent({ voltage: parseFloat(e.target.value) })
                      }
                      className="w-32 accent-cyan-400 cursor-pointer"
                    />
                    <input
                      type="number"
                      min={0.5}
                      max={48}
                      step={0.5}
                      value={selectedComponent.voltage ?? 9}
                      onChange={(e) =>
                        updateSelectedComponent({
                          voltage: Math.max(0.5, Math.min(48, parseFloat(e.target.value) || 0.5)),
                        })
                      }
                      className="w-20 rounded-lg bg-[#070A12] border border-slate-700 px-2 py-1 text-xs font-mono text-amber-300"
                    />
                    <span className="text-xs font-mono text-slate-400">V</span>
                  </div>
                )}

                {(selectedComponent.type === 'resistor' ||
                  selectedComponent.type === 'bulb' ||
                  selectedComponent.type === 'buzzer') && (
                  <div className="flex items-center gap-2.5">
                    <label className="text-xs font-mono text-slate-300">
                      Resistencia (Ω):
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={selectedComponent.type === 'resistor' ? 1000 : 200}
                      step={1}
                      value={selectedComponent.resistance ?? 10}
                      onChange={(e) =>
                        updateSelectedComponent({
                          resistance: parseFloat(e.target.value),
                          isBurnedOut: false,
                        })
                      }
                      className="w-32 accent-cyan-400 cursor-pointer"
                    />
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      step={1}
                      value={selectedComponent.resistance ?? 10}
                      onChange={(e) =>
                        updateSelectedComponent({
                          resistance: Math.max(1, Math.min(10000, parseFloat(e.target.value) || 1)),
                          isBurnedOut: false,
                        })
                      }
                      className="w-24 rounded-lg bg-[#070A12] border border-slate-700 px-2 py-1 text-xs font-mono text-cyan-300"
                    />
                    <span className="text-xs font-mono text-slate-400">Ω</span>
                  </div>
                )}

                {selectedComponent.type === 'fuse' && (
                  <div className="flex items-center gap-2.5">
                    <label className="text-xs font-mono text-slate-300">
                      Límite Fusible (A):
                    </label>
                    <input
                      type="number"
                      min={0.2}
                      max={10}
                      step={0.2}
                      value={selectedComponent.maxCurrentAmps ?? 2.0}
                      onChange={(e) =>
                        updateSelectedComponent({
                          maxCurrentAmps: Math.max(0.2, Math.min(10, parseFloat(e.target.value) || 2.0)),
                          isBlown: false,
                        })
                      }
                      className="w-20 rounded-lg bg-[#070A12] border border-slate-700 px-2 py-1 text-xs font-mono text-emerald-300"
                    />
                    <span className="text-xs font-mono text-slate-400">A</span>
                  </div>
                )}

                {selectedComponent.type === 'switch' && (
                  <button
                    type="button"
                    data-testid="inspector-toggle-switch"
                    onClick={() =>
                      updateSelectedComponent({ isClosed: !selectedComponent.isClosed })
                    }
                    className={`touch-target px-3 py-1.5 rounded-lg text-xs font-mono font-bold border cursor-pointer ${
                      selectedComponent.isClosed
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-amber-500/20 border-amber-400 text-amber-300'
                    }`}
                  >
                    {selectedComponent.isClosed ? 'Estado: CERRADO (ON)' : 'Estado: ABIERTO (OFF)'}
                  </button>
                )}

                {selectedComponent.type === 'pushbutton' && (
                  <button
                    type="button"
                    onClick={() =>
                      updateSelectedComponent({ isPressed: !selectedComponent.isPressed })
                    }
                    className={`touch-target px-3 py-1.5 rounded-lg text-xs font-mono font-bold border cursor-pointer ${
                      selectedComponent.isPressed
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-slate-800 border-slate-600 text-slate-200'
                    }`}
                  >
                    {selectedComponent.isPressed
                      ? 'Pulsador: RETENIDO (ON)'
                      : 'Pulsador: SUELTO (OFF)'}
                  </button>
                )}

                {(selectedComponent.isBurnedOut || selectedComponent.isBlown) && (
                  <button
                    type="button"
                    data-testid="inspector-repair-btn"
                    onClick={() =>
                      updateSelectedComponent({ isBurnedOut: false, isBlown: false })
                    }
                    className="touch-target flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 text-xs font-mono font-bold cursor-pointer"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Reparar Componente</span>
                  </button>
                )}

                {/* Botón Rotar 90° */}
                <button
                  type="button"
                  data-testid="inspector-rotate-btn"
                  onClick={() =>
                    updateSelectedComponent({
                      rotation: (((selectedComponent.rotation + 90) % 360) as 0 | 90 | 180 | 270),
                    })
                  }
                  className="touch-target flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111827] hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-200 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Rotar 90° (R)</span>
                </button>

                {/* Botón Eliminar */}
                <button
                  type="button"
                  data-testid="inspector-delete-btn"
                  onClick={handleDeleteSelectedComponent}
                  className="touch-target flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-xs font-mono text-rose-200 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar</span>
                </button>
              </div>
            </div>
          )}

          {/* Inspector de Cable Seleccionado */}
          {selectedWireId && (
            <div className="p-3.5 rounded-xl bg-[#0B101E] border border-emerald-500/40 flex items-center justify-between gap-3">
              <div className="text-xs font-mono text-slate-200">
                Cable Conductor Seleccionado (<strong className="text-emerald-400">{selectedWireId}</strong>) · Corriente:{' '}
                <strong className="text-amber-300">
                  {Math.abs(solverResult.wireStates[selectedWireId]?.current ?? 0).toFixed(3)} A
                </strong>
              </div>
              <button
                type="button"
                onClick={() => {
                  setWires((prev) => prev.filter((w) => w.id !== selectedWireId));
                  setSelectedWireId(null);
                }}
                className="touch-target flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/80 border border-rose-500/50 text-xs font-mono text-rose-200 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Cortar / Eliminar Cable</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
