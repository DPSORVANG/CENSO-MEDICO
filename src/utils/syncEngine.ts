import type { Patient, ClinicalNoteRecord, LabRecord, DiagnosticStudy, ClinicalPending, MedicationItem } from '../types/clinical.ts';
import type { BackupPackage } from './storage.ts';
import { generateAuditHash } from './clinicalLogic.ts';

export interface MergeStats {
  addedRemotePatients: number;
  addedLocalPatients: number;
  updatedPatients: number;
  addedNotes: number;
  totalPatients: number;
  totalNotes: number;
  timestamp: string;
}

export interface OfflineMutation {
  id: string;
  type: 'patient_created' | 'patient_updated' | 'patient_deleted' | 'lab_added' | 'study_added' | 'note_created';
  entityId: string;
  description: string;
  timestamp: string;
}

const MUTATIONS_STORAGE_KEY = 'resimed_offline_mutations_v1';
const LAST_SYNC_KEY = 'resimed_last_sync_timestamp_v1';

/**
 * Records a local mutation made while working (online or offline)
 */
export function recordOfflineMutation(
  type: OfflineMutation['type'],
  entityId: string,
  description: string
): void {
  try {
    const raw = localStorage.getItem(MUTATIONS_STORAGE_KEY);
    const mutations: OfflineMutation[] = raw ? JSON.parse(raw) : [];
    const newMutation: OfflineMutation = {
      id: 'mut_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      type,
      entityId,
      description,
      timestamp: new Date().toISOString(),
    };
    mutations.push(newMutation);
    localStorage.setItem(MUTATIONS_STORAGE_KEY, JSON.stringify(mutations));
  } catch (e) {
    console.warn('Could not record offline mutation:', e);
  }
}

/**
 * Gets the list of pending local mutations
 */
export function getPendingMutations(): OfflineMutation[] {
  try {
    const raw = localStorage.getItem(MUTATIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Clears the pending mutations queue after a successful merge & sync
 */
export function clearPendingMutations(): void {
  try {
    localStorage.removeItem(MUTATIONS_STORAGE_KEY);
  } catch (e) {
    console.warn('Could not clear mutations:', e);
  }
}

/**
 * Gets the last sync timestamp
 */
export function getLastSyncTime(): string | null {
  try {
    return localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

/**
 * Sets the last sync timestamp
 */
export function setLastSyncTime(timestamp: string): void {
  try {
    localStorage.setItem(LAST_SYNC_KEY, timestamp);
  } catch (e) {
    console.warn('Could not save last sync time:', e);
  }
}

/**
 * Merges labs from two patient records, preventing duplicates and keeping all unique reports
 */
export function mergeLabs(labsA: LabRecord[] = [], labsB: LabRecord[] = []): LabRecord[] {
  const map = new Map<string, LabRecord>();

  const getLabKey = (lab: LabRecord): string => {
    // Unique fingerprint: id if available, or normalized date+time
    return lab.id || `${lab.date}_${lab.time}_${lab.hb ?? ''}_${lab.glucosa ?? ''}_${lab.creatinina ?? ''}`;
  };

  // Add all from A
  for (const lab of labsA) {
    map.set(getLabKey(lab), lab);
  }

  // Add or update from B
  for (const lab of labsB) {
    const key = getLabKey(lab);
    if (!map.has(key)) {
      map.set(key, lab);
    } else {
      // Merge properties if one has more detail
      const existing = map.get(key)!;
      map.set(key, {
        ...existing,
        ...lab,
        // If either was marked new, preserve the new status until note integration
        isNew: existing.isNew || lab.isNew,
      });
    }
  }

  // Sort descending by date and time (most recent first)
  return Array.from(map.values()).sort((a, b) => {
    const timeA = `${a.date} ${a.time || '00:00'}`;
    const timeB = `${b.date} ${b.time || '00:00'}`;
    return timeB.localeCompare(timeA);
  });
}

/**
 * Merges diagnostic studies (TAC, USG, Cultivos, Rx) without losing any report
 */
export function mergeStudies(studiesA: DiagnosticStudy[] = [], studiesB: DiagnosticStudy[] = []): DiagnosticStudy[] {
  const map = new Map<string, DiagnosticStudy>();

  const getStudyKey = (st: DiagnosticStudy): string => {
    return st.id || `${st.category}_${st.title}_${st.date}`;
  };

  for (const s of studiesA) {
    map.set(getStudyKey(s), s);
  }

  for (const s of studiesB) {
    const key = getStudyKey(s);
    if (!map.has(key)) {
      map.set(key, s);
    } else {
      const existing = map.get(key)!;
      map.set(key, {
        ...existing,
        ...s,
        isNew: existing.isNew || s.isNew,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const timeA = `${a.date} ${a.time || '00:00'}`;
    const timeB = `${b.date} ${b.time || '00:00'}`;
    return timeB.localeCompare(timeA);
  });
}

/**
 * Merges medications list
 */
export function mergeMedications(medsA: MedicationItem[] = [], medsB: MedicationItem[] = []): MedicationItem[] {
  const map = new Map<string, MedicationItem>();

  const getMedKey = (m: MedicationItem): string => {
    return m.id || `${m.name.trim().toLowerCase()}_${m.route.trim().toLowerCase()}`;
  };

  for (const m of medsA) {
    map.set(getMedKey(m), m);
  }

  for (const m of medsB) {
    const key = getMedKey(m);
    if (!map.has(key)) {
      map.set(key, m);
    } else {
      // If either updated active status or days, prefer the one with more recent start date or active
      const existing = map.get(key)!;
      map.set(key, {
        ...existing,
        ...m,
        active: m.active ?? existing.active,
      });
    }
  }

  return Array.from(map.values());
}

/**
 * Merges clinical pendings
 */
export function mergePendings(pendA: ClinicalPending[] = [], pendB: ClinicalPending[] = []): ClinicalPending[] {
  const map = new Map<string, ClinicalPending>();

  const getPendingKey = (p: ClinicalPending): string => {
    return p.id || p.text.trim().toLowerCase();
  };

  for (const p of pendA) {
    map.set(getPendingKey(p), p);
  }

  for (const p of pendB) {
    const key = getPendingKey(p);
    if (!map.has(key)) {
      map.set(key, p);
    } else {
      // If one is completed, keep it completed
      const existing = map.get(key)!;
      map.set(key, {
        ...existing,
        ...p,
        completed: existing.completed || p.completed,
      });
    }
  }

  return Array.from(map.values());
}

/**
 * Merges two patient objects representing the same patient
 */
export function mergeSinglePatient(patientA: Patient, patientB: Patient): Patient {
  const dateA = new Date(patientA.lastUpdated || patientA.admissionDate || 0).getTime();
  const dateB = new Date(patientB.lastUpdated || patientB.admissionDate || 0).getTime();
  const mostRecent = dateB > dateA ? patientB : patientA;
  const other = dateB > dateA ? patientA : patientB;

  // Merge tags without duplicates
  const allTags = Array.from(
    new Set([...(patientA.clinicalTags || []), ...(patientB.clinicalTags || [])])
  );

  // Merge diagnoses without duplicates (ignoring leading numbering)
  const diagSeen = new Set<string>();
  const mergedDiagnoses: string[] = [];
  for (const d of [...patientA.diagnoses, ...patientB.diagnoses]) {
    const norm = d.replace(/^\d+[\.\)]\s*/, '').trim().toLowerCase();
    if (!diagSeen.has(norm)) {
      diagSeen.add(norm);
      mergedDiagnoses.push(d);
    }
  }

  return {
    ...mostRecent,
    // Preserve merged collections so nothing is lost from either workstation
    diagnoses: mergedDiagnoses.length > 0 ? mergedDiagnoses : mostRecent.diagnoses,
    labs: mergeLabs(patientA.labs, patientB.labs),
    studies: mergeStudies(patientA.studies, patientB.studies),
    medications: mergeMedications(patientA.medications, patientB.medications),
    pendings: mergePendings(patientA.pendings, patientB.pendings),
    clinicalTags: allTags,
    clinicalHistory: mostRecent.clinicalHistory || other.clinicalHistory,
    allergies:
      mostRecent.allergies && mostRecent.allergies !== 'Negadas'
        ? mostRecent.allergies
        : other.allergies || mostRecent.allergies,
    lastUpdated: new Date(Math.max(dateA, dateB, Date.now())).toISOString(),
  };
}

/**
 * Core Bidirectional Census Reconciliation Engine:
 * Smartly merges Local (offline) data with Remote (Google Drive) data.
 * - Distinct patients added on either side are all included (zero patients lost).
 * - Shared patients are reconciled with merged labs, studies, medications, tags, and diagnoses.
 * - Historical clinical notes are unioned by audit hash / ID (zero notes lost).
 */
export function mergeCensusData(
  localData: BackupPackage,
  remoteData: BackupPackage,
  residentAuthor: string = 'Residente Medicina Interna'
): { merged: BackupPackage; stats: MergeStats } {
  const localPatients = localData.patients || [];
  const remotePatients = remoteData.patients || [];

  const localNotes = localData.notes || [];
  const remoteNotes = remoteData.notes || [];

  let addedRemotePatients = 0;
  let addedLocalPatients = 0;
  let updatedPatients = 0;

  // Index remote patients by ID and recordNumber
  const remoteById = new Map<string, Patient>();
  const remoteByRecord = new Map<string, Patient>();

  for (const rp of remotePatients) {
    if (rp.id) remoteById.set(rp.id, rp);
    if (rp.recordNumber) remoteByRecord.set(rp.recordNumber.trim().toLowerCase(), rp);
  }

  const mergedPatientsMap = new Map<string, Patient>();
  const matchedRemoteIds = new Set<string>();

  // Process all local patients
  for (const lp of localPatients) {
    const recordKey = lp.recordNumber ? lp.recordNumber.trim().toLowerCase() : '';
    const match = (lp.id ? remoteById.get(lp.id) : null) || (recordKey ? remoteByRecord.get(recordKey) : null);

    if (match) {
      // Patient exists on both sides: merge fields intelligently
      matchedRemoteIds.add(match.id);
      const mergedP = mergeSinglePatient(lp, match);
      mergedPatientsMap.set(mergedP.id, mergedP);
      updatedPatients++;
    } else {
      // Patient exists ONLY locally (e.g. admitted on this computer while offline)
      mergedPatientsMap.set(lp.id, lp);
      addedLocalPatients++;
    }
  }

  // Process remote patients that were not in local storage
  for (const rp of remotePatients) {
    if (!matchedRemoteIds.has(rp.id) && !mergedPatientsMap.has(rp.id)) {
      // Patient was admitted on another workstation
      mergedPatientsMap.set(rp.id, rp);
      addedRemotePatients++;
    }
  }

  const mergedPatients = Array.from(mergedPatientsMap.values());

  // Merge Notes: Historical immutable records unioned by ID or auditHash
  const notesMap = new Map<string, ClinicalNoteRecord>();
  let addedNotes = 0;

  for (const n of localNotes) {
    const key = n.id || n.auditHash;
    notesMap.set(key, n);
  }

  for (const n of remoteNotes) {
    const key = n.id || n.auditHash;
    if (!notesMap.has(key)) {
      notesMap.set(key, n);
      addedNotes++;
    }
  }

  const mergedNotes = Array.from(notesMap.values()).sort(
    (a, b) => (b.createdAtTimestamp || 0) - (a.createdAtTimestamp || 0)
  );

  const now = new Date().toISOString();
  const mergedPackage: BackupPackage = {
    version: '1.1.0',
    exportDate: now,
    residentAuthor,
    patients: mergedPatients,
    notes: mergedNotes,
    integrityHash: generateAuditHash('CENSUS-SMART-MERGE', now, `${mergedPatients.length}:${mergedNotes.length}`),
  };

  const stats: MergeStats = {
    addedRemotePatients,
    addedLocalPatients,
    updatedPatients,
    addedNotes,
    totalPatients: mergedPatients.length,
    totalNotes: mergedNotes.length,
    timestamp: now,
  };

  return { merged: mergedPackage, stats };
}
