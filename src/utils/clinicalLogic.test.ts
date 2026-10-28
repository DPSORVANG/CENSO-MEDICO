import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHospitalStayDays,
  calculateAntibioticDay,
  calculateCKDEPI,
  calculateCorrectedSodium,
  calculateAnionGap,
  calculateFreeWaterDeficit,
  calculateCURB65,
  generateAuditHash,
  buildDeterministicProgressNote,
  buildNomClinicalHistoryNote,
  getCodeStatusInfo,
  formatDiagnosticStudiesSummary,
  formatChronologicalLabsParagraphs,
  filterAndSortLabsOldestToNewest,
  calculateLabNumericTrend,
  advancePendingWorkflow,
  evaluateCustomFormula,
  purgeExpiredDischargedPatients,
  isBackupOverdue24h,
  sanitizePdfText,
  parseDiagnosesList,
  formatDiagnosesList,
  getRespiratorySupportFlags,
  getNonRedundantClinicalTags,
  hexToRgb,
  tintRgb,
  formatCriticalCareSystemsSummary,
  formatCriticalCareSystemsForNote,
} from './clinicalLogic.ts';

test('calculateHospitalStayDays calculates Day 1 for same-day admission', () => {
  const today = new Date('2026-10-23T10:00:00Z');
  const days = calculateHospitalStayDays('2026-10-23', today);
  assert.equal(days, 1);
});

test('calculateHospitalStayDays calculates Day 5 for admission 4 days prior', () => {
  const today = new Date('2026-10-23T10:00:00Z');
  const days = calculateHospitalStayDays('2026-10-19', today);
  assert.equal(days, 5);
});

test('calculateAntibioticDay tracks progress and completion accurately', () => {
  const refDate = new Date('2026-10-23T10:00:00Z');
  const result = calculateAntibioticDay('2026-10-19', 7, refDate);
  assert.equal(result.currentDay, 5);
  assert.equal(result.totalDays, 7);
  assert.equal(result.isCompleted, false);
  assert.equal(result.displayString, 'Día 5/7');

  const completedResult = calculateAntibioticDay('2026-10-16', 7, refDate);
  assert.equal(completedResult.currentDay, 8);
  assert.equal(completedResult.isCompleted, true);
});

test('calculateCKDEPI computes accurate eGFR for male and female', () => {
  const egfrMale = calculateCKDEPI(1.0, 60, 'male');
  assert.ok(egfrMale > 75 && egfrMale < 95);

  const egfrFemale = calculateCKDEPI(1.0, 60, 'female');
  assert.ok(egfrFemale > 55 && egfrFemale < 75);
});

test('calculateCorrectedSodium adjusts for hyperglycemia', () => {
  const corrected = calculateCorrectedSodium(130, 600);
  assert.equal(corrected, 138);

  const normal = calculateCorrectedSodium(135, 90);
  assert.equal(normal, 135);
});

test('calculateAnionGap computes Na - (Cl + HCO3)', () => {
  const ag = calculateAnionGap(140, 100, 24);
  assert.equal(ag, 16);
});

test('calculateFreeWaterDeficit calculates deficit in hypernatremia', () => {
  const deficit = calculateFreeWaterDeficit(70, 160, 'male');
  assert.equal(deficit, 6);
});

test('calculateCURB65 stratifies pneumonia risk correctly', () => {
  const lowRisk = calculateCURB65({
    confusion: false,
    bunAbove19: false,
    rrAbove30: false,
    hypotension: false,
    age65OrMore: false,
  });
  assert.equal(lowRisk.score, 0);

  const highRisk = calculateCURB65({
    confusion: true,
    bunAbove19: true,
    rrAbove30: true,
    hypotension: false,
    age65OrMore: true,
  });
  assert.equal(highRisk.score, 4);
  assert.equal(highRisk.mortalityRisk, '14 - 28%');
});

test('generateAuditHash produces reproducible tamper-evident checksum', () => {
  const hash1 = generateAuditHash('PAT-01', '2026-10-23T12:00:00Z', 'Paciente con cetoacidosis');
  const hash2 = generateAuditHash('PAT-01', '2026-10-23T12:00:00Z', 'Paciente con cetoacidosis');
  const alteredHash = generateAuditHash('PAT-01', '2026-10-23T12:00:00Z', 'Paciente con nefropatía');

  assert.equal(hash1, hash2);
  assert.notEqual(hash1, alteredHash);
  assert.ok(hash1.startsWith('MED-HASH-v1-'));
});

test('formatChronologicalLabsParagraphs sorts most recent first and formats comma-separated single paragraphs', () => {
  const formatted = formatChronologicalLabsParagraphs([
    { date: '2026-10-20', time: '06:00', hb: 11.8, leucos: 15400, creatinina: 1.8 },
    { date: '2026-10-23', time: '07:00', hb: 12.6, leucos: 9800, creatinina: 1.1, na: 138, k: 4.1 },
  ]);
  const lines = formatted.split('\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[0].startsWith('23/10/2026: Hb 12.6 g/dL, Leucos 9,800/µL, Cr 1.1 mg/dL, Na 138 mEq/L, K 4.1 mEq/L.'));
  assert.ok(lines[1].startsWith('20/10/2026: Hb 11.8 g/dL, Leucos 15,400/µL, Cr 1.8 mg/dL.'));
});

test('filterAndSortLabsOldestToNewest orders oldest on the left and newest on the right for all presets', () => {
  const sampleLabs = [
    { id: 'l-4', date: '2026-10-24', time: '07:00', creatinina: 1.1, leucos: 8500 },
    { id: 'l-1', date: '2026-10-15', time: '08:00', creatinina: 2.8, leucos: 19000 },
    { id: 'l-3', date: '2026-10-22', time: '07:00', creatinina: 1.4, leucos: 11000 },
    { id: 'l-2', date: '2026-10-19', time: '07:00', creatinina: 2.0, leucos: 14500 },
    { id: 'l-5', date: '2026-10-25', time: '07:00', creatinina: 0.95, leucos: 7200 },
  ];

  const initPlusLast = filterAndSortLabsOldestToNewest(sampleLabs, 'initial-latest');
  assert.equal(initPlusLast.length, 2);
  assert.equal(initPlusLast[0].id, 'l-1'); // Oldest on left
  assert.equal(initPlusLast[1].id, 'l-5'); // Newest on right

  const initPlusLast3 = filterAndSortLabsOldestToNewest(sampleLabs, 'initial-last3');
  assert.equal(initPlusLast3.length, 4);
  assert.deepEqual(
    initPlusLast3.map((l) => l.id),
    ['l-1', 'l-3', 'l-4', 'l-5']
  );

  const last3 = filterAndSortLabsOldestToNewest(sampleLabs, 'last3');
  assert.deepEqual(
    last3.map((l) => l.id),
    ['l-3', 'l-4', 'l-5']
  );
});

test('calculateLabNumericTrend computes exact signed delta and clinical color between newest and previous lab', () => {
  const crTrend = calculateLabNumericTrend('creatinina', 2.4, 1.6);
  assert.ok(crTrend.hasTrend);
  assert.equal(crTrend.direction, 'down');
  assert.equal(crTrend.formattedDiff, '-0.8');
  assert.ok(crTrend.colorClass.includes('emerald')); // Lower creatinine is improvement

  const leucoTrend = calculateLabNumericTrend('leucos', 16200, 11200);
  assert.ok(leucoTrend.hasTrend);
  assert.equal(leucoTrend.direction, 'down');
  assert.equal(leucoTrend.formattedDiff, '-5,000');
  assert.ok(leucoTrend.colorClass.includes('emerald'));

  const hbTrend = calculateLabNumericTrend('hb', 10.2, 11.0);
  assert.ok(hbTrend.hasTrend);
  assert.equal(hbTrend.direction, 'up');
  assert.equal(hbTrend.formattedDiff, '+0.8');
  assert.ok(hbTrend.colorClass.includes('emerald'));
});

test('advancePendingWorkflow chains lab/imaging/consult pendings through take -> collect -> register_census -> done', () => {
  const initialLabPending = {
    id: 'p-1',
    text: 'TOMA DE LABORATORIOS: BH, QS, ES3',
    category: 'Laboratorio' as const,
    priority: 'Alta' as const,
    completed: false,
    createdAt: '2026-10-24',
    customDetails: 'BH, QS, ES3',
    workflowStage: 'take' as const,
  };

  // Step 1 -> Step 2 (Recabar)
  const step2 = advancePendingWorkflow(initialLabPending).updatedPending;
  assert.equal(step2.completed, false);
  assert.equal(step2.workflowStage, 'collect');
  assert.ok(step2.text.includes('RECABAR LABORATORIOS'));

  // Step 2 -> Step 3 (Registrar en Censo)
  const step3 = advancePendingWorkflow(step2).updatedPending;
  assert.equal(step3.completed, false);
  assert.equal(step3.workflowStage, 'register_census');
  assert.ok(step3.text.includes('REGISTRAR EN CENSO'));

  // Step 3 -> Done
  const step4 = advancePendingWorkflow(step3).updatedPending;
  assert.equal(step4.completed, true);
  assert.equal(step4.workflowStage, 'done');
});

test('evaluateCustomFormula evaluates custom mathematical expressions safely', () => {
  // PAM = (pas + 2 * pad) / 3
  const pam = evaluateCustomFormula('(pas + 2 * pad) / 3', { pas: 120, pad: 80 });
  assert.equal(pam, 93.33);

  // Kirby = (pao2 / fio2) * 100
  const kirby = evaluateCustomFormula('(pao2 / fio2) * 100', { pao2: 75, fio2: 30 });
  assert.equal(kirby, 250);
});

test('purgeExpiredDischargedPatients removes discharged patients older than 5 days while preserving active and recent discharges', () => {
  const refDate = new Date('2026-10-25T12:00:00Z');
  const patients = [
    { id: 'active-1', status: 'active' as const },
    { id: 'recent-discharge', status: 'discharged' as const, dischargeDate: '2026-10-22' }, // 3 days ago -> keep
    { id: 'old-discharge', status: 'discharged' as const, dischargeDate: '2026-10-18' }, // 7 days ago -> purge
  ];
  const notes = [
    { patientId: 'active-1' },
    { patientId: 'old-discharge' },
  ];

  const { keptPatients, keptNotes, purgedPatientCount } = purgeExpiredDischargedPatients(
    patients,
    notes,
    5,
    refDate
  );
  assert.equal(purgedPatientCount, 1);
  assert.equal(keptPatients.length, 2);
  assert.deepEqual(
    keptPatients.map((p) => p.id),
    ['active-1', 'recent-discharge']
  );
  assert.equal(keptNotes.length, 1);
  assert.equal(keptNotes[0].patientId, 'active-1');
});

test('isBackupOverdue24h flags when 24 hours have elapsed since last backup', () => {
  const now = 1_700_000_000_000;
  assert.equal(isBackupOverdue24h(undefined, now), true);
  assert.equal(isBackupOverdue24h(now - 2 * 60 * 60 * 1000, now), false); // 2h ago
  assert.equal(isBackupOverdue24h(now - 25 * 60 * 60 * 1000, now), true); // 25h ago
});

test('buildDeterministicProgressNote formats institutional prose note without identification header or section titles on opening paragraphs', () => {
  const note = buildDeterministicProgressNote({
    patient: {
      name: 'González Pérez Carlos',
      bed: 'Cama 412',
      service: 'Medicina Interna Piso 4',
      age: 64,
      gender: 'Masculino',
      diagnoses: '1. Neumonía adquirida en la comunidad resuelta\n2. DM2 controlada',
      previousDiagnoses: '1. Síndrome febril en estudio\n2. DM2 descompensada',
      hospitalStayDays: 5,
      codeStatus: 'RCP 1 (Reanimación Completa / Todo esfuerzo)',
    },
    vitals: {
      bp: '125/80',
      hr: '78',
      rr: '18',
      temp: '36.7',
      spo2: '95',
      glucose: '142',
    },
    patientComplaintsToday: 'Refiere disminución de accesos de tos, niega disnea en reposo.',
    physicalExam: 'A la exploración física encontramos paciente consciente, orientado en sus tres esferas, cardiopulmonar con ruidos cardiacos rítmicos.',
    chronologicalLabsText: '23/10/2026: Hb 13.1 g/dL, Leucos 8,900/µL, Cr 0.9 mg/dL.\n21/10/2026: Hb 12.9 g/dL, Leucos 14,200/µL, Cr 1.3 mg/dL.',
    imagingStudiesText: '22/10/2026: Radiografía de tórax PA (Radiografía) — Infiltrado basal derecho en resolución.',
    problemAnalysis: 'Paciente con evolución favorable hacia la mejoría clínica y paraclínica.',
    dietPlan: 'Dieta para diabético 1800 kcal',
    solutionsPlan: 'Solución salina 0.9% 500 cc p/24h',
    medicationsPlan: '• Ceftriaxona 1g IV cada 24 hrs\n• Insulina Glargina 14 UI SC cada 24 hrs',
    nursingOrdersPlan: '• Signos vitales por turno\n• Cuidados de vía periférica',
    residentName: 'Dr. Miranda',
  });

  assert.ok(!note.includes('HOSPITAL DE ESPECIALIDADES'));
  assert.ok(!note.includes('SUBJETIVO:'));
  assert.ok(!note.includes('OBJETIVO:'));
  assert.ok(note.startsWith('Paciente masculino de 64 años de edad, en su 5° día de estancia intrahospitalaria, cursando con los diagnósticos actuales de:'));
  assert.ok(note.includes('Diagnósticos previos de ingreso:'));
  assert.ok(note.includes('Signos vitales: TA 125/80 mmHg, FC 78 lpm, FR 18 rpm, Temp 36.7 °C, SpO2 95%, Glucemia capilar 142 mg/dL. A la exploración física encontramos paciente'));
  assert.ok(note.includes('PARACLÍNICOS:\n23/10/2026:'));
  assert.ok(note.includes('ESTUDIOS DE IMAGEN Y GABINETE:\n22/10/2026:'));
  assert.ok(note.includes('ANÁLISIS:\nPaciente con evolución favorable'));
  assert.ok(!note.includes('COBERTURA ANTIMICROBIANA'));
  assert.ok(note.includes('INDICACIONES MÉDICAS:\n1. Dieta:\n   - Dieta para diabético 1800 kcal\n2. Soluciones:\n   - Solución salina 0.9% 500 cc p/24h\n3. Medicamentos:\n   - Ceftriaxona 1g IV cada 24 hrs\n   - Insulina Glargina 14 UI SC cada 24 hrs\n4. Indicaciones de enfermería:\n   - Signos vitales por turno\n   - Cuidados de vía periférica'));
});

test('buildNomClinicalHistoryNote starts directly from HISTORIA CLÍNICA and includes ANÁLISIS E INTEGRACIÓN CLÍNICA before Plan', () => {
  const historyNote = buildNomClinicalHistoryNote({
    patient: {
      name: 'Mendoza Ruiz Fernando',
      bed: 'Cama 308',
      service: 'Medicina Interna Piso 3',
      age: 58,
      gender: 'Masculino',
      recordNumber: 'EXP-129401',
      admissionDate: '2026-10-23',
      codeStatus: 'RCP 1 (Reanimación Completa / Todo esfuerzo)',
      allergies: 'Alérgico a sulfamidas',
    },
    history: {
      interrogationType: 'Directo',
      maritalStatus: 'Casado',
      occupation: 'Contador',
      ahf: 'Padre finado por IAM a los 60 años. Madre con DM2.',
      apnp: 'Habitación urbana con todos los servicios. Tabaquismo negativo.',
      app: 'HAS diagnosticada hace 8 años en manejo con Telmisartán 40mg.',
      currentIllness: 'Inicia hace 3 días con disnea progresiva hasta pequeños esfuerzos y ortopnea.',
      ipas: 'Cardiovascular: palpitaciones ocasionales. Resto negativo.',
      initialLabsGabinete: 'Hb 14.1, Leucos 8,200, Cr 1.0, BNP 1,200 pg/ml. ECG con taquicardia sinusal.',
      clinicalAnalysis: 'Paciente masculino de la sexta década de la vida que ingresa con datos clínicos y bioquímicos de insuficiencia cardíaca aguda descompensada.',
      diagnosticImpression: '1. Insuficiencia Cardíaca Aguda Descompensada NYHA IV\n2. HAS estadio 2',
      prognosisLife: 'Bueno para la vida a corto plazo',
      admissionPlan: '1. Dieta hiposódica estricta.\n2. Furosemida 40 mg IV c/12h.\n3. Balance estricto.',
    },
    vitals: {
      bp: '150/90',
      hr: '98',
      rr: '22',
      temp: '36.6',
      spo2: '93',
    },
    residentName: 'MIP Dra. Sofía Hernández',
  });

  assert.ok(historyNote.startsWith('HISTORIA CLÍNICA'));
  assert.ok(!historyNote.includes('DEPARTAMENTO DE MEDICINA INTERNA'));
  assert.ok(historyNote.includes('MENDOZA RUIZ FERNANDO'));
  assert.ok(historyNote.includes('IX. ANÁLISIS E INTEGRACIÓN CLÍNICA:'));
  assert.ok(historyNote.includes('insuficiencia cardíaca aguda descompensada'));
  assert.ok(historyNote.includes('XII. PLAN DE MANEJO E INDICACIONES MÉDICAS:'));
  assert.ok(historyNote.includes('Elaboró: MIP Dra. Sofía Hernández'));
});

test('isNoRcp and getCodeStatusInfo correctly differentiate RCP 1, RCP 2, and RCP 3 with exact codeLabel', () => {
  const rcp3 = getCodeStatusInfo('RCP 3 (No Reanimación / Voluntad Anticipada / Paliativo)');
  assert.equal(rcp3.isNoRcp, true);
  assert.equal(rcp3.codeLabel, 'RCP 3');
  assert.ok(rcp3.shortLabel.includes('NO REANIMACIÓN'));

  const rcp1 = getCodeStatusInfo('RCP 1 (Reanimación Completa / Todo esfuerzo)');
  assert.equal(rcp1.isNoRcp, false);
  assert.equal(rcp1.codeLabel, 'RCP 1');
  assert.ok(rcp1.shortLabel.includes('COMPLETO'));

  const rcp2 = getCodeStatusInfo('RCP 2 (Manejo Intermedio / Limitado / No IOT)');
  assert.equal(rcp2.isNoRcp, false);
  assert.equal(rcp2.codeLabel, 'RCP 2');
  assert.ok(rcp2.shortLabel.includes('RCP 2'));
});

test('parseDiagnosesList and formatDiagnosesList preserve CIE-10 codes and renumbering', () => {
  const parsed = parseDiagnosesList([
    '1. [CIE-10: A41.5] Choque Séptico de foco urinario',
    '2. [CIE-10: N17.9] Lesión Renal Aguda KDIGO 3',
    '3. Hipertensión Arterial Sistémica',
  ]);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].cie10, 'A41.5');
  assert.equal(parsed[0].description, 'Choque Séptico de foco urinario');
  assert.equal(parsed[2].cie10, '');

  // Reorder 2nd to 1st
  const reordered = [parsed[1], parsed[0], parsed[2]];
  const formatted = formatDiagnosesList(reordered);
  assert.equal(formatted[0], '1. [CIE-10: N17.9] Lesión Renal Aguda KDIGO 3');
  assert.equal(formatted[1], '2. [CIE-10: A41.5] Choque Séptico de foco urinario');
  assert.equal(formatted[2], '3. Hipertensión Arterial Sistémica');
});

test('buildDeterministicProgressNote formats structuredSolutions, structuredNursingOrders with notes, and pendings in hierarchical bullets', () => {
  const note = buildDeterministicProgressNote({
    patient: {
      name: 'Paciente Prueba',
      bed: 'Cama 101',
      service: 'Medicina Interna',
      age: 55,
      gender: 'Masculino',
      diagnoses: '1. [CIE-10: J18.9] Neumonía adquirida en la comunidad',
      hospitalStayDays: 2,
      codeStatus: 'RCP 1',
    },
    vitals: { bp: '120/70', hr: '80', rr: '18', temp: '36.5', spo2: '94' },
    physicalExam: 'Consciente y orientado.',
    problemAnalysis: 'En mejoría.',
    dietPlan: 'Dieta blanda hiposódica',
    dietSpecialNotes: 'Restricción hídrica a 1200 ml en 24h',
    structuredSolutions: [
      {
        id: 's-1',
        solutionType: 'Solución Hartmann',
        volume: '1000',
        addedConcentrateOrMed: 'KCl 20 mEq',
        route: 'IV',
        infusionRate: '42 ml/h p/24h',
        specialNotes: 'Vigilar sitio de punción periférica',
      },
      {
        id: 's-2',
        solutionType: 'Solución Salina 0.9%',
        volume: '100',
        addedConcentrateOrMed: 'Norepinefrina 8 mg',
        concentration: '80 mcg/ml',
        route: 'CVC',
        infusionRate: '6 ml/h titular para PAM > 65 mmHg',
        specialNotes: 'Infusión continua por lumen distal exclusivo',
      },
    ],
    medicationsPlan: 'Ceftriaxona 1g IV cada 24h\nClaromicina 500mg VO cada 12h',
    structuredNursingOrders: [
      {
        id: 'n-1',
        text: 'Signos vitales cada 2 horas y curva térmica',
        note: 'Notificar al médico de guardia si T > 38.0 °C o PAM < 65 mmHg',
      },
      {
        id: 'n-2',
        text: 'Cabecera semifowler a 35 grados',
      },
    ],
    pendingsText: 'Recabar hemocultivos\nValorar destete de vasopresor',
  });

  assert.ok(note.includes('1. Dieta:\n   - Dieta blanda hiposódica\n     Restricción hídrica a 1200 ml en 24h'));
  assert.ok(note.includes('2. Soluciones:\n   - Solución Hartmann 1000 ml + KCl 20 mEq Vía IV a 42 ml/h p/24h\n     Vigilar sitio de punción periférica\n   - Solución Salina 0.9% 100 ml + Norepinefrina 8 mg [Conc: 80 mcg/ml] Vía CVC a 6 ml/h titular para PAM > 65 mmHg\n     Infusión continua por lumen distal exclusivo'));
  assert.ok(note.includes('3. Medicamentos:\n   - Ceftriaxona 1g IV cada 24h\n   - Claromicina 500mg VO cada 12h'));
  assert.ok(note.includes('4. Indicaciones de enfermería:\n   - Signos vitales cada 2 horas y curva térmica\n     Notificar al médico de guardia si T > 38.0 °C o PAM < 65 mmHg\n   - Cabecera semifowler a 35 grados'));
  assert.ok(note.includes('5. Pendientes:\n   - Recabar hemocultivos\n   - Valorar destete de vasopresor'));
});

test('getRespiratorySupportFlags detects Intubated / VMI and CPAP / BiPAP accurately', () => {
  const vmiPat = getRespiratorySupportFlags({ clinicalTags: ['VMI / Intubación', 'Aislamiento'] });
  assert.equal(vmiPat.isIntubated, true);
  assert.equal(vmiPat.isCpap, false);

  const cpapPat = getRespiratorySupportFlags({ clinicalTags: ['CPAP / BiPAP'] });
  assert.equal(cpapPat.isIntubated, false);
  assert.equal(cpapPat.isCpap, true);
});

test('formatDiagnosticStudiesSummary formats imaging and lab studies with new indicators', () => {
  const summary = formatDiagnosticStudiesSummary([
    {
      category: 'TAC',
      title: 'Tomografía de Tórax de alta resolución',
      summary: 'Infiltrados bilaterales periféricos compatibles con COVID severo',
      date: '2026-10-23',
      time: '14:30',
      isNew: true,
    },
    {
      category: 'Ultrasonido',
      title: 'USG de Vías Biliares',
      summary: 'Litiasis vesicular sin colecistitis aguda',
      date: '2026-10-22',
      isNew: false,
    },
  ]);

  assert.ok(summary.includes('[★ NUEVO] [TAC] Tomografía de Tórax'));
  assert.ok(summary.includes('[Ultrasonido] USG de Vías Biliares'));
  assert.ok(summary.includes('Infiltrados bilaterales'));
});

test('sanitizePdfText eliminates codepoints > 255 (□, •, —, ≥) while preserving Spanish accents for jsPDF WinAnsi fonts', () => {
  const raw = '□ Cotejar con Nefrología • Meropenem 1g — Gasto ≥ 1 ml/kg/h → [★]';
  const clean = sanitizePdfText(raw);

  assert.ok(clean.includes('[ ] Cotejar con Nefrología'));
  assert.ok(clean.includes('- Meropenem 1g'));
  assert.ok(clean.includes('>= 1 ml/kg/h'));
  assert.ok(clean.includes('-> [*]'));

  for (let i = 0; i < clean.length; i++) {
    assert.ok(
      clean.charCodeAt(i) <= 255,
      `Character "${clean[i]}" at index ${i} has charCode ${clean.charCodeAt(i)} > 255`
    );
  }
});

test('formatCriticalCareSystemsSummary and formatCriticalCareSystemsForNote format 6 critical care systems cleanly', () => {
  const sys = {
    enabled: true,
    neuro: {
      consciousness: 'Bajo sedoanalgesia',
      glasgow: '10T',
      rass: '-2 (Sedación ligera)',
      sedationAnalgesia: 'Fentanilo + Propofol',
      reflexes: 'Pupilas isocóricas 2mm reactivas',
    },
    respiratory: {
      supportType: 'VMI (Intubación Endotraqueal)',
      ventMode: 'AC/Volumen',
      fio2: '45',
      peep: '8',
      tidalVolume: '420',
      respRateVent: '18',
      spo2: '94',
      bloodGas: 'pH 7.36, PaO2/FiO2 210',
    },
    hemodynamic: {
      hemodynamicStatus: 'Con soporte vasopresor',
      bpAndMap: 'TA 105/65 (PAM 78 mmHg)',
      vasopressorsInotropes: 'Norepinefrina 0.08 mcg/kg/min',
      hrAndRhythm: 'FC 88 lpm, Sinusal',
    },
    gastroMetabolic: {
      glycemias: '140-165 mg/dL',
      feedingType: 'Enteral por SNG',
      abdomenAndBowel: 'Blando, peristalsis +',
    },
    renal: {
      diuresis: '1100 ml/24h (0.7 ml/kg/h)',
      renalFunction: 'Cr 1.6, K 4.2',
      fluidBalance: '-350 ml',
      diureticsOrRrt: 'Furosemida 20mg IV c/12h',
    },
    infectious: {
      infectionData: 'Foco pulmonar, afebril 24h',
      acutePhaseReactants: 'Leucos 12.4k, PCR 8.2',
      antibioticsInUse: 'Meropenem [D4/7]',
    },
  };

  const summary = formatCriticalCareSystemsSummary(sys);
  assert.equal(summary.length, 6);
  assert.equal(summary[0].label, 'Neurológico');
  assert.ok(summary[0].summary.includes('Glasgow 10T'));
  assert.equal(summary[1].label, 'Respiratorio');
  assert.ok(summary[1].summary.includes('FiO2 45%'));
  assert.equal(summary[2].label, 'Hemodinámico / Cardiológico');
  assert.ok(summary[2].summary.includes('Norepinefrina 0.08 mcg/kg/min'));

  const noteBlock = formatCriticalCareSystemsForNote(sys);
  assert.ok(noteBlock.includes('EVOLUCIÓN Y PARÁMETROS POR SISTEMAS:'));
  assert.ok(noteBlock.includes('- Neurológico:'));
  assert.ok(noteBlock.includes('- Renal:'));
  assert.ok(noteBlock.includes('- Infeccioso:'));

  // Partial systems for a general floor patient (only Uresis & Balance filled) omits all empty systems
  const partialSys = {
    enabled: true,
    renal: {
      diuresis: '1500 ml/24h (1.1 ml/kg/h)',
      fluidBalance: '-200 ml',
    },
  };
  const partialBlock = formatCriticalCareSystemsForNote(partialSys);
  assert.ok(partialBlock.includes('EVOLUCIÓN Y PARÁMETROS POR SISTEMAS:'));
  assert.ok(partialBlock.includes('- Renal: Diuresis: 1500 ml/24h (1.1 ml/kg/h) | Balances: -200 ml'));
  assert.equal(partialBlock.includes('Neurológico'), false);
  assert.equal(partialBlock.includes('Respiratorio'), false);
});

test('getNonRedundantClinicalTags removes tags already represented by primary top badges (Intubado, CPAP, RCP) while keeping non-redundant tags', () => {
  const inputTags = [
    'Intubado / VMI',
    'CPAP / BiPAP',
    'RCP 3 (No RCP / Voluntad)',
    'Aislado de Contacto',
    'Hemodiálisis',
    'CVC',
  ];
  const filtered = getNonRedundantClinicalTags(inputTags);
  assert.deepEqual(filtered, ['Aislado de Contacto', 'Hemodiálisis', 'CVC']);
});

test('hexToRgb and tintRgb convert hex colors to RGB tuples for color PDF badges', () => {
  const rgb = hexToRgb('#2563eb');
  assert.deepEqual(rgb, [37, 99, 235]);

  const tinted = tintRgb(rgb, 0.85);
  assert.ok(tinted[0] > 200 && tinted[1] > 220 && tinted[2] > 240);
});

test('shouldShowFloatingSearchButton hides floating search on desktop until main search bar scrolls out of view, and always shows on tablet/mobile', async () => {
  const { shouldShowFloatingSearchButton } = await import('./clinicalLogic.ts');
  // Mobile / Tablet: always visible
  assert.equal(
    shouldShowFloatingSearchButton({ isDesktopViewport: false, isDesktopTopBarOutOfView: false }),
    true
  );
  assert.equal(
    shouldShowFloatingSearchButton({ isDesktopViewport: false, isDesktopTopBarOutOfView: true }),
    true
  );
  // Desktop at top of page (main search bar visible): hidden to avoid duplicate search UI
  assert.equal(
    shouldShowFloatingSearchButton({ isDesktopViewport: true, isDesktopTopBarOutOfView: false }),
    false
  );
  // Desktop scrolled down (main search bar out of view): visible
  assert.equal(
    shouldShowFloatingSearchButton({ isDesktopViewport: true, isDesktopTopBarOutOfView: true }),
    true
  );
});

test('buildCompactLabSummaryItems formats compact lab chips with trends and alert flags for the compact list view', async () => {
  const { buildCompactLabSummaryItems } = await import('./clinicalLogic.ts');
  const chips = buildCompactLabSummaryItems(
    { leucos: 14800, hb: 11.2, plaquetas: 210000, creatinina: 1.2, na: 138, k: 4.1, lactato: 2.3 },
    { leucos: 18200, hb: 11.0, plaquetas: 195000, creatinina: 1.8 }
  );

  assert.equal(chips[0].label, 'Leu');
  assert.equal(chips[0].valueText, '14.8k');
  assert.equal(chips[0].trend, 'down');
  assert.equal(chips[0].isAlert, true);

  const crChip = chips.find((c) => c.label === 'Cr');
  assert.ok(crChip);
  assert.equal(crChip.valueText, '1.2');
  assert.equal(crChip.trend, 'down');

  const lacChip = chips.find((c) => c.label === 'Lac');
  assert.ok(lacChip);
  assert.equal(lacChip.isAlert, true);
});

test('buildPatientComparativeLabAnalysis compares all laboratory panels (BHC, QS, ES6, PFH, Gaso, Coag, Inflam, ExtraParams) chronologically with trends', async () => {
  const { buildPatientComparativeLabAnalysis } = await import('./clinicalLogic.ts');
  const labs = [
    {
      id: 'l-new',
      date: '2026-10-27',
      time: '06:30',
      hb: 11.4,
      leucos: 8900,
      plaquetas: 220000,
      creatinina: 1.1,
      urea: 36,
      na: 139,
      k: 4.1,
      calcium: '9.0',
      phosphorus: '3.5',
      magnesium: '2.0',
      biliTotal: '1.2',
      ast: '32',
      alt: '35',
      albumin: '3.4',
      ph: 7.39,
      pco2: 37,
      hco3: 23.0,
      lactato: 1.1,
      inr: '1.12',
      pcr: 14.0,
      procalcitonina: 0.4,
      extraParams: {
        tsh: { label: 'TSH', value: '2.4', unit: 'mUI/L', panelId: 'endocrino' },
      },
    },
    {
      id: 'l-old',
      date: '2026-10-24',
      time: '06:30',
      hb: 10.6,
      leucos: 15200,
      plaquetas: 180000,
      creatinina: 1.9,
      urea: 68,
      na: 134,
      k: 4.8,
      calcium: '8.3',
      phosphorus: '4.4',
      magnesium: '1.6',
      biliTotal: '2.8',
      ast: '78',
      alt: '84',
      albumin: '2.9',
      ph: 7.29,
      pco2: 31,
      hco3: 16.5,
      lactato: 2.9,
      inr: '1.48',
      pcr: 68.0,
      procalcitonina: 3.2,
      extraParams: {
        tsh: { label: 'TSH', value: '4.8', unit: 'mUI/L', panelId: 'endocrino' },
      },
    },
  ];

  const analysis = buildPatientComparativeLabAnalysis(labs);
  assert.ok(analysis.panelsWithData.length >= 7);

  // Verify PFH (Bilirrubina Total & AST) trends
  const btRow = analysis.rows.find((r) => r.key === 'biliTotal');
  assert.ok(btRow);
  assert.equal(btRow.panelId, 'pfh');
  assert.equal(btRow.previousFormatted, '2.8');
  assert.equal(btRow.latestFormatted, '1.2');
  assert.equal(btRow.trend.direction, 'down');
  assert.equal(btRow.trend.formattedDiff, '-1.6');
  assert.ok(btRow.trend.colorClass.includes('emerald'));

  // Verify Albumin (higher is better)
  const albRow = analysis.rows.find((r) => r.key === 'albumin');
  assert.ok(albRow);
  assert.equal(albRow.trend.direction, 'up');
  assert.equal(albRow.trend.formattedDiff, '+0.5');
  assert.ok(albRow.trend.colorClass.includes('emerald'));

  // Verify Gasometry pH (homeostatic target 7.40: 7.29 -> 7.39 is improvement)
  const phRow = analysis.rows.find((r) => r.key === 'ph');
  assert.ok(phRow);
  assert.equal(phRow.trend.direction, 'up');
  assert.ok(phRow.trend.colorClass.includes('emerald'));

  // Verify Coagulation INR (1.48 -> 1.12 is improvement)
  const inrRow = analysis.rows.find((r) => r.key === 'inr');
  assert.ok(inrRow);
  assert.equal(inrRow.panelId, 'coagulacion');
  assert.equal(inrRow.trend.direction, 'down');
  assert.ok(inrRow.trend.colorClass.includes('emerald'));

  // Verify Endocrine / extraParams (TSH)
  const tshRow = analysis.rows.find((r) => r.key === 'tsh');
  assert.ok(tshRow);
  assert.equal(tshRow.panelId, 'endocrino_otros');
  assert.equal(tshRow.previousFormatted, '4.8');
  assert.equal(tshRow.latestFormatted, '2.4');
  assert.equal(tshRow.trend.direction, 'down');
});


