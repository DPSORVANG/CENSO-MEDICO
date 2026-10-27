import React, { useState } from 'react';
import { Download, Smartphone, CheckCircle2, WifiOff, CloudUpload, X, Copy, Check } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

interface PWAInstallButtonProps {
  variant?: 'header' | 'full';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, isInIframe, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (isInstalled && variant === 'header') {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setShowGuideModal(true);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(window.location.origin);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  return (
    <>
      {variant === 'header' ? (
        <button
          type="button"
          onClick={handleClick}
          title="Instalar ResiMed MI en este dispositivo para uso 100% Fuera de Línea (Offline)"
          aria-label="Instalar App Offline"
          className="flex items-center gap-1.5 p-2 xl:px-2.5 xl:py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/40 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
        >
          <Download className="w-4 h-4 shrink-0" />
          <span className="hidden 2xl:inline">Instalar App</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4 shrink-0" />
          {isInstalled
            ? 'App Instalada en este Dispositivo (Modo Offline Activo)'
            : 'Instalar App para Uso 100% Fuera de Línea (PWA)'}
        </button>
      )}

      {showGuideModal && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-900 px-5 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold">
                    Instalar ResiMed MI (Modo Offline + Sincronización)
                  </h3>
                  <p className="text-[11px] text-teal-300">
                    Aplicación Web Progresiva (PWA) para hospital sin señal
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                aria-label="Cerrar guía de instalación"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5">
                  <WifiOff className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-emerald-950 text-xs">100% Editable Sin Internet</div>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      Registra ingresos, laboratorios, indicaciones y notas en sótanos o pisos sin red. Todo se guarda en la memoria local cifrada del dispositivo.
                    </p>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 flex items-start gap-2.5">
                  <CloudUpload className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-teal-950 text-xs">Subida y Fusión Posterior</div>
                    <p className="text-[11px] text-teal-800 mt-0.5">
                      Cada ingreso hecho sin red se encola automáticamente. Al recuperar Wi-Fi o datos, presiona <strong>Unificar Censo</strong> para subirlos sin sobrescribir a otros residentes.
                    </p>
                  </div>
                </div>
              </div>

              {isInstallable && (
                <div className="p-3.5 rounded-xl bg-teal-600 text-white flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold">
                    Tu navegador permite instalar la aplicación directamente con un clic:
                  </div>
                  <button
                    type="button"
                    onClick={install}
                    className="px-3.5 py-2 rounded-lg bg-white text-teal-900 font-bold text-xs shrink-0 hover:bg-teal-50 cursor-pointer"
                  >
                    Instalar Ahora
                  </button>
                </div>
              )}

              {isInIframe && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                  <div className="font-bold text-amber-950 text-xs">
                    Paso 1: Abre el enlace directo de tu App en una pestaña completa
                  </div>
                  <p className="text-[11px] text-amber-900">
                    Por seguridad del navegador, la instalación en pantalla de inicio o escritorio requiere abrir el enlace publicado directamente en Chrome, Edge o Safari (fuera de la vista previa):
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={window.location.origin}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-amber-300 text-[11px] font-mono text-slate-700"
                    />
                    <button
                      type="button"
                      onClick={handleCopyUrl}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs cursor-pointer shrink-0"
                    >
                      {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedUrl ? 'Copiado' : 'Copiar URL'}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2.5">
                <div className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Cómo instalarla según tu dispositivo:
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-800 text-xs">
                    • Android (Chrome) / PC o Mac (Chrome o Edge)
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Abre la URL de la app y toca el ícono <strong>Instalar aplicación</strong> en la barra de direcciones (o menú <strong>⋮ → Instalar aplicación / Agregar a la pantalla principal</strong>).
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-800 text-xs">
                    • iPhone / iPad (Safari){isIOS ? ' — Detectado en este dispositivo' : ''}
                  </div>
                  <p className="text-[11px] text-slate-600">
                    1. Abre la URL en <strong>Safari</strong>.<br />
                    2. Toca el botón <strong>Compartir</strong> (cuadro con flecha hacia arriba) en la barra inferior.<br />
                    3. Desliza hacia abajo y selecciona <strong>Agregar a pantalla de inicio</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Service Worker Offline Activo</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
