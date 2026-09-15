/**
 * js/components/QuizView.js
 * Componente de Evaluación Formativa y Sustentación Teórica (Zona 4).
 * 
 * Permite:
 * - Navegar entre reactivos del banco de preguntas.
 * - Responder de forma interactiva con feedback visual inmediato.
 * - Desplegar el cuadro verde de justificación teórica y fórmulas matemáticas paso a paso.
 * - Probar la hipótesis directamente en el simulador mediante un botón de ajuste asistido.
 */

import { QUIZ_QUESTIONS } from '../../data/questions.js';

export class QuizView {
  /**
   * @param {HTMLElement} container - Contenedor DOM de la Zona 4
   * @param {Object} options - Dependencias (stateManager para ajustar el simulador)
   */
  constructor(container, { stateManager } = {}) {
    this.container = container;
    this.stateManager = stateManager;
    this.questions = QUIZ_QUESTIONS;
    this.currentQuestionIndex = 0;
    this.selectedAnswers = {}; // { questionId: optionId }

    this._initDOMElements();
    this._bindEvents();
    this._renderQuestion();
  }

  /**
   * Captura elementos del DOM de la Zona 4.
   * @private
   */
  _initDOMElements() {
    this.selectEl = this.container.querySelector('#quiz-select');
    this.promptEl = this.container.querySelector('#quiz-prompt');
    this.optionsContainer = this.container.querySelector('#quiz-options-container');
    this.justificationBox = this.container.querySelector('#quiz-justification-box');
    this.justificationTitle = this.container.querySelector('#justification-title');
    this.justificationText = this.container.querySelector('#justification-text');
    this.justificationFormula = this.container.querySelector('#justification-formula');
    this.justificationTip = this.container.querySelector('#justification-tip');
    this.btnApplyExperiment = this.container.querySelector('#btn-apply-experiment');
    this.scoreBadge = this.container.querySelector('#quiz-score-badge');
    this.btnResetQuiz = this.container.querySelector('#btn-reset-quiz');

    // Población inicial del selector de preguntas
    if (this.selectEl) {
      this.selectEl.innerHTML = this.questions.map((q, idx) => `
        <option value="${idx}">Pregunta ${q.id}: ${q.title.split(':')[1] || q.title}</option>
      `).join('');
    }
  }

  /**
   * Enlaza eventos de usuario.
   * @private
   */
  _bindEvents() {
    if (this.selectEl) {
      this.selectEl.addEventListener('change', (e) => {
        this.currentQuestionIndex = parseInt(e.target.value, 10) || 0;
        this._renderQuestion();
      });
    }

    if (this.btnApplyExperiment) {
      this.btnApplyExperiment.addEventListener('click', () => {
        this._applyPresetForCurrentQuestion();
      });
    }

    if (this.btnResetQuiz) {
      this.btnResetQuiz.addEventListener('click', () => {
        this.resetQuiz();
      });
    }
  }

  /**
   * Reinicia todas las respuestas seleccionadas y el puntaje a 0/10.
   */
  resetQuiz() {
    this.selectedAnswers = {};
    this.currentQuestionIndex = 0;
    if (this.selectEl) this.selectEl.value = '0';
    this._renderQuestion();
  }

  /**
   * Renderiza el reactivo actual en pantalla.
   * @private
   */
  _renderQuestion() {
    const q = this.questions[this.currentQuestionIndex];
    if (!q) return;

    if (this.promptEl) {
      this.promptEl.textContent = q.prompt;
    }

    const selected = this.selectedAnswers[q.id];

    // Renderizar opciones [A], [B], [C], [D]
    if (this.optionsContainer) {
      this.optionsContainer.innerHTML = q.options.map(opt => {
        let isChosen = selected === opt.id;
        let isCorrect = q.correctAnswer === opt.id;
        let optionClass = 'quiz-option';

        if (selected) {
          if (isChosen && isCorrect) {
            optionClass += ' option-correct';
          } else if (isChosen && !isCorrect) {
            optionClass += ' option-incorrect';
          } else if (isCorrect) {
            optionClass += ' option-reveal-correct';
          }
        }

        return `
          <button type="button" class="${optionClass}" data-option-id="${opt.id}" ${selected ? 'disabled' : ''} tabindex="${selected ? '-1' : '0'}">
            <span class="option-badge">[${opt.id}]</span>
            <span class="option-text">${opt.text}</span>
          </button>
        `;
      }).join('');

      // Agregar listeners a los botones de opciones (click + teclado)
      this.optionsContainer.querySelectorAll('.quiz-option').forEach(btn => {
        const handleSelect = () => {
          const optId = btn.getAttribute('data-option-id');
          this._handleAnswerSelect(q.id, optId);
        };
        
        btn.addEventListener('click', handleSelect);
        btn.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleSelect();
          }
        });
      });
    }

    // Renderizar Cuadro Verde de Justificación Teórica
    if (this.justificationBox) {
      if (selected) {
        this.justificationBox.classList.remove('hidden');
        if (this.justificationTitle) {
          this.justificationTitle.textContent = `Justificación Teórica: ${q.justification.law}`;
        }
        if (this.justificationText) {
          this.justificationText.textContent = q.justification.explanation;
        }
        if (this.justificationFormula) {
          // Usar textContent para seguridad, el CSS maneja el estilo monoespaciado
          this.justificationFormula.textContent = q.justification.formula;
        }
        if (this.justificationTip) {
          // Reemplazar emoji 💡 con SVG inline seguro
          this.justificationTip.innerHTML = '<strong><svg class="icon" aria-hidden="true"><use href="#icon-flask"></use></svg> Aplicación Práctica:</strong> ' + q.justification.realWorldTip;
        }
      } else {
        this.justificationBox.classList.add('hidden');
      }
    }

    this._updateScoreBadge();
  }

  /**
   * Maneja la selección de respuesta por el usuario.
   * @private
   */
  _handleAnswerSelect(questionId, optionId) {
    this.selectedAnswers[questionId] = optionId;
    this._renderQuestion();
  }

  /**
   * Obtiene el progreso y detalle de respuestas del cuestionario para los informes.
   * @returns {Object}
   */
  getQuizProgress() {
    const total = this.questions.length;
    let answered = 0;
    let correct = 0;
    const details = this.questions.map(q => {
      const selected = this.selectedAnswers[q.id] || null;
      const isCorrect = selected === q.correctAnswer;
      if (selected) {
        answered++;
        if (isCorrect) correct++;
      }
      return {
        id: q.id,
        title: q.title,
        prompt: q.prompt,
        correctAnswer: q.correctAnswer,
        correctText: (q.options.find(o => o.id === q.correctAnswer)?.text) || '',
        selectedOptionId: selected,
        selectedOptionText: selected ? (q.options.find(o => o.id === selected)?.text || '') : 'Sin responder',
        isCorrect: selected ? isCorrect : false,
        justification: q.justification
      };
    });

    return {
      total,
      answered,
      correct,
      scorePercent: total > 0 ? ((correct / total) * 100).toFixed(0) : 0,
      details
    };
  }

  /**
   * Actualiza el contador de puntaje formativo.
   * @private
   */
  _updateScoreBadge() {
    if (!this.scoreBadge) return;
    const total = this.questions.length;
    let correct = 0;
    let answered = 0;

    this.questions.forEach(q => {
      const ans = this.selectedAnswers[q.id];
      if (ans) {
        answered++;
        if (ans === q.correctAnswer) correct++;
      }
    });

    this.scoreBadge.textContent = `${correct}/${total} Correctas`;
  }

  /**
   * Configura automáticamente el simulador con los parámetros ideales para experimentar la pregunta.
   * @private
   */
  _applyPresetForCurrentQuestion() {
    if (!this.stateManager) return;
    const qIndex = this.currentQuestionIndex;

    if (qIndex === 0) {
      // Pregunta 1: Voltaje al doble (24V con R=10Ω)
      this.stateManager.setTopology('series');
      this.stateManager.setVoltage(24);
      this.stateManager.setResistor(0, 10);
      this.stateManager.setResistor(1, 10);
      this.stateManager.setResistor(2, 10);
      this.stateManager.setSwitchState(0, 'ON');
      this.stateManager.setSwitchState(1, 'ON');
      this.stateManager.setSwitchState(2, 'ON');
    } else if (qIndex === 1) {
      // Pregunta 2: Resistencia alta (R=100Ω)
      this.stateManager.setTopology('series');
      this.stateManager.setVoltage(12);
      this.stateManager.setResistor(0, 100);
      this.stateManager.setResistor(1, 10);
      this.stateManager.setResistor(2, 10);
      this.stateManager.setSwitchState(0, 'ON');
      this.stateManager.setSwitchState(1, 'ON');
      this.stateManager.setSwitchState(2, 'ON');
    } else if (qIndex === 2) {
      // Pregunta 3: Misma corriente en Serie (12V, 10, 20, 30)
      this.stateManager.setTopology('series');
      this.stateManager.setVoltage(12);
      this.stateManager.setResistor(0, 10);
      this.stateManager.setResistor(1, 20);
      this.stateManager.setResistor(2, 30);
      this.stateManager.setSwitchState(0, 'ON');
      this.stateManager.setSwitchState(1, 'ON');
      this.stateManager.setSwitchState(2, 'ON');
    } else if (qIndex === 3) {
      // Pregunta 4: Req en serie (Suma 10+20+30 = 60Ω)
      this.stateManager.setTopology('series');
      this.stateManager.setVoltage(12);
      this.stateManager.setResistor(0, 10);
      this.stateManager.setResistor(1, 20);
      this.stateManager.setResistor(2, 30);
      this.stateManager.setSwitchState(0, 'ON');
      this.stateManager.setSwitchState(1, 'ON');
      this.stateManager.setSwitchState(2, 'ON');
    } else if (qIndex === 4) {
      // Pregunta 5: LVK Serie (Caídas 2V, 4V, 6V suman 12V)
      this.stateManager.setTopology('series');
      this.stateManager.setVoltage(12);
      this.stateManager.setResistor(0, 10);
      this.stateManager.setResistor(1, 20);
      this.stateManager.setResistor(2, 30);
      this.stateManager.setSwitchState(0, 'ON');
      this.stateManager.setSwitchState(1, 'ON');
      this.stateManager.setSwitchState(2, 'ON');
    } else if (qIndex === 5) {
      // Pregunta 6: Mismo Voltaje en Paralelo (12V en todas)
      this.stateManager.setTopology('parallel');
      this.stateManager.setVoltage(12);
      this.stateManager.setResistor(0, 10);
      this.stateManager.setResistor(1, 20);
      this.stateManager.setResistor(2, 30);
      this.stateManager.setSwitchState(0, 'ON');
      this.stateManager.setSwitchState(1, 'ON');
      this.stateManager.setSwitchState(2, 'ON');
    } else if (qIndex === 6) {
      // Pregunta 7: Req en Paralelo menor (Req = 5.45Ω)
      this.stateManager.setTopology('parallel');
      this.stateManager.setVoltage(12);
      this.stateManager.setResistor(0, 10);
      this.stateManager.setResistor(1, 20);
      this.stateManager.setResistor(2, 30);
      this.stateManager.setSwitchState(0, 'ON');
      this.stateManager.setSwitchState(1, 'ON');
      this.stateManager.setSwitchState(2, 'ON');
    } else if (qIndex === 7) {
      // Pregunta 8: LCK Nodos en Paralelo (IT = I1 + I2 + I3)
      this.stateManager.setTopology('parallel');
      this.stateManager.setVoltage(12);
      this.stateManager.setResistor(0, 10);
      this.stateManager.setResistor(1, 20);
      this.stateManager.setResistor(2, 30);
      this.stateManager.setSwitchState(0, 'ON');
      this.stateManager.setSwitchState(1, 'ON');
      this.stateManager.setSwitchState(2, 'ON');
    } else if (qIndex === 8) {
      // Pregunta 9: Falla de rama abierta en Paralelo vs Serie
      this.stateManager.setTopology('parallel');
      this.stateManager.setVoltage(12);
      this.stateManager.setResistor(0, 10);
      this.stateManager.setResistor(1, 20);
      this.stateManager.setResistor(2, 30);
      this.stateManager.setSwitchState(0, 'ON');
      this.stateManager.setSwitchState(1, 'OPEN');
      this.stateManager.setSwitchState(2, 'ON');
    } else if (qIndex === 9) {
      // Pregunta 10: Cortocircuito (R1 en corto)
      this.stateManager.setTopology('series');
      this.stateManager.setVoltage(12);
      this.stateManager.setSwitchState(0, 'SHORT');
      this.stateManager.setSwitchState(1, 'SHORT');
      this.stateManager.setSwitchState(2, 'SHORT');
    }
  }
}
