import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, X, Smartphone, Copy, Check, ExternalLink } from 'lucide-react';
import { Language } from '../assets/js/i18n';

interface LabQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

const VERCEL_OFFICIAL_URL = 'https://laboratorio-fisica-avanzada.vercel.app';

export const LabQRCodeModal: React.FC<LabQRCodeModalProps> = ({ isOpen, onClose, lang }) => {
  const [targetUrl, setTargetUrl] = useState<string>(VERCEL_OFFICIAL_URL);
  const [qrSvgMarkup, setQrSvgMarkup] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    const urlToEncode = targetUrl.trim() || VERCEL_OFFICIAL_URL;
    QRCode.toString(
      urlToEncode,
      {
        type: 'svg',
        margin: 2,
        width: 240,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#06B6D4',
          light: '#070B14',
        },
      },
      (err, svgStr) => {
        if (!err && active && svgStr) {
          setQrSvgMarkup(svgStr);
        }
      }
    );
    return () => {
      active = false;
    };
  }, [targetUrl]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[#0B0F1A] border border-cyan-500/40 shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0F1626] border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <QrCode className="w-5 h-5 text-cyan-400" />
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 block">
                ACCESO MÓVIL INMEDIATO · WEB OFICIAL VERCEL
              </span>
              <h2 id="qr-modal-title" className="text-lg font-bold text-white">
                {lang === 'es'
                  ? 'Escanea para Abrir el Laboratorio 3D en Vercel'
                  : 'Scan to Launch the 3D Laboratory on Vercel'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={lang === 'es' ? 'Cerrar Código QR' : 'Close QR Code'}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-center">
          <p className="text-xs text-slate-300 leading-relaxed">
            {lang === 'es'
              ? 'Apunta la cámara de cualquier teléfono móvil o tablet hacia este código QR para entrar directamente a la web oficial en Vercel y experimentar con los 3 laboratorios en 3D (Circuitos DC, Espacio-Tiempo de Einstein y Péndulos RK4).'
              : 'Point any smartphone or tablet camera at this QR code to open the official Vercel web app and interact live with all 3 3D laboratories.'}
          </p>

          {/* Scannable QR Frame */}
          <div className="mx-auto w-64 h-64 p-3 rounded-2xl bg-[#070B14] border-2 border-cyan-500/50 shadow-xl flex items-center justify-center">
            {qrSvgMarkup ? (
              <div
                data-testid="lab-qr-svg"
                className="w-full h-full [&>svg]:w-full [&>svg]:h-full"
                dangerouslySetInnerHTML={{ __html: qrSvgMarkup }}
              />
            ) : (
              <span className="text-xs font-mono text-cyan-400">Generando QR...</span>
            )}
          </div>

          {/* Direct Lab Deep-Link Presets on Vercel */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setTargetUrl(VERCEL_OFFICIAL_URL)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono border cursor-pointer transition-colors ${
                targetUrl === VERCEL_OFFICIAL_URL
                  ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-bold'
                  : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border-slate-700'
              }`}
            >
              Web Vercel (Inicio)
            </button>
            <button
              type="button"
              onClick={() => setTargetUrl(`${VERCEL_OFFICIAL_URL}/?lab=circuits`)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono border cursor-pointer transition-colors ${
                targetUrl === `${VERCEL_OFFICIAL_URL}/?lab=circuits`
                  ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
              }`}
            >
              Vercel: Circuitos 3D
            </button>
            <button
              type="button"
              onClick={() => setTargetUrl(`${VERCEL_OFFICIAL_URL}/?lab=space`)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono border cursor-pointer transition-colors ${
                targetUrl === `${VERCEL_OFFICIAL_URL}/?lab=space`
                  ? 'bg-purple-500 text-white border-purple-300 font-bold'
                  : 'bg-slate-800 hover:bg-slate-700 text-purple-300 border-slate-700'
              }`}
            >
              Vercel: Espacio 3D
            </button>
            <button
              type="button"
              onClick={() => setTargetUrl(`${VERCEL_OFFICIAL_URL}/?lab=mechanics`)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono border cursor-pointer transition-colors ${
                targetUrl === `${VERCEL_OFFICIAL_URL}/?lab=mechanics`
                  ? 'bg-emerald-400 text-slate-950 border-emerald-300 font-bold'
                  : 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border-slate-700'
              }`}
            >
              Vercel: Péndulos 3D
            </button>
          </div>

          {/* Editable URL + Copy Button */}
          <div className="space-y-1.5 text-left">
            <label htmlFor="qr-url-input" className="block text-[11px] font-mono text-slate-400">
              {lang === 'es' ? 'Enlace de Vercel codificado en el QR:' : 'Vercel URL encoded in QR:'}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="qr-url-input"
                type="text"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                className="flex-1 rounded-lg bg-[#07090E] border border-slate-700 px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-400"
              />
              <button
                type="button"
                onClick={handleCopyUrl}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-colors cursor-pointer shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#0F1626] border-t border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-emerald-400 font-mono">
            <Smartphone className="w-4 h-4" />
            <span>Compatible con iOS / Android (PWA instalable)</span>
          </div>
          <a
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-mono"
          >
            <span>Abrir web en Vercel</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};

export const HubQRCodeBanner: React.FC<{
  lang: Language;
  onOpenModal: () => void;
}> = ({ lang, onOpenModal }) => {
  const [svgStr, setSvgStr] = useState<string>('');
  const liveUrl = VERCEL_OFFICIAL_URL;

  useEffect(() => {
    let active = true;
    QRCode.toString(
      liveUrl,
      {
        type: 'svg',
        margin: 2,
        width: 168,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#22D3EE',
          light: '#070B14',
        },
      },
      (err, str) => {
        if (!err && active && str) setSvgStr(str);
      }
    );
    return () => {
      active = false;
    };
  }, [liveUrl]);

  return (
    <section
      data-testid="hub-qr-section"
      className="rounded-2xl bg-[#0B101E] border border-cyan-500/40 p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6"
    >
      <div className="space-y-3 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-cyan-950/80 border border-cyan-500/40 text-xs font-mono text-cyan-300">
          <QrCode className="w-3.5 h-3.5" />
          <span>ACCESO MÓVIL OFICIAL EN VERCEL · ESCANEA Y EXPERIMENTA EN 3D</span>
        </div>
        <h2 className="text-2xl font-bold text-white">
          {lang === 'es'
            ? '¿Quieres probar el Laboratorio 3D en tu celular ahora mismo?'
            : 'Want to try the 3D Laboratory on your phone right now?'}
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          {lang === 'es'
            ? 'Escanea este código QR con la cámara de tu teléfono para abrir directamente https://laboratorio-fisica-avanzada.vercel.app en tiempo real. Puedes manipular el banco óptico de circuitos DC, deformar la malla relativista del espacio-tiempo o experimentar con péndulos 3D desde tu celular.'
            : 'Scan this QR code with your phone camera to open https://laboratorio-fisica-avanzada.vercel.app in real time.'}
        </p>
        <div className="pt-1 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onOpenModal}
            className="px-4 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            <span>
              {lang === 'es'
                ? 'Ampliar Código QR / Elegir Laboratorio'
                : 'Enlarge QR Code / Pick Laboratory'}
            </span>
          </button>
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-cyan-300 hover:text-cyan-200 underline break-all"
          >
            {liveUrl}
          </a>
        </div>
      </div>

      <div
        onClick={onOpenModal}
        title="Haz clic para ampliar el Código QR"
        className="shrink-0 flex flex-col items-center gap-2 p-3.5 rounded-2xl bg-[#070B14] border-2 border-cyan-400/60 hover:border-cyan-300 transition-colors cursor-pointer shadow-xl"
      >
        <div className="w-36 h-36 flex items-center justify-center">
          {svgStr ? (
            <div
              data-testid="hub-qr-svg"
              className="w-full h-full [&>svg]:w-full [&>svg]:h-full"
              dangerouslySetInnerHTML={{ __html: svgStr }}
            />
          ) : (
            <span className="text-xs font-mono text-cyan-400">QR...</span>
          )}
        </div>
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-300">
          {lang === 'es' ? 'ESCANEAR CON CÁMARA' : 'SCAN WITH CAMERA'}
        </span>
      </div>
    </section>
  );
};
