import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeCensusData, mergeSinglePatient } from './syncEngine.ts';
import type { Patient, ClinicalNoteRecord, LabRecord, DiagnosticStudy } from '../types/clinical.ts';
import type { BackupPackage } from './storage.ts';

describe('ResiMed MI Offline / Online Smart Merge Engine', () => {
  it('preserves distinct patients added on different workstations independently', () => {
    const localPatient: Patient = {
      id: 'pat_local_1',
      recordNumber: 'EXP-101',
      name: 'García Pérez Juan',
      age: 65,
      gender: 'Masculino',
      bed: 'Cama 301',
      service: 'Medicina Interna Piso 3',
      admissionDate: '2026-10-22',
      status: 'active',
      severity: 'Delicado',
      codeStatus: 'RCP 1 (Reanimación Completa / Todo esfuerzo)',
      allergies: 'Negadas',
      diagnoses: ['1. Falla cardíaca descompensada'],
      vitals: { bp: '130/80', hr: '82', rr: '18', temp: '36.5', spo2: '94' },
      medications: [],
      labs: [],
      pendings: [],
      lastUpdated: '2026-10-23T14:00:00.000Z',
    };

    const remotePatient: Patient = {
      id: 'pat_remote_2',
      recordNumber: 'EXP-202',
      name: 'López Hernández María',
      age: 72,
      gender: 'Femenino',
      bed: 'Cama 302',
      service: 'Medicina Interna Piso 3',
      admissionDate: '2026-10-23',
      status: 'active',
      severity: 'Grave',
      codeStatus: 'RCP 3 (No Reanimación / Voluntad Anticipada / Paliativo)',
      allergies: 'Penicilinas',
      diagnoses: ['1. Choque séptico foco pulmonar'],
      vitals: { bp: '90/60', hr: '105', rr: '24', temp: '38.2', spo2: '90' },
      medications: [],
      labs: [],
      pendings: [],
      lastUpdated: '2026-10-23T15:00:00.000Z',
    };

    const localPkg: BackupPackage = {
      version: '1.0.0',
      exportDate: '2026-10-23T14:00:00.000Z',
      residentAuthor: 'Dr. Local',
      patients: [localPatient],
      notes: [],
      integrityHash: 'hash_local',
    };

    const remotePkg: BackupPackage = {
      version: '1.0.0',
      exportDate: '2026-10-23T15:00:00.000Z',
      residentAuthor: 'Dr. Remote',
      patients: [remotePatient],
      notes: [],
      integrityHash: 'hash_remote',
    };

    const { merged, stats } = mergeCensusData(localPkg, remotePkg);

    assert.equal(merged.patients.length, 2);
    assert.equal(stats.totalPatients, 2);
    assert.equal(stats.addedLocalPatients, 1);
    assert.equal(stats.addedRemotePatients, 1);
    assert.ok(merged.patients.some((p) => p.id === 'pat_local_1'));
    assert.ok(merged.patients.some((p) => p.id === 'pat_remote_2'));
  });

  it('unifies independent modifications to the same patient (e.g. labs on one station and CT on another)', () => {
    const labItem: LabRecord = {
      id: 'lab_1',
      date: '2026-10-23',
      time: '07:00',
      hb: 12.5,
      leucos: 9500,
      creatinina: 1.1,
      isNew: true,
    };

    const studyItem: DiagnosticStudy = {
      id: 'study_1',
      date: '2026-10-23',
      time: '11:00',
      category: 'TAC',
      title: 'TAC de Tórax',
      summary: 'Infiltrado basal derecho',
      isNew: true,
    };

    const patientLocal: Patient = {
      id: 'patient_common',
      recordNumber: 'EXP-555',
      name: 'Ramírez Morales Roberto',
      age: 67,
      gender: 'Masculino',
      bed: 'Cama 312',
      service: 'Medicina Interna Piso 3',
      admissionDate: '2026-10-20',
      status: 'active',
      severity: 'Delicado',
      codeStatus: 'RCP 1 (Reanimación Completa / Todo esfuerzo)',
      allergies: 'Negadas',
      diagnoses: ['1. Neumonía bacteriana'],
      clinicalTags: ['CVC'],
      vitals: { bp: '120/80', hr: '78', rr: '18', temp: '36.8', spo2: '96' },
      medications: [],
      labs: [labItem], // Added locally offline
      studies: [],
      pendings: [],
      lastUpdated: '2026-10-23T12:00:00.000Z',
    };

    const patientRemote: Patient = {
      id: 'patient_common',
      recordNumber: 'EXP-555',
      name: 'Ramírez Morales Roberto',
      age: 67,
      gender: 'Masculino',
      bed: 'Cama 312',
      service: 'Medicina Interna Piso 3',
      admissionDate: '2026-10-20',
      status: 'active',
      severity: 'Delicado',
      codeStatus: 'RCP 1 (Reanimación Completa / Todo esfuerzo)',
      allergies: 'Negadas',
      diagnoses: ['1. Neumonía bacteriana', '2. Derrame pleural paraneumónico'],
      clinicalTags: ['CVC', 'Sonda Foley'],
      vitals: { bp: '120/80', hr: '78', rr: '18', temp: '36.8', spo2: '96' },
      medications: [],
      labs: [],
      studies: [studyItem], // Added remotely on another computer
      pendings: [],
      lastUpdated: '2026-10-23T12:30:00.000Z',
    };

    const merged = mergeSinglePatient(patientLocal, patientRemote);

    // Patient should have BOTH the lab and the study
    assert.equal(merged.labs.length, 1);
    assert.equal(merged.labs[0].id, 'lab_1');
    assert.equal(merged.studies?.length, 1);
    assert.equal(merged.studies[0].id, 'study_1');

    // Tags should be unioned without duplicates
    assert.equal(merged.clinicalTags?.length, 2);
    assert.ok(merged.clinicalTags?.includes('CVC'));
    assert.ok(merged.clinicalTags?.includes('Sonda Foley'));

    // Diagnoses should be unified
    assert.equal(merged.diagnoses.length, 2);
  });

  it('unions clinical note records so no historical legal note is ever lost', () => {
    const noteLocal: ClinicalNoteRecord = {
      id: 'note_1',
      patientId: 'pat_1',
      patientName: 'García Juan',
      bed: 'Cama 301',
      service: 'Medicina Interna Piso 3',
      date: '2026-10-23',
      time: '08:00',
      noteType: 'Nota de Evolución',
      content: 'Contenido nota local 1',
      auditHash: 'hash_1',
      residentAuthor: 'Dr. A',
      createdAtTimestamp: 1000,
    };

    const noteRemote: ClinicalNoteRecord = {
      id: 'note_2',
      patientId: 'pat_2',
      patientName: 'López María',
      bed: 'Cama 302',
      service: 'Medicina Interna Piso 3',
      date: '2026-10-23',
      time: '09:00',
      noteType: 'Nota de Ingreso',
      content: 'Contenido nota remota 2',
      auditHash: 'hash_2',
      residentAuthor: 'Dr. B',
      createdAtTimestamp: 2000,
    };

    const localPkg: BackupPackage = {
      version: '1.0.0',
      exportDate: '2026-10-23T08:00:00.000Z',
      residentAuthor: 'Dr. A',
      patients: [],
      notes: [noteLocal],
      integrityHash: 'h1',
    };

    const remotePkg: BackupPackage = {
      version: '1.0.0',
      exportDate: '2026-10-23T09:00:00.000Z',
      residentAuthor: 'Dr. B',
      patients: [],
      notes: [noteRemote],
      integrityHash: 'h2',
    };

    const { merged, stats } = mergeCensusData(localPkg, remotePkg);

    assert.equal(merged.notes.length, 2);
    assert.equal(stats.addedNotes, 1);
    assert.ok(merged.notes.some((n) => n.id === 'note_1'));
    assert.ok(merged.notes.some((n) => n.id === 'note_2'));
  });

  it('honors deletion tombstones (deletedPatientIds) so deleted patients never resurrect from other computers', () => {
    const keptPatient: Patient = {
      id: 'pat_keep_1',
      recordNumber: 'EXP-901',
      name: 'Méndez Soto Carlos',
      age: 58,
      gender: 'Masculino',
      bed: 'Cama 305',
      service: 'Medicina Interna Piso 3',
      admissionDate: '2026-10-20',
      status: 'active',
      severity: 'Estable',
      codeStatus: 'RCP 1 (Reanimación Completa / Todo esfuerzo)',
      allergies: 'Negadas',
      diagnoses: ['1. Infección de vías urinarias'],
      vitals: { bp: '120/75', hr: '72', rr: '16', temp: '36.6', spo2: '97' },
      medications: [],
      labs: [],
      pendings: [],
      lastUpdated: '2026-10-25T10:00:00.000Z',
    };

    const deletedPatientStillOnOtherPC: Patient = {
      id: 'pat_deleted_2',
      recordNumber: 'EXP-902',
      name: 'Paciente Eliminado en PC 1',
      age: 64,
      gender: 'Femenino',
      bed: 'Cama 306',
      service: 'Medicina Interna Piso 3',
      admissionDate: '2026-10-19',
      status: 'active',
      severity: 'Estable',
      codeStatus: 'RCP 1 (Reanimación Completa / Todo esfuerzo)',
      allergies: 'Negadas',
      diagnoses: ['1. Alta / Registro eliminado'],
      vitals: { bp: '120/80', hr: '75', rr: '18', temp: '36.5', spo2: '96' },
      medications: [],
      labs: [],
      pendings: [],
      lastUpdated: '2026-10-25T09:00:00.000Z',
    };

    // PC 1 deleted pat_deleted_2 at 12:00:00Z, so PC 1 only has keptPatient and a tombstone for pat_deleted_2
    const pc1Package: BackupPackage = {
      version: '1.1.0',
      exportDate: '2026-10-25T12:05:00.000Z',
      residentAuthor: 'PC 1',
      patients: [keptPatient],
      notes: [],
      deletedPatientIds: {
        pat_deleted_2: '2026-10-25T12:00:00.000Z',
        'rec:exp-902': '2026-10-25T12:00:00.000Z',
      },
      integrityHash: 'h_pc1',
    };

    // PC 2 (or Drive) still had both keptPatient and deletedPatientStillOnOtherPC
    const pc2Package: BackupPackage = {
      version: '1.1.0',
      exportDate: '2026-10-25T11:30:00.000Z',
      residentAuthor: 'PC 2',
      patients: [keptPatient, deletedPatientStillOnOtherPC],
      notes: [],
      integrityHash: 'h_pc2',
    };

    const { merged, stats } = mergeCensusData(pc1Package, pc2Package);

    // pat_deleted_2 MUST NOT be resurrected!
    assert.equal(merged.patients.length, 1);
    assert.equal(merged.patients[0].id, 'pat_keep_1');
    assert.ok(!merged.patients.some((p) => p.id === 'pat_deleted_2'));
    assert.equal(stats.deletedPatientsCount, 1);
    assert.equal(merged.deletedPatientIds?.['pat_deleted_2'], '2026-10-25T12:00:00.000Z');
  });
});
