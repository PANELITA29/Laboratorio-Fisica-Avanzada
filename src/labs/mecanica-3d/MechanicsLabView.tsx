import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
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
  Activity,
} from 'lucide-react';
import { Language, dictionary } from '../../assets/js/i18n';
import { audioSynth } from '../../assets/js/audio-synth';
import { TelemetryItem } from '../../assets/js/report-generator';
import {
  MechanicsPresetId,
  PendulumState,
  MechanicsParameters,
  stepRK4Pendulum,
  computeMechanicsEnergetics,
  MECHANICS_CHALLENGES,
  validateMechanicsChallenge1,
  validateMechanicsChallenge2,
} from './mechanics-engine';

interface MechanicsLabViewProps {
  lang: Language;
  onUpdateTelemetry: (items: TelemetryItem[]) => void;
  completedChallenges: Record<string, boolean>;
  onCompleteChallenge: (id: string, points: number) => void;
}

export const MechanicsLabView: React.FC<MechanicsLabViewProps> = ({
  lang,
  onUpdateTelemetry,
  completedChallenges,
  onCompleteChallenge,
}) => {
  const t = dictionary[lang];

  const [activeSubTab, setActiveSubTab] = useState<'sandbox' | 'challenges'>('sandbox');
  const [preset, setPreset] = useState<MechanicsPresetId>('simple-pendulum');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);

  // Parámetros físicos controlables
  const [length, setLength] = useState<number>(1.0); // L = 1.00 m -> T = 2.00 s en Tierra
  const [mass, setMass] = useState<number>(2.0);
  const [gravity, setGravity] = useState<number>(9.81);
  const [damping, setDamping] = useState<number>(0.0);
  const [couplingSpring, setCouplingSpring] = useState<number>(2.5);

  // Capas de vectores 3D conmutables
  const [showTensionVector, setShowTensionVector] = useState<boolean>(true);
  const [showWeightVector, setShowWeightVector] = useState<boolean>(true);
  const [showVelocityVector, setShowVelocityVector] = useState<boolean>(true);
  const [showWaveSurface, setShowWaveSurface] = useState<boolean>(true);

  const [liveEnergy, setLiveEnergy] = useState({
    kineticEnergy: 0,
    potentialEnergy: 3.5,
    totalEnergy: 3.5,
    theoreticalPeriod: 2.01,
    linearSpeed: 0,
  });

  const [validationFeedback, setValidationFeedback] = useState<
    Record<string, { passed: boolean; messageEs: string; messageEn: string }>
  >({});

  const pendulumStateRef = useRef<PendulumState>({
    theta: 0.55,
    omega: 0,
    phi: 0,
    phiDot: 0,
    theta2: -0.15,
    omega2: 0,
  });

  const paramsRef = useRef({
    preset,
    isPaused,
    length,
    mass,
    gravity,
    damping,
    couplingSpring,
    showTensionVector,
    showWeightVector,
    showVelocityVector,
    showWaveSurface,
  });
  paramsRef.current = {
    preset,
    isPaused,
    length,
    mass,
    gravity,
    damping,
    couplingSpring,
    showTensionVector,
    showWeightVector,
    showVelocityVector,
    showWaveSurface,
  };

  const mountRef = useRef<HTMLDivElement | null>(null);

  const applyMechanicsPreset = (newPreset: MechanicsPresetId) => {
    setPreset(newPreset);
    if (newPreset === 'simple-pendulum') {
      setLength(1.0);
      setGravity(9.81);
      setDamping(0.0);
      setCouplingSpring(0.0);
      pendulumStateRef.current = { theta: 0.55, omega: 0, phi: 0, phiDot: 0, theta2: 0, omega2: 0 };
    } else if (newPreset === 'foucault-3d') {
      setLength(2.2);
      setGravity(9.81);
      setDamping(0.0);
      pendulumStateRef.current = { theta: 0.52, omega: 0, phi: 0, phiDot: 0.35, theta2: 0, omega2: 0 };
    } else if (newPreset === 'coupled-resonance') {
      setLength(1.6);
      setGravity(9.81);
      setDamping(0.0);
      setCouplingSpring(2.5);
      pendulumStateRef.current = { theta: 0.6, omega: 0, phi: 0, phiDot: 0, theta2: 0, omega2: 0 };
    } else if (newPreset === 'wave-interference') {
      setLength(1.4);
      setGravity(9.81);
      pendulumStateRef.current = { theta: 0.45, omega: 0, phi: 0, phiDot: 0, theta2: -0.45, omega2: 0 };
    }
  };

  const handleValidateChallenge = (chId: string) => {
    const currentParams: MechanicsParameters = {
      length,
      mass,
      gravity,
      damping,
      couplingSpring,
    };
    if (chId === 'mech-1') {
      const res = validateMechanicsChallenge1(currentParams);
      setValidationFeedback((prev) => ({ ...prev, [chId]: res }));
      if (res.passed) {
        audioSynth.playSuccessChime();
        onCompleteChallenge('mech-1', 250);
      }
    } else if (chId === 'mech-2') {
      const res = validateMechanicsChallenge2(preset, currentParams);
      setValidationFeedback((prev) => ({ ...prev, [chId]: res }));
      if (res.passed) {
        audioSynth.playSuccessChime();
        onCompleteChallenge('mech-2', 300);
      }
    }
  };

  useEffect(() => {
    onUpdateTelemetry([
      {
        label: lang === 'es' ? 'Período Teórico (T)' : 'Theoretical Period (T)',
        value: liveEnergy.theoreticalPeriod.toFixed(3),
        unit: 's',
      },
      {
        label: lang === 'es' ? 'Energía Cinética (K)' : 'Kinetic Energy (K)',
        value: liveEnergy.kineticEnergy.toFixed(2),
        unit: 'J',
      },
      {
        label: lang === 'es' ? 'Energía Potencial (U)' : 'Potential Energy (U)',
        value: liveEnergy.potentialEnergy.toFixed(2),
        unit: 'J',
      },
      {
        label: lang === 'es' ? 'Energía Mecánica (E)' : 'Mechanical Energy (E)',
        value: liveEnergy.totalEnergy.toFixed(2),
        unit: 'J',
      },
    ]);
  }, [liveEnergy, lang, onUpdateTelemetry]);

  // Escena Three.js WebGL con pórtico 3D, esferas PBR, resorte de acoplamiento y tanque de ondas 3D
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
    scene.background = new THREE.Color(0x060a12);
    scene.fog = new THREE.FogExp2(0x060a12, 0.015);

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 200);
    camera.position.set(0, 6.5, 16.5);
    camera.lookAt(0, 3.0, 0);

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
    controls.target.set(0, 3.2, 0);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.minDistance = 6;
    controls.maxDistance = 35;

    // Iluminación de estudio cálida/fría
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.85);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 2.0);
    dirLight.position.set(8, 16, 10);
    scene.add(dirLight);

    // Pórtico Metálico 3D Compuesto (Base, 2 Columnas Verticales, Travesaño Superior y Soportes)
    const gantryGroup = new THREE.Group();
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.85,
      roughness: 0.25,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.9,
      roughness: 0.18,
    });

    const colL = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 9.2, 20), steelMat);
    colL.position.set(-5.8, 4.6, 0);
    const colR = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 9.2, 20), steelMat);
    colR.position.set(5.8, 9.2 / 2, 0);
    const topBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 12.4, 20).rotateZ(Math.PI / 2),
      steelMat
    );
    topBeam.position.set(0, 9.1, 0);

    const pivotBearing1 = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.5, 20), brassMat);
    pivotBearing1.position.set(0, 9.1, 0);

    const pivotBearing2 = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.5, 20), brassMat);
    pivotBearing2.position.set(2.4, 9.1, 0);

    gantryGroup.add(colL, colR, topBeam, pivotBearing1, pivotBearing2);
    scene.add(gantryGroup);

    // Esfera PBR 1 y Cuerda 1
    const bob1Group = new THREE.Group();
    const bob1Sphere = new THREE.Mesh(new THREE.SphereGeometry(0.68, 28, 28), brassMat);
    const bob1Ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.75, 0.05, 12, 28),
      new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x06b6d4, emissiveIntensity: 0.5 })
    );
    bob1Group.add(bob1Sphere, bob1Ring);
    scene.add(bob1Group);

    const rod1Geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 9.1, 0),
      new THREE.Vector3(0, 5.0, 0),
    ]);
    const rod1Line = new THREE.Line(
      rod1Geo,
      new THREE.LineBasicMaterial({ color: 0xe2e8f0, linewidth: 2 })
    );
    scene.add(rod1Line);

    // Esfera PBR 2 y Cuerda 2 (para Resonancia Acoplada e Interferencia)
    const bob2Group = new THREE.Group();
    const bob2Sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.68, 28, 28),
      new THREE.MeshStandardMaterial({ color: 0x06b6d4, metalness: 0.85, roughness: 0.2 })
    );
    bob2Group.add(bob2Sphere);
    scene.add(bob2Group);

    const rod2Geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(2.4, 9.1, 0),
      new THREE.Vector3(2.4, 5.0, 0),
    ]);
    const rod2Line = new THREE.Line(
      rod2Geo,
      new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 })
    );
    scene.add(rod2Line);

    // Resorte de acoplamiento entre ambos péndulos
    const springGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-1.2, 6.0, 0),
      new THREE.Vector3(1.2, 6.0, 0),
    ]);
    const springLine = new THREE.Line(
      springGeo,
      new THREE.LineBasicMaterial({ color: 0xf59e0b })
    );
    scene.add(springLine);

    // Vectores 3D Conmutables sobre el Péndulo Principal: Tensión (Cian), Peso mg (Rojo), Velocidad (Verde)
    const tensionArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(),
      2.5,
      0x22d3ee,
      0.5,
      0.35
    );
    const weightArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(),
      2.5,
      0xf43f5e,
      0.5,
      0.35
    );
    const velArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(),
      2.5,
      0x10b981,
      0.5,
      0.35
    );
    scene.add(tensionArrow, weightArrow, velArrow);

    // Superficie 3D de Ondas Mecánicas e Interferencia en la base del laboratorio
    const waveSegs = isSoftwareGl ? 36 : 52;
    const waveGeo = new THREE.PlaneGeometry(24, 18, waveSegs, waveSegs);
    waveGeo.rotateX(-Math.PI / 2);
    const waveVertCount = waveGeo.attributes.position.count;
    const waveColors = new THREE.BufferAttribute(new Float32Array(waveVertCount * 3), 3);
    waveGeo.setAttribute('color', waveColors);

    const waveMat = new THREE.MeshBasicMaterial({
      wireframe: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
    });
    const waveMesh = new THREE.Mesh(waveGeo, waveMat);
    waveMesh.position.y = 0.05;
    scene.add(waveMesh);

    const _p1 = new THREE.Vector3();
    const _p2 = new THREE.Vector3();
    const _pivot1 = new THREE.Vector3();
    const _pivot2 = new THREE.Vector3();
    const _dir = new THREE.Vector3();
    const _cLow = new THREE.Color(0x0284c7);
    const _cPeak = new THREE.Color(0x22d3ee);
    const _cTmp = new THREE.Color();

    let frameId = 0;
    let waveTime = 0;
    let lastHudTime = 0;

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
      const cfg = paramsRef.current;
      const isCoupled = cfg.preset === 'coupled-resonance' || cfg.preset === 'wave-interference';

      if (!cfg.isPaused) {
        const dt = 0.016;
        pendulumStateRef.current = stepRK4Pendulum(
          pendulumStateRef.current,
          {
            length: cfg.length,
            mass: cfg.mass,
            gravity: cfg.gravity,
            damping: cfg.damping,
            couplingSpring: isCoupled ? cfg.couplingSpring : 0,
          },
          dt
        );
        waveTime += dt * 3.2;
      }

      const st = pendulumStateRef.current;
      const visualLength = 2.6 + cfg.length * 1.15; // Escala visual en metros 3D

      // Posición del Péndulo 1
      const pivotX1 = isCoupled ? -1.8 : 0;
      _pivot1.set(pivotX1, 9.1, 0);
      pivotBearing1.position.set(pivotX1, 9.1, 0);

      const sinT1 = Math.sin(st.theta);
      const cosT1 = Math.cos(st.theta);
      const x1 = pivotX1 + visualLength * sinT1 * Math.cos(st.phi);
      const z1 = visualLength * sinT1 * Math.sin(st.phi);
      const y1 = 9.1 - visualLength * cosT1;

      _p1.set(x1, y1, z1);
      bob1Group.position.copy(_p1);

      const r1Attr = rod1Geo.attributes.position as THREE.BufferAttribute;
      r1Attr.setXYZ(0, _pivot1.x, _pivot1.y, _pivot1.z);
      r1Attr.setXYZ(1, _p1.x, _p1.y, _p1.z);
      r1Attr.needsUpdate = true;

      // Posición del Péndulo 2 (si está en modo acoplado)
      if (isCoupled) {
        bob2Group.visible = true;
        rod2Line.visible = true;
        springLine.visible = true;
        pivotBearing2.visible = true;

        const pivotX2 = 1.8;
        _pivot2.set(pivotX2, 9.1, 0);
        pivotBearing2.position.set(pivotX2, 9.1, 0);

        const x2 = pivotX2 + visualLength * Math.sin(st.theta2);
        const y2 = 9.1 - visualLength * Math.cos(st.theta2);
        _p2.set(x2, y2, 0);
        bob2Group.position.copy(_p2);

        const r2Attr = rod2Geo.attributes.position as THREE.BufferAttribute;
        r2Attr.setXYZ(0, _pivot2.x, _pivot2.y, _pivot2.z);
        r2Attr.setXYZ(1, _p2.x, _p2.y, _p2.z);
        r2Attr.needsUpdate = true;

        const spAttr = springGeo.attributes.position as THREE.BufferAttribute;
        spAttr.setXYZ(0, (_pivot1.x + _p1.x) * 0.5, (_pivot1.y + _p1.y) * 0.5, 0);
        spAttr.setXYZ(1, (_pivot2.x + _p2.x) * 0.5, (_pivot2.y + _p2.y) * 0.5, 0);
        spAttr.needsUpdate = true;
      } else {
        bob2Group.visible = false;
        rod2Line.visible = false;
        springLine.visible = false;
        pivotBearing2.visible = false;
      }

      // Actualizar Vectores 3D Conmutables (Tensión T, Peso mg, Velocidad v)
      tensionArrow.visible = cfg.showTensionVector;
      if (cfg.showTensionVector) {
        tensionArrow.position.copy(_p1);
        _dir.subVectors(_pivot1, _p1).normalize();
        tensionArrow.setDirection(_dir);
        tensionArrow.setLength(2.2, 0.45, 0.3);
      }

      weightArrow.visible = cfg.showWeightVector;
      if (cfg.showWeightVector) {
        weightArrow.position.copy(_p1);
        _dir.set(0, -1, 0);
        weightArrow.setDirection(_dir);
        weightArrow.setLength(Math.min(3.2, 1.0 + cfg.gravity * 0.12), 0.45, 0.3);
      }

      velArrow.visible = cfg.showVelocityVector && Math.abs(st.omega) > 0.02;
      if (velArrow.visible) {
        velArrow.position.copy(_p1);
        _dir.set(Math.cos(st.theta) * Math.sign(st.omega), Math.sin(st.theta) * Math.sign(st.omega), 0).normalize();
        velArrow.setDirection(_dir);
        velArrow.setLength(Math.min(3.5, Math.max(0.8, Math.abs(st.omega) * cfg.length * 0.9)), 0.45, 0.3);
      }

      // Actualizar Malla 3D de Ondas Mecánicas e Interferencia en la base
      waveMesh.visible = cfg.showWaveSurface;
      if (cfg.showWaveSurface) {
        const wPos = waveGeo.attributes.position as THREE.BufferAttribute;
        const wCol = waveGeo.attributes.color as THREE.BufferAttribute;

        for (let i = 0; i < wPos.count; i++) {
          const wx = wPos.getX(i);
          const wz = wPos.getZ(i);
          const d1 = Math.hypot(wx - _p1.x, wz - _p1.z);
          let waveH = 0.32 * Math.sin(d1 * 1.45 - waveTime) * Math.exp(-d1 * 0.08);

          if (isCoupled) {
            const d2 = Math.hypot(wx - _p2.x, wz - _p2.z);
            waveH += 0.32 * Math.sin(d2 * 1.45 - waveTime) * Math.exp(-d2 * 0.08);
          }

          wPos.setY(i, waveH);
          const norm = Math.min(1, Math.max(0, (waveH + 0.5) / 1.0));
          _cTmp.lerpColors(_cLow, _cPeak, norm);
          wCol.setXYZ(i, _cTmp.r, _cTmp.g, _cTmp.b);
        }
        wPos.needsUpdate = true;
        wCol.needsUpdate = true;
      }

      // Actualizar HUD de energía cada 200ms
      const now = performance.now();
      if (now - lastHudTime > 200) {
        lastHudTime = now;
        const eStats = computeMechanicsEnergetics(
          st,
          {
            length: cfg.length,
            mass: cfg.mass,
            gravity: cfg.gravity,
            damping: cfg.damping,
            couplingSpring: cfg.couplingSpring,
          },
          isCoupled
        );
        setLiveEnergy(eStats);
      }

      controls.update();
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
      {/* Header del Laboratorio 3 */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[#0D1322] border border-slate-800/90">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-emerald-400">
            MÓDULO 3 · OSCILADORES ACOPLADOS, PÉNDULO 3D Y ONDAS (INTEGRADOR RK4)
          </span>
          <h2 className="text-xl font-bold text-white">
            {lang === 'es'
              ? 'Laboratorio de Dinámica Clásica, Resonancia y Ondas 3D'
              : '3D Classical Dynamics, Resonance & Wave Interference Lab'}
          </h2>
          <p className="text-xs text-slate-400">
            {lang === 'es'
              ? 'Integración Runge-Kutta de 4to Orden (RK4) · Conservación E = K + U · Interferencia de Ondas en Tiempo Real'
              : '4th-Order Runge-Kutta (RK4) Integration · Energy Conservation E = K + U · Real-Time Wave Interference'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#07090E] border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveSubTab('sandbox')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeSubTab === 'sandbox'
                  ? 'bg-emerald-500 text-slate-950 font-semibold'
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
                  ? 'bg-emerald-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>{t.challengesTab}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'simple-pendulum', labelEs: 'Péndulo de Huygens (Reto 1)', labelEn: 'Huygens Pendulum (Challenge 1)' },
                { id: 'coupled-resonance', labelEs: 'Resonancia Acoplada 3D (Reto 2)', labelEn: '3D Coupled Resonance (Challenge 2)' },
                { id: 'foucault-3d', labelEs: 'Precesión 3D de Foucault', labelEn: '3D Foucault Precession' },
                { id: 'wave-interference', labelEs: 'Interferencia Constructiva', labelEn: 'Wave Interference' },
              ] as Array<{ id: MechanicsPresetId; labelEs: string; labelEn: string }>
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyMechanicsPreset(p.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  preset === p.id
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                    : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {lang === 'es' ? p.labelEs : p.labelEn}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pestaña de Retos del Laboratorio 3 */}
      {activeSubTab === 'challenges' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {MECHANICS_CHALLENGES.map((ch) => {
            const isDone = !!completedChallenges[ch.id];
            const fb = validationFeedback[ch.id];
            return (
              <div
                key={ch.id}
                className="p-5 rounded-xl bg-[#0D1322] border border-slate-800 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs font-mono">
                    <span className="text-emerald-400">{ch.points} PTS</span>
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
                    onClick={() =>
                      applyMechanicsPreset(ch.id === 'mech-1' ? 'simple-pendulum' : 'coupled-resonance')
                    }
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
                  >
                    {t.loadChallengeSetup}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleValidateChallenge(ch.id)}
                    className="flex-1 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    {t.validateChallenge}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Escenario 3D Principal con Barras de Conservación de Energía en Vivo y Dock Inferior Colapsable */}
      <div className="relative w-full h-[560px] rounded-xl bg-[#060A12] border border-slate-800 overflow-hidden">
        <div ref={mountRef} data-testid="mechanics-3d-canvas" className="w-full h-full" />

        {/* Medidor en Vivo de Conservación de Energía (Top-Left, superficie sólida sin backdrop-blur) */}
        <div className="absolute top-4 left-4 pointer-events-none bg-[#090D16] border border-slate-800 rounded-lg p-3.5 w-72 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-emerald-400 uppercase">
            <span className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" />
              CONSERVACIÓN E = K + U
            </span>
            <span>T = {liveEnergy.theoreticalPeriod.toFixed(2)} s</span>
          </div>

          <div className="space-y-1.5 text-[11px] font-mono">
            <div>
              <div className="flex justify-between text-slate-300">
                <span>Cinética (K)</span>
                <span className="tabular-nums">{liveEnergy.kineticEnergy.toFixed(2)} J</span>
              </div>
              <div className="w-full h-1.5 rounded bg-slate-800 overflow-hidden mt-0.5">
                <div
                  className="h-full bg-emerald-400 transition-transform origin-left"
                  style={{
                    transform: `scaleX(${Math.min(
                      1,
                      liveEnergy.kineticEnergy / Math.max(0.1, liveEnergy.totalEnergy)
                    )})`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-300">
                <span>Potencial (U)</span>
                <span className="tabular-nums">{liveEnergy.potentialEnergy.toFixed(2)} J</span>
              </div>
              <div className="w-full h-1.5 rounded bg-slate-800 overflow-hidden mt-0.5">
                <div
                  className="h-full bg-cyan-400 transition-transform origin-left"
                  style={{
                    transform: `scaleX(${Math.min(
                      1,
                      liveEnergy.potentialEnergy / Math.max(0.1, liveEnergy.totalEnergy)
                    )})`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Collapsible Bottom Control Dock */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[94%] max-w-[920px] flex flex-col items-center">
          <button
            type="button"
            onClick={() => setDockCollapsed((prev) => !prev)}
            className="flex items-center gap-1.5 px-3.5 py-1 rounded-t-lg bg-[#0D1322] border border-b-0 border-slate-700 text-xs font-mono text-emerald-300 hover:text-white transition-colors cursor-pointer"
          >
            {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{dockCollapsed ? t.showControls : t.hideControls}</span>
          </button>

          {!dockCollapsed && (
            <div className="w-full rounded-xl bg-[#0B0F1C] border border-slate-700/90 p-4 shadow-2xl space-y-3">
              {/* Row 1: Vector Toggles & Planetary Gravity Selector */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-mono text-slate-400 flex items-center gap-1 mr-1">
                    <Layers className="w-3.5 h-3.5 text-emerald-400" />
                    Vectores 3D:
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowTensionVector((v) => !v)}
                    className={`px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                      showTensionVector
                        ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-200'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    Tensión (T)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowWeightVector((v) => !v)}
                    className={`px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                      showWeightVector
                        ? 'bg-rose-500/20 border border-rose-400 text-rose-200'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    Peso (m·g)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowVelocityVector((v) => !v)}
                    className={`px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                      showVelocityVector
                        ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-200'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    Velocidad (v)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowWaveSurface((v) => !v)}
                    className={`px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                      showWaveSurface
                        ? 'bg-amber-500/20 border border-amber-400 text-amber-200'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    Malla de Ondas 3D
                  </button>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-mono">
                  <span className="text-slate-400">Gravedad:</span>
                  {[
                    { label: 'Luna (1.62)', val: 1.62 },
                    { label: 'Tierra (9.81)', val: 9.81 },
                    { label: 'Júpiter (24.79)', val: 24.79 },
                  ].map((gItem) => (
                    <button
                      key={gItem.label}
                      type="button"
                      onClick={() => setGravity(gItem.val)}
                      className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                        Math.abs(gravity - gItem.val) < 0.1
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {gItem.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 2: Sliders L, b, k_c and Play/Reset */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label htmlFor="pendulum-length-slider" className="text-slate-300">
                      Longitud Cuerda (L)
                    </label>
                    <span className="font-mono font-bold text-emerald-300 tabular-nums">
                      {length.toFixed(2)} m
                    </span>
                  </div>
                  <input
                    id="pendulum-length-slider"
                    type="range"
                    min={0.4}
                    max={3.5}
                    step={0.05}
                    value={length}
                    onChange={(e) => setLength(parseFloat(e.target.value))}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label htmlFor="pendulum-damping-slider" className="text-slate-300">
                      Amortiguamiento (b)
                    </label>
                    <span className="font-mono font-bold text-cyan-300 tabular-nums">
                      {damping.toFixed(2)} N·s/m
                    </span>
                  </div>
                  <input
                    id="pendulum-damping-slider"
                    type="range"
                    min={0.0}
                    max={0.4}
                    step={0.02}
                    value={damping}
                    onChange={(e) => setDamping(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label htmlFor="pendulum-spring-slider" className="text-slate-300">
                      Resorte Acoplado (k_c)
                    </label>
                    <span className="font-mono font-bold text-amber-300 tabular-nums">
                      {couplingSpring.toFixed(1)} N/m
                    </span>
                  </div>
                  <input
                    id="pendulum-spring-slider"
                    type="range"
                    min={0.0}
                    max={6.0}
                    step={0.5}
                    value={couplingSpring}
                    onChange={(e) => setCouplingSpring(parseFloat(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPaused((p) => !p)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-xs hover:bg-emerald-400 transition-colors cursor-pointer"
                  >
                    {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    <span>{isPaused ? t.resumeSim : t.pauseSim}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyMechanicsPreset(preset)}
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

      {/* Explicación Pedagógica Intuitiva del Laboratorio 3 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[#0D1322] border border-slate-800 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400 uppercase">
            <BookOpen className="w-4 h-4" />
            <span>1. El Descubrimiento de Galileo e Huygens</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Observa que el período <span className="font-mono text-emerald-300">T = 2π √(L / g)</span> depende únicamente de la longitud <span className="font-mono">L</span> de la cuerda y de la gravedad <span className="font-mono">g</span>, ¡no de la masa de la esfera! Con <span className="font-mono">L = 1.00 m</span> en la Tierra, cada oscilación completa tarda exactamente 2.00 segundos.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#0D1322] border border-slate-800 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-400 uppercase">
            <BookOpen className="w-4 h-4" />
            <span>2. Transformación Continua K ↔ U</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            En los extremos del arco la esfera se detiene un instante (<span className="text-emerald-300 font-mono">K = 0</span>, máxima altura potencial <span className="text-cyan-300 font-mono">U</span>). Al pasar por el punto más bajo ocurre lo inverso: toda la energía potencial se ha transformado en velocidad máxima.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#0D1322] border border-slate-800 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-400 uppercase">
            <BookOpen className="w-4 h-4" />
            <span>3. Resonancia y Batimiento Armónico</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            En el modo <strong>Resonancia Acoplada 3D</strong>, el resorte central transfiere energía gradualmente del primer péndulo al segundo hasta detener por completo al primero, y luego el proceso se invierte en un ciclo perpetuo de batimiento.
          </p>
        </div>
      </div>
    </div>
  );
};
