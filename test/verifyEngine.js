/**
 * test/verifyEngine.js
 * Script de Verificación y Pruebas Unitarias del Motor Físico y Matemático.
 */

import { CircuitEngine } from '../js/engine/CircuitEngine.js';
import { QUIZ_QUESTIONS } from '../data/questions.js';
import { THEORY_MODULES } from '../data/theoryData.js';

console.log('🧪 Iniciando Verificación de Consistencia Física y Lógica...\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

// --------------------------------------------------------------------------
// PRUEBA 1: Circuito Serie Estándar (12V, R1=10, R2=20, R3=30)
// --------------------------------------------------------------------------
console.log('--- Test 1: Circuito Serie Estándar (12V, 10Ω, 20Ω, 30Ω) ---');
const resSeries = CircuitEngine.calculate({
  topology: 'series',
  voltage: 12,
  resistors: [10, 20, 30],
  switches: ['ON', 'ON', 'ON']
});

assert(resSeries.req === 60, `Req debe ser 60Ω (Obtenido: ${resSeries.req}Ω)`);
assert(Math.abs(resSeries.it - 0.2) < 0.001, `Corriente total debe ser 0.2A (Obtenido: ${resSeries.it}A)`);
assert(Math.abs(resSeries.pt - 2.4) < 0.001, `Potencia total debe ser 2.4W (Obtenido: ${resSeries.pt}W)`);
assert(resSeries.branches[0].v === 2.0, `V1 = 2V (Obtenido: ${resSeries.branches[0].v}V)`);
assert(resSeries.branches[1].v === 4.0, `V2 = 4V (Obtenido: ${resSeries.branches[1].v}V)`);
assert(resSeries.branches[2].v === 6.0, `V3 = 6V (Obtenido: ${resSeries.branches[2].v}V)`);
assert(resSeries.kvlCheck.holds === true, 'Verificación LVK (Suma de caídas de tensión = 12V)');
assert(resSeries.kclCheck.holds === true, 'Verificación LCK (Corriente idéntica en toda la malla)');

// --------------------------------------------------------------------------
// PRUEBA 2: Circuito Paralelo (12V, R1=10, R2=20, R3=30)
// --------------------------------------------------------------------------
console.log('\n--- Test 2: Circuito Paralelo (12V, 10Ω, 20Ω, 30Ω) ---');
const resParallel = CircuitEngine.calculate({
  topology: 'parallel',
  voltage: 12,
  resistors: [10, 20, 30],
  switches: ['ON', 'ON', 'ON']
});

// 1/Req = 1/10 + 1/20 + 1/30 = 11/60 => Req = 60/11 = 5.4545...
const expectedReq = 60 / 11;
assert(Math.abs(resParallel.req - expectedReq) < 0.01, `Req paralelo debe ser ~5.45Ω (Obtenido: ${resParallel.req}Ω)`);
assert(resParallel.branches[0].v === 12.0, 'V1 debe ser igual a la fuente (12V)');
assert(resParallel.branches[1].v === 12.0, 'V2 debe ser igual a la fuente (12V)');
assert(resParallel.branches[2].v === 12.0, 'V3 debe ser igual a la fuente (12V)');
assert(Math.abs(resParallel.branches[0].i - 1.2) < 0.01, 'I1 = 12/10 = 1.2A');
assert(Math.abs(resParallel.branches[1].i - 0.6) < 0.01, 'I2 = 12/20 = 0.6A');
assert(Math.abs(resParallel.branches[2].i - 0.4) < 0.01, 'I3 = 12/30 = 0.4A');
assert(Math.abs(resParallel.it - 2.2) < 0.01, `IT debe ser 1.2+0.6+0.4 = 2.2A (Obtenido: ${resParallel.it}A)`);
assert(resParallel.kvlCheck.holds === true, 'LVK verificado en paralelo');
assert(resParallel.kclCheck.holds === true, 'LCK verificado en paralelo');

// --------------------------------------------------------------------------
// PRUEBA 3: Circuito Mixto (R1 en serie con R2 || R3)
// --------------------------------------------------------------------------
console.log('\n--- Test 3: Circuito Mixto (12V, R1=10Ω, R2=20Ω, R3=20Ω) ---');
const resMixed = CircuitEngine.calculate({
  topology: 'mixed',
  voltage: 12,
  resistors: [10, 20, 20], // R2 || R3 = 10Ω => Req = 10 + 10 = 20Ω
  switches: ['ON', 'ON', 'ON']
});

assert(resMixed.req === 20, `Req mixto debe ser 20Ω (Obtenido: ${resMixed.req}Ω)`);
assert(Math.abs(resMixed.it - 0.6) < 0.001, `IT debe ser 12/20 = 0.6A (Obtenido: ${resMixed.it}A)`);
assert(Math.abs(resMixed.branches[0].v - 6.0) < 0.01, `V_R1 = 0.6*10 = 6V (Obtenido: ${resMixed.branches[0].v}V)`);
assert(Math.abs(resMixed.branches[1].v - 6.0) < 0.01, `V_R2 = 6V (Obtenido: ${resMixed.branches[1].v}V)`);
assert(Math.abs(resMixed.branches[1].i - 0.3) < 0.01, `I2 = 6/20 = 0.3A (Obtenido: ${resMixed.branches[1].i}A)`);
assert(Math.abs(resMixed.branches[2].i - 0.3) < 0.01, `I3 = 6/20 = 0.3A (Obtenido: ${resMixed.branches[2].i}A)`);
assert(resMixed.kclCheck.holds === true, 'LCK verificado en nodo mixto (I1 = I2 + I3)');

// --------------------------------------------------------------------------
// PRUEBA 4: Análisis de Fallas (Circuito Abierto en R2)
// --------------------------------------------------------------------------
console.log('\n--- Test 4: Falla de Circuito Abierto en Serie vs Paralelo ---');
const resSeriesOpen = CircuitEngine.calculate({
  topology: 'series',
  voltage: 12,
  resistors: [10, 20, 30],
  switches: ['ON', 'OPEN', 'ON']
});
assert(resSeriesOpen.isOpenCircuit === true, 'Detección de circuito abierto en serie');
assert(resSeriesOpen.it === 0, 'Corriente total debe colapsar a 0A en serie abierto');

const resParallelOpen = CircuitEngine.calculate({
  topology: 'parallel',
  voltage: 12,
  resistors: [10, 20, 30],
  switches: ['ON', 'OPEN', 'ON']
});
// Solo R1 (10) y R3 (30) activos: 1/Req = 1/10 + 1/30 = 4/30 => Req = 7.5Ω
assert(Math.abs(resParallelOpen.req - 7.5) < 0.01, `Req paralelo con R2 abierto debe ser 7.5Ω (Obtenido: ${resParallelOpen.req}Ω)`);
assert(Math.abs(resParallelOpen.it - 1.6) < 0.01, `IT en paralelo debe ser 12/7.5 = 1.6A (Obtenido: ${resParallelOpen.it}A)`);

// --------------------------------------------------------------------------
// PRUEBA 5: Integridad del Banco de Preguntas y Teoría
// --------------------------------------------------------------------------
console.log('\n--- Test 5: Integridad del Banco de Preguntas y Teoría ---');
assert(QUIZ_QUESTIONS.length === 10, `Debe haber exactamente 10 preguntas completas (Total: ${QUIZ_QUESTIONS.length})`);
QUIZ_QUESTIONS.forEach(q => {
  assert(q.options.length === 4, `Pregunta ${q.id} tiene 4 opciones [A, B, C, D]`);
  assert(Boolean(q.correctAnswer), `Pregunta ${q.id} tiene respuesta correcta definida (${q.correctAnswer})`);
  assert(Boolean(q.justification.explanation), `Pregunta ${q.id} tiene justificación teórica simple`);
  assert(Boolean(q.justification.realWorldTip), `Pregunta ${q.id} tiene aplicación en la vida real`);
});

assert(Boolean(THEORY_MODULES.ohm), 'Módulo teórico Ley de Ohm presente');
assert(Boolean(THEORY_MODULES.kirchhoff), 'Módulo teórico Leyes de Kirchhoff presente');
// --------------------------------------------------------------------------
// PRUEBA 6: Motor de Código de Colores EIA (ColorCodeEngine)
// --------------------------------------------------------------------------
console.log('\n--- Test 6: Motor de Código de Colores EIA ---');
import { ColorCodeEngine } from '../js/engine/ColorCodeEngine.js';
import { ReportExporter } from '../js/engine/ReportExporter.js';

// 10 Ohms = Marrón (1), Negro (0), Negro (x1), Dorado (±5%)
const r10Bands = ColorCodeEngine.getBandsFromValue(10, 5);
assert(r10Bands.bands[0].key === 'brown', '10Ω Banda 1 = Marrón');
assert(r10Bands.bands[1].key === 'black', '10Ω Banda 2 = Negro');
assert(r10Bands.bands[2].key === 'black', '10Ω Banda 3 = Negro (x1)');
assert(r10Bands.bands[3].key === 'gold', '10Ω Banda 4 = Dorado (±5%)');

// 20 Ohms = Rojo (2), Negro (0), Negro (x1), Dorado
const r20Bands = ColorCodeEngine.getBandsFromValue(20, 5);
assert(r20Bands.bands[0].key === 'red', '20Ω Banda 1 = Rojo');
assert(r20Bands.bands[1].key === 'black', '20Ω Banda 2 = Negro');

// 470 Ohms = Amarillo (4), Violeta (7), Marrón (x10)
const r470Bands = ColorCodeEngine.getBandsFromValue(470, 5);
assert(r470Bands.bands[0].key === 'yellow', '470Ω Banda 1 = Amarillo');
assert(r470Bands.bands[1].key === 'violet', '470Ω Banda 2 = Violeta');
assert(r470Bands.bands[2].key === 'brown', '470Ω Banda 3 = Marrón');

// Decodificación inversa: Marrón + Negro + Rojo = 1000Ω (1kΩ)
const fromBands = ColorCodeEngine.getValueFromBands('brown', 'black', 'red', 'gold');
assert(fromBands.ohms === 1000, `Decodificación inversa: Marrón-Negro-Rojo = 1000Ω (Obtenido: ${fromBands.ohms}Ω)`);
assert(fromBands.minOhms === 950 && fromBands.maxOhms === 1050, 'Tolerancia ±5% correcta (950Ω - 1050Ω)');

// --------------------------------------------------------------------------
// PRUEBA 7: Generador de Reportes de Laboratorio (ReportExporter)
// --------------------------------------------------------------------------
console.log('\n--- Test 7: Generador de Reportes Técnicos ---');
const dummyState = {
  topology: 'series',
  voltage: 12,
  resistors: [10, 20, 30],
  switches: ['ON', 'ON', 'ON'],
  telemetry: resSeries
};
const reportHTML = ReportExporter.generateReportHTML(dummyState, {
  studentName: 'Nikola Tesla',
  course: 'Electromagnetismo',
  institution: 'MIT'
});
assert(typeof reportHTML === 'string' && reportHTML.length > 500, 'Generación de HTML de informe técnico válida');
assert(reportHTML.includes('Nikola Tesla'), 'Informe contiene el nombre del estudiante');
assert(reportHTML.includes('SERIE'), 'Informe contiene la topología evaluada');
assert(reportHTML.includes('Ley de Voltajes de Kirchhoff'), 'Informe contiene comprobación de LVK');

console.log(`\n🎉 Resumen de Pruebas: ${passedTests}/${totalTests} pruebas superadas exitosamente.`);

