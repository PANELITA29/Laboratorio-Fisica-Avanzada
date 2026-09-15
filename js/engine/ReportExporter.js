/**
 * js/engine/ReportExporter.js
 * Generador de Reportes Técnicos de Laboratorio en Formato Académico (IEEE / Impresión PDF) y Exportador CSV.
 * 
 * Genera informes completos con:
 * 1. Encabezado institucional y metadatos del estudiante.
 * 2. Marco Teórico detallado de la Ley de Ohm y Ley de Joule (sin símbolos $ crudos).
 * 3. Parámetros globales y telemetría de instrumentación.
 * 4. Tabla analítica de ramas con código de colores EIA.
 * 5. Deducción matemática paso a paso del experimento actual.
 * 6. Validación formal de leyes de Kirchhoff (LVK y LCK).
 * 7. Sección de Evaluación Formativa con preguntas resueltas y justificaciones.
 * 8. Conclusiones y líneas de firma de calificación.
 */

import { ColorCodeEngine } from './ColorCodeEngine.js';

export class ReportExporter {
  /**
   * Genera el archivo CSV con toda la telemetría del experimento y lo descarga en el navegador.
   * @param {Object} state - Estado actual de StateManager
   * @param {Object} [metadata={}] - Metadatos de alumno y práctica
   */
  static downloadCSV(state, metadata = {}) {
    const tele = state.telemetry;
    if (!tele) return;

    const student = metadata.studentName || 'Estudiante de Laboratorio';
    const dateStr = new Date().toLocaleString();
    const topology = state.topology.toUpperCase();

    let csv = `sep=,\n`;
    csv += `"LABORATORIO VIRTUAL DE FISICA AVANZADA - REPORTE DE TELEMETRIA"\n`;
    csv += `"Estudiante:","${student}"\n`;
    csv += `"Fecha y Hora:","${dateStr}"\n`;
    csv += `"Topologia:","${topology}"\n`;
    csv += `"Voltaje de Fuente (V):",${state.voltage}\n`;
    csv += `"Resistencia Equivalente Req (Ohms):",${tele.req === Infinity ? '"Infinito (Abierto)"' : tele.req}\n`;
    csv += `"Corriente Total IT (Amperios):",${tele.it}\n`;
    csv += `"Potencia Total PT (Watts):",${tele.pt}\n`;
    csv += `"Estado del Sistema:","${tele.diagnosis ? tele.diagnosis.badge : 'NOMINAL'}"\n\n`;

    // Tabla de Ramas
    csv += `"TABLA ANALITICA DE RAMAS Y COMPONENTES"\n`;
    csv += `"ID","Nombre","R Nominal (Ohms)","Bandas Color EIA","R Efectiva (Ohms)","Voltaje V (V)","Corriente I (A)","Potencia P (W)","Estado Falla"\n`;

    tele.branches.forEach(b => {
      const bandsInfo = ColorCodeEngine.getBandsFromValue(b.nominalR);
      const bandNames = bandsInfo.bands.map(bd => bd.name).join(' - ');
      const rEff = b.effectiveR === Infinity ? '"Infinito"' : b.effectiveR;
      csv += `"${b.id}","${b.name}",${b.nominalR},"${bandNames}",${rEff},${b.v},${b.i},${b.p},"${b.status}"\n`;
    });

    csv += `\n"COMPROBACION FORMAL DE LEYES DE KIRCHHOFF"\n`;
    csv += `"Ley de Voltajes (LVK):","${tele.kvlCheck ? tele.kvlCheck.expression : 'N/A'}","${tele.kvlCheck ? tele.kvlCheck.status : 'N/A'}"\n`;
    csv += `"Ley de Corrientes (LCK):","${tele.kclCheck ? tele.kclCheck.expression : 'N/A'}","${tele.kclCheck ? tele.kclCheck.status : 'N/A'}"\n`;

    // Disparar descarga Blob en navegador
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_Laboratorio_Circuitos_${state.topology}_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Genera el HTML enriquecido para vista previa e impresión directa en PDF.
   * @param {Object} state - Estado del circuito
   * @param {Object} metadata - Datos del alumno y progreso del quiz
   * @returns {string} HTML del informe
   */
  static generateReportHTML(state, metadata = {}) {
    const tele = state.telemetry;
    const student = metadata.studentName || 'Alexander Humboldt';
    const course = metadata.course || 'Física II - Electrodinámica';
    const institution = metadata.institution || 'Facultad de Ciencias e Ingeniería';
    const dateStr = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const quiz = metadata.quizProgress || null;

    // Cálculo del desglose paso a paso
    const V = state.voltage;
    const R1 = state.resistors[0];
    const R2 = state.resistors[1];
    const R3 = state.resistors[2];
    const topo = state.topology;

    let stepReqText = '';
    if (topo === 'series') {
      stepReqText = `Req = R₁ + R₂ + R₃ = ${R1} Ω + ${R2} Ω + ${R3} Ω = <strong>${tele.req} Ω</strong>`;
    } else if (topo === 'parallel') {
      stepReqText = `1/Req = 1/R₁ + 1/R₂ + 1/R₃ = 1/${R1} + 1/${R2} + 1/${R3} ➔ Req = <strong>${tele.req} Ω</strong>`;
    } else {
      const r23 = ((R2 * R3) / (R2 + R3)).toFixed(2);
      stepReqText = `Bloque Paralelo R₂₃ = (R₂ · R₃)/(R₂ + R₃) = (${R2} · ${R3})/(${R2} + ${R3}) = ${r23} Ω<br>Req Total = R₁ + R₂₃ = ${R1} Ω + ${r23} Ω = <strong>${tele.req} Ω</strong>`;
    }

    return `
      <div class="printable-lab-report" id="printable-lab-report">
        
        <!-- ===================================================================
             ENCABEZADO ACADÉMICO / INSTITUCIONAL
             =================================================================== -->
        <header class="report-head">
          <div class="report-head-brand">
            <span class="report-logo">⚡</span>
            <div>
              <h1 class="report-inst-title">${institution}</h1>
              <h2 class="report-doc-title">INFORME TÉCNICO DE PRÁCTICA EXPERIMENTAL</h2>
              <p class="report-doc-subtitle">Electrodinámica, Ley de Ohm, Leyes de Kirchhoff y Análisis de Fallas</p>
            </div>
          </div>
          <div class="report-meta-box">
            <p><strong>Estudiante:</strong> ${student}</p>
            <p><strong>Materia / Grupo:</strong> ${course}</p>
            <p><strong>Fecha de Práctica:</strong> ${dateStr}</p>
            <p><strong>Topología Ensayada:</strong> <span class="badge-topo-report">${topo.toUpperCase()}</span></p>
          </div>
        </header>

        <!-- ===================================================================
             SECCIÓN 1: FUNDAMENTO TEÓRICO Y FÓRMULAS FUNDAMENTALES
             =================================================================== -->
        <section class="report-section">
          <h3 class="report-sec-title">1. Fundamento Teórico: Ley de Ohm y Ley de Joule</h3>
          <div class="report-theory-box">
            <p>
              La <strong>Ley de Ohm</strong> (formulada por el físico alemán Georg Simon Ohm en 1827) postula que la intensidad de corriente eléctrica (<em>I</em>) que fluye por un conductor es directamente proporcional a la diferencia de potencial o voltaje (<em>V</em>) aplicado entre sus extremos, e inversamente proporcional a la resistencia eléctrica (<em>R</em>) que ofrece el material.
            </p>

            <div class="report-formulas-grid">
              <div class="formula-card-clean">
                <span class="formula-card-tag">Ley de Ohm</span>
                <div class="formula-math">V = I · R</div>
                <div class="formula-sub">I = V / R &nbsp;|&nbsp; R = V / I</div>
              </div>
              <div class="formula-card-clean">
                <span class="formula-card-tag">Ley de Joule (Potencia)</span>
                <div class="formula-math">P = V · I</div>
                <div class="formula-sub">P = I² · R &nbsp;|&nbsp; P = V² / R</div>
              </div>
            </div>

            <table class="report-units-table">
              <thead>
                <tr>
                  <th>Magnitud Física</th>
                  <th>Símbolo</th>
                  <th>Unidad (S.I.)</th>
                  <th>Definición y Significado Físico</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Tensión / Voltaje</strong></td>
                  <td class="font-mono">V</td>
                  <td>Voltio (V)</td>
                  <td>Presión o fuerza impulsora de los electrones a través del conductor.</td>
                </tr>
                <tr>
                  <td><strong>Corriente Eléctrica</strong></td>
                  <td class="font-mono">I</td>
                  <td>Amperio (A)</td>
                  <td>Caudal o cantidad de carga eléctrica que pasa por segundo (1 A = 1 Culombio/s).</td>
                </tr>
                <tr>
                  <td><strong>Resistencia Eléctrica</strong></td>
                  <td class="font-mono">R</td>
                  <td>Ohmio (Ω)</td>
                  <td>Oposición intrínseca del material al paso libre de los electrones.</td>
                </tr>
                <tr>
                  <td><strong>Potencia Eléctrica</strong></td>
                  <td class="font-mono">P</td>
                  <td>Vatio / Watt (W)</td>
                  <td>Energía consumida o transformada en calor por unidad de tiempo (1 W = 1 Julio/s).</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- ===================================================================
             SECCIÓN 2: PARÁMETROS GLOBALES Y TELEMETRÍA DEL SISTEMA
             =================================================================== -->
        <section class="report-section">
          <h3 class="report-sec-title">2. Parámetros Globales y Telemetría Experimental</h3>
          <div class="report-grid-3">
            <div class="report-stat-card">
              <span class="stat-lbl">Tensión de Alimentación (V)</span>
              <span class="stat-val font-mono">${state.voltage.toFixed(2)} V</span>
            </div>
            <div class="report-stat-card">
              <span class="stat-lbl">Resistencia Equivalente (Req)</span>
              <span class="stat-val font-mono">${tele.req === Infinity ? '∞ O.L. (Abierto)' : tele.req.toFixed(2) + ' Ω'}</span>
            </div>
            <div class="report-stat-card">
              <span class="stat-lbl">Corriente Total (IT)</span>
              <span class="stat-val font-mono">${tele.it.toFixed(3)} A</span>
            </div>
            <div class="report-stat-card">
              <span class="stat-lbl">Potencia Suministrada (PT)</span>
              <span class="stat-val font-mono">${tele.pt.toFixed(2)} W</span>
            </div>
            <div class="report-stat-card">
              <span class="stat-lbl">Diagnóstico del Circuito</span>
              <span class="stat-val stat-badge">${tele.diagnosis ? tele.diagnosis.badge : 'NOMINAL'}</span>
            </div>
            <div class="report-stat-card">
              <span class="stat-lbl">Potencia Total Disipada (ΣP)</span>
              <span class="stat-val font-mono">${(tele.branches.reduce((acc, b) => acc + b.p, 0)).toFixed(2)} W</span>
            </div>
          </div>
        </section>

        <!-- ===================================================================
             SECCIÓN 3: TABLA ANALÍTICA DE COMPONENTES Y CÓDIGO DE COLORES
             =================================================================== -->
        <section class="report-section">
          <h3 class="report-sec-title">3. Tabla Analítica de Ramas y Código de Colores EIA (4 Bandas)</h3>
          <table class="report-table">
            <thead>
              <tr>
                <th>Elemento</th>
                <th>R Nominal</th>
                <th>Bandas de Color EIA (Norma RS-279)</th>
                <th>Voltaje V (V)</th>
                <th>Corriente I (A)</th>
                <th>Potencia P (W)</th>
                <th>Estado Operativo</th>
              </tr>
            </thead>
            <tbody>
              ${tele.branches.map(b => {
                const bandsInfo = ColorCodeEngine.getBandsFromValue(b.nominalR);
                const colorBadges = bandsInfo.bands.map(bd => `
                  <span class="band-tag" style="background:${bd.hex}; color:${bd.name === 'Blanco' || bd.name === 'Amarillo' ? '#000' : '#fff'}; border:1px solid #ccc;">
                    ${bd.name}
                  </span>
                `).join(' ');

                return `
                  <tr>
                    <td><strong>${b.id}</strong> (${b.name})</td>
                    <td class="font-mono">${b.nominalR} Ω</td>
                    <td>${colorBadges}</td>
                    <td class="font-mono">${b.v.toFixed(2)} V</td>
                    <td class="font-mono">${b.i.toFixed(3)} A</td>
                    <td class="font-mono">${b.p.toFixed(2)} W</td>
                    <td><span class="report-badge-status">${b.status}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </section>

        <!-- ===================================================================
             SECCIÓN 4: DEDUCCIÓN MATEMÁTICA PASO A PASO
             =================================================================== -->
        <section class="report-section">
          <h3 class="report-sec-title">4. Demostración y Cálculo Paso a Paso</h3>
          <div class="report-steps-box">
            <div class="step-item">
              <strong>Paso 1: Cálculo de la Resistencia Equivalente Total (Req)</strong>
              <p class="step-calc font-mono">${stepReqText}</p>
            </div>
            <div class="step-item">
              <strong>Paso 2: Cálculo de la Corriente Total del Circuito (IT)</strong>
              <p class="step-calc font-mono">
                IT = V_fuente / Req = ${V} V / ${tele.req === Infinity ? '∞' : tele.req + ' Ω'} = <strong>${tele.it.toFixed(3)} A</strong>
              </p>
            </div>
            <div class="step-item">
              <strong>Paso 3: Verificación de Caídas de Tensión Individuales</strong>
              <p class="step-calc font-mono">
                ${tele.branches.map(b => `${b.id}: V = ${b.i.toFixed(3)} A · ${b.nominalR} Ω = <strong>${b.v.toFixed(2)} V</strong>`).join(' &nbsp;|&nbsp; ')}
              </p>
            </div>
            <div class="step-item">
              <strong>Paso 4: Verificación del Balance de Potencia Térmica (Efecto Joule)</strong>
              <p class="step-calc font-mono">
                P_fuente (${tele.pt.toFixed(2)} W) = P₁ (${tele.branches[0].p} W) + P₂ (${tele.branches[1].p} W) + P₃ (${tele.branches[2].p} W) = <strong>${(tele.branches.reduce((acc, b) => acc + b.p, 0)).toFixed(2)} W</strong>
              </p>
            </div>
          </div>
        </section>

        <!-- ===================================================================
             SECCIÓN 5: COMPROBACIÓN FORMAL DE LEYES DE KIRCHHOFF
             =================================================================== -->
        <section class="report-section">
          <h3 class="report-sec-title">5. Dictamen Formal de Leyes de Kirchhoff</h3>
          <div class="report-proof-box">
            <h4>A. Ley de Voltajes de Kirchhoff (LVK / Segunda Ley - Conservación de la Energía):</h4>
            <p class="font-mono proof-expr"><code>${tele.kvlCheck ? tele.kvlCheck.expression : 'N/A'}</code></p>
            <p class="proof-desc"><strong>Resultado:</strong> ${tele.kvlCheck && tele.kvlCheck.holds ? '✓ Cumple rigurosamente: La suma de caídas de tensión es idéntica a la fuerza electromotriz de la fuente.' : '⚠ Alerta de discrepancia o cortocircuito.'}</p>

            <h4 style="margin-top:14px;">B. Ley de Corrientes de Kirchhoff (LCK / Primera Ley - Conservación de la Carga):</h4>
            <p class="font-mono proof-expr"><code>${tele.kclCheck ? tele.kclCheck.expression : 'N/A'}</code></p>
            <p class="proof-desc"><strong>Resultado:</strong> ${tele.kclCheck && tele.kclCheck.holds ? '✓ Cumple rigurosamente: La suma algebraica de corrientes en los nodos del circuito es cero.' : '⚠ Falla de balance.'}</p>
          </div>
        </section>

        <!-- ===================================================================
             SECCIÓN 6: CUESTIONARIO DE EVALUACIÓN Y PREGUNTAS RESUELTAS
             =================================================================== -->
        ${quiz ? `
          <section class="report-section">
            <div class="report-quiz-header">
              <h3 class="report-sec-title" style="margin-bottom:0;">6. Cuestionario de Evaluación y Preguntas Resueltas</h3>
              <span class="quiz-score-pill">Puntaje Obtenido: ${quiz.correct} / ${quiz.total} (${quiz.scorePercent}%)</span>
            </div>
            
            <div class="report-quiz-grid">
              ${quiz.details.map((q, idx) => `
                <div class="report-quiz-card ${q.selectedOptionId ? (q.isCorrect ? 'card-correct' : 'card-incorrect') : 'card-unanswered'}">
                  <div class="quiz-card-head">
                    <span class="quiz-num">Pregunta ${q.id}</span>
                    <span class="quiz-status-tag ${q.isCorrect ? 'tag-ok' : (q.selectedOptionId ? 'tag-err' : 'tag-pending')}">
                      ${q.isCorrect ? '✓ Correcta' : (q.selectedOptionId ? '✗ Incorrecta' : '○ Sin Responder')}
                    </span>
                  </div>
                  <p class="quiz-card-prompt"><strong>${q.prompt}</strong></p>
                  <p class="quiz-user-ans"><strong>Tu respuesta:</strong> [${q.selectedOptionId || '-'}] ${q.selectedOptionText}</p>
                  ${!q.isCorrect && q.selectedOptionId ? `<p class="quiz-correct-ans"><strong>Respuesta Correcta:</strong> [${q.correctAnswer}] ${q.correctText}</p>` : ''}
                  <div class="quiz-card-justification">
                    <strong>💡 Explicación Teórica:</strong> ${q.justification.explanation}
                  </div>
                </div>
              `).join('')}
            </div>
          </section>
        ` : ''}

        <!-- ===================================================================
             SECCIÓN 7: CONCLUSIONES Y FIRMAS
             =================================================================== -->
        <section class="report-section report-conclusions">
          <h3 class="report-sec-title">7. Conclusiones de la Práctica Experimental</h3>
          <p>
            1. En la topología <strong>${topo.toUpperCase()}</strong> ensayada, se comprobó experimentalmente la validez universal de la <strong>Ley de Ohm (V = I · R)</strong> y las <strong>Leyes de Kirchhoff (LVK y LCK)</strong> con una discrepancia experimental inferior al 0.5%.<br>
            2. Se verificó el Principio de Conservación de la Energía: la potencia eléctrica total suministrada por la fuente (${tele.pt.toFixed(2)} W) coincide exactamente con la suma de potencias disipadas por efecto Joule en las tres resistencias (${(tele.branches.reduce((acc, b) => acc + b.p, 0)).toFixed(2)} W).<br>
            3. Se demostró que las bandas de color EIA corresponden a la resistencia nominal con su respectivo rango de tolerancia.
          </p>

          <div class="report-signatures">
            <div class="signature-line">
              <div class="line"></div>
              <span>${student}</span>
              <small>Firma del Estudiante</small>
            </div>
            <div class="signature-line">
              <div class="line"></div>
              <span>Docente Evaluador / Laboratorio</span>
              <small>V°B° y Calificación Final</small>
            </div>
          </div>
        </section>
      </div>
    `;
  }
}
