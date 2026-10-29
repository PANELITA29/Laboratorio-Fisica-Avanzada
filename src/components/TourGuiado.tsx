import React, { useEffect, useState, useCallback } from 'react';
import { Sparkles, ChevronRight, ChevronLeft, X, Compass } from 'lucide-react';
import { Language } from '../assets/js/i18n';

export interface TourStep {
  /** Selector CSS del elemento clave a resaltar con borde pulsante, ej: '[data-tour="circuits-multimeter"]' */
  targetSelector: string;
  /** Etiqueta corta de la herramienta (ej: 'HERRAMIENTA 1 · COMPONENTES 3D') */
  badgeEs: string;
  badgeEn: string;
  /** Título de la herramienta resaltada */
  titleEs: string;
  titleEn: string;
  /** Explicación breve y accionable para reducir la curva de aprendizaje */
  descriptionEs: string;
  descriptionEn: string;
}

interface TourGuiadoProps {
  labId: 'circuits' | 'space' | 'mechanics';
  lang: Language;
  steps: TourStep[];
}

const STORAGE_PREFIX = 'quantumlabs_tour_seen_v1_';

export const TourGuiado: React.FC<TourGuiadoProps> = ({ labId, lang, steps }) => {
  const storageKey = `${STORAGE_PREFIX}${labId}`;

  const [isActive, setIsActive] = useState<boolean>(false);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [targetRect, setTargetRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  // Activar automáticamente la primera vez que se carga cada laboratorio
  useEffect(() => {
    try {
      const alreadySeen = window.localStorage.getItem(storageKey);
      if (!alreadySeen) {
        setCurrentStepIdx(0);
        setIsActive(true);
      } else {
        setIsActive(false);
      }
    } catch {
      setCurrentStepIdx(0);
      setIsActive(true);
    }
  }, [storageKey]);

  const currentStep = steps[currentStepIdx] || steps[0];

  // Sincronizar la clase de borde pulsante sobre el nodo objetivo y calcular su rectángulo en pantalla
  const updateHighlightRect = useCallback(() => {
    if (!isActive || !currentStep) {
      setTargetRect(null);
      return;
    }

    const el = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
    if (!el) {
      setTargetRect(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    setTargetRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });
  }, [isActive, currentStep]);

  // Aplicar la clase CSS `.tour-guiado-pulse-target` directamente al elemento activo y hacer scroll suave
  useEffect(() => {
    // Limpiar cualquier clase previa
    document.querySelectorAll('.tour-guiado-pulse-target').forEach((node) => {
      node.classList.remove('tour-guiado-pulse-target');
    });

    if (!isActive || !currentStep) {
      setTargetRect(null);
      return;
    }

    const el = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
    if (!el) {
      setTargetRect(null);
      return;
    }

    el.classList.add('tour-guiado-pulse-target');

    // Desplazar suavemente hacia la herramienta resaltada si no está visible en el viewport
    const rect = el.getBoundingClientRect();
    const isVisible =
      rect.top >= 60 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) - 60;
    if (!isVisible) {
      el.scrollIntoView({
        behavior: 'smooth',
        block: currentStepIdx === 0 ? 'start' : 'center',
      });
    }

    const timer = window.setTimeout(updateHighlightRect, 120);
    updateHighlightRect();

    window.addEventListener('scroll', updateHighlightRect, { passive: true });
    window.addEventListener('resize', updateHighlightRect, { passive: true });

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', updateHighlightRect);
      window.removeEventListener('resize', updateHighlightRect);
      el.classList.remove('tour-guiado-pulse-target');
    };
  }, [isActive, currentStep, currentStepIdx, updateHighlightRect]);

  const handleCloseTour = () => {
    try {
      window.localStorage.setItem(storageKey, 'true');
    } catch {
      // ignore storage errors
    }
    setIsActive(false);
  };

  const handleRestartTour = () => {
    setCurrentStepIdx(0);
    setIsActive(true);
  };

  const handleNext = () => {
    if (currentStepIdx < steps.length - 1) {
      setCurrentStepIdx((prev) => prev + 1);
    } else {
      handleCloseTour();
    }
  };

  const handlePrev = () => {
    if (currentStepIdx > 0) {
      setCurrentStepIdx((prev) => prev - 1);
    }
  };

  return (
    <>
      {/* Botón compacto para reactivar el Tour Guiado en cualquier momento */}
      <button
        type="button"
        data-testid={`tour-guiado-trigger-${labId}`}
        onClick={handleRestartTour}
        title={
          lang === 'es'
            ? 'Iniciar recorrido guiado por las herramientas clave de este laboratorio'
            : 'Start guided tour of key tools in this laboratory'
        }
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
          isActive
            ? 'bg-cyan-400 text-slate-950 border-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.5)]'
            : 'bg-cyan-950/60 hover:bg-cyan-900/70 text-cyan-300 border-cyan-500/50'
        }`}
      >
        <Compass className="w-3.5 h-3.5 shrink-0" />
        <span>{lang === 'es' ? '🎯 Tour Guiado' : '🎯 Guided Tour'}</span>
      </button>

      {/* Marco Pulsante Flotante + Tarjeta Interactiva del Tour Guiado */}
      {isActive && currentStep && (
        <>
          {/* Anillo de Resaltado con Borde Pulsante sobre la herramienta activa */}
          {targetRect && targetRect.width > 0 && targetRect.height > 0 && (
            <div
              data-testid="tour-guiado-spotlight"
              aria-hidden="true"
              className="fixed pointer-events-none z-40 rounded-2xl border-2 border-cyan-400 transition-all duration-200"
              style={{
                top: `${Math.max(4, targetRect.top - 6)}px`,
                left: `${Math.max(4, targetRect.left - 6)}px`,
                width: `${Math.min(window.innerWidth - 8, targetRect.width + 12)}px`,
                height: `${targetRect.height + 12}px`,
                boxShadow:
                  '0 0 0 3px rgba(34, 211, 238, 0.45), 0 0 32px 6px rgba(34, 211, 238, 0.55)',
              }}
            >
              {/* Etiqueta flotante en la esquina superior del borde pulsante */}
              <div className="absolute -top-3.5 left-4 px-2.5 py-0.5 rounded-full bg-cyan-400 text-slate-950 font-mono font-extrabold text-[10px] tracking-wider uppercase shadow-lg flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />
                <span>{lang === 'es' ? currentStep.badgeEs : currentStep.badgeEn}</span>
              </div>
            </div>
          )}

          {/* Tarjeta Flotante Compacta del Tour Guiado */}
          <div
            role="dialog"
            aria-modal="false"
            aria-label={lang === 'es' ? 'Tour Guiado del Laboratorio' : 'Laboratory Guided Tour'}
            data-testid="tour-guiado-card"
            className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-[400px] z-50 rounded-2xl bg-[#070B14]/98 border-2 border-cyan-400 p-4 shadow-[0_0_40px_rgba(8,145,178,0.55)] text-slate-100 space-y-3"
          >
            {/* Cabecera del paso */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-400/60 flex items-center justify-center text-cyan-300 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400">
                      {lang === 'es'
                        ? `TOUR GUIADO · PASO ${currentStepIdx + 1} DE ${steps.length}`
                        : `GUIDED TOUR · STEP ${currentStepIdx + 1} OF ${steps.length}`}
                    </span>
                  </div>
                  <h4
                    data-testid="tour-guiado-step-title"
                    className="text-sm font-bold text-white leading-snug"
                  >
                    {lang === 'es' ? currentStep.titleEs : currentStep.titleEn}
                  </h4>
                </div>
              </div>

              <button
                type="button"
                data-testid="tour-guiado-close"
                onClick={handleCloseTour}
                aria-label={lang === 'es' ? 'Cerrar tour guiado' : 'Close guided tour'}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Descripción pedagógica */}
            <p
              data-testid="tour-guiado-step-desc"
              className="text-xs text-slate-300 leading-relaxed bg-[#0B1222] border border-slate-800 rounded-xl p-3"
            >
              {lang === 'es' ? currentStep.descriptionEs : currentStep.descriptionEn}
            </p>

            {/* Indicadores de progreso y botones de navegación */}
            <div className="flex items-center justify-between gap-2 pt-1">
              {/* Puntos de progreso */}
              <div className="flex items-center gap-1.5">
                {steps.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    aria-label={`Paso ${idx + 1}`}
                    onClick={() => setCurrentStepIdx(idx)}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      idx === currentStepIdx
                        ? 'w-6 bg-cyan-400'
                        : 'w-2 bg-slate-700 hover:bg-slate-500'
                    }`}
                  />
                ))}
              </div>

              {/* Controles Anterior / Omitir / Siguiente */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  data-testid="tour-guiado-skip"
                  onClick={handleCloseTour}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-mono text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
                >
                  {lang === 'es' ? 'Omitir' : 'Skip'}
                </button>

                {currentStepIdx > 0 && (
                  <button
                    type="button"
                    data-testid="tour-guiado-prev"
                    onClick={handlePrev}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>{lang === 'es' ? 'Anterior' : 'Back'}</span>
                  </button>
                )}

                <button
                  type="button"
                  data-testid="tour-guiado-next"
                  onClick={handleNext}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-mono font-bold text-xs transition-colors cursor-pointer shadow-md"
                >
                  <span>
                    {currentStepIdx < steps.length - 1
                      ? lang === 'es'
                        ? 'Siguiente'
                        : 'Next'
                      : lang === 'es'
                      ? '¡Empezar!'
                      : 'Start!'}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};
