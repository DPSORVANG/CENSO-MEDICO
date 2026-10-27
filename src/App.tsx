import { useState, useEffect } from 'react';
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
  exportFullBackup,
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
  findDriveCensusFile,
  downloadCensusFromDrive,
  saveCensusToDrive,
} from './utils/googleDriveSync.ts';
import { WifiOff, GitMerge } from 'lucide-react';

export default function App() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [notes, setNotes] = useState<ClinicalNoteRecord[]>([]);
  const [profile, setProfile] = useState<ResidentProfile>(loadProfile());
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

  // Network state and offline queue tracking
  const [isOnline, setIsOnline] = useState<boolean>(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingChangesCount, setPendingChangesCount] = useState<number>(() => getPendingMutations().length);

  // Initialize data
  useEffect(() => {
    const loadedPatients = loadPatients();
    const loadedNotes = loadNotes();
    const loadedProfile = loadProfile();
    setPatients(loadedPatients);
    setNotes(loadedNotes);
    setProfile(loadedProfile);
    setIsAdmin(loadedProfile.activeRole !== 'intern');
    setPendingChangesCount(getPendingMutations().length);
  }, []);

  // Online / Offline Detection & Auto-Sync Engine
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      showToast('¡Conexión restablecida! Verificando censo en Google Drive...');

      const token = await getAccessToken();
      if (token) {
        try {
          setIsSyncing(true);
          const driveFile = await findDriveCensusFile(token);
          const now = new Date().toISOString();
          const currentLocal: BackupPackage = {
            version: '1.1.0',
            exportDate: now,
            residentAuthor: profile.name,
            patients: loadPatients(),
            notes: loadNotes(),
            integrityHash: '',
          };

          let remotePackage: BackupPackage;
          if (driveFile) {
            const remote = await downloadCensusFromDrive(driveFile.id, token);
            remotePackage = remote.data;
          } else {
            remotePackage = {
              version: '1.1.0',
              exportDate: now,
              residentAuthor: profile.name,
              patients: [],
              notes: [],
              integrityHash: '',
            };
          }

          const { merged, stats } = mergeCensusData(currentLocal, remotePackage, profile.name);
          savePatients(merged.patients);
          saveNotes(merged.notes);
          setPatients(merged.patients);
          setNotes(merged.notes);

          await saveCensusToDrive(merged, token);
          clearPendingMutations();
          setPendingChangesCount(0);
          setLastSyncTime(now);

          const updatedProf = { ...profile, lastBackupTimestamp: Date.now() };
          setProfile(updatedProf);
          saveProfile(updatedProf);

          showToast(
            `¡Censo unificado tras recuperar internet! +${stats.addedRemotePatients} pacientes nuevos de otras PCs, ${stats.updatedPatients} actualizados.`
          );
        } catch (e: any) {
          console.error('Error durante sincronización automática:', e);
        } finally {
          setIsSyncing(false);
        }
      } else {
        const pending = getPendingMutations().length;
        if (pending > 0) {
          showToast(`Tienes ${pending} cambios locales listos. Abre Google Drive para unificarlos.`);
        }
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      showToast('⚡ Sin conexión a internet. Modo fuera de línea activo: tus cambios se guardan localmente.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [profile]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

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
    const newPatients = patients.map((p) => (p.id === updated.id ? updated : p));
    setPatients(newPatients);
    savePatients(newPatients);
    recordOfflineMutation('patient_updated', updated.id, `Actualizado ${updated.name} (${updated.bed})`);
    setPendingChangesCount(getPendingMutations().length);
    if (selectedPatientForDetail?.id === updated.id) {
      setSelectedPatientForDetail(updated);
    }
    if (selectedPatientForNote?.id === updated.id) {
      setSelectedPatientForNote(updated);
    }
    if (patientToEdit?.id === updated.id) {
      setPatientToEdit(updated);
    }
  };

  const handleSavePatient = (savedPatient: Patient, generatedHistoryText?: string) => {
    const exists = patients.some((p) => p.id === savedPatient.id);
    let newPatients: Patient[];
    if (exists) {
      newPatients = patients.map((p) => (p.id === savedPatient.id ? savedPatient : p));
      showToast(`Paciente ${savedPatient.name} actualizado.`);
      recordOfflineMutation('patient_updated', savedPatient.id, `Actualización de ${savedPatient.name} (${savedPatient.bed})`);
    } else {
      newPatients = [savedPatient, ...patients];
      showToast(`Nuevo paciente ${savedPatient.name} ingresado a ${savedPatient.bed}.`);
      recordOfflineMutation('patient_created', savedPatient.id, `Ingreso de ${savedPatient.name} en ${savedPatient.bed}`);
    }
    setPatients(newPatients);
    savePatients(newPatients);
    setPendingChangesCount(getPendingMutations().length);

    if (generatedHistoryText && generatedHistoryText.trim()) {
      const today = new Date().toISOString().split('T')[0];
      const time = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      const auditHash = generateAuditHash(
        savedPatient.id,
        today,
        `${profile.name}:${generatedHistoryText}`
      );

      const admissionNote: ClinicalNoteRecord = {
        id: `note-hc-${Date.now()}`,
        patientId: savedPatient.id,
        patientName: savedPatient.name,
        bed: savedPatient.bed,
        service: profile.service || 'Medicina Interna',
        date: today,
        time,
        noteType: 'Nota de Ingreso',
        content: generatedHistoryText,
        auditHash,
        residentAuthor: profile.name,
        createdAtTimestamp: Date.now(),
      };

      const updatedNotes = [admissionNote, ...notes];
      setNotes(updatedNotes);
      saveNotes(updatedNotes);
      recordOfflineMutation('note_created', admissionNote.id, `Nota de ingreso para ${savedPatient.name}`);
      setPendingChangesCount(getPendingMutations().length);
      showToast(`Historia Clínica NOM-004 archivada en bóveda (${auditHash.slice(0, 14)}...)`);
    }
  };

  // 4-Stage Chained Pending Workflow handler
  const handleTogglePending = (patientId: string, pendingId: string) => {
    let stageFeedback: string | null = null;
    const updated = patients.map((p) => {
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
    setPatients(updated);
    savePatients(updated);
    recordOfflineMutation('patient_updated', patientId, 'Pendiente actualizado');
    setPendingChangesCount(getPendingMutations().length);
    if (stageFeedback) {
      showToast(stageFeedback);
    }
  };

  // Add Quick Pending from Census Card or Checklist
  const handleAddQuickPending = (patientId: string, newPending: ClinicalPending) => {
    const updated = patients.map((p) => {
      if (p.id !== patientId) return p;
      return {
        ...p,
        pendings: [newPending, ...p.pendings],
        lastUpdated: new Date().toISOString(),
      };
    });
    setPatients(updated);
    savePatients(updated);
    recordOfflineMutation('patient_updated', patientId, `Nuevo pendiente: ${newPending.text}`);
    setPendingChangesCount(getPendingMutations().length);
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
      `Esta acción eliminará el registro del paciente del censo activo. Ingrese el PIN Maestro de Administrador para autorizar.`,
      () => {
        const newPatients = patients.filter((p) => p.id !== patient.id);
        setPatients(newPatients);
        savePatients(newPatients);
        showToast(`Paciente ${patient.name} eliminado del censo.`);
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
    const updatedNotes = [newNote, ...notes];
    setNotes(updatedNotes);
    saveNotes(updatedNotes);
    recordOfflineMutation('note_created', newNote.patientId, `Nota ${newNote.noteType} para ${newNote.patientName}`);
    setPendingChangesCount(getPendingMutations().length);
    showToast(`Nota respaldada en bóveda (${newNote.auditHash.slice(0, 14)}...)`);
  };

  const handleSaveDirectLab = (patientId: string, lab: LabRecord) => {
    const updated = patients.map((p) => {
      if (p.id !== patientId) return p;
      // Automatically complete any 'register_census' lab pending on this patient so workflow advances to Step 4 (Pendiente de Nota)
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
    showToast(`⚡ Laboratorio registrado como NUEVO (Pendiente de integrar a Nota) para ${target?.name || 'paciente'}.`);
  };

  const handleSaveDirectStudy = (patientId: string, study: DiagnosticStudy) => {
    const updated = patients.map((p) => {
      if (p.id !== patientId) return p;
      const currentStudies = p.studies || [];
      // Automatically complete any 'register_census' study/consult pending on this patient
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

  const handleReloadData = () => {
    setPatients(loadPatients());
    setNotes(loadNotes());
    setProfile(loadProfile());
    setPendingChangesCount(getPendingMutations().length);
    showToast('Datos sincronizados desde respaldo.');
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

  const activePatients = patients.filter((p) => p.status === 'active');

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
            Unificar Censo
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

      {/* FLOATING MEDICAL FORMULAS & CALCULATOR MODAL (Accessible from anywhere, over any open modal) */}
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
