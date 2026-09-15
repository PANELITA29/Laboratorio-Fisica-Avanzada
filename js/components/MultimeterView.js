/**
 * js/components/MultimeterView.js
 * Componente de Presentación para la Zona 2: Multímetro Digital, Tabla de Datos y Verificación de Leyes.
 * 
 * Actualiza en tiempo real:
 * - Panel LCD Digital de Cabecera (Req, IT, PT, Diagnóstico).
 * - Tabla Analítica de Ramas con estados térmicos y de falla.
 * - Tarjeta de Comprobación Formal de LVK (Ley de Mallas) y LCK (Ley de Nodos).
 */

export class MultimeterView {
  /**
   * @param {HTMLElement} container - Elemento contenedor de la Zona 2
   */
  constructor(container) {
    this.container = container;
    this._prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    // Escuchar cambios en prefers-reduced-motion
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      this._prefersReducedMotion = e.matches;
    });
    
    this._initDOMElements();
  }

  /**
   * Captura referencias a los elementos dinámicos del DOM.
   * @private
   */
  _initDOMElements() {
    this.lcdReq = this.container.querySelector('#lcd-req');
    this.lcdIT = this.container.querySelector('#lcd-it');
    this.lcdPT = this.container.querySelector('#lcd-pt');
    this.statusBadge = this.container.querySelector('#lcd-status-badge');
    this.tableBody = this.container.querySelector('#telemetry-table-body');
    
    // Verificación de Kirchhoff
    this.kvlExpr = this.container.querySelector('#kvl-expression');
    this.kvlBadge = this.container.querySelector('#kvl-status-badge');
    this.kclExpr = this.container.querySelector('#kcl-expression');
    this.kclBadge = this.container.querySelector('#kcl-status-badge');
    this.diagMsg = this.container.querySelector('#system-diagnosis-msg');
  }

  /**
   * Actualiza todos los indicadores a partir del estado emitido por StateManager.
   * @param {Object} state 
   */
  update(state) {
    const tele = state.telemetry;
    if (!tele) return;

    // 1. Actualizar Displays LCD Digitales
    if (this.lcdReq) {
      if (tele.isShortCircuit) {
        this.lcdReq.textContent = '0.00 Ω';
      } else if (tele.isOpenCircuit || tele.req === Infinity) {
        this.lcdReq.textContent = '∞ O.L. (Abierto)';
      } else {
        this.lcdReq.textContent = `${tele.req.toFixed(2)} Ω`;
      }
    }

    if (this.lcdIT) {
      if (tele.isShortCircuit) {
        this.lcdIT.textContent = 'OVERLOAD (>10A)';
        if (!this._prefersReducedMotion) {
          this.lcdIT.classList.add('lcd-danger-blink');
        }
      } else {
        this.lcdIT.textContent = `${tele.it.toFixed(3)} A (${(tele.it * 1000).toFixed(1)} mA)`;
        this.lcdIT.classList.remove('lcd-danger-blink');
      }
    }

    if (this.lcdPT) {
      if (tele.isShortCircuit) {
        this.lcdPT.textContent = 'MAX DISC';
      } else {
        this.lcdPT.textContent = `${tele.pt.toFixed(2)} W`;
      }
    }

    // 2. Estado del Sistema / Diagnóstico
    if (this.statusBadge && tele.diagnosis) {
      this.statusBadge.textContent = tele.diagnosis.badge;
      this.statusBadge.className = `status-badge status-${tele.diagnosis.type.toLowerCase()}`;
    }

    if (this.diagMsg && tele.diagnosis) {
      this.diagMsg.textContent = tele.diagnosis.message;
      this.diagMsg.style.borderColor = tele.diagnosis.color;
    }

    // 3. Renderizar Filas de la Tabla de Datos
    if (this.tableBody && tele.branches) {
      this.tableBody.innerHTML = tele.branches.map(branch => {
        let rText = `${branch.nominalR.toFixed(1)} Ω`;
        if (branch.switchState === 'OPEN') rText += ' [ABIERTO]';
        if (branch.switchState === 'SHORT') rText += ' [CORTO]';

        let statusClass = 'tag-normal';
        let statusLabel = 'Nominal';

        if (branch.status === 'ABIERTO') {
          statusClass = 'tag-open';
          statusLabel = 'Abierto';
        } else if (branch.status === 'CORTO') {
          statusClass = 'tag-short';
          statusLabel = 'Cortocircuito';
        } else if (branch.status === 'SOBRECALENTADO') {
          statusClass = 'tag-overheated';
          statusLabel = '<svg class="icon" aria-hidden="true"><use href="#icon-fire"></use></svg> Calentando';
        } else if (branch.status === 'DESENERGIZADO' || branch.status === 'BYPASS_CORTO') {
          statusClass = 'tag-idle';
          statusLabel = 'Desenergizado';
        }

        return `
          <tr class="${branch.isOverheated ? 'row-overheated' : ''}">
            <td class="col-branch font-mono"><strong>${branch.id}</strong></td>
            <td class="col-r font-mono">${rText}</td>
            <td class="col-v font-mono tabular-nums">${branch.v.toFixed(2)} V</td>
            <td class="col-i font-mono tabular-nums">${branch.i.toFixed(3)} A</td>
            <td class="col-p font-mono tabular-nums">${branch.p.toFixed(2)} W</td>
            <td class="col-status"><span class="badge-status ${statusClass}">${statusLabel}</span></td>
          </tr>
        `;
      }).join('');
    }

    // 4. Verificación de Kirchhoff
    if (this.kvlExpr && tele.kvlCheck) {
      this.kvlExpr.textContent = tele.kvlCheck.expression;
      if (this.kvlBadge) {
        const isVerified = tele.kvlCheck.status === 'VERIFIED';
        this.kvlBadge.innerHTML = `${isVerified 
          ? '<svg class="icon" aria-hidden="true"><use href="#icon-check"></use></svg> Cumple LVK' 
          : '<svg class="icon" aria-hidden="true"><use href="#icon-alert"></use></svg> Falla LVK'}`;
        this.kvlBadge.className = `badge-check ${isVerified ? 'check-pass' : 'check-fail'}`;
      }
    }

    if (this.kclExpr && tele.kclCheck) {
      this.kclExpr.textContent = tele.kclCheck.expression;
      if (this.kclBadge) {
        const isVerified = tele.kclCheck.status === 'VERIFIED';
        this.kclBadge.innerHTML = `${isVerified 
          ? '<svg class="icon" aria-hidden="true"><use href="#icon-check"></use></svg> Cumple LCK' 
          : '<svg class="icon" aria-hidden="true"><use href="#icon-alert"></use></svg> Falla LCK'}`;
        this.kclBadge.className = `badge-check ${isVerified ? 'check-pass' : 'check-fail'}`;
      }
    }
  }
}
