import type { Patient, ClinicalNoteRecord, ResidentProfile } from '../types/clinical.ts';
import { seedPatients, seedNotes, defaultResidentProfile } from '../data/seedPatients.ts';
import { generateAuditHash, purgeExpiredDischargedPatients } from './clinicalLogic.ts';

const ACTIVE_NAMESPACE_KEY = 'resimed_active_account_ns_v2';
const PIN_KEY = 'resimed_pin_hash_v1';

export function getActiveAccountNamespace(): string {
  try {
    return localStorage.getItem(ACTIVE_NAMESPACE_KEY) || 'local';
  } catch {
    return 'local';
  }
}

export function setActiveAccountNamespace(accountEmailOrMode: string): void {
  try {
    const clean = (accountEmailOrMode || 'local').trim().toLowerCase();
    localStorage.setItem(ACTIVE_NAMESPACE_KEY, clean);
  } catch (e) {
    console.error('Error setting account namespace:', e);
  }
}

function getScopedKey(base: string): string {
  const ns = getActiveAccountNamespace();
  if (ns === 'demo') {
    return `resimed_demo_${base}_v2`;
  }
  if (ns === 'local') {
    return `resimed_local_${base}_v2`;
  }
  const safeNs = ns.replace(/[^a-z0-9@._-]/gi, '_');
  return `resimed_acct_${safeNs}_${base}_v2`;
}

export function loadDeletedPatients(): Record<string, string> {
  try {
    const raw = localStorage.getItem(getScopedKey('deleted_patients'));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveDeletedPatients(deletedMap: Record<string, string>): void {
  try {
    localStorage.setItem(getScopedKey('deleted_patients'), JSON.stringify(deletedMap));
  } catch (e) {
    console.error('Error saving deleted patients tombstones:', e);
  }
}

export function recordDeletedPatient(
  patientId: string,
  recordNumber?: string,
  deletedAt: string = new Date().toISOString()
): Record<string, string> {
  const current = loadDeletedPatients();
  if (patientId) {
    current[patientId] = deletedAt;
  }
  if (recordNumber && recordNumber.trim()) {
    current[`rec:${recordNumber.trim().toLowerCase()}`] = deletedAt;
  }
  saveDeletedPatients(current);
  return current;
}

export function unmarkDeletedPatient(patientId: string, recordNumber?: string): void {
  const current = loadDeletedPatients();
  let changed = false;
  if (patientId && current[patientId]) {
    delete current[patientId];
    changed = true;
  }
  if (recordNumber && recordNumber.trim()) {
    const recKey = `rec:${recordNumber.trim().toLowerCase()}`;
    if (current[recKey]) {
      delete current[recKey];
      changed = true;
    }
  }
  if (changed) {
    saveDeletedPatients(current);
  }
}

export function isPatientDeletedByTombstone(
  pt: Pick<Patient, 'id' | 'recordNumber' | 'lastUpdated'>,
  tombstones: Record<string, string>
): boolean {
  const delById = pt.id ? tombstones[pt.id] : undefined;
  const recKey = pt.recordNumber ? `rec:${pt.recordNumber.trim().toLowerCase()}` : undefined;
  const delByRec = recKey ? tombstones[recKey] : undefined;
  const deletedAtStr = delById || delByRec;
  if (!deletedAtStr) return false;

  const deletedTime = new Date(deletedAtStr).getTime();
  if (isNaN(deletedTime)) return true;

  if (pt.lastUpdated) {
    const updatedTime = new Date(pt.lastUpdated).getTime();
    // Only allow a patient to survive a tombstone if it was explicitly re-admitted AFTER the deletion timestamp
    if (!isNaN(updatedTime) && updatedTime > deletedTime + 2000) {
      return false;
    }
  }
  return true;
}

const SEED_PATIENT_BY_ID = new Map<string, Patient>(seedPatients.map((sp) => [sp.id, sp]));

export function normalizePatientRecord(pt: Patient): Patient {
  const normalizedNursingOrders = Array.isArray(pt.nursingOrders)
    ? pt.nursingOrders
    : typeof pt.nursingOrders === 'string'
    ? (pt.nursingOrders as string)
        .split('\n')
        .map((s) => s.replace(/^[•\-*\d.)\s]+/, '').trim())
        .filter(Boolean)
    : undefined;
  const normalizedDiagnoses = Array.isArray(pt.diagnoses)
    ? pt.diagnoses
    : typeof pt.diagnoses === 'string'
    ? (pt.diagnoses as string)
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    : ['1. Protocolo de estudio Medicina Interna'];
  const normalizedInitialDiagnoses = Array.isArray(pt.initialDiagnoses)
    ? pt.initialDiagnoses
    : typeof pt.initialDiagnoses === 'string'
    ? (pt.initialDiagnoses as string)
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    : normalizedDiagnoses;

  // Backfill longitudinal multi-panel lab values for seed patients if their stored labs predated the multi-panel upgrade
  const seedRef = SEED_PATIENT_BY_ID.get(pt.id);
  let normalizedLabs = Array.isArray(pt.labs) ? pt.labs : [];
  if (seedRef && seedRef.labs && seedRef.labs.length > 0) {
    const seedLabById = new Map(seedRef.labs.map((l) => [l.id, l]));
    normalizedLabs = normalizedLabs.map((l) => {
      const seedLab = seedLabById.get(l.id);
      if (!seedLab) return l;
      return {
        ...seedLab,
        ...Object.fromEntries(
          Object.entries(l).filter(([, v]) => v !== undefined && v !== null && v !== '')
        ),
      };
    });
    // For p-104 which previously only had 1 seed lab ('lab-401'), ensure 'lab-402' is also present if unmodified
    if (
      pt.id === 'p-104' &&
      normalizedLabs.length === 1 &&
      normalizedLabs[0].id === 'lab-401' &&
      seedRef.labs.length >= 2
    ) {
      normalizedLabs = seedRef.labs;
    }
  }

  return {
    ...pt,
    diagnoses: normalizedDiagnoses,
    initialDiagnoses: normalizedInitialDiagnoses,
    nursingOrders: normalizedNursingOrders,
    labs: normalizedLabs,
    medications: (pt.medications || []).map((m) =>
      m.id === 'm-203' && m.isLimitedCourse === undefined
        ? {
            ...m,
            isLimitedCourse: true,
            plannedDays: m.plannedDays || 5,
            indication: m.indication || 'Curso corto esteroide por EPOC agudizado',
          }
        : m
    ),
  };
}

export function loadPatients(): Patient[] {
  try {
    const ns = getActiveAccountNamespace();
    const key = getScopedKey('patients');
    const raw = localStorage.getItem(key);
    const tombstones = loadDeletedPatients();

    if (!raw) {
      // ONLY populate seedPatients if the user explicitly chose 'demo' mode.
      // Institutional Google Drive accounts and clean local workspaces start with 0 patients ([]).
      if (ns === 'demo') {
        const initialDemo = seedPatients.filter(
          (pt) => !isPatientDeletedByTombstone(pt, tombstones)
        );
        savePatients(initialDemo);
        return initialDemo;
      }
      savePatients([]);
      return [];
    }

    const parsed = JSON.parse(raw);
    const rawList: Patient[] = Array.isArray(parsed) ? parsed : [];
    const filteredList = rawList.filter((pt) => !isPatientDeletedByTombstone(pt, tombstones));
    const list: Patient[] = filteredList.map(normalizePatientRecord);

    // Auto-purge discharged patients older than 5 days to optimize storage
    const notesKey = getScopedKey('notes');
    const rawNotes = localStorage.getItem(notesKey);
    const parsedNotes: ClinicalNoteRecord[] = rawNotes ? JSON.parse(rawNotes) : [];
    const { keptPatients, keptNotes, purgedPatientCount } = purgeExpiredDischargedPatients(
      list,
      Array.isArray(parsedNotes) ? parsedNotes : [],
      5
    );
    if (purgedPatientCount > 0) {
      savePatients(keptPatients);
      saveNotes(keptNotes);
    }
    return keptPatients;
  } catch (e) {
    console.error('Error loading patients from storage:', e);
    return [];
  }
}

export function savePatients(patients: Patient[]): void {
  try {
    localStorage.setItem(getScopedKey('patients'), JSON.stringify(patients));
  } catch (e) {
    console.error('Error saving patients to storage:', e);
  }
}

export function loadNotes(): ClinicalNoteRecord[] {
  try {
    const ns = getActiveAccountNamespace();
    const key = getScopedKey('notes');
    const raw = localStorage.getItem(key);
    if (!raw) {
      if (ns === 'demo') {
        saveNotes(seedNotes);
        return seedNotes;
      }
      saveNotes([]);
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error loading notes from storage:', e);
    return [];
  }
}

export function saveNotes(notes: ClinicalNoteRecord[]): void {
  try {
    localStorage.setItem(getScopedKey('notes'), JSON.stringify(notes));
  } catch (e) {
    console.error('Error saving notes to storage:', e);
  }
}

export function loadProfile(): ResidentProfile {
  try {
    const raw = localStorage.getItem(getScopedKey('profile'));
    if (!raw) {
      saveProfile(defaultResidentProfile);
      return defaultResidentProfile;
    }
    return JSON.parse(raw);
  } catch {
    return defaultResidentProfile;
  }
}

export function saveProfile(profile: ResidentProfile): void {
  try {
    localStorage.setItem(getScopedKey('profile'), JSON.stringify(profile));
  } catch (e) {
    console.error('Error saving profile:', e);
  }
}

export function resetDemoDataInCurrentNamespace(): void {
  saveDeletedPatients({});
  savePatients(seedPatients);
  saveNotes(seedNotes);
}

export function clearAllPatientsInCurrentNamespace(): Record<string, string> {
  const currentPatients = loadPatients();
  const now = new Date().toISOString();
  const tombstones = loadDeletedPatients();
  for (const p of currentPatients) {
    if (p.id) tombstones[p.id] = now;
    if (p.recordNumber) tombstones[`rec:${p.recordNumber.trim().toLowerCase()}`] = now;
  }
  saveDeletedPatients(tombstones);
  savePatients([]);
  return tombstones;
}

export function getStoredPinHash(): string | null {
  return localStorage.getItem(PIN_KEY);
}

export function setStoredPin(pin: string): void {
  if (!pin) {
    localStorage.removeItem(PIN_KEY);
    return;
  }
  const hash = generateAuditHash('RESIDENT-PIN', 'LOCK-SALT', pin);
  localStorage.setItem(PIN_KEY, hash);
}

export function verifyStoredPin(enteredPin: string): boolean {
  const currentHash = getStoredPinHash();
  if (!currentHash) {
    return enteredPin === '1234';
  }
  const testHash = generateAuditHash('RESIDENT-PIN', 'LOCK-SALT', enteredPin);
  return currentHash === testHash;
}

export interface BackupPackage {
  version: string;
  exportDate: string;
  residentAuthor: string;
  patients: Patient[];
  notes: ClinicalNoteRecord[];
  deletedPatientIds?: Record<string, string>;
  profile?: ResidentProfile;
  integrityHash: string;
}

export function exportFullBackup(): string {
  const patients = loadPatients();
  const notes = loadNotes();
  const profile = loadProfile();
  const deletedPatientIds = loadDeletedPatients();
  const now = new Date().toISOString();

  const updatedProfile: ResidentProfile = {
    ...profile,
    lastBackupTimestamp: Date.now(),
  };
  saveProfile(updatedProfile);

  const backupData: BackupPackage = {
    version: '2.0.0',
    exportDate: now,
    residentAuthor: profile.name,
    patients,
    notes,
    deletedPatientIds,
    profile: updatedProfile,
    integrityHash: generateAuditHash('BACKUP-VAULT', now, `${patients.length}:${notes.length}`),
  };

  return JSON.stringify(backupData, null, 2);
}

export function importFullBackup(jsonString: string): {
  success: boolean;
  message: string;
  patientsCount?: number;
  notesCount?: number;
} {
  try {
    const data: BackupPackage = JSON.parse(jsonString);
    if (!data.patients || !Array.isArray(data.patients)) {
      return {
        success: false,
        message: 'El archivo de respaldo no contiene datos de pacientes válidos.',
      };
    }

    if (data.deletedPatientIds && typeof data.deletedPatientIds === 'object') {
      const mergedTombstones = { ...loadDeletedPatients(), ...data.deletedPatientIds };
      saveDeletedPatients(mergedTombstones);
    }

    const activeTombstones = loadDeletedPatients();
    const nonDeletedPatients = data.patients
      .filter((pt) => !isPatientDeletedByTombstone(pt, activeTombstones))
      .map(normalizePatientRecord);

    const { keptPatients, keptNotes } = purgeExpiredDischargedPatients(
      nonDeletedPatients,
      Array.isArray(data.notes) ? data.notes : [],
      5
    );

    savePatients(keptPatients);
    if (keptNotes && Array.isArray(keptNotes)) {
      saveNotes(keptNotes);
    }

    const prof = data.profile ? { ...loadProfile(), ...data.profile } : loadProfile();
    saveProfile({ ...prof, lastBackupTimestamp: Date.now() });

    return {
      success: true,
      message: `Respaldo restaurado exitosamente: ${keptPatients.length} pacientes y ${(keptNotes || []).length} notas históricas recuperadas.`,
      patientsCount: keptPatients.length,
      notesCount: (keptNotes || []).length,
    };
  } catch (e: any) {
    return { success: false, message: `Error al procesar el archivo JSON: ${e.message}` };
  }
}
