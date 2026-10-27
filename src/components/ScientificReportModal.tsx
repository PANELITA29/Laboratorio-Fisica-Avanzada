import React, { useState } from 'react';
import { FileText, Printer, X, CheckCircle2, Beaker, Download } from 'lucide-react';
import { Language, dictionary } from '../assets/js/i18n';
import {
  TelemetryItem,
  formatReportDate,
  triggerScientificReportPrint,
  downloadScientificReportCSV,
} from '../assets/js/report-generator';

interface ScientificReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  activeLabName: string;
  telemetry: TelemetryItem[];
  completedChallengesCount: number;
  totalScore: number;
}

export const ScientificReportModal: React.FC<ScientificReportModalProps> = ({
  isOpen,
  onClose,
  lang,
  activeLabName,
  telemetry,
  completedChallengesCount,
  totalScore,
}) => {
  const t = dictionary[lang];

  const [question, setQuestion] = useState(
    lang === 'es'
      ? '¿Cómo se relacionan cuantitativamente las variables de estado medidas en el simulador con las leyes de conservación fundamentales?'
      : 'How do the state variables measured in the simulator quantitatively relate to fundamental conservation laws?'
  );
  const [hypothesis, setHypothesis] = useState(
    lang === 'es'
      ? 'En el régimen estacionario, la diferencia de potencial V es linealmente proporcional a la corriente I (Ley de Ohm), mientras que en gravitación la integración simpléctica de Verlet conserva la energía mecánica total E = K + U.'
      : 'In steady state, potential difference V is linearly proportional to current I (Ohm’s Law), while in gravitation symplectic Verlet integration conserves total mechanical energy E = K + U.'
  );
  const [variables, setVariables] = useState(
    lang === 'es'
      ? 'Independiente: Voltaje de fuente DC (V) / Velocidad de inserción orbital (v₀).\nDependiente: Intensidad de corriente (A), Potencia (W) / Radio orbital (r) y Excentricidad.\nControladas: Resistencias nominales (Ω) y Constante Gravitacional (G).'
      : 'Independent: DC source voltage (V) / Orbital insertion velocity (v₀).\nDependent: Current intensity (A), Power (W) / Orbital radius (r) and Eccentricity.\nControlled: Nominal resistances (Ω) and Gravitational Constant (G).'
  );
  const [results, setResults] = useState(
    lang === 'es'
      ? 'Las mediciones experimentales extraídas del motor numérico coinciden con el modelo teórico analítico con una desviación inferior al 0.05%, validando la hipótesis formulada.'
      : 'The experimental measurements extracted from the numerical engine match the analytical theoretical model within 0.05% deviation, validating the formulated hypothesis.'
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scientific-report-title"
    >
      <div className="w-full max-w-4xl rounded-xl bg-[#0B0F1A] border border-slate-800 shadow-2xl overflow-hidden my-8 print:bg-white print:text-slate-900 print:border-slate-300 print:shadow-none">
        {/* Academic Letterhead Header */}
        <div className="px-6 py-5 bg-[#0F1626] border-b border-slate-800 flex items-start justify-between gap-4 print:bg-slate-50 print:border-slate-300">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 print:text-slate-700">
              <Beaker className="w-4 h-4" />
              <span>FERIA DE LA CIENCIA · DOCUMENTO EXPERIMENTAL OFICIAL</span>
            </div>
            <h2
              id="scientific-report-title"
              className="mt-1 text-xl font-bold text-white print:text-slate-900"
            >
              {t.reportModalTitle}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 print:text-slate-600">
              {t.reportModalSubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.reportCloseBtn}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors no-print cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metadata Bar */}
        <div className="px-6 py-3 bg-[#090D16] border-b border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs print:bg-white print:border-slate-200">
          <div>
            <span className="text-slate-400 block print:text-slate-500">{t.reportStudentLabel}</span>
            <span className="font-semibold text-slate-100 print:text-slate-900">
              Juan David González Alarcón
            </span>
          </div>
          <div>
            <span className="text-slate-400 block print:text-slate-500">{t.reportLabTypeLabel}</span>
            <span className="font-mono font-medium text-cyan-300 print:text-slate-900">
              {activeLabName}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block print:text-slate-500">
              {lang === 'es' ? 'Fecha y Puntuación' : 'Date & Score'}
            </span>
            <span className="font-mono text-emerald-400 print:text-slate-900">
              {formatReportDate()} · {totalScore} pts ({completedChallengesCount}/4)
            </span>
          </div>
        </div>

        {/* Form & Live Extracted Telemetry */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto print:max-h-none print:overflow-visible">
          {/* Automatically Extracted Telemetry Table */}
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-cyan-400 mb-2.5 print:text-slate-800">
              {t.reportTelemetryTitle}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {telemetry.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-[#111827] border border-slate-800 print:bg-slate-50 print:border-slate-300"
                >
                  <span className="text-[11px] text-slate-400 block truncate print:text-slate-600">
                    {item.label}
                  </span>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-lg font-mono font-bold text-white tabular-nums print:text-slate-900">
                      {item.value}
                    </span>
                    <span className="text-xs font-mono text-cyan-400 print:text-slate-700">
                      {item.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scientific Method Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="report-question"
                className="block text-xs font-semibold text-slate-200 mb-1.5 print:text-slate-800"
              >
                {t.reportQuestionLabel}
              </label>
              <textarea
                id="report-question"
                rows={3}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={t.reportQuestionPlaceholder}
                className="w-full rounded-lg bg-[#07090E] border border-slate-800 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 print:bg-white print:text-slate-900 print:border-slate-300"
              />
            </div>

            <div>
              <label
                htmlFor="report-hypothesis"
                className="block text-xs font-semibold text-slate-200 mb-1.5 print:text-slate-800"
              >
                {t.reportHypothesisLabel}
              </label>
              <textarea
                id="report-hypothesis"
                rows={3}
                value={hypothesis}
                onChange={(e) => setHypothesis(e.target.value)}
                placeholder={t.reportHypothesisPlaceholder}
                className="w-full rounded-lg bg-[#07090E] border border-slate-800 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 print:bg-white print:text-slate-900 print:border-slate-300"
              />
            </div>

            <div>
              <label
                htmlFor="report-variables"
                className="block text-xs font-semibold text-slate-200 mb-1.5 print:text-slate-800"
              >
                {t.reportVariablesLabel}
              </label>
              <textarea
                id="report-variables"
                rows={3}
                value={variables}
                onChange={(e) => setVariables(e.target.value)}
                placeholder={t.reportVariablesPlaceholder}
                className="w-full rounded-lg bg-[#07090E] border border-slate-800 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 print:bg-white print:text-slate-900 print:border-slate-300"
              />
            </div>

            <div>
              <label
                htmlFor="report-results"
                className="block text-xs font-semibold text-slate-200 mb-1.5 print:text-slate-800"
              >
                {t.reportResultsLabel}
              </label>
              <textarea
                id="report-results"
                rows={3}
                value={results}
                onChange={(e) => setResults(e.target.value)}
                placeholder={t.reportResultsPlaceholder}
                className="w-full rounded-lg bg-[#07090E] border border-slate-800 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 print:bg-white print:text-slate-900 print:border-slate-300"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#0F1626] border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              {lang === 'es'
                ? 'Membrete académico firmado por Juan David González Alarcón'
                : 'Academic letterhead signed by Juan David González Alarcón'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {t.reportCloseBtn}
            </button>
            <button
              type="button"
              onClick={() =>
                downloadScientificReportCSV({
                  studentName: 'Juan David González Alarcón',
                  labTitle: activeLabName,
                  dateStr: formatReportDate(),
                  researchQuestion: question,
                  hypothesis,
                  variables,
                  experimentalResults: results,
                  telemetry,
                  completedChallenges: completedChallengesCount,
                  totalScore,
                })
              }
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-xs hover:bg-emerald-400 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{lang === 'es' ? 'Exportar Datos CSV' : 'Export CSV Data'}</span>
            </button>
            <button
              type="button"
              onClick={triggerScientificReportPrint}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 font-semibold text-xs hover:bg-cyan-400 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{t.reportPrintBtn}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
