/**
 * js/components/ColorCodeModal.js
 * Modal y Calculadora Interactiva de Código de Colores de Resistores (4 Bandas EIA).
 */

import { ColorCodeEngine, COLOR_TABLE } from '../engine/ColorCodeEngine.js';

export class ColorCodeModal {
  constructor(modalElement, { stateManager } = {}) {
    this.modal = modalElement;
    this.stateManager = stateManager;

    this.selectedBands = {
      b1: 'brown',
      b2: 'black',
      b3: 'black',
      b4: 'gold'
    };

    this._initDOMElements();
    this._bindEvents();
    this._updateFromBands();
  }

  _initDOMElements() {
    this.openBtn = document.getElementById('btn-open-color-code');
    this.closeBtn = this.modal.querySelector('#btn-close-color-code');

    this.selectB1 = this.modal.querySelector('#color-band-1');
    this.selectB2 = this.modal.querySelector('#color-band-2');
    this.selectB3 = this.modal.querySelector('#color-band-3');
    this.selectB4 = this.modal.querySelector('#color-band-4');

    this.resistorPreviewBody = this.modal.querySelector('#resistor-preview-body');
    this.previewBand1 = this.modal.querySelector('#preview-band-1');
    this.previewBand2 = this.modal.querySelector('#preview-band-2');
    this.previewBand3 = this.modal.querySelector('#preview-band-3');
    this.previewBand4 = this.modal.querySelector('#preview-band-4');

    this.outOhms = this.modal.querySelector('#color-calc-ohms');
    this.outRange = this.modal.querySelector('#color-calc-range');
    this.inputManualOhms = this.modal.querySelector('#input-manual-ohms');
    this.selectTargetResistor = this.modal.querySelector('#select-color-target-resistor');
    this.btnApplyToTarget = this.modal.querySelector('#btn-apply-color-to-target') || this.modal.querySelector('#btn-apply-color-to-r1');
    this.btnResetCalc = this.modal.querySelector('#btn-reset-color-code-calc');
  }

  _bindEvents() {
    if (this.openBtn) {
      this.openBtn.addEventListener('click', () => this.open());
    }

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    // Cerrar al hacer clic fuera o Escape
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.modal.classList.contains('hidden')) {
        this.close();
      }
    });

    // Selects de Bandas
    const handleBandChange = () => {
      this.selectedBands.b1 = this.selectB1.value;
      this.selectedBands.b2 = this.selectB2.value;
      this.selectedBands.b3 = this.selectB3.value;
      this.selectedBands.b4 = this.selectB4.value;
      this._updateFromBands();
    };

    [this.selectB1, this.selectB2, this.selectB3, this.selectB4].forEach(sel => {
      if (sel) sel.addEventListener('change', handleBandChange);
    });

    // Input manual en Ohmios
    if (this.inputManualOhms) {
      this.inputManualOhms.addEventListener('input', (e) => {
        const ohms = parseFloat(e.target.value);
        if (!isNaN(ohms) && ohms > 0) {
          this._updateFromValue(ohms);
        }
      });
    }

    // Botón para aplicar el valor a la resistencia seleccionada (R1, R2 o R3)
    if (this.btnApplyToTarget && this.stateManager) {
      this.btnApplyToTarget.addEventListener('click', () => {
        const res = ColorCodeEngine.getValueFromBands(
          this.selectedBands.b1,
          this.selectedBands.b2,
          this.selectedBands.b3,
          this.selectedBands.b4
        );
        const targetIdx = this.selectTargetResistor ? parseInt(this.selectTargetResistor.value, 10) || 0 : 0;
        this.stateManager.setResistor(targetIdx, res.ohms);
        this.close();
      });
    }

    // Botón para restablecer valores predeterminados (10Ω)
    if (this.btnResetCalc) {
      this.btnResetCalc.addEventListener('click', () => {
        this.reset();
      });
    }
  }

  /**
   * Restablece el decodificador al valor predeterminado (10Ω: Marrón-Negro-Negro-Dorado).
   */
  reset() {
    this.selectedBands = {
      b1: 'brown',
      b2: 'black',
      b3: 'black',
      b4: 'gold'
    };
    if (this.selectB1) this.selectB1.value = 'brown';
    if (this.selectB2) this.selectB2.value = 'black';
    if (this.selectB3) this.selectB3.value = 'black';
    if (this.selectB4) this.selectB4.value = 'gold';
    if (this.inputManualOhms) this.inputManualOhms.value = 10;
    if (this.selectTargetResistor) this.selectTargetResistor.value = '0';
    this._updateFromBands();
  }

  open() {
    this.modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  close() {
    this.modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  /**
   * Actualiza el cálculo a partir de las bandas seleccionadas.
   * @private
   */
  _updateFromBands() {
    const res = ColorCodeEngine.getValueFromBands(
      this.selectedBands.b1,
      this.selectedBands.b2,
      this.selectedBands.b3,
      this.selectedBands.b4
    );

    if (this.previewBand1) this.previewBand1.style.backgroundColor = res.hexColors[0];
    if (this.previewBand2) this.previewBand2.style.backgroundColor = res.hexColors[1];
    if (this.previewBand3) this.previewBand3.style.backgroundColor = res.hexColors[2];
    if (this.previewBand4) this.previewBand4.style.backgroundColor = res.hexColors[3];

    if (this.outOhms) this.outOhms.textContent = `${res.formattedValue} (±${res.tolerancePercent}%)`;
    if (this.outRange) this.outRange.textContent = `Rango real admisible: ${res.minOhms} Ω - ${res.maxOhms} Ω`;
    if (this.inputManualOhms && document.activeElement !== this.inputManualOhms) {
      this.inputManualOhms.value = res.ohms;
    }
  }

  /**
   * Actualiza los selects y el dibujo a partir de un valor en Ohmios.
   * @private
   */
  _updateFromValue(ohms) {
    const info = ColorCodeEngine.getBandsFromValue(ohms);
    this.selectedBands.b1 = info.bands[0].key;
    this.selectedBands.b2 = info.bands[1].key;
    this.selectedBands.b3 = info.bands[2].key;
    this.selectedBands.b4 = info.bands[3].key;

    if (this.selectB1) this.selectB1.value = this.selectedBands.b1;
    if (this.selectB2) this.selectB2.value = this.selectedBands.b2;
    if (this.selectB3) this.selectB3.value = this.selectedBands.b3;
    if (this.selectB4) this.selectB4.value = this.selectedBands.b4;

    if (this.previewBand1) this.previewBand1.style.backgroundColor = info.hexColors[0];
    if (this.previewBand2) this.previewBand2.style.backgroundColor = info.hexColors[1];
    if (this.previewBand3) this.previewBand3.style.backgroundColor = info.hexColors[2];
    if (this.previewBand4) this.previewBand4.style.backgroundColor = info.hexColors[3];

    if (this.outOhms) this.outOhms.textContent = `${info.formattedValue} (±5%)`;
    const minVal = (ohms * 0.95).toFixed(2);
    const maxVal = (ohms * 1.05).toFixed(2);
    if (this.outRange) this.outRange.textContent = `Rango real admisible: ${minVal} Ω - ${maxVal} Ω`;
  }
}
