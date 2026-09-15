/**
 * js/components/TheoryModal.js
 * Módulo interactivo de visualización de Teoría y Ejemplos de la Vida Real.
 */

import { THEORY_MODULES } from '../../data/theoryData.js';

export class TheoryModal {
  /**
   * @param {HTMLElement} modalContainer 
   */
  constructor(modalContainer) {
    this.modal = modalContainer;
    this.currentTab = 'ohm';
    this._initDOMElements();
    this._bindEvents();
    this._renderContent();
  }

  _initDOMElements() {
    this.tabs = this.modal.querySelectorAll('.theory-tab-btn[role="tab"]');
    this.tabPanels = {}; // Will be populated in _renderContent
    this.contentBody = this.modal.querySelector('#theory-content-body');
    this.closeBtn = this.modal.querySelector('#btn-close-theory');
    this.openBtn = document.querySelector('#btn-open-theory');
  }

  _bindEvents() {
    if (this.tabs) {
      this.tabs.forEach(btn => {
        // Click handler
        btn.addEventListener('click', () => {
          const tabId = btn.getAttribute('data-tab');
          this._switchTab(tabId);
        });

        // Keyboard navigation for tabs (Arrow keys, Home, End)
        btn.addEventListener('keydown', (e) => {
          const tabsArray = Array.from(this.tabs);
          const currentIndex = tabsArray.indexOf(btn);
          let nextIndex = currentIndex;

          switch (e.key) {
            case 'ArrowRight':
              e.preventDefault();
              nextIndex = (currentIndex + 1) % tabsArray.length;
              break;
            case 'ArrowLeft':
              e.preventDefault();
              nextIndex = (currentIndex - 1 + tabsArray.length) % tabsArray.length;
              break;
            case 'Home':
              e.preventDefault();
              nextIndex = 0;
              break;
            case 'End':
              e.preventDefault();
              nextIndex = tabsArray.length - 1;
              break;
            default:
              return;
          }

          tabsArray[nextIndex].focus();
          tabsArray[nextIndex].click();
        });
      });
    }

    if (this.openBtn) {
      this.openBtn.addEventListener('click', () => this.open());
    }

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    // Cerrar con Escape o clic fuera
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.modal.classList.contains('hidden')) {
        this.close();
        this.openBtn?.focus(); // Return focus to trigger button
      }
    });

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });
  }

  _switchTab(tabId) {
    this.currentTab = tabId;
    this.tabs.forEach(btn => {
      const isActive = btn.getAttribute('data-tab') === tabId;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive.toString());
    });
    this._renderContent();
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
   * Escapa HTML para prevenir XSS
   * @private
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Reemplaza saltos de línea con <br> de forma segura
   * @private
   */
  _nl2br(text) {
    return this._escapeHtml(text).replace(/\n/g, '<br>');
  }

  _renderContent() {
    if (!this.contentBody) return;
    const data = THEORY_MODULES[this.currentTab];
    if (!data) return;

    const panelId = `panel-${this.currentTab}`;
    
    // Actualizar aria-controls en tabs
    this.tabs.forEach(btn => {
      const tabId = btn.getAttribute('data-tab');
      btn.setAttribute('aria-controls', `panel-${tabId}`);
    });

    let html = `
      <div class="theory-article animate-fade-in" role="tabpanel" id="${panelId}" aria-labelledby="tab-${this.currentTab}" tabindex="0">
        <header class="theory-header">
          <h2 class="theory-title">${this._escapeHtml(data.title)}</h2>
          <p class="theory-subtitle">${this._escapeHtml(data.subtitle)}</p>
        </header>
    `;

    if (data.concept) {
      html += `
        <div class="theory-concept-card">
          <p>${this._nl2br(data.concept)}</p>
        </div>
      `;
    }

    if (data.formula) {
      html += `
        <div class="theory-formula-card">
          <span class="formula-badge">Ecuación Fundamental</span>
          <div class="formula-text font-mono">${this._escapeHtml(data.formula)}</div>
        </div>
      `;
    }

    if (data.units) {
      html += `
        <h3 class="section-title">Magnitudes y Unidades del Sistema Internacional</h3>
        <div class="units-grid">
          ${data.units.map(u => `
            <div class="unit-card">
              <div class="unit-symbol font-mono">${this._escapeHtml(u.symbol)}</div>
              <div class="unit-info">
                <strong>${this._escapeHtml(u.name)}</strong>
                <span class="unit-name">${this._escapeHtml(u.unit)}</span>
                <p class="unit-desc">${this._escapeHtml(u.desc)}</p>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (data.analogy) {
      html += `
        <div class="analogy-card">
          <h4>${this._escapeHtml(data.analogy.title)}</h4>
          <p>${this._nl2br(data.analogy.text)}</p>
        </div>
      `;
    }

    if (data.laws) {
      html += `
        <div class="laws-list">
          ${data.laws.map(law => `
            <div class="law-card">
              <span class="law-tag">${this._escapeHtml(law.principle)}</span>
              <h3>${this._escapeHtml(law.name)}</h3>
              <p class="law-statement">${this._escapeHtml(law.statement)}</p>
              <div class="law-formula font-mono">${this._escapeHtml(law.formula)}</div>
              <p class="law-example"><strong>Ejemplo Práctico:</strong> ${this._escapeHtml(law.example)}</p>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (data.types) {
      html += `
        <div class="topologies-grid">
          ${data.types.map(t => `
            <div class="topology-card">
              <span class="topology-badge">${this._escapeHtml(t.badge)}</span>
              <h3>${this._escapeHtml(t.name)}</h3>
              <p>${this._escapeHtml(t.description)}</p>
              <ul class="rules-list font-mono">
                ${t.rules.map(r => `<li>${this._escapeHtml(r)}</li>`).join('')}
              </ul>
              <div class="topology-drawback">
                <strong>Comportamiento ante fallas:</strong> ${this._escapeHtml(t.drawback)}
              </div>
              <div class="topology-real">
                <strong><svg class="icon" aria-hidden="true"><use href="#icon-flask"></use></svg> En la vida real:</strong> ${this._escapeHtml(t.realWorld)}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (data.conditions) {
      html += `
        <div class="faults-grid">
          ${data.conditions.map(f => `
            <div class="fault-card">
              <h3 class="fault-title"><svg class="icon" aria-hidden="true"><use href="#icon-alert"></use></svg> ${this._escapeHtml(f.name)}</h3>
              <p><strong>Causa:</strong> ${this._escapeHtml(f.cause)}</p>
              <p><strong>Efecto Eléctrico:</strong> ${this._escapeHtml(f.effect)}</p>
              <p class="prevention"><strong>Protección:</strong> ${this._escapeHtml(f.prevention)}</p>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (data.realLifeExamples) {
      html += `
        <h3 class="section-title">Aplicaciones en la Vida Cotidiana</h3>
        <div class="real-life-grid">
          ${data.realLifeExamples.map(ex => `
            <div class="real-example-card">
              <h4><svg class="icon" aria-hidden="true"><use href="#icon-bolt"></use></svg> ${this._escapeHtml(ex.title)}</h4>
              <p>${this._escapeHtml(ex.desc)}</p>
            </div>
          `).join('')}
        </div>
      `;
    }

    html += `</div>`;
    this.contentBody.innerHTML = html;
  }
}
