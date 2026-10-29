import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Compass,
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  SkipForward,
  CheckCircle2,
  Sliders,
  Zap,
} from 'lucide-react';
import { Language } from '../assets/js/i18n';

export interface TourParameterItem {
  /** Nombre corto del parámetro o control (ej. "Voltaje Fuente (0–48 V)") */
  name: string;
  /** Rango o unidad técnica (ej. "V⎓ · Paralelo") */
  value: string;
  /** Explicación clara de para qué sirve y qué efecto produce */
  detail: string;
}

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
  /** Lista de pasos accionables ("¿Qué hacer aquí?") en español */
  whatToDoEs?: string[];
  /** Lista de pasos accionables ("What to do here?") en inglés */
  whatToDoEn?: string[];
  /** Desglose de parámetros clave del panel resaltado en español */
  parametersEs?: TourParameterItem[];
  /** Desglose de parámetros clave del panel resaltado en inglés */
  parametersEn?: TourParameterItem[];
  /** Fórmula o regla física clave asociada a este paso */
  formulaEs?: string;
  formulaEn?: string;
  /** Acción interactiva opcional para demostrar el paso en vivo */
  onTryAction?: () => void;
  tryActionLabelEs?: string;
  tryActionLabelEn?: string;
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
 * - Se renderiza mediante Portal en `document.body` para que ningún contenedor con `transform`
 *   (como `.quantum-hero-enter`) desplace el recorte spotlight ni oculte la tarjeta explicativa.
 * - Incluye múltiples botones visibles de 'Omitir tutorial' / 'Saltar tour' (en la barra superior,
 *   en el propio borde del elemento resaltado, en el pie de la tarjeta y con la tecla Escape).
 * - Explica detalladamente qué hacer en cada paso y desglosa cada parámetro del laboratorio.
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

  const measureCurrentTarget = useCallback(() => {
    if (typeof document === 'undefined' || !isActive || !currentStep) {
      setTargetRect(null);
      return;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setViewportSize((prev) => (prev.w === vw && prev.h === vh ? prev : { w: vw, h: vh }));

    const targetEl = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
    if (!targetEl) {
      setTargetRect(null);
      return;
    }

    const rect = targetEl.getBoundingClientRect();
    // Recortar el rectángulo al área visible de la ventana para evitar cuadros gigantes fuera de pantalla
    const topEdge = Math.max(58, rect.top);
    const bottomEdge = Math.min(vh - 16, rect.bottom);
    const visibleHeight = Math.max(0, bottomEdge - topEdge);

    if (visibleHeight < 24 || rect.width <= 0) {
      setTargetRect({
        top: Math.max(58, Math.min(vh - 120, rect.top)),
        left: Math.max(8, rect.left),
        width: Math.min(vw - 16, rect.width),
        height: Math.min(vh - 90, rect.height),
      });
      return;
    }

    setTargetRect({
      top: topEdge,
      left: Math.max(8, rect.left),
      width: Math.min(vw - 16, rect.width),
      height: visibleHeight,
    });
  }, [isActive, currentStep]);

  // Al cambiar de paso o activar el tour, desplazarse suavemente hacia el objetivo y mantener sincronizado el recorte
  useEffect(() => {
    if (!isActive || !currentStep) {
      clearAllHighlightedNodes();
      setTargetRect(null);
      return;
    }

    clearAllHighlightedNodes();
    const targetEl = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
    if (targetEl) {
      targetEl.classList.add('tour-guiado-pulse-target');
      const rectBefore = targetEl.getBoundingClientRect();
      const needsScroll =
        rectBefore.top < 72 ||
        rectBefore.top > window.innerHeight * 0.55 ||
        rectBefore.bottom > window.innerHeight - 40;

      if (needsScroll) {
        const blockMode: ScrollLogicalPosition =
          rectBefore.height > window.innerHeight * 0.65 ? 'start' : 'center';
        try {
          targetEl.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: blockMode });
        } catch {
          targetEl.scrollIntoView();
        }
      }
    }

    measureCurrentTarget();
    const t1 = window.setTimeout(measureCurrentTarget, 120);
    const t2 = window.setTimeout(measureCurrentTarget, 350);

    const handleViewportChange = () => measureCurrentTarget();
    window.addEventListener('scroll', handleViewportChange, { capture: true, passive: true });
    window.addEventListener('resize', handleViewportChange, { passive: true });

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('scroll', handleViewportChange, { capture: true });
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [isActive, currentStepIdx, currentStep, measureCurrentTarget, clearAllHighlightedNodes]);

  // Permitir cerrar / omitir el tutorial con la tecla Escape
  useEffect(() => {
    if (!isActive) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseTour();
      } else if (e.key === 'ArrowRight') {
        if (currentStepIdx < steps.length - 1) {
          setCurrentStepIdx((prev) => prev + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        if (currentStepIdx > 0) {
          setCurrentStepIdx((prev) => prev - 1);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isActive, currentStepIdx, steps.length, handleCloseTour]);

  // Limpieza al desmontar el componente
  useEffect(() => {
    return () => {
      clearAllHighlightedNodes();
    };
  }, [clearAllHighlightedNodes]);

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
  const cutoutLeft = hasValidRect && targetRect ? Math.max(6, targetRect.left - pad) : 0;
  const cutoutTop = hasValidRect && targetRect ? Math.max(54, targetRect.top - pad) : 0;
  const cutoutWidth =
    hasValidRect && targetRect
      ? Math.min(viewportSize.w - cutoutLeft - 6, targetRect.width + pad * 2)
      : 0;
  const cutoutHeight =
    hasValidRect && targetRect
      ? Math.min(viewportSize.h - cutoutTop - 10, targetRect.height + pad * 2)
      : 0;
  const cutoutRight = cutoutLeft + cutoutWidth;
  const cutoutBottom = cutoutTop + cutoutHeight;

  const overlayClipPath = hasValidRect
    ? `polygon(0% 0%, 0% 100%, ${cutoutLeft}px 100%, ${cutoutLeft}px ${cutoutTop}px, ${cutoutRight}px ${cutoutTop}px, ${cutoutRight}px ${cutoutBottom}px, ${cutoutLeft}px ${cutoutBottom}px, ${cutoutLeft}px 100%, 100% 100%, 100% 0%)`
    : undefined;

  const whatToDoList = lang === 'es' ? currentStep?.whatToDoEs : currentStep?.whatToDoEn;
  const parameterList = lang === 'es' ? currentStep?.parametersEs : currentStep?.parametersEn;
  const formulaText = lang === 'es' ? currentStep?.formulaEs : currentStep?.formulaEn;

  // Decidir si la tarjeta explicativa se ubica a la izquierda o a la derecha para no tapar el control resaltado
  const placeCardOnRight =
    hasValidRect &&
    targetRect &&
    targetRect.width < viewportSize.w * 0.65 &&
    targetRect.left < viewportSize.w * 0.35;

  const tourPortalContent =
    isActive && currentStep && typeof document !== 'undefined'
      ? createPortal(
          <>
            {/* Capa superpuesta semitransparente con ventana recortada sobre la herramienta activa */}
            <div
              data-testid="tour-guiado-overlay"
              aria-hidden="true"
              className="fixed inset-0 z-[9980] bg-slate-950/75 backdrop-blur-[1.5px] pointer-events-none"
              style={overlayClipPath ? { clipPath: overlayClipPath } : undefined}
            />

            {/* Barra Superior Fija del Tutorial: Navegación Rápida + Botón Directo 'Omitir tutorial' */}
            <div
              data-testid="tour-guiado-topbar"
              className="fixed top-2.5 left-1/2 -translate-x-1/2 z-[9995] w-[96%] max-w-4xl px-3.5 py-2 rounded-xl bg-[#060A14]/95 border-2 border-cyan-400/90 shadow-[0_8px_32px_rgba(6,182,212,0.45)] flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-cyan-400 text-slate-950 font-mono font-extrabold text-[11px] uppercase">
                  {lang === 'es'
                    ? `PASO ${currentStepIdx + 1} / ${steps.length}`
                    : `STEP ${currentStepIdx + 1} / ${steps.length}`}
                </span>
                <span className="font-bold text-white truncate max-w-[200px] sm:max-w-xs">
                  {lang === 'es' ? currentStep.titleEs : currentStep.titleEn}
                </span>
              </div>

              {/* Píldoras de acceso directo a cada paso */}
              <div className="hidden md:flex items-center gap-1">
                {steps.map((st, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentStepIdx(idx)}
                    className={`px-2 py-0.5 rounded-md font-mono text-[10px] transition-colors cursor-pointer ${
                      idx === currentStepIdx
                        ? 'bg-cyan-500/30 border border-cyan-300 text-cyan-200 font-bold'
                        : 'bg-slate-900/90 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {lang === 'es' ? st.badgeEs : st.badgeEn}
                  </button>
                ))}
              </div>

              {/* Botón Principal de Omitir Tutorial en la Barra Superior */}
              <button
                type="button"
                data-testid="tour-guiado-skip-top"
                onClick={handleCloseTour}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-mono font-bold text-xs shadow-md transition-colors cursor-pointer shrink-0"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>{lang === 'es' ? 'Omitir tutorial' : 'Skip tutorial'}</span>
              </button>
            </div>

            {/* Anillo de Resaltado con Borde Pulsante sobre la herramienta activa */}
            {hasValidRect && (
              <div
                data-testid="tour-guiado-spotlight"
                aria-hidden="true"
                className="fixed pointer-events-none z-[9985] rounded-2xl border-2 border-cyan-400"
                style={{
                  top: `${cutoutTop}px`,
                  left: `${cutoutLeft}px`,
                  width: `${cutoutWidth}px`,
                  height: `${cutoutHeight}px`,
                  boxShadow:
                    '0 0 0 4px rgba(34, 211, 238, 0.35), 0 0 32px 6px rgba(34, 211, 238, 0.5)',
                }}
              >
                {/* Etiqueta flotante izquierda con indicador de zona activa */}
                <div className="absolute -top-3.5 left-4 px-2.5 py-0.5 rounded-full bg-cyan-400 text-slate-950 font-mono font-extrabold text-[10px] tracking-wider uppercase shadow-lg flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />
                  <span>{lang === 'es' ? currentStep.badgeEs : currentStep.badgeEn}</span>
                </div>

                {/* Botón interactivo directo en la esquina del cuadro resaltado para Omitir el tutorial */}
                <button
                  type="button"
                  onClick={handleCloseTour}
                  className="pointer-events-auto absolute -top-3.5 right-4 px-2.5 py-0.5 rounded-full bg-slate-950 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/80 font-mono font-bold text-[10px] uppercase shadow-lg flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>{lang === 'es' ? 'Omitir tutorial' : 'Skip tutorial'}</span>
                </button>
              </div>
            )}

            {/* Tarjeta Pedagógica Interactiva del Paso Actual (Siempre visible en el viewport) */}
            <div
              role="dialog"
              aria-modal="false"
              aria-label={lang === 'es' ? 'Tour Guiado del Laboratorio' : 'Laboratory Guided Tour'}
              data-testid="tour-guiado-card"
              className={`fixed bottom-4 z-[9995] left-3 right-3 sm:w-[460px] max-h-[calc(100vh-5.2rem)] flex flex-col rounded-2xl bg-[#070B14]/98 border-2 border-cyan-400 p-4 shadow-[0_0_50px_rgba(8,145,178,0.75)] text-slate-100 ${
                placeCardOnRight
                  ? 'sm:left-auto sm:right-6'
                  : 'sm:left-5 sm:right-auto'
              }`}
            >
              {/* Cabecera fija del paso */}
              <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-800/80 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/60 flex items-center justify-center text-cyan-300 shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400">
                        {lang === 'es'
                          ? `GUÍA INTERACTIVA · PASO ${currentStepIdx + 1} DE ${steps.length}`
                          : `INTERACTIVE GUIDE · STEP ${currentStepIdx + 1} OF ${steps.length}`}
                      </span>
                    </div>
                    <h4
                      data-testid="tour-guiado-step-title"
                      className="text-sm sm:text-base font-bold text-white leading-snug"
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
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Cuerpo desplazable con instrucciones y parámetros */}
              <div className="overflow-y-auto space-y-2.5 py-2.5 pr-1 flex-1">
                {/* Resumen de qué estás viendo */}
                <p
                  data-testid="tour-guiado-step-desc"
                  className="text-xs text-slate-200 leading-relaxed bg-[#0B1222] border border-slate-800 rounded-xl p-2.5"
                >
                  {lang === 'es' ? currentStep.descriptionEs : currentStep.descriptionEn}
                </p>

                {/* Bloque: ¿Qué hacer paso a paso en esta herramienta? */}
                {whatToDoList && whatToDoList.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-cyan-950/35 border border-cyan-500/40 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase text-cyan-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>
                        {lang === 'es' ? '¿Qué hacer en este paso?' : 'What to do in this step:'}
                      </span>
                    </div>
                    <ol className="space-y-1 text-xs text-slate-200 list-decimal list-inside">
                      {whatToDoList.map((instruction, idx) => (
                        <li key={idx} className="leading-snug">
                          {instruction}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Bloque: Desglose de Parámetros y Controles del Panel */}
                {parameterList && parameterList.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-[#090F1D] border border-slate-800 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase text-amber-300">
                      <Sliders className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>
                        {lang === 'es'
                          ? 'Parámetros clave y cómo funcionan:'
                          : 'Key parameters & how they work:'}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {parameterList.map((param, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded-lg bg-[#050811] border border-slate-800/90 text-[11px]"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <span className="font-mono font-bold text-cyan-300">{param.name}</span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-[10px]">
                              {param.value}
                            </span>
                          </div>
                          <p className="text-slate-300 mt-0.5 leading-snug">{param.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fórmula o Regla Física Clave + Botón de Demostración en Vivo */}
                {(formulaText || currentStep.onTryAction) && (
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-purple-950/35 border border-purple-500/40 text-xs">
                    {formulaText && (
                      <span className="font-mono text-[11px] text-purple-200 font-semibold">
                        📐 {formulaText}
                      </span>
                    )}
                    {currentStep.onTryAction && (
                      <button
                        type="button"
                        onClick={currentStep.onTryAction}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono font-bold text-[11px] transition-colors cursor-pointer shrink-0"
                      >
                        <Zap className="w-3 h-3" />
                        <span>
                          {lang === 'es'
                            ? currentStep.tryActionLabelEs || 'Probar en vivo'
                            : currentStep.tryActionLabelEn || 'Try live'}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Pie fijo: Indicadores de progreso y botones de navegación siempre visibles */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-800 shrink-0">
                {/* Puntos de progreso */}
                <div className="flex items-center gap-1.5">
                  {steps.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      aria-label={`Paso ${idx + 1}`}
                      onClick={() => setCurrentStepIdx(idx)}
                      className={`h-2.5 rounded-full transition-all cursor-pointer ${
                        idx === currentStepIdx
                          ? 'w-7 bg-cyan-400'
                          : 'w-2.5 bg-slate-700 hover:bg-slate-500'
                      }`}
                    />
                  ))}
                </div>

                {/* Controles Omitir tutorial / Anterior / Siguiente */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    data-testid="tour-guiado-skip"
                    onClick={handleCloseTour}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-500/60 bg-rose-950/60 hover:bg-rose-600 text-[11px] font-mono font-bold text-rose-200 hover:text-white transition-colors cursor-pointer"
                  >
                    <SkipForward className="w-3 h-3" />
                    <span>{lang === 'es' ? 'Omitir tutorial' : 'Skip tutorial'}</span>
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
                    className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-mono font-bold text-xs transition-colors cursor-pointer shadow-md"
                  >
                    <span>
                      {currentStepIdx < steps.length - 1
                        ? lang === 'es'
                          ? 'Siguiente paso'
                          : 'Next step'
                        : lang === 'es'
                        ? '¡Empezar a experimentar!'
                        : 'Start experimenting!'}
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
      {/* Botón compacto en la cabecera del laboratorio para iniciar u omitir el Tour Guiado en cualquier momento */}
      <button
        type="button"
        data-testid={`tour-guiado-trigger-${labId}`}
        onClick={isActive ? handleCloseTour : handleRestartTour}
        title={
          isActive
            ? lang === 'es'
              ? 'Omitir y cerrar el tutorial guiado'
              : 'Skip and close guided tour'
            : lang === 'es'
            ? 'Iniciar recorrido guiado paso a paso por este laboratorio'
            : 'Start step-by-step guided tour of this laboratory'
        }
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
          isActive
            ? 'bg-rose-500 hover:bg-rose-400 text-white border-rose-300 shadow-[0_0_16px_rgba(244,63,94,0.5)]'
            : 'bg-cyan-950/60 hover:bg-cyan-900/70 text-cyan-300 border-cyan-500/50'
        }`}
      >
        {isActive ? (
          <>
            <SkipForward className="w-3.5 h-3.5 shrink-0" />
            <span>{lang === 'es' ? 'Omitir Tour' : 'Skip Tour'}</span>
          </>
        ) : (
          <>
            <Compass className="w-3.5 h-3.5 shrink-0" />
            <span>{lang === 'es' ? '🎯 Tour Guiado' : '🎯 Guided Tour'}</span>
          </>
        )}
      </button>

      {tourPortalContent}
    </>
  );
};
