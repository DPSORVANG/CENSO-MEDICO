import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  Save,
  Zap,
  BookOpen,
  Copy,
  Check,
  Stethoscope,
  User,
  ArrowLeft,
  Plus,
  Settings,
  AlertTriangle,
  Trash2,
  Pill,
  ClipboardList,
} from 'lucide-react';
import {
  Patient,
  ServiceType,
  SeverityType,
  CodeStatusType,
  NomClinicalHistory,
  ResidentProfile,
  MedicationItem,
  PatientNursingOrderItem,
  ParenteralSolutionItem,
} from '../types/clinical.ts';
import {
  buildNomClinicalHistoryNote,
  DEFAULT_DIET_PRESETS,
  DEFAULT_MEDICATION_ROUTES,
  DEFAULT_AHF_PRESETS,
  DEFAULT_APNP_PRESETS,
  DEFAULT_APP_PRESETS,
} from '../utils/clinicalLogic.ts';
import {
  defaultServicesCatalog,
  defaultAttendingPhysicians,
  defaultAvailableTags,
  defaultNursingRepository,
} from '../data/seedPatients.ts';
import { InfoPopover } from './InfoPopover.tsx';
import { DiagnosisListEditor } from './DiagnosisListEditor.tsx';
import { SettingsTabKey } from './GlobalSettingsModal.tsx';
import {
  UnifiedNursingOrdersPanel,
  normalizeNursingOrdersToStructured,
} from './UnifiedNursingOrdersPanel.tsx';
import {
  UnifiedSolutionsPanel,
  formatSolutionsSummaryString,
  normalizeSolutionsFromPatient,
} from './UnifiedSolutionsPanel.tsx';

interface PatientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (patient: Patient, generatedHistoryText?: string) => void;
  initialPatient?: Patient | null;
  profile?: ResidentProfile;
  onBackToExpediente?: (patient: Patient) => void;
  onAddNewTagToCatalog?: (newTag: string) => void;
  onOpenSettings?: (tab?: SettingsTabKey) => void;
}

export const PatientFormModal: React.FC<PatientFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialPatient,
  profile,
  onBackToExpediente,
  onAddNewTagToCatalog,
  onOpenSettings,
}) => {
  if (!isOpen) return null;

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

  const availableServices = (profile?.servicesCatalog && profile.servicesCatalog.length > 0)
    ? profile.servicesCatalog
    : defaultServicesCatalog;

  const availableDoctors =
    profile?.attendingPhysicians && profile.attendingPhysicians.length > 0
      ? profile.attendingPhysicians.map((d) => d.name)
      : profile?.attendingPhysiciansCatalog && profile.attendingPhysiciansCatalog.length > 0
      ? profile.attendingPhysiciansCatalog
      : defaultAttendingPhysicians;

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

  const ahfPresetsList =
    profile?.ahfPresets && profile.ahfPresets.length > 0
      ? profile.ahfPresets
      : DEFAULT_AHF_PRESETS;

  const apnpPresetsList =
    profile?.apnpPresets && profile.apnpPresets.length > 0
      ? profile.apnpPresets
      : DEFAULT_APNP_PRESETS;

  const appPresetsList =
    profile?.appPresets && profile.appPresets.length > 0
      ? profile.appPresets
      : DEFAULT_APP_PRESETS;

  // Mode: Express / Quick Admission vs Complete NOM-004 Clinical History
  const [mode, setMode] = useState<'express' | 'nom-history'>('express');
  const [historyTab, setHistoryTab] = useState<'ficha-ahf' | 'padecimiento-ipas' | 'exploracion' | 'diagnostico-plan' | 'preview'>('ficha-ahf');

  // Validation state
  const [submittedAttempt, setSubmittedAttempt] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Basic Patient Info
  const [name, setName] = useState(initialPatient?.name || '');
  const [bed, setBed] = useState(initialPatient?.bed || '');
  const [recordNumber, setRecordNumber] = useState(
    initialPatient?.recordNumber || `EXP-${Math.floor(100000 + Math.random() * 900000)}`
  );
  const [service, setService] = useState<ServiceType>(
    initialPatient?.service || 'Medicina Interna Piso 3'
  );
  const [attendingPhysician, setAttendingPhysician] = useState<string>(
    initialPatient?.attendingPhysician || availableDoctors[0] || ''
  );
  const [age, setAge] = useState<string>(initialPatient?.age ? String(initialPatient.age) : '55');
  const [gender, setGender] = useState<'Masculino' | 'Femenino'>(
    initialPatient?.gender || 'Masculino'
  );
  const [admissionDate, setAdmissionDate] = useState(
    initialPatient?.admissionDate || new Date().toISOString().split('T')[0]
  );
  const [severity, setSeverity] = useState<SeverityType>(
    initialPatient?.severity || 'Delicado'
  );
  const [codeStatus, setCodeStatus] = useState<CodeStatusType>(
    initialPatient?.codeStatus || 'RCP 1 (Reanimación Completa / Todo esfuerzo)'
  );
  const [clinicalTags, setClinicalTags] = useState<string[]>(
    initialPatient?.clinicalTags || []
  );
  const [newTagInput, setNewTagInput] = useState<string>('');
  const [admissionReason, setAdmissionReason] = useState<string>(
    initialPatient?.admissionReason || ''
  );
  const [relevantHistory, setRelevantHistory] = useState<string>(
    initialPatient?.relevantHistory || ''
  );
  const [allergies, setAllergies] = useState(initialPatient?.allergies || 'Negadas');
  const [diagnosesText, setDiagnosesText] = useState<string>(
    (initialPatient?.initialDiagnoses || initialPatient?.diagnoses)?.join('\n') || '1. '
  );

  const mergedAvailableTags = Array.from(
    new Set([...defaultAvailableTags, ...(profile?.availableTags || []), ...clinicalTags])
  );

  // Vitals & Somatometry
  const [bp, setBp] = useState(initialPatient?.vitals?.bp || '120/80');
  const [hr, setHr] = useState(initialPatient?.vitals?.hr || '75');
  const [rr, setRr] = useState(initialPatient?.vitals?.rr || '18');
  const [temp, setTemp] = useState(initialPatient?.vitals?.temp || '36.5');
  const [spo2, setSpo2] = useState(initialPatient?.vitals?.spo2 || '96');
  const [glucose, setGlucose] = useState(initialPatient?.vitals?.glucose || '110');
  const [weightKg, setWeightKg] = useState<string>(
    initialPatient?.vitals?.weightKg ? String(initialPatient.vitals.weightKg) : '70'
  );
  const [heightCm, setHeightCm] = useState<string>('165');

  // Initial Express Labs
  const [quickHb, setQuickHb] = useState('');
  const [quickLeucos, setQuickLeucos] = useState('');
  const [quickPlq, setQuickPlq] = useState('');
  const [quickCr, setQuickCr] = useState('');
  const [quickGluc, setQuickGluc] = useState('');

  // Admission Medications Builder (Separated Dose, Route, Frequency, Type & Days)
  const [admissionMedsList, setAdmissionMedsList] = useState<MedicationItem[]>(
    initialPatient?.medications ? [...initialPatient.medications] : []
  );
  const [quickAbName, setQuickAbName] = useState('');
  const [quickAbDose, setQuickAbDose] = useState('');
  const [quickAbRoute, setQuickAbRoute] = useState('IV');
  const [quickAbFreq, setQuickAbFreq] = useState('cada 24 hrs');
  const [quickAbCourseType, setQuickAbCourseType] = useState<'antibiotic' | 'limited' | 'continuous'>('antibiotic');
  const [quickAbDays, setQuickAbDays] = useState('7');

  // Synchronized Admission Indications (Diet, Parenteral Solutions, Nursing Orders)
  // Uses initial* admission base fields when editing an existing patient's admission so active evolution changes don't overwrite the admission base
  const [admissionDiet, setAdmissionDiet] = useState<string>(
    initialPatient?.initialDiet ?? initialPatient?.diet ?? ''
  );
  const [admissionDietSpecialNotes, setAdmissionDietSpecialNotes] = useState<string>(
    initialPatient?.initialDietSpecialNotes ?? initialPatient?.dietSpecialNotes ?? ''
  );
  const [admissionStructuredSolutions, setAdmissionStructuredSolutions] = useState<
    ParenteralSolutionItem[]
  >(() =>
    normalizeSolutionsFromPatient(
      initialPatient?.initialStructuredSolutions ?? initialPatient?.structuredSolutions,
      initialPatient?.initialIvFluids ?? initialPatient?.ivFluids
    )
  );
  const [admissionStructuredNursingOrders, setAdmissionStructuredNursingOrders] = useState<
    PatientNursingOrderItem[]
  >(() =>
    normalizeNursingOrdersToStructured(
      initialPatient?.initialStructuredNursingOrders ?? initialPatient?.structuredNursingOrders,
      initialPatient?.initialNursingOrders ?? initialPatient?.nursingOrders
    )
  );

  // NOM-004 Specific Fields
  const [maritalStatus, setMaritalStatus] = useState('Casado(a)');
  const [occupation, setOccupation] = useState('Empleado');
  const [education, setEducation] = useState('Secundaria completa');
  const [origin, setOrigin] = useState('Ciudad de México');
  const [residence, setResidence] = useState('Ciudad de México');
  const [religion, setReligion] = useState('Católica');
  const [interrogationType, setInterrogationType] = useState<'Directo' | 'Indirecto' | 'Mixto'>('Directo');

  // AHF, APNP, APP
  const [ahf, setAhf] = useState(
    'Padre finado por complicaciones de Diabetes Mellitus tipo 2. Madre viva de 78 años con Hipertensión Arterial Sistémica en tratamiento. Hermanos con carga metabólica positiva. Niega antecedentes familiares de neoplasias o nefropatías tempranas.'
  );
  const [apnp, setApnp] = useState(
    'Habitación de tipo urbano con construcción de materiales perdurables, cuenta con todos los servicios intra y extradomiciliarios (agua potable, luz, drenaje). Hacinamiento y fecalismo negativos. Zoonosis negativa. Tabaquismo negativo. Alcoholismo ocasional social sin llegar a la embriaguez. Alimentación adecuada en cantidad y calidad. Esquema de vacunación refiere completo.'
  );
  const [app, setApp] = useState(
    'Crónico-degenerativos: Diabetes Mellitus tipo 2 de 8 años de evolución en manejo irregular con Metformina 850mg c/12h. Hipertensión Arterial Sistémica de 5 años en manejo con Losartán 50mg c/12h. Quirúrgicos: Apendicectomía a los 22 años sin complicaciones. Traumáticos: Negados. Transfusionales: Negados. Alérgicos: Negados. Hospitalizaciones previas: Negadas.'
  );

  // Padecimiento Actual & IPAS
  const [currentIllness, setCurrentIllness] = useState(
    'Inicia su padecimiento actual hace 5 días de evolución caracterizado por astenia, adinamia y malestar general. Posteriormente se agrega alza térmica no cuantificada acompañada de accesos de tos con expectoración mucopurulenta y disnea progresiva de medianos a pequeños esfuerzos. Acude a valoración donde se decide su ingreso al servicio de Medicina Interna.'
  );
  const [ipas, setIpas] = useState(
    'Respiratorio: Tos productiva referida en padecimiento actual. Cardiovascular: Niega palpitaciones, dolor precordial o edemas previos. Gastrointestinal: Adecuada tolerancia digestiva, evacuaciones normales. Genitourinario: Sin disuria ni tenesmo. Neurológico: Sin cefalea, convulsiones ni pérdida de estado de alerta. Músculo-esquelético: Sin artralgias. Piel: Sin lesiones exantemáticas activas.'
  );

  // Exploración Física NOM-004
  const [physicalExamNom, setPhysicalExamNom] = useState(
    'Habitus exterior: Paciente de edad aparente concuerda con la cronológica, íntegro, biotipo normolíneo, orientado en sus 3 esferas, sin facies característica, posición pasiva libremente escogida, bien hidratado, coloración mucotegumentaria adecuada.\nCabeza y cuello: Normocéfalo, pupilas isocóricas y normorreactivas a la luz, faringe sin exudados, cuello cilíndrico, tráquea central y desplazable, pulsos carotídeos simétricos sin soplos, sin ingurgitación yugular.\nTórax y Cardiopulmonar: Caja torácica simétrica con adecuada amplexión y amplexación. Ruidos cardíacos rítmicos de buena intensidad, no se auscultan soplos ni ruidos agregados. Campos pulmonares con murmullo vesicular presente bilateralmente, con estertores crepitantes subcrepitantes basales en hemitórax derecho.\nAbdomen: Blando, depresible, no doloroso a la palpación media ni profunda, sin visceromegalias palpables, peristalsis normoaudible en los cuatro cuadrantes, sin datos de irritación peritoneal ni rebote.\nExtremidades: Eutróficas, simétricas, arcos de movilidad conservados, sin edema periférico, pulsos periféricos distales (radiales, pedios) presentes y de intensidad simétrica, llenado capilar distal 2 segundos.\nNeurológico: Funciones mentales superiores íntegras, pares craneales sin alteraciones evidentes, fuerza muscular 5/5 en las cuatro extremidades, sensibilidad superficial y profunda conservada, reflejos osteotendinosos simétricos, sin signos meníngeos ni datos de focalización motora.'
  );

  // Paraclínicos y Gabinete de Ingreso
  const [initialLabsText, setInitialLabsText] = useState(
    'BH: Hb 13.4 g/dL, Hto 40.2%, Leucocitos 13,800/uL (Neu 82%, Linf 12%), Plaquetas 245,000/uL.\nQS: Glucosa 168 mg/dL, Urea 38 mg/dL, BUN 17.7 mg/dL, Creatinina 1.0 mg/dL.\nES: Na 138 mEq/L, K 4.1 mEq/L, Cl 101 mEq/L.\nRadiografía de tórax PA: Infiltrado de aspecto alveolar consolidativo en base pulmonar derecha con broncograma aéreo, compatible con foco neumónico. Silueta cardiaca dentro de límites normales.'
  );

  // Análisis e Integración Clínica (MIP / Residente) antes del Plan
  const [clinicalAnalysis, setClinicalAnalysis] = useState(
    initialPatient?.clinicalHistory?.clinicalAnalysis ||
      'Paciente que ingresa al servicio de Medicina Interna por cuadro clínico y paraclínico compatible con los diagnósticos establecidos. Se inicia protocolo de estudio etiológico, estabilización hemodinámica y metabólica, así como vigilancia estrecha de datos de alarma.'
  );

  // Impresión Diagnóstica y Pronóstico
  const [diagnosticImpression, setDiagnosticImpression] = useState<string>(
    initialPatient?.clinicalHistory?.diagnosticImpression ||
      (initialPatient?.initialDiagnoses || initialPatient?.diagnoses)?.join('\n') ||
      '1. Neumonía adquirida en la comunidad (CURB-65 2 puntos)\n2. Diabetes Mellitus tipo 2 en descontrol metabólico agudo secundario a proceso infeccioso\n3. Hipertensión Arterial Sistémica estadio 1 controlada'
  );
  const [prognosisLife, setPrognosisLife] = useState(
    initialPatient?.clinicalHistory?.prognosisLife || 'Reservado a evolución intrahospitalaria'
  );
  const [prognosisFunction, setPrognosisFunction] = useState(
    initialPatient?.clinicalHistory?.prognosisFunction || 'Reservado a evolución'
  );
  const [admissionPlan, setAdmissionPlan] = useState(
    initialPatient?.clinicalHistory?.admissionPlan ||
      '1. Dieta para diabético (1800 kcal) normosódica fraccionada en 3 tomas.\n2. Solución Fisiológica 0.9% 1000 cc para 24 hrs IV a 42 ml/h.\n3. Ceftriaxona 2 g IV cada 24 hrs [Día 1/7].\n4. Claritromicina 500 mg IV cada 12 hrs [Día 1/7].\n5. Insulina Lispro según esquema preprandial.\n6. Enoxaparina 40 mg SC cada 24 hrs (tromboprofilaxis).\n7. Medidas generales y vigilancia de datos de alarma respiratoria.'
  );

  // Author attribution directly editable in the Clinical History form
  const [doctorAuthor, setDoctorAuthor] = useState(
    initialPatient?.clinicalHistory?.authorName ||
      profile?.name ||
      'Médico Residente / Interno'
  );

  const [isCopied, setIsCopied] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCopySection = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedSection(key);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  // Add draft medication to admissionMedsList
  const handleAddDraftMedication = () => {
    if (!quickAbName.trim()) return;
    const isAb = quickAbCourseType === 'antibiotic';
    const isLim = quickAbCourseType === 'limited';
    const newMed: MedicationItem = {
      id: `med-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: quickAbName.trim(),
      dose: quickAbDose.trim() || 'Dosis indicada',
      route: (quickAbRoute || 'IV') as MedicationItem['route'],
      frequency: quickAbFreq.trim() || 'cada 24 hrs',
      isAntibiotic: isAb,
      isLimitedCourse: isLim,
      startDate: admissionDate,
      plannedDays: isAb || isLim ? parseInt(quickAbDays, 10) || 7 : undefined,
      indication: 'Ingreso hospitalario',
      active: true,
    };
    setAdmissionMedsList((prev) => [...prev, newMed]);
    setQuickAbName('');
    setQuickAbDose('');
  };

  const handleRemoveAdmissionMed = (medId: string) => {
    setAdmissionMedsList((prev) => prev.filter((m) => m.id !== medId));
  };

  // Synchronize structured admission indications into NOM-004 admissionPlan text
  const handleSyncIndicationsToNomPlan = () => {
    const blocks: string[] = [];
    if (admissionDiet.trim() || admissionDietSpecialNotes.trim()) {
      const dietLine = [
        admissionDiet.trim(),
        admissionDietSpecialNotes.trim()
          ? `(Indicaciones especiales: ${admissionDietSpecialNotes.trim()})`
          : '',
      ]
        .filter(Boolean)
        .join(' ');
      blocks.push(`1. DIETA E HIDRATACIÓN ENTERAL: ${dietLine}`);
    }
    const solutionsSummary = formatSolutionsSummaryString(admissionStructuredSolutions);
    if (solutionsSummary.trim()) {
      blocks.push(`2. SOLUCIONES PARENTERALES: ${solutionsSummary.trim()}`);
    }
    const allMeds = [...admissionMedsList];
    if (quickAbName.trim()) {
      allMeds.push({
        id: 'temp',
        name: quickAbName.trim(),
        dose: quickAbDose.trim() || 'Dosis indicada',
        route: (quickAbRoute || 'IV') as MedicationItem['route'],
        frequency: quickAbFreq.trim() || 'cada 24 hrs',
        isAntibiotic: quickAbCourseType === 'antibiotic',
        isLimitedCourse: quickAbCourseType === 'limited',
        startDate: admissionDate,
        plannedDays:
          quickAbCourseType === 'antibiotic' || quickAbCourseType === 'limited'
            ? parseInt(quickAbDays, 10) || 7
            : undefined,
        active: true,
      });
    }
    if (allMeds.length > 0) {
      const medLines = allMeds.map(
        (m, idx) =>
          `   ${idx + 1}) ${m.name} — ${m.dose} ${m.route} ${m.frequency}${
            (m.isAntibiotic || m.isLimitedCourse) && m.plannedDays ? ` [Día 1/${m.plannedDays}]` : ''
          }`
      );
      blocks.push(`3. ESQUEMA FARMACOLÓGICO:\n${medLines.join('\n')}`);
    }
    const validNursing = admissionStructuredNursingOrders.filter((o) => o.text.trim());
    if (validNursing.length > 0) {
      const nursingLines = validNursing.map(
        (o, idx) =>
          `   ${idx + 1}) ${o.text.trim()}${
            o.note && o.note.trim() ? ` (${o.note.trim()})` : ''
          }`
      );
      blocks.push(`4. INDICACIONES DE ENFERMERÍA Y MEDIDAS GENERALES:\n${nursingLines.join('\n')}`);
    }
    if (blocks.length > 0) {
      setAdmissionPlan(blocks.join('\n\n'));
    }
  };

  // Calculate BMI
  const computedBmi = () => {
    const w = parseFloat(weightKg);
    const h = parseFloat(heightCm) / 100;
    if (w > 0 && h > 0) {
      return (w / (h * h)).toFixed(1);
    }
    return undefined;
  };

  // Generate full NOM-004 History text
  const generateNomText = () => {
    return buildNomClinicalHistoryNote({
      patient: {
        name,
        bed,
        service,
        age,
        gender,
        recordNumber,
        admissionDate,
        codeStatus,
        allergies,
      },
      history: {
        interrogationType,
        maritalStatus,
        occupation,
        education,
        origin,
        residence,
        religion,
        ahf,
        apnp,
        app,
        currentIllness,
        ipas,
        weightKg,
        heightCm,
        bmi: computedBmi(),
        physicalExamGeneral: physicalExamNom,
        initialLabsGabinete: initialLabsText,
        clinicalAnalysis,
        diagnosticImpression,
        prognosisLife,
        prognosisFunction,
        admissionPlan,
      },
      vitals: { bp, hr, rr, temp, spo2, glucose },
      residentName: doctorAuthor,
      hospitalName: profile?.hospital,
    });
  };

  const handleCopyHistory = async () => {
    const text = generateNomText();
    await navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  // Submit handler: validates required fields, normalizes diagnoses, and saves to database and censo
  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedAttempt(true);

    const missingFields: string[] = [];
    if (!name.trim()) missingFields.push('Nombre Completo del Paciente');
    if (!bed.trim()) missingFields.push('Cama Asignada');

    if (missingFields.length > 0) {
      setValidationError(
        `No se puede guardar el paciente porque faltan datos obligatorios: ${missingFields.join(
          ' y '
        )}. Por favor completa los campos marcados en rojo.`
      );
      if (mode === 'nom-history' && historyTab !== 'ficha-ahf') {
        setHistoryTab('ficha-ahf');
      }
      return;
    }

    setValidationError(null);

    const safeDiagString = Array.isArray(diagnosesText)
      ? (diagnosesText as string[]).join('\n')
      : String(diagnosesText || '');
    const safeImpressionString = Array.isArray(diagnosticImpression)
      ? (diagnosticImpression as string[]).join('\n')
      : String(diagnosticImpression || '');

    const rawDiagnosesList =
      mode === 'nom-history' && safeImpressionString.trim()
        ? safeImpressionString.split('\n')
        : safeDiagString.split('\n');

    const diagnosesList = rawDiagnosesList
      .map((d) => d.trim())
      .filter((d) => Boolean(d) && !/^\d+[.)]?$/.test(d));

    // Initial labs array
    const initialLabsArray = initialPatient?.labs ? [...initialPatient.labs] : [];
    if (quickHb || quickLeucos || quickPlq || quickCr || quickGluc) {
      initialLabsArray.unshift({
        id: `lab-${Date.now()}`,
        date: admissionDate,
        time: '08:00',
        hb: quickHb ? parseFloat(quickHb) : undefined,
        leucos: quickLeucos ? parseFloat(quickLeucos) : undefined,
        plaquetas: quickPlq ? parseFloat(quickPlq) : undefined,
        creatinina: quickCr ? parseFloat(quickCr) : undefined,
        glucosa: quickGluc ? parseFloat(quickGluc) : glucose ? parseFloat(glucose) : undefined,
      });
    }

    // Initial medications array (combines admissionMedsList + any unsaved draft in quickAbName)
    const initialMedsArray: MedicationItem[] = [...admissionMedsList];
    if (quickAbName.trim()) {
      const isAb = quickAbCourseType === 'antibiotic';
      const isLim = quickAbCourseType === 'limited';
      initialMedsArray.push({
        id: `med-${Date.now()}`,
        name: quickAbName.trim(),
        dose: quickAbDose.trim() || 'Dosis indicada',
        route: (quickAbRoute || 'IV') as MedicationItem['route'],
        frequency: quickAbFreq.trim() || 'cada 24 hrs',
        isAntibiotic: isAb,
        isLimitedCourse: isLim,
        startDate: admissionDate,
        plannedDays: isAb || isLim ? parseInt(quickAbDays, 10) || 7 : undefined,
        indication: diagnosesList[0] || 'Ingreso Medicina Interna',
        active: true,
      });
    }

    // Synchronize Nursing Orders & Solutions into both plain and structured lists
    const validStructuredNursing = admissionStructuredNursingOrders.filter((o) =>
      o.text.trim()
    );
    const cleanNursingLines = validStructuredNursing.map((o) =>
      o.note && o.note.trim() ? `${o.text.trim()} (${o.note.trim()})` : o.text.trim()
    );
    const syncedStructuredNursingOrders: PatientNursingOrderItem[] | undefined =
      validStructuredNursing.length > 0
        ? validStructuredNursing
        : initialPatient?.structuredNursingOrders;

    const validStructuredSolutions = admissionStructuredSolutions.filter(
      (s) => s.solutionType.trim() || (s.addedConcentrateOrMed && s.addedConcentrateOrMed.trim())
    );
    const computedAdmissionIvFluids = formatSolutionsSummaryString(validStructuredSolutions);

    const clinicalHistoryObj: NomClinicalHistory | undefined = mode === 'nom-history' ? {
      interrogationType,
      maritalStatus,
      occupation,
      education,
      origin,
      residence,
      religion,
      ahf,
      apnp,
      app,
      currentIllness,
      ipas,
      weightKg: parseFloat(weightKg) || undefined,
      heightCm: parseFloat(heightCm) || undefined,
      bmi: parseFloat(computedBmi() || '0') || undefined,
      physicalExamGeneral: physicalExamNom,
      initialLabsGabinete: initialLabsText,
      clinicalAnalysis,
      diagnosticImpression: safeImpressionString,
      prognosisLife,
      prognosisFunction,
      admissionPlan,
      authorName: doctorAuthor,
    } : initialPatient?.clinicalHistory;

    const finalInitialDiags =
      diagnosesList.length > 0 ? diagnosesList : ['1. Protocolo de estudio Medicina Interna'];

    // Preserve active evolved fields if the patient already evolved in progress notes;
    // only update active fields on initial admission or if active fields had not diverged from initial* base
    const hadEvolvedDiagnoses =
      initialPatient &&
      initialPatient.initialDiagnoses &&
      initialPatient.diagnoses.join('\n') !== initialPatient.initialDiagnoses.join('\n');

    const hadEvolvedDiet =
      initialPatient &&
      initialPatient.initialDiet !== undefined &&
      initialPatient.diet !== initialPatient.initialDiet;

    const hadEvolvedFluids =
      initialPatient &&
      initialPatient.initialIvFluids !== undefined &&
      initialPatient.ivFluids !== initialPatient.initialIvFluids;

    const hadEvolvedNursing =
      initialPatient &&
      initialPatient.initialNursingOrders !== undefined &&
      Array.isArray(initialPatient.nursingOrders) &&
      initialPatient.nursingOrders.join('\n') !== initialPatient.initialNursingOrders.join('\n');

    const patientRecord: Patient = {
      id: initialPatient ? initialPatient.id : `pat-${Date.now()}`,
      recordNumber: recordNumber.trim(),
      name: name.trim(),
      age: parseInt(age, 10) || 55,
      gender,
      bed: bed.trim(),
      service,
      attendingPhysician: attendingPhysician.trim() || undefined,
      admissionDate,
      status: initialPatient ? initialPatient.status : 'active',
      severity,
      codeStatus,
      admissionReason: admissionReason.trim() || undefined,
      relevantHistory: relevantHistory.trim() || undefined,
      allergies: allergies.trim() || 'Negadas',
      initialDiagnoses: finalInitialDiags,
      diagnoses: hadEvolvedDiagnoses ? initialPatient.diagnoses : finalInitialDiags,
      initialDiet: admissionDiet.trim() || initialPatient?.initialDiet || initialPatient?.diet,
      initialDietSpecialNotes:
        admissionDietSpecialNotes.trim() ||
        initialPatient?.initialDietSpecialNotes ||
        initialPatient?.dietSpecialNotes,
      diet: hadEvolvedDiet
        ? initialPatient.diet
        : admissionDiet.trim() || initialPatient?.diet,
      dietSpecialNotes: hadEvolvedDiet
        ? initialPatient.dietSpecialNotes
        : admissionDietSpecialNotes.trim() || initialPatient?.dietSpecialNotes,
      initialIvFluids:
        computedAdmissionIvFluids || initialPatient?.initialIvFluids || initialPatient?.ivFluids,
      initialStructuredSolutions:
        validStructuredSolutions.length > 0
          ? validStructuredSolutions
          : initialPatient?.initialStructuredSolutions || initialPatient?.structuredSolutions,
      ivFluids: hadEvolvedFluids
        ? initialPatient.ivFluids
        : computedAdmissionIvFluids || initialPatient?.ivFluids,
      structuredSolutions: hadEvolvedFluids
        ? initialPatient.structuredSolutions
        : validStructuredSolutions.length > 0
        ? validStructuredSolutions
        : initialPatient?.structuredSolutions,
      initialNursingOrders:
        cleanNursingLines.length > 0
          ? cleanNursingLines
          : initialPatient?.initialNursingOrders ||
            (Array.isArray(initialPatient?.nursingOrders)
              ? initialPatient.nursingOrders
              : undefined),
      initialStructuredNursingOrders:
        syncedStructuredNursingOrders || initialPatient?.initialStructuredNursingOrders,
      nursingOrders: hadEvolvedNursing
        ? initialPatient.nursingOrders
        : cleanNursingLines.length > 0
        ? cleanNursingLines
        : Array.isArray(initialPatient?.nursingOrders)
        ? initialPatient.nursingOrders
        : undefined,
      structuredNursingOrders: hadEvolvedNursing
        ? initialPatient.structuredNursingOrders
        : syncedStructuredNursingOrders,
      criticalCareSystems: initialPatient?.criticalCareSystems,
      roundsPresentationNote: initialPatient?.roundsPresentationNote,
      vitals: {
        bp,
        hr,
        rr,
        temp,
        spo2,
        glucose,
        weightKg: parseFloat(weightKg) || undefined,
      },
      medications: initialMedsArray,
      labs: initialLabsArray,
      studies: initialPatient?.studies || [],
      clinicalTags,
      pendings: initialPatient?.pendings || [
        {
          id: `pen-${Date.now()}`,
          text: 'Completar expediente y valorar laboratorios de control',
          category: 'Laboratorio',
          priority: 'Alta',
          completed: false,
          createdAt: admissionDate,
        },
      ],
      evolutionSummary: initialPatient?.evolutionSummary || 'Paciente de reciente ingreso al servicio de Medicina Interna.',
      clinicalHistory: clinicalHistoryObj,
      lastUpdated: new Date().toISOString(),
    };

    const generatedText = mode === 'nom-history' ? generateNomText() : undefined;
    onSave(patientRecord, generatedText);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-[92vh] overflow-hidden">
        {/* Modal Top Header with Mode Switcher */}
        <div className="px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between border-b border-slate-800 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center">
              <UserPlus className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white leading-tight">
                {initialPatient ? `Expediente de Ingreso: ${initialPatient.name}` : 'Ingreso de Paciente'}
              </h2>
              <InfoPopover
                title="Modos de Ingreso al Censo"
                content="Puedes dar de alta al paciente en menos de 1 minuto con Ingreso Rápido al Censo (conservando diagnósticos iniciales separados de la evolución), o elaborar la Historia Clínica Completa NOM-004 lista para copiar por secciones."
              />
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="inline-flex rounded-xl border border-slate-700 bg-slate-800 p-1 text-xs">
            <button
              type="button"
              onClick={() => setMode('express')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                mode === 'express'
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>⚡ Ingreso Rápido</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('nom-history')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                mode === 'nom-history'
                  ? 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>📋 Historia Clínica (NOM-004)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {initialPatient && onBackToExpediente && (
              <button
                type="button"
                onClick={() => onBackToExpediente(initialPatient)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 font-bold text-xs border border-teal-500/40 transition-colors cursor-pointer"
                title="Regresar al Panel de Expediente del Paciente"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Regresar al Expediente</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs border border-slate-700 transition-colors cursor-pointer"
              title="Cerrar al Censo Activo (Esc)"
            >
              <X className="w-4 h-4 text-rose-400" />
              <span>Cerrar</span>
            </button>
          </div>
        </div>

        {/* Validation Error Alert Banner (Visible in both Express & NOM-004 modes) */}
        {validationError && (
          <div className="mx-6 mt-3 px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{validationError}</span>
            </div>
            <button
              type="button"
              onClick={() => setValidationError(null)}
              className="p-1 rounded-md hover:bg-rose-200/50 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-300 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* MODE 1: INGRESO RÁPIDO / EXPRESS */}
        {mode === 'express' ? (
          <form onSubmit={handleFinalSubmit} noValidate className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">

            {/* Basic Info */}
            <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Datos Principales del Paciente
                </span>
                <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                  * Campos obligatorios para ingresar al censo
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-0.5">
                    <label
                      className={`text-[10px] font-bold ${
                        submittedAttempt && !name.trim()
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Nombre Completo *
                    </label>
                    {submittedAttempt && !name.trim() && (
                      <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                        Obligatorio
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (e.target.value.trim() && bed.trim()) setValidationError(null);
                    }}
                    placeholder="ej. Navarro Gómez Pedro"
                    className={`w-full px-3 py-1.5 rounded-lg text-slate-900 dark:text-white font-medium transition-all ${
                      submittedAttempt && !name.trim()
                        ? 'bg-rose-50 dark:bg-rose-950/30 border-2 border-rose-500 ring-2 ring-rose-500/20'
                        : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700'
                    }`}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label
                      className={`text-[10px] font-bold ${
                        submittedAttempt && !bed.trim()
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Cama Asignada *
                    </label>
                    {submittedAttempt && !bed.trim() && (
                      <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                        Obligatorio
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={bed}
                    onChange={(e) => {
                      setBed(e.target.value);
                      if (name.trim() && e.target.value.trim()) setValidationError(null);
                    }}
                    placeholder="ej. Cama 318"
                    className={`w-full px-3 py-1.5 rounded-lg font-mono font-bold text-slate-900 dark:text-white transition-all ${
                      submittedAttempt && !bed.trim()
                        ? 'bg-rose-50 dark:bg-rose-950/30 border-2 border-rose-500 ring-2 ring-rose-500/20'
                        : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-0.5">Servicio</label>
                  <select
                    value={service}
                    onChange={(e: any) => setService(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    {availableServices.map((srv) => (
                      <option key={srv.id} value={srv.name}>
                        {srv.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Médico a Cargo / Adscrito */}
              <div className="bg-teal-50/60 dark:bg-teal-950/30 p-2.5 rounded-xl border border-teal-200 dark:border-teal-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-[11px] font-bold text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Médico a Cargo / Adscrito (Pase de Visita):</span>
                </label>

                <div className="flex items-center gap-2 flex-1 sm:max-w-md">
                  <select
                    value={attendingPhysician}
                    onChange={(e) => setAttendingPhysician(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-teal-300 dark:border-teal-700 rounded-lg font-bold text-slate-900 dark:text-white"
                  >
                    <option value="">-- Sin asignar --</option>
                    {Array.from(
                      new Set(
                        attendingPhysician
                          ? [...availableDoctors, attendingPhysician]
                          : availableDoctors
                      )
                    ).map((docName) => (
                      <option key={docName} value={docName}>
                        {docName}
                      </option>
                    ))}
                  </select>
                  {onOpenSettings && (
                    <button
                      type="button"
                      onClick={() => onOpenSettings('doctors')}
                      className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-teal-100 dark:hover:bg-slate-700 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-700 rounded-lg font-bold text-[10px] shrink-0 flex items-center gap-1 cursor-pointer"
                      title="Configurar catálogo y colores de médicos a cargo en Preferencias"
                    >
                      <Settings className="w-3 h-3" />
                      <span>Preferencias</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Edad (años)</label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Género</label>
                  <select
                    value={gender}
                    onChange={(e: any) => setGender(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Gravedad</label>
                  <select
                    value={severity}
                    onChange={(e: any) => setSeverity(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold"
                  >
                    <option value="Estable">Estable</option>
                    <option value="Delicado">Delicado</option>
                    <option value="Grave">Grave</option>
                    <option value="Muy Grave / UCI">Muy Grave / UCI</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Código RCP</label>
                  <select
                    value={codeStatus}
                    onChange={(e: any) => setCodeStatus(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-slate-800 dark:text-slate-200"
                  >
                    <option value="RCP 1 (Reanimación Completa / Todo esfuerzo)">RCP 1 (Reanimación Completa / Todo esfuerzo)</option>
                    <option value="RCP 2 (Manejo Intermedio / Limitado / No IOT)">RCP 2 (Manejo Intermedio / Limitado / No IOT)</option>
                    <option value="RCP 3 (No Reanimación / Voluntad Anticipada / Paliativo)">RCP 3 (No Reanimación / Voluntad Anticipada)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                    No. de Expediente / NSS / Afiliación
                  </label>
                  <input
                    type="text"
                    value={recordNumber}
                    onChange={(e) => setRecordNumber(e.target.value)}
                    placeholder="ej. EXP-1042 o NSS"
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                    Fecha de Ingreso Hospitalario
                  </label>
                  <input
                    type="date"
                    value={admissionDate}
                    onChange={(e) => setAdmissionDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                  />
                </div>
              </div>

              {/* Quick Clinical Tags (Synchronized with Global Catalog + Inline Creator) */}
              <div className="pt-1 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                    Etiquetas Clínicas / Marcadores del Paciente ({clinicalTags.length} activas):
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const clean = newTagInput.trim();
                          if (clean) {
                            if (!clinicalTags.includes(clean)) {
                              setClinicalTags([...clinicalTags, clean]);
                            }
                            if (onAddNewTagToCatalog) onAddNewTagToCatalog(clean);
                            setNewTagInput('');
                          }
                        }
                      }}
                      placeholder="Nueva etiqueta (ej. Traqueostomía)..."
                      className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-[11px]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const clean = newTagInput.trim();
                        if (clean) {
                          if (!clinicalTags.includes(clean)) {
                            setClinicalTags([...clinicalTags, clean]);
                          }
                          if (onAddNewTagToCatalog) onAddNewTagToCatalog(clean);
                          setNewTagInput('');
                        }
                      }}
                      className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Agregar</span>
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {mergedAvailableTags.map((tag) => {
                    const isSelected = clinicalTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setClinicalTags(clinicalTags.filter((t) => t !== tag));
                          } else {
                            setClinicalTags([...clinicalTags, tag]);
                          }
                        }}
                        className={`text-[11px] px-2 py-0.5 rounded-md border font-medium transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-teal-600 text-white border-teal-700 font-bold shadow-xs'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Motivo de Ingreso, Antecedentes Relevantes y Alergias (para Pase de Visita) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                    Motivo de Ingreso (Pase de Visita)
                  </label>
                  <input
                    type="text"
                    value={admissionReason}
                    onChange={(e) => setAdmissionReason(e.target.value)}
                    placeholder="ej. Insuficiencia respiratoria aguda y fiebre de 5 días"
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                    Antecedentes Relevantes (APP / Crónicos)
                  </label>
                  <input
                    type="text"
                    value={relevantHistory}
                    onChange={(e) => setRelevantHistory(e.target.value)}
                    placeholder="ej. DM2 (10a), HAS (8a), ERC KDIGO G3b"
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Alergias</label>
                  <input
                    type="text"
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder="ej. Penicilina (choque anafiláctico) o 'Negadas'"
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-1">
                <DiagnosisListEditor
                  value={diagnosesText}
                  onChange={(_, joinedString) => setDiagnosesText(joinedString)}
                  label="Diagnósticos Iniciales de Ingreso (CIE-10 y Orden Clínico)"
                />
              </div>
            </div>

            {/* Quick Labs & Medications on Admission */}
            <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Laboratorios y Medicamentos de Ingreso (Opcional)
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <span className="text-[10px] text-slate-500">Hb (g/dL)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={quickHb}
                    onChange={(e) => setQuickHb(e.target.value)}
                    placeholder="ej. 12.5"
                    className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">Leucocitos</span>
                  <input
                    type="number"
                    value={quickLeucos}
                    onChange={(e) => setQuickLeucos(e.target.value)}
                    placeholder="ej. 15200"
                    className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">Plaquetas</span>
                  <input
                    type="number"
                    value={quickPlq}
                    onChange={(e) => setQuickPlq(e.target.value)}
                    placeholder="ej. 230000"
                    className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">Creatinina</span>
                  <input
                    type="number"
                    step="0.01"
                    value={quickCr}
                    onChange={(e) => setQuickCr(e.target.value)}
                    placeholder="ej. 1.2"
                    className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">Glucemia</span>
                  <input
                    type="number"
                    value={quickGluc}
                    onChange={(e) => setQuickGluc(e.target.value)}
                    placeholder="ej. 140"
                    className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono"
                  />
                </div>
              </div>

              {/* Medication / Antibiotic Builder with SEPARATE Dose, Route, Frequency & Type */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Pill className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                      Medicamentos de Ingreso (Dosis, Vía y Frecuencia separados)
                    </span>
                  </div>
                  {onOpenSettings && (
                    <button
                      type="button"
                      onClick={() => onOpenSettings('templates')}
                      className="text-[10px] px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:text-teal-600 flex items-center gap-1 cursor-pointer"
                      title="Personalizar catálogo de vías de administración en Preferencias"
                    >
                      <Settings className="w-3 h-3 text-teal-600" />
                      <span>Vías en Preferencias</span>
                    </button>
                  )}
                </div>

                {/* Existing queued admission medications */}
                {admissionMedsList.length > 0 && (
                  <div className="space-y-1.5">
                    {admissionMedsList.map((med) => (
                      <div
                        key={med.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800/70 text-xs"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">{med.name}</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono font-bold text-[11px]">
                            Dosis: {med.dose}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-bold text-[11px]">
                            Vía: {med.route}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px]">
                            Frec: {med.frequency}
                          </span>
                          {(med.isAntibiotic || med.isLimitedCourse) && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-mono font-bold text-[10px]">
                              {med.isAntibiotic ? 'ATB' : 'Curso Corto'}: {med.plannedDays || 7}d
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAdmissionMed(med.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                          title="Quitar medicamento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                  <div className="sm:col-span-3">
                    <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-0.5">
                      Fármaco / Antibiótico
                    </span>
                    <input
                      type="text"
                      value={quickAbName}
                      onChange={(e) => setQuickAbName(e.target.value)}
                      placeholder="ej. Ceftriaxona / Enoxaparina"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-0.5">
                      Dosis
                    </span>
                    <input
                      type="text"
                      value={quickAbDose}
                      onChange={(e) => setQuickAbDose(e.target.value)}
                      placeholder="ej. 1 g / 40 mg"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-0.5">
                      Vía Admin.
                    </span>
                    <select
                      value={quickAbRoute}
                      onChange={(e) => setQuickAbRoute(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold"
                    >
                      {medicationRoutesList.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-0.5">
                      Frecuencia
                    </span>
                    <input
                      type="text"
                      value={quickAbFreq}
                      onChange={(e) => setQuickAbFreq(e.target.value)}
                      placeholder="ej. cada 12 hrs"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-0.5">
                      Tipo / Días
                    </span>
                    <div className="flex items-center gap-1">
                      <select
                        value={quickAbCourseType}
                        onChange={(e: any) => setQuickAbCourseType(e.target.value)}
                        className="flex-1 min-w-0 px-1.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-[11px]"
                      >
                        <option value="antibiotic">ATB</option>
                        <option value="limited">Curso corto</option>
                        <option value="continuous">Continuo</option>
                      </select>
                      {quickAbCourseType !== 'continuous' && (
                        <input
                          type="number"
                          value={quickAbDays}
                          onChange={(e) => setQuickAbDays(e.target.value)}
                          title="Días programados"
                          className="w-12 px-1.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-center"
                        />
                      )}
                    </div>
                  </div>
                  <div className="sm:col-span-1">
                    <button
                      type="button"
                      onClick={handleAddDraftMedication}
                      disabled={!quickAbName.trim()}
                      title="Agregar medicamento a la lista de ingreso"
                      className="w-full py-1.5 px-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="sm:hidden">Agregar Medicamento</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Synchronized Admission Indications & Treatment Plan Box */}
            <div className="bg-teal-50/40 dark:bg-slate-850 p-4 rounded-2xl border border-teal-200 dark:border-teal-900/60 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <div>
                    <span className="text-[11px] font-bold text-teal-900 dark:text-teal-300 uppercase tracking-wider block">
                      Plan e Indicaciones Médicas de Ingreso (Base de Ingreso + Sincronización Inicial)
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Lo que registres aquí queda resguardado como Base de Ingreso y alimenta inicialmente el Expediente y la Nota de Evolución.
                    </span>
                  </div>
                </div>
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => onOpenSettings('templates')}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-teal-300 dark:border-teal-700 font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-100 flex items-center gap-1 cursor-pointer"
                    title="Configurar plantillas de dieta y órdenes de enfermería en Preferencias"
                  >
                    <Settings className="w-3 h-3" />
                    <span>Personalizar Plantillas</span>
                  </button>
                )}
              </div>

              {/* 1. Dieta e Hidratación Enteral de Ingreso */}
              <div className="bg-white/90 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <label className="text-[11px] font-bold text-teal-800 dark:text-teal-300 uppercase">
                    1. Dieta e Hidratación Enteral de Ingreso
                  </label>
                  <div className="flex flex-wrap items-center gap-1">
                    {dietQuickPresets.map((dPreset) => (
                      <button
                        key={dPreset}
                        type="button"
                        onClick={() => setAdmissionDiet(dPreset)}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                          admissionDiet === dPreset
                            ? 'bg-teal-600 text-white border-teal-700 font-bold'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-teal-400'
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold block mb-0.5">
                      Tipo de Dieta / Vía Enteral
                    </span>
                    <input
                      type="text"
                      value={admissionDiet}
                      onChange={(e) => setAdmissionDiet(e.target.value)}
                      placeholder="ej. Dieta para diabético 1800 kcal normosódica o Ayuno hasta nueva orden"
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold block mb-0.5">
                      Indicaciones Especiales (Restricción hídrica, SNG, gastrostomía, colaciones)
                    </span>
                    <input
                      type="text"
                      value={admissionDietSpecialNotes}
                      onChange={(e) => setAdmissionDietSpecialNotes(e.target.value)}
                      placeholder="ej. Restricción de líquidos a 1000 ml/24h, agua libre por SNG..."
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Soluciones Parenterales de Ingreso (Compact Unified System) */}
              <div className="bg-white/90 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <UnifiedSolutionsPanel
                  solutions={admissionStructuredSolutions}
                  onChange={setAdmissionStructuredSolutions}
                />
              </div>

              {/* 3. Indicaciones de Enfermería y Medidas Generales de Ingreso (Compact Unified System) */}
              <div className="bg-white/90 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <UnifiedNursingOrdersPanel
                  orders={admissionStructuredNursingOrders}
                  onChange={(nextOrders) => setAdmissionStructuredNursingOrders(nextOrders)}
                  nursingRepository={nursingRepo}
                  onOpenSettings={
                    onOpenSettings ? (tab) => onOpenSettings(tab as SettingsTabKey) : undefined
                  }
                  compact
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-500 hover:text-slate-700 font-semibold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-500/20 flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Ingresar Paciente al Censo</span>
              </button>
            </div>
          </form>
        ) : (
          /* MODE 2: HISTORIA CLÍNICA COMPLETA NOM-004 */
          <form onSubmit={handleFinalSubmit} noValidate className="flex-1 overflow-hidden flex flex-col">
            {/* Persistent Author & Quick Navigation Bar */}
            <div className="px-6 py-2 bg-teal-950/20 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                <User className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 shrink-0">
                  Elabora Historia Clínica (Interno / Residente):
                </label>
                <input
                  type="text"
                  value={doctorAuthor}
                  onChange={(e) => setDoctorAuthor(e.target.value)}
                  placeholder="Ej. MIP Juan Pérez / Dr. Carlos Mendoza (R1MI)"
                  className="flex-1 max-w-sm px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMode('express')}
                  className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-teal-600 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Volver a Datos Rápidos</span>
                </button>
                {initialPatient && onBackToExpediente && (
                  <button
                    type="button"
                    onClick={() => onBackToExpediente(initialPatient)}
                    className="text-[11px] font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50 px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-800 flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Regresar al Expediente</span>
                  </button>
                )}
              </div>
            </div>

            {/* Steps / Sub-tabs */}
            <div className="px-6 pt-3 pb-2 bg-slate-100 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto text-xs font-semibold">
              <button
                type="button"
                onClick={() => setHistoryTab('ficha-ahf')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                  historyTab === 'ficha-ahf'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <span>1. Ficha y Antecedentes (AHF, APNP, APP)</span>
              </button>
              <button
                type="button"
                onClick={() => setHistoryTab('padecimiento-ipas')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                  historyTab === 'padecimiento-ipas'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <span>2. Padecimiento Actual e IPAS</span>
              </button>
              <button
                type="button"
                onClick={() => setHistoryTab('exploracion')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                  historyTab === 'exploracion'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <span>3. Exploración Física Completa</span>
              </button>
              <button
                type="button"
                onClick={() => setHistoryTab('diagnostico-plan')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                  historyTab === 'diagnostico-plan'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <span>4. Labs, Análisis, Diagnósticos y Plan</span>
              </button>
              <button
                type="button"
                onClick={() => setHistoryTab('preview')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                  historyTab === 'preview'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <span>5. Vista Previa y Copiar para Expediente</span>
              </button>
            </div>

            {/* Sub-tab Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {/* TAB 1: FICHA & ANTECEDENTES */}
              {historyTab === 'ficha-ahf' && (
                <div className="space-y-4">
                  {/* Ficha básica */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-0.5">
                        <label
                          className={`text-[10px] font-bold uppercase ${
                            submittedAttempt && !name.trim()
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-500'
                          }`}
                        >
                          Nombre Completo *
                        </label>
                        {submittedAttempt && !name.trim() && (
                          <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                            Obligatorio
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (e.target.value.trim() && bed.trim()) setValidationError(null);
                        }}
                        placeholder="Nombre y Apellidos"
                        className={`w-full px-3 py-1.5 rounded-lg font-bold transition-all ${
                          submittedAttempt && !name.trim()
                            ? 'bg-rose-50 dark:bg-rose-950/30 border-2 border-rose-500 ring-2 ring-rose-500/20'
                            : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700'
                        }`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label
                          className={`text-[10px] font-bold uppercase ${
                            submittedAttempt && !bed.trim()
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-500'
                          }`}
                        >
                          Cama Asignada *
                        </label>
                        {submittedAttempt && !bed.trim() && (
                          <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                            Obligatorio
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={bed}
                        onChange={(e) => {
                          setBed(e.target.value);
                          if (name.trim() && e.target.value.trim()) setValidationError(null);
                        }}
                        placeholder="ej. Cama 312"
                        className={`w-full px-3 py-1.5 rounded-lg font-mono font-bold transition-all ${
                          submittedAttempt && !bed.trim()
                            ? 'bg-rose-50 dark:bg-rose-950/30 border-2 border-rose-500 ring-2 ring-rose-500/20'
                            : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Servicio</label>
                      <select
                        value={service}
                        onChange={(e: any) => setService(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                      >
                        {availableServices.map((srv) => (
                          <option key={srv.id} value={srv.name}>
                            {srv.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Edad</label>
                      <input
                        type="number"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Género</label>
                      <select
                        value={gender}
                        onChange={(e: any) => setGender(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                      >
                        <option value="Masculino">Masculino</option>
                        <option value="Femenino">Femenino</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Estado Civil</label>
                      <input
                        type="text"
                        value={maritalStatus}
                        onChange={(e) => setMaritalStatus(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Ocupación</label>
                      <input
                        type="text"
                        value={occupation}
                        onChange={(e) => setOccupation(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Interrogatorio</label>
                      <select
                        value={interrogationType}
                        onChange={(e: any) => setInterrogationType(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                      >
                        <option value="Directo">Directo</option>
                        <option value="Indirecto">Indirecto</option>
                        <option value="Mixto">Mixto</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Escolaridad</label>
                      <input
                        type="text"
                        value={education}
                        onChange={(e) => setEducation(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Lugar de Origen</label>
                      <input
                        type="text"
                        value={origin}
                        onChange={(e) => setOrigin(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Residencia</label>
                      <input
                        type="text"
                        value={residence}
                        onChange={(e) => setResidence(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Religión</label>
                      <input
                        type="text"
                        value={religion}
                        onChange={(e) => setReligion(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Expediente / NSS</label>
                      <input
                        type="text"
                        value={recordNumber}
                        onChange={(e) => setRecordNumber(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Fecha Ingreso</label>
                      <input
                        type="date"
                        value={admissionDate}
                        onChange={(e) => setAdmissionDate(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                      />
                    </div>
                  </div>

                  {/* AHF */}
                  <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                        II. Antecedentes Heredofamiliares (AHF)
                      </label>
                      <div className="flex flex-wrap items-center gap-1 text-[10px]">
                        {ahfPresetsList.map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => setAhf((prev) => `${prev} ${chip}.`)}
                            className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-teal-700 dark:text-teal-300 cursor-pointer"
                          >
                            +{chip}
                          </button>
                        ))}
                        {onOpenSettings && (
                          <button
                            type="button"
                            onClick={() => onOpenSettings('templates')}
                            title="Personalizar opciones rápidas de AHF en Preferencias"
                            className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-teal-600 cursor-pointer"
                          >
                            <Settings className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopySection('ahf', ahf)}
                          className="px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-700 font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedSection === 'ahf' ? '¡Copiado!' : 'Copiar sección'}</span>
                        </button>
                      </div>
                    </div>
                    <textarea
                      rows={3}
                      value={ahf}
                      onChange={(e) => setAhf(e.target.value)}
                      className="w-full text-xs p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg leading-relaxed"
                    />
                  </div>

                  {/* APNP */}
                  <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                        III. Antecedentes Personales No Patológicos (APNP)
                      </label>
                      <div className="flex flex-wrap items-center gap-1 text-[10px]">
                        {apnpPresetsList.map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => setApnp((prev) => `${prev} ${chip}.`)}
                            className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-teal-700 dark:text-teal-300 cursor-pointer"
                          >
                            +{chip}
                          </button>
                        ))}
                        {onOpenSettings && (
                          <button
                            type="button"
                            onClick={() => onOpenSettings('templates')}
                            title="Personalizar opciones rápidas de APNP en Preferencias"
                            className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-teal-600 cursor-pointer"
                          >
                            <Settings className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopySection('apnp', apnp)}
                          className="px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-700 font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedSection === 'apnp' ? '¡Copiado!' : 'Copiar sección'}</span>
                        </button>
                      </div>
                    </div>
                    <textarea
                      rows={3}
                      value={apnp}
                      onChange={(e) => setApnp(e.target.value)}
                      className="w-full text-xs p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg leading-relaxed"
                    />
                  </div>

                  {/* APP */}
                  <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                        IV. Antecedentes Personales Patológicos (APP)
                      </label>
                      <div className="flex flex-wrap items-center gap-1 text-[10px]">
                        {appPresetsList.map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => setApp((prev) => `${prev} ${chip}.`)}
                            className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-teal-700 dark:text-teal-300 cursor-pointer"
                          >
                            +{chip}
                          </button>
                        ))}
                        {onOpenSettings && (
                          <button
                            type="button"
                            onClick={() => onOpenSettings('templates')}
                            title="Personalizar opciones rápidas de APP en Preferencias"
                            className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-teal-600 cursor-pointer"
                          >
                            <Settings className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopySection('app', app)}
                          className="px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-700 font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedSection === 'app' ? '¡Copiado!' : 'Copiar sección'}</span>
                        </button>
                      </div>
                    </div>
                    <textarea
                      rows={3}
                      value={app}
                      onChange={(e) => setApp(e.target.value)}
                      className="w-full text-xs p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg leading-relaxed"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: PADECIMIENTO ACTUAL & IPAS */}
              {historyTab === 'padecimiento-ipas' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                        V. Padecimiento Actual (Semiología detallada: inicio, evolución, terapéutica previa)
                      </label>
                      <button
                        type="button"
                        onClick={() => handleCopySection('padecimiento', currentIllness)}
                        className="text-[10px] px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedSection === 'padecimiento' ? '¡Copiado!' : 'Copiar sección'}</span>
                      </button>
                    </div>
                    <textarea
                      rows={6}
                      value={currentIllness}
                      onChange={(e) => setCurrentIllness(e.target.value)}
                      className="w-full text-xs p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg leading-relaxed font-mono"
                    />
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                        VI. Interrogatorio por Aparatos y Sistemas (IPAS)
                      </label>
                      <button
                        type="button"
                        onClick={() => handleCopySection('ipas', ipas)}
                        className="text-[10px] px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedSection === 'ipas' ? '¡Copiado!' : 'Copiar sección'}</span>
                      </button>
                    </div>
                    <textarea
                      rows={5}
                      value={ipas}
                      onChange={(e) => setIpas(e.target.value)}
                      className="w-full text-xs p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg leading-relaxed font-mono"
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: EXPLORACIÓN FÍSICA COMPLETA */}
              {historyTab === 'exploracion' && (
                <div className="space-y-4">
                  {/* Signos y Somatometría */}
                  <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Somatometría y Signos Vitales de Ingreso
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
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
                      <div>
                        <span className="text-[10px] text-slate-500">Peso (kg)</span>
                        <input
                          type="number"
                          value={weightKg}
                          onChange={(e) => setWeightKg(e.target.value)}
                          className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono text-center font-bold"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500">Talla (cm)</span>
                        <input
                          type="number"
                          value={heightCm}
                          onChange={(e) => setHeightCm(e.target.value)}
                          className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono text-center font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Exploración Física Completa por Regiones */}
                  <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                        VII. Exploración Física por Sistemas (Habitus, Cabeza/Cuello, Tórax, Abdomen, Extremidades, Neuro)
                      </label>
                      <button
                        type="button"
                        onClick={() => handleCopySection('ef', physicalExamNom)}
                        className="text-[10px] px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedSection === 'ef' ? '¡Copiado!' : 'Copiar sección'}</span>
                      </button>
                    </div>
                    <textarea
                      rows={10}
                      value={physicalExamNom}
                      onChange={(e) => setPhysicalExamNom(e.target.value)}
                      className="w-full text-xs p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg leading-relaxed font-mono"
                    />
                  </div>
                </div>
              )}

              {/* TAB 4: LABS, ANÁLISIS, DIAGNÓSTICOS & PLAN DE INGRESO */}
              {historyTab === 'diagnostico-plan' && (
                <div className="space-y-4">
                  {/* Paraclínicos y Gabinete */}
                  <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                        VIII. Paraclínicos y Estudios de Gabinete al Ingreso
                      </label>
                      <button
                        type="button"
                        onClick={() => handleCopySection('labs', initialLabsText)}
                        className="text-[10px] px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedSection === 'labs' ? '¡Copiado!' : 'Copiar sección'}</span>
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={initialLabsText}
                      onChange={(e) => setInitialLabsText(e.target.value)}
                      className="w-full text-xs p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg leading-relaxed font-mono"
                    />
                  </div>

                  {/* IX. Análisis e Integración Clínica (antes del Plan de Manejo, ideal para MIPs / Residentes) */}
                  <div className="bg-purple-50/50 dark:bg-purple-950/20 p-4 rounded-xl border border-purple-200 dark:border-purple-800/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-[11px] font-bold text-purple-900 dark:text-purple-300 uppercase block">
                          IX. Análisis e Integración Clínica (MIP / Residente)
                        </label>
                        <span className="text-[10px] text-slate-500">
                          Integración sindromática y justificación diagnóstica antes del plan de manejo e indicaciones
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopySection('analysis', clinicalAnalysis)}
                        className="text-[10px] px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-purple-300 dark:border-purple-700 font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedSection === 'analysis' ? '¡Copiado!' : 'Copiar sección'}</span>
                      </button>
                    </div>
                    <textarea
                      rows={4}
                      value={clinicalAnalysis}
                      onChange={(e) => setClinicalAnalysis(e.target.value)}
                      placeholder="Redacta aquí el análisis clínico integrando antecedentes, cuadro actual, hallazgos físicos y paraclínicos de ingreso..."
                      className="w-full text-xs p-3 bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-800 rounded-lg leading-relaxed font-mono"
                    />
                  </div>

                  {/* Diagnósticos de Ingreso */}
                  <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => handleCopySection('diag', diagnosticImpression)}
                        className="text-[10px] px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedSection === 'diag' ? '¡Copiado!' : 'Copiar sección'}</span>
                      </button>
                    </div>
                    <DiagnosisListEditor
                      value={diagnosticImpression}
                      onChange={(_, joinedString) => setDiagnosticImpression(joinedString)}
                      label="X. Impresión Diagnóstica / Diagnósticos Iniciales de Ingreso (CIE-10 y Orden)"
                    />
                  </div>

                  {/* Pronóstico */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        XI. Pronóstico para la Vida
                      </label>
                      <input
                        type="text"
                        value={prognosisLife}
                        onChange={(e) => setPrognosisLife(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        Pronóstico para la Función
                      </label>
                      <input
                        type="text"
                        value={prognosisFunction}
                        onChange={(e) => setPrognosisFunction(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Plan de Ingreso */}
                  <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                        XII. Plan de Manejo e Indicaciones Médicas de Ingreso
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleSyncIndicationsToNomPlan}
                          className="text-[10px] px-2.5 py-0.5 rounded bg-teal-600 hover:bg-teal-500 text-white font-bold flex items-center gap-1 cursor-pointer"
                          title="Traer dieta, soluciones, medicamentos e indicaciones capturadas en Ingreso Rápido"
                        >
                          <Zap className="w-3 h-3" />
                          <span>Sincronizar desde Indicaciones de Ingreso</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopySection('plan', admissionPlan)}
                          className="text-[10px] px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedSection === 'plan' ? '¡Copiado!' : 'Copiar sección'}</span>
                        </button>
                      </div>
                    </div>
                    <textarea
                      rows={5}
                      value={admissionPlan}
                      onChange={(e) => setAdmissionPlan(e.target.value)}
                      className="w-full text-xs p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg leading-relaxed font-mono"
                    />
                  </div>
                </div>
              )}

              {/* TAB 5: VISTA PREVIA Y COPIAR OFICIAL */}
              {historyTab === 'preview' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">
                        Historia Clínica NOM-004 (Desde Título hacia abajo, sin encabezado de hospital)
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Incluye Análisis Clínico antes del Plan y nombre de quien elabora ({doctorAuthor}).
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyHistory}
                      className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-500/20 cursor-pointer"
                    >
                      {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{isCopied ? '¡Historia Clínica Copiada!' : 'Copiar Texto Completo'}</span>
                    </button>
                  </div>

                  <pre className="p-4 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 font-mono text-[11px] leading-relaxed whitespace-pre-wrap max-h-[500px] overflow-y-auto selection:bg-teal-700">
                    {generateNomText()}
                  </pre>
                </div>
              )}
            </div>

            {/* Bottom Form Actions */}
            <div className="px-6 py-3.5 bg-slate-100 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {initialPatient && onBackToExpediente && (
                  <button
                    type="button"
                    onClick={() => onBackToExpediente(initialPatient)}
                    className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-teal-700 dark:text-teal-300 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Regresar al Expediente</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-slate-500 hover:text-slate-800 font-semibold text-xs cursor-pointer"
                >
                  Cerrar al Censo
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyHistory}
                  className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  <span>{isCopied ? 'Copiado' : 'Copiar Historia'}</span>
                </button>

                <button
                  type="submit"
                  className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Paciente y Registrar Historia</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
