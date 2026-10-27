import React, { useEffect, useRef, useState } from 'react';
import { Atom } from 'lucide-react';

/**
 * Barra superior de progreso de lectura / scroll con gradiente cuántico
 */
export const ScrollProgressBar: React.FC = () => {
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    const updateScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight =
        document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (docHeight <= 0) {
        setProgress(0);
        return;
      }
      const pct = Math.min(100, Math.max(0, (scrollTop / docHeight) * 100));
      setProgress(pct);
    };

    window.addEventListener('scroll', updateScroll, { passive: true });
    updateScroll();
    return () => window.removeEventListener('scroll', updateScroll);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 h-[3px] z-50 pointer-events-none bg-transparent no-print"
    >
      <div
        className="h-full bg-gradient-to-r from-cyan-400 via-sky-400 to-purple-500 shadow-[0_0_12px_rgba(34,211,238,0.85)] transition-[width] duration-100 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

/**
 * Animación de entrada cinemática al abrir la web (QuantumLabs 3D Boot Sequence)
 */
export const QuantumIntroSplash: React.FC = () => {
  const [phase, setPhase] = useState<'entering' | 'fading' | 'done'>('entering');
  const [progress, setProgress] = useState<number>(12);

  useEffect(() => {
    const t1 = window.setTimeout(() => setProgress(68), 220);
    const t2 = window.setTimeout(() => setProgress(100), 680);
    const t3 = window.setTimeout(() => setPhase('fading'), 1050);
    const t4 = window.setTimeout(() => setPhase('done'), 1500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  if (phase === 'done') return null;

  return (
    <div
      onClick={() => setPhase('done')}
      role="status"
      aria-label="Iniciando QuantumLabs 3D"
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[#05070C] px-6 select-none cursor-pointer transition-opacity duration-500 ease-out no-print ${
        phase === 'fading' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Resplandor cuántico de fondo */}
      <div className="relative flex flex-col items-center max-w-md w-full text-center space-y-5 quantum-splash-card">
        {/* Átomo / Órbita 3D animada */}
        <div className="relative w-24 h-24 flex items-center justify-center">
          <svg
            viewBox="0 0 120 120"
            className="w-full h-full quantum-spin-slow"
            aria-hidden="true"
          >
            <ellipse
              cx="60"
              cy="60"
              rx="50"
              ry="20"
              fill="none"
              stroke="#22D3EE"
              strokeWidth="2"
              strokeDasharray="6 4"
              transform="rotate(30 60 60)"
            />
            <ellipse
              cx="60"
              cy="60"
              rx="50"
              ry="20"
              fill="none"
              stroke="#A855F7"
              strokeWidth="2"
              strokeDasharray="6 4"
              transform="rotate(-30 60 60)"
            />
            <circle cx="60" cy="60" r="46" fill="none" stroke="#10B981" strokeWidth="1.2" opacity="0.45" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-400/50 flex items-center justify-center shadow-[0_0_25px_rgba(34,211,238,0.45)]">
              <Atom className="w-7 h-7 text-cyan-300" />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-cyan-400 block">
            QUANTUM LABS · EDICIÓN FERIA DE LA CIENCIA
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Laboratorio de Física Avanzada 3D
          </h2>
          <p className="text-xs font-mono text-slate-400">
            Sincronizando Motores WebGL · Kirchhoff · Espacio-Tiempo GLSL · RK4
          </p>
        </div>

        {/* Barra de carga de telemetría */}
        <div className="w-64 sm:w-72 space-y-1.5">
          <div className="h-1.5 w-full rounded-full bg-slate-800/90 overflow-hidden border border-slate-700/60">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 via-sky-400 to-purple-500 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>MOTOR 60 FPS ACTIVO</span>
            <span className="text-cyan-300 font-bold">{progress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ScrollRevealProps {
  children: React.ReactNode;
  direction?: 'up' | 'left' | 'right' | 'scale';
  delayMs?: number;
  className?: string;
}

/**
 * Contenedor que revela suavemente los elementos cuando el usuario hace scroll hacia abajo
 */
export const ScrollReveal: React.FC<ScrollRevealProps> = ({
  children,
  direction = 'up',
  delayMs = 0,
  className = '',
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const hiddenTransform =
    direction === 'left'
      ? 'opacity-0 -translate-x-8'
      : direction === 'right'
      ? 'opacity-0 translate-x-8'
      : direction === 'scale'
      ? 'opacity-0 scale-95 translate-y-6'
      : 'opacity-0 translate-y-8';

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={`transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[transform,opacity] ${
        isVisible ? 'opacity-100 translate-x-0 translate-y-0 scale-100' : hiddenTransform
      } ${className}`}
    >
      {children}
    </div>
  );
};
