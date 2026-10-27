import { LabRecord, LabExtraParamValue } from '../types/clinical';

export interface LabFieldSpec {
  key: string;
  label: string;
  shortLabel: string;
  unit: string;
  placeholder: string;
  standardField?: keyof LabRecord;
}

export interface LabPanelSpec {
  id: string;
  name: string;
  shortName: string;
  category: string;
  accentColor: string;
  fields: LabFieldSpec[];
}

export const LAB_PANELS_CATALOG: LabPanelSpec[] = [
  {
    id: 'bhc',
    name: 'Biometría Hemática Completa (BHC)',
    shortName: 'BHC',
    category: 'Hematología',
    accentColor: '#EF4444',
    fields: [
      { key: 'hb', label: 'Hemoglobina (Hb)', shortLabel: 'Hb', unit: 'g/dL', placeholder: '13.5', standardField: 'hb' },
      { key: 'hto', label: 'Hematocrito (Hto)', shortLabel: 'Hto', unit: '%', placeholder: '40.5' },
      { key: 'wbc', label: 'Leucocitos (Leu)', shortLabel: 'Leu', unit: 'x10³/µL', placeholder: '7.8', standardField: 'wbc' },
      { key: 'neutrophils', label: 'Neutrófilos (Neu)', shortLabel: 'Neu', unit: '% / abs', placeholder: '65% (5.1)', standardField: 'neutrophils' },
      { key: 'lymphocytes', label: 'Linfocitos (Lin)', shortLabel: 'Lin', unit: '% / abs', placeholder: '25% (1.9)', standardField: 'lymphocytes' },
      { key: 'monocytes', label: 'Monocitos (Mon)', shortLabel: 'Mon', unit: '% / abs', placeholder: '6%' },
      { key: 'eosinophils', label: 'Eosinófilos (Eos)', shortLabel: 'Eos', unit: '% / abs', placeholder: '2%' },
      { key: 'basophils', label: 'Basófilos (Bas)', shortLabel: 'Bas', unit: '%', placeholder: '0.5%' },
      { key: 'bandas', label: 'Bandas', shortLabel: 'Bandas', unit: '%', placeholder: '0%' },
      { key: 'platelets', label: 'Plaquetas (Plaq)', shortLabel: 'Plaq', unit: 'x10³/µL', placeholder: '245', standardField: 'platelets' },
      { key: 'vcm', label: 'Vol. Corp. Medio (VCM)', shortLabel: 'VCM', unit: 'fL', placeholder: '88' },
      { key: 'hcm', label: 'Hb Corp. Media (HCM)', shortLabel: 'HCM', unit: 'pg', placeholder: '29' },
      { key: 'cmhc', label: 'CMHC', shortLabel: 'CMHC', unit: 'g/dL', placeholder: '33' },
      { key: 'rdw', label: 'ADE / RDW', shortLabel: 'RDW', unit: '%', placeholder: '13.2' },
      { key: 'reticulocitos', label: 'Reticulocitos', shortLabel: 'Retis', unit: '%', placeholder: '1.2' },
    ],
  },
  {
    id: 'qs',
    name: 'Química Sanguínea Completa (QS)',
    shortName: 'Química Sanguínea',
    category: 'Bioquímica',
    accentColor: '#3B82F6',
    fields: [
      { key: 'glucose', label: 'Glucosa Sérica', shortLabel: 'Glu', unit: 'mg/dL', placeholder: '98', standardField: 'glucose' },
      { key: 'hba1c', label: 'Hemoglobina Glucosilada (HbA1c)', shortLabel: 'HbA1c', unit: '%', placeholder: '6.2' },
      { key: 'urea', label: 'Urea', shortLabel: 'Urea', unit: 'mg/dL', placeholder: '34', standardField: 'urea' },
      { key: 'bun', label: 'Nitrógeno Ureico (BUN)', shortLabel: 'BUN', unit: 'mg/dL', placeholder: '16', standardField: 'bun' },
      { key: 'creatinine', label: 'Creatinina Sérica (Cr)', shortLabel: 'Cr', unit: 'mg/dL', placeholder: '0.9', standardField: 'creatinine' },
      { key: 'uric_acid', label: 'Ácido Úrico', shortLabel: 'Ác. Úrico', unit: 'mg/dL', placeholder: '5.4' },
      { key: 'osmolarity', label: 'Osmolaridad Sérica', shortLabel: 'Osm', unit: 'mOsm/kg', placeholder: '285' },
    ],
  },
  {
    id: 'renal_ego',
    name: 'Pruebas de Función Renal, Depuración y EGO',
    shortName: 'Función Renal / EGO',
    category: 'Nefrología',
    accentColor: '#0EA5E9',
    fields: [
      { key: 'creatinine', label: 'Creatinina Sérica (Cr)', shortLabel: 'Cr', unit: 'mg/dL', placeholder: '0.9', standardField: 'creatinine' },
      { key: 'tfg', label: 'TFG (CKD-EPI)', shortLabel: 'TFG', unit: 'mL/min/1.73m²', placeholder: '85' },
      { key: 'bun', label: 'BUN', shortLabel: 'BUN', unit: 'mg/dL', placeholder: '16', standardField: 'bun' },
      { key: 'urea', label: 'Urea', shortLabel: 'Urea', unit: 'mg/dL', placeholder: '34', standardField: 'urea' },
      { key: 'cistatina_c', label: 'Cistatina C', shortLabel: 'Cistatina C', unit: 'mg/L', placeholder: '0.85' },
      { key: 'fena', label: 'FeNa (Excreción Fracc. Na)', shortLabel: 'FeNa', unit: '%', placeholder: '0.8' },
      { key: 'feurea', label: 'FeUrea', shortLabel: 'FeUrea', unit: '%', placeholder: '32' },
      { key: 'na_urinario', label: 'Sodio Urinario (NaU)', shortLabel: 'NaU', unit: 'mEq/L', placeholder: '25' },
      { key: 'rac', label: 'Relación Albúmina/Creatinina (RAC)', shortLabel: 'RAC', unit: 'mg/g', placeholder: '18' },
      { key: 'prot_24h', label: 'Proteinuria en 24h', shortLabel: 'Prot 24h', unit: 'mg/24h', placeholder: '150' },
      { key: 'dep_cr_24h', label: 'Depuración Cr 24h', shortLabel: 'DepCr 24h', unit: 'mL/min', placeholder: '82' },
      { key: 'ego_densidad', label: 'EGO Densidad', shortLabel: 'EGO Dens', unit: '', placeholder: '1.015' },
      { key: 'ego_ph', label: 'EGO pH', shortLabel: 'EGO pH', unit: '', placeholder: '6.0' },
      { key: 'ego_prot', label: 'EGO Proteínas', shortLabel: 'EGO Prot', unit: 'mg/dL', placeholder: 'Negativo' },
      { key: 'ego_leucos', label: 'EGO Leucocitos', shortLabel: 'EGO Leu', unit: '/cpo', placeholder: '0-2/cpo' },
      { key: 'ego_eritros', label: 'EGO Eritrocitos', shortLabel: 'EGO Eri', unit: '/cpo', placeholder: '0-1/cpo' },
      { key: 'ego_nitritos', label: 'EGO Nitritos / Esterasa', shortLabel: 'EGO Nit/EL', unit: '', placeholder: 'Neg/Neg' },
      { key: 'ego_sedimento', label: 'Sedimento Urinario / Cilindros', shortLabel: 'Sedimento', unit: '', placeholder: 'Sin cilindros' },
    ],
  },
  {
    id: 'electrolitos',
    name: 'Electrólitos Séricos Completos (ES6 / ES7)',
    shortName: 'Electrólitos (ES6)',
    category: 'Medio Interno',
    accentColor: '#10B981',
    fields: [
      { key: 'sodium', label: 'Sodio (Na)', shortLabel: 'Na', unit: 'mEq/L', placeholder: '139', standardField: 'sodium' },
      { key: 'potassium', label: 'Potasio (K)', shortLabel: 'K', unit: 'mEq/L', placeholder: '4.1', standardField: 'potassium' },
      { key: 'chloride', label: 'Cloro (Cl)', shortLabel: 'Cl', unit: 'mEq/L', placeholder: '103', standardField: 'chloride' },
      { key: 'calcium', label: 'Calcio Total (Ca)', shortLabel: 'Ca', unit: 'mg/dL', placeholder: '9.2', standardField: 'calcium' },
      { key: 'calcium_ion', label: 'Calcio Iónico (Ca²⁺)', shortLabel: 'Ca iónico', unit: 'mmol/L', placeholder: '1.18' },
      { key: 'ca_corregido', label: 'Calcio Corregido por Albúmina', shortLabel: 'Ca corr', unit: 'mg/dL', placeholder: '9.4' },
      { key: 'phosphorus', label: 'Fósforo (P)', shortLabel: 'P', unit: 'mg/dL', placeholder: '3.5', standardField: 'phosphorus' },
      { key: 'magnesium', label: 'Magnesio (Mg)', shortLabel: 'Mg', unit: 'mg/dL', placeholder: '2.0', standardField: 'magnesium' },
    ],
  },
  {
    id: 'pfh',
    name: 'Pruebas de Función Hepática (PFH)',
    shortName: 'PFH',
    category: 'Gastroenterología / Hepatología',
    accentColor: '#F59E0B',
    fields: [
      { key: 'ast', label: 'AST (TGO)', shortLabel: 'AST', unit: 'U/L', placeholder: '24', standardField: 'ast' },
      { key: 'alt', label: 'ALT (TGP)', shortLabel: 'ALT', unit: 'U/L', placeholder: '28', standardField: 'alt' },
      { key: 'alp', label: 'Fosfatasa Alcalina (FA)', shortLabel: 'FA', unit: 'U/L', placeholder: '85', standardField: 'alp' },
      { key: 'ggt', label: 'Gamma-Glutamil Transferasa (GGT)', shortLabel: 'GGT', unit: 'U/L', placeholder: '32' },
      { key: 'biliTotal', label: 'Bilirrubina Total (BT)', shortLabel: 'BT', unit: 'mg/dL', placeholder: '0.8', standardField: 'biliTotal' },
      { key: 'biliDirect', label: 'Bilirrubina Directa (BD)', shortLabel: 'BD', unit: 'mg/dL', placeholder: '0.2', standardField: 'biliDirect' },
      { key: 'biliIndirect', label: 'Bilirrubina Indirecta (BI)', shortLabel: 'BI', unit: 'mg/dL', placeholder: '0.6' },
      { key: 'prot_totales', label: 'Proteínas Totales', shortLabel: 'Prot Tot', unit: 'g/dL', placeholder: '7.1' },
      { key: 'albumin', label: 'Albúmina Sérica (Alb)', shortLabel: 'Alb', unit: 'g/dL', placeholder: '3.9', standardField: 'albumin' },
      { key: 'globulinas', label: 'Globulinas', shortLabel: 'Glob', unit: 'g/dL', placeholder: '3.2' },
      { key: 'ldh', label: 'Deshidrogenasa Láctica (DHL)', shortLabel: 'DHL', unit: 'U/L', placeholder: '185', standardField: 'ldh' },
      { key: 'amonio', label: 'Amonio Sérico (NH3)', shortLabel: 'Amonio', unit: 'µmol/L', placeholder: '35' },
    ],
  },
  {
    id: 'gasometria',
    name: 'Gasometría Completa (Arterial / Venosa)',
    shortName: 'Gasometría',
    category: 'Cuidados Críticos / Neumología',
    accentColor: '#EC4899',
    fields: [
      { key: 'gas_tipo', label: 'Tipo de Muestra', shortLabel: 'Muestra', unit: '', placeholder: 'Arterial / Venosa' },
      { key: 'ph', label: 'pH', shortLabel: 'pH', unit: '', placeholder: '7.40', standardField: 'ph' },
      { key: 'pco2', label: 'pCO2', shortLabel: 'pCO2', unit: 'mmHg', placeholder: '38', standardField: 'pco2' },
      { key: 'po2', label: 'pO2', shortLabel: 'pO2', unit: 'mmHg', placeholder: '85', standardField: 'po2' },
      { key: 'hco3', label: 'HCO3 (Bicarbonato)', shortLabel: 'HCO3', unit: 'mEq/L', placeholder: '24', standardField: 'hco3' },
      { key: 'eb', label: 'Exceso de Base (EB)', shortLabel: 'EB', unit: 'mmol/L', placeholder: '-0.5', standardField: 'eb' },
      { key: 'lactate', label: 'Lactato', shortLabel: 'Lac', unit: 'mmol/L', placeholder: '1.1', standardField: 'lactate' },
      { key: 'sao2_gas', label: 'SatO2 (Gasometría)', shortLabel: 'SaO2', unit: '%', placeholder: '96%' },
      { key: 'fio2_gas', label: 'FiO2 al momento de toma', shortLabel: 'FiO2', unit: '%', placeholder: '21%' },
      { key: 'pafi', label: 'Índice PaO2/FiO2 (Kirby)', shortLabel: 'PaO2/FiO2', unit: 'mmHg', placeholder: '310' },
      { key: 'anion_gap', label: 'Brecha Aniónica (Anion Gap)', shortLabel: 'AG', unit: 'mEq/L', placeholder: '12' },
      { key: 'cohb', label: 'Carboxihemoglobina (COHb)', shortLabel: 'COHb', unit: '%', placeholder: '0.8%' },
      { key: 'methb', label: 'Metahemoglobina (MetHb)', shortLabel: 'MetHb', unit: '%', placeholder: '0.5%' },
    ],
  },
  {
    id: 'coagulacion',
    name: 'Tiempos de Coagulación y Hemostasia',
    shortName: 'Coagulación',
    category: 'Hematología / Trombosis',
    accentColor: '#8B5CF6',
    fields: [
      { key: 'tp', label: 'Tiempo de Protrombina (TP)', shortLabel: 'TP', unit: 's', placeholder: '12.5', standardField: 'tp' },
      { key: 'inr', label: 'INR', shortLabel: 'INR', unit: '', placeholder: '1.05', standardField: 'inr' },
      { key: 'ttpa', label: 'TTPa', shortLabel: 'TTPa', unit: 's', placeholder: '29.0', standardField: 'ttpa' },
      { key: 'tt', label: 'Tiempo de Trombina (TT)', shortLabel: 'TT', unit: 's', placeholder: '16.0' },
      { key: 'fibrinogen', label: 'Fibrinógeno', shortLabel: 'Fibrinógeno', unit: 'mg/dL', placeholder: '320' },
      { key: 'dimerD', label: 'Dímero D', shortLabel: 'Dímero D', unit: 'ng/mL', placeholder: '240', standardField: 'dimerD' },
    ],
  },
  {
    id: 'lipidos',
    name: 'Perfil de Lípidos Completo',
    shortName: 'Perfil de Lípidos',
    category: 'Cardiometabólico',
    accentColor: '#D97706',
    fields: [
      { key: 'col_total', label: 'Colesterol Total', shortLabel: 'Col Tot', unit: 'mg/dL', placeholder: '185' },
      { key: 'hdl', label: 'Colesterol HDL', shortLabel: 'HDL', unit: 'mg/dL', placeholder: '48' },
      { key: 'ldl', label: 'Colesterol LDL', shortLabel: 'LDL', unit: 'mg/dL', placeholder: '105' },
      { key: 'vldl', label: 'Colesterol VLDL', shortLabel: 'VLDL', unit: 'mg/dL', placeholder: '30' },
      { key: 'trigliceridos', label: 'Triglicéridos (TG)', shortLabel: 'TG', unit: 'mg/dL', placeholder: '145' },
      { key: 'col_no_hdl', label: 'Colesterol No-HDL', shortLabel: 'No-HDL', unit: 'mg/dL', placeholder: '137' },
      { key: 'apo_b', label: 'Apolipoproteína B (ApoB)', shortLabel: 'ApoB', unit: 'mg/dL', placeholder: '88' },
      { key: 'lpa', label: 'Lipoproteína (a) [Lp(a)]', shortLabel: 'Lp(a)', unit: 'nmol/L', placeholder: '35' },
    ],
  },
  {
    id: 'inflamatorios_cardiacos',
    name: 'Marcadores Inflamatorios, Cardíacos y Pancreáticos',
    shortName: 'Inflamación / Cardio / Páncreas',
    category: 'Urgencias / Medicina Interna',
    accentColor: '#DC2626',
    fields: [
      { key: 'pcr', label: 'Proteína C Reactiva (PCR)', shortLabel: 'PCR', unit: 'mg/L', placeholder: '12.5', standardField: 'pcr' },
      { key: 'pct', label: 'Procalcitonina (PCT)', shortLabel: 'PCT', unit: 'ng/mL', placeholder: '0.25', standardField: 'pct' },
      { key: 'vsg', label: 'Velocidad Sedim. Globular (VSG)', shortLabel: 'VSG', unit: 'mm/h', placeholder: '18', standardField: 'vsg' },
      { key: 'ferritin', label: 'Ferritina Sérica', shortLabel: 'Ferritina', unit: 'ng/mL', placeholder: '210', standardField: 'ferritin' },
      { key: 'troponin', label: 'Troponina I / T Ultrasensible', shortLabel: 'Troponina', unit: 'ng/L', placeholder: '14', standardField: 'troponin' },
      { key: 'bnp', label: 'BNP / NT-proBNP', shortLabel: 'BNP/NT-proBNP', unit: 'pg/mL', placeholder: '450', standardField: 'bnp' },
      { key: 'cpk', label: 'CPK Total', shortLabel: 'CPK', unit: 'U/L', placeholder: '95' },
      { key: 'ck_mb', label: 'CK-MB', shortLabel: 'CK-MB', unit: 'U/L', placeholder: '12' },
      { key: 'mioglobina', label: 'Mioglobina', shortLabel: 'Mioglobina', unit: 'ng/mL', placeholder: '45' },
      { key: 'amilasa', label: 'Amilasa Sérica', shortLabel: 'Amilasa', unit: 'U/L', placeholder: '68' },
      { key: 'lipasa', label: 'Lipasa Sérica', shortLabel: 'Lipasa', unit: 'U/L', placeholder: '42' },
    ],
  },
  {
    id: 'tiroideo',
    name: 'Perfil Tiroideo Completo',
    shortName: 'Perfil Tiroideo',
    category: 'Endocrinología',
    accentColor: '#6366F1',
    fields: [
      { key: 'tsh', label: 'TSH (Hormona Estimulante Tiroides)', shortLabel: 'TSH', unit: 'mUI/L', placeholder: '2.1' },
      { key: 't4_libre', label: 'T4 Libre (Tiroxina Libre)', shortLabel: 'T4L', unit: 'ng/dL', placeholder: '1.15' },
      { key: 't4_total', label: 'T4 Total', shortLabel: 'T4T', unit: 'µg/dL', placeholder: '8.2' },
      { key: 't3_libre', label: 'T3 Libre (Triyodotironina Libre)', shortLabel: 'T3L', unit: 'pg/mL', placeholder: '3.1' },
      { key: 't3_total', label: 'T3 Total', shortLabel: 'T3T', unit: 'ng/dL', placeholder: '115' },
      { key: 'anti_tpo', label: 'Anticuerpos Anti-TPO', shortLabel: 'Anti-TPO', unit: 'UI/mL', placeholder: '<9' },
      { key: 'anti_tg', label: 'Anticuerpos Anti-Tiroglobulina', shortLabel: 'Anti-TG', unit: 'UI/mL', placeholder: '<4' },
      { key: 'tiroglobulina', label: 'Tiroglobulina', shortLabel: 'Tiroglobulina', unit: 'ng/mL', placeholder: '12' },
    ],
  },
  {
    id: 'suprarrenal_hormonal',
    name: 'Perfil Suprarrenal, Paratiroideo y Hormonal / Hipofisario',
    shortName: 'Suprarrenal / Hormonal',
    category: 'Endocrinología',
    accentColor: '#7C3AED',
    fields: [
      { key: 'cortisol_am', label: 'Cortisol Matutino (8 AM)', shortLabel: 'Cortisol AM', unit: 'µg/dL', placeholder: '14.5' },
      { key: 'cortisol_pm', label: 'Cortisol Vespertino / Nocturno', shortLabel: 'Cortisol PM', unit: 'µg/dL', placeholder: '4.2' },
      { key: 'cortisol_urin', label: 'Cortisol Libre Urinario 24h', shortLabel: 'CLU 24h', unit: 'µg/24h', placeholder: '32' },
      { key: 'acth', label: 'ACTH Plasmática', shortLabel: 'ACTH', unit: 'pg/mL', placeholder: '28' },
      { key: 'aldosterona', label: 'Aldosterona Plasmática', shortLabel: 'Aldosterona', unit: 'ng/dL', placeholder: '8.5' },
      { key: 'renina', label: 'Actividad/Concentración de Renina', shortLabel: 'Renina', unit: 'ng/mL/h', placeholder: '1.4' },
      { key: 'metanefrinas', label: 'Metanefrinas / Normetanefrinas', shortLabel: 'Metanefrinas', unit: 'pg/mL', placeholder: 'Normal' },
      { key: 'pth', label: 'Hormona Paratiroidea (PTH Intacta)', shortLabel: 'PTH', unit: 'pg/mL', placeholder: '45' },
      { key: 'vitamina_d', label: '25-Hidroxivitamina D [25(OH)D]', shortLabel: 'Vit D', unit: 'ng/mL', placeholder: '32' },
      { key: 'prolactina', label: 'Prolactina', shortLabel: 'PRL', unit: 'ng/mL', placeholder: '12' },
      { key: 'fsh', label: 'FSH', shortLabel: 'FSH', unit: 'mUI/mL', placeholder: '6.5' },
      { key: 'lh', label: 'LH', shortLabel: 'LH', unit: 'mUI/mL', placeholder: '5.2' },
      { key: 'estradiol', label: 'Estradiol (E2)', shortLabel: 'E2', unit: 'pg/mL', placeholder: '45' },
      { key: 'testosterona', label: 'Testosterona Total / Libre', shortLabel: 'Testost', unit: 'ng/dL', placeholder: '450' },
      { key: 'gh_igf1', label: 'GH / IGF-1 (Somatomedina C)', shortLabel: 'IGF-1', unit: 'ng/mL', placeholder: '140' },
    ],
  },
  {
    id: 'marcadores_tumorales',
    name: 'Marcadores Tumorales',
    shortName: 'Marcadores Tumorales',
    category: 'Oncología',
    accentColor: '#DB2777',
    fields: [
      { key: 'psa_total', label: 'Antígeno Prostático Específico (APE / PSA)', shortLabel: 'APE/PSA', unit: 'ng/mL', placeholder: '1.8' },
      { key: 'psa_libre', label: 'APE Libre / % Libre', shortLabel: 'APE Libre', unit: '%', placeholder: '22%' },
      { key: 'cea', label: 'Antígeno Carcinoembrionario (ACE / CEA)', shortLabel: 'ACE/CEA', unit: 'ng/mL', placeholder: '2.1' },
      { key: 'ca_19_9', label: 'CA 19-9', shortLabel: 'CA 19-9', unit: 'U/mL', placeholder: '15' },
      { key: 'ca_125', label: 'CA-125', shortLabel: 'CA-125', unit: 'U/mL', placeholder: '18' },
      { key: 'ca_15_3', label: 'CA 15-3', shortLabel: 'CA 15-3', unit: 'U/mL', placeholder: '14' },
      { key: 'afp', label: 'Alfa-Fetoproteína (AFP)', shortLabel: 'AFP', unit: 'ng/mL', placeholder: '3.5' },
      { key: 'bhcg', label: 'Fracción Beta-hCG Cuantitativa', shortLabel: 'β-hCG', unit: 'mUI/mL', placeholder: '<2' },
      { key: 'beta2_micro', label: 'Beta-2 Microglobulina', shortLabel: 'β2-Micro', unit: 'mg/L', placeholder: '1.6' },
      { key: 'ca_72_4', label: 'CA 72-4 / Enolasa / Cromogranina A', shortLabel: 'Otros MT', unit: '', placeholder: 'Negativo' },
    ],
  },
  {
    id: 'hierro_anemias',
    name: 'Cinética de Hierro y Perfil de Anemias / Hemólisis',
    shortName: 'Hierro / Anemias',
    category: 'Hematología',
    accentColor: '#B45309',
    fields: [
      { key: 'hierro_serico', label: 'Hierro Sérico', shortLabel: 'Fe sérico', unit: 'µg/dL', placeholder: '85' },
      { key: 'tibc', label: 'Capacidad Fijación Hierro (TIBC)', shortLabel: 'TIBC', unit: 'µg/dL', placeholder: '310' },
      { key: 'sat_transf', label: '% Saturación de Transferrina', shortLabel: '%SatTransf', unit: '%', placeholder: '28%' },
      { key: 'transferrina', label: 'Transferrina', shortLabel: 'Transferrina', unit: 'mg/dL', placeholder: '250' },
      { key: 'ferritin', label: 'Ferritina', shortLabel: 'Ferritina', unit: 'ng/mL', placeholder: '150', standardField: 'ferritin' },
      { key: 'vit_b12', label: 'Vitamina B12 (Cianocobalamina)', shortLabel: 'Vit B12', unit: 'pg/mL', placeholder: '420' },
      { key: 'ac_folico', label: 'Ácido Fólico (Folatos)', shortLabel: 'Ác. Fólico', unit: 'ng/mL', placeholder: '11.5' },
      { key: 'haptoglobina', label: 'Haptoglobina', shortLabel: 'Haptoglobina', unit: 'mg/dL', placeholder: '95' },
      { key: 'coombs_dir', label: 'Coombs Directo / Indirecto', shortLabel: 'Coombs', unit: '', placeholder: 'Negativo' },
      { key: 'frotis_sp', label: 'Frotis de Sangre Periférica', shortLabel: 'Frotis SP', unit: '', placeholder: 'Normocítico normocrómico' },
    ],
  },
  {
    id: 'reuma_inmuno_serologia',
    name: 'Perfil Reumatológico, Inmunológico e Infeccioso / Cultivos',
    shortName: 'Inmuno / Reuma / Serología',
    category: 'Reumatología / Infectología',
    accentColor: '#059669',
    fields: [
      { key: 'ana', label: 'Anticuerpos Antinucleares (ANA)', shortLabel: 'ANA', unit: 'título', placeholder: 'Negativo / 1:160' },
      { key: 'anti_dna', label: 'Anti-dsDNA / Anti-Sm', shortLabel: 'Anti-DNA/Sm', unit: 'UI/mL', placeholder: 'Negativo' },
      { key: 'anca', label: 'c-ANCA (PR3) / p-ANCA (MPO)', shortLabel: 'ANCA', unit: '', placeholder: 'Negativo' },
      { key: 'factor_reuma', label: 'Factor Reumatoide (FR) / Anti-CCP', shortLabel: 'FR/Anti-CCP', unit: 'UI/mL', placeholder: 'Negativo' },
      { key: 'c3_c4', label: 'Complemento C3 y C4', shortLabel: 'C3/C4', unit: 'mg/dL', placeholder: 'C3 110 / C4 24' },
      { key: 'saf_perfil', label: 'Anticoag. Lúpico / Cardiolipinas / β2GP1', shortLabel: 'Perfil SAF', unit: '', placeholder: 'Negativo' },
      { key: 'igg_igm_iga', label: 'Inmunoglobulinas (IgG / IgA / IgM)', shortLabel: 'IgG/IgA/IgM', unit: 'mg/dL', placeholder: 'Normales' },
      { key: 'panel_viral', label: 'Panel Viral (VIH, VHC, HBsAg, VDRL)', shortLabel: 'Panel Viral', unit: '', placeholder: 'No reactivos' },
      { key: 'hemocultivos', label: 'Hemocultivos / Urocultivo / Cultivo Exp.', shortLabel: 'Cultivos', unit: '', placeholder: 'Sin desarrollo a las 48h' },
      { key: 'lcr_citoquimico', label: 'LCR / Líquido Ascítico / Pleural', shortLabel: 'Líquidos', unit: '', placeholder: 'Sin alteraciones' },
    ],
  },
];

/**
 * Helper to build a LabRecord from a dictionary of field values (key -> value string)
 */
export function buildLabRecordFromPanelInputs(
  values: Record<string, string>,
  selectedPanels: string[],
  date: string,
  time: string,
  notes: string,
  existingId?: string
): LabRecord {
  const record: LabRecord = {
    id: existingId || `lab-${Date.now()}`,
    date,
    time,
    selectedPanels,
    extraParams: {},
    notes: notes.trim() || undefined,
  };

  const extraParams: Record<string, LabExtraParamValue> = {};

  for (const panel of LAB_PANELS_CATALOG) {
    for (const field of panel.fields) {
      const rawVal = (values[field.key] || '').trim();
      if (!rawVal) continue;
      if (field.standardField) {
        (record as unknown as Record<string, string>)[field.standardField as string] = rawVal;
      } else {
        extraParams[field.key] = {
          label: field.shortLabel,
          value: rawVal,
          unit: field.unit,
          panel: panel.shortName,
        };
      }
    }
  }

  if (Object.keys(extraParams).length > 0) {
    record.extraParams = extraParams;
  }

  return record;
}
