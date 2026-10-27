export interface HospitalServiceItem {
  id: string;
  name: string;
  color: string; // Hex color code (e.g. #0d9488)
}

export interface AttendingPhysicianItem {
  id: string;
  name: string;
  color: string; // Hex color code (e.g. #0d9488)
}

export interface DiagnosisEntry {
  id: string;
  cie10?: string; // Código CIE-10 opcional (ej. "J18.9", "A41.9")
  text: string; // Descripción clínica del diagnóstico
}

export interface ParenteralSolutionItem {
  id: string;
  category?: 'solucion' | 'infusion'; // Solución base vs Infusión de medicamento
  solutionType: string; // ej. "Solución Salina 0.9%", "Solución Hartmann", "Glucosada 5%"
  volume?: string; // ej. "1000 ml", "500 ml", "100 ml"
  volumeMl?: string;
  addedConcentrateOrMed?: string; // Concentrado o medicamento (ej. "KCl 20 mEq", "Norepinefrina 8 mg")
  addedMedication?: string;
  concentration?: string; // Concentración de infusión (ej. "80 mcg/mL", "1 UI/mL")
  route: 'IV' | 'CVC' | 'IO'; // Vía: IV periférica, CVC (Catéter Venoso Central) o IO (Intraósea)
  infusionRate?: string; // Velocidad de infusión o tiempo (ej. "p/24h (42 ml/h)", "a 8 ml/h (0.1 mcg/kg/min)")
  rateOrDuration?: string;
  specialNotes?: string; // Indicaciones especiales de la solución o infusión
}

export interface PatientNursingOrderItem {
  id: string;
  text: string; // Indicación de enfermería editable
  note?: string; // Aclaración o nota específica debajo de la indicación (opcional)
  active?: boolean;
}

export interface LabExtraParamValue {
  panelId?: string;
  panelName?: string;
  panel?: string;
  label: string;
  value: string;
  unit: string;
}

export type ServiceType = string;

export type SeverityType = 'Estable' | 'Delicado' | 'Grave' | 'Muy Grave / UCI';

export type CodeStatusType =
  | 'RCP 1 (Reanimación Completa / Todo esfuerzo)'
  | 'RCP 2 (Manejo Intermedio / Limitado / No IOT)'
  | 'RCP 3 (No Reanimación / Voluntad Anticipada / Paliativo)'
  | 'RCP Completo (RCP3)' // Compatibilidad con registros previos
  | 'No RCP / Máximo esfuerzo médico'
  | 'Voluntad Anticipada'
  | 'Rechazo a Medidas Invasivas (No IOT)';

export interface DiagnosticStudy {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  category:
    | 'TAC'
    | 'Radiografía'
    | 'Ultrasonido'
    | 'Ecocardiograma'
    | 'Cultivo / Microbiología'
    | 'Endoscopía'
    | 'Resonancia Magnética'
    | 'Laboratorio Especial'
    | 'Otro Estudio';
  title: string; // ej. TAC simple de abdomen y pelvis
  summary: string; // ej. Colecistitis litiásica con engrosamiento de pared 5mm, sin líquido libre.
  isNew?: boolean; // Reportado fuera de nota, pendiente de integrar
  integratedInNoteId?: string;
  registeredBy?: string;
}

export interface MedicationItem {
  id: string;
  name: string;
  dose: string;
  route: string;
  frequency: string;
  isAntibiotic: boolean;
  isLimitedCourse?: boolean; // Medicamento por tiempo limitado / curso corto (ej. esteroides, antivirales)
  startDate: string; // YYYY-MM-DD
  plannedDays?: number; // e.g. 5, 7 or 14
  indication?: string;
  active: boolean;
}

export interface LabRecord {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  hb?: number; // g/dL
  leucos?: number; // /uL (e.g. 11500)
  wbc?: number | string;
  neutrophils?: number | string;
  lymphocytes?: number | string;
  plaquetas?: number; // /uL (e.g. 210000)
  platelets?: number | string;
  glucosa?: number; // mg/dL
  glucose?: number | string;
  creatinina?: number; // mg/dL
  creatinine?: number | string;
  urea?: number; // mg/dL
  bun?: number; // mg/dL
  na?: number; // mEq/L
  sodium?: number | string;
  k?: number; // mEq/L
  potassium?: number | string;
  cl?: number; // mEq/L
  chloride?: number | string;
  calcium?: number | string;
  phosphorus?: number | string;
  magnesium?: number | string;
  ast?: number | string;
  alt?: number | string;
  alp?: number | string;
  biliTotal?: number | string;
  biliDirect?: number | string;
  albumin?: number | string;
  ldh?: number | string;
  tp?: number | string;
  inr?: number | string;
  ttpa?: number | string;
  dimerD?: number | string;
  ph?: number;
  po2?: number;
  pco2?: number;
  hco3?: number;
  eb?: number | string;
  lactato?: number; // mmol/L
  lactate?: number | string;
  pcr?: number; // mg/L
  procalcitonina?: number; // ng/mL
  pct?: number | string;
  vsg?: number | string;
  ferritin?: number | string;
  troponin?: number | string;
  bnp?: number | string;
  selectedPanels?: string[]; // Paneles seleccionados al capturar
  extraParams?: Record<string, LabExtraParamValue>; // Parámetros adicionales de todos los paneles de Medicina Interna
  otherNotes?: string;
  notes?: string;
  isNew?: boolean; // Nuevo laboratorio ingresado entre turnos, pendiente de integrar en la nota
  integratedInNoteId?: string;
}

export type PendingUrgencyColor = 'red' | 'yellow' | 'green' | 'blue';

export type PendingWorkflowStage = 'take' | 'collect' | 'register_census' | 'done';

export interface ClinicalPending {
  id: string;
  text: string;
  category:
    | 'Laboratorio'
    | 'Imagen/Gabinete'
    | 'Interconsulta'
    | 'Procedimiento'
    | 'Familiar/Alta'
    | 'Alta Hospitalaria';
  priority: 'Alta' | 'Media' | 'Baja' | 'Informativa';
  urgencyColor?: PendingUrgencyColor; // 'red' (Urgente), 'yellow' (Prioritario), 'green' (Rutina), 'blue' (Informativo)
  isDischargePending?: boolean; // Especial: ALTA PENDIENTE (requiere egreso hoy o mañana temprano)
  workflowStage?: PendingWorkflowStage; // Cadena: 'take' (Tomar/Solicitar) -> 'collect' (Recabar) -> 'register_census' (Subir al Censo) -> 'done'
  customDetails?: string; // Detalle específico (ej. "BH, QS6, ES3, Gasometría")
  completed: boolean;
  createdAt: string;
}

export interface CustomFormulaVariable {
  symbol: string; // ej. "na", "glucosa", "peso"
  label: string; // ej. "Sodio medido (mEq/L)"
  defaultValue: number;
}

export interface CustomMedicalFormula {
  id: string;
  name: string;
  specialty: string; // ej. "Medicina Interna", "Nefrología", "Cirugía", "Ginecología"
  description?: string;
  variables: CustomFormulaVariable[];
  expression: string; // ej. "na + 0.016 * (glucosa - 100)"
  resultUnit: string; // ej. "mEq/L"
  interpretationHint?: string; // ej. "Normal: 135 - 145 mEq/L"
}

export interface ClinicalNoteRecord {
  id: string;
  patientId: string;
  patientName: string;
  bed: string;
  service: string;
  date: string;
  time: string;
  noteType: 'Nota de Evolución' | 'Nota de Ingreso' | 'Valoración / Interconsulta' | 'Nota de Egreso / Alta';
  content: string;
  auditHash: string;
  residentAuthor: string;
  createdAtTimestamp: number;
}

export interface CriticalCareSystemsData {
  enabled?: boolean;
  neuro?: {
    consciousness?: string;
    reflexes?: string;
    sedationAnalgesia?: string;
    glasgow?: string;
    fourScore?: string;
    rass?: string;
    notes?: string;
  };
  respiratory?: {
    supportType?: string;
    ventMode?: string;
    fio2?: string;
    peep?: string;
    tidalVolume?: string;
    respRateVent?: string;
    spo2?: string;
    bloodGas?: string;
    notes?: string;
  };
  hemodynamic?: {
    hemodynamicStatus?: string;
    bpAndMap?: string;
    vasopressorsInotropes?: string;
    hrAndRhythm?: string;
    notes?: string;
  };
  gastroMetabolic?: {
    glycemias?: string;
    feedingType?: string;
    abdomenAndBowel?: string;
    notes?: string;
  };
  renal?: {
    diuresis?: string;
    renalFunction?: string;
    fluidBalance?: string;
    diureticsOrRrt?: string;
    notes?: string;
  };
  infectious?: {
    infectionData?: string;
    acutePhaseReactants?: string;
    antibioticsInUse?: string;
    notes?: string;
  };
}

export interface Patient {
  id: string;
  recordNumber: string; // Expediente o NSS
  name: string;
  age: number;
  gender: 'Masculino' | 'Femenino';
  bed: string;
  service: ServiceType;
  attendingPhysician?: string; // Médico a cargo / adscrito asignado para pase de visita
  admissionDate: string; // YYYY-MM-DD
  dischargeDate?: string | null;
  status: 'active' | 'discharged';
  severity: SeverityType;
  codeStatus: CodeStatusType;
  allergies: string;
  admissionReason?: string; // Motivo de ingreso conciso para el pase de visita ("¿por qué ingresó?")
  relevantHistory?: string; // Antecedentes relevantes con el padecimiento actual (se omite si no aporta)
  initialDiagnoses?: string[]; // Diagnósticos iniciales de ingreso (no se sobrescriben al evolucionar)
  diagnoses: string[]; // Diagnósticos actuales activos en el censo (incluyen CIE-10 si se asignó)
  vitals: {
    bp: string;
    hr: string;
    rr: string;
    temp: string;
    spo2: string;
    glucose?: string;
    weightKg?: number;
  };
  initialDiet?: string; // Dieta base de ingreso (no cambia en retroceso a menos que se edite en Ingreso)
  initialDietSpecialNotes?: string; // Indicaciones especiales de dieta al ingreso
  diet?: string; // Dieta actual sincronizada entre Expediente y Nota de Evolución
  dietSpecialNotes?: string; // Indicaciones especiales de la dieta en caso de ser necesarias
  initialIvFluids?: string; // Soluciones de ingreso (no cambian en retroceso)
  initialStructuredSolutions?: ParenteralSolutionItem[]; // Soluciones estructuradas de ingreso
  ivFluids?: string; // Soluciones parenterales actuales (resumen en texto) sincronizadas desde la nota
  structuredSolutions?: ParenteralSolutionItem[]; // Lista ordenada de soluciones e infusiones parenterales
  initialNursingOrders?: string[]; // Indicaciones de enfermería originales del ingreso (no cambian en retroceso)
  initialStructuredNursingOrders?: PatientNursingOrderItem[]; // Lista estructurada de enfermería del ingreso
  nursingOrders?: string[]; // Indicaciones de enfermería activas
  structuredNursingOrders?: PatientNursingOrderItem[]; // Lista ordenada de indicaciones de enfermería con notas opcionales
  medications: MedicationItem[];
  labs: LabRecord[];
  studies?: DiagnosticStudy[];
  clinicalTags?: string[]; // ej. 'Intubado', 'CPAP', 'Aislado', 'Agresivo', 'Ayuno', 'Hemodiálisis', 'CVC'
  pendings: ClinicalPending[];
  evolutionSummary?: string;
  roundsPresentationNote?: string; // Resumen corto temporal para presentación en el pase de visita (no altera la Nota de Evolución)
  criticalCareSystems?: CriticalCareSystemsData; // Evolución clínica detallada por sistemas (pacientes críticos / UCI / MI)
  clinicalHistory?: NomClinicalHistory;
  lastUpdated: string;
}

export interface NomClinicalHistory {
  interrogationType: 'Directo' | 'Indirecto' | 'Mixto';
  informantRelation?: string;
  maritalStatus?: string;
  occupation?: string;
  education?: string;
  origin?: string;
  residence?: string;
  religion?: string;
  ahf: string;
  apnp: string;
  app: string;
  currentIllness: string;
  ipas: string;
  weightKg?: number;
  heightCm?: number;
  bmi?: number;
  physicalExamGeneral?: string;
  initialLabsGabinete?: string;
  clinicalAnalysis?: string; // Análisis e integración clínica (para internos y residentes) antes del plan
  diagnosticImpression?: string;
  prognosisLife?: string;
  prognosisFunction?: string;
  admissionPlan?: string;
  authorName?: string; // Nombre de quien elabora la historia clínica
}

export interface PhysicalExamTemplateItem {
  id: string;
  label: string;
  text: string;
}

export interface ResidentProfile {
  name: string;
  hospital: string;
  service: string;
  residencyYear: string;
  pinLockEnabled: boolean;
  pinHash?: string;
  nursingRepository?: string[];
  availableTags?: string[]; // Catálogo de etiquetas permanentes
  servicesCatalog?: HospitalServiceItem[]; // Catálogo de servicios configurables con color específico
  attendingPhysicians?: AttendingPhysicianItem[]; // Catálogo de médicos a cargo con personalización de color
  attendingPhysiciansCatalog?: string[]; // Compatibilidad con nombres simples de médicos a cargo
  pendingUserTags?: string[]; // Etiquetas agregadas por usuarios pendientes de aprobación permanente del Admin
  pendingUserNursingOrders?: string[]; // Órdenes agregadas por usuarios pendientes de aprobación Admin
  pendingUserServices?: HospitalServiceItem[]; // Servicios agregados por usuarios pendientes de aprobación Admin
  customFormulas?: CustomMedicalFormula[]; // Repertorio personalizable de fórmulas médicas
  subjectivePresets?: string[]; // Opciones seleccionables para Subjetivo y Evolución Sintomática en la Nota
  physicalExamTemplates?: PhysicalExamTemplateItem[]; // Plantillas pre-hechas para Exploración Física en la Nota
  dietPresets?: string[]; // Plantillas rápidas de Dieta e Hidratación Enteral
  medicationRoutesCatalog?: string[]; // Repertorio de vías de administración de medicamentos
  ahfPresets?: string[]; // Autorrelleno para Antecedentes Heredofamiliares (AHF)
  apnpPresets?: string[]; // Autorrelleno para Antecedentes Personales No Patológicos (APNP)
  appPresets?: string[]; // Autorrelleno para Antecedentes Personales Patológicos (APP)
  lastBackupTimestamp?: number; // Marca de tiempo del último respaldo (alerta cada 24h)
  activeRole?: 'admin' | 'intern'; // 'admin' (Modo Administrador) vs 'intern' (Modo Usuario)
  collaboratorName?: string; // Nombre de quien está usando la estación actualmente
}

export interface NursingOrderOption {
  id: string;
  text: string;
  category: 'Monitoreo' | 'Posición' | 'Catéteres / Vías' | 'Líquidos' | 'Seguridad';
}

