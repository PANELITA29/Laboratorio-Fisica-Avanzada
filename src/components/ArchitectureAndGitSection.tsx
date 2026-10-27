import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, Check, Copy, Cpu, Orbit, ShieldCheck, Smartphone, ExternalLink } from 'lucide-react';
import { Language, dictionary } from '../assets/js/i18n';

interface ArchitectureAndGitSectionProps {
  lang: Language;
}

type QrTargetPreset = 'current' | 'circuits' | 'space' | 'mechanics' | 'vercel';

export const ArchitectureAndGitSection: React.FC<ArchitectureAndGitSectionProps> = ({ lang }) => {
  const t = dictionary[lang];
  const [qrPreset, setQrPreset] = useState<QrTargetPreset>('current');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  const originUrl =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://laboratorio-fisica-avanzada.vercel.app';

  const targetUrl =
    qrPreset === 'current'
      ? `${originUrl}/`
      : qrPreset === 'circuits'
      ? `${originUrl}/?lab=circuits`
      : qrPreset === 'space'
      ? `${originUrl}/?lab=space`
      : qrPreset === 'mechanics'
      ? `${originUrl}/?lab=mechanics`
      : 'https://laboratorio-fisica-avanzada.vercel.app/';

  useEffect(() => {
    let mounted = true;
    QRCode.toDataURL(targetUrl, {
      width: 280,
      margin: 2,
      color: {
        dark: '#07090E',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => {
        if (mounted) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [targetUrl]);

  const handleCopyUrl = () => {
    navigator.clipboard?.writeText(targetUrl).catch(() => {});
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="space-y-16">
      {/* Mathematical & Physical Foundations Section */}
      <section id="fundamentos" className="scroll-mt-24">
        <div className="border-b border-slate-800/80 pb-4 mb-8">
          <p className="text-xs font-mono uppercase tracking-wider text-cyan-400">
            01. RIGOR FÍSICO Y COMPUTACIONAL
          </p>
          <h2 className="mt-1 text-2xl sm:text-3xl font-bold text-white">{t.foundationsTitle}</h2>
          <p className="mt-1 text-sm text-slate-400">{t.foundationsSubtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl bg-[#0D1322] border border-slate-800/90">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">
              {lang === 'es'
                ? 'Leyes de Ohm, Kirchhoff y Diagnóstico Real de Fallas'
                : 'Ohm, Kirchhoff Laws & Real Fault Diagnostics'}
            </h3>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              {lang === 'es'
                ? 'Resuelve en tiempo real topologías en Serie, Paralelo y Mixto (R₁ + R₂∥R₃), simulando circuitos abiertos (rama cortada I = 0 A) y cortocircuitos francos con disparo de protección térmica OCP.'
                : 'Solves Series, Parallel, and Mixed (R₁ + R₂∥R₃) topologies in real time, simulating open circuits (cut branch I = 0 A) and dead short-circuits with thermal OCP trip.'}
            </p>
            <div className="mt-4 pt-3 border-t border-slate-800/80 font-mono text-xs text-cyan-300">
              V = I · R &nbsp;·&nbsp; P = I² · R &nbsp;·&nbsp; ∑ ΔV_malla = 0
            </div>
          </div>

          <div className="p-6 rounded-xl bg-[#0D1322] border border-slate-800/90">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4">
              <Orbit className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">
              {lang === 'es'
                ? 'Integración Simpléctica Velocity Verlet y Kepler'
                : 'Symplectic Velocity Verlet & Keplerian Mechanics'}
            </h3>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              {lang === 'es'
                ? 'Conserva la energía orbital y el momento angular a largo plazo mientras calcula analíticamente las 3 Leyes de Kepler, Velocidad de Escape y órbitas de Transferencia de Hohmann.'
                : 'Preserves orbital energy and angular momentum over long runs while analytically computing Kepler’s 3 Laws, Escape Velocity, and Hohmann Transfer orbits.'}
            </p>
            <div className="mt-4 pt-3 border-t border-slate-800/80 font-mono text-xs text-purple-300">
              r(t+Δt) = r(t) + v(t)Δt + ½a(t)Δt²
            </div>
          </div>

          <div className="p-6 rounded-xl bg-[#0D1322] border border-slate-800/90">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">
              {lang === 'es'
                ? 'ShaderMaterial GLSL de Espacio-Tiempo (SpaceScene3D)'
                : 'GLSL Spacetime ShaderMaterial (SpaceScene3D)'}
            </h3>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              {lang === 'es'
                ? 'Deforma en la GPU un plano subdividido aplicando el potencial gravitacional relativista en el Vertex Shader con una rejilla neón Sci-Fi y anillos equipotenciales en el Fragment Shader.'
                : 'Deforms a subdivided plane on the GPU by applying the relativistic gravitational potential in the Vertex Shader with a Sci-Fi neon grid in the Fragment Shader.'}
            </p>
            <div className="mt-4 pt-3 border-t border-slate-800/80 font-mono text-xs text-amber-300">
              z(x,y) = -∑ G·Mᵢ / √((x-xᵢ)² + (y-yᵢ)² + ε²)
            </div>
          </div>
        </div>
      </section>

      {/* Interactive QR Code Access Section for Science Fair Visitors & Judges */}
      <section id="acceso-qr" className="scroll-mt-24">
        <div className="rounded-2xl bg-gradient-to-br from-[#0D1528] via-[#0B101E] to-[#080C16] border border-cyan-500/30 p-6 sm:p-8 shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left 7 Cols: Instructions & Direct Lab Selector for QR */}
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-xs font-mono text-cyan-300">
                <QrCode className="w-3.5 h-3.5" />
                <span>ACCESO MÓVIL INSTANTÁNEO · FERIA DE LA CIENCIA</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {lang === 'es'
                  ? '¡Escanea el Código QR y Experimenta en tu Propio Dispositivo!'
                  : 'Scan the QR Code & Experiment on Your Own Device!'}
              </h2>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {lang === 'es'
                  ? 'Apunta con la cámara de tu teléfono o tablet al código QR para abrir inmediatamente los laboratorios interactivos 3D sin necesidad de instalar nada. Elige qué módulo deseas compartir con el jurado o los visitantes:'
                  : 'Point your phone or tablet camera at the QR code to immediately open the interactive 3D laboratories with zero installation required. Choose which module to share with judges or visitors:'}
              </p>

              {/* QR Destination Selector Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {(
                  [
                    { id: 'current', labelEs: 'Hub Central (3 Labs)', labelEn: 'Main Hub (3 Labs)' },
                    { id: 'circuits', labelEs: 'Lab 1: Circuitos 3D', labelEn: 'Lab 1: 3D Circuits' },
                    { id: 'space', labelEs: 'Lab 2: Espacio-Tiempo 3D', labelEn: 'Lab 2: 3D Spacetime' },
                    { id: 'mechanics', labelEs: 'Lab 3: Oscilaciones 3D', labelEn: 'Lab 3: 3D Oscillations' },
                    { id: 'vercel', labelEs: 'Despliegue Oficial Vercel', labelEn: 'Official Vercel Deploy' },
                  ] as Array<{ id: QrTargetPreset; labelEs: string; labelEn: string }>
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setQrPreset(item.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer ${
                      qrPreset === item.id
                        ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-bold'
                        : 'bg-[#07090E] border-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    {lang === 'es' ? item.labelEs : item.labelEn}
                  </button>
                ))}
              </div>

              {/* URL Copy Bar */}
              <div className="pt-2 flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-[240px] px-3.5 py-2 rounded-lg bg-[#07090E] border border-slate-800 font-mono text-xs text-cyan-300 truncate">
                  {targetUrl}
                </div>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                >
                  {copiedUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedUrl ? '¡Enlace Copiado!' : 'Copiar Enlace'}</span>
                </button>
              </div>
            </div>

            {/* Right 5 Cols: High-Contrast Scannable QR Card */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center">
              <div className="p-5 rounded-2xl bg-white shadow-2xl border-4 border-cyan-400 flex flex-col items-center space-y-2.5">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Código QR de acceso a QuantumLabs LabFísica 3D"
                    data-testid="lab-qr-code"
                    className="w-52 h-52 sm:w-56 sm:h-56 object-contain"
                  />
                ) : (
                  <div className="w-52 h-52 flex items-center justify-center text-xs font-mono text-slate-700">
                    Generando QR...
                  </div>
                )}
                <div className="text-center">
                  <span className="text-[11px] font-mono font-bold text-slate-900 uppercase tracking-wider flex items-center justify-center gap-1">
                    <Smartphone className="w-3.5 h-3.5 text-cyan-600" />
                    <span>ESCANEA CON TU CÁMARA</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-600 block">
                    QuantumLabs · Juan David González Alarcón
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
