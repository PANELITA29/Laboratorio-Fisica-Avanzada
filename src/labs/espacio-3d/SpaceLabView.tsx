import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Camera,
  RotateCcw,
  Play,
  Pause,
  Award,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Layers,
  Flame,
  Sparkles,
  PlusCircle,
  Clock,
} from 'lucide-react';
import { Language, dictionary } from '../../assets/js/i18n';
import { audioSynth } from '../../assets/js/audio-synth';
import { TelemetryItem } from '../../assets/js/report-generator';
import {
  CelestialBody,
  SpacePresetId,
  createSpacePreset,
  stepVerletIntegration,
  computeSystemEnergetics,
  computeKeplerAndHohmannAnalytics,
  createKeplerianCustomSystem,
  convertCentralBodyToBlackHole,
  scaleCentralBodyMass,
  triggerPlanetaryCollisionCourse,
  detectAndResolveCollisions,
  computeRelativisticAndTidalMetrics,
  computeSchwarzschildRadius,
} from './space-engine';
import {
  createSpacetimeShaderMesh,
  updateSpacetimeShaderUniforms,
  deformPlanetGeometryForSpaghettification,
} from './SpaceScene3D';
import {
  SPACE_CHALLENGES,
  validateSpaceChallenge1,
  validateSpaceChallenge2,
  SpaceValidationResult,
} from './space-challenges';
import { ScrollReveal } from '../../components/QuantumAnimations';
import { TourGuiado, TourStep } from '../../components/TourGuiado';
import { useLabGlobalStore } from '../../store/useLabGlobalStore';

const SPACE_TOUR_STEPS: TourStep[] = [
  {
    targetSelector: '[data-tour="space-3d-stage"]',
    badgeEs: '1 · ESCENARIO ORBITAL 3D',
    badgeEn: '1 · 3D ORBITAL STAGE',
    titleEs: 'Malla Espacio-Tiempo y Cuerpos Celestes 3D',
    titleEn: '3D Spacetime Mesh & Celestial Bodies',
    descriptionEs:
      'Rota la cámara con el ratón o gesto táctil y observa en tiempo real la curvatura gravitatoria y la telemetría Verlet (radio r, velocidad v y energía E_tot).',
    descriptionEn:
      'Rotate the camera with mouse or touch and observe the gravitational curvature and live Verlet telemetry (radius r, velocity v, and total energy E_tot).',
    whatToDoEs: [
      'Arrastra con clic izquierdo sobre el lienzo 3D para rotar la vista y usa la rueda del ratón para acercar o alejar.',
      'Prueba los escenarios superiores: «Sistema Solar», «Tierra-Luna», «Exoplaneta», «Geoestacionaria» o «Lagrange».',
    ],
    parametersEs: [
      {
        name: 'Radio Orbital (r) y Velocidad (v)',
        value: 'Telemetría Verlet 60 FPS',
        detail: 'Muestra en la esquina superior izquierda la distancia instantánea al astro central y la rapidez orbital.',
      },
      {
        name: 'Energía Mecánica Total (E_tot = K + U)',
        value: 'E_tot < 0 (Órbita Ligada)',
        detail: 'Si E_tot es negativa el planeta permanece en órbita; si supera 0 GJ el cuerpo escapa al espacio.',
      },
    ],
    formulaEs: 'z(x,y) = -∑ G·Mᵢ / √(r² + ε²)  |  E_tot = ½mv² - G·M·m/r',
  },
  {
    targetSelector: '[data-tour="space-control-dock"]',
    badgeEs: '2 · PANEL DE CONTROL ORBITAL',
    badgeEn: '2 · ORBITAL CONTROL DOCK',
    titleEs: 'Panel de Control: Velocidad de Inserción y Capas',
    titleEn: 'Control Panel: Insertion Velocity & Vector Layers',
    descriptionEs:
      'Ajusta la velocidad de inserción (v_c), la constante gravitacional G y activa o desactiva los vectores de gravedad, velocidad y estelas orbitales.',
    descriptionEn:
      'Adjust insertion velocity (v_c), gravitational constant G, and toggle gravity vectors, velocity vectors, and orbital trails.',
    whatToDoEs: [
      'Mueve el slider «Velocidad de Inserción» entre 0.50x y 1.60x v_c para transformar una órbita circular (1.00x) en elíptica o de escape (≥1.41x).',
      'Cambia la cámara entre «Libre Orbital», «Persecución (Chase)» y «Superficial» para seguir de cerca a cualquier planeta.',
    ],
    parametersEs: [
      {
        name: 'Factor de Velocidad (v / v_c)',
        value: '0.50x – 1.60x v_c',
        detail: '1.00x produce una órbita circular; valores > 1.00x alargan la elipse y ≥ 1.41x superan la velocidad de escape.',
      },
      {
        name: 'Capas 3D (Malla, Gravedad Fg, Velocidad v)',
        value: 'Vectores en Vivo',
        detail: 'La flecha azul (Fg) apunta hacia el centro gravitacional y la flecha verde (v) es tangente a la trayectoria.',
      },
    ],
    formulaEs: 'v_circular = √(G·M / r)  |  v_escape = √2 · v_c ≈ 1.414 · v_c',
  },
  {
    targetSelector: '[data-tour="space-kepler-instrument"]',
    badgeEs: '3 · TELEMETRÍA KEPLER Y HOHMANN',
    badgeEn: '3 · KEPLER & HOHMANN TELEMETRY',
    titleEs: 'Instrumentación de Leyes de Kepler y Maniobra Hohmann',
    titleEn: 'Kepler Laws Instrumentation & Hohmann Transfer',
    descriptionEs:
      'Modifica la masa estelar (M☉), el semieje mayor (a) y la excentricidad (e), o inyecta el impulso Δv₁ para ejecutar una transferencia interplanetaria de Hohmann.',
    descriptionEn:
      'Modify stellar mass (M☉), semi-major axis (a), and eccentricity (e), or inject Δv₁ to execute a Hohmann interplanetary transfer.',
    whatToDoEs: [
      'Ajusta «Masa Estrella Central (M☉)», «Semieje Mayor (a)» y «Excentricidad (e)» y observa cómo se actualiza la fórmula paso a paso.',
      'Pulsa «🚀 Ejecutar Transferencia de Hohmann» para inyectar Δv₁ y enviar la nave desde la órbita terrestre hacia Marte.',
    ],
    parametersEs: [
      {
        name: 'Semieje Mayor (a) y Excentricidad (e)',
        value: '0.5 – 2.2 UA | e: 0 – 0.75',
        detail: 'Controlan el tamaño de la órbita y qué tan achatada es la elipse (1ª y 2ª Ley de Kepler).',
      },
      {
        name: '3ª Ley de Kepler y Δv₁ Hohmann',
        value: 'T² = a³ / M☉',
        detail: 'Calcula el período orbital en años y días terrestres y el impulso necesario para cambiar de órbita.',
      },
    ],
    formulaEs: '3ª Ley de Kepler: T = √(a³ / M☉) años',
  },
];

interface SpaceLabViewProps {
  lang: Language;
  onUpdateTelemetry: (items: TelemetryItem[]) => void;
  completedChallenges: Record<string, boolean>;
  onCompleteChallenge: (id: string, points: number) => void;
}

export type CameraMode = 'free' | 'chase' | 'surface';

export const SpaceLabView: React.FC<SpaceLabViewProps> = ({
  lang,
  onUpdateTelemetry,
  completedChallenges,
  onCompleteChallenge,
}) => {
  const t = dictionary[lang];

  // Estado global centralizado en Zustand (useLabGlobalStore) para evitar reinicios erróneos entre Agujero Negro, Masa y Gravedad
  const spaceLab = useLabGlobalStore((s) => s.spaceLab);
  const setSpaceBlackHole = useLabGlobalStore((s) => s.setSpaceBlackHole);
  const setSpacePlanetCreatorMode = useLabGlobalStore((s) => s.setSpacePlanetCreatorMode);
  const spawnPlanetAtCoords = useLabGlobalStore((s) => s.spawnPlanetAtCoords);
  const setSpaceCentralMass = useLabGlobalStore((s) => s.setSpaceCentralMass);
  const setSpaceGravityG = useLabGlobalStore((s) => s.setSpaceGravityG);
  const setSpaceInsertionFactor = useLabGlobalStore((s) => s.setSpaceInsertionFactor);
  const setSpaceSimSpeed = useLabGlobalStore((s) => s.setSpaceSimSpeed);
  const setSpacePreset = useLabGlobalStore((s) => s.setSpacePreset);
  const setSpaceKeplerParams = useLabGlobalStore((s) => s.setSpaceKeplerParams);
  const setSpaceVisualLayers = useLabGlobalStore((s) => s.setSpaceVisualLayers);
  const triggerSpaceCollisionCataclysm = useLabGlobalStore((s) => s.triggerSpaceCollisionCataclysm);
  const injectSchwarzschildProbe = useLabGlobalStore((s) => s.injectSchwarzschildProbe);
  const setSpaceBodies = useLabGlobalStore((s) => s.setSpaceBodies);

  const {
    preset,
    isBlackHole,
    planetCreatorMode,
    centralMassSolar,
    gravityG,
    insertionFactor,
    simSpeed,
    semiMajorAxisAU,
    eccentricity,
    hohmannActive,
    showSpacetimeMesh,
    showGravityVectors,
    showVelocityVectors,
    showTrails,
  } = spaceLab;

  const setShowSpacetimeMesh = (updater: boolean | ((v: boolean) => boolean)) => {
    const next = typeof updater === 'function' ? updater(showSpacetimeMesh) : updater;
    setSpaceVisualLayers({ showSpacetimeMesh: next });
  };
  const setShowGravityVectors = (updater: boolean | ((v: boolean) => boolean)) => {
    const next = typeof updater === 'function' ? updater(showGravityVectors) : updater;
    setSpaceVisualLayers({ showGravityVectors: next });
  };
  const setShowVelocityVectors = (updater: boolean | ((v: boolean) => boolean)) => {
    const next = typeof updater === 'function' ? updater(showVelocityVectors) : updater;
    setSpaceVisualLayers({ showVelocityVectors: next });
  };
  const setShowTrails = (updater: boolean | ((v: boolean) => boolean)) => {
    const next = typeof updater === 'function' ? updater(showTrails) : updater;
    setSpaceVisualLayers({ showTrails: next });
  };

  const [activeSubTab, setActiveSubTab] = useState<'sandbox' | 'challenges'>('sandbox');
  const [cameraMode, setCameraMode] = useState<CameraMode>('free');
  const [targetBodyIndex, setTargetBodyIndex] = useState<number>(1);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);

  const keplerMetrics = computeKeplerAndHohmannAnalytics({
    centralMassSolar,
    semiMajorAxisAU,
    eccentricity,
    targetOrbitAU: semiMajorAxisAU * 1.524,
  });

  const [supernovaAlert, setSupernovaAlert] = useState<{
    active: boolean;
    totalEnergyGJ: number;
    absorbedPlanets: string[];
  }>({
    active: false,
    totalEnergyGJ: 0,
    absorbedPlanets: [],
  });
  const [lastCollisionNotice, setLastCollisionNotice] = useState<string | null>(null);

  // Telemetría viva throttled a <= 10Hz para el HUD y Reporte (+ Reloj Relativista y Espaguetización en Horizonte de Schwarzschild)
  const [liveStats, setLiveStats] = useState({
    kineticEnergy: 0,
    potentialEnergy: 0,
    totalEnergy: 0,
    primaryOrbitalRadius: 16,
    primarySpeed: 8.6,
    coordTimeSec: 0,
    properTimeSec: 0,
    properTimeRate: 1.0,
    lorentzGamma: 1.0,
    redshiftZ: 0.0,
    maxTidalStretch: 1.0,
    maxTidalHeatingK: 290,
    schwarzschildRadiusU: 5.5,
    closestDistanceU: 16.0,
    horizonDistanceRatio: 2.9,
    isCrossingSchwarzschild: false,
    isBinaryBlackHoleSystem: false,
    spaghettificationRegime: 'nominal' as 'nominal' | 'roche-tidal' | 'schwarzschild-spaghettification',
    closestBodyNameEs: 'Tierra',
    closestBodyNameEn: 'Earth',
  });

  const [validationFeedback, setValidationFeedback] = useState<Record<string, SpaceValidationResult>>({});

  // Estado mutable de los cuerpos celestes para el bucle Verlet sincronizado con el store global
  const bodiesRef = useRef<CelestialBody[]>(useLabGlobalStore.getState().spaceLab.bodies);
  const resetTriggerRef = useRef<number>(useLabGlobalStore.getState().spaceLab.sceneRevision);
  const relClockRef = useRef<{ coordTime: number; properTime: number }>({
    coordTime: 0,
    properTime: 0,
  });
  const supernovaAnimRef = useRef<{
    active: boolean;
    startTime: number;
    progress: number;
    origin: { x: number; y: number; z: number };
  }>({
    active: false,
    startTime: 0,
    progress: 0,
    origin: { x: 0, y: 0, z: 0 },
  });
  const impactFlashesRef = useRef<
    Array<{ x: number; y: number; z: number; startTime: number }>
  >([]);
  const absorbedHistoryRef = useRef<string[]>([]);
  const totalCollisionEnergyRef = useRef<number>(0);

  const controlsStateRef = useRef({
    preset,
    cameraMode,
    targetBodyIndex,
    isPaused,
    insertionFactor,
    gravityG,
    simSpeed,
    showSpacetimeMesh,
    showGravityVectors,
    showVelocityVectors,
    showTrails,
    isBlackHole,
    planetCreatorMode,
  });
  controlsStateRef.current = {
    preset,
    cameraMode,
    targetBodyIndex,
    isPaused,
    insertionFactor,
    gravityG,
    simSpeed,
    showSpacetimeMesh,
    showGravityVectors,
    showVelocityVectors,
    showTrails,
    isBlackHole,
    planetCreatorMode,
  };

  const mountRef = useRef<HTMLDivElement | null>(null);

  // Suscripción directa al store global Zustand para sincronizar bodiesRef y sceneRevision al instante
  useEffect(() => {
    const unsubscribe = useLabGlobalStore.subscribe((state, prevState) => {
      if (state.spaceLab.sceneRevision !== prevState.spaceLab.sceneRevision) {
        bodiesRef.current = state.spaceLab.bodies;
        resetTriggerRef.current = state.spaceLab.sceneRevision;
      }
    });
    return () => {
      // Al desmontar la vista, guardar la posición actual de los cuerpos en el store global
      setSpaceBodies(bodiesRef.current, false);
      unsubscribe();
    };
  }, [setSpaceBodies]);

  // Dron ambiental cósmico suave al entrar al Laboratorio Espacial 3D
  useEffect(() => {
    audioSynth.startCosmicDrone();
    return () => {
      audioSynth.stopCosmicDrone();
    };
  }, []);

  // Sincronizar telemetría con el Generador de Informes Científicos
  useEffect(() => {
    onUpdateTelemetry([
      {
        label: lang === 'es' ? 'Radio Orbital (r)' : 'Orbital Radius (r)',
        value: liveStats.primaryOrbitalRadius.toFixed(2),
        unit: 'u (R⊕)',
      },
      {
        label: lang === 'es' ? 'Velocidad Orbital (v)' : 'Orbital Velocity (v)',
        value: liveStats.primarySpeed.toFixed(2),
        unit: 'km/s eq',
      },
      {
        label: lang === 'es' ? 'Energía Cinética (K)' : 'Kinetic Energy (K)',
        value: liveStats.kineticEnergy.toFixed(1),
        unit: 'GJ',
      },
      {
        label: lang === 'es' ? 'Energía Potencial (U)' : 'Potential Energy (U)',
        value: liveStats.potentialEnergy.toFixed(1),
        unit: 'GJ',
      },
    ]);
  }, [liveStats, lang, onUpdateTelemetry]);

  const clearCataclysmState = () => {
    setSupernovaAlert({ active: false, totalEnergyGJ: 0, absorbedPlanets: [] });
    setLastCollisionNotice(null);
    supernovaAnimRef.current = { active: false, startTime: 0, progress: 0, origin: { x: 0, y: 0, z: 0 } };
    impactFlashesRef.current = [];
    absorbedHistoryRef.current = [];
    totalCollisionEnergyRef.current = 0;
  };

  const applyPreset = (
    newPreset: SpacePresetId,
    newFactor: number = insertionFactor,
    keepBlackHole?: boolean
  ) => {
    setTargetBodyIndex(1);
    clearCataclysmState();
    setSpaceBodies(bodiesRef.current, false);
    if (keepBlackHole !== undefined && keepBlackHole !== useLabGlobalStore.getState().spaceLab.isBlackHole) {
      setSpaceBlackHole(keepBlackHole);
    }
    setSpacePreset(newPreset, newFactor);
  };

  const handleToggleBlackHole = (forceValue?: boolean) => {
    setSpaceBodies(bodiesRef.current, false);
    setSpaceBlackHole(forceValue);
  };

  const handleCentralMassChange = (newMassSolar: number) => {
    setSpaceBodies(bodiesRef.current, false);
    setSpaceCentralMass(newMassSolar);
  };

  const handleTriggerCollisionCataclysm = () => {
    setIsPaused(false);
    clearCataclysmState();
    setSpaceBodies(bodiesRef.current, false);
    triggerSpaceCollisionCataclysm();
  };

  const handleInsertionFactorChange = (val: number) => {
    clearCataclysmState();
    setSpaceBodies(bodiesRef.current, false);
    setSpaceInsertionFactor(val);
  };

  const handleValidateChallenge = (chId: string) => {
    if (chId === 'space-1') {
      const res = validateSpaceChallenge1(preset, insertionFactor, bodiesRef.current);
      setValidationFeedback((prev) => ({ ...prev, [chId]: res }));
      if (res.passed) {
        audioSynth.playSuccessChime();
        onCompleteChallenge('space-1', 300);
      }
    } else if (chId === 'space-2') {
      const res = validateSpaceChallenge2(preset, insertionFactor, bodiesRef.current);
      setValidationFeedback((prev) => ({ ...prev, [chId]: res }));
      if (res.passed) {
        audioSynth.playSuccessChime();
        onCompleteChallenge('space-2', 350);
      }
    }
  };

  // Inicialización de Three.js WebGL y bucle físico Velocity Verlet
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || 960;
    const height = container.clientHeight || 540;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070e);
    scene.fog = new THREE.FogExp2(0x05070e, 0.008);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 400);
    camera.position.set(0, 26, 38);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 4;
    controls.maxDistance = 120;

    // Iluminación cósmica cálida/fría
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x090d16, 0.7);
    scene.add(hemiLight);

    const starLight = new THREE.PointLight(0xfffbeb, 3.8, 180, 0.5);
    starLight.position.set(0, 3, 0);
    scene.add(starLight);

    // Campo estelar con InstancedMesh (>20 objetos repetidos)
    const starCount = 260;
    const starGeo = new THREE.SphereGeometry(0.14, 6, 6);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
    const starsInstanced = new THREE.InstancedMesh(starGeo, starMat, starCount);
    const dummyMatrix = new THREE.Matrix4();
    const starColor = new THREE.Color();
    for (let i = 0; i < starCount; i++) {
      const r = 65 + Math.random() * 65;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      dummyMatrix.makeTranslation(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      );
      const s = 0.6 + Math.random() * 1.1;
      dummyMatrix.scale(new THREE.Vector3(s, s, s));
      starsInstanced.setMatrixAt(i, dummyMatrix);
      starColor.setHSL(0.55 + Math.random() * 0.15, 0.6, 0.85);
      starsInstanced.setColorAt(i, starColor);
    }
    starsInstanced.computeBoundingSphere();
    scene.add(starsInstanced);

    // Malla 3D de Deformación del Espacio-Tiempo con ShaderMaterial personalizado (SpaceScene3D)
    const spacetimeBundle = createSpacetimeShaderMesh(isSoftwareGl);
    const spacetimeMesh = spacetimeBundle.mesh;
    scene.add(spacetimeMesh);

    // Contenedor de cuerpos celestes 3D compuestos, vectores y rastros
    const bodiesGroup = new THREE.Group();
    scene.add(bodiesGroup);

    interface BodyVisuals {
      group: THREE.Group;
      forceArrow: THREE.ArrowHelper;
      velArrow: THREE.ArrowHelper;
      trailLine: THREE.Line;
      trailPositions: Float32Array;
      trailCount: number;
      deformableMesh?: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
      deformableMat?: THREE.MeshStandardMaterial;
      basePositions?: Float32Array;
      wasDeformed?: boolean;
      tidalStreamLine?: THREE.Line;
      tidalStreamPositions?: Float32Array;
    }

    let visualsMap: Record<string, BodyVisuals> = {};
    let lastResetToken = -1;
    const MAX_TRAIL_POINTS = 180;
    const TIDAL_STREAM_POINTS = 24;

    // Construye un modelo 3D compuesto (3-12 partes) para cada astro, satélite o Agujero Negro
    const createCelestialCompositeGroup = (b: CelestialBody): THREE.Group => {
      const grp = new THREE.Group();

      if (b.isBlackHole) {
        const rsRadius = computeSchwarzschildRadius(b.mass, controlsStateRef.current.gravityG, true);

        // Agujero Negro Relativista (Gargantúa) de 8 partes incluyendo Frontera del Radio de Schwarzschild (r_s):
        // 1) Horizonte de Sucesos Interno (Sombra negra absoluta que absorbe toda radiación)
        const horizonMesh = new THREE.Mesh(
          new THREE.SphereGeometry(b.radius * 0.92, 32, 32),
          new THREE.MeshBasicMaterial({ color: 0x000000 })
        );
        grp.add(horizonMesh);

        // 2) Esfera de Fotones (Photon Ring incandescente cian-blanco en el borde crítico)
        const photonRingGeo = new THREE.TorusGeometry(b.radius * 1.04, b.radius * 0.06, 16, 64);
        const photonRingMat = new THREE.MeshBasicMaterial({
          color: 0xe0f2fe,
          transparent: true,
          opacity: 0.95,
        });
        const photonRing = new THREE.Mesh(photonRingGeo, photonRingMat);
        grp.add(photonRing);

        // 3) Disco de Acreción Interno (Plasma relativista blanco-dorado de alta temperatura)
        const diskInnerGeo = new THREE.TorusGeometry(b.radius * 1.65, b.radius * 0.24, 14, 64);
        diskInnerGeo.rotateX(Math.PI / 2);
        const diskInnerMat = new THREE.MeshStandardMaterial({
          color: 0xfef08a,
          emissive: 0xf59e0b,
          emissiveIntensity: 2.2,
          roughness: 0.15,
          transparent: true,
          opacity: 0.92,
        });
        const diskInner = new THREE.Mesh(diskInnerGeo, diskInnerMat);
        diskInner.scale.y = 0.22;
        grp.add(diskInner);

        // 4) Disco de Acreción Medio (Doppler naranja-rojizo turbulento)
        const diskMidGeo = new THREE.TorusGeometry(b.radius * 2.35, b.radius * 0.36, 14, 64);
        diskMidGeo.rotateX(Math.PI / 2);
        const diskMidMat = new THREE.MeshStandardMaterial({
          color: 0xf97316,
          emissive: 0xea580c,
          emissiveIntensity: 1.6,
          roughness: 0.25,
          transparent: true,
          opacity: 0.78,
        });
        const diskMid = new THREE.Mesh(diskMidGeo, diskMidMat);
        diskMid.scale.y = 0.16;
        grp.add(diskMid);

        // 5) Disco de Acreción Exterior + Halo Relativista Violeta
        const diskOuterGeo = new THREE.TorusGeometry(b.radius * 3.1, b.radius * 0.28, 12, 64);
        diskOuterGeo.rotateX(Math.PI / 2);
        const diskOuterMat = new THREE.MeshStandardMaterial({
          color: 0xa855f7,
          emissive: 0x9333ea,
          emissiveIntensity: 1.3,
          roughness: 0.35,
          transparent: true,
          opacity: 0.52,
        });
        const diskOuter = new THREE.Mesh(diskOuterGeo, diskOuterMat);
        diskOuter.scale.y = 0.12;
        grp.add(diskOuter);

        // 6) Arco de Lente Gravitacional Einstein (luz curvada por encima y debajo de la sombra)
        const lensingGeo = new THREE.TorusGeometry(b.radius * 1.48, b.radius * 0.08, 14, 56);
        lensingGeo.rotateX(0.32);
        const lensingMat = new THREE.MeshBasicMaterial({
          color: 0xfdba74,
          transparent: true,
          opacity: 0.65,
        });
        const lensingMesh = new THREE.Mesh(lensingGeo, lensingMat);
        grp.add(lensingMesh);

        // 7) Chorros Relativistas Polares (Jets astrofísicos de plasma en eje ±Y)
        const jetGeo = new THREE.ConeGeometry(b.radius * 0.35, b.radius * 3.8, 16, 1, true);
        const jetMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.38,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const jetTop = new THREE.Mesh(jetGeo, jetMat);
        jetTop.position.y = b.radius * 2.2;
        const jetBottom = new THREE.Mesh(jetGeo, jetMat);
        jetBottom.position.y = -b.radius * 2.2;
        jetBottom.rotation.x = Math.PI;
        grp.add(jetTop, jetBottom);

        // 8) Frontera Holográfica del Radio de Schwarzschild (r = r_s): marca la zona crítica de Espaguetización 3D
        const rsHorizonRingGeo = new THREE.TorusGeometry(rsRadius, 0.055, 12, 72);
        rsHorizonRingGeo.rotateX(Math.PI / 2);
        const rsHorizonRingMat = new THREE.MeshBasicMaterial({
          color: 0xf43f5e,
          transparent: true,
          opacity: 0.62,
          depthWrite: false,
        });
        const rsHorizonRing = new THREE.Mesh(rsHorizonRingGeo, rsHorizonRingMat);
        grp.add(rsHorizonRing);

        const rsShellGeo = new THREE.SphereGeometry(rsRadius, 18, 14);
        const rsShellMat = new THREE.MeshBasicMaterial({
          color: 0xf43f5e,
          transparent: true,
          opacity: 0.09,
          wireframe: true,
          depthWrite: false,
        });
        const rsShellMesh = new THREE.Mesh(rsShellGeo, rsShellMat);
        grp.add(rsShellMesh);

        return grp;
      }

      if (b.id.includes('satellite')) {
        // Satélite compuesto: 1) Bus central dorado, 2) 2 Paneles solares azules, 3) Plato de antena y propulsor
        const hullGeo = new THREE.SphereGeometry(b.radius, 28, 28);
        const hullMat = new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          metalness: 0.85,
          roughness: 0.25,
          emissive: 0x000000,
          emissiveIntensity: 0.1,
        });
        const hull = new THREE.Mesh(hullGeo, hullMat);
        const posAttr = hullGeo.attributes.position as THREE.BufferAttribute;
        grp.userData.deformableMesh = hull;
        grp.userData.deformableMat = hullMat;
        grp.userData.basePositions = new Float32Array(posAttr.array as Float32Array);

        const wingGeo = new THREE.BoxGeometry(2.8, 0.06, 0.75);
        const wingMat = new THREE.MeshStandardMaterial({
          color: 0x0284c7,
          metalness: 0.6,
          roughness: 0.2,
          emissive: 0x0369a1,
          emissiveIntensity: 0.3,
        });
        const wingL = new THREE.Mesh(wingGeo, wingMat);
        wingL.position.x = -1.65;
        const wingR = new THREE.Mesh(wingGeo, wingMat);
        wingR.position.x = 1.65;

        const dish = new THREE.Mesh(
          new THREE.ConeGeometry(0.42, 0.35, 16),
          new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.15 })
        );
        dish.position.y = 0.8;
        dish.rotation.x = Math.PI;

        grp.add(hull, wingL, wingR, dish);
        return grp;
      }

      // Astro, Planeta o Sonda Relativista compuesta:
      // 1) Esfera núcleo PBR subdividida (32x28) cuyos vértices se deforman en vivo al cruzar el Radio de Schwarzschild
      const coreGeo = new THREE.SphereGeometry(b.radius, 32, 28);
      const coreMat = new THREE.MeshStandardMaterial({
        color: b.color,
        roughness: b.emissive ? 0.15 : 0.38,
        metalness: b.emissive ? 0.1 : 0.32,
        emissive: b.emissive ? b.color : '#000000',
        emissiveIntensity: b.emissive ? 1.4 : 0.1,
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      const posAttr = coreGeo.attributes.position as THREE.BufferAttribute;
      grp.userData.deformableMesh = coreMesh;
      grp.userData.deformableMat = coreMat;
      grp.userData.basePositions = new Float32Array(posAttr.array as Float32Array);
      grp.add(coreMesh);

      // 2) Malla Wireframe Relativista superpuesta que hace evidente la deformación de los polígonos 3D (espaguetización)
      const wireOverlayMat = new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.22,
        wireframe: true,
        depthWrite: false,
      });
      const wireOverlayMesh = new THREE.Mesh(coreGeo, wireOverlayMat);
      wireOverlayMesh.scale.setScalar(1.015);
      grp.add(wireOverlayMesh);

      // 3) Halo atmosférico o corona
      const haloMat = new THREE.MeshBasicMaterial({
        color: b.color,
        transparent: true,
        opacity: b.emissive ? 0.24 : 0.14,
        depthWrite: false,
      });
      const haloMesh = new THREE.Mesh(new THREE.SphereGeometry(b.radius * 1.28, 20, 20), haloMat);
      grp.add(haloMesh);

      // 4) Anillo ecuatorial / marcador polar
      const ringGeo = new THREE.TorusGeometry(b.radius * 1.55, b.radius * 0.06, 10, 36);
      ringGeo.rotateX(Math.PI / 2);
      const ringMat = new THREE.MeshStandardMaterial({
        color: b.color,
        roughness: 0.3,
        metalness: 0.6,
        transparent: true,
        opacity: 0.55,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      grp.add(ringMesh);

      return grp;
    };

    // Grupo 3D para la Explosión de Supernova y Destellos de Colisión Planetaria
    const supernovaGroup = new THREE.Group();
    supernovaGroup.visible = false;
    scene.add(supernovaGroup);

    const snCoreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const snCoreMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), snCoreMat);
    supernovaGroup.add(snCoreMesh);

    const snShellMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xec4899,
      emissiveIntensity: 2.8,
      transparent: true,
      opacity: 0,
      roughness: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const snShellMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), snShellMat);
    supernovaGroup.add(snShellMesh);

    const snRingGeo = new THREE.TorusGeometry(1, 0.08, 16, 72);
    snRingGeo.rotateX(Math.PI / 2);
    const snRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const snRingMesh = new THREE.Mesh(snRingGeo, snRingMat);
    supernovaGroup.add(snRingMesh);

    // Nebulosa de eyección de Supernova (160 filamentos 3D con InstancedMesh)
    const ejectaCount = 160;
    const ejectaGeo = new THREE.SphereGeometry(0.28, 8, 8);
    const ejectaMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const ejectaInstanced = new THREE.InstancedMesh(ejectaGeo, ejectaMat, ejectaCount);
    const ejectaDirs: Array<{ x: number; y: number; z: number; speed: number; scale: number }> = [];
    const ejectaPalette = [0xfef08a, 0xf97316, 0xec4899, 0x38bdf8, 0xa855f7];
    const tmpEjectaColor = new THREE.Color();
    for (let i = 0; i < ejectaCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      ejectaDirs.push({
        x: Math.sin(phi) * Math.cos(theta),
        y: Math.cos(phi) * 0.65,
        z: Math.sin(phi) * Math.sin(theta),
        speed: 10 + Math.random() * 24,
        scale: 0.6 + Math.random() * 1.6,
      });
      tmpEjectaColor.setHex(ejectaPalette[i % ejectaPalette.length]);
      ejectaInstanced.setColorAt(i, tmpEjectaColor);
    }
    supernovaGroup.add(ejectaInstanced);

    // Anillo de destello para colisiones planetarias individuales
    const impactRingGeo = new THREE.RingGeometry(0.4, 1.0, 32);
    impactRingGeo.rotateX(-Math.PI / 2);
    const impactRingMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const impactRingMesh = new THREE.Mesh(impactRingGeo, impactRingMat);
    impactRingMesh.visible = false;
    scene.add(impactRingMesh);

    // Cursor 3D Holográfico para el Modo Creador de Planetas (Clic en el Lienzo 3D)
    const spawnCursorGroup = new THREE.Group();
    spawnCursorGroup.visible = false;
    const spawnCursorRing = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.35, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    const spawnCursorGhost = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 20, 20),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.45,
        wireframe: true,
      })
    );
    spawnCursorGroup.add(spawnCursorRing, spawnCursorGhost);
    scene.add(spawnCursorGroup);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const orbitalPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const planeHitPoint = new THREE.Vector3();
    let pointerDownPos = { x: 0, y: 0 };

    const updateCanvasPointer = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const handleCanvasPointerMove = (e: MouseEvent) => {
      if (!controlsStateRef.current.planetCreatorMode) {
        if (spawnCursorGroup.visible) spawnCursorGroup.visible = false;
        return;
      }
      updateCanvasPointer(e);
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(orbitalPlane, planeHitPoint)) {
        const r = Math.hypot(planeHitPoint.x, planeHitPoint.z);
        if (r >= 4.2 && r <= 34.0) {
          spawnCursorGroup.visible = true;
          spawnCursorGroup.position.set(planeHitPoint.x, 0, planeHitPoint.z);
        } else {
          spawnCursorGroup.visible = false;
        }
      } else {
        spawnCursorGroup.visible = false;
      }
    };

    const handleCanvasPointerDown = (e: MouseEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const handleCanvasPointerUp = (e: MouseEvent) => {
      if (!controlsStateRef.current.planetCreatorMode) return;
      const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (moveDist > 6) return; // Ignorar si el usuario estaba rotando la cámara con OrbitControls

      updateCanvasPointer(e);
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(orbitalPlane, planeHitPoint)) {
        const r = Math.hypot(planeHitPoint.x, planeHitPoint.z);
        if (r >= 4.2 && r <= 34.0) {
          useLabGlobalStore.getState().setSpaceBodies(bodiesRef.current, false);
          useLabGlobalStore.getState().spawnPlanetAtCoords(planeHitPoint.x, planeHitPoint.z);
          audioSynth.playPlanetSpawnWhoosh();
        }
      }
    };

    renderer.domElement.addEventListener('mousemove', handleCanvasPointerMove);
    renderer.domElement.addEventListener('mousedown', handleCanvasPointerDown);
    renderer.domElement.addEventListener('mouseup', handleCanvasPointerUp);

    const rebuildVisualsForCurrentBodies = () => {
      while (bodiesGroup.children.length > 0) {
        bodiesGroup.remove(bodiesGroup.children[0]);
      }
      visualsMap = {};

      bodiesRef.current.forEach((b) => {
        const group = createCelestialCompositeGroup(b);
        group.position.set(b.position.x, b.position.y, b.position.z);
        bodiesGroup.add(group);

        const forceArrow = new THREE.ArrowHelper(
          new THREE.Vector3(1, 0, 0),
          group.position,
          2,
          0x38bdf8,
          0.6,
          0.4
        );
        const velArrow = new THREE.ArrowHelper(
          new THREE.Vector3(0, 0, 1),
          group.position,
          2,
          0x10b981,
          0.6,
          0.4
        );
        bodiesGroup.add(forceArrow, velArrow);

        const trailPositions = new Float32Array(MAX_TRAIL_POINTS * 3);
        const trailGeo = new THREE.BufferGeometry();
        trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
        trailGeo.setDrawRange(0, 0);

        const trailMat = new THREE.LineBasicMaterial({
          color: b.color,
          transparent: true,
          opacity: 0.75,
        });
        const trailLine = new THREE.Line(trailGeo, trailMat);
        trailLine.frustumCulled = false;
        bodiesGroup.add(trailLine);

        // Corriente de Plasma de Marea (Tidal Disruption Stream) que fluye desde la malla espaguetizada hacia el Agujero Negro al cruzar r_s
        const tidalStreamPositions = new Float32Array(TIDAL_STREAM_POINTS * 3);
        const tidalStreamGeo = new THREE.BufferGeometry();
        tidalStreamGeo.setAttribute('position', new THREE.BufferAttribute(tidalStreamPositions, 3));
        const tidalStreamMat = new THREE.LineBasicMaterial({
          color: 0xf43f5e,
          transparent: true,
          opacity: 0.88,
        });
        const tidalStreamLine = new THREE.Line(tidalStreamGeo, tidalStreamMat);
        tidalStreamLine.frustumCulled = false;
        tidalStreamLine.visible = false;
        bodiesGroup.add(tidalStreamLine);

        visualsMap[b.id] = {
          group,
          forceArrow,
          velArrow,
          trailLine,
          trailPositions,
          trailCount: 0,
          deformableMesh: group.userData.deformableMesh,
          deformableMat: group.userData.deformableMat,
          basePositions: group.userData.basePositions,
          wasDeformed: false,
          tidalStreamLine,
          tidalStreamPositions,
        };
      });
    };

    // Vectores pre-alocados fuera del loop para Cero Garbage Collection
    const _dirVec = new THREE.Vector3();
    const _camTargetPos = new THREE.Vector3();
    const _camLookAt = new THREE.Vector3();
    const _ejectaMatrix = new THREE.Matrix4();
    const _ejectaPos = new THREE.Vector3();
    const _ejectaQuat = new THREE.Quaternion();
    const _ejectaScale = new THREE.Vector3();
    const _unitX = new THREE.Vector3(1, 0, 0);
    const _tidalAxis = new THREE.Vector3(1, 0, 0);

    let frameId = 0;
    let lastHudUpdate = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (resetTriggerRef.current !== lastResetToken) {
        lastResetToken = resetTriggerRef.current;
        rebuildVisualsForCurrentBodies();
      }

      const cfg = controlsStateRef.current;
      const nowMs = performance.now();

      if (!cfg.planetCreatorMode && spawnCursorGroup.visible) {
        spawnCursorGroup.visible = false;
      }

      // 1. Integración Física Simpléctica de Velocity Verlet + Detección de Colisiones Planetarias
      if (!cfg.isPaused) {
        const subSteps = 2;
        const dt = (0.016 * cfg.simSpeed) / subSteps;
        for (let s = 0; s < subSteps; s++) {
          bodiesRef.current = stepVerletIntegration(bodiesRef.current, dt, cfg.gravityG);
          const colResult = detectAndResolveCollisions(bodiesRef.current);
          if (colResult.collisions.length > 0) {
            bodiesRef.current = colResult.bodies;
            rebuildVisualsForCurrentBodies();

            colResult.collisions.forEach((col) => {
              totalCollisionEnergyRef.current += col.energyReleasedGJ;
              absorbedHistoryRef.current.push(lang === 'es' ? col.absorbedNameEs : col.absorbedNameEn);
              impactFlashesRef.current.push({
                x: col.position.x,
                y: col.position.y,
                z: col.position.z,
                startTime: nowMs,
              });
              setLastCollisionNotice(
                `💥 Colisión gravitacional: ${col.absorbedNameEs} absorbido (+${col.energyReleasedGJ.toFixed(0)} GJ)`
              );
            });

            if (colResult.allOrbitersCollided && !supernovaAnimRef.current.active) {
              // ¡TODOS LOS PLANETAS CHOCARON! Detonar Supernova Cataclísmica
              const centerPos = bodiesRef.current[0]?.position ?? { x: 0, y: 0, z: 0 };
              supernovaAnimRef.current = {
                active: true,
                startTime: nowMs,
                progress: 0.001,
                origin: { ...centerPos },
              };
              audioSynth.playSupernovaExplosion();
              setSupernovaAlert({
                active: true,
                totalEnergyGJ: totalCollisionEnergyRef.current + 125000,
                absorbedPlanets: [...absorbedHistoryRef.current],
              });
            } else {
              audioSynth.playPlanetaryImpact();
            }
          }
        }
      }

      const activeBodies = bodiesRef.current;

      // 1a. Evaluar Métricas Relativistas (Dilatación Temporal dτ/dt y Espaguetización Mareal 3D)
      const relMetrics = computeRelativisticAndTidalMetrics(activeBodies, cfg.gravityG);
      if (!cfg.isPaused) {
        const stepRealSec = 0.016 * cfg.simSpeed;
        relClockRef.current.coordTime += stepRealSec;
        relClockRef.current.properTime += stepRealSec * relMetrics.properTimeRate;
      }

      // 1b. Animación 3D de la Supernova y Onda de Choque Relativista
      let currentSnProgress = 0;
      if (supernovaAnimRef.current.active) {
        const elapsedSn = (nowMs - supernovaAnimRef.current.startTime) / 4200; // 4.2s de expansión
        if (elapsedSn >= 0 && elapsedSn <= 1.0) {
          currentSnProgress = elapsedSn;
          supernovaAnimRef.current.progress = elapsedSn;
          supernovaGroup.visible = true;
          supernovaGroup.position.set(
            supernovaAnimRef.current.origin.x,
            supernovaAnimRef.current.origin.y,
            supernovaAnimRef.current.origin.z
          );

          const coreScale = 2.0 + Math.sin(elapsedSn * Math.PI) * 14.0;
          snCoreMesh.scale.setScalar(coreScale);
          snCoreMat.opacity = Math.max(0, 1.0 - elapsedSn * 1.15);

          const shellScale = 2.5 + elapsedSn * 34.0;
          snShellMesh.scale.setScalar(shellScale);
          snShellMat.opacity = Math.max(0, (1.0 - elapsedSn) * 0.68);

          const ringScale = 3.0 + elapsedSn * 44.0;
          snRingMesh.scale.setScalar(ringScale);
          snRingMat.opacity = Math.max(0, (1.0 - elapsedSn) * 0.92);

          ejectaMat.opacity = Math.max(0, 1.0 - elapsedSn * 0.9);
          for (let i = 0; i < ejectaCount; i++) {
            const d = ejectaDirs[i];
            const dist = elapsedSn * d.speed;
            _ejectaPos.set(d.x * dist, d.y * dist, d.z * dist);
            const s = d.scale * (1.0 + elapsedSn * 1.5);
            _ejectaScale.set(s, s, s);
            _ejectaMatrix.compose(_ejectaPos, _ejectaQuat, _ejectaScale);
            ejectaInstanced.setMatrixAt(i, _ejectaMatrix);
          }
          ejectaInstanced.instanceMatrix.needsUpdate = true;

          // Destello lumínico extremo durante la Supernova
          starLight.intensity = 3.8 + Math.sin(elapsedSn * Math.PI) * 32.0;
        } else {
          supernovaAnimRef.current.active = false;
          supernovaGroup.visible = false;
          snCoreMat.opacity = 0;
          snShellMat.opacity = 0;
          snRingMat.opacity = 0;
          ejectaMat.opacity = 0;
          starLight.intensity = 3.8;
        }
      } else if (supernovaGroup.visible) {
        // Garantiza que si se cancela la Supernova al cambiar de modo rápido, nunca quede congelada en pantalla
        supernovaGroup.visible = false;
        snCoreMat.opacity = 0;
        snShellMat.opacity = 0;
        snRingMat.opacity = 0;
        ejectaMat.opacity = 0;
        starLight.intensity = 3.8;
      }

      // Animación de destello de impacto planetario individual
      if (impactFlashesRef.current.length > 0) {
        const latest = impactFlashesRef.current[impactFlashesRef.current.length - 1];
        const tFlash = (nowMs - latest.startTime) / 700;
        if (tFlash >= 0 && tFlash <= 1.0) {
          impactRingMesh.visible = true;
          impactRingMesh.position.set(latest.x, latest.y, latest.z);
          const s = 1.0 + tFlash * 9.5;
          impactRingMesh.scale.setScalar(s);
          impactRingMat.opacity = (1.0 - tFlash) * 0.85;
        } else {
          impactRingMesh.visible = false;
          impactRingMat.opacity = 0;
          impactFlashesRef.current = [];
        }
      } else if (impactRingMesh.visible) {
        impactRingMesh.visible = false;
        impactRingMat.opacity = 0;
      }

      // 2. Actualizar Malla 3D del Espacio-Tiempo mediante GPU ShaderMaterial (SpaceScene3D)
      spacetimeMesh.visible = cfg.showSpacetimeMesh;
      if (cfg.showSpacetimeMesh) {
        updateSpacetimeShaderUniforms(
          spacetimeBundle,
          activeBodies,
          cfg.gravityG,
          nowMs * 0.001,
          undefined,
          currentSnProgress
        );
      }

      // 3. Actualizar Posiciones de Cuerpos, Deformación de Malla 3D (Espaguetización en r_s), Vectores y Rastro Orbital
      const timeSec = nowMs * 0.001;
      activeBodies.forEach((b) => {
        const vis = visualsMap[b.id];
        if (!vis) return;

        vis.group.position.set(b.position.x, b.position.y, b.position.z);

        const tidal = relMetrics.tidalByBodyId[b.id];
        if (tidal && tidal.stretchFactor > 1.04 && !b.isBlackHole && !b.isFixed) {
          // Espaguetización 3D: alinear eje X del grupo hacia el Agujero Negro y aplicar deformación de malla BufferGeometry + escala tensorial
          _tidalAxis.set(tidal.dirX, tidal.dirY, tidal.dirZ).normalize();
          vis.group.quaternion.setFromUnitVectors(_unitX, _tidalAxis);
          vis.group.scale.set(
            1.0 + (tidal.stretchFactor - 1.0) * 0.65,
            tidal.transverseScale,
            tidal.transverseScale
          );

          if (vis.deformableMesh && vis.basePositions) {
            deformPlanetGeometryForSpaghettification(
              vis.deformableMesh.geometry,
              vis.basePositions,
              b.radius,
              tidal.stretchFactor,
              tidal.vertexPinchIntensity,
              timeSec
            );
            vis.wasDeformed = true;
          }

          if (vis.deformableMat) {
            // Incandescencia térmica por fricción de marea al cruzar el Radio de Schwarzschild
            const heatRatio = Math.min(1.0, tidal.vertexPinchIntensity * 1.15);
            vis.deformableMat.emissive.setHex(
              tidal.crossedSchwarzschild ? 0xf43f5e : heatRatio > 0.25 ? 0xf97316 : 0x000000
            );
            vis.deformableMat.emissiveIntensity = 0.15 + heatRatio * 2.2;
          }

          // Filamento de acreción de plasma arrancado del cuerpo espaguetizado hacia el horizonte del Agujero Negro Binario
          if (vis.tidalStreamLine && vis.tidalStreamPositions && tidal.distanceToHorizonRatio <= 1.55) {
            vis.tidalStreamLine.visible = true;
            const streamArr = vis.tidalStreamPositions;
            const ax = tidal.attractorPosition.x;
            const ay = tidal.attractorPosition.y;
            const az = tidal.attractorPosition.z;
            for (let k = 0; k < TIDAL_STREAM_POINTS; k++) {
              const u = k / (TIDAL_STREAM_POINTS - 1);
              const spiralPhase = u * 8.5 - timeSec * 11.0;
              const spiralAmp = (1.0 - u) * 0.45 * b.radius * tidal.vertexPinchIntensity;
              streamArr[k * 3] =
                b.position.x + (ax - b.position.x) * u + Math.cos(spiralPhase) * spiralAmp;
              streamArr[k * 3 + 1] =
                b.position.y + (ay - b.position.y) * u + Math.sin(spiralPhase * 1.3) * spiralAmp * 0.5;
              streamArr[k * 3 + 2] =
                b.position.z + (az - b.position.z) * u + Math.sin(spiralPhase) * spiralAmp;
            }
            const streamAttr = vis.tidalStreamLine.geometry.attributes
              .position as THREE.BufferAttribute;
            streamAttr.needsUpdate = true;
          } else if (vis.tidalStreamLine) {
            vis.tidalStreamLine.visible = false;
          }
        } else {
          vis.group.scale.set(1, 1, 1);
          vis.group.rotation.y += b.isBlackHole ? 0.045 : 0.012;
          if (vis.wasDeformed && vis.deformableMesh && vis.basePositions) {
            deformPlanetGeometryForSpaghettification(
              vis.deformableMesh.geometry,
              vis.basePositions,
              b.radius,
              1.0,
              0,
              timeSec
            );
            vis.wasDeformed = false;
          }
          if (vis.deformableMat && !b.emissive) {
            vis.deformableMat.emissive.setHex(0x000000);
            vis.deformableMat.emissiveIntensity = 0.1;
          }
          if (vis.tidalStreamLine) {
            vis.tidalStreamLine.visible = false;
          }
        }

        // Vector 3D Fuerza Gravitacional (Azul)
        const accMag = Math.hypot(b.acceleration.x, b.acceleration.y, b.acceleration.z);
        if (cfg.showGravityVectors && accMag > 1e-4 && !b.isFixed) {
          vis.forceArrow.visible = true;
          vis.forceArrow.position.copy(vis.group.position);
          _dirVec.set(b.acceleration.x, b.acceleration.y, b.acceleration.z).normalize();
          vis.forceArrow.setDirection(_dirVec);
          vis.forceArrow.setLength(Math.min(7, Math.max(1.8, Math.log10(1 + accMag * 8) * 3.2)), 0.6, 0.38);
        } else {
          vis.forceArrow.visible = false;
        }

        // Vector 3D Velocidad Tangencial (Verde)
        const velMag = Math.hypot(b.velocity.x, b.velocity.y, b.velocity.z);
        if (cfg.showVelocityVectors && velMag > 1e-4 && !b.isFixed) {
          vis.velArrow.visible = true;
          vis.velArrow.position.copy(vis.group.position);
          _dirVec.set(b.velocity.x, b.velocity.y, b.velocity.z).normalize();
          vis.velArrow.setDirection(_dirVec);
          vis.velArrow.setLength(Math.min(7.5, Math.max(1.8, velMag * 0.42)), 0.6, 0.38);
        } else {
          vis.velArrow.visible = false;
        }

        // Rastro Orbital Luminoso (THREE.BufferGeometry)
        vis.trailLine.visible = cfg.showTrails && !b.isFixed;
        if (cfg.showTrails && !b.isFixed && !cfg.isPaused) {
          const arr = vis.trailPositions;
          if (vis.trailCount < MAX_TRAIL_POINTS) {
            arr[vis.trailCount * 3] = b.position.x;
            arr[vis.trailCount * 3 + 1] = b.position.y;
            arr[vis.trailCount * 3 + 2] = b.position.z;
            vis.trailCount += 1;
          } else {
            arr.copyWithin(0, 3);
            const last = (MAX_TRAIL_POINTS - 1) * 3;
            arr[last] = b.position.x;
            arr[last + 1] = b.position.y;
            arr[last + 2] = b.position.z;
          }
          const posAttr = vis.trailLine.geometry.attributes.position as THREE.BufferAttribute;
          posAttr.needsUpdate = true;
          vis.trailLine.geometry.setDrawRange(0, vis.trailCount);
        }
      });

      // 4. Cinemática de Cámaras Dinámica (Libre Orbital, Chase Cam, Superficial)
      const targetBody =
        activeBodies[Math.min(cfg.targetBodyIndex, activeBodies.length - 1)] || activeBodies[0];
      const centralBody = activeBodies[0];

      if (cfg.cameraMode === 'chase' && targetBody) {
        controls.enabled = false;
        const vx = targetBody.velocity.x;
        const vz = targetBody.velocity.z;
        const vNorm = Math.hypot(vx, vz) || 1;
        const backX = -vx / vNorm;
        const backZ = -vz / vNorm;

        _camTargetPos.set(
          targetBody.position.x + backX * (targetBody.radius * 5.5 + 5),
          targetBody.position.y + targetBody.radius * 3 + 3.5,
          targetBody.position.z + backZ * (targetBody.radius * 5.5 + 5)
        );
        camera.position.lerp(_camTargetPos, 0.08);
        _camLookAt.set(centralBody.position.x, centralBody.position.y, centralBody.position.z);
        camera.lookAt(_camLookAt);
      } else if (cfg.cameraMode === 'surface' && targetBody && centralBody) {
        controls.enabled = false;
        // Situar la cámara en la superficie del cuerpo observando hacia la estrella central (Tránsitos / Eclipses)
        const dx = centralBody.position.x - targetBody.position.x;
        const dz = centralBody.position.z - targetBody.position.z;
        const dNorm = Math.hypot(dx, dz) || 1;
        _camTargetPos.set(
          targetBody.position.x + (dx / dNorm) * (targetBody.radius + 0.45),
          targetBody.position.y + targetBody.radius * 0.85,
          targetBody.position.z + (dz / dNorm) * (targetBody.radius + 0.45)
        );
        camera.position.lerp(_camTargetPos, 0.12);
        _camLookAt.set(centralBody.position.x, centralBody.position.y, centralBody.position.z);
        camera.lookAt(_camLookAt);
      } else {
        controls.enabled = true;
        controls.update();
      }

      // 5. Actualizar HUD de energías y Reloj Relativista cada 200ms (<= 5Hz) para evitar re-renders a 60Hz
      const now = performance.now();
      if (now - lastHudUpdate > 200) {
        lastHudUpdate = now;
        const energetics = computeSystemEnergetics(activeBodies, cfg.gravityG);
        setLiveStats({
          ...energetics,
          coordTimeSec: relClockRef.current.coordTime,
          properTimeSec: relClockRef.current.properTime,
          properTimeRate: relMetrics.properTimeRate,
          lorentzGamma: relMetrics.lorentzGamma,
          redshiftZ: relMetrics.gravitationalRedshiftZ,
          maxTidalStretch: relMetrics.maxTidalStretch,
          maxTidalHeatingK: relMetrics.maxTidalHeatingK,
          schwarzschildRadiusU: relMetrics.schwarzschildRadiusU,
          closestDistanceU: relMetrics.closestDistanceU,
          horizonDistanceRatio: relMetrics.horizonDistanceRatio,
          isCrossingSchwarzschild: relMetrics.isCrossingSchwarzschild,
          isBinaryBlackHoleSystem: relMetrics.isBinaryBlackHoleSystem,
          spaghettificationRegime: relMetrics.spaghettificationRegime,
          closestBodyNameEs: relMetrics.closestBodyNameEs,
          closestBodyNameEn: relMetrics.closestBodyNameEn,
        });
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }
    tick();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 960;
      const h = container.clientHeight || 540;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousemove', handleCanvasPointerMove);
      renderer.domElement.removeEventListener('mousedown', handleCanvasPointerDown);
      renderer.domElement.removeEventListener('mouseup', handleCanvasPointerUp);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Header & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[#0D1322] border border-slate-800/90">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-purple-400">
            MÓDULO 2 · RELATIVIDAD GENERAL Y GRAVITACIÓN N-CUERPOS (VERLET 3D)
          </span>
          <h2 className="text-xl font-bold text-white">{t.spaceTitle}</h2>
          <p className="text-xs text-slate-400">{t.spaceSubtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#07090E] border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveSubTab('sandbox')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeSubTab === 'sandbox'
                  ? 'bg-purple-500 text-white font-semibold'
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
                  ? 'bg-purple-500 text-white font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>{t.challengesTab}</span>
            </button>
          </div>

          {/* Escenarios Astrofísicos Predefinidos + Agujero Negro Binario, Creador con Clic y Supernova */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'solar', label: t.presetSolar },
                { id: 'earth-moon', label: t.presetEarthMoon },
                { id: 'exoplanet', label: t.presetExoplanet },
                { id: 'geostationary', label: t.presetGeostationary },
                { id: 'lagrange', label: t.presetLagrange },
                {
                  id: 'binary-bh',
                  label: lang === 'es' ? '🌀 Agujeros Negros Binarios' : '🌀 Binary Black Holes',
                },
              ] as Array<{ id: SpacePresetId; label: string }>
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                data-testid={`preset-btn-${item.id}`}
                onClick={() => applyPreset(item.id, 1.0)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  preset === item.id
                    ? 'bg-purple-500/20 border-purple-400 text-purple-200'
                    : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {item.label}
              </button>
            ))}

            {/* Botón Conmutador Sol <-> Agujero Negro */}
            <button
              type="button"
              data-testid="toggle-blackhole-btn"
              onClick={() => handleToggleBlackHole()}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                isBlackHole
                  ? 'bg-fuchsia-600/30 border-fuchsia-400 text-fuchsia-200 shadow-[0_0_16px_rgba(217,70,239,0.35)]'
                  : 'bg-[#090D18] border-purple-500/50 text-purple-200 hover:bg-purple-950/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
              <span>
                {isBlackHole
                  ? lang === 'es'
                    ? '🕳️ Agujero Negro: ACTIVO'
                    : '🕳️ Black Hole: ON'
                  : lang === 'es'
                  ? '🕳️ Convertir Sol en Agujero Negro'
                  : '🕳️ Turn Sun into Black Hole'}
              </span>
            </button>

            {/* Botón Modo Creador de Planetas con Clic en el Lienzo 3D */}
            <button
              type="button"
              data-testid="toggle-planet-creator-btn"
              onClick={() => setSpacePlanetCreatorMode()}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                planetCreatorMode
                  ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-[0_0_14px_rgba(6,182,212,0.4)]'
                  : 'bg-[#090D18] border-cyan-500/50 text-cyan-200 hover:bg-cyan-950/50'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>
                {planetCreatorMode
                  ? lang === 'es'
                    ? '🪐 Clic en 3D para Crear: ACTIVO'
                    : '🪐 Click 3D to Spawn: ON'
                  : lang === 'es'
                  ? '🪐 Creador de Planetas (Clic 3D)'
                  : '🪐 Planet Creator (3D Click)'}
              </span>
            </button>

            {/* Botón Colisionar Todos los Planetas -> Supernova */}
            <button
              type="button"
              data-testid="trigger-supernova-collision-btn"
              onClick={handleTriggerCollisionCataclysm}
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold border border-amber-500/60 bg-gradient-to-r from-amber-500/20 to-rose-500/20 hover:from-amber-500/30 hover:to-rose-500/30 text-amber-200 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {lang === 'es' ? '☄️ Chocar Planetas (Supernova)' : '☄️ Crash Planets (Supernova)'}
              </span>
            </button>

            {/* Botón Inyectar Sonda al Radio de Schwarzschild Binario (Espaguetización 3D) */}
            <button
              type="button"
              data-testid="launch-schwarzschild-probe-top-btn"
              onClick={() => {
                setIsPaused(false);
                clearCataclysmState();
                setSpaceBodies(bodiesRef.current, false);
                injectSchwarzschildProbe();
                audioSynth.playPlanetSpawnWhoosh();
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold border border-rose-500/70 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>
                {lang === 'es'
                  ? '🍝 Cruzar Radio de Schwarzschild (Binario)'
                  : '🍝 Cross Schwarzschild Radius (Binary)'}
              </span>
            </button>
          </div>

          <TourGuiado labId="space" lang={lang} steps={SPACE_TOUR_STEPS} />
        </div>
      </div>

      {/* Desafíos Experimentales Espaciales */}
      {activeSubTab === 'challenges' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {SPACE_CHALLENGES.map((ch) => {
            const isDone = !!completedChallenges[ch.id];
            const fb = validationFeedback[ch.id];
            return (
              <div
                key={ch.id}
                className="p-5 rounded-xl bg-[#0D1322] border border-slate-800 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs font-mono">
                    <span className="text-purple-400">{ch.points} PTS</span>
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
                    onClick={() => applyPreset(ch.presetId, 1.0)}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
                  >
                    {t.loadChallengeSetup}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleValidateChallenge(ch.id)}
                    className="flex-1 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-400 text-white font-semibold text-xs transition-colors cursor-pointer"
                  >
                    {t.validateChallenge}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Escenario Principal 3D (En móvil el dock se ubica debajo del lienzo 3D para no tapar la simulación) */}
      <div className="space-y-3 lg:space-y-0 lg:relative w-full">
        <div
          data-tour="space-3d-stage"
          className="relative w-full fluid-stage-box rounded-xl bg-[#05070E] border border-slate-800 overflow-hidden"
        >
          {/* Contenedor aislado del Canvas WebGL */}
          <div
            ref={mountRef}
            data-testid="space-3d-canvas"
            className={`w-full h-full ${planetCreatorMode ? 'cursor-crosshair' : ''}`}
          />

          {/* Minimal Spec Badge + Reloj Relativista y Espaguetización Mareal (Top-Left) */}
          <div className="absolute top-2.5 left-2.5 right-2.5 sm:right-auto sm:top-4 sm:left-4 pointer-events-none bg-[#090D16]/95 border border-slate-800 rounded-lg px-3 py-2 sm:px-3.5 sm:py-2.5 space-y-1.5">
            <div className="text-[10px] sm:text-[11px] font-mono text-purple-400 uppercase truncate">
              {preset === 'binary-bh'
                ? '🌀 SISTEMA BINARIO DE AGUJEROS NEGROS · HORIZONTE DE SCHWARZSCHILD'
                : isBlackHole
                ? '🕳️ MÉTRICA DE KERR-SCHWARZSCHILD · HORIZONTE DE SUCESOS'
                : 'TELEMETRÍA ORBITAL EN VIVO (VERLET)'}
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[11px] sm:text-xs font-mono text-slate-200 tabular-nums">
              <span>r: {liveStats.primaryOrbitalRadius.toFixed(2)} u</span>
              <span>r/r_s: {liveStats.horizonDistanceRatio.toFixed(2)}</span>
              <span>v: {liveStats.primarySpeed.toFixed(2)} u/s</span>
              <span className="text-cyan-400">E_tot: {liveStats.totalEnergy.toFixed(0)} GJ</span>
            </div>

            {/* Reloj de Dilatación Temporal Relativista y Estiramiento Mareal (Espaguetización) */}
            <div
              data-testid="relativistic-telemetry-hud"
              className="pt-1 border-t border-slate-800/90 flex flex-wrap items-center gap-2.5 text-[10px] sm:text-[11px] font-mono tabular-nums"
            >
              <span className="text-slate-300 flex items-center gap-1">
                <Clock className="w-3 h-3 text-fuchsia-400" />
                <span>t_obs: {liveStats.coordTimeSec.toFixed(1)}s</span>
              </span>
              <span className="text-fuchsia-300 font-semibold">
                τ_sonda: {liveStats.properTimeSec.toFixed(1)}s (γ={liveStats.lorentzGamma.toFixed(2)}x)
              </span>
              <span
                className={
                  liveStats.isCrossingSchwarzschild
                    ? 'text-rose-400 font-extrabold'
                    : liveStats.maxTidalStretch > 1.25
                    ? 'text-amber-300 font-bold'
                    : 'text-emerald-300'
                }
              >
                🍝 Malla 3D: {liveStats.maxTidalStretch.toFixed(2)}x
                {liveStats.isCrossingSchwarzschild
                  ? ' [CRUZANDO r_s · ESPAGUETIZACIÓN]'
                  : liveStats.maxTidalStretch > 1.25
                  ? ' [ZONA DE MAREA]'
                  : ''}
              </span>
            </div>

            {planetCreatorMode && (
              <div className="text-[10px] font-mono text-cyan-300 pt-0.5">
                🎯 Haz clic en cualquier punto de la malla 3D para inyectar un nuevo planeta en órbita.
              </div>
            )}
            {lastCollisionNotice && !supernovaAlert.active && (
              <div className="text-[11px] font-mono text-amber-300 pt-0.5">
                {lastCollisionNotice}
              </div>
            )}
          </div>

          {/* Alerta Cataclísmica de Supernova cuando todos los planetas chocan */}
          {supernovaAlert.active && (
            <div
              data-testid="supernova-alert-banner"
              className="absolute top-16 sm:top-4 right-2.5 left-2.5 sm:left-auto sm:max-w-md bg-[#13071E]/95 border-2 border-amber-400/80 rounded-xl p-3.5 shadow-[0_0_35px_rgba(245,158,11,0.45)] space-y-2 z-20"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-rose-400" />
                  ¡SUPERNOVA CATACLÍSMICA DETONADA!
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 border border-rose-400/40 text-rose-200">
                  MASA CRÍTICA
                </span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                Todos los cuerpos planetarios ({supernovaAlert.absorbedPlanets.join(', ') || 'Sistema Orbital'}) colisionaron liberando{' '}
                <strong className="text-amber-300 font-mono">
                  {supernovaAlert.totalEnergyGJ.toFixed(0)} GJ
                </strong>{' '}
                y una onda gravitacional sobre el tejido espacio-temporal.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {!isBlackHole && (
                  <button
                    type="button"
                    onClick={() => handleToggleBlackHole(true)}
                    className="px-3 py-1.5 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-400 text-slate-950 font-mono font-bold text-xs cursor-pointer transition-colors"
                  >
                    🕳️ Colapsar en Agujero Negro
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => applyPreset(preset, 1.0, isBlackHole)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 font-mono text-xs cursor-pointer transition-colors"
                >
                  🔄 Regenerar Planetas
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Collapsible Unified Control Dock (Flujo normal en móvil/tablet, flotante inferior en escritorio lg+) */}
        <div className="w-full lg:absolute lg:bottom-4 lg:left-1/2 lg:-translate-x-1/2 lg:w-[94%] lg:max-w-[57.5rem] flex flex-col items-center z-10">
          <button
            type="button"
            onClick={() => setDockCollapsed((prev) => !prev)}
            className="flex items-center gap-1.5 px-3.5 py-2 min-h-[2.75rem] lg:min-h-0 lg:py-1 rounded-t-lg bg-[#0D1322] border border-b-0 border-slate-700 text-xs font-mono text-cyan-300 hover:text-white transition-colors cursor-pointer"
          >
            {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{dockCollapsed ? t.showControls : t.hideControls}</span>
          </button>

          {!dockCollapsed && (
            <div
              data-tour="space-control-dock"
              className="w-full rounded-xl bg-[#0B0F1C] border border-slate-700/90 p-3.5 sm:p-4 shadow-2xl space-y-3"
            >
              {/* Row 1: Camera Kinematics & Vector Layers */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 border-b border-slate-800 pb-3">
                {/* Camera Selector */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-mono text-slate-400 flex items-center gap-1 mr-1">
                    <Camera className="w-3.5 h-3.5 text-purple-400" />
                    {t.cameraModeLabel}:
                  </span>
                  {(
                    [
                      { id: 'free', label: t.camFree },
                      { id: 'chase', label: t.camChase },
                      { id: 'surface', label: t.camSurface },
                    ] as Array<{ id: CameraMode; label: string }>
                  ).map((cam) => (
                    <button
                      key={cam.id}
                      type="button"
                      onClick={() => setCameraMode(cam.id)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                        cameraMode === cam.id
                          ? 'bg-purple-500 text-white font-semibold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {cam.label}
                    </button>
                  ))}

                  {cameraMode !== 'free' && (
                    <select
                      aria-label={t.chaseTargetLabel}
                      value={targetBodyIndex}
                      onChange={(e) => setTargetBodyIndex(parseInt(e.target.value, 10))}
                      className="rounded bg-[#07090E] border border-slate-700 px-2 py-1 text-xs font-mono text-cyan-300"
                    >
                      {bodiesRef.current.map((b, idx) => (
                        <option key={b.id} value={idx}>
                          {lang === 'es' ? b.nameEs : b.nameEn}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Physics Layers Toggles */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-mono text-slate-400 flex items-center gap-1 mr-1">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    {t.layersLabel}:
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSpacetimeMesh((v) => !v)}
                    className={`px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                      showSpacetimeMesh
                        ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-200'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {t.layerSpacetime}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGravityVectors((v) => !v)}
                    className={`px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                      showGravityVectors
                        ? 'bg-sky-500/20 border border-sky-400 text-sky-200'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {t.layerGravityVec}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowVelocityVectors((v) => !v)}
                    className={`px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                      showVelocityVectors
                        ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-200'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {t.layerVelocityVec}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTrails((v) => !v)}
                    className={`px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                      showTrails
                        ? 'bg-amber-500/20 border border-amber-400 text-amber-200'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {t.layerTrails}
                  </button>
                </div>
              </div>

              {/* Row 2: Orbital Sliders & Playback Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4 items-center">
                <div>
                  <div className="flex items-center justify-between gap-1 text-xs mb-1">
                    <label htmlFor="central-mass-top-slider" className="text-slate-300 whitespace-nowrap truncate">
                      {isBlackHole
                        ? lang === 'es'
                          ? 'Masa Agujero Negro (M☉)'
                          : 'Black Hole Mass (M☉)'
                        : lang === 'es'
                        ? 'Masa Astro Central (M☉)'
                        : 'Central Mass (M☉)'}
                    </label>
                    <span className="font-mono font-bold text-fuchsia-300 tabular-nums whitespace-nowrap shrink-0">
                      {centralMassSolar.toFixed(2)} M☉
                    </span>
                  </div>
                  <input
                    id="central-mass-top-slider"
                    type="range"
                    min={0.4}
                    max={2.5}
                    step={0.1}
                    value={centralMassSolar}
                    onChange={(e) => handleCentralMassChange(parseFloat(e.target.value))}
                    className="w-full accent-fuchsia-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-1 text-xs mb-1">
                    <label htmlFor="insertion-vel-slider" className="text-slate-300 whitespace-nowrap truncate">
                      {t.insertionVelocityLabel}
                    </label>
                    <span className="font-mono font-bold text-cyan-300 tabular-nums whitespace-nowrap shrink-0">
                      {insertionFactor.toFixed(2)}x v_c
                    </span>
                  </div>
                  <input
                    id="insertion-vel-slider"
                    type="range"
                    min={0.1}
                    max={1.6}
                    step={0.02}
                    value={insertionFactor}
                    onChange={(e) => handleInsertionFactorChange(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label htmlFor="gravity-g-slider" className="text-slate-300">
                      {t.gravityConstantLabel}
                    </label>
                    <span className="font-mono font-bold text-purple-300 tabular-nums">
                      {gravityG.toFixed(2)} G₀
                    </span>
                  </div>
                  <input
                    id="gravity-g-slider"
                    type="range"
                    min={0.4}
                    max={2.0}
                    step={0.05}
                    value={gravityG}
                    onChange={(e) => {
                      const nextG = parseFloat(e.target.value);
                      setSpaceBodies(bodiesRef.current, false);
                      setSpaceGravityG(nextG);
                    }}
                    className="w-full accent-purple-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label htmlFor="sim-speed-slider" className="text-slate-300">
                      {t.timeStepLabel}
                    </label>
                    <span className="font-mono font-bold text-amber-300 tabular-nums">
                      {simSpeed.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    id="sim-speed-slider"
                    type="range"
                    min={0.2}
                    max={3.0}
                    step={0.2}
                    value={simSpeed}
                    onChange={(e) => setSpaceSimSpeed(parseFloat(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPaused((p) => !p)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-cyan-500 text-slate-950 font-semibold text-xs hover:bg-cyan-400 transition-colors cursor-pointer"
                  >
                    {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    <span>{isPaused ? t.resumeSim : t.pauseSim}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset(preset, 1.0)}
                    aria-label={t.resetSim}
                    className="p-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* UI Interactiva: Reloj de Dilatación Temporal Relativista y Monitor de Espaguetización 3D (Radio de Schwarzschild r_s) */}
      <ScrollReveal direction="up" delayMs={50}>
        <div
          data-testid="relativistic-clock-spaghettification-panel"
          className="p-5 rounded-xl bg-[#0D1322] border border-fuchsia-500/40 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-fuchsia-400">
                  MÉTRICA DE SCHWARZSCHILD Y TENSOR DE MAREA BINARIO · dτ = dt · √(1 - r_s / r)
                </span>
                <span
                  data-testid="spaghettification-status-badge"
                  className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded border ${
                    liveStats.isCrossingSchwarzschild
                      ? 'bg-rose-500/25 border-rose-400 text-rose-200'
                      : liveStats.spaghettificationRegime === 'roche-tidal'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                      : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  }`}
                >
                  {liveStats.isCrossingSchwarzschild
                    ? '🔴 ¡CRUZANDO RADIO DE SCHWARZSCHILD (r ≤ r_s) · ESPAGUETIZACIÓN CRÍTICA 3D!'
                    : liveStats.spaghettificationRegime === 'roche-tidal'
                    ? '🟡 ZONA DE ROCHE · DEFORMACIÓN DE MALLA MAREAL ACTIVA'
                    : '🟢 GEOMETRÍA ESFÉRICA NOMINAL (r > 2.2 r_s)'}
                </span>
              </div>
              <h3 className="text-sm font-bold text-white mt-1">
                Reloj de Dilatación Temporal Relativista y Monitor de Espaguetización 3D en Agujero Negro Binario
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="launch-schwarzschild-probe-btn"
                onClick={() => {
                  setIsPaused(false);
                  clearCataclysmState();
                  setSpaceBodies(bodiesRef.current, false);
                  injectSchwarzschildProbe();
                  audioSynth.playPlanetSpawnWhoosh();
                }}
                className="px-3.5 py-2 rounded-lg text-xs font-mono font-bold bg-rose-500 hover:bg-rose-400 text-slate-950 transition-colors cursor-pointer"
              >
                🍝 Inyectar Sonda en Radio de Schwarzschild Binario (r ≤ r_s)
              </button>
              <button
                type="button"
                data-testid="reset-relativistic-clocks-btn"
                onClick={() => {
                  relClockRef.current = { coordTime: 0, properTime: 0 };
                  setLiveStats((prev) => ({
                    ...prev,
                    coordTimeSec: 0,
                    properTimeSec: 0,
                  }));
                }}
                className="px-3 py-2 rounded-lg text-xs font-mono border border-slate-700 bg-[#07090E] hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer"
              >
                ⏱️ Sincronizar Relojes (t = τ = 0)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* Columna Izquierda (7 cols): Relojes Gemelos Relativistas (Observador Lejano vs. Sonda en el Horizonte) */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Reloj 1: Observador en el Infinito (t_obs) */}
              <div className="p-3.5 rounded-xl bg-[#07090E] border border-slate-800 flex items-center gap-3.5">
                <svg
                  viewBox="0 0 80 80"
                  className="w-16 h-16 shrink-0"
                  aria-label="Reloj Observador Lejano"
                >
                  <circle
                    cx="40"
                    cy="40"
                    r="35"
                    fill="#090D16"
                    stroke="#38BDF8"
                    strokeWidth="2.5"
                  />
                  {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
                    <line
                      key={deg}
                      x1="40"
                      y1="8"
                      x2="40"
                      y2={deg % 90 === 0 ? '14' : '11'}
                      stroke="#64748B"
                      strokeWidth={deg % 90 === 0 ? '2' : '1'}
                      transform={`rotate(${deg} 40 40)`}
                    />
                  ))}
                  {/* Manecilla de minutos */}
                  <line
                    x1="40"
                    y1="40"
                    x2="40"
                    y2="20"
                    stroke="#94A3B8"
                    strokeWidth="2"
                    strokeLinecap="round"
                    transform={`rotate(${(liveStats.coordTimeSec * 6) % 360} 40 40)`}
                  />
                  {/* Manecilla de segundos rápida (1 vuelta cada 10s simulados) */}
                  <line
                    x1="40"
                    y1="40"
                    x2="40"
                    y2="13"
                    stroke="#38BDF8"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    transform={`rotate(${(liveStats.coordTimeSec * 36) % 360} 40 40)`}
                  />
                  <circle cx="40" cy="40" r="3" fill="#38BDF8" />
                </svg>

                <div className="space-y-1 font-mono min-w-0">
                  <span className="text-[10px] uppercase tracking-wider text-sky-400 block">
                    RELOJ OBSERVADOR LEJANO (r → ∞)
                  </span>
                  <div
                    data-testid="clock-observer-readout"
                    className="text-lg font-extrabold text-white tabular-nums"
                  >
                    t = {liveStats.coordTimeSec.toFixed(2)} s
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Ritmo: <span className="text-sky-300 font-semibold">1.000 s/s</span> (Espacio Plano)
                  </div>
                </div>
              </div>

              {/* Reloj 2: Tiempo Propio en la Sonda / Horizonte (τ_sonda) */}
              <div
                className={`p-3.5 rounded-xl bg-[#07090E] border flex items-center gap-3.5 ${
                  liveStats.isCrossingSchwarzschild
                    ? 'border-rose-500/80 shadow-[0_0_20px_rgba(244,63,94,0.22)]'
                    : 'border-fuchsia-500/40'
                }`}
              >
                <svg
                  viewBox="0 0 80 80"
                  className="w-16 h-16 shrink-0"
                  aria-label="Reloj Propio en el Horizonte"
                >
                  <circle
                    cx="40"
                    cy="40"
                    r="35"
                    fill="#12081C"
                    stroke={liveStats.isCrossingSchwarzschild ? '#F43F5E' : '#D946EF'}
                    strokeWidth="2.5"
                  />
                  {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
                    <line
                      key={deg}
                      x1="40"
                      y1="8"
                      x2="40"
                      y2={deg % 90 === 0 ? '14' : '11'}
                      stroke="#701A75"
                      strokeWidth={deg % 90 === 0 ? '2' : '1'}
                      transform={`rotate(${deg} 40 40)`}
                    />
                  ))}
                  {/* Manecilla de minutos relativista */}
                  <line
                    x1="40"
                    y1="40"
                    x2="40"
                    y2="20"
                    stroke="#F0ABFC"
                    strokeWidth="2"
                    strokeLinecap="round"
                    transform={`rotate(${(liveStats.properTimeSec * 6) % 360} 40 40)`}
                  />
                  {/* Manecilla de segundos ralentizada por la gravedad (dτ/dt) */}
                  <line
                    x1="40"
                    y1="40"
                    x2="40"
                    y2="13"
                    stroke={liveStats.isCrossingSchwarzschild ? '#F43F5E' : '#E879F9'}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    transform={`rotate(${(liveStats.properTimeSec * 36) % 360} 40 40)`}
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="3"
                    fill={liveStats.isCrossingSchwarzschild ? '#F43F5E' : '#E879F9'}
                  />
                </svg>

                <div className="space-y-1 font-mono min-w-0">
                  <span className="text-[10px] uppercase tracking-wider text-fuchsia-400 block truncate">
                    RELOJ PROPIO ({lang === 'es' ? liveStats.closestBodyNameEs : liveStats.closestBodyNameEn})
                  </span>
                  <div
                    data-testid="clock-proper-readout"
                    className="text-lg font-extrabold text-fuchsia-200 tabular-nums"
                  >
                    τ = {liveStats.properTimeSec.toFixed(2)} s
                  </div>
                  <div className="text-[11px] text-slate-300">
                    dτ/dt:{' '}
                    <span className="text-rose-300 font-bold">
                      {(liveStats.properTimeRate * 100).toFixed(1)}%
                    </span>{' '}
                    · Δt: +{(liveStats.coordTimeSec - liveStats.properTimeSec).toFixed(2)}s
                  </div>
                </div>
              </div>

              {/* Fila inferior de métricas relativistas: Factor Gamma, Redshift z, Temperatura de Marea */}
              <div className="sm:col-span-2 grid grid-cols-3 gap-2.5 text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-[#07090E] border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">FACTOR LORENTZ GRAV. (γ)</span>
                  <span className="text-sm font-bold text-fuchsia-300 tabular-nums">
                    γ = {liveStats.lorentzGamma.toFixed(2)}x
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#07090E] border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">REDSHIFT GRAVITACIONAL (z)</span>
                  <span className="text-sm font-bold text-amber-300 tabular-nums">
                    z = {liveStats.redshiftZ.toFixed(3)}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#07090E] border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">FRICCIÓN DE MAREA (T)</span>
                  <span className="text-sm font-bold text-rose-300 tabular-nums">
                    {liveStats.maxTidalHeatingK} K
                  </span>
                </div>
              </div>
            </div>

            {/* Columna Derecha (5 cols): Visualizador de Malla 3D Espaguetizada y Proximidad al Radio de Schwarzschild (r / r_s) */}
            <div className="lg:col-span-5 p-3.5 rounded-xl bg-[#07090E] border border-slate-800 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between gap-2 text-xs font-mono">
                <span className="text-rose-300 font-bold">
                  🍝 DEFORMACIÓN DE MALLA 3D (λ = {liveStats.maxTidalStretch.toFixed(2)}x)
                </span>
                <span className="text-slate-300 tabular-nums">
                  r / r_s = <strong className="text-white">{liveStats.horizonDistanceRatio.toFixed(2)}</strong> (r_s = {liveStats.schwarzschildRadiusU.toFixed(1)} u)
                </span>
              </div>

              {/* Esquema SVG en vivo de la Malla 3D deformándose al cruzar el Radio de Schwarzschild r_s */}
              <div className="relative h-24 w-full rounded-lg bg-[#05070E] border border-slate-800/90 overflow-hidden flex items-center justify-center">
                <svg
                  viewBox="0 0 260 84"
                  className="w-full h-full"
                  aria-label="Monitor de Espaguetización en el Radio de Schwarzschild"
                >
                  {/* Horizonte de Sucesos de Schwarzschild (Derecha) */}
                  <circle
                    cx="236"
                    cy="42"
                    r="28"
                    fill="#000000"
                    stroke="#F43F5E"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                  />
                  <circle cx="236" cy="42" r="14" fill="#000000" stroke="#A855F7" strokeWidth="2" />
                  <text x="195" y="15" fill="#F43F5E" fontSize="8" fontFamily="monospace">
                    Horizonte r_s
                  </text>

                  {/* Malla 3D de la Sonda/Planeta estirada longitudinalmente y comprimida transversalmente */}
                  {(() => {
                    const stretch = Math.min(4.2, liveStats.maxTidalStretch);
                    const rx = 14 * stretch;
                    const ry = Math.max(4.5, 14 / Math.sqrt(stretch));
                    const cx = Math.max(
                      52,
                      Math.min(198, 215 - Math.min(3.2, liveStats.horizonDistanceRatio) * 48)
                    );
                    const strokeCol = liveStats.isCrossingSchwarzschild
                      ? '#F43F5E'
                      : stretch > 1.25
                      ? '#F59E0B'
                      : '#38BDF8';
                    return (
                      <g transform={`translate(${cx}, 42)`}>
                        <ellipse
                          cx="0"
                          cy="0"
                          rx={rx}
                          ry={ry}
                          fill={strokeCol}
                          fillOpacity="0.22"
                          stroke={strokeCol}
                          strokeWidth="1.8"
                        />
                        {/* Meridianos de la malla 3D deformada */}
                        <ellipse
                          cx="0"
                          cy="0"
                          rx={rx * 0.65}
                          ry={ry}
                          fill="none"
                          stroke="#FEF08A"
                          strokeOpacity="0.55"
                          strokeWidth="0.9"
                        />
                        <line
                          x1={-rx}
                          y1="0"
                          x2={rx}
                          y2="0"
                          stroke="#FEF08A"
                          strokeOpacity="0.65"
                          strokeWidth="1"
                        />
                        <line
                          x1="0"
                          y1={-ry}
                          x2="0"
                          y2={ry}
                          stroke="#FEF08A"
                          strokeOpacity="0.65"
                          strokeWidth="1"
                        />
                      </g>
                    );
                  })()}
                </svg>
              </div>

              {/* Barra de Proximidad al Radio de Schwarzschild (r / r_s) */}
              <div className="space-y-1 font-mono text-[11px]">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>0.5 r_s (Singularidad)</span>
                  <span className="text-rose-400 font-bold">1.0 r_s (Horizonte Schwarzschild)</span>
                  <span>3.0+ r_s (Zona Segura)</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-900 border border-slate-800 overflow-hidden relative">
                  <div
                    className={`h-full transition-all duration-150 ${
                      liveStats.isCrossingSchwarzschild
                        ? 'bg-gradient-to-r from-rose-600 via-fuchsia-500 to-amber-400'
                        : 'bg-gradient-to-r from-cyan-500 to-purple-500'
                    }`}
                    style={{
                      width: `${Math.max(
                        8,
                        Math.min(100, (1 - Math.min(3.2, liveStats.horizonDistanceRatio) / 3.4) * 100)
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollReveal>

      {/* Panel Analítico Interactivo: Leyes de Kepler (Animado al Hacer Scroll) */}
      <ScrollReveal direction="up" delayMs={80}>
      <div
        data-tour="space-kepler-instrument"
        className="p-5 rounded-xl bg-[#0D1322] border border-slate-800 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-purple-400 block">
              MECÁNICA CELESTE QUANTUMLABS · KEPLER 1ª–3ª &amp; MANIOBRA DE HOHMANN
            </span>
            <h3 className="text-sm font-bold text-white">
              Simulador Paramétrico de Excentricidad Orbital, Velocidad de Escape y Transferencia Interplanetaria
            </h3>
          </div>

          <button
            type="button"
            onClick={() => {
              const nextHohmann = !hohmannActive;
              clearCataclysmState();
              setSpaceKeplerParams({ hohmannActive: nextHohmann });
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${
              hohmannActive
                ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                : 'bg-purple-500/20 hover:bg-purple-500/30 border-purple-400 text-purple-200'
            }`}
          >
            {hohmannActive
              ? '● Transferencia de Hohmann Activa (Δv₁ Inyectado)'
              : '🚀 Ejecutar Transferencia de Hohmann (r₁ → Marte)'}
          </button>
        </div>

        {/* Sliders Keplerianos: Masa Estelar M, Semieje Mayor a, Excentricidad e */}
        <div className="fluid-auto-grid text-xs">
          <div className="p-3 rounded-lg bg-[#07090E] border border-slate-800">
            <div className="flex justify-between mb-1">
              <label htmlFor="kepler-mass-slider" className="text-slate-300 font-mono">
                {isBlackHole ? 'Masa Agujero Negro (M☉)' : 'Masa Estrella Central (M☉)'}
              </label>
              <span className="font-mono font-bold text-amber-300">{centralMassSolar.toFixed(2)} M☉</span>
            </div>
            <input
              id="kepler-mass-slider"
              type="range"
              min={0.4}
              max={2.5}
              step={0.1}
              value={centralMassSolar}
              onChange={(e) => {
                const m = parseFloat(e.target.value);
                handleCentralMassChange(m);
              }}
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>

          <div className="p-3 rounded-lg bg-[#07090E] border border-slate-800">
            <div className="flex justify-between mb-1">
              <label htmlFor="kepler-a-slider" className="text-slate-300 font-mono">
                Semieje Mayor Orbital (a)
              </label>
              <span className="font-mono font-bold text-cyan-300">{semiMajorAxisAU.toFixed(2)} UA</span>
            </div>
            <input
              id="kepler-a-slider"
              type="range"
              min={0.5}
              max={2.2}
              step={0.05}
              value={semiMajorAxisAU}
              onChange={(e) => {
                const aVal = parseFloat(e.target.value);
                clearCataclysmState();
                setSpaceKeplerParams({ semiMajorAxisAU: aVal });
              }}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="p-3 rounded-lg bg-[#07090E] border border-slate-800">
            <div className="flex justify-between mb-1">
              <label htmlFor="kepler-e-slider" className="text-slate-300 font-mono">
                Excentricidad Orbital (e)
              </label>
              <span className="font-mono font-bold text-purple-300">{eccentricity.toFixed(2)}</span>
            </div>
            <input
              id="kepler-e-slider"
              type="range"
              min={0.0}
              max={0.75}
              step={0.05}
              value={eccentricity}
              onChange={(e) => {
                const eVal = parseFloat(e.target.value);
                clearCataclysmState();
                setSpaceKeplerParams({ eccentricity: eVal });
              }}
              className="w-full accent-purple-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Telemetría Analítica de las 4 Leyes Celestes con Equivalencias Reales */}
        <div className="fluid-metrics-grid text-xs font-mono">
          <div className="p-3 rounded-lg bg-[#07090E] border border-slate-800">
            <span className="text-[10px] text-slate-400 block">1ª LEY (PERIHELIO / AFELIO)</span>
            <span className="text-sm font-bold text-white">
              {keplerMetrics.perihelionAU.toFixed(2)} / {keplerMetrics.aphelionAU.toFixed(2)} UA
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              ≈ {(semiMajorAxisAU * 149.6).toFixed(0)} millones de km
            </span>
          </div>
          <div className="p-3 rounded-lg bg-[#07090E] border border-slate-800">
            <span className="text-[10px] text-slate-400 block">2ª LEY (v_peri / v_afelio)</span>
            <span className="text-sm font-bold text-emerald-300">
              {keplerMetrics.perihelionVelocityKmS.toFixed(1)} / {keplerMetrics.aphelionVelocityKmS.toFixed(1)} km/s
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Más rápido cerca del Sol
            </span>
          </div>
          <div className="p-3 rounded-lg bg-[#07090E] border border-slate-800">
            <span className="text-[10px] text-slate-400 block">3ª LEY (PERÍODO T² = a³/M)</span>
            <span className="text-sm font-bold text-cyan-300">
              T = {keplerMetrics.orbitalPeriodYears.toFixed(2)} años
            </span>
            <span className="text-[10px] text-cyan-400/90 block mt-0.5">
              ≈ {(keplerMetrics.orbitalPeriodYears * 365.25).toFixed(0)} días terrestres
            </span>
          </div>
          <div className="p-3 rounded-lg bg-[#07090E] border border-slate-800">
            <span className="text-[10px] text-slate-400 block">VELOCIDAD ESCAPE &amp; HOHMANN</span>
            <span className="text-sm font-bold text-amber-300">
              v_esc: {keplerMetrics.escapeVelocityKmS.toFixed(1)} km/s · Δv₁: {keplerMetrics.hohmannDeltaV1KmS.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Límite escape: 1.41x v_c
            </span>
          </div>
        </div>

        {/* Semáforo Orbital Pedagógico + Sustitución Paso a Paso para Secundaria */}
        <div className="p-3.5 rounded-xl bg-[#070B14] border border-purple-500/30 space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono font-bold text-purple-300">
              🚦 Diagnóstico Orbital para Estudiantes y Fórmula de Kepler Paso a Paso:
            </span>
            <span className="font-mono text-[11px] text-cyan-300 bg-[#0B101E] px-2.5 py-1 rounded border border-slate-800 break-words whitespace-normal max-w-full">
              {`T = √(a³ / M) = √(${semiMajorAxisAU.toFixed(2)}³ / ${centralMassSolar.toFixed(2)}) = ${keplerMetrics.orbitalPeriodYears.toFixed(2)} años`}
            </span>
          </div>

          <p className="text-slate-200 leading-relaxed">
            {insertionFactor >= 1.41 || liveStats.totalEnergy > 0 ? (
              <span className="text-rose-300 font-medium">
                🔴 <strong>¡Velocidad de Escape Superada ({insertionFactor.toFixed(2)}x ≥ 1.41x)!</strong> El planeta lleva tanta velocidad que venció el pozo gravitacional del Sol (Energía Total &gt; 0) y saldrá disparado hacia el espacio interestelar sin regresar jamás.
              </span>
            ) : hohmannActive ? (
              <span className="text-emerald-300 font-medium">
                🚀 <strong>Maniobra de Transferencia de Hohmann Activa:</strong> La nave encendió sus motores en el punto más cercano (sumando Δv₁ = {keplerMetrics.hohmannDeltaV1KmS.toFixed(2)} km/s) para estirar su elipse justo hasta tocar la órbita de Marte gastando el mínimo combustible posible.
              </span>
            ) : eccentricity >= 0.35 || insertionFactor >= 1.18 ? (
              <span className="text-amber-300 font-medium">
                🟡 <strong>Órbita Elíptica Alargada (Tipo Cometa, e = {eccentricity.toFixed(2)}):</strong> Por la 2ª Ley de Kepler, observa cómo el planeta se acelera hasta {keplerMetrics.perihelionVelocityKmS.toFixed(1)} km/s cuando pasa cerca del Sol (perihelio) y se frena a {keplerMetrics.aphelionVelocityKmS.toFixed(1)} km/s cuando se aleja (afelio).
              </span>
            ) : (
              <span className="text-cyan-200 font-medium">
                🟢 <strong>Órbita Estable Casi Circular (Tipo Tierra, e = {eccentricity.toFixed(2)}):</strong> La fuerza de gravedad (flecha azul hacia el Sol) y la velocidad tangencial (flecha verde) están en equilibrio a 90°, manteniendo al planeta a unos {(semiMajorAxisAU * 149.6).toFixed(0)} millones de km del Sol.
              </span>
            )}
          </p>
        </div>
      </div>
      </ScrollReveal>

      {/* Guía Pedagógica Interactiva del Laboratorio Espacial 3D (Animada al Hacer Scroll) */}
      <ScrollReveal direction="up" delayMs={140}>
      <div className="fluid-auto-grid">
        <div className="p-4 rounded-xl bg-[#0D1322] border border-slate-800 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-purple-400 uppercase">
            <BookOpen className="w-4 h-4" />
            <span>1. Curvatura del Espacio-Tiempo</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            La rejilla luminosa inferior representa el tejido espacio-temporal de Einstein. Cada astro hunde la malla según su masa{' '}
            <span className="font-mono text-cyan-300">z(x,y) = -∑ G·Mᵢ / √(r² + ε²)</span>. Los planetas no son “jalados” a distancia: siguen geodésicas dentro de ese pozo gravitacional.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#0D1322] border border-slate-800 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-400 uppercase">
            <BookOpen className="w-4 h-4" />
            <span>2. Vectores Fuerza (Fg) y Velocidad (v)</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Observa las flechas 3D sobre cada planeta: la <strong className="text-sky-300">flecha azul (Fg)</strong> apunta siempre hacia el centro gravitacional, mientras la <strong className="text-emerald-300">flecha verde (v)</strong> es tangente a la trayectoria. En una órbita circular (1.00x v_c) son exactamente perpendiculares (90°).
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#0D1322] border border-slate-800 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-400 uppercase">
            <BookOpen className="w-4 h-4" />
            <span>3. Velocidad de Escape y Marcos Móviles</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Si aumentas el Factor de Velocidad por encima de <span className="font-mono text-amber-300">√2 ≈ 1.41x</span>, la energía cinética supera al pozo potencial (<span className="font-mono">E_tot &gt; 0</span>) y el cuerpo escapa en una hipérbola. Cambia a la <strong>Cámara Superficial</strong> para observar tránsitos astronómicos como un observador en Tierra.
          </p>
        </div>
      </div>
      </ScrollReveal>
    </div>
  );
};
