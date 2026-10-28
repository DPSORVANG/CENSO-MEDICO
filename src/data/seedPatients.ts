import type {
  Patient,
  ResidentProfile,
  ClinicalNoteRecord,
  HospitalServiceItem,
  AttendingPhysicianItem,
  CustomMedicalFormula,
  SeverityType,
  CodeStatusType,
  LabRecord,
  DiagnosticStudy,
  MedicationItem,
  ClinicalPending,
  ParenteralSolutionItem,
  PatientNursingOrderItem,
} from '../types/clinical.ts';
import { generateAuditHash } from '../utils/clinicalLogic.ts';

export const defaultServicesCatalog: HospitalServiceItem[] = [
  { id: 'srv-1', name: 'Medicina Interna Piso 3', color: '#0d9488' }, // Teal
  { id: 'srv-2', name: 'Medicina Interna Piso 4', color: '#2563eb' }, // Blue
  { id: 'srv-3', name: 'Urgencias Adultos', color: '#ea580c' }, // Orange
  { id: 'srv-4', name: 'Terapia Intermedia', color: '#7c3aed' }, // Purple
  { id: 'srv-5', name: 'Unidad de Cuidados Intensivos (UCI)', color: '#e11d48' }, // Rose
  { id: 'srv-6', name: 'Cirugía General', color: '#059669' }, // Emerald
  { id: 'srv-7', name: 'Ginecología y Obstetricia', color: '#db2777' }, // Pink
];

export const defaultAttendingPhysicianItems: AttendingPhysicianItem[] = [
  { id: 'doc-1', name: 'Dr. Roberto Méndez (MI)', color: '#0d9488' }, // Teal
  { id: 'doc-2', name: 'Dra. Patricia Vega (MI)', color: '#2563eb' }, // Blue
  { id: 'doc-3', name: 'Dr. Carlos Navarro (UCI)', color: '#e11d48' }, // Rose
  { id: 'doc-4', name: 'Dra. Sofía Alarcón (MI)', color: '#7c3aed' }, // Purple
  { id: 'doc-5', name: 'Dr. Alejandro Ríos (Urgencias)', color: '#ea580c' }, // Orange
];

export const defaultAttendingPhysicians: string[] = defaultAttendingPhysicianItems.map(
  (d) => d.name
);

export const defaultAvailableTags: string[] = [
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
];

export const defaultNursingRepository: string[] = [
  'Signos vitales por turno y avisar eventualidades (PAM < 65 o > 100, FC > 100 o < 50, Temp > 38°C)',
  'Posición semi-Fowler 30° a 45° con cabecera elevada',
  'Cuantificación estricta de uresis y balance hídrico acumulado por turno',
  'Vigilancia estrecha de datos de alarma neurológica y escala de Glasgow',
  'Cuidados de catéter venoso central / vía periférica y curación según NOM',
  'Dextrostix / Glucemia capilar preprandial y aplicar esquema si > 180 mg/dL',
  'Movilización en cama cada 2 horas y medidas de prevención de UPP',
  'Oxígeno suplementario por puntas nasales a 2-3 L/min para meta SpO2 > 92%',
  'Medición diaria de perímetro abdominal en ayuno a nivel umbilical',
  'Vigilancia de sangrado en sitios de punción y datos de sangrado de tubo digestivo',
];

export const defaultCustomFormulas: CustomMedicalFormula[] = [
  {
    id: 'form-sodio-corr',
    name: 'Sodio Corregido por Glucosa (Katz)',
    specialty: 'Medicina Interna',
    description: 'Ajuste de sodio sérico ante hiperglucemia osmótica.',
    variables: [
      { symbol: 'na', label: 'Sodio medido (mEq/L)', defaultValue: 130 },
      { symbol: 'glucosa', label: 'Glucosa sérica (mg/dL)', defaultValue: 380 },
    ],
    expression: 'na + 0.016 * (glucosa - 100)',
    resultUnit: 'mEq/L',
    interpretationHint: 'Normal: 135 - 145 mEq/L',
  },
  {
    id: 'form-anion-gap',
    name: 'Brecha Aniónica (Anion Gap)',
    specialty: 'Medicina Interna',
    description: 'Diferencia de cationes y aniones medidos para acidosis metabólica.',
    variables: [
      { symbol: 'na', label: 'Sodio (mEq/L)', defaultValue: 138 },
      { symbol: 'cl', label: 'Cloro (mEq/L)', defaultValue: 100 },
      { symbol: 'hco3', label: 'HCO3 (mEq/L)', defaultValue: 18 },
    ],
    expression: 'na - (cl + hco3)',
    resultUnit: 'mEq/L',
    interpretationHint: 'Normal: 8 - 12 mEq/L (>12 acidosis de brecha aniónica elevada)',
  },
  {
    id: 'form-osm-efectiva',
    name: 'Osmolaridad Plasmática Efectiva',
    specialty: 'Medicina Interna',
    description: 'Cálculo de tonicidad plasmática efectiva en crisis hiperglucémicas.',
    variables: [
      { symbol: 'na', label: 'Sodio (mEq/L)', defaultValue: 136 },
      { symbol: 'glucosa', label: 'Glucosa (mg/dL)', defaultValue: 360 },
    ],
    expression: '2 * na + (glucosa / 18)',
    resultUnit: 'mOsm/kg',
    interpretationHint: 'Normal: 275 - 295 mOsm/kg (>320 criterio de EHH)',
  },
  {
    id: 'form-pam',
    name: 'Presión Arterial Media (PAM)',
    specialty: 'Terapia Intensiva',
    description: 'Perfusión tisular sistémica.',
    variables: [
      { symbol: 'tas', label: 'TA Sistólica (mmHg)', defaultValue: 110 },
      { symbol: 'tad', label: 'TA Diastólica (mmHg)', defaultValue: 70 },
    ],
    expression: '(tas + 2 * tad) / 3',
    resultUnit: 'mmHg',
    interpretationHint: 'Meta en sepsis / choque: >= 65 mmHg',
  },
  {
    id: 'form-calcio-corr',
    name: 'Calcio Corregido por Albúmina',
    specialty: 'Medicina Interna',
    description: 'Ajuste de calcio total según hipoalbuminemia.',
    variables: [
      { symbol: 'ca', label: 'Calcio sérico (mg/dL)', defaultValue: 7.8 },
      { symbol: 'alb', label: 'Albúmina sérica (g/dL)', defaultValue: 2.5 },
    ],
    expression: 'ca + 0.8 * (4 - alb)',
    resultUnit: 'mg/dL',
    interpretationHint: 'Normal: 8.5 - 10.2 mg/dL',
  },
  {
    id: 'form-cockcroft',
    name: 'Depuración de Creatinina (Cockcroft-Gault Hombres)',
    specialty: 'Nefrología',
    description: 'Estimación de depuración para ajuste farmacológico rápido.',
    variables: [
      { symbol: 'edad', label: 'Edad (años)', defaultValue: 65 },
      { symbol: 'peso', label: 'Peso (kg)', defaultValue: 72 },
      { symbol: 'cr', label: 'Creatinina (mg/dL)', defaultValue: 1.4 },
    ],
    expression: '((140 - edad) * peso) / (72 * cr)',
    resultUnit: 'ml/min',
    interpretationHint: 'En mujeres multiplicar por 0.85',
  },
];

export const defaultResidentProfile: ResidentProfile = {
  name: 'Dr. González Miranda',
  hospital: 'Hospital General de Zona / Especialidades',
  service: 'Medicina Interna',
  residencyYear: 'R1 Medicina Interna',
  pinLockEnabled: false,
  servicesCatalog: defaultServicesCatalog,
  attendingPhysicians: defaultAttendingPhysicianItems,
  attendingPhysiciansCatalog: defaultAttendingPhysicians,
  customFormulas: defaultCustomFormulas,
  nursingRepository: defaultNursingRepository,
  availableTags: defaultAvailableTags,
};

const baseFourPatients: Patient[] = [
  {
    id: 'p-101',
    recordNumber: 'IM-948123-A',
    name: 'Ramírez Morales Roberto',
    age: 67,
    gender: 'Masculino',
    bed: 'Cama 301',
    service: 'Medicina Interna Piso 3',
    attendingPhysician: 'Dr. Roberto Méndez (MI)',
    admissionDate: '2026-10-10',
    status: 'active',
    severity: 'Muy Grave / UCI',
    codeStatus: 'RCP 1 (Reanimación Completa / Todo esfuerzo)',
    clinicalTags: ['Intubado / VMI', 'CVC', 'Sonda Foley'],
    allergies: 'Penicilinas (Rash y anafilaxia)',
    admissionReason: 'Fiebre, disuria, deterioro neurológico e hipotensión refractaria a cristaloides (choque séptico urinario).',
    relevantHistory: 'DM2 (20 años, insulina glargina) · HAS (12 años, losartán) · Hiperplasia prostática benigna.',
    roundsPresentationNote: 'Cumple 24h sin fiebre, en ventana de sedación (RASS -1), destete progresivo de Norepinefrina a 0.06 mcg/kg/min, uresis 1.3 ml/kg/h y Cr en franco descenso (1.8 → 1.2). Hoy candidato a protocolo de extubación.',
    criticalCareSystems: {
      enabled: true,
      neuro: {
        consciousness: 'Bajo sedación ligera reactivo al llamado',
        reflexes: 'Pupilas isocóricas 3mm normorreactivas, reflejo tusígeno y nauseoso presentes',
        sedationAnalgesia: 'Dexmedetomidina 0.4 mcg/kg/h + Fentanilo 25 mcg/h IV',
        glasgow: '10T',
        fourScore: '14',
        rass: '-1',
        notes: 'Adecuada ventana neurológica matutina, moviliza 4 extremidades.',
      },
      respiratory: {
        supportType: 'Ventilación Mecánica Invasiva (VMI - TOT #8.0)',
        ventMode: 'CPAP / PSV',
        fio2: '35%',
        peep: '6',
        tidalVolume: '460 mL (6.2 mL/kg)',
        respRateVent: '16 rpm',
        spo2: '96%',
        bloodGas: 'pH 7.39, pCO2 37, pO2 88, HCO3 22.8, Lactato 1.1, PaO2/FiO2 251',
        notes: 'Índice de Tobin 42, candidato a prueba de ventilación espontánea.',
      },
      hemodynamic: {
        hemodynamicStatus: 'Choque séptico en resolución con dosis bajas de vasopresor',
        bpAndMap: 'TA 124/76 mmHg (PAM 92 mmHg)',
        vasopressorsInotropes: 'Norepinefrina 0.06 mcg/kg/min por CVC subclavio derecho',
        hrAndRhythm: '78 lpm · Sinusal',
        notes: 'Llenado capilar 2 seg, sin moteado periférico.',
      },
      gastroMetabolic: {
        glycemias: '128 - 145 mg/dL (Glargina basal 16 UI + esquema Lispro)',
        feedingType: 'Nutrición enteral polimérica por SNG a 50 mL/h',
        abdomenAndBowel: 'Abdomen blando, peristalsis presente, 1 evacuación Bristol 4, sin residuo gástrico.',
      },
      renal: {
        diuresis: '2,150 mL/24h (1.21 mL/kg/h) por sonda Foley',
        renalFunction: 'Cr 1.2 mg/dL (previa 1.8), BUN 17.7, Urea 38, Na 139, K 4.2, Cl 102',
        fluidBalance: 'Balance 24h: -380 mL | Acumulado: +420 mL',
        diureticsOrRrt: 'Sin requerimiento de diurético ni TRR',
      },
      infectious: {
        infectionData: 'Foco urinario controlado (afebril 72h, Tmáx 36.7°C)',
        acutePhaseReactants: 'Leucocitos 8,900 (previos 13,200), PCR 12.4 mg/L (previa 48.0), Urocultivo control (-)',
        antibioticsInUse: 'Meropenem 1g IV c/8h [Día 6/10] dirigido a E. coli BLEE(+)',
      },
    },
    diagnoses: [
      '1. [CIE-10: A41.5] Choque séptico de origen urinario en resolución secundario a ITU por E. coli BLEE(+)',
      '2. [CIE-10: N17.9] Lesión Renal Aguda KDIGO 2 en resolución secundaria a sepsis',
      '3. [CIE-10: E11.9] Diabetes Mellitus tipo 2 de 20 años de evolución en control metabólico',
      '4. [CIE-10: I10] Hipertensión Arterial Sistémica estadio 2',
    ],
    initialDiagnoses: [
      '1. [CIE-10: A41.9] Choque séptico de foco urinario',
      '2. [CIE-10: N17.9] Lesión Renal Aguda KDIGO 3',
    ],
    vitals: {
      bp: '124/76',
      hr: '78',
      rr: '16',
      temp: '36.6',
      spo2: '96',
      glucose: '138',
      weightKg: 74,
    },
    diet: 'Dieta polimérica por SNG 1500 kcal en 4 tomas',
    ivFluids: 'Sol. Hartmann 1000 ml p/24h (42 ml/h) + Norepinefrina 8mg en 100ml SG5% p/PAM >65',
    structuredSolutions: [
      {
        id: 'sol-101-1',
        category: 'solucion',
        solutionType: 'Solución Hartmann',
        volume: '1000 ml',
        route: 'CVC',
        infusionRate: 'p/24h (42 ml/h)',
      },
      {
        id: 'sol-101-2',
        category: 'infusion',
        solutionType: 'Glucosada 5%',
        volume: '100 ml',
        addedConcentrateOrMed: 'Norepinefrina 8 mg',
        concentration: '80 mcg/mL',
        route: 'CVC',
        infusionRate: 'a 3.3 ml/h (0.06 mcg/kg/min)',
        specialNotes: 'Titular para mantener PAM >= 65 mmHg',
      },
    ],
    structuredNursingOrders: [
      { id: 'no-101-1', text: 'Signos vitales por hora y registro en hoja de terapia', note: 'Avisar si PAM < 65 mmHg', active: true },
      { id: 'no-101-2', text: 'Posición semi-Fowler 30° a 45° con cabecera elevada', active: true },
      { id: 'no-101-3', text: 'Cuantificación estricta de uresis horaria por sonda Foley y balance hídrico por turno', active: true },
      { id: 'no-101-4', text: 'Aspiración de secreciones por TOT según requerimiento con técnica cerrada', active: true },
    ],
    nursingOrders: [
      'Signos vitales por hora y registro en hoja de terapia (Avisar si PAM < 65 mmHg)',
      'Posición semi-Fowler 30° a 45° con cabecera elevada',
      'Cuantificación estricta de uresis horaria por sonda Foley y balance hídrico por turno',
      'Aspiración de secreciones por TOT según requerimiento con técnica cerrada',
    ],
    medications: [
      {
        id: 'm-1',
        name: 'Meropenem',
        dose: '1 g',
        route: 'IV',
        frequency: 'cada 8 hrs',
        isAntibiotic: true,
        startDate: '2026-10-18',
        plannedDays: 10,
        indication: 'ITU complicada BLEE(+)',
        active: true,
      },
      {
        id: 'm-2',
        name: 'Insulina Glargina',
        dose: '16 UI',
        route: 'SC',
        frequency: 'cada 24 hrs (21:00)',
        isAntibiotic: false,
        startDate: '2026-10-12',
        active: true,
      },
      {
        id: 'm-3',
        name: 'Enoxaparina',
        dose: '40 mg',
        route: 'SC',
        frequency: 'cada 24 hrs',
        isAntibiotic: false,
        startDate: '2026-10-10',
        active: true,
      },
      {
        id: 'm-4',
        name: 'Omeprazol',
        dose: '40 mg',
        route: 'IV',
        frequency: 'cada 24 hrs',
        isAntibiotic: false,
        startDate: '2026-10-10',
        active: true,
      },
    ],
    labs: [
      {
        id: 'lab-3',
        date: '2026-10-23',
        time: '06:30',
        hb: 10.4,
        hematocrit: '31.8',
        leucos: 8900,
        neutrophils: '66',
        lymphocytes: '24',
        plaquetas: 215000,
        glucosa: 138,
        creatinina: 1.2,
        urea: 38,
        bun: 17.7,
        na: 139,
        k: 4.2,
        cl: 102,
        calcium: '8.9',
        phosphorus: '3.5',
        magnesium: '2.0',
        biliTotal: '0.9',
        biliDirect: '0.3',
        ast: '29',
        alt: '32',
        albumin: '3.3',
        ph: 7.39,
        pco2: 37,
        po2: 88,
        hco3: 22.8,
        lactato: 1.1,
        tp: '12.4',
        inr: '1.08',
        ttpa: '29.5',
        pcr: 12.4,
        procalcitonina: 0.42,
        otherNotes: 'Urocultivo de control negativo.',
      },
      {
        id: 'lab-2',
        date: '2026-10-20',
        time: '07:00',
        hb: 9.8,
        hematocrit: '30.1',
        leucos: 13200,
        neutrophils: '78',
        lymphocytes: '14',
        plaquetas: 198000,
        glucosa: 165,
        creatinina: 1.8,
        urea: 62,
        bun: 29.0,
        na: 137,
        k: 4.5,
        cl: 100,
        calcium: '8.5',
        phosphorus: '4.1',
        magnesium: '1.8',
        biliTotal: '1.4',
        biliDirect: '0.6',
        ast: '46',
        alt: '51',
        albumin: '3.0',
        ph: 7.34,
        pco2: 35,
        po2: 79,
        hco3: 19.6,
        lactato: 1.9,
        tp: '13.8',
        inr: '1.22',
        ttpa: '32.0',
        pcr: 48.0,
        procalcitonina: 2.8,
      },
      {
        id: 'lab-1',
        date: '2026-10-15',
        time: '06:45',
        hb: 9.2,
        hematocrit: '28.4',
        leucos: 19400,
        neutrophils: '88',
        lymphocytes: '7',
        plaquetas: 165000,
        glucosa: 240,
        creatinina: 2.6,
        urea: 94,
        bun: 43.9,
        na: 134,
        k: 4.9,
        cl: 98,
        calcium: '8.1',
        phosphorus: '4.8',
        magnesium: '1.6',
        biliTotal: '1.9',
        biliDirect: '0.9',
        ast: '68',
        alt: '74',
        albumin: '2.8',
        ph: 7.26,
        pco2: 32,
        po2: 71,
        hco3: 15.4,
        lactato: 3.2,
        tp: '15.2',
        inr: '1.38',
        ttpa: '36.4',
        pcr: 120.0,
        procalcitonina: 9.6,
      },
    ],
    studies: [
      {
        id: 'std-101',
        category: 'Cultivo / Microbiología',
        title: 'Urocultivo cuantitativo con antibiograma',
        summary: '> 100,000 UFC/mL de E. coli productora de BLEE sensible a carbapenémicos y amikacina, resistente a quinolonas y cefalosporinas.',
        date: '2026-10-23',
        time: '11:30',
        isNew: true,
      },
      {
        id: 'std-102',
        category: 'Ultrasonido',
        title: 'USG Renal y de Vías Urinarias',
        summary: 'Riñones de forma y tamaño normal. Sin ectasia pielocalicial ni litiasis evidente.',
        date: '2026-10-21',
        time: '10:00',
        isNew: false,
      },
    ],
    pendings: [
      {
        id: 'pen-1',
        text: 'INTERCONSULTA: Valoración por Nefrología para ajuste de egreso',
        category: 'Interconsulta',
        priority: 'Media',
        urgencyColor: 'yellow',
        workflowStage: 'collect',
        completed: false,
        createdAt: '2026-10-23',
      },
      {
        id: 'pen-2',
        text: 'ESTUDIO DE IMAGEN: USG renal de control para descartar litiasis residual',
        category: 'Imagen/Gabinete',
        priority: 'Alta',
        urgencyColor: 'red',
        workflowStage: 'take',
        completed: false,
        createdAt: '2026-10-23',
      },
    ],
    evolutionSummary: 'Franca mejoría clínica. Afebril desde hace 72 hrs. Gasto urinario > 1 ml/kg/h. TFG recuperada.',
    lastUpdated: '2026-10-27T08:00:00Z',
  },
  {
    id: 'p-102',
    recordNumber: 'IM-882041-B',
    name: 'Castillo Hernández Elena',
    age: 72,
    gender: 'Femenino',
    bed: 'Cama 401',
    service: 'Medicina Interna Piso 4',
    attendingPhysician: 'Dra. Patricia Vega (MI)',
    admissionDate: '2026-10-20',
    status: 'active',
    severity: 'Grave',
    codeStatus: 'RCP 2 (Manejo Intermedio / Limitado / No IOT)',
    clinicalTags: ['CPAP / BiPAP', 'Aislado Respiratorio'],
    allergies: 'Negadas',
    admissionReason: 'Disnea de pequeños esfuerzos, tos productiva purulenta y desaturación hasta 78% al aire ambiente.',
    relevantHistory: 'EPOC GOLD 3 (índice tabáquico 42 paq/año, O2 suplementario nocturno) · Cardiopatía hipertensiva.',
    roundsPresentationNote: 'Mejor mecánica ventilatoria con BiPAP intermitente (IPAP 14 / EPAP 6, FiO2 40%), SpO2 91-93%, descenso de leucocitos (21.5k → 14.8k) y pCO2 en descenso (49 → 44 mmHg). Familiar ratifica RCP 2 (No IOT).',
    criticalCareSystems: {
      enabled: true,
      neuro: {
        consciousness: 'Alerta y orientada en 3 esferas, sin encefalopatía hipercápnica',
        reflexes: 'Pupilas isocóricas normorreactivas',
        sedationAnalgesia: 'Sin sedación',
        glasgow: '15',
        rass: '0',
      },
      respiratory: {
        supportType: 'Ventilación Mecánica No Invasiva (VMNI - CPAP / BiPAP)',
        ventMode: 'BiPAP S/T (IPAP 14 / EPAP 6 cmH2O)',
        fio2: '40%',
        peep: '6',
        tidalVolume: '390 mL',
        respRateVent: '24 rpm',
        spo2: '91%',
        bloodGas: 'pH 7.36, pCO2 44 (prev 49), pO2 68, HCO3 24.2, Lactato 1.4',
        notes: 'Estertores subcrepitantes basales derechos; menor uso de músculos accesorios.',
      },
      hemodynamic: {
        hemodynamicStatus: 'Estable sin apoyo vasopresor',
        bpAndMap: 'TA 105/65 mmHg (PAM 78 mmHg)',
        vasopressorsInotropes: 'Sin vasopresores',
        hrAndRhythm: '92 lpm · Sinusal',
      },
      gastroMetabolic: {
        glycemias: '124 mg/dL en ayuno',
        feedingType: 'Vía oral blanda asistida en ventanas de BiPAP',
        abdomenAndBowel: 'Sin distensión abdominal, tránsito intestinal conservado.',
      },
      renal: {
        diuresis: '1,450 mL/24h (0.97 mL/kg/h) espontánea',
        renalFunction: 'Cr 0.9 mg/dL, BUN 15.0, Na 138, K 4.1',
        fluidBalance: 'Balance 24h: -120 mL (neutro)',
        diureticsOrRrt: 'Sin diuréticos',
      },
      infectious: {
        infectionData: 'Foco pulmonar derecho (febrícula aislada 37.8°C vespertina)',
        acutePhaseReactants: 'Leucocitos 14,800 (previos 21,500), Hemocultivos x2 en incubación (72h)',
        antibioticsInUse: 'Ceftriaxona 2g IV c/24h [Día 4/7] + Claritromicina 500mg IV c/12h [Día 4/7]',
      },
    },
    diagnoses: [
      '1. [CIE-10: J18.9] Neumonía adquirida en la comunidad grave (CURB-65 3 puntos)',
      '2. [CIE-10: J96.0] Insuficiencia respiratoria aguda tipo 1 en manejo con CPAP / BiPAP',
      '3. [CIE-10: J44.1] Enfermedad Pulmonar Obstructiva Crónica (EPOC) estadio GOLD 3 agudizado',
    ],
    studies: [
      {
        id: 'std-201',
        category: 'TAC',
        title: 'TAC de Tórax Simple de Alta Resolución',
        summary: 'Consolidación alveolar con broncograma aéreo en lóbulo inferior derecho y língula. Enfisema centrolobulillar y paraseptal difuso.',
        date: '2026-10-23',
        time: '13:00',
        isNew: true,
      },
      {
        id: 'std-202',
        category: 'Radiografía',
        title: 'Radiografía de Tórax portátil AP',
        summary: 'Radioopacidad heterogénea basal derecha en mejoría.',
        date: '2026-10-21',
        isNew: false,
      },
    ],
    vitals: {
      bp: '105/65',
      hr: '92',
      rr: '24',
      temp: '37.8',
      spo2: '91',
      glucose: '124',
      weightKg: 62,
    },
    diet: 'Dieta blanda hiperproteica asistida en ventanas de VMNI',
    ivFluids: 'Sol. Salina 0.9% 500 ml p/24h (21 ml/h) para mantener vía permeable',
    medications: [
      {
        id: 'm-201',
        name: 'Ceftriaxona',
        dose: '2 g',
        route: 'IV',
        frequency: 'cada 24 hrs',
        isAntibiotic: true,
        startDate: '2026-10-22',
        plannedDays: 7,
        indication: 'NAC grave',
        active: true,
      },
      {
        id: 'm-202',
        name: 'Claritromicina',
        dose: '500 mg',
        route: 'IV',
        frequency: 'cada 12 hrs',
        isAntibiotic: true,
        startDate: '2026-10-22',
        plannedDays: 7,
        indication: 'Cobertura atípicos NAC',
        active: true,
      },
      {
        id: 'm-203',
        name: 'Metilprednisolona',
        dose: '40 mg',
        route: 'IV',
        frequency: 'cada 12 hrs',
        isAntibiotic: false,
        isLimitedCourse: true,
        startDate: '2026-10-24',
        plannedDays: 5,
        indication: 'Curso corto esteroide por EPOC agudizado',
        active: true,
      },
      {
        id: 'm-204',
        name: 'Bromuro de Ipratropio / Salbutamol',
        dose: '1 dosis',
        route: 'Inhalada',
        frequency: 'cada 6 hrs',
        isAntibiotic: false,
        startDate: '2026-10-20',
        active: true,
      },
    ],
    labs: [
      {
        id: 'lab-202',
        date: '2026-10-23',
        time: '06:00',
        hb: 12.1,
        leucos: 14800,
        neutrophils: '76',
        lymphocytes: '16',
        plaquetas: 240000,
        glucosa: 124,
        creatinina: 0.9,
        urea: 32,
        bun: 15.0,
        na: 138,
        k: 4.1,
        cl: 101,
        calcium: '9.0',
        phosphorus: '3.4',
        magnesium: '2.1',
        albumin: '3.5',
        ast: '26',
        alt: '24',
        ph: 7.36,
        po2: 68,
        pco2: 44,
        hco3: 24.2,
        lactato: 1.4,
        pcr: 34.0,
        procalcitonina: 0.55,
        bnp: '310',
      },
      {
        id: 'lab-201',
        date: '2026-10-20',
        time: '18:00',
        hb: 12.8,
        leucos: 21500,
        neutrophils: '86',
        lymphocytes: '9',
        plaquetas: 260000,
        glucosa: 150,
        creatinina: 1.1,
        urea: 44,
        bun: 20.5,
        na: 135,
        k: 4.4,
        cl: 99,
        calcium: '8.8',
        phosphorus: '3.7',
        magnesium: '1.9',
        albumin: '3.3',
        ast: '34',
        alt: '30',
        ph: 7.31,
        po2: 52,
        pco2: 49,
        hco3: 23.8,
        lactato: 2.3,
        pcr: 88.0,
        procalcitonina: 1.9,
        bnp: '460',
      },
    ],
    pendings: [
      {
        id: 'pen-201',
        text: 'ESTUDIO DE IMAGEN: Tomografía de tórax de alta resolución',
        category: 'Imagen/Gabinete',
        priority: 'Alta',
        urgencyColor: 'red',
        workflowStage: 'register_census',
        completed: false,
        createdAt: '2026-10-23',
      },
      {
        id: 'pen-202',
        text: 'TOMA DE LABORATORIOS: Revisar reporte de hemocultivos x 2 a 72 hrs',
        category: 'Laboratorio',
        priority: 'Alta',
        urgencyColor: 'yellow',
        workflowStage: 'collect',
        completed: false,
        createdAt: '2026-10-23',
      },
    ],
    evolutionSummary: 'Persiste con requerimiento de O2 suplementario. Familiar enterado y ratifica RCP 2 / No IOT.',
    lastUpdated: '2026-10-27T07:30:00Z',
  },
  {
    id: 'p-103',
    recordNumber: 'IM-771920-C',
    name: 'Vázquez Trejo Andrés',
    age: 48,
    gender: 'Masculino',
    bed: 'Cama 302',
    service: 'Medicina Interna Piso 3',
    attendingPhysician: 'Dr. Roberto Méndez (MI)',
    admissionDate: '2026-10-21',
    status: 'active',
    severity: 'Estable',
    codeStatus: 'RCP 1 (Reanimación Completa / Todo esfuerzo)',
    clinicalTags: ['Ayuno', 'CVC'],
    allergies: 'Sulfamidas (urticaria)',
    admissionReason: 'Polidipsia, poliuria, vómito incoercible, respiración de Kussmaul y glucemia de 480 mg/dL con pH 7.18.',
    relevantHistory: 'Debut de Diabetes Mellitus tipo 1 · Sin crónico-degenerativos previos.',
    roundsPresentationNote: 'Brecha aniónica cerrada (pH 7.41, HCO3 23.5), tolerando vía oral al 100%, transición exitosa a esquema subcutáneo Degludec + Lispro. Listo para alta hoy.',
    diagnoses: [
      '1. [CIE-10: E10.1] Cetoacidosis diabética moderada resuelta',
      '2. [CIE-10: E10.9] Diabetes Mellitus tipo 1 de reciente diagnóstico',
      '3. [CIE-10: E87.6] Hipokalemia corregida',
    ],
    vitals: {
      bp: '118/72',
      hr: '74',
      rr: '16',
      temp: '36.4',
      spo2: '98',
      glucose: '142',
      weightKg: 68,
    },
    diet: 'Dieta para diabético 1800 kcal sin azúcares simples',
    ivFluids: 'Catéter venoso salinizado',
    medications: [
      {
        id: 'm-301',
        name: 'Insulina Lispro',
        dose: '4-6 UI',
        route: 'SC',
        frequency: 'preprandial según escala',
        isAntibiotic: false,
        startDate: '2026-10-22',
        active: true,
      },
      {
        id: 'm-302',
        name: 'Insulina Degludec',
        dose: '14 UI',
        route: 'SC',
        frequency: 'cada 24 hrs',
        isAntibiotic: false,
        startDate: '2026-10-22',
        active: true,
      },
    ],
    labs: [
      {
        id: 'lab-302',
        date: '2026-10-23',
        time: '06:15',
        hb: 14.2,
        leucos: 7800,
        plaquetas: 290000,
        glucosa: 142,
        creatinina: 0.8,
        urea: 26,
        bun: 12.1,
        na: 140,
        k: 4.3,
        cl: 104,
        calcium: '9.2',
        phosphorus: '3.6',
        magnesium: '2.1',
        ph: 7.41,
        pco2: 38,
        hco3: 23.5,
        lactato: 0.9,
      },
      {
        id: 'lab-301',
        date: '2026-10-21',
        time: '14:00',
        hb: 15.1,
        leucos: 14200,
        plaquetas: 310000,
        glucosa: 480,
        creatinina: 1.4,
        urea: 58,
        bun: 27.1,
        na: 132,
        k: 3.1,
        cl: 99,
        calcium: '8.7',
        phosphorus: '2.4',
        magnesium: '1.7',
        ph: 7.18,
        pco2: 22,
        hco3: 9.8,
        lactato: 2.1,
      },
    ],
    pendings: [
      {
        id: 'pen-301',
        text: 'ALTA: Programar egreso matutino con receta de insulina basal-bolo',
        category: 'Alta Hospitalaria',
        priority: 'Alta',
        urgencyColor: 'red',
        isDischargePending: true,
        completed: false,
        createdAt: '2026-10-23',
      },
      {
        id: 'pen-302',
        text: 'TOMA DE LABORATORIOS: BH, QS6 y ES3 de control previo a egreso',
        customDetails: 'BH, QS6 y ES3 de control previo a egreso',
        category: 'Laboratorio',
        priority: 'Media',
        urgencyColor: 'yellow',
        workflowStage: 'take',
        completed: false,
        createdAt: '2026-10-23',
      },
    ],
    evolutionSummary: 'Brecha aniónica cerrada. Tolerando vía oral. Esquema basal-bolo establecido.',
    lastUpdated: '2026-10-27T08:15:00Z',
  },
  {
    id: 'p-104',
    recordNumber: 'IM-552918-D',
    name: 'Salgado Mendoza Lucía',
    age: 59,
    gender: 'Femenino',
    bed: 'Cama 402',
    service: 'Medicina Interna Piso 4',
    attendingPhysician: 'Dra. Sofía Alarcón (MI)',
    admissionDate: '2026-10-18',
    status: 'active',
    severity: 'Delicado',
    codeStatus: 'RCP 3 (No Reanimación / Voluntad Anticipada / Paliativo)',
    clinicalTags: ['RCP 3 (No RCP / Voluntad)', 'Sonda Foley'],
    allergies: 'Negadas',
    admissionReason: 'Aumento progresivo de perímetro abdominal por ascitis a tensión, inversión del ciclo sueño-vigilia y asterixis.',
    relevantHistory: 'Cirrosis hepática por MASH (Child-Pugh B 8 pts, MELD-Na 17) · Paracentesis evacuadora previa hace 3 meses.',
    roundsPresentationNote: 'Sin asterixis, orientada, 3 evacuaciones blandas con lactulosa, pérdida ponderal de 800g/día con doble diurético sin deterioro renal (Cr 0.8). Pendiente endoscopia.',
    diagnoses: [
      '1. [CIE-10: K74.6] Cirrosis hepática descompensada secundario a MASH (Child-Pugh B 8 pts, MELD-Na 17)',
      '2. [CIE-10: R18] Síndrome ascítico en resolución con manejo diurético',
      '3. [CIE-10: K72.9] Encefalopatía hepática West-Haven grado 1 resuelta',
    ],
    vitals: {
      bp: '110/68',
      hr: '70',
      rr: '17',
      temp: '36.5',
      spo2: '97',
      glucose: '108',
      weightKg: 65,
    },
    diet: 'Dieta hiposódica (<2g Na/día) hiperproteica vegetal 1600 kcal',
    ivFluids: 'Sin soluciones parenterales (restricción hídrica a 1200 ml/día)',
    medications: [
      {
        id: 'm-401',
        name: 'Espironolactona',
        dose: '100 mg',
        route: 'VO',
        frequency: 'cada 24 hrs',
        isAntibiotic: false,
        startDate: '2026-10-19',
        active: true,
      },
      {
        id: 'm-402',
        name: 'Furosemida',
        dose: '40 mg',
        route: 'VO',
        frequency: 'cada 24 hrs',
        isAntibiotic: false,
        startDate: '2026-10-19',
        active: true,
      },
      {
        id: 'm-403',
        name: 'Rifaximina',
        dose: '550 mg',
        route: 'VO',
        frequency: 'cada 12 hrs',
        isAntibiotic: true,
        startDate: '2026-10-18',
        plannedDays: 30,
        indication: 'Prevención secundaria de encefalopatía hepática',
        active: true,
      },
      {
        id: 'm-404',
        name: 'Lactulosa',
        dose: '15 ml',
        route: 'VO',
        frequency: 'cada 8 hrs (titular a 3 evacuaciones blandas)',
        isAntibiotic: false,
        startDate: '2026-10-18',
        active: true,
      },
    ],
    labs: [
      {
        id: 'lab-402',
        date: '2026-10-23',
        time: '06:30',
        hb: 11.2,
        leucos: 5600,
        plaquetas: 88000,
        glucosa: 108,
        creatinina: 0.8,
        urea: 28,
        bun: 13.1,
        na: 136,
        k: 4.4,
        cl: 102,
        calcium: '8.4',
        phosphorus: '3.2',
        magnesium: '1.9',
        biliTotal: '2.4',
        biliDirect: '1.5',
        ast: '58',
        alt: '44',
        alp: '132',
        ggt: '96',
        albumin: '2.7',
        tp: '16.4',
        inr: '1.45',
        ttpa: '35.0',
      },
      {
        id: 'lab-401',
        date: '2026-10-19',
        time: '06:40',
        hb: 10.9,
        leucos: 6400,
        plaquetas: 82000,
        glucosa: 116,
        creatinina: 1.05,
        urea: 41,
        bun: 19.2,
        na: 132,
        k: 4.7,
        cl: 99,
        calcium: '8.1',
        phosphorus: '3.5',
        magnesium: '1.7',
        biliTotal: '3.2',
        biliDirect: '2.1',
        ast: '79',
        alt: '61',
        alp: '158',
        ggt: '124',
        albumin: '2.5',
        tp: '18.2',
        inr: '1.62',
        ttpa: '38.5',
      },
    ],
    pendings: [
      {
        id: 'pen-401',
        text: 'Citoquímico y cultivo de líquido ascítico de paracentesis diagnóstica',
        category: 'Laboratorio',
        priority: 'Media',
        completed: true,
        createdAt: '2026-10-19',
      },
      {
        id: 'pen-402',
        text: 'Endoscopia de tubo digestivo alto para tamizaje de várices esofágicas',
        category: 'Procedimiento',
        priority: 'Media',
        urgencyColor: 'yellow',
        completed: false,
        createdAt: '2026-10-23',
      },
    ],
    evolutionSummary: 'Sin datos de peritonitis bacteriana espontánea. Perímetro abdominal en decremento.',
    lastUpdated: '2026-10-27T08:30:00Z',
  },
];

// Deterministic realistic hospital patient generator for stress-testing up to 100 patients
const LAST_NAMES_1 = [
  'Hernández', 'García', 'Martínez', 'López', 'González', 'Pérez', 'Rodríguez', 'Sánchez',
  'Ramírez', 'Cruz', 'Flores', 'Gómez', 'Morales', 'Vázquez', 'Reyes', 'Jiménez',
  'Torres', 'Díaz', 'Gutiérrez', 'Ruiz', 'Mendoza', 'Aguilar', 'Ortiz', 'Moreno',
  'Castillo', 'Romero', 'Álvarez', 'Méndez', 'Chávez', 'Rivera', 'Juárez', 'Domínguez',
];

const LAST_NAMES_2 = [
  'Silva', 'Vargas', 'Ramos', 'Castro', 'Ortega', 'Rubio', 'Delgado', 'Suárez',
  'Navarro', 'Rojas', 'Medina', 'Ibarra', 'Salazar', 'Contreras', 'Estrada', 'Bautista',
  'Cortés', 'Lara', 'Cervantes', 'Núñez', 'Sandoval', 'Valdez', 'Ríos', 'Miranda',
];

const MALE_NAMES = [
  'Carlos', 'Alejandro', 'Fernando', 'Jorge', 'Luis', 'Ricardo', 'Eduardo', 'Miguel',
  'Francisco', 'Arturo', 'Javier', 'Héctor', 'Sergio', 'Manuel', 'Raúl', 'Gustavo',
  'Óscar', 'Alberto', 'Daniel', 'Rubén', 'Enrique', 'Víctor', 'Guillermo', 'Armando',
];

const FEMALE_NAMES = [
  'María Elena', 'Guadalupe', 'Rosa María', 'Patricia', 'Leticia', 'Margarita', 'Verónica', 'Silvia',
  'Gabriela', 'Adriana', 'Laura', 'Teresa', 'Josefina', 'Beatriz', 'Martha', 'Alejandra',
  'Carmen', 'Irma', 'Claudia', 'Yolanda', 'Gloria', 'Rocío', 'Araceli', 'Cecilia',
];

interface ClinicalArchetype {
  title: string;
  diagnoses: string[];
  admissionReason: string;
  relevantHistory: string;
  roundsNote: string;
  evolutionSummary: string;
  diet: string;
  dietSpecialNotes: string;
  severity: SeverityType;
  codeStatus: CodeStatusType;
  tags: string[];
  allergies: string;
  antibiotics: Array<{
    name: string;
    dose: string;
    route: string;
    frequency: string;
    plannedDays: number;
    indication: string;
  }>;
  supportMeds: Array<{
    name: string;
    dose: string;
    route: string;
    frequency: string;
    isLimitedCourse?: boolean;
    plannedDays?: number;
  }>;
  solutions: Array<{
    category: 'solucion' | 'infusion';
    solutionType: string;
    volume: string;
    addedConcentrateOrMed?: string;
    concentration?: string;
    route: 'IV' | 'CVC';
    infusionRate: string;
    specialNotes?: string;
  }>;
  studyTitle: string;
  studyCategory: DiagnosticStudy['category'];
  studySummary: string;
  criticalSystems?: boolean;
}

const CLINICAL_ARCHETYPES: ClinicalArchetype[] = [
  {
    title: 'Insuficiencia Cardíaca Agudizada Wet-Warm',
    diagnoses: [
      '1. [CIE-10: I50.1] Insuficiencia cardíaca crónica agudizada perfil Stevenson B (húmedo-caliente) con FEVI reducida (32%)',
      '2. [CIE-10: I48.2] Fibrilación auricular permanente con respuesta ventricular controlada',
      '3. [CIE-10: N17.9] Síndrome cardiorrenal tipo 1 en mejoría',
      '4. [CIE-10: I10] Hipertensión arterial sistémica de larga evolución',
    ],
    admissionReason: 'Ortopnea de 3 almohadas, disnea paroxística nocturna, edema de miembros pélvicos +++ y estertores crepitantes bilaterales.',
    relevantHistory: 'Cardiopatía isquémica con IAM anteroseptal hace 5 años · Portador de FA en manejo con Apixabán · DM2 de 15 años.',
    roundsNote: 'Balance negativo acumulado de -2,400 mL en 48h con perfusión de furosemida, sin ortopnea, campos pulmonares con estertores únicamente subescapulares y Cr estable en 1.3 mg/dL. Hoy se inicia transición a diurético vía oral y dapagliflozina.',
    evolutionSummary: 'Franca descongestión pulmonar y periférica. NT-proBNP en descenso. Tolerando titulación de cuádruple terapia.',
    diet: 'Dieta cardioprotectora hiposódica (<1.5g Na/día) con restricción hídrica a 1,200 mL/24h',
    dietSpecialNotes: 'Control estricto de líquidos ingeridos por turno; pesar diariamente en ayuno',
    severity: 'Delicado',
    codeStatus: 'RCP 1 (Reanimación Completa / Todo esfuerzo)',
    tags: ['Sonda Foley'],
    allergies: 'IECA (tos seca crónica)',
    antibiotics: [],
    supportMeds: [
      { name: 'Furosemida', dose: '40 mg', route: 'IV', frequency: 'cada 8 hrs' },
      { name: 'Sacubitrilo / Valsartán', dose: '50 mg', route: 'VO', frequency: 'cada 12 hrs' },
      { name: 'Dapagliflozina', dose: '10 mg', route: 'VO', frequency: 'cada 24 hrs' },
      { name: 'Espironolactona', dose: '25 mg', route: 'VO', frequency: 'cada 24 hrs' },
      { name: 'Apixabán', dose: '5 mg', route: 'VO', frequency: 'cada 12 hrs' },
    ],
    solutions: [
      {
        category: 'solucion',
        solutionType: 'Catéter venoso salinizado',
        volume: '0 ml',
        route: 'IV',
        infusionRate: 'Vía permeable con restricción hídrica',
      },
    ],
    studyTitle: 'Ecocardiograma Transtorácico Doppler Color',
    studyCategory: 'Ecocardiograma',
    studySummary: 'Ventrículo izquierdo dilatado con hipocinesia global y acinesia anteroseptal, FEVI 32%, insuficiencia mitral funcional moderada, PSAP 48 mmHg.',
  },
  {
    title: 'Neumonía Nosocomial en VMI + Choque Séptico',
    diagnoses: [
      '1. [CIE-10: J15.0] Neumonía asociada a la ventilación mecánica por Klebsiella pneumoniae',
      '2. [CIE-10: J80] Síndrome de Distrés Respiratorio Agudo (SDRA) moderado (PaO2/FiO2 168)',
      '3. [CIE-10: R65.21] Choque séptico pulmonar con requerimiento vasopresor',
      '4. [CIE-10: E11.9] Diabetes Mellitus tipo 2 descompensada',
    ],
    admissionReason: 'Fiebre de 39.1°C, secreciones bronquiales purulentas abundantes, caída de PaO2/FiO2 a 140 e hipotensión arterial.',
    relevantHistory: 'Tabaquismo 30 paq/año · HAS 15 años · Intubación endotraqueal hace 6 días por insuficiencia respiratoria hipoxémica.',
    roundsNote: 'Bajo sedoanalgesia RASS -2, ventilación protectora (Vt 6 ml/kg, PEEP 10, FiO2 45%, presión meseta 22 cmH2O), PaO2/FiO2 subió de 140 a 185. Norepinefrina en descenso a 0.08 mcg/kg/min y procalcitonina bajó de 14.2 a 4.6 ng/mL.',
    evolutionSummary: 'Mejoría gasométrica y hemodinámica tras ajuste dirigido a Linezolid + Cefepime. Uresis conservada.',
    diet: 'Nutrición enteral polimérica hiperproteica por SNG 1,600 kcal en infusión continua a 65 mL/h',
    dietSpecialNotes: 'Verificar residuo gástrico cada 6 horas y mantener cabecera a 35° estrictos',
    severity: 'Muy Grave / UCI',
    codeStatus: 'RCP 1 (Reanimación Completa / Todo esfuerzo)',
    tags: ['Intubado / VMI', 'CVC', 'Sonda Foley', 'Sonda Nasogástrica', 'Aislado de Contacto'],
    allergies: 'Negadas',
    antibiotics: [
      { name: 'Cefepime', dose: '2 g', route: 'IV', frequency: 'cada 8 hrs', plannedDays: 8, indication: 'NAV por K. pneumoniae' },
      { name: 'Linezolid', dose: '600 mg', route: 'IV', frequency: 'cada 12 hrs', plannedDays: 7, indication: 'Cobertura MRSA pulmonar' },
    ],
    supportMeds: [
      { name: 'Hidrocortisona', dose: '50 mg', route: 'IV', frequency: 'cada 6 hrs', isLimitedCourse: true, plannedDays: 5 },
      { name: 'Enoxaparina', dose: '60 mg', route: 'SC', frequency: 'cada 24 hrs' },
      { name: 'Omeprazol', dose: '40 mg', route: 'IV', frequency: 'cada 24 hrs' },
    ],
    solutions: [
      {
        category: 'solucion',
        solutionType: 'Solución Hartmann',
        volume: '1000 ml',
        route: 'CVC',
        infusionRate: 'p/24h (42 ml/h)',
      },
      {
        category: 'infusion',
        solutionType: 'Solución Salina 0.9%',
        volume: '100 ml',
        addedConcentrateOrMed: 'Norepinefrina 8 mg',
        concentration: '80 mcg/mL',
        route: 'CVC',
        infusionRate: 'a 4.2 ml/h (0.08 mcg/kg/min)',
        specialNotes: 'Meta PAM >= 65 mmHg',
      },
      {
        category: 'infusion',
        solutionType: 'Solución Salina 0.9%',
        volume: '100 ml',
        addedConcentrateOrMed: 'Dexmedetomidina 400 mcg',
        concentration: '4 mcg/mL',
        route: 'CVC',
        infusionRate: 'a 7 ml/h (RASS meta -1 a -2)',
      },
    ],
    studyTitle: 'TAC de Tórax Simple y cultivo de aspirado bronquial',
    studyCategory: 'TAC',
    studySummary: 'Consolidación bibasal de predominio posterior con broncograma aéreo y vidrio despulido perilesional; sin derrame pleural tabicado.',
    criticalSystems: true,
  },
  {
    title: 'Pancreatitis Aguda Biliar Moderadamente Grave (BISAP 2)',
    diagnoses: [
      '1. [CIE-10: K85.1] Pancreatitis aguda de etiología biliar moderadamente grave (Balthazar D, BISAP 2 puntos)',
      '2. [CIE-10: K80.2] Colelitiasis sintomática sin colecistitis aguda',
      '3. [CIE-10: E86.0] Deshidratación isotónica corregida',
    ],
    admissionReason: 'Dolor epigástrico transfictivo en cinturón EVA 9/10, náusea, vómito gastrobiliar y lipasa sérica de 2,840 U/L.',
    relevantHistory: 'Obesidad grado 1 (IMC 32.4 kg/m2) · Dislipidemia mixta · Cólico biliar recurrente desde hace 4 meses.',
    roundsNote: 'Dolor abdominal controlado EVA 2/10 con buprenorfina, peristalsis normoactiva, hoy reinicia vía oral con dieta líquida clara y baja en grasas. Hematocrito y BUN en descenso tras reanimación dirigida con Hartmann.',
    evolutionSummary: 'Resolución del SIRS a las 48h. Sin falla orgánica persistente. En protocolo para colecistectomía laparoscópica en el mismo internamiento.',
    diet: 'Dieta blanda hipograsa progresiva según tolerancia oral',
    dietSpecialNotes: 'Suspender vía oral y avisar si reaparece dolor abdominal o vómito',
    severity: 'Delicado',
    codeStatus: 'RCP 1 (Reanimación Completa / Todo esfuerzo)',
    tags: ['Sonda Foley'],
    allergies: 'AINEs (Ketorolaco produce broncoespasmo)',
    antibiotics: [],
    supportMeds: [
      { name: 'Buprenorfina', dose: '150 mcg', route: 'IV', frequency: 'cada 8 hrs' },
      { name: 'Ondansetrón', dose: '8 mg', route: 'IV', frequency: 'cada 8 hrs' },
      { name: 'Omeprazol', dose: '40 mg', route: 'IV', frequency: 'cada 24 hrs' },
      { name: 'Enoxaparina', dose: '40 mg', route: 'SC', frequency: 'cada 24 hrs' },
    ],
    solutions: [
      {
        category: 'solucion',
        solutionType: 'Solución Hartmann',
        volume: '1000 ml',
        route: 'IV',
        infusionRate: 'p/12h (83 ml/h)',
        specialNotes: 'Ajustar según uresis meta > 0.8 ml/kg/h',
      },
    ],
    studyTitle: 'TAC Abdominal Contrastada en Fase Pancreática',
    studyCategory: 'TAC',
    studySummary: 'Aumento difuso de volumen pancreático con colección aguda peripancreática única < 3 cm en saco menor, realce homogéneo del parénquima sin necrosis (Balthazar D). Vesícula con microlitiasis.',
  },
  {
    title: 'Hemorragia de Tubo Digestivo Alto Variceal + Cirrosis Child C',
    diagnoses: [
      '1. [CIE-10: I85.01] Hemorragia de tubo digestivo alto variceal controlada post-ligadura endoscópica',
      '2. [CIE-10: K70.3] Cirrosis hepática de etiología enólica Child-Pugh C (10 puntos) / MELD-Na 21',
      '3. [CIE-10: D62] Anemia aguda posthemorrágica corregida con transfusión de 2 CE',
      '4. [CIE-10: K65.2] Peritonitis bacteriana espontánea descartada',
    ],
    admissionReason: 'Hematemesis franca en 3 ocasiones (~600 mL), melena fétida, diaforesis y Hb de ingreso de 6.4 g/dL.',
    relevantHistory: 'Cirrosis hepática diagnosticada hace 3 años · Sin apego a propranolol · Ingesta etílica suspendida hace 6 meses.',
    roundsNote: 'Cumple 36h sin nuevos eventos de hematemesis ni melena tras ligadura de 4 paquetes variceales. Hb estable en 8.6 g/dL post-transfusión, hemodinámicamente estable con octreótide en infusión y profilaxis con ceftriaxona.',
    evolutionSummary: 'Control hemostático exitoso. Sin datos de encefalopatía hepática. Mañana se suspende octreótide e inicia carvedilol.',
    diet: 'Dieta líquida clara fría progresando a blanda sin irritantes para hepatópata',
    dietSpecialNotes: 'Vigilar características de evacuaciones (escala de Bristol y presencia de melena)',
    severity: 'Grave',
    codeStatus: 'RCP 2 (Manejo Intermedio / Limitado / No IOT)',
    tags: ['CVC', 'Sonda Foley'],
    allergies: 'Negadas',
    antibiotics: [
      { name: 'Ceftriaxona', dose: '1 g', route: 'IV', frequency: 'cada 24 hrs', plannedDays: 7, indication: 'Profilaxis antibiótica en HTDA variceal' },
    ],
    supportMeds: [
      { name: 'Octreótide', dose: '50 mcg/h', route: 'IV', frequency: 'en infusión continua por 72h', isLimitedCourse: true, plannedDays: 3 },
      { name: 'Omeprazol', dose: '40 mg', route: 'IV', frequency: 'cada 12 hrs' },
      { name: 'Lactulosa', dose: '20 ml', route: 'VO', frequency: 'cada 8 hrs' },
    ],
    solutions: [
      {
        category: 'solucion',
        solutionType: 'Solución Glucosada 5%',
        volume: '1000 ml',
        route: 'CVC',
        infusionRate: 'p/24h (42 ml/h)',
      },
      {
        category: 'infusion',
        solutionType: 'Solución Salina 0.9%',
        volume: '100 ml',
        addedConcentrateOrMed: 'Octreótide 500 mcg',
        concentration: '5 mcg/mL',
        route: 'CVC',
        infusionRate: 'a 10 ml/h (50 mcg/h)',
      },
    ],
    studyTitle: 'Panendoscopia Oral Urgente Terapéutica',
    studyCategory: 'Endoscopía',
    studySummary: 'Várices esofágicas grandes (F3) con signos rojos y estigma de sangrado reciente en tercio distal; se colocan 4 bandas elásticas con hemostasia exitosa. Gastropatía hipertensiva portal moderada.',
  },
  {
    title: 'Evento Vascular Cerebral Isquémico ACM Izquierda (NIHSS 11)',
    diagnoses: [
      '1. [CIE-10: I63.5] Infarto cerebral agudo en territorio de arteria cerebral media izquierda (NIHSS 11 pts, ASPECTS 8)',
      '2. [CIE-10: I48.0] Fibrilación auricular de novo cardioembólica (CHA2DS2-VASc 5 pts)',
      '3. [CIE-10: I10] Hipertensión arterial sistémica en control permisivo',
    ],
    admissionReason: 'Inicio súbito de hemiparesia corporal derecha faciobraquiocrural 2/5, afasia motora de Broca y desviación de la comisura labial.',
    relevantHistory: 'HAS de 18 años en manejo irregular con enalapril · Dislipidemia · Extabaquismo.',
    roundsNote: 'Glasgow 14 (O4 V4 M6), NIHSS en mejoría de 14 a 11 puntos, sin transformación hemorrágica en TAC de control a las 48h. En protocolo de rehabilitación física temprana y deglución segura.',
    evolutionSummary: 'Estabilidad neurológica. Ecocardiograma y Doppler carotídeo realizados; se planea inicio de anticoagulación oral al día 7 según regla 1-3-6-12.',
    diet: 'Dieta en papilla espesa para disfagia neurógena asistida con cabecera a 45°',
    dietSpecialNotes: 'Vigilar reflejo de deglución y tos durante la alimentación para prevenir broncoaspiración',
    severity: 'Grave',
    codeStatus: 'RCP 2 (Manejo Intermedio / Limitado / No IOT)',
    tags: ['Sonda Nasogástrica'],
    allergies: 'Negadas',
    antibiotics: [],
    supportMeds: [
      { name: 'Ácido Acetilsalicílico', dose: '100 mg', route: 'VO', frequency: 'cada 24 hrs' },
      { name: 'Atorvastatina', dose: '80 mg', route: 'VO', frequency: 'cada 24 hrs' },
      { name: 'Enoxaparina', dose: '40 mg', route: 'SC', frequency: 'cada 24 hrs' },
      { name: 'Losartán', dose: '50 mg', route: 'VO', frequency: 'cada 12 hrs' },
    ],
    solutions: [
      {
        category: 'solucion',
        solutionType: 'Solución Salina 0.9%',
        volume: '1000 ml',
        route: 'IV',
        infusionRate: 'p/24h (42 ml/h)',
        specialNotes: 'Evitar soluciones hipotónicas o glucosadas',
      },
    ],
    studyTitle: 'TAC de Cráneo Simple de Control 48 hrs',
    studyCategory: 'TAC',
    studySummary: 'Hipodensidad cortico-subcortical frontoparietal izquierda bien delimitada en territorio de M2 de ACM izquierda, sin efecto de masa significativo ni transformación hemorrágica.',
  },
  {
    title: 'Enfermedad Renal Crónica KDIGO G5 en Urgencia Dialítica Resuelta',
    diagnoses: [
      '1. [CIE-10: N18.5] Enfermedad Renal Crónica estadio KDIGO G5A3 en terapia de reemplazo renal con hemodiálisis',
      '2. [CIE-10: E87.5] Hiperkalemia severa (6.8 → 4.4 mEq/L) y acidosis metabólica corregidas post-hemodiálisis',
      '3. [CIE-10: D63.8] Anemia normocítica normocrómica secundaria a ERC',
      '4. [CIE-10: E11.2] Nefropatía diabética e hipertensiva',
    ],
    admissionReason: 'Náusea, vómito urémico, sobrecarga hídrica con estertores bibasales, K sérico de 6.8 mEq/L, pH 7.21 y Urea de 248 mg/dL.',
    relevantHistory: 'DM2 22 años · HAS 15 años · ERC G5 sin acceso vascular previo.',
    roundsNote: 'Post-segunda sesión de hemodiálisis por catéter Mahurkar yugular derecho con ultrafiltrado de 2,200 mL; K 4.4 mEq/L, HCO3 21.8, Urea bajó de 248 a 112 mg/dL. Sin datos de encefalopatía ni pericarditis urémica.',
    evolutionSummary: 'Excelente tolerancia a sesiones de hemodiálisis. En trámite de referencia a programa de hemodiálisis crónica ambulatoria.',
    diet: 'Dieta para nefrópata 1,600 kcal hiposódica, baja en potasio y fósforo con restricción hídrica a 800 mL/día',
    dietSpecialNotes: 'Cuidados estrictos de catéter Mahurkar yugular derecho exclusivo para hemodiálisis',
    severity: 'Delicado',
    codeStatus: 'RCP 1 (Reanimación Completa / Todo esfuerzo)',
    tags: ['Hemodiálisis', 'CVC'],
    allergies: 'Medios de contraste yodados',
    antibiotics: [],
    supportMeds: [
      { name: 'Eritropoyetina humana recombinante', dose: '4,000 UI', route: 'SC', frequency: 'lunes, miércoles y viernes' },
      { name: 'Nifedipino liberación prolongada', dose: '30 mg', route: 'VO', frequency: 'cada 12 hrs' },
      { name: 'Furosemida', dose: '80 mg', route: 'VO', frequency: 'cada 12 hrs' },
      { name: 'Carbonato de Calcio', dose: '1 g', route: 'VO', frequency: 'cada 8 hrs con alimentos' },
    ],
    solutions: [
      {
        category: 'solucion',
        solutionType: 'Catéter venoso salinizado',
        volume: '0 ml',
        route: 'IV',
        infusionRate: 'Restricción hídrica estricta',
      },
    ],
    studyTitle: 'Radiografía de Tórax PA de control post-colocación de Mahurkar',
    studyCategory: 'Radiografía',
    studySummary: 'Catéter venoso central de alto flujo yugular interno derecho con extremo distal en unión cavoatrial. Sin neumotórax; disminución de cefalización de flujo pulmonar.',
  },
  {
    title: 'Pie Diabético Infectado WIFI 4 / PEDIS 3 en Protocolo Quirúrgico',
    diagnoses: [
      '1. [CIE-10: E11.621] Pie diabético derecho clasificado Texas III-B / Wagner 3 / PEDIS 3 con osteomielitis del 1er metatarsiano',
      '2. [CIE-10: E11.9] Diabetes Mellitus tipo 2 en descontrol glucémico crónico (HbA1c 10.4%)',
      '3. [CIE-10: I70.2] Enfermedad arterial periférica femoropoplítea moderada',
    ],
    admissionReason: 'Úlcera plantar profunda en región metatarsiana derecha con secreción purulenta fétida, hiperemia ascendente hasta tercio distal de pierna y fiebre de 38.6°C.',
    relevantHistory: 'DM2 18 años en mal apego a metformina · Neuropatía periférica distal simétrica · Tabaquismo activo.',
    roundsNote: 'Posterior a lavado quirúrgico y desbridamiento amplio por Cirugía General, tejido de granulación limpio en bordes, sin avance de eritema. Afebril 48h con Clindamicina + Ceftazidima y glucemias capilares entre 130-165 mg/dL.',
    evolutionSummary: 'Control local de la infección. Pendiente resultado de cultivo de biopsia ósea para definir duración total de antibioticoterapia.',
    diet: 'Dieta para diabético hiperproteica 1,800 kcal con suplemento de arginina/vitamina C',
    dietSpecialNotes: 'Curación avanzada diaria de herida en pie derecho con técnica estéril',
    severity: 'Estable',
    codeStatus: 'RCP 1 (Reanimación Completa / Todo esfuerzo)',
    tags: ['Aislado de Contacto'],
    allergies: 'Negadas',
    antibiotics: [
      { name: 'Ceftazidima', dose: '1 g', route: 'IV', frequency: 'cada 8 hrs', plannedDays: 14, indication: 'Pie diabético PEDIS 3' },
      { name: 'Clindamicina', dose: '600 mg', route: 'IV', frequency: 'cada 8 hrs', plannedDays: 14, indication: 'Cobertura anaerobios y Gram(+) en pie diabético' },
    ],
    supportMeds: [
      { name: 'Insulina Glargina', dose: '24 UI', route: 'SC', frequency: 'cada 24 hrs' },
      { name: 'Insulina Rápida Regular', dose: 'Esquema', route: 'SC', frequency: 'preprandial si > 180 mg/dL' },
      { name: 'Enoxaparina', dose: '40 mg', route: 'SC', frequency: 'cada 24 hrs' },
      { name: 'Pregabalina', dose: '75 mg', route: 'VO', frequency: 'cada 12 hrs' },
    ],
    solutions: [
      {
        category: 'solucion',
        solutionType: 'Solución Salina 0.9%',
        volume: '1000 ml',
        route: 'IV',
        infusionRate: 'p/24h (42 ml/h)',
      },
    ],
    studyTitle: 'Radiografía Dorsoplantar y Oblicua de Pie Derecho + USG Doppler Arterial',
    studyCategory: 'Radiografía',
    studySummary: 'Reabsorción cortical y osteólisis en cabeza del primer metatarsiano compatible con osteomielitis; gas en tejidos blandos ausente post-desbridamiento. Doppler con flujo trifásico tibial posterior y bifásico pedio.',
  },
  {
    title: 'Tromboembolia Pulmonar de Riesgo Intermedio-Alto (PESI III)',
    diagnoses: [
      '1. [CIE-10: I26.9] Tromboembolia pulmonar aguda bilateral de riesgo intermedio-alto (sPESI 2 pts) con disfunción leve del VD',
      '2. [CIE-10: I82.4] Trombosis venosa profunda femoropoplítea izquierda proximal',
      '3. [CIE-10: E66.9] Obesidad exógena grado 2 (IMC 36.1 kg/m2)',
    ],
    admissionReason: 'Disnea súbita en reposo, dolor torácico pleurítico derecho, taquicardia sinusal de 118 lpm, SpO2 86% al aire ambiente y Dímero D de 6,420 ng/mL.',
    relevantHistory: 'Inmovilización prolongada por fractura de tobillo izquierdo hace 3 semanas · Obesidad grado 2.',
    roundsNote: 'Con Cánula de Alto Flujo a 40 L/min FiO2 35% mantiene SpO2 95%, FC bajó de 118 a 84 lpm, normotenso (TA 122/78) y sin dolor torácico bajo anticoagulación plena con Enoxaparina 1 mg/kg c/12h.',
    evolutionSummary: 'Estabilidad hemodinámica sostenida sin requerir trombólisis sistémica. Mañana se traslapa a Rivaroxabán 15 mg c/12h.',
    diet: 'Dieta normal normocalórica 1,800 kcal rica en fibra',
    dietSpecialNotes: 'Reposo relativo en cama y vigilancia de datos de sangrado mayor o menor',
    severity: 'Grave',
    codeStatus: 'RCP 1 (Reanimación Completa / Todo esfuerzo)',
    tags: ['Cánula Alto Flujo'],
    allergies: 'Negadas',
    antibiotics: [],
    supportMeds: [
      { name: 'Enoxaparina', dose: '80 mg', route: 'SC', frequency: 'cada 12 hrs (anticoagulación plena)' },
      { name: 'Paracetamol', dose: '1 g', route: 'IV', frequency: 'cada 8 hrs PRN dolor' },
      { name: 'Senósidos A-B', dose: '2 tabletas', route: 'VO', frequency: 'cada 24 hrs nocturno' },
    ],
    solutions: [
      {
        category: 'solucion',
        solutionType: 'Solución Salina 0.9%',
        volume: '500 ml',
        route: 'IV',
        infusionRate: 'p/24h (21 ml/h)',
      },
    ],
    studyTitle: 'Angio-TAC de Arterias Pulmonares',
    studyCategory: 'TAC',
    studySummary: 'Defectos de llenado intraluminales en rama principal derecha y ramas lobares inferiores bilaterales compatibles con tromboembolia pulmonar aguda; relación VD/VI de 1.1.',
    criticalSystems: true,
  },
  {
    title: 'Síndrome Coronario Agudo IAMCEST Anterior Reperfundido (Killip II)',
    diagnoses: [
      '1. [CIE-10: I21.0] Infarto Agudo de Miocardio con Elevación del ST (IAMCEST) anterior extenso Killip-Kimball II post-ICP primaria a DA proximal con 1 stent medicado (TIMI 3)',
      '2. [CIE-10: I10] Cardiopatía isquémica e hipertensiva',
      '3. [CIE-10: E78.5] Dislipidemia aterogénica',
    ],
    admissionReason: 'Dolor precordial opresivo retroesternal irradiado a brazo izquierdo y mandíbula de 90 minutos de evolución, diaforesis fría y supradesnivel del ST de 4 mm en V1-V5.',
    relevantHistory: 'Tabaquismo intenso 25 paq/año · HAS 10 años · Padre finado por IAM a los 58 años.',
    roundsNote: 'Asintomático cardiovascular (0/10 dolor anginoso), electrocardiograma con resolución del ST > 70% y ritmo sinusal FC 64 lpm con bisoprolol. Troponina I en curva de lavado descendente y sitio de punción radial derecho sin hematoma.',
    evolutionSummary: 'Evolución post-angioplastia favorable. En vigilancia en unidad coronaria/terapia intermedia por 24h más antes de pase a piso.',
    diet: 'Dieta cardioprotectora hiposódica rica en fibra soluble 1,600 kcal',
    dietSpecialNotes: 'Monitoreo cardiaco continuo en central y avisar ante arritmias o dolor precordial',
    severity: 'Grave',
    codeStatus: 'RCP 1 (Reanimación Completa / Todo esfuerzo)',
    tags: ['CVC'],
    allergies: 'Negadas',
    antibiotics: [],
    supportMeds: [
      { name: 'Ácido Acetilsalicílico', dose: '100 mg', route: 'VO', frequency: 'cada 24 hrs' },
      { name: 'Clopidogrel', dose: '75 mg', route: 'VO', frequency: 'cada 24 hrs' },
      { name: 'Atorvastatina', dose: '80 mg', route: 'VO', frequency: 'cada 24 hrs' },
      { name: 'Bisoprolol', dose: '2.5 mg', route: 'VO', frequency: 'cada 24 hrs' },
      { name: 'Enalapril', dose: '5 mg', route: 'VO', frequency: 'cada 12 hrs' },
      { name: 'Espironolactona', dose: '25 mg', route: 'VO', frequency: 'cada 24 hrs' },
    ],
    solutions: [
      {
        category: 'solucion',
        solutionType: 'Catéter venoso salinizado',
        volume: '0 ml',
        route: 'IV',
        infusionRate: 'Para medicamentos IV',
      },
    ],
    studyTitle: 'Coronariografía Diagnóstica e Intervencionismo Coronario Percutáneo',
    studyCategory: 'Otro Estudio',
    studySummary: 'Oclusión trombótica aguda del 100% en segmento proximal de Arteria Descendente Anterior; se realiza tromboaspiración e implante de stent liberador de everolimus 3.0x24mm logrando flujo final TIMI 3.',
  },
  {
    title: 'Colangitis Aguda Moderada Tokyo II post-CPRE',
    diagnoses: [
      '1. [CIE-10: K83.0] Colangitis aguda ascendente grado II (moderada de criterios de Tokyo) resuelta post-CPRE',
      '2. [CIE-10: K80.5] Coledocolitiasis resuelta por esfinterotomía y extracción con balón',
      '3. [CIE-10: K82.8] Portador de endoprótesis biliar plástica 10 Fr',
    ],
    admissionReason: 'Tríada de Charcot clásica: fiebre de 38.9°C con escalofríos, ictericia escleral y dolor en hipocondrio derecho, con bilirrubina total de 6.8 mg/dL (directa 5.1) y leucocitosis de 17,900.',
    relevantHistory: 'Colelitiasis conocida desde hace 2 años · DM2 en control con metformina.',
    roundsNote: '48h post-CPRE con drenaje biliar exitoso; afebril, sin dolor abdominal, bilirrubina total en franco descenso (6.8 → 2.4 mg/dL) y leucocitos normalizados en 8,200/uL. Tolerando dieta blanda.',
    evolutionSummary: 'Sepsis biliar resuelta. Completa 5 días de Piperacilina/Tazobactam intravenoso y se programa egreso con cita a Cirugía General.',
    diet: 'Dieta blanda colecistocinética (baja en grasas y colecistoquinéticos) 1,700 kcal',
    dietSpecialNotes: 'Vigilar acolia, coluria y temperatura por turno',
    severity: 'Estable',
    codeStatus: 'RCP 1 (Reanimación Completa / Todo esfuerzo)',
    tags: [],
    allergies: 'Negadas',
    antibiotics: [
      { name: 'Piperacilina / Tazobactam', dose: '4.5 g', route: 'IV', frequency: 'cada 8 hrs', plannedDays: 7, indication: 'Colangitis aguda Tokyo II' },
    ],
    supportMeds: [
      { name: 'Butilhioscina', dose: '20 mg', route: 'IV', frequency: 'cada 8 hrs' },
      { name: 'Omeprazol', dose: '40 mg', route: 'IV', frequency: 'cada 24 hrs' },
      { name: 'Vitamina K (Fitomenadiona)', dose: '10 mg', route: 'IV', frequency: 'cada 24 hrs por 3 dosis', isLimitedCourse: true, plannedDays: 3 },
    ],
    solutions: [
      {
        category: 'solucion',
        solutionType: 'Solución Hartmann',
        volume: '1000 ml',
        route: 'IV',
        infusionRate: 'p/24h (42 ml/h)',
      },
    ],
    studyTitle: 'Colangiopancreatografía Retrógrada Endoscópica (CPRE)',
    studyCategory: 'Endoscopía',
    studySummary: 'Colédoco dilatado de 12 mm con defecto de llenado distal de 8 mm; se realiza esfinterotomía biliar amplia, barrido con balón extractor obteniendo lito pigmentado y pus franco, colocando prótesis plástica 10 Fr x 7 cm.',
  },
  {
    title: 'Crisis Lúpica con Nefritis Lúpica Clase IV + Serositis',
    diagnoses: [
      '1. [CIE-10: M32.14] Lupus Eritematoso Sistémico con actividad grave (SLEDAI-2K 16 pts): Nefritis lúpica proliferativa difusa y derrame pleural',
      '2. [CIE-10: N04.9] Síndrome nefrótico secundario (proteinuria 4.2 g/24h) con función renal conservada',
      '3. [CIE-10: D59.1] Anemia hemolítica autoinmune Coombs directo positivo en remisión inicial',
    ],
    admissionReason: 'Anasarca, orina espumosa, disnea pleurítica, artralgias inflamatorias simétricas, hipocomplementemia (C3 42, C4 6) y anti-DNAds > 200 UI/mL.',
    relevantHistory: 'LES diagnosticado hace 2 años con abandono de hidroxicloroquina y micofenolato hace 4 meses.',
    roundsNote: 'Completó 3 bolos de Metilprednisolona 500 mg IV y hoy inicia prednisona 1 mg/kg/día + micofenolato de mofetilo 2 g/día. Disminución del edema periférico, Hb subió de 8.4 a 9.7 g/dL sin hemólisis activa.',
    evolutionSummary: 'Buena respuesta inicial a inducción de remisión. Pendiente biopsia renal guiada por ultrasonido por Nefrología.',
    diet: 'Dieta hiposódica normoproteica 1,600 kcal con restricción hídrica a 1,500 mL/día',
    dietSpecialNotes: 'Recolección de orina de 24 horas para depuración de creatinina y proteínas totales',
    severity: 'Delicado',
    codeStatus: 'RCP 1 (Reanimación Completa / Todo esfuerzo)',
    tags: [],
    allergies: 'Trimetoprim/Sulfametoxazol (exantema maculopapular)',
    antibiotics: [],
    supportMeds: [
      { name: 'Prednisona', dose: '60 mg', route: 'VO', frequency: 'cada 24 hrs matutino' },
      { name: 'Micofenolato de Mofetilo', dose: '1 g', route: 'VO', frequency: 'cada 12 hrs' },
      { name: 'Hidroxicloroquina', dose: '200 mg', route: 'VO', frequency: 'cada 24 hrs' },
      { name: 'Furosemida', dose: '20 mg', route: 'IV', frequency: 'cada 12 hrs' },
      { name: 'Losartán', dose: '50 mg', route: 'VO', frequency: 'cada 12 hrs (antiproteinúrico)' },
      { name: 'Omeprazol', dose: '40 mg', route: 'VO', frequency: 'cada 24 hrs' },
    ],
    solutions: [
      {
        category: 'solucion',
        solutionType: 'Catéter venoso salinizado',
        volume: '0 ml',
        route: 'IV',
        infusionRate: 'Vía permeable para diurético IV',
      },
    ],
    studyTitle: 'Perfil Inmunológico y USG Renal Bilateral previo a Biopsia',
    studyCategory: 'Laboratorio Especial',
    studySummary: 'ANA 1:1280 patrón homogéneo, Anti-DNAds 245 UI/mL, C3 42 mg/dL, C4 6 mg/dL, Coombs directo IgG(+)/C3d(+). Riñones de 11.2 cm con aumento de ecogenicidad cortical y diferenciación corticomedular conservada.',
  },
  {
    title: 'Meningoencefalitis Bacteriana Aguda por S. pneumoniae',
    diagnoses: [
      '1. [CIE-10: G00.1] Meningitis bacteriana aguda por Streptococcus pneumoniae confirmada en LCR',
      '2. [CIE-10: H66.9] Otitis media aguda supurada derecha (foco contiguo otomastoideo)',
      '3. [CIE-10: G93.6] Edema cerebral leve resuelto con dexametasona adyuvante',
    ],
    admissionReason: 'Cefalea holocraneana intensa, fiebre de 39.4°C, rigidez de nuca, signos de Kernig y Brudzinski positivos y estupor superficial (Glasgow 12).',
    relevantHistory: 'Otitis media derecha no tratada de 10 días de evolución · Esplenectomía post-traumática hace 8 años.',
    roundsNote: 'Recuperación neurológica completa (Glasgow 15, orientado en 3 esferas, sin focalización), afebril desde hace 72h y sin cefalea. En Día 8/14 de Ceftriaxona a dosis meníngea + Vancomicina.',
    evolutionSummary: 'Excelente respuesta clínica y microbiológica. Valorado por ORL con miringotomía realizada sin complicaciones.',
    diet: 'Dieta normal hipercalórica 2,000 kcal a libre demanda',
    dietSpecialNotes: 'Vigilancia neurológica por turno (Glasgow, pupilas y pares craneales)',
    severity: 'Delicado',
    codeStatus: 'RCP 1 (Reanimación Completa / Todo esfuerzo)',
    tags: ['Aislado Respiratorio', 'CVC'],
    allergies: 'Negadas',
    antibiotics: [
      { name: 'Ceftriaxona', dose: '2 g', route: 'IV', frequency: 'cada 12 hrs (dosis meníngea)', plannedDays: 14, indication: 'Meningitis neumocócica' },
      { name: 'Vancomicina', dose: '1 g', route: 'IV', frequency: 'cada 12 hrs', plannedDays: 14, indication: 'Meningitis bacteriana' },
    ],
    supportMeds: [
      { name: 'Dexametasona', dose: '10 mg', route: 'IV', frequency: 'cada 6 hrs por 4 días', isLimitedCourse: true, plannedDays: 4 },
      { name: 'Levetiracetam', dose: '500 mg', route: 'IV', frequency: 'cada 12 hrs (profilaxis comicial)' },
      { name: 'Paracetamol', dose: '1 g', route: 'IV', frequency: 'cada 8 hrs' },
    ],
    solutions: [
      {
        category: 'solucion',
        solutionType: 'Solución Salina 0.9%',
        volume: '1000 ml',
        route: 'CVC',
        infusionRate: 'p/24h (42 ml/h)',
      },
    ],
    studyTitle: 'Citoquímico, Gram y Panel FilmArray de Líquido Cefalorraquídeo + TAC de Cráneo',
    studyCategory: 'Cultivo / Microbiología',
    studySummary: 'LCR turbio, presión de apertura 28 cmH2O, leucocitos 1,450/mm3 (92% PMN), glucosa 18 mg/dL (sérica 115), proteínas 240 mg/dL; PCR multiplex y cultivo positivos para Streptococcus pneumoniae.',
  },
];

function buildGeneratedPatient(indexZeroBased: number): Patient {
  // indexZeroBased goes from 4 to 99 (producing p-105 through p-200)
  const patientNum = 101 + indexZeroBased;
  const archetype = CLINICAL_ARCHETYPES[indexZeroBased % CLINICAL_ARCHETYPES.length];
  const isFemale = indexZeroBased % 2 === 1;
  const gender: 'Masculino' | 'Femenino' = isFemale ? 'Femenino' : 'Masculino';

  const lastName1 = LAST_NAMES_1[(indexZeroBased * 3) % LAST_NAMES_1.length];
  const lastName2 = LAST_NAMES_2[(indexZeroBased * 5) % LAST_NAMES_2.length];
  const firstName = isFemale
    ? FEMALE_NAMES[(indexZeroBased * 2) % FEMALE_NAMES.length]
    : MALE_NAMES[(indexZeroBased * 2) % MALE_NAMES.length];

  const fullName = `${lastName1} ${lastName2} ${firstName}`;
  const age = 24 + ((indexZeroBased * 7) % 66); // Ages 24 to 89
  const weightKg = isFemale ? 52 + ((indexZeroBased * 3) % 34) : 62 + ((indexZeroBased * 4) % 38);
  const heightCm = isFemale ? 152 + (indexZeroBased % 18) : 164 + (indexZeroBased % 22);
  const bmi = Number((weightKg / Math.pow(heightCm / 100, 2)).toFixed(1));

  // Distribute across all 7 hospital services
  const serviceObj = defaultServicesCatalog[indexZeroBased % defaultServicesCatalog.length];
  const serviceName = serviceObj.name;
  const floorPrefix =
    serviceObj.id === 'srv-1'
      ? 300
      : serviceObj.id === 'srv-2'
      ? 400
      : serviceObj.id === 'srv-3'
      ? 100
      : serviceObj.id === 'srv-4'
      ? 200
      : serviceObj.id === 'srv-5'
      ? 500
      : serviceObj.id === 'srv-6'
      ? 600
      : 700;
  const bedNum = floorPrefix + Math.floor(indexZeroBased / 7) + 3;
  const bed = `Cama ${bedNum}`;

  const attending = defaultAttendingPhysicians[indexZeroBased % defaultAttendingPhysicians.length];

  // Vary admission dates between Oct 12 and Oct 26, 2026
  const admDay = 12 + (indexZeroBased % 15);
  const admissionDate = `2026-10-${String(admDay).padStart(2, '0')}`;
  const abxStartDay = Math.min(26, admDay + 1);
  const abxStartDate = `2026-10-${String(abxStartDay).padStart(2, '0')}`;

  // Vary code status across patients so RCP 1, RCP 2, and RCP 3 badges are all well-represented
  const codeStatus: CodeStatusType =
    indexZeroBased % 11 === 0
      ? 'RCP 3 (No Reanimación / Voluntad Anticipada / Paliativo)'
      : indexZeroBased % 6 === 0
      ? 'RCP 2 (Manejo Intermedio / Limitado / No IOT)'
      : archetype.codeStatus;

  const tags = [...archetype.tags];
  if (codeStatus.startsWith('RCP 3') && !tags.includes('RCP 3 (No RCP / Voluntad)')) {
    tags.push('RCP 3 (No RCP / Voluntad)');
  }

  // Build realistic vitals
  const sysBp = archetype.severity === 'Muy Grave / UCI' ? 102 + (indexZeroBased % 24) : 114 + (indexZeroBased % 28);
  const diaBp = 64 + (indexZeroBased % 20);
  const hr = 66 + ((indexZeroBased * 3) % 36);
  const rr = 15 + (indexZeroBased % 9);
  const temp = (36.3 + ((indexZeroBased % 7) * 0.2)).toFixed(1);
  const spo2 = String(92 + (indexZeroBased % 7));
  const glucose = String(96 + ((indexZeroBased * 9) % 88));

  // Build Medications (Antibiotics + Support)
  const medications: MedicationItem[] = [
    ...archetype.antibiotics.map((abx, idx) => ({
      id: `m-${patientNum}-abx-${idx}`,
      name: abx.name,
      dose: abx.dose,
      route: abx.route,
      frequency: abx.frequency,
      isAntibiotic: true,
      startDate: abxStartDate,
      plannedDays: abx.plannedDays,
      indication: abx.indication,
      active: true,
    })),
    ...archetype.supportMeds.map((med, idx) => ({
      id: `m-${patientNum}-sup-${idx}`,
      name: med.name,
      dose: med.dose,
      route: med.route,
      frequency: med.frequency,
      isAntibiotic: false,
      isLimitedCourse: med.isLimitedCourse,
      plannedDays: med.plannedDays,
      startDate: admissionDate,
      active: true,
    })),
  ];

  // Build 3 chronological labs showing realistic evolution from admission to today
  const baseHb = isFemale ? 11.4 + ((indexZeroBased % 5) * 0.4) : 12.8 + ((indexZeroBased % 5) * 0.4);
  const baseLeucos = archetype.antibiotics.length > 0 ? 11800 + (indexZeroBased % 6) * 900 : 7200 + (indexZeroBased % 5) * 600;
  const basePlaq = 185000 + (indexZeroBased % 8) * 18000;
  const baseCr = archetype.title.includes('Renal') ? 4.2 : 0.8 + ((indexZeroBased % 5) * 0.2);
  const baseUrea = Math.round(baseCr * 34);
  const baseBun = Number((baseUrea / 2.14).toFixed(1));
  const baseNa = 136 + (indexZeroBased % 7);
  const baseK = Number((3.8 + (indexZeroBased % 5) * 0.2).toFixed(1));

  const baseAst = archetype.title.includes('Colangitis') || archetype.title.includes('Cirrosis')
    ? 64 + (indexZeroBased % 25)
    : 26 + (indexZeroBased % 15);
  const baseAlt = archetype.title.includes('Colangitis') || archetype.title.includes('Cirrosis')
    ? 58 + (indexZeroBased % 22)
    : 29 + (indexZeroBased % 18);
  const baseBili = archetype.title.includes('Colangitis')
    ? 2.4
    : archetype.title.includes('Cirrosis')
    ? 2.1
    : Number((0.8 + (indexZeroBased % 4) * 0.2).toFixed(1));
  const baseInr = archetype.title.includes('Cirrosis') ? 1.52 : 1.06;

  const labs: LabRecord[] = [
    {
      id: `lab-${patientNum}-3`,
      date: '2026-10-27',
      time: '06:30',
      hb: Number(baseHb.toFixed(1)),
      leucos: baseLeucos,
      neutrophils: '68',
      lymphocytes: '22',
      plaquetas: basePlaq,
      glucosa: Number(glucose),
      creatinina: Number(baseCr.toFixed(2)),
      urea: baseUrea,
      bun: baseBun,
      na: baseNa,
      k: baseK,
      cl: 101 + (indexZeroBased % 5),
      calcium: String(Number((8.8 + (indexZeroBased % 3) * 0.3).toFixed(1))),
      phosphorus: '3.6',
      magnesium: '2.0',
      albumin: '3.4',
      ast: String(baseAst),
      alt: String(baseAlt),
      biliTotal: String(baseBili),
      biliDirect: String(Number((baseBili * 0.45).toFixed(1))),
      tp: String(Number((baseInr * 11.8).toFixed(1))),
      inr: String(baseInr),
      ttpa: '29.4',
      ph: 7.38,
      pco2: 36,
      po2: 84,
      hco3: 22.6,
      lactato: 1.2,
      pcr: archetype.antibiotics.length > 0 ? 18.5 : 4.2,
      procalcitonina: archetype.antibiotics.length > 0 ? 0.65 : 0.08,
      isNew: indexZeroBased % 3 === 0,
      otherNotes: 'Muestra matutina procesada sin hemólisis.',
    },
    {
      id: `lab-${patientNum}-2`,
      date: '2026-10-25',
      time: '06:45',
      hb: Number((baseHb - 0.3).toFixed(1)),
      leucos: baseLeucos + 3400,
      neutrophils: '77',
      lymphocytes: '15',
      plaquetas: basePlaq - 12000,
      glucosa: Number(glucose) + 24,
      creatinina: Number((baseCr + 0.35).toFixed(2)),
      urea: baseUrea + 18,
      bun: Number(((baseUrea + 18) / 2.14).toFixed(1)),
      na: baseNa - 2,
      k: Number((baseK + 0.3).toFixed(1)),
      cl: 100,
      calcium: String(Number((8.5 + (indexZeroBased % 3) * 0.2).toFixed(1))),
      phosphorus: '4.0',
      magnesium: '1.8',
      albumin: '3.2',
      ast: String(baseAst + 16),
      alt: String(baseAlt + 19),
      biliTotal: String(Number((baseBili + 0.5).toFixed(1))),
      biliDirect: String(Number(((baseBili + 0.5) * 0.5).toFixed(1))),
      tp: String(Number(((baseInr + 0.12) * 11.8).toFixed(1))),
      inr: String(Number((baseInr + 0.12).toFixed(2))),
      ttpa: '32.1',
      ph: 7.34,
      pco2: 39,
      po2: 76,
      hco3: 20.4,
      lactato: 1.9,
      pcr: archetype.antibiotics.length > 0 ? 54.0 : 9.1,
      procalcitonina: archetype.antibiotics.length > 0 ? 1.85 : 0.18,
    },
    {
      id: `lab-${patientNum}-1`,
      date: admissionDate,
      time: '14:20',
      hb: Number((baseHb - 0.6).toFixed(1)),
      leucos: baseLeucos + 6800,
      neutrophils: '85',
      lymphocytes: '9',
      plaquetas: basePlaq - 25000,
      glucosa: Number(glucose) + 52,
      creatinina: Number((baseCr + 0.7).toFixed(2)),
      urea: baseUrea + 36,
      bun: Number(((baseUrea + 36) / 2.14).toFixed(1)),
      na: baseNa - 3,
      k: Number((baseK + 0.5).toFixed(1)),
      cl: 98,
      calcium: String(Number((8.3 + (indexZeroBased % 3) * 0.2).toFixed(1))),
      phosphorus: '4.4',
      magnesium: '1.7',
      albumin: '3.0',
      ast: String(baseAst + 34),
      alt: String(baseAlt + 38),
      biliTotal: String(Number((baseBili + 1.1).toFixed(1))),
      biliDirect: String(Number(((baseBili + 1.1) * 0.55).toFixed(1))),
      tp: String(Number(((baseInr + 0.24) * 11.8).toFixed(1))),
      inr: String(Number((baseInr + 0.24).toFixed(2))),
      ttpa: '35.0',
      ph: 7.31,
      pco2: 41,
      po2: 70,
      hco3: 18.8,
      lactato: 2.6,
      pcr: archetype.antibiotics.length > 0 ? 96.0 : 14.5,
      procalcitonina: archetype.antibiotics.length > 0 ? 4.2 : 0.32,
    },
  ];

  // Build Studies
  const studies: DiagnosticStudy[] = [
    {
      id: `std-${patientNum}-1`,
      date: '2026-10-26',
      time: '11:15',
      category: archetype.studyCategory,
      title: archetype.studyTitle,
      summary: archetype.studySummary,
      isNew: indexZeroBased % 4 === 0,
    },
    {
      id: `std-${patientNum}-2`,
      date: admissionDate,
      time: '16:00',
      category: 'Radiografía',
      title: 'Tele de Tórax PA y Electrocardiograma de 12 derivaciones de ingreso',
      summary: 'Silueta cardiomediastínica valorable, ángulos costofrénicos libres, ritmo sinusal sin bloqueos auriculoventriculares.',
      isNew: false,
    },
  ];

  // Build Structured Solutions
  const structuredSolutions: ParenteralSolutionItem[] = archetype.solutions.map((s, idx) => ({
    id: `sol-${patientNum}-${idx}`,
    category: s.category,
    solutionType: s.solutionType,
    volume: s.volume,
    addedConcentrateOrMed: s.addedConcentrateOrMed,
    concentration: s.concentration,
    route: s.route,
    infusionRate: s.infusionRate,
    specialNotes: s.specialNotes,
  }));

  const ivFluidsText = structuredSolutions
    .map((s) =>
      s.category === 'infusion'
        ? `Infusión: ${s.addedConcentrateOrMed} en ${s.volume} ${s.solutionType} (${s.infusionRate})`
        : `${s.solutionType} ${s.volume} ${s.infusionRate}`
    )
    .join(' + ');

  // Build Structured Nursing Orders
  const structuredNursingOrders: PatientNursingOrderItem[] = [
    {
      id: `no-${patientNum}-1`,
      text: 'Signos vitales por turno y avisar eventualidades (PAM < 65 o > 100, FC > 100 o < 50, Temp > 38°C)',
      note: `Meta SpO2 > 92% y glucemia capilar < 180 mg/dL`,
      active: true,
    },
    {
      id: `no-${patientNum}-2`,
      text: 'Posición semi-Fowler 30° a 45° con cabecera elevada y barandales en alto',
      active: true,
    },
    {
      id: `no-${patientNum}-3`,
      text: 'Cuantificación estricta de uresis y balance hídrico acumulado por turno',
      note: archetype.dietSpecialNotes,
      active: true,
    },
    {
      id: `no-${patientNum}-4`,
      text: 'Cuidados de acceso venoso y movilización asistida cada 2 horas para prevención de UPP',
      active: true,
    },
  ];

  const nursingOrdersText = structuredNursingOrders.map((n) =>
    n.note ? `${n.text} (${n.note})` : n.text
  );

  // Build Chained 4-Stage Pendings
  const stages: Array<'take' | 'collect' | 'register_census'> = ['take', 'collect', 'register_census'];
  const stageForPatient = stages[indexZeroBased % stages.length];
  const stagePrefix =
    stageForPatient === 'take'
      ? 'TOMA DE LABORATORIOS'
      : stageForPatient === 'collect'
      ? 'RECABAR LABORATORIOS'
      : 'SUBIR LABORATORIOS AL CENSO';

  const pendings: ClinicalPending[] = [
    {
      id: `pen-${patientNum}-1`,
      text: `${stagePrefix}: BH, QS6, ES6 y gasometría de control matutino`,
      customDetails: 'BH, QS6, ES6 y gasometría de control matutino',
      category: 'Laboratorio',
      priority: indexZeroBased % 3 === 0 ? 'Alta' : 'Media',
      urgencyColor: indexZeroBased % 3 === 0 ? 'red' : 'yellow',
      workflowStage: stageForPatient,
      completed: false,
      createdAt: '2026-10-27',
    },
    {
      id: `pen-${patientNum}-2`,
      text:
        indexZeroBased % 8 === 0
          ? 'ALTA: Preparar resumen de egreso, receta y contrarreferencia matutina'
          : `INTERCONSULTA: Seguimiento conjunto con ${attending.split('(')[0].trim()}`,
      category: indexZeroBased % 8 === 0 ? 'Alta Hospitalaria' : 'Interconsulta',
      priority: indexZeroBased % 8 === 0 ? 'Alta' : 'Media',
      urgencyColor: indexZeroBased % 8 === 0 ? 'red' : 'blue',
      isDischargePending: indexZeroBased % 8 === 0,
      completed: false,
      createdAt: '2026-10-27',
    },
  ];

  return {
    id: `p-${patientNum}`,
    recordNumber: `IM-${710000 + indexZeroBased * 137}-${String.fromCharCode(65 + (indexZeroBased % 26))}`,
    name: fullName,
    age,
    gender,
    bed,
    service: serviceName,
    attendingPhysician: attending,
    admissionDate,
    status: 'active',
    severity: archetype.severity,
    codeStatus,
    clinicalTags: tags,
    allergies: archetype.allergies,
    admissionReason: archetype.admissionReason,
    relevantHistory: archetype.relevantHistory,
    roundsPresentationNote: archetype.roundsNote,
    initialDiagnoses: [archetype.diagnoses[0]],
    diagnoses: archetype.diagnoses,
    vitals: {
      bp: `${sysBp}/${diaBp}`,
      hr: String(hr),
      rr: String(rr),
      temp,
      spo2,
      glucose,
      weightKg,
    },
    initialDiet: 'Ayuno protector de ingreso durante estabilización inicial',
    diet: archetype.diet,
    dietSpecialNotes: archetype.dietSpecialNotes,
    initialIvFluids: 'Sol. Hartmann 1000 ml p/12h de ingreso',
    ivFluids: ivFluidsText,
    structuredSolutions,
    initialNursingOrders: nursingOrdersText,
    nursingOrders: nursingOrdersText,
    structuredNursingOrders,
    medications,
    labs,
    studies,
    pendings,
    evolutionSummary: archetype.evolutionSummary,
    criticalCareSystems: archetype.criticalSystems
      ? {
          enabled: true,
          neuro: {
            consciousness: tags.includes('Intubado / VMI')
              ? 'Bajo sedación ligera RASS -1 reactivo a estímulo táctil'
              : 'Alerta y orientado en 3 esferas',
            reflexes: 'Pupilas isocóricas 3mm normorreactivas',
            sedationAnalgesia: tags.includes('Intubado / VMI')
              ? 'Dexmedetomidina 0.4 mcg/kg/h IV'
              : 'Sin sedación continua',
            glasgow: tags.includes('Intubado / VMI') ? '10T' : '15',
            rass: tags.includes('Intubado / VMI') ? '-1' : '0',
          },
          respiratory: {
            supportType: tags.includes('Intubado / VMI')
              ? 'Ventilación Mecánica Invasiva (VMI)'
              : 'Cánula Nasal de Alto Flujo (40 L/min)',
            ventMode: tags.includes('Intubado / VMI') ? 'Asisto-Control por Volumen' : 'Alto Flujo Húmedo',
            fio2: '40%',
            peep: tags.includes('Intubado / VMI') ? '8' : '5',
            tidalVolume: '440 mL',
            respRateVent: `${rr} rpm`,
            spo2: `${spo2}%`,
            bloodGas: `pH 7.38, pCO2 36, pO2 84, HCO3 22.6, Lactato 1.2`,
          },
          hemodynamic: {
            hemodynamicStatus: 'Perfusión tisular conservada, llenado capilar 2 seg',
            bpAndMap: `TA ${sysBp}/${diaBp} mmHg (PAM ${Math.round((sysBp + 2 * diaBp) / 3)} mmHg)`,
            vasopressorsInotropes: tags.includes('Intubado / VMI')
              ? 'Norepinefrina 0.08 mcg/kg/min por CVC'
              : 'Sin requerimiento vasopresor',
            hrAndRhythm: `${hr} lpm · Ritmo sinusal`,
          },
          gastroMetabolic: {
            glycemias: `${glucose} mg/dL en control con esquema subcutáneo`,
            feedingType: archetype.diet,
            abdomenAndBowel: 'Abdomen blando, peristalsis presente, sin distensión.',
          },
          renal: {
            diuresis: '1,850 mL/24h (1.1 mL/kg/h)',
            renalFunction: `Cr ${baseCr.toFixed(2)} mg/dL, Urea ${baseUrea}, Na ${baseNa}, K ${baseK}`,
            fluidBalance: 'Balance 24h: -240 mL',
            diureticsOrRrt: 'Uresis espontánea conservada',
          },
          infectious: {
            infectionData: `Tmáx ${temp}°C en últimas 24h`,
            acutePhaseReactants: `Leucocitos ${baseLeucos}/uL, PCR ${archetype.antibiotics.length > 0 ? '18.5' : '4.2'} mg/L`,
            antibioticsInUse:
              archetype.antibiotics.map((a) => `${a.name} ${a.dose} ${a.route} ${a.frequency}`).join(' + ') ||
              'Sin antimicrobianos activos',
          },
        }
      : undefined,
    clinicalHistory: {
      interrogationType: 'Directo',
      maritalStatus: 'Casado(a)',
      occupation: 'Empleado(a) / Hogar',
      education: 'Secundaria completa',
      origin: 'Ciudad de México',
      residence: 'Área Metropolitana',
      religion: 'Católica',
      ahf: 'Madre con Diabetes Mellitus tipo 2 e Hipertensión Arterial Sistémica; padre con cardiopatía isquémica.',
      apnp: 'Habitación urbana con todos los servicios básicos, zoonosis negada, esquema de vacunación completo.',
      app: archetype.relevantHistory,
      currentIllness: archetype.admissionReason,
      ipas: 'Sin síntomas agregados fuera de los descritos en el padecimiento actual.',
      weightKg,
      heightCm,
      bmi,
      physicalExamGeneral: `Paciente consciente, orientado, TA ${sysBp}/${diaBp} mmHg, FC ${hr} lpm, FR ${rr} rpm, Temp ${temp}°C, SpO2 ${spo2}%. Cardiopulmonar y abdomen con hallazgos descritos en evolución.`,
      initialLabsGabinete: archetype.studySummary,
      clinicalAnalysis: `Paciente de ${age} años con cuadro compatible con ${archetype.title}. Se instaura manejo médico dirigido y vigilancia estrecha en ${serviceName}.`,
      diagnosticImpression: archetype.diagnoses.join('\n'),
      prognosisLife: archetype.severity === 'Muy Grave / UCI' ? 'Reservado a evolución' : 'Bueno para la vida',
      prognosisFunction: 'Reservado a evolución',
      admissionPlan: `${archetype.diet}. ${ivFluidsText}.`,
      authorName: 'Dr. González Miranda',
    },
    lastUpdated: `2026-10-27T0${8 + (indexZeroBased % 2)}:${String((indexZeroBased * 7) % 60).padStart(2, '0')}:00Z`,
  };
}

export function generateStressTestPatients(totalCount: number = 100): Patient[] {
  const result: Patient[] = [...baseFourPatients];
  for (let i = baseFourPatients.length; i < totalCount; i++) {
    result.push(buildGeneratedPatient(i));
  }
  return result.slice(0, totalCount);
}

export const seedPatients: Patient[] = generateStressTestPatients(100);

export const seedNotes: ClinicalNoteRecord[] = seedPatients.slice(0, 25).map((pt, idx) => ({
  id: `note-${pt.id}`,
  patientId: pt.id,
  patientName: pt.name,
  bed: pt.bed,
  service: pt.service,
  date: '2026-10-27',
  time: `0${7 + (idx % 3)}:${String((idx * 11) % 60).padStart(2, '0')}`,
  noteType: idx % 4 === 0 ? 'Nota de Ingreso' : 'Nota de Evolución',
  content: `HOSPITAL GENERAL - ${pt.service.toUpperCase()}
${idx % 4 === 0 ? 'NOTA DE INGRESO' : 'NOTA DE EVOLUCIÓN'}
PACIENTE: ${pt.name.toUpperCase()} | EXPEDIENTE: ${pt.recordNumber} | CAMA: ${pt.bed}
1. SUBJETIVO / MOTIVO: ${pt.admissionReason || 'En vigilancia clínica.'}
2. OBJETIVO: TA ${pt.vitals.bp} mmHg, FC ${pt.vitals.hr} lpm, FR ${pt.vitals.rr} rpm, Temp ${pt.vitals.temp}°C, SpO2 ${pt.vitals.spo2}%, Glucemia ${pt.vitals.glucose} mg/dL.
3. ANÁLISIS CLÍNICO: ${pt.roundsPresentationNote || pt.evolutionSummary || 'Evolución estacionaria.'}
4. PLAN E INDICACIONES:
- Dieta: ${pt.diet || 'Blanda'}
- Soluciones: ${pt.ivFluids || 'Vía salinizada'}
- Diagnósticos: ${pt.diagnoses.join(' / ')}`,
  auditHash: generateAuditHash(`note-${pt.id}`, '2026-10-27', `${pt.name} - Evolución`),
  residentAuthor: 'Dr. González Miranda (R1 MI)',
  createdAtTimestamp: Date.now() - idx * 3600000,
}));
