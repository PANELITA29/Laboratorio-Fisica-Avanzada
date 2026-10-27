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
} from './space-engine';
import {
  createSpacetimeShaderMesh,
  updateSpacetimeShaderUniforms,
} from './SpaceScene3D';
import {
  SPACE_CHALLENGES,
  validateSpaceChallenge1,
  validateSpaceChallenge2,
  SpaceValidationResult,
} from './space-challenges';

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

  const [activeSubTab, setActiveSubTab] = useState<'sandbox' | 'challenges'>('sandbox');
  const [preset, setPreset] = useState<SpacePresetId>('solar');
  const [cameraMode, setCameraMode] = useState<CameraMode>('free');
  const [targetBodyIndex, setTargetBodyIndex] = useState<number>(1);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);

  // Parámetros físicos interactivos + Parámetros Keplerianos / Hohmann de QuantumLabs
  const [insertionFactor, setInsertionFactor] = useState<number>(1.0);
  const [gravityG, setGravityG] = useState<number>(1.0);
  const [simSpeed, setSimSpeed] = useState<number>(1.0);
  const [centralMassSolar, setCentralMassSolar] = useState<number>(1.0);
  const [semiMajorAxisAU, setSemiMajorAxisAU] = useState<number>(1.0);
  const [eccentricity, setEccentricity] = useState<number>(0.15);
  const [hohmannActive, setHohmannActive] = useState<boolean>(false);

  const keplerMetrics = computeKeplerAndHohmannAnalytics({
    centralMassSolar,
    semiMajorAxisAU,
    eccentricity,
    targetOrbitAU: semiMajorAxisAU * 1.524,
  });

  // Capas de visualización conmutables
  const [showSpacetimeMesh, setShowSpacetimeMesh] = useState<boolean>(true);
  const [showGravityVectors, setShowGravityVectors] = useState<boolean>(true);
  const [showVelocityVectors, setShowVelocityVectors] = useState<boolean>(true);
  const [showTrails, setShowTrails] = useState<boolean>(true);

  // Telemetría viva throttled a <= 10Hz para el HUD y Reporte
  const [liveStats, setLiveStats] = useState({
    kineticEnergy: 0,
    potentialEnergy: 0,
    totalEnergy: 0,
    primaryOrbitalRadius: 16,
    primarySpeed: 8.6,
  });

  const [validationFeedback, setValidationFeedback] = useState<Record<string, SpaceValidationResult>>({});

  // Estado mutable de los cuerpos celestes para el bucle Verlet
  const bodiesRef = useRef<CelestialBody[]>(createSpacePreset('solar', 1.0, 1.0));
  const resetTriggerRef = useRef<number>(0);

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
  };

  const mountRef = useRef<HTMLDivElement | null>(null);

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

  const applyPreset = (newPreset: SpacePresetId, newFactor: number = insertionFactor) => {
    setPreset(newPreset);
    setInsertionFactor(newFactor);
    setTargetBodyIndex(1);
    bodiesRef.current = createSpacePreset(newPreset, newFactor, gravityG);
    resetTriggerRef.current += 1;
  };

  const handleInsertionFactorChange = (val: number) => {
    setInsertionFactor(val);
    bodiesRef.current = createSpacePreset(preset, val, gravityG);
    resetTriggerRef.current += 1;
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
    }

    let visualsMap: Record<string, BodyVisuals> = {};
    let lastResetToken = -1;
    const MAX_TRAIL_POINTS = 180;

    // Construye un modelo 3D compuesto (3-12 partes) para cada astro o satélite
    const createCelestialCompositeGroup = (b: CelestialBody): THREE.Group => {
      const grp = new THREE.Group();

      if (b.id.includes('satellite')) {
        // Satélite compuesto: 1) Bus central dorado, 2) 2 Paneles solares azules, 3) Plato de antena y propulsor
        const hull = new THREE.Mesh(
          new THREE.CylinderGeometry(0.45, 0.45, 1.2, 16),
          new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.25 })
        );
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

      // Astro o Estrella compuesta: 1) Esfera núcleo PBR, 2) Halo atmosférico o corona, 3) Anillo ecuatorial / marcador polar
      const coreMat = new THREE.MeshStandardMaterial({
        color: b.color,
        roughness: b.emissive ? 0.15 : 0.45,
        metalness: b.emissive ? 0.1 : 0.3,
        emissive: b.emissive ? b.color : '#000000',
        emissiveIntensity: b.emissive ? 1.4 : 0.08,
      });
      const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(b.radius, 28, 28), coreMat);
      grp.add(coreMesh);

      const haloMat = new THREE.MeshBasicMaterial({
        color: b.color,
        transparent: true,
        opacity: b.emissive ? 0.24 : 0.14,
        depthWrite: false,
      });
      const haloMesh = new THREE.Mesh(new THREE.SphereGeometry(b.radius * 1.28, 20, 20), haloMat);
      grp.add(haloMesh);

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

        visualsMap[b.id] = {
          group,
          forceArrow,
          velArrow,
          trailLine,
          trailPositions,
          trailCount: 0,
        };
      });
    };

    // Vectores pre-alocados fuera del loop para Cero Garbage Collection
    const _dirVec = new THREE.Vector3();
    const _camTargetPos = new THREE.Vector3();
    const _camLookAt = new THREE.Vector3();
    const _colorLow = new THREE.Color(0xa855f7); // Pozo gravitacional profundo (violeta/magenta)
    const _colorMid = new THREE.Color(0x06b6d4); // Curvatura media (cian)
    const _colorFlat = new THREE.Color(0x1e293b); // Espacio plano (azul pizarra)
    const _tmpColor = new THREE.Color();

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

      // 1. Integración Física Simpléctica de Velocity Verlet
      if (!cfg.isPaused) {
        const subSteps = 2;
        const dt = (0.016 * cfg.simSpeed) / subSteps;
        for (let s = 0; s < subSteps; s++) {
          bodiesRef.current = stepVerletIntegration(bodiesRef.current, dt, cfg.gravityG);
        }
      }

      const activeBodies = bodiesRef.current;

      // 2. Actualizar Malla 3D del Espacio-Tiempo mediante GPU ShaderMaterial (SpaceScene3D)
      spacetimeMesh.visible = cfg.showSpacetimeMesh;
      if (cfg.showSpacetimeMesh) {
        updateSpacetimeShaderUniforms(
          spacetimeBundle,
          activeBodies,
          cfg.gravityG,
          performance.now() * 0.001
        );
      }

      // 3. Actualizar Posiciones de Cuerpos, Vectores 3D Conmutables y Rastro Orbital
      activeBodies.forEach((b) => {
        const vis = visualsMap[b.id];
        if (!vis) return;

        vis.group.position.set(b.position.x, b.position.y, b.position.z);
        vis.group.rotation.y += 0.012;

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

      // 5. Actualizar HUD de energías cada 200ms (<= 5Hz) para evitar re-renders a 60Hz
      const now = performance.now();
      if (now - lastHudUpdate > 220) {
        lastHudUpdate = now;
        const energetics = computeSystemEnergetics(activeBodies, cfg.gravityG);
        setLiveStats(energetics);
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

          {/* Escenarios Astrofísicos Predefinidos */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'solar', label: t.presetSolar },
                { id: 'earth-moon', label: t.presetEarthMoon },
                { id: 'exoplanet', label: t.presetExoplanet },
                { id: 'geostationary', label: t.presetGeostationary },
                { id: 'lagrange', label: t.presetLagrange },
              ] as Array<{ id: SpacePresetId; label: string }>
            ).map((item) => (
              <button
                key={item.id}
                type="button"
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
          </div>
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

      {/* Escenario Principal 3D (100% centro libre de obstrucciones + Collapsible Bottom Dock) */}
      <div className="relative w-full h-[580px] rounded-xl bg-[#05070E] border border-slate-800 overflow-hidden">
        {/* Contenedor aislado del Canvas WebGL */}
        <div
          ref={mountRef}
          data-testid="space-3d-canvas"
          className="w-full h-full"
        />

        {/* Minimal Spec Badge (Top-Left, solid surface without backdrop-blur over WebGL) */}
        <div className="absolute top-4 left-4 pointer-events-none bg-[#090D16] border border-slate-800 rounded-lg px-3.5 py-2.5 space-y-1">
          <div className="text-[11px] font-mono text-purple-400 uppercase">
            TELEMETRÍA ORBITAL EN VIVO (VERLET)
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-slate-200 tabular-nums">
            <span>r: {liveStats.primaryOrbitalRadius.toFixed(2)} u</span>
            <span>v: {liveStats.primarySpeed.toFixed(2)} u/s</span>
            <span className="text-cyan-400">E_tot: {liveStats.totalEnergy.toFixed(0)} GJ</span>
          </div>
        </div>

        {/* Collapsible Unified Bottom Control Dock */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[94%] max-w-[920px] flex flex-col items-center">
          <button
            type="button"
            onClick={() => setDockCollapsed((prev) => !prev)}
            className="flex items-center gap-1.5 px-3.5 py-1 rounded-t-lg bg-[#0D1322] border border-b-0 border-slate-700 text-xs font-mono text-cyan-300 hover:text-white transition-colors cursor-pointer"
          >
            {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{dockCollapsed ? t.showControls : t.hideControls}</span>
          </button>

          {!dockCollapsed && (
            <div className="w-full rounded-xl bg-[#0B0F1C] border border-slate-700/90 p-4 shadow-2xl space-y-3">
              {/* Row 1: Camera Kinematics & Vector Layers */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
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
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
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
                    min={0.5}
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
                    onChange={(e) => setGravityG(parseFloat(e.target.value))}
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
                    onChange={(e) => setSimSpeed(parseFloat(e.target.value))}
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

      {/* Panel Analítico Interactivo: Leyes de Kepler (1ª-3ª), Velocidad de Escape y Transferencia de Hohmann */}
      <div className="p-5 rounded-xl bg-[#0D1322] border border-slate-800 space-y-4">
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
              setHohmannActive(nextHohmann);
              bodiesRef.current = createKeplerianCustomSystem({
                centralMassSolar,
                semiMajorAxisAU,
                eccentricity,
                isHohmannTransferActive: nextHohmann,
                G: gravityG,
              });
              resetTriggerRef.current += 1;
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3 rounded-lg bg-[#07090E] border border-slate-800">
            <div className="flex justify-between mb-1">
              <label htmlFor="kepler-mass-slider" className="text-slate-300 font-mono">
                Masa Estrella Central (M☉)
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
                setCentralMassSolar(m);
                bodiesRef.current = createKeplerianCustomSystem({
                  centralMassSolar: m,
                  semiMajorAxisAU,
                  eccentricity,
                  isHohmannTransferActive: hohmannActive,
                  G: gravityG,
                });
                resetTriggerRef.current += 1;
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
                setSemiMajorAxisAU(aVal);
                bodiesRef.current = createKeplerianCustomSystem({
                  centralMassSolar,
                  semiMajorAxisAU: aVal,
                  eccentricity,
                  isHohmannTransferActive: hohmannActive,
                  G: gravityG,
                });
                resetTriggerRef.current += 1;
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
                setEccentricity(eVal);
                bodiesRef.current = createKeplerianCustomSystem({
                  centralMassSolar,
                  semiMajorAxisAU,
                  eccentricity: eVal,
                  isHohmannTransferActive: hohmannActive,
                  G: gravityG,
                });
                resetTriggerRef.current += 1;
              }}
              className="w-full accent-purple-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Telemetría Analítica de las 4 Leyes Celestes con Equivalencias Reales */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
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
            <span className="font-mono text-[11px] text-cyan-300 bg-[#0B101E] px-2.5 py-0.5 rounded border border-slate-800">
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

      {/* Guía Pedagógica Interactiva del Laboratorio Espacial 3D */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
    </div>
  );
};
