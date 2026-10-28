/**
 * Core clinical calculation logic and algorithms for Internal Medicine Residency.
 * Decoupled from React UI for deterministic testing and zero-latency client evaluations.
 */

export interface AntibioticStatus {
  currentDay: number;
  totalDays: number;
  isCompleted: boolean;
  displayString: string;
}

/**
 * Calculates days of hospital stay (Días de estancia intrahospitalaria).
 * Hospital convention: Admission day is Day 1.
 */
export function calculateHospitalStayDays(admissionDateStr: string, referenceDate: Date = new Date()): number {
  if (!admissionDateStr) return 1;
  const admission = new Date(admissionDateStr);
  if (isNaN(admission.getTime())) return 1;

  // Normalize both dates to midnight UTC to avoid daylight saving or timezone shifts
  const refUTC = Date.UTC(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const admUTC = Date.UTC(admission.getFullYear(), admission.getMonth(), admission.getDate());

  const diffMs = refUTC - admUTC;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

/**
 * Calculates antibiotic or limited-dose medication progression day.
 */
export function calculateAntibioticDay(
  startDateStr: string,
  totalDays: number = 7,
  referenceDate: Date = new Date()
): AntibioticStatus {
  if (!startDateStr) {
    return {
      currentDay: 1,
      totalDays,
      isCompleted: false,
      displayString: `Día 1/${totalDays}`,
    };
  }

  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) {
    return {
      currentDay: 1,
      totalDays,
      isCompleted: false,
      displayString: `Día 1/${totalDays}`,
    };
  }

  const refUTC = Date.UTC(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());

  const diffMs = refUTC - startUTC;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const currentDay = Math.max(1, diffDays + 1);
  const isCompleted = currentDay >= totalDays;

  return {
    currentDay,
    totalDays,
    isCompleted,
    displayString: isCompleted && currentDay > totalDays 
      ? `Completado (Día ${currentDay}/${totalDays})` 
      : `Día ${currentDay}/${totalDays}`,
  };
}

/**
 * CKD-EPI 2021 Creatinine Equation (without race parameter, current KDIGO standard).
 * eGFR = 142 * min(Scr/kappa, 1)^alpha * max(Scr/kappa, 1)^-1.200 * 0.9938^Age * (1.012 if female)
 */
export function calculateCKDEPI(creatinine: number, age: number, gender: 'male' | 'female'): number {
  if (creatinine <= 0 || age <= 0) return 0;
  const isFemale = gender === 'female';
  const kappa = isFemale ? 0.7 : 0.9;
  const alpha = isFemale ? -0.241 : -0.302;
  const genderMultiplier = isFemale ? 1.012 : 1.0;

  const scrOverKappa = creatinine / kappa;
  const minVal = Math.min(scrOverKappa, 1);
  const maxVal = Math.max(scrOverKappa, 1);

  const egfr =
    142 *
    Math.pow(minVal, alpha) *
    Math.pow(maxVal, -1.2) *
    Math.pow(0.9938, age) *
    genderMultiplier;

  return Math.round(egfr * 10) / 10;
}

/**
 * Corrected Sodium in Hyperglycemia (Katz / Hillier standard formula).
 * Corrected Na = Measured Na + 0.016 * (Glucose - 100)
 */
export function calculateCorrectedSodium(measuredNa: number, glucose: number): number {
  if (measuredNa <= 0) return 0;
  if (glucose <= 100) return measuredNa;
  const corrected = measuredNa + 0.016 * (glucose - 100);
  return Math.round(corrected * 10) / 10;
}

/**
 * Anion Gap calculation: Na - (Cl + HCO3)
 * Normal value: 8 - 12 mEq/L
 */
export function calculateAnionGap(na: number, cl: number, hco3: number): number {
  if (na <= 0 || cl <= 0) return 0;
  return Math.round((na - (cl + hco3)) * 10) / 10;
}

/**
 * Free Water Deficit in Hypernatremia.
 * Deficit (L) = TBW * ((Serum Na / 140) - 1)
 */
export function calculateFreeWaterDeficit(
  weightKg: number,
  sodium: number,
  gender: 'male' | 'female',
  isElderly: boolean = false
): number {
  if (weightKg <= 0 || sodium <= 140) return 0;
  let factor = gender === 'male' ? (isElderly ? 0.5 : 0.6) : (isElderly ? 0.45 : 0.5);
  const tbw = weightKg * factor;
  const deficit = tbw * (sodium / 140 - 1);
  return Math.max(0, Math.round(deficit * 10) / 10);
}

/**
 * CURB-65 Score for Community-Acquired Pneumonia
 * Confusion (1), Urea > 7 mmol/L or BUN > 19 mg/dL (1), Respiratory rate >= 30 (1),
 * Blood pressure SBP < 90 or DBP <= 60 (1), Age >= 65 (1)
 */
export function calculateCURB65(params: {
  confusion: boolean;
  bunAbove19: boolean;
  rrAbove30: boolean;
  hypotension: boolean;
  age65OrMore: boolean;
}): { score: number; mortalityRisk: string; recommendation: string } {
  let score = 0;
  if (params.confusion) score++;
  if (params.bunAbove19) score++;
  if (params.rrAbove30) score++;
  if (params.hypotension) score++;
  if (params.age65OrMore) score++;

  if (score <= 1) {
    return { score, mortalityRisk: '< 2.7%', recommendation: 'Bajo riesgo. Considerar manejo ambulatorio.' };
  } else if (score === 2) {
    return { score, mortalityRisk: '~ 6.8%', recommendation: 'Riesgo moderado. Hospitalización en piso de Medicina Interna.' };
  } else {
    return { score, mortalityRisk: '14 - 28%', recommendation: 'Alto riesgo de mortalidad. Valorar Terapia Intermedia / UCI.' };
  }
}

/**
 * Generates an immutable, tamper-evident hash for clinical audit and medico-legal backup protection.
 * Simple robust hash implementation (Jenkins 32-bit / FNV-1a composite string)
 */
export function generateAuditHash(recordId: string, timestamp: string, content: string): string {
  const input = `${recordId}::${timestamp}::${content}`;
  let hash1 = 0x811c9dc5;
  let hash2 = 0x55555555;

  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash1 ^= char;
    hash1 = (hash1 * 0x01000193) >>> 0;

    hash2 = (hash2 + ((char << 5) - char)) | 0;
  }

  const hex1 = ('00000000' + hash1.toString(16)).slice(-8).toUpperCase();
  const hex2 = ('00000000' + (hash2 >>> 0).toString(16)).slice(-8).toUpperCase();
  return `MED-HASH-v1-${hex1}-${hex2}`;
}

/**
 * Generates an institutional formatted clinical progress note (SOAP / Medicina Interna)
 * immediately offline without requiring external network access.
 */
export interface StructuredSoapInput {
  patient: {
    name: string;
    bed: string;
    service: string;
    age: number | string;
    gender: string;
    diagnoses: string;
    previousDiagnoses?: string;
    hospitalStayDays: number;
    codeStatus: string;
    allergies?: string;
  };
  vitals: {
    bp: string;
    hr: string;
    rr: string;
    temp: string;
    spo2: string;
    glucose?: string;
    weightKg?: number | string;
  };
  // S - Subjetivo
  currentIllness?: string;
  patientComplaintsToday?: string;
  subjective?: string; // fallback
  // O - Objetivo
  physicalExam: string;
  chronologicalLabsText?: string;
  imagingStudiesText?: string;
  newLabsText?: string;
  priorLabsText?: string;
  recentLabsText?: string; // fallback
  glasgowOrBalance?: string;
  // A - Análisis
  problemAnalysis: string;
  antibioticSummary?: string;
  // P - Plan (Orden estándar hospitalario)
  dietPlan?: string;
  dietSpecialNotes?: string;
  solutionsPlan?: string;
  structuredSolutions?: Array<{
    id: string;
    solutionType: string;
    volume?: string;
    addedConcentrateOrMed?: string;
    concentration?: string;
    route: 'IV' | 'CVC' | 'IO';
    infusionRate?: string;
    specialNotes?: string;
  }>;
  medicationsPlan?: string;
  nursingOrdersPlan?: string;
  structuredNursingOrders?: Array<{
    id: string;
    text: string;
    note?: string;
  }>;
  treatmentPlan?: string; // fallback
  pendingsText?: string;
  criticalCareSystemsText?: string; // Evolución clínica detallada por sistemas (pacientes críticos)
  // Autor / Responsable
  residentName?: string;
  residentAuthorTitle?: string;
}

export interface CriticalSystemSummaryItem {
  key: 'neuro' | 'respiratory' | 'hemodynamic' | 'gastroMetabolic' | 'renal' | 'infectious';
  label: string;
  shortLabel: string;
  summary: string;
  badgeClass: string;
}

export function formatCriticalCareSystemsSummary(systems?: {
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
}): CriticalSystemSummaryItem[] {
  if (!systems || systems.enabled === false) return [];
  const items: CriticalSystemSummaryItem[] = [];

  if (systems.neuro) {
    const n = systems.neuro;
    const scales: string[] = [];
    if (n.glasgow?.trim()) scales.push(`Glasgow ${n.glasgow.trim()}`);
    if (n.fourScore?.trim()) scales.push(`FOUR ${n.fourScore.trim()}`);
    if (n.rass?.trim()) scales.push(`RASS ${n.rass.trim()}`);
    const parts = [
      n.consciousness?.trim(),
      scales.length > 0 ? `[${scales.join(' · ')}]` : '',
      n.sedationAnalgesia?.trim() ? `Sedación: ${n.sedationAnalgesia.trim()}` : '',
      n.reflexes?.trim(),
      n.notes?.trim(),
    ].filter(Boolean);
    if (parts.length > 0) {
      items.push({
        key: 'neuro',
        label: 'Neurológico',
        shortLabel: 'Neuro',
        summary: parts.join(' | '),
        badgeClass:
          'bg-indigo-50 text-indigo-900 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-200 dark:border-indigo-800',
      });
    }
  }

  if (systems.respiratory) {
    const r = systems.respiratory;
    const ventParams: string[] = [];
    if (r.ventMode?.trim()) ventParams.push(`Modo ${r.ventMode.trim()}`);
    if (r.fio2?.trim()) ventParams.push(`FiO2 ${r.fio2.trim().replace(/%+$/, '')}%`);
    if (r.peep?.trim()) ventParams.push(`PEEP ${r.peep.trim()}`);
    if (r.tidalVolume?.trim()) ventParams.push(`Vt ${r.tidalVolume.trim()}`);
    if (r.respRateVent?.trim()) ventParams.push(`FR ${r.respRateVent.trim()}`);

    const parts = [
      r.supportType?.trim(),
      ventParams.length > 0 ? `(${ventParams.join(', ')})` : '',
      r.spo2?.trim() ? `SpO2 ${r.spo2.trim().replace(/%+$/, '')}%` : '',
      r.bloodGas?.trim() ? `Gaso: ${r.bloodGas.trim()}` : '',
      r.notes?.trim(),
    ].filter(Boolean);
    if (parts.length > 0) {
      items.push({
        key: 'respiratory',
        label: 'Respiratorio',
        shortLabel: 'Resp/Vent',
        summary: parts.join(' | '),
        badgeClass:
          'bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:border-sky-800',
      });
    }
  }

  if (systems.hemodynamic) {
    const h = systems.hemodynamic;
    const parts = [
      h.hemodynamicStatus?.trim(),
      h.bpAndMap?.trim(),
      h.vasopressorsInotropes?.trim() ? `Apoyo: ${h.vasopressorsInotropes.trim()}` : '',
      h.hrAndRhythm?.trim() ? `Ritmo: ${h.hrAndRhythm.trim()}` : '',
      h.notes?.trim(),
    ].filter(Boolean);
    if (parts.length > 0) {
      items.push({
        key: 'hemodynamic',
        label: 'Hemodinámico / Cardiológico',
        shortLabel: 'Hemodinámico',
        summary: parts.join(' | '),
        badgeClass:
          'bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-800',
      });
    }
  }

  if (systems.gastroMetabolic) {
    const g = systems.gastroMetabolic;
    const parts = [
      g.glycemias?.trim() ? `Glucemias: ${g.glycemias.trim()}` : '',
      g.feedingType?.trim() ? `Nutrición: ${g.feedingType.trim()}` : '',
      g.abdomenAndBowel?.trim(),
      g.notes?.trim(),
    ].filter(Boolean);
    if (parts.length > 0) {
      items.push({
        key: 'gastroMetabolic',
        label: 'Gastrointestinal / Metabólico',
        shortLabel: 'GI / Metab',
        summary: parts.join(' | '),
        badgeClass:
          'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800',
      });
    }
  }

  if (systems.renal) {
    const rn = systems.renal;
    const parts = [
      rn.diuresis?.trim() ? `Diuresis: ${rn.diuresis.trim()}` : '',
      rn.renalFunction?.trim() ? `Función renal: ${rn.renalFunction.trim()}` : '',
      rn.fluidBalance?.trim() ? `Balances: ${rn.fluidBalance.trim()}` : '',
      rn.diureticsOrRrt?.trim() ? `Diurético/TRR: ${rn.diureticsOrRrt.trim()}` : '',
      rn.notes?.trim(),
    ].filter(Boolean);
    if (parts.length > 0) {
      items.push({
        key: 'renal',
        label: 'Renal',
        shortLabel: 'Renal',
        summary: parts.join(' | '),
        badgeClass:
          'bg-teal-50 text-teal-900 border-teal-200 dark:bg-teal-950/50 dark:text-teal-200 dark:border-teal-800',
      });
    }
  }

  if (systems.infectious) {
    const inf = systems.infectious;
    const parts = [
      inf.infectionData?.trim(),
      inf.acutePhaseReactants?.trim() ? `Reactantes: ${inf.acutePhaseReactants.trim()}` : '',
      inf.antibioticsInUse?.trim() ? `ATB: ${inf.antibioticsInUse.trim()}` : '',
      inf.notes?.trim(),
    ].filter(Boolean);
    if (parts.length > 0) {
      items.push({
        key: 'infectious',
        label: 'Infeccioso',
        shortLabel: 'Infeccioso',
        summary: parts.join(' | '),
        badgeClass:
          'bg-purple-50 text-purple-900 border-purple-200 dark:bg-purple-950/50 dark:text-purple-200 dark:border-purple-800',
      });
    }
  }

  return items;
}

export function formatCriticalCareSystemsForNote(
  systems?: Parameters<typeof formatCriticalCareSystemsSummary>[0]
): string {
  const items = formatCriticalCareSystemsSummary(systems);
  if (items.length === 0) return '';
  return [
    'EVOLUCIÓN Y PARÁMETROS POR SISTEMAS:',
    ...items.map((item) => `- ${item.label}: ${item.summary}`),
  ].join('\n');
}

export function formatParenteralSolutionLine(sol: {
  solutionType: string;
  volume?: string;
  addedConcentrateOrMed?: string;
  concentration?: string;
  route: 'IV' | 'CVC' | 'IO';
  infusionRate?: string;
}): string {
  const parts: string[] = [];
  if (sol.solutionType?.trim()) parts.push(sol.solutionType.trim());
  if (sol.volume?.trim()) parts.push(`${sol.volume.trim()} ml`.replace(/ml\s*ml$/i, 'ml'));
  if (sol.addedConcentrateOrMed?.trim()) {
    parts.push(`+ ${sol.addedConcentrateOrMed.trim()}`);
  }
  if (sol.concentration?.trim()) {
    parts.push(`[Conc: ${sol.concentration.trim()}]`);
  }
  parts.push(`Vía ${sol.route || 'IV'}`);
  if (sol.infusionRate?.trim()) {
    parts.push(`a ${sol.infusionRate.trim()}`);
  }
  return parts.join(' ');
}

/**
 * Parses string diagnosis array (e.g. "1. [CIE-10: J18.9] Neumonía") into structured DiagnosisEntry items
 */
export function parseDiagnosesList(lines?: string[] | string): Array<{
  id: string;
  cie10: string;
  description: string;
}> {
  const rawArray = Array.isArray(lines)
    ? lines
    : typeof lines === 'string'
    ? lines.split('\n')
    : [];

  const parsed = rawArray
    .map((line, idx) => {
      const trimmed = (line || '').trim();
      if (!trimmed) return null;
      // Strip leading numbering like "1.", "1)", "•", "-"
      const withoutNum = trimmed.replace(/^(?:\d+[.)]\s*|[•\-*]\s*)/, '').trim();
      // Match optional [CIE-10: CODE] or (CIE-10: CODE) or [CODE]
      const cieMatch =
        withoutNum.match(/^\[(?:CIE-?10:\s*)?([A-Z0-9.-]+)\]\s*(.*)$/i) ||
        withoutNum.match(/^\((?:CIE-?10:\s*)([A-Z0-9.-]+)\)\s*(.*)$/i);
      if (cieMatch) {
        return {
          id: `diag-${idx}`,
          cie10: cieMatch[1].toUpperCase().trim(),
          description: cieMatch[2].trim(),
        };
      }
      return {
        id: `diag-${idx}`,
        cie10: '',
        description: withoutNum,
      };
    })
    .filter((item): item is { id: string; cie10: string; description: string } => Boolean(item));

  return parsed;
}

/**
 * Formats structured DiagnosisEntry items back into numbered strings with CIE-10 next to the number
 */
export function formatDiagnosesList(
  entries: Array<{ cie10?: string; description: string }>
): string[] {
  return entries
    .map((e) => ({
      cie10: (e.cie10 || '').trim().toUpperCase(),
      description: (e.description || '').trim(),
    }))
    .filter((e) => e.description.length > 0 || e.cie10.length > 0)
    .map((e, idx) => {
      const codePrefix = e.cie10 ? `[CIE-10: ${e.cie10}] ` : '';
      return `${idx + 1}. ${codePrefix}${e.description}`;
    });
}

/**
 * Formats all patient laboratories in reverse chronological order (most recent first, oldest last),
 * with each date on a single continuous comma-separated paragraph to save vertical paper space.
 * Supports both numeric fields and string LabRecord fields + extraParams from all 14 panels.
 */
export function formatChronologicalLabsParagraphs(
  labs?: Array<{
    date: string;
    time?: string;
    hb?: number | string;
    leucos?: number | string;
    wbc?: number | string;
    neutrophils?: number | string;
    lymphocytes?: number | string;
    plaquetas?: number | string;
    platelets?: number | string;
    glucosa?: number | string;
    glucose?: number | string;
    urea?: number | string;
    bun?: number | string;
    creatinina?: number | string;
    creatinine?: number | string;
    na?: number | string;
    sodium?: number | string;
    k?: number | string;
    potassium?: number | string;
    cl?: number | string;
    chloride?: number | string;
    calcium?: number | string;
    phosphorus?: number | string;
    magnesium?: number | string;
    albumin?: number | string;
    biliTotal?: number | string;
    biliDirect?: number | string;
    ast?: number | string;
    alt?: number | string;
    alp?: number | string;
    ldh?: number | string;
    ph?: number | string;
    pco2?: number | string;
    po2?: number | string;
    hco3?: number | string;
    eb?: number | string;
    lactato?: number | string;
    lactate?: number | string;
    pcr?: number | string;
    procalcitonina?: number | string;
    pct?: number | string;
    vsg?: number | string;
    ferritin?: number | string;
    troponin?: number | string;
    bnp?: number | string;
    dimerD?: number | string;
    tp?: number | string;
    inr?: number | string;
    ttpa?: number | string;
    extraParams?: Record<string, { label: string; value: string; unit?: string; panel?: string }>;
    otherNotes?: string;
    notes?: string;
  }>
): string {
  if (!labs || labs.length === 0) {
    return 'Sin laboratorios registrados hasta el momento.';
  }

  // Sort most recent first, oldest last
  const sorted = [...labs].sort((a, b) => {
    const dtA = `${a.date || ''}T${a.time || '00:00'}`;
    const dtB = `${b.date || ''}T${b.time || '00:00'}`;
    return dtB.localeCompare(dtA);
  });

  return sorted
    .map((l) => {
      const dateParts = (l.date || '').split('-');
      const formattedDate =
        dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : l.date;
      const items: string[] = [];

      const hbVal = l.hb;
      if (hbVal !== undefined && hbVal !== '') items.push(`Hb ${hbVal} g/dL`);

      if (l.leucos !== undefined && l.leucos !== '') {
        const numLeu = typeof l.leucos === 'number' ? l.leucos.toLocaleString() : l.leucos;
        items.push(`Leucos ${numLeu}/µL`);
      } else if (l.wbc) {
        items.push(`Leucos ${l.wbc}`);
      }
      if (l.neutrophils) items.push(`Neu ${l.neutrophils}`);
      if (l.lymphocytes) items.push(`Lin ${l.lymphocytes}`);

      if (l.plaquetas !== undefined && l.plaquetas !== '') {
        const numPlaq = typeof l.plaquetas === 'number' ? l.plaquetas.toLocaleString() : l.plaquetas;
        items.push(`Plaq ${numPlaq}/µL`);
      } else if (l.platelets) {
        items.push(`Plaq ${l.platelets}`);
      }

      const gluVal = l.glucosa ?? l.glucose;
      if (gluVal !== undefined && gluVal !== '') items.push(`Glucosa ${gluVal} mg/dL`);
      if (l.urea !== undefined && l.urea !== '') items.push(`Urea ${l.urea} mg/dL`);
      if (l.bun !== undefined && l.bun !== '') items.push(`BUN ${l.bun} mg/dL`);
      const crVal = l.creatinina ?? l.creatinine;
      if (crVal !== undefined && crVal !== '') items.push(`Cr ${crVal} mg/dL`);

      const naVal = l.na ?? l.sodium;
      if (naVal !== undefined && naVal !== '') items.push(`Na ${naVal} mEq/L`);
      const kVal = l.k ?? l.potassium;
      if (kVal !== undefined && kVal !== '') items.push(`K ${kVal} mEq/L`);
      const clVal = l.cl ?? l.chloride;
      if (clVal !== undefined && clVal !== '') items.push(`Cl ${clVal} mEq/L`);
      if (l.calcium) items.push(`Ca ${l.calcium} mg/dL`);
      if (l.phosphorus) items.push(`P ${l.phosphorus} mg/dL`);
      if (l.magnesium) items.push(`Mg ${l.magnesium} mg/dL`);

      if (l.ast) items.push(`AST ${l.ast} U/L`);
      if (l.alt) items.push(`ALT ${l.alt} U/L`);
      if (l.alp) items.push(`FA ${l.alp} U/L`);
      if (l.biliTotal) items.push(`BT ${l.biliTotal} mg/dL`);
      if (l.biliDirect) items.push(`BD ${l.biliDirect} mg/dL`);
      if (l.albumin) items.push(`Alb ${l.albumin} g/dL`);
      if (l.ldh) items.push(`DHL ${l.ldh} U/L`);

      if (l.tp) items.push(`TP ${l.tp}s`);
      if (l.inr) items.push(`INR ${l.inr}`);
      if (l.ttpa) items.push(`TTPa ${l.ttpa}s`);
      if (l.dimerD) items.push(`Dímero D ${l.dimerD}`);

      if (l.ph !== undefined && l.ph !== '') items.push(`pH ${l.ph}`);
      if (l.pco2 !== undefined && l.pco2 !== '') items.push(`pCO2 ${l.pco2} mmHg`);
      if (l.po2 !== undefined && l.po2 !== '') items.push(`pO2 ${l.po2} mmHg`);
      if (l.hco3 !== undefined && l.hco3 !== '') items.push(`HCO3 ${l.hco3} mEq/L`);
      if (l.eb) items.push(`EB ${l.eb}`);
      const lacVal = l.lactato ?? l.lactate;
      if (lacVal !== undefined && lacVal !== '') items.push(`Lactato ${lacVal} mmol/L`);

      if (l.pcr !== undefined && l.pcr !== '') items.push(`PCR ${l.pcr} mg/L`);
      const pctVal = l.procalcitonina ?? l.pct;
      if (pctVal !== undefined && pctVal !== '') items.push(`PCT ${pctVal} ng/mL`);
      if (l.vsg) items.push(`VSG ${l.vsg} mm/h`);
      if (l.ferritin) items.push(`Ferritina ${l.ferritin} ng/mL`);
      if (l.troponin) items.push(`Troponina ${l.troponin}`);
      if (l.bnp) items.push(`BNP ${l.bnp} pg/mL`);

      if (l.extraParams) {
        Object.values(l.extraParams).forEach((ep) => {
          if (ep && ep.value?.trim()) {
            const unitSuffix = ep.unit ? ` ${ep.unit}` : '';
            items.push(`${ep.label} ${ep.value.trim()}${unitSuffix}`);
          }
        });
      }

      const noteStr = l.otherNotes?.trim() || l.notes?.trim();
      if (noteStr) items.push(noteStr);

      return `${formattedDate}: ${items.join(', ')}.`;
    })
    .join('\n');
}

/**
 * Formats all imaging and diagnostic studies in reverse chronological order (most recent first, oldest last),
 * each study in a single continuous paragraph to save paper space.
 */
export function formatChronologicalStudiesParagraphs(
  studies?: Array<{
    date: string;
    time?: string;
    category: string;
    title: string;
    summary: string;
  }>
): string {
  if (!studies || studies.length === 0) {
    return 'Sin estudios de imagen o gabinete reportados.';
  }

  const sorted = [...studies].sort((a, b) => {
    const dtA = `${a.date || ''}T${a.time || '00:00'}`;
    const dtB = `${b.date || ''}T${b.time || '00:00'}`;
    return dtB.localeCompare(dtA);
  });

  return sorted
    .map((s) => {
      const dateParts = (s.date || '').split('-');
      const formattedDate =
        dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : s.date;
      return `${formattedDate}: ${s.title} (${s.category}) — ${s.summary.trim().replace(/\n+/g, ' ')}`;
    })
    .join('\n');
}

export function buildDeterministicProgressNote(data: StructuredSoapInput): string {
  // 1. Opening paragraph: Integrates patient stay days, current active diagnoses (and previous diagnoses if evolved), and subjective status in prose WITHOUT titles or identification headers
  const genderLower =
    (data.patient.gender || '').toLowerCase().startsWith('f') ? 'femenina' : 'masculino';
  const diagLines = (data.patient.diagnoses || '')
    .split('\n')
    .map((d) => d.trim())
    .filter(Boolean);
  const inlineDiagnoses =
    diagLines.length > 0 ? diagLines.join('; ') : 'En protocolo de estudio por Medicina Interna';

  const prevDiagLines = (data.patient.previousDiagnoses || '')
    .split('\n')
    .map((d) => d.trim())
    .filter(Boolean);
  const prevDiagInline = prevDiagLines.join('; ');
  const hasDifferentPrevDiag =
    prevDiagInline && prevDiagInline.toLowerCase() !== inlineDiagnoses.toLowerCase();

  const openingDiagnosesSentence = `Paciente ${genderLower} de ${data.patient.age} años de edad, en su ${data.patient.hospitalStayDays}° día de estancia intrahospitalaria, cursando con los diagnósticos actuales de: ${inlineDiagnoses}.${
    hasDifferentPrevDiag ? ` (Diagnósticos previos de ingreso: ${prevDiagInline}).` : ''
  }`;

  const subjectiveParts: string[] = [];
  if (data.currentIllness?.trim()) {
    const trimmedIllness = data.currentIllness.trim();
    if (!trimmedIllness.toLowerCase().startsWith('paciente en su')) {
      subjectiveParts.push(trimmedIllness.replace(/\n+/g, ' '));
    }
  }
  if (data.patientComplaintsToday?.trim()) {
    subjectiveParts.push(data.patientComplaintsToday.trim().replace(/\n+/g, ' '));
  } else if (data.subjective?.trim()) {
    subjectiveParts.push(data.subjective.trim().replace(/\n+/g, ' '));
  }

  const paragraph1 = [openingDiagnosesSentence, ...subjectiveParts].filter(Boolean).join(' ');

  // 2. Second paragraph: Vital signs inline at the start of the physical exam in prose WITHOUT title
  const vitalsInlineParts: string[] = [
    `TA ${data.vitals.bp || '120/80'} mmHg`,
    `FC ${data.vitals.hr || '75'} lpm`,
    `FR ${data.vitals.rr || '18'} rpm`,
    `Temp ${data.vitals.temp || '36.5'} °C`,
    `SpO2 ${data.vitals.spo2 || '96'}%`,
  ];
  if (data.vitals.glucose) {
    vitalsInlineParts.push(`Glucemia capilar ${data.vitals.glucose} mg/dL`);
  }
  if (data.vitals.weightKg) {
    vitalsInlineParts.push(`Peso ${data.vitals.weightKg} kg`);
  }
  if (data.glasgowOrBalance?.trim()) {
    vitalsInlineParts.push(data.glasgowOrBalance.trim().replace(/\.$/, ''));
  }

  const physicalProse = data.physicalExam.trim().replace(/\n+/g, ' ');
  const paragraph2 = `Signos vitales: ${vitalsInlineParts.join(', ')}. ${physicalProse}`;

  // 3. PARACLÍNICOS (With Title, chronological from most recent to oldest, comma-separated single paragraph per date)
  const labsContent =
    data.chronologicalLabsText?.trim() ||
    [data.newLabsText?.trim(), data.priorLabsText?.trim(), data.recentLabsText?.trim()]
      .filter(Boolean)
      .join('\n') ||
    'Sin laboratorios reportados.';

  // 4. ESTUDIOS DE IMAGEN Y GABINETE (With Title)
  const studiesContent = data.imagingStudiesText?.trim();

  // 5. ANÁLISIS (With Title, no antimicrobial registry block)
  const analysisContent = `${data.problemAnalysis.trim().replace(/\n+/g, ' ')} Pronóstico: Reservado a evolución intrahospitalaria.`;

  // 6. INDICACIONES MÉDICAS (Hierarchical numbered list + indented bullet subsections)
  const indicationLines: string[] = [];

  if (
    data.dietPlan ||
    data.solutionsPlan ||
    (data.structuredSolutions && data.structuredSolutions.length > 0) ||
    data.medicationsPlan ||
    data.nursingOrdersPlan ||
    (data.structuredNursingOrders && data.structuredNursingOrders.length > 0)
  ) {
    // 1. Dieta
    indicationLines.push('1. Dieta:');
    const dietRawLines = (data.dietPlan?.trim() || 'Dieta normosódica adecuada a patología de base.')
      .split('\n')
      .map((l) => l.replace(/^[•\-*]\s*/, '').trim())
      .filter(Boolean);
    indicationLines.push(`   - ${dietRawLines[0] || 'Dieta normosódica adecuada a patología de base.'}`);
    if (dietRawLines.length > 1) {
      dietRawLines.slice(1).forEach((extra) => {
        indicationLines.push(`     ${extra}`);
      });
    }
    if (data.dietSpecialNotes?.trim()) {
      data.dietSpecialNotes
        .trim()
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .forEach((spec) => {
          indicationLines.push(`     ${spec}`);
        });
    }

    // 2. Soluciones
    indicationLines.push('2. Soluciones:');
    if (data.structuredSolutions && data.structuredSolutions.length > 0) {
      data.structuredSolutions.forEach((sol) => {
        indicationLines.push(`   - ${formatParenteralSolutionLine(sol)}`);
        if (sol.specialNotes?.trim()) {
          sol.specialNotes
            .trim()
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
            .forEach((noteLine) => {
              indicationLines.push(`     ${noteLine}`);
            });
        }
      });
    } else if (data.solutionsPlan?.trim()) {
      const solLines = data.solutionsPlan
        .trim()
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      solLines.forEach((line) => {
        if (line.startsWith('Nota:') || line.startsWith('Indicaciones:')) {
          indicationLines.push(`     ${line}`);
        } else {
          indicationLines.push(`   - ${line.replace(/^[•\-*]\s*/, '')}`);
        }
      });
    } else {
      indicationLines.push('   - Vena periférica permeable / Catéter heparinizado.');
    }

    // 3. Medicamentos
    indicationLines.push('3. Medicamentos:');
    if (data.medicationsPlan?.trim()) {
      const medLines = data.medicationsPlan
        .trim()
        .split('\n')
        .map((m) => m.replace(/^[•\-*\d.)\s]+/, '').trim())
        .filter(Boolean);
      if (medLines.length > 0) {
        medLines.forEach((m) => {
          indicationLines.push(`   - ${m}`);
        });
      } else {
        indicationLines.push('   - Continuar esquema farmacológico establecido.');
      }
    } else {
      indicationLines.push('   - Continuar esquema farmacológico establecido.');
    }

    // 4. Indicaciones de enfermería
    indicationLines.push('4. Indicaciones de enfermería:');
    if (data.structuredNursingOrders && data.structuredNursingOrders.length > 0) {
      data.structuredNursingOrders.forEach((ord) => {
        if (!ord.text?.trim()) return;
        indicationLines.push(`   - ${ord.text.replace(/^[•\-*\d.)\s]+/, '').trim()}`);
        if (ord.note?.trim()) {
          ord.note
            .trim()
            .split('\n')
            .map((n) => n.trim())
            .filter(Boolean)
            .forEach((noteLine) => {
              indicationLines.push(`     ${noteLine}`);
            });
        }
      });
    } else if (data.nursingOrdersPlan?.trim()) {
      const rawNursing = data.nursingOrdersPlan.split('\n');
      rawNursing.forEach((line) => {
        if (!line.trim()) return;
        const isSubNote = /^\s{2,}/.test(line) && !/^\s*[•\-*]/.test(line);
        if (isSubNote) {
          indicationLines.push(`     ${line.trim()}`);
        } else {
          const cleanN = line.replace(/^[•\-*\d.)\s]+/, '').trim();
          if (cleanN) indicationLines.push(`   - ${cleanN}`);
        }
      });
    } else {
      indicationLines.push('   - Signos vitales por turno y cuidados generales de enfermería.');
    }

    // 5. Pendientes
    const cleanPendingsList = (data.pendingsText || '')
      .trim()
      .split('\n')
      .map((p) => p.replace(/^[•\-*\d.)\s□]+/, '').trim())
      .filter((p) => p && !p.toLowerCase().includes('sin estudios pendientes'));

    if (cleanPendingsList.length > 0) {
      indicationLines.push('5. Pendientes:');
      cleanPendingsList.forEach((p) => {
        indicationLines.push(`   - ${p}`);
      });
    }
  } else if (data.treatmentPlan?.trim()) {
    const rawLines = data.treatmentPlan
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    rawLines.forEach((l) => {
      indicationLines.push(l);
    });
  } else {
    indicationLines.push('1. Continuar manejo médico intrahospitalario establecido.');
  }

  const sections: string[] = [paragraph1, paragraph2];

  if (data.criticalCareSystemsText?.trim()) {
    sections.push(data.criticalCareSystemsText.trim());
  }

  sections.push(`PARACLÍNICOS:\n${labsContent}`);

  if (studiesContent && !studiesContent.toLowerCase().includes('sin estudios de imagen')) {
    sections.push(`ESTUDIOS DE IMAGEN Y GABINETE:\n${studiesContent}`);
  }

  sections.push(`ANÁLISIS:\n${analysisContent}`);
  sections.push(`INDICACIONES MÉDICAS:\n${indicationLines.join('\n')}`);

  if (data.residentName?.trim()) {
    sections.push(`Elaboró: ${data.residentName.trim()}`);
  }

  return sections.join('\n\n');
}

/**
 * Formats a full Mexican Official Standard (NOM-004-SSA3-2012) Clinical History note
 * for Internal Medicine admissions. Starts directly from HISTORIA CLÍNICA (no hospital/department header)
 * and includes ANÁLISIS CLÍNICO before IMPRESIÓN DIAGNÓSTICA and PLAN DE MANEJO.
 */
export function buildNomClinicalHistoryNote(data: {
  patient: {
    name: string;
    bed: string;
    service: string;
    age: number | string;
    gender: string;
    recordNumber: string;
    admissionDate: string;
    codeStatus: string;
    allergies: string;
  };
  history: {
    interrogationType?: string;
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
    weightKg?: number | string;
    heightCm?: number | string;
    bmi?: number | string;
    physicalExamGeneral?: string;
    initialLabsGabinete?: string;
    clinicalAnalysis?: string;
    diagnosticImpression?: string;
    prognosisLife?: string;
    prognosisFunction?: string;
    admissionPlan?: string;
  };
  vitals: {
    bp: string;
    hr: string;
    rr: string;
    temp: string;
    spo2: string;
    glucose?: string;
  };
  residentName: string;
  hospitalName?: string;
}): string {
  const admissionPlanCompact = data.history.admissionPlan
    ? data.history.admissionPlan
        .trim()
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .join('\n')
    : '1. Dieta adecuada para patología de base.\n2. Soluciones de sostén.\n3. Medicación prescrita.\n4. Medidas generales y vigilancia de datos de alarma.';

  return `HISTORIA CLÍNICA

I. FICHA DE IDENTIFICACIÓN:
Nombre: ${data.patient.name.toUpperCase()} | Edad: ${data.patient.age} años | Género: ${data.patient.gender} | Cama: ${data.patient.bed} | Exp: ${data.patient.recordNumber}
Estado Civil: ${data.history.maritalStatus || 'No especificado'} | Ocupación: ${data.history.occupation || 'No especificada'} | Escolaridad: ${data.history.education || 'No especificada'}
Lugar de origen / residencia: ${data.history.origin || 'N/E'} / ${data.history.residence || 'N/E'} | Religión: ${data.history.religion || 'No referida'} | Interrogatorio: ${data.history.interrogationType || 'Directo'}
Alergias: ${data.patient.allergies || 'Negadas'}

II. ANTECEDENTES HEREDOFAMILIARES (AHF):
${data.history.ahf.trim()}

III. ANTECEDENTES PERSONALES NO PATOLÓGICOS (APNP):
${data.history.apnp.trim()}

IV. ANTECEDENTES PERSONALES PATOLÓGICOS (APP):
${data.history.app.trim()}

V. PADECIMIENTO ACTUAL:
${data.history.currentIllness.trim()}

VI. INTERROGATORIO POR APARATOS Y SISTEMAS (IPAS):
${data.history.ipas.trim()}

VII. EXPLORACIÓN FÍSICA Y SIGNOS VITALES:
Signos vitales: TA ${data.vitals.bp || '120/80'} mmHg, FC ${data.vitals.hr || '75'} lpm, FR ${data.vitals.rr || '18'} rpm, Temp ${data.vitals.temp || '36.5'} °C, SpO2 ${data.vitals.spo2 || '96'}%${data.vitals.glucose ? `, Glucemia capilar ${data.vitals.glucose} mg/dL` : ''}${data.history.weightKg ? `, Peso ${data.history.weightKg} kg` : ''}${data.history.heightCm ? `, Talla ${data.history.heightCm} cm` : ''}${data.history.bmi ? `, IMC ${data.history.bmi} kg/m²` : ''}.
${data.history.physicalExamGeneral ? data.history.physicalExamGeneral.trim() : 'Exploración física detallada pendiente.'}

VIII. PARACLÍNICOS Y ESTUDIOS DE GABINETE AL INGRESO:
${data.history.initialLabsGabinete ? data.history.initialLabsGabinete.trim() : 'Estudios de ingreso pendientes de reporte en sistema.'}

IX. ANÁLISIS E INTEGRACIÓN CLÍNICA:
${data.history.clinicalAnalysis ? data.history.clinicalAnalysis.trim() : 'Paciente que ingresa por cuadro clínico descrito, encontrándose en protocolo diagnóstico y terapéutico integral por el servicio.'}

X. IMPRESIÓN DIAGNÓSTICA (DIAGNÓSTICOS DE INGRESO):
${data.history.diagnosticImpression ? data.history.diagnosticImpression.trim() : 'En estudio por Medicina Interna.'}

XI. PRONÓSTICO:
Para la vida: ${data.history.prognosisLife || 'Reservado a evolución intrahospitalaria'} | Para la función: ${data.history.prognosisFunction || 'Reservado a evolución intrahospitalaria'}

XII. PLAN DE MANEJO E INDICACIONES MÉDICAS:
${admissionPlanCompact}

Elaboró: ${data.residentName}`;
}

/**
 * Validates whether a patient's code status represents Do Not Resuscitate (No RCP / Voluntad Anticipada).
 * Corrected Mexican Clinical Definition:
 * - RCP 1: Reanimación Completa / Todo esfuerzo
 * - RCP 2: Limitado / Manejo intermedio (sin IOT / no invasivo)
 * - RCP 3: NO Reanimación / Voluntad Anticipada / Cuidados Paliativos
 */
export function isNoRcp(codeStatus: string): boolean {
  if (!codeStatus) return false;
  const lower = codeStatus.toLowerCase();

  if (
    lower.includes('rcp 3') ||
    lower.includes('rcp3') ||
    lower.includes('no rcp') ||
    lower.includes('voluntad') ||
    lower.includes('paliativ')
  ) {
    return true;
  }
  return false;
}

export function getCodeStatusInfo(codeStatus: string): {
  isNoRcp: boolean;
  codeLabel: 'RCP 1' | 'RCP 2' | 'RCP 3';
  shortLabel: string;
  badgeClass: string;
  description: string;
} {
  const isNo = isNoRcp(codeStatus);
  const lower = (codeStatus || '').toLowerCase();

  if (lower.includes('rcp 2') || lower.includes('rcp2') || lower.includes('rechazo') || lower.includes('no iot')) {
    return {
      isNoRcp: false,
      codeLabel: 'RCP 2',
      shortLabel: 'RCP 2 (LIMITADO / NO IOT)',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
      description: 'Manejo médico máximo sin intubación orotraqueal ni maniobras invasivas desproporcionadas',
    };
  }

  if (isNo) {
    return {
      isNoRcp: true,
      codeLabel: 'RCP 3',
      shortLabel: 'RCP 3: NO REANIMACIÓN',
      badgeClass: 'bg-rose-100 text-rose-900 border-rose-400 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800 font-extrabold',
      description: 'No Reanimación Cardiopulmonar / Voluntad Anticipada / Enfoque de Confort y Paliativo',
    };
  }

  return {
    isNoRcp: false,
    codeLabel: 'RCP 1',
    shortLabel: 'RCP 1: COMPLETO',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    description: 'Reanimación Cardiopulmonar Completa / Todo esfuerzo terapéutico',
  };
}

/**
 * Evaluates whether a patient has invasive mechanical ventilation (Intubado / VMI)
 * or non-invasive ventilation (CPAP / BiPAP / VMNI) based on clinicalTags and diagnoses.
 */
export function getRespiratorySupportFlags(patient: {
  clinicalTags?: string[];
  diagnoses?: string[];
}): {
  isIntubated: boolean;
  isCpap: boolean;
} {
  const tagsLower = (patient.clinicalTags || []).map((t) => t.toLowerCase());
  const diagLower = (patient.diagnoses || []).join(' ').toLowerCase();

  const isIntubated =
    tagsLower.some(
      (t) =>
        t.includes('vmi') ||
        t.includes('intuba') ||
        t.includes('tubo') ||
        t.includes('ventilación mecánica invasiva')
    ) ||
    diagLower.includes('intubado') ||
    diagLower.includes('ventilación mecánica invasiva');

  const isCpap =
    tagsLower.some(
      (t) =>
        t.includes('cpap') ||
        t.includes('bipap') ||
        t.includes('vmni') ||
        t.includes('no invasiva')
    ) ||
    diagLower.includes('cpap') ||
    diagLower.includes('bipap');

  return { isIntubated, isCpap };
}

/**
 * Filters out clinical tags that are already displayed as prominent top-level colored markers
 * (e.g., Intubado/VMI/Tubo, CPAP/BiPAP/VMNI, RCP 1/2/3 / No RCP / Voluntad, Grave/UCI)
 * so they are never duplicated in the secondary tags list below.
 */
export function getNonRedundantClinicalTags(tags?: string[]): string[] {
  if (!tags || tags.length === 0) return [];
  return tags.filter((tag) => {
    const t = (tag || '').trim().toLowerCase();
    if (!t) return false;
    // Intubation / invasive ventilation already shown in top INTUBADO badge
    if (
      t.includes('intuba') ||
      t.includes('vmi') ||
      t.includes('tubo') ||
      t.includes('ventilación mecánica invasiva') ||
      t.includes('ventilacion mecanica invasiva')
    ) {
      return false;
    }
    // Non-invasive ventilation already shown in top CPAP badge
    if (
      t.includes('cpap') ||
      t.includes('bipap') ||
      t.includes('vmni') ||
      t.includes('no invasiva')
    ) {
      return false;
    }
    // Code status already shown in top RCP 1 / RCP 2 / RCP 3 badge
    if (
      t.includes('rcp 1') ||
      t.includes('rcp 2') ||
      t.includes('rcp 3') ||
      t.includes('rcp1') ||
      t.includes('rcp2') ||
      t.includes('rcp3') ||
      t.includes('no rcp') ||
      t.includes('voluntad')
    ) {
      return false;
    }
    // Severity already shown in top Grave / UCI / Delicado / Estable badge
    if (
      t === 'grave' ||
      t === 'muy grave' ||
      t === 'uci' ||
      t === 'delicado' ||
      t === 'estable'
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Converts a CSS hex color string (e.g. "#2563eb" or "#0d9488") into an RGB tuple [r, g, b] for jsPDF vector drawing.
 */
export function hexToRgb(hex: string, fallback: [number, number, number] = [71, 85, 105]): [number, number, number] {
  const clean = (hex || '').replace(/^#/, '').trim();
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  return fallback;
}

/**
 * Blends an RGB color with white (255, 255, 255) by a given whiteFactor (0 = original color, 0.88 = soft pastel tint).
 */
export function tintRgb(rgb: [number, number, number], whiteFactor: number = 0.88): [number, number, number] {
  const f = Math.max(0, Math.min(1, whiteFactor));
  return [
    Math.round(rgb[0] + (255 - rgb[0]) * f),
    Math.round(rgb[1] + (255 - rgb[1]) * f),
    Math.round(rgb[2] + (255 - rgb[2]) * f),
  ];
}

/**
 * Formats diagnostic studies list for evolution note or clipboard
 */
export function formatDiagnosticStudiesSummary(studies?: Array<{
  category: string;
  title: string;
  summary: string;
  date: string;
  time?: string;
  isNew?: boolean;
}>): string {
  if (!studies || studies.length === 0) {
    return 'Sin estudios de imagen o gabinete recientes reportados.';
  }

  return studies.map((s, idx) => {
    const isNewMarker = s.isNew ? '[★ NUEVO] ' : '';
    const timeStr = s.time ? ` (${s.time} hrs)` : '';
    return `${idx + 1}. ${isNewMarker}[${s.category}] ${s.title} (${s.date}${timeStr}):\n   • Conclusión / Hallazgos: ${s.summary}`;
  }).join('\n\n');
}

/**
 * Returns color, hex code, and badge styling for any hospital service
 */
export function getServiceColorInfo(
  serviceName: string,
  catalog?: Array<{ id: string; name: string; color: string }>
): {
  color: string;
  badgeStyle: {
    backgroundColor: string;
    borderColor: string;
    color: string;
  };
} {
  const defaultColors: Record<string, string> = {
    'medicina interna piso 3': '#0d9488',
    'medicina interna piso 4': '#2563eb',
    'urgencias adultos': '#ea580c',
    'terapia intermedia': '#7c3aed',
    'unidad de cuidados intensivos (uci)': '#e11d48',
    'uci adultos': '#e11d48',
  };

  const norm = (serviceName || '').trim().toLowerCase();
  let hex = '#0d9488'; // fallback teal

  if (catalog && catalog.length > 0) {
    const found = catalog.find((s) => s.name.trim().toLowerCase() === norm);
    if (found?.color) {
      hex = found.color;
    } else if (defaultColors[norm]) {
      hex = defaultColors[norm];
    }
  } else if (defaultColors[norm]) {
    hex = defaultColors[norm];
  }

  return {
    color: hex,
    badgeStyle: {
      backgroundColor: `${hex}18`,
      borderColor: `${hex}66`,
      color: hex,
    },
  };
}

/**
 * Returns custom color, hex code, and badge styling for an Attending Physician (Médico a Cargo)
 */
export function getDoctorColorInfo(
  doctorName?: string,
  catalog?: Array<{ id: string; name: string; color: string }>
): {
  color: string;
  badgeStyle: {
    backgroundColor: string;
    borderColor: string;
    color: string;
  };
} {
  const defaultDocColors: Record<string, string> = {
    'dr. alejandro solís (m.i.)': '#2563eb',
    'dra. elena villaseñor (m.i. / infectología)': '#7c3aed',
    'dr. héctor cárdenas (m.i. / nefrología)': '#0d9488',
    'dra. patricia mendieta (m.i. / terapia intensiva)': '#e11d48',
    'dr. roberto elizondo (jefe de servicio m.i.)': '#d97706',
  };

  const norm = (doctorName || '').trim().toLowerCase();
  let hex = '#475569'; // slate fallback

  if (catalog && catalog.length > 0 && norm) {
    const found = catalog.find((d) => d.name.trim().toLowerCase() === norm);
    if (found?.color) {
      hex = found.color;
    } else if (defaultDocColors[norm]) {
      hex = defaultDocColors[norm];
    }
  } else if (norm && defaultDocColors[norm]) {
    hex = defaultDocColors[norm];
  }

  return {
    color: hex,
    badgeStyle: {
      backgroundColor: `${hex}18`,
      borderColor: `${hex}66`,
      color: hex,
    },
  };
}

export type LabFilterMode =
  | 'initial-latest'
  | 'initial-last2'
  | 'initial-last3'
  | 'initial-last4'
  | 'last3'
  | 'last4'
  | 'custom'
  | 'all';

/**
 * Sorts laboratory records chronologically from OLDEST (left) to NEWEST (right)
 * and filters them according to the selected clinical comparison preset.
 */
export function filterAndSortLabsOldestToNewest<
  T extends { id: string; date: string; time?: string }
>(labs: T[], mode: LabFilterMode, customSelectedIds?: string[]): T[] {
  if (!labs || labs.length === 0) return [];

  // Sort ascending: oldest first (left), newest last (right)
  const sortedAsc = [...labs].sort((a, b) => {
    const dtA = `${a.date || ''}T${a.time || '00:00'}`;
    const dtB = `${b.date || ''}T${b.time || '00:00'}`;
    return dtA.localeCompare(dtB);
  });

  if (sortedAsc.length <= 1) return sortedAsc;

  const dedupePreserveOrder = (items: T[]): T[] => {
    const seen = new Set<string>();
    const result: T[] = [];
    for (const item of items) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        result.push(item);
      }
    }
    return result;
  };

  const initialLab = sortedAsc[0];

  switch (mode) {
    case 'initial-latest':
      return dedupePreserveOrder([initialLab, sortedAsc[sortedAsc.length - 1]]);
    case 'initial-last2':
      return dedupePreserveOrder([initialLab, ...sortedAsc.slice(-2)]);
    case 'initial-last3':
      return dedupePreserveOrder([initialLab, ...sortedAsc.slice(-3)]);
    case 'initial-last4':
      return dedupePreserveOrder([initialLab, ...sortedAsc.slice(-4)]);
    case 'last3':
      return sortedAsc.slice(-3);
    case 'last4':
      return sortedAsc.slice(-4);
    case 'custom':
      if (customSelectedIds && customSelectedIds.length > 0) {
        const filtered = sortedAsc.filter((l) => customSelectedIds.includes(l.id));
        return filtered.length > 0 ? filtered : sortedAsc;
      }
      return sortedAsc;
    case 'all':
    default:
      return sortedAsc;
  }
}

export type LabParameterKey =
  | 'leucos'
  | 'hb'
  | 'plaquetas'
  | 'creatinina'
  | 'glucosa'
  | 'na'
  | 'k'
  | 'lactato'
  | 'bun'
  | string;

export interface LabNumericTrendResult {
  hasTrend: boolean;
  direction: 'up' | 'down' | 'equal';
  rawDiff: number;
  formattedDiff: string;
  colorClass: string;
}

/**
 * Computes the numeric change (delta = newerVal - olderVal), arrow direction,
 * and clinical color coding between two laboratory values across all Internal Medicine panels.
 */
export function calculateLabNumericTrend(
  param: LabParameterKey,
  olderVal?: number,
  newerVal?: number
): LabNumericTrendResult {
  if (
    olderVal === undefined ||
    newerVal === undefined ||
    olderVal === null ||
    newerVal === null ||
    Number.isNaN(olderVal) ||
    Number.isNaN(newerVal)
  ) {
    return {
      hasTrend: false,
      direction: 'equal',
      rawDiff: 0,
      formattedDiff: '-',
      colorClass: 'text-slate-400 dark:text-slate-500',
    };
  }

  const rawDiff = Number((newerVal - olderVal).toFixed(2));
  const absDiff = Math.abs(rawDiff);

  const isIntegerMetric =
    param === 'leucos' ||
    param === 'wbc' ||
    param === 'plaquetas' ||
    param === 'platelets' ||
    param === 'glucosa' ||
    param === 'glucose' ||
    param === 'bun' ||
    param === 'urea' ||
    param === 'ldh' ||
    param === 'cpk' ||
    param === 'bnp' ||
    param === 'dimerD' ||
    param === 'ferritin' ||
    param === 'pafi' ||
    param === 'col_total' ||
    param === 'ldl' ||
    param === 'hdl' ||
    param === 'trigliceridos';

  const formattedNumber =
    isIntegerMetric && absDiff >= 10
      ? Math.round(absDiff).toLocaleString('en-US')
      : Number(absDiff.toFixed(2)).toString();

  if (rawDiff === 0) {
    return {
      hasTrend: true,
      direction: 'equal',
      rawDiff: 0,
      formattedDiff: '0',
      colorClass:
        'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700',
    };
  }

  const sign = rawDiff > 0 ? '+' : '-';
  const direction: 'up' | 'down' = rawDiff > 0 ? 'up' : 'down';
  const formattedDiff = `${sign}${formattedNumber}`;

  const greenBadge =
    'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800';
  const redBadge =
    'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800';
  const amberBadge =
    'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800';

  let colorClass = greenBadge;

  const lowerIsBetterSet = new Set([
    'creatinina',
    'creatinine',
    'bun',
    'urea',
    'uric_acid',
    'lactato',
    'lactate',
    'pcr',
    'procalcitonina',
    'pct',
    'vsg',
    'ferritin',
    'ast',
    'alt',
    'alp',
    'ggt',
    'biliTotal',
    'biliDirect',
    'biliIndirect',
    'ldh',
    'amonio',
    'tp',
    'inr',
    'ttpa',
    'dimerD',
    'troponin',
    'bnp',
    'cpk',
    'ck_mb',
    'amilasa',
    'lipasa',
    'hba1c',
    'col_total',
    'ldl',
    'trigliceridos',
    'psa_total',
    'cea',
    'ca_19_9',
    'ca_125',
    'bandas',
  ]);

  const higherIsBetterSet = new Set([
    'hb',
    'hto',
    'plaquetas',
    'platelets',
    'albumin',
    'prot_totales',
    'tfg',
    'dep_cr_24h',
    'po2',
    'pafi',
    'hdl',
    'hierro_serico',
    'sat_transf',
    'vit_b12',
    'ac_folico',
    'vitamina_d',
  ]);

  const targetMidpoints: Record<string, { mid: number; min: number; max: number; severeOut?: boolean }> = {
    glucosa: { mid: 120, min: 70, max: 180 },
    glucose: { mid: 120, min: 70, max: 180 },
    na: { mid: 140, min: 135, max: 145 },
    sodium: { mid: 140, min: 135, max: 145 },
    k: { mid: 4.2, min: 3.5, max: 5.0, severeOut: true },
    potassium: { mid: 4.2, min: 3.5, max: 5.0, severeOut: true },
    cl: { mid: 102, min: 98, max: 107 },
    chloride: { mid: 102, min: 98, max: 107 },
    calcium: { mid: 9.3, min: 8.5, max: 10.2 },
    calcium_ion: { mid: 1.22, min: 1.12, max: 1.32 },
    phosphorus: { mid: 3.5, min: 2.5, max: 4.5 },
    magnesium: { mid: 2.05, min: 1.7, max: 2.4 },
    ph: { mid: 7.4, min: 7.35, max: 7.45, severeOut: true },
    pco2: { mid: 40, min: 35, max: 45 },
    hco3: { mid: 24, min: 22, max: 26 },
    eb: { mid: 0, min: -2, max: 2 },
    anion_gap: { mid: 10, min: 8, max: 12 },
    neutrophils: { mid: 55, min: 40, max: 70 },
    lymphocytes: { mid: 30, min: 20, max: 45 },
    vcm: { mid: 88, min: 80, max: 100 },
    fibrinogen: { mid: 300, min: 200, max: 400 },
    tsh: { mid: 2.0, min: 0.4, max: 4.5 },
    t4_libre: { mid: 1.3, min: 0.8, max: 1.8 },
    cortisol_am: { mid: 13, min: 6, max: 20 },
    osmolarity: { mid: 285, min: 275, max: 295 },
  };

  if (param === 'leucos' || param === 'wbc') {
    const isThousands = newerVal > 100 || olderVal > 100;
    const lowThreshold = isThousands ? 3800 : 3.8;
    const highThreshold = isThousands ? 10500 : 10.5;
    if (direction === 'down') {
      colorClass = newerVal < lowThreshold ? amberBadge : greenBadge;
    } else {
      colorClass = newerVal > highThreshold ? redBadge : greenBadge;
    }
  } else if (lowerIsBetterSet.has(param)) {
    colorClass = direction === 'down' ? greenBadge : redBadge;
  } else if (higherIsBetterSet.has(param)) {
    colorClass = direction === 'up' ? greenBadge : redBadge;
  } else if (targetMidpoints[param]) {
    const t = targetMidpoints[param];
    const inTarget = newerVal >= t.min && newerVal <= t.max;
    const closerToMid = Math.abs(newerVal - t.mid) <= Math.abs(olderVal - t.mid);
    if (param === 'glucosa' || param === 'glucose') {
      colorClass = inTarget || closerToMid ? greenBadge : amberBadge;
    } else if (param === 'na' || param === 'sodium') {
      colorClass = closerToMid ? greenBadge : amberBadge;
    } else if (param === 'k' || param === 'potassium') {
      colorClass = closerToMid ? greenBadge : redBadge;
    } else {
      colorClass = inTarget || closerToMid ? greenBadge : t.severeOut ? redBadge : amberBadge;
    }
  }

  return {
    hasTrend: true,
    direction,
    rawDiff,
    formattedDiff,
    colorClass,
  };
}

/**
 * Determines whether a pending item belongs to the chained clinical workflow
 * (1. Solicitar/Tomar -> 2. Recabar -> 3. Registrar en Censo -> 4. Completado / En Nota).
 */
export function isChainedClinicalPending(pending: {
  category: string;
  text: string;
  workflowStage?: 'take' | 'collect' | 'register_census' | 'done';
  isDischargePending?: boolean;
}): boolean {
  if (pending.isDischargePending || pending.category === 'Alta Hospitalaria') return false;
  if (pending.workflowStage) return true;
  if (
    pending.category === 'Laboratorio' ||
    pending.category === 'Imagen/Gabinete' ||
    pending.category === 'Interconsulta'
  ) {
    return true;
  }
  const upper = (pending.text || '').toUpperCase();
  return (
    upper.includes('TOMA DE LAB') ||
    upper.includes('TOMAR LAB') ||
    upper.includes('RECABAR') ||
    upper.includes('SOLICITAR')
  );
}

/**
 * Advances a clinical pending item through the chained hospital workflow when checked:
 * - Stage 'take' (Tomar / Solicitar) -> transitions to 'collect' (RECABAR ...) still active!
 * - Stage 'collect' (Recabar) -> transitions to 'register_census' (REGISTRAR EN CENSO: ...) still active!
 * - Stage 'register_census' -> transitions to 'done' (completed: true).
 * Non-chained pendings toggle their `completed` boolean directly.
 */
export function advancePendingWorkflow<
  T extends {
    id: string;
    text: string;
    category: string;
    completed: boolean;
    workflowStage?: 'take' | 'collect' | 'register_census' | 'done';
    customDetails?: string;
    isDischargePending?: boolean;
  }
>(pending: T): { updatedPending: T; nextStageReached: 'collect' | 'register_census' | 'done' | 'uncompleted' } {
  if (pending.completed) {
    return {
      updatedPending: {
        ...pending,
        completed: false,
        workflowStage: pending.workflowStage === 'done' ? 'take' : pending.workflowStage,
      },
      nextStageReached: 'uncompleted',
    };
  }

  if (!isChainedClinicalPending(pending)) {
    return {
      updatedPending: { ...pending, completed: true, workflowStage: 'done' },
      nextStageReached: 'done',
    };
  }

  // Extract base detail text without stage prefix
  const cleanDetail = (
    pending.customDetails ||
    pending.text
      .replace(/^(TOMA DE LABORATORIOS|TOMAR LABORATORIOS|SOLICITAR IMAGEN|SOLICITAR ESTUDIO|SOLICITAR INTERCONSULTA|RECABAR LABORATORIOS|RECABAR ESTUDIO|RECABAR INTERCONSULTA|RECABAR|REGISTRAR EN CENSO)\s*:?\s*/i, '')
      .trim() ||
    pending.text
  ).trim();

  // Infer current stage if not explicitly set
  let currentStage: 'take' | 'collect' | 'register_census' | 'done' = pending.workflowStage || 'take';
  if (!pending.workflowStage) {
    const upper = pending.text.toUpperCase();
    if (upper.startsWith('REGISTRAR EN CENSO')) {
      currentStage = 'register_census';
    } else if (upper.startsWith('RECABAR')) {
      currentStage = 'collect';
    } else {
      currentStage = 'take';
    }
  }

  if (currentStage === 'take') {
    const prefix =
      pending.category === 'Laboratorio'
        ? 'RECABAR LABORATORIOS'
        : pending.category === 'Imagen/Gabinete'
        ? 'RECABAR ESTUDIO'
        : 'RECABAR INTERCONSULTA';
    return {
      updatedPending: {
        ...pending,
        workflowStage: 'collect',
        customDetails: cleanDetail,
        text: `${prefix}: ${cleanDetail}`,
        completed: false,
      },
      nextStageReached: 'collect',
    };
  }

  if (currentStage === 'collect') {
    return {
      updatedPending: {
        ...pending,
        workflowStage: 'register_census',
        customDetails: cleanDetail,
        text: `REGISTRAR EN CENSO: ${cleanDetail}`,
        completed: false,
      },
      nextStageReached: 'register_census',
    };
  }

  return {
    updatedPending: {
      ...pending,
      workflowStage: 'done',
      completed: true,
    },
    nextStageReached: 'done',
  };
}

/**
 * Returns 4-color traffic light (Semáforo: Rojo, Amarillo, Verde, Azul) visual metadata for a pending item.
 */
export function getPendingTrafficLightInfo(pending: {
  priority?: string;
  urgencyColor?: 'red' | 'yellow' | 'green' | 'blue';
  isDischargePending?: boolean;
  category?: string;
}): {
  colorKey: 'red' | 'yellow' | 'green' | 'blue';
  label: string;
  dotClass: string;
  badgeClass: string;
  borderClass: string;
} {
  if (pending.isDischargePending || pending.category === 'Alta Hospitalaria') {
    return {
      colorKey: 'red',
      label: 'ALTA REQUERIDA',
      dotClass: 'bg-rose-600',
      badgeClass: 'bg-rose-600 text-white border-rose-700 font-extrabold',
      borderClass: 'border-rose-400 dark:border-rose-700 bg-rose-50/60 dark:bg-rose-950/30',
    };
  }

  const color: 'red' | 'yellow' | 'green' | 'blue' =
    pending.urgencyColor ||
    (pending.priority === 'Alta'
      ? 'red'
      : pending.priority === 'Media'
      ? 'yellow'
      : pending.priority === 'Informativa'
      ? 'blue'
      : 'green');

  switch (color) {
    case 'red':
      return {
        colorKey: 'red',
        label: 'Urgente',
        dotClass: 'bg-rose-500',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800',
        borderClass: 'border-rose-300 dark:border-rose-800/80',
      };
    case 'yellow':
      return {
        colorKey: 'yellow',
        label: 'Prioritario',
        dotClass: 'bg-amber-500',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800',
        borderClass: 'border-amber-300 dark:border-amber-800/80',
      };
    case 'blue':
      return {
        colorKey: 'blue',
        label: 'Seguimiento',
        dotClass: 'bg-sky-500',
        badgeClass: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950 dark:text-sky-200 dark:border-sky-800',
        borderClass: 'border-sky-300 dark:border-sky-800/80',
      };
    case 'green':
    default:
      return {
        colorKey: 'green',
        label: 'Rutina',
        dotClass: 'bg-emerald-500',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800',
        borderClass: 'border-emerald-300 dark:border-emerald-800/80',
      };
  }
}

/**
 * Safe deterministic arithmetic evaluator for custom medical formulas.
 * Supports variable names (alphanumeric/underscore), +, -, *, /, ^, and parentheses ().
 */
export function evaluateCustomFormula(
  expression: string,
  variables: Record<string, number>
): number | null {
  if (!expression || !expression.trim()) return null;

  try {
    // Substitute variables (longest symbol first to avoid partial prefix replacement)
    let substituted = expression.trim();
    const sortedSymbols = Object.keys(variables).sort((a, b) => b.length - a.length);

    for (const sym of sortedSymbols) {
      const val = variables[sym];
      if (val === undefined || val === null || Number.isNaN(val)) return null;
      const escaped = sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      substituted = substituted.replace(regex, `(${val})`);
    }

    // Replace ^ with ** for exponentiation
    substituted = substituted.replace(/\^/g, '**');

    // Validate that only digits, decimal points, arithmetic operators, spaces, and parentheses remain
    if (!/^[0-9+\-*/().\s]+$/.test(substituted)) {
      return null;
    }

    // Tokenize & parse using recursive descent for 100% safe deterministic math without eval
    const tokens = substituted.match(/\d+(?:\.\d+)?|\*\*|[+\-*/()]/g);
    if (!tokens || tokens.length === 0) return null;

    let pos = 0;

    function parseExpression(): number {
      let left = parseTerm();
      while (pos < tokens!.length && (tokens![pos] === '+' || tokens![pos] === '-')) {
        const op = tokens![pos++];
        const right = parseTerm();
        left = op === '+' ? left + right : left - right;
      }
      return left;
    }

    function parseTerm(): number {
      let left = parsePower();
      while (pos < tokens!.length && (tokens![pos] === '*' || tokens![pos] === '/')) {
        const op = tokens![pos++];
        const right = parsePower();
        if (op === '/' && right === 0) return NaN;
        left = op === '*' ? left * right : left / right;
      }
      return left;
    }

    function parsePower(): number {
      let base = parseFactor();
      while (pos < tokens!.length && tokens![pos] === '**') {
        pos++;
        const exp = parseFactor();
        base = Math.pow(base, exp);
      }
      return base;
    }

    function parseFactor(): number {
      if (pos >= tokens!.length) return NaN;
      const tok = tokens![pos];
      if (tok === '+') {
        pos++;
        return parseFactor();
      }
      if (tok === '-') {
        pos++;
        return -parseFactor();
      }
      if (tok === '(') {
        pos++;
        const val = parseExpression();
        if (tokens![pos] === ')') pos++;
        return val;
      }
      pos++;
      return parseFloat(tok);
    }

    const result = parseExpression();
    if (pos !== tokens.length || !Number.isFinite(result)) return null;
    return Math.round(result * 100) / 100;
  } catch {
    return null;
  }
}

/**
 * Purges discharged patients (and their associated clinical notes) if more than `maxDaysAfterDischarge`
 * (default 5 days) have elapsed since their `dischargeDate` to keep local and cloud storage lean.
 */
export function purgeExpiredDischargedPatients<
  P extends { id: string; status: string; dischargeDate?: string | null; lastUpdated?: string },
  N extends { patientId: string }
>(
  patients: P[],
  notes: N[],
  maxDaysAfterDischarge: number = 5,
  referenceDate: Date = new Date()
): { keptPatients: P[]; keptNotes: N[]; purgedPatientCount: number } {
  const refUTC = Date.UTC(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );

  const purgedIds = new Set<string>();
  const keptPatients: P[] = [];

  for (const p of patients) {
    if (p.status !== 'discharged') {
      keptPatients.push(p);
      continue;
    }

    const dateStr = p.dischargeDate || (p.lastUpdated ? p.lastUpdated.split('T')[0] : '');
    if (!dateStr) {
      keptPatients.push(p);
      continue;
    }

    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) {
      keptPatients.push(p);
      continue;
    }

    const disUTC = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.floor((refUTC - disUTC) / (1000 * 60 * 60 * 24));

    if (diffDays > maxDaysAfterDischarge) {
      purgedIds.add(p.id);
    } else {
      keptPatients.push(p);
    }
  }

  const keptNotes =
    purgedIds.size > 0 ? notes.filter((n) => !purgedIds.has(n.patientId)) : notes;

  return {
    keptPatients,
    keptNotes,
    purgedPatientCount: purgedIds.size,
  };
}

/**
 * Returns true if more than 24 hours have passed since the last daily census backup.
 */
export function isBackupOverdue24h(
  lastBackupTimestamp?: number,
  nowMs: number = Date.now()
): boolean {
  if (!lastBackupTimestamp || lastBackupTimestamp <= 0) return true;
  return nowMs - lastBackupTimestamp >= 24 * 60 * 60 * 1000;
}

/**
 * Sanitizes text for jsPDF standard Type1 fonts (Helvetica / WinAnsiEncoding)
 * so that no character with charCode > 255 ever triggers 2-byte UTF-16BE byte
 * corruption (which produces random '%', '¡', '@' glyphs and doubles line width
 * causing text to overflow outside table cells and page margins).
 * Also normalizes tight separators so jspdf-autotable wraps cleanly inside narrow cells.
 */
export function sanitizePdfText(input: string): string {
  if (!input) return '';

  let text = input
    // Checkboxes & squares (U+25A1 □ is 0x25 '%' + 0xA1 '¡' in UTF-16BE!)
    .replace(/[\u25A1\u2610\u25FB\u25FD\u2B1C]/g, '[ ]')
    .replace(/[\u25A0\u2611\u2612\u2713\u2714\u2705]/g, '[x]')
    // Bullets & list markers (U+2022 • is > 255 and triggers UTF-16BE in jsPDF)
    .replace(/[\u2022\u2023\u25E6\u2043\u2219\u25AA\u25AB\u25CF\u25CB]/g, '-')
    // Dashes & minus signs
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-')
    // Smart quotes & guillemets
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    // Ellipsis
    .replace(/\u2026/g, '...')
    // Math & clinical comparison symbols outside Latin-1
    .replace(/\u2265/g, '>=')
    .replace(/\u2264/g, '<=')
    .replace(/\u2260/g, '!=')
    .replace(/\u2248/g, '~')
    .replace(/[\u03BC\u00B5]/g, 'u')
    // Arrows
    .replace(/[\u2192\u2794\u279C\u27A1]/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/[\u2191\u2197]/g, '^')
    .replace(/[\u2193\u2198]/g, 'v')
    // Stars / badges
    .replace(/[\u2605\u2606\u272A]/g, '*')
    // Non-breaking spaces & zero-width characters
    .replace(/[\u00A0\u202F\u2007]/g, ' ')
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '');

  // Guarantee every remaining character is strictly within Latin-1 (<= 255)
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code <= 255) {
      result += text[i];
    } else {
      // Decompose accented letters outside Latin-1 to base ASCII + combining mark, keep base <= 255
      const decomposed = text[i].normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      for (let j = 0; j < decomposed.length; j++) {
        if (decomposed.charCodeAt(j) <= 255) {
          result += decomposed[j];
        }
      }
    }
  }

  // Ensure long unbroken tokens (> 24 chars without space) have soft wrap spaces after '/', ',', ';', ':'
  result = result
    .split('\n')
    .map((line) =>
      line
        .split(' ')
        .map((word) => {
          if (word.length <= 24) return word;
          return word.replace(/([/,;:|-])(?=\S)/g, '$1 ');
        })
        .join(' ')
    )
    .join('\n');

  return result;
}

/**
 * Determines whether the compact floating search/filter button in the bottom-right dock
 * should be visible:
 * - On mobile and tablet (< xl / !isDesktopViewport), it is always visible.
 * - On desktop (xl+ / isDesktopViewport), it is hidden while the main top search bar
 *   is visible in the viewport, and appears only when the user scrolls down and the
 *   main search bar disappears out of view.
 */
export function shouldShowFloatingSearchButton(params: {
  isDesktopViewport: boolean;
  isDesktopTopBarOutOfView: boolean;
}): boolean {
  if (!params.isDesktopViewport) {
    return true;
  }
  return params.isDesktopTopBarOutOfView;
}

export interface CompactLabChipItem {
  label: string;
  valueText: string;
  trend: 'up' | 'down' | 'same' | null;
  isAlert?: boolean;
  panelId?: string;
}

export type ComparativeLabPanelGroupId =
  | 'bhc'
  | 'qs_renal'
  | 'electrolitos'
  | 'pfh'
  | 'gasometria'
  | 'coagulacion'
  | 'inflamatorios_cardiacos'
  | 'endocrino_otros';

export interface ComparativeLabParamSpec {
  key: string;
  label: string;
  shortLabel: string;
  unit: string;
  panelId: ComparativeLabPanelGroupId;
  normalHint?: string;
  alertLow?: number;
  alertHigh?: number;
}

export interface ComparativeLabPanelGroupSpec {
  id: ComparativeLabPanelGroupId;
  name: string;
  shortName: string;
  accentColor: string;
  badgeClass: string;
  params: ComparativeLabParamSpec[];
}

export const COMPARATIVE_LAB_PANELS: ComparativeLabPanelGroupSpec[] = [
  {
    id: 'bhc',
    name: 'Biometría Hemática (BHC)',
    shortName: 'BHC',
    accentColor: '#EF4444',
    badgeClass:
      'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-800',
    params: [
      { key: 'leucos', label: 'Leucocitos', shortLabel: 'Leucos', unit: '/µL', panelId: 'bhc', alertLow: 4000, alertHigh: 11000 },
      { key: 'hb', label: 'Hemoglobina (Hb)', shortLabel: 'Hb', unit: 'g/dL', panelId: 'bhc', alertLow: 9.5, alertHigh: 18.0 },
      { key: 'hto', label: 'Hematocrito (Hto)', shortLabel: 'Hto', unit: '%', panelId: 'bhc', alertLow: 30, alertHigh: 54 },
      { key: 'plaquetas', label: 'Plaquetas', shortLabel: 'Plaq', unit: '/µL', panelId: 'bhc', alertLow: 100000, alertHigh: 450000 },
      { key: 'neutrophils', label: 'Neutrófilos', shortLabel: 'Neu%', unit: '%', panelId: 'bhc', alertLow: 40, alertHigh: 75 },
      { key: 'lymphocytes', label: 'Linfocitos', shortLabel: 'Lin%', unit: '%', panelId: 'bhc', alertLow: 15, alertHigh: 45 },
      { key: 'bandas', label: 'Bandas', shortLabel: 'Bandas', unit: '%', panelId: 'bhc', alertHigh: 5 },
      { key: 'vcm', label: 'VCM', shortLabel: 'VCM', unit: 'fL', panelId: 'bhc', alertLow: 80, alertHigh: 100 },
      { key: 'rdw', label: 'RDW / ADE', shortLabel: 'RDW', unit: '%', panelId: 'bhc', alertHigh: 15 },
      { key: 'reticulocitos', label: 'Reticulocitos', shortLabel: 'Retis', unit: '%', panelId: 'bhc', alertHigh: 2.5 },
    ],
  },
  {
    id: 'qs_renal',
    name: 'Química Sanguínea y Función Renal',
    shortName: 'QS / Renal',
    accentColor: '#0EA5E9',
    badgeClass:
      'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:border-sky-800',
    params: [
      { key: 'glucosa', label: 'Glucosa Sérica', shortLabel: 'Gluc', unit: 'mg/dL', panelId: 'qs_renal', alertLow: 70, alertHigh: 180 },
      { key: 'creatinina', label: 'Creatinina (Cr)', shortLabel: 'Cr', unit: 'mg/dL', panelId: 'qs_renal', alertHigh: 1.3 },
      { key: 'urea', label: 'Urea', shortLabel: 'Urea', unit: 'mg/dL', panelId: 'qs_renal', alertHigh: 45 },
      { key: 'bun', label: 'Nitrógeno Ureico (BUN)', shortLabel: 'BUN', unit: 'mg/dL', panelId: 'qs_renal', alertHigh: 22 },
      { key: 'tfg', label: 'TFG (CKD-EPI)', shortLabel: 'TFG', unit: 'mL/min', panelId: 'qs_renal', alertLow: 60 },
      { key: 'uric_acid', label: 'Ácido Úrico', shortLabel: 'Ác.Úrico', unit: 'mg/dL', panelId: 'qs_renal', alertHigh: 7.2 },
      { key: 'hba1c', label: 'HbA1c', shortLabel: 'HbA1c', unit: '%', panelId: 'qs_renal', alertHigh: 6.5 },
      { key: 'osmolarity', label: 'Osmolaridad Sérica', shortLabel: 'Osm', unit: 'mOsm/kg', panelId: 'qs_renal', alertLow: 275, alertHigh: 298 },
      { key: 'fena', label: 'FeNa', shortLabel: 'FeNa', unit: '%', panelId: 'qs_renal' },
      { key: 'prot_24h', label: 'Proteinuria 24h', shortLabel: 'Prot24h', unit: 'mg/24h', panelId: 'qs_renal', alertHigh: 300 },
    ],
  },
  {
    id: 'electrolitos',
    name: 'Electrólitos Séricos Completos (ES6)',
    shortName: 'Electrólitos (ES6)',
    accentColor: '#10B981',
    badgeClass:
      'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800',
    params: [
      { key: 'na', label: 'Sodio (Na)', shortLabel: 'Na', unit: 'mEq/L', panelId: 'electrolitos', alertLow: 132, alertHigh: 147 },
      { key: 'k', label: 'Potasio (K)', shortLabel: 'K', unit: 'mEq/L', panelId: 'electrolitos', alertLow: 3.4, alertHigh: 5.2 },
      { key: 'cl', label: 'Cloro (Cl)', shortLabel: 'Cl', unit: 'mEq/L', panelId: 'electrolitos', alertLow: 96, alertHigh: 108 },
      { key: 'calcium', label: 'Calcio Total (Ca)', shortLabel: 'Ca', unit: 'mg/dL', panelId: 'electrolitos', alertLow: 8.4, alertHigh: 10.4 },
      { key: 'calcium_ion', label: 'Calcio Iónico (Ca²⁺)', shortLabel: 'Ca²⁺', unit: 'mmol/L', panelId: 'electrolitos', alertLow: 1.1, alertHigh: 1.35 },
      { key: 'phosphorus', label: 'Fósforo (P)', shortLabel: 'P', unit: 'mg/dL', panelId: 'electrolitos', alertLow: 2.4, alertHigh: 4.6 },
      { key: 'magnesium', label: 'Magnesio (Mg)', shortLabel: 'Mg', unit: 'mg/dL', panelId: 'electrolitos', alertLow: 1.6, alertHigh: 2.6 },
    ],
  },
  {
    id: 'pfh',
    name: 'Pruebas de Función Hepática (PFH)',
    shortName: 'PFH',
    accentColor: '#F59E0B',
    badgeClass:
      'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800',
    params: [
      { key: 'ast', label: 'AST / TGO', shortLabel: 'AST', unit: 'U/L', panelId: 'pfh', alertHigh: 40 },
      { key: 'alt', label: 'ALT / TGP', shortLabel: 'ALT', unit: 'U/L', panelId: 'pfh', alertHigh: 45 },
      { key: 'alp', label: 'Fosfatasa Alcalina (FA)', shortLabel: 'FA', unit: 'U/L', panelId: 'pfh', alertHigh: 130 },
      { key: 'ggt', label: 'GGT', shortLabel: 'GGT', unit: 'U/L', panelId: 'pfh', alertHigh: 60 },
      { key: 'biliTotal', label: 'Bilirrubina Total (BT)', shortLabel: 'BT', unit: 'mg/dL', panelId: 'pfh', alertHigh: 1.2 },
      { key: 'biliDirect', label: 'Bilirrubina Directa (BD)', shortLabel: 'BD', unit: 'mg/dL', panelId: 'pfh', alertHigh: 0.4 },
      { key: 'biliIndirect', label: 'Bilirrubina Indirecta (BI)', shortLabel: 'BI', unit: 'mg/dL', panelId: 'pfh', alertHigh: 0.9 },
      { key: 'albumin', label: 'Albúmina Sérica (Alb)', shortLabel: 'Alb', unit: 'g/dL', panelId: 'pfh', alertLow: 3.4 },
      { key: 'prot_totales', label: 'Proteínas Totales', shortLabel: 'ProtTot', unit: 'g/dL', panelId: 'pfh', alertLow: 6.0 },
      { key: 'ldh', label: 'Deshidrogenasa Láctica (DHL)', shortLabel: 'DHL', unit: 'U/L', panelId: 'pfh', alertHigh: 240 },
      { key: 'amonio', label: 'Amonio Sérico (NH3)', shortLabel: 'NH3', unit: 'µmol/L', panelId: 'pfh', alertHigh: 50 },
    ],
  },
  {
    id: 'gasometria',
    name: 'Gasometría y Equilibrio Ácido-Base',
    shortName: 'Gasometría',
    accentColor: '#EC4899',
    badgeClass:
      'bg-pink-50 text-pink-800 border-pink-200 dark:bg-pink-950/50 dark:text-pink-200 dark:border-pink-800',
    params: [
      { key: 'ph', label: 'pH Gasométrico', shortLabel: 'pH', unit: '', panelId: 'gasometria', alertLow: 7.32, alertHigh: 7.48 },
      { key: 'pco2', label: 'pCO2', shortLabel: 'pCO2', unit: 'mmHg', panelId: 'gasometria', alertLow: 32, alertHigh: 48 },
      { key: 'po2', label: 'pO2', shortLabel: 'pO2', unit: 'mmHg', panelId: 'gasometria', alertLow: 65 },
      { key: 'hco3', label: 'HCO3 (Bicarbonato)', shortLabel: 'HCO3', unit: 'mEq/L', panelId: 'gasometria', alertLow: 20, alertHigh: 28 },
      { key: 'eb', label: 'Exceso de Base (EB)', shortLabel: 'EB', unit: 'mmol/L', panelId: 'gasometria', alertLow: -3, alertHigh: 3 },
      { key: 'lactato', label: 'Lactato Sérico', shortLabel: 'Lac', unit: 'mmol/L', panelId: 'gasometria', alertHigh: 2.0 },
      { key: 'pafi', label: 'Índice PaO2/FiO2 (Kirby)', shortLabel: 'PaFi', unit: 'mmHg', panelId: 'gasometria', alertLow: 250 },
      { key: 'anion_gap', label: 'Brecha Aniónica (AG)', shortLabel: 'AG', unit: 'mEq/L', panelId: 'gasometria', alertHigh: 14 },
    ],
  },
  {
    id: 'coagulacion',
    name: 'Coagulación y Hemostasia',
    shortName: 'Coagulación',
    accentColor: '#8B5CF6',
    badgeClass:
      'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-200 dark:border-purple-800',
    params: [
      { key: 'tp', label: 'Tiempo de Protrombina (TP)', shortLabel: 'TP', unit: 's', panelId: 'coagulacion', alertHigh: 14.5 },
      { key: 'inr', label: 'INR', shortLabel: 'INR', unit: '', panelId: 'coagulacion', alertHigh: 1.3 },
      { key: 'ttpa', label: 'TTPa', shortLabel: 'TTPa', unit: 's', panelId: 'coagulacion', alertHigh: 36 },
      { key: 'fibrinogen', label: 'Fibrinógeno', shortLabel: 'Fib', unit: 'mg/dL', panelId: 'coagulacion', alertLow: 180, alertHigh: 450 },
      { key: 'dimerD', label: 'Dímero D', shortLabel: 'Dím-D', unit: 'ng/mL', panelId: 'coagulacion', alertHigh: 500 },
    ],
  },
  {
    id: 'inflamatorios_cardiacos',
    name: 'Inflamación, Cardíaco y Pancreático',
    shortName: 'Inflam / Cardio / Páncreas',
    accentColor: '#DC2626',
    badgeClass:
      'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-200 dark:border-red-800',
    params: [
      { key: 'pcr', label: 'Proteína C Reactiva (PCR)', shortLabel: 'PCR', unit: 'mg/L', panelId: 'inflamatorios_cardiacos', alertHigh: 10 },
      { key: 'procalcitonina', label: 'Procalcitonina (PCT)', shortLabel: 'PCT', unit: 'ng/mL', panelId: 'inflamatorios_cardiacos', alertHigh: 0.5 },
      { key: 'vsg', label: 'VSG', shortLabel: 'VSG', unit: 'mm/h', panelId: 'inflamatorios_cardiacos', alertHigh: 25 },
      { key: 'ferritin', label: 'Ferritina Sérica', shortLabel: 'Ferr', unit: 'ng/mL', panelId: 'inflamatorios_cardiacos', alertLow: 30, alertHigh: 400 },
      { key: 'troponin', label: 'Troponina I/T', shortLabel: 'Trop', unit: 'ng/L', panelId: 'inflamatorios_cardiacos', alertHigh: 19 },
      { key: 'bnp', label: 'BNP / NT-proBNP', shortLabel: 'BNP', unit: 'pg/mL', panelId: 'inflamatorios_cardiacos', alertHigh: 300 },
      { key: 'cpk', label: 'CPK Total', shortLabel: 'CPK', unit: 'U/L', panelId: 'inflamatorios_cardiacos', alertHigh: 200 },
      { key: 'ck_mb', label: 'CK-MB', shortLabel: 'CK-MB', unit: 'U/L', panelId: 'inflamatorios_cardiacos', alertHigh: 25 },
      { key: 'amilasa', label: 'Amilasa Sérica', shortLabel: 'Amil', unit: 'U/L', panelId: 'inflamatorios_cardiacos', alertHigh: 120 },
      { key: 'lipasa', label: 'Lipasa Sérica', shortLabel: 'Lip', unit: 'U/L', panelId: 'inflamatorios_cardiacos', alertHigh: 160 },
    ],
  },
  {
    id: 'endocrino_otros',
    name: 'Tiroides, Lípidos, Hierro y Especiales',
    shortName: 'Endocrino / Lípidos / Otros',
    accentColor: '#6366F1',
    badgeClass:
      'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-200 dark:border-indigo-800',
    params: [
      { key: 'tsh', label: 'TSH', shortLabel: 'TSH', unit: 'mUI/L', panelId: 'endocrino_otros', alertLow: 0.4, alertHigh: 4.5 },
      { key: 't4_libre', label: 'T4 Libre', shortLabel: 'T4L', unit: 'ng/dL', panelId: 'endocrino_otros', alertLow: 0.8, alertHigh: 1.8 },
      { key: 't3_libre', label: 'T3 Libre', shortLabel: 'T3L', unit: 'pg/mL', panelId: 'endocrino_otros' },
      { key: 'cortisol_am', label: 'Cortisol AM', shortLabel: 'CortAM', unit: 'µg/dL', panelId: 'endocrino_otros', alertLow: 5, alertHigh: 25 },
      { key: 'pth', label: 'PTH Intacta', shortLabel: 'PTH', unit: 'pg/mL', panelId: 'endocrino_otros', alertHigh: 65 },
      { key: 'vitamina_d', label: 'Vitamina D [25(OH)D]', shortLabel: 'VitD', unit: 'ng/mL', panelId: 'endocrino_otros', alertLow: 20 },
      { key: 'col_total', label: 'Colesterol Total', shortLabel: 'ColT', unit: 'mg/dL', panelId: 'endocrino_otros', alertHigh: 200 },
      { key: 'ldl', label: 'Colesterol LDL', shortLabel: 'LDL', unit: 'mg/dL', panelId: 'endocrino_otros', alertHigh: 130 },
      { key: 'hdl', label: 'Colesterol HDL', shortLabel: 'HDL', unit: 'mg/dL', panelId: 'endocrino_otros', alertLow: 40 },
      { key: 'trigliceridos', label: 'Triglicéridos', shortLabel: 'TG', unit: 'mg/dL', panelId: 'endocrino_otros', alertHigh: 150 },
      { key: 'hierro_serico', label: 'Hierro Sérico', shortLabel: 'Fe', unit: 'µg/dL', panelId: 'endocrino_otros', alertLow: 50 },
      { key: 'sat_transf', label: '% Sat. Transferrina', shortLabel: '%SatFe', unit: '%', panelId: 'endocrino_otros', alertLow: 20 },
      { key: 'vit_b12', label: 'Vitamina B12', shortLabel: 'VitB12', unit: 'pg/mL', panelId: 'endocrino_otros', alertLow: 200 },
      { key: 'ac_folico', label: 'Ácido Fólico', shortLabel: 'Folato', unit: 'ng/mL', panelId: 'endocrino_otros', alertLow: 4 },
      { key: 'psa_total', label: 'APE / PSA Total', shortLabel: 'PSA', unit: 'ng/mL', panelId: 'endocrino_otros', alertHigh: 4.0 },
      { key: 'cea', label: 'ACE / CEA', shortLabel: 'CEA', unit: 'ng/mL', panelId: 'endocrino_otros', alertHigh: 5.0 },
      { key: 'ca_19_9', label: 'CA 19-9', shortLabel: 'CA19-9', unit: 'U/mL', panelId: 'endocrino_otros', alertHigh: 37 },
      { key: 'ca_125', label: 'CA-125', shortLabel: 'CA-125', unit: 'U/mL', panelId: 'endocrino_otros', alertHigh: 35 },
    ],
  },
];

export interface ExtractedLabCell {
  labId: string;
  date: string;
  time?: string;
  displayValue: string;
  compactValue: string;
  numericValue?: number;
  isAlert: boolean;
}

export interface ComparativeLabTableCell {
  labId: string;
  date: string;
  time?: string;
  formatted: string;
  numericValue?: number;
  isAlert: boolean;
}

export interface ComparativeLabRow {
  key: string;
  label: string;
  shortLabel: string;
  unit: string;
  panelId: ComparativeLabPanelGroupId;
  panelName: string;
  panelShortName: string;
  accentColor: string;
  badgeClass: string;
  valuesByLabId: Record<string, ExtractedLabCell>;
  cells: ComparativeLabTableCell[];
  latestCell: ExtractedLabCell | null;
  previousCell: ExtractedLabCell | null;
  latestFormatted: string | undefined;
  previousFormatted: string | undefined;
  trend: LabNumericTrendResult;
}

export interface ComparativeActivePanelInfo {
  id: ComparativeLabPanelGroupId;
  name: string;
  shortName: string;
  title: string;
  shortTitle: string;
  accentColor: string;
  badgeClass: string;
  activeParamCount: number;
}

export interface PatientComparativeLabAnalysis {
  sortedOldestToNewest: Array<{ id: string; date: string; time?: string }>;
  sortedNewestToOldest: Array<{ id: string; date: string; time?: string }>;
  rows: ComparativeLabRow[];
  rowsByPanel: Record<string, ComparativeLabRow[]>;
  activePanels: ComparativeActivePanelInfo[];
  panelsWithData: ComparativeActivePanelInfo[];
}

function getRawValueFromLabRecord(lab: Record<string, any>, key: string): number | string | undefined {
  if (!lab) return undefined;
  switch (key) {
    case 'leucos':
      return lab.leucos ?? lab.wbc ?? lab.extraParams?.wbc?.value;
    case 'plaquetas':
      return lab.plaquetas ?? lab.platelets ?? lab.extraParams?.platelets?.value;
    case 'glucosa':
      return lab.glucosa ?? lab.glucose ?? lab.extraParams?.glucose?.value;
    case 'creatinina':
      return lab.creatinina ?? lab.creatinine ?? lab.extraParams?.creatinine?.value;
    case 'na':
      return lab.na ?? lab.sodium ?? lab.extraParams?.sodium?.value;
    case 'k':
      return lab.k ?? lab.potassium ?? lab.extraParams?.potassium?.value;
    case 'cl':
      return lab.cl ?? lab.chloride ?? lab.extraParams?.chloride?.value;
    case 'lactato':
      return lab.lactato ?? lab.lactate ?? lab.extraParams?.lactate?.value;
    case 'procalcitonina':
      return lab.procalcitonina ?? lab.pct ?? lab.extraParams?.pct?.value;
    default: {
      if (lab[key] !== undefined && lab[key] !== null && lab[key] !== '') {
        return lab[key];
      }
      if (lab.extraParams && lab.extraParams[key]?.value !== undefined && lab.extraParams[key].value !== '') {
        return lab.extraParams[key].value;
      }
      return undefined;
    }
  }
}

export function extractLabParameterCell(
  lab: Record<string, any>,
  spec: ComparativeLabParamSpec
): ExtractedLabCell | null {
  const raw = getRawValueFromLabRecord(lab, spec.key);
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return null;
  }

  let numericValue: number | undefined;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    numericValue = raw;
  } else if (typeof raw === 'string') {
    const cleaned = raw.replace(/,/g, '').trim();
    const match = cleaned.match(/^[-+]?\d+(?:\.\d+)?/);
    if (match) {
      const parsed = parseFloat(match[0]);
      if (Number.isFinite(parsed)) {
        numericValue = parsed;
      }
    }
  }

  let displayValue = String(raw).trim();
  let compactValue = displayValue;

  if (numericValue !== undefined) {
    if (spec.key === 'leucos' && numericValue >= 1000) {
      displayValue = numericValue.toLocaleString('en-US');
      compactValue = `${(numericValue / 1000).toFixed(1)}k`;
    } else if (spec.key === 'plaquetas' && numericValue >= 1000) {
      displayValue = numericValue.toLocaleString('en-US');
      compactValue = `${(numericValue / 1000).toFixed(0)}k`;
    } else if (typeof raw === 'number') {
      displayValue = String(raw);
      compactValue = String(raw);
    }
  }

  let isAlert = false;
  if (numericValue !== undefined) {
    if (spec.alertLow !== undefined && numericValue < spec.alertLow) {
      if ((spec.key === 'leucos' || spec.key === 'plaquetas') && numericValue < 900) {
        const scaled = numericValue * 1000;
        isAlert =
          (spec.alertLow !== undefined && scaled < spec.alertLow) ||
          (spec.alertHigh !== undefined && scaled > spec.alertHigh);
      } else {
        isAlert = true;
      }
    }
    if (spec.alertHigh !== undefined && numericValue > spec.alertHigh) {
      isAlert = true;
    }
  }

  return {
    labId: String(lab.id || ''),
    date: String(lab.date || ''),
    time: lab.time ? String(lab.time) : undefined,
    displayValue,
    compactValue,
    numericValue,
    isAlert,
  };
}

/**
 * Analyzes all laboratory records of a patient across all Internal Medicine panels,
 * extracting every parameter present in any study, matching each parameter's most recent value
 * with its previous recorded value, and computing its clinical trend and numeric delta (Δ).
 */
export function buildPatientComparativeLabAnalysis(
  labs?: Array<Record<string, any>> | null
): PatientComparativeLabAnalysis {
  if (!labs || labs.length === 0) {
    return {
      sortedOldestToNewest: [],
      sortedNewestToOldest: [],
      rows: [],
      rowsByPanel: {},
      activePanels: [],
      panelsWithData: [],
    };
  }

  const normalizedLabs = labs.map((lab, idx) => ({
    ...lab,
    id: lab.id ? String(lab.id) : `lab-idx-${idx}`,
  }));

  const sortedOldestToNewest = [...normalizedLabs].sort((a, b) => {
    const dtA = `${a.date || ''}T${a.time || '00:00'}`;
    const dtB = `${b.date || ''}T${b.time || '00:00'}`;
    return dtA.localeCompare(dtB);
  });

  const sortedNewestToOldest = [...sortedOldestToNewest].reverse();

  const knownParamKeys = new Set<string>();
  const rows: ComparativeLabRow[] = [];

  for (const panel of COMPARATIVE_LAB_PANELS) {
    for (const spec of panel.params) {
      knownParamKeys.add(spec.key);
      const valuesByLabId: Record<string, ExtractedLabCell> = {};
      const chronologicalCells: ExtractedLabCell[] = [];
      const cells: ComparativeLabTableCell[] = [];

      for (const lab of sortedOldestToNewest) {
        const cell = extractLabParameterCell(lab, spec);
        if (cell) {
          valuesByLabId[lab.id] = cell;
          chronologicalCells.push(cell);
          cells.push({
            labId: String(lab.id),
            date: String(lab.date || ''),
            time: lab.time ? String(lab.time) : undefined,
            formatted: cell.displayValue,
            numericValue: cell.numericValue,
            isAlert: cell.isAlert,
          });
        } else {
          cells.push({
            labId: String(lab.id),
            date: String(lab.date || ''),
            time: lab.time ? String(lab.time) : undefined,
            formatted: '-',
            isAlert: false,
          });
        }
      }

      if (chronologicalCells.length > 0) {
        const latestCell = chronologicalCells[chronologicalCells.length - 1];
        const previousCell =
          chronologicalCells.length >= 2 ? chronologicalCells[chronologicalCells.length - 2] : null;
        const trend = calculateLabNumericTrend(
          spec.key,
          previousCell?.numericValue,
          latestCell?.numericValue
        );

        rows.push({
          key: spec.key,
          label: spec.label,
          shortLabel: spec.shortLabel,
          unit: spec.unit,
          panelId: panel.id,
          panelName: panel.name,
          panelShortName: panel.shortName,
          accentColor: panel.accentColor,
          badgeClass: panel.badgeClass,
          valuesByLabId,
          cells,
          latestCell,
          previousCell,
          latestFormatted: latestCell.compactValue,
          previousFormatted: previousCell ? previousCell.compactValue : undefined,
          trend,
        });
      }
    }
  }

  // Also include any dynamic extraParams keys not already in knownParamKeys
  const dynamicSpecsMap = new Map<string, { label: string; unit: string; panelHint?: string }>();
  for (const lab of sortedOldestToNewest) {
    if (lab.extraParams && typeof lab.extraParams === 'object') {
      for (const [k, ep] of Object.entries(lab.extraParams)) {
        if (
          !knownParamKeys.has(k) &&
          k !== 'wbc' &&
          k !== 'platelets' &&
          k !== 'glucose' &&
          k !== 'creatinine' &&
          k !== 'sodium' &&
          k !== 'potassium' &&
          k !== 'chloride' &&
          k !== 'lactate' &&
          k !== 'pct' &&
          ep &&
          typeof ep === 'object' &&
          (ep as any).value
        ) {
          dynamicSpecsMap.set(k, {
            label: (ep as any).label || k,
            unit: (ep as any).unit || '',
            panelHint: (ep as any).panel,
          });
        }
      }
    }
  }

  if (dynamicSpecsMap.size > 0) {
    const fallbackPanel = COMPARATIVE_LAB_PANELS[COMPARATIVE_LAB_PANELS.length - 1];
    for (const [dynKey, meta] of dynamicSpecsMap.entries()) {
      const spec: ComparativeLabParamSpec = {
        key: dynKey,
        label: meta.label,
        shortLabel: meta.label,
        unit: meta.unit,
        panelId: 'endocrino_otros',
      };
      const valuesByLabId: Record<string, ExtractedLabCell> = {};
      const chronologicalCells: ExtractedLabCell[] = [];
      const cells: ComparativeLabTableCell[] = [];

      for (const lab of sortedOldestToNewest) {
        const cell = extractLabParameterCell(lab, spec);
        if (cell) {
          valuesByLabId[lab.id] = cell;
          chronologicalCells.push(cell);
          cells.push({
            labId: String(lab.id),
            date: String(lab.date || ''),
            time: lab.time ? String(lab.time) : undefined,
            formatted: cell.displayValue,
            numericValue: cell.numericValue,
            isAlert: cell.isAlert,
          });
        } else {
          cells.push({
            labId: String(lab.id),
            date: String(lab.date || ''),
            time: lab.time ? String(lab.time) : undefined,
            formatted: '-',
            isAlert: false,
          });
        }
      }

      if (chronologicalCells.length > 0) {
        const latestCell = chronologicalCells[chronologicalCells.length - 1];
        const previousCell =
          chronologicalCells.length >= 2 ? chronologicalCells[chronologicalCells.length - 2] : null;
        const trend = calculateLabNumericTrend(
          dynKey,
          previousCell?.numericValue,
          latestCell?.numericValue
        );
        rows.push({
          key: dynKey,
          label: meta.label,
          shortLabel: meta.label,
          unit: meta.unit,
          panelId: fallbackPanel.id,
          panelName: meta.panelHint || fallbackPanel.name,
          panelShortName: meta.panelHint || fallbackPanel.shortName,
          accentColor: fallbackPanel.accentColor,
          badgeClass: fallbackPanel.badgeClass,
          valuesByLabId,
          cells,
          latestCell,
          previousCell,
          latestFormatted: latestCell.compactValue,
          previousFormatted: previousCell ? previousCell.compactValue : undefined,
          trend,
        });
      }
    }
  }

  const rowsByPanel: Record<string, ComparativeLabRow[]> = {};
  for (const panel of COMPARATIVE_LAB_PANELS) {
    rowsByPanel[panel.id] = rows.filter((r) => r.panelId === panel.id);
  }

  const activePanels: ComparativeActivePanelInfo[] = COMPARATIVE_LAB_PANELS.map((panel) => {
    const count = (rowsByPanel[panel.id] || []).length;
    return {
      id: panel.id,
      name: panel.name,
      shortName: panel.shortName,
      title: panel.name,
      shortTitle: panel.shortName,
      accentColor: panel.accentColor,
      badgeClass: panel.badgeClass,
      activeParamCount: count,
    };
  }).filter((p) => p.activeParamCount > 0);

  return {
    sortedOldestToNewest: sortedOldestToNewest.map((l) => ({
      id: String(l.id || ''),
      date: String(l.date || ''),
      time: l.time ? String(l.time) : undefined,
    })),
    sortedNewestToOldest: sortedNewestToOldest.map((l) => ({
      id: String(l.id || ''),
      date: String(l.date || ''),
      time: l.time ? String(l.time) : undefined,
    })),
    rows,
    rowsByPanel,
    activePanels,
    panelsWithData: activePanels,
  };
}

/**
 * Builds a concise array of key laboratory chips with trend direction vs previous lab
 * for the high-density Compact List View (Vista de Lista Compacta), supporting all panels.
 */
export function buildCompactLabSummaryItems(
  latestLab?: Record<string, any> | null,
  previousLab?: Record<string, any> | null,
  allLabs?: Array<Record<string, any>> | null
): CompactLabChipItem[] {
  let sourceLabs: Array<Record<string, any>> = [];
  if (allLabs && allLabs.length > 0) {
    sourceLabs = allLabs;
  } else {
    if (previousLab) {
      sourceLabs.push({
        ...previousLab,
        id: previousLab.id || 'prev-lab',
        date: previousLab.date || '0000-01-01',
      });
    }
    if (latestLab) {
      sourceLabs.push({
        ...latestLab,
        id: latestLab.id || 'latest-lab',
        date: latestLab.date || '9999-12-31',
      });
    }
  }

  if (sourceLabs.length === 0) return [];

  const analysis = buildPatientComparativeLabAnalysis(sourceLabs);
  if (analysis.rows.length === 0) return [];

  const items: CompactLabChipItem[] = [];

  for (const row of analysis.rows) {
    if (!row.latestCell) continue;
    let trendDir: 'up' | 'down' | 'same' | null = null;
    if (row.trend.hasTrend) {
      trendDir =
        row.trend.direction === 'up'
          ? 'up'
          : row.trend.direction === 'down'
          ? 'down'
          : 'same';
    }
    items.push({
      label: row.key === 'leucos' ? 'Leu' : row.shortLabel,
      valueText: row.latestCell.compactValue,
      trend: trendDir,
      isAlert: row.latestCell.isAlert,
      panelId: row.panelId,
    });
  }

  return items;
}

export const DEFAULT_SUBJECTIVE_PRESETS: string[] = [
  'Paciente consciente y tranquilo',
  'Adecuada tolerancia a la vía oral',
  'Afebril y sin dolor agudo',
  'Disminución de accesos de tos',
  'Sin disnea en reposo',
  'Sin cefalea, mareo ni fosfenos',
  'Uresis espontánea clara en metas',
  'Niega melena o hematemesis',
  'Canaliza gases y evacuaciones presentes',
  'Mejoría subjetiva respecto al día previo',
];

export const DEFAULT_PHYSICAL_EXAM_TEMPLATES: Array<{
  id: string;
  label: string;
  text: string;
}> = [
  {
    id: 'ef-base-normal',
    label: 'EF Base Normal / Estable',
    text: 'Consciente, orientado en 3 esferas (persona, tiempo y espacio), cooperador, adecuada coloración e hidratación mucotegumentaria. Cráneo normocéfalo, pupilas isocóricas normorreflécticas, cuello cilíndrico sin ingurgitación yugular. Tórax normolíneo con murmullo vesicular bilateral conservado sin estertores ni sibilancias; ruidos cardíacos rítmicos de buen tono e intensidad sin soplos. Abdomen blando, depresible, no doloroso a la palpación, peristalsis normoactiva, sin datos de irritación peritoneal. Extremidades íntegras, eutróficas, sin edema, llenado capilar < 2 segundos y pulsos distales simétricos.',
  },
  {
    id: 'ef-cardiorresp',
    label: 'EF Cardiorrespiratoria',
    text: 'Despierto, orientado, polipneico leve con puntas nasales. Campos pulmonares con hipoventilación basal bilateral y estertores subcrepitantes bibasales; ruidos cardíacos rítmicos sin agregados. Abdomen blando sin visceromegalias. Extremidades inferiores con edema +/++++ maleolar bilateral, pulsos presentes.',
  },
  {
    id: 'ef-neuro-sedacion',
    label: 'EF Neurológica / Sedación',
    text: 'Bajo efectos de sedoanalgesia, RASS -2, pupilas isocóricas de 2 mm hiporreactivas a la luz, reflejo tusígeno y corneal conservados. Asistencia mecánica ventilatoria con acoplamiento adecuado al ventilador, murmullo vesicular simétrico con escasas secreciones hialinas por cánula endotraqueal. Hemodinámicamente con apoyo vasopresor titular. Abdomen blando, sonda Foley a derivación con uresis clara.',
  },
  {
    id: 'ef-abdominal',
    label: 'EF Abdominal / Digestivo',
    text: 'Consciente, orientado, mucosas subhidratadas. Cardiopulmonar sin compromiso agudo. Abdomen globoso a expensas de panículo adiposo, doloroso a la palpación media y profunda en epigastrio e hipocondrio derecho, Murphy negativo, Blumberg negativo, peristalsis presente disminuida. Extremidades sin edema, llenado capilar inmediato.',
  },
];

export const DEFAULT_DIET_PRESETS: string[] = [
  'Ayuno hasta nueva orden',
  'Dieta normal / Libre para la edad',
  'Dieta blanda hiposódica',
  'Dieta para diabético 1800 kcal normosódica',
  'Dieta nefrópata hiposódica (K < 2g, P < 800mg) + Restricción hídrica 800 ml/24h',
  'Dieta hepatópata hiperproteica hiposódica',
  'Dieta líquida clara / Líquidos generales',
  'Dieta polimérica por SNG / SOG 1500 kcal en 5 tomas',
];

export const DEFAULT_MEDICATION_ROUTES: string[] = [
  'IV',
  'VO',
  'SC',
  'IM',
  'Inhalado / Nebulizado',
  'Sublingual',
  'SNG / SOG',
  'Tópico',
  'Oftálmico',
  'Ótico',
  'Nasal',
  'Rectal',
  'Transdérmico',
  'Intratecal',
  'Epidural',
  'Infusión Continua IV',
  'CVC',
  'IO',
];

export const DEFAULT_AHF_PRESETS: string[] = [
  'Madre con DM2 e HAS',
  'Padre con HAS / Cardiopatía isquémica',
  'Abuelos con DM2',
  'Niega antecedentes oncológicos familiares',
  'Interrogados y negados para crónico-degenerativos',
];

export const DEFAULT_APNP_PRESETS: string[] = [
  'Habita en casa propia con todos los servicios básicos de urbanización (agua, luz, drenaje)',
  'Zoonosis negada, baño y cambio de ropa diario',
  'Tabaquismo negado',
  'Alcoholismo negado',
  'Toxicomanías negadas',
  'Esquema de vacunación del adulto completo (incluye Influenza y SARS-CoV-2)',
  'Exposición a biomasa (humo de leña) negada',
];

export const DEFAULT_APP_PRESETS: string[] = [
  'DM2 de larga evolución en tratamiento con metformina / insulina',
  'Hipertensión Arterial Sistémica en control con ARA-II / IECA',
  'Enfermedad Renal Crónica en seguimiento por Nefrología',
  'Quirúrgicos, traumáticos y transfusionales interrogados y negados',
  'Alergias a medicamentos interrogadas y negadas',
];


