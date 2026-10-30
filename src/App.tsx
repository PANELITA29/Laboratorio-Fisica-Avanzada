/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Atom,
  Zap,
  Orbit,
  Activity,
  Volume2,
  VolumeX,
  ArrowLeft,
  Play,
  BookOpen,
  Award,
  CheckCircle2,
  QrCode,
  Menu,
  X,
  Sliders,
  Crosshair,
} from 'lucide-react';
import { Language, dictionary } from './assets/js/i18n';
import { audioSynth } from './assets/js/audio-synth';
import { TelemetryItem } from './assets/js/report-generator';
import { mountDotField } from './assets/js/graphics/DotField';
import { PWAInstallButton } from './components/PWAInstallButton';
import { TheoryModal } from './components/TheoryModal';
import { ColorCodeModal } from './components/ColorCodeModal';
import { LabQRCodeModal, HubQRCodeBanner } from './components/LabQRCodeModal';
import { ScrollReveal } from './components/QuantumAnimations';
import { CircuitLabView } from './labs/circuitos/CircuitLabView';
import { SpaceLabView } from './labs/espacio-3d/SpaceLabView';
import { MechanicsLabView } from './labs/mecanica-3d/MechanicsLabView';
import { KinematicsLabView } from './labs/cinematica/KinematicsLabView';

type ActiveModuleView = 'hub' | 'circuits' | 'space' | 'mechanics' | 'kinematics';
type ModuleCategoryFilter = 'all' | 'circuits' | 'space' | 'mechanics' | 'kinematics';

export default function App() {
  const [lang, setLang] = useState<Language>('es');
  const [activeView, setActiveView] = useState<ActiveModuleView>(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const requestedLab = searchParams.get('lab');
      if (requestedLab === 'circuits' || requestedLab === 'circuitos') return 'circuits';
      if (requestedLab === 'space' || requestedLab === 'espacio-3d') return 'space';
      if (requestedLab === 'mechanics' || requestedLab === 'mecanica-3d') return 'mechanics';
      if (requestedLab === 'kinematics' || requestedLab === 'cinematica') return 'kinematics';
    }
    return 'hub';
  });
  const [categoryFilter, setCategoryFilter] = useState<ModuleCategoryFilter>('all');
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState<boolean>(false);
  const [isNetworkOnline, setIsNetworkOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isTheoryModalOpen, setIsTheoryModalOpen] = useState<boolean>(false);
  const [isColorCodeModalOpen, setIsColorCodeModalOpen] = useState<boolean>(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState<boolean>(false);
  const [externalResistorSync, setExternalResistorSync] = useState<{
    target: 'R1' | 'R2' | 'R3';
    ohms: number;
    token: number;
  } | null>(null);
  const [selectedObjectivesModule, setSelectedObjectivesModule] = useState<
    'circuits' | 'space' | 'mechanics' | 'kinematics' | null
  >(null);

  const [completedChallenges, setCompletedChallenges] = useState<Record<string, boolean>>({});
  const [totalScore, setTotalScore] = useState<number>(0);
  const [, setActiveTelemetry] = useState<TelemetryItem[]>([]);

  const navbarRef = useRef<HTMLElement | null>(null);
  const translations = dictionary[lang];

  useEffect(() => {
    if (!navbarRef.current) return;
    const controller = mountDotField(navbarRef.current);
    return () => {
      controller.destroy();
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsNetworkOnline(true);
    const handleOffline = () => setIsNetworkOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const selectModuleView = (nextView: ActiveModuleView) => {
    setActiveView(nextView);
    setIsMobileMenuOpen(false);
  };

  const toggleProceduralAudio = () => {
    const nextMutedState = !isAudioMuted;
    setIsAudioMuted(nextMutedState);
    audioSynth.setMuted(nextMutedState);
  };

  const registerCompletedChallenge = (challengeId: string, awardedPoints: number) => {
    setCompletedChallenges((previous) => {
      if (previous[challengeId]) return previous;
      setTotalScore((score) => score + awardedPoints);
      return { ...previous, [challengeId]: true };
    });
  };

  const verifiedChallengesCount = Object.keys(completedChallenges).length;

  const engineSpecifications = [
    {
      code: 'MOD-01',
      domain: lang === 'es' ? 'Electrodinámica DC' : 'DC Electrodynamics',
      solver: 'Gauss-Seidel / Kirchhoff Nodal',
      equations: 'V = I·R, ∑I = 0, ∑ΔV = 0',
      targetView: 'circuits' as ActiveModuleView,
    },
    {
      code: 'MOD-02',
      domain: lang === 'es' ? 'Gravitación N-Cuerpos' : 'N-Body Gravitation',
      solver: 'Velocity Verlet Simpléctico',
      equations: 'F = G·M·m/r², T² = a³/M',
      targetView: 'space' as ActiveModuleView,
    },
    {
      code: 'MOD-03',
      domain: lang === 'es' ? 'Oscilaciones y Ondas' : 'Oscillations & Waves',
      solver: 'Runge-Kutta 4to Orden (RK4)',
      equations: 'T = 2π√(L/g), E = K + U',
      targetView: 'mechanics' as ActiveModuleView,
    },
    {
      code: 'MOD-04',
      domain: lang === 'es' ? 'Cinemática y Balística 2D' : '2D Kinematics & Ballistics',
      solver: 'Runge-Kutta 4 (RK4) + Rayleigh',
      equations: 'F_d = -½ρ·Cd·A·|v_rel|·v_rel, E = Ec + Ep',
      targetView: 'kinematics' as ActiveModuleView,
    },
  ];

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#07090E] text-slate-100 flex flex-col pb-16 md:pb-0">
      <header
        ref={navbarRef}
        className="hub-navbar sticky top-0 z-40 overflow-hidden bg-[#07090E]/95 border-b border-slate-800 py-2.5 no-print"
      >
        <div className="fluid-container flex items-center justify-between gap-2 sm:gap-4">
          <button
            type="button"
            data-testid="nav-tab-inicio"
            onClick={() => selectModuleView('hub')}
            className="hub-brand-group min-h-[2.75rem] px-1.5 text-sm sm:text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer"
          >
            <Atom className="w-5 h-5 text-cyan-400 shrink-0" />
            <span className="truncate font-mono">
              LABFÍSICA <span className="hidden sm:inline text-slate-400 font-normal">· SUITE NUMÉRICA 3D</span>
            </span>
          </button>

          <nav
            aria-label="Navegación principal"
            className="hub-nav-links hidden md:flex flex-wrap items-center justify-center gap-1 lg:gap-1.5 text-xs font-medium text-slate-300"
          >
            <button
              type="button"
              onClick={() => selectModuleView('hub')}
              className={`min-h-[2.75rem] px-3 rounded-lg instrument-transition whitespace-nowrap shrink-0 cursor-pointer flex items-center ${
                activeView === 'hub'
                  ? 'text-cyan-300 font-semibold bg-slate-900 border border-slate-700'
                  : 'hover:text-white'
              }`}
            >
              {translations.navExplore}
            </button>
            <button
              type="button"
              onClick={() => selectModuleView('circuits')}
              className={`min-h-[2.75rem] px-3 rounded-lg instrument-transition whitespace-nowrap shrink-0 cursor-pointer flex items-center ${
                activeView === 'circuits'
                  ? 'text-cyan-300 font-semibold bg-slate-900 border border-slate-700'
                  : 'hover:text-white'
              }`}
            >
              Circuitos DC
            </button>
            <button
              type="button"
              onClick={() => selectModuleView('space')}
              className={`min-h-[2.75rem] px-3 rounded-lg instrument-transition whitespace-nowrap shrink-0 cursor-pointer flex items-center ${
                activeView === 'space'
                  ? 'text-cyan-300 font-semibold bg-slate-900 border border-slate-700'
                  : 'hover:text-white'
              }`}
            >
              Gravitación 3D
            </button>
            <button
              type="button"
              onClick={() => selectModuleView('mechanics')}
              className={`min-h-[2.75rem] px-3 rounded-lg instrument-transition whitespace-nowrap shrink-0 cursor-pointer flex items-center ${
                activeView === 'mechanics'
                  ? 'text-cyan-300 font-semibold bg-slate-900 border border-slate-700'
                  : 'hover:text-white'
              }`}
            >
              Oscilaciones RK4
            </button>
            <button
              type="button"
              data-testid="nav-tab-kinematics"
              onClick={() => selectModuleView('kinematics')}
              className={`min-h-[2.75rem] px-3 rounded-lg instrument-transition whitespace-nowrap shrink-0 cursor-pointer flex items-center ${
                activeView === 'kinematics'
                  ? 'text-cyan-300 font-semibold bg-slate-900 border border-slate-700'
                  : 'hover:text-white'
              }`}
            >
              Cinemática 2D
            </button>
            <button
              type="button"
              onClick={() => {
                setIsTheoryModalOpen(true);
                setIsMobileMenuOpen(false);
              }}
              className="min-h-[2.75rem] px-3 rounded-lg hover:text-white instrument-transition whitespace-nowrap shrink-0 cursor-pointer flex items-center"
            >
              {translations.navFoundations}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsColorCodeModalOpen(true);
                setIsMobileMenuOpen(false);
              }}
              className="min-h-[2.75rem] px-3 rounded-lg hover:text-white instrument-transition whitespace-nowrap shrink-0 cursor-pointer flex items-center"
            >
              Norma EIA
            </button>
          </nav>

          <div className="hub-nav-links flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsQRModalOpen(true)}
              className="min-h-[2.75rem] flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-semibold text-slate-950 bg-cyan-400 rounded-lg hover:bg-cyan-300 instrument-transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              <QrCode className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Sincronizar QR</span>
              <span className="inline sm:hidden">QR</span>
            </button>

            <button
              type="button"
              data-testid="mobile-menu-toggle"
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-navigation-drawer"
              aria-label={isMobileMenuOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
              onClick={() => setIsMobileMenuOpen((previous) => !previous)}
              className="inline-flex md:hidden items-center justify-center touch-target rounded-lg bg-[#0D1322] border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800 instrument-transition cursor-pointer"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <nav
            id="mobile-navigation-drawer"
            data-testid="mobile-nav-drawer"
            aria-label="Menú móvil desplegable"
            className="md:hidden fluid-container pt-3 pb-2 mt-2.5 border-t border-slate-800 space-y-2"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => selectModuleView('hub')}
                className={`min-h-[2.75rem] px-3.5 py-2.5 rounded-lg text-left text-xs font-semibold flex items-center justify-between instrument-transition cursor-pointer ${
                  activeView === 'hub'
                    ? 'bg-slate-900 text-cyan-300 border border-cyan-500/50'
                    : 'bg-[#0C111D] text-slate-200 border border-slate-800'
                }`}
              >
                <span>{translations.navExplore}</span>
                <span className="text-[10px] font-mono text-slate-400">ÍNDICE</span>
              </button>
              <button
                type="button"
                onClick={() => selectModuleView('circuits')}
                className={`min-h-[2.75rem] px-3.5 py-2.5 rounded-lg text-left text-xs font-semibold flex items-center justify-between instrument-transition cursor-pointer ${
                  activeView === 'circuits'
                    ? 'bg-slate-900 text-cyan-300 border border-cyan-500/50'
                    : 'bg-[#0C111D] text-slate-200 border border-slate-800'
                }`}
              >
                <span>Banco de Circuitos DC</span>
                <span className="text-[10px] font-mono text-slate-400">MOD-01</span>
              </button>
              <button
                type="button"
                onClick={() => selectModuleView('space')}
                className={`min-h-[2.75rem] px-3.5 py-2.5 rounded-lg text-left text-xs font-semibold flex items-center justify-between instrument-transition cursor-pointer ${
                  activeView === 'space'
                    ? 'bg-slate-900 text-cyan-300 border border-cyan-500/50'
                    : 'bg-[#0C111D] text-slate-200 border border-slate-800'
                }`}
              >
                <span>Gravitación N-Cuerpos 3D</span>
                <span className="text-[10px] font-mono text-slate-400">MOD-02</span>
              </button>
              <button
                type="button"
                onClick={() => selectModuleView('mechanics')}
                className={`min-h-[2.75rem] px-3.5 py-2.5 rounded-lg text-left text-xs font-semibold flex items-center justify-between instrument-transition cursor-pointer ${
                  activeView === 'mechanics'
                    ? 'bg-slate-900 text-cyan-300 border border-cyan-500/50'
                    : 'bg-[#0C111D] text-slate-200 border border-slate-800'
                }`}
              >
                <span>Oscilaciones y Ondas RK4</span>
                <span className="text-[10px] font-mono text-slate-400">MOD-03</span>
              </button>
              <button
                type="button"
                onClick={() => selectModuleView('kinematics')}
                className={`min-h-[2.75rem] px-3.5 py-2.5 rounded-lg text-left text-xs font-semibold flex items-center justify-between instrument-transition cursor-pointer ${
                  activeView === 'kinematics'
                    ? 'bg-slate-900 text-cyan-300 border border-cyan-500/50'
                    : 'bg-[#0C111D] text-slate-200 border border-slate-800'
                }`}
              >
                <span>Cinemática y Balística 2D</span>
                <span className="text-[10px] font-mono text-slate-400">MOD-04</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsTheoryModalOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="min-h-[2.75rem] px-3.5 py-2.5 rounded-lg bg-[#0C111D] border border-slate-800 text-left text-xs font-semibold text-slate-200 hover:bg-slate-800 instrument-transition cursor-pointer flex items-center justify-between"
              >
                <span>Formulario Físico-Matemático</span>
                <BookOpen className="w-4 h-4 text-cyan-400 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsColorCodeModalOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="min-h-[2.75rem] px-3.5 py-2.5 rounded-lg bg-[#0C111D] border border-slate-800 text-left text-xs font-semibold text-slate-200 hover:bg-slate-800 instrument-transition cursor-pointer flex items-center justify-between"
              >
                <span>Decodificador EIA (IEC 60062)</span>
                <Sliders className="w-4 h-4 text-amber-400 shrink-0" />
              </button>
            </div>
          </nav>
        )}
      </header>

      <div className="bg-[#0A0E17] border-b border-slate-800/80 py-1 no-print">
        <div className="fluid-container flex items-center justify-between gap-1.5 sm:gap-2 text-xs">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            {activeView !== 'hub' && (
              <button
                type="button"
                onClick={() => selectModuleView('hub')}
                className="min-h-[2rem] flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium instrument-transition cursor-pointer whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{translations.backToHub}</span>
                <span className="sm:hidden">{lang === 'es' ? 'Módulos' : 'Modules'}</span>
              </button>
            )}

            {/* Menú desplegable secundario de Perfil de Investigador / Red Activa */}
            <div className="relative min-w-0">
              <button
                type="button"
                data-testid="researcher-profile-menu-btn"
                aria-expanded={isProfileMenuOpen}
                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                className="min-h-[2rem] px-2 sm:px-2.5 py-1 rounded-md bg-[#07090E] border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white font-mono text-[11px] flex items-center gap-1.5 sm:gap-2 cursor-pointer"
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isNetworkOnline ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span className="hidden sm:inline whitespace-nowrap">
                  {lang === 'es' ? 'Perfil Investigador' : 'Researcher Profile'}
                </span>
                <span className="sm:hidden whitespace-nowrap">
                  {lang === 'es' ? 'Perfil' : 'Profile'}
                </span>
                <span className="text-amber-300 font-bold tabular-nums whitespace-nowrap">
                  {totalScore} PTS
                </span>
              </button>

              {isProfileMenuOpen && (
                <div
                  data-testid="researcher-profile-dropdown"
                  className="absolute left-0 mt-1.5 w-72 rounded-xl bg-[#0B101C] border border-slate-700 shadow-2xl p-3.5 z-50 space-y-2.5 text-xs font-mono"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-400 text-[10px] uppercase">Credencial Activa</span>
                    <button
                      type="button"
                      onClick={() => setIsProfileMenuOpen(false)}
                      aria-label="Cerrar menú de perfil"
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-slate-100 font-semibold">
                    {translations.authorBadge}
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Estado de Red:</span>
                    <span className="text-emerald-400">
                      {isNetworkOnline ? translations.statusOnline : translations.statusOffline}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">{translations.scoreLabel}:</span>
                    <span className="text-amber-300 font-bold tabular-nums">
                      {totalScore} PTS ({verifiedChallengesCount}/6 retos)
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <div
              className="flex items-center rounded-md bg-[#07090E] border border-slate-800 p-0.5"
              role="group"
              aria-label="Selector de Idioma"
            >
              <button
                type="button"
                onClick={() => setLang('es')}
                className={`min-h-[1.75rem] min-w-[2rem] px-2 py-0.5 rounded text-[11px] font-mono font-semibold instrument-transition cursor-pointer ${
                  lang === 'es' ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                ES
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`min-h-[1.75rem] min-w-[2rem] px-2 py-0.5 rounded text-[11px] font-mono font-semibold instrument-transition cursor-pointer ${
                  lang === 'en' ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                EN
              </button>
            </div>

            <button
              type="button"
              onClick={toggleProceduralAudio}
              aria-label={isAudioMuted ? translations.unmuteAudio : translations.muteAudio}
              className="min-h-[2rem] flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#07090E] border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 instrument-transition cursor-pointer"
            >
              {isAudioMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              )}
              <span className="hidden sm:inline font-mono text-[11px]">
                {isAudioMuted ? '60Hz: OFF' : '60Hz: ON'}
              </span>
            </button>

            <div className="hidden sm:block">
              <PWAInstallButton lang={lang} />
            </div>
          </div>
        </div>
      </div>

      <main
        className={`flex-1 fluid-container ${
          activeView === 'hub' ? 'py-[var(--fluid-pad-y)]' : 'py-2.5 sm:py-3'
        }`}
      >
        {activeView === 'hub' && (
          <div id="portal-hub-view" className="space-y-8 sm:space-y-10">
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch pt-1">
              <div className="lg:col-span-6 flex flex-col justify-between space-y-5">
                <div className="space-y-3.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-300">
                    <span className="text-cyan-300 font-semibold">
                      {lang === 'es' ? 'Suite de Instrumentación Numérica' : 'Numerical Instrumentation Suite'}
                    </span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span>WebGL2 &amp; Canvas 2D</span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span>Δt = 16.67 ms</span>
                  </div>

                  <h1 className="fluid-title-xl font-bold tracking-tight text-white max-w-[22ch]">
                    <span className="block">{translations.heroTitleLine1}</span>
                    <span className="block text-slate-300 font-normal mt-1.5 text-[0.72em] leading-snug">
                      {translations.heroTitleLine2}
                    </span>
                  </h1>

                  <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed max-w-[62ch]">
                    {translations.heroDescription}
                  </p>
                </div>

                <div className="pt-1 space-y-2">
                  <div className="text-xs font-mono text-slate-300">
                    {lang === 'es' ? 'Filtrar bancos de prueba por dominio físico:' : 'Filter testbenches by physical domain:'}
                  </div>
                  <div
                    role="group"
                    aria-label={lang === 'es' ? 'Filtro de módulos de laboratorio' : 'Laboratory module filter'}
                    className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#0B101B] border border-slate-800/90 w-fit"
                  >
                    <button
                      type="button"
                      onClick={() => setCategoryFilter('all')}
                      className={`min-h-[2.375rem] px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold whitespace-nowrap instrument-transition cursor-pointer ${
                        categoryFilter === 'all'
                          ? 'bg-cyan-400 text-slate-950 shadow-sm'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                      }`}
                    >
                      {translations.filterAll}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoryFilter('circuits')}
                      className={`min-h-[2.375rem] px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold whitespace-nowrap instrument-transition cursor-pointer ${
                        categoryFilter === 'circuits'
                          ? 'bg-cyan-400 text-slate-950 shadow-sm'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                      }`}
                    >
                      {lang === 'es' ? 'Circuitos DC' : 'DC Circuits'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoryFilter('space')}
                      className={`min-h-[2.375rem] px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold whitespace-nowrap instrument-transition cursor-pointer ${
                        categoryFilter === 'space'
                          ? 'bg-cyan-400 text-slate-950 shadow-sm'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                      }`}
                    >
                      {lang === 'es' ? 'Gravitación 3D' : '3D Gravitation'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoryFilter('mechanics')}
                      className={`min-h-[2.375rem] px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold whitespace-nowrap instrument-transition cursor-pointer ${
                        categoryFilter === 'mechanics'
                          ? 'bg-cyan-400 text-slate-950 shadow-sm'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                      }`}
                    >
                      {lang === 'es' ? 'Oscilaciones RK4' : 'RK4 Oscillations'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoryFilter('kinematics')}
                      className={`min-h-[2.375rem] px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold whitespace-nowrap instrument-transition cursor-pointer ${
                        categoryFilter === 'kinematics'
                          ? 'bg-cyan-400 text-slate-950 shadow-sm'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                      }`}
                    >
                      {lang === 'es' ? 'Cinemática 2D' : '2D Kinematics'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6 rounded-xl workbench-panel overflow-hidden flex flex-col justify-between">
                <div className="px-4 py-3 bg-[#0E1525] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-mono font-semibold text-white">
                    {lang === 'es'
                      ? 'Arquitectura de los Solucionadores Numéricos'
                      : 'Numerical Solver Architecture'}
                  </span>
                  <span className="text-xs font-mono text-cyan-300">
                    {lang === 'es' ? 'Paso fijo Δt = 16.67 ms · 60 FPS' : 'Fixed step Δt = 16.67 ms · 60 FPS'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-800/90 border-b border-slate-800 bg-[#080C15]">
                  <div className="p-3 space-y-0.5">
                    <div className="text-[11px] font-mono text-slate-300">
                      {lang === 'es' ? 'Orden Temporal' : 'Time Order'}
                    </div>
                    <div className="text-sm font-mono font-bold text-cyan-300">RK4 O(h⁴)</div>
                  </div>
                  <div className="p-3 space-y-0.5">
                    <div className="text-[11px] font-mono text-slate-300">
                      {lang === 'es' ? 'Invariante Orbital' : 'Orbital Invariant'}
                    </div>
                    <div className="text-sm font-mono font-bold text-amber-300">Verlet O(h²)</div>
                  </div>
                  <div className="p-3 space-y-0.5">
                    <div className="text-[11px] font-mono text-slate-300">
                      {lang === 'es' ? 'Álgebra Nodal' : 'Nodal Algebra'}
                    </div>
                    <div className="text-sm font-mono font-bold text-emerald-300">G·V = I_s</div>
                  </div>
                  <div className="p-3 space-y-0.5">
                    <div className="text-[11px] font-mono text-slate-300">
                      {lang === 'es' ? 'Verificación' : 'Verification'}
                    </div>
                    <div className="text-sm font-mono font-bold text-white">
                      {verifiedChallengesCount}/6 {lang === 'es' ? 'Retos' : 'Labs'}
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-slate-800/80 text-xs flex-1 flex flex-col justify-center">
                  {engineSpecifications.map((spec) => (
                    <div
                      key={spec.code}
                      className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#0E1525]/70 instrument-transition"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="font-mono text-xs font-semibold text-cyan-300">
                            {spec.code}
                          </span>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span className="font-semibold text-white">{spec.domain}</span>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span className="text-slate-300 font-mono text-[11px]">{spec.solver}</span>
                        </div>
                        <div className="font-mono text-[11px] text-slate-300 truncate">{spec.equations}</div>
                      </div>

                      <button
                        type="button"
                        onClick={() => selectModuleView(spec.targetView)}
                        className="min-h-[2.25rem] self-start sm:self-center px-3 py-1 rounded-lg bg-slate-800/90 hover:bg-cyan-400 hover:text-slate-950 border border-slate-700 hover:border-cyan-400 text-slate-100 font-mono font-semibold text-[11px] instrument-transition cursor-pointer shrink-0"
                      >
                        {lang === 'es' ? 'Abrir →' : 'Open →'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section
              id="labs-3d-grid"
              aria-label={lang === 'es' ? 'Bancos de Simulación Interactiva' : 'Interactive Simulation Workbenches'}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch"
            >
              {(categoryFilter === 'all' || categoryFilter === 'circuits') && (
                <ScrollReveal className="h-full flex">
                  <article className="w-full rounded-xl workbench-panel-interactive flex flex-col justify-between overflow-hidden">
                    <div>
                      <div
                        onClick={() => selectModuleView('circuits')}
                        className="relative aspect-[21/9] schematic-grid-bg border-b border-slate-800 flex items-center justify-center cursor-pointer group overflow-hidden"
                      >
                        <svg viewBox="0 0 420 160" className="w-full h-full px-6 py-3">
                          <rect
                            x="56"
                            y="24"
                            width="304"
                            height="96"
                            rx="5"
                            fill="none"
                            stroke="#475569"
                            strokeWidth="1.75"
                          />
                          <line x1="56" y1="56" x2="56" y2="88" stroke="#070A12" strokeWidth="4" />
                          <line x1="42" y1="68" x2="70" y2="68" stroke="#22D3EE" strokeWidth="2.5" />
                          <line x1="48" y1="78" x2="64" y2="78" stroke="#94A3B8" strokeWidth="2" />
                          <text x="36" y="58" fill="#67E8F9" fontSize="10" fontFamily="JetBrains Mono, monospace">
                            +V_F
                          </text>

                          <rect
                            x="126"
                            y="14"
                            width="58"
                            height="20"
                            rx="3"
                            fill="#0F172A"
                            stroke="#22D3EE"
                            strokeWidth="1.75"
                          />
                          <rect x="136" y="15" width="5" height="18" fill="#EF4444" />
                          <rect x="146" y="15" width="5" height="18" fill="#A855F7" />
                          <rect x="156" y="15" width="5" height="18" fill="#F59E0B" />
                          <text x="140" y="48" fill="#CBD5E1" fontSize="10" fontFamily="JetBrains Mono, monospace">
                            R₁ (EIA)
                          </text>

                          <line x1="252" y1="24" x2="252" y2="120" stroke="#475569" strokeWidth="1.75" />
                          <circle cx="252" cy="24" r="3.5" fill="#22D3EE" />
                          <circle cx="252" cy="120" r="3.5" fill="#22D3EE" />

                          <rect
                            x="240"
                            y="52"
                            width="24"
                            height="40"
                            rx="3"
                            fill="#0F172A"
                            stroke="#38BDF8"
                            strokeWidth="1.75"
                          />
                          <text x="270" y="76" fill="#CBD5E1" fontSize="10" fontFamily="JetBrains Mono, monospace">
                            R₂
                          </text>

                          <circle
                            cx="360"
                            cy="72"
                            r="16"
                            fill="#0F172A"
                            stroke="#F59E0B"
                            strokeWidth="2"
                          />
                          <circle cx="360" cy="72" r="7" fill="#F59E0B" fillOpacity="0.85" />
                          <text x="314" y="76" fill="#FDE68A" fontSize="10" fontFamily="JetBrains Mono, monospace">
                            P≤15W
                          </text>
                        </svg>
                        <div className="absolute top-2.5 left-3.5 font-mono text-[11px] text-cyan-300 bg-[#070A12]/90 px-2.5 py-0.5 rounded border border-slate-800">
                          V_F = I_T · (R₁ + R₂∥R₃)
                        </div>
                        <div className="absolute bottom-2.5 right-3.5 font-mono text-[11px] text-slate-300 bg-[#070A12]/90 px-2.5 py-0.5 rounded border border-slate-800">
                          LCK: ∑I = 0 · LVK: ∑ΔV = 0
                        </div>
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 instrument-transition flex items-center justify-center">
                          <span className="px-4 py-2 rounded-lg bg-cyan-400 text-slate-950 font-mono font-bold text-xs flex items-center gap-1.5">
                            <Play className="w-3.5 h-3.5 fill-current" />
                            {translations.card1PlayBtn}
                          </span>
                        </div>
                      </div>

                      <div className="fluid-section-pad space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                          <span className="text-cyan-300 font-semibold">
                            {lang === 'es' ? '01. Electrodinámica DC' : '01. DC Electrodynamics'}
                          </span>
                          <span className="text-slate-300">
                            {lang === 'es' ? 'Solver Nodal Matricial · Sandbox Libre' : 'Nodal Matrix Solver · Free Sandbox'}
                          </span>
                        </div>
                        <h2 className="fluid-title-md font-bold text-white">{translations.card1Title}</h2>
                        <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed">
                          {translations.card1Desc}
                        </p>
                        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-mono text-slate-300">
                          {translations.card1Badges.map((badgeText, badgeIndex) => (
                            <React.Fragment key={badgeIndex}>
                              {badgeIndex > 0 && <span aria-hidden="true" className="text-slate-600">·</span>}
                              <span>{badgeText}</span>
                            </React.Fragment>
                          ))}
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span className="text-cyan-300">Taller Libre de Nodos</span>
                        </div>
                      </div>
                    </div>

                    <div className="fluid-section-pad pt-0 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => selectModuleView('circuits')}
                        className="min-h-[2.75rem] w-full py-2.5 px-4 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-mono font-bold text-xs flex items-center justify-center gap-2 instrument-transition cursor-pointer"
                      >
                        <Zap className="w-4 h-4 shrink-0" />
                        <span>{translations.card1PlayBtn}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedObjectivesModule('circuits')}
                        className="min-h-[2.75rem] w-full py-2.5 px-4 rounded-lg bg-[#07090E] hover:bg-slate-900 border border-slate-700 text-slate-200 font-mono text-xs flex items-center justify-center gap-1.5 instrument-transition cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>{translations.card1ObjectivesBtn}</span>
                      </button>
                    </div>
                  </article>
                </ScrollReveal>
              )}

              {(categoryFilter === 'all' || categoryFilter === 'space') && (
                <ScrollReveal className="h-full flex">
                  <article className="w-full rounded-xl workbench-panel-interactive flex flex-col justify-between overflow-hidden">
                    <div>
                      <div
                        onClick={() => selectModuleView('space')}
                        className="relative aspect-[21/9] schematic-grid-bg border-b border-slate-800 flex items-center justify-center cursor-pointer group overflow-hidden"
                      >
                        <svg viewBox="0 0 420 160" className="w-full h-full px-6 py-3">
                          <path
                            d="M 36 112 Q 210 148 384 112"
                            fill="none"
                            stroke="#334155"
                            strokeWidth="1.5"
                          />
                          <path
                            d="M 76 118 Q 210 142 344 118"
                            fill="none"
                            stroke="#1E293B"
                            strokeWidth="1.25"
                          />
                          <ellipse
                            cx="210"
                            cy="74"
                            rx="124"
                            ry="40"
                            transform="rotate(-9 210 74)"
                            fill="none"
                            stroke="#38BDF8"
                            strokeWidth="1.75"
                            strokeDasharray="6 4"
                          />
                          <ellipse
                            cx="196"
                            cy="74"
                            rx="76"
                            ry="25"
                            transform="rotate(-9 196 74)"
                            fill="none"
                            stroke="#22D3EE"
                            strokeWidth="2"
                          />
                          <circle cx="176" cy="76" r="17" fill="#F59E0B" />
                          <circle cx="268" cy="56" r="7" fill="#22D3EE" />
                          <line x1="268" y1="56" x2="234" y2="62" stroke="#F43F5E" strokeWidth="2" />
                          <line x1="268" y1="56" x2="280" y2="30" stroke="#10B981" strokeWidth="2" />
                          <text x="286" y="38" fill="#6EE7B7" fontSize="10" fontFamily="JetBrains Mono, monospace">
                            v_t
                          </text>
                          <text x="222" y="54" fill="#FDA4AF" fontSize="10" fontFamily="JetBrains Mono, monospace">
                            F_g
                          </text>
                        </svg>
                        <div className="absolute top-2.5 left-3.5 font-mono text-[11px] text-cyan-300 bg-[#070A12]/90 px-2.5 py-0.5 rounded border border-slate-800">
                          F_g = G·M·m / r² · T² ∝ a³
                        </div>
                        <div className="absolute bottom-2.5 right-3.5 font-mono text-[11px] text-slate-300 bg-[#070A12]/90 px-2.5 py-0.5 rounded border border-slate-800">
                          v_e = √(2GM/r) · Hohmann Δv
                        </div>
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 instrument-transition flex items-center justify-center">
                          <span className="px-4 py-2 rounded-lg bg-cyan-400 text-slate-950 font-mono font-bold text-xs flex items-center gap-1.5">
                            <Play className="w-3.5 h-3.5 fill-current" />
                            {translations.card2PlayBtn}
                          </span>
                        </div>
                      </div>

                      <div className="fluid-section-pad space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                          <span className="text-cyan-300 font-semibold">
                            {lang === 'es' ? '02. Mecánica Celeste N-Cuerpos' : '02. N-Body Celestial Mechanics'}
                          </span>
                          <span className="text-slate-300">
                            {lang === 'es' ? 'Integrador Simpléctico Velocity Verlet' : 'Symplectic Velocity Verlet Integrator'}
                          </span>
                        </div>
                        <h2 className="fluid-title-md font-bold text-white">{translations.card2Title}</h2>
                        <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed">
                          {translations.card2Desc}
                        </p>
                        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-mono text-slate-300">
                          {translations.card2Badges.map((badgeText, badgeIndex) => (
                            <React.Fragment key={badgeIndex}>
                              {badgeIndex > 0 && <span aria-hidden="true" className="text-slate-600">·</span>}
                              <span>{badgeText}</span>
                            </React.Fragment>
                          ))}
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span className="text-cyan-300">Transferencia de Hohmann</span>
                        </div>
                      </div>
                    </div>

                    <div className="fluid-section-pad pt-0 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => selectModuleView('space')}
                        className="min-h-[2.75rem] w-full py-2.5 px-4 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-mono font-bold text-xs flex items-center justify-center gap-2 instrument-transition cursor-pointer"
                      >
                        <Orbit className="w-4 h-4 shrink-0" />
                        <span>{translations.card2PlayBtn}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedObjectivesModule('space')}
                        className="min-h-[2.75rem] w-full py-2.5 px-4 rounded-lg bg-[#07090E] hover:bg-slate-900 border border-slate-700 text-slate-200 font-mono text-xs flex items-center justify-center gap-1.5 instrument-transition cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>{translations.card2ObjectivesBtn}</span>
                      </button>
                    </div>
                  </article>
                </ScrollReveal>
              )}

              {(categoryFilter === 'all' || categoryFilter === 'mechanics') && (
                <ScrollReveal className="h-full flex">
                  <article className="w-full rounded-xl workbench-panel-interactive flex flex-col justify-between overflow-hidden">
                    <div>
                      <div
                        onClick={() => selectModuleView('mechanics')}
                        className="relative aspect-[21/9] schematic-grid-bg border-b border-slate-800 flex items-center justify-center cursor-pointer group overflow-hidden"
                      >
                        <svg viewBox="0 0 420 160" className="w-full h-full px-6 py-3">
                          <line x1="96" y1="24" x2="324" y2="24" stroke="#64748B" strokeWidth="3" />
                          <line x1="158" y1="24" x2="128" y2="104" stroke="#94A3B8" strokeWidth="2" />
                          <line x1="262" y1="24" x2="292" y2="104" stroke="#94A3B8" strokeWidth="2" />
                          <path
                            d="M 142 64 L 166 56 L 188 70 L 210 56 L 232 70 L 254 56 L 278 64"
                            fill="none"
                            stroke="#F59E0B"
                            strokeWidth="2"
                          />
                          <circle cx="128" cy="104" r="12" fill="#F59E0B" />
                          <circle cx="292" cy="104" r="12" fill="#22D3EE" />
                          <text x="192" y="50" fill="#FDE68A" fontSize="10" fontFamily="JetBrains Mono, monospace">
                            k_c · Δx
                          </text>
                        </svg>
                        <div className="absolute top-2.5 left-3.5 font-mono text-[11px] text-cyan-300 bg-[#070A12]/90 px-2.5 py-0.5 rounded border border-slate-800">
                          θ̈ + (g/L)sin(θ) = 0 · T = 2π√(L/g)
                        </div>
                        <div className="absolute bottom-2.5 right-3.5 font-mono text-[11px] text-slate-300 bg-[#070A12]/90 px-2.5 py-0.5 rounded border border-slate-800">
                          E_m = K + U = cte
                        </div>
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 instrument-transition flex items-center justify-center">
                          <span className="px-4 py-2 rounded-lg bg-cyan-400 text-slate-950 font-mono font-bold text-xs flex items-center gap-1.5">
                            <Play className="w-3.5 h-3.5 fill-current" />
                            {lang === 'es' ? 'Abrir Banco RK4' : 'Open RK4 Bench'}
                          </span>
                        </div>
                      </div>

                      <div className="fluid-section-pad space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                          <span className="text-cyan-300 font-semibold">
                            {lang === 'es' ? '03. Dinámica y Oscilaciones RK4' : '03. RK4 Dynamics & Oscillations'}
                          </span>
                          <span className="text-slate-300">
                            {lang === 'es' ? 'Integrador Runge-Kutta 4to Orden' : '4th-Order Runge-Kutta Integrator'}
                          </span>
                        </div>
                        <h2 className="fluid-title-md font-bold text-white">
                          {lang === 'es'
                            ? 'Osciladores Acoplados, Péndulo de Huygens y Ondas 3D'
                            : 'Coupled Oscillators, Huygens Pendulum & 3D Waves'}
                        </h2>
                        <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed">
                          {lang === 'es'
                            ? 'Integración numérica Runge-Kutta de 4to orden (RK4). Evalúa conservación de energía mecánica E = K + U, transferencia por batimiento armónico, precesión de Foucault e interferencia ondulatoria.'
                            : '4th-order Runge-Kutta (RK4) numerical integration. Evaluates mechanical energy conservation E = K + U, harmonic beat transfer, Foucault precession, and wave interference.'}
                        </p>
                        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-mono text-slate-300">
                          <span>Runge-Kutta 4</span>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span>Modos Normales</span>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span>E = K + U</span>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span className="text-cyan-300">Precesión de Foucault</span>
                        </div>
                      </div>
                    </div>

                    <div className="fluid-section-pad pt-0 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => selectModuleView('mechanics')}
                        className="min-h-[2.75rem] w-full py-2.5 px-4 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-mono font-bold text-xs flex items-center justify-center gap-2 instrument-transition cursor-pointer"
                      >
                        <Activity className="w-4 h-4 shrink-0" />
                        <span>{lang === 'es' ? 'Abrir Banco RK4' : 'Open RK4 Bench'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedObjectivesModule('mechanics')}
                        className="min-h-[2.75rem] w-full py-2.5 px-4 rounded-lg bg-[#07090E] hover:bg-slate-900 border border-slate-700 text-slate-200 font-mono text-xs flex items-center justify-center gap-1.5 instrument-transition cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>{translations.card1ObjectivesBtn}</span>
                      </button>
                    </div>
                  </article>
                </ScrollReveal>
              )}

              {(categoryFilter === 'all' || categoryFilter === 'kinematics') && (
                <ScrollReveal className="h-full flex">
                  <article
                    data-testid="hub-card-kinematics"
                    className="w-full rounded-xl workbench-panel-interactive flex flex-col justify-between overflow-hidden"
                  >
                    <div>
                      <div
                        onClick={() => selectModuleView('kinematics')}
                        className="relative aspect-[21/9] schematic-grid-bg border-b border-slate-800 flex items-center justify-center cursor-pointer group overflow-hidden"
                      >
                        <svg viewBox="0 0 420 160" className="w-full h-full px-6 py-3">
                          <line x1="36" y1="118" x2="368" y2="118" stroke="#475569" strokeWidth="2" />
                          <rect
                            x="46"
                            y="82"
                            width="26"
                            height="36"
                            rx="3"
                            fill="#0F172A"
                            stroke="#38BDF8"
                            strokeWidth="1.75"
                          />
                          <path
                            d="M 68 80 Q 204 8 338 118"
                            fill="none"
                            stroke="#22D3EE"
                            strokeWidth="2.25"
                          />
                          <path
                            d="M 68 80 Q 168 32 254 118"
                            fill="none"
                            stroke="#F59E0B"
                            strokeWidth="2.25"
                            strokeDasharray="6 4"
                          />
                          <circle cx="204" cy="44" r="6" fill="#10B981" />
                          <circle cx="254" cy="118" r="6" fill="#F59E0B" />
                          <circle cx="338" cy="118" r="6" fill="#EF4444" />
                          <text x="216" y="42" fill="#6EE7B7" fontSize="10" fontFamily="JetBrains Mono, monospace">
                            y_max (v_y=0)
                          </text>
                          <text x="150" y="96" fill="#FDE68A" fontSize="10" fontFamily="JetBrains Mono, monospace">
                            Con arrastre ρ
                          </text>
                        </svg>
                        <div className="absolute top-2.5 left-3.5 font-mono text-[11px] text-cyan-300 bg-[#070A12]/90 px-2.5 py-0.5 rounded border border-slate-800">
                          F_d = -½ρ·C_d·A·|v_rel|·v_rel
                        </div>
                        <div className="absolute bottom-2.5 right-3.5 font-mono text-[11px] text-slate-300 bg-[#070A12]/90 px-2.5 py-0.5 rounded border border-slate-800">
                          v_t = √(2mg / ρ·C_d·A) · (g, ρ) Libre
                        </div>
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 instrument-transition flex items-center justify-center">
                          <span className="px-4 py-2 rounded-lg bg-cyan-400 text-slate-950 font-mono font-bold text-xs flex items-center gap-1.5">
                            <Play className="w-3.5 h-3.5 fill-current" />
                            {lang === 'es' ? 'Iniciar Laboratorio' : 'Start Laboratory'}
                          </span>
                        </div>
                      </div>

                      <div className="fluid-section-pad space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                          <span className="text-cyan-300 font-semibold">
                            {lang === 'es' ? '04. Cinemática y Aerodinámica 2D' : '04. 2D Kinematics & Aerodynamics'}
                          </span>
                          <span className="text-slate-300">
                            {lang === 'es' ? 'Balística RK4 · Entornos Exóticos (g, ρ)' : 'RK4 Ballistics · Exotic Environments (g, ρ)'}
                          </span>
                        </div>
                        <h2 className="fluid-title-md font-bold text-white">
                          {lang === 'es'
                            ? 'Laboratorio de Cinemática: Lanzamiento de Proyectiles & Aerodinámica'
                            : 'Kinematics Lab: Projectile Launch & Aerodynamics'}
                        </h2>
                        <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed">
                          {lang === 'es'
                            ? 'Cañón neumático sobre plataforma hidráulica (0–30 m) con integración RK4 de resistencia cuadrática de Rayleigh, calibración manual de gravedad (g) y densidad (ρ), cámara de vacío de Galileo y 8 proyectiles.'
                            : 'Pneumatic cannon on a hydraulic platform (0–30 m) with RK4 quadratic Rayleigh drag, manual gravity (g) and air density (ρ) calibration, Galileo vacuum chamber, and 8 payloads.'}
                        </p>
                        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-mono text-slate-300">
                          <span>Arrastre Rayleigh</span>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span>Cámara de Vacío</span>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span>8 Proyectiles</span>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span className="text-cyan-300">Parámetros (g, ρ) Manuales</span>
                        </div>
                      </div>
                    </div>

                    <div className="fluid-section-pad pt-0 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        data-testid="start-kinematics-lab-btn"
                        onClick={() => selectModuleView('kinematics')}
                        className="min-h-[2.75rem] w-full py-2.5 px-4 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-mono font-bold text-xs flex items-center justify-center gap-2 instrument-transition cursor-pointer"
                      >
                        <Crosshair className="w-4 h-4 shrink-0" />
                        <span>{lang === 'es' ? 'Iniciar Laboratorio' : 'Start Laboratory'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedObjectivesModule('kinematics')}
                        className="min-h-[2.75rem] w-full py-2.5 px-4 rounded-lg bg-[#07090E] hover:bg-slate-900 border border-slate-700 text-slate-200 font-mono text-xs flex items-center justify-center gap-1.5 instrument-transition cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>{translations.card1ObjectivesBtn}</span>
                      </button>
                    </div>
                  </article>
                </ScrollReveal>
              )}
            </section>

            <section
              id="ecuaciones-referencia"
              className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch"
            >
              <div className="rounded-xl workbench-panel fluid-section-pad flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-300">
                    <span className="text-cyan-300 font-semibold">
                      {lang === 'es' ? 'Referencia Físico-Matemática' : 'Mathematical Physics Reference'}
                    </span>
                    <span>Kirchhoff · Verlet · RK4</span>
                  </div>
                  <h2 className="fluid-title-md font-bold text-white">
                    {lang === 'es'
                      ? 'Formulaciones Diferenciales y Leyes de Conservación'
                      : 'Differential Formulations & Conservation Laws'}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed">
                    {lang === 'es'
                      ? 'Consulta las ecuaciones exactas evaluadas en cada paso de integración de 16.67 ms: análisis nodal matricial, invariantes orbitales de Kepler-Newton y coeficientes aerodinámicos de Rayleigh.'
                      : 'Inspect the exact equations evaluated on every 16.67 ms integration step: nodal matrix analysis, Kepler-Newton orbital invariants, and Rayleigh aerodynamic drag coefficients.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs font-mono bg-[#070A12] p-3 rounded-lg border border-slate-800/90">
                  <div className="space-y-0.5">
                    <div className="text-slate-300">Electrodinámica DC</div>
                    <div className="text-cyan-300 font-semibold">∑ I_k = 0 · P = I²·R</div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-slate-300">Balística &amp; Arrastre</div>
                    <div className="text-amber-300 font-semibold">m·a = m·g - ½ρC_dA|v|v</div>
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => setIsTheoryModalOpen(true)}
                    className="min-h-[2.75rem] inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/90 hover:bg-cyan-400 hover:text-slate-950 border border-slate-700 hover:border-cyan-400 text-slate-100 font-mono font-semibold text-xs instrument-transition cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4 text-cyan-400" />
                    <span>{lang === 'es' ? 'Abrir Formulario Completo' : 'Open Complete Formulary'}</span>
                  </button>
                </div>
              </div>

              <div className="rounded-xl workbench-panel fluid-section-pad flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-300">
                    <span className="text-amber-300 font-semibold">
                      {lang === 'es' ? 'Instrumentación Pasiva' : 'Passive Instrumentation'}
                    </span>
                    <span>IEC 60062 · EIA-RS-279</span>
                  </div>
                  <h2 className="fluid-title-md font-bold text-white">
                    {lang === 'es'
                      ? 'Decodificador de Resistores de 4 y 5 Bandas con Inyección Directa'
                      : '4- and 5-Band Resistor Decoder with Direct Workbench Injection'}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed">
                    {lang === 'es'
                      ? 'Calcula el valor óhmico nominal, el multiplicador decimal y el rango de tolerancia (±1% a ±10%), y transfiere el componente directamente hacia las ramas R₁, R₂ o R₃ del banco DC.'
                      : 'Compute nominal ohmic resistance, decimal multiplier, and tolerance bounds (±1% to ±10%), and transfer the component directly into branches R₁, R₂, or R₃ of the DC workbench.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 bg-[#070A12] p-3 rounded-lg border border-slate-800/90 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-3 h-4 rounded-xs bg-amber-700 border border-slate-600" title="Marrón (1)" />
                    <span className="inline-block w-3 h-4 rounded-xs bg-neutral-900 border border-slate-500" title="Negro (0)" />
                    <span className="inline-block w-3 h-4 rounded-xs bg-red-600 border border-slate-600" title="Rojo (×100)" />
                    <span className="inline-block w-3 h-4 rounded-xs bg-yellow-500 border border-slate-600" title="Oro (±5%)" />
                    <span className="text-white font-semibold ml-1">1.0 kΩ ±5%</span>
                  </div>
                  <span className="text-slate-300">Rango: 950 Ω – 1,050 Ω</span>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => setIsColorCodeModalOpen(true)}
                    className="min-h-[2.75rem] inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/90 hover:bg-cyan-400 hover:text-slate-950 border border-slate-700 hover:border-cyan-400 text-slate-100 font-mono font-semibold text-xs instrument-transition cursor-pointer"
                  >
                    <Sliders className="w-4 h-4 text-amber-400" />
                    <span>{lang === 'es' ? 'Abrir Decodificador IEC 60062' : 'Open IEC 60062 Decoder'}</span>
                  </button>
                </div>
              </div>
            </section>

            <HubQRCodeBanner lang={lang} onOpenModal={() => setIsQRModalOpen(true)} />
          </div>
        )}

        {activeView === 'circuits' && (
          <CircuitLabView
            lang={lang}
            onUpdateTelemetry={setActiveTelemetry}
            completedChallenges={completedChallenges}
            onCompleteChallenge={registerCompletedChallenge}
            externalResistorSync={externalResistorSync}
          />
        )}

        {activeView === 'space' && (
          <SpaceLabView
            lang={lang}
            onUpdateTelemetry={setActiveTelemetry}
            completedChallenges={completedChallenges}
            onCompleteChallenge={registerCompletedChallenge}
          />
        )}

        {activeView === 'mechanics' && (
          <MechanicsLabView
            lang={lang}
            onUpdateTelemetry={setActiveTelemetry}
            completedChallenges={completedChallenges}
            onCompleteChallenge={registerCompletedChallenge}
          />
        )}

        {activeView === 'kinematics' && (
          <KinematicsLabView
            lang={lang}
            onUpdateTelemetry={setActiveTelemetry}
            completedChallenges={completedChallenges}
            onCompleteChallenge={registerCompletedChallenge}
          />
        )}
      </main>

      {selectedObjectivesModule && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-[32rem] rounded-xl bg-[#0B101B] border border-slate-700 fluid-section-pad shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-cyan-400 shrink-0" />
                <h3 className="fluid-title-md font-bold text-white">
                  {selectedObjectivesModule === 'circuits'
                    ? translations.card1ObjectivesTitle
                    : selectedObjectivesModule === 'space'
                    ? translations.card2ObjectivesTitle
                    : selectedObjectivesModule === 'kinematics'
                    ? lang === 'es'
                      ? 'Objetivos Técnicos — Cinemática y Balística 2D'
                      : 'Technical Objectives — 2D Kinematics & Ballistics'
                    : lang === 'es'
                    ? 'Objetivos Técnicos — Oscilaciones y Ondas RK4'
                    : 'Technical Objectives — RK4 Oscillations & Waves'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedObjectivesModule(null)}
                aria-label="Cerrar"
                className="touch-target rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ul className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
              {(selectedObjectivesModule === 'circuits'
                ? translations.card1ObjectivesList
                : selectedObjectivesModule === 'space'
                ? translations.card2ObjectivesList
                : selectedObjectivesModule === 'kinematics'
                ? [
                    'Comprobar el principio de equivalencia de Galileo en cámara de vacío (ρ = 0) comparando cuerpos desde 5 g hasta 400 kg.',
                    'Analizar la desviación de la parábola ideal bajo arrastre cuadrático de Rayleigh F_d = -½ρ·Cd·A·|v_rel|·v_rel y viento.',
                    'Inspeccionar la transformación entre energía cinética Ec, potencial Ep y disipación térmica con la Sonda de Telemetría.',
                    'Resolver retos de artillería balística calculando ángulo θ, altura inicial h₀ y velocidad v₀ para impactar la diana.',
                  ]
                : [
                    'Verificar el período del péndulo T = 2π √(L / g) bajo aceleraciones gravitatorias de la Luna, Marte, Tierra y Júpiter.',
                    'Monitorear la conservación de energía mecánica E = K + U con paso de integración Runge-Kutta de 4to orden.',
                    'Medir la transferencia periódica de amplitud en osciladores acoplados por resorte transversal.',
                    'Inspeccionar frentes de onda esféricos e interferencia en mallas tridimensionales.',
                  ]
              ).map((objectiveDescription, objectiveIndex) => (
                <li key={objectiveIndex} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>{objectiveDescription}</span>
                </li>
              ))}
            </ul>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const targetModule = selectedObjectivesModule;
                  setSelectedObjectivesModule(null);
                  if (targetModule) selectModuleView(targetModule);
                }}
                className="min-h-[2.75rem] px-4 py-2 rounded-lg bg-cyan-400 text-slate-950 font-mono font-bold text-xs hover:bg-cyan-300 instrument-transition cursor-pointer"
              >
                {lang === 'es' ? 'Abrir Módulo' : 'Open Module'}
              </button>
            </div>
          </div>
        </div>
      )}

      <TheoryModal
        isOpen={isTheoryModalOpen}
        onClose={() => setIsTheoryModalOpen(false)}
        lang={lang}
      />

      <ColorCodeModal
        isOpen={isColorCodeModalOpen}
        onClose={() => setIsColorCodeModalOpen(false)}
        lang={lang}
        onApplyToResistor={(target, ohms) => {
          setExternalResistorSync({ target, ohms, token: Date.now() });
          selectModuleView('circuits');
        }}
      />

      <LabQRCodeModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        lang={lang}
      />

      <nav
        aria-label="Barra inferior de acceso rápido móvil"
        data-testid="mobile-bottom-nav"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#07090E]/95 border-t border-slate-800 px-2 py-1 grid grid-cols-5 gap-1 no-print"
      >
        <button
          type="button"
          onClick={() => selectModuleView('hub')}
          className={`min-h-[2.75rem] rounded-lg flex flex-col items-center justify-center gap-0.5 text-[10px] font-mono instrument-transition cursor-pointer ${
            activeView === 'hub'
              ? 'text-cyan-300 bg-slate-900 font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Atom className="w-4 h-4 shrink-0" />
          <span className="truncate max-w-full">Índice</span>
        </button>
        <button
          type="button"
          onClick={() => selectModuleView('circuits')}
          className={`min-h-[2.75rem] rounded-lg flex flex-col items-center justify-center gap-0.5 text-[10px] font-mono instrument-transition cursor-pointer ${
            activeView === 'circuits'
              ? 'text-cyan-300 bg-slate-900 font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Zap className="w-4 h-4 shrink-0" />
          <span className="truncate max-w-full">Circuitos</span>
        </button>
        <button
          type="button"
          onClick={() => selectModuleView('space')}
          className={`min-h-[2.75rem] rounded-lg flex flex-col items-center justify-center gap-0.5 text-[10px] font-mono instrument-transition cursor-pointer ${
            activeView === 'space'
              ? 'text-cyan-300 bg-slate-900 font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Orbit className="w-4 h-4 shrink-0" />
          <span className="truncate max-w-full">Órbitas</span>
        </button>
        <button
          type="button"
          onClick={() => selectModuleView('mechanics')}
          className={`min-h-[2.75rem] rounded-lg flex flex-col items-center justify-center gap-0.5 text-[10px] font-mono instrument-transition cursor-pointer ${
            activeView === 'mechanics'
              ? 'text-cyan-300 bg-slate-900 font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4 shrink-0" />
          <span className="truncate max-w-full">Péndulos</span>
        </button>
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen((previous) => !previous)}
          className={`min-h-[2.75rem] rounded-lg flex flex-col items-center justify-center gap-0.5 text-[10px] font-mono instrument-transition cursor-pointer ${
            isMobileMenuOpen
              ? 'text-cyan-300 bg-slate-900 font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Menu className="w-4 h-4 shrink-0" />
          <span className="truncate max-w-full">Menú</span>
        </button>
      </nav>

      <footer className="mt-12 border-t border-slate-800/80 bg-[#05070C] py-5 text-xs text-slate-400 no-print">
        <div className="fluid-container flex flex-wrap items-center justify-between gap-4 font-mono">
          <div>
            <span className="text-slate-200 font-semibold">LabFísica Avanzada</span>
            <span aria-hidden="true" className="mx-2 text-slate-600">
              |
            </span>
            <span>Juan David González Alarcón</span>
          </div>
          <a
            href="https://github.com/PANELITA29/Laboratorio-Fisica-Avanzada"
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[2.75rem] inline-flex items-center text-slate-300 hover:text-cyan-400 instrument-transition"
          >
            GitHub · PANELITA29/Laboratorio-Fisica-Avanzada
          </a>
        </div>
      </footer>
    </div>
  );
}
