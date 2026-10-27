import * as THREE from 'three';
import { CelestialBody, DEFAULT_G } from './space-engine';

/**
 * SpaceScene3D.ts (equivalente tipado de SpaceScene3D.js)
 * Renderiza la malla relativista del espacio-tiempo de Einstein utilizando un
 * THREE.ShaderMaterial GLSL personalizado que aplica en GPU la deformación:
 *   z(x, y) = - Σ (G * M_i / sqrt((x - x_i)^2 + (y - y_i)^2 + ε^2))
 * sobre un plano subdividido, integrado con una rejilla holográfica neón estilo sci-fi.
 */

export const MAX_SHADER_BODIES = 8;

export const SPACETIME_VERTEX_SHADER = /* glsl */ `
  uniform vec3 uBodyPositions[${MAX_SHADER_BODIES}];
  uniform float uBodyMasses[${MAX_SHADER_BODIES}];
  uniform int uBodyCount;
  uniform float uG;
  uniform float uEpsilon;
  uniform float uScaleFactor;

  varying vec2 vUv;
  varying vec2 vWorldXZ;
  varying float vDepth;

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
    totalDeformation = max(-14.5, totalDeformation);
    displaced.y += totalDeformation - 1.5;

    vDepth = totalDeformation;
    vWorldXZ = displaced.xz;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

export const SPACETIME_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uGridDensity;

  varying vec2 vUv;
  varying vec2 vWorldXZ;
  varying float vDepth;

  void main() {
    // Normalizar la profundidad relativista (0 = espacio plano, 1 = pozo gravitacional profundo)
    float normDepth = clamp(abs(vDepth) / 7.5, 0.0, 1.0);

    // Paleta Sci-Fi QuantumLabs: Azul Pizarra -> Cian Neón -> Magenta/Púrpura Relativista
    vec3 colorFlat = vec3(0.08, 0.16, 0.28);
    vec3 colorCyan = vec3(0.02, 0.78, 0.95);
    vec3 colorMagenta = vec3(0.72, 0.22, 0.98);

    vec3 baseColor = mix(
      mix(colorFlat, colorCyan, smoothstep(0.0, 0.45, normDepth)),
      colorMagenta,
      smoothstep(0.42, 1.0, normDepth)
    );

    // Rejilla neón sci-fi procedural en coordenadas del mundo (X, Z)
    vec2 gridCoord = abs(fract(vWorldXZ * uGridDensity - 0.5) - 0.5);
    float lineDist = min(gridCoord.x, gridCoord.y);
    float gridLine = 1.0 - smoothstep(0.015, 0.075, lineDist);

    // Sub-rejilla secundaria fina + anillos equipotenciales de curvatura
    vec2 subCoord = abs(fract(vWorldXZ * (uGridDensity * 4.0) - 0.5) - 0.5);
    float subLine = (1.0 - smoothstep(0.02, 0.12, min(subCoord.x, subCoord.y))) * 0.28;

    float contourRing = (0.5 + 0.5 * sin(vDepth * 5.5 - uTime * 1.4)) * smoothstep(0.12, 0.7, normDepth) * 0.35;

    float intensity = clamp(gridLine + subLine + contourRing, 0.0, 1.0);
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
  updateUniforms: (bodies: CelestialBody[], G: number, elapsedSeconds: number, epsilon?: number) => void;
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
    epsilon?: number
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
  epsilon?: number
): void {
  bundle.updateUniforms(bodies, G, elapsedSeconds, epsilon);
}

