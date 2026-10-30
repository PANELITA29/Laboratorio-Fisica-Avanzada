import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  SandboxComponent,
  SandboxComponentType,
  SandboxWire,
  VoltmeterProbes,
  ChargeFlowDisplayMode,
  CircuitVisualStyle,
  NodalSolverResult,
  getEia4Bands,
  canvasToWorld3D,
  world3DToCanvas,
} from './NodalSolver';

export type CameraPreset3D = 'perspective' | 'top' | 'front' | 'isometric';

interface SandboxWorkbench3DProps {
  components: SandboxComponent[];
  wires: SandboxWire[];
  solverResult: NodalSolverResult;
  voltmeter: VoltmeterProbes;
  isRunning: boolean;
  flowMode: ChargeFlowDisplayMode;
  visualStyle: CircuitVisualStyle;
  selectedCompId: string | null;
  selectedWireId: string | null;
  pendingTerminal: string | null;
  probePlacementTarget: 'red' | 'black' | null;
  cameraPreset: CameraPreset3D;
  cameraResetToken: number;
  onSelectComponent: (id: string | null) => void;
  onSelectWire: (id: string | null) => void;
  onTerminalSelect: (terminalId: string) => void;
  onMoveComponent: (id: string, x: number, y: number) => void;
  onToggleSwitch: (id: string) => void;
  onPressPushbutton: (id: string, pressed: boolean) => void;
  onDropNewComponent: (type: SandboxComponentType, x: number, y: number) => void;
  onCancelPending: () => void;
}

const TERMINAL_LOCAL_X = 2.8; // 56 px / 20 px per unit = 2.8 world units

function getTerminalWorldPos(comp: SandboxComponent, pin: 'A' | 'B'): THREE.Vector3 {
  const center = canvasToWorld3D(comp.x, comp.y, 0.52);
  const rad = (comp.rotation * Math.PI) / 180;
  const sign = pin === 'A' ? -1 : 1;
  const dx = Math.cos(rad) * TERMINAL_LOCAL_X * sign;
  const dz = Math.sin(rad) * TERMINAL_LOCAL_X * sign;
  return new THREE.Vector3(center.x + dx, 0.52, center.z + dz);
}

function createTextBadgeTexture(
  primaryText: string,
  secondaryText: string,
  accentHex: string,
  statusBgHex = '#070B14',
  maxAnisotropy = 4
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 144;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = statusBgHex;
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 22);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 40px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(primaryText, canvas.width / 2, 48);

    ctx.fillStyle = accentHex;
    ctx.font = 'bold 31px "JetBrains Mono", monospace';
    ctx.fillText(secondaryText, canvas.width / 2, 102);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

function createAmmeterScreenTexture(currentAmps: number, maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#040812';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('AMPERÍMETRO DC', 16, 30);

    ctx.fillStyle = '#22D3EE';
    ctx.font = 'bold 46px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.abs(currentAmps).toFixed(2)} A`, canvas.width / 2, 92);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

function createBatteryTopTexture(voltage: number, isShort: boolean, maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = isShort ? '#450A0A' : '#0F172A';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = isShort ? '#EF4444' : '#D97706';
    ctx.fillRect(172, 0, 84, canvas.height);

    ctx.strokeStyle = isShort ? '#FCA5A5' : '#F59E0B';
    ctx.lineWidth = 5;
    ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 34px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('−', 34, 76);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('+', 216, 76);

    ctx.fillStyle = '#FDE68A';
    ctx.font = 'bold 34px "JetBrains Mono", monospace';
    ctx.fillText(`${voltage.toFixed(1)}V`, 108, 76);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export const SandboxWorkbench3D: React.FC<SandboxWorkbench3DProps> = ({
  components,
  wires,
  solverResult,
  voltmeter,
  isRunning,
  flowMode,
  visualStyle,
  selectedCompId,
  selectedWireId,
  pendingTerminal,
  probePlacementTarget,
  cameraPreset,
  cameraResetToken,
  onSelectComponent,
  onSelectWire,
  onTerminalSelect,
  onMoveComponent,
  onToggleSwitch,
  onPressPushbutton,
  onDropNewComponent,
  onCancelPending,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [hoveredInfo, setHoveredInfo] = useState<string | null>(null);
  const [draggingLabel, setDraggingLabel] = useState<string | null>(null);

  const propsRef = useRef({
    components,
    wires,
    solverResult,
    voltmeter,
    isRunning,
    flowMode,
    visualStyle,
    selectedCompId,
    selectedWireId,
    pendingTerminal,
    probePlacementTarget,
    onSelectComponent,
    onSelectWire,
    onTerminalSelect,
    onMoveComponent,
    onToggleSwitch,
    onPressPushbutton,
    onCancelPending,
  });
  propsRef.current = {
    components,
    wires,
    solverResult,
    voltmeter,
    isRunning,
    flowMode,
    visualStyle,
    selectedCompId,
    selectedWireId,
    pendingTerminal,
    probePlacementTarget,
    onSelectComponent,
    onSelectWire,
    onTerminalSelect,
    onMoveComponent,
    onToggleSwitch,
    onPressPushbutton,
    onCancelPending,
  };

  // Referencias para interpolación suave de cámara y partes articuladas
  const cameraGoalRef = useRef<{
    pos: THREE.Vector3;
    target: THREE.Vector3;
    active: boolean;
  }>({
    pos: new THREE.Vector3(0, 22, 21),
    target: new THREE.Vector3(0, 0, 0),
    active: false,
  });

  // Referencia a escenas y grupos dinámicos para actualizar sin recrear el WebGLRenderer
  const sceneSyncRef = useRef<{
    rebuildDynamicScene: () => void;
  } | null>(null);

  useEffect(() => {
    const presetMap: Record<CameraPreset3D, { pos: [number, number, number]; target: [number, number, number] }> = {
      perspective: { pos: [0, 24.5, 22.8], target: [0, -0.3, 0.8] },
      top: { pos: [0, 31.5, 0.01], target: [0, 0, 0] },
      front: { pos: [0, 9.5, 28.5], target: [0, 0.4, 0] },
      isometric: { pos: [21.5, 22.5, 21.5], target: [0, -0.3, 0.5] },
    };
    const next = presetMap[cameraPreset] || presetMap.perspective;
    cameraGoalRef.current = {
      pos: new THREE.Vector3(...next.pos),
      target: new THREE.Vector3(...next.target),
      active: true,
    };
  }, [cameraPreset, cameraResetToken]);

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

    const width = container.clientWidth || 920;
    const height = container.clientHeight || 520;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060a12);
    scene.fog = new THREE.FogExp2(0x060a12, 0.0085);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 250);
    camera.position.set(0, 24.5, 22.8);
    camera.lookAt(0, -0.3, 0.8);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    renderer.domElement.setAttribute('data-testid', 'builder-sandbox-canvas-3d');
    renderer.domElement.className = 'w-full h-full block touch-none select-none';
    container.appendChild(renderer.domElement);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    // Environment Map (IBL) obligatorio en todos los dispositivos
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnvTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = roomEnvTexture;

    // Iluminación de estudio de 3 puntos
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x090d16, 0.72);
    hemiLight.position.set(0, 30, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 2.35);
    keyLight.position.set(16, 28, 18);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 2;
      keyLight.shadow.camera.far = 75;
      const d = 28;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.bias = -0.0005;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x22d3ee, 0.85);
    rimLight.position.set(-18, 16, -16);
    scene.add(rimLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minDistance = 7;
    controls.maxDistance = 62;
    controls.target.set(0, -0.3, 0.8);

    // Si el usuario manipula manualmente la cámara, cancelar transición automática
    const stopCameraGoal = () => {
      cameraGoalRef.current.active = false;
    };
    controls.addEventListener('start', stopCameraGoal);

    // ========================================================================
    // 1. MESA ÓPTICA Y PROTOBOARD 3D DE INGENIERÍA (ESTÁTICA)
    // ========================================================================
    const boardStaticGroup = new THREE.Group();
    scene.add(boardStaticGroup);

    // Chasis metálico inferior biselado
    const chassisGeo = new THREE.BoxGeometry(47.6, 0.9, 27.6);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.82,
      roughness: 0.32,
    });
    const chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
    chassisMesh.position.set(0, -0.55, 0);
    chassisMesh.receiveShadow = !isSoftwareGl;
    boardStaticGroup.add(chassisMesh);

    // Superficie dieléctrica FR-4 oscura
    const deckGeo = new THREE.BoxGeometry(46.0, 0.24, 26.0);
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x09101d,
      metalness: 0.14,
      roughness: 0.68,
    });
    const deckMesh = new THREE.Mesh(deckGeo, deckMat);
    deckMesh.position.set(0, -0.08, 0);
    deckMesh.receiveShadow = !isSoftwareGl;
    boardStaticGroup.add(deckMesh);

    // Rieles de alimentación superior (+) e inferior (-) estilo Protoboard
    const railGeo = new THREE.BoxGeometry(44.4, 0.06, 0.32);
    const posRailMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0x7f1d1d,
      emissiveIntensity: 0.35,
      roughness: 0.4,
    });
    const negRailMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0c4a6e,
      emissiveIntensity: 0.35,
      roughness: 0.4,
    });
    const topRail = new THREE.Mesh(railGeo, posRailMat);
    topRail.position.set(0, 0.05, -12.1);
    boardStaticGroup.add(topRail);

    const bottomRail = new THREE.Mesh(railGeo, negRailMat);
    bottomRail.position.set(0, 0.05, 12.1);
    boardStaticGroup.add(bottomRail);

    // Rejilla milimetrada sobre el banco 3D
    const gridHelper = new THREE.GridHelper(46, 46, 0x1e293b, 0x111c2d);
    gridHelper.position.set(0, 0.05, 0);
    gridHelper.scale.set(1, 1, 26 / 46);
    boardStaticGroup.add(gridHelper);

    // Pernos cilíndricos en las 4 esquinas del chasis
    const boltGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 16);
    const boltMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.9,
      roughness: 0.22,
    });
    [
      [-22.8, -12.8],
      [22.8, -12.8],
      [-22.8, 12.8],
      [22.8, 12.8],
    ].forEach(([bx, bz]) => {
      const bolt = new THREE.Mesh(boltGeo, boltMat);
      bolt.position.set(bx, 0.08, bz);
      boardStaticGroup.add(bolt);
    });

    // Anillo indicador de snap sobre la mesa cuando se arrastra o cablea
    const snapRingGeo = new THREE.RingGeometry(0.55, 0.78, 32);
    snapRingGeo.rotateX(-Math.PI / 2);
    const snapRingMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    const snapRingMesh = new THREE.Mesh(snapRingGeo, snapRingMat);
    snapRingMesh.position.set(0, 0.08, 0);
    snapRingMesh.visible = false;
    scene.add(snapRingMesh);

    // Línea 3D elástica para previsualizar el cable mientras se tiende entre dos terminales
    const previewCurvePoints = [
      new THREE.Vector3(0, 0.5, 0),
      new THREE.Vector3(0, 1.8, 0),
      new THREE.Vector3(1, 0.5, 1),
    ];
    const previewLineGeo = new THREE.BufferGeometry().setFromPoints(previewCurvePoints);
    const previewLineMat = new THREE.LineBasicMaterial({ color: 0x22d3ee });
    const previewLine = new THREE.Line(previewLineGeo, previewLineMat);
    previewLine.visible = false;
    scene.add(previewLine);

    // ========================================================================
    // 2. GRUPOS DINÁMICOS (COMPONENTES 3D, CABLES 3D, SONDAS Y PARTÍCULAS)
    // ========================================================================
    const dynamicRoot = new THREE.Group();
    scene.add(dynamicRoot);

    const particleGroup = new THREE.Group();
    scene.add(particleGroup);

    const clickableTerminals: THREE.Object3D[] = [];
    const clickableComponents: THREE.Object3D[] = [];
    const clickableWires: THREE.Object3D[] = [];

    // Mapa de cuchillas de interruptores y émbolos de pulsadores para interpolación suave
    const switchBladesMap = new Map<string, { pivot: THREE.Object3D; targetAngle: number }>();
    const pushbuttonCapsMap = new Map<string, { cap: THREE.Object3D; targetY: number }>();
    const buzzerRingsMap = new Map<string, THREE.Mesh[]>();
    const disposableTextures: THREE.Texture[] = [];
    const disposableGeometries: THREE.BufferGeometry[] = [];
    const disposableMaterials: THREE.Material[] = [];

    interface ParticlePathSpec {
      curve: THREE.CatmullRomCurve3;
      currentAmps: number;
      isShort: boolean;
      meshes: THREE.Mesh[];
    }
    let activeParticlePaths: ParticlePathSpec[] = [];

    const sharedSphereGeo = new THREE.SphereGeometry(0.2, 14, 14);
    const sharedConeGeo = new THREE.ConeGeometry(0.22, 0.52, 12);
    sharedConeGeo.rotateX(Math.PI / 2);

    const electronMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    });
    const conventionalMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    });
    const shortParticleMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 1.2,
      roughness: 0.15,
    });

    const clearDynamicScene = () => {
      clickableTerminals.length = 0;
      clickableComponents.length = 0;
      clickableWires.length = 0;
      switchBladesMap.clear();
      pushbuttonCapsMap.clear();
      buzzerRingsMap.clear();
      activeParticlePaths = [];

      while (dynamicRoot.children.length > 0) {
        dynamicRoot.remove(dynamicRoot.children[0]);
      }
      while (particleGroup.children.length > 0) {
        particleGroup.remove(particleGroup.children[0]);
      }

      while (disposableTextures.length > 0) {
        disposableTextures.pop()?.dispose();
      }
      while (disposableGeometries.length > 0) {
        disposableGeometries.pop()?.dispose();
      }
      while (disposableMaterials.length > 0) {
        disposableMaterials.pop()?.dispose();
      }
    };

    const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      disposableGeometries.push(g);
      return g;
    };
    const trackMat = <T extends THREE.Material>(m: T): T => {
      disposableMaterials.push(m);
      return m;
    };
    const trackTex = <T extends THREE.Texture>(t: T): T => {
      disposableTextures.push(t);
      return t;
    };

    // Construye una sonda 3D de multímetro (Roja V+ o Negra COM) sobre un terminal
    const buildProbe3D = (pos: THREE.Vector3, isRed: boolean): THREE.Group => {
      const probeGroup = new THREE.Group();
      probeGroup.position.copy(pos);

      const needleGeo = trackGeo(new THREE.ConeGeometry(0.14, 0.75, 14));
      needleGeo.rotateX(Math.PI);
      const needleMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xfbbf24,
          metalness: 0.92,
          roughness: 0.18,
        })
      );
      const needle = new THREE.Mesh(needleGeo, needleMat);
      needle.position.set(0, 0.65, 0);
      probeGroup.add(needle);

      const handleColor = isRed ? 0xef4444 : 0x0284c7;
      const handleGeo = trackGeo(new THREE.CylinderGeometry(0.28, 0.22, 2.2, 18));
      const handleMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: handleColor,
          roughness: 0.35,
          metalness: 0.15,
        })
      );
      const handle = new THREE.Mesh(handleGeo, handleMat);
      handle.position.set(0, 2.05, 0);
      probeGroup.add(handle);

      const guardGeo = trackGeo(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 18));
      const guard = new THREE.Mesh(guardGeo, handleMat);
      guard.position.set(0, 1.02, 0);
      probeGroup.add(guard);

      return probeGroup;
    };

    const rebuildDynamicScene = () => {
      clearDynamicScene();
      const {
        components: currComps,
        wires: currWires,
        solverResult: currSolver,
        voltmeter: currVoltmeter,
        flowMode: currFlowMode,
        selectedCompId: currSelectedComp,
        selectedWireId: currSelectedWire,
        pendingTerminal: currPendingTerm,
      } = propsRef.current;

      const terminalWorldMap: Record<string, THREE.Vector3> = {};

      // 1. Construir cada Componente 3D Compuesto (3 a 12 sub-partes)
      for (const comp of currComps) {
        const compCenter = canvasToWorld3D(comp.x, comp.y, 0);
        const branch = currSolver.branches[comp.id];
        const currentA = branch?.current ?? 0;
        const powerW = branch?.power ?? 0;
        const brightness = branch?.brightness ?? 0;
        const isSelected = comp.id === currSelectedComp;
        const isShort = branch?.isShortPath ?? false;

        const compGroup = new THREE.Group();
        compGroup.position.set(compCenter.x, 0, compCenter.z);
        compGroup.rotation.y = -THREE.MathUtils.degToRad(comp.rotation);
        compGroup.userData = { componentId: comp.id, componentType: comp.type };
        dynamicRoot.add(compGroup);

        // Caja de colisión rápida para selección y arrastre 3D del componente
        const hitBoxGeo = trackGeo(new THREE.BoxGeometry(4.4, 2.2, 2.4));
        const hitBoxMat = trackMat(
          new THREE.MeshBasicMaterial({ visible: false })
        );
        const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
        hitBox.position.set(0, 1.0, 0);
        hitBox.userData = { componentId: comp.id, componentType: comp.type };
        compGroup.add(hitBox);
        clickableComponents.push(hitBox);

        // Halo de selección sobre la mesa 3D si el componente está activo en el inspector
        if (isSelected) {
          const selGeo = trackGeo(new THREE.RingGeometry(2.95, 3.22, 36));
          selGeo.rotateX(-Math.PI / 2);
          const selMat = trackMat(
            new THREE.MeshBasicMaterial({
              color: 0x22d3ee,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.85,
            })
          );
          const selMesh = new THREE.Mesh(selGeo, selMat);
          selMesh.position.set(0, 0.06, 0);
          compGroup.add(selMesh);
        }

        // Zócalo aislante base para anclar el componente al tablero 3D
        const plinthGeo = trackGeo(new THREE.BoxGeometry(5.9, 0.22, 1.85));
        const plinthMat = trackMat(
          new THREE.MeshStandardMaterial({
            color: isSelected ? 0x164e63 : 0x111827,
            metalness: 0.35,
            roughness: 0.55,
          })
        );
        const plinth = new THREE.Mesh(plinthGeo, plinthMat);
        plinth.position.set(0, 0.11, 0);
        plinth.castShadow = !isSoftwareGl;
        plinth.receiveShadow = !isSoftwareGl;
        compGroup.add(plinth);

        // Postes de conexión de latón en Terminal A (-2.8) y Terminal B (+2.8)
        (['A', 'B'] as const).forEach((pin) => {
          const lx = pin === 'A' ? -TERMINAL_LOCAL_X : TERMINAL_LOCAL_X;
          const tId = `${comp.id}:${pin}`;
          const isPending = currPendingTerm === tId;
          const isRedProbe = currVoltmeter.enabled && currVoltmeter.redTerminal === tId;
          const isBlackProbe = currVoltmeter.enabled && currVoltmeter.blackTerminal === tId;

          const postBaseGeo = trackGeo(new THREE.CylinderGeometry(0.36, 0.42, 0.52, 20));
          const postBaseMat = trackMat(
            new THREE.MeshStandardMaterial({
              color: isPending
                ? 0x22d3ee
                : isRedProbe
                ? 0xef4444
                : isBlackProbe
                ? 0x38bdf8
                : pin === 'B' && comp.type === 'battery'
                ? 0xd97706
                : 0x94a3b8,
              metalness: 0.82,
              roughness: 0.24,
              emissive: isPending ? 0x0891b2 : 0x000000,
              emissiveIntensity: isPending ? 0.8 : 0,
            })
          );
          const postMesh = new THREE.Mesh(postBaseGeo, postBaseMat);
          postMesh.position.set(lx, 0.42, 0);
          postMesh.castShadow = !isSoftwareGl;
          compGroup.add(postMesh);

          // Anillo superior moleteado
          const nutGeo = trackGeo(new THREE.CylinderGeometry(0.44, 0.44, 0.16, 6));
          const nutMesh = new THREE.Mesh(nutGeo, postBaseMat);
          nutMesh.position.set(lx, 0.68, 0);
          compGroup.add(nutMesh);

          // Esfera invisible más amplia para clic fácil en el terminal 3D
          const termHitGeo = trackGeo(new THREE.SphereGeometry(0.72, 12, 12));
          const termHitMat = trackMat(new THREE.MeshBasicMaterial({ visible: false }));
          const termHit = new THREE.Mesh(termHitGeo, termHitMat);
          termHit.position.set(lx, 0.6, 0);
          termHit.userData = { terminalId: tId, componentId: comp.id, pin };
          compGroup.add(termHit);
          clickableTerminals.push(termHit);

          terminalWorldMap[tId] = getTerminalWorldPos(comp, pin);
        });

        // Patillas axiales metálicas desde los postes hacia el cuerpo central
        const leadGeo = trackGeo(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 12));
        leadGeo.rotateZ(Math.PI / 2);
        const leadMat = trackMat(
          new THREE.MeshStandardMaterial({
            color: 0xcbd5e1,
            metalness: 0.9,
            roughness: 0.2,
          })
        );
        const leadLeft = new THREE.Mesh(leadGeo, leadMat);
        leadLeft.position.set(-2.1, 0.62, 0);
        compGroup.add(leadLeft);

        const leadRight = new THREE.Mesh(leadGeo, leadMat);
        leadRight.position.set(2.1, 0.62, 0);
        compGroup.add(leadRight);

        // Geometría específica 3D según el tipo de componente
        if (comp.type === 'battery') {
          const batBodyGeo = trackGeo(new THREE.BoxGeometry(3.4, 1.35, 1.55));
          const batBodyMat = trackMat(
            new THREE.MeshStandardMaterial({
              color: isShort ? 0x7f1d1d : 0x0f172a,
              metalness: 0.45,
              roughness: 0.38,
            })
          );
          const batBody = new THREE.Mesh(batBodyGeo, batBodyMat);
          batBody.position.set(0, 0.88, 0);
          batBody.castShadow = !isSoftwareGl;
          compGroup.add(batBody);

          // Bloque positivo cobrizo en el extremo derecho (+B)
          const posCapGeo = trackGeo(new THREE.BoxGeometry(1.05, 1.38, 1.58));
          const posCapMat = trackMat(
            new THREE.MeshStandardMaterial({
              color: 0xd97706,
              metalness: 0.72,
              roughness: 0.28,
            })
          );
          const posCap = new THREE.Mesh(posCapGeo, posCapMat);
          posCap.position.set(1.2, 0.88, 0);
          compGroup.add(posCap);

          // Placa superior con textura CanvasTexture (Voltaje y polaridad)
          const topTex = trackTex(createBatteryTopTexture(comp.voltage ?? 9, isShort, maxAniso));
          const topPlateGeo = trackGeo(new THREE.PlaneGeometry(3.2, 1.35));
          topPlateGeo.rotateX(-Math.PI / 2);
          const topPlateMat = trackMat(
            new THREE.MeshBasicMaterial({ map: topTex })
          );
          const topPlate = new THREE.Mesh(topPlateGeo, topPlateMat);
          topPlate.position.set(0, 1.58, 0);
          compGroup.add(topPlate);
        } else if (comp.type === 'resistor') {
          // Cuerpo cerámico axial con extremos abombados (dog-bone)
          const coreGeo = trackGeo(new THREE.CylinderGeometry(0.46, 0.46, 2.7, 24));
          coreGeo.rotateZ(Math.PI / 2);
          const coreMat = trackMat(
            new THREE.MeshStandardMaterial({
              color: 0xfde68a,
              roughness: 0.42,
              metalness: 0.08,
            })
          );
          const coreMesh = new THREE.Mesh(coreGeo, coreMat);
          coreMesh.position.set(0, 0.72, 0);
          coreMesh.castShadow = !isSoftwareGl;
          compGroup.add(coreMesh);

          const capGeo = trackGeo(new THREE.SphereGeometry(0.5, 20, 20));
          capGeo.scale(0.65, 1.02, 1.02);
          const leftCap = new THREE.Mesh(capGeo, coreMat);
          leftCap.position.set(-1.3, 0.72, 0);
          compGroup.add(leftCap);

          const rightCap = new THREE.Mesh(capGeo, coreMat);
          rightCap.position.set(1.3, 0.72, 0);
          compGroup.add(rightCap);

          // 4 Bandas de color EIA en relieve 3D
          const bands = getEia4Bands(comp.resistance ?? 10);
          const bandOffsets = [-0.85, -0.28, 0.28, 0.88];
          bands.forEach((b, idx) => {
            const bandGeo = trackGeo(new THREE.CylinderGeometry(0.485, 0.485, 0.24, 24));
            bandGeo.rotateZ(Math.PI / 2);
            const bandMat = trackMat(
              new THREE.MeshStandardMaterial({
                color: new THREE.Color(b.hex),
                roughness: 0.3,
                metalness: idx === 3 ? 0.75 : 0.1,
              })
            );
            const bandMesh = new THREE.Mesh(bandGeo, bandMat);
            bandMesh.position.set(bandOffsets[idx], 0.72, 0);
            compGroup.add(bandMesh);
          });
        } else if (comp.type === 'bulb') {
          // Casquillo roscado Edison de latón
          const socketGeo = trackGeo(new THREE.CylinderGeometry(0.75, 0.85, 0.65, 24));
          const socketMat = trackMat(
            new THREE.MeshStandardMaterial({
              color: 0xd97706,
              metalness: 0.85,
              roughness: 0.25,
            })
          );
          const socketMesh = new THREE.Mesh(socketGeo, socketMat);
          socketMesh.position.set(0, 0.52, 0);
          compGroup.add(socketMesh);

          // Collar aislante cerámico negro
          const collarGeo = trackGeo(new THREE.CylinderGeometry(0.58, 0.72, 0.22, 20));
          const collarMat = trackMat(
            new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 })
          );
          const collarMesh = new THREE.Mesh(collarGeo, collarMat);
          collarMesh.position.set(0, 0.92, 0);
          compGroup.add(collarMesh);

          // Filamento de tungsteno incandescente interior
          const filGeo = trackGeo(new THREE.TorusGeometry(0.32, 0.045, 12, 24, Math.PI));
          const isLit = brightness > 0.02 && !comp.isBurnedOut;
          const filMat = trackMat(
            new THREE.MeshStandardMaterial({
              color: comp.isBurnedOut ? 0xef4444 : isLit ? 0xfef08a : 0x94a3b8,
              emissive: comp.isBurnedOut ? 0x7f1d1d : 0xf59e0b,
              emissiveIntensity: isLit ? Math.min(4.0, 0.8 + brightness * 2.8) : 0,
              roughness: 0.3,
            })
          );
          const filMesh = new THREE.Mesh(filGeo, filMat);
          filMesh.position.set(0, 1.38, 0);
          compGroup.add(filMesh);

          // Ampolla esférica de vidrio translúcido (depthWrite: false según guía Three.js)
          const globeGeo = trackGeo(new THREE.SphereGeometry(0.96, 28, 28));
          const globeMat = trackMat(
            new THREE.MeshStandardMaterial({
              color: comp.isBurnedOut
                ? 0x1e293b
                : isLit
                ? 0xfef08a
                : 0xe2e8f0,
              emissive: isLit ? 0xfacc15 : 0x000000,
              emissiveIntensity: isLit ? Math.min(2.2, brightness * 1.45) : 0,
              transparent: true,
              opacity: comp.isBurnedOut ? 0.72 : isLit ? 0.68 : 0.35,
              roughness: 0.12,
              metalness: 0.08,
              depthWrite: false,
            })
          );
          const globeMesh = new THREE.Mesh(globeGeo, globeMat);
          globeMesh.position.set(0, 1.58, 0);
          compGroup.add(globeMesh);

          if (isLit) {
            const bulbLight = new THREE.PointLight(
              0xfde047,
              Math.min(5.0, brightness * 3.6),
              12,
              1.6
            );
            bulbLight.position.set(0, 1.7, 0);
            compGroup.add(bulbLight);
          }
        } else if (comp.type === 'buzzer') {
          const isBuzzing = currSolver.activeBuzzerIds.includes(comp.id);
          const canGeo = trackGeo(new THREE.CylinderGeometry(0.95, 0.95, 1.15, 28));
          const canMat = trackMat(
            new THREE.MeshStandardMaterial({
              color: 0x0f172a,
              roughness: 0.4,
              metalness: 0.25,
            })
          );
          const canMesh = new THREE.Mesh(canGeo, canMat);
          canMesh.position.set(0, 0.76, 0);
          canMesh.castShadow = !isSoftwareGl;
          compGroup.add(canMesh);

          // Diafragma piezoeléctrico metálico central
          const diaphGeo = trackGeo(new THREE.CylinderGeometry(0.52, 0.52, 0.06, 24));
          const diaphMat = trackMat(
            new THREE.MeshStandardMaterial({
              color: isBuzzing ? 0x22d3ee : 0xd97706,
              emissive: isBuzzing ? 0x0891b2 : 0x000000,
              emissiveIntensity: isBuzzing ? 0.9 : 0,
              metalness: 0.85,
              roughness: 0.2,
            })
          );
          const diaphMesh = new THREE.Mesh(diaphGeo, diaphMat);
          diaphMesh.position.set(0, 1.35, 0);
          compGroup.add(diaphMesh);

          if (isBuzzing) {
            const rings: THREE.Mesh[] = [];
            for (let rIdx = 0; rIdx < 2; rIdx++) {
              const rGeo = trackGeo(new THREE.TorusGeometry(0.65 + rIdx * 0.35, 0.04, 10, 28));
              rGeo.rotateX(Math.PI / 2);
              const rMat = trackMat(
                new THREE.MeshBasicMaterial({
                  color: 0x22d3ee,
                  transparent: true,
                  opacity: 0.75 - rIdx * 0.25,
                })
              );
              const rMesh = new THREE.Mesh(rGeo, rMat);
              rMesh.position.set(0, 1.55 + rIdx * 0.35, 0);
              compGroup.add(rMesh);
              rings.push(rMesh);
            }
            buzzerRingsMap.set(comp.id, rings);
          }
        } else if (comp.type === 'switch') {
          // Contactos de horquilla de latón en A (-1.3) y B (+1.3)
          const jawGeo = trackGeo(new THREE.BoxGeometry(0.32, 0.58, 0.42));
          const jawMat = trackMat(
            new THREE.MeshStandardMaterial({
              color: 0xf59e0b,
              metalness: 0.85,
              roughness: 0.22,
            })
          );
          const jawLeft = new THREE.Mesh(jawGeo, jawMat);
          jawLeft.position.set(-1.3, 0.5, 0);
          compGroup.add(jawLeft);

          const jawRight = new THREE.Mesh(jawGeo, jawMat);
          jawRight.position.set(1.3, 0.5, 0);
          compGroup.add(jawRight);

          // Pivote articulado para la cuchilla conductora del interruptor
          const bladePivot = new THREE.Group();
          bladePivot.position.set(-1.3, 0.68, 0);
          const targetAngle = comp.isClosed ? 0 : THREE.MathUtils.degToRad(36);
          bladePivot.rotation.z = targetAngle;
          compGroup.add(bladePivot);

          const bladeGeo = trackGeo(new THREE.BoxGeometry(2.75, 0.14, 0.22));
          const bladeMat = trackMat(
            new THREE.MeshStandardMaterial({
              color: comp.isClosed ? 0x10b981 : 0xf59e0b,
              metalness: 0.78,
              roughness: 0.25,
            })
          );
          const bladeMesh = new THREE.Mesh(bladeGeo, bladeMat);
          bladeMesh.position.set(1.35, 0, 0);
          bladePivot.add(bladeMesh);

          // Mango cilíndrico aislante en el extremo de la cuchilla
          const gripGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.18, 0.75, 16));
          gripGeo.rotateZ(Math.PI / 2);
          const gripMat = trackMat(
            new THREE.MeshStandardMaterial({
              color: comp.isClosed ? 0x059669 : 0xdc2626,
              roughness: 0.4,
            })
          );
          const gripMesh = new THREE.Mesh(gripGeo, gripMat);
          gripMesh.position.set(2.65, 0.06, 0);
          bladePivot.add(gripMesh);

          switchBladesMap.set(comp.id, { pivot: bladePivot, targetAngle });
        } else if (comp.type === 'pushbutton') {
          const housingGeo = trackGeo(new THREE.BoxGeometry(2.3, 0.75, 1.55));
          const housingMat = trackMat(
            new THREE.MeshStandardMaterial({
              color: 0x1e293b,
              roughness: 0.5,
              metalness: 0.3,
            })
          );
          const housing = new THREE.Mesh(housingGeo, housingMat);
          housing.position.set(0, 0.56, 0);
          compGroup.add(housing);

          const bezelGeo = trackGeo(new THREE.CylinderGeometry(0.68, 0.74, 0.2, 24));
          const bezelMat = trackMat(
            new THREE.MeshStandardMaterial({
              color: 0x94a3b8,
              metalness: 0.88,
              roughness: 0.2,
            })
          );
          const bezel = new THREE.Mesh(bezelGeo, bezelMat);
          bezel.position.set(0, 0.98, 0);
          compGroup.add(bezel);

          const capGeo = trackGeo(new THREE.CylinderGeometry(0.54, 0.54, 0.45, 24));
          const capMat = trackMat(
            new THREE.MeshStandardMaterial({
              color: comp.isPressed ? 0x10b981 : 0x0284c7,
              emissive: comp.isPressed ? 0x059669 : 0x000000,
              emissiveIntensity: comp.isPressed ? 0.6 : 0,
              roughness: 0.32,
            })
          );
          const capMesh = new THREE.Mesh(capGeo, capMat);
          const targetY = comp.isPressed ? 1.02 : 1.24;
          capMesh.position.set(0, targetY, 0);
          compGroup.add(capMesh);
          pushbuttonCapsMap.set(comp.id, { cap: capMesh, targetY });
        } else if (comp.type === 'fuse') {
          // Casquillos metálicos laterales del cartucho fusible
          const capGeo = trackGeo(new THREE.CylinderGeometry(0.42, 0.42, 0.55, 20));
          capGeo.rotateZ(Math.PI / 2);
          const capMat = trackMat(
            new THREE.MeshStandardMaterial({
              color: 0xe2e8f0,
              metalness: 0.9,
              roughness: 0.18,
            })
          );
          const leftCap = new THREE.Mesh(capGeo, capMat);
          leftCap.position.set(-1.15, 0.72, 0);
          compGroup.add(leftCap);

          const rightCap = new THREE.Mesh(capGeo, capMat);
          rightCap.position.set(1.15, 0.72, 0);
          compGroup.add(rightCap);

          // Hilo fusible calibrado interior
          if (comp.isBlown) {
            const stubGeo = trackGeo(new THREE.CylinderGeometry(0.05, 0.05, 0.65, 10));
            stubGeo.rotateZ(Math.PI / 2);
            const stubMat = trackMat(
              new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x7f1d1d })
            );
            const stub1 = new THREE.Mesh(stubGeo, stubMat);
            stub1.position.set(-0.6, 0.72, 0);
            stub1.rotation.z = 0.25;
            compGroup.add(stub1);

            const stub2 = new THREE.Mesh(stubGeo, stubMat);
            stub2.position.set(0.6, 0.72, 0);
            stub2.rotation.z = -0.25;
            compGroup.add(stub2);
          } else {
            const wireGeo = trackGeo(new THREE.CylinderGeometry(0.055, 0.055, 1.9, 12));
            wireGeo.rotateZ(Math.PI / 2);
            const wireMat = trackMat(
              new THREE.MeshStandardMaterial({
                color: 0x34d399,
                emissive: 0x059669,
                emissiveIntensity: Math.min(1.5, Math.abs(currentA) * 0.5),
              })
            );
            const fuseWire = new THREE.Mesh(wireGeo, wireMat);
            fuseWire.position.set(0, 0.72, 0);
            compGroup.add(fuseWire);
          }

          // Tubo de vidrio transparente
          const glassGeo = trackGeo(new THREE.CylinderGeometry(0.39, 0.39, 1.85, 24));
          glassGeo.rotateZ(Math.PI / 2);
          const glassMat = trackMat(
            new THREE.MeshStandardMaterial({
              color: comp.isBlown ? 0x450a0a : 0xe0f2fe,
              transparent: true,
              opacity: comp.isBlown ? 0.62 : 0.36,
              roughness: 0.12,
              depthWrite: false,
            })
          );
          const glassTube = new THREE.Mesh(glassGeo, glassMat);
          glassTube.position.set(0, 0.72, 0);
          compGroup.add(glassTube);
        } else if (comp.type === 'ammeter') {
          const boxGeo = trackGeo(new THREE.BoxGeometry(3.2, 1.15, 1.65));
          const boxMat = trackMat(
            new THREE.MeshStandardMaterial({
              color: 0x0b132b,
              metalness: 0.4,
              roughness: 0.45,
            })
          );
          const boxMesh = new THREE.Mesh(boxGeo, boxMat);
          boxMesh.position.set(0, 0.76, 0);
          boxMesh.castShadow = !isSoftwareGl;
          compGroup.add(boxMesh);

          const screenTex = trackTex(createAmmeterScreenTexture(currentA, maxAniso));
          const screenGeo = trackGeo(new THREE.PlaneGeometry(2.85, 1.35));
          screenGeo.rotateX(-Math.PI / 2);
          const screenMat = trackMat(new THREE.MeshBasicMaterial({ map: screenTex }));
          const screenMesh = new THREE.Mesh(screenGeo, screenMat);
          screenMesh.position.set(0, 1.35, 0);
          compGroup.add(screenMesh);
        }

        // Etiqueta flotante 3D (Sprite con CanvasTexture) sobre cada componente
        const valText =
          comp.type === 'battery'
            ? `${comp.voltage ?? 9}V`
            : comp.type === 'resistor' || comp.type === 'bulb'
            ? `${comp.resistance ?? 10}Ω`
            : comp.type === 'fuse'
            ? `${comp.maxCurrentAmps ?? 2}A`
            : '';
        const primaryLabel = `${comp.label}${valText ? ` (${valText})` : ''}`;
        const secondaryLabel = comp.isBurnedOut
          ? 'QUEMADA (>15W)'
          : comp.isBlown
          ? 'FUSIBLE FUNDIDO'
          : comp.type === 'switch'
          ? comp.isClosed
            ? 'CERRADO (ON)'
            : 'ABIERTO (OFF)'
          : `I=${Math.abs(currentA).toFixed(2)}A · P=${powerW.toFixed(1)}W`;

        const accentHex =
          comp.isBurnedOut || comp.isBlown || isShort
            ? '#EF4444'
            : isSelected
            ? '#22D3EE'
            : '#38BDF8';

        const badgeTex = trackTex(
          createTextBadgeTexture(primaryLabel, secondaryLabel, accentHex, '#070B14', maxAniso)
        );
        const spriteMat = trackMat(
          new THREE.SpriteMaterial({
            map: badgeTex,
            transparent: true,
            depthTest: false,
          })
        );
        const badgeSprite = new THREE.Sprite(spriteMat);
        badgeSprite.position.set(0, 2.65, 0);
        badgeSprite.scale.set(4.5, 1.28, 1);
        compGroup.add(badgeSprite);

        // Registrar trayectoria 3D de partículas sobre la rama activa del componente
        if (Math.abs(currentA) >= 0.001) {
          const pA = terminalWorldMap[`${comp.id}:A`];
          const pB = terminalWorldMap[`${comp.id}:B`];
          if (pA && pB) {
            const mid = pA.clone().lerp(pB, 0.5);
            mid.y = 0.82;
            const branchCurve = new THREE.CatmullRomCurve3([pA.clone(), mid, pB.clone()]);
            const pCount = 4;
            const pMeshes: THREE.Mesh[] = [];
            const matToUse = isShort
              ? shortParticleMat
              : currFlowMode === 'electrons'
              ? electronMat
              : conventionalMat;
            const geoToUse = currFlowMode === 'arrows' ? sharedConeGeo : sharedSphereGeo;
            for (let i = 0; i < pCount; i++) {
              const pm = new THREE.Mesh(geoToUse, matToUse);
              particleGroup.add(pm);
              pMeshes.push(pm);
            }
            activeParticlePaths.push({
              curve: branchCurve,
              currentAmps: currentA,
              isShort,
              meshes: pMeshes,
            });
          }
        }
      }

      // 2. Construir cada Cable Conductor 3D (TubeGeometry arqueado sobre la protoboard)
      currWires.forEach((w, wIdx) => {
        const p1 = terminalWorldMap[w.fromTerminal];
        const p2 = terminalWorldMap[w.toTerminal];
        if (!p1 || !p2) return;

        const wState = currSolver.wireStates[w.id];
        const isShort = wState?.isShortPath ?? false;
        const isSelected = w.id === currSelectedWire;
        const dist = p1.distanceTo(p2);
        const archHeight = Math.min(2.4, Math.max(0.75, dist * 0.14 + (wIdx % 3) * 0.12));

        const mid1 = p1.clone().lerp(p2, 0.25);
        mid1.y = 0.55 + archHeight * 0.75;
        const mid2 = p1.clone().lerp(p2, 0.5);
        mid2.y = 0.55 + archHeight;
        const mid3 = p1.clone().lerp(p2, 0.75);
        mid3.y = 0.55 + archHeight * 0.75;

        const curve = new THREE.CatmullRomCurve3([
          p1.clone(),
          mid1,
          mid2,
          mid3,
          p2.clone(),
        ]);

        const tubeGeo = trackGeo(new THREE.TubeGeometry(curve, 28, isSelected || isShort ? 0.15 : 0.115, 12, false));
        const tubeMat = trackMat(
          new THREE.MeshStandardMaterial({
            color: isShort ? 0xef4444 : isSelected ? 0x22d3ee : 0x10b981,
            emissive: isShort ? 0x991b1b : isSelected ? 0x0891b2 : 0x064e3b,
            emissiveIntensity: isShort ? 0.9 : isSelected ? 0.65 : 0.25,
            roughness: 0.35,
            metalness: 0.25,
          })
        );
        const wireMesh = new THREE.Mesh(tubeGeo, tubeMat);
        wireMesh.castShadow = !isSoftwareGl;
        wireMesh.userData = { wireId: w.id };
        dynamicRoot.add(wireMesh);
        clickableWires.push(wireMesh);

        // Partículas 3D sobre el cable activo
        const wCurrent = wState?.current ?? 0;
        if (Math.abs(wCurrent) >= 0.001) {
          const pCount = Math.max(3, Math.min(8, Math.round(dist / 2.2)));
          const pMeshes: THREE.Mesh[] = [];
          const matToUse = isShort
            ? shortParticleMat
            : currFlowMode === 'electrons'
            ? electronMat
            : conventionalMat;
          const geoToUse = currFlowMode === 'arrows' ? sharedConeGeo : sharedSphereGeo;

          for (let i = 0; i < pCount; i++) {
            const pm = new THREE.Mesh(geoToUse, matToUse);
            particleGroup.add(pm);
            pMeshes.push(pm);
          }
          activeParticlePaths.push({
            curve,
            currentAmps: wCurrent,
            isShort,
            meshes: pMeshes,
          });
        }
      });

      // 3. Construir las Sondas 3D del Voltímetro (Roja V+ y Negra COM)
      if (currVoltmeter.enabled) {
        if (currVoltmeter.redTerminal && terminalWorldMap[currVoltmeter.redTerminal]) {
          dynamicRoot.add(buildProbe3D(terminalWorldMap[currVoltmeter.redTerminal], true));
        }
        if (currVoltmeter.blackTerminal && terminalWorldMap[currVoltmeter.blackTerminal]) {
          dynamicRoot.add(buildProbe3D(terminalWorldMap[currVoltmeter.blackTerminal], false));
        }
      }
    };

    sceneSyncRef.current = { rebuildDynamicScene };
    rebuildDynamicScene();

    // ========================================================================
    // 3. INTERACCIÓN 3D: RAYCASTING, DRAG DE COMPONENTES Y CABLEADO DE BORNES
    // ========================================================================
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const planeIntersect = new THREE.Vector3();

    let draggedCompId: string | null = null;
    let dragStartWorld = new THREE.Vector3();
    let pointerMovedDuringDown = false;

    const updatePointerNdc = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      updatePointerNdc(e.clientX, e.clientY);
      raycaster.setFromCamera(pointerNdc, camera);
      pointerMovedDuringDown = false;

      // 1. Priorizar clic en Terminales 3D (A o B) para cablear o colocar sondas
      const termHits = raycaster.intersectObjects(clickableTerminals, false);
      if (termHits.length > 0) {
        const tId = termHits[0].object.userData.terminalId as string;
        if (tId) {
          controls.enabled = false;
          propsRef.current.onTerminalSelect(tId);
          window.setTimeout(() => {
            controls.enabled = true;
          }, 60);
          return;
        }
      }

      // 2. Verificar clic sobre un Componente 3D para seleccionarlo o arrastrarlo sobre el plano X-Z
      const compHits = raycaster.intersectObjects(clickableComponents, false);
      if (compHits.length > 0) {
        const cId = compHits[0].object.userData.componentId as string;
        const cType = compHits[0].object.userData.componentType as SandboxComponentType;
        if (cId) {
          propsRef.current.onSelectComponent(cId);
          propsRef.current.onSelectWire(null);
          if (cType === 'pushbutton') {
            propsRef.current.onPressPushbutton(cId, true);
          }
          if (raycaster.ray.intersectPlane(groundPlane, planeIntersect)) {
            draggedCompId = cId;
            dragStartWorld.copy(planeIntersect);
            controls.enabled = false;
            const found = propsRef.current.components.find((c) => c.id === cId);
            setDraggingLabel(found?.label ?? cId);
          }
          return;
        }
      }

      // 3. Verificar clic sobre un Cable 3D
      const wireHits = raycaster.intersectObjects(clickableWires, false);
      if (wireHits.length > 0) {
        const wId = wireHits[0].object.userData.wireId as string;
        if (wId) {
          propsRef.current.onSelectWire(wId);
          propsRef.current.onSelectComponent(null);
          return;
        }
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      updatePointerNdc(e.clientX, e.clientY);
      raycaster.setFromCamera(pointerNdc, camera);

      if (draggedCompId) {
        if (raycaster.ray.intersectPlane(groundPlane, planeIntersect)) {
          if (planeIntersect.distanceTo(dragStartWorld) > 0.35) {
            pointerMovedDuringDown = true;
          }
          const snappedCanvas = world3DToCanvas(planeIntersect.x, planeIntersect.z);
          const snappedWorld = canvasToWorld3D(snappedCanvas.x, snappedCanvas.y, 0.08);
          snapRingMesh.position.set(snappedWorld.x, 0.08, snappedWorld.z);
          snapRingMesh.visible = true;
          propsRef.current.onMoveComponent(draggedCompId, snappedCanvas.x, snappedCanvas.y);
        }
        return;
      }

      // Si hay un terminal pendiente de cablear, actualizar el arco 3D elástico en vivo
      const pending = propsRef.current.pendingTerminal;
      if (pending && raycaster.ray.intersectPlane(groundPlane, planeIntersect)) {
        const [compId, pin] = pending.split(':') as [string, 'A' | 'B'];
        const comp = propsRef.current.components.find((c) => c.id === compId);
        if (comp) {
          const startPos = getTerminalWorldPos(comp, pin);
          const endPos = new THREE.Vector3(planeIntersect.x, 0.52, planeIntersect.z);
          const midPos = startPos.clone().lerp(endPos, 0.5);
          midPos.y = 1.9;
          const curve = new THREE.CatmullRomCurve3([startPos, midPos, endPos]);
          previewLine.geometry.setFromPoints(curve.getPoints(20));
          previewLine.visible = true;
        }
      } else {
        previewLine.visible = false;
      }

      // Detectar hover sobre terminales o componentes para feedback de cursor
      const termHits = raycaster.intersectObjects(clickableTerminals, false);
      if (termHits.length > 0) {
        const tId = termHits[0].object.userData.terminalId as string;
        const nId = propsRef.current.solverResult.terminalToNode[tId] ?? 'N?';
        renderer.domElement.style.cursor = 'crosshair';
        setHoveredInfo(`Borne ${tId} (${nId}) · Clic para conectar cable o sonda`);
        return;
      }

      const compHits = raycaster.intersectObjects(clickableComponents, false);
      if (compHits.length > 0) {
        const cId = compHits[0].object.userData.componentId as string;
        const comp = propsRef.current.components.find((c) => c.id === cId);
        renderer.domElement.style.cursor = 'grab';
        setHoveredInfo(
          comp
            ? `${comp.label} · Arrastra para mover en 3D${comp.type === 'switch' ? ' · Clic para conmutar' : ''}`
            : null
        );
        return;
      }

      renderer.domElement.style.cursor = 'default';
      setHoveredInfo(null);
    };

    const handlePointerUp = () => {
      if (draggedCompId) {
        const finishedId = draggedCompId;
        const comp = propsRef.current.components.find((c) => c.id === finishedId);
        if (comp && comp.type === 'switch' && !pointerMovedDuringDown) {
          propsRef.current.onToggleSwitch(finishedId);
        }
        if (comp && comp.type === 'pushbutton') {
          propsRef.current.onPressPushbutton(finishedId, false);
        }
        draggedCompId = null;
        snapRingMesh.visible = false;
        setDraggingLabel(null);
        controls.enabled = true;
      }
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    // ========================================================================
    // 4. BUCLE DE ANIMACIÓN 3D CON FENCE-SYNC PARA SOFTWARE WEBGL
    // ========================================================================
    let disposed = false;
    let rafId = 0;
    let timerId = 0;
    const gl = renderer.getContext() as WebGL2RenderingContext;
    const startTimeMs = performance.now();
    let lastTimeMs = startTimeMs;
    let phase = 0;
    const tempPoint = new THREE.Vector3();
    const tempTangent = new THREE.Vector3();
    const upVec = new THREE.Vector3(0, 1, 0);

    const afterDraw = (cb: () => void) => {
      if (!isSoftwareGl || typeof gl.fenceSync !== 'function') {
        rafId = requestAnimationFrame(cb);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        if (!sync) {
          timerId = window.setTimeout(cb, 80);
          return;
        }
        const status = gl.clientWaitSync(sync, 0, 0);
        if (status === gl.CONDITION_SATISFIED || status === gl.ALREADY_SIGNALED) {
          gl.deleteSync(sync);
          timerId = window.setTimeout(cb, 80);
        } else {
          rafId = requestAnimationFrame(poll);
        }
      };
      rafId = requestAnimationFrame(poll);
    };

    const tick = () => {
      if (disposed) return;
      const nowMs = performance.now();
      const dt = Math.min((nowMs - lastTimeMs) / 1000, 0.1);
      lastTimeMs = nowMs;
      const elapsed = (nowMs - startTimeMs) / 1000;

      // Transición suave de cámara hacia el preset elegido
      if (cameraGoalRef.current.active) {
        camera.position.x = THREE.MathUtils.damp(camera.position.x, cameraGoalRef.current.pos.x, 6, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, cameraGoalRef.current.pos.y, 6, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, cameraGoalRef.current.pos.z, 6, dt);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, cameraGoalRef.current.target.x, 6, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, cameraGoalRef.current.target.y, 6, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, cameraGoalRef.current.target.z, 6, dt);
        if (camera.position.distanceTo(cameraGoalRef.current.pos) < 0.08) {
          cameraGoalRef.current.active = false;
        }
      }

      controls.update();

      // Interpolación suave de cuchillas de interruptores y pulsadores
      switchBladesMap.forEach((item) => {
        item.pivot.rotation.z = THREE.MathUtils.damp(item.pivot.rotation.z, item.targetAngle, 12, dt);
      });
      pushbuttonCapsMap.forEach((item) => {
        item.cap.position.y = THREE.MathUtils.damp(item.cap.position.y, item.targetY, 14, dt);
      });
      buzzerRingsMap.forEach((rings) => {
        rings.forEach((rMesh, idx) => {
          const pulse = ((elapsed * 2.2 + idx * 0.5) % 1);
          rMesh.position.y = 1.4 + pulse * 0.9;
          rMesh.scale.setScalar(0.85 + pulse * 0.55);
        });
      });

      // Animación de esferas / conos 3D de flujo de corriente
      const { isRunning: running, solverResult: sRes, flowMode: fMode } = propsRef.current;
      if (running) {
        phase = (phase + dt * (sRes.isShortCircuit ? 2.4 : 0.95)) % 1000;
      }

      for (const pathSpec of activeParticlePaths) {
        const { curve, currentAmps, isShort, meshes } = pathSpec;
        const count = meshes.length;
        const sign =
          fMode === 'electrons'
            ? currentAmps > 0
              ? -1
              : 1
            : currentAmps > 0
            ? 1
            : -1;

        const speed = isShort
          ? 2.8
          : Math.min(2.4, Math.max(0.28, Math.log10(1 + Math.abs(currentAmps) * 6) * 1.1));

        for (let i = 0; i < count; i++) {
          let t = ((i / count) + phase * speed * 0.35 * sign) % 1;
          if (t < 0) t += 1;
          curve.getPointAt(t, tempPoint);
          meshes[i].position.copy(tempPoint);

          if (fMode === 'arrows') {
            curve.getTangentAt(t, tempTangent);
            if (sign < 0) tempTangent.negate();
            meshes[i].quaternion.setFromUnitVectors(upVec, tempTangent.normalize());
          }
        }
      }

      renderer.render(scene, camera);
      afterDraw(tick);
    };

    const handleResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth || 920;
      const h = container.clientHeight || 520;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
      window.removeEventListener('resize', handleResize);
      domElem.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      controls.dispose();
      clearDynamicScene();
      sharedSphereGeo.dispose();
      sharedConeGeo.dispose();
      electronMat.dispose();
      conventionalMat.dispose();
      shortParticleMat.dispose();
      roomEnvTexture.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
    };
  }, []);

  // Reconstruir mallas dinámicas cuando cambian componentes, cables o estado del solver
  useEffect(() => {
    sceneSyncRef.current?.rebuildDynamicScene();
  }, [
    components,
    wires,
    solverResult,
    voltmeter,
    flowMode,
    visualStyle,
    selectedCompId,
    selectedWireId,
    pendingTerminal,
  ]);

  return (
    <div
      className="relative w-full aspect-[16/9] max-h-[480px] min-h-[340px] bg-[#060A12] overflow-hidden select-none"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const compType = e.dataTransfer.getData(
          'application/x-sandbox-component'
        ) as SandboxComponentType;
        if (!compType || !mountRef.current) return;
        const rect = mountRef.current.getBoundingClientRect();
        const normX = (e.clientX - rect.left) / Math.max(1, rect.width);
        const normY = (e.clientY - rect.top) / Math.max(1, rect.height);
        const canvasX = Math.round((80 + normX * 760) / 20) * 20;
        const canvasY = Math.round((80 + normY * 360) / 20) * 20;
        onDropNewComponent(compType, canvasX, canvasY);
      }}
    >
      {/* Lienzo WebGL Three.js 3D */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Píldora inferior de estado de interacción 3D (Sin backdrop-filter sobre WebGL) */}
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
        <div className="px-3 py-1.5 rounded-lg bg-[#090E1A] border border-slate-800 text-slate-300 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-cyan-400" />
          <span>
            {draggingLabel
              ? `Moviendo ${draggingLabel} sobre el banco 3D...`
              : hoveredInfo
              ? hoveredInfo
              : 'Mesa 3D WebGL: Clic izq + arrastrar = Orbitar · Clic en bornes A/B = Cablear · Arrastrar componente = Mover'}
          </span>
        </div>

        {(pendingTerminal || probePlacementTarget) && (
          <button
            type="button"
            onClick={onCancelPending}
            className="pointer-events-auto px-3 py-1.5 rounded-lg bg-rose-950 border border-rose-500 text-rose-200 font-bold cursor-pointer"
          >
            Cancelar Conexión (Esc)
          </button>
        )}
      </div>
    </div>
  );
};
