import React, { useState, useEffect } from 'react';
import {
  X,
  Activity,
  Pill,
  ClipboardList,
  FileText,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldCheck,
  Copy,
  Check,
  BookOpen,
  FileImage,
  Calendar,
  LogOut,
  FlaskConical,
  Tag,
  Clock,
  Settings,
} from 'lucide-react';
import {
  Patient,
  LabRecord,
  MedicationItem,
  ClinicalPending,
  ClinicalNoteRecord,
  DiagnosticStudy,
  PendingUrgencyColor,
  ResidentProfile,
  ParenteralSolutionItem,
  PatientNursingOrderItem,
} from '../types/clinical.ts';
import {
  calculateHospitalStayDays,
  calculateAntibioticDay,
  getCodeStatusInfo,
  getRespiratorySupportFlags,
  getNonRedundantClinicalTags,
  filterAndSortLabsOldestToNewest,
  calculateLabNumericTrend,
  LabFilterMode,
  isChainedClinicalPending,
  advancePendingWorkflow,
  getPendingTrafficLightInfo,
  DEFAULT_MEDICATION_ROUTES,
  DEFAULT_DIET_PRESETS,
} from '../utils/clinicalLogic.ts';
import { defaultNursingRepository } from '../data/seedPatients.ts';
import { InfoPopover } from './InfoPopover.tsx';
import { DiagnosisListEditor } from './DiagnosisListEditor.tsx';
import {
  UnifiedNursingOrdersPanel,
  normalizeNursingOrdersToStructured,
} from './UnifiedNursingOrdersPanel.tsx';
import {
  UnifiedSolutionsPanel,
  formatSolutionsSummaryString,
  normalizeSolutionsFromPatient,
} from './UnifiedSolutionsPanel.tsx';
import { SettingsTabKey } from './GlobalSettingsModal.tsx';

interface PatientDetailModalProps {
  patient: Patient;
  profile?: ResidentProfile;
  isOpen: boolean;
  onClose: () => void;
  onUpdatePatient: (updatedPatient: Patient) => void;
  onOpenNoteGenerator: () => void;
  onEditPatient?: (patient: Patient) => void;
  onOpenDirectLabStudy?: (patient: Patient) => void;
  onOpenTagSelector?: (patient: Patient) => void;
  onOpenSettings?: (tab?: SettingsTabKey) => void;
  patientNotes: ClinicalNoteRecord[];
}

export const PatientDetailModal: React.FC<PatientDetailModalProps> = ({
  patient,
  profile,
  isOpen,
  onClose,
  onUpdatePatient,
  onOpenNoteGenerator,
  onEditPatient,
  onOpenDirectLabStudy,
  onOpenTagSelector,
  onOpenSettings,
  patientNotes,
}) => {
  if (!isOpen) return null;

  const medicationRoutesList =
    profile?.medicationRoutesCatalog && profile.medicationRoutesCatalog.length > 0
      ? profile.medicationRoutesCatalog
      : DEFAULT_MEDICATION_ROUTES;

  const dietQuickPresets =
    profile?.dietPresets && profile.dietPresets.length > 0
      ? profile.dietPresets
      : DEFAULT_DIET_PRESETS;

  const nursingRepo =
    profile?.nursingRepository && profile.nursingRepository.length > 0
      ? profile.nursingRepository
      : defaultNursingRepository;

  const [activeTab, setActiveTab] = useState<'labs' | 'studies' | 'meds' | 'pendings' | 'notes'>('labs');
  const stayDays = calculateHospitalStayDays(patient.admissionDate);

  // Lab comparative filter mode (Requested: Inicial + Último, Inicial + Últimos 3, Inicial + Últimos 4, Últimos 3, Últimos 4, Selección de Fechas)
  const [labFilterMode, setLabFilterMode] = useState<LabFilterMode>('initial-last3');
  const [customSelectedLabIds, setCustomSelectedLabIds] = useState<string[]>([]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // New Lab Form State
  const [showAddLab, setShowAddLab] = useState(false);
  const [labDate, setLabDate] = useState(new Date().toISOString().split('T')[0]);
  const [labTime, setLabTime] = useState(
    new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  );
  const [hb, setHb] = useState('');
  const [leucos, setLeucos] = useState('');
  const [plaquetas, setPlaquetas] = useState('');
  const [glucosa, setGlucosa] = useState('');
  const [creatinina, setCreatinina] = useState('');
  const [urea, setUrea] = useState('');
  const [bun, setBun] = useState('');
  const [na, setNa] = useState('');
  const [k, setK] = useState('');
  const [cl, setCl] = useState('');
  const [lactato, setLactato] = useState('');
  const [otherNotes, setOtherNotes] = useState('');

  // Medication Filter & New Medication Form State
  const [medCategoryFilter, setMedCategoryFilter] = useState<'all' | 'antibiotic' | 'limited'>('all');
  const [showAddMed, setShowAddMed] = useState(false);
  const [medName, setMedName] = useState('');
  const [medDose, setMedDose] = useState('');
  const [medRoute, setMedRoute] = useState('IV');
  const [medFrequency, setMedFrequency] = useState('cada 8 hrs');
  const [medCourseType, setMedCourseType] = useState<'antibiotic' | 'limited' | 'continuous'>('antibiotic');
  const [medStartDate, setMedStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [medPlannedDays, setMedPlannedDays] = useState('7');
  const [medIndication, setMedIndication] = useState('');

  // New Pending Form State
  const [showAddPending, setShowAddPending] = useState(false);
  const [pendingPreset, setPendingPreset] = useState<'lab' | 'imaging' | 'consult' | 'discharge' | 'custom'>('lab');
  const [pendingText, setPendingText] = useState('');
  const [pendingCategory, setPendingCategory] = useState<ClinicalPending['category']>('Laboratorio');
  const [pendingUrgencyColor, setPendingUrgencyColor] = useState<PendingUrgencyColor>('red');

  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);

  // Handle Add Lab (also auto-advances any 'register_census' lab pending!)
  const handleAddLab = (e: React.FormEvent) => {
    e.preventDefault();
    const newRecord: LabRecord = {
      id: `lab-${Date.now()}`,
      date: labDate,
      time: labTime,
      hb: hb ? parseFloat(hb) : undefined,
      leucos: leucos ? parseFloat(leucos) : undefined,
      plaquetas: plaquetas ? parseFloat(plaquetas) : undefined,
      glucosa: glucosa ? parseFloat(glucosa) : undefined,
      creatinina: creatinina ? parseFloat(creatinina) : undefined,
      urea: urea ? parseFloat(urea) : undefined,
      bun: bun ? parseFloat(bun) : undefined,
      na: na ? parseFloat(na) : undefined,
      k: k ? parseFloat(k) : undefined,
      cl: cl ? parseFloat(cl) : undefined,
      lactato: lactato ? parseFloat(lactato) : undefined,
      otherNotes: otherNotes.trim() || undefined,
      isNew: true,
    };

    const updatedLabs = [newRecord, ...patient.labs];
    const updatedPendings = patient.pendings.map((pen) =>
      !pen.completed && pen.workflowStage === 'register_census' && pen.category === 'Laboratorio'
        ? { ...pen, completed: true, workflowStage: 'done' as const }
        : pen
    );

    onUpdatePatient({
      ...patient,
      labs: updatedLabs,
      pendings: updatedPendings,
      lastUpdated: new Date().toISOString(),
    });

    setHb('');
    setLeucos('');
    setPlaquetas('');
    setGlucosa('');
    setCreatinina('');
    setUrea('');
    setBun('');
    setNa('');
    setK('');
    setCl('');
    setLactato('');
    setOtherNotes('');
    setShowAddLab(false);
  };

  // New Diagnostic Study Form State
  const [showAddStudy, setShowAddStudy] = useState(false);
  const [studyCat, setStudyCat] = useState<DiagnosticStudy['category']>('TAC');
  const [studyTitle, setStudyTitle] = useState('');
  const [studySummary, setStudySummary] = useState('');
  const [studyDate, setStudyDate] = useState(new Date().toISOString().split('T')[0]);
  const [studyTime] = useState(
    new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  );

  const handleAddStudy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studyTitle.trim() || !studySummary.trim()) return;

    const newStudy: DiagnosticStudy = {
      id: `study-${Date.now()}`,
      category: studyCat,
      title: studyTitle.trim(),
      summary: studySummary.trim(),
      date: studyDate,
      time: studyTime,
      isNew: true,
    };

    const currentStudies = patient.studies || [];
    const updatedPendings = patient.pendings.map((pen) =>
      !pen.completed &&
      pen.workflowStage === 'register_census' &&
      (pen.category === 'Imagen/Gabinete' || pen.category === 'Interconsulta')
        ? { ...pen, completed: true, workflowStage: 'done' as const }
        : pen
    );

    onUpdatePatient({
      ...patient,
      studies: [newStudy, ...currentStudies],
      pendings: updatedPendings,
      lastUpdated: new Date().toISOString(),
    });

    setStudyTitle('');
    setStudySummary('');
    setShowAddStudy(false);
  };

  // Handle Add Medication
  const handleAddMedication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!medName.trim()) return;

    const isAb = medCourseType === 'antibiotic';
    const isLim = medCourseType === 'limited';
    const hasDayCount = isAb || isLim;

    const newMed: MedicationItem = {
      id: `med-${Date.now()}`,
      name: medName.trim(),
      dose: medDose.trim(),
      route: medRoute,
      frequency: medFrequency,
      isAntibiotic: isAb,
      isLimitedCourse: isLim,
      startDate: medStartDate,
      plannedDays: hasDayCount && medPlannedDays ? parseInt(medPlannedDays, 10) : undefined,
      indication: medIndication.trim() || undefined,
      active: true,
    };

    onUpdatePatient({
      ...patient,
      medications: [...patient.medications, newMed],
      lastUpdated: new Date().toISOString(),
    });

    setMedName('');
    setMedDose('');
    setMedIndication('');
    setShowAddMed(false);
  };

  // Switch medication category inline (Antibiótico vs Tiempo Limitado vs Continuo)
  const handleSetMedicationCourseType = (
    medId: string,
    targetType: 'antibiotic' | 'limited' | 'continuous'
  ) => {
    const updated = patient.medications.map((m) => {
      if (m.id !== medId) return m;
      if (targetType === 'antibiotic') {
        return {
          ...m,
          isAntibiotic: true,
          isLimitedCourse: false,
          plannedDays: m.plannedDays || 7,
        };
      }
      if (targetType === 'limited') {
        return {
          ...m,
          isAntibiotic: false,
          isLimitedCourse: true,
          plannedDays: m.plannedDays || 5,
        };
      }
      return {
        ...m,
        isAntibiotic: false,
        isLimitedCourse: false,
        plannedDays: undefined,
      };
    });
    onUpdatePatient({
      ...patient,
      medications: updated,
      lastUpdated: new Date().toISOString(),
    });
  };

  // Handle Add Pending with 4-color traffic light & chained workflow
  const handleAddPending = (e: React.FormEvent) => {
    e.preventDefault();

    let finalCategory = pendingCategory;
    let finalText = pendingText.trim();
    let isDischarge = false;
    let finalColor = pendingUrgencyColor;

    if (pendingPreset === 'lab') {
      finalCategory = 'Laboratorio';
      const detail = finalText || 'BH, QS, ES3';
      finalText = detail.toUpperCase().startsWith('TOMA DE LABORATORIOS')
        ? detail
        : `TOMA DE LABORATORIOS: ${detail}`;
    } else if (pendingPreset === 'imaging') {
      finalCategory = 'Imagen/Gabinete';
      const detail = finalText || 'Estudio de imagen';
      finalText = detail.toUpperCase().startsWith('SOLICITAR')
        ? detail
        : `SOLICITAR IMAGEN: ${detail}`;
    } else if (pendingPreset === 'consult') {
      finalCategory = 'Interconsulta';
      const detail = finalText || 'Valoración por servicio';
      finalText = detail.toUpperCase().startsWith('SOLICITAR')
        ? detail
        : `SOLICITAR INTERCONSULTA: ${detail}`;
    } else if (pendingPreset === 'discharge') {
      finalCategory = 'Alta Hospitalaria';
      isDischarge = true;
      finalColor = 'red';
      const detail = finalText || 'Preparar nota de alta, receta y egreso hospitalario';
      finalText = detail.toUpperCase().startsWith('ALTA')
        ? detail
        : `ALTA REQUERIDA: ${detail}`;
    } else if (!finalText) {
      return;
    }

    const priorityMap: Record<PendingUrgencyColor, ClinicalPending['priority']> = {
      red: 'Alta',
      yellow: 'Media',
      green: 'Baja',
      blue: 'Baja',
    };

    const tempPending: ClinicalPending = {
      id: `pen-${Date.now()}`,
      text: finalText,
      category: finalCategory,
      priority: priorityMap[finalColor],
      urgencyColor: finalColor,
      completed: false,
      createdAt: new Date().toISOString().split('T')[0],
      customDetails: pendingText.trim() || undefined,
      isDischargePending: isDischarge,
    };

    if (isChainedClinicalPending(tempPending)) {
      tempPending.workflowStage = 'take';
    }

    onUpdatePatient({
      ...patient,
      pendings: [tempPending, ...patient.pendings],
      lastUpdated: new Date().toISOString(),
    });

    setPendingText('');
    setShowAddPending(false);
  };

  const handleTogglePending = (pendingId: string) => {
    const updated = patient.pendings.map((p) =>
      p.id === pendingId ? advancePendingWorkflow(p).updatedPending : p
    );
    onUpdatePatient({
      ...patient,
      pendings: updated,
      lastUpdated: new Date().toISOString(),
    });
  };

  const handleDeleteMedication = (medId: string) => {
    onUpdatePatient({
      ...patient,
      medications: patient.medications.filter((m) => m.id !== medId),
      lastUpdated: new Date().toISOString(),
    });
  };

  const handleCopyNote = async (note: ClinicalNoteRecord) => {
    await navigator.clipboard.writeText(note.content);
    setCopiedNoteId(note.id);
    setTimeout(() => setCopiedNoteId(null), 2500);
  };

  // Filtered and chronologically ordered labs: OLDEST ON LEFT -> NEWEST ON RIGHT
  const comparativeLabs = filterAndSortLabsOldestToNewest(
    patient.labs,
    labFilterMode,
    customSelectedLabIds
  );

  // Helper to render trend cell with arrow, color, and exact numeric delta between newest and previous lab
  const renderNumericTrendCell = (
    paramKey: 'leucos' | 'hb' | 'plaquetas' | 'creatinina' | 'glucosa' | 'na' | 'k'
  ) => {
    const validVals = comparativeLabs
      .map((l) => l[paramKey])
      .filter((v): v is number => v !== undefined && v !== null && !Number.isNaN(v));
    if (validVals.length < 2) return <span className="text-slate-400">-</span>;

    const olderVal = validVals[validVals.length - 2];
    const newerVal = validVals[validVals.length - 1];
    const trend = calculateLabNumericTrend(paramKey, olderVal, newerVal);
    if (!trend.hasTrend) return <span className="text-slate-400">-</span>;

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-mono font-bold text-[11px] ${trend.colorClass}`}
        title={`Cambio numérico entre penúltimo (${olderVal}) y último estudio (${newerVal}): ${trend.formattedDiff}`}
      >
        {trend.direction === 'up' && <TrendingUp className="w-3.5 h-3.5 shrink-0" />}
        {trend.direction === 'down' && <TrendingDown className="w-3.5 h-3.5 shrink-0" />}
        {trend.direction === 'equal' && <Minus className="w-3 h-3 shrink-0" />}
        <span>{trend.formattedDiff}</span>
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center pt-14 px-3 pb-3 sm:px-6 sm:pb-6 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="px-3.5 sm:px-6 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800 shrink-0">
          <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
            <span className="px-2.5 py-1 bg-teal-500/20 text-teal-300 border border-teal-500/40 rounded-xl font-mono font-bold text-xs sm:text-sm shrink-0">
              {patient.bed}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <h2 className="text-sm sm:text-base font-bold text-white leading-tight break-words">
                  {patient.name}
                </h2>
                <span className="text-[11px] sm:text-xs text-slate-400">
                  ({patient.age}a • {patient.gender} • Exp: {patient.recordNumber})
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] sm:text-xs text-slate-400">
                <span>{patient.service}</span>
                <span>•</span>
                <strong className="text-teal-400">Día {stayDays} de estancia</strong>
                <span>•</span>
                <span className={`px-2 py-0.5 rounded text-[10px] ${getCodeStatusInfo(patient.codeStatus).badgeClass}`}>
                  {getCodeStatusInfo(patient.codeStatus).codeLabel}
                </span>
                {getRespiratorySupportFlags(patient).isIntubated && (
                  <span className="px-2 py-0.5 rounded bg-rose-700 text-white border border-rose-800 text-[10px] font-extrabold uppercase">
                    INTUBADO
                  </span>
                )}
                {getRespiratorySupportFlags(patient).isCpap && (
                  <span className="px-2 py-0.5 rounded bg-sky-600 text-white border border-sky-700 text-[10px] font-extrabold uppercase">
                    CPAP
                  </span>
                )}
                <div className="flex flex-wrap items-center gap-1">
                  {getNonRedundantClinicalTags(patient.clinicalTags).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => onOpenTagSelector && onOpenTagSelector(patient)}
                      className="bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 text-[10px] px-2 py-0.5 rounded font-semibold cursor-pointer transition-colors"
                      title="Clic para gestionar etiquetas del paciente"
                    >
                      {t}
                    </button>
                  ))}
                  {onOpenTagSelector && (
                    <button
                      type="button"
                      onClick={() => onOpenTagSelector(patient)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-600/20 hover:bg-teal-600/40 text-teal-300 border border-teal-500/40 text-[10px] font-bold cursor-pointer transition-colors"
                      title="Agregar o quitar etiquetas clínicas sincronizadas"
                    >
                      <Tag className="w-3 h-3" />
                      <span>+ Etiquetas</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {onEditPatient && (
              <button
                onClick={() => {
                  onClose();
                  onEditPatient(patient);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                title="Editar datos o registrar Historia Clínica Completa NOM-004"
              >
                <BookOpen className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span className="hidden sm:inline">H. Clínica / Editar</span>
                <span className="sm:hidden">H.C.</span>
              </button>
            )}
            <button
              onClick={onOpenNoteGenerator}
              className="bg-teal-600 hover:bg-teal-700 text-white px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>Nota de Evolución</span>
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
              title="Cerrar expediente (Esc)"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Cerrar</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-950/60 px-3 sm:px-6 pt-2 text-xs font-semibold gap-1.5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('labs')}
            className={`py-2 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'labs'
                ? 'border-teal-500 text-teal-600 dark:text-teal-400 bg-white dark:bg-slate-900 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Activity className="w-3.5 h-3.5 shrink-0" />
            <span>Laboratorios ({patient.labs.length})</span>
            {patient.labs.some((l) => l.isNew) && (
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('studies')}
            className={`py-2 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'studies'
                ? 'border-teal-500 text-teal-600 dark:text-teal-400 bg-white dark:bg-slate-900 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <FileImage className="w-3.5 h-3.5 shrink-0" />
            <span>Gabinete e Imagen ({patient.studies?.length || 0})</span>
            {patient.studies?.some((s) => s.isNew) && (
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('meds')}
            className={`py-2 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'meds'
                ? 'border-teal-500 text-teal-600 dark:text-teal-400 bg-white dark:bg-slate-900 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Pill className="w-3.5 h-3.5 shrink-0" />
            <span>Antibióticos e Indicaciones ({patient.medications.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('pendings')}
            className={`py-2 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'pendings'
                ? 'border-teal-500 text-teal-600 dark:text-teal-400 bg-white dark:bg-slate-900 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5 shrink-0" />
            <span>Pendientes ({patient.pendings.filter((p) => !p.completed).length})</span>
          </button>

          <button
            onClick={() => setActiveTab('notes')}
            className={`py-2 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'notes'
                ? 'border-teal-500 text-teal-600 dark:text-teal-400 bg-white dark:bg-slate-900 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Notas Previas ({patientNotes.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-5 bg-slate-50/50 dark:bg-slate-900">
          {/* TAB 1: LABORATORIOS & TENDENCIAS */}
          {activeTab === 'labs' && (
            <div className="space-y-6">
              {/* Comparative Lab Matrix Card (Target of Focus Mode selector) */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-teal-500" />
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Comparativa de Laboratorios y Diferencia Numérica ({comparativeLabs.length} Estudios)
                    </h3>
                    <InfoPopover
                      title="Comparativa Cronológica (Antiguo → Nuevo)"
                      content="Los estudios se muestran de izquierda (más antiguos / ingreso) a derecha (más recientes). La columna Tendencia calcula el diferencial numérico exacto (Δ) entre los últimos dos valores con flecha y semáforo clínico."
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    {onOpenDirectLabStudy && (
                      <button
                        type="button"
                        onClick={() => onOpenDirectLabStudy(patient)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                      >
                        <FlaskConical className="w-3.5 h-3.5" />
                        <span>Capturar por Paneles (14 Grupos)</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowAddLab(!showAddLab)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Rápido</span>
                    </button>
                  </div>
                </div>

                {/* Preset Filter Bar: Inicial + Último, Inicial + Últimos 3, Inicial + Últimos 4, Últimos 3, Últimos 4, Por Fechas */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 pb-2 border-b border-slate-100 dark:border-slate-700/70">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                      Filtro:
                    </span>
                    {(
                      [
                        { id: 'initial-latest', label: 'Inicial + Último' },
                        { id: 'initial-last2', label: 'Inicial + Últimos 2' },
                        { id: 'initial-last3', label: 'Inicial + Últimos 3' },
                        { id: 'initial-last4', label: 'Inicial + Últimos 4' },
                        { id: 'last3', label: 'Últimos 3' },
                        { id: 'last4', label: 'Últimos 4' },
                        { id: 'custom', label: 'Elegir Fechas' },
                        { id: 'all', label: 'Todos' },
                      ] as { id: LabFilterMode; label: string }[]
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setLabFilterMode(f.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          labFilterMode === f.id
                            ? 'bg-teal-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {labFilterMode === 'custom' && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <Calendar className="w-3.5 h-3.5 text-teal-500" />
                      {patient.labs.map((l) => {
                        const checked = customSelectedLabIds.includes(l.id);
                        return (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() =>
                              setCustomSelectedLabIds((prev) =>
                                prev.includes(l.id) ? prev.filter((id) => id !== l.id) : [...prev, l.id]
                              )
                            }
                            className={`px-2 py-0.5 rounded font-mono text-[10px] border cursor-pointer ${
                              checked
                                ? 'bg-teal-600 text-white border-teal-700 font-bold'
                                : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            {l.date}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Comparative Matrix Table: Oldest on Left -> Newest on Right */}
                {comparativeLabs.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-center text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-900 text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                          <th className="py-2 px-3 text-left">Parámetro</th>
                          {comparativeLabs.map((l, idx) => {
                            const isOldest = idx === 0 && comparativeLabs.length > 1;
                            const isNewest = idx === comparativeLabs.length - 1;
                            return (
                              <th
                                key={l.id}
                                className={`py-2 px-3 ${
                                  isNewest ? 'bg-teal-50/70 dark:bg-teal-950/30 text-teal-800 dark:text-teal-300' : ''
                                }`}
                              >
                                <div className="font-mono font-bold">{l.date}</div>
                                <div className="text-[9.5px] text-slate-400 font-normal">
                                  {l.time} hrs{' '}
                                  {isOldest && <span className="text-slate-500 font-bold">[INICIAL]</span>}
                                  {isNewest && <span className="text-teal-600 dark:text-teal-400 font-bold">[RECIENTE]</span>}
                                </div>
                              </th>
                            );
                          })}
                          <th className="py-2 px-3 text-right">Tendencia (Δ)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-mono">
                        {/* Leucocitos */}
                        <tr>
                          <td className="py-2 px-3 text-left font-sans font-bold text-slate-700 dark:text-slate-300">
                            Leucocitos (/uL)
                          </td>
                          {comparativeLabs.map((l, idx) => (
                            <td
                              key={l.id}
                              className={`py-2 px-3 font-semibold ${
                                idx === comparativeLabs.length - 1 ? 'bg-teal-50/30 dark:bg-teal-950/15 font-bold' : ''
                              }`}
                            >
                              {l.leucos !== undefined ? l.leucos.toLocaleString() : '-'}
                            </td>
                          ))}
                          <td className="py-2 px-3 text-right">{renderNumericTrendCell('leucos')}</td>
                        </tr>

                        {/* Hemoglobina */}
                        <tr>
                          <td className="py-2 px-3 text-left font-sans font-bold text-slate-700 dark:text-slate-300">
                            Hemoglobina (g/dL)
                          </td>
                          {comparativeLabs.map((l, idx) => (
                            <td
                              key={l.id}
                              className={`py-2 px-3 font-semibold ${
                                idx === comparativeLabs.length - 1 ? 'bg-teal-50/30 dark:bg-teal-950/15 font-bold' : ''
                              }`}
                            >
                              {l.hb ?? '-'}
                            </td>
                          ))}
                          <td className="py-2 px-3 text-right">{renderNumericTrendCell('hb')}</td>
                        </tr>

                        {/* Plaquetas */}
                        <tr>
                          <td className="py-2 px-3 text-left font-sans font-bold text-slate-700 dark:text-slate-300">
                            Plaquetas (/uL)
                          </td>
                          {comparativeLabs.map((l, idx) => (
                            <td
                              key={l.id}
                              className={`py-2 px-3 font-semibold ${
                                idx === comparativeLabs.length - 1 ? 'bg-teal-50/30 dark:bg-teal-950/15 font-bold' : ''
                              }`}
                            >
                              {l.plaquetas !== undefined ? l.plaquetas.toLocaleString() : '-'}
                            </td>
                          ))}
                          <td className="py-2 px-3 text-right">{renderNumericTrendCell('plaquetas')}</td>
                        </tr>

                        {/* Creatinina */}
                        <tr>
                          <td className="py-2 px-3 text-left font-sans font-bold text-slate-700 dark:text-slate-300">
                            Creatinina (mg/dL)
                          </td>
                          {comparativeLabs.map((l, idx) => (
                            <td
                              key={l.id}
                              className={`py-2 px-3 font-semibold ${
                                idx === comparativeLabs.length - 1 ? 'bg-teal-50/30 dark:bg-teal-950/15 font-bold' : ''
                              }`}
                            >
                              {l.creatinina ?? '-'}
                            </td>
                          ))}
                          <td className="py-2 px-3 text-right">{renderNumericTrendCell('creatinina')}</td>
                        </tr>

                        {/* Glucosa */}
                        <tr>
                          <td className="py-2 px-3 text-left font-sans font-bold text-slate-700 dark:text-slate-300">
                            Glucosa (mg/dL)
                          </td>
                          {comparativeLabs.map((l, idx) => (
                            <td
                              key={l.id}
                              className={`py-2 px-3 ${
                                idx === comparativeLabs.length - 1 ? 'bg-teal-50/30 dark:bg-teal-950/15 font-bold' : ''
                              }`}
                            >
                              {l.glucosa ?? '-'}
                            </td>
                          ))}
                          <td className="py-2 px-3 text-right">{renderNumericTrendCell('glucosa')}</td>
                        </tr>

                        {/* Sodio */}
                        <tr>
                          <td className="py-2 px-3 text-left font-sans font-bold text-slate-700 dark:text-slate-300">
                            Sodio (mEq/L)
                          </td>
                          {comparativeLabs.map((l, idx) => (
                            <td
                              key={l.id}
                              className={`py-2 px-3 ${
                                idx === comparativeLabs.length - 1 ? 'bg-teal-50/30 dark:bg-teal-950/15 font-bold' : ''
                              }`}
                            >
                              {l.na ?? '-'}
                            </td>
                          ))}
                          <td className="py-2 px-3 text-right">{renderNumericTrendCell('na')}</td>
                        </tr>

                        {/* Potasio */}
                        <tr>
                          <td className="py-2 px-3 text-left font-sans font-bold text-slate-700 dark:text-slate-300">
                            Potasio (mEq/L)
                          </td>
                          {comparativeLabs.map((l, idx) => (
                            <td
                              key={l.id}
                              className={`py-2 px-3 ${
                                idx === comparativeLabs.length - 1 ? 'bg-teal-50/30 dark:bg-teal-950/15 font-bold' : ''
                              }`}
                            >
                              {l.k ?? '-'}
                            </td>
                          ))}
                          <td className="py-2 px-3 text-right">{renderNumericTrendCell('k')}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    No hay laboratorios registrados todavía.
                  </div>
                )}
              </div>

              {/* Add Lab Form (Collapsible) */}
              {showAddLab && (
                <form
                  onSubmit={handleAddLab}
                  className="bg-teal-50/50 dark:bg-slate-800/80 p-5 rounded-xl border border-teal-200 dark:border-teal-800/80 shadow-xs space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-teal-900 dark:text-teal-200 uppercase tracking-wider">
                      Captura Rápida de Laboratorios del Día
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAddLab(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Fecha</label>
                      <input
                        type="date"
                        value={labDate}
                        onChange={(e) => setLabDate(e.target.value)}
                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Hora</label>
                      <input
                        type="text"
                        value={labTime}
                        onChange={(e) => setLabTime(e.target.value)}
                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Hb (g/dL)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={hb}
                        onChange={(e) => setHb(e.target.value)}
                        placeholder="ej. 11.5"
                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Leucos (/uL)</label>
                      <input
                        type="number"
                        value={leucos}
                        onChange={(e) => setLeucos(e.target.value)}
                        placeholder="ej. 9800"
                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Plaquetas</label>
                      <input
                        type="number"
                        value={plaquetas}
                        onChange={(e) => setPlaquetas(e.target.value)}
                        placeholder="ej. 210000"
                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Creatinina (mg/dL)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={creatinina}
                        onChange={(e) => setCreatinina(e.target.value)}
                        placeholder="ej. 1.1"
                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Glucosa (mg/dL)</label>
                      <input
                        type="number"
                        value={glucosa}
                        onChange={(e) => setGlucosa(e.target.value)}
                        placeholder="ej. 130"
                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Urea (mg/dL)</label>
                      <input
                        type="number"
                        value={urea}
                        onChange={(e) => setUrea(e.target.value)}
                        placeholder="ej. 34"
                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Sodio (mEq/L)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={na}
                        onChange={(e) => setNa(e.target.value)}
                        placeholder="ej. 138"
                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Potasio (mEq/L)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={k}
                        onChange={(e) => setK(e.target.value)}
                        placeholder="ej. 4.2"
                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Cloro (mEq/L)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={cl}
                        onChange={(e) => setCl(e.target.value)}
                        placeholder="ej. 102"
                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Lactato (mmol/L)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={lactato}
                        onChange={(e) => setLactato(e.target.value)}
                        placeholder="ej. 1.2"
                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                      Observaciones / Gasometría / Cultivos
                    </label>
                    <input
                      type="text"
                      value={otherNotes}
                      onChange={(e) => setOtherNotes(e.target.value)}
                      placeholder="ej. Gasometría: pH 7.38, pO2 75, pCO2 38, HCO3 22. Cultivo de esputo pendiente."
                      className="w-full px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddLab(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-xs"
                    >
                      Guardar y Actualizar Tendencia
                    </button>
                  </div>
                </form>
              )}

              {/* Full Chronological Labs List */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Historial Completo Cronológico ({patient.labs.length} estudios)
                </h4>
                <div className="space-y-2">
                  {patient.labs.map((l, idx) => (
                    <div
                      key={l.id}
                      className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-mono space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px] font-sans font-bold text-slate-800 dark:text-slate-200">
                        <span className="flex items-center gap-1.5">
                          <span>{l.date} — {l.time} hrs</span>
                          {idx === 0 && <span className="text-teal-600 text-[10px] font-mono">[MÁS RECIENTE]</span>}
                          {l.isNew && (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-200 px-1.5 py-0.2 rounded font-black text-[9px]">
                              ⚡ NUEVO (PENDIENTE DE NOTA)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700 dark:text-slate-300 text-[11px]">
                        {(l.hb !== undefined || l.wbc) && <div>Hb: <strong>{l.hb ?? '-'}</strong> g/dL</div>}
                        {(l.leucos !== undefined || l.wbc) && (
                          <div>Leucos: <strong>{l.leucos ? l.leucos.toLocaleString() : l.wbc || '-'}</strong></div>
                        )}
                        {(l.plaquetas !== undefined || l.platelets) && (
                          <div>Plaquetas: <strong>{l.plaquetas ? l.plaquetas.toLocaleString() : l.platelets || '-'}</strong></div>
                        )}
                        {(l.creatinina !== undefined || l.creatinine) && (
                          <div>Creatinina: <strong>{l.creatinina ?? l.creatinine ?? '-'}</strong> mg/dL</div>
                        )}
                        {(l.glucosa !== undefined || l.glucose) && (
                          <div>Glucosa: <strong>{l.glucosa ?? l.glucose ?? '-'}</strong> mg/dL</div>
                        )}
                        {(l.urea !== undefined || l.bun !== undefined) && (
                          <div>Urea/BUN: <strong>{l.urea ?? '-'}</strong> / <strong>{l.bun ?? '-'}</strong></div>
                        )}
                        {(l.na !== undefined || l.k !== undefined || l.cl !== undefined || l.sodium || l.potassium) && (
                          <div>
                            Na/K/Cl: <strong>{l.na ?? l.sodium ?? '-'}/{l.k ?? l.potassium ?? '-'}/{l.cl ?? l.chloride ?? '-'}</strong>
                          </div>
                        )}
                        {(l.lactato !== undefined || l.lactate) && (
                          <div>Lactato: <strong>{l.lactato ?? l.lactate}</strong> mmol/L</div>
                        )}
                        {l.ast && <div>AST: <strong>{l.ast}</strong> U/L</div>}
                        {l.alt && <div>ALT: <strong>{l.alt}</strong> U/L</div>}
                        {l.alp && <div>FA: <strong>{l.alp}</strong> U/L</div>}
                        {l.biliTotal && <div>BT/BD: <strong>{l.biliTotal}/{l.biliDirect || '-'}</strong> mg/dL</div>}
                        {l.albumin && <div>Albúmina: <strong>{l.albumin}</strong> g/dL</div>}
                        {l.tp && <div>TP/INR/TTPa: <strong>{l.tp}s / {l.inr || '-'} / {l.ttpa || '-'}s</strong></div>}
                        {l.pcr !== undefined && <div>PCR: <strong>{l.pcr}</strong> mg/L</div>}
                        {(l.procalcitonina !== undefined || l.pct) && (
                          <div>PCT: <strong>{l.procalcitonina ?? l.pct}</strong> ng/mL</div>
                        )}
                        {l.troponin && <div>Troponina: <strong>{l.troponin}</strong></div>}
                        {l.bnp && <div>BNP: <strong>{l.bnp}</strong> pg/mL</div>}
                        {l.dimerD && <div>Dímero D: <strong>{l.dimerD}</strong></div>}
                        {l.extraParams &&
                          Object.entries(l.extraParams).map(([k, ep]) => (
                            <div key={k} className="text-teal-800 dark:text-teal-300">
                              {ep.label}: <strong>{ep.value}</strong> {ep.unit || ''}
                            </div>
                          ))}
                      </div>
                      {(l.otherNotes || l.notes) && (
                        <div className="text-[10px] font-sans text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-800">
                          {l.otherNotes || l.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: ESTUDIOS DE GABINETE E IMAGEN */}
          {activeTab === 'studies' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <FileImage className="w-4 h-4 text-cyan-500" />
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Estudios de Imagen, Gabinete y Microbiología
                  </h3>
                  <InfoPopover
                    title="Imagen, Gabinete y Cultivos"
                    content="Registra tomografías, radiografías, ultrasonidos y reportes de cultivos. Se sincronizan automáticamente en el párrafo cronológico de la Nota de Evolución."
                  />
                </div>
                <button
                  onClick={() => setShowAddStudy(!showAddStudy)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Agregar Estudio Directo</span>
                </button>
              </div>

              {/* Form Add Study */}
              {showAddStudy && (
                <form
                  onSubmit={handleAddStudy}
                  className="bg-white dark:bg-slate-850 p-4 rounded-xl border border-cyan-300 dark:border-cyan-800 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Modalidad / Tipo</label>
                      <select
                        value={studyCat}
                        onChange={(e) => setStudyCat(e.target.value as DiagnosticStudy['category'])}
                        className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-xs font-semibold"
                      >
                        <option value="TAC">TAC</option>
                        <option value="Radiografía">Radiografía</option>
                        <option value="Ultrasonido">Ultrasonido</option>
                        <option value="Ecocardiograma">Ecocardiograma</option>
                        <option value="Cultivo / Microbiología">Cultivo / Microbiología</option>
                        <option value="Endoscopía">Endoscopía</option>
                        <option value="Resonancia Magnética">Resonancia Magnética</option>
                        <option value="Otro Estudio">Otro Estudio</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Título / Nombre del Estudio *</label>
                      <input
                        type="text"
                        required
                        placeholder="ej. TAC de tórax de alta resolución"
                        value={studyTitle}
                        onChange={(e) => setStudyTitle(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Fecha del Reporte</label>
                      <input
                        type="date"
                        value={studyDate}
                        onChange={(e) => setStudyDate(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Hallazgos Principales y Conclusión *</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="ej. Se aprecian infiltrados alveolares bibasales con broncograma aéreo compatibles con neumonía multilobar..."
                      value={studySummary}
                      onChange={(e) => setStudySummary(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddStudy(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold shadow-xs"
                    >
                      Guardar Estudio como NUEVO
                    </button>
                  </div>
                </form>
              )}

              {/* Studies List */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Estudios Registrados ({patient.studies?.length || 0})
                </h4>
                {patient.studies && patient.studies.length > 0 ? (
                  <div className="space-y-3">
                    {patient.studies.map((st) => (
                      <div
                        key={st.id}
                        className={`p-3 rounded-xl border text-xs space-y-1.5 transition-all ${
                          st.isNew
                            ? 'bg-cyan-50/70 border-cyan-300 dark:bg-cyan-950/40 dark:border-cyan-800'
                            : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-cyan-800 dark:text-cyan-300 uppercase text-[10.5px]">
                              [{st.category}] {st.title}
                            </span>
                            {st.isNew && (
                              <span className="bg-cyan-100 text-cyan-900 border border-cyan-400 dark:bg-cyan-900 dark:text-cyan-100 px-1.5 py-0.2 rounded font-black text-[9px]">
                                ⚡ NUEVO (PENDIENTE DE NOTA)
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {st.date} {st.time ? `(${st.time} hrs)` : ''}
                          </span>
                        </div>
                        <p className="text-slate-800 dark:text-slate-200 text-xs leading-relaxed">
                          {st.summary}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs italic">
                    Sin estudios de imagen o gabinete registrados para este paciente.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: MEDICAMENTOS & ANTIBIÓTICOS */}
          {activeTab === 'meds' && (
            <div className="space-y-6">
              {/* Unified Indications Summary: Diagnósticos Activos, Dieta, Soluciones & Enfermería */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                      Indicaciones Generales y Diagnósticos Sincronizados (Evolución Activa)
                    </span>
                    <InfoPopover
                      title="Sincronización Bidireccional y Base de Ingreso Protegida"
                      content="Cualquier cambio en Diagnósticos Activos, Dieta, Soluciones o Indicaciones de Enfermería se refleja inmediatamente en la Nota de Evolución y el Censo Activo. Los datos originales de la Nota de Ingreso se conservan intactos como referencia base y no se modifican en retroceso."
                    />
                  </div>
                  {onOpenSettings && (
                    <button
                      type="button"
                      onClick={() => onOpenSettings('templates')}
                      className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-50 flex items-center gap-1 cursor-pointer"
                      title="Personalizar plantillas de dieta y repertorio en Preferencias"
                    >
                      <Settings className="w-3 h-3" />
                      <span>Preferencias de Indicaciones</span>
                    </button>
                  )}
                </div>

                {/* 1. Dieta e Hidratación Enteral Actual */}
                <div className="bg-slate-50/70 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <label className="text-[11px] font-bold text-teal-800 dark:text-teal-300 uppercase">
                      1. Dieta e Hidratación Enteral Actual
                    </label>
                    <div className="flex flex-wrap items-center gap-1">
                      {dietQuickPresets.map((dPreset) => (
                        <button
                          key={dPreset}
                          type="button"
                          onClick={() =>
                            onUpdatePatient({
                              ...patient,
                              initialDiet: patient.initialDiet ?? patient.diet,
                              diet: dPreset,
                              lastUpdated: new Date().toISOString(),
                            })
                          }
                          className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                            patient.diet === dPreset
                              ? 'bg-teal-600 text-white border-teal-700 font-bold'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-teal-400'
                          }`}
                        >
                          +{dPreset}
                        </button>
                      ))}
                      {onOpenSettings && (
                        <button
                          type="button"
                          onClick={() => onOpenSettings('templates')}
                          className="text-[10px] px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 font-bold flex items-center gap-1 cursor-pointer"
                          title="Personalizar opciones rápidas de dieta en Preferencias"
                        >
                          <Settings className="w-2.5 h-2.5" />
                          <span>Editar dietas</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold block mb-0.5">
                        Tipo de Dieta / Vía Enteral
                      </span>
                      <input
                        type="text"
                        value={patient.diet || ''}
                        onChange={(e) =>
                          onUpdatePatient({
                            ...patient,
                            initialDiet: patient.initialDiet ?? patient.diet,
                            diet: e.target.value,
                            lastUpdated: new Date().toISOString(),
                          })
                        }
                        placeholder="Ej. Dieta normosódica para diabético 1800 kcal..."
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-medium text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold block mb-0.5">
                        Indicaciones Especiales (Restricción hídrica, SNG, gastrostomía, colaciones)
                      </span>
                      <input
                        type="text"
                        value={patient.dietSpecialNotes || ''}
                        onChange={(e) =>
                          onUpdatePatient({
                            ...patient,
                            initialDietSpecialNotes:
                              patient.initialDietSpecialNotes ?? patient.dietSpecialNotes,
                            dietSpecialNotes: e.target.value,
                            lastUpdated: new Date().toISOString(),
                          })
                        }
                        placeholder="Ej. Restricción hídrica a 1000 ml/24h, agua libre por SNG..."
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Soluciones Parenterales Actuales (Compact Unified System) */}
                <div className="bg-slate-50/70 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <UnifiedSolutionsPanel
                    solutions={normalizeSolutionsFromPatient(
                      patient.structuredSolutions,
                      patient.ivFluids
                    )}
                    onChange={(nextSolutions: ParenteralSolutionItem[]) => {
                      const summaryText = formatSolutionsSummaryString(nextSolutions);
                      onUpdatePatient({
                        ...patient,
                        initialIvFluids: patient.initialIvFluids ?? patient.ivFluids,
                        initialStructuredSolutions:
                          patient.initialStructuredSolutions ?? patient.structuredSolutions,
                        structuredSolutions: nextSolutions,
                        ivFluids: summaryText,
                        lastUpdated: new Date().toISOString(),
                      });
                    }}
                  />
                </div>

                {/* 3. Indicaciones de Enfermería y Medidas Generales (Compact Unified System) */}
                <div className="bg-slate-50/70 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <UnifiedNursingOrdersPanel
                    orders={normalizeNursingOrdersToStructured(
                      patient.structuredNursingOrders,
                      patient.nursingOrders
                    )}
                    onChange={(nextOrders: PatientNursingOrderItem[], plainLines: string[]) => {
                      onUpdatePatient({
                        ...patient,
                        initialNursingOrders:
                          patient.initialNursingOrders ??
                          (Array.isArray(patient.nursingOrders) ? patient.nursingOrders : undefined),
                        initialStructuredNursingOrders:
                          patient.initialStructuredNursingOrders ?? patient.structuredNursingOrders,
                        structuredNursingOrders: nextOrders,
                        nursingOrders: plainLines,
                        lastUpdated: new Date().toISOString(),
                      });
                    }}
                    nursingRepository={nursingRepo}
                    onOpenSettings={
                      onOpenSettings ? (tab) => onOpenSettings(tab as SettingsTabKey) : undefined
                    }
                    compact
                  />
                </div>

                {/* Diagnósticos Iniciales (Base Inmutable de Ingreso) vs Diagnósticos Actuales (Evolución Activa) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-1">
                  <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                          Diagnósticos Iniciales (Base de Ingreso — No se modifica en retroceso)
                        </label>
                        {onEditPatient && (
                          <button
                            type="button"
                            onClick={() => onEditPatient(patient)}
                            className="text-[10px] px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-teal-500 font-semibold cursor-pointer shrink-0"
                            title="Abrir sección de Ingreso si necesitas editar la base de ingreso explícitamente"
                          >
                            Ir a Ingreso
                          </button>
                        )}
                      </div>
                      <div className="p-2.5 bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] text-slate-600 dark:text-slate-400 font-mono space-y-1">
                        {(patient.initialDiagnoses && patient.initialDiagnoses.length > 0
                          ? patient.initialDiagnoses
                          : patient.diagnoses
                        ).map((d, i) => (
                          <div key={i}>{d}</div>
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 italic">
                      Esta base de ingreso permanece fija como referencia histórica aunque agregues o reordenes diagnósticos en la evolución.
                    </p>
                  </div>

                  <div className="lg:col-span-7 bg-teal-50/30 dark:bg-teal-950/20 p-3 rounded-xl border border-teal-200 dark:border-teal-800/60">
                    <DiagnosisListEditor
                      value={(patient.diagnoses || []).join('\n')}
                      onChange={(cleanArray) => {
                        const preservedInitial =
                          patient.initialDiagnoses && patient.initialDiagnoses.length > 0
                            ? patient.initialDiagnoses
                            : [...(patient.diagnoses || [])];
                        onUpdatePatient({
                          ...patient,
                          initialDiagnoses: preservedInitial,
                          diagnoses:
                            cleanArray.length > 0
                              ? cleanArray
                              : ['1. En protocolo de estudio'],
                          lastUpdated: new Date().toISOString(),
                        });
                      }}
                      label="Diagnósticos Actuales (Evolución Activa — CIE-10 y Reordenamiento)"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Pill className="w-4 h-4 text-purple-500" />
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Prescripciones, Antibióticos y Medicamentos por Tiempo Limitado
                  </h3>
                  <InfoPopover
                    title="Antibióticos vs Medicamentos por Tiempo Limitado (Cursos Cortos)"
                    content="1) Los Antibióticos son los más importantes de reportar en el pase de visita y aparecen primero en morado con su conteo [Día X/Y]. 2) Los Medicamentos por Tiempo Limitado (ej. esteroides como Dexametasona, Metilprednisolona o Prednisona en cursos cortos) aparecen en ámbar también con conteo [Día X/Y] para llevar el seguimiento de días sin confundirlos con antibióticos."
                  />
                </div>
                <button
                  onClick={() => setShowAddMed(!showAddMed)}
                  className="flex items-center gap-1 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Prescribir Medicamento</span>
                </button>
              </div>

              {/* Filter Buttons: Todos vs Solo Antibióticos vs Medicamentos por Tiempo Limitado */}
              {(() => {
                const countAntibiotics = patient.medications.filter((m) => m.isAntibiotic).length;
                const countLimited = patient.medications.filter(
                  (m) =>
                    !m.isAntibiotic &&
                    Boolean(m.isLimitedCourse || (m.plannedDays && m.plannedDays > 0))
                ).length;

                return (
                  <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 px-1">
                      Diferenciar:
                    </span>
                    <button
                      type="button"
                      onClick={() => setMedCategoryFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        medCategoryFilter === 'all'
                          ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                          : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Todos ({patient.medications.length})
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setMedCategoryFilter(
                          medCategoryFilter === 'antibiotic' ? 'all' : 'antibiotic'
                        )
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer ${
                        medCategoryFilter === 'antibiotic'
                          ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                          : 'bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-800 hover:bg-purple-100'
                      }`}
                      title="Mostrar únicamente antibióticos (prioritarios en el reporte)"
                    >
                      <Pill className="w-3.5 h-3.5 shrink-0" />
                      <span>Solo Antibióticos ({countAntibiotics})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setMedCategoryFilter(medCategoryFilter === 'limited' ? 'all' : 'limited')
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer ${
                        medCategoryFilter === 'limited'
                          ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                          : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800 hover:bg-amber-100'
                      }`}
                      title="Mostrar medicamentos por tiempo limitado / cursos cortos (ej. esteroides) con conteo de días"
                    >
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>Tiempo Limitado / Curso Corto ({countLimited})</span>
                    </button>
                  </div>
                );
              })()}

              {/* Add Medication Form */}
              {showAddMed && (
                <form
                  onSubmit={handleAddMedication}
                  className="bg-purple-50/50 dark:bg-slate-800/80 p-5 rounded-xl border border-purple-200 dark:border-purple-800/80 shadow-xs space-y-4 text-xs sm:text-sm"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-purple-900 dark:text-purple-200 uppercase tracking-wider text-xs">
                      Nueva Prescripción Farmacológica
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAddMed(false)}
                      className="text-slate-400 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Selector de Tipo de Medicamento: Antibiótico vs Tiempo Limitado (Esteroides/Curso Corto) vs Continuo */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Tipo de Prescripción y Seguimiento de Días:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setMedCourseType('antibiotic');
                          if (!medPlannedDays) setMedPlannedDays('7');
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 ${
                          medCourseType === 'antibiotic'
                            ? 'bg-purple-600 text-white border-purple-700 shadow-xs font-bold'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        <Pill className="w-4 h-4 shrink-0" />
                        <div>
                          <div className="text-xs font-bold">1. Antibiótico (Prioritario)</div>
                          <div className="text-[11px] opacity-85">Reporta conteo Día X/Y (ATB)</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setMedCourseType('limited');
                          if (!medPlannedDays || medPlannedDays === '7') setMedPlannedDays('5');
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 ${
                          medCourseType === 'limited'
                            ? 'bg-amber-600 text-white border-amber-700 shadow-xs font-bold'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        <Clock className="w-4 h-4 shrink-0" />
                        <div>
                          <div className="text-xs font-bold">2. Tiempo Limitado / Curso Corto</div>
                          <div className="text-[11px] opacity-85">Ej. Esteroides (Conteo Día X/Y)</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMedCourseType('continuous')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 ${
                          medCourseType === 'continuous'
                            ? 'bg-teal-600 text-white border-teal-700 shadow-xs font-bold'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        <Activity className="w-4 h-4 shrink-0" />
                        <div>
                          <div className="text-xs font-bold">3. Medicamento Continuo</div>
                          <div className="text-[11px] opacity-85">De base / Sin límite de días</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-5">
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        Nombre del Fármaco
                      </label>
                      <input
                        type="text"
                        value={medName}
                        onChange={(e) => setMedName(e.target.value)}
                        placeholder={
                          medCourseType === 'antibiotic'
                            ? 'ej. Meropenem, Ceftriaxona, Vancomicina'
                            : medCourseType === 'limited'
                            ? 'ej. Dexametasona, Metilprednisolona, Prednisona'
                            : 'ej. Enoxaparina, Omeprazol, Insulina Glargina'
                        }
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                        required
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        Dosis
                      </label>
                      <input
                        type="text"
                        value={medDose}
                        onChange={(e) => setMedDose(e.target.value)}
                        placeholder="ej. 1 g, 40 mg"
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                        required
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          Vía
                        </label>
                        {onOpenSettings && (
                          <button
                            type="button"
                            onClick={() => onOpenSettings('templates')}
                            className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                            title="Personalizar catálogo de vías de administración"
                          >
                            <Settings className="w-2.5 h-2.5" />
                            <span>Vías</span>
                          </button>
                        )}
                      </div>
                      <select
                        value={medRoute}
                        onChange={(e) => setMedRoute(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-bold"
                      >
                        {medicationRoutesList.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        Frecuencia
                      </label>
                      <input
                        type="text"
                        value={medFrequency}
                        onChange={(e) => setMedFrequency(e.target.value)}
                        placeholder="cada 8 hrs, cada 12 hrs"
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                        required
                      />
                    </div>
                  </div>

                  {(medCourseType === 'antibiotic' || medCourseType === 'limited') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700">
                      <div>
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          Fecha de Inicio (Día 0 = primeras 24h)
                        </label>
                        <input
                          type="date"
                          value={medStartDate}
                          onChange={(e) => setMedStartDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          Días Programados Totales (Meta del esquema/curso)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={90}
                          value={medPlannedDays}
                          onChange={(e) => setMedPlannedDays(e.target.value)}
                          placeholder="ej. 5, 7, 10, 14"
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      Indicación Clínica / Motivo
                    </label>
                    <input
                      type="text"
                      value={medIndication}
                      onChange={(e) => setMedIndication(e.target.value)}
                      placeholder="ej. NAC grave, Curso corto de esteroide por EPOC exacerbado, Tromboprofilaxis"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddMed(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                    >
                      Guardar Prescripción
                    </button>
                  </div>
                </form>
              )}

              {/* Medication List */}
              <div className="space-y-3">
                {patient.medications
                  .filter((m) => {
                    const isLim =
                      !m.isAntibiotic &&
                      Boolean(m.isLimitedCourse || (m.plannedDays && m.plannedDays > 0));
                    if (medCategoryFilter === 'antibiotic') return m.isAntibiotic;
                    if (medCategoryFilter === 'limited') return isLim;
                    return true;
                  })
                  .map((m) => {
                    const isLim =
                      !m.isAntibiotic &&
                      Boolean(m.isLimitedCourse || (m.plannedDays && m.plannedDays > 0));
                    const hasCounter = m.isAntibiotic || isLim;
                    const status = hasCounter
                      ? calculateAntibioticDay(m.startDate, m.plannedDays)
                      : null;

                    return (
                      <div
                        key={m.id}
                        className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm ${
                          m.isAntibiotic
                            ? 'bg-purple-50/40 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/60'
                            : isLim
                            ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {m.isAntibiotic && (
                              <span className="px-2 py-0.5 rounded bg-purple-600 text-white font-extrabold text-[11px] uppercase">
                                💊 Antibiótico
                              </span>
                            )}
                            {isLim && (
                              <span className="px-2 py-0.5 rounded bg-amber-600 text-white font-extrabold text-[11px] uppercase">
                                ⏳ Tiempo Limitado
                              </span>
                            )}
                            <span className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                              {m.name}
                            </span>
                            <span className="text-slate-600 dark:text-slate-300 font-semibold">
                              {m.dose}
                            </span>
                            <span className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-xs font-mono">
                              {m.route} {m.frequency}
                            </span>
                          </div>
                          {m.indication && (
                            <p className="text-xs text-slate-600 dark:text-slate-300">
                              Indicación: <strong>{m.indication}</strong>
                            </p>
                          )}
                          {hasCounter && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                              Inicio: {m.startDate}
                              {m.plannedDays ? ` • Esquema programado: ${m.plannedDays} días` : ''}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* Botones rápidos para reclasificar entre Antibiótico, Tiempo Limitado o Continuo */}
                          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-900 text-[11px]">
                            <button
                              type="button"
                              onClick={() => handleSetMedicationCourseType(m.id, 'antibiotic')}
                              className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                                m.isAntibiotic
                                  ? 'bg-purple-600 text-white'
                                  : 'text-slate-500 hover:text-purple-600'
                              }`}
                              title="Marcar como Antibiótico"
                            >
                              ATB
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetMedicationCourseType(m.id, 'limited')}
                              className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                                isLim
                                  ? 'bg-amber-600 text-white'
                                  : 'text-slate-500 hover:text-amber-600'
                              }`}
                              title="Marcar como Medicamento por Tiempo Limitado (ej. Esteroide)"
                            >
                              Tiempo Limitado
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetMedicationCourseType(m.id, 'continuous')}
                              className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                                !m.isAntibiotic && !isLim
                                  ? 'bg-slate-800 text-white dark:bg-slate-700'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                              title="Marcar como Medicamento Continuo sin conteo de días"
                            >
                              Continuo
                            </button>
                          </div>

                          {status && (
                            <div className="text-right">
                              <span
                                className={`inline-block px-3 py-1 rounded-lg font-mono font-bold text-xs ${
                                  status.isCompleted
                                    ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200'
                                    : m.isAntibiotic
                                    ? 'bg-purple-600 text-white shadow-xs'
                                    : 'bg-amber-600 text-white shadow-xs'
                                }`}
                              >
                                {status.displayString}
                              </span>
                            </div>
                          )}
                          <button
                            onClick={() => handleDeleteMedication(m.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer"
                            title="Eliminar medicamento"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* TAB 3: PENDIENTES DEL TURNO (4-COLOR SEMAPHORE & CHAINED WORKFLOW) */}
          {activeTab === 'pendings' && (
            <div className="space-y-4">
              {/* Evolución y Análisis Clínico (Sincronizado con Nota de Evolución, Censo Activo e Imprimible) */}
              <div className="bg-teal-50/70 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800/60 rounded-xl p-3 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <label className="text-[11px] font-extrabold text-teal-900 dark:text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Evolución y Análisis Clínico (De la Nota de Evolución • Pase de Visita)</span>
                  </label>
                  <span className="text-[10px] text-teal-700 dark:text-teal-400 font-medium">
                    Sincronizado con Censo y Hoja Imprimible
                  </span>
                </div>
                <input
                  type="text"
                  value={patient.evolutionSummary || ''}
                  onChange={(e) => {
                    onUpdatePatient({
                      ...patient,
                      evolutionSummary: e.target.value,
                      lastUpdated: new Date().toISOString(),
                    });
                  }}
                  placeholder="Resumen del análisis y evolución clínica de la Nota de Evolución..."
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-teal-300 dark:border-teal-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Pendientes Clínicos y Cadena de Seguimiento
                  </h3>
                  <InfoPopover
                    title="Semáforo de 4 Colores y Flujo Encadenado"
                    content="Al marcar como hecho un pendiente de Laboratorio, Imagen o Interconsulta, avanza automáticamente: 1) Tomar/Solicitar → 2) Recabar → 3) Registrar en Censo → 4) Integrar en Nota. También puedes marcar ALTA REQUERIDA."
                  />
                </div>
                <button
                  onClick={() => setShowAddPending(!showAddPending)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nuevo Pendiente</span>
                </button>
              </div>

              {/* Add Pending Form with Presets & 4-Color Traffic Light */}
              {showAddPending && (
                <form
                  onSubmit={handleAddPending}
                  className="bg-emerald-50/50 dark:bg-slate-800/80 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/80 shadow-xs space-y-3 text-xs"
                >
                  {/* Preset selector */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        { id: 'lab', label: '🧪 TOMA DE LABORATORIOS' },
                        { id: 'imaging', label: '🩻 SOLICITAR IMAGEN' },
                        { id: 'consult', label: '🩺 INTERCONSULTA' },
                        { id: 'discharge', label: '🚪 ALTA REQUERIDA' },
                        { id: 'custom', label: '✏️ Otro / Libre' },
                      ] as const
                    ).map((pr) => (
                      <button
                        key={pr.id}
                        type="button"
                        onClick={() => {
                          setPendingPreset(pr.id);
                          if (pr.id === 'discharge') setPendingUrgencyColor('red');
                        }}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border transition-all cursor-pointer ${
                          pendingPreset === pr.id
                            ? pr.id === 'discharge'
                              ? 'bg-emerald-600 text-white border-emerald-700'
                              : 'bg-teal-600 text-white border-teal-700'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {pr.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                        {pendingPreset === 'lab'
                          ? 'Estudios solicitados (ej. BH, QS, ES3, Gasometría)'
                          : pendingPreset === 'imaging'
                          ? 'Estudio de imagen (ej. TAC de tórax simple)'
                          : pendingPreset === 'consult'
                          ? 'Servicio interconsultante (ej. Nefrología, UCI)'
                          : pendingPreset === 'discharge'
                          ? 'Detalles de Alta (ej. Receta, resumen de egreso, cita)'
                          : 'Descripción del Pendiente'}
                      </label>
                      <input
                        type="text"
                        value={pendingText}
                        onChange={(e) => setPendingText(e.target.value)}
                        placeholder={
                          pendingPreset === 'lab'
                            ? 'BH, QS, ES3, Procalcitonina...'
                            : pendingPreset === 'discharge'
                            ? 'Egreso matutino indicado'
                            : 'Escribe los detalles...'
                        }
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                      />
                    </div>

                    {pendingPreset === 'custom' && (
                      <div>
                        <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Categoría</label>
                        <select
                          value={pendingCategory}
                          onChange={(e: any) => setPendingCategory(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                        >
                          <option value="Laboratorio">Laboratorio</option>
                          <option value="Imagen/Gabinete">Imagen / Gabinete</option>
                          <option value="Interconsulta">Interconsulta</option>
                          <option value="Procedimiento">Procedimiento</option>
                          <option value="Familiar/Alta">Familiar / Trámite</option>
                          <option value="Alta Hospitalaria">Alta Hospitalaria</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* 4-Color Traffic Light Selector */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Semáforo:</span>
                      {(
                        [
                          { id: 'red', label: 'Rojo (Urgente)', dot: 'bg-rose-500' },
                          { id: 'yellow', label: 'Amarillo (Prioritario)', dot: 'bg-amber-400' },
                          { id: 'green', label: 'Verde (Rutina)', dot: 'bg-emerald-500' },
                          { id: 'blue', label: 'Azul (Seguimiento)', dot: 'bg-sky-500' },
                        ] as { id: PendingUrgencyColor; label: string; dot: string }[]
                      ).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setPendingUrgencyColor(c.id)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                            pendingUrgencyColor === c.id
                              ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                          <span>{c.label}</span>
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddPending(false)}
                        className="px-3 py-1 text-slate-500 hover:text-slate-800"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1 bg-emerald-600 text-white rounded-md font-bold cursor-pointer"
                      >
                        Guardar Pendiente
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Pending List */}
              <div className="space-y-2">
                {patient.pendings.map((pen) => {
                  const tl = getPendingTrafficLightInfo(pen);
                  const isDischarge = pen.isDischargePending || pen.category === 'Alta Hospitalaria';
                  const isRegisterStep = pen.workflowStage === 'register_census' && !pen.completed;

                  return (
                    <div
                      key={pen.id}
                      onClick={() => handleTogglePending(pen.id)}
                      className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs cursor-pointer transition-all ${
                        pen.completed
                          ? 'bg-slate-100 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60 line-through'
                          : isDischarge
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-700 font-bold'
                          : isRegisterStep
                          ? 'bg-cyan-50 dark:bg-cyan-950/30 border-cyan-400 dark:border-cyan-700 font-bold'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-teal-400'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={pen.completed}
                          onChange={() => {}}
                          className="rounded text-teal-600 focus:ring-teal-500"
                        />
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${tl.dotClass}`} />
                        {isDischarge && <LogOut className="w-4 h-4 text-emerald-600 shrink-0" />}
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {pen.text}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {pen.workflowStage && !pen.completed && (
                          <span className="px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-mono font-bold text-[10px]">
                            {pen.workflowStage === 'take'
                              ? 'Paso 1/3: Tomar/Solicitar'
                              : pen.workflowStage === 'collect'
                              ? 'Paso 2/3: Recabar'
                              : 'Paso 3/3: Registrar en Censo'}
                          </span>
                        )}
                        {isRegisterStep && onOpenDirectLabStudy && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenDirectLabStudy(patient);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                          >
                            <FlaskConical className="w-3 h-3" />
                            <span>Capturar Ahora</span>
                          </button>
                        )}
                        <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-[10px]">
                          {pen.category}
                        </span>
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] border ${tl.badgeClass}`}>
                          {tl.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: NOTAS PREVIAS */}
          {activeTab === 'notes' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Historial de Notas del Paciente
                  </h3>
                  <InfoPopover
                    title="Notas Guardadas en Bóveda"
                    content="Consulta o copia las notas de ingreso y evolución elaboradas previamente para este paciente."
                  />
                </div>
              </div>

              {patientNotes.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  No hay notas respaldadas para este paciente aún. Redacta una desde el botón superior.
                </div>
              ) : (
                <div className="space-y-4">
                  {patientNotes.map((note) => (
                    <div
                      key={note.id}
                      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-teal-600 dark:text-teal-400">
                            {note.noteType}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-600 dark:text-slate-300">
                            {note.date} a las {note.time} hrs
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-500 italic">Por: {note.residentAuthor}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                            {note.auditHash}
                          </span>
                          <button
                            onClick={() => handleCopyNote(note)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                          >
                            {copiedNoteId === note.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{copiedNoteId === note.id ? 'Copiada' : 'Copiar'}</span>
                          </button>
                        </div>
                      </div>

                      <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                        {note.content}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Bottom Actions Bar */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Cerrar Expediente
          </button>

          <button
            type="button"
            onClick={onOpenNoteGenerator}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Generar Nota de Evolución</span>
          </button>
        </div>
      </div>
    </div>
  );
};
