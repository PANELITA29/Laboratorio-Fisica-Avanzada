import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeReactionStoichiometry,
  computeIdealGasMetrics,
  validateChemistryChallenge,
  getUniversalIndicatorColor,
  MAX_VESSEL_PRESSURE_ATM,
} from './chemistry-engine';

describe('Módulo 05 — Motor Estequiométrico y Termoquímico (Reactor Químico 3D)', () => {
  it('calcula correctamente el reactivo limitante, exceso y pH = 7.00 en neutralización equimolar HCl + NaOH', () => {
    const res = computeReactionStoichiometry({
      presetId: 'acid-base-neutralization',
      molesA: 2.0,
      molesB: 2.0,
      temperatureK: 298,
      catalystActive: false,
    });

    assert.equal(res.limitingReactant, 'estequiometrico');
    assert.equal(res.excessMolesRemaining, 0);
    assert.equal(res.resultingPH, 7.0);
    assert.equal(res.phIndicatorColorHex, '#10b981');
    assert.ok(Math.abs(res.heatReleasedKJ - 114.6) < 0.1);
    assert.equal(res.isThermalRunawayExplosion, false);
  });

  it('identifica reactivo limitante y pH ácido o básico cuando hay exceso en HCl + NaOH', () => {
    const acidic = computeReactionStoichiometry({
      presetId: 'acid-base-neutralization',
      molesA: 3.0, // HCl en exceso
      molesB: 1.0, // NaOH limitante
      temperatureK: 298,
      catalystActive: false,
    });

    assert.equal(acidic.limitingReactant, 'B');
    assert.ok(Math.abs(acidic.excessMolesRemaining - 2.0) < 1e-6);
    assert.ok(acidic.resultingPH < 2.0);
    assert.equal(getUniversalIndicatorColor(acidic.resultingPH).colorHex, '#ef4444');

    const alkaline = computeReactionStoichiometry({
      presetId: 'acid-base-neutralization',
      molesA: 1.0, // HCl limitante
      molesB: 3.0, // NaOH en exceso
      temperatureK: 298,
      catalystActive: false,
    });

    assert.equal(alkaline.limitingReactant, 'A');
    assert.ok(alkaline.resultingPH > 12.0);
    assert.equal(getUniversalIndicatorColor(alkaline.resultingPH).colorHex, '#a855f7');
  });

  it('dispara explosión exotérmica 3D en Sodio + Agua (2Na + 2H2O) a carga molar alta', () => {
    const res = computeReactionStoichiometry({
      presetId: 'alkali-explosion',
      molesA: 3.0,
      molesB: 4.0,
      temperatureK: 320,
      catalystActive: false,
    });

    assert.equal(res.limitingReactant, 'A');
    assert.ok(Math.abs(res.extentOfReactionMoles - 1.5) < 1e-6);
    assert.ok(res.heatReleasedKJ > 500);
    assert.equal(res.isThermalRunawayExplosion, true);
    assert.ok(res.explosionReasonEs && res.explosionReasonEs.length > 10);
  });

  it('verifica el efecto del catalizador (cinta de Magnesio) en la reacción de Termita Fe2O3 + 2Al', () => {
    const unignited = computeReactionStoichiometry({
      presetId: 'thermite-aluminothermic',
      molesA: 1.2,
      molesB: 2.4,
      temperatureK: 300,
      catalystActive: false,
    });
    assert.equal(unignited.isThermalRunawayExplosion, false);

    const ignitedWithCatalyst = computeReactionStoichiometry({
      presetId: 'thermite-aluminothermic',
      molesA: 1.2,
      molesB: 2.4,
      temperatureK: 300,
      catalystActive: true,
    });
    assert.ok(ignitedWithCatalyst.heatReleasedKJ > 900);
    assert.equal(ignitedWithCatalyst.isThermalRunawayExplosion, true);
  });
});

describe('Módulo 05 — Cámara de Gases Ideales 3D (PV = nRT y Maxwell-Boltzmann)', () => {
  it('calcula presión ideal P = nRT/V y rapidez cuadrática media v_rms según masa molar', () => {
    const helium = computeIdealGasMetrics({
      speciesId: 'He',
      molesN: 2.0,
      temperatureK: 300,
      volumeLiters: 10.0,
    });
    const co2 = computeIdealGasMetrics({
      speciesId: 'CO2',
      molesN: 2.0,
      temperatureK: 300,
      volumeLiters: 10.0,
    });

    // Ambos gases ideales tienen la misma presión a igual n, T, V: P = 2 * 0.082057 * 300 / 10 ≈ 4.923 atm
    assert.ok(Math.abs(helium.idealPressureAtm - 4.9234) < 0.01);
    assert.ok(Math.abs(co2.idealPressureAtm - 4.9234) < 0.01);

    // El Helio (M = 4 g/mol) se mueve mucho más rápido que el CO2 (M = 44 g/mol) a la misma temperatura
    assert.ok(helium.rmsSpeedMetersPerSec > 1300);
    assert.ok(co2.rmsSpeedMetersPerSec < 450);
    assert.equal(helium.isOverpressureExploded, false);
  });

  it('detecta ruptura del cilindro 3D cuando la presión supera 25 atm o al detonar 2H2 + O2', () => {
    const overpressure = computeIdealGasMetrics({
      speciesId: 'N2',
      molesN: 8.5,
      temperatureK: 650,
      volumeLiters: 12.0,
    });

    assert.ok(overpressure.idealPressureAtm > MAX_VESSEL_PRESSURE_ATM);
    assert.equal(overpressure.isOverpressureExploded, true);

    const oxyHydrogenSpark = computeIdealGasMetrics({
      speciesId: 'H2_O2_mix',
      molesN: 3.0,
      temperatureK: 300,
      volumeLiters: 12.0,
      sparkIgnited: true,
    });
    assert.equal(oxyHydrogenSpark.isReactiveDetonated, true);
    assert.equal(oxyHydrogenSpark.isOverpressureExploded, true);
  });

  it('valida los 3 retos experimentales guiados de Química 3D', () => {
    const neutralStoich = computeReactionStoichiometry({
      presetId: 'acid-base-neutralization',
      molesA: 2.0,
      molesB: 2.0,
      temperatureK: 298,
      catalystActive: false,
    });
    const gas18Atm = computeIdealGasMetrics({
      speciesId: 'He',
      molesN: 4.5,
      temperatureK: 480,
      volumeLiters: 10.0,
    });

    const c1 = validateChemistryChallenge(
      'chem-neutralization-ph7',
      'reactor',
      neutralStoich,
      gas18Atm
    );
    assert.equal(c1.passed, true);

    const c2 = validateChemistryChallenge(
      'chem-gas-compression-18atm',
      'gases',
      neutralStoich,
      gas18Atm
    );
    assert.equal(c2.passed, true);
  });
});
