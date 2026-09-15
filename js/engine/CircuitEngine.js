/**
 * js/engine/CircuitEngine.js
 * Motor Físico y Matemático Determinista de Circuitos Eléctricos.
 * 
 * Implementa de forma pura:
 * - Ley de Ohm (V = I * R)
 * - Ley de Voltajes de Kirchhoff (LVK / KVL)
 * - Ley de Corrientes de Kirchhoff (LCK / KCL)
 * - Topologías: Serie, Paralelo y Mixto
 * - Análisis de Fallas: Circuito Abierto (R -> Inf), Cortocircuito (R -> 0), Sobrecarga térmica
 */

export class CircuitEngine {
  /**
   * Potencia nominal máxima disipable por resistencia antes de sobrecalentarse (en Watts).
   */
  static MAX_RATED_POWER_WATTS = 15.0;

  /**
   * Resistencia umbral considerada cortocircuito cuando se fuerza (en Ohmios).
   */
  static SHORT_CIRCUIT_EPSILON = 0.001;

  /**
   * Calcula el estado completo del circuito a partir de los parámetros de entrada.
   * 
   * @param {Object} params
   * @param {string} params.topology - 'series' | 'parallel' | 'mixed'
   * @param {number} params.voltage - Voltaje de la fuente (Volts)
   * @param {number[]} params.resistors - Valores nominales de [R1, R2, R3] en Ohms
   * @param {string[]} params.switches - Estados de cada rama ['ON'|'OPEN'|'SHORT']
   * @returns {Object} Telemetría completa calculada
   */
  static calculate({ topology = 'series', voltage = 12, resistors = [10, 20, 30], switches = ['ON', 'ON', 'ON'] }) {
    // Sanitización y validación de entradas
    const V = Math.max(0, Number(voltage) || 0);
    const R_nom = resistors.map(r => Math.max(0.1, Number(r) || 10));
    const sw = switches.map(s => (s ? String(s).toUpperCase() : 'ON'));

    // Calcular la resistencia efectiva de cada rama según el switch de falla
    const effectiveR = R_nom.map((r, i) => {
      if (sw[i] === 'OPEN') return Infinity;
      if (sw[i] === 'SHORT') return CircuitEngine.SHORT_CIRCUIT_EPSILON;
      return r;
    });

    let req = 0;
    let branchResults = [];
    let isShortCircuit = false;
    let isOpenCircuit = false;

    if (topology === 'series') {
      const res = CircuitEngine._solveSeries(V, effectiveR, R_nom, sw);
      req = res.req;
      branchResults = res.branches;
      isShortCircuit = res.isShortCircuit;
      isOpenCircuit = res.isOpenCircuit;
    } else if (topology === 'parallel') {
      const res = CircuitEngine._solveParallel(V, effectiveR, R_nom, sw);
      req = res.req;
      branchResults = res.branches;
      isShortCircuit = res.isShortCircuit;
      isOpenCircuit = res.isOpenCircuit;
    } else if (topology === 'mixed') {
      const res = CircuitEngine._solveMixed(V, effectiveR, R_nom, sw);
      req = res.req;
      branchResults = res.branches;
      isShortCircuit = res.isShortCircuit;
      isOpenCircuit = res.isOpenCircuit;
    } else {
      throw new Error(`Topología desconocida: ${topology}`);
    }

    // Cálculo de Corriente Total (I_T = V / Req)
    let it = 0;
    if (isShortCircuit) {
      it = 999.99; // Representación de corriente de cortocircuito saturada
    } else if (req === Infinity || req <= 0) {
      it = 0;
    } else {
      it = V / req;
    }

    // Potencia total suministrada por la fuente (P_T = V * I_T)
    const pt = isShortCircuit ? 9999.99 : V * it;

    // Validación formal de Leyes de Kirchhoff
    const kvlCheck = CircuitEngine._verifyKVL(topology, V, branchResults, isShortCircuit);
    const kclCheck = CircuitEngine._verifyKCL(topology, it, branchResults, isShortCircuit);

    // Diagnóstico textual del estado del sistema
    const diagnosis = CircuitEngine._generateDiagnosis({
      topology,
      V,
      req,
      it,
      pt,
      isShortCircuit,
      isOpenCircuit,
      sw,
      branchResults
    });

    return {
      topology,
      voltage: V,
      nominalResistors: R_nom,
      effectiveResistors: effectiveR,
      switches: sw,
      req: isShortCircuit ? 0 : (req === Infinity ? Infinity : Number(req.toFixed(4))),
      it: Number(it.toFixed(4)),
      pt: Number(pt.toFixed(4)),
      branches: branchResults,
      kvlCheck,
      kclCheck,
      isShortCircuit,
      isOpenCircuit,
      diagnosis
    };
  }

  /**
   * Resuelve topología Serie: R_eq = R1 + R2 + R3
   * @private
   */
  static _solveSeries(V, effR, nomR, sw) {
    let req = 0;
    let hasOpen = false;
    let allShort = true;

    for (let i = 0; i < effR.length; i++) {
      if (effR[i] === Infinity) {
        hasOpen = true;
      }
      if (effR[i] !== CircuitEngine.SHORT_CIRCUIT_EPSILON) {
        allShort = false;
      }
      req += effR[i];
    }

    if (hasOpen) {
      req = Infinity;
    }

    const isShortCircuit = allShort && V > 0;
    const isOpenCircuit = hasOpen;

    let it = 0;
    if (!hasOpen && req > 0) {
      it = isShortCircuit ? 999.99 : V / req;
    }

    const branches = effR.map((r, i) => {
      let vBranch = 0;
      let iBranch = 0;
      let pBranch = 0;
      let status = 'NORMAL';

      if (sw[i] === 'OPEN') {
        status = 'ABIERTO';
        // En serie, el elemento abierto concentra todo el voltaje de la fuente
        vBranch = V;
        iBranch = 0;
        pBranch = 0;
      } else if (sw[i] === 'SHORT') {
        status = 'CORTO';
        vBranch = 0;
        iBranch = it;
        pBranch = 0;
      } else if (hasOpen) {
        // Si otra rama está abierta, no hay corriente y el voltaje en las ramas cerradas es 0
        status = 'DESENERGIZADO';
        vBranch = 0;
        iBranch = 0;
        pBranch = 0;
      } else {
        iBranch = it;
        vBranch = it * r;
        pBranch = vBranch * iBranch;
        if (pBranch > CircuitEngine.MAX_RATED_POWER_WATTS) {
          status = 'SOBRECALENTADO';
        }
      }

      return {
        id: `R${i + 1}`,
        name: `Resistencia ${i + 1}`,
        nominalR: nomR[i],
        effectiveR: r,
        switchState: sw[i],
        v: Number(vBranch.toFixed(3)),
        i: Number(iBranch.toFixed(3)),
        p: Number(pBranch.toFixed(3)),
        status,
        isOverheated: pBranch > CircuitEngine.MAX_RATED_POWER_WATTS
      };
    });

    return { req, branches, isShortCircuit, isOpenCircuit };
  }

  /**
   * Resuelve topología Paralelo: 1/R_eq = 1/R1 + 1/R2 + 1/R3
   * @private
   */
  static _solveParallel(V, effR, nomR, sw) {
    let hasShort = effR.some(r => r === CircuitEngine.SHORT_CIRCUIT_EPSILON);
    let allOpen = effR.every(r => r === Infinity);

    let sumConductance = 0;
    effR.forEach(r => {
      if (r !== Infinity && r > 0) {
        sumConductance += 1 / r;
      }
    });

    let req = 0;
    if (hasShort) {
      req = 0;
    } else if (allOpen || sumConductance === 0) {
      req = Infinity;
    } else {
      req = 1 / sumConductance;
    }

    const isShortCircuit = hasShort && V > 0;
    const isOpenCircuit = allOpen;

    const branches = effR.map((r, i) => {
      let vBranch = 0;
      let iBranch = 0;
      let pBranch = 0;
      let status = 'NORMAL';

      if (hasShort && sw[i] !== 'SHORT') {
        // Si hay cortocircuito en una rama paralela, colapsa el voltaje de todas las demás
        status = 'BYPASS_CORTO';
        vBranch = 0;
        iBranch = 0;
        pBranch = 0;
      } else if (sw[i] === 'SHORT') {
        status = 'CORTO';
        vBranch = V;
        iBranch = 999.99;
        pBranch = 9999.99;
      } else if (sw[i] === 'OPEN') {
        status = 'ABIERTO';
        vBranch = V; // El potencial entre terminales sigue existiendo
        iBranch = 0;
        pBranch = 0;
      } else {
        vBranch = V;
        iBranch = r > 0 ? V / r : 0;
        pBranch = vBranch * iBranch;
        if (pBranch > CircuitEngine.MAX_RATED_POWER_WATTS) {
          status = 'SOBRECALENTADO';
        }
      }

      return {
        id: `R${i + 1}`,
        name: `Rama ${i + 1}`,
        nominalR: nomR[i],
        effectiveR: r,
        switchState: sw[i],
        v: Number(vBranch.toFixed(3)),
        i: Number(iBranch.toFixed(3)),
        p: Number(pBranch.toFixed(3)),
        status,
        isOverheated: pBranch > CircuitEngine.MAX_RATED_POWER_WATTS
      };
    });

    return { req, branches, isShortCircuit, isOpenCircuit };
  }

  /**
   * Resuelve topología Mixta: R1 en serie con el bloque paralelo (R2 || R3)
   * @private
   */
  static _solveMixed(V, effR, nomR, sw) {
    const [r1, r2, r3] = effR;

    // Bloque Paralelo R23 = R2 || R3
    let r23 = 0;
    let parallelHasShort = (r2 === CircuitEngine.SHORT_CIRCUIT_EPSILON || r3 === CircuitEngine.SHORT_CIRCUIT_EPSILON);
    let parallelAllOpen = (r2 === Infinity && r3 === Infinity);

    if (parallelHasShort) {
      r23 = 0;
    } else if (parallelAllOpen) {
      r23 = Infinity;
    } else {
      let g2 = r2 === Infinity ? 0 : 1 / r2;
      let g3 = r3 === Infinity ? 0 : 1 / r3;
      r23 = 1 / (g2 + g3);
    }

    // Resistencia total del circuito
    let req = 0;
    let isShortCircuit = false;
    let isOpenCircuit = false;

    if (r1 === Infinity || r23 === Infinity) {
      req = Infinity;
      isOpenCircuit = true;
    } else if (r1 === CircuitEngine.SHORT_CIRCUIT_EPSILON && r23 === 0) {
      req = 0;
      isShortCircuit = true;
    } else {
      req = r1 + r23;
    }

    // Corriente principal I_T que atraviesa R1
    let it = 0;
    if (!isOpenCircuit && req > 0) {
      it = isShortCircuit ? 999.99 : V / req;
    }

    // Caídas de tensión
    let v1 = 0;
    let v23 = 0;

    if (isOpenCircuit) {
      if (r1 === Infinity) {
        v1 = V;
        v23 = 0;
      } else {
        v1 = 0;
        v23 = V;
      }
    } else if (isShortCircuit) {
      v1 = 0;
      v23 = 0;
    } else {
      v1 = it * r1;
      v23 = it * r23;
    }

    // Resolver rama R1
    let i1 = it;
    let p1 = v1 * i1;
    let status1 = 'NORMAL';
    if (sw[0] === 'OPEN') status1 = 'ABIERTO';
    else if (sw[0] === 'SHORT') status1 = 'CORTO';
    else if (isOpenCircuit && sw[0] === 'ON') status1 = 'DESENERGIZADO';
    else if (p1 > CircuitEngine.MAX_RATED_POWER_WATTS) status1 = 'SOBRECALENTADO';

    // Resolver rama R2
    let i2 = 0;
    let v2 = v23;
    let p2 = 0;
    let status2 = 'NORMAL';
    if (sw[1] === 'OPEN') {
      status2 = 'ABIERTO';
      i2 = 0;
    } else if (sw[1] === 'SHORT') {
      status2 = 'CORTO';
      i2 = it;
      v2 = 0;
    } else {
      i2 = r2 > 0 ? v23 / r2 : 0;
      p2 = v2 * i2;
      if (p2 > CircuitEngine.MAX_RATED_POWER_WATTS) status2 = 'SOBRECALENTADO';
    }

    // Resolver rama R3
    let i3 = 0;
    let v3 = v23;
    let p3 = 0;
    let status3 = 'NORMAL';
    if (sw[2] === 'OPEN') {
      status3 = 'ABIERTO';
      i3 = 0;
    } else if (sw[2] === 'SHORT') {
      status3 = 'CORTO';
      i3 = it;
      v3 = 0;
    } else {
      i3 = r3 > 0 ? v23 / r3 : 0;
      p3 = v3 * i3;
      if (p3 > CircuitEngine.MAX_RATED_POWER_WATTS) status3 = 'SOBRECALENTADO';
    }

    const branches = [
      {
        id: 'R1',
        name: 'R1 (En Serie)',
        nominalR: nomR[0],
        effectiveR: r1,
        switchState: sw[0],
        v: Number(v1.toFixed(3)),
        i: Number(i1.toFixed(3)),
        p: Number(p1.toFixed(3)),
        status: status1,
        isOverheated: p1 > CircuitEngine.MAX_RATED_POWER_WATTS
      },
      {
        id: 'R2',
        name: 'R2 (Paralelo Rama A)',
        nominalR: nomR[1],
        effectiveR: r2,
        switchState: sw[1],
        v: Number(v2.toFixed(3)),
        i: Number(i2.toFixed(3)),
        p: Number(p2.toFixed(3)),
        status: status2,
        isOverheated: p2 > CircuitEngine.MAX_RATED_POWER_WATTS
      },
      {
        id: 'R3',
        name: 'R3 (Paralelo Rama B)',
        nominalR: nomR[2],
        effectiveR: r3,
        switchState: sw[2],
        v: Number(v3.toFixed(3)),
        i: Number(i3.toFixed(3)),
        p: Number(p3.toFixed(3)),
        status: status3,
        isOverheated: p3 > CircuitEngine.MAX_RATED_POWER_WATTS
      }
    ];

    return { req, branches, isShortCircuit, isOpenCircuit };
  }

  /**
   * Comprobación analítica de la Ley de Voltajes de Kirchhoff (LVK)
   * @private
   */
  static _verifyKVL(topology, V, branches, isShort) {
    if (isShort) {
      return {
        holds: false,
        sumV: 0,
        sourceV: V,
        diff: V,
        expression: "¡Cortocircuito! Tensión colapsada a 0V.",
        status: "ALERT"
      };
    }

    if (topology === 'series') {
      const sumV = branches.reduce((acc, b) => acc + (b.status === 'ABIERTO' ? 0 : b.v), 0);
      const isOpen = branches.some(b => b.status === 'ABIERTO');
      const holds = isOpen ? true : Math.abs(sumV - V) < 0.05;

      return {
        holds,
        sumV: Number(sumV.toFixed(2)),
        sourceV: V,
        diff: Number(Math.abs(sumV - V).toFixed(2)),
        expression: `V_T = V₁ + V₂ + V₃ ➔ ${V}V ≈ ${branches[0].v}V + ${branches[1].v}V + ${branches[2].v}V`,
        status: holds ? "VERIFIED" : "DISCREPANCY"
      };
    } else if (topology === 'parallel') {
      const allMatch = branches.every(b => Math.abs(b.v - V) < 0.05 || b.status === 'BYPASS_CORTO');
      return {
        holds: allMatch,
        sumV: V,
        sourceV: V,
        diff: 0,
        expression: `V_fuente = V₁ = V₂ = V₃ = ${V}V`,
        status: allMatch ? "VERIFIED" : "DISCREPANCY"
      };
    } else {
      // Mixto: V = V1 + V_paralelo
      const v1 = branches[0].v;
      const v2 = branches[1].v;
      const sumV = v1 + v2;
      const holds = Math.abs(sumV - V) < 0.05;
      return {
        holds,
        sumV: Number(sumV.toFixed(2)),
        sourceV: V,
        diff: Number(Math.abs(sumV - V).toFixed(2)),
        expression: `V_T = V₁ + V_paralelo ➔ ${V}V ≈ ${v1}V + ${v2}V`,
        status: holds ? "VERIFIED" : "DISCREPANCY"
      };
    }
  }

  /**
   * Comprobación analítica de la Ley de Corrientes de Kirchhoff (LCK)
   * @private
   */
  static _verifyKCL(topology, it, branches, isShort) {
    if (isShort) {
      return {
        holds: false,
        sumIn: it,
        sumOut: 0,
        diff: it,
        expression: "Sobrecorriente por cortocircuito",
        status: "ALERT"
      };
    }

    if (topology === 'series') {
      const holds = branches.every(b => b.status === 'ABIERTO' ? it === 0 : Math.abs(b.i - it) < 0.01);
      return {
        holds,
        sumIn: it,
        sumOut: it,
        diff: 0,
        expression: `I_T = I₁ = I₂ = I₃ = ${it}A`,
        status: "VERIFIED"
      };
    } else if (topology === 'parallel') {
      const sumI = branches.reduce((acc, b) => acc + b.i, 0);
      const holds = Math.abs(sumI - it) < 0.05;
      return {
        holds,
        sumIn: Number(it.toFixed(2)),
        sumOut: Number(sumI.toFixed(2)),
        diff: Number(Math.abs(sumI - it).toFixed(2)),
        expression: `I_T = I₁ + I₂ + I₃ ➔ ${it}A ≈ ${branches[0].i}A + ${branches[1].i}A + ${branches[2].i}A`,
        status: holds ? "VERIFIED" : "DISCREPANCY"
      };
    } else {
      // Mixto: I1 = I2 + I3
      const i1 = branches[0].i;
      const sumI_paralelo = branches[1].i + branches[2].i;
      const holds = Math.abs(i1 - sumI_paralelo) < 0.05;
      return {
        holds,
        sumIn: Number(i1.toFixed(2)),
        sumOut: Number(sumI_paralelo.toFixed(2)),
        diff: Number(Math.abs(i1 - sumI_paralelo).toFixed(2)),
        expression: `I₁ (Serie) = I₂ + I₃ (Paralelo) ➔ ${i1}A ≈ ${branches[1].i}A + ${branches[2].i}A`,
        status: holds ? "VERIFIED" : "DISCREPANCY"
      };
    }
  }

  /**
   * Genera el diagnóstico del estado del circuito.
   * @private
   */
  static _generateDiagnosis({ topology, V, req, it, pt, isShortCircuit, isOpenCircuit, sw, branchResults }) {
    if (V === 0) {
      return {
        type: 'IDLE',
        badge: 'En Espera',
        message: 'Fuente en 0V. Aumenta la tensión de alimentación para energizar el circuito.',
        color: 'var(--color-text-dim)'
      };
    }

    if (isShortCircuit) {
      return {
        type: 'DANGER',
        badge: '¡CORTOCIRCUITO!',
        message: '¡PELIGRO! Resistencia equivalente nula. La corriente se dispara a niveles destructivos. Se activó la protección.',
        color: 'var(--color-danger)'
      };
    }

    if (isOpenCircuit) {
      const openBranches = sw.map((s, i) => s === 'OPEN' ? `R${i + 1}` : null).filter(Boolean).join(', ');
      return {
        type: 'WARNING',
        badge: 'Circuito Abierto',
        message: `Circuito interrumpido en switch(es) [${openBranches}]. La corriente total es 0A y la Req es infinita.`,
        color: 'var(--color-warning)'
      };
    }

    const overheated = branchResults.filter(b => b.isOverheated);
    if (overheated.length > 0) {
      const names = overheated.map(b => b.id).join(', ');
      return {
        type: 'CAUTION',
        badge: 'Sobrecarga Térmica',
        message: `Advertencia: Disipación excesiva (> ${CircuitEngine.MAX_RATED_POWER_WATTS}W) en [${names}]. Riesgo de daño por efecto Joule.`,
        color: 'var(--color-warning-glow)'
      };
    }

    return {
      type: 'SUCCESS',
      badge: 'Operación Nominal',
      message: `Circuito estable. Req = ${req} Ω, Corriente Total = ${it} A, Potencia = ${pt} W. Leyes de Kirchhoff verificadas.`,
      color: 'var(--color-success)'
    };
  }
}
