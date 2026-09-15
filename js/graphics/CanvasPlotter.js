/**
 * js/graphics/CanvasPlotter.js
 * Motor de Graficación de Alta Precisión en HTML5 Canvas 2D.
 * 
 * Renderiza a 60 FPS:
 * 1. Gráfica 1: Voltaje vs Corriente (V vs I) - Recta de la Ley de Ohm y punto de operación.
 * 2. Gráfica 2: Corriente vs Req (I vs Req) - Hipérbola Decreciente (I = V / Req).
 * 
 * Incluye soporte para pantallas Retina (devicePixelRatio), rejillas milimétricas,
 * leyendas de escala, gradientes de brillo y puntos de medición en tiempo real.
 */

export class CanvasPlotter {
  /**
   * @param {HTMLCanvasElement} canvas1 - Canvas para V vs I
   * @param {HTMLCanvasElement} canvas2 - Canvas para I vs Req
   */
  constructor(canvas1, canvas2) {
    this.canvasVI = canvas1;
    this.ctxVI = canvas1 ? canvas1.getContext('2d') : null;

    this.canvasIReq = canvas2;
    this.ctxIReq = canvas2 ? canvas2.getContext('2d') : null;

    this.theme = {
      bg: '#0a0e17',
      gridMajor: 'rgba(30, 58, 95, 0.45)',
      gridMinor: 'rgba(20, 40, 70, 0.25)',
      axis: '#38bdf8',
      text: '#94a3b8',
      textAccent: '#38bdf8',
      curveVI: '#00f2fe',
      curveIReq: '#a855f7',
      pointFill: '#facc15',
      pointGlow: 'rgba(250, 204, 21, 0.6)',
      alertGlow: 'rgba(239, 68, 68, 0.8)'
    };

    // Elementos de descripción accesible
    this._descVI = document.getElementById('plot-vi-description');
    this._descIReq = document.getElementById('plot-ireq-description');

    this._setupResizeListeners();
  }

  /**
   * Configura observador de cambio de tamaño responsivo.
   * @private
   */
  _setupResizeListeners() {
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        this._fixResolution(this.canvasVI, this.ctxVI);
        this._fixResolution(this.canvasIReq, this.ctxIReq);
        if (this._lastState) {
          this.render(this._lastState);
        }
      });
      if (this.canvasVI) ro.observe(this.canvasVI);
      if (this.canvasIReq) ro.observe(this.canvasIReq);
    }
  }

  /**
   * Ajusta la resolución del canvas para pantallas de alta densidad de píxeles (HiDPI / Retina).
   * @private
   */
  _fixResolution(canvas, ctx) {
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width || 320;
    const height = rect.height || 200;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.resetTransform?.();
      ctx.scale(dpr, dpr);
    }
  }

  /**
   * Dibuja ambas gráficas con los datos del estado actual.
   * @param {Object} state - Estado completo emitido por StateManager
   */
  render(state) {
    this._lastState = state;
    this._renderVIPlot(state);
    this._renderIReqPlot(state);
    this._updateAccessibleDescriptions(state);
  }

  /**
   * Actualiza las descripciones accesibles para lectores de pantalla.
   * @private
   */
  _updateAccessibleDescriptions(state) {
    const tele = state.telemetry;
    if (!tele) return;

    // Descripción para V vs I
    if (this._descVI) {
      let desc = `Gráfica Voltaje vs Corriente (Ley de Ohm). `;
      if (tele.isShortCircuit) {
        desc += `Cortocircuito detectado: resistencia equivalente cero, corriente teóricamente infinita. `;
      } else if (tele.isOpenCircuit || tele.req === Infinity) {
        desc += `Circuito abierto: resistencia equivalente infinita, corriente cero. `;
      } else {
        desc += `Recta de pendiente 1/Req = ${(1/tele.req).toFixed(4)} Ω⁻¹. `;
        desc += `Punto de operación: ${state.voltage}V, ${tele.it.toFixed(3)}A. `;
        desc += `Resistencia equivalente: ${tele.req.toFixed(2)} Ω.`;
      }
      this._descVI.textContent = desc;
    }

    // Descripción para I vs Req
    if (this._descIReq) {
      let desc = `Gráfica Corriente vs Resistencia Equivalente (Hipérbola I = V/R). `;
      if (tele.isShortCircuit) {
        desc += `Cortocircuito: resistencia cero, corriente saturada. `;
      } else if (tele.isOpenCircuit || tele.req === Infinity) {
        desc += `Circuito abierto: resistencia tiende a infinito, corriente cero. `;
      } else {
        desc += `Función I(R) = ${state.voltage}V / R. `;
        desc += `Punto de operación: ${tele.req.toFixed(2)}Ω, ${tele.it.toFixed(3)}A. `;
        desc += `Potencia: ${tele.pt.toFixed(2)}W.`;
      }
      this._descIReq.textContent = desc;
    }
  }

  /**
   * Gráfica 1: Voltaje vs Corriente (V vs I) - Recta de Ohm
   * Eje X: Voltaje (0 a 48V)
   * Eje Y: Corriente (0 a 3A o dinámica según escala)
   * @private
   */
  _renderVIPlot(state) {
    const canvas = this.canvasVI;
    const ctx = this.ctxVI;
    if (!canvas || !ctx) return;

    this._fixResolution(canvas, ctx);
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;

    // Márgenes técnicos
    const padLeft = 46;
    const padRight = 20;
    const padTop = 24;
    const padBottom = 34;

    const plotW = W - padLeft - padRight;
    const plotH = H - padTop - padBottom;

    // Limpiar fondo
    ctx.fillStyle = this.theme.bg;
    ctx.fillRect(0, 0, W, H);

    // Escalas
    const maxV = 48; // Escala fija de voltaje para visualización clara
    const req = state.telemetry.req;
    const isShort = state.telemetry.isShortCircuit;
    const isOpen = state.telemetry.isOpenCircuit || req === Infinity;

    // Determinar escala Y de corriente dinámica
    const currentI = state.telemetry.it;
    let maxI = Math.max(3.0, currentI * 1.3);
    if (isShort) maxI = 10.0;

    // Dibujar Rejilla milimétrica
    this._drawGrid(ctx, padLeft, padTop, plotW, plotH, 6, 5);

    // Dibujar Ejes y Etiquetas
    this._drawAxes(ctx, padLeft, padTop, plotW, plotH, {
      xLabel: 'Voltaje (V)',
      yLabel: 'Corriente I (A)',
      xMax: maxV,
      yMax: maxI,
      xUnit: 'V',
      yUnit: 'A'
    });

    // Mapeador de coordenadas físicas a píxeles
    const toCanvasX = (v) => padLeft + (v / maxV) * plotW;
    const toCanvasY = (i) => padTop + plotH - (i / maxI) * plotH;

    // Trazar la Recta de la Ley de Ohm: I = V / Req
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = this.theme.curveVI;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = this.theme.curveVI;
    ctx.shadowBlur = 8;

    if (isOpen) {
      // Si está abierto, la corriente es 0 para cualquier voltaje
      ctx.moveTo(toCanvasX(0), toCanvasY(0));
      ctx.lineTo(toCanvasX(maxV), toCanvasY(0));
    } else if (isShort) {
      // En cortocircuito la recta es una vertical en V=0
      ctx.moveTo(toCanvasX(0), toCanvasY(0));
      ctx.lineTo(toCanvasX(0), toCanvasY(maxI));
    } else {
      const vStart = 0;
      const iStart = 0;
      const vEnd = maxV;
      const iEnd = vEnd / req;

      ctx.moveTo(toCanvasX(vStart), toCanvasY(iStart));
      ctx.lineTo(toCanvasX(vEnd), toCanvasY(Math.min(maxI, iEnd)));
    }
    ctx.stroke();
    ctx.restore();

    // Dibujar Pendiente / Ecuación
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = this.theme.textAccent;
    const slopeText = isShort
      ? 'Pendiente: ∞ (R=0Ω)'
      : (isOpen ? 'Pendiente: 0 (Req = ∞)' : `Pendiente m = 1/Req = ${(1 / req).toFixed(4)} Ω⁻¹`);
    ctx.fillText(slopeText, padLeft + 8, padTop + 14);

    // Punto de Operación Actual (V_actual, I_actual)
    const opV = state.voltage;
    const opI = isOpen ? 0 : (isShort ? maxI * 0.9 : currentI);
    const ptX = toCanvasX(opV);
    const ptY = toCanvasY(Math.min(maxI, opI));

    this._drawOperatingPoint(ctx, ptX, ptY, isShort ? this.theme.alertGlow : this.theme.pointGlow, {
      title: `P (${opV}V, ${currentI.toFixed(2)}A)`,
      sub: `Req: ${isOpen ? '∞' : req.toFixed(1)}Ω`
    });
  }

  /**
   * Gráfica 2: Corriente vs Resistencia Equivalente (I vs Req) - Hipérbola Decreciente
   * I = V / Req (con V constante fijado por la fuente)
   * @private
   */
  _renderIReqPlot(state) {
    const canvas = this.canvasIReq;
    const ctx = this.ctxIReq;
    if (!canvas || !ctx) return;

    this._fixResolution(canvas, ctx);
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;

    const padLeft = 46;
    const padRight = 20;
    const padTop = 24;
    const padBottom = 34;

    const plotW = W - padLeft - padRight;
    const plotH = H - padTop - padBottom;

    ctx.fillStyle = this.theme.bg;
    ctx.fillRect(0, 0, W, H);

    const maxReq = 120; // Rango de 0 a 120 Ohms para apreciar la curvatura
    const V = state.voltage;
    const currentReq = state.telemetry.req;
    const currentI = state.telemetry.it;
    const isShort = state.telemetry.isShortCircuit;
    const isOpen = state.telemetry.isOpenCircuit || currentReq === Infinity;

    let maxI = Math.max(3.0, (V / 5) * 1.1);
    if (maxI > 15) maxI = 15;

    // Dibujar Rejilla
    this._drawGrid(ctx, padLeft, padTop, plotW, plotH, 6, 5);

    // Dibujar Ejes y Etiquetas
    this._drawAxes(ctx, padLeft, padTop, plotW, plotH, {
      xLabel: 'Resistencia Req (Ω)',
      yLabel: 'Corriente I (A)',
      xMax: maxReq,
      yMax: maxI,
      xUnit: 'Ω',
      yUnit: 'A'
    });

    const toCanvasX = (r) => padLeft + (r / maxReq) * plotW;
    const toCanvasY = (i) => padTop + plotH - (i / maxI) * plotH;

    // Trazar Hipérbola: I(R) = V / R
    if (V > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = this.theme.curveIReq;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = this.theme.curveIReq;
      ctx.shadowBlur = 8;

      const steps = 80;
      let first = true;
      for (let s = 1; s <= steps; s++) {
        const rVal = (s / steps) * maxReq;
        const iVal = V / rVal;
        const cx = toCanvasX(rVal);
        const cy = toCanvasY(Math.min(maxI, iVal));

        if (first) {
          ctx.moveTo(cx, cy);
          first = false;
        } else {
          ctx.lineTo(cx, cy);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // Título de la Función
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = this.theme.curveIReq;
    ctx.fillText(`Función I(R) = ${V}V / R (Hipérbola)`, padLeft + 8, padTop + 14);

    // Punto de Operación Actual (Req_actual, I_actual)
    if (!isOpen && !isShort && currentReq <= maxReq) {
      const ptX = toCanvasX(currentReq);
      const ptY = toCanvasY(Math.min(maxI, currentI));
      this._drawOperatingPoint(ctx, ptX, ptY, this.theme.pointGlow, {
        title: `(${currentReq.toFixed(1)}Ω, ${currentI.toFixed(2)}A)`,
        sub: `P = ${(V * currentI).toFixed(1)}W`
      });
    } else if (isOpen) {
      // Dibujar indicador asintótico a la derecha
      ctx.fillStyle = this.theme.text;
      ctx.font = '10px "Inter", sans-serif';
      ctx.fillText('Req → ∞ ➔ I = 0 A', padLeft + plotW - 120, padTop + plotH - 12);
    }
  }

  /**
   * Dibuja la cuadrícula técnica de fondo.
   * @private
   */
  _drawGrid(ctx, x, y, w, h, cols, rows) {
    ctx.save();
    ctx.lineWidth = 1;

    // Líneas verticales
    for (let i = 0; i <= cols; i++) {
      const gx = x + (i / cols) * w;
      ctx.strokeStyle = i === 0 || i === cols ? this.theme.gridMajor : this.theme.gridMinor;
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx, y + h);
      ctx.stroke();
    }

    // Líneas horizontales
    for (let j = 0; j <= rows; j++) {
      const gy = y + (j / rows) * h;
      ctx.strokeStyle = j === 0 || j === rows ? this.theme.gridMajor : this.theme.gridMinor;
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Dibuja los ejes de coordenadas y las escalas numéricas.
   * @private
   */
  _drawAxes(ctx, x, y, w, h, config) {
    ctx.save();
    ctx.strokeStyle = this.theme.gridMajor;
    ctx.lineWidth = 1.5;

    // Eje X e Y
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.stroke();

    // Tipografía
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = this.theme.text;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    // Marcas de escala Y
    const ySteps = 4;
    for (let i = 0; i <= ySteps; i++) {
      const val = ((ySteps - i) / ySteps) * config.yMax;
      const py = y + (i / ySteps) * h;
      ctx.fillText(`${val.toFixed(1)}`, x - 6, py);
    }

    // Marcas de escala X
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const xSteps = 4;
    for (let i = 0; i <= xSteps; i++) {
      const val = (i / xSteps) * config.xMax;
      const px = x + (i / xSteps) * w;
      ctx.fillText(`${val.toFixed(0)}`, px, y + h + 6);
    }

    // Título del Eje X
    ctx.font = '10px "Inter", sans-serif';
    ctx.fillStyle = this.theme.textAccent;
    ctx.fillText(config.xLabel, x + w / 2, y + h + 18);

    // Título del Eje Y
    ctx.save();
    ctx.translate(14, y + h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(config.yLabel, 0, 0);
    ctx.restore();

    ctx.restore();
  }

  /**
   * Dibuja un punto de operación destacado con resplandor y tooltip de texto.
   * @private
   */
  _drawOperatingPoint(ctx, x, y, glowColor, label) {
    ctx.save();

    // Halo exterior de resplandor
    const radGrad = ctx.createRadialGradient(x, y, 2, x, y, 14);
    radGrad.addColorStop(0, glowColor);
    radGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();

    // Núcleo del punto
    ctx.fillStyle = this.theme.pointFill;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Placa de valor (etiqueta)
    if (label && label.title) {
      ctx.font = '9px "JetBrains Mono", monospace';
      const textWidth = ctx.measureText(label.title).width;
      const boxW = Math.max(textWidth + 12, 60);
      const boxH = 24;

      let boxX = x + 8;
      let boxY = y - 28;
      if (boxX + boxW > ctx.canvas.width / (window.devicePixelRatio || 1) - 10) {
        boxX = x - boxW - 8;
      }
      if (boxY < 10) {
        boxY = y + 10;
      }

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1;
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(label.title, boxX + 6, boxY + 4);

      if (label.sub) {
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(label.sub, boxX + 6, boxY + 14);
      }
    }

    ctx.restore();
  }
}
