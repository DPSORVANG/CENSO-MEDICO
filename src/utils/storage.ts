import type { Patient, ClinicalNoteRecord, ResidentProfile } from '../types/clinical.ts';
import { seedPatients, seedNotes, defaultResidentProfile } from '../data/seedPatients.ts';
import { generateAuditHash, purgeExpiredDischargedPatients } from './clinicalLogic.ts';

const PATIENTS_KEY = 'resimed_patients_v1';
const NOTES_KEY = 'resimed_notes_v1';
const PROFILE_KEY = 'resimed_profile_v1';
const PIN_KEY = 'resimed_pin_hash_v1';

export function loadPatients(): Patient[] {
  try {
    const raw = localStorage.getItem(PATIENTS_KEY);
    if (!raw) {
      savePatients(seedPatients);
      return seedPatients;
    }
    const parsed = JSON.parse(raw);
    const rawList: Patient[] = Array.isArray(parsed) && parsed.length > 0 ? parsed : seedPatients;
    const list: Patient[] = rawList.map((pt) => {
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

      return {
        ...pt,
        diagnoses: normalizedDiagnoses,
        initialDiagnoses: normalizedInitialDiagnoses,
        nursingOrders: normalizedNursingOrders,
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
    });

    // Auto-purge discharged patients older than 5 days to optimize storage
    const rawNotes = localStorage.getItem(NOTES_KEY);
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
    return seedPatients;
  }
}

export function savePatients(patients: Patient[]): void {
  try {
    localStorage.setItem(PATIENTS_KEY, JSON.stringify(patients));
  } catch (e) {
    console.error('Error saving patients to storage:', e);
  }
}

export function loadNotes(): ClinicalNoteRecord[] {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (!raw) {
      saveNotes(seedNotes);
      return seedNotes;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : seedNotes;
  } catch (e) {
    console.error('Error loading notes from storage:', e);
    return seedNotes;
  }
}

export function saveNotes(notes: ClinicalNoteRecord[]): void {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  } catch (e) {
    console.error('Error saving notes to storage:', e);
  }
}

export function loadProfile(): ResidentProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) {
      saveProfile(defaultResidentProfile);
      return defaultResidentProfile;
    }
    return JSON.parse(raw);
  } catch (e) {
    return defaultResidentProfile;
  }
}

export function saveProfile(profile: ResidentProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error('Error saving profile:', e);
  }
}

export function getStoredPinHash(): string | null {
  return localStorage.getItem(PIN_KEY);
}

export function setStoredPin(pin: string): void {
  if (!pin) {
    localStorage.removeItem(PIN_KEY);
    return;
  }
  // Simple deterministic client hash for resident PIN lock
  const hash = generateAuditHash('RESIDENT-PIN', 'LOCK-SALT', pin);
  localStorage.setItem(PIN_KEY, hash);
}

export function verifyStoredPin(enteredPin: string): boolean {
  const currentHash = getStoredPinHash();
  if (!currentHash) {
    // PIN maestro por defecto (1234) en estaciones hospitalarias hasta que el administrador defina el suyo
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
  integrityHash: string;
}

export function exportFullBackup(): string {
  const patients = loadPatients();
  const notes = loadNotes();
  const profile = loadProfile();
  const now = new Date().toISOString();

  // Record backup timestamp for 24-hour alert badge
  const updatedProfile: ResidentProfile = {
    ...profile,
    lastBackupTimestamp: Date.now(),
  };
  saveProfile(updatedProfile);

  const backupData: BackupPackage = {
    version: '1.0.0',
    exportDate: now,
    residentAuthor: profile.name,
    patients,
    notes,
    integrityHash: generateAuditHash('BACKUP-VAULT', now, `${patients.length}:${notes.length}`),
  };

  return JSON.stringify(backupData, null, 2);
}

export function importFullBackup(jsonString: string): { success: boolean; message: string; patientsCount?: number; notesCount?: number } {
  try {
    const data: BackupPackage = JSON.parse(jsonString);
    if (!data.patients || !Array.isArray(data.patients)) {
      return { success: false, message: 'El archivo de respaldo no contiene datos de pacientes válidos.' };
    }

    const { keptPatients, keptNotes } = purgeExpiredDischargedPatients(
      data.patients,
      Array.isArray(data.notes) ? data.notes : [],
      5
    );

    savePatients(keptPatients);
    if (keptNotes && Array.isArray(keptNotes)) {
      saveNotes(keptNotes);
    }

    const prof = loadProfile();
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
