import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  FlaskConical,
  Flame,
  Gauge,
  RotateCcw,
  Sparkles,
  Award,
  CheckCircle2,
  AlertTriangle,
  Thermometer,
  Droplets,
  Zap,
} from 'lucide-react';
import { Language } from '../../assets/js/i18n';
import { audioSynth } from '../../assets/js/audio-synth';
import { TelemetryItem } from '../../assets/js/report-generator';
import { useLabGlobalStore } from '../../store/useLabGlobalStore';
import {
  REACTION_PRESETS,
  GAS_SPECIES_CATALOG,
  ReactionPresetId,
  GasSpeciesId,
  computeReactionStoichiometry,
  computeIdealGasMetrics,
  CHEMISTRY_CHALLENGES,
  validateChemistryChallenge,
} from './chemistry-engine';
import { TourGuiado, TourStep } from '../../components/TourGuiado';

const CHEMISTRY_TOUR_STEPS: TourStep[] = [
  {
    targetSelector: '[data-tour="chemistry-3d-stage"]',
    badgeEs: '1 · CÁMARA QUÍMICA 3D INTERACTIVA',
    badgeEn: '1 · INTERACTIVE 3D CHEMICAL CHAMBER',
    titleEs: 'Reactor de Borosilicato 3D y Cilindro Termodinámico PV=nRT',
    titleEn: '3D Borosilicate Reactor & PV=nRT Thermodynamic Cylinder',
    descriptionEs:
      'Inspecciona en 3D la disolución reactiva con indicador universal de Yamada, desprendimiento de burbujas, barra magnética agitadora, explosión exotérmica de fragmentos o colisiones moleculares de Maxwell-Boltzmann.',
    descriptionEn:
      'Inspect in 3D the reactive solution with Yamada universal indicator, gas bubble evolution, magnetic stirrer bar, exothermic shard explosion, or Maxwell-Boltzmann molecular collisions.',
    whatToDoEs: [
      'Alterna entre «Reactor Estequiométrico 3D» y «Cámara de Gases PV=nRT 3D» en la barra superior.',
      'Rota la cámara con clic izquierdo y acerca el zoom con la rueda del ratón.',
    ],
    parametersEs: [
      {
        name: 'Avance de Reacción (ξ) y Entalpía (ΔH°)',
        value: 'ξ = min(n_A/ν_A, n_B/ν_B)',
        detail: 'Determina el reactivo limitante, el calor liberado Q = ξ·|ΔH°| y el salto térmico ΔT.',
      },
    ],
    formulaEs: 'aA + bB → cC + dD  |  P·V = n·R·T',
  },
  {
    targetSelector: '[data-tour="chemistry-control-dock"]',
    badgeEs: '2 · DOSIFICACIÓN MOLAR Y GASES',
    badgeEn: '2 · MOLAR DOSING & GASES',
    titleEs: 'Ecuaciones Químicas Balanceadas, Reactivo Limitante y Presión',
    titleEn: 'Balanced Chemical Equations, Limiting Reactant & Pressure',
    descriptionEs:
      'Selecciona una de las 5 reacciones químicas reales o 5 especies gaseosas. Ajusta los moles (n_A, n_B), la temperatura (T), el volumen del pistón (V) o inyecta un catalizador para abatir la energía de activación E_a.',
    descriptionEn:
      'Select one of the 5 real chemical reactions or 5 gas species. Adjust moles (n_A, n_B), temperature (T), piston volume (V), or inject a catalyst to lower activation energy E_a.',
    whatToDoEs: [
      'Prueba «2Na + 2H₂O» o «Termita Fe₂O₃ + 2Al» y aumenta los moles para desencadenar una sobrecarga térmica explosiva.',
      'En modo Gases, comprime el pistón por debajo de 4 L o calienta para superar el límite estructural de 25 atm.',
    ],
    parametersEs: [
      {
        name: 'Indicador Universal pH y Presión Crítica',
        value: 'pH 0–14 | P_ruptura = 25 atm',
        detail: 'En HCl + NaOH, igualar n_A = n_B produce neutralización exacta (pH 7.00, color verde esmeralda).',
      },
    ],
    formulaEs: 'v_rms = √(3·R·T / M)  |  pH = -log₁₀[H⁺]',
  },
];

interface ChemistryLabViewProps {
  lang: Language;
  onUpdateTelemetry: (items: TelemetryItem[]) => void;
  completedChallenges: Record<string, boolean>;
  onCompleteChallenge: (id: string, points: number) => void;
}

export const ChemistryLabView: React.FC<ChemistryLabViewProps> = ({
  lang,
  onUpdateTelemetry,
  completedChallenges,
  onCompleteChallenge,
}) => {
  const chemistryLab = useLabGlobalStore((s) => s.chemistryLab);
  const setChemistryMode = useLabGlobalStore((s) => s.setChemistryMode);
  const setChemistryReactionPreset = useLabGlobalStore((s) => s.setChemistryReactionPreset);
  const setChemistryMoles = useLabGlobalStore((s) => s.setChemistryMoles);
  const setChemistryReactorTemp = useLabGlobalStore((s) => s.setChemistryReactorTemp);
  const setChemistryStirrerRpm = useLabGlobalStore((s) => s.setChemistryStirrerRpm);
  const setChemistryCatalystActive = useLabGlobalStore((s) => s.setChemistryCatalystActive);
  const triggerChemistryDetonation = useLabGlobalStore((s) => s.triggerChemistryDetonation);
  const resetChemistryReactor = useLabGlobalStore((s) => s.resetChemistryReactor);
  const setChemistryGasSpecies = useLabGlobalStore((s) => s.setChemistryGasSpecies);
  const setChemistryGasParams = useLabGlobalStore((s) => s.setChemistryGasParams);
  const triggerChemistryGasSpark = useLabGlobalStore((s) => s.triggerChemistryGasSpark);

  const [activeSubTab, setActiveSubTab] = useState<'sandbox' | 'challenges'>('sandbox');
  const [validationFeedback, setValidationFeedback] = useState<
    Record<string, { passed: boolean; feedbackEs: string }>
  >({});

  const activePreset = REACTION_PRESETS[chemistryLab.reactionPreset];
  const activeGasSpecies = GAS_SPECIES_CATALOG[chemistryLab.gasSpecies];

  // Cálculo estequiométrico y termoquímico puro
  const reactionResult = useMemo(
    () =>
      computeReactionStoichiometry({
        presetId: chemistryLab.reactionPreset,
        molesA: chemistryLab.molesA,
        molesB: chemistryLab.molesB,
        temperatureK: chemistryLab.reactorTempK,
        catalystActive: chemistryLab.catalystActive,
      }),
    [
      chemistryLab.reactionPreset,
      chemistryLab.molesA,
      chemistryLab.molesB,
      chemistryLab.reactorTempK,
      chemistryLab.catalystActive,
    ]
  );

  // Cálculo termodinámico de gases ideales y reales
  const gasResult = useMemo(
    () =>
      computeIdealGasMetrics({
        speciesId: chemistryLab.gasSpecies,
        molesN: chemistryLab.gasMoles,
        temperatureK: chemistryLab.gasTempK,
        volumeLiters: chemistryLab.gasVolumeLiters,
        sparkIgnited: chemistryLab.gasSparkIgnited,
      }),
    [
      chemistryLab.gasSpecies,
      chemistryLab.gasMoles,
      chemistryLab.gasTempK,
      chemistryLab.gasVolumeLiters,
      chemistryLab.gasSparkIgnited,
    ]
  );

  const isReactorExploded =
    reactionResult.isThermalRunawayExplosion || chemistryLab.manualDetonated;
  const isGasVesselRuptured = gasResult.isOverpressureExploded;

  // Efecto sonoro al detonar o romper contenedor
  const prevReactorExplodedRef = useRef(isReactorExploded);
  const prevGasRupturedRef = useRef(isGasVesselRuptured);

  useEffect(() => {
    if (isReactorExploded && !prevReactorExplodedRef.current) {
      audioSynth.playGlassShatterExplosion();
    }
    prevReactorExplodedRef.current = isReactorExploded;
  }, [isReactorExploded]);

  useEffect(() => {
    if (isGasVesselRuptured && !prevGasRupturedRef.current) {
      audioSynth.playGlassShatterExplosion();
    }
    prevGasRupturedRef.current = isGasVesselRuptured;
  }, [isGasVesselRuptured]);

  // Actualizar telemetría global para reportes PDF
  useEffect(() => {
    if (chemistryLab.mode === 'reactor') {
      onUpdateTelemetry([
        {
          label: 'Reacción Activa',
          value: activePreset.equationPlain,
          unit: '',
        },
        {
          label: 'Reactivo Limitante',
          value: reactionResult.limitingFormula,
          unit: '',
        },
        {
          label: 'Avance Molar (ξ)',
          value: reactionResult.extentOfReactionMoles.toFixed(3),
          unit: 'mol',
        },
        {
          label: 'Calor Liberado (Q)',
          value: reactionResult.heatReleasedKJ.toFixed(1),
          unit: 'kJ',
        },
        {
          label: 'Temperatura Final (T_f)',
          value: `${reactionResult.adiabaticTempFinalK.toFixed(1)} K (${(
            reactionResult.adiabaticTempFinalK - 273.15
          ).toFixed(1)} °C)`,
          unit: '',
        },
        {
          label: 'pH Disolución',
          value: `${reactionResult.resultingPH.toFixed(2)} (${reactionResult.phClassificationEs})`,
          unit: '',
        },
      ]);
    } else {
      onUpdateTelemetry([
        {
          label: 'Especie Gaseosa',
          value: `${activeGasSpecies.formula} (${activeGasSpecies.nameEs})`,
          unit: '',
        },
        {
          label: 'Presión Ideal (PV=nRT)',
          value: gasResult.idealPressureAtm.toFixed(2),
          unit: 'atm',
        },
        {
          label: 'Presión Van der Waals',
          value: gasResult.realVanDerWaalsPressureAtm.toFixed(2),
          unit: 'atm',
        },
        {
          label: 'Velocidad Cuadrática (v_rms)',
          value: gasResult.rmsSpeedMetersPerSec.toFixed(0),
          unit: 'm/s',
        },
        {
          label: 'Energía Cinética Media',
          value: (gasResult.averageKineticEnergyJoulesPerMol / 1000).toFixed(2),
          unit: 'kJ/mol',
        },
        {
          label: 'Estado del Cilindro',
          value: gasResult.isOverpressureExploded
            ? 'RUPTURA POR SOBREPRESIÓN'
            : 'ÍNTEGRO (< 25 atm)',
          unit: '',
        },
      ]);
    }
  }, [
    chemistryLab.mode,
    activePreset,
    activeGasSpecies,
    reactionResult,
    gasResult,
    onUpdateTelemetry,
  ]);

  // Ref con estado vivo para el loop 3D sin recrear el WebGLRenderer
  const liveSceneParamsRef = useRef({
    mode: chemistryLab.mode,
    reactionResult,
    gasResult,
    activeGasSpecies,
    isReactorExploded,
    isGasVesselRuptured,
    stirrerRpm: chemistryLab.stirrerRpm,
    catalystActive: chemistryLab.catalystActive,
    molesA: chemistryLab.molesA,
    molesB: chemistryLab.molesB,
    gasVolumeLiters: chemistryLab.gasVolumeLiters,
    gasMoles: chemistryLab.gasMoles,
  });

  const syncSceneImmediateRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    liveSceneParamsRef.current = {
      mode: chemistryLab.mode,
      reactionResult,
      gasResult,
      activeGasSpecies,
      isReactorExploded,
      isGasVesselRuptured,
      stirrerRpm: chemistryLab.stirrerRpm,
      catalystActive: chemistryLab.catalystActive,
      molesA: chemistryLab.molesA,
      molesB: chemistryLab.molesB,
      gasVolumeLiters: chemistryLab.gasVolumeLiters,
      gasMoles: chemistryLab.gasMoles,
    };
    syncSceneImmediateRef.current?.();
  }, [
    chemistryLab.mode,
    reactionResult,
    gasResult,
    activeGasSpecies,
    isReactorExploded,
    isGasVesselRuptured,
    chemistryLab.stirrerRpm,
    chemistryLab.catalystActive,
    chemistryLab.molesA,
    chemistryLab.molesB,
    chemistryLab.gasVolumeLiters,
    chemistryLab.gasMoles,
  ]);

  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  // Escena Three.js
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060a14);
    scene.fog = new THREE.FogExp2(0x060a14, 0.045);

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 100);
    camera.position.set(0, 3.3, 8.2);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });

    const gl = renderer.getContext();
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
    const isSoftwareGl = /SwiftShader|llvmpipe|Software|Mesa OffScreen/i.test(
      String(rendererStr)
    );

    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.target.set(0, 1.65, 0);
    controls.minDistance = 3.5;
    controls.maxDistance = 16;
    controls.maxPolarAngle = Math.PI * 0.49;

    // Iluminación con contraste cálido/frío
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.9);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.85);
    keyLight.position.set(5.5, 9.0, 6.0);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.bias = -0.0005;
    }
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0xa855f7, 2.2, 14);
    rimLight.position.set(-4.0, 3.8, -3.5);
    scene.add(rimLight);

    const thermalGlowLight = new THREE.PointLight(0xf97316, 0.5, 8);
    thermalGlowLight.position.set(0, 0.9, 0);
    scene.add(thermalGlowLight);

    // Piso de laboratorio y sombra de contacto
    const benchGeo = new THREE.CylinderGeometry(5.5, 5.8, 0.3, 48);
    const benchMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.78,
      metalness: 0.2,
    });
    const benchMesh = new THREE.Mesh(benchGeo, benchMat);
    benchMesh.position.y = -0.15;
    benchMesh.receiveShadow = !isSoftwareGl;
    scene.add(benchMesh);

    const gridHelper = new THREE.GridHelper(10, 20, 0x38bdf8, 0x1e293b);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    const contactShadowGeo = new THREE.CircleGeometry(2.3, 36);
    const contactShadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    const contactShadow = new THREE.Mesh(contactShadowGeo, contactShadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.015;
    scene.add(contactShadow);

    // =========================================================================
    // GRUPO 1: REACTOR ESTEQUIOMÉMSPICO DE BOROSILICATO 3D (Composite 10-part)
    // =========================================================================
    const reactorGroup = new THREE.Group();
    scene.add(reactorGroup);

    // 1. Placa calefactora y agitador magnético (base metálica)
    const hotplateBase = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.36, 2.8),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55, metalness: 0.65 })
    );
    hotplateBase.position.y = 0.18;
    reactorGroup.add(hotplateBase);

    const ceramicTop = new THREE.Mesh(
      new THREE.CylinderGeometry(1.18, 1.22, 0.08, 36),
      new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.35, metalness: 0.3 })
    );
    ceramicTop.position.y = 0.4;
    reactorGroup.add(ceramicTop);

    const heaterCoilMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 0.4,
      roughness: 0.4,
    });
    const heaterCoil = new THREE.Mesh(
      new THREE.TorusGeometry(0.78, 0.045, 16, 48),
      heaterCoilMat
    );
    heaterCoil.rotation.x = Math.PI / 2;
    heaterCoil.position.y = 0.445;
    reactorGroup.add(heaterCoil);

    // Subgrupo intacto del matraz de borosilicato
    const intactVesselGroup = new THREE.Group();
    reactorGroup.add(intactVesselGroup);

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.28,
      roughness: 0.1,
      metalness: 0.05,
      reflectivity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const flaskLower = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.15, 0.65, 36, 1, true),
      glassMat
    );
    flaskLower.position.y = 0.78;
    intactVesselGroup.add(flaskLower);

    const flaskCone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 1.15, 1.65, 36, 1, true),
      glassMat
    );
    flaskCone.position.y = 1.93;
    intactVesselGroup.add(flaskCone);

    const flaskNeck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.52, 0.7, 36, 1, true),
      glassMat
    );
    flaskNeck.position.y = 3.1;
    intactVesselGroup.add(flaskNeck);

    const flaskRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.54, 0.055, 16, 36),
      new THREE.MeshStandardMaterial({ color: 0xbae6fd, roughness: 0.2, metalness: 0.1 })
    );
    flaskRim.rotation.x = Math.PI / 2;
    flaskRim.position.y = 3.45;
    intactVesselGroup.add(flaskRim);

    for (let i = 0; i < 3; i++) {
      const ringRadius = 1.08 - i * 0.16;
      const gradRing = new THREE.Mesh(
        new THREE.TorusGeometry(ringRadius, 0.012, 8, 36),
        new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.55 })
      );
      gradRing.rotation.x = Math.PI / 2;
      gradRing.position.y = 0.95 + i * 0.45;
      intactVesselGroup.add(gradRing);
    }

    const liquidMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.25,
      roughness: 0.2,
      metalness: 0.1,
      transparent: true,
      opacity: 0.86,
    });
    const liquidMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.86, 1.11, 1.2, 32),
      liquidMat
    );
    liquidMesh.position.y = 1.06;
    intactVesselGroup.add(liquidMesh);

    const stirBarMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.065, 0.36, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.1 })
    );
    stirBarMesh.rotation.z = Math.PI / 2;
    stirBarMesh.position.y = 0.54;
    intactVesselGroup.add(stirBarMesh);

    const catalystInjector = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.03, 0.85, 16),
      new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0x9333ea,
        emissiveIntensity: 0.5,
        roughness: 0.3,
        metalness: 0.5,
      })
    );
    catalystInjector.position.set(0.18, 3.65, 0);
    intactVesselGroup.add(catalystInjector);

    const bubbleCount = 32;
    const bubbleGeo = new THREE.SphereGeometry(0.055, 10, 10);
    const bubbleMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.78,
      roughness: 0.15,
    });
    const bubblesGroup = new THREE.Group();
    intactVesselGroup.add(bubblesGroup);

    const bubbleData: { mesh: THREE.Mesh; speed: number; angle: number; radius: number; y: number }[] = [];
    for (let i = 0; i < bubbleCount; i++) {
      const m = new THREE.Mesh(bubbleGeo, bubbleMat);
      const angle = (i / bubbleCount) * Math.PI * 2 + Math.random() * 0.5;
      const radius = 0.12 + Math.random() * 0.65;
      const y = 0.55 + Math.random() * 1.6;
      m.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      const s = 0.6 + Math.random() * 0.9;
      m.scale.setScalar(s);
      bubblesGroup.add(m);
      bubbleData.push({
        mesh: m,
        speed: 0.6 + Math.random() * 1.4,
        angle,
        radius,
        y,
      });
    }

    // Pool de fragmentos de vidrio y chispas exotérmicas para explosión 3D
    const shardCount = 44;
    const explosionGroup = new THREE.Group();
    explosionGroup.visible = false;
    reactorGroup.add(explosionGroup);

    const fireballCoreMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.85,
    });
    const fireballCore = new THREE.Mesh(new THREE.SphereGeometry(0.95, 20, 20), fireballCoreMat);
    fireballCore.position.y = 1.5;
    explosionGroup.add(fireballCore);

    const shardGeo = new THREE.OctahedronGeometry(0.11, 0);
    const shardGlassMat = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
      roughness: 0.15,
      metalness: 0.4,
    });
    const shardFireMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xf97316,
      emissiveIntensity: 0.9,
      roughness: 0.3,
    });

    const shards: {
      mesh: THREE.Mesh;
      pos: THREE.Vector3;
      vel: THREE.Vector3;
      rotVel: THREE.Vector3;
      origin: THREE.Vector3;
      initVel: THREE.Vector3;
    }[] = [];

    for (let i = 0; i < shardCount; i++) {
      const isEmber = i % 2 === 0;
      const m = new THREE.Mesh(shardGeo, isEmber ? shardFireMat : shardGlassMat);
      const theta = Math.random() * Math.PI * 2;
      const phi = 0.2 + Math.random() * 1.1;
      const speed = 2.2 + Math.random() * 4.5;
      const origin = new THREE.Vector3(
        Math.cos(theta) * 0.4,
        1.1 + Math.random() * 1.1,
        Math.sin(theta) * 0.4
      );
      const initVel = new THREE.Vector3(
        Math.cos(theta) * Math.sin(phi) * speed,
        Math.cos(phi) * speed + 1.8,
        Math.sin(theta) * Math.sin(phi) * speed
      );
      m.position.copy(origin);
      explosionGroup.add(m);
      shards.push({
        mesh: m,
        pos: origin.clone(),
        vel: initVel.clone(),
        rotVel: new THREE.Vector3(
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8
        ),
        origin,
        initVel,
      });
    }

    // =========================================================================
    // GRUPO 2: CÁMARA DE GASES IDEALES PV=nRT 3D (Composite 10-part)
    // =========================================================================
    const gasChamberGroup = new THREE.Group();
    gasChamberGroup.visible = false;
    scene.add(gasChamberGroup);

    const chamberBase = new THREE.Mesh(
      new THREE.CylinderGeometry(1.65, 1.8, 0.42, 36),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.7 })
    );
    chamberBase.position.y = 0.21;
    gasChamberGroup.add(chamberBase);

    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 3.5, 16),
        new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.35, metalness: 0.8 })
      );
      pillar.position.set(Math.cos(angle) * 1.48, 1.95, Math.sin(angle) * 1.48);
      gasChamberGroup.add(pillar);
    }

    const cylinderWallMat = new THREE.MeshPhysicalMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.24,
      roughness: 0.12,
      metalness: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const cylinderWall = new THREE.Mesh(
      new THREE.CylinderGeometry(1.32, 1.32, 3.2, 36, 1, true),
      cylinderWallMat
    );
    cylinderWall.position.y = 2.02;
    gasChamberGroup.add(cylinderWall);

    const pistonAssembly = new THREE.Group();
    gasChamberGroup.add(pistonAssembly);

    const pistonHeadMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.3,
      metalness: 0.75,
    });
    const pistonHead = new THREE.Mesh(
      new THREE.CylinderGeometry(1.29, 1.29, 0.24, 36),
      pistonHeadMat
    );
    pistonAssembly.add(pistonHead);

    const pistonSeal = new THREE.Mesh(
      new THREE.TorusGeometry(1.29, 0.04, 12, 36),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85 })
    );
    pistonSeal.rotation.x = Math.PI / 2;
    pistonAssembly.add(pistonSeal);

    const pistonRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 1.8, 20),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.25, metalness: 0.85 })
    );
    pistonRod.position.y = 1.0;
    pistonAssembly.add(pistonRod);

    const sparkPlug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.45, 16),
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xeab308,
        emissiveIntensity: 0.4,
      })
    );
    sparkPlug.rotation.z = Math.PI / 2;
    sparkPlug.position.set(1.38, 0.85, 0);
    gasChamberGroup.add(sparkPlug);

    const maxGasParticles = 56;
    const gasParticleGeo = new THREE.SphereGeometry(0.085, 12, 12);
    const gasParticleMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.4,
      roughness: 0.25,
      metalness: 0.2,
    });

    const gasParticlesGroup = new THREE.Group();
    gasChamberGroup.add(gasParticlesGroup);

    const gasParticles: {
      mesh: THREE.Mesh;
      pos: THREE.Vector3;
      dir: THREE.Vector3;
    }[] = [];

    for (let i = 0; i < maxGasParticles; i++) {
      const m = new THREE.Mesh(gasParticleGeo, gasParticleMat);
      const r = Math.random() * 1.05;
      const theta = Math.random() * Math.PI * 2;
      const y = 0.55 + Math.random() * 1.4;
      const pos = new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r);
      const dir = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize();
      m.position.copy(pos);
      gasParticlesGroup.add(m);
      gasParticles.push({ mesh: m, pos, dir });
    }

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let rafId = 0;
    let timeoutId = 0;
    let disposed = false;
    let lastTime = performance.now();
    let explosionElapsed = 0;
    let wasExplodedLastFrame = false;

    const afterDraw = (cb: () => void) => {
      const g = renderer.getContext();
      if (typeof (g as WebGL2RenderingContext).fenceSync === 'function') {
        const gl2 = g as WebGL2RenderingContext;
        const sync = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl2.flush();
        const poll = () => {
          if (disposed) return;
          const status = gl2.clientWaitSync(sync!, 0, 0);
          if (status === gl2.TIMEOUT_EXPIRED) {
            timeoutId = window.setTimeout(poll, 16);
            return;
          }
          gl2.deleteSync(sync);
          timeoutId = window.setTimeout(() => {
            if (!disposed) rafId = requestAnimationFrame(cb);
          }, 0);
        };
        timeoutId = window.setTimeout(poll, 16);
      } else {
        g.finish();
        timeoutId = window.setTimeout(() => {
          if (!disposed) rafId = requestAnimationFrame(cb);
        }, 0);
      }
    };

    const stepAndRenderScene = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const state = liveSceneParamsRef.current;

      if (state.mode === 'reactor') {
        reactorGroup.visible = true;
        gasChamberGroup.visible = false;

        liquidMat.color.set(state.reactionResult.phIndicatorColorHex);
        liquidMat.emissive.set(state.reactionResult.phIndicatorColorHex);

        const totalMoles = state.molesA + state.molesB;
        const fillFactor = Math.min(Math.max(totalMoles / 6.0, 0.25), 1.25);
        liquidMesh.scale.y = fillFactor;
        liquidMesh.position.y = 0.46 + 0.6 * fillFactor;

        const tempFactor = Math.min(
          Math.max((state.reactionResult.adiabaticTempFinalK - 298) / 800, 0.1),
          1.8
        );
        heaterCoilMat.emissiveIntensity = 0.25 + tempFactor * 1.2;
        thermalGlowLight.intensity = 0.4 + tempFactor * 2.2;

        const radPerSec = (state.stirrerRpm / 60) * Math.PI * 2;
        stirBarMesh.rotation.y += radPerSec * dt * 0.35;

        catalystInjector.visible = state.catalystActive;

        const hasGas = state.reactionResult.totalGasMolesFormed > 0.01 && !state.isReactorExploded;
        bubblesGroup.visible = hasGas;
        if (hasGas) {
          const maxLiquidY = 0.46 + 1.15 * fillFactor;
          const speedBoost = 1 + Math.min(state.reactionResult.totalGasMolesFormed, 3) * 0.6;
          for (let i = 0; i < bubbleData.length; i++) {
            const b = bubbleData[i];
            b.y += b.speed * speedBoost * dt;
            if (b.y > maxLiquidY) {
              b.y = 0.52;
            }
            b.mesh.position.y = b.y;
            b.mesh.position.x = Math.cos(b.angle + now * 0.002) * b.radius * 0.75;
            b.mesh.position.z = Math.sin(b.angle + now * 0.002) * b.radius * 0.75;
          }
        }

        if (state.isReactorExploded) {
          if (!wasExplodedLastFrame) {
            explosionElapsed = 0;
            for (let i = 0; i < shards.length; i++) {
              shards[i].pos.copy(shards[i].origin);
              shards[i].vel.copy(shards[i].initVel);
            }
          }
          wasExplodedLastFrame = true;
          explosionElapsed += dt;

          intactVesselGroup.visible = false;
          explosionGroup.visible = true;

          const pulse = 1 + Math.sin(now * 0.015) * 0.18;
          fireballCore.scale.setScalar(Math.min(1.6, 0.5 + explosionElapsed * 1.4) * pulse);
          fireballCoreMat.opacity = Math.max(0.18, 0.88 - explosionElapsed * 0.22);

          for (let i = 0; i < shards.length; i++) {
            const s = shards[i];
            s.vel.y -= 6.8 * dt;
            s.pos.addScaledVector(s.vel, dt);
            if (s.pos.y < 0.12) {
              s.pos.y = 0.12;
              s.vel.y = Math.abs(s.vel.y) * 0.42;
              s.vel.x *= 0.78;
              s.vel.z *= 0.78;
            }
            s.mesh.position.copy(s.pos);
            s.mesh.rotation.x += s.rotVel.x * dt;
            s.mesh.rotation.y += s.rotVel.y * dt;
          }
        } else {
          wasExplodedLastFrame = false;
          intactVesselGroup.visible = true;
          explosionGroup.visible = false;
        }
      } else {
        reactorGroup.visible = false;
        gasChamberGroup.visible = true;

        const species = state.activeGasSpecies;
        gasParticleMat.color.set(species.primaryColorHex);
        gasParticleMat.emissive.set(species.secondaryColorHex);

        const volNorm = Math.min(Math.max((state.gasVolumeLiters - 1.5) / 28.5, 0), 1);
        const ceilingY = state.isGasVesselRuptured ? 3.85 : 0.78 + volNorm * 2.55;
        pistonAssembly.position.y = ceilingY;

        pistonHeadMat.color.set(
          state.isGasVesselRuptured
            ? 0xef4444
            : state.gasResult.idealPressureAtm > 18
            ? 0xf59e0b
            : 0x38bdf8
        );
        cylinderWall.visible = !state.isGasVesselRuptured;

        const simSpeed = Math.min(
          Math.max(state.gasResult.rmsSpeedMetersPerSec / 240, 0.9),
          8.5
        );
        const activeCount = Math.min(
          maxGasParticles,
          Math.max(8, Math.round(state.gasMoles * 11))
        );
        const maxRadius = state.isGasVesselRuptured ? 3.6 : 1.18;

        for (let i = 0; i < maxGasParticles; i++) {
          const p = gasParticles[i];
          p.mesh.visible = i < activeCount;
          if (!p.mesh.visible) continue;

          p.mesh.scale.setScalar(species.particleRadiusScale);
          p.pos.addScaledVector(p.dir, simSpeed * dt);

          const minY = 0.52;
          const maxY = Math.max(0.68, ceilingY - 0.16);
          if (p.pos.y < minY) {
            p.pos.y = minY;
            p.dir.y = Math.abs(p.dir.y);
          } else if (p.pos.y > maxY) {
            p.pos.y = maxY;
            p.dir.y = -Math.abs(p.dir.y);
          }

          const radialSq = p.pos.x * p.pos.x + p.pos.z * p.pos.z;
          if (radialSq > maxRadius * maxRadius) {
            const radial = Math.sqrt(radialSq);
            const nx = p.pos.x / radial;
            const nz = p.pos.z / radial;
            p.pos.x = nx * (maxRadius - 0.02);
            p.pos.z = nz * (maxRadius - 0.02);
            const dot = p.dir.x * nx + p.dir.z * nz;
            p.dir.x -= 2 * dot * nx;
            p.dir.z -= 2 * dot * nz;
          }

          p.mesh.position.copy(p.pos);
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };

    const tick = () => {
      if (disposed) return;
      stepAndRenderScene();

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    syncSceneImmediateRef.current = stepAndRenderScene;
    rafId = requestAnimationFrame(tick);

    const handleResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 500;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      syncSceneImmediateRef.current = null;
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
    };
  }, []);

  const handleVerifyChallenge = (challengeId: string, points: number) => {
    const validation = validateChemistryChallenge(
      challengeId,
      chemistryLab.mode,
      reactionResult,
      gasResult
    );

    setValidationFeedback((prev) => ({
      ...prev,
      [challengeId]: validation,
    }));

    if (validation.passed) {
      audioSynth.playSuccessChime();
      onCompleteChallenge(challengeId, points);
    }
  };

  const applySuggestedChallengeSetup = (challengeId: string) => {
    if (challengeId === 'chem-neutralization-ph7') {
      setChemistryMode('reactor');
      setChemistryReactionPreset('acid-base-neutralization');
      setChemistryMoles({ molesA: 1.8, molesB: 1.8 });
    } else if (challengeId === 'chem-gas-compression-18atm') {
      setChemistryMode('gases');
      setChemistryGasSpecies('N2');
      setChemistryGasParams({
        gasMoles: 2.2,
        gasTempK: 920,
        gasVolumeLiters: 9.0,
      });
    } else if (challengeId === 'chem-exothermic-detonation') {
      setChemistryMode('reactor');
      setChemistryReactionPreset('thermite-aluminothermic');
      setChemistryMoles({ molesA: 1.5, molesB: 3.0 });
      setChemistryCatalystActive(true);
    }
  };

  const nuA = activePreset.reactantA.coefficient;
  const nuB = activePreset.reactantB.coefficient;
  const molesAReacted = reactionResult.extentOfReactionMoles * nuA;
  const molesBReacted = reactionResult.extentOfReactionMoles * nuB;
  const molesARemaining = Math.max(0, chemistryLab.molesA - molesAReacted);
  const molesBRemaining = Math.max(0, chemistryLab.molesB - molesBReacted);

  return (
    <div className="space-y-5" data-testid="chemistry-lab-root">
      <TourGuiado
        labId="chemistry"
        steps={CHEMISTRY_TOUR_STEPS}
        lang={lang}
      />

      {/* Cabecera del Módulo 05 */}
      <header className="rounded-xl workbench-panel p-4 sm:p-5 border border-purple-500/30 bg-gradient-to-r from-[#0B1020] via-[#101327] to-[#0A0F1D]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className="px-2 py-0.5 rounded bg-purple-950/80 border border-purple-500/40 text-purple-300 font-bold">
                MOD-05 · QUÍMICA COMPUTACIONAL 3D
              </span>
              <span className="text-cyan-300">
                Estequiometría · Termoquímica ΔH° · Gases Ideales PV=nRT
              </span>
            </div>
            <h1 className="fluid-title-lg font-bold text-white tracking-tight flex items-center gap-2.5">
              <FlaskConical className="w-6 h-6 text-purple-400 shrink-0" />
              <span>
                {lang === 'es'
                  ? 'Laboratorio de Reacciones Químicas, Reactivo Limitante y Dinámica Molecular 3D'
                  : '3D Chemical Reactions, Limiting Reactant & Molecular Dynamics Lab'}
              </span>
            </h1>
          </div>

          {/* Selector de Modo Principal y Subpestañas */}
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Modo del banco químico 3D"
              className="flex items-center p-1 rounded-xl bg-[#070A12] border border-slate-800 text-xs font-mono"
            >
              <button
                type="button"
                data-testid="chemistry-mode-reactor-btn"
                onClick={() => setChemistryMode('reactor')}
                className={`min-h-[2.25rem] px-3 py-1.5 rounded-lg flex items-center gap-1.5 instrument-transition cursor-pointer ${
                  chemistryLab.mode === 'reactor'
                    ? 'bg-purple-500 text-slate-950 font-bold shadow-md shadow-purple-500/25'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <FlaskConical className="w-3.5 h-3.5" />
                <span>{lang === 'es' ? 'Reactor 3D (ΔH° / pH)' : '3D Reactor (ΔH° / pH)'}</span>
              </button>
              <button
                type="button"
                data-testid="chemistry-mode-gases-btn"
                onClick={() => setChemistryMode('gases')}
                className={`min-h-[2.25rem] px-3 py-1.5 rounded-lg flex items-center gap-1.5 instrument-transition cursor-pointer ${
                  chemistryLab.mode === 'gases'
                    ? 'bg-cyan-400 text-slate-950 font-bold shadow-md shadow-cyan-500/25'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>{lang === 'es' ? 'Gases Ideales PV=nRT' : 'Ideal Gases PV=nRT'}</span>
              </button>
            </div>

            <div className="flex items-center p-1 rounded-xl bg-[#070A12] border border-slate-800 text-xs font-mono">
              <button
                type="button"
                data-testid="chemistry-tab-sandbox"
                onClick={() => setActiveSubTab('sandbox')}
                className={`min-h-[2.25rem] px-3 py-1.5 rounded-lg cursor-pointer ${
                  activeSubTab === 'sandbox'
                    ? 'bg-slate-800 text-cyan-300 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lang === 'es' ? 'Banco Experimental' : 'Experimental Bench'}
              </button>
              <button
                type="button"
                data-testid="chemistry-tab-challenges"
                onClick={() => setActiveSubTab('challenges')}
                className={`min-h-[2.25rem] px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer ${
                  activeSubTab === 'challenges'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>{lang === 'es' ? 'Retos (3)' : 'Challenges (3)'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Banner de Ecuación Química Balanceada o Ecuación de Estado */}
      <section
        aria-label="Ecuación Fisicoquímica Activa"
        className="rounded-xl bg-[#070B14] border border-slate-800 px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3"
      >
        {chemistryLab.mode === 'reactor' ? (
          <>
            <div className="space-y-0.5">
              <div className="text-[11px] font-mono text-purple-300 uppercase tracking-wider">
                {lang === 'es'
                  ? `${activePreset.code} · Ecuación Estequiométrica Balanceada`
                  : `${activePreset.code} · Balanced Stoichiometric Equation`}
              </div>
              <div
                data-testid="balanced-equation-display"
                className="font-mono text-sm sm:text-base font-bold text-white"
              >
                {activePreset.equationPlain}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700 text-amber-300">
                ΔH° = {activePreset.enthalpyKJPerMol} kJ/mol
              </span>
              <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700 text-cyan-300">
                E_a,ef = {reactionResult.EffectiveActivationEnergyKJ.toFixed(1)} kJ/mol
              </span>
              <span
                data-testid="limiting-reactant-badge"
                className={`px-2.5 py-1 rounded-md font-bold border ${
                  reactionResult.limitingReactant === 'estequiometrico'
                    ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                    : 'bg-purple-950/80 border-purple-500/50 text-purple-200'
                }`}
              >
                {reactionResult.limitingReactant === 'estequiometrico'
                  ? 'Proporción Estequiométrica Exacta'
                  : `Limitante: ${reactionResult.limitingFormula}`}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-0.5">
              <div className="text-[11px] font-mono text-cyan-300 uppercase tracking-wider">
                {lang === 'es'
                  ? 'Ecuación de Estado Ideal y Corrección de Van der Waals'
                  : 'Ideal Equation of State & Van der Waals Correction'}
              </div>
              <div className="font-mono text-sm sm:text-base font-bold text-white">
                P·V = n·R·T &nbsp;|&nbsp; [P + a(n/V)²]·(V - nb) = n·R·T
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700 text-cyan-300">
                Especie: {activeGasSpecies.formula} ({activeGasSpecies.molarMassGPerMol} g/mol)
              </span>
              <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700 text-amber-300">
                v_rms = {gasResult.rmsSpeedMetersPerSec.toFixed(0)} m/s
              </span>
              <span
                className={`px-2.5 py-1 rounded-md font-bold border ${
                  isGasVesselRuptured
                    ? 'bg-red-950/80 border-red-500 text-red-300'
                    : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                }`}
              >
                P = {gasResult.idealPressureAtm.toFixed(2)} atm
              </span>
            </div>
          </>
        )}
      </section>

      {/* Layout Principal: Escenario 3D + Controles e Instrumentación */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Columna Izquierda (7 cols): Escenario Three.js + HUD y Tablas */}
        <div className="xl:col-span-7 space-y-4">
          <div
            data-tour="chemistry-3d-stage"
            className="relative rounded-2xl overflow-hidden border border-slate-800 bg-[#060A14] shadow-2xl"
          >
            {/* Contenedor dedicado para el canvas WebGL */}
            <div
              ref={canvasMountRef}
              data-testid="chemistry-3d-canvas"
              className="w-full h-[390px] sm:h-[450px]"
            />

            {/* Overlay HUD Superior (sin backdrop-filter) */}
            <div className="absolute top-3 left-3 right-3 flex flex-wrap items-start justify-between gap-2 pointer-events-none">
              <div className="bg-[#070B14]/95 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono space-y-1">
                {chemistryLab.mode === 'reactor' ? (
                  <>
                    <div className="flex items-center gap-2 text-purple-300 font-bold">
                      <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                      <span>
                        T_final: {reactionResult.adiabaticTempFinalK.toFixed(1)} K (
                        {(reactionResult.adiabaticTempFinalK - 273.15).toFixed(1)} °C)
                      </span>
                    </div>
                    <div className="text-slate-300">
                      Calor Q ={' '}
                      <span className="text-amber-300 font-bold">
                        {reactionResult.heatReleasedKJ.toFixed(1)} kJ
                      </span>{' '}
                      · Gas: {reactionResult.totalGasMolesFormed.toFixed(2)} mol
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-cyan-300 font-bold">
                      <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                      <span>
                        P_ideal: {gasResult.idealPressureAtm.toFixed(2)} atm (
                        {gasResult.idealPressureKPa.toFixed(0)} kPa)
                      </span>
                    </div>
                    <div className="text-slate-300">
                      P_real (VdW):{' '}
                      <span className="text-purple-300 font-bold">
                        {gasResult.realVanDerWaalsPressureAtm.toFixed(2)} atm
                      </span>{' '}
                      · Límite: {gasResult.maxSafePressureAtm} atm
                    </div>
                  </>
                )}
              </div>

              {/* Alerta de Explosión o Estado */}
              {(chemistryLab.mode === 'reactor' ? isReactorExploded : isGasVesselRuptured) && (
                <div
                  data-testid="chemistry-explosion-banner"
                  className="pointer-events-auto bg-red-950/95 border border-red-500 rounded-xl px-3.5 py-2 text-xs font-mono text-red-200 flex items-center gap-2.5 shadow-lg"
                >
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 animate-bounce" />
                  <div>
                    <div className="font-bold text-red-300">
                      {chemistryLab.mode === 'reactor'
                        ? '¡DETONACIÓN TERMOQUÍMICA 3D!'
                        : '¡RUPTURA DEL CILINDRO POR SOBREPRESIÓN (>25 atm)!'}
                    </div>
                    <div className="text-[11px] text-red-200/90">
                      {chemistryLab.mode === 'reactor'
                        ? reactionResult.explosionReasonEs ||
                          'Fractura explosiva del matraz de borosilicato.'
                        : gasResult.explosionReasonEs ||
                          'La presión interna excedió el límite estructural de 25 atm.'}
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="rebuild-vessel-btn"
                    onClick={() => {
                      if (chemistryLab.mode === 'reactor') {
                        resetChemistryReactor();
                      } else {
                        setChemistryGasSpecies(chemistryLab.gasSpecies);
                        setChemistryGasParams({
                          gasMoles: 1.5,
                          gasTempK: 300,
                          gasVolumeLiters: 12.0,
                        });
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 text-slate-950 font-bold cursor-pointer shrink-0"
                  >
                    Reconstruir 3D
                  </button>
                </div>
              )}
            </div>

            {/* Barra Inferior de Indicador Universal de pH Yamada o Velocidades de Maxwell-Boltzmann */}
            <div className="bg-[#080C17] border-t border-slate-800 px-4 py-3">
              {chemistryLab.mode === 'reactor' ? (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Escala de pH Indicador Universal Yamada:</span>
                      <strong data-testid="reactor-ph-value" className="text-white">
                        pH {reactionResult.resultingPH.toFixed(2)}
                      </strong>
                    </span>
                    <span className="text-cyan-300 font-semibold">
                      {reactionResult.phClassificationEs}
                    </span>
                  </div>
                  <div className="relative h-3 w-full rounded-full overflow-hidden bg-gradient-to-r from-red-600 via-emerald-500 to-purple-700 border border-slate-700">
                    <div
                      className="absolute top-0 bottom-0 w-2 bg-white border border-slate-950 rounded-full shadow"
                      style={{
                        left: `calc(${Math.min(
                          Math.max((reactionResult.resultingPH / 14) * 100, 1),
                          99
                        )}% - 4px)`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span>0 · Ácido Fuerte (HCl)</span>
                    <span className="text-emerald-400 font-semibold">
                      7.0 · Neutro (H₂O + NaCl)
                    </span>
                    <span>14 · Base Fuerte (NaOH)</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                  <div className="bg-[#0B101D] border border-slate-800 rounded-lg p-2">
                    <div className="text-[10px] text-slate-400">Vel. Más Probable (v_mp)</div>
                    <div className="text-cyan-300 font-bold">
                      {gasResult.mostProbableSpeedMetersPerSec.toFixed(0)} m/s
                    </div>
                  </div>
                  <div className="bg-[#0B101D] border border-slate-800 rounded-lg p-2">
                    <div className="text-[10px] text-slate-400">Vel. Media (v_mean)</div>
                    <div className="text-emerald-300 font-bold">
                      {gasResult.meanSpeedMetersPerSec.toFixed(0)} m/s
                    </div>
                  </div>
                  <div className="bg-[#0B101D] border border-slate-800 rounded-lg p-2">
                    <div className="text-[10px] text-slate-400">Vel. Cuadrática (v_rms)</div>
                    <div className="text-amber-300 font-bold">
                      {gasResult.rmsSpeedMetersPerSec.toFixed(0)} m/s
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tabla de Balance Estequiométrico Molar y Másico o Curva de Maxwell-Boltzmann */}
          {chemistryLab.mode === 'reactor' ? (
            <div className="rounded-xl workbench-panel p-4 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider">
                  Balance Estequiométrico de Masa y Moles (Ley de Lavoisier)
                </h2>
                <span className="text-[11px] font-mono text-slate-400">
                  Avance ξ = {reactionResult.extentOfReactionMoles.toFixed(3)} mol
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 pr-3">Especie</th>
                      <th className="py-2 px-2">Inicial (mol)</th>
                      <th className="py-2 px-2">Cambio (Δn)</th>
                      <th className="py-2 px-2">Final (mol)</th>
                      <th className="py-2 pl-2">Masa Final (g)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    <tr>
                      <td className="py-2 pr-3 font-bold text-white">
                        {activePreset.reactantA.coefficient}{' '}
                        {activePreset.reactantA.displayFormula}{' '}
                        <span className="text-[10px] text-slate-400">
                          ({activePreset.reactantA.nameEs})
                        </span>
                      </td>
                      <td className="py-2 px-2 text-slate-300">{chemistryLab.molesA.toFixed(2)}</td>
                      <td className="py-2 px-2 text-rose-400">-{molesAReacted.toFixed(2)}</td>
                      <td className="py-2 px-2 font-bold text-cyan-300">
                        {molesARemaining.toFixed(2)}
                      </td>
                      <td className="py-2 pl-2 text-slate-300">
                        {(molesARemaining * activePreset.reactantA.molarMassGPerMol).toFixed(1)} g
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-3 font-bold text-white">
                        {activePreset.reactantB.coefficient}{' '}
                        {activePreset.reactantB.displayFormula}{' '}
                        <span className="text-[10px] text-slate-400">
                          ({activePreset.reactantB.nameEs})
                        </span>
                      </td>
                      <td className="py-2 px-2 text-slate-300">{chemistryLab.molesB.toFixed(2)}</td>
                      <td className="py-2 px-2 text-rose-400">-{molesBReacted.toFixed(2)}</td>
                      <td className="py-2 px-2 font-bold text-cyan-300">
                        {molesBRemaining.toFixed(2)}
                      </td>
                      <td className="py-2 pl-2 text-slate-300">
                        {(molesBRemaining * activePreset.reactantB.molarMassGPerMol).toFixed(1)} g
                      </td>
                    </tr>
                    {reactionResult.productsFormed.map((prod) => (
                      <tr key={prod.formula} className="bg-slate-900/40">
                        <td className="py-2 pr-3 font-bold text-emerald-300">
                          → {prod.displayFormula}{' '}
                          <span className="text-[10px] text-slate-400">({prod.nameEs})</span>
                        </td>
                        <td className="py-2 px-2 text-slate-500">0.00</td>
                        <td className="py-2 px-2 text-emerald-400">
                          +{prod.molesFormed.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 font-bold text-emerald-300">
                          {prod.molesFormed.toFixed(2)}
                        </td>
                        <td className="py-2 pl-2 text-emerald-200">{prod.massGrams.toFixed(1)} g</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-xl workbench-panel p-4 border border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider">
                  Distribución Estadística de Velocidades de Maxwell-Boltzmann f(v)
                </h2>
                <span className="text-[11px] font-mono text-slate-400">
                  K_media = {(gasResult.averageKineticEnergyJoulesPerMol / 1000).toFixed(2)} kJ/mol
                </span>
              </div>

              <svg
                viewBox="0 0 500 130"
                className="w-full h-32 bg-[#060912] rounded-lg border border-slate-800 p-2"
              >
                <line x1="35" y1="108" x2="480" y2="108" stroke="#334155" strokeWidth="1.5" />
                <line x1="35" y1="15" x2="35" y2="108" stroke="#334155" strokeWidth="1.5" />
                {(() => {
                  const maxF = Math.max(
                    ...gasResult.maxwellBoltzmannCurve.map((p) => p.probabilityDensity),
                    1e-6
                  );
                  const maxV =
                    gasResult.maxwellBoltzmannCurve[gasResult.maxwellBoltzmannCurve.length - 1]
                      ?.speedMs || 2600;
                  const pts = gasResult.maxwellBoltzmannCurve
                    .map((pt) => {
                      const x = 35 + (pt.speedMs / maxV) * 435;
                      const y = 106 - (pt.probabilityDensity / maxF) * 84;
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    })
                    .join(' ');
                  const vRmsX = 35 + Math.min(gasResult.rmsSpeedMetersPerSec / maxV, 0.98) * 435;
                  return (
                    <>
                      <polyline
                        fill="none"
                        stroke={activeGasSpecies.primaryColorHex}
                        strokeWidth="2.5"
                        points={pts}
                      />
                      <line
                        x1={vRmsX}
                        y1="18"
                        x2={vRmsX}
                        y2="108"
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                      />
                      <text
                        x={Math.min(vRmsX + 6, 385)}
                        y="28"
                        fill="#fde047"
                        fontSize="10"
                        fontFamily="monospace"
                      >
                        v_rms = {gasResult.rmsSpeedMetersPerSec.toFixed(0)} m/s
                      </text>
                    </>
                  );
                })()}
              </svg>
            </div>
          )}
        </div>

        {/* Columna Derecha (5 cols): Panel de Control o Retos Experimentales */}
        <div
          data-tour="chemistry-control-dock"
          className="xl:col-span-5 rounded-2xl workbench-panel p-4 sm:p-5 border border-slate-800 space-y-4"
        >
          {activeSubTab === 'sandbox' ? (
            chemistryLab.mode === 'reactor' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-mono font-bold text-purple-300 uppercase mb-2">
                    1. Catálogo de Reacciones Químicas Balanceadas
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {(Object.keys(REACTION_PRESETS) as ReactionPresetId[]).map((presetId) => {
                      const rx = REACTION_PRESETS[presetId];
                      const active = chemistryLab.reactionPreset === presetId;
                      return (
                        <button
                          key={presetId}
                          type="button"
                          data-testid={`reaction-preset-${presetId}`}
                          onClick={() => setChemistryReactionPreset(presetId)}
                          className={`w-full text-left p-2.5 rounded-xl border font-mono text-xs instrument-transition cursor-pointer ${
                            active
                              ? 'bg-purple-950/60 border-purple-400 text-white shadow-md'
                              : 'bg-[#080C16] border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-cyan-300">
                              {rx.code} · {rx.equationPlain}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-amber-300">
                              ΔH° {rx.enthalpyKJPerMol} kJ/mol
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {lang === 'es' ? rx.titleEs : rx.titleEn}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sliders Molares */}
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <label htmlFor="slider-moles-a" className="text-slate-200 font-semibold">
                        Reactivo A ({activePreset.reactantA.displayFormula}):
                      </label>
                      <span className="text-cyan-300 font-bold">
                        {chemistryLab.molesA.toFixed(2)} mol ({reactionResult.massAGrams.toFixed(1)}{' '}
                        g)
                      </span>
                    </div>
                    <input
                      id="slider-moles-a"
                      data-testid="slider-moles-a"
                      type="range"
                      min="0.1"
                      max="5.0"
                      step="0.1"
                      value={chemistryLab.molesA}
                      onChange={(e) =>
                        setChemistryMoles({
                          molesA: parseFloat(e.target.value),
                          molesB: chemistryLab.molesB,
                        })
                      }
                      className="w-full accent-purple-400 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <label htmlFor="slider-moles-b" className="text-slate-200 font-semibold">
                        Reactivo B ({activePreset.reactantB.displayFormula}):
                      </label>
                      <span className="text-cyan-300 font-bold">
                        {chemistryLab.molesB.toFixed(2)} mol ({reactionResult.massBGrams.toFixed(1)}{' '}
                        g)
                      </span>
                    </div>
                    <input
                      id="slider-moles-b"
                      data-testid="slider-moles-b"
                      type="range"
                      min="0.1"
                      max="5.0"
                      step="0.1"
                      value={chemistryLab.molesB}
                      onChange={(e) =>
                        setChemistryMoles({
                          molesA: chemistryLab.molesA,
                          molesB: parseFloat(e.target.value),
                        })
                      }
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <label htmlFor="slider-reactor-temp" className="text-slate-200 font-semibold">
                        Temperatura Inicial Baño Térmico (T₀):
                      </label>
                      <span className="text-amber-300 font-bold">
                        {chemistryLab.reactorTempK.toFixed(0)} K (
                        {(chemistryLab.reactorTempK - 273.15).toFixed(0)} °C)
                      </span>
                    </div>
                    <input
                      id="slider-reactor-temp"
                      data-testid="slider-reactor-temp"
                      type="range"
                      min="273"
                      max="650"
                      step="5"
                      value={chemistryLab.reactorTempK}
                      onChange={(e) => setChemistryReactorTemp(parseFloat(e.target.value))}
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <label htmlFor="slider-stirrer-rpm" className="text-slate-200 font-semibold">
                        Agitador Magnético PTFE:
                      </label>
                      <span className="text-emerald-300 font-bold">{chemistryLab.stirrerRpm} RPM</span>
                    </div>
                    <input
                      id="slider-stirrer-rpm"
                      type="range"
                      min="0"
                      max="1200"
                      step="50"
                      value={chemistryLab.stirrerRpm}
                      onChange={(e) => setChemistryStirrerRpm(parseFloat(e.target.value))}
                      className="w-full accent-emerald-400 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Catalizador y Botones de Detonación / Reconstrucción */}
                <div className="pt-2 border-t border-slate-800 space-y-2.5">
                  <button
                    type="button"
                    data-testid="toggle-catalyst-btn"
                    onClick={() => setChemistryCatalystActive(!chemistryLab.catalystActive)}
                    className={`w-full py-2.5 px-3 rounded-xl font-mono text-xs font-bold flex items-center justify-between border instrument-transition cursor-pointer ${
                      chemistryLab.catalystActive
                        ? 'bg-purple-500/20 border-purple-400 text-purple-200'
                        : 'bg-[#080C16] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span>
                        {activePreset.catalyst
                          ? `Inyectar Catalizador: ${activePreset.catalyst.nameEs}`
                          : 'Catalizador Homogéneo / Ignitor'}
                      </span>
                    </span>
                    <span>{chemistryLab.catalystActive ? 'ACTIVO' : 'INACTIVO'}</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      data-testid="trigger-detonation-btn"
                      onClick={() => triggerChemistryDetonation()}
                      className="min-h-[2.6rem] px-3 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-slate-950 font-mono font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                    >
                      <Flame className="w-4 h-4 fill-current" />
                      <span>Ignición / Detonar 3D</span>
                    </button>

                    <button
                      type="button"
                      data-testid="reset-reactor-btn"
                      onClick={() => resetChemistryReactor()}
                      className="min-h-[2.6rem] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Reiniciar Reactor</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Controles de Cámara de Gases Ideales PV=nRT */
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-mono font-bold text-cyan-300 uppercase mb-2">
                    1. Especie Molecular en Cámara de Contención
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {(Object.keys(GAS_SPECIES_CATALOG) as GasSpeciesId[]).map((spId) => {
                      const sp = GAS_SPECIES_CATALOG[spId];
                      const active = chemistryLab.gasSpecies === spId;
                      return (
                        <button
                          key={spId}
                          type="button"
                          data-testid={`gas-species-${spId}`}
                          onClick={() => setChemistryGasSpecies(spId)}
                          className={`w-full text-left p-2.5 rounded-xl border font-mono text-xs flex items-center justify-between instrument-transition cursor-pointer ${
                            active
                              ? 'bg-cyan-950/60 border-cyan-400 text-white'
                              : 'bg-[#080C16] border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <span className="font-bold">
                            {sp.formula} · {lang === 'es' ? sp.nameEs : sp.nameEn}
                          </span>
                          <span className="text-[11px] text-cyan-300">
                            M = {sp.molarMassGPerMol} g/mol
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <label htmlFor="slider-gas-moles" className="text-slate-200 font-semibold">
                        Cantidad de Sustancia (n):
                      </label>
                      <span className="text-cyan-300 font-bold">
                        {chemistryLab.gasMoles.toFixed(2)} mol
                      </span>
                    </div>
                    <input
                      id="slider-gas-moles"
                      data-testid="slider-gas-moles"
                      type="range"
                      min="0.2"
                      max="8.0"
                      step="0.1"
                      value={chemistryLab.gasMoles}
                      onChange={(e) =>
                        setChemistryGasParams({ gasMoles: parseFloat(e.target.value) })
                      }
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <label htmlFor="slider-gas-volume" className="text-slate-200 font-semibold">
                        Volumen del Pistón (V):
                      </label>
                      <span className="text-purple-300 font-bold">
                        {chemistryLab.gasVolumeLiters.toFixed(1)} L
                      </span>
                    </div>
                    <input
                      id="slider-gas-volume"
                      data-testid="slider-gas-volume"
                      type="range"
                      min="1.5"
                      max="30.0"
                      step="0.5"
                      value={chemistryLab.gasVolumeLiters}
                      onChange={(e) =>
                        setChemistryGasParams({ gasVolumeLiters: parseFloat(e.target.value) })
                      }
                      className="w-full accent-purple-400 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <label htmlFor="slider-gas-temp" className="text-slate-200 font-semibold">
                        Temperatura Absoluta (T):
                      </label>
                      <span className="text-amber-300 font-bold">
                        {chemistryLab.gasTempK.toFixed(0)} K (
                        {(chemistryLab.gasTempK - 273.15).toFixed(0)} °C)
                      </span>
                    </div>
                    <input
                      id="slider-gas-temp"
                      data-testid="slider-gas-temp"
                      type="range"
                      min="100"
                      max="1200"
                      step="5"
                      value={chemistryLab.gasTempK}
                      onChange={(e) =>
                        setChemistryGasParams({ gasTempK: parseFloat(e.target.value) })
                      }
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    data-testid="gas-spark-btn"
                    onClick={() => triggerChemistryGasSpark()}
                    className="min-h-[2.6rem] px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="w-4 h-4 fill-current" />
                    <span>Chispa 2H₂ + O₂</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setChemistryGasSpecies(chemistryLab.gasSpecies);
                      setChemistryGasParams({
                        gasMoles: 1.5,
                        gasTempK: 300,
                        gasVolumeLiters: 12.0,
                      });
                    }}
                    className="min-h-[2.6rem] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Restaurar Cámara</span>
                  </button>
                </div>
              </div>
            )
          ) : (
            /* Pestaña de Retos Experimentales de Química */
            <div className="space-y-3" data-testid="chemistry-challenges-panel">
              <div className="text-xs font-mono text-amber-300 font-bold uppercase">
                Retos Verificables de Estequiometría y Termodinámica
              </div>
              {CHEMISTRY_CHALLENGES.map((ch) => {
                const isDone = !!completedChallenges[ch.id];
                const feedback = validationFeedback[ch.id];
                return (
                  <div
                    key={ch.id}
                    className={`p-3.5 rounded-xl border font-mono text-xs space-y-2 ${
                      isDone
                        ? 'bg-emerald-950/30 border-emerald-500/50'
                        : 'bg-[#080C16] border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white">
                        {ch.code} · {lang === 'es' ? ch.titleEs : ch.titleEn}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                        +{ch.points} PTS
                      </span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">
                      {lang === 'es' ? ch.goalEs : ch.goalEn}
                    </p>
                    <div className="text-[11px] text-cyan-300 bg-slate-900/90 px-2.5 py-1.5 rounded border border-slate-800">
                      Fórmula: {ch.formulaHint}
                    </div>

                    {feedback && (
                      <div
                        data-testid={`feedback-${ch.code}`}
                        className={`p-2 rounded-lg text-[11px] flex items-center gap-2 ${
                          feedback.passed
                            ? 'bg-emerald-950/80 text-emerald-200 border border-emerald-500/40'
                            : 'bg-rose-950/80 text-rose-200 border border-rose-500/40'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{feedback.feedbackEs}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        data-testid={`verify-${ch.code}`}
                        onClick={() => handleVerifyChallenge(ch.id, ch.points)}
                        className="px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold cursor-pointer"
                      >
                        {isDone ? 'Completado ✓ (Revalidar)' : 'Verificar Reto'}
                      </button>
                      <button
                        type="button"
                        data-testid={`autofill-${ch.code}`}
                        onClick={() => applySuggestedChallengeSetup(ch.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                      >
                        Configurar Parámetros Meta
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default ChemistryLabView;
