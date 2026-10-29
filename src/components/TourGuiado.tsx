import React, { useEffect, useState, useCallback } from 'react';
import { Compass, X, ChevronRight, ChevronLeft, Sparkles, SkipForward } from 'lucide-react';
import { Language } from '../assets/js/i18n';

export interface TourStep {
  /** Selector CSS del elemento a resaltar con borde pulsante (ej. '[data-tour="circuits-multimeter"]') */
  targetSelector: string;
  /** Título breve del paso en español */
  titleEs: string;
  /** Título breve del paso en inglés */
  titleEn: string;
  /** Explicación concisa para reducir la curva de aprendizaje en español */
  descriptionEs: string;
  /** Explicación concisa en inglés */
  descriptionEn: string;
  /** Etiqueta de categoría o número de herramienta */
  badgeEs: string;
  badgeEn: string;
}

interface TourGuiadoProps {
  /** Identificador único del laboratorio ('circuits' | 'space' | 'mechanics') */
  labId: 'circuits' | 'space' | 'mechanics';
  lang: Language;
  steps: TourStep[];
}

const STORAGE_PREFIX = 'quantumlabs_tour_seen_v1_';

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Componente pedagógico 'TourGuiado':
 * - Se activa automáticamente al cargar por primera vez la aplicación / cada laboratorio (persistido en localStorage).
 * - Utiliza una capa superpuesta semitransparente (backdrop con recorte spotlight) para resaltar secuencialmente
 *   el Multímetro, el Área de Componentes y el Panel de Control.
 * - Incluye un botón explícito de 'Saltar tour' para cerrar el recorrido en cualquier momento.
 */
export const TourGuiado: React.FC<TourGuiadoProps> = ({ labId, lang, steps }) => {
  const storageKey = `${STORAGE_PREFIX}${labId}`;

  const [isActive, setIsActive] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(storageKey) !== 'true';
    } catch {
      return true;
    }
  });

  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [targetRect, setTargetRect] = useState<HighlightRect | null>(null);
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  const currentStep = steps[currentStepIdx] || steps[0];

  const clearAllHighlightedNodes = useCallback(() => {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.tour-guiado-pulse-target').forEach((el) => {
      el.classList.remove('tour-guiado-pulse-target');
    });
  }, []);

  const updateTargetPosition = useCallback(
    (shouldScrollIntoView: boolean) => {
      if (typeof document === 'undefined' || !isActive || !currentStep) {
        setTargetRect(null);
        return;
      }

      setViewportSize({
        w: window.innerWidth,
        h: window.innerHeight,
      });

      const targetEl = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
      clearAllHighlightedNodes();

      if (!targetEl) {
        setTargetRect(null);
        return;
      }

      targetEl.classList.add('tour-guiado-pulse-target');

      if (shouldScrollIntoView) {
        const rectBefore = targetEl.getBoundingClientRect();
        const isOutOfViewport =
          rectBefore.top < 70 || rectBefore.bottom > window.innerHeight - 100;
        if (isOutOfViewport) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }

      const rect = targetEl.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    },
    [isActive, currentStep, clearAllHighlightedNodes]
  );

  // Al cambiar de paso o activar el tour, desplazarse suavemente y resaltar el elemento objetivo
  useEffect(() => {
    if (!isActive) {
      clearAllHighlightedNodes();
      setTargetRect(null);
      return;
    }

    updateTargetPosition(true);
    const t1 = window.setTimeout(() => updateTargetPosition(false), 260);
    const t2 = window.setTimeout(() => updateTargetPosition(false), 550);

    const handleViewportChange = () => updateTargetPosition(false);
    window.addEventListener('scroll', handleViewportChange, { passive: true });
    window.addEventListener('resize', handleViewportChange, { passive: true });

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('scroll', handleViewportChange);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [isActive, currentStepIdx, updateTargetPosition, clearAllHighlightedNodes]);

  // Limpieza al desmontar el componente
  useEffect(() => {
    return () => {
      clearAllHighlightedNodes();
    };
  }, [clearAllHighlightedNodes]);

  const handleCloseTour = useCallback(() => {
    setIsActive(false);
    clearAllHighlightedNodes();
    setTargetRect(null);
    try {
      window.localStorage.setItem(storageKey, 'true');
    } catch {
      // Ignorar errores de almacenamiento privado
    }
  }, [clearAllHighlightedNodes, storageKey]);

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

  // Cálculo del recorte (spotlight cutout) para la capa superpuesta semitransparente
  const pad = 6;
  const hasValidRect = Boolean(targetRect && targetRect.width > 0 && targetRect.height > 0);
  const cutoutLeft = hasValidRect && targetRect ? Math.max(4, targetRect.left - pad) : 0;
  const cutoutTop = hasValidRect && targetRect ? Math.max(4, targetRect.top - pad) : 0;
  const cutoutWidth =
    hasValidRect && targetRect
      ? Math.min(viewportSize.w - cutoutLeft - 4, targetRect.width + pad * 2)
      : 0;
  const cutoutHeight = hasValidRect && targetRect ? targetRect.height + pad * 2 : 0;
  const cutoutRight = cutoutLeft + cutoutWidth;
  const cutoutBottom = cutoutTop + cutoutHeight;

  const overlayClipPath = hasValidRect
    ? `polygon(0% 0%, 0% 100%, ${cutoutLeft}px 100%, ${cutoutLeft}px ${cutoutTop}px, ${cutoutRight}px ${cutoutTop}px, ${cutoutRight}px ${cutoutBottom}px, ${cutoutLeft}px ${cutoutBottom}px, ${cutoutLeft}px 100%, 100% 100%, 100% 0%)`
    : undefined;

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

      {/* Capa Superpuesta Semitransparente + Marco Pulsante + Tarjeta del Tour Guiado */}
      {isActive && currentStep && (
        <>
          {/* Capa superpuesta semitransparente con ventana recortada sobre la herramienta activa */}
          <div
            data-testid="tour-guiado-overlay"
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-[1.5px] pointer-events-none transition-all duration-200"
            style={overlayClipPath ? { clipPath: overlayClipPath } : undefined}
          />

          {/* Anillo de Resaltado con Borde Pulsante sobre la herramienta activa */}
          {hasValidRect && (
            <div
              data-testid="tour-guiado-spotlight"
              aria-hidden="true"
              className="fixed pointer-events-none z-40 rounded-2xl border-2 border-cyan-400 transition-all duration-200"
              style={{
                top: `${cutoutTop}px`,
                left: `${cutoutLeft}px`,
                width: `${cutoutWidth}px`,
                height: `${cutoutHeight}px`,
                boxShadow:
                  '0 0 0 4px rgba(34, 211, 238, 0.45), 0 0 36px 8px rgba(34, 211, 238, 0.6)',
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
            className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-[420px] z-50 rounded-2xl bg-[#070B14]/98 border-2 border-cyan-400 p-4 shadow-[0_0_45px_rgba(8,145,178,0.65)] text-slate-100 space-y-3"
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

              {/* Controles Saltar tour / Anterior / Siguiente */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  data-testid="tour-guiado-skip"
                  onClick={handleCloseTour}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900/90 hover:bg-slate-800 text-[11px] font-mono font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <SkipForward className="w-3 h-3 text-cyan-400" />
                  <span>{lang === 'es' ? 'Saltar tour' : 'Skip tour'}</span>
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
