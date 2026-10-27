import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  UserCheck,
  UserMinus,
  Clock,
  AlertTriangle,
  Pill,
  Calendar,
  Layers,
  Table as TableIcon,
  LayoutGrid,
  FileEdit,
  ClipboardList,
  Eye,
  Activity,
  HeartPulse,
  TrendingUp,
  TrendingDown,
  Minus,
  Trash2,
  Lock,
  Tag,
  FlaskConical,
  LogOut,
  ListChecks,
  Plus,
  ArrowRight,
  Copy,
  Check,
  FileText,
  Stethoscope,
  ArrowUp,
  ArrowDown,
  X,
  Wind,
  ShieldCheck,
  ShieldAlert,
  Settings,
  Download,
  FolderArchive,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import {
  Patient,
  SeverityType,
  HospitalServiceItem,
  AttendingPhysicianItem,
  ClinicalPending,
  PendingUrgencyColor,
  CriticalCareSystemsData,
} from '../types/clinical.ts';
import {
  calculateHospitalStayDays,
  calculateAntibioticDay,
  getCodeStatusInfo,
  getServiceColorInfo,
  getDoctorColorInfo,
  getRespiratorySupportFlags,
  getNonRedundantClinicalTags,
  isNoRcp,
  getPendingTrafficLightInfo,
  formatCriticalCareSystemsSummary,
  formatParenteralSolutionLine,
  isBackupOverdue24h,
  shouldShowFloatingSearchButton,
  buildCompactLabSummaryItems,
} from '../utils/clinicalLogic.ts';
import {
  defaultServicesCatalog,
  defaultAttendingPhysicians,
  defaultAttendingPhysicianItems,
} from '../data/seedPatients.ts';
import { SettingsTabKey } from './GlobalSettingsModal.tsx';
import { CriticalCareSystemsEditor } from './CriticalCareSystemsEditor.tsx';

export type LeftRailFilterType =
  | 'active'
  | 'recent'
  | 'prolonged'
  | 'severe'
  | 'intubated'
  | 'cpap'
  | 'norcp'
  | 'antibiotics'
  | 'discharge_pending'
  | 'pendings'
  | 'discharged';

interface CensusDashboardProps {
  patients: Patient[];
  onSelectPatient: (patient: Patient) => void;
  onGenerateNote: (patient: Patient) => void;
  onTogglePending: (patientId: string, pendingId: string) => void;
  onAddQuickPending?: (patientId: string, pending: ClinicalPending) => void;
  onDischargePatient: (patient: Patient) => void;
  onEditPatient: (patient: Patient) => void;
  onDeletePatient?: (patient: Patient) => void;
  isAdmin?: boolean;
  onOpenDirectLabStudy?: (patient: Patient | null) => void;
  onOpenTagSelector?: (patient: Patient) => void;
  servicesCatalog?: HospitalServiceItem[];
  attendingPhysicians?: AttendingPhysicianItem[];
  attendingPhysiciansCatalog?: string[];
  onAssignAttendingPhysician?: (
    patientId: string | null,
    doctorName: string,
    isNewDoctor?: boolean
  ) => void;
  onUpdateRoundsPresentation?: (patientId: string, note: string) => void;
  onUpdatePatient?: (patient: Patient) => void;
  onOpenSettings?: (tab?: SettingsTabKey) => void;
  onOpenVault?: () => void;
  onQuickBackup?: () => void;
  onLockSession?: () => void;
  onRequestAdminMode?: () => void;
  onSwitchToInternMode?: () => void;
  lastBackupTimestamp?: number;
  pendingAdminApprovalsCount?: number;
  isMobileDrawerOpen?: boolean;
  onCloseMobileDrawer?: () => void;
  onToggleMobileDrawer?: () => void;
}

export const CensusDashboard: React.FC<CensusDashboardProps> = ({
  patients,
  onSelectPatient,
  onGenerateNote,
  onTogglePending,
  onAddQuickPending,
  onDischargePatient,
  onEditPatient,
  onDeletePatient,
  isAdmin = false,
  onOpenDirectLabStudy,
  onOpenTagSelector,
  servicesCatalog,
  attendingPhysicians,
  attendingPhysiciansCatalog,
  onAssignAttendingPhysician,
  onUpdateRoundsPresentation,
  onUpdatePatient,
  onOpenSettings,
  onOpenVault,
  onQuickBackup,
  onLockSession,
  onRequestAdminMode,
  onSwitchToInternMode,
  lastBackupTimestamp,
  pendingAdminApprovalsCount = 0,
  isMobileDrawerOpen = false,
  onCloseMobileDrawer,
  onToggleMobileDrawer,
}) => {
  // Left Vertical Interactive Rail Filter
  const [railFilter, setRailFilter] = useState<LeftRailFilterType>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'dense-table' | 'pending-checklist'>('cards');
  const [copiedChecklist, setCopiedChecklist] = useState(false);

  // Collapsible Left Sidebar State (persisted in localStorage)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem('resimed_sidebar_collapsed_v1') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('resimed_sidebar_collapsed_v1', String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  // Floating Search & Filter Popover Menu state (for Mobile, Tablet & quick scroll access)
  const [isFloatingFilterOpen, setIsFloatingFilterOpen] = useState<boolean>(false);
  const desktopSearchBarRef = useRef<HTMLDivElement | null>(null);
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1280 : true
  );
  const [isDesktopTopBarOutOfView, setIsDesktopTopBarOutOfView] = useState<boolean>(false);

  useEffect(() => {
    const updateScrollAndViewport = () => {
      const isDesktop = window.innerWidth >= 1280;
      setIsDesktopViewport(isDesktop);
      if (!isDesktop) {
        setIsDesktopTopBarOutOfView(false);
        return;
      }
      const el = desktopSearchBarRef.current;
      if (!el) {
        setIsDesktopTopBarOutOfView(window.scrollY > 90);
        return;
      }
      const rect = el.getBoundingClientRect();
      // Header is 48px tall; once the main search bar scrolls above the header, it has disappeared
      const outOfView = rect.bottom <= 50;
      setIsDesktopTopBarOutOfView(outOfView);
      if (!outOfView) {
        setIsFloatingFilterOpen(false);
      }
    };

    updateScrollAndViewport();
    window.addEventListener('scroll', updateScrollAndViewport, { passive: true });
    window.addEventListener('resize', updateScrollAndViewport);
    return () => {
      window.removeEventListener('scroll', updateScrollAndViewport);
      window.removeEventListener('resize', updateScrollAndViewport);
    };
  }, []);

  const showFloatingSearchAndTools = shouldShowFloatingSearchButton({
    isDesktopViewport,
    isDesktopTopBarOutOfView,
  });

  // Highlighted patient card when jumping from the Compact List View to the detailed Card View
  const [highlightedPatientId, setHighlightedPatientId] = useState<string | null>(null);

  const handleJumpToPatientCard = (patientId: string) => {
    setViewMode('cards');
    setHighlightedPatientId(patientId);
    setTimeout(() => {
      const el = document.getElementById(`patient-card-${patientId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 60);
    setTimeout(() => {
      setHighlightedPatientId((prev) => (prev === patientId ? null : prev));
    }, 2800);
  };

  // Temporary Rounds Presentation Note inline editor state (independent of Progress Note)
  const [editingRoundsNoteId, setEditingRoundsNoteId] = useState<string | null>(null);
  const [roundsNoteDraft, setRoundsNoteDraft] = useState<string>('');

  // Inline Context (Motivo de Ingreso & Antecedentes Relevantes) quick editor state
  const [editingContextId, setEditingContextId] = useState<string | null>(null);
  const [admissionReasonDraft, setAdmissionReasonDraft] = useState<string>('');
  const [relevantHistoryDraft, setRelevantHistoryDraft] = useState<string>('');

  // Inline Critical Care Systems Editor Drawer per Patient Card
  const [openCriticalEditorPatientId, setOpenCriticalEditorPatientId] = useState<string | null>(
    null
  );

  const doctorsCatalogItems = useMemo(() => {
    if (attendingPhysicians && attendingPhysicians.length > 0) {
      return attendingPhysicians;
    }
    return defaultAttendingPhysicianItems;
  }, [attendingPhysicians]);

  const availableDoctors = useMemo(() => {
    const base =
      attendingPhysiciansCatalog && attendingPhysiciansCatalog.length > 0
        ? attendingPhysiciansCatalog
        : doctorsCatalogItems.map((d) => d.name).length > 0
        ? doctorsCatalogItems.map((d) => d.name)
        : defaultAttendingPhysicians;
    const fromPatients = patients
      .map((p) => p.attendingPhysician)
      .filter((d): d is string => Boolean(d && d.trim()));
    return Array.from(new Set([...base, ...fromPatients]));
  }, [attendingPhysiciansCatalog, doctorsCatalogItems, patients]);

  // Quick Add Pending Modal/Popover State inside Checklist or Dashboard
  const [showQuickAddPending, setShowQuickAddPending] = useState(false);
  const [quickPendingPatientId, setQuickPendingPatientId] = useState<string>('');
  const [quickPendingPreset, setQuickPendingPreset] = useState<
    'lab' | 'image' | 'consult' | 'discharge' | 'custom'
  >('lab');
  const [quickPendingDetail, setQuickPendingDetail] = useState('');
  const [quickPendingUrgency, setQuickPendingUrgency] = useState<PendingUrgencyColor>('red');

  // Dedicated Pendings Control Panel State
  const [pendingPanelStageFilter, setPendingPanelStageFilter] = useState<
    'all_active' | 'urgent' | 'take' | 'collect' | 'register_census' | 'completed'
  >('all_active');
  const [pendingPanelCategoryFilter, setPendingPanelCategoryFilter] = useState<string>('all');
  const [pendingPanelGroupBy, setPendingPanelGroupBy] = useState<'priority' | 'patient'>('priority');

  // Helper to check if patient has a pending ALTA
  const hasDischargePending = (p: Patient): boolean => {
    return p.pendings.some(
      (pen) =>
        !pen.completed &&
        (pen.isDischargePending ||
          pen.category === 'Alta Hospitalaria' ||
          pen.text.toUpperCase().startsWith('ALTA'))
    );
  };

  // Compute key statistics for the Left Vertical Rail (including separate Intubados/Tubo and CPAP counters)
  const stats = useMemo(() => {
    const active = patients.filter((p) => p.status === 'active');
    const discharged = patients.filter((p) => p.status === 'discharged');

    const recentAdmissions = active.filter((p) => calculateHospitalStayDays(p.admissionDate) <= 2);
    const prolongedStays = active.filter((p) => calculateHospitalStayDays(p.admissionDate) >= 7);
    const severePatients = active.filter(
      (p) => p.severity === 'Grave' || p.severity === 'Muy Grave / UCI'
    );
    const intubatedPatients = active.filter((p) => getRespiratorySupportFlags(p).isIntubated);
    const cpapPatients = active.filter((p) => getRespiratorySupportFlags(p).isCpap);
    const noRcpPatients = active.filter((p) => isNoRcp(p.codeStatus));
    const antibioticPatients = active.filter((p) =>
      p.medications.some((m) => m.isAntibiotic && m.active)
    );
    const dischargePendingPatients = active.filter((p) => hasDischargePending(p));
    const patientsWithPendings = active.filter((p) => p.pendings.some((pen) => !pen.completed));

    let totalActivePendingsCount = 0;
    let urgentPendingsCount = 0;
    let takeStagePendingsCount = 0;
    let collectStagePendingsCount = 0;
    let registerStagePendingsCount = 0;
    let completedPendingsCount = 0;

    active.forEach((p) => {
      p.pendings.forEach((pen) => {
        if (pen.completed) {
          completedPendingsCount++;
        } else {
          totalActivePendingsCount++;
          const tl = getPendingTrafficLightInfo(pen);
          if (
            tl.colorKey === 'red' ||
            pen.isDischargePending ||
            pen.category === 'Alta Hospitalaria'
          ) {
            urgentPendingsCount++;
          }
          if (pen.workflowStage === 'take') takeStagePendingsCount++;
          if (pen.workflowStage === 'collect') collectStagePendingsCount++;
          if (pen.workflowStage === 'register_census') registerStagePendingsCount++;
        }
      });
    });

    return {
      totalActive: active.length,
      totalDischarged: discharged.length,
      recentAdmissions: recentAdmissions.length,
      prolongedStays: prolongedStays.length,
      severeCount: severePatients.length,
      intubatedCount: intubatedPatients.length,
      cpapCount: cpapPatients.length,
      noRcpCount: noRcpPatients.length,
      antibioticPatientsCount: antibioticPatients.length,
      dischargePendingCount: dischargePendingPatients.length,
      patientsWithPendingsCount: patientsWithPendings.length,
      totalActivePendingsCount,
      urgentPendingsCount,
      takeStagePendingsCount,
      collectStagePendingsCount,
      registerStagePendingsCount,
      completedPendingsCount,
    };
  }, [patients]);

  // Filtered patients according to Left Rail + Service + Doctor + Search
  const filteredPatients = useMemo(() => {
    return patients.filter((patient) => {
      if (railFilter === 'discharged') {
        if (patient.status !== 'discharged') return false;
      } else {
        if (patient.status !== 'active') return false;
        if (railFilter === 'recent' && calculateHospitalStayDays(patient.admissionDate) > 2) {
          return false;
        }
        if (railFilter === 'prolonged' && calculateHospitalStayDays(patient.admissionDate) < 7) {
          return false;
        }
        if (
          railFilter === 'severe' &&
          patient.severity !== 'Grave' &&
          patient.severity !== 'Muy Grave / UCI'
        ) {
          return false;
        }
        if (railFilter === 'intubated' && !getRespiratorySupportFlags(patient).isIntubated) {
          return false;
        }
        if (railFilter === 'cpap' && !getRespiratorySupportFlags(patient).isCpap) {
          return false;
        }
        if (railFilter === 'norcp' && !isNoRcp(patient.codeStatus)) {
          return false;
        }
        if (
          railFilter === 'antibiotics' &&
          !patient.medications.some((m) => m.isAntibiotic && m.active)
        ) {
          return false;
        }
        if (railFilter === 'discharge_pending' && !hasDischargePending(patient)) {
          return false;
        }
        if (railFilter === 'pendings' && !patient.pendings.some((pen) => !pen.completed)) {
          return false;
        }
      }

      if (serviceFilter !== 'all' && patient.service !== serviceFilter) return false;
      if (doctorFilter !== 'all') {
        if (doctorFilter === '__unassigned__') {
          if (patient.attendingPhysician && patient.attendingPhysician.trim() !== '') return false;
        } else if ((patient.attendingPhysician || '') !== doctorFilter) {
          return false;
        }
      }

      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const matchesName = patient.name.toLowerCase().includes(term);
        const matchesBed = patient.bed.toLowerCase().includes(term);
        const matchesRecord = patient.recordNumber.toLowerCase().includes(term);
        const matchesDoctor = (patient.attendingPhysician || '').toLowerCase().includes(term);
        const matchesDiag = patient.diagnoses.some((d) => d.toLowerCase().includes(term));
        const matchesMed = patient.medications.some((m) => m.name.toLowerCase().includes(term));
        if (
          !matchesName &&
          !matchesBed &&
          !matchesRecord &&
          !matchesDoctor &&
          !matchesDiag &&
          !matchesMed
        ) {
          return false;
        }
      }

      return true;
    });
  }, [patients, railFilter, serviceFilter, doctorFilter, searchTerm]);

  // Filtered pendings for the Dedicated Shift Pendings Control Panel
  const flatShiftPendings = useMemo(() => {
    const items: Array<{ patient: Patient; pending: ClinicalPending }> = [];
    filteredPatients.forEach((p) => {
      p.pendings.forEach((pen) => {
        if (pendingPanelStageFilter === 'completed') {
          if (!pen.completed) return;
        } else {
          if (pen.completed) return;
          if (pendingPanelStageFilter === 'urgent') {
            const tl = getPendingTrafficLightInfo(pen);
            if (
              tl.colorKey !== 'red' &&
              !pen.isDischargePending &&
              pen.category !== 'Alta Hospitalaria'
            ) {
              return;
            }
          } else if (pendingPanelStageFilter === 'take' && pen.workflowStage !== 'take') {
            return;
          } else if (pendingPanelStageFilter === 'collect' && pen.workflowStage !== 'collect') {
            return;
          } else if (
            pendingPanelStageFilter === 'register_census' &&
            pen.workflowStage !== 'register_census'
          ) {
            return;
          }
        }

        if (
          pendingPanelCategoryFilter !== 'all' &&
          (pen.category || 'Procedimiento') !== pendingPanelCategoryFilter
        ) {
          return;
        }

        items.push({ patient: p, pending: pen });
      });
    });

    const rank = (pen: ClinicalPending) => {
      if (pen.isDischargePending || pen.category === 'Alta Hospitalaria') return 0;
      const info = getPendingTrafficLightInfo(pen);
      if (info.colorKey === 'red') return 1;
      if (info.colorKey === 'yellow') return 2;
      if (info.colorKey === 'green') return 3;
      return 4;
    };

    return items.sort((a, b) => rank(a.pending) - rank(b.pending));
  }, [filteredPatients, pendingPanelStageFilter, pendingPanelCategoryFilter]);

  const handleUpdatePendingUrgency = (
    patientId: string,
    pendingId: string,
    urgencyColor: PendingUrgencyColor
  ) => {
    if (!onUpdatePatient) return;
    const target = patients.find((p) => p.id === patientId);
    if (!target) return;
    const priorityMap: Record<PendingUrgencyColor, ClinicalPending['priority']> = {
      red: 'Alta',
      yellow: 'Media',
      green: 'Baja',
      blue: 'Informativa',
    };
    const updatedPendings = target.pendings.map((pen) =>
      pen.id === pendingId
        ? { ...pen, urgencyColor, priority: priorityMap[urgencyColor] }
        : pen
    );
    onUpdatePatient({
      ...target,
      pendings: updatedPendings,
      lastUpdated: new Date().toISOString(),
    });
  };

  const handleDeletePending = (patientId: string, pendingId: string) => {
    if (!onUpdatePatient) return;
    const target = patients.find((p) => p.id === patientId);
    if (!target) return;
    onUpdatePatient({
      ...target,
      pendings: target.pendings.filter((pen) => pen.id !== pendingId),
      lastUpdated: new Date().toISOString(),
    });
  };

  const handleClearCompletedPendings = () => {
    if (!onUpdatePatient) return;
    patients.forEach((p) => {
      if (p.pendings.some((pen) => pen.completed)) {
        onUpdatePatient({
          ...p,
          pendings: p.pendings.filter((pen) => !pen.completed),
          lastUpdated: new Date().toISOString(),
        });
      }
    });
    if (pendingPanelStageFilter === 'completed') {
      setPendingPanelStageFilter('all_active');
    }
  };

  const handleCopyShiftChecklist = () => {
    // Group by bed for clean shift handoff
    const byBed = new Map<string, { patient: Patient; pendings: ClinicalPending[] }>();
    filteredPatients.forEach((p) => {
      const activePens = p.pendings.filter((pen) => !pen.completed);
      if (activePens.length > 0) {
        byBed.set(p.id, { patient: p, pendings: activePens });
      }
    });
    const sections: string[] = [];
    byBed.forEach(({ patient, pendings }) => {
      const header = `• ${patient.bed} — ${patient.name}:`;
      const lines = pendings.map((pen) => {
        const tl = getPendingTrafficLightInfo(pen);
        const stageTag =
          pen.workflowStage === 'collect'
            ? ' [RECABAR]'
            : pen.workflowStage === 'register_census'
            ? ' [SUBIR A CENSO]'
            : '';
        return `   [ ] (${tl.label.toUpperCase()})${stageTag} ${pen.text}`;
      });
      sections.push([header, ...lines].join('\n'));
    });

    navigator.clipboard.writeText(
      sections.length > 0
        ? `PENDIENTES DEL TURNO (${stats.totalActivePendingsCount}):\n\n${sections.join('\n\n')}`
        : 'Sin pendientes activos en el turno.'
    );
    setCopiedChecklist(true);
    setTimeout(() => setCopiedChecklist(false), 2000);
  };

  const handleCreateQuickPending = (e: React.FormEvent) => {
    e.preventDefault();
    const targetId =
      quickPendingPatientId || (filteredPatients[0] ? filteredPatients[0].id : '');
    if (!targetId || !onAddQuickPending) return;

    const cleanDetail = quickPendingDetail.trim();
    let finalText = cleanDetail;
    let category: ClinicalPending['category'] = 'Laboratorio';
    let isDischarge = false;
    let workflowStage: ClinicalPending['workflowStage'] = 'take';

    if (quickPendingPreset === 'lab') {
      finalText = `TOMA DE LABORATORIOS: ${cleanDetail || 'BH, QS, ES'}`;
      category = 'Laboratorio';
      workflowStage = 'take';
    } else if (quickPendingPreset === 'image') {
      finalText = `SOLICITAR IMAGEN: ${cleanDetail || 'Estudio de gabinete'}`;
      category = 'Imagen/Gabinete';
      workflowStage = 'take';
    } else if (quickPendingPreset === 'consult') {
      finalText = `SOLICITAR INTERCONSULTA: ${cleanDetail || 'Valoración por servicio'}`;
      category = 'Interconsulta';
      workflowStage = 'take';
    } else if (quickPendingPreset === 'discharge') {
      finalText = `ALTA: ${cleanDetail || 'Preparar nota de egreso, indicaciones y receta'}`;
      category = 'Alta Hospitalaria';
      isDischarge = true;
      workflowStage = undefined;
    } else {
      if (!cleanDetail) return;
      finalText = cleanDetail;
      category = 'Procedimiento';
      workflowStage = undefined;
    }

    const priorityMap: Record<PendingUrgencyColor, ClinicalPending['priority']> = {
      red: 'Alta',
      yellow: 'Media',
      green: 'Baja',
      blue: 'Informativa',
    };

    const newPen: ClinicalPending = {
      id: `pen-${Date.now()}`,
      text: finalText,
      customDetails: cleanDetail || undefined,
      category,
      priority: isDischarge ? 'Alta' : priorityMap[quickPendingUrgency],
      urgencyColor: isDischarge ? 'red' : quickPendingUrgency,
      isDischargePending: isDischarge,
      workflowStage,
      completed: false,
      createdAt: new Date().toISOString().split('T')[0],
    };

    onAddQuickPending(targetId, newPen);
    setQuickPendingDetail('');
    setShowQuickAddPending(false);
  };

  const getSeverityBadge = (severity: SeverityType) => {
    switch (severity) {
      case 'Estable':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
      case 'Delicado':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
      case 'Grave':
        return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800 font-semibold';
      case 'Muy Grave / UCI':
        return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800 font-bold';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const backupOverdue = isBackupOverdue24h(lastBackupTimestamp);

  const railItems: Array<{
    id: LeftRailFilterType;
    label: string;
    shortLabel: string;
    count: number;
    icon: React.ReactNode;
    activeClass: string;
  }> = [
    {
      id: 'active',
      label: 'Censo Activo',
      shortLabel: 'Activos',
      count: stats.totalActive,
      icon: <UserCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />,
      activeClass: 'bg-teal-600 text-white border-teal-600',
    },
    {
      id: 'recent',
      label: 'Ingresos <= 48h',
      shortLabel: 'Ingresos',
      count: stats.recentAdmissions,
      icon: <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />,
      activeClass: 'bg-blue-600 text-white border-blue-600',
    },
    {
      id: 'prolonged',
      label: 'Estancia > 7d',
      shortLabel: '> 7 Días',
      count: stats.prolongedStays,
      icon: <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
      activeClass: 'bg-amber-600 text-white border-amber-600',
    },
    {
      id: 'severe',
      label: 'Graves / UCI',
      shortLabel: 'Graves',
      count: stats.severeCount,
      icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />,
      activeClass: 'bg-rose-600 text-white border-rose-600',
    },
    {
      id: 'intubated',
      label: 'Pacientes Intubados / Con Tubo (VMI)',
      shortLabel: 'Tubo / VMI',
      count: stats.intubatedCount,
      icon: <Activity className="w-3.5 h-3.5 text-rose-500 shrink-0" />,
      activeClass: 'bg-rose-700 text-white border-rose-700',
    },
    {
      id: 'cpap',
      label: 'Pacientes con CPAP / BiPAP (VMNI)',
      shortLabel: 'CPAP / BiPAP',
      count: stats.cpapCount,
      icon: <Wind className="w-3.5 h-3.5 text-sky-400 shrink-0" />,
      activeClass: 'bg-sky-600 text-white border-sky-600',
    },
    {
      id: 'norcp',
      label: 'No RCP / Voluntad Anticipada (RCP 3)',
      shortLabel: 'No RCP (3)',
      count: stats.noRcpCount,
      icon: <HeartPulse className="w-3.5 h-3.5 text-red-400 shrink-0" />,
      activeClass: 'bg-red-700 text-white border-red-700',
    },
    {
      id: 'antibiotics',
      label: 'Antibióticos Activos',
      shortLabel: 'ATB',
      count: stats.antibioticPatientsCount,
      icon: <Pill className="w-3.5 h-3.5 text-purple-400 shrink-0" />,
      activeClass: 'bg-purple-600 text-white border-purple-600',
    },
    {
      id: 'discharge_pending',
      label: 'Alta Pendiente',
      shortLabel: 'Pre-Alta',
      count: stats.dischargePendingCount,
      icon: <LogOut className="w-3.5 h-3.5 text-rose-500 shrink-0" />,
      activeClass: 'bg-rose-600 text-white border-rose-600',
    },
    {
      id: 'discharged',
      label: 'Egresos (<=5d)',
      shortLabel: 'Egresos',
      count: stats.totalDischarged,
      icon: <UserMinus className="w-3.5 h-3.5 text-slate-400 shrink-0" />,
      activeClass: 'bg-slate-700 text-white border-slate-700',
    },
  ];

  // Format diagnosis line highlighting optional [CIE-10: CODE]
  const renderDiagnosisLine = (diag: string, idx: number) => {
    const withoutNum = diag.replace(/^(?:\d+[.)]\s*|[•\-*]\s*)/, '').trim();
    const cieMatch = withoutNum.match(/^\[(?:CIE-?10:\s*)?([A-Z0-9.-]+)\]\s*(.*)$/i);
    if (cieMatch) {
      return (
        <div key={idx} className="flex items-baseline gap-1.5 leading-snug break-words text-sm">
          <span className="font-mono font-extrabold text-teal-700 dark:text-teal-400 text-xs shrink-0">
            {idx + 1}.
          </span>
          <span className="px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-mono font-bold text-xs shrink-0">
            {cieMatch[1].toUpperCase()}
          </span>
          <span className="text-slate-900 dark:text-slate-100 font-semibold">{cieMatch[2]}</span>
        </div>
      );
    }
    return (
      <div key={idx} className="flex items-baseline gap-1.5 leading-snug break-words text-sm">
        <span className="font-mono font-extrabold text-teal-700 dark:text-teal-400 text-xs shrink-0">
          {idx + 1}.
        </span>
        <span className="text-slate-900 dark:text-slate-100 font-semibold">{withoutNum}</span>
      </div>
    );
  };

  const hasAnyActiveSearchOrFilter =
    railFilter !== 'active' ||
    serviceFilter !== 'all' ||
    doctorFilter !== 'all' ||
    searchTerm.trim() !== '' ||
    viewMode !== 'cards';

  const activeRailItem = railItems.find((r) => r.id === railFilter) || railItems[0];

  const renderSidebarContent = (isDrawer: boolean = false) => {
    const isCollapsed = !isDrawer && isSidebarCollapsed;

    return (
      <>
        {/* Upper Section: Clinical Census Filters & Counters (including Tubo/VMI and CPAP/BiPAP) */}
        <div className="flex flex-col gap-1 shrink-0">
          {isCollapsed ? (
            <div className="flex items-center justify-center pb-1 mb-0.5 border-b border-slate-800">
              <button
                type="button"
                onClick={toggleSidebarCollapse}
                title="Expandir panel izquierdo del censo"
                aria-label="Expandir panel izquierdo"
                className="w-full py-1.5 rounded-lg bg-slate-800/80 hover:bg-teal-600/30 text-teal-400 hover:text-white border border-slate-700/80 flex items-center justify-center transition-colors cursor-pointer"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 truncate">
                Censo y Soporte
              </span>
              {!isDrawer && (
                <button
                  type="button"
                  onClick={toggleSidebarCollapse}
                  title="Contraer panel izquierdo (mostrar sólo icono y número)"
                  aria-label="Contraer panel izquierdo"
                  className="p-1 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-400 hover:text-teal-300 border border-slate-700/70 transition-colors cursor-pointer shrink-0"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              )}
              {isDrawer && onCloseMobileDrawer && (
                <button
                  type="button"
                  onClick={onCloseMobileDrawer}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                  aria-label="Cerrar panel lateral"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {railItems.map((item) => {
            const isSelected = railFilter === item.id && viewMode !== 'pending-checklist';
            if (isCollapsed) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setRailFilter(item.id);
                    if (viewMode === 'pending-checklist') {
                      setViewMode('cards');
                    }
                  }}
                  title={`${item.label} (${item.count})`}
                  aria-label={`${item.label} (${item.count})`}
                  className={`flex items-center justify-between gap-1 px-2 py-1.5 rounded-xl text-xs font-bold border transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? `${item.activeClass} shadow-xs`
                      : 'bg-slate-800/40 border-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span className={isSelected ? '[&>svg]:text-white' : ''}>{item.icon}</span>
                  <span
                    className={`px-1 py-0.5 rounded font-mono font-extrabold text-[11px] tabular-nums leading-none ${
                      isSelected
                        ? 'bg-black/30 text-white'
                        : 'text-slate-200'
                    }`}
                  >
                    {item.count}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setRailFilter(item.id);
                  if (viewMode === 'pending-checklist') {
                    setViewMode('cards');
                  }
                  if (isDrawer && onCloseMobileDrawer) {
                    onCloseMobileDrawer();
                  }
                }}
                title={`${item.label} (${item.count})`}
                className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  isSelected
                    ? `${item.activeClass} shadow-xs`
                    : 'bg-transparent border-transparent text-slate-300 hover:text-white hover:bg-slate-800/90'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={isSelected ? '[&>svg]:text-white' : ''}>{item.icon}</span>
                  <span className="truncate text-xs">{item.shortLabel}</span>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded font-mono font-bold text-xs tabular-nums ${
                    isSelected
                      ? 'bg-black/30 text-white'
                      : 'bg-slate-800 text-slate-300 border border-slate-700/80'
                  }`}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Middle Dedicated Section: PENDIENTES DEL TURNO (Separated by divider line as its own distinct control hub) */}
        <div className="flex flex-col gap-1.5 pt-2.5 mt-1.5 border-t border-slate-800 shrink-0">
          {!isCollapsed && (
            <div className="flex items-center justify-between px-2 py-0.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
                Pendientes Turno
              </span>
              {onAddQuickPending && (
                <button
                  type="button"
                  onClick={() => {
                    if (!quickPendingPatientId && filteredPatients[0]) {
                      setQuickPendingPatientId(filteredPatients[0].id);
                    }
                    setShowQuickAddPending(true);
                    if (isDrawer && onCloseMobileDrawer) onCloseMobileDrawer();
                  }}
                  title="Agregar nuevo pendiente rápido"
                  className="px-1.5 py-0.5 rounded bg-emerald-600/25 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-600/50 text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Nuevo</span>
                </button>
              )}
            </div>
          )}

          {/* Main Button to Open the Dedicated Pendings Panel */}
          {isCollapsed ? (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => {
                  setPendingPanelStageFilter('all_active');
                  setViewMode(viewMode === 'pending-checklist' ? 'cards' : 'pending-checklist');
                }}
                title={`Panel Pendientes del Turno (${stats.totalActivePendingsCount})`}
                aria-label={`Panel Pendientes (${stats.totalActivePendingsCount})`}
                className={`flex items-center justify-between gap-1 px-2 py-1.5 rounded-xl text-xs font-bold border transition-all shrink-0 cursor-pointer ${
                  viewMode === 'pending-checklist'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                    : 'bg-slate-800/70 hover:bg-slate-800 text-slate-200 hover:text-white border-slate-700/80'
                }`}
              >
                <ListChecks
                  className={`w-3.5 h-3.5 shrink-0 ${
                    viewMode === 'pending-checklist' ? 'text-white' : 'text-emerald-400'
                  }`}
                />
                <span className="font-mono font-extrabold text-[11px] tabular-nums">
                  {stats.totalActivePendingsCount}
                </span>
              </button>
              {onAddQuickPending && (
                <button
                  type="button"
                  onClick={() => {
                    if (!quickPendingPatientId && filteredPatients[0]) {
                      setQuickPendingPatientId(filteredPatients[0].id);
                    }
                    setShowQuickAddPending(true);
                  }}
                  title="Agregar nuevo pendiente rápido"
                  aria-label="Agregar pendiente rápido"
                  className="py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-600/40 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setPendingPanelStageFilter('all_active');
                  setViewMode(viewMode === 'pending-checklist' ? 'cards' : 'pending-checklist');
                  if (isDrawer && onCloseMobileDrawer) onCloseMobileDrawer();
                }}
                title="Abrir Panel y Centro de Control de Pendientes del Turno"
                className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'pending-checklist'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                    : 'bg-slate-800/70 hover:bg-slate-800 text-slate-200 hover:text-white border-slate-700/80'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <ListChecks
                    className={`w-3.5 h-3.5 shrink-0 ${
                      viewMode === 'pending-checklist' ? 'text-white' : 'text-emerald-400'
                    }`}
                  />
                  <span className="truncate">Panel Pendientes</span>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded font-mono font-bold text-xs tabular-nums ${
                    viewMode === 'pending-checklist'
                      ? 'bg-black/30 text-white'
                      : 'bg-emerald-950 text-emerald-300 border border-emerald-800/80'
                  }`}
                >
                  {stats.totalActivePendingsCount}
                </span>
              </button>

              {/* Quick Stage Breakdown Sub-Pills inside Left Sidebar */}
              {stats.totalActivePendingsCount > 0 && (
                <div className="grid grid-cols-2 gap-1 px-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setPendingPanelStageFilter('urgent');
                      setViewMode('pending-checklist');
                      if (isDrawer && onCloseMobileDrawer) onCloseMobileDrawer();
                    }}
                    title="Ver pendientes urgentes (Rojo / Pre-Alta)"
                    className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center justify-between border transition-colors cursor-pointer ${
                      viewMode === 'pending-checklist' && pendingPanelStageFilter === 'urgent'
                        ? 'bg-rose-600 text-white border-rose-500'
                        : 'bg-slate-800/60 hover:bg-slate-800 text-rose-300 border-slate-700/70'
                    }`}
                  >
                    <span className="truncate">Urgentes</span>
                    <span className="font-mono font-extrabold">{stats.urgentPendingsCount}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPendingPanelStageFilter(
                        stats.registerStagePendingsCount > 0 ? 'register_census' : 'collect'
                      );
                      setViewMode('pending-checklist');
                      if (isDrawer && onCloseMobileDrawer) onCloseMobileDrawer();
                    }}
                    title="Ver pendientes por recabar o subir al censo"
                    className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center justify-between border transition-colors cursor-pointer ${
                      viewMode === 'pending-checklist' &&
                      (pendingPanelStageFilter === 'collect' ||
                        pendingPanelStageFilter === 'register_census')
                        ? 'bg-amber-600 text-white border-amber-500'
                        : 'bg-slate-800/60 hover:bg-slate-800 text-amber-300 border-slate-700/70'
                    }`}
                  >
                    <span className="truncate">Recabar</span>
                    <span className="font-mono font-extrabold">
                      {stats.collectStagePendingsCount + stats.registerStagePendingsCount}
                    </span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Lower Base Section: Preferencias y Respaldo (Single unified entry point — no duplicate buttons) */}
        <div className="flex flex-col gap-1.5 mt-auto pt-3 border-t border-slate-800 shrink-0">
          {!isCollapsed && (
            <div className="px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Ajustes y Respaldo
            </div>
          )}

          {onOpenSettings && (
            <button
              type="button"
              onClick={() => {
                if (isDrawer && onCloseMobileDrawer) onCloseMobileDrawer();
                onOpenSettings('institution');
              }}
              title="Preferencias: Institución, Servicios, Médicos y Colores, Etiquetas, Enfermería y Plantillas"
              aria-label="Preferencias"
              className={`flex items-center ${
                isCollapsed ? 'justify-center p-2' : 'justify-between gap-1.5 px-2.5 py-1.5'
              } rounded-lg text-xs font-semibold hover:bg-slate-800 text-slate-200 hover:text-white border border-transparent transition-colors whitespace-nowrap shrink-0 cursor-pointer relative`}
            >
              <span className="flex items-center gap-1.5 truncate">
                <Settings className="w-4 h-4 text-teal-400 shrink-0" />
                {!isCollapsed && <span className="truncate">Preferencias</span>}
              </span>
              {isAdmin && pendingAdminApprovalsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white font-mono font-bold text-[10px]">
                  {pendingAdminApprovalsCount}
                </span>
              )}
            </button>
          )}

          {onOpenVault && (
            <div className={`flex ${isCollapsed ? 'flex-col' : 'items-center'} gap-1`}>
              <button
                type="button"
                onClick={() => {
                  if (isDrawer && onCloseMobileDrawer) onCloseMobileDrawer();
                  onOpenVault();
                }}
                title="Abrir Bóveda de Notas y Respaldos"
                aria-label="Bóveda"
                className={`flex-1 flex items-center ${
                  isCollapsed ? 'justify-center p-2' : 'gap-1.5 px-2.5 py-1.5'
                } rounded-lg text-xs font-semibold hover:bg-slate-800 text-slate-200 hover:text-white border border-transparent transition-colors whitespace-nowrap shrink-0 cursor-pointer`}
              >
                <FolderArchive className="w-4 h-4 text-emerald-400 shrink-0" />
                {!isCollapsed && <span className="truncate">Bóveda</span>}
              </button>
              {onQuickBackup && (
                <button
                  type="button"
                  onClick={onQuickBackup}
                  title={
                    backupOverdue
                      ? '¡Más de 24h sin respaldo! Descargar JSON'
                      : 'Descargar respaldo JSON'
                  }
                  aria-label="Descargar respaldo JSON"
                  className={`p-1.5 rounded-lg border transition-colors shrink-0 flex items-center justify-center cursor-pointer ${
                    backupOverdue
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                      : 'bg-slate-800/70 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Role Mode & Session Lock Compact Row */}
          <div className={`flex ${isCollapsed ? 'flex-col' : 'items-center'} gap-1 pt-0.5`}>
            {isAdmin ? (
              <button
                type="button"
                onClick={onSwitchToInternMode}
                title="Modo Administrador activo (Clic para cambiar a Modo Usuario)"
                aria-label="Modo Administrador"
                className={`flex-1 flex items-center ${
                  isCollapsed ? 'justify-center p-1.5' : 'gap-1.5 px-2.5 py-1'
                } rounded-lg bg-teal-950/60 hover:bg-teal-900/70 text-teal-300 border border-teal-800/70 text-xs font-semibold truncate cursor-pointer`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                {!isCollapsed && <span className="truncate">Admin</span>}
              </button>
            ) : (
              <button
                type="button"
                onClick={onRequestAdminMode}
                title="Modo Usuario activo (Clic para desbloquear Admin con PIN)"
                aria-label="Modo Usuario"
                className={`flex-1 flex items-center ${
                  isCollapsed ? 'justify-center p-1.5' : 'gap-1.5 px-2.5 py-1'
                } rounded-lg bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 text-xs font-semibold truncate cursor-pointer`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                {!isCollapsed && <span className="truncate">Usuario</span>}
              </button>
            )}

            {onLockSession && (
              <button
                type="button"
                onClick={onLockSession}
                title="Bloquear pantalla con PIN"
                aria-label="Bloquear sesión"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 shrink-0 flex items-center justify-center cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="flex flex-col xl:flex-row items-stretch min-h-[calc(100vh-48px)] w-full max-w-full overflow-x-clip relative">
      {/* DESKTOP (xl+): DOCKED LEFT VERTICAL SIDEBAR (Collapsible between sleek icon+count bar and full rail) */}
      <aside
        aria-label="Filtros rápidos de censo y panel inferior de configuración"
        className={`hidden xl:flex ${
          isSidebarCollapsed ? 'xl:w-[68px] px-1.5' : 'xl:w-46 px-2.5'
        } shrink-0 bg-slate-900 text-slate-200 border-r border-slate-800 sticky top-[48px] h-[calc(100vh-48px)] self-start z-40 py-2.5 flex-col justify-between gap-1.5 overflow-y-auto scrollbar-none transition-all duration-200 print:hidden`}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* MOBILE & TABLET (< xl, Both Portrait & Landscape): APP-STYLE SLIDE-OVER LATERAL DRAWER */}
      {isMobileDrawerOpen && (
        <div className="xl:hidden fixed inset-0 z-[75] flex print:hidden">
          <div
            onClick={onCloseMobileDrawer}
            className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs"
            aria-hidden="true"
          />
          <aside
            aria-label="Panel lateral expandido de censo y ajustes"
            className="relative z-10 w-64 max-w-[82vw] h-full bg-slate-900 text-slate-200 border-r border-slate-800 px-3 py-3 flex flex-col justify-between gap-2 overflow-y-auto shadow-2xl"
          >
            {renderSidebarContent(true)}
          </aside>
        </div>
      )}

      {/* MAIN CENSUS WORKSPACE */}
      <div className="flex-1 w-full min-w-0 p-2 sm:p-3.5 lg:p-5 space-y-2.5">
        {/* MOBILE & TABLET (< xl): Ultra-Compact Active Filter Status Pill Strip (Only shown if a filter/search is active) */}
        {hasAnyActiveSearchOrFilter && (
          <div className="xl:hidden flex flex-wrap items-center justify-between gap-1.5 px-2.5 py-1.5 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 text-xs print:hidden">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="px-2 py-0.5 rounded bg-teal-600 text-white font-bold text-[11px]">
                {activeRailItem.shortLabel} ({filteredPatients.length})
              </span>
              {serviceFilter !== 'all' && (
                <span className="px-2 py-0.5 rounded bg-slate-800 text-teal-300 border border-slate-700 truncate max-w-[140px]">
                  {serviceFilter}
                </span>
              )}
              {doctorFilter !== 'all' && (
                <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 truncate max-w-[140px]">
                  {doctorFilter === '__unassigned__' ? 'Sin médico' : doctorFilter}
                </span>
              )}
              {searchTerm.trim() !== '' && (
                <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700 truncate max-w-[130px]">
                  "{searchTerm}"
                </span>
              )}
              {viewMode !== 'cards' && (
                <span className="px-2 py-0.5 rounded bg-emerald-700 text-white font-bold text-[11px]">
                  {viewMode === 'dense-table' ? 'Vista Lista Compacta' : 'Checklist Pendientes'}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setRailFilter('active');
                setServiceFilter('all');
                setDoctorFilter('all');
                setSearchTerm('');
                setViewMode('cards');
              }}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Limpiar</span>
            </button>
          </div>
        )}

        {/* DESKTOP (xl+): Main Top Search & Filter Bar (Scrolls naturally so the compact floating search icon takes over only when scrolled down) */}
        <div
          ref={desktopSearchBarRef}
          className="hidden xl:flex bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex-col gap-2 print:hidden"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Search + Service + Doctor Filter */}
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar cama, paciente, diagnóstico, CIE-10..."
                  className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                aria-label="Filtrar por servicio"
                className="max-w-[195px] truncate px-2.5 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-medium focus:outline-none"
              >
                <option value="all">Todos los Servicios</option>
                {(servicesCatalog && servicesCatalog.length > 0
                  ? servicesCatalog
                  : defaultServicesCatalog
                ).map((srv) => (
                  <option key={srv.id} value={srv.name}>
                    {srv.name}
                  </option>
                ))}
              </select>

              <select
                value={doctorFilter}
                onChange={(e) => setDoctorFilter(e.target.value)}
                aria-label="Filtrar por médico a cargo"
                className="max-w-[210px] truncate px-2.5 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-semibold focus:outline-none"
              >
                <option value="all">Todos los Médicos</option>
                {availableDoctors.map((docName) => (
                  <option key={docName} value={docName}>
                    {docName}
                  </option>
                ))}
                <option value="__unassigned__">Sin asignar</option>
              </select>
            </div>

            {/* View Switcher & Quick Action Buttons */}
            <div className="flex items-center justify-end gap-1.5">
              <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                    viewMode === 'cards'
                      ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                  title="Vista de Cuadros Detallada de Pase de Visita"
                  aria-label="Vista de Tarjetas"
                >
                  <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-xs">Cuadros</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('dense-table')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                    viewMode === 'dense-table'
                      ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                  title="Vista de Lista Compacta del Censo Activo"
                  aria-label="Vista de Lista Compacta"
                >
                  <TableIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-xs">Lista</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {onOpenDirectLabStudy && (
                  <button
                    type="button"
                    onClick={() => onOpenDirectLabStudy(null)}
                    className="flex items-center gap-1 bg-teal-600 hover:bg-teal-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                    title="Registrar laboratorios por paneles o estudios reportados al censo"
                  >
                    <FlaskConical className="w-3.5 h-3.5 shrink-0" />
                    <span>+ Labs / Paneles</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* FLOATING QUICK PENDING MODAL (Accessible from anywhere on Mobile, Tablet, or Desktop without losing scroll position) */}
        {showQuickAddPending && onAddQuickPending && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs print:hidden">
            <form
              onSubmit={handleCreateQuickPending}
              className="w-full max-w-lg bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-emerald-400 dark:border-emerald-700 shadow-2xl space-y-3.5 text-xs sm:text-sm"
            >
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <ListChecks className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">
                      Agregar Pendiente Rápido
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Selecciona cama, tipo de pendiente y prioridad por semáforo
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode(viewMode === 'pending-checklist' ? 'cards' : 'pending-checklist');
                      setShowQuickAddPending(false);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-slate-200 dark:border-slate-700 text-[11px] font-bold cursor-pointer"
                    title="Ver lista completa de pendientes del turno"
                  >
                    Checklist ({stats.totalActivePendingsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQuickAddPending(false)}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-300 cursor-pointer"
                    aria-label="Cerrar ventana de pendiente rápido"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Preset Selector */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'lab', label: 'Toma de Laboratorios' },
                  { id: 'image', label: 'Estudio de Imagen' },
                  { id: 'consult', label: 'Interconsulta' },
                  { id: 'discharge', label: 'ALTA REQUERIDA' },
                  { id: 'custom', label: 'Otro' },
                ].map((pr) => (
                  <button
                    key={pr.id}
                    type="button"
                    onClick={() => setQuickPendingPreset(pr.id as any)}
                    className={`px-2.5 py-1.5 rounded-lg font-bold text-xs border transition-colors cursor-pointer ${
                      quickPendingPreset === pr.id
                        ? pr.id === 'discharge'
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-teal-600 text-white border-teal-600'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {pr.label}
                  </button>
                ))}
              </div>

              {/* Patient & Details Inputs */}
              <div className="space-y-2.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Paciente / Cama
                  </label>
                  <select
                    value={quickPendingPatientId}
                    onChange={(e) => setQuickPendingPatientId(e.target.value)}
                    aria-label="Seleccionar paciente para pendiente"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white"
                    required
                  >
                    {patients
                      .filter((p) => p.status === 'active')
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.bed} — {p.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Detalle o Indicación
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={quickPendingDetail}
                    onChange={(e) => setQuickPendingDetail(e.target.value)}
                    placeholder="Especificar estudio, interconsulta o indicación..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Urgency Traffic Light & Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Prioridad:
                  </span>
                  <div className="flex items-center gap-1.5">
                    {(
                      [
                        { color: 'red', bg: 'bg-rose-500', title: 'Rojo: Urgente' },
                        { color: 'yellow', bg: 'bg-amber-400', title: 'Amarillo: Prioritario' },
                        { color: 'green', bg: 'bg-emerald-500', title: 'Verde: Rutina' },
                        { color: 'blue', bg: 'bg-sky-500', title: 'Azul: Seguimiento' },
                      ] as const
                    ).map((tl) => (
                      <button
                        key={tl.color}
                        type="button"
                        onClick={() => setQuickPendingUrgency(tl.color)}
                        title={tl.title}
                        aria-label={tl.title}
                        className={`w-5 h-5 rounded-full ${tl.bg} transition-transform cursor-pointer ${
                          quickPendingUrgency === tl.color
                            ? 'ring-2 ring-offset-1 ring-slate-900 dark:ring-white scale-115'
                            : 'opacity-50 hover:opacity-90'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowQuickAddPending(false)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-sm cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Guardar Pendiente</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* VIEW 1: DEDICATED SHIFT PENDINGS CONTROL PANEL (Accessed from the separated Pendientes section in the Left Sidebar) */}
        {viewMode === 'pending-checklist' ? (
          <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            {/* Panel Header & Primary Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <ListChecks className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                    Panel de Pendientes del Turno
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Seguimiento encadenado (Tomar → Recabar → Subir al Censo), prioridad por semáforo y pase de guardia
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {onAddQuickPending && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!quickPendingPatientId && filteredPatients[0]) {
                        setQuickPendingPatientId(filteredPatients[0].id);
                      }
                      setShowQuickAddPending(true);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Nuevo Pendiente</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setPendingPanelGroupBy((prev) =>
                      prev === 'priority' ? 'patient' : 'priority'
                    )
                  }
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  title="Alternar agrupación por Prioridad (Semáforo) o por Cama/Paciente"
                >
                  {pendingPanelGroupBy === 'priority'
                    ? 'Agrupado: Prioridad'
                    : 'Agrupado: Por Cama'}
                </button>

                <button
                  type="button"
                  onClick={handleCopyShiftChecklist}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  title="Copiar resumen estructurado por cama para el pase de guardia"
                >
                  {copiedChecklist ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedChecklist ? 'Copiado para Guardia' : 'Copiar para Guardia'}</span>
                </button>

                {stats.completedPendingsCount > 0 && onUpdatePatient && (
                  <button
                    type="button"
                    onClick={handleClearCompletedPendings}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    title="Depurar todos los pendientes ya completados del turno"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Depurar Completados ({stats.completedPendingsCount})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-teal-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-teal-400" />
                  <span>Volver a Cuadros</span>
                </button>
              </div>
            </div>

            {/* Interactive Workflow Stage & Urgency KPI Filters */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  {
                    id: 'all_active',
                    label: 'Todos Activos',
                    count: stats.totalActivePendingsCount,
                    activeClass: 'bg-emerald-600 text-white border-emerald-600',
                  },
                  {
                    id: 'urgent',
                    label: 'Urgentes / Alta',
                    count: stats.urgentPendingsCount,
                    activeClass: 'bg-rose-600 text-white border-rose-600',
                  },
                  {
                    id: 'take',
                    label: 'Paso 1: Tomar / Solicitar',
                    count: stats.takeStagePendingsCount,
                    activeClass: 'bg-slate-800 text-white border-slate-800',
                  },
                  {
                    id: 'collect',
                    label: 'Paso 2: Recabar',
                    count: stats.collectStagePendingsCount,
                    activeClass: 'bg-amber-600 text-white border-amber-600',
                  },
                  {
                    id: 'register_census',
                    label: 'Paso 3: Subir al Censo',
                    count: stats.registerStagePendingsCount,
                    activeClass: 'bg-teal-600 text-white border-teal-600',
                  },
                  {
                    id: 'completed',
                    label: 'Completados',
                    count: stats.completedPendingsCount,
                    activeClass: 'bg-slate-600 text-white border-slate-600',
                  },
                ].map((stTab) => {
                  const active = pendingPanelStageFilter === stTab.id;
                  return (
                    <button
                      key={stTab.id}
                      type="button"
                      onClick={() => setPendingPanelStageFilter(stTab.id as any)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-colors cursor-pointer ${
                        active
                          ? stTab.activeClass
                          : 'bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>{stTab.label}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded font-mono text-[11px] font-extrabold ${
                          active
                            ? 'bg-black/25 text-white'
                            : 'bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {stTab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Category Filter Selector */}
              <select
                value={pendingPanelCategoryFilter}
                onChange={(e) => setPendingPanelCategoryFilter(e.target.value)}
                aria-label="Filtrar pendientes por categoría"
                className="px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">Categoría: Todas</option>
                <option value="Laboratorio">Laboratorio</option>
                <option value="Imagen/Gabinete">Imagen / Gabinete</option>
                <option value="Interconsulta">Interconsulta</option>
                <option value="Alta Hospitalaria">Alta Hospitalaria</option>
                <option value="Procedimiento">Procedimiento / Otros</option>
              </select>
            </div>

            {flatShiftPendings.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                No hay pendientes en este filtro actualmente.
              </div>
            ) : pendingPanelGroupBy === 'patient' ? (
              /* GROUPED BY BED / PATIENT VIEW */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {Array.from(
                  flatShiftPendings.reduce((acc, item) => {
                    const list = acc.get(item.patient.id) || [];
                    list.push(item);
                    acc.set(item.patient.id, list);
                    return acc;
                  }, new Map<string, Array<{ patient: Patient; pending: ClinicalPending }>>())
                ).map(([patId, groupItems]) => {
                  const pat = groupItems[0].patient;
                  return (
                    <div
                      key={patId}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => handleJumpToPatientCard(pat.id)}
                          className="flex items-center gap-2 text-left hover:text-teal-600 cursor-pointer"
                          title="Ir al cuadro detallado de este paciente"
                        >
                          <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono font-extrabold text-xs">
                            {pat.bed}
                          </span>
                          <span className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm">
                            {pat.name}
                          </span>
                        </button>
                        <div className="flex items-center gap-1">
                          {onAddQuickPending && (
                            <button
                              type="button"
                              onClick={() => {
                                setQuickPendingPatientId(pat.id);
                                setShowQuickAddPending(true);
                              }}
                              className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold cursor-pointer"
                            >
                              + Agregar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleJumpToPatientCard(pat.id)}
                            className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold cursor-pointer"
                          >
                            Ir a Cuadro
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {groupItems.map(({ pending }) => {
                          const tl = getPendingTrafficLightInfo(pending);
                          return (
                            <div
                              key={pending.id}
                              className={`p-2.5 rounded-lg border ${tl.borderClass} bg-white dark:bg-slate-900 flex items-start justify-between gap-2 text-xs`}
                            >
                              <label className="flex items-start gap-2 cursor-pointer min-w-0 flex-1">
                                <input
                                  type="checkbox"
                                  checked={pending.completed}
                                  onChange={() => onTogglePending(pat.id, pending.id)}
                                  className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4 shrink-0 mt-0.5"
                                />
                                <span
                                  className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${tl.dotClass}`}
                                />
                                <span
                                  className={`font-semibold leading-snug break-words ${
                                    pending.completed
                                      ? 'line-through text-slate-400'
                                      : 'text-slate-900 dark:text-white'
                                  }`}
                                >
                                  {pending.text}
                                </span>
                              </label>
                              <div className="flex items-center gap-1 shrink-0">
                                {pending.workflowStage === 'register_census' &&
                                  onOpenDirectLabStudy && (
                                    <button
                                      type="button"
                                      onClick={() => onOpenDirectLabStudy(pat)}
                                      className="text-[10px] bg-teal-600 hover:bg-teal-500 text-white px-2 py-0.5 rounded font-bold cursor-pointer"
                                    >
                                      + Censo
                                    </button>
                                  )}
                                <button
                                  type="button"
                                  onClick={() => handleDeletePending(pat.id, pending.id)}
                                  title="Eliminar pendiente"
                                  className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* GROUPED BY PRIORITY (TRAFFIC LIGHT) VIEW */
              <div className="space-y-2">
                {flatShiftPendings.map(({ patient, pending }) => {
                  const tl = getPendingTrafficLightInfo(pending);
                  return (
                    <div
                      key={pending.id}
                      className={`p-3 rounded-xl border ${tl.borderClass} bg-slate-50/60 dark:bg-slate-800/40 flex flex-col gap-2 text-xs transition-colors hover:bg-slate-100/70 dark:hover:bg-slate-800/70`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={pending.completed}
                            onChange={() => onTogglePending(patient.id, pending.id)}
                            className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4 shrink-0 cursor-pointer"
                            title="Avanzar paso o marcar completado"
                          />
                          <button
                            type="button"
                            onClick={() => handleJumpToPatientCard(patient.id)}
                            title="Ir al cuadro detallado de este paciente"
                            className="flex items-center gap-1.5 hover:text-teal-600 cursor-pointer min-w-0"
                          >
                            <span className="font-mono font-extrabold bg-slate-900 dark:bg-slate-700 hover:bg-teal-600 text-white px-2 py-0.5 rounded text-[11px] shrink-0 transition-colors">
                              {patient.bed}
                            </span>
                            <span className="font-extrabold text-slate-800 dark:text-slate-200 truncate">
                              {patient.name}
                            </span>
                          </button>
                          {pending.category && (
                            <span className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-semibold">
                              {pending.category}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Inline Quick Traffic Light Priority Switcher */}
                          {!pending.completed && onUpdatePatient && (
                            <div
                              className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                              title="Cambiar prioridad del pendiente"
                            >
                              {(
                                [
                                  { color: 'red', bg: 'bg-rose-500', label: 'Urgente' },
                                  { color: 'yellow', bg: 'bg-amber-400', label: 'Prioritario' },
                                  { color: 'green', bg: 'bg-emerald-500', label: 'Rutina' },
                                  { color: 'blue', bg: 'bg-sky-500', label: 'Seguimiento' },
                                ] as const
                              ).map((dot) => (
                                <button
                                  key={dot.color}
                                  type="button"
                                  onClick={() =>
                                    handleUpdatePendingUrgency(patient.id, pending.id, dot.color)
                                  }
                                  title={`Prioridad: ${dot.label}`}
                                  className={`w-3 h-3 rounded-full ${dot.bg} transition-transform cursor-pointer ${
                                    tl.colorKey === dot.color
                                      ? 'ring-2 ring-slate-900 dark:ring-white scale-110'
                                      : 'opacity-35 hover:opacity-90'
                                  }`}
                                />
                              ))}
                            </div>
                          )}

                          {pending.workflowStage === 'take' && !pending.completed && (
                            <button
                              type="button"
                              onClick={() => onTogglePending(patient.id, pending.id)}
                              className="text-[10px] bg-slate-200 hover:bg-amber-500 dark:bg-slate-700 text-slate-800 hover:text-white dark:text-slate-200 px-2 py-0.5 rounded font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Clic para pasar a Paso 2: Recabar"
                            >
                              <span>Paso 1: Tomar/Solicitar</span>
                              <ArrowRight className="w-2.5 h-2.5" />
                              <span>Recabar</span>
                            </button>
                          )}
                          {pending.workflowStage === 'collect' && !pending.completed && (
                            <button
                              type="button"
                              onClick={() => onTogglePending(patient.id, pending.id)}
                              className="text-[10px] bg-amber-100 hover:bg-teal-600 dark:bg-amber-950/60 text-amber-800 hover:text-white dark:text-amber-300 border border-amber-300 px-2 py-0.5 rounded font-bold transition-colors cursor-pointer"
                              title="Clic para pasar a Paso 3: Subir al Censo"
                            >
                              Paso 2: Recabar → Censo
                            </button>
                          )}
                          {pending.workflowStage === 'register_census' &&
                            !pending.completed &&
                            onOpenDirectLabStudy && (
                              <button
                                type="button"
                                onClick={() => onOpenDirectLabStudy(patient)}
                                className="text-[10px] bg-teal-600 hover:bg-teal-500 text-white px-2.5 py-0.5 rounded-md font-bold cursor-pointer"
                              >
                                Subir al Censo
                              </button>
                            )}
                          <span className={`text-[10px] px-2 py-0.5 rounded border ${tl.badgeClass}`}>
                            {tl.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeletePending(patient.id, pending.id)}
                            title="Eliminar pendiente"
                            className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div
                        onClick={() => onTogglePending(patient.id, pending.id)}
                        className={`pl-6 font-bold text-xs sm:text-[13px] leading-snug break-words cursor-pointer ${
                          pending.completed
                            ? 'line-through text-slate-400'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {pending.text}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 p-10 text-center rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
            <Layers className="w-10 h-10 mx-auto text-slate-400 stroke-1" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Sin pacientes en este filtro
            </h3>
            <button
              type="button"
              onClick={() => {
                setRailFilter('active');
                setSearchTerm('');
                setServiceFilter('all');
                setDoctorFilter('all');
              }}
              className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline pt-1 inline-block cursor-pointer"
            >
              Ver todos los pacientes activos
            </button>
          </div>
        ) : viewMode === 'cards' ? (
          /* VIEW 2: PATIENT CARDS STRUCTURED IN NATURAL ROUNDS PRESENTATION ORDER (PASE DE VISITA) */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredPatients.map((patient) => {
              const stayDays = calculateHospitalStayDays(patient.admissionDate);
              const activeMeds = patient.medications.filter((m) => m.active);
              const activeAntibiotics = activeMeds.filter((m) => m.isAntibiotic);
              const activeLimitedCourseMeds = activeMeds.filter(
                (m) =>
                  !m.isAntibiotic &&
                  Boolean(m.isLimitedCourse || (m.plannedDays && m.plannedDays > 0))
              );
              const otherActiveMeds = activeMeds.filter(
                (m) =>
                  !m.isAntibiotic &&
                  !m.isLimitedCourse &&
                  !(m.plannedDays && m.plannedDays > 0)
              );
              const latestLab = patient.labs && patient.labs.length > 0 ? patient.labs[0] : null;
              const previousLab = patient.labs && patient.labs.length > 1 ? patient.labs[1] : null;
              const pendingList = patient.pendings.filter((pen) => !pen.completed);
              const patientHasAltaPending = hasDischargePending(patient);
              const codeInfo = getCodeStatusInfo(patient.codeStatus);
              const respFlags = getRespiratorySupportFlags(patient);
              const docColor = getDoctorColorInfo(
                patient.attendingPhysician,
                doctorsCatalogItems
              );
              const criticalSummaryItems = formatCriticalCareSystemsSummary(
                patient.criticalCareSystems
              );

              // Extract relevant history or concise summary if present
              const effectiveRelevantHistory =
                patient.relevantHistory?.trim() ||
                (patient.clinicalHistory?.app
                  ? patient.clinicalHistory.app.slice(0, 140) +
                    (patient.clinicalHistory.app.length > 140 ? '...' : '')
                  : '');
              const hasPositiveAllergy =
                Boolean(patient.allergies?.trim()) &&
                patient.allergies.trim().toLowerCase() !== 'negadas' &&
                patient.allergies.trim().toLowerCase() !== 'ninguna';

              // Compute PAM if BP is available
              let computedPam: number | null = null;
              const bpParts = (patient.vitals?.bp || '').split('/').map((n) => parseFloat(n.trim()));
              if (bpParts.length === 2 && !isNaN(bpParts[0]) && !isNaN(bpParts[1])) {
                computedPam = Math.round((bpParts[0] + 2 * bpParts[1]) / 3);
              }

              // Extra lab parameters from the 14 panels on latestLab
              const extraLabEntries = latestLab?.extraParams
                ? Object.values(latestLab.extraParams)
                : [];

              return (
                <div
                  key={patient.id}
                  id={`patient-card-${patient.id}`}
                  className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all duration-300 hover:shadow-md flex flex-col justify-between min-w-0 overflow-hidden ${
                    highlightedPatientId === patient.id
                      ? 'ring-3 ring-teal-500 dark:ring-teal-400 border-teal-500 shadow-2xl'
                      : patient.status === 'discharged'
                      ? 'border-slate-300 dark:border-slate-800 opacity-75'
                      : patientHasAltaPending
                      ? 'border-rose-400 dark:border-rose-700'
                      : patient.severity === 'Muy Grave / UCI' || patient.severity === 'Grave'
                      ? 'border-rose-300 dark:border-rose-900/70'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {/* =========================================================================
                      BLOQUE 1: IDENTIFICACIÓN, MOTIVO DE INGRESO Y DIAGNÓSTICOS ACTUALES
                      ("¿Quién es, por qué ingresó, cuánto tiempo lleva y qué tiene hoy?")
                     ========================================================================= */}
                  <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-800 space-y-2.5">
                    {/* Fila 1A: Cama + Nombre + Edad/Sexo/DE + Distintivos (Gravedad, RCP 1/2/3, INTUBADO, CPAP) */}
                    <div className="flex flex-col sm:flex-row sm:flex-wrap items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0 sm:min-w-[220px] flex-1 w-full sm:w-auto">
                        <span className="px-2.5 py-1 bg-slate-900 dark:bg-slate-800 text-white font-mono font-extrabold text-sm rounded-lg shrink-0">
                          {patient.bed}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-base font-extrabold text-slate-900 dark:text-white break-words leading-tight">
                              {patient.name}
                            </h3>
                            {(() => {
                              const srvInfo = getServiceColorInfo(patient.service, servicesCatalog);
                              return (
                                <span
                                  className="text-xs font-bold px-2 py-0.5 rounded border inline-flex items-center gap-1 leading-none whitespace-nowrap"
                                  style={srvInfo.badgeStyle}
                                >
                                  <span
                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{ backgroundColor: srvInfo.color }}
                                  />
                                  <span>{patient.service.replace('Medicina Interna ', 'MI ')}</span>
                                </span>
                              );
                            })()}
                          </div>

                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5 flex flex-wrap items-center gap-x-1.5">
                            <span>
                              <strong className="text-slate-700 dark:text-slate-200">
                                {patient.age}a
                              </strong>{' '}
                              · {patient.gender}
                            </span>
                            <span>·</span>
                            <span>{patient.recordNumber}</span>
                            <span>·</span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold">
                              DE: {stayDays}d
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Distintivos de Gravedad, RCP (1/2/3) y Soporte Ventilatorio (INTUBADO / CPAP) */}
                      <div className="flex flex-wrap items-center sm:justify-end gap-1.5 shrink-0">
                        {patientHasAltaPending && (
                          <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-extrabold text-xs uppercase tracking-wide">
                            ALTA HOY
                          </span>
                        )}

                        {respFlags.isIntubated && (
                          <span
                            className="px-2 py-0.5 rounded bg-rose-700 text-white border border-rose-800 font-extrabold text-xs uppercase tracking-wide flex items-center gap-1 shadow-2xs"
                            title="Intubación Endotraqueal / Ventilación Mecánica Invasiva"
                          >
                            <Activity className="w-3.5 h-3.5 shrink-0" />
                            <span>INTUBADO</span>
                          </span>
                        )}

                        {respFlags.isCpap && (
                          <span
                            className="px-2 py-0.5 rounded bg-sky-600 text-white border border-sky-700 font-extrabold text-xs uppercase tracking-wide flex items-center gap-1 shadow-2xs"
                            title="Ventilación Mecánica No Invasiva (CPAP / BiPAP)"
                          >
                            <Wind className="w-3.5 h-3.5 shrink-0" />
                            <span>CPAP</span>
                          </span>
                        )}

                        <span
                          className={`text-xs px-2 py-0.5 rounded border whitespace-nowrap ${getSeverityBadge(
                            patient.severity
                          )}`}
                        >
                          {patient.severity === 'Muy Grave / UCI' ? 'UCI' : patient.severity}
                        </span>

                        <span
                          className={`text-xs px-2 py-0.5 rounded border whitespace-nowrap font-extrabold ${codeInfo.badgeClass}`}
                          title={codeInfo.description}
                        >
                          {codeInfo.codeLabel}
                        </span>
                      </div>
                    </div>

                    {/* Fila 1B: Médico a Cargo (Con color personalizado) + Etiquetas Clínicas */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
                      <div
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs border max-w-full"
                        style={
                          patient.attendingPhysician
                            ? docColor.badgeStyle
                            : {
                                backgroundColor: 'rgba(148, 163, 184, 0.12)',
                                borderColor: 'rgba(148, 163, 184, 0.35)',
                              }
                        }
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            backgroundColor: patient.attendingPhysician
                              ? docColor.color
                              : '#94a3b8',
                          }}
                        />
                        <Stethoscope className="w-3.5 h-3.5 shrink-0 opacity-80" />
                        <select
                          value={patient.attendingPhysician || ''}
                          onChange={(e) => {
                            onAssignAttendingPhysician?.(patient.id, e.target.value, false);
                          }}
                          aria-label={`Médico a cargo de ${patient.name}`}
                          className="bg-transparent font-bold focus:outline-none cursor-pointer truncate max-w-[195px] sm:max-w-[240px]"
                        >
                          <option value="">-- Sin médico --</option>
                          {availableDoctors.map((docName) => (
                            <option key={docName} value={docName}>
                              {docName}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Etiquetas Clínicas Sincronizadas (Omitiendo las que ya aparecen arriba como marcadores grandes) */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {getNonRedundantClinicalTags(patient.clinicalTags).map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="text-xs px-2 py-0.5 rounded font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                          >
                            {tag}
                          </span>
                        ))}
                        {onOpenTagSelector && (
                          <button
                            type="button"
                            onClick={() => onOpenTagSelector(patient)}
                            className="text-xs px-2 py-0.5 rounded border border-dashed border-slate-300 dark:border-slate-700 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 flex items-center gap-1 cursor-pointer"
                            title="Etiquetas clínicas del paciente"
                          >
                            <Tag className="w-3 h-3" />
                            <span>+ Etiqueta</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Fila 1C: Motivo de Ingreso, Antecedentes Relevantes y Alergias */}
                    {editingContextId === patient.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (onUpdatePatient) {
                            onUpdatePatient({
                              ...patient,
                              admissionReason: admissionReasonDraft.trim() || undefined,
                              relevantHistory: relevantHistoryDraft.trim() || undefined,
                              lastUpdated: new Date().toISOString(),
                            });
                          }
                          setEditingContextId(null);
                        }}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 space-y-2 text-sm"
                      >
                        <div>
                          <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase block mb-1">
                            Motivo de Ingreso
                          </label>
                          <input
                            type="text"
                            value={admissionReasonDraft}
                            onChange={(e) => setAdmissionReasonDraft(e.target.value)}
                            placeholder="Ej. Disnea progresiva y fiebre..."
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                            autoFocus
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase block mb-1">
                            Antecedentes Relevantes (APP)
                          </label>
                          <input
                            type="text"
                            value={relevantHistoryDraft}
                            onChange={(e) => setRelevantHistoryDraft(e.target.value)}
                            placeholder="Ej. DM2 15a · EPOC GOLD 3..."
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingContextId(null)}
                            className="px-2.5 py-1 text-xs text-slate-500 cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            className="px-3 py-1 bg-teal-600 text-white rounded-md text-xs font-bold cursor-pointer"
                          >
                            Guardar
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="space-y-1">
                        {patient.admissionReason && (
                          <div
                            onClick={() => {
                              setEditingContextId(patient.id);
                              setAdmissionReasonDraft(patient.admissionReason || '');
                              setRelevantHistoryDraft(patient.relevantHistory || '');
                            }}
                            title="Clic para editar ingreso y antecedentes"
                            className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 bg-slate-50/90 dark:bg-slate-800/50 px-2.5 py-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800 leading-snug cursor-pointer hover:border-teal-400"
                          >
                            <span className="font-extrabold uppercase text-xs text-slate-500 dark:text-slate-400 mr-1.5">
                              Ingreso:
                            </span>
                            <span>{patient.admissionReason}</span>
                          </div>
                        )}

                        {(hasPositiveAllergy || effectiveRelevantHistory) && (
                          <div
                            onClick={() => {
                              setEditingContextId(patient.id);
                              setAdmissionReasonDraft(patient.admissionReason || '');
                              setRelevantHistoryDraft(patient.relevantHistory || '');
                            }}
                            title="Clic para editar antecedentes"
                            className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm cursor-pointer"
                          >
                            {hasPositiveAllergy && (
                              <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800 font-bold text-xs">
                                ⚠️ Alergia: {patient.allergies}
                              </span>
                            )}
                            {effectiveRelevantHistory && (
                              <span className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-snug">
                                <strong className="text-slate-700 dark:text-slate-300">APP:</strong>{' '}
                                {effectiveRelevantHistory}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Fila 1D: Diagnósticos Principales y Secundarios Actuales (Con CIE-10) */}
                    <div className="pt-0.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                          Diagnósticos
                        </span>
                        {!patient.admissionReason && !effectiveRelevantHistory && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingContextId(patient.id);
                              setAdmissionReasonDraft(patient.admissionReason || '');
                              setRelevantHistoryDraft(patient.relevantHistory || '');
                            }}
                            className="text-xs text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                          >
                            + Ingreso / APP
                          </button>
                        )}
                      </div>
                      <div className="text-sm space-y-1">
                        {patient.diagnoses.map((diag, idx) => renderDiagnosisLine(diag, idx))}
                      </div>
                    </div>
                  </div>

                  {/* =========================================================================
                      BLOQUE 2: EVOLUCIÓN ACTUAL, SIGNOS VITALES, SISTEMAS CRÍTICOS Y PARACLÍNICOS
                     ========================================================================= */}
                  <div className="p-3.5 sm:p-4 bg-slate-50/60 dark:bg-slate-950/40 space-y-2.5 flex-1">
                    {/* 2A. Signos Vitales de Guardia / Matutinos */}
                    {patient.vitals && (
                      <div className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1 px-3 py-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 text-xs sm:text-sm font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <span className="flex items-center gap-1 font-sans font-extrabold text-teal-700 dark:text-teal-400 text-xs uppercase">
                            <Activity className="w-3.5 h-3.5" />
                            SV:
                          </span>
                          <span>
                            TA <strong>{patient.vitals.bp}</strong>
                            {computedPam !== null && (
                              <span className="text-xs text-slate-500"> (PAM {computedPam})</span>
                            )}
                          </span>
                          <span>
                            FC <strong>{patient.vitals.hr}</strong>
                          </span>
                          <span>
                            FR <strong>{patient.vitals.rr}</strong>
                          </span>
                          <span>
                            T <strong>{patient.vitals.temp}°C</strong>
                          </span>
                          <span>
                            SpO2 <strong>{patient.vitals.spo2}%</strong>
                          </span>
                          {patient.vitals.glucose && (
                            <span>
                              Gluc <strong>{patient.vitals.glucose}</strong>
                            </span>
                          )}
                        </div>

                        {onUpdatePatient && (
                          <button
                            type="button"
                            onClick={() =>
                              setOpenCriticalEditorPatientId(
                                openCriticalEditorPatientId === patient.id ? null : patient.id
                              )
                            }
                            className={`font-sans text-xs font-bold px-2.5 py-0.5 rounded-md border flex items-center gap-1 transition-colors cursor-pointer ${
                              criticalSummaryItems.length > 0 ||
                              openCriticalEditorPatientId === patient.id
                                ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-rose-600'
                            }`}
                            title="Evolución y parámetros clínicos por sistemas (Opcional — Todos los pacientes)"
                          >
                            <HeartPulse className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              Sistemas
                              {criticalSummaryItems.length > 0
                                ? ` (${criticalSummaryItems.length})`
                                : ''}
                            </span>
                            {openCriticalEditorPatientId === patient.id ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    )}

                    {/* 2B. Resumen / Apunte Temporal para Presentación en el Pase de Visita */}
                    {editingRoundsNoteId === patient.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (onUpdateRoundsPresentation) {
                            onUpdateRoundsPresentation(patient.id, roundsNoteDraft.trim());
                          }
                          setEditingRoundsNoteId(null);
                        }}
                        className="p-3 rounded-xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 space-y-2 text-sm"
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-300">
                          <span>Apunte para el pase (temporal):</span>
                        </div>
                        <textarea
                          rows={2}
                          value={roundsNoteDraft}
                          onChange={(e) => setRoundsNoteDraft(e.target.value)}
                          placeholder="Estado hoy, eventos de guardia, respuesta a manejo..."
                          className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg text-slate-900 dark:text-white focus:outline-none"
                          autoFocus
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingRoundsNoteId(null)}
                            className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-md text-xs font-bold cursor-pointer"
                          >
                            Guardar
                          </button>
                        </div>
                      </form>
                    ) : patient.roundsPresentationNote && patient.roundsPresentationNote.trim() ? (
                      <div className="px-3 py-2 rounded-xl bg-amber-50/75 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 flex items-start justify-between gap-2 text-sm">
                        <div
                          onClick={() => {
                            setEditingRoundsNoteId(patient.id);
                            setRoundsNoteDraft(patient.roundsPresentationNote || '');
                          }}
                          title="Clic para editar apunte del pase"
                          className="min-w-0 flex-1 cursor-pointer"
                        >
                          <span className="text-xs font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300 mr-1.5">
                            Pase Hoy:
                          </span>
                          <span className="text-slate-800 dark:text-slate-200 text-xs sm:text-sm leading-snug break-words">
                            {patient.roundsPresentationNote}
                          </span>
                        </div>
                        {onUpdateRoundsPresentation && (
                          <button
                            type="button"
                            onClick={() => onUpdateRoundsPresentation(patient.id, '')}
                            title="Limpiar apunte"
                            className="p-0.5 text-slate-400 hover:text-rose-600 shrink-0 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRoundsNoteId(patient.id);
                          setRoundsNoteDraft('');
                        }}
                        className="w-full text-left px-3 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 hover:border-teal-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                        title="Agregar apunte rápido de guardia para el pase de visita"
                      >
                        <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                        <span>+ Apunte rápido para el pase...</span>
                      </button>
                    )}

                    {/* 2C. Evolución Clínica de Paciente Crítico por Sistemas */}
                    {openCriticalEditorPatientId === patient.id && onUpdatePatient ? (
                      <div className="pt-1">
                        <CriticalCareSystemsEditor
                          value={
                            patient.criticalCareSystems || {
                              enabled: true,
                            }
                          }
                          onChange={(updatedSystems: CriticalCareSystemsData) => {
                            onUpdatePatient({
                              ...patient,
                              criticalCareSystems: updatedSystems,
                              lastUpdated: new Date().toISOString(),
                            });
                          }}
                          patient={patient}
                        />
                      </div>
                    ) : (
                      criticalSummaryItems.length > 0 && (
                        <div
                          onClick={() => setOpenCriticalEditorPatientId(patient.id)}
                          title="Clic para editar evolución por sistemas"
                          className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 space-y-1.5 cursor-pointer hover:border-rose-300"
                        >
                          <div className="grid grid-cols-1 gap-1.5">
                            {criticalSummaryItems.map((sys) => (
                              <div
                                key={sys.key}
                                className="text-xs sm:text-sm leading-snug flex items-baseline gap-1.5"
                              >
                                <span
                                  className={`text-[11px] font-extrabold uppercase px-1.5 py-0.5 rounded border shrink-0 ${sys.badgeClass}`}
                                >
                                  {sys.shortLabel}
                                </span>
                                <span className="text-slate-800 dark:text-slate-200 break-words">
                                  {sys.summary}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    )}

                    {/* 2D. Estudios de Laboratorio y Gabinete Recientes + Comparativa con Guardia Previa */}
                    {(latestLab || (patient.studies && patient.studies.length > 0)) && (
                      <div className="space-y-1.5">
                        {latestLab && (
                          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-extrabold uppercase tracking-wider text-slate-500">
                                Labs ({latestLab.date.slice(5)}
                                {previousLab ? ` vs ${previousLab.date.slice(5)}` : ''})
                              </span>
                              {latestLab.isNew && (
                                <span className="px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-bold text-[11px]">
                                  NUEVO
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center font-mono tabular-nums">
                              {[
                                {
                                  label: 'Leucos',
                                  curr: latestLab.leucos,
                                  prev: previousLab?.leucos,
                                  fmt: (v: number) =>
                                    v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v),
                                },
                                {
                                  label: 'Hb',
                                  curr: latestLab.hb,
                                  prev: previousLab?.hb,
                                  fmt: (v: number) => String(v),
                                },
                                {
                                  label: 'Plaq',
                                  curr: latestLab.plaquetas,
                                  prev: previousLab?.plaquetas,
                                  fmt: (v: number) =>
                                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v),
                                },
                                {
                                  label: 'Cr',
                                  curr: latestLab.creatinina,
                                  prev: previousLab?.creatinina,
                                  fmt: (v: number) => String(v),
                                },
                                {
                                  label: 'Gluc',
                                  curr: latestLab.glucosa,
                                  prev: previousLab?.glucosa,
                                  fmt: (v: number) => String(v),
                                },
                                {
                                  label: 'Na / K',
                                  curr: latestLab.na,
                                  prev: previousLab?.na,
                                  fmt: () =>
                                    `${latestLab.na ?? '-'}/${latestLab.k ?? '-'}`,
                                },
                              ]
                                .filter(
                                  (item) =>
                                    item.curr !== undefined ||
                                    (item.label === 'Na / K' && latestLab.k !== undefined)
                                )
                                .map((item) => (
                                  <div
                                    key={item.label}
                                    className="bg-slate-50 dark:bg-slate-800/70 px-1.5 py-1 rounded-lg border border-slate-200/70 dark:border-slate-700/70"
                                  >
                                    <div className="text-[11px] font-sans text-slate-400">
                                      {item.label}
                                    </div>
                                    <div className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm flex items-center justify-center gap-0.5">
                                      <span>{item.fmt(item.curr as number)}</span>
                                      {item.prev !== undefined &&
                                        item.curr !== undefined &&
                                        item.label !== 'Na / K' &&
                                        (item.curr > item.prev ? (
                                          <TrendingUp className="w-3 h-3 text-rose-500 shrink-0" />
                                        ) : item.curr < item.prev ? (
                                          <TrendingDown className="w-3 h-3 text-emerald-500 shrink-0" />
                                        ) : (
                                          <Minus className="w-3 h-3 text-slate-400 shrink-0" />
                                        ))}
                                    </div>
                                    {item.prev !== undefined && item.label !== 'Na / K' && (
                                      <div className="text-[10px] text-slate-400 leading-none mt-0.5">
                                        prev {item.fmt(item.prev)}
                                      </div>
                                    )}
                                  </div>
                                ))}
                            </div>

                            {/* Gasometry or Extra Panel Parameters if present */}
                            {(latestLab.ph !== undefined ||
                              latestLab.lactato !== undefined ||
                              latestLab.pcr !== undefined ||
                              extraLabEntries.length > 0) && (
                              <div className="flex flex-wrap gap-1.5 pt-0.5 font-mono text-xs">
                                {latestLab.ph !== undefined && (
                                  <span className="px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                                    pH {latestLab.ph}
                                    {latestLab.pco2 !== undefined ? ` · pCO2 ${latestLab.pco2}` : ''}
                                    {latestLab.hco3 !== undefined ? ` · HCO3 ${latestLab.hco3}` : ''}
                                  </span>
                                )}
                                {latestLab.lactato !== undefined && (
                                  <span className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold">
                                    Lac {latestLab.lactato}
                                  </span>
                                )}
                                {latestLab.pcr !== undefined && (
                                  <span className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                    PCR {latestLab.pcr}
                                  </span>
                                )}
                                {extraLabEntries.slice(0, 8).map((ep, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 rounded bg-teal-50/80 dark:bg-teal-950/50 text-teal-900 dark:text-teal-200 border border-teal-200 dark:border-teal-800"
                                  >
                                    {ep.label}: <strong>{ep.value}</strong>
                                    {ep.unit ? ` ${ep.unit}` : ''}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Estudios de Gabinete / Imagen / Cultivos recientes */}
                        {patient.studies && patient.studies.length > 0 && (
                          <div className="bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm space-y-1">
                            {patient.studies.slice(0, 2).map((st) => (
                              <div key={st.id} className="leading-snug break-words">
                                <span className="font-mono font-bold text-xs text-cyan-700 dark:text-cyan-400 mr-1.5">
                                  [{st.category} {st.date.slice(5)}]
                                </span>
                                <strong className="text-slate-800 dark:text-slate-200">
                                  {st.title}:
                                </strong>{' '}
                                <span className="text-slate-600 dark:text-slate-400">
                                  {st.summary}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 2E. Terapéutica Activa: Dieta, Soluciones/Infusiones, Antibióticos y Fármacos */}
                    {(patient.diet ||
                      patient.ivFluids ||
                      (patient.structuredSolutions && patient.structuredSolutions.length > 0) ||
                      activeMeds.length > 0) && (
                      <div className="space-y-1.5">
                        {(patient.diet ||
                          patient.ivFluids ||
                          (patient.structuredSolutions && patient.structuredSolutions.length > 0)) && (
                          <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 leading-snug break-words space-y-0.5">
                            {patient.diet && (
                              <div>
                                <strong className="text-slate-900 dark:text-white">Dieta:</strong>{' '}
                                {patient.diet}
                              </div>
                            )}
                            {patient.structuredSolutions && patient.structuredSolutions.length > 0 ? (
                              <div>
                                <strong className="text-slate-900 dark:text-white">
                                  Sol ({patient.structuredSolutions.length}):
                                </strong>{' '}
                                {patient.structuredSolutions
                                  .map((s) => formatParenteralSolutionLine(s))
                                  .join(' + ')}
                              </div>
                            ) : (
                              patient.ivFluids && (
                                <div>
                                  <strong className="text-slate-900 dark:text-white">Sol:</strong>{' '}
                                  {patient.ivFluids}
                                </div>
                              )
                            )}
                          </div>
                        )}

                        {(activeAntibiotics.length > 0 || activeLimitedCourseMeds.length > 0) && (
                          <div className="flex flex-wrap gap-1.5">
                            {activeAntibiotics.map((ab) => {
                              const status = calculateAntibioticDay(ab.startDate, ab.plannedDays);
                              return (
                                <div
                                  key={ab.id}
                                  className="text-xs px-2.5 py-1 rounded-lg border bg-purple-50 dark:bg-purple-950/50 text-purple-900 dark:text-purple-200 border-purple-200 dark:border-purple-800 flex items-center gap-1.5 max-w-full"
                                  title="Antibiótico con conteo de días"
                                >
                                  <Pill className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                                  <span className="font-bold truncate">
                                    {ab.name} {ab.dose} {ab.route}
                                  </span>
                                  <span className="font-mono font-bold text-[11px] bg-purple-200 dark:bg-purple-900 px-1.5 rounded shrink-0">
                                    {status.displayString}
                                  </span>
                                </div>
                              );
                            })}

                            {activeLimitedCourseMeds.map((lim) => {
                              const status = calculateAntibioticDay(lim.startDate, lim.plannedDays);
                              return (
                                <div
                                  key={lim.id}
                                  className="text-xs px-2.5 py-1 rounded-lg border bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800 flex items-center gap-1.5 max-w-full"
                                  title="Medicamento por tiempo limitado / curso corto con conteo de días"
                                >
                                  <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                  <span className="font-bold truncate">
                                    {lim.name} {lim.dose} {lim.route}
                                  </span>
                                  <span className="font-mono font-bold text-[11px] bg-amber-200 dark:bg-amber-900 px-1.5 rounded shrink-0">
                                    {status.displayString}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {otherActiveMeds.length > 0 && (
                          <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-snug px-1">
                            <strong className="text-slate-700 dark:text-slate-300">
                              Fármacos:
                            </strong>{' '}
                            {otherActiveMeds
                              .map((m) => `${m.name} ${m.dose} ${m.route}`)
                              .join(' · ')}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 2F. Plan y Pendientes del Turno */}
                    {pendingList.length > 0 && (
                      <div className="space-y-1.5 pt-0.5">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 px-0.5 block">
                          Pendientes ({pendingList.length})
                        </span>
                        {pendingList.map((pen) => {
                          const tl = getPendingTrafficLightInfo(pen);
                          return (
                            <div
                              key={pen.id}
                              className={`flex flex-wrap items-start justify-between gap-2 text-xs sm:text-sm bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border ${tl.borderClass}`}
                            >
                              <label className="flex items-start gap-2 cursor-pointer min-w-0 flex-1">
                                <input
                                  type="checkbox"
                                  checked={pen.completed}
                                  onChange={() => onTogglePending(patient.id, pen.id)}
                                  className="rounded text-teal-600 focus:ring-teal-500 shrink-0 mt-1 w-4 h-4"
                                  title="Marcar paso completado"
                                />
                                <span
                                  className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${tl.dotClass}`}
                                  title={`Urgencia: ${tl.label}`}
                                />
                                <span className="font-medium text-slate-800 dark:text-slate-200 break-words leading-snug">
                                  {pen.text}
                                </span>
                              </label>
                              {pen.workflowStage === 'collect' && (
                                <span className="text-xs bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded font-bold shrink-0">
                                  Recabar
                                </span>
                              )}
                              {pen.workflowStage === 'register_census' && onOpenDirectLabStudy && (
                                <button
                                  type="button"
                                  onClick={() => onOpenDirectLabStudy(patient)}
                                  className="text-xs bg-teal-600 text-white px-2 py-0.5 rounded font-bold shrink-0 cursor-pointer"
                                >
                                  + Censo
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Card Bottom Action Toolbar */}
                  <div className="px-3 sm:px-3.5 py-2.5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onSelectPatient(patient)}
                        className="px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Abrir Expediente Clínico y Matriz de Laboratorios"
                      >
                        <Eye className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                        <span>Expediente</span>
                      </button>
                      {onOpenDirectLabStudy && (
                        <button
                          type="button"
                          onClick={() => onOpenDirectLabStudy(patient)}
                          className="p-1.5 text-teal-700 dark:text-teal-300 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-lg transition-colors cursor-pointer"
                          title="Capturar laboratorios por paneles o estudios directos"
                          aria-label="Capturar laboratorios o estudios"
                        >
                          <FlaskConical className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onEditPatient(patient)}
                        className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
                        title="Historia Clínica de Ingreso / Editar Ficha"
                        aria-label="Editar paciente"
                      >
                        <FileEdit className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      {onDeletePatient && (
                        <button
                          type="button"
                          onClick={() => onDeletePatient(patient)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                          title={isAdmin ? 'Eliminar paciente' : 'Eliminar (Requiere PIN Administrador)'}
                          aria-label="Eliminar paciente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {patient.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => onDischargePatient(patient)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors flex items-center gap-0.5 cursor-pointer"
                          title={isAdmin ? 'Dar de alta / Egreso' : 'Egreso (Requiere PIN Administrador)'}
                          aria-label="Egreso hospitalario"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                          {!isAdmin && <Lock className="w-2.5 h-2.5 text-amber-500" />}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onGenerateNote(patient)}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <ClipboardList className="w-3.5 h-3.5 shrink-0" />
                        <span>Evolucionar</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* VIEW 3: COMPACT LIST VIEW ("Al grano", rich clinical strips, responsive on Mobile/Tablet/Desktop, with 1-click jump to detailed Card View) */
          <div className="space-y-2.5">
            {/* List View Header Banner */}
            <div className="bg-slate-900 text-slate-100 px-3.5 py-2.5 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="inline-flex items-center gap-1.5 font-extrabold text-teal-400 uppercase tracking-wider">
                  <TableIcon className="w-4 h-4 shrink-0" />
                  <span>Vista de Lista Compacta ({filteredPatients.length})</span>
                </span>
                <span className="hidden sm:inline text-slate-400">·</span>
                <span className="text-slate-300 text-[11px] sm:text-xs">
                  Haz clic en la cama, nombre o en <strong>"Ir a Cuadro"</strong> para abrir ese paciente en la vista de cuadros detallada
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-teal-600 text-teal-300 hover:text-white border border-slate-700 font-bold text-[11px] flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Ver todos en Cuadros</span>
              </button>
            </div>

            {/* Desktop Column Header Strip */}
            <div className="hidden lg:grid lg:grid-cols-12 gap-3 px-4 py-2 bg-slate-800/95 text-slate-300 rounded-xl text-[11px] font-extrabold uppercase tracking-wider">
              <div className="lg:col-span-3">1. Cama · Paciente · Médico y Soporte</div>
              <div className="lg:col-span-3">2. Diagnósticos Actuales y Pase Hoy</div>
              <div className="lg:col-span-3">3. SV · Labs Clave · ATB y Manejo</div>
              <div className="lg:col-span-3">4. Pendientes del Turno y Acciones</div>
            </div>

            {/* Compact Patient Rows */}
            <div className="space-y-2">
              {filteredPatients.map((patient) => {
                const stayDays = calculateHospitalStayDays(patient.admissionDate);
                const activeMeds = patient.medications.filter((m) => m.active);
                const activeAntibiotics = activeMeds.filter((m) => m.isAntibiotic);
                const activeLimited = activeMeds.filter(
                  (m) =>
                    !m.isAntibiotic &&
                    Boolean(m.isLimitedCourse || (m.plannedDays && m.plannedDays > 0))
                );
                const otherActiveMeds = activeMeds.filter(
                  (m) =>
                    !m.isAntibiotic &&
                    !m.isLimitedCourse &&
                    !(m.plannedDays && m.plannedDays > 0)
                );
                const pendingList = patient.pendings.filter((p) => !p.completed);
                const patientHasAltaPending = hasDischargePending(patient);
                const codeInfo = getCodeStatusInfo(patient.codeStatus);
                const respFlags = getRespiratorySupportFlags(patient);
                const docColor = getDoctorColorInfo(
                  patient.attendingPhysician,
                  doctorsCatalogItems
                );
                const srvInfo = getServiceColorInfo(patient.service, servicesCatalog);
                const latestLab = patient.labs && patient.labs.length > 0 ? patient.labs[0] : null;
                const previousLab =
                  patient.labs && patient.labs.length > 1 ? patient.labs[1] : null;
                const compactLabChips = buildCompactLabSummaryItems(latestLab, previousLab);
                const criticalSummaryItems = formatCriticalCareSystemsSummary(
                  patient.criticalCareSystems
                );
                const nonRedundantTags = getNonRedundantClinicalTags(patient.clinicalTags);
                const hasPositiveAllergy =
                  Boolean(patient.allergies?.trim()) &&
                  patient.allergies.trim().toLowerCase() !== 'negadas' &&
                  patient.allergies.trim().toLowerCase() !== 'ninguna';

                let computedPam: number | null = null;
                const bpParts = (patient.vitals?.bp || '')
                  .split('/')
                  .map((n) => parseFloat(n.trim()));
                if (bpParts.length === 2 && !isNaN(bpParts[0]) && !isNaN(bpParts[1])) {
                  computedPam = Math.round((bpParts[0] + 2 * bpParts[1]) / 3);
                }

                const severityLeftAccent =
                  patient.severity === 'Muy Grave / UCI' || patient.severity === 'Grave'
                    ? 'border-l-4 border-l-rose-600'
                    : patient.severity === 'Delicado'
                    ? 'border-l-4 border-l-amber-500'
                    : 'border-l-4 border-l-emerald-500';

                return (
                  <div
                    key={patient.id}
                    className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 ${severityLeftAccent} shadow-xs hover:shadow-md hover:border-teal-400/70 dark:hover:border-teal-600/70 transition-all p-3 sm:p-3.5 grid grid-cols-1 lg:grid-cols-12 gap-3 items-start text-xs`}
                  >
                    {/* ZONE 1: CAMA, PACIENTE, SOPORTE, ETIQUETAS Y MÉDICO A CARGO */}
                    <div className="lg:col-span-3 space-y-2 min-w-0">
                      {/* Clickable Patient Header -> Jumps directly to this patient's detailed card */}
                      <button
                        type="button"
                        onClick={() => handleJumpToPatientCard(patient.id)}
                        title={`Ir al cuadro detallado de ${patient.name} (${patient.bed})`}
                        className="group w-full text-left flex items-start justify-between gap-2 cursor-pointer rounded-xl p-1 -m-1 hover:bg-teal-50/70 dark:hover:bg-teal-950/30 transition-colors"
                      >
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <span className="px-2 py-0.5 bg-slate-900 dark:bg-slate-800 group-hover:bg-teal-600 text-white font-mono font-extrabold text-xs rounded-lg shrink-0 transition-colors">
                            {patient.bed}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="font-extrabold text-slate-900 dark:text-white group-hover:text-teal-700 dark:group-hover:text-teal-300 text-sm leading-tight break-words flex items-center gap-1.5 flex-wrap">
                              <span>{patient.name}</span>
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded border inline-flex items-center gap-1 leading-none"
                                style={srvInfo.badgeStyle}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: srvInfo.color }}
                                />
                                <span>{patient.service.replace('Medicina Interna ', 'MI ')}</span>
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 flex flex-wrap items-center gap-x-1.5">
                              <span>
                                <strong className="text-slate-700 dark:text-slate-200">
                                  {patient.age}a
                                </strong>{' '}
                                · {patient.gender.slice(0, 1)}
                              </span>
                              <span>·</span>
                              <span>{patient.recordNumber}</span>
                              <span>·</span>
                              <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold">
                                DE: {stayDays}d
                              </span>
                            </div>
                          </div>
                        </div>
                        <span className="px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-[10px] font-bold shrink-0 opacity-85 group-hover:opacity-100 flex items-center gap-0.5">
                          <LayoutGrid className="w-3 h-3" />
                          <span>Cuadro</span>
                        </span>
                      </button>

                      {/* Primary Colored Markers (ALTA, INTUBADO, CPAP, Gravedad, RCP) */}
                      <div className="flex flex-wrap items-center gap-1">
                        {patientHasAltaPending && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-extrabold text-[10px] uppercase">
                            ALTA HOY
                          </span>
                        )}
                        {respFlags.isIntubated && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-700 text-white font-extrabold text-[10px] uppercase flex items-center gap-1">
                            <Activity className="w-3 h-3 shrink-0" />
                            <span>INTUBADO</span>
                          </span>
                        )}
                        {respFlags.isCpap && (
                          <span className="px-1.5 py-0.5 rounded bg-sky-600 text-white font-extrabold text-[10px] uppercase flex items-center gap-1">
                            <Wind className="w-3 h-3 shrink-0" />
                            <span>CPAP</span>
                          </span>
                        )}
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded border ${getSeverityBadge(
                            patient.severity
                          )}`}
                        >
                          {patient.severity === 'Muy Grave / UCI' ? 'UCI' : patient.severity}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded border font-extrabold ${codeInfo.badgeClass}`}
                        >
                          {codeInfo.codeLabel}
                        </span>
                        {nonRedundantTags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Allergy Alert & Attending Physician Selector */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {hasPositiveAllergy && (
                          <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold text-[10px] flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[180px]">
                              Alergia: {patient.allergies}
                            </span>
                          </span>
                        )}

                        <div
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] border max-w-full"
                          style={
                            patient.attendingPhysician
                              ? docColor.badgeStyle
                              : {
                                  backgroundColor: 'rgba(148, 163, 184, 0.12)',
                                  borderColor: 'rgba(148, 163, 184, 0.35)',
                                }
                          }
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{
                              backgroundColor: patient.attendingPhysician
                                ? docColor.color
                                : '#94a3b8',
                            }}
                          />
                          <select
                            value={patient.attendingPhysician || ''}
                            onChange={(e) => {
                              onAssignAttendingPhysician?.(patient.id, e.target.value, false);
                            }}
                            aria-label={`Médico a cargo de ${patient.name}`}
                            className="bg-transparent font-bold focus:outline-none cursor-pointer truncate max-w-[180px]"
                          >
                            <option value="">-- Sin médico --</option>
                            {availableDoctors.map((docName) => (
                              <option key={docName} value={docName}>
                                {docName}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* ZONE 2: DIAGNÓSTICOS ACTUALES (CIE-10) + APUNTE RÁPIDO DE PASE (PASE HOY) + SISTEMAS CRÍTICOS */}
                    <div
                      onClick={() => handleJumpToPatientCard(patient.id)}
                      title="Clic para abrir el cuadro detallado de este paciente"
                      className="lg:col-span-3 space-y-1.5 min-w-0 cursor-pointer lg:border-l lg:border-slate-100 dark:lg:border-slate-800 lg:pl-3"
                    >
                      <div className="space-y-1">
                        {patient.diagnoses.slice(0, 3).map((diag, idx) => {
                          const withoutNum = diag.replace(/^(?:\d+[.)]\s*|[•\-*]\s*)/, '').trim();
                          const cieMatch = withoutNum.match(
                            /^\[(?:CIE-?10:\s*)?([A-Z0-9.-]+)\]\s*(.*)$/i
                          );
                          return (
                            <div
                              key={idx}
                              className="flex items-baseline gap-1 leading-snug text-xs break-words"
                            >
                              <span className="font-mono font-bold text-teal-700 dark:text-teal-400 text-[11px] shrink-0">
                                {idx + 1}.
                              </span>
                              {cieMatch && (
                                <span className="px-1 py-0.2 rounded bg-teal-50 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-mono font-bold text-[10px] shrink-0">
                                  {cieMatch[1].toUpperCase()}
                                </span>
                              )}
                              <span className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
                                {cieMatch ? cieMatch[2] : withoutNum}
                              </span>
                            </div>
                          );
                        })}
                        {patient.diagnoses.length > 3 && (
                          <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold">
                            +{patient.diagnoses.length - 3} diagnóstico(s) más...
                          </span>
                        )}
                      </div>

                      {/* Apunte Rápido para el Pase (Pase Hoy) o Motivo de Ingreso */}
                      {patient.roundsPresentationNote?.trim() ? (
                        <div className="px-2.5 py-1.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/70 text-[11px] leading-snug">
                          <span className="font-extrabold uppercase text-amber-800 dark:text-amber-300 mr-1">
                            Pase Hoy:
                          </span>
                          <span className="text-slate-800 dark:text-slate-200 line-clamp-2">
                            {patient.roundsPresentationNote}
                          </span>
                        </div>
                      ) : (
                        patient.admissionReason?.trim() && (
                          <div className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 text-[11px] text-slate-600 dark:text-slate-300 line-clamp-1">
                            <strong className="text-slate-700 dark:text-slate-200">
                              Ingreso:
                            </strong>{' '}
                            {patient.admissionReason}
                          </div>
                        )
                      )}

                      {/* Compact Critical Care Systems Badges if enabled */}
                      {criticalSummaryItems.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pt-0.5">
                          {criticalSummaryItems.map((sys) => (
                            <span
                              key={sys.key}
                              title={`${sys.label}: ${sys.summary}`}
                              className={`text-[9.5px] font-extrabold uppercase px-1.5 py-0.2 rounded border ${sys.badgeClass}`}
                            >
                              {sys.shortLabel}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* ZONE 3: SIGNOS VITALES (SV + PAM), LABS CLAVE CON TENDENCIA Y ESQUEMA ACTIVO (ATB / CICLOS CORTOS / SOLUCIONES) */}
                    <div
                      onClick={() => handleJumpToPatientCard(patient.id)}
                      title="Clic para abrir el cuadro detallado de este paciente"
                      className="lg:col-span-3 space-y-1.5 min-w-0 cursor-pointer lg:border-l lg:border-slate-100 dark:lg:border-slate-800 lg:pl-3"
                    >
                      {/* Signos Vitales Compact Strip */}
                      <div className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 font-mono text-[11px] flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-700 dark:text-slate-200">
                        <span className="font-extrabold text-teal-600 dark:text-teal-400">SV:</span>
                        <span>
                          TA <strong>{patient.vitals?.bp || '-'}</strong>
                          {computedPam ? ` (PAM ${computedPam})` : ''}
                        </span>
                        <span>
                          FC <strong>{patient.vitals?.hr || '-'}</strong>
                        </span>
                        <span>
                          T <strong>{patient.vitals?.temp || '-'}°</strong>
                        </span>
                        <span>
                          SpO2 <strong>{patient.vitals?.spo2 || '-'}%</strong>
                        </span>
                        {patient.vitals?.glucose && (
                          <span>
                            Gluc <strong>{patient.vitals.glucose}</strong>
                          </span>
                        )}
                      </div>

                      {/* Key Lab Chips with Trend Arrows */}
                      {compactLabChips.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 font-mono text-[11px]">
                          {latestLab?.isNew && (
                            <span className="px-1.5 py-0.2 rounded bg-teal-600 text-white font-sans font-extrabold text-[9.5px]">
                              NUEVO
                            </span>
                          )}
                          {compactLabChips.map((chip) => (
                            <span
                              key={chip.label}
                              className={`px-1.5 py-0.5 rounded border inline-flex items-center gap-0.5 ${
                                chip.isAlert
                                  ? 'bg-rose-50/90 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-800 font-bold'
                                  : 'bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              <span className="text-slate-400 font-sans text-[10px]">
                                {chip.label}:
                              </span>
                              <span className="font-bold">{chip.valueText}</span>
                              {chip.trend === 'up' && (
                                <TrendingUp className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                              )}
                              {chip.trend === 'down' && (
                                <TrendingDown className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                              )}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Active Antibiotics & Limited-Course Medications */}
                      {(activeAntibiotics.length > 0 || activeLimited.length > 0) && (
                        <div className="flex flex-wrap gap-1">
                          {activeAntibiotics.map((ab) => {
                            const st = calculateAntibioticDay(ab.startDate, ab.plannedDays);
                            return (
                              <span
                                key={ab.id}
                                className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800 font-bold text-[11px] inline-flex items-center gap-1"
                              >
                                <Pill className="w-3 h-3 text-purple-500 shrink-0" />
                                <span className="truncate max-w-[140px]">{ab.name}</span>
                                <span className="font-mono text-[10px] bg-purple-200 dark:bg-purple-900 px-1 rounded">
                                  {st.displayString}
                                </span>
                              </span>
                            );
                          })}
                          {activeLimited.map((lim) => {
                            const st = calculateAntibioticDay(lim.startDate, lim.plannedDays);
                            return (
                              <span
                                key={lim.id}
                                className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 font-bold text-[11px] inline-flex items-center gap-1"
                              >
                                <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                                <span className="truncate max-w-[140px]">{lim.name}</span>
                                <span className="font-mono text-[10px] bg-amber-200 dark:bg-amber-900 px-1 rounded">
                                  {st.displayString}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Concise Solutions / Diet / Other Meds 1-liner */}
                      {(patient.structuredSolutions?.length ||
                        patient.ivFluids ||
                        otherActiveMeds.length > 0) && (
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-1">
                          {patient.structuredSolutions && patient.structuredSolutions.length > 0 ? (
                            <span>
                              <strong className="text-slate-700 dark:text-slate-300">Sol:</strong>{' '}
                              {patient.structuredSolutions
                                .map((s) => formatParenteralSolutionLine(s))
                                .join(' + ')}
                            </span>
                          ) : patient.ivFluids ? (
                            <span>
                              <strong className="text-slate-700 dark:text-slate-300">Sol:</strong>{' '}
                              {patient.ivFluids}
                            </span>
                          ) : (
                            <span>
                              <strong className="text-slate-700 dark:text-slate-300">
                                Fármacos:
                              </strong>{' '}
                              {otherActiveMeds.map((m) => m.name).join(', ')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ZONE 4: PENDIENTES INTERACTIVOS DEL TURNO + BOTONES DE ACCIÓN Y SALTO A CUADRO */}
                    <div className="lg:col-span-3 flex flex-col justify-between gap-2 min-w-0 lg:border-l lg:border-slate-100 dark:lg:border-slate-800 lg:pl-3 h-full">
                      {/* Interactive Shift Pendings */}
                      <div className="space-y-1">
                        {pendingList.length > 0 ? (
                          pendingList.slice(0, 3).map((pen) => {
                            const tl = getPendingTrafficLightInfo(pen);
                            return (
                              <div
                                key={pen.id}
                                className={`flex items-start justify-between gap-1.5 px-2 py-1 rounded-lg border bg-slate-50/70 dark:bg-slate-800/50 text-[11px] ${tl.borderClass}`}
                              >
                                <label className="flex items-start gap-1.5 cursor-pointer min-w-0 flex-1">
                                  <input
                                    type="checkbox"
                                    checked={pen.completed}
                                    onChange={() => onTogglePending(patient.id, pen.id)}
                                    className="rounded text-teal-600 focus:ring-teal-500 shrink-0 mt-0.5 w-3.5 h-3.5"
                                  />
                                  <span
                                    className={`w-2 h-2 rounded-full shrink-0 mt-1 ${tl.dotClass}`}
                                  />
                                  <span className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">
                                    {pen.text}
                                  </span>
                                </label>
                                {pen.workflowStage === 'register_census' &&
                                  onOpenDirectLabStudy && (
                                    <button
                                      type="button"
                                      onClick={() => onOpenDirectLabStudy(patient)}
                                      className="text-[10px] bg-teal-600 text-white px-1.5 py-0.2 rounded font-bold shrink-0 cursor-pointer"
                                    >
                                      +Censo
                                    </button>
                                  )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 py-0.5">
                            <Check className="w-3.5 h-3.5 shrink-0" />
                            <span>Sin pendientes activos</span>
                          </div>
                        )}
                        {pendingList.length > 3 && (
                          <button
                            type="button"
                            onClick={() => handleJumpToPatientCard(patient.id)}
                            className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                          >
                            +{pendingList.length - 3} pendiente(s) más en su cuadro...
                          </button>
                        )}
                      </div>

                      {/* Quick Action Buttons Row */}
                      <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                        <button
                          type="button"
                          onClick={() => handleJumpToPatientCard(patient.id)}
                          aria-label={`Ir al cuadro de ${patient.name}`}
                          title="Ir a este paciente en la Vista de Cuadros Detallada"
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-teal-600 dark:bg-slate-800 dark:hover:bg-teal-600 text-white font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <LayoutGrid className="w-3 h-3 text-teal-400 shrink-0" />
                          <span>Ir a Cuadro</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onSelectPatient(patient)}
                          title="Abrir Expediente Clínico"
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3 text-teal-500 shrink-0" />
                          <span>Exp.</span>
                        </button>

                        {onOpenDirectLabStudy && (
                          <button
                            type="button"
                            onClick={() => onOpenDirectLabStudy(patient)}
                            title="Capturar laboratorios o estudios directos"
                            aria-label={`Capturar laboratorios de ${patient.name}`}
                            className="p-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 cursor-pointer"
                          >
                            <FlaskConical className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onGenerateNote(patient)}
                          title="Generar Nota de Evolución"
                          className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          <ClipboardList className="w-3 h-3 shrink-0" />
                          <span>Nota</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* FLOATING SYMBOLOGY DOCK: SEARCH/FILTERS POPOVER + LATERAL DRAWER + LABS + SCROLL UP/DOWN */}
      <div className="fixed bottom-3 right-3 z-[45] flex items-end gap-2 print:hidden">
        {/* Floating Collapsible Search, Filter & View Menu (Always at hand, compact symbology-driven) */}
        {isFloatingFilterOpen && (
          <div className="w-72 sm:w-80 bg-slate-900/95 text-slate-100 border border-slate-700 rounded-2xl shadow-2xl p-3 space-y-2.5 backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="text-xs font-extrabold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5" />
                <span>Búsqueda y Filtros</span>
              </span>
              <button
                type="button"
                onClick={() => setIsFloatingFilterOpen(false)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
                aria-label="Cerrar menú de búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cama, paciente, CIE-10, fármaco..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-teal-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Service & Attending Physician Selectors */}
            <div className="grid grid-cols-1 gap-1.5 text-xs">
              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                aria-label="Filtrar por servicio"
                className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 font-semibold focus:outline-none"
              >
                <option value="all">Servicio: Todos</option>
                {(servicesCatalog && servicesCatalog.length > 0
                  ? servicesCatalog
                  : defaultServicesCatalog
                ).map((srv) => (
                  <option key={srv.id} value={srv.name}>
                    {srv.name}
                  </option>
                ))}
              </select>

              <select
                value={doctorFilter}
                onChange={(e) => setDoctorFilter(e.target.value)}
                aria-label="Filtrar por médico a cargo"
                className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 font-semibold focus:outline-none"
              >
                <option value="all">Médico: Todos</option>
                {availableDoctors.map((docName) => (
                  <option key={docName} value={docName}>
                    {docName}
                  </option>
                ))}
                <option value="__unassigned__">Sin médico asignado</option>
              </select>
            </div>

            {/* View Mode Selector (Strictly Cuadros vs Lista — no duplicate Pendientes button here) */}
            <div className="grid grid-cols-2 gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer ${
                  viewMode === 'cards' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Vista Cuadros</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('dense-table')}
                className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer ${
                  viewMode === 'dense-table'
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Vista Lista</span>
              </button>
            </div>
          </div>
        )}

        {/* Vertical Stack of Pure Symbology Buttons */}
        <div className="flex flex-col gap-1.5">
          {/* 1. Open Lateral Census & Settings Drawer (Mobile/Tablet < xl) */}
          {onToggleMobileDrawer && (
            <button
              type="button"
              onClick={onToggleMobileDrawer}
              title="Abrir panel lateral de contadores del censo y ajustes"
              aria-label="Abrir panel lateral de censo"
              className="xl:hidden relative h-9 w-9 rounded-xl bg-slate-900/95 hover:bg-teal-600 text-slate-100 hover:text-white border border-slate-700 shadow-lg flex items-center justify-center transition-colors cursor-pointer backdrop-blur-xs"
            >
              <SlidersHorizontal className="w-4 h-4 text-teal-400" />
              {railFilter !== 'active' && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-teal-400 ring-2 ring-slate-900" />
              )}
            </button>
          )}

          {/* 2. Toggle Floating Search & Filters Menu (Always visible on Mobile/Tablet; on Desktop ONLY appears when the main top search bar scrolls out of view) */}
          {showFloatingSearchAndTools && (
            <button
              type="button"
              onClick={() => setIsFloatingFilterOpen((prev) => !prev)}
              title="Abrir menú desplegable de búsqueda, filtros y vistas"
              aria-label="Menú desplegable de búsqueda y filtros"
              className={`relative h-9 w-9 rounded-xl border shadow-lg flex items-center justify-center transition-colors cursor-pointer backdrop-blur-xs ${
                isFloatingFilterOpen
                  ? 'bg-teal-600 text-white border-teal-500'
                  : 'bg-slate-900/95 hover:bg-teal-600 text-slate-100 hover:text-white border-slate-700'
              }`}
            >
              <Search
                className={`w-4 h-4 ${isFloatingFilterOpen ? 'text-white' : 'text-teal-400'}`}
              />
              {(searchTerm.trim() !== '' ||
                serviceFilter !== 'all' ||
                doctorFilter !== 'all') && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-slate-900" />
              )}
            </button>
          )}

          {/* 3. Quick Add Pending Button (Always visible on Mobile/Tablet; on Desktop appears when scrolled down) */}
          {onAddQuickPending && showFloatingSearchAndTools && (
            <button
              type="button"
              onClick={() => {
                if (!quickPendingPatientId && filteredPatients[0]) {
                  setQuickPendingPatientId(filteredPatients[0].id);
                }
                setShowQuickAddPending((prev) => !prev);
                setIsFloatingFilterOpen(false);
              }}
              title="Agregar pendiente rápido del turno"
              aria-label="Agregar pendiente rápido"
              className={`relative h-9 w-9 rounded-xl border shadow-lg flex items-center justify-center transition-colors cursor-pointer backdrop-blur-xs ${
                showQuickAddPending
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-slate-900/95 hover:bg-emerald-600 text-slate-100 hover:text-white border-slate-700'
              }`}
            >
              <ListChecks
                className={`w-4 h-4 ${showQuickAddPending ? 'text-white' : 'text-emerald-400'}`}
              />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-600 text-white font-mono font-extrabold text-[9px] flex items-center justify-center ring-1 ring-slate-900">
                +
              </span>
            </button>
          )}

          {/* 4. Quick Direct Lab / Panel Entry Button (Always visible on Mobile/Tablet; on Desktop appears when scrolled down) */}
          {onOpenDirectLabStudy && showFloatingSearchAndTools && (
            <button
              type="button"
              onClick={() => onOpenDirectLabStudy(null)}
              title="Capturar laboratorios por paneles o estudios directos"
              aria-label="Capturar laboratorios o estudios"
              className="h-9 w-9 rounded-xl bg-slate-900/95 hover:bg-teal-600 text-slate-100 hover:text-white border border-slate-700 shadow-lg flex items-center justify-center transition-colors cursor-pointer backdrop-blur-xs"
            >
              <FlaskConical className="w-4 h-4 text-cyan-400" />
            </button>
          )}

          {/* 5. Scroll to Top */}
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            title="Subir rápidamente al inicio de la página"
            aria-label="Subir al inicio"
            className="h-9 w-9 rounded-xl bg-slate-900/95 hover:bg-teal-600 text-slate-100 hover:text-white border border-slate-700 shadow-lg flex items-center justify-center transition-colors cursor-pointer backdrop-blur-xs"
          >
            <ArrowUp className="w-4 h-4 text-teal-400" />
          </button>

          {/* 6. Scroll to Bottom */}
          <button
            type="button"
            onClick={() =>
              window.scrollTo({
                top: document.documentElement.scrollHeight,
                behavior: 'smooth',
              })
            }
            title="Bajar rápidamente al final de la página"
            aria-label="Bajar al final"
            className="h-9 w-9 rounded-xl bg-slate-900/95 hover:bg-teal-600 text-slate-100 hover:text-white border border-slate-700 shadow-lg flex items-center justify-center transition-colors cursor-pointer backdrop-blur-xs"
          >
            <ArrowDown className="w-4 h-4 text-teal-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
