/**
 * DotField.js — Motor WebGL2 Nativo (#version 300 es) para el fondo animado de ".hub-navbar".
 * Cero dependencias externas. Renderizado instanciado a 60 FPS con lente reactiva (uLens),
 * resplandor (uGlow), antialiasing por derivadas (fwidth) e interpolación de color en Oklab.
 */

export const DEFAULT_DOT_FIELD_CONFIG = {
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

export function hexToRgbNormalized(hex) {
  const clean = String(hex).replace(/^#/, '').trim();
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16) / 255,
      parseInt(clean[1] + clean[1], 16) / 255,
      parseInt(clean[2] + clean[2], 16) / 255,
    ];
  }
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return [0, 0.835, 1];
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
}

const VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aCorner;

uniform vec2 uResolution;
uniform vec2 uGridOffset;
uniform int uCols;
uniform float uDotSpacing;
uniform float uDotRadius;
uniform vec4 uLens;
uniform vec3 uGlow;
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

  float effectiveDotRadius = max(1.35, uDotRadius * 2.7) + glowFactor * 1.15;
  float quadHalfSize = effectiveDotRadius + 2.5 + glowFactor * 2.2;

  vec2 vertexPx = pos + aCorner * quadHalfSize;
  vec2 ndc = (vertexPx / max(vec2(1.0), uResolution)) * 2.0 - 1.0;
  ndc.y = -ndc.y;

  gl_Position = vec4(ndc, 0.0, 1.0);

  vLocalUv = aCorner * quadHalfSize;
  vDotRadius = effectiveDotRadius;
  vGlow = glowFactor;

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
  float aa = max(0.35, fwidth(dist));
  float coreAlpha = 1.0 - smoothstep(vDotRadius - aa, vDotRadius + aa, dist);

  float haloSigma = max(0.75, vDotRadius * 1.45);
  float haloAlpha = exp(-(dist * dist) / (2.0 * haloSigma * haloSigma)) * vGlow * 0.75;

  float alpha = clamp(coreAlpha * uBaseOpacity + haloAlpha, 0.0, 1.0);
  if (alpha < 0.004) {
    discard;
  }

  vec3 baseColor = mixOklab(uGradientFrom, uGradientTo, vGradT);
  vec3 finalColor = mix(baseColor, uGlowColor, clamp(vGlow * 0.88, 0.0, 1.0));

  fragColor = vec4(finalColor * alpha, alpha);
}
`;

export function mountDotField(container, customConfig = {}) {
  const config = { ...DEFAULT_DOT_FIELD_CONFIG, ...customConfig };
  const canvas = document.createElement('canvas');
  canvas.className = 'dot-field-canvas';
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '0';
  container.insertBefore(canvas, container.firstChild);
  return { canvas };
}
