/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
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
  X,
} from 'lucide-react';
import { Language, dictionary } from './assets/js/i18n';
import { audioSynth } from './assets/js/audio-synth';
import { TelemetryItem } from './assets/js/report-generator';
import { PWAInstallButton } from './components/PWAInstallButton';
import { TheoryModal } from './components/TheoryModal';
import { ColorCodeModal } from './components/ColorCodeModal';
import { LabQRCodeModal, HubQRCodeBanner } from './components/LabQRCodeModal';
import { ChatbotWidget } from './components/ChatbotWidget';
import { CircuitLabView } from './labs/circuitos/CircuitLabView';
import { SpaceLabView } from './labs/espacio-3d/SpaceLabView';
import { MechanicsLabView } from './labs/mecanica-3d/MechanicsLabView';

type ActiveView = 'hub' | 'circuits' | 'space' | 'mechanics';
type CategoryFilter = 'all' | 'circuits' | 'space' | 'mechanics';

export default function App() {
  const [lang, setLang] = useState<Language>('es');
  const [activeView, setActiveView] = useState<ActiveView>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const lab = params.get('lab');
      if (lab === 'circuits' || lab === 'circuitos') return 'circuits';
      if (lab === 'space' || lab === 'espacio-3d') return 'space';
      if (lab === 'mechanics' || lab === 'mecanica-3d') return 'mechanics';
    }
    return 'hub';
  });
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isTheoryOpen, setIsTheoryOpen] = useState<boolean>(false);
  const [isColorCodeOpen, setIsColorCodeOpen] = useState<boolean>(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState<boolean>(false);
  const [externalResistorSync, setExternalResistorSync] = useState<{
    target: 'R1' | 'R2' | 'R3';
    ohms: number;
    token: number;
  } | null>(null);
  const [objectivesModalLab, setObjectivesModalLab] = useState<'circuits' | 'space' | 'mechanics' | null>(null);

  // Registro de retos superados y puntuación científica
  const [completedChallenges, setCompletedChallenges] = useState<Record<string, boolean>>({});
  const [totalScore, setTotalScore] = useState<number>(0);

  // Telemetría actual extraída automáticamente del laboratorio activo
  const [liveTelemetry, setLiveTelemetry] = useState<TelemetryItem[]>([
    { label: 'Voltaje Fuente DC', value: '20.00', unit: 'V' },
    { label: 'Voltaje Bombilla', value: '5.00', unit: 'V' },
    { label: 'Radio Orbital Tierra', value: '16.00', unit: 'u' },
    { label: 'Período Péndulo 3D', value: '2.00', unit: 's' },
  ]);

  const t = dictionary[lang];

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audioSynth.setMuted(nextMuted);
  };

  const handleCompleteChallenge = (id: string, points: number) => {
    setCompletedChallenges((prev) => {
      if (prev[id]) return prev;
      setTotalScore((s) => s + points);
      return { ...prev, [id]: true };
    });
  };

  const completedCount = Object.keys(completedChallenges).length;

  const activeLabDisplayName =
    activeView === 'circuits'
      ? t.card1Title
      : activeView === 'space'
      ? t.card2Title
      : activeView === 'mechanics'
      ? lang === 'es'
        ? 'Laboratorio de Dinámica Clásica, Resonancia y Ondas 3D'
        : '3D Classical Dynamics, Resonance & Wave Lab'
      : 'Suite Completa (3 Laboratorios 3D)';

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col">
      {/* Top Bar Contract: 3 Zones separated by gap-8 */}
      <header className="sticky top-0 z-40 bg-[#07090E]/95 border-b border-slate-800/90 px-6 py-3.5 no-print">
        <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveView('hub')}
            className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 flex items-center gap-2.5 cursor-pointer"
          >
            <Atom className="w-6 h-6 text-cyan-400 shrink-0" />
            <span>QUANTUM LABS · LabFísica 3D</span>
          </button>

          {/* Zone 2: 4–5 Single-Line Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <button
              type="button"
              onClick={() => setActiveView('hub')}
              className={`hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'hub' ? 'text-cyan-400 font-semibold' : ''
              }`}
            >
              {t.navExplore}
            </button>
            <button
              type="button"
              onClick={() => setActiveView('circuits')}
              className={`hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'circuits' ? 'text-cyan-400 font-semibold' : ''
              }`}
            >
              Circuitos 3D
            </button>
            <button
              type="button"
              onClick={() => setActiveView('space')}
              className={`hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'space' ? 'text-cyan-400 font-semibold' : ''
              }`}
            >
              Espacio-Tiempo 3D
            </button>
            <button
              type="button"
              onClick={() => setIsTheoryOpen(true)}
              className="hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Fundamentos
            </button>
            <button
              type="button"
              onClick={() => setIsColorCodeOpen(true)}
              className="hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Código EIA
            </button>
          </nav>

          {/* Zone 3: Quick QR Mobile Access */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsQRModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 rounded-lg hover:bg-cyan-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Acceso Móvil QR</span>
            </button>
          </div>
        </div>
      </header>

      {/* Secondary Institutional & Utility Bar (Language ES/EN, Offline Status, Audio Synth, PWA Install) */}
      <div className="bg-[#0A0E17] border-b border-slate-800/70 px-6 py-2.5 no-print">
        <div className="max-w-[1360px] mx-auto flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-3 text-slate-300">
            <span className="font-medium text-cyan-300">{t.authorBadge}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="font-mono text-emerald-400">
              {isOnline ? `● ${t.statusOnline}` : `▲ ${t.statusOffline}`}
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="font-mono text-amber-300">
              {t.scoreLabel}: {totalScore} PTS ({completedCount}/6 Retos)
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {activeView !== 'hub' && (
              <button
                type="button"
                onClick={() => setActiveView('hub')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t.backToHub}</span>
              </button>
            )}

            {/* Bilingual Toggle [ES | EN] */}
            <div
              className="flex items-center rounded-lg bg-[#07090E] border border-slate-800 p-0.5"
              role="group"
              aria-label="Selector de Idioma"
            >
              <button
                type="button"
                onClick={() => setLang('es')}
                className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-colors cursor-pointer ${
                  lang === 'es' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                ES
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-colors cursor-pointer ${
                  lang === 'en' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                EN
              </button>
            </div>

            {/* Procedural Audio Synth Mute Button */}
            <button
              type="button"
              onClick={handleToggleMute}
              aria-label={isMuted ? t.unmuteAudio : t.muteAudio}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#07090E] border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors cursor-pointer"
            >
              {isMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              )}
              <span className="hidden sm:inline font-mono">
                {isMuted ? 'Audio: OFF' : 'Audio: 60Hz'}
              </span>
            </button>

            {/* QR Code Access Button for Mobile Devices */}
            <button
              type="button"
              data-testid="open-qr-btn"
              onClick={() => setIsQRModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-900/80 hover:text-white transition-colors cursor-pointer font-mono"
            >
              <QrCode className="w-3.5 h-3.5 text-cyan-400" />
              <span>Código QR</span>
            </button>

            {/* In-App PWA Install Button */}
            <PWAInstallButton lang={lang} />
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-6 py-8">
        {activeView === 'hub' && (
          <div className="space-y-16">
            {/* Hero Educativo (Inspirado en Quantum Labs / PhET Colorado) */}
            <section className="text-center max-w-4xl mx-auto pt-4 space-y-5">
              <p className="text-xs font-mono uppercase tracking-widest text-cyan-400">
                {t.heroKicker}
              </p>
              <h1
                className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]"
                style={{ textWrap: 'balance' }}
              >
                <span className="block text-white">{t.heroTitleLine1}</span>
                <span className="block mt-1 bg-gradient-to-r from-cyan-400 via-sky-400 to-purple-400 bg-clip-text text-transparent">
                  {t.heroTitleLine2}
                </span>
              </h1>
              <p className="text-base sm:text-lg text-slate-300 font-medium max-w-2xl mx-auto">
                “{t.heroMotto}”
              </p>
              <p className="text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
                {t.heroDescription}
              </p>

              {/* Subject Filter Buttons */}
              <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    filter === 'all'
                      ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200'
                      : 'bg-[#0D1322] border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {lang === 'es' ? 'Todos los Laboratorios 3D (3)' : 'All 3D Laboratories (3)'}
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('circuits')}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    filter === 'circuits'
                      ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200'
                      : 'bg-[#0D1322] border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {t.filterCircuits}
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('space')}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    filter === 'space'
                      ? 'bg-purple-950/80 border-purple-400 text-purple-200'
                      : 'bg-[#0D1322] border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {t.filterSpace}
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('mechanics')}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    filter === 'mechanics'
                      ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200'
                      : 'bg-[#0D1322] border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {lang === 'es' ? 'Mecánica y Ondas 3D (1)' : '3D Mechanics & Waves (1)'}
                </button>
              </div>
            </section>

            {/* Simulation Cards Grid (3 Interactive 3D Laboratories) */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-7 items-stretch">
              {/* Card 1: Kit de Construcción de Circuitos DC (Mesa 3D + Esquemático 2D) */}
              {(filter === 'all' || filter === 'circuits') && (
                <article className="rounded-2xl bg-[#0B101E] border border-slate-800/90 hover:border-cyan-500/50 transition-colors flex flex-col justify-between overflow-hidden">
                  <div>
                    {/* 16:9 Interactive Animated Preview Thumbnail */}
                    <div
                      onClick={() => setActiveView('circuits')}
                      className="relative aspect-[16/9] bg-gradient-to-br from-[#081528] via-[#0B1324] to-[#070B14] border-b border-slate-800/80 flex items-center justify-center cursor-pointer group overflow-hidden"
                    >
                      <svg viewBox="0 0 260 140" className="w-4/5 h-4/5">
                        <circle
                          cx="130"
                          cy="70"
                          r="52"
                          fill="none"
                          stroke="#06B6D4"
                          strokeWidth="2"
                          strokeDasharray="6 5"
                          opacity="0.6"
                        />
                        <rect
                          x="74"
                          y="54"
                          width="28"
                          height="32"
                          rx="5"
                          fill="#0F172A"
                          stroke="#22D3EE"
                          strokeWidth="2.5"
                        />
                        <rect
                          x="158"
                          y="54"
                          width="28"
                          height="32"
                          rx="5"
                          fill="#0F172A"
                          stroke="#22D3EE"
                          strokeWidth="2.5"
                        />
                        <line x1="102" y1="70" x2="158" y2="70" stroke="#38BDF8" strokeWidth="3" />
                        <line x1="130" y1="30" x2="130" y2="54" stroke="#F59E0B" strokeWidth="3" />
                        <polygon points="130,22 123,33 137,33" fill="#F59E0B" />
                        <circle cx="130" cy="70" r="9" fill="#FEF08A" />
                      </svg>
                      <div className="absolute inset-0 bg-cyan-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="px-4 py-2 rounded-lg bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg">
                          <Play className="w-3.5 h-3.5 fill-current" />
                          {t.card1PlayBtn}
                        </span>
                      </div>
                    </div>

                    <div className="p-6 space-y-3">
                      <div className="flex items-center justify-between text-xs font-mono text-cyan-400">
                        <span>{t.card1Category}</span>
                        <span className="text-emerald-400">● 3D + 2D (60 FPS)</span>
                      </div>
                      <h2 className="text-xl font-bold text-white">{t.card1Title}</h2>
                      <p className="text-xs text-slate-300 leading-relaxed">{t.card1Desc}</p>
                      <div className="pt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-slate-400">
                        <span>{t.card1Badges[0]}</span>
                        <span aria-hidden="true">·</span>
                        <span>Mesa Óptica 3D</span>
                        <span aria-hidden="true">·</span>
                        <span>Kirchhoff &amp; Ohm</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 pt-0 space-y-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveView('circuits')}
                      className="w-full py-2.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Zap className="w-4 h-4" />
                      <span>{t.card1PlayBtn}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setObjectivesModalLab('circuits')}
                      className="w-full py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{t.card1ObjectivesBtn}</span>
                    </button>
                  </div>
                </article>
              )}

              {/* Card 2: Laboratorio de Gravedad, Órbitas y Espacio-Tiempo 3D */}
              {(filter === 'all' || filter === 'space') && (
                <article className="rounded-2xl bg-[#0B101E] border border-slate-800/90 hover:border-purple-500/50 transition-colors flex flex-col justify-between overflow-hidden">
                  <div>
                    <div
                      onClick={() => setActiveView('space')}
                      className="relative aspect-[16/9] bg-gradient-to-br from-[#190D2E] via-[#0F1026] to-[#070913] border-b border-slate-800/80 flex items-center justify-center cursor-pointer group overflow-hidden"
                    >
                      <svg viewBox="0 0 260 140" className="w-4/5 h-4/5">
                        {/* Relativistic curved grid lines */}
                        <path
                          d="M 20 95 Q 130 135 240 95"
                          fill="none"
                          stroke="#06B6D4"
                          strokeWidth="1.2"
                          opacity="0.45"
                        />
                        <path
                          d="M 40 108 Q 130 145 220 108"
                          fill="none"
                          stroke="#A855F7"
                          strokeWidth="1.2"
                          opacity="0.45"
                        />
                        <ellipse
                          cx="130"
                          cy="68"
                          rx="68"
                          ry="28"
                          transform="rotate(-16 130 68)"
                          fill="none"
                          stroke="#8B5CF6"
                          strokeWidth="2.2"
                        />
                        <circle cx="130" cy="68" r="20" fill="#F59E0B" />
                        <circle cx="182" cy="48" r="8" fill="#38BDF8" stroke="#E0F2FE" strokeWidth="2" />
                      </svg>
                      <div className="absolute inset-0 bg-purple-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="px-4 py-2 rounded-lg bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg">
                          <Play className="w-3.5 h-3.5 fill-current" />
                          {t.card2PlayBtn}
                        </span>
                      </div>
                    </div>

                    <div className="p-6 space-y-3">
                      <div className="flex items-center justify-between text-xs font-mono text-purple-400">
                        <span>{t.card2Category}</span>
                        <span className="text-emerald-400">● {t.card2Status}</span>
                      </div>
                      <h2 className="text-xl font-bold text-white">{t.card2Title}</h2>
                      <p className="text-xs text-slate-300 leading-relaxed">{t.card2Desc}</p>
                      <div className="pt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-slate-400">
                        <span>{t.card2Badges[0]}</span>
                        <span aria-hidden="true">·</span>
                        <span>{t.card2Badges[1]}</span>
                        <span aria-hidden="true">·</span>
                        <span>{t.card2Badges[2]}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 pt-0 space-y-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveView('space')}
                      className="w-full py-2.5 px-4 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Orbit className="w-4 h-4" />
                      <span>{t.card2PlayBtn}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setObjectivesModalLab('space')}
                      className="w-full py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                      <span>{t.card2ObjectivesBtn}</span>
                    </button>
                  </div>
                </article>
              )}

              {/* Card 3: Laboratorio de Dinámica Clásica, Resonancia y Ondas 3D */}
              {(filter === 'all' || filter === 'mechanics') && (
                <article className="rounded-2xl bg-[#0B101E] border border-slate-800/90 hover:border-emerald-500/50 transition-colors flex flex-col justify-between overflow-hidden">
                  <div>
                    <div
                      onClick={() => setActiveView('mechanics')}
                      className="relative aspect-[16/9] bg-gradient-to-br from-[#06221E] via-[#091824] to-[#070912] border-b border-slate-800/80 flex items-center justify-center cursor-pointer group overflow-hidden"
                    >
                      <svg viewBox="0 0 260 140" className="w-4/5 h-4/5">
                        <line x1="70" y1="20" x2="190" y2="20" stroke="#64748B" strokeWidth="4" />
                        <line x1="105" y1="20" x2="82" y2="82" stroke="#E2E8F0" strokeWidth="2" />
                        <line x1="155" y1="20" x2="178" y2="82" stroke="#38BDF8" strokeWidth="2" />
                        <path
                          d="M 93 52 L 167 52"
                          stroke="#F59E0B"
                          strokeWidth="2"
                          strokeDasharray="4 3"
                        />
                        <circle cx="82" cy="82" r="12" fill="#F59E0B" />
                        <circle cx="178" cy="82" r="12" fill="#06B6D4" />
                        <path
                          d="M 30 116 Q 80 98 130 116 T 230 116"
                          fill="none"
                          stroke="#10B981"
                          strokeWidth="2"
                        />
                      </svg>
                      <div className="absolute inset-0 bg-emerald-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="px-4 py-2 rounded-lg bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg">
                          <Play className="w-3.5 h-3.5 fill-current" />
                          {lang === 'es' ? 'Iniciar Laboratorio 3D' : 'Launch 3D Lab'}
                        </span>
                      </div>
                    </div>

                    <div className="p-6 space-y-3">
                      <div className="flex items-center justify-between text-xs font-mono text-emerald-400">
                        <span>DINÁMICA Y ONDAS 3D · RK4</span>
                        <span className="text-emerald-400">● 60 FPS · MOTOR RK4 3D</span>
                      </div>
                      <h2 className="text-xl font-bold text-white">
                        {lang === 'es'
                          ? 'Laboratorio de Oscilaciones, Resonancia y Ondas 3D'
                          : '3D Oscillations, Coupled Resonance & Wave Lab'}
                      </h2>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {lang === 'es'
                          ? 'Simulador 3D con integrador Runge-Kutta de 4to orden (RK4), péndulo de Huygens, resonancia de osciladores acoplados, precesión 3D de Foucault y malla de interferencia ondulatoria.'
                          : '3D simulator featuring a 4th-order Runge-Kutta (RK4) integrator, Huygens pendulum, coupled oscillator resonance, 3D Foucault precession, and wave interference mesh.'}
                      </p>
                      <div className="pt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-slate-400">
                        <span>Mecánica Clásica 3D</span>
                        <span aria-hidden="true">·</span>
                        <span>Runge-Kutta 4</span>
                        <span aria-hidden="true">·</span>
                        <span>Conservación E = K + U</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 pt-0 space-y-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveView('mechanics')}
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Activity className="w-4 h-4" />
                      <span>
                        {lang === 'es' ? 'Iniciar Simulación 3D' : 'Launch 3D Simulation'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setObjectivesModalLab('mechanics')}
                      className="w-full py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{t.card1ObjectivesBtn}</span>
                    </button>
                  </div>
                </article>
              )}
            </section>

            {/* Scannable Mobile Access QR Code Section (Replaces Technical File/Git Architecture) */}
            <HubQRCodeBanner
              lang={lang}
              onOpenModal={() => setIsQRModalOpen(true)}
            />
          </div>
        )}

        {activeView === 'circuits' && (
          <CircuitLabView
            lang={lang}
            onUpdateTelemetry={setLiveTelemetry}
            completedChallenges={completedChallenges}
            onCompleteChallenge={handleCompleteChallenge}
            externalResistorSync={externalResistorSync}
          />
        )}

        {activeView === 'space' && (
          <SpaceLabView
            lang={lang}
            onUpdateTelemetry={setLiveTelemetry}
            completedChallenges={completedChallenges}
            onCompleteChallenge={handleCompleteChallenge}
          />
        )}

        {activeView === 'mechanics' && (
          <MechanicsLabView
            lang={lang}
            onUpdateTelemetry={setLiveTelemetry}
            completedChallenges={completedChallenges}
            onCompleteChallenge={handleCompleteChallenge}
          />
        )}
      </main>

      {/* Learning Objectives Modal */}
      {objectivesModalLab && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl bg-[#0D1322] border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-bold text-white">
                  {objectivesModalLab === 'circuits'
                    ? t.card1ObjectivesTitle
                    : objectivesModalLab === 'space'
                    ? t.card2ObjectivesTitle
                    : lang === 'es'
                    ? 'Objetivos Pedagógicos — Dinámica y Ondas 3D'
                    : 'Learning Objectives — 3D Dynamics & Waves'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setObjectivesModalLab(null)}
                aria-label="Cerrar"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ul className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
              {(objectivesModalLab === 'circuits'
                ? t.card1ObjectivesList
                : objectivesModalLab === 'space'
                ? t.card2ObjectivesList
                : [
                    'Verificar experimentalmente la ley del isocronismo del péndulo T = 2π √(L / g) bajo distintas gravedades planetarias.',
                    'Observar en tiempo real la conservación de la energía mecánica E = K + U mediante integración Runge-Kutta de 4to orden.',
                    'Analizar el fenómeno de batimiento y modos normales en osciladores acoplados por resorte en 3D.',
                    'Visualizar frentes de onda esféricos e interferencia constructiva/destructiva en mallas 3D.',
                  ]
              ).map((item, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const target = objectivesModalLab;
                  setObjectivesModalLab(null);
                  if (target) setActiveView(target);
                }}
                className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-colors cursor-pointer"
              >
                Ir al Laboratorio Ahora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enciclopedia Teórica Interactiva (Fundamentos) */}
      <TheoryModal
        isOpen={isTheoryOpen}
        onClose={() => setIsTheoryOpen(false)}
        lang={lang}
      />

      {/* Calculadora de Código de Colores EIA (4 y 5 Bandas) */}
      <ColorCodeModal
        isOpen={isColorCodeOpen}
        onClose={() => setIsColorCodeOpen(false)}
        lang={lang}
        onApplyToResistor={(target, ohms) => {
          setExternalResistorSync({ target, ohms, token: Date.now() });
          setActiveView('circuits');
        }}
      />

      {/* Scannable Mobile QR Code Modal */}
      <LabQRCodeModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        lang={lang}
      />

      {/* Tutor Pedagógico IA Flotante (QuantumLabs Chatbot) */}
      <ChatbotWidget
        lang={lang}
        activeLabName={activeLabDisplayName}
        telemetry={liveTelemetry}
      />

      {/* Clean Academic Footer */}
      <footer className="mt-16 border-t border-slate-800/80 bg-[#05070C] py-6 px-6 text-xs text-slate-400 no-print">
        <div className="max-w-[1360px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="font-semibold text-slate-200">LabFísica Avanzada · Edición Feria de la Ciencia</span>
            <span aria-hidden="true" className="mx-2">·</span>
            <span>Autor e Investigador: Juan David González Alarcón</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/PANELITA29/Laboratorio-Fisica-Avanzada"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-cyan-400 transition-colors"
            >
              Repositorio GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
