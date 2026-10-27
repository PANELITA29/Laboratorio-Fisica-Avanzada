import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Language, dictionary } from '../assets/js/i18n';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface PWAInstallButtonProps {
  lang: Language;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ lang }) => {
  const t = dictionary[lang];
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (isInstalled) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } else {
      setShowIOSModal(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-950/50 border border-cyan-500/30 rounded-lg hover:bg-cyan-900/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        aria-label={isIOS ? t.installIOS : t.installApp}
      >
        <Download className="w-3.5 h-3.5" />
        <span>{isIOS ? t.installIOS : t.installApp}</span>
      </button>

      {showIOSModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-modal-title"
        >
          <div className="w-full max-w-md rounded-xl bg-[#0D1322] border border-slate-800 p-6 shadow-2xl">
            <h3 id="pwa-modal-title" className="text-lg font-bold text-white">
              {lang === 'es' ? 'Instalación Offline (PWA)' : 'Offline Installation (PWA)'}
            </h3>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              {lang === 'es'
                ? 'Esta plataforma cuenta con Service Worker activo (sw.js) y Web App Manifest que precachean todos los motores físicos 2D y 3D para funcionar 100% sin Internet en la feria científica.'
                : 'This platform includes an active Service Worker (sw.js) and Web App Manifest that precache all 2D and 3D physics engines for 100% offline operation at the science fair.'}
            </p>
            <div className="mt-4 p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-300 space-y-1.5">
              <p>
                <strong>Chrome / Edge (Desktop & Android):</strong>{' '}
                {lang === 'es'
                  ? 'Haz clic en el icono "Instalar LabFísica" en la barra de direcciones del navegador.'
                  : 'Click the "Install LabFísica" icon in your browser address bar.'}
              </p>
              <p>
                <strong>iOS Safari:</strong>{' '}
                {lang === 'es'
                  ? 'Toca Compartir y selecciona "Agregar a pantalla de inicio".'
                  : 'Tap Share and select "Add to Home Screen".'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="mt-5 w-full py-2 px-4 rounded-lg bg-cyan-500 text-slate-950 font-semibold text-sm hover:bg-cyan-400 transition-colors cursor-pointer"
            >
              {lang === 'es' ? 'Entendido' : 'Got it'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
