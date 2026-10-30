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
  Play,
  BookOpen,
  Award,
  CheckCircle2,
  QrCode,
  Menu,
  X,
  Sliders,
  Crosshair,
  Layers,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  FlaskConical,
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
import CardSwap, { Card, CardSwapRef } from './components/CardSwap';
import DotField from './components/DotField';
import ShapeGrid from './components/ShapeGrid';
import { LabCoverBadge, LAB_THEMES, LabId } from './components/LabCoverIcons';
import { CircuitLabView } from './labs/circuitos/CircuitLabView';
import { SpaceLabView } from './labs/espacio-3d/SpaceLabView';
import { MechanicsLabView } from './labs/mecanica-3d/MechanicsLabView';
import { KinematicsLabView } from './labs/cinematica/KinematicsLabView';
import { ChemistryLabView } from './labs/quimica-3d/ChemistryLabView';
import {
  useLabGlobalStore,
  ActiveModuleView,
} from './store/useLabGlobalStore';

export default function App() {
  const lang = useLabGlobalStore((s) => s.lang);
  const setLang = useLabGlobalStore((s) => s.setLang);
  const activeView = useLabGlobalStore((s) => s.activeView);
  const setActiveView = useLabGlobalStore((s) => s.setActiveView);
  const categoryFilter = useLabGlobalStore((s) => s.categoryFilter);
  const setCategoryFilter = useLabGlobalStore((s) => s.setCategoryFilter);
  const isAudioMuted = useLabGlobalStore((s) => s.isAudioMuted);
  const setIsAudioMuted = useLabGlobalStore((s) => s.setIsAudioMuted);
  const labDisplayMode = useLabGlobalStore((s) => s.labDisplayMode);
  const setLabDisplayMode = useLabGlobalStore((s) => s.setLabDisplayMode);
  const externalResistorSync = useLabGlobalStore((s) => s.externalResistorSync);
  const setExternalResistorSync = useLabGlobalStore((s) => s.setExternalResistorSync);
  const completedChallenges = useLabGlobalStore((s) => s.completedChallenges);
  const totalScore = useLabGlobalStore((s) => s.totalScore);
  const registerCompletedChallenge = useLabGlobalStore((s) => s.registerCompletedChallenge);
  const setActiveTelemetry = useLabGlobalStore((s) => s.setActiveTelemetry);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState<boolean>(false);
  const [isNetworkOnline, setIsNetworkOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isTheoryModalOpen, setIsTheoryModalOpen] = useState<boolean>(false);
  const [isColorCodeModalOpen, setIsColorCodeModalOpen] = useState<boolean>(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState<boolean>(false);
  const [selectedObjectivesModule, setSelectedObjectivesModule] = useState<
    'circuits' | 'space' | 'mechanics' | 'kinematics' | 'chemistry' | null
  >(null);
  const [currentFrontLabIndex, setCurrentFrontLabIndex] = useState<number>(0);
  const cardSwapRef = useRef<CardSwapRef | null>(null);

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

  const verifiedChallengesCount = Object.keys(completedChallenges).length;

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#07090E] text-slate-100 flex flex-col pb-16 md:pb-0 relative">
      {/* Fondo interactivo estelar WebGL2 DotField de pantalla completa en el Menú Principal */}
      {activeView === 'hub' && (
        <div
          className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
          aria-hidden="true"
        >
          <DotField
            gradientFrom="#0135ff"
            gradientTo="#3ac1ff"
            dotRadius={1}
            dotSpacing={22}
            mobileDotSpacing={32}
            cursorRadius={140}
            bulgeStrength={-0.6}
            glowRadius={36}
            pattern="scatter"
            glowColor="#00ff0b"
            gradientAngle={147}
            twist={0}
            glowIntensity={0.8}
            baseOpacity={0.42}
            waveAmplitude={0}
            speed={0.85}
            sparkle
            interactive
            holdToZoom
            intro
            lightMode={false}
            maxDevicePixelRatio={1.5}
            mobileMaxRatio={1.0}
            maxDots={25000}
            adaptivePerformance={true}
          />
        </div>
      )}

      {/* Fondo interactivo matricial ShapeGrid en todos los Laboratorios */}
      {activeView !== 'hub' && (
        <div
          className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-35"
          aria-hidden="true"
        >
          <ShapeGrid
            shape="square"
            direction="diagonal"
            lineColor="#00dfff"
            hoverColor="#75ff4f"
            hoverFillColor="#ffc300"
            fillOpacity={0.15}
            cellSize={40}
            mobileCellSize={50}
            speed={0.5}
            tiltX={0}
            tiltY={0}
            rainbow={false}
            lineWidth={1}
            radius={1.5}
            trail={0.6}
            glow={0.35}
            twinkle={0}
            fade={1}
            clickCascade
            intro
            mobileDpr={1.0}
          />
        </div>
      )}

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
              data-testid="nav-tab-chemistry"
              onClick={() => selectModuleView('chemistry')}
              className={`min-h-[2.75rem] px-3 rounded-lg instrument-transition whitespace-nowrap shrink-0 cursor-pointer flex items-center ${
                activeView === 'chemistry'
                  ? 'text-cyan-300 font-semibold bg-slate-900 border border-slate-700'
                  : 'hover:text-white'
              }`}
            >
              Química 3D
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
                onClick={() => selectModuleView('chemistry')}
                className={`min-h-[2.75rem] px-3.5 py-2.5 rounded-lg text-left text-xs font-semibold flex items-center justify-between instrument-transition cursor-pointer ${
                  activeView === 'chemistry'
                    ? 'bg-slate-900 text-cyan-300 border border-cyan-500/50'
                    : 'bg-[#0C111D] text-slate-200 border border-slate-800'
                }`}
              >
                <span>Química Computacional 3D</span>
                <span className="text-[10px] font-mono text-slate-400">MOD-05</span>
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
                      {totalScore} PTS ({verifiedChallengesCount}/9 retos)
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
        className={`flex-1 fluid-container relative z-10 ${
          activeView === 'hub' ? 'py-[var(--fluid-pad-y)]' : 'py-2.5 sm:py-3'
        }`}
      >
        {activeView === 'hub' && (
          <div id="portal-hub-view" className="space-y-8 sm:space-y-10">
            <section className="max-w-4xl mx-auto flex flex-col items-center text-center space-y-6 pt-3 sm:pt-6 pb-2">
              <div className="space-y-4 flex flex-col items-center w-full">
                <div className="inline-flex flex-wrap items-center justify-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-cyan-500/30 text-xs font-mono text-slate-300 shadow-[0_0_20px_rgba(6,182,212,0.15)] backdrop-blur-md">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]"></span>
                  <span className="text-cyan-300 font-semibold tracking-wide">
                    {lang === 'es' ? 'Suite de Instrumentación Numérica' : 'Numerical Instrumentation Suite'}
                  </span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="text-slate-300">WebGL2 &amp; Canvas 2D</span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="text-cyan-400 font-semibold">Δt = 16.67 ms</span>
                </div>

                <h1 className="font-['Outfit'] font-black tracking-tight text-center mx-auto max-w-4xl">
                  <span className="block text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-400 leading-[1.12] pb-1">
                    {translations.heroTitleLine1}
                  </span>
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-slate-300 font-semibold mt-2 sm:mt-3 text-lg sm:text-xl md:text-2xl lg:text-3xl tracking-tight leading-snug">
                    {translations.heroTitleLine2}
                  </span>
                </h1>

                <p className="text-xs sm:text-sm md:text-base text-slate-300 leading-relaxed max-w-2xl mx-auto font-normal text-center">
                  {translations.heroDescription}
                </p>
              </div>

              <div className="pt-1 flex flex-col items-center space-y-2.5 w-full">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-400 text-center">
                  {lang === 'es' ? 'Filtrar bancos de prueba por dominio físico:' : 'Filter testbenches by physical domain:'}
                </div>
                <div
                  role="group"
                  aria-label={lang === 'es' ? 'Filtro de módulos de laboratorio' : 'Laboratory module filter'}
                  className="flex flex-wrap items-center justify-center gap-1.5 p-1.5 rounded-xl bg-[#0B101B]/95 border border-slate-800/90 shadow-xl backdrop-blur-md max-w-full"
                >
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('all')}
                    className={`min-h-[2.375rem] px-3.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold whitespace-nowrap instrument-transition cursor-pointer ${
                      categoryFilter === 'all'
                        ? 'bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    {translations.filterAll}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('circuits')}
                    className={`min-h-[2.375rem] px-3.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold whitespace-nowrap instrument-transition cursor-pointer ${
                      categoryFilter === 'circuits'
                        ? 'bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    {lang === 'es' ? 'Circuitos DC' : 'DC Circuits'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('space')}
                    className={`min-h-[2.375rem] px-3.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold whitespace-nowrap instrument-transition cursor-pointer ${
                      categoryFilter === 'space'
                        ? 'bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    {lang === 'es' ? 'Gravitación 3D' : '3D Gravitation'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('mechanics')}
                    className={`min-h-[2.375rem] px-3.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold whitespace-nowrap instrument-transition cursor-pointer ${
                      categoryFilter === 'mechanics'
                        ? 'bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    {lang === 'es' ? 'Oscilaciones RK4' : 'RK4 Oscillations'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('kinematics')}
                    className={`min-h-[2.375rem] px-3.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold whitespace-nowrap instrument-transition cursor-pointer ${
                      categoryFilter === 'kinematics'
                        ? 'bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    {lang === 'es' ? 'Cinemática 2D' : '2D Kinematics'}
                  </button>
                  <button
                    type="button"
                    data-testid="filter-chemistry"
                    onClick={() => setCategoryFilter('chemistry')}
                    className={`min-h-[2.375rem] px-3.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold whitespace-nowrap instrument-transition cursor-pointer ${
                      categoryFilter === 'chemistry'
                        ? 'bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    {lang === 'es' ? 'Química 3D' : '3D Chemistry'}
                  </button>
                </div>
              </div>
            </section>

            {(() => {
              const labModules = [
                {
                  id: 'circuits' as const,
                  code: 'MOD-01',
                  number: '01',
                  title: lang === 'es' ? 'Electrodinámica y Redes DC' : 'DC Electrodynamics & Networks',
                  subtitle: lang === 'es' ? 'Solver Nodal Matricial · Sandbox Libre' : 'Nodal Matrix Solver · Free Sandbox',
                  solver: 'Gauss-Seidel / Kirchhoff Nodal',
                  category: 'circuits' as const,
                  icon: Zap,
                  accentColor: '#22d3ee',
                  equationsHeader: 'V_F = I_T · (R₁ + R₂∥R₃)',
                  equationsFooter: 'LCK: ∑I = 0 · LVK: ∑ΔV = 0',
                  description: translations.card1Desc,
                  badges: translations.card1Badges,
                  extraBadge: lang === 'es' ? 'Taller Libre de Nodos' : 'Free Node Workshop',
                  playBtnText: translations.card1PlayBtn,
                  objectivesBtnText: translations.card1ObjectivesBtn,
                  svgRender: (
                    <svg viewBox="0 0 420 160" className="w-full h-full px-4 py-2">
                      <defs>
                        <linearGradient id="circ-line-grad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#22d3ee" />
                          <stop offset="100%" stopColor="#38bdf8" />
                        </linearGradient>
                        <filter id="c-glow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="2" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      <rect x="10" y="10" width="400" height="140" rx="10" fill="#070c18" stroke="#1e293b" strokeWidth="1" />
                      <path d="M 50 80 H 110 M 170 80 H 230 M 230 40 V 120 M 230 40 H 330 M 230 120 H 330 M 330 40 V 120" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
                      <path d="M 50 80 H 110 M 170 80 H 230" stroke="url(#circ-line-grad)" strokeWidth="1.8" strokeLinecap="round" />
                      <circle cx="50" cy="80" r="16" fill="#0f172a" stroke="#22d3ee" strokeWidth="2" filter="url(#c-glow)" />
                      <text x="44" y="76" fill="#67e8f9" fontSize="12" fontWeight="bold" fontFamily="monospace">+</text>
                      <text x="46" y="90" fill="#94a3b8" fontSize="11" fontFamily="monospace">-</text>
                      <text x="32" y="112" fill="#22d3ee" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="bold">V_F = 12V</text>
                      <rect x="110" y="68" width="60" height="24" rx="4" fill="#0f172a" stroke="#22d3ee" strokeWidth="1.8" />
                      <rect x="120" y="69" width="6" height="22" rx="1" fill="#ef4444" />
                      <rect x="132" y="69" width="6" height="22" rx="1" fill="#a855f7" />
                      <rect x="144" y="69" width="6" height="22" rx="1" fill="#f59e0b" />
                      <rect x="156" y="69" width="6" height="22" rx="1" fill="#eab308" />
                      <text x="124" y="58" fill="#e2e8f0" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="bold">R₁ (27kΩ)</text>
                      <circle cx="230" cy="40" r="4.5" fill="#22d3ee" filter="url(#c-glow)" />
                      <circle cx="230" cy="80" r="3.5" fill="#38bdf8" />
                      <circle cx="230" cy="120" r="4.5" fill="#22d3ee" filter="url(#c-glow)" />
                      <circle cx="330" cy="80" r="4" fill="#38bdf8" />
                      <text x="206" y="36" fill="#67e8f9" fontSize="10" fontFamily="JetBrains Mono, monospace">V_A</text>
                      <rect x="256" y="28" width="48" height="24" rx="4" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.8" />
                      <text x="272" y="44" fill="#cbd5e1" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="bold">R₂</text>
                      <rect x="256" y="108" width="48" height="24" rx="4" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.8" />
                      <text x="272" y="124" fill="#cbd5e1" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="bold">R₃</text>
                      <circle cx="370" cy="80" r="18" fill="#0f172a" stroke="#f59e0b" strokeWidth="2" filter="url(#c-glow)" />
                      <text x="362" y="78" fill="#fde68a" fontSize="11" fontWeight="bold" fontFamily="monospace">P_L</text>
                      <text x="355" y="90" fill="#f59e0b" fontSize="8" fontFamily="monospace">≤15W</text>
                      <path d="M 85 74 L 95 80 L 85 86" fill="#22d3ee" />
                      <text x="82" y="68" fill="#22d3ee" fontSize="9" fontFamily="JetBrains Mono, monospace">I_T</text>
                    </svg>
                  )
                },
                {
                  id: 'space' as const,
                  code: 'MOD-02',
                  number: '02',
                  title: translations.card2Title,
                  subtitle: lang === 'es' ? 'Integrador Simpléctico Velocity Verlet' : 'Symplectic Velocity Verlet Integrator',
                  solver: 'Velocity Verlet Simpléctico',
                  category: 'space' as const,
                  icon: Orbit,
                  accentColor: '#38bdf8',
                  equationsHeader: 'F_g = G·M·m / r² · T² ∝ a³',
                  equationsFooter: 'v_e = √(2GM/r) · Hohmann Δv',
                  description: translations.card2Desc,
                  badges: translations.card2Badges,
                  extraBadge: lang === 'es' ? 'Transferencia de Hohmann' : 'Hohmann Transfer',
                  playBtnText: translations.card2PlayBtn,
                  objectivesBtnText: translations.card2ObjectivesBtn,
                  svgRender: (
                    <svg viewBox="0 0 420 160" className="w-full h-full px-4 py-2">
                      <defs>
                        <radialGradient id="sun-rad" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="#fef08a" />
                          <stop offset="40%" stopColor="#f59e0b" />
                          <stop offset="100%" stopColor="#ea580c" stopOpacity="0.1" />
                        </radialGradient>
                        <filter id="sp-glow" x="-30%" y="-30%" width="160%" height="160%">
                          <feGaussianBlur stdDeviation="3" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      <rect x="10" y="10" width="400" height="140" rx="10" fill="#060914" stroke="#1e293b" strokeWidth="1" />
                      <ellipse cx="160" cy="80" rx="140" ry="50" fill="none" stroke="#1e293b" strokeWidth="1" />
                      <ellipse cx="160" cy="80" rx="110" ry="38" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
                      <ellipse
                        cx="185"
                        cy="80"
                        rx="135"
                        ry="48"
                        transform="rotate(-8 185 80)"
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="1.8"
                        strokeDasharray="6 4"
                      />
                      <ellipse
                        cx="160"
                        cy="80"
                        rx="75"
                        ry="28"
                        transform="rotate(-8 160 80)"
                        fill="none"
                        stroke="#818cf8"
                        strokeWidth="1.5"
                      />
                      <circle cx="160" cy="80" r="28" fill="url(#sun-rad)" opacity="0.4" />
                      <circle cx="160" cy="80" r="18" fill="#f59e0b" filter="url(#sp-glow)" />
                      <circle cx="160" cy="80" r="7" fill="#fef08a" />
                      <text x="148" y="115" fill="#fde68a" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="bold">M_central</text>
                      <circle cx="285" cy="62" r="7" fill="#38bdf8" filter="url(#sp-glow)" />
                      <circle cx="285" cy="62" r="2.5" fill="#ffffff" />
                      <line x1="285" y1="62" x2="310" y2="35" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" />
                      <polygon points="310,35 302,42 308,46" fill="#10b981" />
                      <text x="316" y="42" fill="#6ee7b7" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="bold">v_t (Verlet)</text>
                      <line x1="285" y1="62" x2="238" y2="70" stroke="#f43f5e" strokeWidth="2.2" strokeLinecap="round" />
                      <polygon points="238,70 248,66 247,73" fill="#f43f5e" />
                      <text x="235" y="60" fill="#fda4af" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="bold">F_g = GMm/r²</text>
                      <circle cx="65" cy="95" r="9" fill="#a855f7" stroke="#c084fc" strokeWidth="1.5" />
                      <text x="45" y="118" fill="#c084fc" fontSize="9" fontFamily="JetBrains Mono, monospace">Apocentro</text>
                    </svg>
                  )
                },
                {
                  id: 'mechanics' as const,
                  code: 'MOD-03',
                  number: '03',
                  title: lang === 'es' ? 'Osciladores Acoplados, Péndulo de Huygens y Ondas 3D' : 'Coupled Oscillators, Huygens Pendulum & 3D Waves',
                  subtitle: lang === 'es' ? 'Integrador Runge-Kutta 4to Orden' : '4th-Order Runge-Kutta Integrator',
                  solver: 'Runge-Kutta 4to Orden (RK4)',
                  category: 'mechanics' as const,
                  icon: Activity,
                  accentColor: '#f59e0b',
                  equationsHeader: 'θ̈ + (g/L)sin(θ) = 0 · T = 2π√(L/g)',
                  equationsFooter: 'E_m = K + U = cte',
                  description:
                    lang === 'es'
                      ? 'Integración numérica Runge-Kutta de 4to orden (RK4). Evalúa conservación de energía mecánica E = K + U, transferencia por batimiento armónico, precesión de Foucault e interferencia ondulatoria.'
                      : '4th-order Runge-Kutta (RK4) numerical integration. Evaluates mechanical energy conservation E = K + U, harmonic beat transfer, Foucault precession, and wave interference.',
                  badges: ['Runge-Kutta 4', 'Modos Normales', 'E = K + U'],
                  extraBadge: lang === 'es' ? 'Precesión de Foucault' : 'Foucault Precession',
                  playBtnText: lang === 'es' ? 'Abrir Banco RK4' : 'Open RK4 Bench',
                  objectivesBtnText: translations.card1ObjectivesBtn,
                  svgRender: (
                    <svg viewBox="0 0 420 160" className="w-full h-full px-4 py-2">
                      <defs>
                        <linearGradient id="bob-gold" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#fef08a" />
                          <stop offset="60%" stopColor="#f59e0b" />
                          <stop offset="100%" stopColor="#b45309" />
                        </linearGradient>
                        <filter id="m-glow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="2" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      <rect x="10" y="10" width="400" height="140" rx="10" fill="#090c14" stroke="#1e293b" strokeWidth="1" />
                      <line x1="70" y1="26" x2="350" y2="26" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
                      <circle cx="140" cy="26" r="4" fill="#94a3b8" />
                      <circle cx="280" cy="26" r="4" fill="#94a3b8" />
                      <line x1="140" y1="26" x2="110" y2="108" stroke="#cbd5e1" strokeWidth="1.8" strokeLinecap="round" />
                      <line x1="280" y1="26" x2="310" y2="108" stroke="#cbd5e1" strokeWidth="1.8" strokeLinecap="round" />
                      <path
                        d="M 125 68 L 140 60 L 155 76 L 170 60 L 185 76 L 200 60 L 215 76 L 230 60 L 245 76 L 260 60 L 275 76 L 295 68"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="2.2"
                        strokeLinejoin="round"
                        filter="url(#m-glow)"
                      />
                      <text x="195" y="52" fill="#fde68a" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="bold">k_c · Δx</text>
                      <circle cx="110" cy="108" r="14" fill="url(#bob-gold)" filter="url(#m-glow)" />
                      <circle cx="110" cy="108" r="5" fill="#ffffff" />
                      <circle cx="310" cy="108" r="14" fill="#38bdf8" filter="url(#m-glow)" />
                      <circle cx="310" cy="108" r="5" fill="#f0f9ff" />
                      <text x="96" y="136" fill="#fde68a" fontSize="10" fontFamily="JetBrains Mono, monospace">m₁, θ₁(t)</text>
                      <text x="296" y="136" fill="#7dd3fc" fontSize="10" fontFamily="JetBrains Mono, monospace">m₂, θ₂(t)</text>
                      <path
                        d="M 30 144 Q 70 128 110 144 T 190 144 T 270 144 T 350 144 T 390 144"
                        fill="none"
                        stroke="#fbbf24"
                        strokeWidth="1.6"
                        strokeDasharray="4 2"
                        opacity="0.85"
                      />
                      <text x="325" y="146" fill="#f59e0b" fontSize="9" fontFamily="JetBrains Mono, monospace">RK4 · E=K+U</text>
                    </svg>
                  )
                },
                {
                  id: 'kinematics' as const,
                  code: 'MOD-04',
                  number: '04',
                  title: lang === 'es' ? 'Laboratorio de Cinemática: Lanzamiento de Proyectiles & Aerodinámica' : 'Kinematics Lab: Projectile Launch & Aerodynamics',
                  subtitle: lang === 'es' ? 'Balística RK4 · Entornos Exóticos (g, ρ)' : 'RK4 Ballistics · Exotic Environments (g, ρ)',
                  solver: 'Runge-Kutta 4 (RK4) + Rayleigh',
                  category: 'kinematics' as const,
                  icon: Crosshair,
                  accentColor: '#10b981',
                  equationsHeader: 'F_d = -½ρ·C_d·A·|v_rel|·v_rel',
                  equationsFooter: 'v_t = √(2mg / ρ·C_d·A) · (g, ρ) Libre',
                  description:
                    lang === 'es'
                      ? 'Cañón neumático sobre plataforma hidráulica (0–30 m) con integración RK4 de resistencia cuadrática de Rayleigh, calibración manual de gravedad (g) y densidad (ρ), cámara de vacío de Galileo y 8 proyectiles.'
                      : 'Pneumatic cannon on a hydraulic platform (0–30 m) with RK4 quadratic Rayleigh drag, manual gravity (g) and air density (ρ) calibration, Galileo vacuum chamber, and 8 payloads.',
                  badges: ['Arrastre Rayleigh', 'Cámara de Vacío', '8 Proyectiles'],
                  extraBadge: lang === 'es' ? 'Parámetros (g, ρ) Manuales' : 'Manual (g, ρ) Parameters',
                  playBtnText: lang === 'es' ? 'Iniciar Laboratorio' : 'Start Laboratory',
                  objectivesBtnText: translations.card1ObjectivesBtn,
                  svgRender: (
                    <svg viewBox="0 0 420 160" className="w-full h-full px-4 py-2">
                      <defs>
                        <linearGradient id="kin-grad-line" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#34d399" />
                          <stop offset="100%" stopColor="#059669" />
                        </linearGradient>
                        <filter id="k-glow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="2" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      <rect x="10" y="10" width="400" height="140" rx="10" fill="#070e12" stroke="#1e293b" strokeWidth="1" />
                      <line x1="30" y1="126" x2="390" y2="126" stroke="#334155" strokeWidth="2.5" />
                      <line x1="120" y1="126" x2="120" y2="132" stroke="#475569" strokeWidth="1.5" />
                      <line x1="210" y1="126" x2="210" y2="132" stroke="#475569" strokeWidth="1.5" />
                      <line x1="300" y1="126" x2="300" y2="132" stroke="#475569" strokeWidth="1.5" />
                      <text x="110" y="144" fill="#64748b" fontSize="8" fontFamily="monospace">100m</text>
                      <text x="200" y="144" fill="#64748b" fontSize="8" fontFamily="monospace">200m</text>
                      <text x="290" y="144" fill="#64748b" fontSize="8" fontFamily="monospace">300m</text>
                      <rect x="36" y="86" width="30" height="40" rx="4" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.8" />
                      <line x1="51" y1="92" x2="78" y2="68" stroke="#22d3ee" strokeWidth="5" strokeLinecap="round" />
                      <text x="30" y="80" fill="#38bdf8" fontSize="9" fontFamily="JetBrains Mono, monospace">h₀=15m</text>
                      <path
                        d="M 78 68 Q 230 -10 380 126"
                        fill="none"
                        stroke="#eab308"
                        strokeWidth="1.6"
                        strokeDasharray="5 4"
                        opacity="0.7"
                      />
                      <text x="320" y="55" fill="#fde047" fontSize="9" fontFamily="JetBrains Mono, monospace">Vacío (ρ=0)</text>
                      <path
                        d="M 78 68 Q 185 24 286 126"
                        fill="none"
                        stroke="url(#kin-grad-line)"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        filter="url(#k-glow)"
                      />
                      <circle cx="178" cy="46" r="6" fill="#10b981" filter="url(#k-glow)" />
                      <circle cx="178" cy="46" r="2.5" fill="#ffffff" />
                      <text x="188" y="44" fill="#a7f3d0" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="bold">y_max (v_y=0)</text>
                      <line x1="178" y1="46" x2="214" y2="46" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
                      <polygon points="214,46 206,42 206,50" fill="#38bdf8" />
                      <text x="216" y="43" fill="#7dd3fc" fontSize="9" fontFamily="monospace">v_x</text>
                      <line x1="178" y1="46" x2="152" y2="40" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" />
                      <polygon points="152,40 160,37 160,45" fill="#f43f5e" />
                      <text x="135" y="38" fill="#fda4af" fontSize="9" fontFamily="monospace">F_drag</text>
                      <circle cx="286" cy="126" r="6" fill="#f59e0b" filter="url(#k-glow)" />
                      <text x="264" y="118" fill="#fde68a" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="bold">Impacto (x_f)</text>
                    </svg>
                  )
                },
                {
                  id: 'chemistry' as const,
                  code: 'MOD-05',
                  number: '05',
                  title:
                    lang === 'es'
                      ? 'Laboratorio de Química Computacional 3D: Estequiometría y Gases PV=nRT'
                      : '3D Computational Chemistry Lab: Stoichiometry & PV=nRT Gases',
                  subtitle:
                    lang === 'es'
                      ? 'Reactor Termoquímico ΔH° · Gases Ideales y Van der Waals'
                      : 'ΔH° Thermochemical Reactor · Ideal & Van der Waals Gases',
                  solver: 'Lavoisier + Maxwell-Boltzmann',
                  category: 'chemistry' as const,
                  icon: FlaskConical,
                  accentColor: '#a855f7',
                  equationsHeader: 'P·V = n·R·T · ξ = min(n_i / ν_i)',
                  equationsFooter: 'Q = ξ·|ΔH°| · v_rms = √(3RT / M)',
                  description:
                    lang === 'es'
                      ? 'Reactor de borosilicato 3D con 5 ecuaciones químicas balanceadas, reactivo limitante, indicador universal de pH Yamada, detonaciones exotérmicas y cámara de gases ideales PV=nRT con pistón móvil.'
                      : '3D borosilicate reactor with 5 balanced chemical equations, limiting reactant, Yamada universal pH indicator, exothermic detonations, and PV=nRT ideal gas chamber with movable piston.',
                  badges: ['5 Reacciones Reales', 'Cámara PV=nRT 3D', 'Explosión Térmica'],
                  extraBadge: lang === 'es' ? 'Indicador pH 0–14' : 'pH 0–14 Indicator',
                  playBtnText: lang === 'es' ? 'Iniciar Laboratorio' : 'Start Laboratory',
                  objectivesBtnText: translations.card1ObjectivesBtn,
                  svgRender: (
                    <svg viewBox="0 0 420 160" className="w-full h-full px-4 py-2">
                      <rect x="10" y="10" width="400" height="140" rx="10" fill="#080814" stroke="#1e293b" strokeWidth="1" />
                      {/* Matraz Erlenmeyer izquierdo */}
                      <path
                        d="M 88 38 L 112 38 L 112 62 L 142 122 L 58 122 L 88 62 Z"
                        fill="#1e1b4b"
                        stroke="#a855f7"
                        strokeWidth="2"
                      />
                      <path d="M 66 105 L 134 105 L 140 120 L 60 120 Z" fill="#10b981" opacity="0.85" />
                      <circle cx="92" cy="95" r="3.5" fill="#38bdf8" />
                      <circle cx="108" cy="86" r="4.5" fill="#f472b6" />
                      <circle cx="99" cy="72" r="3" fill="#c084fc" />
                      <text x="58" y="138" fill="#d8b4fe" fontSize="9" fontFamily="monospace">
                        2Na + 2H₂O → 2NaOH + H₂↑
                      </text>
                      {/* Cilindro de gas derecho */}
                      <rect x="245" y="34" width="110" height="88" rx="6" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.8" />
                      <rect x="249" y="48" width="102" height="10" fill="#22d3ee" />
                      <line x1="300" y1="22" x2="300" y2="48" stroke="#94a3b8" strokeWidth="5" />
                      <circle cx="272" cy="78" r="4" fill="#38bdf8" />
                      <circle cx="315" cy="92" r="4.5" fill="#f59e0b" />
                      <circle cx="292" cy="104" r="4" fill="#a855f7" />
                      <circle cx="332" cy="74" r="3.5" fill="#34d399" />
                      <text x="252" y="138" fill="#7dd3fc" fontSize="9" fontFamily="monospace">
                        PV = nRT · v_rms
                      </text>
                    </svg>
                  ),
                }
              ];

              const visibleModules =
                categoryFilter === 'all'
                  ? labModules
                  : labModules.filter((m) => m.category === categoryFilter);

              const activeMod = visibleModules[currentFrontLabIndex % visibleModules.length] || visibleModules[0];

              return (
                <section
                  id="labs-presentation-section"
                  aria-label={lang === 'es' ? 'Bancos de Simulación Interactiva' : 'Interactive Simulation Workbenches'}
                  className="space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-mono text-cyan-300">
                        <Layers className="w-3.5 h-3.5" />
                        <span>
                          {lang === 'es' ? 'Catálogo de Laboratorios Numéricos' : 'Numerical Laboratories Catalog'}
                        </span>
                      </div>
                      <h2 className="fluid-title-md font-bold text-white tracking-tight">
                        {lang === 'es'
                          ? 'Bancos Experimentales de Física Computacional'
                          : 'Computational Physics Experimental Workbenches'}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div
                        role="group"
                        aria-label="Modo de visualización"
                        className="flex items-center p-1 rounded-xl bg-[#0B101B] border border-slate-800 text-xs font-mono"
                      >
                        <button
                          type="button"
                          onClick={() => setLabDisplayMode('swap')}
                          className={`min-h-[2rem] px-3 py-1 rounded-lg flex items-center gap-1.5 instrument-transition cursor-pointer ${
                            labDisplayMode === 'swap'
                              ? 'bg-cyan-400 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>{lang === 'es' ? 'Baraja 3D' : '3D Deck'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setLabDisplayMode('grid')}
                          className={`min-h-[2rem] px-3 py-1 rounded-lg flex items-center gap-1.5 instrument-transition cursor-pointer ${
                            labDisplayMode === 'grid'
                              ? 'bg-cyan-400 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          <LayoutGrid className="w-3.5 h-3.5" />
                          <span>{lang === 'es' ? 'Cuadrícula' : 'Grid'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {labDisplayMode === 'swap' && (
                    <div className="rounded-2xl workbench-panel p-4 sm:p-6 space-y-4 border border-cyan-500/20 bg-gradient-to-b from-[#0C1222]/90 via-[#070A14]/95 to-[#05070E] shadow-2xl overflow-hidden relative">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-950/70 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-semibold">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                            {activeMod ? `${activeMod.code} · ${activeMod.title}` : 'Laboratorio Activo'}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 hidden md:inline">
                            {lang === 'es'
                              ? 'Desliza o lanza las cartas en 3D · Clic en la carta frontal para abrir'
                              : 'Swipe or fling cards in 3D · Click front card to enter'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => cardSwapRef.current?.prev()}
                            aria-label="Carta anterior"
                            className="min-h-[2.25rem] px-3 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1 instrument-transition cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{lang === 'es' ? 'Anterior' : 'Prev'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => cardSwapRef.current?.next()}
                            aria-label="Carta siguiente"
                            className="min-h-[2.25rem] px-3 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1 instrument-transition cursor-pointer"
                          >
                            <span className="hidden sm:inline">{lang === 'es' ? 'Siguiente' : 'Next'}</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div
                        className="relative w-full flex items-center justify-center py-3"
                        style={{ minHeight: '580px', height: '650px' }}
                      >
                        <CardSwap
                          ref={cardSwapRef}
                          width={490}
                          height={485}
                          cardDistance={95}
                          verticalDistance={20}
                          depth={85}
                          skewAmount={0}
                          visibleCards={Math.min(5, visibleModules.length)}
                          delay={4500}
                          speed={1.5}
                          bounce={0.22}
                          parallax={0.5}
                          hoverSpread={0.12}
                          dim={0.5}
                          cardRadius={16}
                          autoplay={true}
                          pauseOnHover={true}
                          draggable={true}
                          theme="science"
                          onCardClick={(index) => {
                            const mod = visibleModules[index];
                            if (mod) selectModuleView(mod.id);
                          }}
                          onChange={(index) => {
                            setCurrentFrontLabIndex(index);
                          }}
                        >
                          {visibleModules.map((mod) => (
                            <Card
                              key={mod.id}
                              className="cursor-pointer group flex flex-col justify-between h-full select-none"
                            >
                              <div className="flex-1 flex flex-col min-h-0">
                                <div className="card-swap-head flex items-center justify-between px-3.5 py-2.5 bg-[#0D1424]/95 border-b border-slate-800 shrink-0">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <LabCoverBadge labId={mod.id} size="sm" isActive={activeMod?.id === mod.id} />
                                    <div className="truncate">
                                      <div className="font-mono text-xs font-bold text-white tracking-wide truncate">
                                        {mod.code} · {mod.title}
                                      </div>
                                      <div className="text-[10px] font-mono text-slate-400 truncate">
                                        {mod.subtitle}
                                      </div>
                                    </div>
                                  </div>
                                  <span className="font-mono text-[10px] text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60 shrink-0">
                                    {mod.solver}
                                  </span>
                                </div>

                                <div className="relative h-40 sm:h-44 w-full schematic-grid-bg border-b border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                                  {mod.svgRender}
                                  <div className="absolute top-2 left-3 font-mono text-[10px] text-cyan-300 bg-[#070A12]/90 px-2 py-0.5 rounded border border-slate-800 shadow-sm">
                                    {mod.equationsHeader}
                                  </div>
                                  <div className="absolute bottom-2 right-3 font-mono text-[10px] text-slate-300 bg-[#070A12]/90 px-2 py-0.5 rounded border border-slate-800 shadow-sm">
                                    {mod.equationsFooter}
                                  </div>
                                </div>

                                <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-center min-h-0">
                                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                                    {mod.description}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-slate-400">
                                    {mod.badges.map((b, i) => (
                                      <span
                                        key={i}
                                        className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 text-slate-300"
                                      >
                                        {b}
                                      </span>
                                    ))}
                                    <span className="px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60 text-cyan-300">
                                      {mod.extraBadge}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="px-3.5 pb-4 pt-1 grid grid-cols-2 gap-2.5 shrink-0 border-t border-slate-800/40 bg-gradient-to-t from-[#080C16] to-transparent">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    selectModuleView(mod.id);
                                  }}
                                  className="min-h-[2.5rem] w-full py-2 px-3 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-mono font-bold text-xs flex items-center justify-center gap-1.5 instrument-transition shadow-md shadow-cyan-500/20 cursor-pointer"
                                >
                                  <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                                  <span className="truncate">{mod.playBtnText}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedObjectivesModule(mod.id);
                                  }}
                                  className="min-h-[2.5rem] w-full py-2 px-2 rounded-lg bg-[#0E1525] hover:bg-slate-800 border border-slate-700 text-slate-200 font-mono text-[11px] sm:text-xs flex items-center justify-center gap-1.5 instrument-transition cursor-pointer"
                                >
                                  <BookOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                  <span className="truncate">{mod.objectivesBtnText}</span>
                                </button>
                              </div>
                            </Card>
                          ))}
                        </CardSwap>
                      </div>
                    </div>
                  )}

                  {labDisplayMode === 'grid' && (
                    <div
                      id="labs-3d-grid"
                      className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch"
                    >
                      {visibleModules.map((mod) => (
                        <ScrollReveal key={mod.id} className="h-full flex">
                          <article
                            data-testid={`hub-card-${mod.id}`}
                            className="w-full rounded-xl workbench-panel-interactive flex flex-col justify-between overflow-hidden"
                          >
                            <div>
                              <div
                                onClick={() => selectModuleView(mod.id)}
                                className="relative aspect-[21/9] schematic-grid-bg border-b border-slate-800 flex items-center justify-center cursor-pointer group overflow-hidden"
                              >
                                {mod.svgRender}
                                <div className="absolute top-2.5 left-3.5 flex items-center gap-2">
                                  <LabCoverBadge labId={mod.id} size="sm" />
                                  <span className="font-mono text-[11px] text-cyan-300 bg-[#070A12]/90 px-2.5 py-0.5 rounded border border-slate-800 backdrop-blur-md">
                                    {mod.equationsHeader}
                                  </span>
                                </div>
                                <div className="absolute bottom-2.5 right-3.5 font-mono text-[11px] text-slate-300 bg-[#070A12]/90 px-2.5 py-0.5 rounded border border-slate-800 backdrop-blur-md">
                                  {mod.equationsFooter}
                                </div>
                                <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 instrument-transition flex items-center justify-center">
                                  <span className="px-4 py-2 rounded-lg bg-cyan-400 text-slate-950 font-mono font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-500/25">
                                    <Play className="w-3.5 h-3.5 fill-current" />
                                    {mod.playBtnText}
                                  </span>
                                </div>
                              </div>

                              <div className="fluid-section-pad space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <LabCoverBadge labId={mod.id} size="sm" />
                                    <span className="text-cyan-300 font-semibold truncate">
                                      {mod.number}. {mod.title}
                                    </span>
                                  </div>
                                  <span className="text-slate-300">{mod.subtitle}</span>
                                </div>
                                <h3 className="fluid-title-md font-bold text-white">{mod.title}</h3>
                                <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed">
                                  {mod.description}
                                </p>
                                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-mono text-slate-300">
                                  {mod.badges.map((badgeText, badgeIndex) => (
                                    <React.Fragment key={badgeIndex}>
                                      {badgeIndex > 0 && (
                                        <span aria-hidden="true" className="text-slate-600">
                                          ·
                                        </span>
                                      )}
                                      <span>{badgeText}</span>
                                    </React.Fragment>
                                  ))}
                                  <span aria-hidden="true" className="text-slate-600">
                                    ·
                                  </span>
                                  <span className="text-cyan-300">{mod.extraBadge}</span>
                                </div>
                              </div>
                            </div>

                            <div className="fluid-section-pad pt-0 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <button
                                type="button"
                                data-testid={`start-${mod.id}-btn`}
                                onClick={() => selectModuleView(mod.id)}
                                className="min-h-[2.75rem] w-full py-2.5 px-4 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-mono font-bold text-xs flex items-center justify-center gap-2 instrument-transition cursor-pointer"
                              >
                                <mod.icon className="w-4 h-4 shrink-0" />
                                <span>{mod.playBtnText}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedObjectivesModule(mod.id)}
                                className="min-h-[2.75rem] w-full py-2.5 px-4 rounded-lg bg-[#07090E] hover:bg-slate-900 border border-slate-700 text-slate-200 font-mono text-xs flex items-center justify-center gap-1.5 instrument-transition cursor-pointer"
                              >
                                <BookOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                <span>{mod.objectivesBtnText}</span>
                              </button>
                            </div>
                          </article>
                        </ScrollReveal>
                      ))}
                    </div>
                  )}
                </section>
              );
            })()}

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

        {activeView === 'chemistry' && (
          <ChemistryLabView
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
                    : selectedObjectivesModule === 'chemistry'
                    ? lang === 'es'
                      ? 'Objetivos Técnicos — Química Computacional 3D y Gases PV=nRT'
                      : 'Technical Objectives — 3D Computational Chemistry & PV=nRT Gases'
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
                : selectedObjectivesModule === 'chemistry'
                ? [
                    'Determinar el reactivo limitante, el reactivo en exceso y el avance molar ξ = min(n_A/ν_A, n_B/ν_B) en 5 reacciones químicas reales.',
                    'Titular ácido fuerte (HCl) y base fuerte (NaOH) hasta alcanzar la neutralización exacta pH = 7.00 con el indicador universal de Yamada.',
                    'Analizar la entalpía exotérmica ΔH°, la reducción catalítica de la energía de activación E_a y la sobrecarga térmica explosiva 3D.',
                    'Experimentar con la ecuación de estado PV = nRT, la corrección real de Van der Waals y la distribución molecular de Maxwell-Boltzmann v_rms.',
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
