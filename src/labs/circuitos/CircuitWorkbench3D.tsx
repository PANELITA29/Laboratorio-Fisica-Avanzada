import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CircuitComponent,
  CircuitSolution,
  TopologyAnalysisResult,
  getResistorColorBands,
  getResistorColorBands5,
} from './circuit-engine';

interface CircuitWorkbench3DProps {
  components: CircuitComponent[];
  solution: CircuitSolution;
  topologyResult: TopologyAnalysisResult;
  eiaBandMode?: 4 | 5;
  rcModeActive?: boolean;
  ledBrightness?: number;
  ledBurnedOut?: boolean;
  selectedId: string;
  flowMode: 'electrons' | 'conventional';
  probeRedNode: string;
  probeBlackNode: string;
  activeProbeTip?: 'red' | 'black';
  measuredBranches?: Record<'R1' | 'R2' | 'R3', boolean>;
  revealAllBranches?: boolean;
  maskNominalValues?: boolean;
  onSelectComponent: (id: string) => void;
  onSelectNode?: (nodeId: string) => void;
  onToggleSwitch: (id: string) => void;
  onTogglePowerSupply?: () => void;
  onUpdateComponent?: (id: string, patch: Partial<CircuitComponent>) => void;
}

// Coordenadas espaciales 3D de los 6 postes sobre el banco óptico (plano X-Z, Y arriba)
const NODE_3D_COORDS: Record<string, THREE.Vector3> = {
  n1: new THREE.Vector3(-8, 0.6, -3.5),
  n2: new THREE.Vector3(0, 0.6, -3.5),
  n3: new THREE.Vector3(8, 0.6, -3.5),
  n0: new THREE.Vector3(-8, 0.6, 4.2),
  n4: new THREE.Vector3(0, 0.6, 4.2),
  n5: new THREE.Vector3(8, 0.6, 4.2),
};

export const CircuitWorkbench3D: React.FC<CircuitWorkbench3DProps> = ({
  components,
  solution,
  topologyResult,
  eiaBandMode = 4,
  rcModeActive = false,
  ledBrightness = 0,
  ledBurnedOut = false,
  selectedId,
  flowMode,
  probeRedNode,
  probeBlackNode,
  activeProbeTip = 'red',
  measuredBranches = { R1: false, R2: false, R3: false },
  revealAllBranches = false,
  maskNominalValues = false,
  onSelectComponent,
  onSelectNode,
  onToggleSwitch,
  onTogglePowerSupply,
  onUpdateComponent,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [draggedCompLabel, setDraggedCompLabel] = useState<string | null>(null);

  // Desplazamientos personalizados 3D (Drag & Drop sobre THREE.Plane) para cada componente
  const customOffsetsRef = useRef<Record<string, { dx: number; dz: number }>>({});

  const propsRef = useRef({
    components,
    solution,
    topologyResult,
    eiaBandMode,
    rcModeActive,
    ledBrightness,
    ledBurnedOut,
    selectedId,
    flowMode,
    probeRedNode,
    probeBlackNode,
    activeProbeTip,
    measuredBranches,
    revealAllBranches,
    maskNominalValues,
    onSelectComponent,
    onSelectNode,
    onToggleSwitch,
    onTogglePowerSupply,
    onUpdateComponent,
  });
  propsRef.current = {
    components,
    solution,
    topologyResult,
    eiaBandMode,
    rcModeActive,
    ledBrightness,
    ledBurnedOut,
    selectedId,
    flowMode,
    probeRedNode,
    probeBlackNode,
    activeProbeTip,
    measuredBranches,
    revealAllBranches,
    maskNominalValues,
    onSelectComponent,
    onSelectNode,
    onToggleSwitch,
    onTogglePowerSupply,
    onUpdateComponent,
  };

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

    const width = container.clientWidth || 820;
    const height = container.clientHeight || 460;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b14);
    scene.fog = new THREE.FogExp2(0x070b14, 0.016);

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 200);
    camera.position.set(0, 15.2, 15.5);
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
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 7;
    controls.maxDistance = 34;

    // Iluminación combinada QuantumLabs (Ambient + Directional + PointLights Cian/Púrpura)
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.85);
    keyLight.position.set(8, 18, 10);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.left = -15;
      keyLight.shadow.camera.right = 15;
      keyLight.shadow.camera.top = 11;
      keyLight.shadow.camera.bottom = -11;
      keyLight.shadow.bias = -0.0005;
    }
    scene.add(keyLight);

    const cyanAccent = new THREE.PointLight(0x06b6d4, 1.4, 28);
    cyanAccent.position.set(-10, 6, -6);
    const purpleAccent = new THREE.PointLight(0xa855f7, 1.2, 28);
    purpleAccent.position.set(10, 6, 6);
    scene.add(cyanAccent, purpleAccent);

    // 1. Mesa de Laboratorio Realista con Alfombrilla Antiestática Milimétrica
    const boardGroup = new THREE.Group();
    const tableGeo = new THREE.BoxGeometry(24, 0.7, 15);
    const tableMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.45,
      metalness: 0.28,
    });
    const tableMesh = new THREE.Mesh(tableGeo, tableMat);
    tableMesh.position.y = -0.35;
    tableMesh.receiveShadow = true;
    boardGroup.add(tableMesh);

    // Alfombrilla antiestática azul oscura biselada
    const matGeo = new THREE.BoxGeometry(21.6, 0.08, 12.6);
    const matMat = new THREE.MeshStandardMaterial({
      color: 0x091526,
      roughness: 0.65,
      metalness: 0.1,
    });
    const matMesh = new THREE.Mesh(matGeo, matMat);
    matMesh.position.y = 0.02;
    boardGroup.add(matMesh);

    const gridHelper = new THREE.GridHelper(21, 21, 0x06b6d4, 0x1e293b);
    gridHelper.position.y = 0.07;
    boardGroup.add(gridHelper);
    scene.add(boardGroup);

    // 2. Fuente de Alimentación DC de Sobremesa en 3D con Display LED 7-Segmentos e Interruptor 3D
    const benchSupplyGroup = new THREE.Group();
    benchSupplyGroup.position.set(-6.2, 1.45, -5.8);

    const chassisMesh = new THREE.Mesh(
      new THREE.BoxGeometry(5.6, 2.7, 2.5),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.55, roughness: 0.35 })
    );
    benchSupplyGroup.add(chassisMesh);

    // Display digital LED matricial (CanvasTexture dinámico)
    const ledCanvas = document.createElement('canvas');
    ledCanvas.width = 256;
    ledCanvas.height = 112;
    const ledCtx = ledCanvas.getContext('2d');
    const ledTexture = new THREE.CanvasTexture(ledCanvas);

    const updateBenchSupplyLED = (v: number, i: number, powered: boolean, shortFault: boolean) => {
      if (!ledCtx) return;
      ledCtx.fillStyle = '#040811';
      ledCtx.fillRect(0, 0, 256, 112);
      ledCtx.strokeStyle = shortFault ? '#EF4444' : powered ? '#06B6D4' : '#334155';
      ledCtx.lineWidth = 4;
      ledCtx.strokeRect(4, 4, 248, 104);

      ledCtx.font = 'bold 12px "JetBrains Mono", monospace';
      ledCtx.fillStyle = shortFault ? '#EF4444' : powered ? '#10B981' : '#EF4444';
      ledCtx.fillText(
        shortFault
          ? 'OCP TRIPPED [CORTOCIRCUITO]'
          : powered
          ? 'QUANTUM DC SUPPLY [ON]'
          : 'QUANTUM DC SUPPLY [OFF]',
        14,
        24
      );

      ledCtx.font = 'bold 30px "JetBrains Mono", monospace';
      ledCtx.fillStyle = shortFault ? '#EF4444' : powered ? '#38BDF8' : '#475569';
      ledCtx.fillText(`${powered && !shortFault ? v.toFixed(1) : '00.0'}V`, 14, 64);

      ledCtx.fillStyle = shortFault ? '#EF4444' : powered ? '#F59E0B' : '#475569';
      ledCtx.fillText(`${powered && !shortFault ? i.toFixed(2) : '0.00'}A`, 136, 64);

      ledCtx.font = '11px "JetBrains Mono", monospace';
      ledCtx.fillStyle = shortFault ? '#FCA5A5' : '#94A3B8';
      ledCtx.fillText(
        shortFault
          ? 'SALIDA CORTADA POR CORTO!'
          : `P = ${(powered ? v * i : 0).toFixed(1)} W`,
        14,
        94
      );
      ledTexture.needsUpdate = true;
    };

    const screenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 1.55),
      new THREE.MeshBasicMaterial({ map: ledTexture })
    );
    screenMesh.position.set(-0.65, 0.25, 1.26);
    benchSupplyGroup.add(screenMesh);

    // Perillas rotatorias de ajuste (V / A) y bornes (+ / -)
    const knobGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.28, 20);
    knobGeo.rotateX(Math.PI / 2);
    const knobMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, metalness: 0.7, roughness: 0.25 });
    const knobV = new THREE.Mesh(knobGeo, knobMat);
    knobV.position.set(1.85, 0.55, 1.32);
    const knobA = new THREE.Mesh(knobGeo, knobMat);
    knobA.position.set(1.85, -0.25, 1.32);
    benchSupplyGroup.add(knobV, knobA);

    // Interruptor de encendido interactivo en 3D (power-switch-3d)
    const powerSwitchMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.45, 0.35),
      new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x059669,
        emissiveIntensity: 0.5,
        roughness: 0.25,
      })
    );
    powerSwitchMesh.position.set(-2.1, -0.82, 1.3);
    powerSwitchMesh.userData = { isPowerSwitch3D: true };
    benchSupplyGroup.add(powerSwitchMesh);
    scene.add(benchSupplyGroup);

    // Postes metálicos interactivos de los 6 nodos (permiten colocar las sondas con un clic)
    const postGeo = new THREE.CylinderGeometry(0.32, 0.38, 1.1, 20);
    const ringGeo = new THREE.TorusGeometry(0.45, 0.08, 12, 24);
    ringGeo.rotateX(Math.PI / 2);
    const nodePostMeshes: THREE.Object3D[] = [];

    Object.entries(NODE_3D_COORDS).forEach(([nodeId, pos]) => {
      const nodeGroup = new THREE.Group();
      nodeGroup.position.set(pos.x, 0, pos.z);

      const postMat = new THREE.MeshStandardMaterial({
        color: 0xd97706,
        metalness: 0.85,
        roughness: 0.2,
      });
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.y = 0.55;
      post.userData = { isNodePost3D: true, nodeId };
      nodeGroup.add(post);
      nodePostMeshes.push(post);

      const ringMat = new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x0891b2,
        emissiveIntensity: 0.4,
        roughness: 0.3,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.06;
      ring.userData = { isNodePost3D: true, nodeId };
      nodeGroup.add(ring);
      nodePostMeshes.push(ring);

      scene.add(nodeGroup);
    });

    // Sondas 3D del Multímetro (Roja V+ y Negra COM)
    const createProbe3D = (hexColor: number) => {
      const grp = new THREE.Group();
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.14, 0.7, 16),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.15 })
      );
      tip.rotation.x = Math.PI;
      tip.position.y = 1.45;
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.18, 1.8, 16),
        new THREE.MeshStandardMaterial({ color: hexColor, roughness: 0.35, metalness: 0.1 })
      );
      body.position.y = 2.6;
      grp.add(tip, body);
      return grp;
    };

    const redProbe3D = createProbe3D(0xef4444);
    const blackProbe3D = createProbe3D(0x0284c7);
    scene.add(redProbe3D, blackProbe3D);

    // Ensamblaje 3D Opcional para Modo Transitorio RC + Diodo LED 3D
    const rcAssemblyGroup = new THREE.Group();
    rcAssemblyGroup.position.set(6.2, 0.8, -5.5);
    const capCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.65, 1.6, 24),
      new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.5, roughness: 0.3 })
    );
    capCylinder.position.set(-1.1, 0.3, 0);
    const ledDomeMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.9,
      roughness: 0.15,
    });
    const ledDome = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 20), ledDomeMat);
    ledDome.position.set(1.1, 0.5, 0);
    rcAssemblyGroup.add(capCylinder, ledDome);
    scene.add(rcAssemblyGroup);

    // Contenedor dinámico de componentes 3D y partículas
    const dynamicRoot = new THREE.Group();
    scene.add(dynamicRoot);

    interface ParticleCarrier {
      mesh: THREE.Mesh;
      start: THREE.Vector3;
      mid: THREE.Vector3;
      end: THREE.Vector3;
      compId: string;
      offset: number;
    }

    let particleCarriers: ParticleCarrier[] = [];
    let bulbGlowMap: Record<
      string,
      {
        glassMat: THREE.MeshStandardMaterial;
        filamentMat: THREE.MeshStandardMaterial;
        light: THREE.PointLight;
      }
    > = {};
    let interactableMeshes: THREE.Object3D[] = [];
    let lastStructureKey = '';

    const rebuild3DCircuitScene = () => {
      while (dynamicRoot.children.length > 0) {
        dynamicRoot.remove(dynamicRoot.children[0]);
      }
      particleCarriers = [];
      bulbGlowMap = {};
      interactableMeshes = [powerSwitchMesh, ...nodePostMeshes];

      const {
        components: comps,
        selectedId: selId,
        flowMode: fMode,
        eiaBandMode: bandMode,
        maskNominalValues: maskValues,
      } = propsRef.current;

      comps.forEach((comp) => {
        const pA = NODE_3D_COORDS[comp.nodeA];
        const pB = NODE_3D_COORDS[comp.nodeB];
        if (!pA || !pB) return;

        const customOff = customOffsetsRef.current[comp.id] || { dx: 0, dz: 0 };
        const mid = new THREE.Vector3()
          .addVectors(pA, pB)
          .multiplyScalar(0.5)
          .add(new THREE.Vector3(customOff.dx, 0, customOff.dz));

        const dir = new THREE.Vector3().subVectors(pB, pA);
        const angleY = Math.atan2(dir.x, dir.z);

        const compGroup = new THREE.Group();
        compGroup.position.copy(mid);
        compGroup.rotation.y = angleY;
        compGroup.userData = { compId: comp.id, compType: comp.type, compLabel: comp.label };

        const isSelected = comp.id === selId;

        // Dos tramos de cable flexibles: pA -> mid y mid -> pB
        // Si el componente es un cable donde se eliminó un resistor (type === 'wire' y faultState === 'OPEN'),
        // dejamos una separación física visible en el centro para que el usuario pueda unir las puntas manualmente.
        const isSeparatedCable = comp.type === 'wire' && comp.faultState === 'OPEN';
        const createLeadSegment = (from: THREE.Vector3, to: THREE.Vector3) => {
          const segDir = new THREE.Vector3().subVectors(to, from);
          const segLen = Math.max(0.1, segDir.length());
          const segMid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
          const wireGeo = new THREE.CylinderGeometry(0.095, 0.095, segLen, 12);
          wireGeo.rotateX(Math.PI / 2);
          const wireMat = new THREE.MeshStandardMaterial({
            color:
              comp.type === 'wire' && comp.id.startsWith('res-')
                ? comp.faultState === 'OPEN'
                  ? 0xf59e0b
                  : 0x10b981
                : isSelected
                ? 0x22d3ee
                : 0x475569,
            metalness: 0.78,
            roughness: 0.28,
          });
          const segMesh = new THREE.Mesh(wireGeo, wireMat);
          segMesh.position.copy(segMid);
          segMesh.lookAt(to);
          segMesh.userData = { compId: comp.id, compType: comp.type, compLabel: comp.label };
          dynamicRoot.add(segMesh);
          interactableMeshes.push(segMesh);
        };

        if (isSeparatedCable) {
          const gapEndA = new THREE.Vector3().lerpVectors(pA, mid, 0.76);
          const gapStartB = new THREE.Vector3().lerpVectors(mid, pB, 0.24);
          createLeadSegment(pA, gapEndA);
          createLeadSegment(gapStartB, pB);
        } else {
          createLeadSegment(pA, mid);
          createLeadSegment(mid, pB);
        }

        if (comp.type === 'wire' && comp.id.startsWith('res-')) {
          const isOpen = comp.faultState === 'OPEN';
          // Puntas de cobre pelado y conector de empalme interactivo 3D
          const copperTipMat = new THREE.MeshStandardMaterial({
            color: isOpen ? 0xf59e0b : 0x10b981,
            emissive: isOpen ? 0xd97706 : 0x059669,
            emissiveIntensity: 0.75,
            metalness: 0.85,
            roughness: 0.2,
          });

          if (isOpen) {
            const tipL = new THREE.Mesh(
              new THREE.CylinderGeometry(0.16, 0.16, 0.55, 16).rotateX(Math.PI / 2),
              copperTipMat
            );
            tipL.position.z = -0.65;
            const tipR = new THREE.Mesh(
              new THREE.CylinderGeometry(0.16, 0.16, 0.55, 16).rotateX(Math.PI / 2),
              copperTipMat
            );
            tipR.position.z = 0.65;
            const joinRing = new THREE.Mesh(
              new THREE.TorusGeometry(0.42, 0.08, 12, 24),
              new THREE.MeshStandardMaterial({
                color: 0x22d3ee,
                emissive: 0x06b6d4,
                emissiveIntensity: 0.9,
              })
            );
            [tipL, tipR, joinRing].forEach((m) => {
              m.userData = {
                compId: comp.id,
                compType: comp.type,
                compLabel: comp.label,
                isCableSplice3D: true,
              };
              compGroup.add(m);
              interactableMeshes.push(m);
            });
          } else {
            const spliceSleeve = new THREE.Mesh(
              new THREE.CylinderGeometry(0.24, 0.24, 1.4, 20).rotateX(Math.PI / 2),
              copperTipMat
            );
            spliceSleeve.userData = {
              compId: comp.id,
              compType: comp.type,
              compLabel: comp.label,
              isCableSplice3D: true,
            };
            compGroup.add(spliceSleeve);
            interactableMeshes.push(spliceSleeve);
          }
        } else if (comp.type === 'battery') {
          const batBody = new THREE.Mesh(
            new THREE.CylinderGeometry(0.75, 0.75, 2.8, 24).rotateX(Math.PI / 2),
            new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.5 })
          );
          const copperTop = new THREE.Mesh(
            new THREE.CylinderGeometry(0.76, 0.76, 0.9, 24).rotateX(Math.PI / 2),
            new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.25, metalness: 0.85 })
          );
          copperTop.position.z = comp.polarityInverted ? -0.95 : 0.95;
          const cap = new THREE.Mesh(
            new THREE.CylinderGeometry(0.32, 0.32, 0.35, 16).rotateX(Math.PI / 2),
            new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.15 })
          );
          cap.position.z = comp.polarityInverted ? -1.5 : 1.5;

          [batBody, copperTop, cap].forEach((m) => {
            m.userData = { compId: comp.id, compType: comp.type, compLabel: comp.label };
            compGroup.add(m);
            interactableMeshes.push(m);
          });
        } else if (comp.type === 'resistor') {
          const isOpenFault = !maskValues && comp.faultState === 'OPEN';
          const isShortFault = !maskValues && comp.faultState === 'SHORT';

          const ceramicBody = new THREE.Mesh(
            new THREE.CylinderGeometry(0.56, 0.56, 2.65, 24).rotateX(Math.PI / 2),
            new THREE.MeshStandardMaterial({
              color: maskValues
                ? 0x3b0764
                : isOpenFault
                ? 0x334155
                : bandMode === 5
                ? 0xbae6fd
                : 0xfef3c7,
              roughness: 0.5,
              metalness: 0.08,
              transparent: isOpenFault,
              opacity: isOpenFault ? 0.42 : 1.0,
            })
          );
          ceramicBody.userData = { compId: comp.id, compType: comp.type, compLabel: comp.label };
          compGroup.add(ceramicBody);
          interactableMeshes.push(ceramicBody);

          if (!maskValues) {
            if (bandMode === 5) {
              const bands5 = getResistorColorBands5(comp.resistance);
              const zOff5 = [-0.9, -0.45, 0.0, 0.45, 0.9];
              bands5.forEach((b, idx) => {
                const bandRing = new THREE.Mesh(
                  new THREE.CylinderGeometry(0.58, 0.58, 0.18, 24).rotateX(Math.PI / 2),
                  new THREE.MeshStandardMaterial({
                    color: b.hex,
                    roughness: 0.3,
                    metalness: 0.1,
                    transparent: isOpenFault,
                    opacity: isOpenFault ? 0.35 : 1.0,
                  })
                );
                bandRing.position.z = zOff5[idx];
                bandRing.userData = { compId: comp.id, compType: comp.type, compLabel: comp.label };
                compGroup.add(bandRing);
              });
            } else {
              const bands4 = getResistorColorBands(comp.resistance);
              const zOff4 = [-0.8, -0.3, 0.2, 0.8];
              bands4.forEach((b, idx) => {
                const bandRing = new THREE.Mesh(
                  new THREE.CylinderGeometry(0.58, 0.58, 0.22, 24).rotateX(Math.PI / 2),
                  new THREE.MeshStandardMaterial({
                    color: b.hex,
                    roughness: 0.3,
                    metalness: 0.1,
                    transparent: isOpenFault,
                    opacity: isOpenFault ? 0.35 : 1.0,
                  })
                );
                bandRing.position.z = zOff4[idx];
                bandRing.userData = { compId: comp.id, compType: comp.type, compLabel: comp.label };
                compGroup.add(bandRing);
              });
            }
          }

          if (isOpenFault) {
            const cutGapRing = new THREE.Mesh(
              new THREE.CylinderGeometry(0.68, 0.68, 0.55, 24).rotateX(Math.PI / 2),
              new THREE.MeshStandardMaterial({
                color: 0xf59e0b,
                emissive: 0xd97706,
                emissiveIntensity: 0.9,
                roughness: 0.2,
              })
            );
            cutGapRing.userData = { compId: comp.id, compType: comp.type, compLabel: comp.label };
            compGroup.add(cutGapRing);
          }

          if (isShortFault) {
            const jumperMat = new THREE.MeshStandardMaterial({
              color: 0xf43f5e,
              emissive: 0xe11d48,
              emissiveIntensity: 0.75,
              metalness: 0.85,
              roughness: 0.2,
            });
            const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.95, 12), jumperMat);
            postL.position.set(0, 0.5, -1.4);
            const postR = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.95, 12), jumperMat);
            postR.position.set(0, 0.5, 1.4);
            const bridgeBar = new THREE.Mesh(
              new THREE.CylinderGeometry(0.12, 0.12, 2.9, 14).rotateX(Math.PI / 2),
              jumperMat
            );
            bridgeBar.position.set(0, 0.95, 0);
            compGroup.add(postL, postR, bridgeBar);
          }
        } else if (comp.type === 'bulb') {
          const socketMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.65, 0.65, 0.9, 24),
            new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.85, roughness: 0.25 })
          );
          socketMesh.position.y = 0.35;

          const filamentMat = new THREE.MeshStandardMaterial({
            color: 0xfde047,
            emissive: 0xf59e0b,
            emissiveIntensity: 0.2,
            roughness: 0.2,
          });
          const filamentMesh = new THREE.Mesh(
            new THREE.TorusGeometry(0.32, 0.055, 12, 24),
            filamentMat
          );
          filamentMesh.position.y = 1.35;

          const glassMat = new THREE.MeshStandardMaterial({
            color: 0xfef08a,
            emissive: 0xfacc15,
            emissiveIntensity: 0.1,
            roughness: 0.15,
            metalness: 0.05,
            transparent: true,
            opacity: 0.85,
          });
          const globeMesh = new THREE.Mesh(new THREE.SphereGeometry(1.02, 24, 24), glassMat);
          globeMesh.position.y = 1.42;

          const bulbLight = new THREE.PointLight(0xfde047, 0, 12);
          bulbLight.position.y = 1.6;

          [socketMesh, filamentMesh, globeMesh].forEach((m) => {
            m.userData = { compId: comp.id, compType: comp.type, compLabel: comp.label };
            compGroup.add(m);
            interactableMeshes.push(m);
          });
          compGroup.add(bulbLight);
          bulbGlowMap[comp.id] = { glassMat, filamentMat, light: bulbLight };
        } else if (comp.type === 'switch') {
          const baseBlock = new THREE.Mesh(
            new THREE.BoxGeometry(1.3, 0.35, 2.4),
            new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 })
          );
          const bladePivot = new THREE.Group();
          bladePivot.position.set(0, 0.2, -0.8);
          const blade = new THREE.Mesh(
            new THREE.BoxGeometry(0.22, 0.16, 1.75),
            new THREE.MeshStandardMaterial({ color: 0x10b981, metalness: 0.85, roughness: 0.2 })
          );
          blade.position.z = 0.85;
          bladePivot.add(blade);
          bladePivot.rotation.x = comp.isClosed ? 0 : -0.58;

          [baseBlock, blade].forEach((m) => {
            m.userData = { compId: comp.id, compType: comp.type, compLabel: comp.label };
            interactableMeshes.push(m);
          });
          compGroup.add(baseBlock, bladePivot);
        } else if (comp.type === 'blackbox') {
          const boxMesh = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 1.3, 2.4),
            new THREE.MeshStandardMaterial({
              color: 0x3b0764,
              emissive: 0x581c87,
              emissiveIntensity: 0.35,
              roughness: 0.3,
              metalness: 0.4,
            })
          );
          boxMesh.position.y = 0.45;
          boxMesh.userData = { compId: comp.id, compType: comp.type, compLabel: comp.label };
          compGroup.add(boxMesh);
          interactableMeshes.push(boxMesh);
        }

        dynamicRoot.add(compGroup);

        // Portadores de carga 3D a lo largo de los dos segmentos
        const pGeo = new THREE.SphereGeometry(0.17, 10, 10);
        const pMat = new THREE.MeshBasicMaterial({
          color: fMode === 'electrons' ? 0x38bdf8 : 0xf43f5e,
        });
        const count = 6;
        for (let i = 0; i < count; i++) {
          const pm = new THREE.Mesh(pGeo, pMat);
          dynamicRoot.add(pm);
          particleCarriers.push({
            mesh: pm,
            start: pA,
            mid,
            end: pB,
            compId: comp.id,
            offset: i / count,
          });
        }
      });
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.6);
    const intersectPt = new THREE.Vector3();
    let draggingCompId: string | null = null;
    let dragBaseMid = new THREE.Vector3();
    let dragStartPointerX = 0;
    let dragStartOhms = 20;

    const updatePointer = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const handlePointerDown = (e: MouseEvent) => {
      updatePointer(e);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(interactableMeshes, false);
      if (hits.length > 0) {
        const uData = hits[0].object.userData;
        if (uData.isPowerSwitch3D) {
          propsRef.current.onTogglePowerSupply?.();
          return;
        }
        if (uData.isNodePost3D && uData.nodeId) {
          propsRef.current.onSelectNode?.(uData.nodeId);
          return;
        }
        const { compId, compType, compLabel } = uData;
        if (compId) {
          propsRef.current.onSelectComponent(compId);
          if (compType === 'switch') {
            propsRef.current.onToggleSwitch(compId);
          } else if (compType === 'wire' && compId.startsWith('res-')) {
            // Si el usuario hace clic sobre el cable en 3D donde eliminó el resistor,
            // une o separa manualmente las puntas del cable de corriente.
            const compObj = propsRef.current.components.find((c) => c.id === compId);
            if (compObj) {
              const nextFault = compObj.faultState === 'OPEN' ? 'ON' : 'OPEN';
              const baseName = compId === 'res-1' ? 'R1' : compId === 'res-2' ? 'R2' : 'R3';
              propsRef.current.onUpdateComponent?.(compId, {
                faultState: nextFault,
                label: nextFault === 'ON' ? `Cable ${baseName} (Unido)` : `Cable ${baseName} (Suelto)`,
              });
            }
          } else if (
            (compType === 'resistor' || compType === 'bulb') &&
            !propsRef.current.maskNominalValues
          ) {
            draggingCompId = compId;
            controls.enabled = false;
            const compObj = propsRef.current.components.find((c) => c.id === compId);
            dragStartOhms = compObj?.resistance ?? 20;
            setDraggedCompLabel(`${compLabel || compId} (${dragStartOhms} Ω)`);
            if (compObj) {
              const pA = NODE_3D_COORDS[compObj.nodeA];
              const pB = NODE_3D_COORDS[compObj.nodeB];
              if (pA && pB) {
                dragBaseMid.addVectors(pA, pB).multiplyScalar(0.5);
              }
            }
            if (raycaster.ray.intersectPlane(dragPlane, intersectPt)) {
              dragStartPointerX = intersectPt.x;
            }
          }
        }
      }
    };

    const handlePointerMove = (e: MouseEvent) => {
      if (!draggingCompId) return;
      updatePointer(e);
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(dragPlane, intersectPt)) {
        const dx = Math.max(-3.2, Math.min(3.2, intersectPt.x - dragBaseMid.x));
        const dz = Math.max(-2.6, Math.min(2.6, intersectPt.z - dragBaseMid.z));
        customOffsetsRef.current[draggingCompId] = { dx, dz };
        lastStructureKey = '';

        const compObj = propsRef.current.components.find((c) => c.id === draggingCompId);
        if (compObj && (compObj.type === 'resistor' || compObj.type === 'bulb')) {
          const deltaX = intersectPt.x - dragStartPointerX;
          const nextOhms = Math.max(1, Math.min(100, Math.round(dragStartOhms + deltaX * 14)));
          const pulledOffPosts = Math.abs(dz) > 2.05;
          const nextFault = pulledOffPosts
            ? 'OPEN'
            : compObj.faultState === 'OPEN' && Math.abs(dz) < 1.6
            ? 'ON'
            : compObj.faultState ?? 'ON';

          setDraggedCompLabel(
            pulledOffPosts
              ? `${compObj.label}: DESCONECTADA (ABRIR)`
              : `${compObj.label}: ${nextOhms} Ω (Ajuste Dinámico MNA)`
          );

          if (nextOhms !== compObj.resistance || nextFault !== (compObj.faultState ?? 'ON')) {
            propsRef.current.onUpdateComponent?.(draggingCompId, {
              resistance: nextOhms,
              faultState: nextFault,
            });
          }
        }
      }
    };

    const handlePointerUp = () => {
      if (draggingCompId) {
        draggingCompId = null;
        controls.enabled = true;
        setDraggedCompLabel(null);
      }
    };

    renderer.domElement.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    let frameId = 0;
    let phase = 0;

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
      const {
        components: comps,
        solution: sol,
        topologyResult: topRes,
        eiaBandMode: bandMode,
        rcModeActive: rcActive,
        ledBrightness: ledBr,
        ledBurnedOut: ledBurned,
        selectedId: selId,
        flowMode: fMode,
        probeRedNode: rNode,
        probeBlackNode: bNode,
        maskNominalValues: maskValues,
      } = propsRef.current;

      updateBenchSupplyLED(
        topRes.sourceVoltage,
        topRes.totalCurrent,
        topRes.isPowered,
        topRes.isShortCircuitFault
      );
      (powerSwitchMesh.material as THREE.MeshStandardMaterial).color.setHex(
        topRes.isPowered && !topRes.isShortCircuitFault ? 0x10b981 : 0xef4444
      );
      (powerSwitchMesh.material as THREE.MeshStandardMaterial).emissive.setHex(
        topRes.isPowered && !topRes.isShortCircuitFault ? 0x059669 : 0x991b1b
      );

      rcAssemblyGroup.visible = !!rcActive;
      if (rcActive) {
        ledDomeMat.color.setHex(ledBurned ? 0xef4444 : 0x10b981);
        ledDomeMat.emissive.setHex(ledBurned ? 0x7f1d1d : 0x10b981);
        ledDomeMat.emissiveIntensity = ledBurned ? 0.1 : 0.2 + (ledBr ?? 0) * 2.4;
      }

      const structKey =
        comps
          .map(
            (c) =>
              `${c.id}:${c.type}:${c.resistance}:${c.isClosed}:${c.polarityInverted}:${c.faultState ?? 'ON'}`
          )
          .join('|') + `|${selId}|${fMode}|${bandMode}|${maskValues}`;
      if (structKey !== lastStructureKey) {
        lastStructureKey = structKey;
        rebuild3DCircuitScene();
      }

      const rPos = NODE_3D_COORDS[rNode];
      if (rPos) redProbe3D.position.set(rPos.x, 0, rPos.z);
      const bPos = NODE_3D_COORDS[bNode];
      if (bPos) blackProbe3D.position.set(bPos.x, 0, bPos.z);

      const masterSwitchComp = comps.find((c) => c.id === 'sw-1');
      const isMasterSwitchClosed = masterSwitchComp ? masterSwitchComp.isClosed !== false : true;
      const ocpTripped = topRes.isShortCircuitFault;
      const circuitActive = topRes.isPowered && isMasterSwitchClosed && !ocpTripped;

      const branchById: Record<string, (typeof topRes.branches)[number] | undefined> = {
        'res-1': topRes.branches[0],
        'res-2': topRes.branches[1],
        'res-3': topRes.branches[2],
      };

      Object.entries(bulbGlowMap).forEach(([cId, bulbObj]) => {
        const st = sol.componentStates[cId];
        const bInfo = branchById[cId];
        const isBurned = st?.isBurnedOut || bInfo?.isBurnedOut || false;
        const powerWatts = bInfo ? bInfo.power : st?.power ?? 0;

        if (isBurned) {
          // Filamento fundido por superar 15.0 W: cristal ahumado oscuro y filamento apagado/rojo ceniza
          bulbObj.glassMat.color.setHex(0x1f2937);
          bulbObj.glassMat.emissive.setHex(0x7f1d1d);
          bulbObj.glassMat.emissiveIntensity = 0.25;
          bulbObj.filamentMat.color.setHex(0xef4444);
          bulbObj.filamentMat.emissiveIntensity = 0.4;
          bulbObj.light.intensity = 0;
        } else if (!circuitActive || powerWatts < 0.01) {
          bulbObj.glassMat.color.setHex(0x1e293b);
          bulbObj.glassMat.emissiveIntensity = 0;
          bulbObj.filamentMat.color.setHex(0x475569);
          bulbObj.filamentMat.emissiveIntensity = 0;
          bulbObj.light.intensity = 0;
        } else {
          // Brillo térmico proporcional a P = I² * R respecto a 15.0 W nominales
          const normBr = Math.min(1.6, Math.max(0.15, powerWatts / 15.0));
          bulbObj.glassMat.color.setHex(0xfef08a);
          bulbObj.glassMat.emissive.setHex(0xfacc15);
          bulbObj.glassMat.emissiveIntensity = normBr * 2.5;
          bulbObj.filamentMat.color.setHex(0xffffff);
          bulbObj.filamentMat.emissiveIntensity = normBr * 3.5;
          bulbObj.light.intensity = normBr * 6.0;
        }
      });

      const branchCurrentById: Record<string, number> = {
        'res-1': topRes.branches[0]?.current ?? 0,
        'res-2': topRes.branches[1]?.current ?? 0,
        'res-3': topRes.branches[2]?.current ?? 0,
      };

      phase = (phase + 0.014) % 1000;
      particleCarriers.forEach((pc) => {
        const st = sol.componentStates[pc.compId];
        const compObj = comps.find((c) => c.id === pc.compId);

        let curr = 0;
        if (circuitActive && !st?.isBurnedOut) {
          if (pc.compId in branchCurrentById) {
            curr = branchCurrentById[pc.compId];
          } else {
            curr = topRes.totalCurrent;
          }
        }

        if (compObj?.faultState === 'OPEN' || st?.isBurnedOut || Math.abs(curr) < 0.0005) {
          pc.mesh.visible = false;
          return;
        }
        pc.mesh.visible = true;
        const dirSign = fMode === 'electrons' ? (curr > 0 ? -1 : 1) : curr > 0 ? 1 : -1;
        const speed = Math.min(3.0, Math.max(0.35, Math.abs(curr) * 7));
        let t = (pc.offset + phase * speed * 0.25 * dirSign) % 1;
        if (t < 0) t += 1;
        if (t < 0.5) {
          pc.mesh.position.lerpVectors(pc.start, pc.mid, t * 2);
        } else {
          pc.mesh.position.lerpVectors(pc.mid, pc.end, (t - 0.5) * 2);
        }
        pc.mesh.position.y += 0.22;
      });

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
      const w = container.clientWidth || 820;
      const h = container.clientHeight || 460;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="w-full h-full relative select-none">
      <div
        ref={mountRef}
        data-testid="circuit-3d-canvas"
        className="w-full h-full"
      />

      {/* Floating 3D Telemetry Badges for R1, R2, R3 */}
      <div className="absolute top-3 left-3 right-3 pointer-events-none flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {topologyResult.branches.map((b) => {
            const isRevealed = revealAllBranches || measuredBranches[b.branchId];
            return (
              <div
                key={b.branchId}
                className={`px-2.5 py-1 rounded-md border text-[10px] font-mono ${
                  b.isBurnedOut
                    ? 'bg-rose-950/95 border-rose-400 text-rose-200'
                    : !maskNominalValues && b.faultState === 'SHORT'
                    ? 'bg-rose-950/90 border-rose-500 text-rose-200'
                    : !maskNominalValues && b.faultState === 'OPEN'
                    ? 'bg-amber-950/90 border-amber-500 text-amber-200'
                    : 'bg-[#090D16]/90 border-slate-700 text-slate-200'
                }`}
              >
                <span className="font-bold text-cyan-300">
                  {b.componentType === 'bulb'
                    ? `💡 ${b.branchId}`
                    : b.componentType === 'wire'
                    ? b.faultState === 'OPEN'
                      ? `✂️ Cable ${b.branchId}`
                      : `🔗 Cable ${b.branchId}`
                    : b.branchId}
                </span>{' '}
                (
                {maskNominalValues
                  ? '??? Ω'
                  : b.componentType === 'wire'
                  ? b.faultState === 'OPEN'
                    ? 'Suelto'
                    : 'Unido 0Ω'
                  : `${b.nominalOhms}Ω`}
                ):{' '}
                {isRevealed ? (
                  <>
                    <span>{b.voltageDrop.toFixed(1)}V</span> · <span>{b.current.toFixed(2)}A</span> ·{' '}
                    <span className="text-emerald-300">{b.power.toFixed(1)}W</span>
                  </>
                ) : (
                  <span className="text-amber-300">🔒 Mide con sondas</span>
                )}
                {b.isBurnedOut && (
                  <span className="ml-1 font-bold uppercase text-rose-300">
                    [🔥 FILAMENTO FUNDIDO &gt;15W]
                  </span>
                )}
                {!maskNominalValues && !b.isBurnedOut && b.componentType === 'wire' && (
                  <span className="ml-1 font-bold uppercase text-cyan-300">
                    [{b.faultState === 'OPEN' ? 'CLIC PARA UNIR CABLE' : 'CABLE UNIDO DIRECTO'}]
                  </span>
                )}
                {!maskNominalValues && !b.isBurnedOut && b.componentType !== 'wire' && b.faultState !== 'ON' && (
                  <span className="ml-1 font-bold uppercase text-amber-300">
                    [{b.faultState === 'OPEN' ? 'CORTADA / ABIERTA' : 'PUENTEADA / CORTO'}]
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {draggedCompLabel && (
          <div className="px-2.5 py-1 rounded-md bg-cyan-500 text-slate-950 font-mono font-bold text-[10px]">
            Arrastrando en Plano 3D: {draggedCompLabel}
          </div>
        )}
      </div>

      {/* Real-Time 3D Fault Status Overlay Banner at Bottom of 3D Viewport */}
      {!maskNominalValues && (topologyResult.isShortCircuitFault || topologyResult.isOpenCircuitFault) && (
        <div className="absolute bottom-3 left-3 right-3 pointer-events-none">
          {topologyResult.isShortCircuitFault ? (
            <div
              data-testid="ocp-short-circuit-banner"
              className="px-3.5 py-2 rounded-lg bg-rose-950/95 border border-rose-500 text-rose-100 text-[11px] font-mono flex items-center justify-between gap-2 shadow-lg"
            >
              <span>
                ⚡ PROTECCIÓN OCP DISPARADA (CORTOCIRCUITO FRANCO R_eq → 0 Ω): La fuente bloqueó la salida y detuvo los electrones para evitar incendio por Efecto Joule.
              </span>
              <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold shrink-0">
                CIRCUITO DETENIDO
              </span>
            </div>
          ) : (
            <div
              data-testid="open-circuit-banner"
              className="px-3.5 py-2 rounded-lg bg-amber-950/95 border border-amber-500/80 text-amber-100 text-[11px] font-mono flex items-center justify-between gap-2 shadow-lg"
            >
              <span>
                ✂️ TRAYECTORIA ABIERTA (R → ∞):{' '}
                {topologyResult.totalCurrent < 0.0005
                  ? 'Malla en serie interrumpida (I_T = 0.00 A). Electrones detenidos.'
                  : 'Rama abierta sin paso de electrones (I_rama = 0.00 A); las demás ramas siguen activas.'}
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold shrink-0">
                {topologyResult.totalCurrent < 0.0005 ? 'FLUJO CERO (0 A)' : 'RAMA ABIERTA'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

