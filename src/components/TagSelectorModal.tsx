import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Tag,
  Check,
  Plus,
  ArrowLeft,
} from 'lucide-react';
import { Patient } from '../types/clinical.ts';
import { defaultAvailableTags } from '../data/seedPatients.ts';
import { InfoPopover } from './InfoPopover.tsx';

interface TagSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient;
  availableTags: string[];
  onUpdateTags: (patientId: string, tags: string[]) => void;
  onAddNewTagToCatalog: (newTag: string) => void;
  onBackToExpediente?: (patient: Patient) => void;
}

export const TagSelectorModal: React.FC<TagSelectorModalProps> = ({
  isOpen,
  onClose,
  patient,
  availableTags,
  onUpdateTags,
  onAddNewTagToCatalog,
  onBackToExpediente,
}) => {
  const [selectedTags, setSelectedTags] = useState<string[]>(patient?.clinicalTags || []);
  const [customTagInput, setCustomTagInput] = useState<string>('');

  useEffect(() => {
    if (isOpen && patient) {
      setSelectedTags(patient.clinicalTags || []);
      setCustomTagInput('');
    }
  }, [isOpen, patient]);

  // Unified catalog combining profile availableTags, defaultAvailableTags, and any custom tags already on the patient
  const unifiedCatalog = useMemo(() => {
    const raw = [
      ...(availableTags || []),
      ...defaultAvailableTags,
      ...(patient?.clinicalTags || []),
      ...selectedTags,
    ];
    const seen = new Set<string>();
    const list: string[] = [];
    for (const item of raw) {
      const clean = (item || '').trim();
      if (!clean) continue;
      const lower = clean.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        list.push(clean);
      }
    }
    return list;
  }, [availableTags, patient?.clinicalTags, selectedTags]);

  if (!isOpen) return null;

  const toggleTag = (tag: string) => {
    const exists = selectedTags.some((t) => t.toLowerCase() === tag.toLowerCase());
    if (exists) {
      setSelectedTags(selectedTags.filter((t) => t.toLowerCase() !== tag.toLowerCase()));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleAddNewTag = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customTagInput.trim();
    if (!trimmed) return;
    onAddNewTagToCatalog(trimmed);
    if (!selectedTags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setSelectedTags([...selectedTags, trimmed]);
    }
    setCustomTagInput('');
  };

  const handleSave = () => {
    let finalTags = [...selectedTags];
    const pendingInput = customTagInput.trim();
    if (pendingInput) {
      onAddNewTagToCatalog(pendingInput);
      if (!finalTags.some((t) => t.toLowerCase() === pendingInput.toLowerCase())) {
        finalTags.push(pendingInput);
      }
    }
    onUpdateTags(patient.id, finalTags);
    onClose();
  };

  const getTagColorStyle = (tag: string) => {
    const t = tag.toLowerCase();
    if (t.includes('intubad') || t.includes('vmi') || t.includes('tubo')) {
      return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800';
    }
    if (t.includes('rcp 3') || t.includes('no rcp') || t.includes('voluntad') || t.includes('rcp3')) {
      return 'bg-red-100 text-red-900 border-red-400 dark:bg-red-950 dark:text-red-100 dark:border-red-800 font-extrabold';
    }
    if (t.includes('cpap') || t.includes('bipap') || t.includes('alto flujo')) {
      return 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-200 dark:border-indigo-800';
    }
    if (t.includes('aislado') || t.includes('aislamiento')) {
      return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800';
    }
    if (t.includes('agresivo') || t.includes('delirium') || t.includes('sujeción')) {
      return 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-800';
    }
    if (t.includes('ayuno') || t.includes('npt')) {
      return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-800';
    }
    if (t.includes('hemodiálisis') || t.includes('cvc') || t.includes('foley') || t.includes('sonda')) {
      return 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-200 dark:border-cyan-800';
    }
    return 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700';
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-teal-500/20 text-teal-400 rounded-xl">
              <Tag className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold">
                  Etiquetas Clínicas del Paciente
                </h3>
                <InfoPopover
                  title="Etiquetas y Dispositivos Clínicos Sincronizados"
                  content="Selecciona las alertas y dispositivos activos (ej. VMI / Intubación, CPAP / BiPAP, Aislamiento, CVC) para que se reflejen en el Censo Activo, el Expediente Clínico y los contadores laterales."
                />
              </div>
              <p className="text-[11px] text-slate-400">
                {patient.name} • <strong>{patient.bed}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Active Tags Preview */}
          <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
              Etiquetas activas asignadas ({selectedTags.length}):
            </span>
            {selectedTags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {selectedTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1.5 transition-all hover:opacity-80 cursor-pointer ${getTagColorStyle(
                      tag
                    )}`}
                    title="Clic para remover"
                  >
                    <span>{tag}</span>
                    <X className="w-3 h-3 text-current opacity-70" />
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-xs text-slate-400 italic">
                Ninguna etiqueta seleccionada para este paciente.
              </span>
            )}
          </div>

          {/* Catalog Tags Checklist */}
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
              Catálogo Sincronizado de Etiquetas (Clic para activar/desactivar):
            </span>
            <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-1">
              {unifiedCatalog.map((tag) => {
                const isSelected = selectedTags.some(
                  (t) => t.toLowerCase() === tag.toLowerCase()
                );
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? `${getTagColorStyle(tag)} ring-2 ring-teal-500/50 shadow-xs font-bold`
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] ${
                        isSelected ? 'bg-teal-600 text-white' : 'border border-slate-400'
                      }`}
                    >
                      {isSelected ? '✓' : ''}
                    </span>
                    <span>{tag}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Add custom tag to catalog & assign to patient */}
          <form
            onSubmit={handleAddNewTag}
            className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={customTagInput}
              onChange={(e) => setCustomTagInput(e.target.value)}
              placeholder="Nueva etiqueta personalizada (ej. 'Pronación', 'Traqueostomía', 'CPAP / BiPAP')..."
              className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              type="submit"
              disabled={!customTagInput.trim()}
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar y Activar</span>
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer"
            >
              Cancelar
            </button>
            {onBackToExpediente && (
              <button
                type="button"
                onClick={() => {
                  handleSave();
                  onBackToExpediente(patient);
                }}
                className="px-3 py-1.5 text-xs font-bold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-800 rounded-lg flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Guardar y Regresar al Expediente</span>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-5 py-1.5 rounded-lg text-xs font-bold shadow-md shadow-teal-500/20 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Aplicar Etiquetas al Paciente</span>
          </button>
        </div>
      </div>
    </div>
  );
};
