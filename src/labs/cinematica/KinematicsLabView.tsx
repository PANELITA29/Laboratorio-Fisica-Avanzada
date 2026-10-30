import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Crosshair,
  Wind,
  Gauge,
  RotateCcw,
  Play,
  Pause,
  Trash2,
  Ruler,
  Search,
  Award,
  Sliders,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Eye,
  Compass,
  CheckCircle2,
  HelpCircle,
  X,
} from 'lucide-react';
import { Language } from '../../assets/js/i18n';
import { TelemetryItem } from '../../assets/js/report-generator';
import {
  PAYLOAD_CATALOG,
  GRAVITY_PRESETS,
  EXOTIC_ENVIRONMENT_PRESETS,
  PayloadId,
  GravityPresetId,
  ExoticEnvironmentPresetId,
  SimulationParams2D,
  TrajectoryResult2D,
  TrajectorySample2D,
  ChallengeTarget2D,
  TargetEvaluationResult,
  getPayloadById,
  getGravityPresetById,
  computeEnvironmentDiagnostics,
  computeExoticTrajectoryPreview,
  simulateFullTrajectory,
  findNearestTrajectorySample,
  evaluateTargetHit,
} from './PhysicsEngine2D';

interface KinematicsLabViewProps {
  lang: Language;
  onUpdateTelemetry: (items: TelemetryItem[]) => void;
  completedChallenges: Record<string, boolean>;
  onCompleteChallenge: (id: string, points: number) => void;
}

interface ImpactParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  rotation: number;
  vRot: number;
  shape: 'circle' | 'rect' | 'seed';
}

interface SteamParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
}

const TRAJECTORY_COLORS = ['#22D3EE', '#F59E0B', '#EC4899'];

const CHALLENGE_LEVELS: ChallengeTarget2D[] = [
  { distanceX: 95, radiusM: 6.5, elevationY: 0, levelNumber: 1, windChallengeSpeed: 0 },
  { distanceX: 135, radiusM: 6.0, elevationY: 0, levelNumber: 2, windChallengeSpeed: -8 },
  { distanceX: 170, radiusM: 5.5, elevationY: 0, levelNumber: 3, windChallengeSpeed: 11 },
  { distanceX: 72, radiusM: 5.0, elevationY: 0, levelNumber: 4, windChallengeSpeed: -15 },
];

export const KinematicsLabView: React.FC<KinematicsLabViewProps> = ({
  lang,
  onUpdateTelemetry,
  completedChallenges,
  onCompleteChallenge,
}) => {
  // Parámetros físicos del lanzador y entorno
  const [payloadId, setPayloadId] = useState<PayloadId>('watermelon');
  const [gravityPresetId, setGravityPresetId] = useState<GravityPresetId>('earth');
  const [exoticPresetId, setExoticPresetId] = useState<ExoticEnvironmentPresetId | null>(null);
  const [v0, setV0] = useState<number>(38);
  const [angleDeg, setAngleDeg] = useState<number>(42);
  const [h0, setH0] = useState<number>(6);
  const [gravity, setGravity] = useState<number>(9.81);
  const [airDensity, setAirDensity] = useState<number>(1.225);
  const [isVacuum, setIsVacuum] = useState<boolean>(false);
  const [windSpeed, setWindSpeed] = useState<number>(0);

  // Parámetros del objeto personalizado
  const [customMassKg, setCustomMassKg] = useState<number>(25.0);
  const [customDiameterM, setCustomDiameterM] = useState<number>(0.35);
  const [customDragCoeff, setCustomDragCoeff] = useState<number>(0.50);

  // Capas de visualización e instrumentos
  const [showMetricGrid, setShowMetricGrid] = useState<boolean>(true);
  const [showVelocityVector, setShowVelocityVector] = useState<boolean>(true);
  const [showAccelerationVector, setShowAccelerationVector] = useState<boolean>(false);
  const [showDragVector, setShowDragVector] = useState<boolean>(true);
  const [showTelemetryProbe, setShowTelemetryProbe] = useState<boolean>(true);
  const [showMeasuringTape, setShowMeasuringTape] = useState<boolean>(false);
  const [showPredictiveGhost, setShowPredictiveGhost] = useState<boolean>(true);
  const [showTutorialOverlay, setShowTutorialOverlay] = useState<boolean>(false);

  // Cinta métrica interactiva (coordenadas en metros del mundo)
  const [tapeStart, setTapeStart] = useState<{ x: number; y: number }>({ x: 0, y: 6 });
  const [tapeEnd, setTapeEnd] = useState<{ x: number; y: number }>({ x: 85, y: 0 });

  // Modo Desafío ("Tiro al Blanco / Artillería")
  const [isChallengeMode, setIsChallengeMode] = useState<boolean>(false);
  const [challengeIndex, setChallengeIndex] = useState<number>(0);
  const [challengeTarget, setChallengeTarget] = useState<ChallengeTarget2D>(CHALLENGE_LEVELS[0]);
  const [lastEvaluation, setLastEvaluation] = useState<TargetEvaluationResult | null>(null);

  // Historial de las últimas 3 trayectorias y estado de reproducción
  const [trajectories, setTrajectories] = useState<TrajectoryResult2D[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [timeScale, setTimeScale] = useState<number>(1.0);
  const [playbackTimeS, setPlaybackTimeS] = useState<number>(0);
  const [probeSampleInfo, setProbeSampleInfo] = useState<{
    trajectoryLabel: string;
    color: string;
    sample: TrajectorySample2D;
  } | null>(null);

  // Zoom manual o automático
  const [manualZoomFactor, setManualZoomFactor] = useState<number>(1.0);
  const [scientistMood, setScientistMood] = useState<'ready' | 'firing' | 'celebrating' | 'shocked'>('ready');

  // Referencias para el bucle de 60 FPS en Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const timeScaleRef = useRef<number>(1.0);
  const cannonRecoilRef = useRef<number>(0);
  const steamParticlesRef = useRef<SteamParticle[]>([]);
  const impactParticlesRef = useRef<ImpactParticle[]>([]);
  const draggingModeRef = useRef<'none' | 'cannon-angle' | 'platform-height' | 'tape-start' | 'tape-end' | 'probe'>('none');
  const worldTransformRef = useRef<{
    scale: number;
    originX: number;
    originY: number;
    width: number;
    height: number;
  }>({ scale: 4.5, originX: 90, originY: 420, width: 960, height: 520 });

  useEffect(() => {
    timeScaleRef.current = timeScale;
  }, [timeScale]);

  const activePayload = getPayloadById(payloadId);
  const baseGravityPreset = getGravityPresetById(gravityPresetId);
  const activeExoticPreset = exoticPresetId
    ? EXOTIC_ENVIRONMENT_PRESETS.find((p) => p.id === exoticPresetId) ?? null
    : null;
  const activeGravityPreset =
    gravityPresetId === 'custom' && activeExoticPreset
      ? {
          ...baseGravityPreset,
          skyTopColor: activeExoticPreset.skyTopColor,
          skyBottomColor: activeExoticPreset.skyBottomColor,
          groundColor: activeExoticPreset.groundColor,
          horizonAccent: activeExoticPreset.horizonAccent,
        }
      : baseGravityPreset;

  const effectiveMassKg = payloadId === 'custom' ? customMassKg : activePayload.massKg;
  const effectiveDiameterM = payloadId === 'custom' ? customDiameterM : activePayload.diameterM;
  const effectiveDragCoeff = payloadId === 'custom' ? customDragCoeff : activePayload.dragCoeff;

  const envDiagnostics = computeEnvironmentDiagnostics({
    massKg: effectiveMassKg,
    diameterM: effectiveDiameterM,
    dragCoeff: effectiveDragCoeff,
    gravity,
    airDensity,
    isVacuum,
  });

  const buildCurrentSimulationParams = useCallback(
    (overrides?: Partial<SimulationParams2D>): SimulationParams2D => ({
      v0,
      angleDeg,
      h0,
      gravity,
      airDensity,
      isVacuum,
      windSpeed,
      massKg: effectiveMassKg,
      diameterM: effectiveDiameterM,
      dragCoeff: effectiveDragCoeff,
      payloadId,
      ...overrides,
    }),
    [
      v0,
      angleDeg,
      h0,
      gravity,
      airDensity,
      isVacuum,
      windSpeed,
      effectiveMassKg,
      effectiveDiameterM,
      effectiveDragCoeff,
      payloadId,
    ]
  );

  const exoticPreview = computeExoticTrajectoryPreview(buildCurrentSimulationParams());


  // Sonidos procedurales Web Audio para efectos balísticos
  const playProceduralSound = useCallback((type: 'fire' | 'splat' | 'piano' | 'quack' | 'thud' | 'win') => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      if (type === 'fire') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(38, now + 0.22);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'quack') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.linearRampToValueAtTime(590, now + 0.06);
        osc.frequency.linearRampToValueAtTime(360, now + 0.16);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.19);
      } else if (type === 'piano') {
        [130.81, 155.56, 185.0, 233.08, 277.18].forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(0.06, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.46);
        });
      } else if (type === 'win') {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.07);
          gain.gain.setValueAtTime(0.12, now + idx * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.07);
          osc.stop(now + idx * 0.07 + 0.26);
        });
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(type === 'splat' ? 240 : 95, now);
        osc.frequency.exponentialRampToValueAtTime(28, now + 0.18);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.21);
      }
    } catch {
      // Ignorar si el navegador bloquea AudioContext sin interacción previa
    }
  }, []);

  // Generar partículas de impacto en el suelo (y = 0) según el proyectil
  const spawnImpactEffects = useCallback(
    (traj: TrajectoryResult2D) => {
      const lastSample = traj.samples[traj.samples.length - 1];
      if (!lastSample || lastSample.y > 0.05) {
        impactParticlesRef.current = [];
        return;
      }
      const impactX = traj.rangeM;
      const speed = Math.max(8, traj.impactSpeedMs);
      const pId = traj.params.payloadId;
      const particles: ImpactParticle[] = [];

      if (pId === 'watermelon') {
        playProceduralSound('splat');
        for (let i = 0; i < 28; i++) {
          const angle = Math.PI * 0.08 + Math.random() * Math.PI * 0.84;
          const spd = 3.5 + Math.random() * Math.min(22, speed * 0.48);
          const isSeed = i % 5 === 0;
          particles.push({
            x: impactX,
            y: 0.15,
            vx: Math.cos(angle) * spd * (Math.random() > 0.5 ? 1 : -1),
            vy: Math.sin(angle) * spd,
            size: isSeed ? 3 : 4.5 + Math.random() * 5,
            color: isSeed ? '#0F172A' : i % 2 === 0 ? '#EF4444' : '#16A34A',
            alpha: 1,
            rotation: Math.random() * Math.PI * 2,
            vRot: (Math.random() - 0.5) * 8,
            shape: isSeed ? 'seed' : 'circle',
          });
        }
      } else if (pId === 'piano') {
        playProceduralSound('piano');
        for (let i = 0; i < 22; i++) {
          const angle = Math.PI * 0.12 + Math.random() * Math.PI * 0.76;
          const spd = 4 + Math.random() * 15;
          particles.push({
            x: impactX,
            y: 0.25,
            vx: Math.cos(angle) * spd * (Math.random() > 0.5 ? 1 : -1),
            vy: Math.sin(angle) * spd,
            size: 5 + Math.random() * 5,
            color: i % 2 === 0 ? '#F8FAFC' : '#1E293B',
            alpha: 1,
            rotation: Math.random() * Math.PI,
            vRot: (Math.random() - 0.5) * 10,
            shape: 'rect',
          });
        }
      } else if (pId === 'rubber-duck') {
        playProceduralSound('quack');
        for (let i = 0; i < 12; i++) {
          const angle = Math.PI * 0.18 + Math.random() * Math.PI * 0.64;
          const spd = 2.5 + Math.random() * 7.5;
          particles.push({
            x: impactX,
            y: 0.18,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            size: 3.8,
            color: '#FACC15',
            alpha: 1,
            rotation: 0,
            vRot: 0,
            shape: 'circle',
          });
        }
      } else {
        // Bala de cañón y demás proyectiles: nube de polvo de impacto en tierra
        playProceduralSound('thud');
        for (let i = 0; i < 18; i++) {
          const angle = Math.PI * 0.12 + Math.random() * Math.PI * 0.76;
          const spd = 2.5 + Math.random() * 10;
          particles.push({
            x: impactX,
            y: 0.12,
            vx: Math.cos(angle) * spd * (Math.random() > 0.5 ? 1 : -1),
            vy: Math.sin(angle) * spd,
            size: 3.5 + Math.random() * 4.5,
            color: i % 3 === 0 ? '#CBD5E1' : '#94A3B8',
            alpha: 0.95,
            rotation: 0,
            vRot: 0,
            shape: 'circle',
          });
        }
      }

      impactParticlesRef.current = particles;
    },
    [playProceduralSound]
  );

  // Disparar proyectil inicial con un tiro de demostración al montar
  useEffect(() => {
    const initialParams = buildCurrentSimulationParams();
    const initialResult = simulateFullTrajectory(initialParams, {
      id: 'traj-init',
      label: `${getPayloadById(initialParams.payloadId).nameEs} (${initialParams.angleDeg}°)`,
      color: TRAJECTORY_COLORS[0],
    });
    setTrajectories([initialResult]);
    const midIdx = Math.floor(initialResult.samples.length * 0.45);
    const sample = initialResult.samples[midIdx] ?? initialResult.samples[0];
    setProbeSampleInfo({
      trajectoryLabel: initialResult.label,
      color: initialResult.color,
      sample,
    });
    setPlaybackTimeS(initialResult.flightTimeS);
    animTimeRef.current = initialResult.flightTimeS;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Disparo principal del cañón neumático
  const handleFireCannon = useCallback(
    (customParamsOverride?: Partial<SimulationParams2D>, customLabel?: string) => {
      const simParams = buildCurrentSimulationParams(customParamsOverride);
      const spec = getPayloadById(simParams.payloadId);
      const colorIndex = trajectories.length % TRAJECTORY_COLORS.length;
      const envTag = simParams.isVacuum ? 'Vacío' : `ρ=${simParams.airDensity.toFixed(2)}`;
      const label =
        customLabel ?? `${spec.nameEs} · ${simParams.angleDeg}° (${envTag})`;

      const result = simulateFullTrajectory(simParams, {
        id: `traj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label,
        color: TRAJECTORY_COLORS[colorIndex],
      });

      // Efectos de salida del cañón: retroceso elástico y nube de vapor
      cannonRecoilRef.current = 1.0;
      const rad = (simParams.angleDeg * Math.PI) / 180;
      const muzzleX = Math.cos(rad) * 4.2;
      const muzzleY = simParams.h0 + Math.sin(rad) * 4.2;
      const newSteam: SteamParticle[] = [];
      for (let i = 0; i < 16; i++) {
        const spread = (Math.random() - 0.5) * 0.7;
        const spd = 2 + Math.random() * 8;
        newSteam.push({
          x: muzzleX,
          y: muzzleY,
          vx: Math.cos(rad + spread) * spd,
          vy: Math.sin(rad + spread) * spd,
          radius: 4 + Math.random() * 7,
          alpha: 0.85,
        });
      }
      steamParticlesRef.current = newSteam;
      impactParticlesRef.current = [];
      playProceduralSound('fire');
      setScientistMood('firing');

      setTrajectories((prev) => {
        const updated = [result, ...prev].slice(0, 3);
        return updated.map((item, idx) => ({
          ...item,
          color: TRAJECTORY_COLORS[idx % TRAJECTORY_COLORS.length],
        }));
      });

      // Iniciar animación en tiempo real
      animTimeRef.current = 0;
      setPlaybackTimeS(0);
      isPlayingRef.current = true;
      setIsPlaying(true);

      // Seleccionar muestra en el ápice para la sonda
      const apexSample =
        result.samples.reduce((best, curr) => (curr.y > best.y ? curr : best), result.samples[0]);
      setProbeSampleInfo({
        trajectoryLabel: result.label,
        color: TRAJECTORY_COLORS[0],
        sample: apexSample,
      });

      // Evaluar modo desafío si está activo
      if (isChallengeMode) {
        const evalRes = evaluateTargetHit(result, challengeTarget);
        setLastEvaluation(evalRes);
        if (evalRes.hit) {
          onCompleteChallenge(`kinematics-level-${challengeTarget.levelNumber}`, evalRes.awardedPoints);
        }
      } else {
        setLastEvaluation(null);
      }

      // Enviar telemetría al generador de informes global
      onUpdateTelemetry([
        {
          label: `Alcance Horizontal (${spec.nameEs})`,
          value: result.rangeM.toFixed(2),
          unit: 'm',
        },
        {
          label: 'Altura Máxima (Ápice)',
          value: result.maxHeightM.toFixed(2),
          unit: 'm',
        },
        {
          label: 'Tiempo Total de Vuelo',
          value: result.flightTimeS.toFixed(2),
          unit: 's',
        },
        {
          label: 'Pérdida Térmica por Arrastre',
          value: result.thermalDissipatedJ.toFixed(1),
          unit: 'J',
        },
      ]);
    },
    [
      buildCurrentSimulationParams,
      trajectories.length,
      playProceduralSound,
      isChallengeMode,
      challengeTarget,
      onCompleteChallenge,
      onUpdateTelemetry,
    ]
  );

  // Disparo doble comparativo: Vacío (Galileo) vs Atmósfera Real con 1 clic
  const handleCompareVacuumVsAir = useCallback(() => {
    const base = buildCurrentSimulationParams();
    const spec = getPayloadById(base.payloadId);

    const vacResult = simulateFullTrajectory(
      { ...base, isVacuum: true },
      {
        id: `traj-vac-${Date.now()}`,
        label: `${spec.nameEs} · Vacío Ideal (ρ=0)`,
        color: TRAJECTORY_COLORS[1],
      }
    );

    const airRho = base.airDensity > 0 ? base.airDensity : 1.225;
    const airResult = simulateFullTrajectory(
      { ...base, isVacuum: false, airDensity: airRho },
      {
        id: `traj-air-${Date.now() + 1}`,
        label: `${spec.nameEs} · Con Aire (ρ=${airRho.toFixed(2)})`,
        color: TRAJECTORY_COLORS[0],
      }
    );

    cannonRecoilRef.current = 1.0;
    playProceduralSound('fire');
    setScientistMood('celebrating');
    setTrajectories([airResult, vacResult]);

    animTimeRef.current = 0;
    setPlaybackTimeS(0);
    isPlayingRef.current = true;
    setIsPlaying(true);

    const apexSample = airResult.samples.reduce(
      (best, curr) => (curr.y > best.y ? curr : best),
      airResult.samples[0]
    );
    setProbeSampleInfo({
      trajectoryLabel: airResult.label,
      color: airResult.color,
      sample: apexSample,
    });
  }, [buildCurrentSimulationParams, playProceduralSound]);

  // Atajo de teclado: Barra espaciadora para disparar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        handleFireCannon();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFireCannon]);

  // Sincronización instantánea en vivo entre los sliders de entorno (g, ρ) y el motor PhysicsEngine2D
  const syncLiveTrajectoryWithEngine = useCallback(
    (overrides: Partial<SimulationParams2D>, customEnvLabel?: string) => {
      const simParams = buildCurrentSimulationParams(overrides);
      const spec = getPayloadById(simParams.payloadId);
      const envTag =
        customEnvLabel ??
        (simParams.isVacuum
          ? `g=${simParams.gravity.toFixed(2)} · Vacío`
          : `g=${simParams.gravity.toFixed(2)} · ρ=${simParams.airDensity.toFixed(2)}`);
      const label = `${spec.nameEs} · ${simParams.angleDeg}° (${envTag})`;

      const preview = computeExoticTrajectoryPreview(simParams, {
        id: `traj-live-${Date.now()}`,
        label,
        color: TRAJECTORY_COLORS[0],
      });
      const result = preview.trajectory;

      setTrajectories((prev) => {
        if (prev.length === 0) return [result];
        return [result, ...prev.slice(1)];
      });

      isPlayingRef.current = false;
      setIsPlaying(false);
      animTimeRef.current = result.flightTimeS;
      setPlaybackTimeS(result.flightTimeS);

      const apexSample =
        result.samples.reduce((best, curr) => (curr.y > best.y ? curr : best), result.samples[0]);
      setProbeSampleInfo({
        trajectoryLabel: result.label,
        color: TRAJECTORY_COLORS[0],
        sample: apexSample,
      });

      spawnImpactEffects(result);

      onUpdateTelemetry([
        {
          label: `Alcance Horizontal (${spec.nameEs})`,
          value: result.rangeM.toFixed(2),
          unit: 'm',
        },
        {
          label: 'Altura Máxima (Ápice)',
          value: result.maxHeightM.toFixed(2),
          unit: 'm',
        },
        {
          label: 'Tiempo Total de Vuelo',
          value: result.flightTimeS.toFixed(2),
          unit: 's',
        },
        {
          label: 'Pérdida Térmica por Arrastre',
          value: result.thermalDissipatedJ.toFixed(1),
          unit: 'J',
        },
      ]);
    },
    [buildCurrentSimulationParams, onUpdateTelemetry, spawnImpactEffects]
  );

  // Selección totalmente independiente de proyectil (mantiene intacto el planeta/entorno actual)
  const handleSelectPayload = (nextPayloadId: PayloadId) => {
    setPayloadId(nextPayloadId);
    const spec = getPayloadById(nextPayloadId);
    const nextMass = nextPayloadId === 'custom' ? customMassKg : spec.massKg;
    const nextDiam = nextPayloadId === 'custom' ? customDiameterM : spec.diameterM;
    const nextCd = nextPayloadId === 'custom' ? customDragCoeff : spec.dragCoeff;
    syncLiveTrajectoryWithEngine({
      payloadId: nextPayloadId,
      massKg: nextMass,
      diameterM: nextDiam,
      dragCoeff: nextCd,
    });
  };

  // Selección totalmente independiente de escenario planetario (mantiene intacto el proyectil actual)
  const handleSelectGravityPreset = (presetId: GravityPresetId) => {
    setGravityPresetId(presetId);
    setExoticPresetId(null);
    const preset = getGravityPresetById(presetId);
    const nextVac = presetId === 'moon' || presetId === 'space';
    setGravity(preset.gravityMs2);
    setAirDensity(preset.defaultAirDensityKgM3);
    setIsVacuum(nextVac);
    syncLiveTrajectoryWithEngine(
      {
        gravity: preset.gravityMs2,
        airDensity: preset.defaultAirDensityKgM3,
        isVacuum: nextVac,
      },
      preset.nameEs
    );
  };

  // Selección de plantilla de entorno exótico (Titán, Venus, Súper-Tierra, Ceres, etc.)
  const handleSelectExoticPreset = (presetId: ExoticEnvironmentPresetId) => {
    const exotic = EXOTIC_ENVIRONMENT_PRESETS.find((p) => p.id === presetId);
    if (!exotic) return;
    const nextVac = exotic.airDensityKgM3 <= 0;
    setGravityPresetId('custom');
    setExoticPresetId(presetId);
    setGravity(exotic.gravityMs2);
    setAirDensity(exotic.airDensityKgM3);
    setIsVacuum(nextVac);
    syncLiveTrajectoryWithEngine(
      {
        gravity: exotic.gravityMs2,
        airDensity: exotic.airDensityKgM3,
        isVacuum: nextVac,
      },
      exotic.nameEs
    );
  };

  // Ajuste manual numérico o por slider de gravedad (g) vinculado a PhysicsEngine2D (0 a 100 m/s²)
  const handleManualGravityChange = (rawValue: number) => {
    if (Number.isNaN(rawValue)) return;
    const clamped = Number(Math.max(0, Math.min(100, rawValue)).toFixed(2));
    setGravityPresetId(clamped === 0 && isVacuum ? 'space' : 'custom');
    setExoticPresetId(null);
    setGravity(clamped);
    syncLiveTrajectoryWithEngine({ gravity: clamped });
  };

  // Ajuste manual numérico o por slider de densidad del aire/fluido (ρ) vinculado a PhysicsEngine2D
  const handleManualDensityChange = (rawValue: number) => {
    if (Number.isNaN(rawValue)) return;
    const clamped = Number(Math.max(0, Math.min(65, rawValue)).toFixed(3));
    const nextVac = clamped === 0;
    setGravityPresetId('custom');
    setExoticPresetId(null);
    setAirDensity(clamped);
    setIsVacuum(nextVac);
    syncLiveTrajectoryWithEngine({ airDensity: clamped, isVacuum: nextVac });
  };

  // Presets didácticos rápidos
  const applyExperimentPreset = (presetKey: 'galileo' | 'watermelon-splat' | 'piano-jupiter' | 'paper-wind') => {
    setIsChallengeMode(false);
    setLastEvaluation(null);

    if (presetKey === 'galileo') {
      setGravityPresetId('earth');
      setGravity(9.81);
      setIsVacuum(true);
      setWindSpeed(0);
      setV0(36);
      setAngleDeg(45);
      setH0(8);
      const cannonSpec = getPayloadById('cannonball');
      const paperSpec = getPayloadById('paper-plane');

      const trajCannon = simulateFullTrajectory(
        {
          v0: 36,
          angleDeg: 45,
          h0: 8,
          gravity: 9.81,
          airDensity: 0,
          isVacuum: true,
          windSpeed: 0,
          massKg: cannonSpec.massKg,
          diameterM: cannonSpec.diameterM,
          dragCoeff: cannonSpec.dragCoeff,
          payloadId: 'cannonball',
        },
        { id: 'galileo-1', label: 'Bala de Cañón (17.6 kg) en Vacío', color: TRAJECTORY_COLORS[0] }
      );
      const trajPaper = simulateFullTrajectory(
        {
          v0: 36,
          angleDeg: 45,
          h0: 8,
          gravity: 9.81,
          airDensity: 0,
          isVacuum: true,
          windSpeed: 0,
          massKg: paperSpec.massKg,
          diameterM: paperSpec.diameterM,
          dragCoeff: paperSpec.dragCoeff,
          payloadId: 'paper-plane',
        },
        { id: 'galileo-2', label: 'Avión de Papel (5 g) en Vacío', color: TRAJECTORY_COLORS[1] }
      );
      setTrajectories([trajCannon, trajPaper]);
      const apexSample = trajCannon.samples.reduce(
        (best, curr) => (curr.y > best.y ? curr : best),
        trajCannon.samples[0]
      );
      setProbeSampleInfo({
        trajectoryLabel: trajCannon.label,
        color: trajCannon.color,
        sample: apexSample,
      });
      animTimeRef.current = 0;
      setPlaybackTimeS(0);
      isPlayingRef.current = true;
      setIsPlaying(true);
      playProceduralSound('fire');
    } else if (presetKey === 'watermelon-splat') {
      setPayloadId('watermelon');
      setGravityPresetId('earth');
      setGravity(9.81);
      setAirDensity(1.225);
      setIsVacuum(false);
      setWindSpeed(0);
      setV0(44);
      setAngleDeg(48);
      setH0(10);
      const spec = getPayloadById('watermelon');
      handleFireCannon(
        {
          v0: 44,
          angleDeg: 48,
          h0: 10,
          gravity: 9.81,
          airDensity: 1.225,
          isVacuum: false,
          windSpeed: 0,
          payloadId: 'watermelon',
          massKg: spec.massKg,
          diameterM: spec.diameterM,
          dragCoeff: spec.dragCoeff,
        },
        'Sandía Gigante · Impacto > 15 m/s'
      );
    } else if (presetKey === 'piano-jupiter') {
      setPayloadId('piano');
      setGravityPresetId('jupiter');
      setGravity(24.79);
      setAirDensity(1.326);
      setIsVacuum(false);
      setWindSpeed(-6);
      setV0(58);
      setAngleDeg(50);
      setH0(14);
      const spec = getPayloadById('piano');
      handleFireCannon(
        {
          v0: 58,
          angleDeg: 50,
          h0: 14,
          gravity: 24.79,
          airDensity: 1.326,
          isVacuum: false,
          windSpeed: -6,
          payloadId: 'piano',
          massKg: spec.massKg,
          diameterM: spec.diameterM,
          dragCoeff: spec.dragCoeff,
        },
        'Piano de Cola (400 kg) en Júpiter'
      );
    } else if (presetKey === 'paper-wind') {
      setPayloadId('paper-plane');
      setGravityPresetId('earth');
      setGravity(9.81);
      setAirDensity(1.225);
      setIsVacuum(false);
      setWindSpeed(-12);
      setV0(34);
      setAngleDeg(38);
      setH0(12);
      const spec = getPayloadById('paper-plane');
      handleFireCannon(
        {
          v0: 34,
          angleDeg: 38,
          h0: 12,
          gravity: 9.81,
          airDensity: 1.225,
          isVacuum: false,
          windSpeed: -12,
          payloadId: 'paper-plane',
          massKg: spec.massKg,
          diameterM: spec.diameterM,
          dragCoeff: spec.dragCoeff,
        },
        'Avión de Papel · Viento en Contra (-12 m/s)'
      );
    }
  };

  // Activar o cambiar nivel en Modo Desafío
  const activateChallengeLevel = (idx: number) => {
    const level = CHALLENGE_LEVELS[idx % CHALLENGE_LEVELS.length];
    setIsChallengeMode(true);
    setChallengeIndex(idx % CHALLENGE_LEVELS.length);
    setChallengeTarget(level);
    setWindSpeed(level.windChallengeSpeed);
    setIsVacuum(false);
    setGravityPresetId('earth');
    setGravity(9.81);
    setAirDensity(1.225);
    setLastEvaluation(null);
  };

  // Conversión de coordenadas de pantalla a coordenadas físicas en metros
  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const { scale, originX, originY } = worldTransformRef.current;
    const worldX = (px - originX) / scale;
    const worldY = (originY - py) / scale;
    return { x: worldX, y: worldY };
  }, []);

  // Interacción con mouse/touch sobre el lienzo 2D (rotar cañón, elevar plataforma, mover cinta o lupa)
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const world = screenToWorld(e.clientX, e.clientY);

    // 1. Verificar extremos de la cinta métrica si está activa
    if (showMeasuringTape) {
      const distStart = Math.hypot(world.x - tapeStart.x, world.y - tapeStart.y);
      const distEnd = Math.hypot(world.x - tapeEnd.x, world.y - tapeEnd.y);
      const threshold = 14 / worldTransformRef.current.scale;
      if (distStart <= threshold) {
        draggingModeRef.current = 'tape-start';
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
      if (distEnd <= threshold) {
        draggingModeRef.current = 'tape-end';
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }

    // 2. Verificar cercanía al cañón para rotar ángulo θ o ajustar plataforma h0
    const distToCannonPivot = Math.hypot(world.x - 0, world.y - h0);
    const cannonRadiusM = 28 / worldTransformRef.current.scale;
    if (distToCannonPivot <= cannonRadiusM && world.x >= -2) {
      draggingModeRef.current = 'cannon-angle';
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (Math.abs(world.x) <= 18 / worldTransformRef.current.scale && world.y >= 0 && world.y <= 32) {
      draggingModeRef.current = 'platform-height';
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    // 3. Buscar muestra más cercana en las trayectorias para la Lupa de Telemetría
    const hit = findNearestTrajectorySample(
      trajectories,
      world.x,
      world.y,
      24 / worldTransformRef.current.scale
    );
    if (hit) {
      draggingModeRef.current = 'probe';
      setProbeSampleInfo({
        trajectoryLabel: hit.trajectory.label,
        color: hit.trajectory.color,
        sample: hit.sample,
      });
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const world = screenToWorld(e.clientX, e.clientY);
    const mode = draggingModeRef.current;

    if (mode === 'cannon-angle') {
      const dx = Math.max(0.01, world.x);
      const dy = Math.max(0, world.y - h0);
      const deg = Math.round(Math.max(0, Math.min(90, (Math.atan2(dy, dx) * 180) / Math.PI)));
      setAngleDeg(deg);
      return;
    }

    if (mode === 'platform-height') {
      const clampedH = Math.round(Math.max(0, Math.min(30, world.y)) * 2) / 2;
      setH0(clampedH);
      return;
    }

    if (mode === 'tape-start') {
      setTapeStart({ x: Math.max(-5, world.x), y: Math.max(0, world.y) });
      return;
    }

    if (mode === 'tape-end') {
      setTapeEnd({ x: Math.max(-5, world.x), y: Math.max(0, world.y) });
      return;
    }

    // Si la lupa está activa, actualizar al pasar el cursor cerca de cualquier curva
    if (showTelemetryProbe) {
      const hit = findNearestTrajectorySample(
        trajectories,
        world.x,
        world.y,
        18 / worldTransformRef.current.scale
      );
      if (hit) {
        setProbeSampleInfo({
          trajectoryLabel: hit.trajectory.label,
          color: hit.trajectory.color,
          sample: hit.sample,
        });
      }
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggingModeRef.current !== 'none') {
      draggingModeRef.current = 'none';
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignorar si no tenía captura
      }
    }
  };

  // Bucle principal de renderizado 2D a 60 FPS
  useEffect(() => {
    let animationFrameId: number;
    let lastTimestamp = performance.now();

    const renderFrame = (now: number) => {
      const rawDt = Math.min(0.05, (now - lastTimestamp) / 1000);
      lastTimestamp = now;

      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) {
        animationFrameId = requestAnimationFrame(renderFrame);
        return;
      }

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(320, Math.floor(rect.width));
      const height = Math.max(360, Math.floor(rect.height));

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animationFrameId = requestAnimationFrame(renderFrame);
        return;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Calcular escala automática de cámara (metros -> píxeles) para encuadrar todo el recorrido
      const primaryTraj = trajectories[0];
      const maxTrajX = trajectories.reduce((acc, t) => Math.max(acc, t.rangeM), 60);
      const maxTrajY = trajectories.reduce((acc, t) => Math.max(acc, t.maxHeightM), Math.max(25, h0 + 15));
      const targetX = isChallengeMode ? challengeTarget.distanceX + 18 : 0;

      const worldSpanX = Math.max(75, maxTrajX * 1.15, targetX);
      const worldSpanY = Math.max(36, maxTrajY * 1.25, h0 + 18);

      const padLeft = Math.max(68, width * 0.09);
      const padRight = 36;
      const padBottom = 54;
      const padTop = 44;

      const scaleX = (width - padLeft - padRight) / worldSpanX;
      const scaleY = (height - padTop - padBottom) / worldSpanY;
      const baseScale = Math.max(1.1, Math.min(scaleX, scaleY));
      const scale = baseScale * manualZoomFactor;

      const originX = padLeft;
      const originY = height - padBottom;

      worldTransformRef.current = { scale, originX, originY, width, height };

      const toScreenX = (wx: number) => originX + wx * scale;
      const toScreenY = (wy: number) => originY - wy * scale;

      // Actualizar avance temporal de la simulación activa
      if (isPlayingRef.current && primaryTraj) {
        const nextT = animTimeRef.current + rawDt * timeScaleRef.current;
        if (nextT >= primaryTraj.flightTimeS) {
          animTimeRef.current = primaryTraj.flightTimeS;
          isPlayingRef.current = false;
          setIsPlaying(false);
          setPlaybackTimeS(primaryTraj.flightTimeS);
          spawnImpactEffects(primaryTraj);

          if (isChallengeMode) {
            const evalRes = evaluateTargetHit(primaryTraj, challengeTarget);
            if (evalRes.hit) {
              setScientistMood('celebrating');
              playProceduralSound('win');
            } else {
              setScientistMood('shocked');
            }
          } else {
            setScientistMood('celebrating');
          }
        } else {
          animTimeRef.current = nextT;
          // Sincronizar slider a ~15 Hz para no saturar React
          if (Math.floor(nextT * 15) !== Math.floor((nextT - rawDt) * 15)) {
            setPlaybackTimeS(nextT);
          }
        }
      }

      // 1. Fondo atmosférico / planetario reactivo según planeta activo
      const skyGrad = ctx.createLinearGradient(0, 0, 0, originY);
      skyGrad.addColorStop(0, activeGravityPreset.skyTopColor);
      skyGrad.addColorStop(1, activeGravityPreset.skyBottomColor);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, originY);

      // Estrellas en Luna, Espacio / Gravedad Cero o Cámara de Vacío
      if (isVacuum || gravityPresetId === 'moon' || gravityPresetId === 'space') {
        ctx.fillStyle = 'rgba(241, 245, 249, 0.55)';
        for (let i = 0; i < 44; i++) {
          const sx = ((i * 197) % (width - 20)) + 10;
          const sy = ((i * 89) % Math.max(60, originY - 40)) + 12;
          ctx.fillRect(sx, sy, i % 3 === 0 ? 2.2 : 1.3, i % 3 === 0 ? 2.2 : 1.3);
        }
      }

      // Bruma cobriza marciana sutil cuando el escenario es Marte
      if (gravityPresetId === 'mars') {
        const marsHaze = ctx.createLinearGradient(0, originY - 90, 0, originY);
        marsHaze.addColorStop(0, 'rgba(251, 146, 60, 0)');
        marsHaze.addColorStop(1, 'rgba(234, 88, 12, 0.22)');
        ctx.fillStyle = marsHaze;
        ctx.fillRect(0, originY - 90, width, 90);
      }

      // 2. Cuadrícula métrica técnica conmutable (X e Y en metros)
      if (showMetricGrid) {
        const rawStep = 80 / scale;
        const stepOptions = [2, 5, 10, 20, 25, 50, 100, 200];
        const gridStepM = stepOptions.find((s) => s >= rawStep) ?? 100;

        ctx.lineWidth = 1;
        ctx.font = '10px "JetBrains Mono", monospace';

        // Líneas verticales (Eje X)
        const maxGridX = Math.ceil((width - originX) / scale / gridStepM) * gridStepM;
        for (let gx = 0; gx <= maxGridX; gx += gridStepM) {
          const sx = toScreenX(gx);
          ctx.strokeStyle = gx === 0 ? 'rgba(148, 163, 184, 0.35)' : 'rgba(51, 65, 85, 0.35)';
          ctx.beginPath();
          ctx.moveTo(sx, 0);
          ctx.lineTo(sx, originY);
          ctx.stroke();
        }

        // Líneas horizontales (Eje Y)
        const maxGridY = Math.ceil(originY / scale / gridStepM) * gridStepM;
        for (let gy = 0; gy <= maxGridY; gy += gridStepM) {
          const sy = toScreenY(gy);
          ctx.strokeStyle = gy === 0 ? 'rgba(250, 204, 21, 0.65)' : 'rgba(51, 65, 85, 0.35)';
          ctx.beginPath();
          ctx.moveTo(0, sy);
          ctx.lineTo(width, sy);
          ctx.stroke();

          if (gy > 0) {
            ctx.fillStyle = '#94A3B8';
            ctx.textAlign = 'right';
            ctx.fillText(`${gy}m`, originX - 8, sy + 3);
          }
        }
      }

      // 3. Indicador de viento ambiental en el cielo (si hay atmósfera y viento != 0)
      if (!isVacuum && Math.abs(windSpeed) > 0.2) {
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
        ctx.lineWidth = 1.5;
        const windDir = Math.sign(windSpeed);
        const speedOffset = ((now * 0.04 * Math.abs(windSpeed)) % 180) * windDir;
        for (let i = 0; i < 6; i++) {
          const wy = 32 + i * 38;
          if (wy < originY - 40) {
            const wx = ((i * 170 + speedOffset + width) % (width - 80)) + 40;
            ctx.beginPath();
            ctx.moveTo(wx, wy);
            ctx.lineTo(wx + 32 * windDir, wy);
            ctx.lineTo(wx + 26 * windDir, wy - 4);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // 4. Superficie planetaria y línea de tierra amarilla (y = 0)
      ctx.fillStyle = activeGravityPreset.groundColor;
      ctx.fillRect(0, originY, width, height - originY);

      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, originY);
      ctx.lineTo(width, originY);
      ctx.stroke();

      // Etiquetas graduadas del eje X sobre la franja del suelo
      if (showMetricGrid) {
        const rawStep = 80 / scale;
        const stepOptions = [2, 5, 10, 20, 25, 50, 100, 200];
        const gridStepM = stepOptions.find((s) => s >= rawStep) ?? 100;
        const maxGridX = Math.ceil((width - originX) / scale / gridStepM) * gridStepM;
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#CBD5E1';
        ctx.textAlign = 'center';
        for (let gx = 0; gx <= maxGridX; gx += gridStepM) {
          const sx = toScreenX(gx);
          ctx.fillText(`${gx}m`, sx, originY + 16);
        }
      }

      // 5. Parábola teórica fantasma en vacío (cortada estrictamente en y = 0)
      if (showPredictiveGhost && !isVacuum && gravity > 1e-4) {
        const ghostParams = buildCurrentSimulationParams({ isVacuum: true });
        const rad = (ghostParams.angleDeg * Math.PI) / 180;
        const v0x = ghostParams.v0 * Math.cos(rad);
        const v0y = ghostParams.v0 * Math.sin(rad);
        const g = Math.max(0.01, ghostParams.gravity);
        const tMax = (v0y + Math.sqrt(v0y * v0y + 2 * g * ghostParams.h0)) / g;

        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let step = 0; step <= 40; step++) {
          const t = (step / 40) * tMax;
          const gx = v0x * t;
          const gy = Math.max(0, ghostParams.h0 + v0y * t - 0.5 * g * t * t);
          const sx = toScreenX(gx);
          const sy = Math.min(originY, toScreenY(gy));
          if (step === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
        ctx.restore();
      }

      // 6. Diana del Modo Desafío ("Tiro al Blanco / Artillería")
      if (isChallengeMode) {
        const tx = toScreenX(challengeTarget.distanceX);
        const ty = toScreenY(0);
        const radPx = Math.max(14, challengeTarget.radiusM * scale);

        // Anillos concéntricos de la diana sobre el terreno
        ctx.save();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.beginPath();
        ctx.ellipse(tx, ty, radPx, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Estandarte / Diana vertical
        ctx.strokeStyle = '#F8FAFC';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx, ty - 34);
        ctx.stroke();

        // Círculos de la diana
        const rings = [
          { r: 14, color: '#EF4444' },
          { r: 9.5, color: '#F8FAFC' },
          { r: 5, color: '#EF4444' },
          { r: 2, color: '#FACC15' },
        ];
        rings.forEach((ring) => {
          ctx.fillStyle = ring.color;
          ctx.beginPath();
          ctx.arc(tx, ty - 34, ring.r, 0, Math.PI * 2);
          ctx.fill();
        });

        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        ctx.fillStyle = '#FACC15';
        ctx.textAlign = 'center';
        ctx.fillText(`DIANA: ${challengeTarget.distanceX.toFixed(0)} m`, tx, ty + 28);
        ctx.restore();
      }

      // 7. Plataforma Hidráulica Elevadora + Científico Excéntrico + Cañón Neumático
      const platScreenX = toScreenX(0);
      const platScreenY = toScreenY(h0);
      const groundScreenY = toScreenY(0);

      // Tijera hidráulica metálica desde el suelo hasta h0
      if (h0 > 0.2) {
        ctx.save();
        ctx.fillStyle = '#0F172A';
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2;
        ctx.fillRect(platScreenX - 18, platScreenY, 36, groundScreenY - platScreenY);
        ctx.strokeRect(platScreenX - 18, platScreenY, 36, groundScreenY - platScreenY);

        // Barras cruzadas de la plataforma hidráulica
        const segments = Math.max(1, Math.min(6, Math.ceil(h0 / 5)));
        const segH = (groundScreenY - platScreenY) / segments;
        ctx.strokeStyle = '#64748B';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < segments; i++) {
          const yTop = platScreenY + i * segH;
          const yBot = yTop + segH;
          ctx.beginPath();
          ctx.moveTo(platScreenX - 16, yTop);
          ctx.lineTo(platScreenX + 16, yBot);
          ctx.moveTo(platScreenX + 16, yTop);
          ctx.lineTo(platScreenX - 16, yBot);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Base superior de la plataforma
      ctx.fillStyle = '#1E293B';
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 2;
      ctx.fillRect(platScreenX - 28, platScreenY - 5, 56, 7);
      ctx.strokeRect(platScreenX - 28, platScreenY - 5, 56, 7);

      // Etiqueta de altura h0
      if (h0 > 0) {
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#38BDF8';
        ctx.textAlign = 'right';
        ctx.fillText(`h₀=${h0.toFixed(1)}m`, platScreenX - 32, platScreenY + 4);
      }

      // Científico excéntrico a la izquierda del cañón sobre la plataforma
      ctx.save();
      const sciX = platScreenX - 18;
      const sciBaseY = platScreenY - 5;
      const jumpOffset =
        scientistMood === 'celebrating' ? Math.abs(Math.sin(now * 0.012)) * 8 : 0;

      // Bata de laboratorio
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(sciX - 6, sciBaseY - 22 - jumpOffset, 12, 16);
      // Pantalones
      ctx.fillStyle = '#334155';
      ctx.fillRect(sciX - 5, sciBaseY - 6 - jumpOffset, 4, 6);
      ctx.fillRect(sciX + 1, sciBaseY - 6 - jumpOffset, 4, 6);
      // Cabeza
      ctx.fillStyle = '#FDE68A';
      ctx.beginPath();
      ctx.arc(sciX, sciBaseY - 27 - jumpOffset, 6, 0, Math.PI * 2);
      ctx.fill();
      // Pelo alborotado de científico loco
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1.6;
      for (let a = -2.4; a <= -0.7; a += 0.42) {
        ctx.beginPath();
        ctx.moveTo(sciX + Math.cos(a) * 5, sciBaseY - 27 - jumpOffset + Math.sin(a) * 5);
        ctx.lineTo(sciX + Math.cos(a) * 10, sciBaseY - 27 - jumpOffset + Math.sin(a) * 10);
        ctx.stroke();
      }
      // Gafas protectoras cian
      ctx.fillStyle = '#22D3EE';
      ctx.fillRect(sciX - 5, sciBaseY - 29 - jumpOffset, 10, 3.5);
      // Brazos animados según estado
      ctx.strokeStyle = '#F8FAFC';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      if (scientistMood === 'celebrating') {
        ctx.moveTo(sciX - 5, sciBaseY - 19 - jumpOffset);
        ctx.lineTo(sciX - 12, sciBaseY - 29 - jumpOffset);
        ctx.moveTo(sciX + 5, sciBaseY - 19 - jumpOffset);
        ctx.lineTo(sciX + 12, sciBaseY - 29 - jumpOffset);
      } else if (scientistMood === 'shocked') {
        ctx.moveTo(sciX - 5, sciBaseY - 19);
        ctx.lineTo(sciX - 8, sciBaseY - 27);
        ctx.moveTo(sciX + 5, sciBaseY - 19);
        ctx.lineTo(sciX + 8, sciBaseY - 27);
      } else {
        ctx.moveTo(sciX + 4, sciBaseY - 18);
        ctx.lineTo(platScreenX - 2, platScreenY - 15);
      }
      ctx.stroke();
      ctx.restore();

      // Cañón Neumático Ajustable con retroceso elástico
      if (cannonRecoilRef.current > 0) {
        cannonRecoilRef.current = Math.max(0, cannonRecoilRef.current - rawDt * 4.5);
      }
      const recoilPx = Math.sin(cannonRecoilRef.current * Math.PI) * 9;

      ctx.save();
      ctx.translate(platScreenX, platScreenY - 12);
      const rad = (angleDeg * Math.PI) / 180;

      // Arco transportador angular
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, 34, -rad, 0);
      ctx.stroke();

      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#22D3EE';
      ctx.textAlign = 'left';
      ctx.fillText(`${angleDeg}°`, 38, -6);

      ctx.rotate(-rad);
      ctx.translate(-recoilPx, 0);

      // Tubo del cañón neumático
      const barrelGrad = ctx.createLinearGradient(0, -9, 0, 9);
      barrelGrad.addColorStop(0, '#475569');
      barrelGrad.addColorStop(0.5, '#1E293B');
      barrelGrad.addColorStop(1, '#0F172A');
      ctx.fillStyle = barrelGrad;
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-6, -8, 38, 16, 4);
      ctx.fill();
      ctx.stroke();

      // Boca anular del cañón
      ctx.fillStyle = '#22D3EE';
      ctx.fillRect(28, -9.5, 5, 19);
      ctx.restore();

      // Rueda / pivote mecánico del cañón
      ctx.fillStyle = '#0F172A';
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(platScreenX, platScreenY - 12, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 8. Nube de vapor al disparar
      if (steamParticlesRef.current.length > 0) {
        steamParticlesRef.current.forEach((sp) => {
          sp.x += sp.vx * rawDt;
          sp.y += sp.vy * rawDt;
          sp.radius += rawDt * 12;
          sp.alpha = Math.max(0, sp.alpha - rawDt * 1.4);
          if (sp.alpha > 0.01) {
            ctx.fillStyle = `rgba(226, 232, 240, ${sp.alpha.toFixed(2)})`;
            ctx.beginPath();
            ctx.arc(toScreenX(sp.x), toScreenY(sp.y), sp.radius, 0, Math.PI * 2);
            ctx.fill();
          }
        });
        steamParticlesRef.current = steamParticlesRef.current.filter((sp) => sp.alpha > 0.02);
      }

      // 9. Dibujar las últimas 3 trayectorias en el Comparador
      for (let tIdx = trajectories.length - 1; tIdx >= 0; tIdx--) {
        const traj = trajectories[tIdx];
        const isCurrent = tIdx === 0;
        const maxTimeRender =
          isCurrent && isPlayingRef.current ? animTimeRef.current : traj.flightTimeS;

        // Si está en pleno vuelo animado, dibujar también el arco balístico completo proyectado hasta y = 0
        if (isCurrent && isPlayingRef.current && animTimeRef.current < traj.flightTimeS) {
          ctx.save();
          ctx.strokeStyle = traj.color;
          ctx.lineWidth = 1.6;
          ctx.globalAlpha = 0.35;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          for (let i = 0; i < traj.samples.length; i++) {
            const s = traj.samples[i];
            const sx = toScreenX(s.x);
            const sy = Math.min(originY, toScreenY(Math.max(0, s.y)));
            if (i === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
            if (i > 0 && s.y <= 0) break;
          }
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        ctx.strokeStyle = traj.color;
        ctx.lineWidth = isCurrent ? 2.8 : 1.8;
        ctx.globalAlpha = isCurrent ? 0.95 : 0.55;
        if (!isCurrent) {
          ctx.setLineDash([6, 4]);
        }

        ctx.beginPath();
        let activeSample: TrajectorySample2D = traj.samples[0];
        for (let i = 0; i < traj.samples.length; i++) {
          const s = traj.samples[i];
          if (s.t <= maxTimeRender) {
            activeSample = s;
            const sx = toScreenX(s.x);
            // Corte estricto en y = 0: jamás dibujar por debajo de la línea de tierra amarilla (originY)
            const sy = Math.min(originY, toScreenY(Math.max(0, s.y)));
            if (i === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
            if (i > 0 && s.y <= 0) {
              break;
            }
          } else {
            break;
          }
        }
        ctx.stroke();
        ctx.restore();

        // Marcador del Ápice (Altura máxima)
        if ((maxTimeRender >= traj.apexTimeS || !isPlayingRef.current) && traj.maxHeightM > 0.5) {
          const ax = toScreenX(traj.apexX);
          const ay = toScreenY(traj.maxHeightM);
          ctx.save();
          ctx.fillStyle = traj.color;
          ctx.beginPath();
          ctx.arc(ax, ay, 4, 0, Math.PI * 2);
          ctx.fill();
          if (isCurrent) {
            ctx.font = 'bold 10px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`Ápice: ${traj.maxHeightM.toFixed(1)} m`, ax, ay - 9);
          }
          ctx.restore();
        }

        // Marcador de Impacto exacto sobre el suelo amarillo (y = 0) + Onda de Choque Cinética (E_k = ½·m·v²)
        if (traj.rangeM > 0.2) {
          const impactScreenX = toScreenX(traj.rangeM);
          const impactEkJoules = 0.5 * traj.params.massKg * traj.impactSpeedMs * traj.impactSpeedMs;
          const ekLabel =
            impactEkJoules >= 1000
              ? `${(impactEkJoules / 1000).toFixed(2)} kJ`
              : `${impactEkJoules.toFixed(1)} J`;
          ctx.save();
          if (isCurrent && (!isPlayingRef.current || maxTimeRender >= traj.flightTimeS - 0.05)) {
            const shockRadiusPx = Math.min(34, Math.max(11, Math.log10(1 + impactEkJoules) * 7.5));
            ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.ellipse(impactScreenX, originY, shockRadiusPx, shockRadiusPx * 0.32, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.fillStyle = traj.color;
          ctx.strokeStyle = '#07090E';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(impactScreenX, originY, isCurrent ? 4.5 : 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          if (isCurrent) {
            ctx.font = 'bold 10px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#FACC15';
            ctx.fillText(
              `Impacto: ${traj.rangeM.toFixed(1)} m · E_k=${ekLabel}`,
              impactScreenX,
              originY - 22
            );
          }
          ctx.restore();
        }

        // Renderizar el proyectil y sus vectores en la trayectoria principal (tIdx === 0)
        if (isCurrent && activeSample) {
          const px = toScreenX(activeSample.x);
          const py = Math.min(originY, toScreenY(Math.max(0, activeSample.y)));
          const isInFlightAboveGround = activeSample.y > 0.02;

          // Vectores Físicos en Vivo (v, a, F_drag) — solo en vuelo (jamás bajo y = 0)
          const drawArrow = (
            fromX: number,
            fromY: number,
            toX: number,
            toY: number,
            color: string,
            label: string
          ) => {
            const clampedToY = Math.min(originY - 2, toY);
            const dx = toX - fromX;
            const dy = clampedToY - fromY;
            const len = Math.hypot(dx, dy);
            if (len < 6) return;
            const angle = Math.atan2(dy, dx);
            ctx.save();
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(fromX, fromY);
            ctx.lineTo(toX, clampedToY);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(toX, clampedToY);
            ctx.lineTo(toX - 8 * Math.cos(angle - 0.4), clampedToY - 8 * Math.sin(angle - 0.4));
            ctx.lineTo(toX - 8 * Math.cos(angle + 0.4), clampedToY - 8 * Math.sin(angle + 0.4));
            ctx.closePath();
            ctx.fill();

            ctx.font = 'bold 10px "JetBrains Mono", monospace';
            ctx.fillText(label, toX + 6, clampedToY - 4);
            ctx.restore();
          };

          if (isInFlightAboveGround && showVelocityVector && activeSample.speed > 0.2) {
            const vScale = 1.35;
            const vxPx = activeSample.vx * vScale;
            const vyPx = -activeSample.vy * vScale;
            const targetVyY = Math.min(originY - 2, py + vyPx);

            // Componentes punteadas vx y vy
            ctx.save();
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.55)';
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + vxPx, py);
            ctx.lineTo(px + vxPx, targetVyY);
            ctx.stroke();
            ctx.restore();

            drawArrow(
              px,
              py,
              px + vxPx,
              targetVyY,
              '#10B981',
              `v=${activeSample.speed.toFixed(1)}m/s`
            );
          }

          if (isInFlightAboveGround && showAccelerationVector) {
            const aScale = 2.6;
            drawArrow(
              px,
              py,
              px + activeSample.ax * aScale,
              py - activeSample.ay * aScale,
              '#FACC15',
              'a'
            );
          }

          if (isInFlightAboveGround && showDragVector && activeSample.dragMagnitude > 0.01) {
            const fNorm = Math.min(65, 14 * Math.log10(1 + activeSample.dragMagnitude * 2));
            const fAngle = Math.atan2(-activeSample.dragForceY, activeSample.dragForceX);
            drawArrow(
              px,
              py,
              px + Math.cos(fAngle) * fNorm,
              py + Math.sin(fAngle) * fNorm,
              '#EF4444',
              `F_d=${activeSample.dragMagnitude.toFixed(1)}N`
            );
          }

          // Dibujar el sprite vectorial del proyectil actual
          ctx.save();
          // Pequeño salto elástico cómico si es el piano al tocar el suelo
          const pianoElasticBounce =
            traj.params.payloadId === 'piano' && activeSample.y <= 0.02
              ? -Math.abs(Math.sin(now * 0.015)) * 7
              : 0;
          ctx.translate(px, py + pianoElasticBounce);
          const pType = traj.params.payloadId;
          const velAngle = Math.atan2(-activeSample.vy, activeSample.vx);

          if (pType === 'piano') {
            ctx.rotate(activeSample.y <= 0.02 ? -0.15 : activeSample.t * 3.2);
            ctx.fillStyle = '#0F172A';
            ctx.strokeStyle = '#F8FAFC';
            ctx.lineWidth = 1.5;
            ctx.fillRect(-11, -8, 22, 16);
            ctx.strokeRect(-11, -8, 22, 16);
            // Teclado blanco y negro
            ctx.fillStyle = '#F8FAFC';
            ctx.fillRect(-9, 3, 18, 4);
          } else if (pType === 'watermelon') {
            // Al impactar en y = 0 se fragmenta en salpicadura roja y verde
            if (activeSample.y > 0.02) {
              ctx.rotate(activeSample.t * 4);
              ctx.fillStyle = '#16A34A';
              ctx.strokeStyle = '#14532D';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.ellipse(0, 0, 10, 7.5, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }
          } else if (pType === 'paper-plane') {
            ctx.rotate(velAngle);
            ctx.fillStyle = '#F8FAFC';
            ctx.strokeStyle = '#38BDF8';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(12, 0);
            ctx.lineTo(-9, -6);
            ctx.lineTo(-5, 0);
            ctx.lineTo(-9, 6);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          } else if (pType === 'astronaut') {
            ctx.rotate(activeSample.vy < 0 ? 0 : activeSample.t * 2.5);
            // Casco y traje EVA
            ctx.fillStyle = '#F8FAFC';
            ctx.fillRect(-5, -4, 10, 11);
            ctx.beginPath();
            ctx.arc(0, -8, 5.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#F59E0B';
            ctx.fillRect(-3.5, -10, 7, 4);
            // Paraguas abierto en descenso
            if (activeSample.vy < -1) {
              ctx.strokeStyle = '#EC4899';
              ctx.fillStyle = '#EC4899';
              ctx.lineWidth = 1.8;
              ctx.beginPath();
              ctx.moveTo(0, -8);
              ctx.lineTo(0, -22);
              ctx.stroke();
              ctx.beginPath();
              ctx.arc(0, -20, 11, Math.PI, 0);
              ctx.fill();
            }
          } else if (pType === 'rubber-duck') {
            ctx.fillStyle = '#FACC15';
            ctx.beginPath();
            ctx.ellipse(0, 2, 8, 5.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(5, -4, 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FB923C';
            ctx.fillRect(8, -5, 4, 2.5);
          } else if (pType === 'golfball') {
            ctx.fillStyle = '#F8FAFC';
            ctx.beginPath();
            ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Bala de cañón clásica u objeto personalizado
            ctx.fillStyle = pType === 'custom' ? '#A855F7' : '#475569';
            ctx.strokeStyle = '#E2E8F0';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // 10. Partículas de impacto en el suelo (sandía, teclas de piano, polvo)
      if (impactParticlesRef.current.length > 0) {
        impactParticlesRef.current.forEach((pt) => {
          pt.x += pt.vx * rawDt;
          pt.y = Math.max(0, pt.y + pt.vy * rawDt);
          pt.vy -= gravity * rawDt;
          if (pt.y <= 0) {
            pt.vx *= 0.85;
            pt.vy = 0;
          }
          pt.rotation += pt.vRot * rawDt;
          pt.alpha = Math.max(0, pt.alpha - rawDt * 0.35);

          if (pt.alpha > 0.02) {
            ctx.save();
            ctx.translate(toScreenX(pt.x), toScreenY(pt.y));
            ctx.rotate(pt.rotation);
            ctx.globalAlpha = pt.alpha;
            ctx.fillStyle = pt.color;
            if (pt.shape === 'rect') {
              ctx.fillRect(-pt.size, -pt.size * 0.5, pt.size * 2, pt.size);
            } else {
              ctx.beginPath();
              ctx.arc(0, 0, pt.size, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          }
        });
      }

      // 11. Cinta Métrica Interactiva Arrastrable
      if (showMeasuringTape) {
        const sx1 = toScreenX(tapeStart.x);
        const sy1 = toScreenY(tapeStart.y);
        const sx2 = toScreenX(tapeEnd.x);
        const sy2 = toScreenY(tapeEnd.y);
        const distM = Math.hypot(tapeEnd.x - tapeStart.x, tapeEnd.y - tapeStart.y);
        const dxM = tapeEnd.x - tapeStart.x;
        const dyM = tapeEnd.y - tapeStart.y;

        ctx.save();
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 2.2;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Nodos arrastrables de la cinta métrica
        [
          { x: sx1, y: sy1 },
          { x: sx2, y: sy2 },
        ].forEach((pt) => {
          ctx.fillStyle = '#0F172A';
          ctx.strokeStyle = '#FACC15';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });

        // Etiqueta central de medición
        const midX = (sx1 + sx2) * 0.5;
        const midY = (sy1 + sy2) * 0.5 - 12;
        const labelText = `📏 ${distM.toFixed(2)} m (ΔX:${dxM.toFixed(1)}m, ΔY:${dyM.toFixed(1)}m)`;
        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        const textW = ctx.measureText(labelText).width + 14;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 1.2;
        ctx.fillRect(midX - textW * 0.5, midY - 14, textW, 20);
        ctx.strokeRect(midX - textW * 0.5, midY - 14, textW, 20);
        ctx.fillStyle = '#FACC15';
        ctx.textAlign = 'center';
        ctx.fillText(labelText, midX, midY);
        ctx.restore();
      }

      // 12. Lupa / Sonda de Telemetría Flotante sobre la trayectoria
      if (showTelemetryProbe && probeSampleInfo) {
        const { sample, color } = probeSampleInfo;
        const px = toScreenX(sample.x);
        const py = toScreenY(sample.y);

        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, 9, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(px - 13, py);
        ctx.lineTo(px + 13, py);
        ctx.moveTo(px, py - 13);
        ctx.lineTo(px, py + 13);
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();

      const hasActiveParticles =
        steamParticlesRef.current.some((p) => p.alpha > 0.02) ||
        impactParticlesRef.current.some((p) => p.alpha > 0.02) ||
        cannonRecoilRef.current > 0.01;
      const hasWindAnimation = !isVacuum && Math.abs(windSpeed) > 0.2;

      if (isPlayingRef.current || hasActiveParticles || hasWindAnimation) {
        timerId = window.setTimeout(() => {
          animationFrameId = requestAnimationFrame(renderFrame);
        }, 16);
      }
    };

    let timerId: number | undefined;
    animationFrameId = requestAnimationFrame(renderFrame);

    const containerEl = containerRef.current;
    const resizeObs =
      containerEl && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(renderFrame);
          })
        : null;
    if (resizeObs && containerEl) {
      resizeObs.observe(containerEl);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (timerId !== undefined) window.clearTimeout(timerId);
      resizeObs?.disconnect();
    };
  }, [
    trajectories,
    isPlaying,
    h0,
    angleDeg,
    gravity,
    isVacuum,
    windSpeed,
    showMetricGrid,
    showVelocityVector,
    showAccelerationVector,
    showDragVector,
    showTelemetryProbe,
    showMeasuringTape,
    showPredictiveGhost,
    tapeStart,
    tapeEnd,
    probeSampleInfo,
    isChallengeMode,
    challengeTarget,
    manualZoomFactor,
    activeGravityPreset,
    gravityPresetId,
    scientistMood,
    buildCurrentSimulationParams,
    spawnImpactEffects,
    playProceduralSound,
  ]);

  const primaryTrajectory = trajectories[0] ?? null;

  // Control manual del deslizador temporal para mover la sonda e inspección paso a paso
  const handleScrubTime = (newTimeS: number) => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    animTimeRef.current = newTimeS;
    setPlaybackTimeS(newTimeS);

    if (primaryTrajectory) {
      const closest = primaryTrajectory.samples.reduce((prev, curr) =>
        Math.abs(curr.t - newTimeS) < Math.abs(prev.t - newTimeS) ? curr : prev
      );
      setProbeSampleInfo({
        trajectoryLabel: primaryTrajectory.label,
        color: primaryTrajectory.color,
        sample: closest,
      });
    }
  };

  return (
    <div
      id="kinematics-view"
      data-testid="kinematics-view"
      className="simulator-view space-y-3.5"
    >
      {/* Cabina Principal Unificada: Título Compacto + Selector Independiente de Escenarios Planetarios + Conmutador de Modo */}
      <div className="rounded-xl bg-[#0A0E17] border border-slate-800 px-3.5 py-2.5 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-cyan-400">
              <span>MÓDULO 04 · CINEMÁTICA 2D</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-400">SOLVER RK4 + RAYLEIGH</span>
            </div>
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {lang === 'es'
                ? 'Laboratorio de Balística y Resistencia Aerodinámica'
                : 'Projectile Ballistics & Aerodynamic Drag Lab'}
            </h1>
          </div>
        </div>

        {/* Barra Independiente de Escenarios Planetarios Conmutables */}
        <div
          data-testid="planetary-scenario-bar"
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Selector de Escenarios Planetarios"
        >
          {GRAVITY_PRESETS.filter((p) => p.id !== 'custom').map((env) => {
            const isSelected = gravityPresetId === env.id && !exoticPresetId;
            return (
              <button
                key={env.id}
                type="button"
                data-testid={`scenario-chip-${env.id}`}
                onClick={() => handleSelectGravityPreset(env.id)}
                className={`min-h-[2.25rem] px-2.5 py-1 rounded-lg border text-xs font-mono cursor-pointer instrument-transition flex items-center gap-1.5 whitespace-nowrap ${
                  isSelected
                    ? 'bg-cyan-400/15 border-cyan-400 text-white font-bold shadow-[0_0_12px_rgba(34,211,238,0.35)]'
                    : 'bg-[#07090E] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                }`}
              >
                <span className="text-sm leading-none">{env.iconEmoji}</span>
                <span>{env.nameEs}</span>
                <span className="text-[10px] text-slate-400 tabular-nums hidden sm:inline">
                  ({env.gravityMs2} m/s²)
                </span>
              </button>
            );
          })}
        </div>

        {/* Conmutador de Modo y Guía */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center rounded-lg bg-[#07090E] border border-slate-800 p-0.5">
            <button
              type="button"
              data-testid="kinematics-mode-free"
              onClick={() => {
                setIsChallengeMode(false);
                setLastEvaluation(null);
              }}
              className={`min-h-[2rem] px-2.5 py-1 rounded-md text-xs font-mono font-semibold instrument-transition cursor-pointer whitespace-nowrap ${
                !isChallengeMode
                  ? 'bg-cyan-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Exploración Libre
            </button>
            <button
              type="button"
              data-testid="kinematics-mode-challenge"
              onClick={() => activateChallengeLevel(challengeIndex)}
              className={`min-h-[2rem] px-2.5 py-1 rounded-md text-xs font-mono font-semibold instrument-transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                isChallengeMode
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Modo Desafío</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowTutorialOverlay((prev) => !prev)}
            className="min-h-[2.25rem] px-2.5 py-1 rounded-lg bg-[#0D1322] border border-slate-700 hover:border-cyan-400 text-xs font-mono text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Guía</span>
          </button>
        </div>
      </div>

      {/* Guía Interactiva Desplegable con Botón Omitir */}
      {showTutorialOverlay && (
        <div className="rounded-xl bg-[#0D1322] border border-cyan-500/50 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-mono font-bold text-cyan-300">
              GUÍA DE OPERACIÓN DEL CAÑÓN NEUMÁTICO Y SONDA RK4
            </span>
            <button
              type="button"
              onClick={() => setShowTutorialOverlay(false)}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Omitir tutorial</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
            <div className="p-3 rounded-lg bg-[#07090E] border border-slate-800 space-y-1">
              <div className="font-mono font-semibold text-white">1. Escenarios y Proyectiles Independientes</div>
              <p>
                Selecciona cualquier planeta (Tierra, Luna, Marte, Júpiter o Gravedad Cero) y combínalo libremente con cualquiera de los 8 proyectiles sin restricciones.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#07090E] border border-slate-800 space-y-1">
              <div className="font-mono font-semibold text-white">2. Cámara de Vacío vs. Atmósfera</div>
              <p>
                Usa el botón <strong>Comparar Vacío vs. Aire</strong> para verificar la ley de Galileo (en vacío una bala de 17.6 kg y un avión de papel de 5 g caen exactamente igual).
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#07090E] border border-slate-800 space-y-1">
              <div className="font-mono font-semibold text-white">3. Lupa de Telemetría y Cinta Métrica</div>
              <p>
                Pasa el cursor sobre cualquier trayectoria para inspeccionar Tiempo, X, Y, Velocidad y Energías (Ec, Ep), o activa la <strong>Cinta Métrica</strong> para medir distancias manualmente.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Layout Principal: Lienzo 2D Interactivo (Izquierda/Arriba) + Panel de Instrumentación (Derecha) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Columna del Escenario 2D y Telemetría Instantánea */}
        <div className="xl:col-span-8 space-y-3.5">
          <div className="rounded-xl bg-[#0A0E17] border border-slate-800 overflow-hidden">
            {/* Barra de herramientas sobre el lienzo */}
            <div className="px-3.5 py-2 bg-[#0D1322] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  data-testid="fire-cannon-btn"
                  onClick={() => handleFireCannon()}
                  className="min-h-[2.25rem] px-3.5 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-mono font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Disparar Cañón</span>
                </button>

                <button
                  type="button"
                  data-testid="compare-vacuum-air-btn"
                  onClick={handleCompareVacuumVsAir}
                  className="min-h-[2.25rem] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 font-mono font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Comparar Vacío vs. Aire</span>
                </button>

                <button
                  type="button"
                  data-testid="preset-galileo-vacuum"
                  onClick={() => applyExperimentPreset('galileo')}
                  className="min-h-[2.25rem] px-2.5 py-1.5 rounded-lg bg-[#07090E] hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-cyan-300 font-mono cursor-pointer whitespace-nowrap"
                >
                  Demo Galileo
                </button>

                <button
                  type="button"
                  data-testid="wind-gust-btn"
                  onClick={() => {
                    const nextWind = windSpeed <= -12 ? 16 : -16;
                    setIsVacuum(false);
                    setWindSpeed(nextWind);
                    handleFireCannon(
                      { isVacuum: false, windSpeed: nextWind },
                      `Ráfaga ${nextWind > 0 ? '+' : ''}${nextWind} m/s`
                    );
                  }}
                  className="min-h-[2.25rem] px-2.5 py-1.5 rounded-lg bg-sky-950/70 hover:bg-sky-900/70 border border-sky-500/60 text-sky-200 font-mono font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <Wind className="w-3.5 h-3.5 text-sky-400" />
                  <span>🌪️ Ráfaga Turbulenta</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const nextState = !isPlaying;
                    if (nextState && primaryTrajectory && animTimeRef.current >= primaryTrajectory.flightTimeS) {
                      animTimeRef.current = 0;
                    }
                    isPlayingRef.current = nextState;
                    setIsPlaying(nextState);
                  }}
                  aria-label={isPlaying ? 'Pausar vuelo' : 'Reanudar vuelo'}
                  className="min-h-[2.25rem] px-2.5 py-1.5 rounded-lg bg-[#07090E] border border-slate-800 text-slate-200 hover:text-white font-mono flex items-center gap-1 cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isPlaying ? 'Pausa' : 'Reproducir'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTimeScale((prev) => (prev === 1 ? 0.25 : 1))}
                  className={`min-h-[2.25rem] px-2.5 py-1.5 rounded-lg border font-mono cursor-pointer ${
                    timeScale < 1
                      ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                      : 'bg-[#07090E] border-slate-800 text-slate-300'
                  }`}
                >
                  {timeScale < 1 ? '0.25× Lento' : '1.0× Normal'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTrajectories([]);
                    setProbeSampleInfo(null);
                    impactParticlesRef.current = [];
                  }}
                  className="min-h-[2.25rem] px-2.5 py-1.5 rounded-lg bg-[#07090E] border border-slate-800 text-slate-300 hover:text-rose-300 font-mono flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Limpiar</span>
                </button>
              </div>

              {/* Herramientas de medición y zoom */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  data-testid="toggle-measuring-tape"
                  onClick={() => setShowMeasuringTape((prev) => !prev)}
                  className={`min-h-[2.25rem] px-2.5 py-1.5 rounded-lg border font-mono flex items-center gap-1 cursor-pointer ${
                    showMeasuringTape
                      ? 'bg-amber-400 text-slate-950 border-amber-400 font-bold'
                      : 'bg-[#07090E] border-slate-800 text-slate-300'
                  }`}
                >
                  <Ruler className="w-3.5 h-3.5" />
                  <span>Cinta Métrica</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowMetricGrid((prev) => !prev)}
                  className={`min-h-[2.25rem] px-2.5 py-1.5 rounded-lg border font-mono cursor-pointer ${
                    showMetricGrid
                      ? 'bg-slate-800 text-cyan-300 border-slate-700'
                      : 'bg-[#07090E] border-slate-800 text-slate-400'
                  }`}
                >
                  Grilla X/Y
                </button>

                <button
                  type="button"
                  aria-label="Alejar cámara"
                  onClick={() => setManualZoomFactor((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))))}
                  className="min-h-[2.25rem] px-2 py-1.5 rounded-lg bg-[#07090E] border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Restablecer zoom automático"
                  onClick={() => setManualZoomFactor(1.0)}
                  className="min-h-[2.25rem] px-2 py-1.5 rounded-lg bg-[#07090E] border border-slate-800 text-slate-300 font-mono text-[11px] cursor-pointer"
                >
                  Auto
                </button>
                <button
                  type="button"
                  aria-label="Acercar cámara"
                  onClick={() => setManualZoomFactor((z) => Math.min(2.2, Number((z + 0.15).toFixed(2))))}
                  className="min-h-[2.25rem] px-2 py-1.5 rounded-lg bg-[#07090E] border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Contenedor del Lienzo HTML5 2D */}
            <div
              ref={containerRef}
              className="relative w-full h-[420px] sm:h-[490px] bg-[#060B14] select-none overflow-hidden"
            >
              <canvas
                ref={canvasRef}
                data-testid="kinematics-canvas"
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                className="w-full h-full block cursor-crosshair touch-none"
              />

              {/* HUD Superpuesto Superior Izquierdo: Estado Planetario, Proyectil y Viento */}
              <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap items-center gap-2 text-[11px] font-mono">
                <div
                  data-testid="canvas-planet-hud"
                  className="px-2.5 py-1 rounded bg-[#07090E]/90 border border-slate-800 text-slate-100 font-semibold"
                >
                  {activeGravityPreset.iconEmoji}{' '}
                  {gravityPresetId === 'custom' && activeExoticPreset
                    ? activeExoticPreset.nameEs
                    : activeGravityPreset.nameEs}
                  : g = {gravity.toFixed(2)} m/s²
                </div>
                <div className="px-2.5 py-1 rounded bg-[#07090E]/90 border border-slate-800 text-amber-300">
                  {activePayload.iconEmoji} {activePayload.nameEs} ({effectiveMassKg} kg)
                </div>
                <div
                  className={`px-2.5 py-1 rounded border ${
                    isVacuum
                      ? 'bg-purple-950/90 border-purple-500/50 text-purple-200'
                      : 'bg-[#07090E]/90 border-slate-800 text-cyan-300'
                  }`}
                >
                  {isVacuum ? 'VACÍO (ρ = 0 kg/m³)' : `ATMÓSFERA (ρ = ${airDensity.toFixed(3)} kg/m³)`}
                </div>
                {!isVacuum && (
                  <div className="px-2.5 py-1 rounded bg-[#07090E]/90 border border-slate-800 text-sky-300">
                    Viento: {windSpeed > 0 ? `+${windSpeed.toFixed(1)}` : windSpeed.toFixed(1)} m/s
                  </div>
                )}
              </div>
            </div>

            {/* Barra de la Sonda / Lupa de Telemetría (Dedicada, sin tapar el eje X del lienzo) */}
            {showTelemetryProbe && probeSampleInfo && (
              <div
                data-testid="telemetry-probe-hud"
                className="px-4 py-2 bg-[#080C15] border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-200"
              >
                <div className="flex items-center gap-2 text-cyan-300 font-semibold">
                  <Search className="w-3.5 h-3.5 shrink-0" />
                  <span>LUPA DE TELEMETRÍA · {probeSampleInfo.trajectoryLabel}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 tabular-nums text-slate-100">
                  <span>Tiempo: {probeSampleInfo.sample.t.toFixed(2)} s</span>
                  <span className="text-slate-600">|</span>
                  <span>X: {probeSampleInfo.sample.x.toFixed(2)} m</span>
                  <span className="text-slate-600">|</span>
                  <span>Y: {probeSampleInfo.sample.y.toFixed(2)} m</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-emerald-400">V: {probeSampleInfo.sample.speed.toFixed(2)} m/s</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-cyan-300">Ec: {probeSampleInfo.sample.kineticEnergyJ.toFixed(1)} J</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-amber-300">Ep: {probeSampleInfo.sample.potentialEnergyJ.toFixed(1)} J</span>
                </div>
              </div>
            )}

            {/* Barra Inferior del Lienzo: Scrubber de Tiempo + Toggles de Vectores */}
            <div className="px-4 py-2.5 bg-[#0D1322] border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 flex-1">
                <label htmlFor="trajectory-time-scrubber" className="font-mono text-slate-300 whitespace-nowrap">
                  Instante t: {playbackTimeS.toFixed(2)} s
                </label>
                <input
                  id="trajectory-time-scrubber"
                  type="range"
                  min={0}
                  max={primaryTrajectory ? Math.max(0.1, primaryTrajectory.flightTimeS) : 5}
                  step={0.01}
                  value={Math.min(playbackTimeS, primaryTrajectory?.flightTimeS ?? 5)}
                  onChange={(e) => handleScrubTime(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                <button
                  type="button"
                  onClick={() => setShowVelocityVector((v) => !v)}
                  className={`px-2.5 py-1 rounded border cursor-pointer ${
                    showVelocityVector
                      ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                      : 'bg-[#07090E] border-slate-800 text-slate-400'
                  }`}
                >
                  Vector v (Verde)
                </button>
                <button
                  type="button"
                  onClick={() => setShowAccelerationVector((v) => !v)}
                  className={`px-2.5 py-1 rounded border cursor-pointer ${
                    showAccelerationVector
                      ? 'bg-amber-950/80 border-amber-500/60 text-amber-300'
                      : 'bg-[#07090E] border-slate-800 text-slate-400'
                  }`}
                >
                  Vector a (Amarillo)
                </button>
                <button
                  type="button"
                  onClick={() => setShowDragVector((v) => !v)}
                  className={`px-2.5 py-1 rounded border cursor-pointer ${
                    showDragVector
                      ? 'bg-rose-950/80 border-rose-500/60 text-rose-300'
                      : 'bg-[#07090E] border-slate-800 text-slate-400'
                  }`}
                >
                  Arrastre F_drag (Rojo)
                </button>
                <button
                  type="button"
                  onClick={() => setShowTelemetryProbe((v) => !v)}
                  className={`px-2.5 py-1 rounded border cursor-pointer ${
                    showTelemetryProbe
                      ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300'
                      : 'bg-[#07090E] border-slate-800 text-slate-400'
                  }`}
                >
                  Lupa Telemetría
                </button>
              </div>
            </div>
          </div>

          {/* Tarjeta de Modo Desafío y Retroalimentación Socrática */}
          {isChallengeMode && (
            <div
              data-testid="challenge-mode-card"
              className="rounded-xl bg-[#0A0E17] border border-amber-500/50 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  <h2 className="text-sm font-bold text-white font-mono">
                    MODO DESAFÍO ARTILLERÍA · NIVEL {challengeTarget.levelNumber} DE {CHALLENGE_LEVELS.length}
                  </h2>
                </div>
                <div className="flex items-center gap-1.5">
                  {CHALLENGE_LEVELS.map((lvl, idx) => {
                    const done = completedChallenges[`kinematics-level-${lvl.levelNumber}`];
                    return (
                      <button
                        key={lvl.levelNumber}
                        type="button"
                        onClick={() => activateChallengeLevel(idx)}
                        className={`px-2.5 py-1 rounded text-xs font-mono cursor-pointer border ${
                          challengeIndex === idx
                            ? 'bg-amber-400 text-slate-950 border-amber-400 font-bold'
                            : done
                            ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                            : 'bg-[#07090E] text-slate-300 border-slate-800'
                        }`}
                      >
                        Nivel {lvl.levelNumber} {done ? '✓' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-[#07090E] border border-slate-800">
                  <span className="text-slate-400 block">Distancia de la Diana:</span>
                  <span className="text-amber-300 font-bold text-sm tabular-nums">
                    {challengeTarget.distanceX.toFixed(1)} m (±{challengeTarget.radiusM.toFixed(1)} m)
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#07090E] border border-slate-800">
                  <span className="text-slate-400 block">Viento en Zona de Tiro:</span>
                  <span className="text-sky-300 font-bold text-sm tabular-nums">
                    {challengeTarget.windChallengeSpeed > 0
                      ? `+${challengeTarget.windChallengeSpeed} m/s (A favor)`
                      : challengeTarget.windChallengeSpeed < 0
                      ? `${challengeTarget.windChallengeSpeed} m/s (En contra)`
                      : '0.0 m/s (Calma)'}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#07090E] border border-slate-800">
                  <span className="text-slate-400 block">Último Alcance Logrado:</span>
                  <span className="text-white font-bold text-sm tabular-nums">
                    {primaryTrajectory ? `${primaryTrajectory.rangeM.toFixed(2)} m` : '—'}
                  </span>
                </div>
              </div>

              {lastEvaluation && (
                <div
                  className={`p-3.5 rounded-lg border text-xs space-y-1 ${
                    lastEvaluation.hit
                      ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
                      : 'bg-amber-950/30 border-amber-500/50 text-amber-100'
                  }`}
                >
                  <div className="font-mono font-bold text-sm flex items-center justify-between">
                    <span>{lastEvaluation.headlineEs}</span>
                    {lastEvaluation.hit && (
                      <button
                        type="button"
                        onClick={() => activateChallengeLevel((challengeIndex + 1) % CHALLENGE_LEVELS.length)}
                        className="px-3 py-1 rounded bg-emerald-400 text-slate-950 font-mono font-bold text-xs cursor-pointer"
                      >
                        Siguiente Objetivo →
                      </button>
                    )}
                  </div>
                  <p className="text-slate-200 leading-relaxed">{lastEvaluation.socraticFeedbackEs}</p>
                </div>
              )}
            </div>
          )}

          {/* Tarjetas de Métricas Clave y Conservación de Energía */}
          {primaryTrajectory && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl bg-[#0A0E17] border border-slate-800 p-3.5">
                <div className="text-[11px] font-mono text-slate-400">ALTURA MÁXIMA (ÁPICE)</div>
                <div
                  data-testid="metric-max-height"
                  className="text-lg font-mono font-bold text-cyan-300 tabular-nums mt-0.5"
                >
                  {primaryTrajectory.maxHeightM.toFixed(2)} m
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                  en X = {primaryTrajectory.apexX.toFixed(1)} m ({primaryTrajectory.apexTimeS.toFixed(2)} s)
                </div>
              </div>

              <div className="rounded-xl bg-[#0A0E17] border border-slate-800 p-3.5">
                <div className="text-[11px] font-mono text-slate-400">ALCANCE HORIZONTAL (X_MÁX)</div>
                <div
                  data-testid="metric-max-range"
                  className="text-lg font-mono font-bold text-emerald-400 tabular-nums mt-0.5"
                >
                  {primaryTrajectory.rangeM.toFixed(2)} m
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                  Teórico vacío: {primaryTrajectory.analyticalVacuumRangeM.toFixed(1)} m
                </div>
              </div>

              <div className="rounded-xl bg-[#0A0E17] border border-slate-800 p-3.5">
                <div className="text-[11px] font-mono text-slate-400">TIEMPO TOTAL DE VUELO</div>
                <div
                  data-testid="metric-flight-time"
                  className="text-lg font-mono font-bold text-amber-300 tabular-nums mt-0.5"
                >
                  {primaryTrajectory.flightTimeS.toFixed(2)} s
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                  Corte exacto en y = 0 m
                </div>
              </div>

              <div className="rounded-xl bg-[#0A0E17] border border-slate-800 p-3.5">
                <div className="text-[11px] font-mono text-slate-400">VELOCIDAD DE IMPACTO</div>
                <div
                  data-testid="metric-impact-speed"
                  className="text-lg font-mono font-bold text-rose-400 tabular-nums mt-0.5"
                >
                  {primaryTrajectory.impactSpeedMs.toFixed(2)} m/s
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                  Ángulo final: {primaryTrajectory.impactAngleDeg.toFixed(1)}°
                </div>
              </div>
            </div>
          )}

          {/* Comparador de las últimas 3 trayectorias */}
          <div className="rounded-xl bg-[#0A0E17] border border-slate-800 overflow-hidden">
            <div className="px-4 py-2.5 bg-[#0D1322] border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-slate-200">
                COMPARADOR BALÍSTICO (ÚLTIMAS 3 TRAYECTORIAS REGISTRADAS)
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {trajectories.length} / 3 activas
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-[#07090E]">
                    <th className="py-2.5 px-3">Proyectil y Entorno</th>
                    <th className="py-2.5 px-3">v₀ / θ / h₀</th>
                    <th className="py-2.5 px-3">Ápice (h_máx)</th>
                    <th className="py-2.5 px-3">Alcance (X_máx)</th>
                    <th className="py-2.5 px-3">Vuelo (t)</th>
                    <th className="py-2.5 px-3">Pérdida Térmica</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 tabular-nums">
                  {trajectories.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        Presiona &quot;Disparar Cañón&quot; para registrar y comparar trayectorias.
                      </td>
                    </tr>
                  ) : (
                    trajectories.map((traj) => (
                      <tr key={traj.id} className="hover:bg-[#0D1320]">
                        <td className="py-2.5 px-3 font-semibold text-white flex items-center gap-2">
                          <span
                            className="inline-block w-3 h-3 rounded-sm shrink-0"
                            style={{ backgroundColor: traj.color }}
                          />
                          <span>{traj.label}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {traj.params.v0.toFixed(0)} m/s · {traj.params.angleDeg}° · {traj.params.h0.toFixed(1)} m
                        </td>
                        <td className="py-2.5 px-3 text-cyan-300">{traj.maxHeightM.toFixed(2)} m</td>
                        <td className="py-2.5 px-3 text-emerald-400 font-bold">
                          {traj.rangeM.toFixed(2)} m
                        </td>
                        <td className="py-2.5 px-3 text-amber-300">{traj.flightTimeS.toFixed(2)} s</td>
                        <td className="py-2.5 px-3 text-rose-300">
                          {traj.thermalDissipatedJ.toFixed(1)} J
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Catálogo de Proyectiles con Iconos y Panel de Configuración sin Overflow */}
        <div className="xl:col-span-4 space-y-4 overflow-y-auto">
          {/* 1. Catálogo de Proyectiles Rediseñado con Iconos Prominentes y Badges Legibles */}
          <div className="rounded-xl bg-[#0A0E17] border border-slate-800 p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono font-semibold text-cyan-400">
                1. CATÁLOGO DE PROYECTILES (8 CARGAS)
              </span>
              <span className="text-[11px] font-mono text-slate-300 tabular-nums">
                A = {((Math.PI * effectiveDiameterM * effectiveDiameterM) / 4).toFixed(3)} m²
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {PAYLOAD_CATALOG.map((item) => {
                const selected = item.id === payloadId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`payload-card-${item.id}`}
                    onClick={() => handleSelectPayload(item.id)}
                    className={`p-3 rounded-xl border text-left instrument-transition cursor-pointer flex flex-col justify-between gap-2 ${
                      selected
                        ? 'bg-cyan-950/25 border-cyan-400 text-white shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                        : 'bg-[#07090E] border-slate-800 text-slate-200 hover:border-slate-600 hover:bg-[#0C1220]'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className="text-2xl leading-none shrink-0 select-none"
                        aria-hidden="true"
                      >
                        {item.iconEmoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs sm:text-[13px] text-white leading-tight">
                          {item.nameEs}
                        </div>
                        <div className="text-[11px] text-slate-400 leading-snug mt-0.5">
                          {item.badgeSubtitleEs}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/80 font-mono text-[11px] tabular-nums">
                      <span className="px-1.5 py-0.5 rounded bg-[#0A0E17] border border-slate-800 text-cyan-300">
                        {item.massKg >= 1 ? `${item.massKg} kg` : `${(item.massKg * 1000).toFixed(0)} g`}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-[#0A0E17] border border-slate-800 text-amber-300">
                        Cd {item.dragCoeff.toFixed(2)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Ficha técnica del proyectil activo */}
            <div className="p-3 rounded-lg bg-[#07090E] border border-slate-800 text-xs space-y-1">
              <div className="flex items-center justify-between font-mono text-cyan-300">
                <span>
                  {activePayload.iconEmoji} {activePayload.shapeLabelEs}
                </span>
                <span className="tabular-nums">d = {effectiveDiameterM.toFixed(2)} m</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                {activePayload.behaviorDescEs}
              </p>
            </div>

            {/* Sliders adicionales si se selecciona "Personalizado" */}
            {payloadId === 'custom' && (
              <div className="p-3.5 rounded-lg bg-[#0D1322] border border-purple-500/40 space-y-3 text-xs">
                <div className="font-mono font-semibold text-purple-300">
                  ⚙️ CONFIGURACIÓN DEL PROYECTIL PERSONALIZADO
                </div>
                <div>
                  <div className="flex justify-between font-mono text-[11px]">
                    <label htmlFor="custom-mass-slider">Masa (m):</label>
                    <span className="text-white tabular-nums">{customMassKg.toFixed(2)} kg</span>
                  </div>
                  <input
                    id="custom-mass-slider"
                    type="range"
                    min={0.05}
                    max={500}
                    step={0.5}
                    value={customMassKg}
                    onChange={(e) => {
                      const nextM = parseFloat(e.target.value);
                      setCustomMassKg(nextM);
                      syncLiveTrajectoryWithEngine({ massKg: nextM });
                    }}
                    className="w-full accent-purple-400 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between font-mono text-[11px]">
                    <label htmlFor="custom-diameter-slider">Diámetro (d):</label>
                    <span className="text-white tabular-nums">{customDiameterM.toFixed(2)} m</span>
                  </div>
                  <input
                    id="custom-diameter-slider"
                    type="range"
                    min={0.02}
                    max={3.0}
                    step={0.02}
                    value={customDiameterM}
                    onChange={(e) => {
                      const nextD = parseFloat(e.target.value);
                      setCustomDiameterM(nextD);
                      syncLiveTrajectoryWithEngine({ diameterM: nextD });
                    }}
                    className="w-full accent-purple-400 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between font-mono text-[11px]">
                    <label htmlFor="custom-cd-slider">Coeficiente Aerodinámico (Cd):</label>
                    <span className="text-white tabular-nums">{customDragCoeff.toFixed(2)}</span>
                  </div>
                  <input
                    id="custom-cd-slider"
                    type="range"
                    min={0.05}
                    max={2.0}
                    step={0.05}
                    value={customDragCoeff}
                    onChange={(e) => {
                      const nextCd = parseFloat(e.target.value);
                      setCustomDragCoeff(nextCd);
                      syncLiveTrajectoryWithEngine({ dragCoeff: nextCd });
                    }}
                    className="w-full accent-purple-400 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 2. Parámetros del Cañón Neumático y Plataforma Hidráulica */}
          <div className="rounded-xl bg-[#0A0E17] border border-slate-800 p-4 space-y-3.5 text-xs">
            <div className="font-mono font-semibold text-cyan-400">
              2. CONTROL DEL LANZADOR Y PLATAFORMA HIDRÁULICA
            </div>

            <div className="space-y-1">
              <div className="flex justify-between font-mono">
                <label htmlFor="slider-v0" className="text-slate-300">
                  Velocidad Inicial (v₀):
                </label>
                <span className="text-cyan-300 font-bold tabular-nums">{v0.toFixed(1)} m/s</span>
              </div>
              <input
                id="slider-v0"
                data-testid="slider-v0"
                type="range"
                min={5}
                max={100}
                step={0.5}
                value={v0}
                onChange={(e) => {
                  const nextV0 = parseFloat(e.target.value);
                  setV0(nextV0);
                  syncLiveTrajectoryWithEngine({ v0: nextV0 });
                }}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between font-mono">
                <label htmlFor="slider-angle" className="text-slate-300">
                  Ángulo de Inclinación (θ):
                </label>
                <span className="text-cyan-300 font-bold tabular-nums">{angleDeg}°</span>
              </div>
              <input
                id="slider-angle"
                data-testid="slider-angle"
                type="range"
                min={0}
                max={90}
                step={1}
                value={angleDeg}
                onChange={(e) => {
                  const nextAng = parseInt(e.target.value, 10);
                  setAngleDeg(nextAng);
                  syncLiveTrajectoryWithEngine({ angleDeg: nextAng });
                }}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between font-mono">
                <label htmlFor="slider-h0" className="text-slate-300">
                  Altura de Plataforma (h₀):
                </label>
                <span className="text-cyan-300 font-bold tabular-nums">{h0.toFixed(1)} m</span>
              </div>
              <input
                id="slider-h0"
                data-testid="slider-h0"
                type="range"
                min={0}
                max={30}
                step={0.5}
                value={h0}
                onChange={(e) => {
                  const nextH0 = parseFloat(e.target.value);
                  setH0(nextH0);
                  syncLiveTrajectoryWithEngine({ h0: nextH0 });
                }}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>

          {/* 3. Entorno Gravitatorio, Panel de Configuración Manual (g y ρ) y Viento (Sin Overflow) */}
          <div
            data-testid="exotic-environment-panel"
            className="rounded-xl bg-[#0A0E17] border border-slate-800 p-4 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono font-semibold text-cyan-400">
                3. GRAVEDAD (g) Y ATMÓSFERA (ρ)
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-[11px] text-amber-300 whitespace-nowrap">
                {gravityPresetId === 'custom'
                  ? activeExoticPreset
                    ? activeExoticPreset.nameEs
                    : 'Entorno Manual'
                  : `${activeGravityPreset.iconEmoji} ${activeGravityPreset.nameEs}`}
              </span>
            </div>

            {/* Selector de Escenarios Planetarios en 3 columnas amplias (Cero corte de palabras como "Júpiter") */}
            <div>
              <div className="text-[11px] font-mono text-slate-400 mb-2">
                Escenarios Planetarios Independientes:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {GRAVITY_PRESETS.map((env) => {
                  const isActive = gravityPresetId === env.id && !exoticPresetId;
                  return (
                    <button
                      key={env.id}
                      type="button"
                      data-testid={`gravity-btn-${env.id}`}
                      onClick={() => handleSelectGravityPreset(env.id)}
                      className={`py-2 px-2.5 rounded-lg border font-mono text-xs text-left cursor-pointer instrument-transition flex flex-col justify-between ${
                        isActive
                          ? 'bg-cyan-400 text-slate-950 border-cyan-400 font-bold shadow-[0_0_10px_rgba(34,211,238,0.35)]'
                          : 'bg-[#07090E] border-slate-800 text-slate-200 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span>{env.iconEmoji}</span>
                        <span>{env.id === 'space' ? 'Gravedad 0' : env.id === 'custom' ? 'Manual' : env.nameEs}</span>
                      </div>
                      <div
                        className={`text-[10px] tabular-nums mt-0.5 whitespace-nowrap ${
                          isActive ? 'text-slate-900' : 'text-slate-400'
                        }`}
                      >
                        g={env.id === 'custom' ? gravity.toFixed(2) : env.gravityMs2} m/s²
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Catálogo de Entornos Exóticos más allá de los planetas clásicos */}
            <div className="p-3 rounded-lg bg-[#07090E] border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-semibold text-[11px] text-amber-300">
                  ENTORNOS EXÓTICOS PRECONFIGURADOS
                </span>
                <span className="text-[10px] font-mono text-slate-400">1 clic para cargar</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {EXOTIC_ENVIRONMENT_PRESETS.map((exotic) => {
                  const isSelected = gravityPresetId === 'custom' && exoticPresetId === exotic.id;
                  return (
                    <button
                      key={exotic.id}
                      type="button"
                      data-testid={`exotic-preset-${exotic.id}`}
                      onClick={() => handleSelectExoticPreset(exotic.id)}
                      className={`p-2.5 rounded-lg border text-left font-mono cursor-pointer instrument-transition ${
                        isSelected
                          ? 'bg-amber-400/15 border-amber-400 text-white'
                          : 'bg-[#0A0E17] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      <div className="text-[11px] font-bold text-amber-300">
                        {exotic.nameEs}
                      </div>
                      <div className="text-[10px] text-slate-400 tabular-nums mt-0.5">
                        g={exotic.gravityMs2} m/s² · ρ={exotic.airDensityKgM3}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Panel de definición manual numérica y continua de g y ρ */}
            <div className="p-3.5 rounded-lg bg-[#07090E] border border-cyan-500/30 space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                <span className="font-mono font-semibold text-[11px] text-cyan-300 whitespace-nowrap">
                  SLIDERS VINCULADOS A PHYSICSENGINE2D
                </span>
                <span className="font-mono text-[10px] text-slate-400 tabular-nums whitespace-nowrap">
                  {envDiagnostics.earthGravityRatio.toFixed(2)} G ·{' '}
                  {envDiagnostics.earthDensityRatio.toFixed(2)}× ρ₀
                </span>
              </div>

              {/* Control manual de Gravedad (g) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 font-mono">
                  <label htmlFor="manual-gravity-input" className="text-slate-200 font-medium whitespace-nowrap">
                    Gravedad Manual (g):
                  </label>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      id="manual-gravity-input"
                      data-testid="manual-gravity-input"
                      type="number"
                      min={0}
                      max={100}
                      step={0.05}
                      value={gravity}
                      onChange={(e) => handleManualGravityChange(parseFloat(e.target.value))}
                      className="w-24 px-2 py-1 rounded bg-[#0A0E17] border border-slate-700 focus:border-amber-400 focus:outline-none text-right font-mono font-bold text-amber-300 tabular-nums"
                    />
                    <span className="text-[11px] text-slate-400 whitespace-nowrap">m/s²</span>
                  </div>
                </div>
                <input
                  id="slider-gravity"
                  data-testid="slider-gravity"
                  type="range"
                  min={0}
                  max={100}
                  step={0.05}
                  value={gravity}
                  onChange={(e) => handleManualGravityChange(parseFloat(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>0 m/s²</span>
                  <span>Tierra (9.81)</span>
                  <span>Júpiter (24.79)</span>
                  <span>100 m/s²</span>
                </div>
              </div>

              {/* Control manual de Densidad del Aire / Fluido (ρ) */}
              <div className="space-y-1.5 pt-1 border-t border-slate-800/70">
                <div className="flex items-center justify-between gap-2 font-mono">
                  <label htmlFor="manual-density-input" className="text-slate-200 font-medium whitespace-nowrap">
                    Densidad del Aire (ρ):
                  </label>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      id="manual-density-input"
                      data-testid="manual-density-input"
                      type="number"
                      min={0}
                      max={65}
                      step={0.05}
                      value={isVacuum ? 0 : airDensity}
                      onChange={(e) => handleManualDensityChange(parseFloat(e.target.value))}
                      className="w-24 px-2 py-1 rounded bg-[#0A0E17] border border-slate-700 focus:border-cyan-400 focus:outline-none text-right font-mono font-bold text-cyan-300 tabular-nums"
                    />
                    <span className="text-[11px] text-slate-400 whitespace-nowrap">kg/m³</span>
                  </div>
                </div>
                <input
                  id="slider-rho"
                  data-testid="slider-rho"
                  type="range"
                  min={0}
                  max={65}
                  step={0.05}
                  value={isVacuum ? 0 : airDensity}
                  onChange={(e) => handleManualDensityChange(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>Vacío (0.0)</span>
                  <span>Tierra (1.225)</span>
                  <span>Titán (5.3)</span>
                  <span>Venus (65 kg/m³)</span>
                </div>
              </div>
            </div>

            {/* Interruptor Cámara de Vacío vs Atmósfera Real */}
            <div className="p-3 rounded-lg bg-[#07090E] border border-slate-800 flex items-center justify-between gap-2">
              <div>
                <div className="font-mono font-semibold text-white">Cámara de Vacío (ρ = 0)</div>
                <div className="text-[11px] text-slate-400">
                  Anula la fricción del aire (Galileo)
                </div>
              </div>
              <button
                type="button"
                data-testid="toggle-vacuum-switch"
                role="switch"
                aria-checked={isVacuum}
                onClick={() => {
                  const nextVac = !isVacuum;
                  const nextRho = !nextVac && airDensity <= 0 ? 1.225 : airDensity;
                  setIsVacuum(nextVac);
                  if (!nextVac && airDensity <= 0) {
                    setAirDensity(1.225);
                  }
                  syncLiveTrajectoryWithEngine({
                    isVacuum: nextVac,
                    airDensity: nextRho,
                  });
                }}
                className={`min-h-[2.25rem] px-3.5 py-1.5 rounded-lg font-mono font-bold text-xs cursor-pointer instrument-transition ${
                  isVacuum
                    ? 'bg-purple-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                {isVacuum ? 'VACÍO ACTIVO' : 'CON AIRE'}
              </button>
            </div>

            {/* Control de Viento cuando hay atmósfera */}
            {!isVacuum && (
              <div className="space-y-1">
                <div className="flex justify-between font-mono">
                  <label htmlFor="slider-wind" className="text-slate-300">
                    Velocidad del Viento (v_wind):
                  </label>
                  <span className="text-sky-300 font-bold tabular-nums">
                    {windSpeed > 0 ? `+${windSpeed.toFixed(1)}` : windSpeed.toFixed(1)} m/s
                  </span>
                </div>
                <input
                  id="slider-wind"
                  data-testid="slider-wind"
                  type="range"
                  min={-25}
                  max={25}
                  step={0.5}
                  value={windSpeed}
                  onChange={(e) => {
                    const nextW = parseFloat(e.target.value);
                    setWindSpeed(nextW);
                    syncLiveTrajectoryWithEngine({ windSpeed: nextW });
                  }}
                  className="w-full accent-sky-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>← En contra (-25 m/s)</span>
                  <button
                    type="button"
                    onClick={() => {
                      setWindSpeed(0);
                      syncLiveTrajectoryWithEngine({ windSpeed: 0 });
                    }}
                    className="text-cyan-400 hover:underline cursor-pointer"
                  >
                    Calma (0)
                  </button>
                  <span>A favor (+25 m/s) →</span>
                </div>
              </div>
            )}

            {/* Tarjeta de Diagnóstico Físico del Entorno Exótico en Tiempo Real (PhysicsEngine2D) */}
            <div
              data-testid="exotic-diagnostics-card"
              className="p-3 rounded-lg bg-[#0D1322] border border-slate-800 space-y-2 font-mono text-[11px]"
            >
              <div className="flex items-center justify-between text-slate-300">
                <span className="font-semibold text-white">MOTOR RK4 EN TIEMPO REAL:</span>
                <span className="text-cyan-300">{envDiagnostics.aerodynamicRegimeEs}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 tabular-nums">
                <div className="p-2 rounded bg-[#07090E] border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Vel. Terminal (v_t)</div>
                  <div
                    data-testid="diagnostic-terminal-velocity"
                    className="text-xs font-bold text-emerald-400 mt-0.5"
                  >
                    {envDiagnostics.terminalVelocityMs !== null
                      ? `${envDiagnostics.terminalVelocityMs.toFixed(2)} m/s`
                      : '∞ (Vacío)'}
                  </div>
                </div>
                <div className="p-2 rounded bg-[#07090E] border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Peso (W = m·g)</div>
                  <div
                    data-testid="diagnostic-weight"
                    className="text-xs font-bold text-amber-300 mt-0.5"
                  >
                    {envDiagnostics.weightNewtons.toFixed(2)} N
                  </div>
                </div>
                <div className="p-2 rounded bg-[#07090E] border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Coef. Balístico (β)</div>
                  <div
                    data-testid="diagnostic-ballistic-coeff"
                    className="text-xs font-bold text-sky-300 mt-0.5"
                  >
                    {envDiagnostics.ballisticCoefficientKgM2.toFixed(1)} kg/m²
                  </div>
                </div>
              </div>

              {/* Comparativa instantánea RK4 con (g, ρ) vs Parábola en Vacío */}
              <div className="grid grid-cols-2 gap-2 tabular-nums">
                <div className="p-2 rounded bg-[#07090E] border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Alcance RK4 (g, ρ)</div>
                  <div
                    data-testid="diagnostic-live-range"
                    className="text-xs font-bold text-cyan-300 mt-0.5"
                  >
                    {exoticPreview.trajectory.rangeM.toFixed(2)} m
                  </div>
                </div>
                <div className="p-2 rounded bg-[#07090E] border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Frenado por Arrastre (ΔX)</div>
                  <div
                    data-testid="diagnostic-drag-loss"
                    className="text-xs font-bold text-rose-400 mt-0.5"
                  >
                    -{exoticPreview.dragRangeLossM.toFixed(2)} m ({exoticPreview.dragRangeLossPercent.toFixed(1)}%)
                  </div>
                </div>
              </div>

              <button
                type="button"
                data-testid="fire-exotic-env-btn"
                onClick={() =>
                  handleFireCannon(
                    undefined,
                    `${activePayload.nameEs} · g=${gravity.toFixed(2)} · ρ=${(
                      isVacuum ? 0 : airDensity
                    ).toFixed(2)}`
                  )
                }
                className="w-full min-h-[2.5rem] mt-1 py-2 px-3 rounded-lg bg-cyan-400/15 hover:bg-cyan-400/25 border border-cyan-400/50 text-cyan-300 font-mono font-bold text-xs cursor-pointer instrument-transition flex items-center justify-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Simular Tiro con (g={gravity.toFixed(2)} m/s², ρ={(isVacuum ? 0 : airDensity).toFixed(2)} kg/m³)</span>
              </button>
            </div>
          </div>

          {/* 4. Balance Energético Instantáneo (Ec vs Ep vs E_térmica) */}
          {probeSampleInfo && primaryTrajectory && (
            <div className="rounded-xl bg-[#0A0E17] border border-slate-800 p-4 space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-200 font-semibold">
                <span>BALANCE DE ENERGÍA MECÁNICA</span>
                <span className="text-cyan-400 tabular-nums">
                  E₀ = {primaryTrajectory.initialMechanicalEnergyJ.toFixed(1)} J
                </span>
              </div>

              {(() => {
                const e0 = Math.max(1e-3, primaryTrajectory.initialMechanicalEnergyJ);
                const s = probeSampleInfo.sample;
                const pctK = Math.min(100, (s.kineticEnergyJ / e0) * 100);
                const pctU = Math.min(100, (s.potentialEnergyJ / e0) * 100);
                const pctTh = Math.min(100, (s.thermalEnergyLossJ / e0) * 100);

                return (
                  <div className="space-y-2 tabular-nums">
                    <div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-cyan-300">Cinética (Ec = ½mv²):</span>
                        <span>{s.kineticEnergyJ.toFixed(1)} J ({pctK.toFixed(0)}%)</span>
                      </div>
                      <div className="w-full h-2 rounded bg-slate-900 overflow-hidden mt-1">
                        <div className="h-full bg-cyan-400" style={{ width: `${pctK}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-amber-300">Potencial (Ep = mgy):</span>
                        <span>{s.potentialEnergyJ.toFixed(1)} J ({pctU.toFixed(0)}%)</span>
                      </div>
                      <div className="w-full h-2 rounded bg-slate-900 overflow-hidden mt-1">
                        <div className="h-full bg-amber-400" style={{ width: `${pctU}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-rose-400">Disipada por Fricción (E_th):</span>
                        <span>{s.thermalEnergyLossJ.toFixed(1)} J ({pctTh.toFixed(0)}%)</span>
                      </div>
                      <div className="w-full h-2 rounded bg-slate-900 overflow-hidden mt-1">
                        <div className="h-full bg-rose-500" style={{ width: `${pctTh}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
