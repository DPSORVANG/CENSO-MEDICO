import React, { useState, useEffect, useRef } from 'react';
import { GripVertical, ArrowUp, ArrowDown, Plus, Trash2 } from 'lucide-react';
import { parseDiagnosesList, formatDiagnosesList } from '../utils/clinicalLogic';
import { InfoPopover } from './InfoPopover';

interface DiagnosisListEditorProps {
  /** Either an array of strings or a newline-separated string */
  value: string[] | string;
  onChange: (formattedLines: string[], joinedString: string) => void;
  label?: string;
  compact?: boolean;
}

interface DiagnosisRow {
  id: string;
  cie10: string;
  description: string;
}

const COMMON_CIE10_SUGGESTIONS = [
  { code: 'J18.9', label: 'Neumonía adquirida en la comunidad' },
  { code: 'A41.9', label: 'Sepsis / Choque séptico' },
  { code: 'N17.9', label: 'Lesión renal aguda (LRA)' },
  { code: 'N18.5', label: 'Enfermedad renal crónica etapa 5' },
  { code: 'E11.9', label: 'Diabetes mellitus tipo 2' },
  { code: 'E11.1', label: 'Cetoacidosis diabética / EHH' },
  { code: 'I10', label: 'Hipertensión arterial sistémica' },
  { code: 'I50.9', label: 'Insuficiencia cardíaca descompensada' },
  { code: 'K74.6', label: 'Cirrosis hepática / Insuficiencia hepática' },
  { code: 'K92.2', label: 'Sangrado de tubo digestivo' },
  { code: 'N39.0', label: 'Infección de vías urinarias' },
  { code: 'J44.1', label: 'EPOC exacerbado' },
  { code: 'I63.9', label: 'Evento vascular cerebral isquémico' },
  { code: 'K85.9', label: 'Pancreatitis aguda' },
];

function normalizeValueToString(val: string[] | string): string {
  if (Array.isArray(val)) return val.join('\n');
  return val || '';
}

function buildInitialRows(val: string[] | string): DiagnosisRow[] {
  const parsed = parseDiagnosesList(val);
  if (parsed.length === 0) {
    return [{ id: 'diag-row-0', cie10: '', description: '' }];
  }
  return parsed.map((item, idx) => ({
    id: `diag-row-${idx}`,
    cie10: item.cie10 || '',
    description: item.description || '',
  }));
}

export const DiagnosisListEditor: React.FC<DiagnosisListEditorProps> = ({
  value,
  onChange,
  label = 'Lista de Diagnósticos (Orden de Importancia Clínica + CIE-10)',
  compact = false,
}) => {
  const [rows, setRows] = useState<DiagnosisRow[]>(() => buildInitialRows(value));
  const lastEmittedStringRef = useRef<string>(normalizeValueToString(value));
  const nextIdCounterRef = useRef<number>(100);

  // Sync only when external `value` changes from outside (e.g. switching patient or resetting form)
  useEffect(() => {
    const incomingStr = normalizeValueToString(value);
    if (incomingStr !== lastEmittedStringRef.current) {
      lastEmittedStringRef.current = incomingStr;
      setRows((prevRows) => {
        const parsed = parseDiagnosesList(value);
        if (parsed.length === 0) {
          return [{ id: prevRows[0]?.id || 'diag-row-0', cie10: '', description: '' }];
        }
        return parsed.map((item, idx) => ({
          id: prevRows[idx]?.id || `diag-row-${idx}`,
          cie10: item.cie10 || '',
          description: item.description || '',
        }));
      });
    }
  }, [value]);

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const commitRows = (nextRows: DiagnosisRow[]) => {
    setRows(nextRows);
    const nonEmpty = formatDiagnosesList(nextRows);
    const joined = nonEmpty.join('\n');
    lastEmittedStringRef.current = joined;
    onChange(nonEmpty, joined);
  };

  const handleFieldChange = (index: number, field: 'cie10' | 'description', newVal: string) => {
    const nextRows = rows.map((item, idx) =>
      idx === index ? { ...item, [field]: field === 'cie10' ? newVal.toUpperCase() : newVal } : item
    );
    commitRows(nextRows);
  };

  const handleMove = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= rows.length || fromIndex === toIndex) return;
    const nextRows = [...rows];
    const [moved] = nextRows.splice(fromIndex, 1);
    nextRows.splice(toIndex, 0, moved);
    commitRows(nextRows);
  };

  const handleAddRow = () => {
    nextIdCounterRef.current += 1;
    const nextRows = [
      ...rows,
      { id: `diag-row-${nextIdCounterRef.current}`, cie10: '', description: '' },
    ];
    setRows(nextRows);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length <= 1) {
      const resetRows = [{ id: rows[0]?.id || 'diag-row-0', cie10: '', description: '' }];
      setRows(resetRows);
      lastEmittedStringRef.current = '';
      onChange([], '');
      return;
    }
    const nextRows = rows.filter((_, idx) => idx !== index);
    commitRows(nextRows);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {label}
          </label>
          <InfoPopover
            title="Diagnósticos con CIE-10 y Orden Clínico"
            content="Registra el código CIE-10 junto al número de cada diagnóstico. Arrastra desde el icono izquierdo o usa las flechas ↑/↓ para ordenarlos según la prioridad e importancia clínica actual."
          />
        </div>
        <button
          type="button"
          onClick={handleAddRow}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-colors cursor-pointer shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Agregar Diagnóstico
        </button>
      </div>

      <datalist id="cie10-common-codes">
        {COMMON_CIE10_SUGGESTIONS.map((item) => (
          <option key={item.code} value={item.code}>
            {item.label}
          </option>
        ))}
      </datalist>

      <div className="space-y-1.5">
        {rows.map((item, idx) => {
          const isBeingDragged = draggedIdx === idx;
          const isDragOver = dragOverIdx === idx;
          return (
            <div
              key={item.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverIdx(idx);
              }}
              onDragLeave={() => setDragOverIdx(null)}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedIdx !== null && draggedIdx !== idx) {
                  handleMove(draggedIdx, idx);
                }
                setDraggedIdx(null);
                setDragOverIdx(null);
              }}
              className={`flex items-center gap-1.5 p-1.5 rounded-lg border transition-all ${
                isDragOver
                  ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40'
                  : isBeingDragged
                  ? 'opacity-50 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800'
                  : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900'
              }`}
            >
              <div
                draggable
                onDragStart={() => setDraggedIdx(idx)}
                onDragEnd={() => {
                  setDraggedIdx(null);
                  setDragOverIdx(null);
                }}
                className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-0.5"
                title="Arrastrar para cambiar orden de importancia clínica"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </div>

              <span className="w-5 text-center font-mono text-xs font-extrabold text-blue-700 dark:text-blue-400 shrink-0">
                {idx + 1}.
              </span>

              <input
                type="text"
                list="cie10-common-codes"
                value={item.cie10}
                onChange={(e) => handleFieldChange(idx, 'cie10', e.target.value)}
                placeholder="CIE-10"
                title="Código CIE-10 (ej. J18.9, A41.5, N17.9)"
                className={`${
                  compact ? 'w-20 text-[11px] px-1.5 py-1' : 'w-24 text-xs px-2 py-1.5'
                } font-mono font-bold uppercase rounded border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 placeholder:text-indigo-400/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0`}
              />

              <input
                type="text"
                value={item.description}
                onChange={(e) => handleFieldChange(idx, 'description', e.target.value)}
                placeholder={`Descripción del diagnóstico #${idx + 1}...`}
                className={`flex-1 min-w-0 ${
                  compact ? 'text-xs px-2 py-1' : 'text-xs px-2.5 py-1.5'
                } font-medium rounded border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/70 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />

              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleMove(idx, idx - 1)}
                  disabled={idx === 0}
                  title="Subir prioridad clínica"
                  className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(idx, idx + 1)}
                  disabled={idx === rows.length - 1}
                  title="Bajar prioridad clínica"
                  className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveRow(idx)}
                  title="Eliminar diagnóstico"
                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
