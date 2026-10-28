import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Wand2,
  Sparkles,
  ShieldCheck,
  FileText,
  AlertCircle,
  Loader2,
  Pill,
  ArrowLeft,
  History,
  Plus,
  Trash2,
  User,
  ClipboardList,
  RefreshCw,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Clock,
  Settings,
} from 'lucide-react';
import {
  Patient,
  ClinicalNoteRecord,
  ResidentProfile,
  MedicationItem,
  ClinicalPending,
  ParenteralSolutionItem,
  PatientNursingOrderItem,
  CriticalCareSystemsData,
} from '../types/clinical.ts';
import {
  calculateHospitalStayDays,
  calculateAntibioticDay,
  buildDeterministicProgressNote,
  generateAuditHash,
  formatChronologicalLabsParagraphs,
  formatChronologicalStudiesParagraphs,
  formatParenteralSolutionLine,
  formatCriticalCareSystemsForNote,
  DEFAULT_SUBJECTIVE_PRESETS,
  DEFAULT_PHYSICAL_EXAM_TEMPLATES,
  DEFAULT_DIET_PRESETS,
  DEFAULT_MEDICATION_ROUTES,
} from '../utils/clinicalLogic.ts';
import { InfoPopover } from './InfoPopover.tsx';
import { DiagnosisListEditor } from './DiagnosisListEditor.tsx';
import { CriticalCareSystemsEditor } from './CriticalCareSystemsEditor.tsx';
import { SettingsTabKey } from './GlobalSettingsModal.tsx';
import { UnifiedNursingOrdersPanel } from './UnifiedNursingOrdersPanel.tsx';
import { UnifiedSolutionsPanel } from './UnifiedSolutionsPanel.tsx';

interface NoteGeneratorModalProps {
  patient: Patient;
  profile: ResidentProfile;
  isOpen: boolean;
  onClose: () => void;
  onSaveNote: (note: ClinicalNoteRecord) => void;
  previousNotes?: ClinicalNoteRecord[];
  onUpdateProfile?: (profile: ResidentProfile) => void;
  onUpdatePatient?: (updatedPatient: Patient) => void;
  onBackToExpediente?: (patient: Patient) => void;
  onOpenSettings?: (tab?: SettingsTabKey) => void;
}

export const NoteGeneratorModal: React.FC<NoteGeneratorModalProps> = ({
  patient,
  profile,
  isOpen,
  onClose,
  onSaveNote,
  previousNotes = [],
  onUpdatePatient,
  onBackToExpediente,
  onOpenSettings,
}) => {
  const stayDays = calculateHospitalStayDays(patient.admissionDate);

  // Detect newly added labs or diagnostic studies reported outside notes
  const newLabsCount = patient.labs.filter((l) => l.isNew).length;
  const newStudiesCount = (patient.studies || []).filter((s) => s.isNew).length;
  const hasNewParaclinics = newLabsCount > 0 || newStudiesCount > 0;

  // Find yesterday's / last previous note for this patient
  const patientPreviousNotes = previousNotes.filter((n) => n.patientId === patient.id);
  const lastNote = patientPreviousNotes.length > 0 ? patientPreviousNotes[0] : null;

  // View state: split screen (Ayer vs Hoy) or full preview
  const [activeSideTab, setActiveSideTab] = useState<'editor' | 'preview'>('editor');
  const [showYesterdayPanel, setShowYesterdayPanel] = useState<boolean>(true);

  // Note Type
  const [noteType] = useState<
    'Nota de Evolución' | 'Nota de Ingreso' | 'Valoración / Interconsulta' | 'Nota de Egreso / Alta'
  >('Nota de Evolución');

  // Author & Responsibility
  const [residentAuthor, setResidentAuthor] = useState(
    profile.name || 'Médico Tratante / Residente'
  );

  // DIAGNÓSTICOS: Iniciales/Previos vs. Actuales (Evolución)
  const initialDiagList =
    patient.initialDiagnoses && patient.initialDiagnoses.length > 0
      ? patient.initialDiagnoses
      : patient.diagnoses;
  const [previousDiagnosesText] = useState<string>(
    initialDiagList.join('\n')
  );
  const [currentDiagnosesText, setCurrentDiagnosesText] = useState<string>(
    patient.diagnoses.join('\n')
  );
  const [includePreviousDiagnosesInNote, setIncludePreviousDiagnosesInNote] = useState<boolean>(false);

  // 1. SUBJETIVO (En prosa sin título en la nota final)
  const [currentIllness] = useState<string>('');
  const [patientComplaintsToday, setPatientComplaintsToday] = useState(
    'Refiere adecuada tolerancia a la vía oral, sin dolor agudo ni disnea en reposo, uresis y evacuaciones presentes sin alteraciones.'
  );
  const [selectedSubjectiveChips, setSelectedSubjectiveChips] = useState<string[]>([
    'Paciente consciente y tranquilo',
    'Afebril y sin dolor agudo',
  ]);

  // 2. OBJETIVO (Signos vitales corridos al inicio de la exploración física en prosa)
  const [bp, setBp] = useState(patient.vitals?.bp || '120/80');
  const [hr, setHr] = useState(patient.vitals?.hr || '75');
  const [rr, setRr] = useState(patient.vitals?.rr || '18');
  const [temp, setTemp] = useState(patient.vitals?.temp || '36.5');
  const [spo2, setSpo2] = useState(patient.vitals?.spo2 || '96');
  const [glucose, setGlucose] = useState(patient.vitals?.glucose || '120');

  useEffect(() => {
    setBp(patient.vitals?.bp || '120/80');
    setHr(patient.vitals?.hr || '75');
    setRr(patient.vitals?.rr || '18');
    setTemp(patient.vitals?.temp || '36.5');
    setSpo2(patient.vitals?.spo2 || '96');
    setGlucose(patient.vitals?.glucose || '120');
  }, [patient.id, patient.vitals?.updatedAt]);
  const [criticalCareSystems, setCriticalCareSystems] = useState<CriticalCareSystemsData>(() => {
    if (patient.criticalCareSystems) return patient.criticalCareSystems;
    return {
      enabled: patient.severity === 'Grave' || patient.severity === 'Muy Grave / UCI',
    };
  });
  const [physicalExam, setPhysicalExam] = useState(
    'A la exploración física encontramos paciente consciente, orientado en sus tres esferas, adecuada coloración e hidratación de mucosas y tegumentos, cuello cilíndrico sin ingurgitación yugular, cardiopulmonar con ruidos cardíacos rítmicos de buen tono e intensidad sin soplos, campos pulmonares bien ventilados con murmullo vesicular presente sin estertores ni sibilancias, abdomen blando, depresible, no doloroso a la palpación, peristalsis normoaudible sin datos de irritación peritoneal, extremidades íntegras, simétricas, sin edema y con llenado capilar inmediato de 2 segundos.'
  );

  // 3. ANÁLISIS (Con título ANÁLISIS:, sin bloque de antimicrobianos)
  const [problemAnalysis, setProblemAnalysis] = useState(
    patient.evolutionSummary ||
      'Paciente que cursa con evolución clínica estacionaria tendiente a la mejoría, hemodinámicamente estable, sin requerimiento de apoyo vasopresor ni deterioro ventilatorio. Se ajusta manejo médico e indicaciones conforme a evolución clínica y paraclínica actual.'
  );

  // 4. PLAN E INDICACIONES MÉDICAS (Sincronizado en tiempo real con Expediente, Censo Activo y Censo Imprimible)
  const [dietPlan, setDietPlan] = useState(
    patient.diet || 'Dieta normosódica para paciente diabético, fraccionada en 3 tomas.'
  );
  const [dietSpecialNotes, setDietSpecialNotes] = useState(patient.dietSpecialNotes || '');

  // Structured Multiple Parenteral Solutions & Infusions (with IV / CVC / IO, concentration, infusion rate, special notes, and drag-and-drop order)
  const [structuredSolutions, setStructuredSolutions] = useState<ParenteralSolutionItem[]>(() => {
    if (patient.structuredSolutions && patient.structuredSolutions.length > 0) {
      return patient.structuredSolutions;
    }
    const rawFluids = (patient.ivFluids || 'Solución Salina 0.9% 500 ml').trim();
    return [
      {
        id: 'sol-init-1',
        solutionType: rawFluids,
        volume: '',
        addedConcentrateOrMed: '',
        concentration: '',
        route: 'IV',
        infusionRate: 'p/24h',
        specialNotes: '',
      },
    ];
  });
  const solutionsPlan = React.useMemo(() => {
    if (structuredSolutions.length === 0) return 'Vena periférica permeable.';
    return structuredSolutions.map((s) => formatParenteralSolutionLine(s)).join(' | ');
  }, [structuredSolutions]);

  // Interactive Medications state synced with patient.medications (with drag-and-drop & up/down order)
  const [localMedications, setLocalMedications] = useState<MedicationItem[]>(patient.medications || []);
  const [medCategoryFilter, setMedCategoryFilter] = useState<'all' | 'antibiotic' | 'limited'>('all');
  const [draggedMedIdx, setDraggedMedIdx] = useState<number | null>(null);
  const [showAddMedForm, setShowAddMedForm] = useState<boolean>(false);
  const [newMedName, setNewMedName] = useState('');
  const [newMedDose, setNewMedDose] = useState('');
  const [newMedRoute, setNewMedRoute] = useState('IV');
  const [newMedFreq, setNewMedFreq] = useState('cada 8 hrs');
  const [newMedCourseType, setNewMedCourseType] = useState<'antibiotic' | 'limited' | 'continuous'>('antibiotic');
  const [newMedStartDate, setNewMedStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [newMedPlannedDays, setNewMedPlannedDays] = useState('7');
  const [newMedIndication, setNewMedIndication] = useState('');

  // Format medications list for the note (compact, preserving order, including day count for both Antibiotics and Limited Course meds)
  const formatMedsListFromItems = (meds: MedicationItem[]): string => {
    const active = meds.filter((m) => m.active);
    if (active.length === 0) return 'Sin medicamentos prescritos.';
    return active
      .map((m) => {
        const isLim =
          !m.isAntibiotic && Boolean(m.isLimitedCourse || (m.plannedDays && m.plannedDays > 0));
        const dayCounter =
          m.isAntibiotic || isLim
            ? ` [FI: ${m.startDate} • ${calculateAntibioticDay(m.startDate, m.plannedDays).displayString}]`
            : '';
        return `${m.name} ${m.dose} vía ${m.route} ${m.frequency}${dayCounter}`;
      })
      .join('\n');
  };

  const [medicationsPlan, setMedicationsPlan] = useState<string>(() =>
    formatMedsListFromItems(patient.medications || [])
  );

  // Sync medicationsPlan whenever localMedications changes
  useEffect(() => {
    setMedicationsPlan(formatMedsListFromItems(localMedications));
  }, [localMedications]);

  // Nursing Orders Repository + Reorderable & Inline-Editable Patient Nursing Orders with Sub-Notes
  const defaultNursingRepo = profile.nursingRepository || [
    'Signos vitales por turno y avisar eventualidades (PAM < 65 o > 100, FC > 100 o < 50, Temp > 38°C)',
    'Posición semi-Fowler 30° a 45° con cabecera elevada',
    'Cuantificación estricta de uresis y balance hídrico acumulado por turno',
    'Vigilancia estrecha de datos de alarma neurológica y escala de Glasgow',
    'Cuidados de catéter venoso central / vía periférica y curación según NOM',
    'Glucemia capilar por turno y aplicar esquema de insulina rápida si > 180 mg/dL',
    'Movilización en cama cada 2 horas y medidas de prevención de UPP',
    'Oxígeno suplementario por puntas nasales a 2-3 L/min para mantener SpO2 > 92%',
  ];
  const nursingRepository =
    profile.nursingRepository && profile.nursingRepository.length > 0
      ? profile.nursingRepository
      : defaultNursingRepo;
  const [structuredNursingOrders, setStructuredNursingOrders] = useState<PatientNursingOrderItem[]>(() => {
    if (patient.structuredNursingOrders && patient.structuredNursingOrders.length > 0) {
      return patient.structuredNursingOrders;
    }
    const normalizedOrders = Array.isArray(patient.nursingOrders)
      ? patient.nursingOrders
      : typeof patient.nursingOrders === 'string'
      ? (patient.nursingOrders as string)
          .split('\n')
          .map((s) => s.replace(/^[•\-*\d.)\s]+/, '').trim())
          .filter(Boolean)
      : [];
    const initialStrings =
      normalizedOrders.length > 0
        ? normalizedOrders
        : [defaultNursingRepo[0], defaultNursingRepo[1], defaultNursingRepo[2]];
    return initialStrings.map((txt, idx) => ({
      id: `nurs-init-${idx}`,
      text: txt,
      note: '',
    }));
  });

  // Interactive Pendings state synced with patient.pendings
  const [localPendings, setLocalPendings] = useState<ClinicalPending[]>(patient.pendings || []);
  const [showAddPendingForm, setShowAddPendingForm] = useState<boolean>(false);
  const [newPendingText, setNewPendingText] = useState('');
  const [newPendingCategory, setNewPendingCategory] = useState<ClinicalPending['category']>('Laboratorio');
  const [newPendingPriority, setNewPendingPriority] = useState<ClinicalPending['priority']>('Alta');

  const formatPendingsListFromItems = (pendings: ClinicalPending[]): string => {
    const active = pendings.filter((p) => !p.completed);
    if (active.length === 0) return '';
    return active.map((p) => `${p.text} (${p.category})`).join('\n');
  };

  const [pendingsPlan, setPendingsPlan] = useState<string>(() =>
    formatPendingsListFromItems(patient.pendings || [])
  );

  useEffect(() => {
    setPendingsPlan(formatPendingsListFromItems(localPendings));
  }, [localPendings]);

  // Generated Text & Actions
  const [finalNoteText, setFinalNoteText] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [isProofreading, setIsProofreading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Subjective presets (customizable from Preferences)
  const subjectivePresets =
    profile.subjectivePresets && profile.subjectivePresets.length > 0
      ? profile.subjectivePresets
      : DEFAULT_SUBJECTIVE_PRESETS;

  // Physical exam prose templates (customizable from Preferences)
  const physicalExamProseTemplates =
    profile.physicalExamTemplates && profile.physicalExamTemplates.length > 0
      ? profile.physicalExamTemplates
      : DEFAULT_PHYSICAL_EXAM_TEMPLATES;

  // Diet quick presets (customizable from Preferences)
  const dietQuickPresets =
    profile.dietPresets && profile.dietPresets.length > 0
      ? profile.dietPresets
      : DEFAULT_DIET_PRESETS;

  // Medication Administration Routes (customizable from Preferences)
  const medicationRoutesList =
    profile.medicationRoutesCatalog && profile.medicationRoutesCatalog.length > 0
      ? profile.medicationRoutesCatalog
      : DEFAULT_MEDICATION_ROUTES;

  // Chronological Labs & Imaging (ALL included, most recent first, oldest last, comma-separated paragraphs)
  const chronologicalLabsParagraphs = formatChronologicalLabsParagraphs(patient.labs || []);
  const chronologicalStudiesParagraphs = formatChronologicalStudiesParagraphs(patient.studies || []);

  // Build the unified institutional prose note
  const generateSoapString = (): string => {
    const chipsString = selectedSubjectiveChips.join(', ');
    const combinedSymptoms = [chipsString, patientComplaintsToday.trim()]
      .filter(Boolean)
      .join('. ');

    return buildDeterministicProgressNote({
      patient: {
        name: patient.name,
        bed: patient.bed,
        service: patient.service,
        age: patient.age,
        gender: patient.gender,
        diagnoses: currentDiagnosesText,
        previousDiagnoses: includePreviousDiagnosesInNote ? previousDiagnosesText : undefined,
        hospitalStayDays: stayDays,
        codeStatus: patient.codeStatus,
        allergies: patient.allergies,
      },
      vitals: { bp, hr, rr, temp, spo2, glucose },
      currentIllness,
      patientComplaintsToday: combinedSymptoms,
      physicalExam,
      chronologicalLabsText: chronologicalLabsParagraphs,
      imagingStudiesText: chronologicalStudiesParagraphs,
      problemAnalysis,
      dietPlan,
      dietSpecialNotes,
      solutionsPlan,
      structuredSolutions,
      medicationsPlan,
      structuredNursingOrders,
      pendingsText: pendingsPlan,
      criticalCareSystemsText: formatCriticalCareSystemsForNote(criticalCareSystems),
      residentName: residentAuthor,
    });
  };

  // Re-generate on change
  useEffect(() => {
    setFinalNoteText(generateSoapString());
  }, [
    currentDiagnosesText,
    previousDiagnosesText,
    includePreviousDiagnosesInNote,
    currentIllness,
    patientComplaintsToday,
    selectedSubjectiveChips,
    bp,
    hr,
    rr,
    temp,
    spo2,
    glucose,
    physicalExam,
    criticalCareSystems,
    problemAnalysis,
    dietPlan,
    dietSpecialNotes,
    structuredSolutions,
    medicationsPlan,
    structuredNursingOrders,
    pendingsPlan,
    residentAuthor,
    patient.labs,
    patient.studies,
  ]);

  // Helper to build the updated Patient object with all changes from this Note Generator
  const buildUpdatedPatientObject = (markParaclinicsIntegratedNoteId?: string): Patient => {
    const parsedCurrentDiagnoses = currentDiagnosesText
      .split('\n')
      .map((d) => d.trim())
      .filter(Boolean);
    const parsedInitialDiagnoses = previousDiagnosesText
      .split('\n')
      .map((d) => d.trim())
      .filter(Boolean);

    const updatedLabs = markParaclinicsIntegratedNoteId
      ? patient.labs.map((l) =>
          l.isNew ? { ...l, isNew: false, integratedInNoteId: markParaclinicsIntegratedNoteId } : l
        )
      : patient.labs;

    const updatedStudies = markParaclinicsIntegratedNoteId
      ? (patient.studies || []).map((s) =>
          s.isNew ? { ...s, isNew: false, integratedInNoteId: markParaclinicsIntegratedNoteId } : s
        )
      : patient.studies;

    return {
      ...patient,
      diagnoses: parsedCurrentDiagnoses.length > 0 ? parsedCurrentDiagnoses : patient.diagnoses,
      // Do NOT retroactively overwrite initialDiagnoses from the progress note
      initialDiagnoses:
        patient.initialDiagnoses && patient.initialDiagnoses.length > 0
          ? patient.initialDiagnoses
          : parsedInitialDiagnoses,
      vitals: {
        bp,
        hr,
        rr,
        temp,
        spo2,
        glucose,
        weightKg: patient.vitals?.weightKg,
        updatedAt: patient.vitals?.updatedAt,
        isNew: markParaclinicsIntegratedNoteId ? false : patient.vitals?.isNew,
      },
      diet: dietPlan.trim(),
      dietSpecialNotes: dietSpecialNotes.trim() || undefined,
      ivFluids: solutionsPlan.trim(),
      structuredSolutions,
      nursingOrders: structuredNursingOrders.map((o) => o.text),
      structuredNursingOrders,
      medications: localMedications,
      pendings: localPendings,
      criticalCareSystems,
      evolutionSummary: problemAnalysis.trim().slice(0, 260) || patient.evolutionSummary,
      labs: updatedLabs,
      studies: updatedStudies,
      lastUpdated: new Date().toISOString(),
    };
  };

  // Sync changes to Patient (Census + Printable Census + Expediente) immediately
  const handleSyncPatientChanges = () => {
    if (!onUpdatePatient) return;
    const updated = buildUpdatedPatientObject();
    onUpdatePatient(updated);
    setSyncSuccess(true);
    setTimeout(() => setSyncSuccess(false), 2500);
  };

  // Medication CRUD inside NoteGeneratorModal
  const handleAddMedicationInline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedName.trim()) return;
    const isAb = newMedCourseType === 'antibiotic';
    const isLim = newMedCourseType === 'limited';
    const hasCounter = isAb || isLim;

    const newMed: MedicationItem = {
      id: `med-${Date.now()}`,
      name: newMedName.trim(),
      dose: newMedDose.trim() || '1 dosis',
      route: newMedRoute,
      frequency: newMedFreq,
      isAntibiotic: isAb,
      isLimitedCourse: isLim,
      startDate: newMedStartDate,
      plannedDays: hasCounter && newMedPlannedDays ? parseInt(newMedPlannedDays, 10) : undefined,
      indication: newMedIndication.trim() || undefined,
      active: true,
    };
    const nextMeds = [...localMedications, newMed];
    setLocalMedications(nextMeds);
    if (onUpdatePatient) {
      onUpdatePatient({ ...patient, medications: nextMeds, lastUpdated: new Date().toISOString() });
    }
    setNewMedName('');
    setNewMedDose('');
    setNewMedIndication('');
    setShowAddMedForm(false);
  };

  const handleSetMedicationCourseTypeInline = (
    medId: string,
    targetType: 'antibiotic' | 'limited' | 'continuous'
  ) => {
    const nextMeds = localMedications.map((m) => {
      if (m.id !== medId) return m;
      if (targetType === 'antibiotic') {
        return { ...m, isAntibiotic: true, isLimitedCourse: false, plannedDays: m.plannedDays || 7 };
      }
      if (targetType === 'limited') {
        return { ...m, isAntibiotic: false, isLimitedCourse: true, plannedDays: m.plannedDays || 5 };
      }
      return { ...m, isAntibiotic: false, isLimitedCourse: false, plannedDays: undefined };
    });
    setLocalMedications(nextMeds);
    if (onUpdatePatient) {
      onUpdatePatient({ ...patient, medications: nextMeds, lastUpdated: new Date().toISOString() });
    }
  };

  const handleToggleMedicationActive = (medId: string) => {
    const nextMeds = localMedications.map((m) =>
      m.id === medId ? { ...m, active: !m.active } : m
    );
    setLocalMedications(nextMeds);
    if (onUpdatePatient) {
      onUpdatePatient({ ...patient, medications: nextMeds, lastUpdated: new Date().toISOString() });
    }
  };

  const handleDeleteMedicationInline = (medId: string) => {
    const nextMeds = localMedications.filter((m) => m.id !== medId);
    setLocalMedications(nextMeds);
    if (onUpdatePatient) {
      onUpdatePatient({ ...patient, medications: nextMeds, lastUpdated: new Date().toISOString() });
    }
  };

  // Pending CRUD inside NoteGeneratorModal
  const handleAddPendingInline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPendingText.trim()) return;
    const newPen: ClinicalPending = {
      id: `pen-${Date.now()}`,
      text: newPendingText.trim(),
      category: newPendingCategory,
      priority: newPendingPriority,
      completed: false,
      createdAt: new Date().toISOString().split('T')[0],
    };
    const nextPendings = [newPen, ...localPendings];
    setLocalPendings(nextPendings);
    if (onUpdatePatient) {
      onUpdatePatient({ ...patient, pendings: nextPendings, lastUpdated: new Date().toISOString() });
    }
    setNewPendingText('');
    setShowAddPendingForm(false);
  };

  const handleTogglePendingInline = (penId: string) => {
    const nextPendings = localPendings.map((p) =>
      p.id === penId ? { ...p, completed: !p.completed } : p
    );
    setLocalPendings(nextPendings);
    if (onUpdatePatient) {
      onUpdatePatient({ ...patient, pendings: nextPendings, lastUpdated: new Date().toISOString() });
    }
  };

  const handleDeletePendingInline = (penId: string) => {
    const nextPendings = localPendings.filter((p) => p.id !== penId);
    setLocalPendings(nextPendings);
    if (onUpdatePatient) {
      onUpdatePatient({ ...patient, pendings: nextPendings, lastUpdated: new Date().toISOString() });
    }
  };

  // Copy from yesterday handlers
  const handleCopyAllFromYesterday = () => {
    if (!lastNote) return;
    setFinalNoteText(lastNote.content);
    setProblemAnalysis(
      patient.evolutionSummary || 'Evolución clínica estacionaria respecto al día previo.'
    );
  };

  const handleCopySubjectiveFromYesterday = () => {
    if (patient.evolutionSummary) {
      setPatientComplaintsToday(
        `Paciente refiere estabilidad sintomática respecto al día previo: ${patient.evolutionSummary}`
      );
    } else {
      setPatientComplaintsToday(
        'Paciente refiere continuar con la misma sintomatología que el día previo, sin nuevos agregados.'
      );
    }
  };

  const handleCopyAnalysisFromYesterday = () => {
    if (patient.evolutionSummary) {
      setProblemAnalysis(
        `Paciente en quien persiste evolución clínica respecto al día previo: ${patient.evolutionSummary}. Se mantiene vigilancia estrecha.`
      );
    } else {
      setProblemAnalysis(
        'Paciente que se mantiene sin cambios clínicos agudos en las últimas 24 horas. Se continúa manejo médico instaurado.'
      );
    }
  };

  // Close on Escape key only when not typing in an input/textarea/select
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

  if (!isOpen) return null;

  const handleMoveMedication = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= localMedications.length || fromIdx === toIdx) return;
    const next = [...localMedications];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setLocalMedications(next);
  };

  // Gemini AI generation
  const handleGenerateWithAi = async () => {
    setIsLoadingAi(true);
    setAiError(null);
    try {
      const res = await fetch('/api/gemini/generate-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientData: {
            name: patient.name,
            bed: patient.bed,
            service: patient.service,
            age: patient.age,
            gender: patient.gender,
            diagnoses: currentDiagnosesText,
            hospitalStayDays: stayDays,
            codeStatus: patient.codeStatus,
            allergies: patient.allergies,
          },
          options: {
            subjective: `${currentIllness}\n${selectedSubjectiveChips.join(', ')}\n${patientComplaintsToday}`,
            vitals: { bp, hr, rr, temp, spo2, glucose },
            physicalExam,
            recentLabs: chronologicalLabsParagraphs,
            medications: medicationsPlan,
            pendings: pendingsPlan,
          },
        }),
      });

      if (!res.ok) throw new Error(`Error en servidor (${res.status})`);
      const data = await res.json();
      if (data.generatedNote) {
        setFinalNoteText(data.generatedNote);
      }
    } catch (e: any) {
      console.warn('AI fallback:', e);
      setAiError('Generada con plantilla institucional en prosa.');
      setFinalNoteText(generateSoapString());
    } finally {
      setIsLoadingAi(false);
    }
  };

  // Gemini Proofreading
  const handleProofread = async () => {
    if (!finalNoteText) return;
    setIsProofreading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/gemini/proofread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: finalNoteText, noteType }),
      });
      if (!res.ok) throw new Error('Error al conectar con corrector');
      const data = await res.json();
      if (data.correctedText) {
        setFinalNoteText(data.correctedText);
      }
    } catch (e) {
      setAiError('Error al contactar con el corrector de ortografía.');
    } finally {
      setIsProofreading(false);
    }
  };

  // Copy to clipboard + sync patient
  const handleCopy = async () => {
    if (onUpdatePatient) {
      onUpdatePatient(buildUpdatedPatientObject());
    }
    try {
      await navigator.clipboard.writeText(finalNoteText);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = finalNoteText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  // Save to Immutable Vault AND update patient (Census + Printable + Expediente)
  const handleSaveToVault = () => {
    if (!finalNoteText) return;
    setIsSaving(true);

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const newId = `note-${Date.now()}`;
    const auditHash = generateAuditHash(newId, now.toISOString(), finalNoteText);

    const record: ClinicalNoteRecord = {
      id: newId,
      patientId: patient.id,
      patientName: patient.name,
      bed: patient.bed,
      service: patient.service,
      date: dateStr,
      time: timeStr,
      noteType,
      content: finalNoteText,
      auditHash,
      residentAuthor,
      createdAtTimestamp: Date.now(),
    };

    onSaveNote(record);

    if (onUpdatePatient) {
      const updatedPatient = buildUpdatedPatientObject(newId);
      onUpdatePatient(updatedPatient);
    }

    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center pt-14 px-2 pb-2 sm:px-4 sm:pb-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-7xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-[86vh] overflow-hidden">
        {/* Top Header */}
        <div className="px-5 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between border-b border-slate-800 gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white leading-tight">
                  Nota de Evolución e Indicaciones Integrales
                </h2>
                <span className="bg-slate-800 text-teal-300 font-mono text-xs px-2 py-0.5 rounded border border-slate-700">
                  {patient.bed}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {patient.name} ({patient.age}a) • Día {stayDays} de estancia • {patient.service} • Sincroniza Censo, Expediente y Hoja de Guardia
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onBackToExpediente && (
              <button
                type="button"
                onClick={() => {
                  if (onUpdatePatient) onUpdatePatient(buildUpdatedPatientObject());
                  onBackToExpediente(buildUpdatedPatientObject());
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 rounded-lg text-xs font-bold border border-teal-500/40 transition-colors cursor-pointer"
                title="Guardar cambios y regresar al Expediente Clínico del paciente"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Regresar al Expediente</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowYesterdayPanel(!showYesterdayPanel)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                showYesterdayPanel
                  ? 'bg-slate-800 text-teal-300 border-teal-500/40'
                  : 'bg-slate-800/60 text-slate-400 border-slate-700'
              }`}
              title="Mostrar / Ocultar panel con la nota previa para comparar"
            >
              <History className="w-3.5 h-3.5 text-teal-400" />
              <span>{showYesterdayPanel ? 'Ocultar Nota Previa' : 'Ver Nota Previa'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
              title="Cerrar al Censo Activo (Esc)"
            >
              <X className="w-4 h-4" />
              <span>Cerrar</span>
            </button>
          </div>
        </div>

        {/* Modal Main Area: Split Screen (Ayer vs Hoy) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
          {/* LEFT PANEL: Nota del Día Anterior */}
          {showYesterdayPanel && (
            <div className="lg:col-span-3 bg-slate-50 dark:bg-slate-950 p-3.5 flex flex-col justify-between overflow-y-auto space-y-3 border-r border-slate-200 dark:border-slate-800">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    <History className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span>Evolución Previa</span>
                  </div>
                  {lastNote && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      {lastNote.date} ({lastNote.time})
                    </span>
                  )}
                </div>

                {/* Quick copy buttons from yesterday */}
                <div className="space-y-1.5 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Atajos de Nota Previa:
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={handleCopySubjectiveFromYesterday}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300 font-semibold text-[11px] flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3 text-teal-500" />
                      <span>Subjetivo</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyAnalysisFromYesterday}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300 font-semibold text-[11px] flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3 text-purple-500" />
                      <span>Análisis</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyAllFromYesterday}
                      className="col-span-2 px-2 py-1 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900/60 text-teal-800 dark:text-teal-200 rounded font-bold text-[11px] flex items-center justify-center gap-1"
                    >
                      <Copy className="w-3 h-3 text-teal-600" />
                      <span>Copiar Nota Previa Íntegra</span>
                    </button>
                  </div>
                </div>

                {/* Content of yesterday's note */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Texto Previo Registrado:
                  </span>
                  {lastNote ? (
                    <pre className="p-2.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-[10px] leading-relaxed whitespace-pre-wrap max-h-[520px] overflow-y-auto">
                      {lastNote.content}
                    </pre>
                  ) : (
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500 text-center">
                      Sin nota previa en bóveda.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* RIGHT PANEL: Editor de Hoy (SOAP estructurado y sincronizado) */}
          <div className={`${showYesterdayPanel ? 'lg:col-span-9' : 'lg:col-span-12'} flex flex-col overflow-hidden bg-white dark:bg-slate-900`}>
            {/* Sub-Header with Section switcher / Preview toggle */}
            <div className="px-5 py-2 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-xs">
                  Nota de Evolución (NOM-004):
                </span>
                <InfoPopover
                  title="Formato Institucional en Prosa (Ahorro de Hoja Blanca)"
                  content="La nota inicia en prosa con estancia y diagnósticos actuales; coloca los signos vitales corridos al principio de la exploración física; lista paraclínicos e imagen en orden cronológico (más reciente arriba) corridos por comas; e incluye INDICACIONES MÉDICAS numeradas sin renglones vacíos."
                />
              </div>

              {/* View mode toggle: Editor vs Final Preview */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSyncPatientChanges}
                  className={`px-3 py-1 rounded-lg font-bold text-xs flex items-center gap-1.5 border transition-all cursor-pointer ${
                    syncSuccess
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-800 hover:bg-teal-100'
                  }`}
                  title="Actualiza diagnósticos, medicamentos, dieta, soluciones y pendientes en el Censo Activo, Censo para Imprimir y Expediente"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncSuccess ? 'animate-spin' : ''}`} />
                  <span>{syncSuccess ? '¡Censo y Expediente Actualizados!' : 'Sincronizar al Censo'}</span>
                </button>

                <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-200/60 dark:bg-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveSideTab('editor')}
                    className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                      activeSideTab === 'editor'
                        ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Editor SOAP
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSideTab('preview')}
                    className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                      activeSideTab === 'preview'
                        ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Texto Final para Copiar
                  </button>
                </div>
              </div>
            </div>

            {/* TAB CONTENT 1: Structured SOAP Editor */}
            {activeSideTab === 'editor' ? (
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                {/* Paraclínicos Nuevos Notificación */}
                {hasNewParaclinics && (
                  <div className="bg-teal-500/10 border border-teal-500/40 rounded-xl p-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-teal-600 text-white rounded font-bold text-[10px]">
                        NUEVO
                      </span>
                      <span className="text-slate-700 dark:text-slate-200 text-[11px]">
                        <strong>{newLabsCount} lab(s) y {newStudiesCount} estudio(s) nuevos</strong> ya están incluidos al inicio del bloque cronológico de Paraclínicos.
                      </span>
                    </div>
                  </div>
                )}

                {/* 0. DIAGNÓSTICOS: PREVIOS (INGRESO) VS ACTUALES (EVOLUCIÓN Y CENSO) */}
                <div className="bg-slate-50/70 dark:bg-slate-950/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-md bg-amber-600 text-white flex items-center justify-center font-bold text-xs">
                        Dx
                      </span>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Diagnósticos de Ingreso vs Actuales
                      </h3>
                      <InfoPopover
                        title="Diagnósticos de Ingreso vs Actuales"
                        content="Los diagnósticos iniciales se conservan como antecedente de ingreso. Modifica a la derecha los Diagnósticos Actuales conforme evolucione el paciente: se integrarán al inicio de la nota y actualizarán el Censo Activo e Imprimible."
                      />
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includePreviousDiagnosesInNote}
                        onChange={(e) => setIncludePreviousDiagnosesInNote(e.target.checked)}
                        className="rounded text-teal-600"
                      />
                      <span>Mencionar Dx previos en nota</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">
                            Diagnósticos de Ingreso (Base Inmutable)
                          </span>
                          <button
                            type="button"
                            onClick={() => setCurrentDiagnosesText(previousDiagnosesText)}
                            className="text-[10px] text-teal-600 hover:underline font-semibold cursor-pointer"
                          >
                            Copiar a actuales →
                          </button>
                        </div>
                        <div className="p-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono text-slate-600 dark:text-slate-400 space-y-1 max-h-40 overflow-y-auto">
                          {previousDiagnosesText
                            .split('\n')
                            .filter(Boolean)
                            .map((line, i) => (
                              <div key={i}>{line}</div>
                            ))}
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-2">
                        La base de ingreso no se modifica en retroceso desde evolución (solo editable en Ingreso).
                      </p>
                    </div>
                    <div className="bg-teal-50/30 dark:bg-teal-950/20 p-3 rounded-xl border-2 border-teal-500/40 dark:border-teal-600/40">
                      <DiagnosisListEditor
                        label="Diagnósticos Actuales (Prioridad Clínica + CIE-10)"
                        compact
                        value={currentDiagnosesText}
                        onChange={(_, joined) => setCurrentDiagnosesText(joined)}
                      />
                    </div>
                  </div>
                </div>

                {/* S - SUBJETIVO (En prosa corrida sin título en la nota final) */}
                <div className="bg-slate-50/70 dark:bg-slate-950/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-md bg-teal-600 text-white flex items-center justify-center font-bold text-xs">
                        S
                      </span>
                      <h3 className="text-xs sm:text-sm font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider">
                        Subjetivo y Evolución Sintomática
                      </h3>
                      <InfoPopover
                        title="Subjetivo en Prosa (NOM-004)"
                        content="Inicia integrando género, edad, días de estancia y diagnósticos actuales seguidos en el mismo párrafo por la evolución subjetiva del paciente (dolor, tolerancia oral, disnea, fiebre, diuresis), sin colocar subtítulo."
                      />
                    </div>
                    {onOpenSettings && (
                      <button
                        type="button"
                        onClick={() => onOpenSettings('templates')}
                        title="Editar o agregar opciones de Subjetivo y Evolución Sintomática en Preferencias"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-teal-500 text-slate-600 dark:text-slate-300 hover:text-teal-600 text-[10px] font-bold transition-colors cursor-pointer"
                      >
                        <Settings className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        <span>Editar opciones</span>
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {subjectivePresets.map((preset) => {
                      const isSel = selectedSubjectiveChips.includes(preset);
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            if (isSel) {
                              setSelectedSubjectiveChips(selectedSubjectiveChips.filter((c) => c !== preset));
                            } else {
                              setSelectedSubjectiveChips([...selectedSubjectiveChips, preset]);
                            }
                          }}
                          className={`text-xs px-2.5 py-0.5 rounded-md border transition-all cursor-pointer ${
                            isSel
                              ? 'bg-teal-600 text-white border-teal-600 font-semibold'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-teal-400'
                          }`}
                        >
                          {preset}
                        </button>
                      );
                    })}
                  </div>

                  <textarea
                    rows={2}
                    value={patientComplaintsToday}
                    onChange={(e) => setPatientComplaintsToday(e.target.value)}
                    placeholder="Ejemplo NOM-004 en prosa: Paciente masculino en su 5° día de estancia... Refiere encontrarse asintomático, afebril, adecuada tolerancia a la vía oral, sin dolor abdominal ni disnea..."
                    className="w-full text-xs sm:text-sm p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg leading-relaxed"
                  />
                </div>

                {/* O - OBJETIVO (Signos vitales corridos al inicio de la Exploración Física en prosa + Paraclínicos cronológicos) */}
                <div className="bg-slate-50/70 dark:bg-slate-950/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                        O
                      </span>
                      <h3 className="text-xs sm:text-sm font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                        Signos Vitales y Exploración Física
                      </h3>
                      <InfoPopover
                        title="Signos Vitales y Exploración en Prosa"
                        content="Los signos vitales capturados antes de la nota (en el censo o expediente durante el pase) se cargan automáticamente aquí y se integran corridos al inicio de la exploración física."
                      />
                      {patient.vitals?.isNew && (
                        <span className="px-2 py-0.5 rounded-md bg-teal-600 text-white font-bold text-[10px] uppercase tracking-wide flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>
                            SV Pre-Nota Cargados
                            {patient.vitals.updatedAt ? ` (${patient.vitals.updatedAt})` : ''}
                          </span>
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setBp(patient.vitals?.bp || '120/80');
                        setHr(patient.vitals?.hr || '75');
                        setRr(patient.vitals?.rr || '18');
                        setTemp(patient.vitals?.temp || '36.5');
                        setSpo2(patient.vitals?.spo2 || '96');
                        setGlucose(patient.vitals?.glucose || '');
                      }}
                      title="Restaurar los signos vitales guardados actualmente en el censo del paciente"
                      className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/50 cursor-pointer"
                    >
                      Traer SV del Censo
                    </button>
                  </div>

                  {/* Signos Vitales Compactos */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500">TA (mmHg)</span>
                      <input
                        type="text"
                        value={bp}
                        onChange={(e) => setBp(e.target.value)}
                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono text-center font-bold"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">FC (lpm)</span>
                      <input
                        type="text"
                        value={hr}
                        onChange={(e) => setHr(e.target.value)}
                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono text-center font-bold"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">FR (rpm)</span>
                      <input
                        type="text"
                        value={rr}
                        onChange={(e) => setRr(e.target.value)}
                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono text-center font-bold"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">Temp (°C)</span>
                      <input
                        type="text"
                        value={temp}
                        onChange={(e) => setTemp(e.target.value)}
                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono text-center font-bold"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">SpO2 (%)</span>
                      <input
                        type="text"
                        value={spo2}
                        onChange={(e) => setSpo2(e.target.value)}
                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono text-center font-bold"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">Glucemia</span>
                      <input
                        type="text"
                        value={glucose}
                        onChange={(e) => setGlucose(e.target.value)}
                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono text-center font-bold"
                      />
                    </div>
                  </div>

                  {/* Exploración Física en Prosa con Plantillas NOM-004 */}
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Exploración Física en Prosa Continua (NOM-004)
                      </label>
                      <div className="flex flex-wrap items-center gap-1">
                        {physicalExamProseTemplates.map((tpl) => (
                          <button
                            key={tpl.label}
                            type="button"
                            onClick={() => setPhysicalExam(tpl.text)}
                            className="text-[10px] px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 font-semibold cursor-pointer"
                          >
                            {tpl.label}
                          </button>
                        ))}
                        {onOpenSettings && (
                          <button
                            type="button"
                            onClick={() => onOpenSettings('templates')}
                            title="Editar o agregar plantillas de Exploración Física en Preferencias"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-blue-500 text-slate-600 dark:text-slate-300 hover:text-blue-600 text-[10px] font-bold cursor-pointer"
                          >
                            <Settings className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                            <span>Editar formatos</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <textarea
                      rows={3}
                      value={physicalExam}
                      onChange={(e) => setPhysicalExam(e.target.value)}
                      placeholder="Ejemplo NOM-004: A la exploración física encontramos paciente consciente, orientado en tiempo, lugar y persona, adecuada hidratación de mucosas, cardiopulmonar con ruidos cardíacos rítmicos sin soplos, campos pulmonares con murmullo vesicular conservado sin estertores, abdomen blando depresible no doloroso, extremidades sin edema..."
                      className="w-full text-xs p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg leading-relaxed"
                    />
                  </div>

                  {/* EVOLUCIÓN Y PARÁMETROS POR SISTEMAS (Opcional para cualquier paciente: solo se incluyen en nota y censo los valores llenados) */}
                  <CriticalCareSystemsEditor
                    value={criticalCareSystems}
                    onChange={setCriticalCareSystems}
                    patient={patient}
                  />

                  {/* PARACLÍNICOS Y ESTUDIOS DE IMAGEN CRONOLÓGICOS (Con Título, todos en orden del más reciente al más antiguo, corridos por comas) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                          PARACLÍNICOS: (Todos en orden cronológico, corridos por comas)
                        </span>
                        <span className="text-[10px] text-teal-600 font-semibold">
                          {patient.labs.length} fecha(s)
                        </span>
                      </div>
                      <pre className="p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-[10px] font-mono whitespace-pre-wrap leading-snug text-slate-800 dark:text-slate-200 max-h-36 overflow-y-auto">
                        {chronologicalLabsParagraphs || 'Sin laboratorios registrados.'}
                      </pre>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                          ESTUDIOS DE IMAGEN Y GABINETE: (Orden cronológico)
                        </span>
                        <span className="text-[10px] text-cyan-600 font-semibold">
                          {(patient.studies || []).length} estudio(s)
                        </span>
                      </div>
                      <pre className="p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-[10px] font-mono whitespace-pre-wrap leading-snug text-slate-800 dark:text-slate-200 max-h-36 overflow-y-auto">
                        {chronologicalStudiesParagraphs || 'Sin estudios de imagen registrados.'}
                      </pre>
                    </div>
                  </div>
                </div>

                {/* A - ANÁLISIS */}
                <div className="bg-slate-50/70 dark:bg-slate-950/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-md bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
                        A
                      </span>
                      <h3 className="text-xs sm:text-sm font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">
                        Análisis Clínico
                      </h3>
                      <InfoPopover
                        title="Análisis Clínico (NOM-004)"
                        content="Se incluye con el título ANÁLISIS: y al guardar o sincronizar actualiza el resumen de evolución del paciente en el Censo."
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyAnalysisFromYesterday}
                      className="text-xs font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-400 flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Usar Análisis Previo</span>
                    </button>
                  </div>

                  <textarea
                    rows={3}
                    value={problemAnalysis}
                    onChange={(e) => setProblemAnalysis(e.target.value)}
                    placeholder="Ejemplo NOM-004: Paciente en su 5° día de estancia intrahospitalaria que cursa con adecuada evolución clínica, estabilidad hemodinámica y remisión progresiva de respuesta inflamatoria sistémica. Se decide continuar esquema establecido y vigilar función renal..."
                    className="w-full text-xs sm:text-sm p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg leading-relaxed"
                  />
                </div>

                {/* P - INDICACIONES MÉDICAS INTEGRADAS */}
                <div className="bg-slate-50/70 dark:bg-slate-950/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3.5">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                        P
                      </span>
                      <h3 className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                        Plan e Indicaciones Médicas (Sincronizadas con Censo y Expediente)
                      </h3>
                      <InfoPopover
                        title="Indicaciones Sincronizadas"
                        content="Lo que modifiques en Dieta, Soluciones, Medicamentos/Antibióticos y Pendientes se formatea bajo INDICACIONES MÉDICAS: y se guarda en el Expediente, Censo Activo y Censo Imprimible."
                      />
                    </div>
                  </div>

                  {/* 1. DIETA + INDICACIONES ESPECIALES */}
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase">
                        1. Dieta (Tipo de dieta e indicaciones especiales)
                      </label>
                      <div className="flex flex-wrap items-center gap-1 text-[10px]">
                        {dietQuickPresets.map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setDietPlan(d)}
                            className="px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-500 cursor-pointer"
                          >
                            {d}
                          </button>
                        ))}
                        {onOpenSettings && (
                          <button
                            type="button"
                            onClick={() => onOpenSettings('templates')}
                            title="Personalizar opciones de dieta en Preferencias"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-emerald-500 text-slate-600 dark:text-slate-300 font-bold cursor-pointer"
                          >
                            <Settings className="w-3 h-3 text-emerald-600" />
                            <span>Editar dietas</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                          Tipo de dieta principal (- viñeta):
                        </span>
                        <input
                          type="text"
                          value={dietPlan}
                          onChange={(e) => setDietPlan(e.target.value)}
                          placeholder="Ej. Dieta para diabético 1800 kcal..."
                          className="w-full text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg font-medium"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                          Indicaciones especiales de la dieta (opcional, sub-línea indentada):
                        </span>
                        <input
                          type="text"
                          value={dietSpecialNotes}
                          onChange={(e) => setDietSpecialNotes(e.target.value)}
                          placeholder="Ej. Restricción de líquidos a 1200 ml/24h, asistir en la alimentación..."
                          className="w-full text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. SOLUCIONES Y TERAPIA PARENTERAL MÚLTIPLE (COMPACTA Y REORDENABLE) */}
                  <UnifiedSolutionsPanel
                    title="2. Soluciones y Terapia Parenteral / Infusiones"
                    solutions={structuredSolutions}
                    onChange={(nextSols) => setStructuredSolutions(nextSols)}
                  />

                  {/* 3. PANEL INTEGRADO DE MEDICAMENTOS, ANTIBIÓTICOS Y CURSOS CORTOS (REORDENABLE) */}
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Pill className="w-4 h-4 text-purple-600" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase">
                          3. Prescripciones: Antibióticos y Medicamentos ({localMedications.filter((m) => m.active).length})
                        </span>
                        <InfoPopover
                          title="Antibióticos vs Medicamentos por Tiempo Limitado"
                          content="Usa los botones para filtrar o clasificar entre Antibióticos (prioritarios en el pase, en morado con Día X/Y), Medicamentos por Tiempo Limitado como esteroides en cursos cortos (en ámbar con Día X/Y) y fármacos continuos."
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAddMedForm(!showAddMedForm)}
                        className="flex items-center gap-1 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Prescribir Fármaco</span>
                      </button>
                    </div>

                    {/* Botones de diferenciación rápida: Todos vs Solo Antibióticos vs Tiempo Limitado */}
                    {(() => {
                      const countAb = localMedications.filter((m) => m.isAntibiotic).length;
                      const countLim = localMedications.filter(
                        (m) =>
                          !m.isAntibiotic &&
                          Boolean(m.isLimitedCourse || (m.plannedDays && m.plannedDays > 0))
                      ).length;
                      return (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <button
                            type="button"
                            onClick={() => setMedCategoryFilter('all')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                              medCategoryFilter === 'all'
                                ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            Todos ({localMedications.length})
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setMedCategoryFilter(
                                medCategoryFilter === 'antibiotic' ? 'all' : 'antibiotic'
                              )
                            }
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1 transition-all cursor-pointer ${
                              medCategoryFilter === 'antibiotic'
                                ? 'bg-purple-600 text-white border-purple-700'
                                : 'bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-800'
                            }`}
                          >
                            <Pill className="w-3 h-3 shrink-0" />
                            <span>Solo Antibióticos ({countAb})</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setMedCategoryFilter(
                                medCategoryFilter === 'limited' ? 'all' : 'limited'
                              )
                            }
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1 transition-all cursor-pointer ${
                              medCategoryFilter === 'limited'
                                ? 'bg-amber-600 text-white border-amber-700'
                                : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800'
                            }`}
                          >
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>Tiempo Limitado / Curso Corto ({countLim})</span>
                          </button>
                        </div>
                      );
                    })()}

                    {/* Inline Form to Add Medication/Antibiotic/Limited Course */}
                    {showAddMedForm && (
                      <form
                        onSubmit={handleAddMedicationInline}
                        className="p-3 bg-purple-50/60 dark:bg-slate-800/80 rounded-xl border border-purple-200 dark:border-purple-800/60 space-y-2.5 text-xs"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-slate-700 dark:text-slate-200 mr-1">
                            Clasificación:
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setNewMedCourseType('antibiotic');
                              setNewMedPlannedDays('7');
                            }}
                            className={`px-2.5 py-1 rounded-lg font-bold border flex items-center gap-1 cursor-pointer ${
                              newMedCourseType === 'antibiotic'
                                ? 'bg-purple-600 text-white border-purple-700'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            <Pill className="w-3.5 h-3.5" />
                            <span>💊 Antibiótico (ATB)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewMedCourseType('limited');
                              setNewMedPlannedDays('5');
                            }}
                            className={`px-2.5 py-1 rounded-lg font-bold border flex items-center gap-1 cursor-pointer ${
                              newMedCourseType === 'limited'
                                ? 'bg-amber-600 text-white border-amber-700'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>⏳ Tiempo Limitado (Ej. Esteroide)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewMedCourseType('continuous')}
                            className={`px-2.5 py-1 rounded-lg font-bold border flex items-center gap-1 cursor-pointer ${
                              newMedCourseType === 'continuous'
                                ? 'bg-teal-600 text-white border-teal-700'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            <span>Continuo / Base</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <div className="sm:col-span-2">
                            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                              Fármaco *
                            </label>
                            <input
                              type="text"
                              value={newMedName}
                              onChange={(e) => setNewMedName(e.target.value)}
                              placeholder={
                                newMedCourseType === 'antibiotic'
                                  ? 'ej. Meropenem, Ceftriaxona'
                                  : newMedCourseType === 'limited'
                                  ? 'ej. Dexametasona, Metilprednisolona'
                                  : 'ej. Enoxaparina, Omeprazol'
                              }
                              className="w-full px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                              required
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                              Dosis *
                            </label>
                            <input
                              type="text"
                              value={newMedDose}
                              onChange={(e) => setNewMedDose(e.target.value)}
                              placeholder="ej. 1 g, 40 mg"
                              className="w-full px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                              required
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                Vía y Horario
                              </label>
                              {onOpenSettings && (
                                <button
                                  type="button"
                                  onClick={() => onOpenSettings('templates')}
                                  title="Personalizar catálogo de vías de administración en Preferencias"
                                  className="text-[10px] text-purple-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                                >
                                  <Settings className="w-3 h-3" />
                                  <span>Vías</span>
                                </button>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <select
                                value={newMedRoute}
                                onChange={(e) => setNewMedRoute(e.target.value)}
                                className="px-1.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-xs max-w-[115px]"
                              >
                                {medicationRoutesList.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                value={newMedFreq}
                                onChange={(e) => setNewMedFreq(e.target.value)}
                                placeholder="cada 8 hrs"
                                className="flex-1 min-w-0 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-xs"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          {(newMedCourseType === 'antibiotic' || newMedCourseType === 'limited') ? (
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                                  Inicio (FI):
                                </span>
                                <input
                                  type="date"
                                  value={newMedStartDate}
                                  onChange={(e) => setNewMedStartDate(e.target.value)}
                                  className="px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                                  Días programados:
                                </span>
                                <input
                                  type="number"
                                  min={1}
                                  max={90}
                                  value={newMedPlannedDays}
                                  onChange={(e) => setNewMedPlannedDays(e.target.value)}
                                  className="w-16 px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">
                              Medicamento continuo (sin conteo de días)
                            </span>
                          )}

                          <div className="flex items-center gap-2 ml-auto">
                            <button
                              type="button"
                              onClick={() => setShowAddMedForm(false)}
                              className="px-2.5 py-1 text-slate-500 hover:text-slate-700 text-xs cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-md font-bold text-xs cursor-pointer"
                            >
                              Guardar Fármaco
                            </button>
                          </div>
                        </div>
                      </form>
                    )}

                    {/* Active & Suspended Medications Rows with Drag-and-Drop Reordering */}
                    {localMedications.length > 0 ? (
                      <div className="space-y-1.5">
                        {localMedications
                          .filter((m) => {
                            const isLim =
                              !m.isAntibiotic &&
                              Boolean(m.isLimitedCourse || (m.plannedDays && m.plannedDays > 0));
                            if (medCategoryFilter === 'antibiotic') return m.isAntibiotic;
                            if (medCategoryFilter === 'limited') return isLim;
                            return true;
                          })
                          .map((m, idx) => {
                            const isLim =
                              !m.isAntibiotic &&
                              Boolean(m.isLimitedCourse || (m.plannedDays && m.plannedDays > 0));
                            const dayInfo =
                              m.isAntibiotic || isLim
                                ? calculateAntibioticDay(m.startDate, m.plannedDays)
                                : null;
                            return (
                              <div
                                key={m.id}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  if (draggedMedIdx !== null && draggedMedIdx !== idx) {
                                    handleMoveMedication(draggedMedIdx, idx);
                                  }
                                  setDraggedMedIdx(null);
                                }}
                                className={`px-2.5 py-1.5 rounded-lg border flex flex-wrap items-center justify-between gap-2 text-xs ${
                                  !m.active
                                    ? 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 opacity-50 line-through'
                                    : m.isAntibiotic
                                    ? 'bg-purple-50/60 dark:bg-purple-950/30 border-purple-300 dark:border-purple-800'
                                    : isLim
                                    ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                                    : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span
                                    draggable
                                    onDragStart={() => setDraggedMedIdx(idx)}
                                    onDragEnd={() => setDraggedMedIdx(null)}
                                    className="cursor-grab active:cursor-grabbing shrink-0"
                                  >
                                    <GripVertical className="w-3.5 h-3.5 text-slate-400" />
                                  </span>
                                  <input
                                    type="checkbox"
                                    checked={m.active}
                                    onChange={() => handleToggleMedicationActive(m.id)}
                                    className="rounded text-teal-600 shrink-0 cursor-pointer"
                                  />
                                  <div className="truncate">
                                    <span className="font-bold text-slate-900 dark:text-white">
                                      {m.name}
                                    </span>{' '}
                                    <span className="text-slate-600 dark:text-slate-300">
                                      {m.dose} {m.route} {m.frequency}
                                    </span>
                                    {dayInfo && (
                                      <span
                                        className={`ml-1.5 px-1.5 py-0.5 text-white rounded text-[11px] font-mono font-bold ${
                                          m.isAntibiotic ? 'bg-purple-600' : 'bg-amber-600'
                                        }`}
                                      >
                                        {m.isAntibiotic ? 'ATB ' : '⏳ '}
                                        {dayInfo.displayString}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <div className="inline-flex rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 text-[10px]">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSetMedicationCourseTypeInline(m.id, 'antibiotic')
                                      }
                                      className={`px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                                        m.isAntibiotic
                                          ? 'bg-purple-600 text-white'
                                          : 'text-slate-500 hover:text-purple-600'
                                      }`}
                                      title="Clasificar como Antibiótico"
                                    >
                                      ATB
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSetMedicationCourseTypeInline(m.id, 'limited')
                                      }
                                      className={`px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                                        isLim
                                          ? 'bg-amber-600 text-white'
                                          : 'text-slate-500 hover:text-amber-600'
                                      }`}
                                      title="Clasificar como Medicamento por Tiempo Limitado (Curso Corto)"
                                    >
                                      Tiempo Lim.
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSetMedicationCourseTypeInline(m.id, 'continuous')
                                      }
                                      className={`px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                                        !m.isAntibiotic && !isLim
                                          ? 'bg-slate-800 text-white dark:bg-slate-700'
                                          : 'text-slate-500 hover:text-slate-800'
                                      }`}
                                      title="Clasificar como Continuo"
                                    >
                                      Cont.
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveMedication(idx, idx - 1)}
                                    disabled={idx === 0}
                                    className="p-0.5 text-slate-400 hover:text-purple-600 disabled:opacity-30 cursor-pointer"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveMedication(idx, idx + 1)}
                                    disabled={idx === localMedications.length - 1}
                                    className="p-0.5 text-slate-400 hover:text-purple-600 disabled:opacity-30 cursor-pointer"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMedicationInline(m.id)}
                                    className="text-slate-400 hover:text-rose-600 p-0.5 shrink-0 cursor-pointer"
                                    title="Eliminar medicamento"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        No hay medicamentos registrados. Agrega uno arriba o edita el texto inferior.
                      </p>
                    )}

                    {/* Direct editable list of medications that goes into the numbered INDICACIONES MÉDICAS */}
                    <textarea
                      rows={2}
                      value={medicationsPlan}
                      onChange={(e) => setMedicationsPlan(e.target.value)}
                      placeholder="Lista de medicamentos con dosis, vía y horario..."
                      className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg font-mono leading-snug"
                    />
                  </div>

                  {/* 4. INDICACIONES DE ENFERMERÍA (PANEL COMPACTO UNIFICADO CON BARRITAS, REORDENAMIENTO, NOTAS Y TUERCA DE PREFERENCIAS) */}
                  <UnifiedNursingOrdersPanel
                    title="4. Indicaciones de Enfermería y Medidas Generales"
                    subtitle="Sincronizadas con Expediente y Censo"
                    orders={structuredNursingOrders}
                    nursingRepository={nursingRepository}
                    onChange={(nextStructured) => setStructuredNursingOrders(nextStructured)}
                    onOpenSettings={(tab) => onOpenSettings && onOpenSettings((tab as SettingsTabKey) || 'nursing')}
                  />

                  {/* 5. PANEL INTEGRADO DE PENDIENTES DEL TURNO (Sincronizado con Censo Activo, Imprimible y Expediente) */}
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <ClipboardList className="w-4 h-4 text-emerald-600" />
                        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase">
                          5. Pendientes del Turno y Contingencias ({localPendings.filter((p) => !p.completed).length} activos)
                        </span>
                        <span className="text-[10px] text-slate-500">
                          (Se sincronizan con Censo y Hoja de Guardia)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAddPendingForm(!showAddPendingForm)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Agregar Pendiente</span>
                      </button>
                    </div>

                    {showAddPendingForm && (
                      <form
                        onSubmit={handleAddPendingInline}
                        className="p-2.5 bg-emerald-50/60 dark:bg-slate-800/80 rounded-xl border border-emerald-200 dark:border-emerald-800/60 flex flex-wrap items-center gap-2 text-xs"
                      >
                        <input
                          type="text"
                          value={newPendingText}
                          onChange={(e) => setNewPendingText(e.target.value)}
                          placeholder="ej. Recabar cultivo de expectoración, Valoración por Nefrología..."
                          className="flex-1 min-w-[200px] px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                          required
                        />
                        <select
                          value={newPendingCategory}
                          onChange={(e: any) => setNewPendingCategory(e.target.value)}
                          className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-[11px]"
                        >
                          <option value="Laboratorio">Laboratorio</option>
                          <option value="Imagen/Gabinete">Imagen/Gabinete</option>
                          <option value="Interconsulta">Interconsulta</option>
                          <option value="Procedimiento">Procedimiento</option>
                          <option value="Familiar/Alta">Familiar/Alta</option>
                        </select>
                        <select
                          value={newPendingPriority}
                          onChange={(e: any) => setNewPendingPriority(e.target.value)}
                          className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-[11px]"
                        >
                          <option value="Alta">Prioridad Alta</option>
                          <option value="Media">Prioridad Media</option>
                          <option value="Baja">Prioridad Baja</option>
                        </select>
                        <button
                          type="submit"
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold text-[11px] cursor-pointer"
                        >
                          Añadir
                        </button>
                      </form>
                    )}

                    {localPendings.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {localPendings.map((pen) => (
                          <div
                            key={pen.id}
                            className={`px-2.5 py-1 rounded-lg border flex items-center justify-between gap-2 text-xs ${
                              pen.completed
                                ? 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 opacity-50 line-through'
                                : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <label className="flex items-center gap-2 cursor-pointer truncate flex-1">
                              <input
                                type="checkbox"
                                checked={pen.completed}
                                onChange={() => handleTogglePendingInline(pen.id)}
                                className="rounded text-emerald-600 shrink-0"
                              />
                              <span className="truncate font-medium">{pen.text}</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => handleDeletePendingInline(pen.id)}
                              className="text-slate-400 hover:text-rose-600 p-0.5 shrink-0"
                              title="Eliminar pendiente"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <input
                      type="text"
                      value={pendingsPlan}
                      onChange={(e) => setPendingsPlan(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                    />
                  </div>
                </div>

                {/* MÉDICO QUE ELABORA LA NOTA */}
                <div className="bg-slate-50/70 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs">
                    <User className="w-4 h-4 text-teal-600" />
                    <span>Elabora Nota de Evolución:</span>
                  </div>
                  <input
                    type="text"
                    value={residentAuthor}
                    onChange={(e) => setResidentAuthor(e.target.value)}
                    placeholder="Nombre del médico residente o interno que elabora la nota..."
                    className="flex-1 min-w-[240px] text-xs px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold"
                  />
                </div>
              </div>
            ) : (
              /* TAB CONTENT 2: Institutional Preview (Ready to copy) */
              <div className="flex-1 overflow-y-auto p-5 flex flex-col justify-between space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Nota de Evolución Institucional (En Prosa)
                    </span>
                    <InfoPopover
                      title="Nota Institucional Lista para Copiar"
                      content="Sin ficha de identificación ni títulos en párrafos iniciales; signos vitales corridos al inicio de la exploración física; paraclínicos cronológicos separados por comas; indicaciones en lista numerada sin renglones vacíos."
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleGenerateWithAi}
                      disabled={isLoadingAi}
                      className="flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white px-3 py-1.5 rounded-lg shadow-xs transition-all disabled:opacity-50"
                    >
                      {isLoadingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      <span>Pulir con IA</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleProofread}
                      disabled={isProofreading || !finalNoteText}
                      className="flex items-center gap-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isProofreading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 text-teal-500" />}
                      <span>Corregir Ortografía</span>
                    </button>
                  </div>
                </div>

                {aiError && (
                  <div className="p-2 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{aiError}</span>
                  </div>
                )}

                <div className="flex-1 min-h-[380px] flex flex-col">
                  <textarea
                    value={finalNoteText}
                    onChange={(e) => setFinalNoteText(e.target.value)}
                    className="w-full flex-1 p-3.5 font-mono text-[11.5px] leading-relaxed bg-slate-900 text-slate-100 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none selection:bg-teal-700"
                  />
                </div>
              </div>
            )}

            {/* Bottom Actions Bar */}
            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cerrar al Censo
                </button>

                {onBackToExpediente && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onUpdatePatient) onUpdatePatient(buildUpdatedPatientObject());
                      onBackToExpediente(buildUpdatedPatientObject());
                    }}
                    className="px-3.5 py-2 bg-teal-50 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-800 text-teal-800 dark:text-teal-300 hover:bg-teal-100 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Regresar al Expediente</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSaveToVault}
                  disabled={isSaving || !finalNoteText}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    saveSuccess
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                  }`}
                  title="Guarda la nota en la bóveda y actualiza automáticamente Diagnósticos, Dieta, Soluciones, Medicamentos y Pendientes en el Censo y Expediente"
                >
                  <ShieldCheck className={`w-4 h-4 ${saveSuccess ? 'text-white' : 'text-emerald-500'}`} />
                  <span>
                    {saveSuccess
                      ? '¡Nota Guardada y Censo Actualizado!'
                      : 'Guardar Nota y Actualizar Todo el Censo'}
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveSideTab('preview');
                    handleCopy();
                  }}
                  disabled={!finalNoteText}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer ${
                    isCopied
                      ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                      : 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-500/20 hover:scale-[1.02]'
                  }`}
                >
                  {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>
                    {isCopied
                      ? '¡Copiado y Censo Sincronizado!'
                      : 'Copiar para Sistema y Sincronizar'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
