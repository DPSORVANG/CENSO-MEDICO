import React, { useState, useEffect, useRef } from 'react';
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
  Copy,
  Check,
  FileJson,
  Download,
  Upload,
  Trash2,
} from 'lucide-react';
import {
  googleSignIn,
  googleLogout,
  getAccessToken,
  getSavedDriveUser,
  findDriveCensusFile,
  downloadCensusFromDrive,
  saveCensusToDrive,
  DriveFileInfo,
  getFirebaseProjectId,
} from '../utils/googleDriveSync.ts';
import {
  BackupPackage,
  savePatients,
  saveNotes,
  loadPatients,
  loadNotes,
  loadDeletedPatients,
  saveDeletedPatients,
  clearAllPatientsInCurrentNamespace,
  normalizePatientRecord,
} from '../utils/storage.ts';
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
  onDriveSessionChanged?: () => void;
  onAuthenticatedWithDrive?: (accessToken: string, email: string, displayName: string) => Promise<void>;
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
  onDriveSessionChanged,
  onAuthenticatedWithDrive,
  showToast,
  isOnline = true,
}) => {
  const [savedUser, setSavedUser] = useState(() => getSavedDriveUser());
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isUnauthorizedDomainError, setIsUnauthorizedDomainError] = useState<boolean>(false);
  const [copiedDomain, setCopiedDomain] = useState<boolean>(false);
  const [driveFileInfo, setDriveFileInfo] = useState<DriveFileInfo | null>(null);
  const [pendingMutations, setPendingMutations] = useState<OfflineMutation[]>([]);
  const [lastSyncResult, setLastSyncResult] = useState<MergeStats | null>(null);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const fileMergeInputRef = useRef<HTMLInputElement | null>(null);

  const currentDomain =
    typeof window !== 'undefined' ? window.location.hostname || 'localhost' : 'localhost';
  const firebaseProjectId = getFirebaseProjectId();

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: 'pull' | 'upload' | 'clear_all';
    title: string;
    description: string;
  }>({
    isOpen: false,
    type: 'pull',
    title: '',
    description: '',
  });

  useEffect(() => {
    if (!isOpen) return;

    setPendingMutations(getPendingMutations());
    setSavedUser(getSavedDriveUser());

    const checkToken = async () => {
      const token = await getAccessToken();
      if (token) {
        setAccessToken(token);
        if (isOnline) {
          fetchDriveFileInfo(token);
        }
      } else {
        setAccessToken(null);
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
      if (e?.message === 'DRIVE_TOKEN_EXPIRED') {
        setAccessToken(null);
        setErrorMsg('La sesión de Google Drive expiró. Vuelve a iniciar sesión para sincronizar.');
      } else {
        console.error('Error al consultar Drive:', e);
        setErrorMsg(e.message || 'No se pudo consultar Google Drive.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setIsUnauthorizedDomainError(false);
    try {
      const res = await googleSignIn();
      if (res) {
        const email = res.user.email || res.user.uid;
        const displayName = res.user.displayName || email;
        setSavedUser({ email, displayName, uid: res.user.uid });
        setAccessToken(res.accessToken);
        if (onAuthenticatedWithDrive) {
          await onAuthenticatedWithDrive(res.accessToken, email, displayName);
        }
        await fetchDriveFileInfo(res.accessToken);
        showToast(`Conectado a Google Drive (${email}) • Sincronización simultánea activa`);
      }
    } catch (e: any) {
      const code = e?.code || '';
      const msg = e?.message || '';
      if (code === 'auth/unauthorized-domain' || msg.includes('auth/unauthorized-domain')) {
        setIsUnauthorizedDomainError(true);
        setErrorMsg(
          `El dominio actual (${currentDomain}) aún no está autorizado en Firebase Authentication para iniciar sesión con Google.`
        );
      } else {
        setErrorMsg(msg || 'Error al autenticar con Google');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await googleLogout();
    setSavedUser(null);
    setAccessToken(null);
    setDriveFileInfo(null);
    showToast('Sesión de Google Drive cerrada.');
    if (onDriveSessionChanged) {
      onDriveSessionChanged();
    }
    onClose();
  };

  // Pull latest authoritative state from Google Drive (or push if no file in Drive yet)
  const executeAuthoritativeSyncWithDrive = async () => {
    if (!accessToken) return;
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const now = new Date().toISOString();
      const existingFile = await findDriveCensusFile(accessToken);

      if (existingFile) {
        const downloadResult = await downloadCensusFromDrive(existingFile.id, accessToken);
        const remotePkg = downloadResult.data;
        const pending = getPendingMutations();

        if (pending.length === 0) {
          // No offline pending mutations: Google Drive is 100% authoritative!
          const remoteTombstones = remotePkg.deletedPatientIds || {};
          saveDeletedPatients(remoteTombstones);
          const cleanRemotePatients = (remotePkg.patients || []).map(normalizePatientRecord);
          savePatients(cleanRemotePatients);
          saveNotes(remotePkg.notes || []);
          setLastSyncTime(now);
          setLastSyncResult({
            addedRemotePatients: 0,
            addedLocalPatients: 0,
            updatedPatients: cleanRemotePatients.length,
            addedNotes: 0,
            totalPatients: cleanRemotePatients.length,
            totalNotes: (remotePkg.notes || []).length,
            timestamp: now,
          });
          onDataSynced();
          await fetchDriveFileInfo(accessToken);
          showToast(
            `¡Censo actualizado desde Google Drive! (${cleanRemotePatients.length} pacientes activos en Drive)`
          );
        } else {
          // Had offline changes: reconcile offline mutations with Drive and upload
          const localPackage: BackupPackage = {
            version: '2.0.0',
            exportDate: now,
            residentAuthor: profile.name,
            patients: loadPatients(),
            notes: loadNotes(),
            deletedPatientIds: loadDeletedPatients(),
            integrityHash: '',
          };
          const { merged, stats } = mergeCensusData(localPackage, remotePkg, profile.name);
          savePatients(merged.patients);
          saveNotes(merged.notes);
          await saveCensusToDrive(merged, accessToken);
          clearPendingMutations();
          setPendingMutations([]);
          setLastSyncTime(now);
          setLastSyncResult(stats);
          onDataSynced();
          await fetchDriveFileInfo(accessToken);
          showToast(
            `¡Cambios fuera de línea sincronizados con Google Drive! (${stats.totalPatients} pacientes activos)`
          );
        }
      } else {
        // First time creating file in Drive
        const initialPkg: BackupPackage = {
          version: '2.0.0',
          exportDate: now,
          residentAuthor: profile.name,
          patients: loadPatients(),
          notes: loadNotes(),
          deletedPatientIds: loadDeletedPatients(),
          profile,
          integrityHash: generateAuditHash('DRIVE-INIT', now, `${patients.length}:${notes.length}`),
        };
        await saveCensusToDrive(initialPkg, accessToken);
        clearPendingMutations();
        setPendingMutations([]);
        setLastSyncTime(now);
        await fetchDriveFileInfo(accessToken);
        showToast('¡Archivo ResiMed-Censo-MI.json creado en tu Google Drive!');
      }
    } catch (e: any) {
      console.error('Error en sincronización con Drive:', e);
      setErrorMsg(e.message || 'Error al sincronizar con Google Drive.');
    } finally {
      setIsLoading(false);
    }
  };

  // Overwrite Google Drive with current screen state
  const executeUploadToDrive = async () => {
    if (!accessToken) return;
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const now = new Date().toISOString();
      const backupData: BackupPackage = {
        version: '2.0.0',
        exportDate: now,
        residentAuthor: profile.name,
        patients: loadPatients(),
        notes: loadNotes(),
        deletedPatientIds: loadDeletedPatients(),
        profile,
        integrityHash: generateAuditHash('DRIVE-SYNC', now, `${patients.length}:${notes.length}`),
      };

      await saveCensusToDrive(backupData, accessToken);
      clearPendingMutations();
      setPendingMutations([]);
      setLastSyncTime(now);
      await fetchDriveFileInfo(accessToken);
      showToast('¡Estado actual de esta pantalla guardado como definitivo en Google Drive!');
    } catch (e: any) {
      console.error('Error al subir a Drive:', e);
      setErrorMsg(e.message || 'Error al guardar en Google Drive.');
    } finally {
      setIsLoading(false);
    }
  };

  // Clear ALL patients in local & Google Drive (to start completely empty with 0 patients)
  const executeClearAllPatientsInDrive = async () => {
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const updatedTombstones = clearAllPatientsInCurrentNamespace();
      clearPendingMutations();
      setPendingMutations([]);
      const now = new Date().toISOString();

      if (accessToken && isOnline) {
        const emptyPackage: BackupPackage = {
          version: '2.0.0',
          exportDate: now,
          residentAuthor: profile.name,
          patients: [],
          notes: loadNotes(),
          deletedPatientIds: updatedTombstones,
          profile,
          integrityHash: generateAuditHash('DRIVE-CLEAR', now, `0:${notes.length}`),
        };
        await saveCensusToDrive(emptyPackage, accessToken);
        await fetchDriveFileInfo(accessToken);
      }

      setLastSyncTime(now);
      onDataSynced();
      showToast('¡Censo vaciado por completo (0 pacientes) en este dispositivo y en Google Drive!');
    } catch (e: any) {
      setErrorMsg(e.message || 'Error al vaciar el censo en Google Drive.');
    } finally {
      setIsLoading(false);
    }
  };

  // Direct Smart Merge via local/shared JSON file
  const handleExportSharedCensusFile = () => {
    const localPatients = loadPatients();
    const localNotes = loadNotes();
    const deletedPatientIds = loadDeletedPatients();
    const now = new Date().toISOString();
    const pkg: BackupPackage = {
      version: '2.0.0',
      exportDate: now,
      residentAuthor: profile.name,
      patients: localPatients,
      notes: localNotes,
      deletedPatientIds,
      profile,
      integrityHash: generateAuditHash(
        'SHARED-MERGE',
        now,
        `${localPatients.length}:${localNotes.length}`
      ),
    };
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ResiMed-Censo-MI.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Archivo ResiMed-Censo-MI.json descargado.');
  };

  const handleMergeFromSelectedFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const text = await file.text();
      const remotePackage = JSON.parse(text) as BackupPackage;
      if (!remotePackage.patients || !Array.isArray(remotePackage.patients)) {
        throw new Error('El archivo seleccionado no tiene un formato de censo ResiMed válido.');
      }
      const localPatients = loadPatients();
      const localNotes = loadNotes();
      const deletedPatientIds = loadDeletedPatients();
      const now = new Date().toISOString();
      const localPackage: BackupPackage = {
        version: '2.0.0',
        exportDate: now,
        residentAuthor: profile.name,
        patients: localPatients,
        notes: localNotes,
        deletedPatientIds,
        integrityHash: generateAuditHash(
          'LOCAL-PKG',
          now,
          `${localPatients.length}:${localNotes.length}`
        ),
      };

      const { merged, stats } = mergeCensusData(localPackage, remotePackage, profile.name);
      savePatients(merged.patients);
      saveNotes(merged.notes);
      if (accessToken && isOnline) {
        await saveCensusToDrive(merged, accessToken);
      }
      clearPendingMutations();
      setPendingMutations([]);
      setLastSyncTime(now);
      setLastSyncResult(stats);
      onDataSynced();
      showToast(
        `¡Censo actualizado desde archivo! (${stats.totalPatients} pacientes activos)`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al procesar el archivo JSON seleccionado.');
    } finally {
      setIsLoading(false);
      if (fileMergeInputRef.current) {
        fileMergeInputRef.current.value = '';
      }
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
                  Google Drive Institucional (Fuente Única de Verdad)
                </h2>
                <span className="bg-teal-950 text-teal-300 border border-teal-800 text-[10px] px-2 py-0.5 rounded-full font-mono">
                  En Tiempo Real
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Cada cuenta de Google Drive mantiene su propio censo aislado. Todo cambio o baja se guarda directamente en Drive.
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
                  {isOnline
                    ? 'Sincronización Simultánea en Línea Activa'
                    : 'Modo Fuera de Línea (Sin Internet)'}
                </span>
                <span className="text-[11px] opacity-90">
                  {isOnline
                    ? 'Cualquier paciente ingresado, editado o eliminado se actualiza automáticamente en Google Drive.'
                    : 'Tus cambios se guardan localmente y se subirán a Google Drive al recuperar la conexión.'}
                </span>
              </div>
            </div>
          </div>

          {/* Connection Card */}
          {!accessToken ? (
            <div className="text-center p-8 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-teal-500/10 text-teal-500 flex items-center justify-center">
                <Cloud className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Iniciar Sesión en Google Drive Institucional
                </h3>
                <p className="text-slate-500 text-xs">
                  Conecta la cuenta de Google Drive de tu hospital o servicio para cargar y editar su censo exclusivo (
                  <code className="text-teal-600 dark:text-teal-400 font-semibold">ResiMed-Censo-MI.json</code>).
                </p>
              </div>

              <div className="pt-2 flex justify-center">
                <button
                  onClick={handleLogin}
                  disabled={isLoading || !isOnline}
                  className="flex items-center gap-3 px-6 py-2.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 rounded-xl font-semibold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
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
                  <span>{isLoading ? 'Conectando...' : 'Iniciar sesión con Google Drive'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Account Card */}
              <div className="p-3.5 bg-teal-50/50 dark:bg-teal-950/20 rounded-2xl border border-teal-200 dark:border-teal-900/60 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center text-xs">
                    {savedUser?.displayName?.[0] || savedUser?.email?.[0] || 'G'}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {savedUser?.displayName || 'Cuenta Institucional Google Drive'}
                      </span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                    </div>
                    <span className="text-slate-500 text-[11px] font-mono">
                      {savedUser?.email}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => accessToken && fetchDriveFileInfo(accessToken)}
                    disabled={isLoading || !isOnline}
                    className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                    title="Verificar estado en Google Drive"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-teal-500' : ''}`} />
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1 px-2.5 py-1 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 rounded-lg border border-rose-200 dark:border-rose-900/40 transition-colors font-semibold text-[11px] cursor-pointer"
                    title="Cerrar sesión para cambiar a la cuenta de otra institución"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Cambiar Cuenta / Salir</span>
                  </button>
                </div>
              </div>

              {/* Primary Action Card: AUTHORITATIVE REAL-TIME DRIVE SYNC */}
              <div className="p-4 bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950/30 dark:to-emerald-950/20 rounded-2xl border-2 border-teal-500/40 space-y-3 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 bg-teal-600 text-white rounded-lg">
                        <GitMerge className="w-4 h-4" />
                      </span>
                      <h3 className="font-extrabold text-slate-900 dark:text-white text-xs">
                        Sincronización Directa en Tiempo Real con Google Drive
                      </h3>
                      <span className="bg-emerald-100 text-emerald-800 text-[9.5px] px-1.5 py-0.2 rounded font-black">
                        AUTO-SYNC ACTIVO
                      </span>
                      {pendingMutations.length > 0 && (
                        <span className="bg-amber-100 text-amber-800 text-[9.5px] px-1.5 py-0.2 rounded font-black">
                          {pendingMutations.length} CAMBIO(S) FUERA DE LÍNEA PENDIENTE(S)
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                      Tu censo vive directamente en Google Drive. Cuando borras, ingresas o editas un paciente en línea, se guarda de inmediato en Drive y las demás computadoras conectadas a esta cuenta actualizan su pantalla automáticamente cada 4 segundos.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-teal-200/80 dark:border-teal-800/60">
                  <div className="text-[11px] text-slate-500">
                    {lastSyncStr ? (
                      <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                        <History className="w-3.5 h-3.5 text-teal-600" />
                        Última actualización con Drive:{' '}
                        <strong className="font-mono">
                          {new Date(lastSyncStr).toLocaleTimeString('es-MX', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}{' '}
                          hrs
                        </strong>
                      </span>
                    ) : (
                      <span>Sincronización continua activa</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={executeAuthoritativeSyncWithDrive}
                      disabled={isLoading || !isOnline}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl font-bold shadow-md shadow-teal-600/25 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <ArrowRightLeft className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                      <span>Actualizar desde Drive Ahora</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Last Sync Stats Report */}
              {lastSyncResult && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Estado actual del censo en Google Drive:</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10.5px] text-slate-700 dark:text-slate-300">
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 block text-[9.5px]">Pacientes en Drive</span>
                      <strong className="text-teal-600 font-bold text-xs">{lastSyncResult.totalPatients}</strong>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 block text-[9.5px]">Notas Archivadas</span>
                      <strong className="text-purple-600 font-bold text-xs">{lastSyncResult.totalNotes}</strong>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 block text-[9.5px]">Archivo en Nube</span>
                      <strong className="text-emerald-600 font-bold text-xs">
                        {driveFileInfo ? 'ResiMed-Censo-MI.json' : 'Sincronizado'}
                      </strong>
                    </div>
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
                  {showAdvanced
                    ? 'Ocultar opciones avanzadas de control de Drive'
                    : 'Ver opciones avanzadas (Sobrescribir Drive o Vaciar Censo en 0 pacientes)'}
                </button>
              </div>

              {showAdvanced && (
                <div className="p-3.5 bg-slate-100 dark:bg-slate-800 rounded-xl space-y-2.5 border border-slate-200 dark:border-slate-700">
                  <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300 block">
                    Control Autoritativo sobre Google Drive:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        setConfirmDialog({
                          isOpen: true,
                          type: 'upload',
                          title: '¿Guardar esta pantalla como única versión en Google Drive?',
                          description:
                            'Esto reemplazará el archivo de Google Drive exactamente con los pacientes que ves ahora en esta pantalla.',
                        })
                      }
                      className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[10.5px] font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <CloudUpload className="w-3.5 h-3.5" />
                      <span>Forzar Subida de Esta Pantalla a Drive</span>
                    </button>

                    <button
                      onClick={() =>
                        setConfirmDialog({
                          isOpen: true,
                          type: 'clear_all',
                          title: '¿Vaciar todos los pacientes del censo en Google Drive?',
                          description:
                            'Esto eliminará todos los pacientes actuales (incluyendo cualquier paciente de prueba previo) y dejará el censo de esta cuenta de Google Drive completamente limpio en 0 pacientes para todas las computadoras.',
                        })
                      }
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10.5px] font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Vaciar Censo en Drive (Dejar en 0 pacientes)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 rounded-2xl border border-rose-200 dark:border-rose-900/60 space-y-2.5">
              <div className="flex items-start gap-2 font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{errorMsg}</span>
              </div>

              {isUnauthorizedDomainError && (
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-800/80 text-slate-700 dark:text-slate-300 space-y-2 text-[11px]">
                  <p className="font-bold text-slate-900 dark:text-white">
                    ¿Por qué aparece <code>auth/unauthorized-domain</code>?
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-[11px]">
                    <li>
                      Copia este dominio exacto:
                      <div className="mt-1 flex items-center gap-2">
                        <code className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-teal-700 dark:text-teal-300">
                          {currentDomain}
                        </code>
                        <button
                          type="button"
                          onClick={async () => {
                            await navigator.clipboard.writeText(currentDomain);
                            setCopiedDomain(true);
                            setTimeout(() => setCopiedDomain(false), 2000);
                          }}
                          className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer"
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
                      Entra a{' '}
                      <a
                        href={`https://console.firebase.google.com/project/${firebaseProjectId}/authentication/settings`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal-600 dark:text-teal-400 font-bold underline"
                      >
                        Firebase Console → Authentication → Settings → Dominios autorizados
                      </a>{' '}
                      y agrégalo.
                    </li>
                  </ol>
                </div>
              )}
            </div>
          )}

          {/* Universal Smart Merge by File */}
          <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileJson className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                    Respaldo / Sincronización Directa por Archivo (.JSON)
                  </h4>
                  <p className="text-[10.5px] text-slate-500">
                    También puedes descargar o cargar el archivo <code>ResiMed-Censo-MI.json</code> manualmente.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleExportSharedCensusFile}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-[11px] cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-teal-600" />
                <span>Exportar Censo (ResiMed-Censo-MI.json)</span>
              </button>
              <input
                ref={fileMergeInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleMergeFromSelectedFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileMergeInputRef.current?.click()}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-[11px] shadow-xs cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Cargar / Fusionar Archivo .json</span>
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <PWAInstallButton variant="full" />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-850 p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Sincronización Institucional Basada en Google Drive v2.0
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
                {confirmDialog.type === 'upload' ? (
                  <CloudUpload className="w-5 h-5" />
                ) : confirmDialog.type === 'clear_all' ? (
                  <Trash2 className="w-5 h-5 text-rose-500" />
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
                  confirmDialog.type === 'upload'
                    ? executeUploadToDrive
                    : confirmDialog.type === 'clear_all'
                    ? executeClearAllPatientsInDrive
                    : executeAuthoritativeSyncWithDrive
                }
                className={`px-4 py-2 text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer ${
                  confirmDialog.type === 'clear_all'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-teal-600 hover:bg-teal-700'
                }`}
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
