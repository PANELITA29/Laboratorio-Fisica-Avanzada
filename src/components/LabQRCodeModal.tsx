import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, X, Smartphone, Copy, Check, ExternalLink } from 'lucide-react';
import { Language } from '../assets/js/i18n';

interface LabQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

const DEPLOYMENT_BASE_URL = 'https://laboratorio-fisica-avanzada.vercel.app';

export const LabQRCodeModal: React.FC<LabQRCodeModalProps> = ({ isOpen, onClose, lang }) => {
  const [encodedUrl, setEncodedUrl] = useState<string>(DEPLOYMENT_BASE_URL);
  const [qrSvgMarkup, setQrSvgMarkup] = useState<string>('');
  const [hasCopiedUrl, setHasCopiedUrl] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const sanitizedUrl = encodedUrl.trim() || DEPLOYMENT_BASE_URL;
    QRCode.toString(
      sanitizedUrl,
      {
        type: 'svg',
        margin: 2,
        width: 220,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      },
      (error, generatedSvg) => {
        if (!error && isMounted && generatedSvg) {
          setQrSvgMarkup(generatedSvg);
        }
      }
    );
    return () => {
      isMounted = false;
    };
  }, [encodedUrl]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(encodedUrl);
      setHasCopiedUrl(true);
      setTimeout(() => setHasCopiedUrl(false), 1600);
    } catch {
      setHasCopiedUrl(false);
    }
  };

  if (!isOpen) return null;

  const moduleDeepLinks = [
    { label: 'Índice', url: DEPLOYMENT_BASE_URL },
    { label: 'Circuitos DC', url: `${DEPLOYMENT_BASE_URL}/?lab=circuits` },
    { label: 'Gravitación 3D', url: `${DEPLOYMENT_BASE_URL}/?lab=space` },
    { label: 'Oscilaciones RK4', url: `${DEPLOYMENT_BASE_URL}/?lab=mechanics` },
    { label: 'Cinemática 2D', url: `${DEPLOYMENT_BASE_URL}/?lab=kinematics` },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
    >
      <div className="w-full max-w-md rounded-xl bg-[#0B0F19] border border-slate-700 overflow-hidden my-4">
        <div className="px-4 sm:px-5 py-3.5 bg-[#0E1422] border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <QrCode className="w-4 h-4 text-cyan-400 shrink-0" />
            <div>
              <h2 id="qr-modal-title" className="text-sm sm:text-base font-bold text-white">
                {lang === 'es' ? 'Acceso Directo por Código QR' : 'Direct QR Code Access'}
              </h2>
              <span className="text-[11px] font-mono text-slate-300 block">
                {lang === 'es' ? 'Sincronización directa hacia navegadores móviles · PWA' : 'Direct mobile browser synchronization · PWA'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={lang === 'es' ? 'Cerrar ventana QR' : 'Close QR modal'}
            className="touch-target rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 text-center">
          <p className="text-xs text-slate-300 leading-relaxed mx-auto">
            {lang === 'es'
              ? 'Escanea el código con la cámara de tu teléfono o tablet para abrir el módulo seleccionado directamente en navegador móvil.'
              : 'Scan with your phone or tablet camera to open the selected module directly on mobile.'}
          </p>

          <div className="mx-auto w-52 h-52 sm:w-56 sm:h-56 p-3 rounded-xl bg-white border border-slate-300 flex items-center justify-center">
            {qrSvgMarkup ? (
              <div
                data-testid="lab-qr-svg"
                className="w-full h-full [&>svg]:w-full [&>svg]:h-full"
                dangerouslySetInnerHTML={{ __html: qrSvgMarkup }}
              />
            ) : (
              <span className="text-xs font-mono text-slate-900">Generando SVG...</span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {moduleDeepLinks.map((routeOption) => (
              <button
                key={routeOption.url}
                type="button"
                onClick={() => setEncodedUrl(routeOption.url)}
                className={`min-h-[2.25rem] px-2.5 py-1 rounded text-[11px] font-mono border cursor-pointer transition-colors ${
                  encodedUrl === routeOption.url
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-semibold'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                }`}
              >
                {routeOption.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5 text-left">
            <label htmlFor="qr-url-input" className="block text-[11px] font-mono text-slate-300">
              {lang === 'es' ? 'URL codificada:' : 'Encoded URL:'}
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                id="qr-url-input"
                type="text"
                value={encodedUrl}
                onChange={(e) => setEncodedUrl(e.target.value)}
                className="min-h-[2.75rem] flex-1 rounded-lg bg-[#07090E] border border-slate-700 px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-400"
              />
              <button
                type="button"
                onClick={handleCopyUrl}
                className="min-h-[2.75rem] flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-mono text-xs border border-slate-700 transition-colors cursor-pointer shrink-0"
              >
                {hasCopiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{hasCopiedUrl ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-5 py-3 bg-[#0E1422] border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-300 font-mono">
            <Smartphone className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
            <span>PWA Offline-First</span>
          </div>
          <a
            href={encodedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-mono"
          >
            <span>Abrir enlace</span>
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
  const [qrPreviewSvg, setQrPreviewSvg] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    QRCode.toString(
      DEPLOYMENT_BASE_URL,
      {
        type: 'svg',
        margin: 2,
        width: 128,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      },
      (error, generatedSvg) => {
        if (!error && isMounted && generatedSvg) setQrPreviewSvg(generatedSvg);
      }
    );
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section
      data-testid="hub-qr-section"
      className="rounded-xl workbench-panel fluid-section-pad flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
    >
      <div className="space-y-2 max-w-2xl">
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-300">
          <Smartphone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>{lang === 'es' ? 'Sincronización con Instrumentos Táctiles' : 'Touch Instrument Synchronization'}</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-cyan-300">PWA Offline-First</span>
        </div>
        <h2 className="fluid-title-md font-bold text-white">
          {lang === 'es'
            ? 'Ejecución en Dispositivos Táctiles y Tablets de Laboratorio'
            : 'Execution on Lab Touch Devices & Tablets'}
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          {lang === 'es'
            ? 'Los cuatro motores numéricos WebGL y Canvas 2D admiten gestos multitáctiles directos para posicionar puntas de prueba, rotar cámaras orbitales y calibrar gravedad o densidad atmosférica en campo.'
            : 'All four WebGL and 2D Canvas numerical engines support direct multi-touch gestures for probe placement, orbital camera rotation, and live gravity or atmospheric density calibration.'}
        </p>
        <div className="pt-1.5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onOpenModal}
            className="min-h-[2.75rem] inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/90 hover:bg-cyan-400 hover:text-slate-950 border border-slate-700 hover:border-cyan-400 text-slate-100 font-mono font-semibold text-xs instrument-transition cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5 text-cyan-400 group-hover:text-slate-950" />
            <span>{lang === 'es' ? 'Generar ruta QR por módulo' : 'Generate module QR route'}</span>
          </button>
          <span className="text-xs font-mono text-slate-300 break-all">
            {DEPLOYMENT_BASE_URL}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenModal}
        aria-label={lang === 'es' ? 'Ampliar código QR' : 'Expand QR code'}
        className="p-2.5 rounded-lg bg-white border border-slate-300 shrink-0 cursor-pointer flex flex-col items-center gap-1 self-center md:self-auto hover:border-cyan-400 instrument-transition"
      >
        {qrPreviewSvg ? (
          <div
            className="w-24 h-24 [&>svg]:w-full [&>svg]:h-full"
            dangerouslySetInnerHTML={{ __html: qrPreviewSvg }}
          />
        ) : (
          <div className="w-24 h-24 flex items-center justify-center text-[10px] font-mono text-slate-900">
            QR
          </div>
        )}
        <span className="text-[10px] font-mono font-semibold text-slate-900">
          {lang === 'es' ? 'Ampliar QR' : 'Expand QR'}
        </span>
      </button>
    </section>
  );
};
