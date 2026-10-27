import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  X,
  GitMerge,
  Wifi,
  WifiOff,
  History,
  ArrowRightLeft,
  Sparkles,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  googleSignIn,
  googleLogout,
  getAccessToken,
  findDriveCensusFile,
  downloadCensusFromDrive,
  saveCensusToDrive,
  DriveFileInfo,
} from '../utils/googleDriveSync.ts';
import { BackupPackage, savePatients, saveNotes, loadPatients, loadNotes } from '../utils/storage.ts';
import { Patient, ClinicalNoteRecord, ResidentProfile } from '../types/clinical.ts';
import { generateAuditHash } from '../utils/clinicalLogic.ts';
import {
  mergeCensusData,
  getPendingMutations,
  clearPendingMutations,
  getLastSyncTime,
  setLastSyncTime,
  MergeStats,
  OfflineMutation,
} from '../utils/syncEngine.ts';
import { PWAInstallButton } from './PWAInstallButton.tsx';

interface GoogleDriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  notes: ClinicalNoteRecord[];
  profile: ResidentProfile;
  isAdmin: boolean;
  onRequestAdminMode: () => void;
  onDataSynced: () => void;
  showToast: (msg: string) => void;
  isOnline?: boolean;
}

export const GoogleDriveSyncModal: React.FC<GoogleDriveSyncModalProps> = ({
  isOpen,
  onClose,
  patients,
  notes,
  profile,
  onDataSynced,
  showToast,
  isOnline = true,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [driveFileInfo, setDriveFileInfo] = useState<DriveFileInfo | null>(null);
  const [pendingMutations, setPendingMutations] = useState<OfflineMutation[]>([]);
  const [lastSyncResult, setLastSyncResult] = useState<MergeStats | null>(null);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Confirmation dialog state for Drive actions
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: 'merge' | 'upload' | 'download';
    title: string;
    description: string;
    previewCount?: { patients: number; notes: number };
  }>({
    isOpen: false,
    type: 'merge',
    title: '',
    description: '',
  });

  // Check auth state and pending mutations on mount/open
  useEffect(() => {
    if (!isOpen) return;

    setPendingMutations(getPendingMutations());

    const checkToken = async () => {
      const token = await getAccessToken();
      if (token) {
        setAccessToken(token);
        if (isOnline) {
          fetchDriveFileInfo(token);
        }
      }
    };
    checkToken();
  }, [isOpen, isOnline]);

  const fetchDriveFileInfo = async (token: string) => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const file = await findDriveCensusFile(token);
      setDriveFileInfo(file);
    } catch (e: any) {
      console.error('Error al consultar Drive:', e);
      setErrorMsg(e.message || 'No se pudo consultar Google Drive.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setCurrentUser(res.user);
        setAccessToken(res.accessToken);
        await fetchDriveFileInfo(res.accessToken);
        showToast(`Conectado a Google Drive como ${res.user.displayName || res.user.email}`);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error al autenticar con Google');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await googleLogout();
    setCurrentUser(null);
    setAccessToken(null);
    setDriveFileInfo(null);
    showToast('Sesión de Google Drive cerrada');
  };

  // 1. Primary Action: Smart Bidirectional Merge
  const requestSmartMerge = () => {
    setConfirmDialog({
      isOpen: true,
      type: 'merge',
      title: '¿Sincronizar y Fusionar Censo (Smart Merge)?',
      description:
        'Esta acción inteligente unificará los datos de esta computadora con la versión de Google Drive. Los ingresos de pacientes de tus compañeros se agregarán a tu lista, tus nuevos pacientes se subirán a la nube y los cambios a un mismo paciente (nuevos labs, notas, recetas o tags) se combinarán sin borrar el trabajo de nadie.',
      previewCount: { patients: patients.length, notes: notes.length },
    });
  };

  const executeSmartMerge = async () => {
    if (!accessToken) return;
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const localPatients = loadPatients();
      const localNotes = loadNotes();
      const now = new Date().toISOString();

      const localPackage: BackupPackage = {
        version: '1.1.0',
        exportDate: now,
        residentAuthor: profile.name,
        patients: localPatients,
        notes: localNotes,
        integrityHash: generateAuditHash('LOCAL-PKG', now, `${localPatients.length}:${localNotes.length}`),
      };

      let remotePackage: BackupPackage;
      const existingFile = await findDriveCensusFile(accessToken);

      if (existingFile) {
        const downloadResult = await downloadCensusFromDrive(existingFile.id, accessToken);
        remotePackage = downloadResult.data;
      } else {
        // First time uploading
        remotePackage = {
          version: '1.1.0',
          exportDate: now,
          residentAuthor: profile.name,
          patients: [],
          notes: [],
          integrityHash: '',
        };
      }

      // Execute smart merge
      const { merged, stats } = mergeCensusData(localPackage, remotePackage, profile.name);

      // Persist merged data locally
      savePatients(merged.patients);
      saveNotes(merged.notes);

      // Persist merged data to Google Drive
      await saveCensusToDrive(merged, accessToken);

      // Clear mutation queue and record sync time
      clearPendingMutations();
      setPendingMutations([]);
      setLastSyncTime(now);
      setLastSyncResult(stats);

      // Notify parent to refresh patient state
      onDataSynced();
      await fetchDriveFileInfo(accessToken);

      showToast(
        `¡Fusión exitosa! +${stats.addedRemotePatients} pacientes nuevos importados, ${stats.updatedPatients} actualizados y ${stats.totalPatients} totales en censo.`
      );
    } catch (e: any) {
      console.error('Error en Smart Merge:', e);
      setErrorMsg(e.message || 'Error al ejecutar la fusión inteligente con Google Drive.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Emergency Upload
  const executeUploadToDrive = async () => {
    if (!accessToken) return;
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const now = new Date().toISOString();
      const backupData: BackupPackage = {
        version: '1.1.0',
        exportDate: now,
        residentAuthor: profile.name,
        patients,
        notes,
        integrityHash: generateAuditHash('DRIVE-SYNC', now, `${patients.length}:${notes.length}`),
      };

      const result = await saveCensusToDrive(backupData, accessToken);
      clearPendingMutations();
      setPendingMutations([]);
      setLastSyncTime(now);
      await fetchDriveFileInfo(accessToken);
      showToast(
        result.isNew
          ? '¡Censo creado exitosamente en Google Drive!'
          : '¡Censo subido a Google Drive!'
      );
    } catch (e: any) {
      console.error('Error al subir a Drive:', e);
      setErrorMsg(e.message || 'Error al guardar en Google Drive.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Emergency Download
  const executeDownloadFromDrive = async () => {
    if (!accessToken || !driveFileInfo) return;
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const result = await downloadCensusFromDrive(driveFileInfo.id, accessToken);
      const pkg = result.data;
      if (pkg.patients && Array.isArray(pkg.patients)) {
        savePatients(pkg.patients);
        if (pkg.notes && Array.isArray(pkg.notes)) {
          saveNotes(pkg.notes);
        }
        clearPendingMutations();
        setPendingMutations([]);
        onDataSynced();
        showToast(`Censo descargado: ${pkg.patients.length} pacientes cargados desde Drive.`);
      } else {
        throw new Error('El archivo de Drive no contiene pacientes válidos.');
      }
    } catch (e: any) {
      console.error('Error al descargar de Drive:', e);
      setErrorMsg(e.message || 'Error al cargar desde Google Drive.');
    } finally {
      setIsLoading(false);
    }
  };

  const lastSyncStr = getLastSyncTime();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-teal-500/20 text-teal-400 border border-teal-500/30 rounded-2xl">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Sincronización Hospitalaria y Modo Fuera de Línea
                </h2>
                <span className="bg-teal-950 text-teal-300 border border-teal-800 text-[10px] px-2 py-0.5 rounded-full font-mono">
                  Smart Merge
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Trabaja sin conexión cuando caiga el internet y unifica los ingresos de todas las computadoras al reconectar.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs">
          {/* Network Status Banner */}
          <div
            className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
              isOnline
                ? 'bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {isOnline ? (
                <Wifi className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <WifiOff className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
              )}
              <div>
                <span className="font-bold text-xs block">
                  {isOnline ? 'Conexión a Red Hospitalaria Activa' : 'Modo Fuera de Línea (Sin Internet)'}
                </span>
                <span className="text-[11px] opacity-90">
                  {isOnline
                    ? 'Listo para fusionar y actualizar el censo con Google Drive.'
                    : 'Puedes seguir ingresando pacientes y notas; tus cambios se guardan localmente y se fusionarán al volver la red.'}
                </span>
              </div>
            </div>

            {pendingMutations.length > 0 && (
              <span className="bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-md font-bold text-[10.5px] shrink-0">
                {pendingMutations.length} cambios pendientes
              </span>
            )}
          </div>

          {/* Connection Card */}
          {!accessToken ? (
            <div className="text-center p-8 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-teal-500/10 text-teal-500 flex items-center justify-center">
                <Cloud className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Conectar con Google Drive
                </h3>
                <p className="text-slate-500 text-xs">
                  Inicia sesión una vez para activar la sincronización y fusión automática del archivo{' '}
                  <code className="text-teal-600 dark:text-teal-400 font-semibold">ResiMed-Censo-MI.json</code>.
                </p>
              </div>

              <div className="pt-2 flex justify-center">
                <button
                  onClick={handleLogin}
                  disabled={isLoading || !isOnline}
                  className="flex items-center gap-3 px-6 py-2.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 rounded-xl font-semibold text-xs shadow-xs transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 48 48">
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
                  <span>{isLoading ? 'Conectando...' : 'Iniciar sesión con Google'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Account Card */}
              <div className="p-3.5 bg-teal-50/50 dark:bg-teal-950/20 rounded-2xl border border-teal-200 dark:border-teal-900/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center text-xs">
                    {currentUser?.displayName?.[0] || currentUser?.email?.[0] || 'G'}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {currentUser?.displayName || 'Usuario Google'}
                      </span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                    </div>
                    <span className="text-slate-500 text-[11px]">{currentUser?.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => accessToken && fetchDriveFileInfo(accessToken)}
                    disabled={isLoading || !isOnline}
                    className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                    title="Actualizar estado de Drive"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-teal-500' : ''}`} />
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1 px-2.5 py-1 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 rounded-lg border border-rose-200 dark:border-rose-900/40 transition-colors font-semibold text-[11px] cursor-pointer"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Desconectar</span>
                  </button>
                </div>
              </div>

              {/* Primary Action Card: SMART BIDIRECTIONAL MERGE */}
              <div className="p-4 bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950/30 dark:to-emerald-950/20 rounded-2xl border-2 border-teal-500/40 space-y-3 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 bg-teal-600 text-white rounded-lg">
                        <GitMerge className="w-4 h-4" />
                      </span>
                      <h3 className="font-extrabold text-slate-900 dark:text-white text-xs">
                        Fusión Inteligente Bidireccional (Smart Merge)
                      </h3>
                      <span className="bg-emerald-100 text-emerald-800 text-[9.5px] px-1.5 py-0.2 rounded font-black">
                        CERO PÉRDIDA DE DATOS
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                      Si tú o tus compañeros trabajaron sin internet o en computadoras distintas, esta opción une todos los ingresos y cambios en un censo único sin sobrescribir el trabajo de nadie.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-teal-200/80 dark:border-teal-800/60">
                  <div className="text-[11px] text-slate-500">
                    {lastSyncStr ? (
                      <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                        <History className="w-3.5 h-3.5 text-teal-600" />
                        Última sincronización:{' '}
                        <strong className="font-mono">
                          {new Date(lastSyncStr).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} hrs
                        </strong>
                      </span>
                    ) : (
                      <span>Pendiente de primera sincronización</span>
                    )}
                  </div>

                  <button
                    onClick={requestSmartMerge}
                    disabled={isLoading || !isOnline}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl font-bold shadow-md shadow-teal-600/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  >
                    <ArrowRightLeft className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>Sincronizar y Fusionar Censo</span>
                  </button>
                </div>
              </div>

              {/* Last Sync Stats Report */}
              {lastSyncResult && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-1.5 animate-in fade-in">
                  <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Resultado de la última fusión de datos:</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10.5px] text-slate-700 dark:text-slate-300">
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 block text-[9.5px]">Pacientes Totales</span>
                      <strong className="text-teal-600 font-bold text-xs">{lastSyncResult.totalPatients}</strong>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 block text-[9.5px]">Nuevos de Otras PC</span>
                      <strong className="text-emerald-600 font-bold text-xs">+{lastSyncResult.addedRemotePatients}</strong>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 block text-[9.5px]">Pacientes Actualizados</span>
                      <strong className="text-indigo-600 font-bold text-xs">{lastSyncResult.updatedPatients}</strong>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 block text-[9.5px]">Notas Preservadas</span>
                      <strong className="text-purple-600 font-bold text-xs">{lastSyncResult.totalNotes}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Pending Offline Changes List (if any) */}
              {pendingMutations.length > 0 && (
                <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    <span>Cambios realizados pendientes de consolidar ({pendingMutations.length}):</span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">
                      Se unirán al presionar Fusionar
                    </span>
                  </div>
                  <div className="max-h-24 overflow-y-auto space-y-1 text-[10px] text-slate-600 dark:text-slate-400">
                    {pendingMutations.slice(0, 5).map((m) => (
                      <div key={m.id} className="flex items-center justify-between bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-200 dark:border-slate-800">
                        <span>• {m.description}</span>
                        <span className="text-slate-400 text-[9px] font-mono">
                          {new Date(m.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                    {pendingMutations.length > 5 && (
                      <div className="text-slate-400 italic text-center text-[9.5px]">
                        y {pendingMutations.length - 5} cambios más...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Advanced Controls Toggle */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-[11px] underline cursor-pointer"
                >
                  {showAdvanced ? 'Ocultar opciones avanzadas' : 'Ver opciones de respaldo manual / forzado'}
                </button>
              </div>

              {showAdvanced && (
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl space-y-2 border border-slate-200 dark:border-slate-700">
                  <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300 block">
                    Opciones de Emergencia (Sobrescritura):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        setConfirmDialog({
                          isOpen: true,
                          type: 'upload',
                          title: '¿Forzar sobrescritura en Google Drive?',
                          description:
                            '¡Advertencia! Esto reemplazará el archivo en la nube con los datos de esta computadora. Usa Smart Merge preferentemente.',
                        })
                      }
                      className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-[10.5px] font-semibold hover:bg-slate-300 cursor-pointer"
                    >
                      Forzar Subida Completa
                    </button>
                    <button
                      onClick={() =>
                        setConfirmDialog({
                          isOpen: true,
                          type: 'download',
                          title: '¿Forzar descarga completa desde Google Drive?',
                          description:
                            '¡Advertencia! Esto reemplazará los datos de esta computadora con la versión de Google Drive. Usa Smart Merge preferentemente.',
                        })
                      }
                      className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-[10.5px] font-semibold hover:bg-slate-300 cursor-pointer"
                    >
                      Forzar Descarga Completa
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-900/50 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <PWAInstallButton variant="full" />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-850 p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Protocolo de reconciliación determinista ResiMed Sync v1.1.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-750 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-slate-900 dark:text-white">
              <div className="p-2.5 rounded-xl bg-teal-500/20 text-teal-400">
                {confirmDialog.type === 'merge' ? (
                  <GitMerge className="w-5 h-5" />
                ) : confirmDialog.type === 'upload' ? (
                  <CloudUpload className="w-5 h-5" />
                ) : (
                  <CloudDownload className="w-5 h-5" />
                )}
              </div>
              <h3 className="font-bold text-sm">{confirmDialog.title}</h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {confirmDialog.description}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={
                  confirmDialog.type === 'merge'
                    ? executeSmartMerge
                    : confirmDialog.type === 'upload'
                    ? executeUploadToDrive
                    : executeDownloadFromDrive
                }
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer"
              >
                Confirmar y Proceder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
