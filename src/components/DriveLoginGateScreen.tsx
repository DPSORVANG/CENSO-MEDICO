import React, { useState, useRef } from 'react';
import {
  Cloud,
  ShieldCheck,
  Hospital,
  WifiOff,
  FlaskConical,
  AlertCircle,
  Copy,
  Check,
  Upload,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import {
  googleSignIn,
  getFirebaseProjectId,
  setWorkspaceMode,
} from '../utils/googleDriveSync.ts';
import {
  setActiveAccountNamespace,
  resetDemoDataInCurrentNamespace,
  importFullBackup,
} from '../utils/storage.ts';

interface DriveLoginGateScreenProps {
  onAuthenticatedWithDrive: (accessToken: string, email: string, displayName: string) => Promise<void>;
  onEnterLocalMode: () => void;
  onEnterDemoMode: () => void;
}

export const DriveLoginGateScreen: React.FC<DriveLoginGateScreenProps> = ({
  onAuthenticatedWithDrive,
  onEnterLocalMode,
  onEnterDemoMode,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isUnauthorizedDomain, setIsUnauthorizedDomain] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentDomain =
    typeof window !== 'undefined' ? window.location.hostname || 'localhost' : 'localhost';
  const firebaseProjectId = getFirebaseProjectId();

  const handleDriveSignIn = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setIsUnauthorizedDomain(false);
    setStatusText('Autenticando con Google Drive...');
    try {
      const res = await googleSignIn();
      if (res) {
        setStatusText('Descargando censo institucional desde Google Drive...');
        await onAuthenticatedWithDrive(
          res.accessToken,
          res.user.email || res.user.uid,
          res.user.displayName || res.user.email || 'Servicio Médico'
        );
      }
    } catch (e: any) {
      const code = e?.code || '';
      const msg = e?.message || '';
      if (code === 'auth/unauthorized-domain' || msg.includes('auth/unauthorized-domain')) {
        setIsUnauthorizedDomain(true);
        setErrorMsg(
          `El dominio actual (${currentDomain}) requiere autorizarse una sola vez en Firebase Console para permitir el inicio de sesión con Google.`
        );
      } else if (code !== 'auth/popup-closed-by-user') {
        setErrorMsg(msg || 'No se pudo iniciar sesión con Google Drive.');
      }
    } finally {
      setIsLoading(false);
      setStatusText(null);
    }
  };

  const handleStartCleanLocal = () => {
    setActiveAccountNamespace('local');
    setWorkspaceMode('local');
    onEnterLocalMode();
  };

  const handleStartDemo = () => {
    setActiveAccountNamespace('demo');
    setWorkspaceMode('demo');
    resetDemoDataInCurrentNamespace();
    onEnterDemoMode();
  };

  const handleImportFileDirectly = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const text = await file.text();
      setActiveAccountNamespace('local');
      setWorkspaceMode('local');
      const result = importFullBackup(text);
      if (!result.success) {
        throw new Error(result.message);
      }
      onEnterLocalMode();
    } catch (err: any) {
      setErrorMsg(err?.message || 'El archivo seleccionado no es un respaldo válido.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Top Institutional Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-teal-950/60 to-slate-900 p-6 sm:p-8 border-b border-slate-800 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-inner">
            <Hospital className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-950/90 border border-teal-800 text-teal-300 text-[10px] font-mono uppercase tracking-wider">
              <Cloud className="w-3 h-3" />
              <span>Censo Clínico Basado en Google Drive</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              ResiMed MI • Acceso Institucional
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
              Inicia sesión con la cuenta de Google Drive de tu hospital o servicio médico. Toda la información se guarda directamente en tu Drive y se actualiza simultáneamente sin cruzar datos entre instituciones.
            </p>
          </div>
        </div>

        {/* Main Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Primary Action: Google Drive Sign In */}
          <div className="bg-slate-950/80 border border-teal-500/30 rounded-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-teal-500/15 text-teal-400 shrink-0 mt-0.5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1 text-xs">
                <h2 className="font-bold text-white text-sm">
                  1. Conectar Cuenta de Google Drive del Servicio
                </h2>
                <p className="text-slate-400 leading-relaxed">
                  Al iniciar sesión, la aplicación lee y edita directamente el archivo{' '}
                  <code className="text-teal-300 font-mono">ResiMed-Censo-MI.json</code> en tu Google Drive. Si eliminas, ingresas o editas un paciente, el cambio se guarda en Drive como fuente única de verdad.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDriveSignIn}
              disabled={isLoading}
              className="w-full py-3 px-5 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-xl shadow-lg flex items-center justify-center gap-3 text-xs sm:text-sm transition-all cursor-pointer disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
                  <span>{statusText || 'Conectando con Google Drive...'}</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  <span>Iniciar Sesión con Google Drive</span>
                </>
              )}
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span>Censo propio por cuenta</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span>Bajas definitivas en vivo</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span>Soporte fuera de línea</span>
              </div>
            </div>
          </div>

          {/* Error & Unauthorized Domain Assistant */}
          {errorMsg && (
            <div className="p-4 bg-rose-950/50 border border-rose-800/80 rounded-2xl space-y-3 text-xs text-rose-200">
              <div className="flex items-start gap-2 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>

              {isUnauthorizedDomain && (
                <div className="p-3 bg-slate-900 rounded-xl border border-rose-800/60 text-slate-300 space-y-2 text-[11px]">
                  <p className="font-bold text-white">
                    Autoriza este dominio en Firebase en 3 pasos:
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5">
                    <li>
                      Copia este dominio:
                      <div className="mt-1 flex items-center gap-2">
                        <code className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg font-mono font-bold text-teal-300">
                          {currentDomain}
                        </code>
                        <button
                          type="button"
                          onClick={async () => {
                            await navigator.clipboard.writeText(currentDomain);
                            setCopiedDomain(true);
                            setTimeout(() => setCopiedDomain(false), 2000);
                          }}
                          className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                        >
                          {copiedDomain ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>¡Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copiar dominio</span>
                            </>
                          )}
                        </button>
                      </div>
                    </li>
                    <li>
                      Abre{' '}
                      <a
                        href={`https://console.firebase.google.com/project/${firebaseProjectId}/authentication/settings`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal-400 font-bold underline"
                      >
                        Firebase Console → Authentication → Settings → Dominios autorizados
                      </a>
                    </li>
                    <li>
                      Haz clic en <strong>Add domain</strong>, pega <code>{currentDomain}</code> y guarda.
                    </li>
                  </ol>
                </div>
              )}
            </div>
          )}

          {/* Secondary Options: Clean Offline Local Mode, Import File, or Demo Mode */}
          <div className="pt-2 border-t border-slate-800 space-y-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block text-center">
              Opciones sin conexión o para pruebas locales
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={handleStartCleanLocal}
                className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-left space-y-1 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                  <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                  <span>Censo Local Limpio</span>
                </div>
                <p className="text-[10.5px] text-slate-400 leading-snug">
                  Inicia en blanco (0 pacientes) sin internet y sincroniza después.
                </p>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-left space-y-1 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                  <Upload className="w-3.5 h-3.5 text-teal-400" />
                  <span>Abrir Archivo .JSON</span>
                </div>
                <p className="text-[10.5px] text-slate-400 leading-snug">
                  Carga un archivo <code>ResiMed-Censo-MI.json</code> guardado en tu equipo.
                </p>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportFileDirectly}
                className="hidden"
              />

              <button
                type="button"
                onClick={handleStartDemo}
                className="p-3 rounded-xl bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/40 text-left space-y-1 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-purple-200">
                  <FlaskConical className="w-3.5 h-3.5 text-purple-400" />
                  <span>Prueba de Estrés (100 Pacientes)</span>
                </div>
                <p className="text-[10.5px] text-purple-300/80 leading-snug">
                  Carga 100 pacientes clínicos completos con labs, estudios, antibióticos y notas.
                </p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
