import * as THREE from 'three';
import { CelestialBody, DEFAULT_G } from './space-engine';

/**
 * SpaceScene3D.ts (equivalente tipado de SpaceScene3D.js)
 * Renderiza la malla relativista del espacio-tiempo de Einstein utilizando un
 * THREE.ShaderMaterial GLSL personalizado que aplica en GPU la deformación:
 *   z(x, y) = - Σ (G * M_i / sqrt((x - x_i)^2 + (y - y_i)^2 + ε^2))
 * sobre un plano subdividido, integrado con una rejilla holográfica neón estilo sci-fi.
 */

export const MAX_SHADER_BODIES = 12;

export const SPACETIME_VERTEX_SHADER = /* glsl */ `
  uniform vec3 uBodyPositions[${MAX_SHADER_BODIES}];
  uniform float uBodyMasses[${MAX_SHADER_BODIES}];
  uniform int uBodyCount;
  uniform float uG;
  uniform float uEpsilon;
  uniform float uScaleFactor;
  uniform float uSupernovaProgress;

  varying vec2 vUv;
  varying vec2 vWorldXZ;
  varying float vDepth;
  varying float vWaveRipple;

  void main() {
    vUv = uv;
    // El plano base está rotado en X (-PI/2), por lo que position.x y position.z son las coordenadas orbitales
    vec3 displaced = position;
    float totalDeformation = 0.0;
    float epsSq = uEpsilon * uEpsilon;

    for (int i = 0; i < ${MAX_SHADER_BODIES}; i++) {
      if (i < uBodyCount) {
        vec2 delta = displaced.xz - uBodyPositions[i].xz;
        float dist = sqrt(dot(delta, delta) + epsSq);
        totalDeformation -= (uG * uBodyMasses[i] * uScaleFactor) / dist;
      }
    }

    // Limitar la profundidad máxima del pozo gravitacional para mantener estabilidad visual
    totalDeformation = max(-18.5, totalDeformation);

    // Onda gravitacional radial cuando detona una Supernova
    float rDist = length(displaced.xz);
    float waveFront = uSupernovaProgress * 38.0;
    float waveEnv = exp(-pow((rDist - waveFront) * 0.28, 2.0)) * (1.0 - smoothstep(0.75, 1.0, uSupernovaProgress));
    float ripple = sin((rDist - waveFront) * 1.4) * 2.8 * waveEnv * step(0.001, uSupernovaProgress);

    displaced.y += totalDeformation - 1.5 + ripple;

    vDepth = totalDeformation;
    vWorldXZ = displaced.xz;
    vWaveRipple = waveEnv * step(0.001, uSupernovaProgress);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

export const SPACETIME_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uGridDensity;
  uniform float uSupernovaProgress;

  varying vec2 vUv;
  varying vec2 vWorldXZ;
  varying float vDepth;
  varying float vWaveRipple;

  void main() {
    // Normalizar la profundidad relativista (0 = espacio plano, 1 = pozo gravitacional profundo)
    float normDepth = clamp(abs(vDepth) / 7.5, 0.0, 1.0);

    // Paleta Sci-Fi QuantumLabs: Azul Pizarra -> Cian Neón -> Magenta/Púrpura Relativista
    vec3 colorFlat = vec3(0.08, 0.16, 0.28);
    vec3 colorCyan = vec3(0.02, 0.78, 0.95);
    vec3 colorMagenta = vec3(0.72, 0.22, 0.98);
    vec3 colorSupernova = vec3(1.0, 0.65, 0.15);

    vec3 baseColor = mix(
      mix(colorFlat, colorCyan, smoothstep(0.0, 0.45, normDepth)),
      colorMagenta,
      smoothstep(0.42, 1.0, normDepth)
    );
    baseColor = mix(baseColor, colorSupernova, clamp(vWaveRipple * 1.35, 0.0, 1.0));

    // Rejilla neón sci-fi procedural en coordenadas del mundo (X, Z)
    vec2 gridCoord = abs(fract(vWorldXZ * uGridDensity - 0.5) - 0.5);
    float lineDist = min(gridCoord.x, gridCoord.y);
    float gridLine = 1.0 - smoothstep(0.015, 0.075, lineDist);

    // Sub-rejilla secundaria fina + anillos equipotenciales de curvatura
    vec2 subCoord = abs(fract(vWorldXZ * (uGridDensity * 4.0) - 0.5) - 0.5);
    float subLine = (1.0 - smoothstep(0.02, 0.12, min(subCoord.x, subCoord.y))) * 0.28;

    float contourRing = (0.5 + 0.5 * sin(vDepth * 5.5 - uTime * 1.4)) * smoothstep(0.12, 0.7, normDepth) * 0.35;

    float intensity = clamp(gridLine + subLine + contourRing + vWaveRipple * 0.85, 0.0, 1.0);
    vec3 finalColor = mix(baseColor * 0.22, baseColor * 1.45, intensity);

    // Atenuación radial suave en los bordes del tejido espacio-temporal
    float radialDist = length(vWorldXZ) / 34.0;
    float edgeFade = 1.0 - smoothstep(0.78, 1.02, radialDist);

    float alpha = clamp((0.16 + intensity * 0.76) * edgeFade, 0.0, 0.92);
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export interface SpacetimeShaderMeshHandle {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  material: THREE.ShaderMaterial;
  wireOverlay: THREE.LineSegments<THREE.WireframeGeometry, THREE.LineBasicMaterial>;
  group: THREE.Group;
  updateUniforms: (
    bodies: CelestialBody[],
    G: number,
    elapsedSeconds: number,
    epsilon?: number,
    supernovaProgress?: number
  ) => void;
  dispose: () => void;
}

/**
 * Crea el plano subdividido con el ShaderMaterial relativista z(x,y) y su rejilla neón sci-fi.
 */
export function createSpacetimeShaderMesh(isSoftwareGl: boolean = false): SpacetimeShaderMeshHandle {
  const segments = isSoftwareGl ? 44 : 72;
  const planeGeo = new THREE.PlaneGeometry(68, 68, segments, segments);
  planeGeo.rotateX(-Math.PI / 2);

  const initialPositions = Array.from({ length: MAX_SHADER_BODIES }, () => new THREE.Vector3(0, 0, 0));
  const initialMasses = new Float32Array(MAX_SHADER_BODIES);

  const shaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uBodyPositions: { value: initialPositions },
      uBodyMasses: { value: initialMasses },
      uBodyCount: { value: 0 },
      uG: { value: DEFAULT_G },
      uEpsilon: { value: 3.2 },
      uScaleFactor: { value: 0.022 },
      uTime: { value: 0 },
      uGridDensity: { value: 0.35 },
      uSupernovaProgress: { value: 0 },
    },
    vertexShader: SPACETIME_VERTEX_SHADER,
    fragmentShader: SPACETIME_FRAGMENT_SHADER,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(planeGeo, shaderMaterial);
  const group = new THREE.Group();
  group.add(mesh);

  // Wireframe auxiliar sutil para reforzar la lectura geométrica en ángulos rasantes
  const wireGeo = new THREE.WireframeGeometry(new THREE.PlaneGeometry(68, 68, 16, 16).rotateX(-Math.PI / 2));
  const wireMat = new THREE.LineBasicMaterial({
    color: 0x06b6d4,
    transparent: true,
    opacity: 0.14,
  });
  const wireOverlay = new THREE.LineSegments(wireGeo, wireMat);
  wireOverlay.position.y = -1.52;
  group.add(wireOverlay);

  const updateUniforms = (
    bodies: CelestialBody[],
    G: number,
    elapsedSeconds: number,
    epsilon?: number,
    supernovaProgress: number = 0
  ) => {
    const count = Math.min(bodies.length, MAX_SHADER_BODIES);
    const posArr = shaderMaterial.uniforms.uBodyPositions.value as THREE.Vector3[];
    const massArr = shaderMaterial.uniforms.uBodyMasses.value as Float32Array;

    for (let i = 0; i < MAX_SHADER_BODIES; i++) {
      if (i < count) {
        posArr[i].set(bodies[i].position.x, bodies[i].position.y, bodies[i].position.z);
        massArr[i] = bodies[i].mass;
      } else {
        posArr[i].set(0, 0, 0);
        massArr[i] = 0;
      }
    }

    shaderMaterial.uniforms.uBodyCount.value = count;
    shaderMaterial.uniforms.uG.value = G;
    shaderMaterial.uniforms.uTime.value = elapsedSeconds;
    shaderMaterial.uniforms.uSupernovaProgress.value = supernovaProgress;
    if (epsilon !== undefined) {
      shaderMaterial.uniforms.uEpsilon.value = epsilon;
    }
  };

  const dispose = () => {
    planeGeo.dispose();
    shaderMaterial.dispose();
    wireGeo.dispose();
    wireMat.dispose();
  };

  return {
    mesh,
    material: shaderMaterial,
    wireOverlay,
    group,
    updateUniforms,
    dispose,
  };
}

export function updateSpacetimeShaderUniforms(
  bundle: SpacetimeShaderMeshHandle,
  bodies: CelestialBody[],
  G: number,
  elapsedSeconds: number,
  epsilon?: number,
  supernovaProgress: number = 0
): void {
  bundle.updateUniforms(bodies, G, elapsedSeconds, epsilon, supernovaProgress);
}

/**
 * Deforma en tiempo real los vértices 3D (THREE.BufferGeometry) de la malla de un planeta o sonda
 * cuando se aproxima o cruza el Radio de Schwarzschild (r <= r_s) de un Agujero Negro Binario:
 * - Estira asimétricamente el hemisferio frontal hacia la singularidad formando un filamento de marea ("espagueti").
 * - Comprime transversalmente la cintura ecuatorial (efecto de estricción de marea / necking).
 * - Introduce ondas de cizalladura relativista a lo largo del eje mareal local (+X).
 */
export function deformPlanetGeometryForSpaghettification(
  geometry: THREE.BufferGeometry,
  basePositions: Float32Array,
  baseRadius: number,
  stretchFactor: number,
  pinchIntensity: number,
  timeSec: number
): void {
  const posAttr = geometry.attributes.position as THREE.BufferAttribute | undefined;
  if (!posAttr) return;

  const arr = posAttr.array as Float32Array;
  const rInv = 1 / Math.max(0.1, baseRadius);

  if (stretchFactor <= 1.04 && pinchIntensity <= 0.01) {
    // Restaurar geometría esférica nominal
    arr.set(basePositions);
    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
    return;
  }

  const effectivePinch = Math.max(0, Math.min(1.0, pinchIntensity));
  // Acotar el estiramiento geométrico real a un elipsoide/gota de marea físicamente limpio (máx ~2.05x el radio base)
  const boundedStretch = Math.min(2.05, 1.0 + (Math.min(4.2, stretchFactor) - 1.0) * 0.31);
  const baseTransverse = 1.0 / Math.sqrt(boundedStretch);
  const count = posAttr.count;

  for (let i = 0; i < count; i++) {
    const idx = i * 3;
    const bx = basePositions[idx];
    const by = basePositions[idx + 1];
    const bz = basePositions[idx + 2];

    // Coordenada longitudinal normalizada en [-1, 1] a lo largo del vector de marea (+X apunta al Agujero Negro)
    const nx = Math.max(-1, Math.min(1, bx * rInv));

    // Asimetría relativista suave (forma de gota / lágrima de Roche hacia el horizonte de sucesos)
    const frontPull = nx >= 0 ? 1.0 + effectivePinch * 0.24 * nx * nx : 1.0 + effectivePinch * 0.1 * nx * nx;
    const longitudinalScale = Math.min(2.08, boundedStretch * frontPull);

    // Compresión transversal conservando volumen + ligero cuello de marea sin convertir el planeta en una aguja
    const necking = Math.max(0.48, baseTransverse * (1.0 - effectivePinch * 0.22 * Math.exp(-nx * nx * 2.6)));
    const tipTaper = 1.0 - effectivePinch * 0.16 * Math.pow(Math.abs(nx), 1.8);
    const ripple =
      effectivePinch > 0.2
        ? Math.sin(nx * 6.0 - timeSec * 8.0) * 0.035 * effectivePinch * baseRadius
        : 0;

    arr[idx] = bx * longitudinalScale + effectivePinch * 0.08 * baseRadius * (nx * nx * Math.sign(nx));
    arr[idx + 1] = by * necking * tipTaper + ripple * 0.4;
    arr[idx + 2] = bz * necking * tipTaper - ripple * 0.4;
  }

  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();
}


