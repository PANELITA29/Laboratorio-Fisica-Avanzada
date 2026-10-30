import React from 'react';

export type LabId = 'circuits' | 'space' | 'mechanics' | 'kinematics';

export interface LabTheme {
  primary: string;
  glow: string;
  border: string;
  borderLight: string;
  bgBadge: string;
  badgeText: string;
  gradient: string;
  accentHex: string;
  secondaryHex: string;
}

export const LAB_THEMES: Record<LabId, LabTheme> = {
  circuits: {
    primary: 'text-cyan-400',
    glow: 'rgba(34, 211, 238, 0.45)',
    border: 'border-cyan-500/40',
    borderLight: 'border-cyan-400/60',
    bgBadge: 'bg-cyan-950/80',
    badgeText: 'text-cyan-300',
    gradient: 'from-cyan-500/25 via-blue-900/30 to-slate-950/80',
    accentHex: '#22d3ee',
    secondaryHex: '#38bdf8',
  },
  space: {
    primary: 'text-sky-400',
    glow: 'rgba(56, 189, 248, 0.45)',
    border: 'border-sky-500/40',
    borderLight: 'border-sky-400/60',
    bgBadge: 'bg-sky-950/80',
    badgeText: 'text-sky-300',
    gradient: 'from-sky-500/25 via-indigo-900/30 to-slate-950/80',
    accentHex: '#38bdf8',
    secondaryHex: '#818cf8',
  },
  mechanics: {
    primary: 'text-amber-400',
    glow: 'rgba(245, 158, 11, 0.45)',
    border: 'border-amber-500/40',
    borderLight: 'border-amber-400/60',
    bgBadge: 'bg-amber-950/80',
    badgeText: 'text-amber-300',
    gradient: 'from-amber-500/25 via-orange-900/30 to-slate-950/80',
    accentHex: '#f59e0b',
    secondaryHex: '#fbbf24',
  },
  kinematics: {
    primary: 'text-emerald-400',
    glow: 'rgba(16, 185, 129, 0.45)',
    border: 'border-emerald-500/40',
    borderLight: 'border-emerald-400/60',
    bgBadge: 'bg-emerald-950/80',
    badgeText: 'text-emerald-300',
    gradient: 'from-emerald-500/25 via-teal-900/30 to-slate-950/80',
    accentHex: '#10b981',
    secondaryHex: '#34d399',
  },
};

/**
 * Icono Ilustrado de Electrodinámica y Circuitos DC
 */
export const CircuitsLabIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`inline-block ${className}`}
  >
    <defs>
      <linearGradient id="cir-grad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop stopColor="#67e8f9" />
        <stop offset="1" stopColor="#0284c7" />
      </linearGradient>
      <filter id="cir-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="1" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    {/* Anillo exterior tecnológico */}
    <rect x="2" y="2" width="28" height="28" rx="8" stroke="#0891b2" strokeWidth="1.2" strokeOpacity="0.4" />
    <circle cx="16" cy="16" r="12" stroke="#22d3ee" strokeWidth="1.2" strokeDasharray="3 2" strokeOpacity="0.6" />
    {/* Pistas de circuito nodal */}
    <path d="M 4 16 H 10 M 22 16 H 28 M 16 4 V 10 M 16 22 V 28" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
    {/* Nodos de interconexión con brillo */}
    <circle cx="10" cy="16" r="2" fill="#22d3ee" filter="url(#cir-glow)" />
    <circle cx="22" cy="16" r="2" fill="#22d3ee" filter="url(#cir-glow)" />
    <circle cx="16" cy="10" r="2" fill="#38bdf8" />
    <circle cx="16" cy="22" r="2" fill="#38bdf8" />
    {/* Rayo central de alta tensión con gradiente */}
    <path
      d="M 17.5 7 L 11.5 16 H 16.5 L 14.5 25 L 21.5 15 H 16.5 L 17.5 7 Z"
      fill="url(#cir-grad)"
      stroke="#a5f3fc"
      strokeWidth="1.2"
      strokeLinejoin="round"
      filter="url(#cir-glow)"
    />
  </svg>
);

/**
 * Icono Ilustrado de Gravitación N-Cuerpos y Astrodinámica
 */
export const SpaceLabIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`inline-block ${className}`}
  >
    <defs>
      <linearGradient id="space-sun" x1="12" y1="12" x2="20" y2="20" gradientUnits="userSpaceOnUse">
        <stop stopColor="#fde047" />
        <stop offset="0.5" stopColor="#f59e0b" />
        <stop offset="1" stopColor="#ea580c" />
      </linearGradient>
      <filter id="space-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="1.2" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    {/* Cuadro exterior tecnológico */}
    <rect x="2" y="2" width="28" height="28" rx="8" stroke="#0284c7" strokeWidth="1.2" strokeOpacity="0.4" />
    {/* Órbita principal de Kepler elíptica */}
    <ellipse
      cx="16"
      cy="16"
      rx="12.5"
      ry="5.5"
      transform="rotate(-26 16 16)"
      stroke="#38bdf8"
      strokeWidth="1.5"
      strokeDasharray="4 2.5"
    />
    {/* Órbita secundaria transversal */}
    <ellipse
      cx="16"
      cy="16"
      rx="12"
      ry="5"
      transform="rotate(38 16 16)"
      stroke="#818cf8"
      strokeWidth="1.2"
      strokeOpacity="0.7"
    />
    {/* Astro central masivo con brillo coronal */}
    <circle cx="16" cy="16" r="5" fill="url(#space-sun)" filter="url(#space-glow)" />
    <circle cx="16" cy="16" r="2.5" fill="#fef08a" />
    {/* Satélite en órbita con vector velocidad */}
    <circle cx="26" cy="11" r="2.2" fill="#38bdf8" filter="url(#space-glow)" />
    <path d="M 26 11 L 28 8" stroke="#10b981" strokeWidth="1.2" strokeLinecap="round" />
    {/* Segundo cuerpo orbital */}
    <circle cx="7" cy="12" r="1.6" fill="#a855f7" />
  </svg>
);

/**
 * Icono Ilustrado de Osciladores Acoplados, Ondas y Huygens
 */
export const MechanicsLabIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`inline-block ${className}`}
  >
    <defs>
      <linearGradient id="mech-grad" x1="4" y1="8" x2="28" y2="24" gradientUnits="userSpaceOnUse">
        <stop stopColor="#fbbf24" />
        <stop offset="1" stopColor="#d97706" />
      </linearGradient>
      <filter id="mech-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="1" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    {/* Chasis exterior */}
    <rect x="2" y="2" width="28" height="28" rx="8" stroke="#d97706" strokeWidth="1.2" strokeOpacity="0.4" />
    {/* Viga soporte de péndulos */}
    <line x1="6" y1="7" x2="26" y2="7" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
    {/* Hilos oscilatorios divergentes */}
    <line x1="11" y1="7" x2="8" y2="20" stroke="#94a3b8" strokeWidth="1.2" />
    <line x1="21" y1="7" x2="24" y2="18" stroke="#94a3b8" strokeWidth="1.2" />
    {/* Resorte de acoplamiento elástico k_c */}
    <path
      d="M 8 18 L 11 16 L 14 19 L 17 16 L 20 19 L 24 17"
      fill="none"
      stroke="#f59e0b"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    {/* Masas oscilantes con resplandor */}
    <circle cx="8" cy="21" r="3" fill="url(#mech-grad)" filter="url(#mech-glow)" />
    <circle cx="8" cy="21" r="1.2" fill="#fffbeb" />
    <circle cx="24" cy="18" r="3" fill="#38bdf8" filter="url(#mech-glow)" />
    <circle cx="24" cy="18" r="1.2" fill="#f0fdf4" />
    {/* Onda senoidal armónica de fondo */}
    <path
      d="M 5 27 Q 10 23 16 27 T 27 27"
      fill="none"
      stroke="#fbbf24"
      strokeWidth="1.5"
      strokeDasharray="2 1.5"
      strokeOpacity="0.8"
    />
  </svg>
);

/**
 * Icono Ilustrado de Cinemática y Balística 2D
 */
export const KinematicsLabIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`inline-block ${className}`}
  >
    <defs>
      <linearGradient id="kin-grad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop stopColor="#34d399" />
        <stop offset="1" stopColor="#059669" />
      </linearGradient>
      <filter id="kin-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="1" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    {/* Chasis exterior */}
    <rect x="2" y="2" width="28" height="28" rx="8" stroke="#059669" strokeWidth="1.2" strokeOpacity="0.4" />
    {/* Retícula de calibración HUD táctica */}
    <circle cx="16" cy="16" r="11" stroke="#10b981" strokeWidth="1" strokeDasharray="3 2" strokeOpacity="0.5" />
    <circle cx="16" cy="16" r="4.5" stroke="#34d399" strokeWidth="1.2" strokeOpacity="0.7" />
    <line x1="16" y1="3" x2="16" y2="8" stroke="#10b981" strokeWidth="1.4" />
    <line x1="16" y1="24" x2="16" y2="29" stroke="#10b981" strokeWidth="1.4" />
    <line x1="3" y1="16" x2="8" y2="16" stroke="#10b981" strokeWidth="1.4" />
    <line x1="24" y1="16" x2="29" y2="16" stroke="#10b981" strokeWidth="1.4" />
    {/* Trayectoria balística parabólica con flecha de velocidad */}
    <path
      d="M 5 24 Q 15 6 27 15"
      fill="none"
      stroke="#a7f3d0"
      strokeWidth="1.8"
      strokeLinecap="round"
      filter="url(#kin-glow)"
    />
    {/* Proyectil en vértice superior */}
    <circle cx="15.5" cy="10.5" r="2.8" fill="url(#kin-grad)" filter="url(#kin-glow)" />
    <circle cx="15.5" cy="10.5" r="1.2" fill="#ffffff" />
    {/* Vector de arrastre aerodinámico F_d */}
    <path d="M 15.5 10.5 L 19 8" stroke="#f43f5e" strokeWidth="1.4" strokeLinecap="round" />
    {/* Vector de aceleración gravitatoria g */}
    <path d="M 15.5 10.5 L 15.5 15" stroke="#38bdf8" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

/**
 * Renderizador de Icono Ilustrado según módulo
 */
export const LabCoverIcon: React.FC<{
  labId: LabId;
  size?: number;
  className?: string;
}> = ({ labId, size = 26, className = '' }) => {
  switch (labId) {
    case 'circuits':
      return <CircuitsLabIcon size={size} className={className} />;
    case 'space':
      return <SpaceLabIcon size={size} className={className} />;
    case 'mechanics':
      return <MechanicsLabIcon size={size} className={className} />;
    case 'kinematics':
      return <KinematicsLabIcon size={size} className={className} />;
    default:
      return <CircuitsLabIcon size={size} className={className} />;
  }
};

/**
 * Badge con Icono + Resplandor + Marco Glassmórfico de alta fidelidad para portadas
 */
export const LabCoverBadge: React.FC<{
  labId: LabId;
  size?: 'sm' | 'md' | 'lg';
  showCode?: boolean;
  code?: string;
  className?: string;
}> = ({ labId, size = 'md', showCode = false, code, className = '' }) => {
  const theme = LAB_THEMES[labId] || LAB_THEMES.circuits;

  const sizeStyles = {
    sm: {
      wrapper: 'w-7 h-7 rounded-lg',
      iconSize: 18,
    },
    md: {
      wrapper: 'w-9 h-9 rounded-xl',
      iconSize: 22,
    },
    lg: {
      wrapper: 'w-12 h-12 rounded-2xl',
      iconSize: 30,
    },
  }[size];

  return (
    <div className={`relative flex items-center gap-2 ${className}`}>
      {/* Resplandor ambiental de fondo */}
      <div
        className="absolute inset-0 rounded-xl blur-md opacity-60 pointer-events-none transform scale-110"
        style={{ backgroundColor: theme.glow }}
        aria-hidden="true"
      />
      <div
        className={`relative ${sizeStyles.wrapper} ${theme.bgBadge} ${theme.border} border shadow-lg flex items-center justify-center shrink-0 backdrop-blur-md instrument-transition group-hover:scale-105 group-hover:${theme.borderLight}`}
      >
        <LabCoverIcon labId={labId} size={sizeStyles.iconSize} />
      </div>
      {showCode && code && (
        <span className={`font-mono text-xs font-bold ${theme.badgeText} tracking-wider`}>
          {code}
        </span>
      )}
    </div>
  );
};
