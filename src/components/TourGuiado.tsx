import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Compass,
  X,
  ChevronRight,
  ChevronLeft,
  SkipForward,
  CheckCircle2,
  Sliders,
  Zap,
} from 'lucide-react';
import { Language } from '../assets/js/i18n';

export interface TourParameterItem {
  name: string;
  value: string;
  detail: string;
}

export interface TourStep {
  targetSelector: string;
  titleEs: string;
  titleEn: string;
  descriptionEs: string;
  descriptionEn: string;
  badgeEs: string;
  badgeEn: string;
  whatToDoEs?: string[];
  whatToDoEn?: string[];
  parametersEs?: TourParameterItem[];
  parametersEn?: TourParameterItem[];
  formulaEs?: string;
  formulaEn?: string;
  onTryAction?: () => void;
  tryActionLabelEs?: string;
  tryActionLabelEn?: string;
}

interface TourGuiadoProps {
  labId: 'circuits' | 'space' | 'mechanics' | 'kinematics' | 'chemistry';
  lang: Language;
  steps: TourStep[];
}

const TOUR_STORAGE_PREFIX = 'quantumlabs_tour_seen_v1_';

interface SpotlightBounds {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const TourGuiado: React.FC<TourGuiadoProps> = ({ labId, lang, steps }) => {
  const storageKey = `${TOUR_STORAGE_PREFIX}${labId}`;

  const [isActive, setIsActive] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(storageKey) !== 'true';
    } catch {
      return true;
    }
  });

  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [spotlightBounds, setSpotlightBounds] = useState<SpotlightBounds | null>(null);
  const [viewportDimensions, setViewportDimensions] = useState<{ width: number; height: number }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  const activeStep = steps[activeStepIndex] || steps[0];

  const removeHighlightClasses = useCallback(() => {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.tour-guiado-pulse-target').forEach((highlightedNode) => {
      highlightedNode.classList.remove('tour-guiado-pulse-target');
    });
  }, []);

  const dismissTour = useCallback(() => {
    setIsActive(false);
    removeHighlightClasses();
    setSpotlightBounds(null);
    try {
      window.localStorage.setItem(storageKey, 'true');
    } catch {
      // Storage blocked in restricted browsing context
    }
  }, [removeHighlightClasses, storageKey]);

  const measureActiveTarget = useCallback(() => {
    if (typeof document === 'undefined' || !isActive || !activeStep) {
      setSpotlightBounds(null);
      return;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    setViewportDimensions((previous) =>
      previous.width === viewportWidth && previous.height === viewportHeight
        ? previous
        : { width: viewportWidth, height: viewportHeight }
    );

    const targetElement = document.querySelector(activeStep.targetSelector) as HTMLElement | null;
    if (!targetElement) {
      setSpotlightBounds(null);
      return;
    }

    const rawRect = targetElement.getBoundingClientRect();
    const clampedTop = Math.max(58, rawRect.top);
    const clampedBottom = Math.min(viewportHeight - 16, rawRect.bottom);
    const visibleHeight = Math.max(0, clampedBottom - clampedTop);

    if (visibleHeight < 24 || rawRect.width <= 0) {
      setSpotlightBounds({
        top: Math.max(58, Math.min(viewportHeight - 120, rawRect.top)),
        left: Math.max(8, rawRect.left),
        width: Math.min(viewportWidth - 16, rawRect.width),
        height: Math.min(viewportHeight - 90, rawRect.height),
      });
      return;
    }

    setSpotlightBounds({
      top: clampedTop,
      left: Math.max(8, rawRect.left),
      width: Math.min(viewportWidth - 16, rawRect.width),
      height: visibleHeight,
    });
  }, [isActive, activeStep]);

  useEffect(() => {
    if (!isActive || !activeStep) {
      removeHighlightClasses();
      setSpotlightBounds(null);
      return;
    }

    removeHighlightClasses();
    const targetElement = document.querySelector(activeStep.targetSelector) as HTMLElement | null;
    if (targetElement) {
      targetElement.classList.add('tour-guiado-pulse-target');
      const initialRect = targetElement.getBoundingClientRect();
      const requiresScroll =
        initialRect.top < 72 ||
        initialRect.top > window.innerHeight * 0.55 ||
        initialRect.bottom > window.innerHeight - 40;

      if (requiresScroll) {
        const alignment: ScrollLogicalPosition =
          initialRect.height > window.innerHeight * 0.65 ? 'start' : 'center';
        try {
          targetElement.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: alignment });
        } catch {
          targetElement.scrollIntoView();
        }
      }
    }

    measureActiveTarget();
    const earlyTimer = window.setTimeout(measureActiveTarget, 120);
    const settleTimer = window.setTimeout(measureActiveTarget, 350);

    window.addEventListener('scroll', measureActiveTarget, { capture: true, passive: true });
    window.addEventListener('resize', measureActiveTarget, { passive: true });

    return () => {
      window.clearTimeout(earlyTimer);
      window.clearTimeout(settleTimer);
      window.removeEventListener('scroll', measureActiveTarget, { capture: true });
      window.removeEventListener('resize', measureActiveTarget);
    };
  }, [isActive, activeStepIndex, activeStep, measureActiveTarget, removeHighlightClasses]);

  useEffect(() => {
    if (!isActive) return;
    const handleKeyboardNavigation = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dismissTour();
      } else if (event.key === 'ArrowRight' && activeStepIndex < steps.length - 1) {
        setActiveStepIndex((previous) => previous + 1);
      } else if (event.key === 'ArrowLeft' && activeStepIndex > 0) {
        setActiveStepIndex((previous) => previous - 1);
      }
    };
    window.addEventListener('keydown', handleKeyboardNavigation);
    return () => window.removeEventListener('keydown', handleKeyboardNavigation);
  }, [isActive, activeStepIndex, steps.length, dismissTour]);

  useEffect(() => {
    return () => {
      removeHighlightClasses();
    };
  }, [removeHighlightClasses]);

  const openTourFromStart = () => {
    setActiveStepIndex(0);
    setIsActive(true);
  };

  const advanceToNextStep = () => {
    if (activeStepIndex < steps.length - 1) {
      setActiveStepIndex((previous) => previous + 1);
    } else {
      dismissTour();
    }
  };

  const returnToPreviousStep = () => {
    if (activeStepIndex > 0) {
      setActiveStepIndex((previous) => previous - 1);
    }
  };

  const spotlightPadding = 6;
  const hasValidBounds = Boolean(
    spotlightBounds && spotlightBounds.width > 0 && spotlightBounds.height > 0
  );
  const cutoutLeft =
    hasValidBounds && spotlightBounds ? Math.max(6, spotlightBounds.left - spotlightPadding) : 0;
  const cutoutTop =
    hasValidBounds && spotlightBounds ? Math.max(54, spotlightBounds.top - spotlightPadding) : 0;
  const cutoutWidth =
    hasValidBounds && spotlightBounds
      ? Math.min(
          viewportDimensions.width - cutoutLeft - 6,
          spotlightBounds.width + spotlightPadding * 2
        )
      : 0;
  const cutoutHeight =
    hasValidBounds && spotlightBounds
      ? Math.min(
          viewportDimensions.height - cutoutTop - 10,
          spotlightBounds.height + spotlightPadding * 2
        )
      : 0;
  const cutoutRight = cutoutLeft + cutoutWidth;
  const cutoutBottom = cutoutTop + cutoutHeight;

  const spotlightClipPolygon = hasValidBounds
    ? `polygon(0% 0%, 0% 100%, ${cutoutLeft}px 100%, ${cutoutLeft}px ${cutoutTop}px, ${cutoutRight}px ${cutoutTop}px, ${cutoutRight}px ${cutoutBottom}px, ${cutoutLeft}px ${cutoutBottom}px, ${cutoutLeft}px 100%, 100% 100%, 100% 0%)`
    : undefined;

  const actionInstructions = lang === 'es' ? activeStep?.whatToDoEs : activeStep?.whatToDoEn;
  const parameterDefinitions = lang === 'es' ? activeStep?.parametersEs : activeStep?.parametersEn;
  const equationReference = lang === 'es' ? activeStep?.formulaEs : activeStep?.formulaEn;

  const alignCardToRight =
    hasValidBounds &&
    spotlightBounds &&
    spotlightBounds.width < viewportDimensions.width * 0.65 &&
    spotlightBounds.left < viewportDimensions.width * 0.35;

  const portalOverlay =
    isActive && activeStep && typeof document !== 'undefined'
      ? createPortal(
          <>
            <div
              data-testid="tour-guiado-overlay"
              aria-hidden="true"
              className="fixed inset-0 z-[9980] bg-slate-950/75 pointer-events-none"
              style={spotlightClipPolygon ? { clipPath: spotlightClipPolygon } : undefined}
            />

            <div
              data-testid="tour-guiado-topbar"
              className="fixed top-2.5 left-1/2 -translate-x-1/2 z-[9995] w-[96%] max-w-4xl px-3.5 py-2 rounded-xl bg-[#080C16] border border-cyan-500/70 shadow-xl flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-2 py-0.5 rounded bg-cyan-400 text-slate-950 font-mono font-bold text-[11px] uppercase shrink-0">
                  {lang === 'es'
                    ? `PASO ${activeStepIndex + 1} / ${steps.length}`
                    : `STEP ${activeStepIndex + 1} / ${steps.length}`}
                </span>
                <span className="font-semibold text-white truncate max-w-[11rem] sm:max-w-[20rem]">
                  {lang === 'es' ? activeStep.titleEs : activeStep.titleEn}
                </span>
              </div>

              <div className="hidden md:flex items-center gap-1">
                {steps.map((tourStep, stepIndex) => (
                  <button
                    key={stepIndex}
                    type="button"
                    onClick={() => setActiveStepIndex(stepIndex)}
                    className={`px-2 py-0.5 rounded font-mono text-[10px] transition-colors cursor-pointer ${
                      stepIndex === activeStepIndex
                        ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-200 font-semibold'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {lang === 'es' ? tourStep.badgeEs : tourStep.badgeEn}
                  </button>
                ))}
              </div>

              <button
                type="button"
                data-testid="tour-guiado-skip-top"
                onClick={dismissTour}
                className="min-h-[2.25rem] flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-mono font-semibold text-xs transition-colors cursor-pointer shrink-0"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>{lang === 'es' ? 'Omitir tutorial' : 'Skip tutorial'}</span>
              </button>
            </div>

            {hasValidBounds && (
              <div
                data-testid="tour-guiado-spotlight"
                aria-hidden="true"
                className="fixed pointer-events-none z-[9985] rounded-xl border-2 border-cyan-400"
                style={{
                  top: `${cutoutTop}px`,
                  left: `${cutoutLeft}px`,
                  width: `${cutoutWidth}px`,
                  height: `${cutoutHeight}px`,
                }}
              >
                <div className="absolute -top-3 left-3 px-2 py-0.5 rounded bg-cyan-400 text-slate-950 font-mono font-bold text-[10px] tracking-wider uppercase">
                  {lang === 'es' ? activeStep.badgeEs : activeStep.badgeEn}
                </div>

                <button
                  type="button"
                  onClick={dismissTour}
                  className="pointer-events-auto absolute -top-3 right-3 px-2 py-0.5 rounded bg-slate-950 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/70 font-mono font-semibold text-[10px] uppercase flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>{lang === 'es' ? 'Omitir tutorial' : 'Skip tutorial'}</span>
                </button>
              </div>
            )}

            <div
              role="dialog"
              aria-modal="false"
              aria-label={lang === 'es' ? 'Guía de Instrumentación' : 'Instrumentation Guide'}
              data-testid="tour-guiado-card"
              className={`fixed bottom-4 z-[9995] left-3 right-3 sm:w-[min(92vw,28.75rem)] max-h-[calc(100vh-5.5rem)] flex flex-col rounded-xl bg-[#080C16] border border-cyan-500/80 p-3.5 sm:p-4 shadow-2xl text-slate-100 ${
                alignCardToRight ? 'sm:left-auto sm:right-6' : 'sm:left-5 sm:right-auto'
              }`}
            >
              <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-500/50 flex items-center justify-center text-cyan-300 shrink-0">
                    <Compass className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-cyan-400 block">
                      {lang === 'es'
                        ? `INSTRUMENTACIÓN · PASO ${activeStepIndex + 1} DE ${steps.length}`
                        : `INSTRUMENTATION · STEP ${activeStepIndex + 1} OF ${steps.length}`}
                    </span>
                    <h4
                      data-testid="tour-guiado-step-title"
                      className="text-sm sm:text-base font-bold text-white leading-snug"
                    >
                      {lang === 'es' ? activeStep.titleEs : activeStep.titleEn}
                    </h4>
                  </div>
                </div>

                <button
                  type="button"
                  data-testid="tour-guiado-close"
                  onClick={dismissTour}
                  aria-label={lang === 'es' ? 'Cerrar guía' : 'Close guide'}
                  className="min-w-[2.25rem] min-h-[2.25rem] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto space-y-2.5 py-2.5 pr-1 flex-1">
                <p
                  data-testid="tour-guiado-step-desc"
                  className="text-xs text-slate-200 leading-relaxed bg-[#0C1220] border border-slate-800 rounded-lg p-2.5"
                >
                  {lang === 'es' ? activeStep.descriptionEs : activeStep.descriptionEn}
                </p>

                {actionInstructions && actionInstructions.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-500/35 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold uppercase text-cyan-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>
                        {lang === 'es' ? 'Procedimiento en este panel:' : 'Procedure in this panel:'}
                      </span>
                    </div>
                    <ol className="space-y-1 text-xs text-slate-200 list-decimal list-inside">
                      {actionInstructions.map((instructionText, instructionIndex) => (
                        <li key={instructionIndex} className="leading-snug">
                          {instructionText}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {parameterDefinitions && parameterDefinitions.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-[#0A0F1C] border border-slate-800 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold uppercase text-amber-300">
                      <Sliders className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>
                        {lang === 'es' ? 'Parámetros de control:' : 'Control parameters:'}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {parameterDefinitions.map((parameterItem, parameterIndex) => (
                        <div
                          key={parameterIndex}
                          className="p-2 rounded bg-[#060911] border border-slate-800/90 text-[11px]"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <span className="font-mono font-semibold text-cyan-300">
                              {parameterItem.name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-[10px]">
                              {parameterItem.value}
                            </span>
                          </div>
                          <p className="text-slate-300 mt-0.5 leading-snug">{parameterItem.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(equationReference || activeStep.onTryAction) && (
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-[#0C1220] border border-slate-800 text-xs">
                    {equationReference && (
                      <span className="font-mono text-[11px] text-cyan-200 font-semibold break-words">
                        {equationReference}
                      </span>
                    )}
                    {activeStep.onTryAction && (
                      <button
                        type="button"
                        onClick={activeStep.onTryAction}
                        className="min-h-[2.25rem] flex items-center gap-1 px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono font-semibold text-[11px] transition-colors cursor-pointer shrink-0"
                      >
                        <Zap className="w-3 h-3" />
                        <span>
                          {lang === 'es'
                            ? activeStep.tryActionLabelEs || 'Aplicar ajuste'
                            : activeStep.tryActionLabelEn || 'Apply setting'}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-800 shrink-0">
                <div className="flex items-center gap-1.5">
                  {steps.map((_, dotIndex) => (
                    <button
                      key={dotIndex}
                      type="button"
                      aria-label={`Paso ${dotIndex + 1}`}
                      onClick={() => setActiveStepIndex(dotIndex)}
                      className={`h-2 rounded-full transition-all cursor-pointer ${
                        dotIndex === activeStepIndex
                          ? 'w-6 bg-cyan-400'
                          : 'w-2 bg-slate-700 hover:bg-slate-500'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    data-testid="tour-guiado-skip"
                    onClick={dismissTour}
                    className="min-h-[2.5rem] sm:min-h-[2.25rem] flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-500/60 bg-rose-950/60 hover:bg-rose-600 text-[11px] font-mono font-semibold text-rose-200 hover:text-white transition-colors cursor-pointer"
                  >
                    <SkipForward className="w-3 h-3" />
                    <span>{lang === 'es' ? 'Omitir tutorial' : 'Skip tutorial'}</span>
                  </button>

                  {activeStepIndex > 0 && (
                    <button
                      type="button"
                      data-testid="tour-guiado-prev"
                      onClick={returnToPreviousStep}
                      className="min-h-[2.5rem] sm:min-h-[2.25rem] flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>{lang === 'es' ? 'Anterior' : 'Back'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    data-testid="tour-guiado-next"
                    onClick={advanceToNextStep}
                    className="min-h-[2.5rem] sm:min-h-[2.25rem] flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-mono font-bold text-xs transition-colors cursor-pointer"
                  >
                    <span>
                      {activeStepIndex === steps.length - 1
                        ? lang === 'es'
                          ? 'Finalizar'
                          : 'Finish'
                        : lang === 'es'
                        ? 'Siguiente'
                        : 'Next'}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        data-testid="tour-guiado-reopen"
        onClick={openTourFromStart}
        className="min-h-[2.5rem] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D1322] hover:bg-slate-800 border border-slate-700 text-cyan-300 font-mono text-xs transition-colors cursor-pointer shrink-0"
      >
        <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span>{lang === 'es' ? 'Guía del Instrumento' : 'Instrument Guide'}</span>
      </button>
      {portalOverlay}
    </>
  );
};
