/**
 * DotField.ts — Motor WebGL2 Nativo (#version 300 es) para el fondo interactivo de ".hub-navbar".
 * Implementa renderizado instanciado (gl.drawArraysInstanced), deformación de lente reactiva (uLens),
 * resplandor exponencial (uGlow), antialiasing con fwidth y mezcla perceptual en espacio Oklab.
 */

export interface DotFieldConfig {
  pattern: 'grid';
  gradientFrom: string;
  gradientTo: string;
  dotRadius: number;
  dotSpacing: number;
  cursorRadius: number;
  bulgeStrength: number;
  glowRadius: number;
  glowColor: string;
  gradientAngle: number;
  twist: number;
  glowIntensity: number;
  baseOpacity: number;
  waveAmplitude: number;
  speed: number;
  interactive: boolean;
}

export const DEFAULT_DOT_FIELD_CONFIG: DotFieldConfig = {
  pattern: 'grid',
  gradientFrom: '#5227FF',
  gradientTo: '#00b537',
  dotRadius: 0.5,
  dotSpacing: 14,
  cursorRadius: 230,
  bulgeStrength: -0.15,
  glowRadius: 120,
  glowColor: '#00d5ff',
  gradientAngle: 158,
  twist: 0,
  glowIntensity: 0.9,
  baseOpacity: 0.55,
  waveAmplitude: 0,
  speed: 1,
  interactive: true,
};

/**
 * Convierte un color hexadecimal (#RRGGBB) a una tupla RGB normalizada [0..1].
 */
export function hexToRgbNormalized(hex: string): [number, number, number] {
  const clean = hex.replace(/^#/, '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) / 255;
    const g = parseInt(clean[1] + clean[1], 16) / 255;
    const b = parseInt(clean[2] + clean[2], 16) / 255;
    return [r, g, b];
  }
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return [0, 0.835, 1];
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  return [r, g, b];
}

/**
 * Calcula la posición desplazada de un punto de la cuadrícula por el efecto de lente (uLens)
 * y el factor de resplandor exponencial (uGlow). Exportado como función pura para pruebas unitarias.
 */
export function computeDotLensAndGlow(
  baseX: number,
  baseY: number,
  cursorX: number,
  cursorY: number,
  cursorActive: number,
  config: DotFieldConfig = DEFAULT_DOT_FIELD_CONFIG
): { x: number; y: number; glow: number } {
  if (!config.interactive || cursorActive <= 0.001) {
    return { x: baseX, y: baseY, glow: 0 };
  }

  const dx = baseX - cursorX;
  const dy = baseY - cursorY;
  const dist = Math.hypot(dx, dy);

  let displacedX = baseX;
  let displacedY = baseY;

  if (dist < config.cursorRadius && dist > 0.0001) {
    const normDist = dist / config.cursorRadius;
    const falloff = 1.0 - normDist;
    const radialMag = config.bulgeStrength * config.cursorRadius * falloff * falloff * normDist;
    const ux = dx / dist;
    const uy = dy / dist;

    if (Math.abs(config.twist) > 0.0001) {
      const angle = config.twist * falloff * falloff;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const rx = dx * cosA - dy * sinA;
      const ry = dx * sinA + dy * cosA;
      displacedX = cursorX + rx + ux * radialMag * cursorActive;
      displacedY = cursorY + ry + uy * radialMag * cursorActive;
    } else {
      displacedX = baseX + ux * radialMag * cursorActive;
      displacedY = baseY + uy * radialMag * cursorActive;
    }
  }

  const sigma = Math.max(1, config.glowRadius);
  const glow =
    Math.exp(-(dist * dist) / (2 * sigma * sigma)) * config.glowIntensity * cursorActive;

  return { x: displacedX, y: displacedY, glow };
}

const VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aCorner;

uniform vec2 uResolution;
uniform vec2 uGridOffset;
uniform int uCols;
uniform float uDotSpacing;
uniform float uDotRadius;
uniform vec4 uLens;        // xy = cursorPos (px), z = cursorRadius, w = bulgeStrength
uniform vec3 uGlow;        // x = glowRadius, y = glowIntensity, z = cursorActive
uniform float uGradientAngle;
uniform float uTwist;
uniform float uWaveAmplitude;
uniform float uTime;
uniform float uSpeed;
uniform float uInteractive;

out vec2 vLocalUv;
out float vDotRadius;
out float vGlow;
out float vGradT;

void main() {
  int col = gl_InstanceID % uCols;
  int row = gl_InstanceID / uCols;

  vec2 basePos = uGridOffset + vec2(float(col), float(row)) * uDotSpacing;

  // Onda armónica opcional
  if (uWaveAmplitude > 0.0001) {
    float phase = float(col) * 0.35 + float(row) * 0.25 + uTime * uSpeed;
    basePos.y += sin(phase) * uWaveAmplitude;
  }

  vec2 pos = basePos;
  float glowFactor = 0.0;
  float active = uGlow.z * uInteractive;

  if (active > 0.001) {
    vec2 toDot = basePos - uLens.xy;
    float dist = length(toDot);
    float cRadius = max(1.0, uLens.z);

    if (dist < cRadius && dist > 0.001) {
      float normD = dist / cRadius;
      float falloff = 1.0 - normD;
      float radialMag = uLens.w * cRadius * (falloff * falloff * normD) * active;
      vec2 dir = toDot / dist;

      if (abs(uTwist) > 0.0001) {
        float ang = uTwist * falloff * falloff * active;
        float ca = cos(ang);
        float sa = sin(ang);
        vec2 rot = vec2(toDot.x * ca - toDot.y * sa, toDot.x * sa + toDot.y * ca);
        pos = uLens.xy + rot + dir * radialMag;
      } else {
        pos = basePos + dir * radialMag;
      }
    }

    float gRadius = max(1.0, uGlow.x);
    glowFactor = exp(-(dist * dist) / (2.0 * gRadius * gRadius)) * uGlow.y * active;
  }

  // Radio visual del punto (garantizando nitidez en pantallas estándar y Retina)
  float effectiveDotRadius = max(1.85, uDotRadius * 3.7) + glowFactor * 1.6;
  float quadHalfSize = effectiveDotRadius + 3.0 + glowFactor * 3.0;

  vec2 vertexPx = pos + aCorner * quadHalfSize;

  // Conversión de coordenadas en píxeles a espacio NDC [-1, 1]
  vec2 ndc = (vertexPx / max(vec2(1.0), uResolution)) * 2.0 - 1.0;
  ndc.y = -ndc.y;

  gl_Position = vec4(ndc, 0.0, 1.0);

  vLocalUv = aCorner * quadHalfSize;
  vDotRadius = effectiveDotRadius;
  vGlow = glowFactor;

  // Proyección angular del gradiente
  float rad = radians(uGradientAngle);
  vec2 gradDir = vec2(cos(rad), sin(rad));
  vec2 normCentered = (basePos / max(vec2(1.0), uResolution)) - 0.5;
  vGradT = clamp(dot(normCentered, gradDir) + 0.5, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec2 vLocalUv;
in float vDotRadius;
in float vGlow;
in float vGradT;

uniform vec3 uGradientFrom;
uniform vec3 uGradientTo;
uniform vec3 uGlowColor;
uniform float uBaseOpacity;

out vec4 fragColor;

// Conversión sRGB lineal <-> Oklab para interpolación perceptual (con piso 1e-5 para evitar log2(0) NaN en GLSL ES 3.0)
vec3 srgbToLinear(vec3 c) {
  return pow(max(c, vec3(1e-5)), vec3(2.2));
}

vec3 linearToSrgb(vec3 c) {
  return pow(max(c, vec3(1e-5)), vec3(1.0 / 2.2));
}

vec3 linearSrgbToOklab(vec3 c) {
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;

  float l_ = pow(max(1e-5, l), 1.0 / 3.0);
  float m_ = pow(max(1e-5, m), 1.0 / 3.0);
  float s_ = pow(max(1e-5, s), 1.0 / 3.0);

  return vec3(
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
  );
}

vec3 oklabToLinearSrgb(vec3 lab) {
  float l_ = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m_ = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s_ = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;

  float l = l_ * l_ * l_;
  float m = m_ * m_ * m_;
  float s = s_ * s_ * s_;

  return vec3(
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

vec3 mixOklab(vec3 colA, vec3 colB, float t) {
  vec3 labA = linearSrgbToOklab(srgbToLinear(colA));
  vec3 labB = linearSrgbToOklab(srgbToLinear(colB));
  vec3 mixedLab = mix(labA, labB, clamp(t, 0.0, 1.0));
  return clamp(linearToSrgb(oklabToLinearSrgb(mixedLab)), 0.0, 1.0);
}

void main() {
  float dist = length(vLocalUv);
  float aa = clamp(fwidth(dist), 0.35, 0.75);
  float coreAlpha = 1.0 - smoothstep(vDotRadius - aa, vDotRadius + aa, dist);

  // Halo exponencial alrededor del punto cuando el cursor ilumina la región
  float haloSigma = max(0.95, vDotRadius * 1.55);
  float haloAlpha = exp(-(dist * dist) / (2.0 * haloSigma * haloSigma)) * vGlow * 0.85;

  float alpha = clamp(coreAlpha * uBaseOpacity + haloAlpha, 0.0, 1.0);
  if (alpha < 0.004) {
    discard;
  }

  vec3 baseColor = mixOklab(uGradientFrom, uGradientTo, vGradT);
  vec3 finalColor = mix(baseColor, uGlowColor, clamp(vGlow * 0.88, 0.0, 1.0));

  fragColor = vec4(finalColor * alpha, alpha);
}
`;

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vsSource: string,
  fsSource: string
): WebGLProgram | null {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export interface DotFieldController {
  canvas: HTMLCanvasElement;
  destroy: () => void;
}

/**
 * Inyecta y ejecuta el lienzo WebGL2 "Dot Field" como capa de fondo pura (z-index: 0)
 * dentro del contenedor `.hub-navbar` indicado.
 */
export function mountDotField(
  container: HTMLElement,
  customConfig?: Partial<DotFieldConfig>
): DotFieldController {
  const config: DotFieldConfig = {
    ...DEFAULT_DOT_FIELD_CONFIG,
    ...customConfig,
  };

  // Evitar lienzos duplicados si se reinicializa
  const existingCanvas = container.querySelector('canvas.dot-field-canvas');
  if (existingCanvas && existingCanvas.parentElement === container) {
    existingCanvas.remove();
  }

  const canvas = document.createElement('canvas');
  canvas.className = 'dot-field-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('data-testid', 'navbar-dot-field-canvas');
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '0';

  container.insertBefore(canvas, container.firstChild);

  const gradFromRgb = hexToRgbNormalized(config.gradientFrom);
  const gradToRgb = hexToRgbNormalized(config.gradientTo);
  const glowRgb = hexToRgbNormalized(config.glowColor);

  let width = Math.max(1, container.clientWidth);
  let height = Math.max(1, container.clientHeight);
  let cols = Math.max(1, Math.floor(width / config.dotSpacing) + 1);
  let rows = Math.max(1, Math.floor(height / config.dotSpacing) + 1);
  let offsetX = (width - (cols - 1) * config.dotSpacing) * 0.5;
  let offsetY = (height - (rows - 1) * config.dotSpacing) * 0.5;

  // Estado del cursor con interpolación suave
  let targetCursorX = width * 0.5;
  let targetCursorY = height * 0.5;
  let currentCursorX = width * 0.5;
  let currentCursorY = height * 0.5;
  let targetCursorActive = 0;
  let currentCursorActive = 0;

  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: true,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });

  let program: WebGLProgram | null = null;
  let vao: WebGLVertexArrayObject | null = null;
  let vbo: WebGLBuffer | null = null;
  let uniforms: Record<string, WebGLUniformLocation | null> = {};

  if (gl) {
    program = createProgram(gl, VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE);
    if (program) {
      vao = gl.createVertexArray();
      vbo = gl.createBuffer();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

      // Quad unitario [-1, 1]^2 (2 triángulos, 6 vértices)
      const quadVertices = new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1,
      ]);
      gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);

      uniforms = {
        uResolution: gl.getUniformLocation(program, 'uResolution'),
        uGridOffset: gl.getUniformLocation(program, 'uGridOffset'),
        uCols: gl.getUniformLocation(program, 'uCols'),
        uDotSpacing: gl.getUniformLocation(program, 'uDotSpacing'),
        uDotRadius: gl.getUniformLocation(program, 'uDotRadius'),
        uLens: gl.getUniformLocation(program, 'uLens'),
        uGlow: gl.getUniformLocation(program, 'uGlow'),
        uGradientAngle: gl.getUniformLocation(program, 'uGradientAngle'),
        uTwist: gl.getUniformLocation(program, 'uTwist'),
        uWaveAmplitude: gl.getUniformLocation(program, 'uWaveAmplitude'),
        uTime: gl.getUniformLocation(program, 'uTime'),
        uSpeed: gl.getUniformLocation(program, 'uSpeed'),
        uInteractive: gl.getUniformLocation(program, 'uInteractive'),
        uGradientFrom: gl.getUniformLocation(program, 'uGradientFrom'),
        uGradientTo: gl.getUniformLocation(program, 'uGradientTo'),
        uGlowColor: gl.getUniformLocation(program, 'uGlowColor'),
        uBaseOpacity: gl.getUniformLocation(program, 'uBaseOpacity'),
      };
    }
  }

  const ctx2d = !gl || !program ? canvas.getContext('2d') : null;

  const updateViewportMetrics = () => {
    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));

    const targetW = Math.max(1, Math.floor(width * dpr));
    const targetH = Math.max(1, Math.floor(height * dpr));
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    cols = Math.max(1, Math.floor(width / config.dotSpacing) + 1);
    rows = Math.max(1, Math.floor(height / config.dotSpacing) + 1);
    offsetX = (width - (cols - 1) * config.dotSpacing) * 0.5;
    offsetY = (height - (rows - 1) * config.dotSpacing) * 0.5;

    if (gl && program) {
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
  };

  updateViewportMetrics();

  const handlePointerMove = (e: MouseEvent) => {
    if (!config.interactive) return;
    const rect = container.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;

    // Detectar proximidad dentro o cerca de la barra de navegación
    const margin = config.cursorRadius * 0.65;
    if (
      localX >= -margin &&
      localX <= rect.width + margin &&
      localY >= -margin &&
      localY <= rect.height + margin
    ) {
      targetCursorX = localX;
      targetCursorY = localY;
      targetCursorActive = 1.0;
    } else {
      targetCursorActive = 0.0;
    }
  };

  const handlePointerLeave = () => {
    targetCursorActive = 0.0;
  };

  window.addEventListener('mousemove', handlePointerMove, { passive: true });
  container.addEventListener('mouseleave', handlePointerLeave, { passive: true });

  const resizeObserver =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateViewportMetrics())
      : null;
  if (resizeObserver) {
    resizeObserver.observe(container);
  }
  window.addEventListener('resize', updateViewportMetrics, { passive: true });

  let animationFrameId = 0;
  let isDestroyed = false;
  const startTime = performance.now();

  const renderFrame = (now: number) => {
    if (isDestroyed) return;
    if (
      Math.abs(width - container.clientWidth) > 1 ||
      Math.abs(height - container.clientHeight) > 1
    ) {
      updateViewportMetrics();
    }
    const elapsedSec = (now - startTime) * 0.001;

    currentCursorX += (targetCursorX - currentCursorX) * 0.22;
    currentCursorY += (targetCursorY - currentCursorY) * 0.22;
    currentCursorActive += (targetCursorActive - currentCursorActive) * 0.14;

    const totalInstances = cols * rows;

    if (gl && program && vao) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      gl.useProgram(program);
      gl.bindVertexArray(vao);

      gl.uniform2f(uniforms.uResolution, width, height);
      gl.uniform2f(uniforms.uGridOffset, offsetX, offsetY);
      gl.uniform1i(uniforms.uCols, cols);
      gl.uniform1f(uniforms.uDotSpacing, config.dotSpacing);
      gl.uniform1f(uniforms.uDotRadius, config.dotRadius);
      gl.uniform4f(
        uniforms.uLens,
        currentCursorX,
        currentCursorY,
        config.cursorRadius,
        config.bulgeStrength
      );
      gl.uniform3f(
        uniforms.uGlow,
        config.glowRadius,
        config.glowIntensity,
        currentCursorActive
      );
      gl.uniform1f(uniforms.uGradientAngle, config.gradientAngle);
      gl.uniform1f(uniforms.uTwist, config.twist);
      gl.uniform1f(uniforms.uWaveAmplitude, config.waveAmplitude);
      gl.uniform1f(uniforms.uTime, elapsedSec);
      gl.uniform1f(uniforms.uSpeed, config.speed);
      gl.uniform1f(uniforms.uInteractive, config.interactive ? 1.0 : 0.0);
      gl.uniform3f(uniforms.uGradientFrom, gradFromRgb[0], gradFromRgb[1], gradFromRgb[2]);
      gl.uniform3f(uniforms.uGradientTo, gradToRgb[0], gradToRgb[1], gradToRgb[2]);
      gl.uniform3f(uniforms.uGlowColor, glowRgb[0], glowRgb[1], glowRgb[2]);
      gl.uniform1f(uniforms.uBaseOpacity, config.baseOpacity);

      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, totalInstances);
      gl.bindVertexArray(null);
    } else if (ctx2d) {
      // Fallback determinista en Canvas 2D cuando el entorno no expone WebGL2
      const dpr = canvas.width / Math.max(1, width);
      ctx2d.save();
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx2d.clearRect(0, 0, width, height);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const bx = offsetX + c * config.dotSpacing;
          const by = offsetY + r * config.dotSpacing;
          const { x, y, glow } = computeDotLensAndGlow(
            bx,
            by,
            currentCursorX,
            currentCursorY,
            currentCursorActive,
            config
          );
          const t = cols > 1 ? c / (cols - 1) : 0.5;
          const cr = Math.round(
            ((gradFromRgb[0] * (1 - t) + gradToRgb[0] * t) * (1 - glow * 0.85) +
              glowRgb[0] * (glow * 0.85)) *
              255
          );
          const cg = Math.round(
            ((gradFromRgb[1] * (1 - t) + gradToRgb[1] * t) * (1 - glow * 0.85) +
              glowRgb[1] * (glow * 0.85)) *
              255
          );
          const cb = Math.round(
            ((gradFromRgb[2] * (1 - t) + gradToRgb[2] * t) * (1 - glow * 0.85) +
              glowRgb[2] * (glow * 0.85)) *
              255
          );
          const alpha = Math.min(1, config.baseOpacity + glow * 0.45);
          const radius = Math.max(1.2, config.dotRadius * 2.4) + glow * 1.1;

          ctx2d.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha.toFixed(3)})`;
          ctx2d.beginPath();
          ctx2d.arc(x, y, radius, 0, Math.PI * 2);
          ctx2d.fill();
        }
      }
      ctx2d.restore();
    }

    animationFrameId = requestAnimationFrame(renderFrame);
  };

  animationFrameId = requestAnimationFrame(renderFrame);

  return {
    canvas,
    destroy: () => {
      isDestroyed = true;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handlePointerMove);
      container.removeEventListener('mouseleave', handlePointerLeave);
      window.removeEventListener('resize', updateViewportMetrics);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (gl) {
        if (vbo) gl.deleteBuffer(vbo);
        if (vao) gl.deleteVertexArray(vao);
        if (program) gl.deleteProgram(program);
      }
      if (canvas.parentElement === container) {
        canvas.remove();
      }
    },
  };
}
