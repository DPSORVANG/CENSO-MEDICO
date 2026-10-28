import { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header.tsx';
import { CensusDashboard } from './components/CensusDashboard.tsx';
import { PrintableCensus } from './components/PrintableCensus.tsx';
import { PatientDetailModal } from './components/PatientDetailModal.tsx';
import { NoteGeneratorModal } from './components/NoteGeneratorModal.tsx';
import { MedicalCalculatorsModal } from './components/MedicalCalculatorsModal.tsx';
import { BackupVaultModal } from './components/BackupVaultModal.tsx';
import { PinLockScreen } from './components/PinLockScreen.tsx';
import { PatientFormModal } from './components/PatientFormModal.tsx';
import { AdminAuthModal } from './components/AdminAuthModal.tsx';
import { GoogleDriveSyncModal } from './components/GoogleDriveSyncModal.tsx';
import { DirectLabStudyModal } from './components/DirectLabStudyModal.tsx';
import { TagSelectorModal } from './components/TagSelectorModal.tsx';
import { GlobalSettingsModal, SettingsTabKey } from './components/GlobalSettingsModal.tsx';
import { DriveLoginGateScreen } from './components/DriveLoginGateScreen.tsx';
import {
  Patient,
  ClinicalNoteRecord,
  ResidentProfile,
  LabRecord,
  DiagnosticStudy,
  ClinicalPending,
} from './types/clinical.ts';
import {
  generateAuditHash,
  advancePendingWorkflow,
} from './utils/clinicalLogic.ts';
import {
  loadPatients,
  savePatients,
  loadNotes,
  saveNotes,
  loadProfile,
  saveProfile,
  loadDeletedPatients,
  saveDeletedPatients,
  recordDeletedPatient,
  unmarkDeletedPatient,
  exportFullBackup,
  setActiveAccountNamespace,
  resetDemoDataInCurrentNamespace,
  clearAllPatientsInCurrentNamespace,
  normalizePatientRecord,
  BackupPackage,
} from './utils/storage.ts';
import {
  mergeCensusData,
  recordOfflineMutation,
  getPendingMutations,
  clearPendingMutations,
  setLastSyncTime,
} from './utils/syncEngine.ts';
import {
  getAccessToken,
  getSavedDriveUser,
  getWorkspaceMode,
  setWorkspaceMode,
  WorkspaceMode,
  findDriveCensusFile,
  downloadCensusFromDrive,
  saveCensusToDrive,
} from './utils/googleDriveSync.ts';
import { WifiOff, GitMerge, Cloud, LogOut, FlaskConical, Trash2 } from 'lucide-react';

export default function App() {
  const [workspaceMode, setWorkspaceModeState] = useState<WorkspaceMode>(() => getWorkspaceMode());
  const [patients, setPatients] = useState<Patient[]>(() => loadPatients());
  const [notes, setNotes] = useState<ClinicalNoteRecord[]>(() => loadNotes());
  const [profile, setProfile] = useState<ResidentProfile>(() => loadProfile());
  const [currentTab, setCurrentTab] = useState<'census' | 'printable' | 'vault'>('census');
  const [isCalculatorOpen, setIsCalculatorOpen] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    const prof = loadProfile();
    return prof.activeRole !== 'intern';
  });

  // Admin authorization modal for protected hospital actions (Delete, Discharge, Vault reset)
  const [adminAuthModal, setAdminAuthModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    action: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    action: () => {},
  });

  // Modals state
  const [selectedPatientForDetail, setSelectedPatientForDetail] = useState<Patient | null>(null);
  const [selectedPatientForNote, setSelectedPatientForNote] = useState<Patient | null>(null);
  const [isPatientFormOpen, setIsPatientFormOpen] = useState<boolean>(false);
  const [patientToEdit, setPatientToEdit] = useState<Patient | null>(null);
  const [isDriveSyncOpen, setIsDriveSyncOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Direct Lab / Study Modal
  const [isDirectLabStudyOpen, setIsDirectLabStudyOpen] = useState<boolean>(false);
  const [selectedPatientForLabStudy, setSelectedPatientForLabStudy] = useState<Patient | null>(null);

  // Tag Selector Modal
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState<boolean>(false);
  const [selectedPatientForTags, setSelectedPatientForTags] = useState<Patient | null>(null);

  // Global Settings Modal (Catalogs, Services, Attending Physicians & Custom Colors)
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTabKey>('institution');

  // Mobile & Tablet App-Style Slide-Over Drawer State
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);

  // Network state and simultaneous live-sync tracking
  const [isOnline, setIsOnline] = useState<boolean>(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingChangesCount, setPendingChangesCount] = useState<number>(() => getPendingMutations().length);
  const isSyncingRef = useRef<boolean>(false);
  const lastDriveModifiedTimeRef = useRef<string | null>(null);
  const livePushTimeoutRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  }, []);

  // Direct Authoritative Push to Google Drive when an online user modifies or deletes data
  // This writes the current local state directly to Google Drive as the new truth without union-merging old Drive patients back.
  const pushAuthoritativeStateToDrive = useCallback(
    async (
      authoritativePatients?: Patient[],
      authoritativeNotes?: ClinicalNoteRecord[],
      authoritativeDeleted?: Record<string, string>
    ) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      const token = await getAccessToken();
      if (!token) return;

      if (isSyncingRef.current) {
        // Re-schedule slightly later if another network call is in flight
        if (livePushTimeoutRef.current) window.clearTimeout(livePushTimeoutRef.current);
        livePushTimeoutRef.current = window.setTimeout(() => {
          pushAuthoritativeStateToDrive(authoritativePatients, authoritativeNotes, authoritativeDeleted);
        }, 400);
        return;
      }

      try {
        isSyncingRef.current = true;
        setIsSyncing(true);

        const now = new Date().toISOString();
        const pts = authoritativePatients ?? loadPatients();
        const nts = authoritativeNotes ?? loadNotes();
        const del = authoritativeDeleted ?? loadDeletedPatients();

        const pkg: BackupPackage = {
          version: '1.1.0',
          exportDate: now,
          residentAuthor: profile.name,
          patients: pts,
          notes: nts,
          deletedPatientIds: del,
          integrityHash: generateAuditHash('authoritative-push', now.split('T')[0], `pts:${pts.length}`),
        };

        const uploadRes = await saveCensusToDrive(pkg, token);
        lastDriveModifiedTimeRef.current = uploadRes.updatedTime || now;
        clearPendingMutations();
        setPendingChangesCount(0);
        setLastSyncTime(now);
      } catch (e: any) {
        console.warn('Error al guardar cambio directo en Google Drive:', e);
      } finally {
        isSyncingRef.current = false;
        setIsSyncing(false);
      }
    },
    [profile.name]
  );

  // Schedule an authoritative push whenever a local change is made while online
  const scheduleAuthoritativeDrivePush = useCallback(
    (
      delayMs = 350,
      overridePatients?: Patient[],
      overrideNotes?: ClinicalNoteRecord[],
      overrideDeleted?: Record<string, string>
    ) => {
      if (typeof window === 'undefined') return;
      if (livePushTimeoutRef.current) {
        window.clearTimeout(livePushTimeoutRef.current);
      }
      livePushTimeoutRef.current = window.setTimeout(() => {
        pushAuthoritativeStateToDrive(overridePatients, overrideNotes, overrideDeleted);
      }, delayMs);
    },
    [pushAuthoritativeStateToDrive]
  );

  // Live Polling / Reconciliation from Google Drive (Every 4 seconds & on Window Focus / Reconnect)
  const syncWithDriveRemote = useCallback(
    async (options?: { forceCheck?: boolean; silent?: boolean }) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      if (isSyncingRef.current) return;

      const token = await getAccessToken();
      if (!token) return;

      try {
        isSyncingRef.current = true;
        setIsSyncing(true);

        const driveFile = await findDriveCensusFile(token);
        const pendingLocal = getPendingMutations();
        const hasPendingLocalMutations = pendingLocal.length > 0;
        const remoteModified = driveFile?.modifiedTime || null;

        // If the remote file hasn't changed since our last read/write and we have no offline mutations, do nothing
        if (
          !options?.forceCheck &&
          !hasPendingLocalMutations &&
          driveFile &&
          lastDriveModifiedTimeRef.current &&
          remoteModified === lastDriveModifiedTimeRef.current
        ) {
          return;
        }

        const now = new Date().toISOString();

        if (!driveFile) {
          // No file on Drive yet: create it with current local state
          const initialPkg: BackupPackage = {
            version: '1.1.0',
            exportDate: now,
            residentAuthor: profile.name,
            patients: loadPatients(),
            notes: loadNotes(),
            deletedPatientIds: loadDeletedPatients(),
            integrityHash: '',
          };
          const uploadRes = await saveCensusToDrive(initialPkg, token);
          lastDriveModifiedTimeRef.current = uploadRes.updatedTime || now;
          clearPendingMutations();
          setPendingChangesCount(0);
          setLastSyncTime(now);
          return;
        }

        // Download latest remote snapshot from Drive (with cache: 'no-store' in googleDriveSync.ts)
        const remote = await downloadCensusFromDrive(driveFile.id, token);
        const remotePackage = remote.data;

        if (!hasPendingLocalMutations) {
          // AUTHORITATIVE PULL: This station had no offline edits pending, so Google Drive is 100% authoritative truth!
          // Any patient deleted or edited on another station is immediately reflected here and never resurrected.
          const remoteDeleted = remotePackage.deletedPatientIds || {};
          const normalizedRemotePatients = (remotePackage.patients || [])
            .filter((p) => !remoteDeleted[p.id])
            .map(normalizePatientRecord);
          const remoteNotes = remotePackage.notes || [];

          const prevCount = loadPatients().length;
          saveDeletedPatients(remoteDeleted);
          savePatients(normalizedRemotePatients);
          saveNotes(remoteNotes);
          setPatients(normalizedRemotePatients);
          setNotes(remoteNotes);

          setSelectedPatientForDetail((prev) => {
            if (!prev) return null;
            return normalizedRemotePatients.find((p) => p.id === prev.id) || null;
          });
          setSelectedPatientForNote((prev) => {
            if (!prev) return null;
            return normalizedRemotePatients.find((p) => p.id === prev.id) || null;
          });

          lastDriveModifiedTimeRef.current = remote.modifiedTime || remoteModified || now;
          setLastSyncTime(now);

          if (!options?.silent) {
            showToast(
              `¡Censo actualizado desde Google Drive! (${normalizedRemotePatients.length} pacientes activos)`
            );
          } else if (prevCount !== normalizedRemotePatients.length) {
            showToast(
              `Sincronización en vivo desde Drive: ${normalizedRemotePatients.length} paciente(s) activo(s).`
            );
          }
        } else {
          // OFFLINE RECONNECT MERGE: We had offline mutations while disconnected, merge them with Drive respecting tombstones
          const currentLocal: BackupPackage = {
            version: '1.1.0',
            exportDate: now,
            residentAuthor: profile.name,
            patients: loadPatients(),
            notes: loadNotes(),
            deletedPatientIds: loadDeletedPatients(),
            integrityHash: '',
          };

          const { merged, stats } = mergeCensusData(currentLocal, remotePackage, profile.name);
          if (merged.deletedPatientIds) {
            saveDeletedPatients(merged.deletedPatientIds);
          }
          savePatients(merged.patients);
          saveNotes(merged.notes);
          setPatients(merged.patients);
          setNotes(merged.notes);

          setSelectedPatientForDetail((prev) => {
            if (!prev) return null;
            return merged.patients.find((p) => p.id === prev.id) || null;
          });
          setSelectedPatientForNote((prev) => {
            if (!prev) return null;
            return merged.patients.find((p) => p.id === prev.id) || null;
          });

          const uploadRes = await saveCensusToDrive(merged, token);
          lastDriveModifiedTimeRef.current = uploadRes.updatedTime || now;
          clearPendingMutations();
          setPendingChangesCount(0);
          setLastSyncTime(now);

          if (!options?.silent) {
            showToast(
              `¡Cambios fuera de línea sincronizados con Drive! (${stats.totalPatients} pacientes activos)`
            );
          }
        }
      } catch (e: any) {
        console.warn('Aviso en sincronización simultánea:', e);
      } finally {
        isSyncingRef.current = false;
        setIsSyncing(false);
      }
    },
    [profile.name, showToast]
  );

  // Handler when the user signs into Google Drive from DriveLoginGateScreen or GoogleDriveSyncModal
  const handleAuthenticatedWithDrive = useCallback(
    async (accessToken: string, email: string, displayName: string) => {
      setActiveAccountNamespace(email || 'drive_default');
      setWorkspaceMode('drive');
      setWorkspaceModeState('drive');

      const now = new Date().toISOString();
      const driveFile = await findDriveCensusFile(accessToken);

      if (driveFile) {
        // Download the institution's census from Google Drive as 100% authoritative truth
        const remote = await downloadCensusFromDrive(driveFile.id, accessToken);
        const remoteDeleted = remote.data.deletedPatientIds || {};
        const remotePatients = (remote.data.patients || [])
          .filter((p) => !remoteDeleted[p.id])
          .map(normalizePatientRecord);
        const remoteNotes = remote.data.notes || [];

        saveDeletedPatients(remoteDeleted);
        savePatients(remotePatients);
        saveNotes(remoteNotes);
        clearPendingMutations();
        setPendingChangesCount(0);
        setPatients(remotePatients);
        setNotes(remoteNotes);
        lastDriveModifiedTimeRef.current = remote.modifiedTime || driveFile.modifiedTime || now;
        setLastSyncTime(now);

        showToast(
          `Conectado a Google Drive (${email || displayName}): ${remotePatients.length} paciente(s) cargado(s).`
        );
      } else {
        // Brand new Google Drive account with no census file yet: initialize a clean 0-patient census in Drive
        saveDeletedPatients({});
        savePatients([]);
        saveNotes([]);
        clearPendingMutations();
        setPendingChangesCount(0);
        setPatients([]);
        setNotes([]);

        const cleanPackage: BackupPackage = {
          version: '1.1.0',
          exportDate: now,
          residentAuthor: displayName || profile.name,
          patients: [],
          notes: [],
          deletedPatientIds: {},
          integrityHash: generateAuditHash('init-clean-drive', now.split('T')[0], 'pts:0'),
        };
        const created = await saveCensusToDrive(cleanPackage, accessToken);
        lastDriveModifiedTimeRef.current = created.updatedTime || now;
        setLastSyncTime(now);

        showToast(
          `Nuevo censo institucional creado en Google Drive (${email || displayName}) con 0 pacientes.`
        );
      }
    },
    [profile.name, showToast]
  );

  // Reload data from current namespace
  const handleReloadData = useCallback(() => {
    setWorkspaceModeState(getWorkspaceMode());
    setPatients(loadPatients());
    setNotes(loadNotes());
    const prof = loadProfile();
    setProfile(prof);
    setIsAdmin(prof.activeRole !== 'intern');
    setPendingChangesCount(getPendingMutations().length);
  }, []);

  const handleLoad100StressTestPatients = useCallback(() => {
    resetDemoDataInCurrentNamespace();
    const loadedPts = loadPatients();
    const loadedNts = loadNotes();
    setPatients(loadedPts);
    setNotes(loadedNts);
    scheduleAuthoritativeDrivePush(300, loadedPts, loadedNts, {});
    showToast(`🧪 Prueba de estrés activada: ${loadedPts.length} pacientes clínicos completos cargados.`);
  }, [scheduleAuthoritativeDrivePush, showToast]);

  const handleClearAllPatients = useCallback(() => {
    clearAllPatientsInCurrentNamespace();
    setPatients([]);
    setNotes([]);
    scheduleAuthoritativeDrivePush(300, [], [], loadDeletedPatients());
    showToast('🧹 Censo vaciado a 0 pacientes.');
  }, [scheduleAuthoritativeDrivePush, showToast]);

  // Initialize data & cross-tab storage synchronization
  useEffect(() => {
    // Auto-seed the 100 stress-test patients once so the user can immediately test all features with 100 patients
    if (typeof window !== 'undefined' && localStorage.getItem('resimed_stress_test_100_autoseed_v1') !== 'done') {
      localStorage.setItem('resimed_stress_test_100_autoseed_v1', 'done');
      if (!getWorkspaceMode()) {
        setActiveAccountNamespace('demo');
        setWorkspaceMode('demo');
      }
      resetDemoDataInCurrentNamespace();
    }

    handleReloadData();

    // If already in 'drive' workspace mode with a valid token on startup, pull authoritative state from Drive immediately
    if (getWorkspaceMode() === 'drive' && navigator.onLine) {
      syncWithDriveRemote({ forceCheck: true, silent: true });
    }

    const handleCrossTabStorage = () => {
      setPatients(loadPatients());
      setNotes(loadNotes());
      setPendingChangesCount(getPendingMutations().length);
    };
    window.addEventListener('storage', handleCrossTabStorage);
    return () => window.removeEventListener('storage', handleCrossTabStorage);
  }, [handleReloadData, syncWithDriveRemote]);

  // Online / Offline Detection + Continuous Simultaneous Polling (Every 4s & on Window Focus)
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      showToast('¡Conexión restablecida! Sincronizando censo con Google Drive...');
      await syncWithDriveRemote({ forceCheck: true, silent: false });
    };

    const handleOffline = () => {
      setIsOnline(false);
      showToast('⚡ Sin conexión a internet. Modo fuera de línea activo: tus cambios se guardan localmente.');
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        syncWithDriveRemote({ silent: true });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    const pollInterval = window.setInterval(() => {
      if (navigator.onLine) {
        syncWithDriveRemote({ silent: true });
      }
    }, 4000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.clearInterval(pollInterval);
    };
  }, [syncWithDriveRemote, showToast]);

  const requireAdminAuth = (title: string, description: string, action: () => void) => {
    if (isAdmin) {
      action();
    } else {
      setAdminAuthModal({
        isOpen: true,
        title,
        description,
        action: () => {
          setAdminAuthModal((prev) => ({ ...prev, isOpen: false }));
          action();
        },
      });
    }
  };

  const handleUpdatePatient = (updated: Patient) => {
    const withTimestamp: Patient = {
      ...updated,
      lastUpdated: new Date().toISOString(),
    };
    setPatients((prev) => {
      const next = prev.map((p) => (p.id === withTimestamp.id ? withTimestamp : p));
      savePatients(next);
      return next;
    });
    recordOfflineMutation('patient_updated', withTimestamp.id, `Actualizado ${withTimestamp.name} (${withTimestamp.bed})`);
    setPendingChangesCount(getPendingMutations().length);
    scheduleAuthoritativeDrivePush(350);
    if (selectedPatientForDetail?.id === withTimestamp.id) {
      setSelectedPatientForDetail(withTimestamp);
    }
    if (selectedPatientForNote?.id === withTimestamp.id) {
      setSelectedPatientForNote(withTimestamp);
    }
    if (patientToEdit?.id === withTimestamp.id) {
      setPatientToEdit(withTimestamp);
    }
  };

  const handleSavePatient = (savedPatient: Patient, generatedHistoryText?: string) => {
    // If re-admitting or explicitly saving a patient, clear any prior deletion tombstone for this ID
    unmarkDeletedPatient(savedPatient.id, savedPatient.recordNumber);
    const withTimestamp: Patient = {
      ...savedPatient,
      lastUpdated: new Date().toISOString(),
    };
    setPatients((prev) => {
      const exists = prev.some((p) => p.id === withTimestamp.id);
      let next: Patient[];
      if (exists) {
        next = prev.map((p) => (p.id === withTimestamp.id ? withTimestamp : p));
        showToast(`Paciente ${withTimestamp.name} actualizado.`);
        recordOfflineMutation('patient_updated', withTimestamp.id, `Actualización de ${withTimestamp.name} (${withTimestamp.bed})`);
      } else {
        next = [withTimestamp, ...prev];
        showToast(`Nuevo paciente ${withTimestamp.name} ingresado a ${withTimestamp.bed}.`);
        recordOfflineMutation('patient_created', withTimestamp.id, `Ingreso de ${withTimestamp.name} en ${withTimestamp.bed}`);
      }
      savePatients(next);
      return next;
    });

    if (generatedHistoryText && generatedHistoryText.trim()) {
      const today = new Date().toISOString().split('T')[0];
      const time = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      const auditHash = generateAuditHash(
        withTimestamp.id,
        today,
        `${profile.name}:${generatedHistoryText}`
      );

      const admissionNote: ClinicalNoteRecord = {
        id: `note-hc-${Date.now()}`,
        patientId: withTimestamp.id,
        patientName: withTimestamp.name,
        bed: withTimestamp.bed,
        service: profile.service || 'Medicina Interna',
        date: today,
        time,
        noteType: 'Nota de Ingreso',
        content: generatedHistoryText,
        auditHash,
        residentAuthor: profile.name,
        createdAtTimestamp: Date.now(),
      };

      setNotes((prev) => {
        const updatedNotes = [admissionNote, ...prev];
        saveNotes(updatedNotes);
        return updatedNotes;
      });
      recordOfflineMutation('note_created', admissionNote.id, `Nota de ingreso para ${withTimestamp.name}`);
      showToast(`Historia Clínica NOM-004 archivada en bóveda (${auditHash.slice(0, 14)}...)`);
    }

    setPendingChangesCount(getPendingMutations().length);
    scheduleAuthoritativeDrivePush(300);
  };

  // 4-Stage Chained Pending Workflow handler
  const handleTogglePending = (patientId: string, pendingId: string) => {
    let stageFeedback: string | null = null;
    setPatients((prev) => {
      const updated = prev.map((p) => {
        if (p.id !== patientId) return p;
        const updatedPendings = p.pendings.map((pen) => {
          if (pen.id !== pendingId) return pen;
          const { updatedPending: nextPen, nextStageReached } = advancePendingWorkflow(pen);
          if (nextStageReached === 'collect') {
            stageFeedback = `Paso 2/3 activado: ${nextPen.text}`;
          } else if (nextStageReached === 'register_census') {
            stageFeedback = `Paso 3/3 activado: ${nextPen.text} (Usa "+ Lab/Imagen" para capturar resultados)`;
          } else if (nextStageReached === 'done') {
            stageFeedback = `Pendiente completado: ${pen.text}`;
          }
          return nextPen;
        });
        return { ...p, pendings: updatedPendings, lastUpdated: new Date().toISOString() };
      });
      savePatients(updated);
      return updated;
    });
    recordOfflineMutation('patient_updated', patientId, 'Pendiente actualizado');
    setPendingChangesCount(getPendingMutations().length);
    scheduleAuthoritativeDrivePush(400);
    if (stageFeedback) {
      showToast(stageFeedback);
    }
  };

  // Add Quick Pending from Census Card or Checklist
  const handleAddQuickPending = (patientId: string, newPending: ClinicalPending) => {
    setPatients((prev) => {
      const updated = prev.map((p) => {
        if (p.id !== patientId) return p;
        return {
          ...p,
          pendings: [newPending, ...p.pendings],
          lastUpdated: new Date().toISOString(),
        };
      });
      savePatients(updated);
      return updated;
    });
    recordOfflineMutation('patient_updated', patientId, `Nuevo pendiente: ${newPending.text}`);
    setPendingChangesCount(getPendingMutations().length);
    scheduleAuthoritativeDrivePush(400);
    showToast(`Pendiente agregado: ${newPending.text}`);
  };

  const handleDischargePatient = (patient: Patient) => {
    requireAdminAuth(
      `Autorizar Egreso de ${patient.name}`,
      `El egreso hospitalario de la cama ${patient.bed} requiere autorización de Administrador. Ingrese el PIN Maestro para continuar.`,
      () => {
        const updated: Patient = {
          ...patient,
          status: 'discharged',
          dischargeDate: new Date().toISOString().split('T')[0],
          lastUpdated: new Date().toISOString(),
        };
        handleUpdatePatient(updated);
        showToast(`Egreso registrado para ${patient.name} (${patient.bed}). Se conservará 5 días antes de depurarse.`);
      }
    );
  };

  const handleDeletePatient = (patient: Patient) => {
    requireAdminAuth(
      `Eliminar Paciente ${patient.name} (${patient.bed})`,
      `Esta acción eliminará permanentemente el registro del paciente en Google Drive y en todas las estaciones conectadas. Ingrese el PIN Maestro de Administrador para autorizar.`,
      () => {
        // Record deletion tombstone so other computers and Google Drive never resurrect this patient
        const deletedAt = new Date().toISOString();
        recordDeletedPatient(patient.id, patient.recordNumber, deletedAt);
        const updatedDeletedMap = loadDeletedPatients();
        const newPatients = patients.filter((p) => p.id !== patient.id);
        setPatients(newPatients);
        savePatients(newPatients);
        recordOfflineMutation(
          'patient_deleted',
          patient.id,
          `Baja definitiva de ${patient.name} (${patient.bed})`
        );
        setPendingChangesCount(getPendingMutations().length);
        // Push authoritative state without the deleted patient immediately to Google Drive
        scheduleAuthoritativeDrivePush(100, newPatients, notes, updatedDeletedMap);
        showToast(`Paciente ${patient.name} eliminado permanentemente del censo y de Google Drive.`);
        if (selectedPatientForDetail?.id === patient.id) {
          setSelectedPatientForDetail(null);
        }
      }
    );
  };

  const handleRequestAdminMode = () => {
    requireAdminAuth(
      'Desbloquear Modo Administrador',
      'Ingrese el PIN Maestro para activar permisos completos de edición, configuración y eliminación en esta estación.',
      () => {
        setIsAdmin(true);
        const updated: ResidentProfile = { ...profile, activeRole: 'admin' };
        setProfile(updated);
        saveProfile(updated);
        showToast('Estación en Modo Administrador (acceso total).');
      }
    );
  };

  const handleSwitchToInternMode = () => {
    setIsAdmin(false);
    const updated: ResidentProfile = { ...profile, activeRole: 'intern' };
    setProfile(updated);
    saveProfile(updated);
    showToast('Estación en Modo Usuario: borrado, egreso y ajustes críticos protegidos por PIN.');
  };

  const handleUpdateProfileName = (newName: string) => {
    const updated: ResidentProfile = { ...profile, name: newName };
    setProfile(updated);
    saveProfile(updated);
    showToast(`Usuario activo actualizado: ${newName}`);
  };

  const handleSaveNote = (newNote: ClinicalNoteRecord) => {
    setNotes((prev) => {
      const updatedNotes = [newNote, ...prev];
      saveNotes(updatedNotes);
      return updatedNotes;
    });
    recordOfflineMutation('note_created', newNote.patientId, `Nota ${newNote.noteType} para ${newNote.patientName}`);
    setPendingChangesCount(getPendingMutations().length);
    scheduleAuthoritativeDrivePush(400);
    showToast(`Nota respaldada en bóveda (${newNote.auditHash.slice(0, 14)}...)`);
  };

  const handleSaveDirectLab = (patientId: string, lab: LabRecord) => {
    const updated = patients.map((p) => {
      if (p.id !== patientId) return p;
      const updatedPendings = p.pendings.map((pen) =>
        !pen.completed && pen.workflowStage === 'register_census' && pen.category === 'Laboratorio'
          ? { ...pen, completed: true, workflowStage: 'done' as const }
          : pen
      );
      return {
        ...p,
        labs: [lab, ...p.labs],
        pendings: updatedPendings,
        lastUpdated: new Date().toISOString(),
      };
    });
    setPatients(updated);
    savePatients(updated);
    const target = updated.find((p) => p.id === patientId);
    if (target && selectedPatientForDetail?.id === patientId) {
      setSelectedPatientForDetail(target);
    }
    recordOfflineMutation('lab_added', patientId, `Laboratorio para ${target?.name || 'paciente'}`);
    setPendingChangesCount(getPendingMutations().length);
    scheduleAuthoritativeDrivePush(400, updated);
    showToast(`⚡ Laboratorio registrado como NUEVO (Pendiente de integrar a Nota) para ${target?.name || 'paciente'}.`);
  };

  const handleSaveDirectStudy = (patientId: string, study: DiagnosticStudy) => {
    const updated = patients.map((p) => {
      if (p.id !== patientId) return p;
      const currentStudies = p.studies || [];
      const updatedPendings = p.pendings.map((pen) =>
        !pen.completed &&
        pen.workflowStage === 'register_census' &&
        (pen.category === 'Imagen/Gabinete' || pen.category === 'Interconsulta')
          ? { ...pen, completed: true, workflowStage: 'done' as const }
          : pen
      );
      return {
        ...p,
        studies: [study, ...currentStudies],
        pendings: updatedPendings,
        lastUpdated: new Date().toISOString(),
      };
    });
    setPatients(updated);
    savePatients(updated);
    const target = updated.find((p) => p.id === patientId);
    if (target && selectedPatientForDetail?.id === patientId) {
      setSelectedPatientForDetail(target);
    }
    recordOfflineMutation('study_added', patientId, `Estudio ${study.title} para ${target?.name || 'paciente'}`);
    setPendingChangesCount(getPendingMutations().length);
    scheduleAuthoritativeDrivePush(400, updated);
    showToast(`⚡ Estudio de ${study.category} registrado como NUEVO (Pendiente de integrar a Nota).`);
  };

  const handleUpdatePatientTags = (patientId: string, tags: string[]) => {
    const updated = patients.map((p) => {
      if (p.id !== patientId) return p;
      return {
        ...p,
        clinicalTags: tags,
        lastUpdated: new Date().toISOString(),
      };
    });
    setPatients(updated);
    savePatients(updated);
    const target = updated.find((p) => p.id === patientId);
    if (target && selectedPatientForDetail?.id === patientId) {
      setSelectedPatientForDetail(target);
    }
    if (target && selectedPatientForTags?.id === patientId) {
      setSelectedPatientForTags(target);
    }
    recordOfflineMutation('patient_updated', patientId, 'Etiquetas clínicas modificadas');
    setPendingChangesCount(getPendingMutations().length);
    scheduleAuthoritativeDrivePush(400, updated);
    showToast('Etiquetas clínicas actualizadas.');
  };

  const handleAddNewTagToCatalog = (newTag: string) => {
    const catalog = profile.availableTags || [];
    if (!catalog.includes(newTag)) {
      const pendingTags = profile.pendingUserTags || [];
      const updatedProfile: ResidentProfile = {
        ...profile,
        availableTags: [...catalog, newTag],
        pendingUserTags: !isAdmin && !pendingTags.includes(newTag) ? [...pendingTags, newTag] : pendingTags,
      };
      setProfile(updatedProfile);
      saveProfile(updatedProfile);
      showToast(
        isAdmin
          ? `Etiqueta "${newTag}" agregada permanentemente al catálogo.`
          : `Etiqueta "${newTag}" activada y enviada a revisión del Administrador.`
      );
    }
  };

  const handleQuickBackup = () => {
    const jsonStr = exportFullBackup();
    setProfile(loadProfile());
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `ResiMed-Respaldo-${today}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Respaldo JSON diario descargado con éxito.');
  };

  const handleAssignAttendingPhysician = (
    patientId: string | null,
    doctorName: string,
    isNewDoctor?: boolean
  ) => {
    const cleanDoc = doctorName.trim();
    if (isNewDoctor && cleanDoc) {
      const currentList = profile.attendingPhysiciansCatalog || [
        'Dr. Roberto Méndez (MI)',
        'Dra. Patricia Vega (MI)',
        'Dr. Carlos Navarro (UCI)',
        'Dra. Sofía Alarcón (MI)',
        'Dr. Alejandro Ríos (Urgencias)',
      ];
      if (!currentList.includes(cleanDoc)) {
        const updatedProfile = {
          ...profile,
          attendingPhysiciansCatalog: [...currentList, cleanDoc],
        };
        setProfile(updatedProfile);
        saveProfile(updatedProfile);
      }
    }

    if (patientId) {
      const target = patients.find((p) => p.id === patientId);
      if (target) {
        const updatedPatient: Patient = {
          ...target,
          attendingPhysician: cleanDoc || undefined,
          lastUpdated: new Date().toISOString(),
        };
        handleUpdatePatient(updatedPatient);
        showToast(
          cleanDoc
            ? `Médico a cargo de ${target.bed}: ${cleanDoc}`
            : `Médico a cargo sin asignar en ${target.bed}`
        );
      }
    } else if (cleanDoc) {
      showToast(`Nuevo médico a cargo registrado: ${cleanDoc}`);
    }
  };

  // If the station has not logged into an institution's Google Drive or chosen an operating mode yet,
  // display the Institutional Google Drive Login Gate Screen so different hospitals/devices never mix data.
  if (!workspaceMode) {
    return (
      <DriveLoginGateScreen
        onAuthenticatedWithDrive={handleAuthenticatedWithDrive}
        onEnterLocalMode={() => {
          handleReloadData();
          showToast('Censo Local Limpio iniciado (0 pacientes). Puedes conectar Google Drive cuando gustes.');
        }}
        onEnterDemoMode={() => {
          handleReloadData();
          showToast('Modo Demostración cargado con 3 pacientes de prueba aislados.');
        }}
      />
    );
  }

  const activePatients = patients.filter((p) => p.status === 'active');
  const savedDriveUser = getSavedDriveUser();

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* PIN Lock Overlay */}
      {isLocked && (
        <PinLockScreen
          profile={profile}
          onUnlock={() => setIsLocked(false)}
        />
      )}

      {/* Compact Sticky Main Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        profile={profile}
        activePatientCount={activePatients.length}
        isAdmin={isAdmin}
        onRequestAdminMode={handleRequestAdminMode}
        onSwitchToInternMode={handleSwitchToInternMode}
        onUpdateProfileName={handleUpdateProfileName}
        onNewPatient={() => {
          setPatientToEdit(null);
          setIsPatientFormOpen(true);
        }}
        onLockSession={() => setIsLocked(true)}
        onQuickBackup={handleQuickBackup}
        onOpenDriveSync={() => setIsDriveSyncOpen(true)}
        onOpenSettings={(tab) => {
          setSettingsInitialTab((tab as SettingsTabKey) || 'institution');
          setIsSettingsOpen(true);
        }}
        onOpenCalculators={() => setIsCalculatorOpen(true)}
        onToggleMobileDrawer={() => setIsMobileDrawerOpen((prev) => !prev)}
        isCalculatorOpen={isCalculatorOpen}
        isOnline={isOnline}
        pendingChangesCount={pendingChangesCount}
        isSyncing={isSyncing}
      />

      {/* Active Workspace / Drive Account Strip */}
      <div className="bg-slate-900 text-slate-300 px-3 sm:px-5 py-1 text-[11px] flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 print:hidden">
        <div className="flex items-center gap-2 min-w-0">
          <Cloud className={`w-3.5 h-3.5 shrink-0 ${ savedDriveUser ? 'text-teal-400' : 'text-amber-400' }`} />
          {savedDriveUser ? (
            <span className="truncate">
              Censo en vivo en Google Drive: <strong className="text-white">{savedDriveUser.email}</strong>
              {isSyncing && <span className="ml-2 text-teal-300 animate-pulse">• Sincronizando...</span>}
            </span>
          ) : workspaceMode === 'demo' ? (
            <span className="truncate text-amber-300">
              <strong>Modo Demostración Aislado</strong> (Pacientes de ejemplo). Conecta tu Google Drive para usar el censo real de tu institución.
            </span>
          ) : (
            <span className="truncate">
              <strong>Modo Local Sin Nube</strong> • Inicia sesión en Google Drive para sincronizar en tiempo real con otras computadoras.
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleLoad100StressTestPatients}
            className="px-2 py-0.5 rounded bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/40 text-purple-200 font-bold flex items-center gap-1 cursor-pointer transition-colors"
            title="Cargar 100 pacientes clínicos completos para prueba de estrés del sistema"
          >
            <FlaskConical className="w-3 h-3 text-purple-300" />
            <span>Cargar 100 Pacientes Prueba</span>
          </button>
          {patients.length > 0 && (
            <button
              onClick={handleClearAllPatients}
              className="px-2 py-0.5 rounded bg-rose-900/40 hover:bg-rose-800/60 border border-rose-500/40 text-rose-200 font-bold flex items-center gap-1 cursor-pointer transition-colors"
              title="Vaciar todos los pacientes del censo actual (dejar en 0)"
            >
              <Trash2 className="w-3 h-3 text-rose-300" />
              <span>Vaciar (0)</span>
            </button>
          )}
          <span className="text-slate-600">|</span>
          <button
            onClick={() => setIsDriveSyncOpen(true)}
            className="text-teal-300 hover:text-teal-200 font-bold underline cursor-pointer"
          >
            {savedDriveUser ? 'Cuenta Drive / Sincronización' : 'Conectar Google Drive'}
          </button>
          <span className="text-slate-600">|</span>
          <button
            onClick={() => {
              setWorkspaceMode(null);
              setWorkspaceModeState(null);
            }}
            className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
            title="Cambiar cuenta institucional o modo de inicio"
          >
            <LogOut className="w-3 h-3" />
            <span>Cambiar Institución / Cuenta</span>
          </button>
        </div>
      </div>

      {/* Network and Offline Synchronisation Banner */}
      {!isOnline && (
        <div className="bg-amber-600 text-white px-4 py-1.5 text-xs flex flex-wrap items-center justify-between gap-2 shadow-inner print:hidden">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 shrink-0 animate-pulse text-amber-200" />
            <span>
              <strong>Modo Fuera de Línea:</strong> Tus cambios se guardan localmente y se unificarán al recuperar conexión.
            </span>
          </div>
          <span className="bg-black/30 px-2 py-0.5 rounded font-mono font-bold text-[11px] shrink-0">
            {pendingChangesCount} {pendingChangesCount === 1 ? 'cambio pendiente' : 'cambios pendientes'}
          </span>
        </div>
      )}

      {isOnline && pendingChangesCount > 0 && (
        <div className="bg-teal-900/95 text-teal-100 px-4 py-1.5 text-xs flex flex-wrap items-center justify-between gap-2 border-b border-teal-700 shadow-xs print:hidden">
          <div className="flex items-center gap-2">
            <GitMerge className="w-3.5 h-3.5 text-teal-300 shrink-0" />
            <span>
              <strong>{pendingChangesCount} {pendingChangesCount === 1 ? 'cambio local pendiente' : 'cambios locales pendientes'}</strong> de sincronizar en Google Drive.
            </span>
          </div>
          <button
            onClick={() => setIsDriveSyncOpen(true)}
            className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-2.5 py-0.5 rounded-lg text-[11px] shadow-xs transition-colors shrink-0 cursor-pointer"
          >
            Sincronizar con Drive
          </button>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 z-[70] bg-slate-900 text-teal-300 border border-teal-500/40 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main View Area */}
      <main
        className={
          currentTab === 'census'
            ? 'flex-1 w-full max-w-full overflow-x-clip'
            : 'flex-1 max-w-7xl w-full mx-auto p-2.5 sm:p-5 lg:p-6 overflow-x-clip'
        }
      >
        {currentTab === 'census' && (
          <CensusDashboard
            patients={patients}
            isAdmin={isAdmin}
            onSelectPatient={(p) => setSelectedPatientForDetail(p)}
            onGenerateNote={(p) => setSelectedPatientForNote(p)}
            onTogglePending={handleTogglePending}
            onAddQuickPending={handleAddQuickPending}
            onDischargePatient={handleDischargePatient}
            onDeletePatient={handleDeletePatient}
            onEditPatient={(p) => {
              setPatientToEdit(p);
              setIsPatientFormOpen(true);
            }}
            onOpenDirectLabStudy={(p) => {
              setSelectedPatientForLabStudy(p);
              setIsDirectLabStudyOpen(true);
            }}
            onOpenTagSelector={(p) => {
              setSelectedPatientForTags(p);
              setIsTagSelectorOpen(true);
            }}
            servicesCatalog={profile.servicesCatalog}
            attendingPhysiciansCatalog={profile.attendingPhysiciansCatalog}
            attendingPhysicians={profile.attendingPhysicians}
            onAssignAttendingPhysician={handleAssignAttendingPhysician}
            onUpdateRoundsPresentation={(patientId, noteText) => {
              const target = patients.find((p) => p.id === patientId);
              if (target) {
                handleUpdatePatient({
                  ...target,
                  roundsPresentationNote: noteText || undefined,
                  lastUpdated: new Date().toISOString(),
                });
              }
            }}
            onUpdatePatient={handleUpdatePatient}
            onOpenSettings={(tab) => {
              setSettingsInitialTab((tab as SettingsTabKey) || 'institution');
              setIsSettingsOpen(true);
            }}
            onOpenVault={() => setCurrentTab('vault')}
            onQuickBackup={handleQuickBackup}
            onLockSession={() => setIsLocked(true)}
            onRequestAdminMode={handleRequestAdminMode}
            onSwitchToInternMode={handleSwitchToInternMode}
            lastBackupTimestamp={profile.lastBackupTimestamp}
            pendingAdminApprovalsCount={
              (profile.pendingUserTags?.length || 0) +
              (profile.pendingUserServices?.length || 0) +
              (profile.pendingUserNursingOrders?.length || 0)
            }
            isMobileDrawerOpen={isMobileDrawerOpen}
            onCloseMobileDrawer={() => setIsMobileDrawerOpen(false)}
            onToggleMobileDrawer={() => setIsMobileDrawerOpen((prev) => !prev)}
          />
        )}

        {currentTab === 'printable' && (
          <PrintableCensus
            patients={patients}
            profile={profile}
            onShowToast={showToast}
          />
        )}

        {currentTab === 'vault' && (
          <BackupVaultModal
            notes={notes}
            patients={patients}
            profile={profile}
            isAdmin={isAdmin}
            onRequestAdminMode={handleRequestAdminMode}
            onUpdateProfile={(p) => {
              setProfile(p);
              saveProfile(p);
            }}
            onReloadData={handleReloadData}
            onOpenDriveSync={() => setIsDriveSyncOpen(true)}
          />
        )}
      </main>

      {/* FLOATING MEDICAL FORMULAS & CALCULATOR MODAL */}
      <MedicalCalculatorsModal
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
        profile={profile}
        isAdmin={isAdmin}
        onUpdateProfile={(updatedProfile) => {
          setProfile(updatedProfile);
          saveProfile(updatedProfile);
          showToast('Repertorio de fórmulas médicas actualizado.');
        }}
      />

      {/* Modals */}
      {selectedPatientForDetail && (
        <PatientDetailModal
          key={selectedPatientForDetail.id}
          patient={selectedPatientForDetail}
          profile={profile}
          isOpen={Boolean(selectedPatientForDetail)}
          onClose={() => setSelectedPatientForDetail(null)}
          onUpdatePatient={handleUpdatePatient}
          onOpenNoteGenerator={() => {
            const p = selectedPatientForDetail;
            setSelectedPatientForDetail(null);
            setSelectedPatientForNote(p);
          }}
          onEditPatient={(p) => {
            setSelectedPatientForDetail(null);
            setPatientToEdit(p);
            setIsPatientFormOpen(true);
          }}
          onOpenDirectLabStudy={(p) => {
            setSelectedPatientForDetail(null);
            setSelectedPatientForLabStudy(p);
            setIsDirectLabStudyOpen(true);
          }}
          onOpenTagSelector={(p) => {
            setSelectedPatientForTags(p);
            setIsTagSelectorOpen(true);
          }}
          onOpenSettings={(tab) => {
            setSettingsInitialTab((tab as SettingsTabKey) || 'nursing');
            setIsSettingsOpen(true);
          }}
          patientNotes={notes.filter((n) => n.patientId === selectedPatientForDetail.id)}
        />
      )}

      {selectedPatientForNote && (
        <NoteGeneratorModal
          key={selectedPatientForNote.id}
          patient={selectedPatientForNote}
          profile={profile}
          isOpen={Boolean(selectedPatientForNote)}
          onClose={() => setSelectedPatientForNote(null)}
          onSaveNote={handleSaveNote}
          onUpdatePatient={handleUpdatePatient}
          previousNotes={notes}
          onUpdateProfile={(p) => {
            setProfile(p);
            saveProfile(p);
          }}
          onBackToExpediente={(p) => {
            setSelectedPatientForNote(null);
            setSelectedPatientForDetail(p);
          }}
          onOpenSettings={(tab) => {
            setSettingsInitialTab((tab as SettingsTabKey) || 'templates');
            setIsSettingsOpen(true);
          }}
        />
      )}

      {isPatientFormOpen && (
        <PatientFormModal
          key={patientToEdit?.id || 'new-patient'}
          isOpen={isPatientFormOpen}
          onClose={() => {
            setIsPatientFormOpen(false);
            setPatientToEdit(null);
          }}
          onSave={(savedPt, genHist) => {
            if (savedPt.attendingPhysician) {
              handleAssignAttendingPhysician(null, savedPt.attendingPhysician, true);
            }
            handleSavePatient(savedPt, genHist);
          }}
          initialPatient={patientToEdit}
          profile={profile}
          onAddNewTagToCatalog={handleAddNewTagToCatalog}
          onOpenSettings={(tab) => {
            setSettingsInitialTab((tab as SettingsTabKey) || 'doctors');
            setIsSettingsOpen(true);
          }}
          onBackToExpediente={(p) => {
            setIsPatientFormOpen(false);
            setPatientToEdit(null);
            setSelectedPatientForDetail(p);
          }}
        />
      )}

      {/* Direct Lab and Diagnostic Study Entry Modal */}
      <DirectLabStudyModal
        isOpen={isDirectLabStudyOpen}
        onClose={() => {
          setIsDirectLabStudyOpen(false);
          setSelectedPatientForLabStudy(null);
        }}
        targetPatient={selectedPatientForLabStudy}
        allPatients={patients}
        onSaveLab={handleSaveDirectLab}
        onSaveStudy={handleSaveDirectStudy}
        onBackToExpediente={(p) => {
          setIsDirectLabStudyOpen(false);
          setSelectedPatientForLabStudy(null);
          setSelectedPatientForDetail(p);
        }}
      />

      {/* Patient Clinical Tags Selector Modal */}
      {selectedPatientForTags && (
        <TagSelectorModal
          isOpen={isTagSelectorOpen}
          onClose={() => {
            setIsTagSelectorOpen(false);
            setSelectedPatientForTags(null);
          }}
          patient={selectedPatientForTags}
          availableTags={
            profile.availableTags || [
              'Intubado / VMI',
              'CPAP / BiPAP',
              'Cánula Alto Flujo',
              'Aislado de Contacto',
              'Aislado Respiratorio',
              'Agresivo / Delirium',
              'Ayuno',
              'NPT',
              'Hemodiálisis',
              'CVC',
              'Sonda Foley',
              'Sonda Nasogástrica',
              'Drenaje / Pleurovac',
              'RCP 3 (No RCP / Voluntad)',
            ]
          }
          onUpdateTags={handleUpdatePatientTags}
          onAddNewTagToCatalog={handleAddNewTagToCatalog}
          onBackToExpediente={(p) => {
            setIsTagSelectorOpen(false);
            setSelectedPatientForTags(null);
            setSelectedPatientForDetail(p);
          }}
        />
      )}

      {/* Admin Authorization Prompt Modal */}
      <AdminAuthModal
        isOpen={adminAuthModal.isOpen}
        title={adminAuthModal.title}
        description={adminAuthModal.description}
        onClose={() => setAdminAuthModal((prev) => ({ ...prev, isOpen: false }))}
        onSuccess={adminAuthModal.action}
      />

      {/* Google Drive Multi-station Sync Modal */}
      <GoogleDriveSyncModal
        isOpen={isDriveSyncOpen}
        onClose={() => setIsDriveSyncOpen(false)}
        patients={patients}
        notes={notes}
        profile={profile}
        isAdmin={isAdmin}
        onRequestAdminMode={handleRequestAdminMode}
        onDataSynced={handleReloadData}
        onDriveSessionChanged={() => {
          setWorkspaceModeState(getWorkspaceMode());
          handleReloadData();
        }}
        onAuthenticatedWithDrive={handleAuthenticatedWithDrive}
        showToast={showToast}
        isOnline={isOnline}
      />

      {/* Global Settings & Catalogs Modal */}
      <GlobalSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        profile={profile}
        isAdmin={isAdmin}
        onRequestAdminMode={handleRequestAdminMode}
        onSaveProfile={(updatedProfile) => {
          setProfile(updatedProfile);
          saveProfile(updatedProfile);
          showToast('Preferencias institucionales y catálogos guardados correctamente.');
        }}
        showToast={showToast}
        initialTab={settingsInitialTab}
      />
    </div>
  );
}
