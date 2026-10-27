import React, { useState } from 'react';
import {
  ShieldCheck,
  Download,
  Upload,
  Lock,
  Search,
  Copy,
  Check,
  FileCheck,
  Cloud,
  ShieldAlert,
} from 'lucide-react';
import { ClinicalNoteRecord, ResidentProfile, Patient } from '../types/clinical.ts';
import {
  exportFullBackup,
  importFullBackup,
  setStoredPin,
  getStoredPinHash,
} from '../utils/storage.ts';
import { InfoPopover } from './InfoPopover.tsx';

interface BackupVaultModalProps {
  notes: ClinicalNoteRecord[];
  patients: Patient[];
  profile: ResidentProfile;
  isAdmin?: boolean;
  onRequestAdminMode?: () => void;
  onUpdateProfile: (profile: ResidentProfile) => void;
  onReloadData: () => void;
  onOpenDriveSync?: () => void;
}

export const BackupVaultModal: React.FC<BackupVaultModalProps> = ({
  notes,
  patients,
  profile,
  isAdmin = true,
  onRequestAdminMode,
  onUpdateProfile,
  onReloadData,
  onOpenDriveSync,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // PIN settings
  const [newPin, setNewPin] = useState('');
  const [pinSaved, setPinSaved] = useState(false);
  const hasPin = Boolean(getStoredPinHash());

  const handleUpdatePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setStoredPin(newPin.trim());
    setNewPin('');
    setPinSaved(true);
    setTimeout(() => setPinSaved(false), 2500);
  };

  const handleExportBackup = () => {
    const jsonStr = exportFullBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `ResiMed-Respaldo-${today}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onUpdateProfile({
      ...profile,
      lastBackupTimestamp: Date.now(),
    });
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const result = importFullBackup(text);
        setImportStatus(result);
        if (result.success) {
          onReloadData();
        }
      }
    };
    reader.readAsText(file);
  };

  const handleCopyNote = async (note: ClinicalNoteRecord) => {
    await navigator.clipboard.writeText(note.content);
    setCopiedId(note.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const filteredNotes = notes.filter((n) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      n.patientName.toLowerCase().includes(term) ||
      n.bed.toLowerCase().includes(term) ||
      n.noteType.toLowerCase().includes(term) ||
      n.content.toLowerCase().includes(term) ||
      n.residentAuthor.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-5">
      {/* Clean Header Bar */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-teal-500/20 text-teal-400 border border-teal-500/30 rounded-xl">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white">Bóveda de Respaldo Clínico</h2>
            <InfoPopover
              title="Respaldo y Depuración Automática"
              content="Resguarda el censo activo y el archivo de notas médicas. Para optimizar espacio de almacenamiento, los pacientes dados de alta se depuran automáticamente 5 días después de su egreso."
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenDriveSync && (
            <button
              type="button"
              onClick={onOpenDriveSync}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Cloud className="w-4 h-4" />
              <span>Sincronizar en Google Drive</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleExportBackup}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-teal-400" />
            <span>Descargar Copia JSON</span>
          </button>
        </div>
      </div>

      {/* Recovery & Admin PIN Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: Restore from JSON or Google Drive */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
              <Upload className="w-4 h-4 text-teal-500" />
              <h3>Recuperación de Respaldo (JSON o Drive)</h3>
              <InfoPopover content="Restaura la base de datos de pacientes y notas desde un archivo .json descargado previamente o directamente desde la copia unificada en Google Drive." />
            </div>
            <span className="text-[11px] text-slate-500 font-mono tabular-nums">
              {patients.length} pac. en censo
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label className="flex items-center justify-center gap-2 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors">
              <Upload className="w-4 h-4 text-teal-600 shrink-0" />
              <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
                Subir Archivo (.json)
              </span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileImport}
                className="hidden"
              />
            </label>

            {onOpenDriveSync && (
              <button
                type="button"
                onClick={onOpenDriveSync}
                className="flex items-center justify-center gap-2 border border-teal-300 dark:border-teal-800 bg-teal-50/60 dark:bg-teal-950/30 hover:bg-teal-100/70 dark:hover:bg-teal-900/40 text-teal-800 dark:text-teal-300 rounded-xl p-3 font-bold transition-colors cursor-pointer"
              >
                <Cloud className="w-4 h-4 text-teal-600 shrink-0" />
                <span>Recuperar de Google Drive</span>
              </button>
            )}
          </div>

          {importStatus && (
            <div
              className={`p-2.5 rounded-lg text-xs ${
                importStatus.success
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {importStatus.message}
            </div>
          )}
        </div>

        {/* Card 2: Admin PIN Lock (Editable ONLY in Admin Mode) */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
              <Lock className="w-4 h-4 text-amber-500" />
              <h3>PIN de Seguridad (Modo Administrador)</h3>
              <InfoPopover content="El PIN protege la eliminación de pacientes, egresos hospitalarios y cambios permanentes en Preferencias. Solo puede modificarse teniendo activo el Modo Administrador." />
            </div>
            {hasPin && (
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                PIN Activo
              </span>
            )}
          </div>

          {isAdmin ? (
            <form onSubmit={handleUpdatePin} className="space-y-2.5 text-xs">
              <div className="flex gap-2">
                <input
                  type="password"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder={hasPin ? 'Nuevo PIN (4-6 dígitos)' : 'Configurar PIN (ej. 1234)'}
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-center tracking-widest text-slate-800 dark:text-slate-200"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer"
                >
                  {pinSaved ? '¡PIN Guardado!' : 'Actualizar PIN'}
                </button>
              </div>
            </form>
          ) : (
            <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                <span>La modificación del PIN requiere Modo Administrador.</span>
              </div>
              {onRequestAdminMode && (
                <button
                  type="button"
                  onClick={onRequestAdminMode}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold shrink-0 cursor-pointer"
                >
                  Desbloquear
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Unified Notes Backup Vault */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-teal-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Historial de Notas Médicas ({notes.length})
            </h3>
            <InfoPopover content="Archivo cronológico de notas de ingreso y evolución de pacientes activos y egresados recientes (últimos 5 días)." />
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por paciente, cama, autor..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>

        {filteredNotes.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700">
            No se encontraron notas médicas con los criterios actuales.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotes.map((note) => (
              <div
                key={note.id}
                className="p-4 bg-slate-50/70 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold bg-slate-900 text-white px-2 py-0.5 rounded text-[11px]">
                      {note.bed}
                    </span>
                    <strong className="text-slate-900 dark:text-white text-sm">
                      {note.patientName}
                    </strong>
                    <span className="text-teal-600 dark:text-teal-400 font-semibold">
                      · {note.noteType}
                    </span>
                    <span className="text-slate-400 font-mono tabular-nums">
                      · {note.date} {note.time}
                    </span>
                    <span className="text-slate-500">· Elaboró: {note.residentAuthor}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyNote(note)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                    title="Copiar texto de la nota al portapapeles"
                  >
                    {copiedId === note.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedId === note.id ? 'Copiada' : 'Copiar'}</span>
                  </button>
                </div>

                <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] whitespace-pre-wrap leading-relaxed max-h-52 overflow-y-auto">
                  {note.content}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
