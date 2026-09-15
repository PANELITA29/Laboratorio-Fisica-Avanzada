/**
 * js/app.js
 * Orquestador y Punto de Entrada del Laboratorio Virtual de Física Avanzada.
 * 
 * Conecta:
 * - StateManager (Estado Reactivo)
 * - CircuitEngine (Física y Matemáticas)
 * - SchematicView (Esquema Dinámico y Flujo de Corriente)
 * - MultimeterView (Multímetro y Tabla de Datos)
 * - CanvasPlotter (Gráficas V vs I e I vs Req)
 * - QuizView (Evaluación y Sustentación)
 * - TheoryModal (Fundamentos Teóricos)
 */

import { StateManager } from './engine/StateManager.js';
import { MultimeterView } from './components/MultimeterView.js';
import { SchematicView } from './components/SchematicView.js';
import { CanvasPlotter } from './graphics/CanvasPlotter.js';
import { QuizView } from './components/QuizView.js';
import { TheoryModal } from './components/TheoryModal.js';
import { ColorCodeModal } from './components/ColorCodeModal.js';
import { ReportModal } from './components/ReportModal.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log('⚡ Inicializando Laboratorio Virtual de Física Avanzada...');

  // 1. Inicializar el Gestor de Estado Centralizado
  const stateManager = new StateManager({
    topology: 'series',
    voltage: 12,
    resistors: [10, 20, 30],
    switches: ['ON', 'ON', 'ON']
  });

  // 2. Inicializar Componentes de Visualización
  const multimeterContainer = document.getElementById('zone-2-multimeter');
  const multimeterView = new MultimeterView(multimeterContainer);

  const schematicCanvas = document.getElementById('schematic-canvas');
  const schematicView = new SchematicView(schematicCanvas);

  const canvasVI = document.getElementById('canvas-plot-vi');
  const canvasIReq = document.getElementById('canvas-plot-ireq');
  const canvasPlotter = new CanvasPlotter(canvasVI, canvasIReq);

  const quizContainer = document.getElementById('zone-4-evaluation');
  const quizView = new QuizView(quizContainer, { stateManager });

  const theoryModalEl = document.getElementById('theory-modal');
  const theoryModal = new TheoryModal(theoryModalEl);

  const colorCodeModalEl = document.getElementById('color-code-modal');
  const colorCodeModal = new ColorCodeModal(colorCodeModalEl, { stateManager });

  const reportModalEl = document.getElementById('report-modal');
  const reportModal = new ReportModal(reportModalEl, { stateManager, quizView });

  // 3. Capturar Elementos de Control de la Zona 1
  const topoBtns = document.querySelectorAll('.topology-btn');
  const topoBadge = document.getElementById('circuit-topology-badge');

  const sliderV = document.getElementById('slider-voltage');
  const badgeV = document.getElementById('val-badge-voltage');

  const sliderR1 = document.getElementById('slider-r1');
  const badgeR1 = document.getElementById('val-badge-r1');

  const sliderR2 = document.getElementById('slider-r2');
  const badgeR2 = document.getElementById('val-badge-r2');

  const sliderR3 = document.getElementById('slider-r3');
  const badgeR3 = document.getElementById('val-badge-r3');

  const switchGroups = document.querySelectorAll('.switch-btn-group');
  const btnReset = document.getElementById('btn-reset-circuit');

  // 4. Enlazar Eventos de los Controles a StateManager
  
  // Topologías (Serie / Paralelo / Mixto)
  topoBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const topo = btn.getAttribute('data-topology');
      stateManager.setTopology(topo);
    });
  });

  // Slider de Voltaje
  if (sliderV) {
    sliderV.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      stateManager.setVoltage(val);
    });
  }

  // Sliders de Resistencias
  if (sliderR1) {
    sliderR1.addEventListener('input', (e) => {
      stateManager.setResistor(0, parseFloat(e.target.value));
    });
  }

  if (sliderR2) {
    sliderR2.addEventListener('input', (e) => {
      stateManager.setResistor(1, parseFloat(e.target.value));
    });
  }

  if (sliderR3) {
    sliderR3.addEventListener('input', (e) => {
      stateManager.setResistor(2, parseFloat(e.target.value));
    });
  }

  // Switches de Falla (ON / OPEN / SHORT)
  switchGroups.forEach(group => {
    const idx = parseInt(group.getAttribute('data-switch-index'), 10);
    const modeBtns = group.querySelectorAll('.switch-mode-btn');

    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const state = btn.getAttribute('data-state');
        stateManager.setSwitchState(idx, state);
      });
    });
  });

  // Botón Reset / Calibración
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      stateManager.resetToDefaults();
    });
  }

  // 5. Suscripción Reactiva al Estado: Actualiza la UI sincronizadamente
  stateManager.subscribe((state) => {
    // A. Actualizar Vistas Principales
    multimeterView.update(state);
    schematicView.update(state);
    canvasPlotter.render(state);

    // B. Sincronizar Topología en UI
    topoBtns.forEach(btn => {
      const isMatch = btn.getAttribute('data-topology') === state.topology;
      btn.classList.toggle('active', isMatch);
    });

    if (topoBadge) {
      topoBadge.textContent = state.topology.toUpperCase();
    }

    // C. Sincronizar Sliders y Badges de Texto
    if (sliderV && parseFloat(sliderV.value) !== state.voltage) {
      sliderV.value = state.voltage;
    }
    if (badgeV) {
      badgeV.textContent = `${state.voltage.toFixed(1)} V`;
    }

    if (sliderR1 && parseFloat(sliderR1.value) !== state.resistors[0]) {
      sliderR1.value = state.resistors[0];
    }
    if (badgeR1) {
      badgeR1.textContent = `${state.resistors[0].toFixed(1)} Ω`;
    }

    if (sliderR2 && parseFloat(sliderR2.value) !== state.resistors[1]) {
      sliderR2.value = state.resistors[1];
    }
    if (badgeR2) {
      badgeR2.textContent = `${state.resistors[1].toFixed(1)} Ω`;
    }

    if (sliderR3 && parseFloat(sliderR3.value) !== state.resistors[2]) {
      sliderR3.value = state.resistors[2];
    }
    if (badgeR3) {
      badgeR3.textContent = `${state.resistors[2].toFixed(1)} Ω`;
    }

    // D. Sincronizar Botones de Switches de Falla
    switchGroups.forEach(group => {
      const idx = parseInt(group.getAttribute('data-switch-index'), 10);
      const activeState = state.switches[idx];
      const modeBtns = group.querySelectorAll('.switch-mode-btn');

      modeBtns.forEach(btn => {
        const btnState = btn.getAttribute('data-state');
        btn.classList.toggle('active', btnState === activeState);
      });
    });
  });

  console.log('✅ Laboratorio Virtual listo y operando a 60 FPS.');
});
