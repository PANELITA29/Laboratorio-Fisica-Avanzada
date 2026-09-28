/**
 * js/components/QuizView.js
 * Componente de Evaluación Formativa y Sustentación Teórica (Zona 4).
 * 
 * Permite:
 * - Visualizar todas las 10 preguntas continuas en un contenedor deslizable sin menú desplegable.
 * - Navegar rápidamente entre reactivos mediante una barra de pastillas interactivas (1..10).
 * - Responder cada reactivo de forma interactiva con feedback visual inmediato.
 * - Desplegar el cuadro verde de justificación teórica y fórmulas matemáticas paso a paso en cada reactivo.
 * - Probar la hipótesis directamente en el simulador mediante el botón de ajuste asistido de cada pregunta.
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
    this.selectedAnswers = {}; // { questionId: optionId }
    this.activeQuestionIndex = 0;

    this._initDOMElements();
    this._renderQuestionsList();
    this._bindEvents();
    this._updateScoreBadge();
    this._setupIntersectionObserver();
  }

  /**
   * Captura elementos del DOM de la Zona 4.
   * @private
   */
  _initDOMElements() {
    this.navPillsContainer = this.container.querySelector('#quiz-nav-pills');
    this.scrollListContainer = this.container.querySelector('#quiz-questions-list');
    this.btnResetQuiz = this.container.querySelector('#btn-reset-quiz');
    this.scoreBadge = this.container.querySelector('#quiz-score-badge');
  }

  /**
   * Renderiza la barra de pastillas (pills) y todas las tarjetas de preguntas en el contenedor deslizante.
   * @private
   */
  _renderQuestionsList() {
    if (this.navPillsContainer) {
      this.navPillsContainer.innerHTML = this.questions.map((q, idx) => `
        <button
          type="button"
          class="quiz-pill-btn ${idx === 0 ? 'active' : ''}"
          data-target-idx="${idx}"
          id="quiz-pill-${q.id}"
          title="Saltar a Pregunta ${q.id}"
          aria-label="Pregunta ${q.id}"
        >
          ${q.id}
        </button>
      `).join('');
    }

    if (this.scrollListContainer) {
      this.scrollListContainer.innerHTML = this.questions.map((q, idx) => {
        const titleText = q.title.includes(':') ? q.title.split(':')[1].trim() : q.title;

        return `
          <article
            class="quiz-item-card"
            id="quiz-question-${q.id}"
            data-question-id="${q.id}"
            data-question-index="${idx}"
          >
            <header class="quiz-item-header">
              <div class="quiz-item-title-wrap">
                <span class="quiz-item-badge">Pregunta ${q.id} de ${this.questions.length}</span>
                <h3 class="quiz-item-title">${titleText}</h3>
              </div>
              <span class="quiz-item-status status-unanswered" id="quiz-status-${q.id}">Pendiente</span>
            </header>

            <div class="quiz-prompt-box">
              ${q.prompt}
            </div>

            <div class="quiz-options-grid" id="quiz-options-${q.id}">
              ${q.options.map(opt => `
                <button
                  type="button"
                  class="quiz-option"
                  data-question-id="${q.id}"
                  data-option-id="${opt.id}"
                  tabindex="0"
                >
                  <span class="option-badge">[${opt.id}]</span>
                  <span class="option-text">${opt.text}</span>
                </button>
              `).join('')}
            </div>

            <div class="justification-box hidden" id="quiz-justification-${q.id}">
              <div class="justification-header">
                <svg class="icon" aria-hidden="true">
                  <use href="#icon-check"></use>
                </svg>
                <h4 class="justification-title">Justificación Teórica: ${q.justification.law}</h4>
              </div>
              <p class="justification-text">${q.justification.explanation}</p>
              <div class="justification-formula">${q.justification.formula}</div>
              <div class="justification-tip">
                <strong><svg class="icon" aria-hidden="true"><use href="#icon-flask"></use></svg> Aplicación Práctica:</strong> ${q.justification.realWorldTip}
              </div>
              <div class="quiz-action-bar">
                <button
                  type="button"
                  class="btn btn-primary btn-apply-experiment"
                  data-preset-idx="${idx}"
                  title="Configurar el circuito en el laboratorio para comprobar este principio"
                >
                  <svg class="icon" aria-hidden="true">
                    <use href="#icon-microscope"></use>
                  </svg>
                  <span>Probar Caso en el Simulador</span>
                </button>
              </div>
            </div>
          </article>
        `;
      }).join('');
    }
  }

  /**
   * Enlaza eventos de usuario delegados y directos.
   * @private
   */
  _bindEvents() {
    // Delegación de clics en las opciones de preguntas y botones de experimento
    if (this.scrollListContainer) {
      this.scrollListContainer.addEventListener('click', (e) => {
        const optionBtn = e.target.closest('.quiz-option');
        if (optionBtn) {
          const qId = parseInt(optionBtn.getAttribute('data-question-id'), 10);
          const optId = optionBtn.getAttribute('data-option-id');
          this._handleAnswerSelect(qId, optId);
          return;
        }

        const applyBtn = e.target.closest('.btn-apply-experiment');
        if (applyBtn) {
          const presetIdx = parseInt(applyBtn.getAttribute('data-preset-idx'), 10);
          this._applyPresetForQuestion(presetIdx);
        }
      });

      this.scrollListContainer.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          const optionBtn = e.target.closest('.quiz-option');
          if (optionBtn) {
            e.preventDefault();
            const qId = parseInt(optionBtn.getAttribute('data-question-id'), 10);
            const optId = optionBtn.getAttribute('data-option-id');
            this._handleAnswerSelect(qId, optId);
          }
        }
      });
    }

    // Delegación de clics en las pastillas (pills) de navegación rápida
    if (this.navPillsContainer) {
      this.navPillsContainer.addEventListener('click', (e) => {
        const pillBtn = e.target.closest('.quiz-pill-btn');
        if (pillBtn) {
          const targetIdx = parseInt(pillBtn.getAttribute('data-target-idx'), 10);
          this.scrollToQuestion(targetIdx);
        }
      });
    }

    // Botón de reinicio general del test
    if (this.btnResetQuiz) {
      this.btnResetQuiz.addEventListener('click', () => {
        this.resetQuiz();
      });
    }
  }

  /**
   * Configura IntersectionObserver para destacar la pastilla activa conforme se desliza la lista.
   * @private
   */
  _setupIntersectionObserver() {
    if (!this.scrollListContainer || !('IntersectionObserver' in window)) return;

    const options = {
      root: this.scrollListContainer,
      rootMargin: '0px 0px -60% 0px',
      threshold: 0.1
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const idx = parseInt(entry.target.getAttribute('data-question-index'), 10);
          if (!isNaN(idx)) {
            this._setActivePill(idx);
          }
        }
      });
    }, options);

    this.scrollListContainer.querySelectorAll('.quiz-item-card').forEach(card => {
      this.observer.observe(card);
    });
  }

  /**
   * Desplaza suavemente el contenedor deslizable hacia la pregunta especificada.
   * @param {number} index - Índice de la pregunta (0..9)
   */
  scrollToQuestion(index) {
    const q = this.questions[index];
    if (!q || !this.scrollListContainer) return;

    const targetEl = this.scrollListContainer.querySelector(`#quiz-question-${q.id}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this._setActivePill(index);
    }
  }

  /**
   * Actualiza la pastilla activa visualmente.
   * @private
   */
  _setActivePill(index) {
    this.activeQuestionIndex = index;
    if (!this.navPillsContainer) return;

    const pills = this.navPillsContainer.querySelectorAll('.quiz-pill-btn');
    pills.forEach((pill, idx) => {
      if (idx === index) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });
  }

  /**
   * Maneja la selección de respuesta para una pregunta específica.
   * @private
   */
  _handleAnswerSelect(questionId, optionId) {
    const q = this.questions.find(item => item.id === questionId);
    if (!q) return;

    this.selectedAnswers[questionId] = optionId;
    const isCorrect = q.correctAnswer === optionId;

    const card = this.scrollListContainer?.querySelector(`#quiz-question-${questionId}`);
    if (!card) return;

    // Actualizar clases de la tarjeta
    card.classList.remove('card-answered-correct', 'card-answered-incorrect');
    card.classList.add(isCorrect ? 'card-answered-correct' : 'card-answered-incorrect');

    // Actualizar botones de opciones
    const optionBtns = card.querySelectorAll('.quiz-option');
    optionBtns.forEach(btn => {
      const optId = btn.getAttribute('data-option-id');
      btn.classList.remove('option-correct', 'option-incorrect', 'option-reveal-correct');

      if (optId === optionId) {
        if (isCorrect) {
          btn.classList.add('option-correct');
        } else {
          btn.classList.add('option-incorrect');
        }
      } else if (optId === q.correctAnswer) {
        btn.classList.add('option-reveal-correct');
      }

      btn.setAttribute('disabled', 'true');
      btn.setAttribute('tabindex', '-1');
    });

    // Actualizar badge de estado
    const statusBadge = card.querySelector(`#quiz-status-${questionId}`);
    if (statusBadge) {
      statusBadge.className = `quiz-item-status ${isCorrect ? 'status-correct' : 'status-incorrect'}`;
      statusBadge.innerHTML = isCorrect
        ? '<svg class="icon-sm" aria-hidden="true"><use href="#icon-check"></use></svg> Correcta'
        : '✗ Incorrecta';
    }

    // Mostrar cuadro de justificación teórica
    const justBox = card.querySelector(`#quiz-justification-${questionId}`);
    if (justBox) {
      justBox.classList.remove('hidden');
    }

    // Actualizar pastilla de navegación rápida
    const pill = this.navPillsContainer?.querySelector(`#quiz-pill-${questionId}`);
    if (pill) {
      pill.classList.remove('pill-correct', 'pill-incorrect');
      pill.classList.add(isCorrect ? 'pill-correct' : 'pill-incorrect');
    }

    this._updateScoreBadge();
  }

  /**
   * Reinicia todas las respuestas seleccionadas y el puntaje a 0/10.
   */
  resetQuiz() {
    this.selectedAnswers = {};
    this.activeQuestionIndex = 0;

    if (this.scrollListContainer) {
      this.questions.forEach(q => {
        const card = this.scrollListContainer.querySelector(`#quiz-question-${q.id}`);
        if (card) {
          card.classList.remove('card-answered-correct', 'card-answered-incorrect');

          const optionBtns = card.querySelectorAll('.quiz-option');
          optionBtns.forEach(btn => {
            btn.classList.remove('option-correct', 'option-incorrect', 'option-reveal-correct');
            btn.removeAttribute('disabled');
            btn.setAttribute('tabindex', '0');
          });

          const statusBadge = card.querySelector(`#quiz-status-${q.id}`);
          if (statusBadge) {
            statusBadge.className = 'quiz-item-status status-unanswered';
            statusBadge.textContent = 'Pendiente';
          }

          const justBox = card.querySelector(`#quiz-justification-${q.id}`);
          if (justBox) {
            justBox.classList.add('hidden');
          }
        }
      });

      this.scrollListContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (this.navPillsContainer) {
      const pills = this.navPillsContainer.querySelectorAll('.quiz-pill-btn');
      pills.forEach((pill, idx) => {
        pill.classList.remove('pill-correct', 'pill-incorrect');
        if (idx === 0) {
          pill.classList.add('active');
        } else {
          pill.classList.remove('active');
        }
      });
    }

    this._updateScoreBadge();
  }

  /**
   * Obtiene el progreso y detalle de respuestas del cuestionario para los informes técnicos.
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

    this.questions.forEach(q => {
      const ans = this.selectedAnswers[q.id];
      if (ans && ans === q.correctAnswer) {
        correct++;
      }
    });

    this.scoreBadge.textContent = `${correct}/${total} Correctas`;
  }

  /**
   * Configura automáticamente el simulador con los parámetros ideales para experimentar la pregunta.
   * @param {number} qIndex - Índice de la pregunta (0..9)
   * @private
   */
  _applyPresetForQuestion(qIndex) {
    if (!this.stateManager) return;

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
