/**
 * js/components/SchematicView.js
 * Renderizador de Esquemas Eléctricos Dinámicos y Animación de Flujo de Corriente.
 * 
 * Dibuja en Canvas/SVG interactivo:
 * - Topologías: Serie, Paralelo y Mixto.
 * - Símbolos normalizados de Fuente DC y Resistencias con lectura de voltaje/corriente local.
 * - Partículas de carga eléctrica (electrones / corriente convencional) con velocidad proporcional al amperaje.
 * - Indicadores visuales de estados de falla (calentamiento, interruptor abierto, arco de corto).
 */

import { ColorCodeEngine } from '../engine/ColorCodeEngine.js';

export class SchematicView {
  /**
   * @param {HTMLCanvasElement} canvas - Canvas destinado al esquema
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.particleOffset = 0;
    this._animationFrameId = null;
    this._lastState = null;
    this._prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._descriptionEl = document.getElementById('schematic-description');

    // Escuchar cambios en prefers-reduced-motion
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      this._prefersReducedMotion = e.matches;
    });

    this._startAnimationLoop();
  }

  /**
   * Inicia el bucle de animación para el flujo continuo de partículas.
   * @private
   */
  _startAnimationLoop() {
    const loop = () => {
      if (this._lastState && this.ctx) {
        // La velocidad de las partículas aumenta con la corriente (I_T)
        const current = this._lastState.telemetry ? this._lastState.telemetry.it : 0;
        const isShort = this._lastState.telemetry ? this._lastState.telemetry.isShortCircuit : false;
        
        // Respetar prefers-reduced-motion: no animar partículas
        if (!this._prefersReducedMotion) {
          let speed = Math.min(6, current * 1.8);
          if (isShort) speed = 12;
          if (current === 0) speed = 0;

          this.particleOffset = (this.particleOffset + speed) % 24;
        }
        
        this._renderSchematic(this._lastState);
        this._updateAccessibleDescription(this._lastState);
      }
      this._animationFrameId = requestAnimationFrame(loop);
    };
    loop();
  }

  /**
   * Actualiza la descripción accesible del esquema para lectores de pantalla.
   * @private
   */
  _updateAccessibleDescription(state) {
    if (!this._descriptionEl) return;
    const tele = state.telemetry;
    if (!tele) return;
    
    const topologyNames = {
      series: 'serie',
      parallel: 'paralelo',
      mixed: 'mixto'
    };
    
    const topology = topologyNames[state.topology] || state.topology;
    const branches = tele.branches.map(b => 
      `${b.id}: ${b.v.toFixed(1)}V, ${b.i.toFixed(2)}A, ${b.p.toFixed(2)}W (${b.status})`
    ).join('; ');
    
    let desc = `Circuito en ${topology}. Voltaje fuente: ${state.voltage}V. `;
    desc += `Resistencia equivalente: ${tele.isOpenCircuit ? 'infinita (abierto)' : tele.isShortCircuit ? 'cero (cortocircuito)' : tele.req.toFixed(2) + ' Ω'}. `;
    desc += `Corriente total: ${tele.it.toFixed(3)}A. Potencia total: ${tele.pt.toFixed(2)}W. `;
    desc += `Ramas: ${branches}. `;
    desc += `Ley de Voltajes: ${tele.kvlCheck.holds ? 'Cumple' : 'No cumple'}. `;
    desc += `Ley de Corrientes: ${tele.kclCheck.holds ? 'Cumple' : 'No cumple'}.`;
    
    this._descriptionEl.textContent = desc;
  }

  /**
   * Actualiza los datos del circuito y solicita re-renderizado.
   * @param {Object} state 
   */
  update(state) {
    this._lastState = state;
  }

  /**
   * Ajusta la resolución interna para pantallas HiDPI.
   * @private
   */
  _fixResolution() {
    if (!this.canvas || !this.ctx) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width || 420;
    const h = rect.height || 240;

    if (this.canvas.width !== w * dpr || this.canvas.height !== h * dpr) {
      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
      this.ctx.resetTransform?.();
      this.ctx.scale(dpr, dpr);
    }
  }

  /**
   * Dibuja el circuito según la topología actual.
   * @private
   */
  _renderSchematic(state) {
    const ctx = this.ctx;
    if (!ctx) return;

    this._fixResolution();
    const rect = this.canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;

    // Limpiar canvas
    ctx.clearRect(0, 0, W, H);

    // Fondo técnico de circuito impreso (PCB Blueprint)
    ctx.fillStyle = '#060911';
    ctx.fillRect(0, 0, W, H);

    const topology = state.topology;
    const tele = state.telemetry;

    if (topology === 'series') {
      this._drawSeriesCircuit(ctx, W, H, state, tele);
    } else if (topology === 'parallel') {
      this._drawParallelCircuit(ctx, W, H, state, tele);
    } else {
      this._drawMixedCircuit(ctx, W, H, state, tele);
    }
  }

  /**
   * Dibuja circuito en Serie
   * @private
   */
  _drawSeriesCircuit(ctx, W, H, state, tele) {
    const top = 45;
    const bottom = H - 45;
    const left = 50;
    const right = W - 50;

    // Cableado principal
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2.5;

    // Conectar malla rectangular
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(right, top);
    ctx.lineTo(right, bottom);
    ctx.lineTo(left, bottom);
    ctx.closePath();
    ctx.stroke();

    // Dibujar Fuente de Tensión en la rama izquierda
    this._drawVoltageSource(ctx, left, (top + bottom) / 2, state.voltage, tele.isShortCircuit);

    // Ubicación de las 3 resistencias en la rama superior y derecha
    const r1X = left + (right - left) * 0.25;
    const r2X = left + (right - left) * 0.75;
    const r3Y = (top + bottom) / 2;

    this._drawResistor(ctx, r1X, top, 0, tele.branches[0], 'H');
    this._drawResistor(ctx, r2X, top, 1, tele.branches[1], 'H');
    this._drawResistor(ctx, right, r3Y, 2, tele.branches[2], 'V');

    // Partículas de corriente
    if (tele.it > 0 && !tele.isOpenCircuit) {
      const path = [
        { x: left, y: top },
        { x: right, y: top },
        { x: right, y: bottom },
        { x: left, y: bottom },
        { x: left, y: top }
      ];
      this._drawCurrentParticles(ctx, path, tele.it);
    }
  }

  /**
   * Dibuja circuito en Paralelo
   * @private
   */
  _drawParallelCircuit(ctx, W, H, state, tele) {
    const top = 35;
    const bottom = H - 35;
    const left = 45;
    const branchX = [left + (W - left - 40) * 0.32, left + (W - left - 40) * 0.65, W - 45];

    // Rieles de distribución superior e inferior
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2.5;

    // Riel superior
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(branchX[2], top);
    ctx.stroke();

    // Riel inferior
    ctx.beginPath();
    ctx.moveTo(left, bottom);
    ctx.lineTo(branchX[2], bottom);
    ctx.stroke();

    // Fuente a la izquierda
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, bottom);
    ctx.stroke();
    this._drawVoltageSource(ctx, left, (top + bottom) / 2, state.voltage, tele.isShortCircuit);

    // Ramas en paralelo
    for (let i = 0; i < 3; i++) {
      const bx = branchX[i];
      ctx.beginPath();
      ctx.moveTo(bx, top);
      ctx.lineTo(bx, bottom);
      ctx.stroke();

      this._drawResistor(ctx, bx, (top + bottom) / 2, i, tele.branches[i], 'V');

      // Nodos de unión
      this._drawNode(ctx, bx, top);
      this._drawNode(ctx, bx, bottom);

      // Partículas por cada rama activa
      if (tele.branches[i].i > 0 && tele.branches[i].status !== 'ABIERTO') {
        const branchPath = [
          { x: bx, y: top },
          { x: bx, y: bottom }
        ];
        this._drawCurrentParticles(ctx, branchPath, tele.branches[i].i);
      }
    }

    // Partículas en rieles principales
    if (tele.it > 0 && !tele.isOpenCircuit) {
      this._drawCurrentParticles(ctx, [{ x: left, y: top }, { x: branchX[2], y: top }], tele.it);
      this._drawCurrentParticles(ctx, [{ x: branchX[2], y: bottom }, { x: left, y: bottom }], tele.it);
    }
  }

  /**
   * Dibuja circuito Mixto (R1 en serie con bloque paralelo R2 || R3)
   * @private
   */
  _drawMixedCircuit(ctx, W, H, state, tele) {
    const top = 38;
    const bottom = H - 38;
    const left = 45;
    const splitX = left + (W - left - 40) * 0.48;
    const branchX = [left + (W - left - 40) * 0.72, W - 45];
    const r1X = left + (splitX - left) * 0.5;

    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2.5;

    // Troncal principal con R1
    ctx.beginPath();
    ctx.moveTo(left, bottom);
    ctx.lineTo(left, top);
    ctx.lineTo(splitX, top);
    ctx.stroke();

    this._drawVoltageSource(ctx, left, (top + bottom) / 2, state.voltage, tele.isShortCircuit);
    this._drawResistor(ctx, r1X, top, 0, tele.branches[0], 'H');

    // Distribución al bloque paralelo
    ctx.beginPath();
    ctx.moveTo(splitX, top);
    ctx.lineTo(branchX[1], top);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(left, bottom);
    ctx.lineTo(branchX[1], bottom);
    ctx.stroke();

    this._drawNode(ctx, splitX, top);
    this._drawNode(ctx, splitX, bottom);

    // Rama R2
    ctx.beginPath();
    ctx.moveTo(branchX[0], top);
    ctx.lineTo(branchX[0], bottom);
    ctx.stroke();
    this._drawResistor(ctx, branchX[0], (top + bottom) / 2, 1, tele.branches[1], 'V');
    this._drawNode(ctx, branchX[0], top);
    this._drawNode(ctx, branchX[0], bottom);

    // Rama R3
    ctx.beginPath();
    ctx.moveTo(branchX[1], top);
    ctx.lineTo(branchX[1], bottom);
    ctx.stroke();
    this._drawResistor(ctx, branchX[1], (top + bottom) / 2, 2, tele.branches[2], 'V');

    // Partículas
    if (tele.it > 0 && !tele.isOpenCircuit) {
      // Flujo en R1
      this._drawCurrentParticles(ctx, [
        { x: left, y: top },
        { x: splitX, y: top }
      ], tele.it);

      // Flujo en R2
      if (tele.branches[1].i > 0) {
        this._drawCurrentParticles(ctx, [
          { x: branchX[0], y: top },
          { x: branchX[0], y: bottom }
        ], tele.branches[1].i);
      }

      // Flujo en R3
      if (tele.branches[2].i > 0) {
        this._drawCurrentParticles(ctx, [
          { x: branchX[1], y: top },
          { x: branchX[1], y: bottom }
        ], tele.branches[2].i);
      }

      // Retorno
      this._drawCurrentParticles(ctx, [
        { x: branchX[1], y: bottom },
        { x: left, y: bottom }
      ], tele.it);
    }
  }

  /**
   * Dibuja la Fuente de Voltaje con símbolo DC normalizado.
   * @private
   */
  _drawVoltageSource(ctx, x, y, voltage, isShort) {
    ctx.save();
    // Limpiar hueco en el cable
    ctx.fillStyle = '#060911';
    ctx.fillRect(x - 18, y - 22, 36, 44);

    // Círculo de la fuente
    ctx.strokeStyle = isShort ? '#ef4444' : '#38bdf8';
    ctx.fillStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Símbolo de placas DC (+ y -)
    ctx.fillStyle = isShort ? '#ef4444' : '#38bdf8';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', x, y - 6);
    ctx.fillText('-', x, y + 6);

    // Etiqueta de voltaje
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${voltage}V`, x - 22, y + 3);

    ctx.restore();
  }

  /**
   * Dibuja un Resistor con símbolo zig-zag o caja normalizada según estado.
   * @private
   */
  _drawResistor(ctx, x, y, index, branchData, orientation = 'H') {
    ctx.save();
    const isHoriz = orientation === 'H';
    const isOpen = branchData.status === 'ABIERTO';
    const isShort = branchData.status === 'CORTO';
    const isOver = branchData.isOverheated;

    // Limpiar área de cable
    ctx.fillStyle = '#060911';
    if (isHoriz) {
      ctx.fillRect(x - 24, y - 16, 48, 32);
    } else {
      ctx.fillRect(x - 16, y - 24, 32, 48);
    }

    if (isOpen) {
      // Dibujar Interruptor Abierto
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (isHoriz) {
        ctx.arc(x - 14, y, 3, 0, Math.PI * 2);
        ctx.arc(x + 14, y, 3, 0, Math.PI * 2);
        ctx.stroke();
        // Palanca abierta
        ctx.beginPath();
        ctx.moveTo(x - 14, y);
        ctx.lineTo(x + 6, y - 14);
        ctx.stroke();
      } else {
        ctx.arc(x, y - 14, 3, 0, Math.PI * 2);
        ctx.arc(x, y + 14, 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y - 14);
        ctx.lineTo(x + 14, y + 6);
        ctx.stroke();
      }
    } else if (isShort) {
      // Línea de Cortocircuito con advertencia
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (isHoriz) {
        ctx.moveTo(x - 20, y);
        ctx.lineTo(x + 20, y);
      } else {
        ctx.moveTo(x, y - 20);
        ctx.lineTo(x, y + 20);
      }
      ctx.stroke();
    } else {
      // Resistencia Real con Cápsula Cerámica y 4 Bandas de Color EIA
      const bandsInfo = ColorCodeEngine.getBandsFromValue(branchData.nominalR);
      const hexColors = bandsInfo.hexColors;

      if (isOver) {
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 12;
      }

      if (isHoriz) {
        const bodyW = 36;
        const bodyH = 14;
        const rx = x - bodyW / 2;
        const ry = y - bodyH / 2;

        // Terminales metálicos de conexión
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x - 24, y);
        ctx.lineTo(rx, y);
        ctx.moveTo(rx + bodyW, y);
        ctx.lineTo(x + 24, y);
        ctx.stroke();

        // Cuerpo cerámico del resistor
        ctx.fillStyle = isOver ? '#ea580c' : '#d4b996';
        ctx.strokeStyle = isOver ? '#f97316' : '#78716c';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(rx, ry, bodyW, bodyH, 4);
        } else {
          ctx.rect(rx, ry, bodyW, bodyH);
        }
        ctx.fill();
        ctx.stroke();

        // Bandas de color normalizadas
        const bandOffsets = [0.22, 0.42, 0.62, 0.82];
        const bandW = 3.5;
        bandOffsets.forEach((ratio, bIdx) => {
          ctx.fillStyle = hexColors[bIdx];
          ctx.fillRect(rx + bodyW * ratio - bandW / 2, ry, bandW, bodyH);
        });
      } else {
        const bodyW = 14;
        const bodyH = 36;
        const rx = x - bodyW / 2;
        const ry = y - bodyH / 2;

        // Terminales metálicos
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x, y - 24);
        ctx.lineTo(x, ry);
        ctx.moveTo(x, ry + bodyH);
        ctx.lineTo(x, y + 24);
        ctx.stroke();

        // Cuerpo cerámico
        ctx.fillStyle = isOver ? '#ea580c' : '#d4b996';
        ctx.strokeStyle = isOver ? '#f97316' : '#78716c';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(rx, ry, bodyW, bodyH, 4);
        } else {
          ctx.rect(rx, ry, bodyW, bodyH);
        }
        ctx.fill();
        ctx.stroke();

        // Bandas de color normalizadas
        const bandOffsets = [0.22, 0.42, 0.62, 0.82];
        const bandH = 3.5;
        bandOffsets.forEach((ratio, bIdx) => {
          ctx.fillStyle = hexColors[bIdx];
          ctx.fillRect(rx, ry + bodyH * ratio - bandH / 2, bodyW, bandH);
        });
      }
    }

    // Etiquetas de Valores
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = isOver ? '#f97316' : (isOpen ? '#ef4444' : '#e2e8f0');
    ctx.textAlign = 'center';

    const labelR = `${branchData.id} (${branchData.nominalR}Ω)`;
    const labelVI = `${branchData.v.toFixed(1)}V | ${branchData.i.toFixed(2)}A`;

    if (isHoriz) {
      ctx.fillText(labelR, x, y - 14);
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(labelVI, x, y + 20);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(labelR, x + 18, y - 4);
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(labelVI, x + 18, y + 8);
    }

    ctx.restore();
  }

  /**
   * Dibuja nodo de interconexión eléctrica
   * @private
   */
  _drawNode(ctx, x, y) {
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Dibuja partículas en movimiento continuo sobre un camino de cables.
   * @private
   */
  _drawCurrentParticles(ctx, path, current) {
    // Respetar prefers-reduced-motion: no dibujar partículas animadas
    if (this._prefersReducedMotion) return;
    if (path.length < 2 || current <= 0) return;

    ctx.save();
    ctx.fillStyle = '#facc15';
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 4;

    const spacing = 18;

    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i];
      const p2 = path[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.hypot(dx, dy);
      if (dist === 0) continue;

      const ux = dx / dist;
      const uy = dy / dist;

      let d = (this.particleOffset % spacing);
      while (d < dist) {
        const px = p1.x + ux * d;
        const py = p1.y + uy * d;
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fill();
        d += spacing;
      }
    }
    ctx.restore();
  }

  /**
   * Destructor para detener el bucle si se desmonta.
   */
  destroy() {
    if (this._animationFrameId) {
      cancelAnimationFrame(this._animationFrameId);
    }
  }
}
