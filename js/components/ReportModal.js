/**
 * js/components/ReportModal.js
 * Componente de Gestión de Informes de Práctica de Laboratorio y Exportación (PDF / CSV).
 */

import { ReportExporter } from '../engine/ReportExporter.js';

export class ReportModal {
  constructor(modalElement, { stateManager, quizView } = {}) {
    this.modal = modalElement;
    this.stateManager = stateManager;
    this.quizView = quizView;

    this.studentData = {
      studentName: 'Alexander Humboldt',
      course: 'Física II - Electrodinámica (Grupo A)',
      institution: 'Facultad de Ciencias e Ingeniería'
    };

    this._initDOMElements();
    this._bindEvents();
  }

  _initDOMElements() {
    this.openBtn = document.getElementById('btn-open-report');
    this.closeBtn = this.modal.querySelector('#btn-close-report');
    this.reportContainer = this.modal.querySelector('#report-preview-container');

    this.inputStudent = this.modal.querySelector('#report-input-student');
    this.inputCourse = this.modal.querySelector('#report-input-course');
    this.inputInstitution = this.modal.querySelector('#report-input-inst');

    this.btnDownloadCSV = this.modal.querySelector('#btn-download-csv');
    this.btnPrintPDF = this.modal.querySelector('#btn-print-pdf');
    this.btnResetMeta = this.modal.querySelector('#btn-reset-report-meta');
  }

  _bindEvents() {
    if (this.openBtn) {
      this.openBtn.addEventListener('click', () => this.open());
    }

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.modal.classList.contains('hidden')) {
        this.close();
      }
    });

    // Actualizar datos de estudiante
    const handleMetaChange = () => {
      if (this.inputStudent) this.studentData.studentName = this.inputStudent.value || 'Estudiante';
      if (this.inputCourse) this.studentData.course = this.inputCourse.value || 'Física II';
      if (this.inputInstitution) this.studentData.institution = this.inputInstitution.value || 'Laboratorio';
      this._renderReportPreview();
    };

    [this.inputStudent, this.inputCourse, this.inputInstitution].forEach(inp => {
      if (inp) inp.addEventListener('input', handleMetaChange);
    });

    // Botón para restablecer metadatos por defecto
    if (this.btnResetMeta) {
      this.btnResetMeta.addEventListener('click', () => {
        this.resetMetadata();
      });
    }

    // Descargar CSV
    if (this.btnDownloadCSV && this.stateManager) {
      this.btnDownloadCSV.addEventListener('click', () => {
        const state = this.stateManager.getState();
        ReportExporter.downloadCSV(state, this.studentData);
      });
    }

    // Imprimir o Guardar como PDF
    if (this.btnPrintPDF) {
      this.btnPrintPDF.addEventListener('click', () => {
        window.print();
      });
    }
  }

  /**
   * Restablece los metadatos a los valores institucionales estándar.
   */
  resetMetadata() {
    this.studentData = {
      studentName: 'Alexander Humboldt',
      course: 'Física II - Electrodinámica (Grupo A)',
      institution: 'Facultad de Ciencias e Ingeniería'
    };
    if (this.inputStudent) this.inputStudent.value = this.studentData.studentName;
    if (this.inputCourse) this.inputCourse.value = this.studentData.course;
    if (this.inputInstitution) this.inputInstitution.value = this.studentData.institution;
    this._renderReportPreview();
  }

  open() {
    this._renderReportPreview();
    this.modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  close() {
    this.modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  /**
   * Genera el HTML del reporte con el estado actual del circuito.
   * @private
   */
  _renderReportPreview() {
    if (!this.reportContainer || !this.stateManager) return;
    const state = this.stateManager.getState();
    const quizProgress = this.quizView ? this.quizView.getQuizProgress() : null;
    const html = ReportExporter.generateReportHTML(state, {
      ...this.studentData,
      quizProgress
    });
    this.reportContainer.innerHTML = html;
  }
}
