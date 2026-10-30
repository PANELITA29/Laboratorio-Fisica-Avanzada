import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DOT_FIELD_CONFIG,
  hexToRgbNormalized,
  computeDotLensAndGlow,
} from './DotField';

test('DotField default configuration matches exact master specification', () => {
  assert.equal(DEFAULT_DOT_FIELD_CONFIG.pattern, 'grid');
  assert.equal(DEFAULT_DOT_FIELD_CONFIG.gradientFrom, '#5227FF');
  assert.equal(DEFAULT_DOT_FIELD_CONFIG.gradientTo, '#00b537');
  assert.equal(DEFAULT_DOT_FIELD_CONFIG.dotRadius, 0.5);
  assert.equal(DEFAULT_DOT_FIELD_CONFIG.dotSpacing, 14);
  assert.equal(DEFAULT_DOT_FIELD_CONFIG.cursorRadius, 230);
  assert.equal(DEFAULT_DOT_FIELD_CONFIG.bulgeStrength, -0.15);
  assert.equal(DEFAULT_DOT_FIELD_CONFIG.glowRadius, 120);
  assert.equal(DEFAULT_DOT_FIELD_CONFIG.glowColor, '#00d5ff');
  assert.equal(DEFAULT_DOT_FIELD_CONFIG.gradientAngle, 158);
  assert.equal(DEFAULT_DOT_FIELD_CONFIG.twist, 0);
  assert.equal(DEFAULT_DOT_FIELD_CONFIG.glowIntensity, 0.9);
  assert.equal(DEFAULT_DOT_FIELD_CONFIG.baseOpacity, 0.55);
  assert.equal(DEFAULT_DOT_FIELD_CONFIG.waveAmplitude, 0);
  assert.equal(DEFAULT_DOT_FIELD_CONFIG.speed, 1);
  assert.equal(DEFAULT_DOT_FIELD_CONFIG.interactive, true);
});

test('hexToRgbNormalized converts #5227FF, #00b537, and #00d5ff accurately', () => {
  const [r1, g1, b1] = hexToRgbNormalized('#5227FF');
  assert.ok(Math.abs(r1 - 0x52 / 255) < 1e-6);
  assert.ok(Math.abs(g1 - 0x27 / 255) < 1e-6);
  assert.ok(Math.abs(b1 - 1.0) < 1e-6);

  const [r2, g2, b2] = hexToRgbNormalized('#00b537');
  assert.equal(r2, 0);
  assert.ok(Math.abs(g2 - 0xb5 / 255) < 1e-6);
  assert.ok(Math.abs(b2 - 0x37 / 255) < 1e-6);
});

test('computeDotLensAndGlow applies inward lens pull (bulgeStrength = -0.15) and exponential glow near cursor', () => {
  const inactive = computeDotLensAndGlow(100, 30, 140, 30, 0);
  assert.equal(inactive.x, 100);
  assert.equal(inactive.y, 30);
  assert.equal(inactive.glow, 0);

  // When cursor is at (140, 30) and dot is at (100, 30), dx = -40 (within cursorRadius 230).
  // Since bulgeStrength is -0.15 (negative = pinch/pull toward cursor), displaced x should move > 100 toward 140.
  const active = computeDotLensAndGlow(100, 30, 140, 30, 1.0);
  assert.ok(active.x > 100 && active.x < 140, `Expected dot x (${active.x}) to pull toward cursor (140)`);
  assert.equal(active.y, 30);
  assert.ok(active.glow > 0.5 && active.glow <= 0.9, `Expected glow (${active.glow}) in (0.5, 0.9]`);
});
