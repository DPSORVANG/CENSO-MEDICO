import React, { useState } from 'react';
import {
  GripVertical,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Settings,
  MessageSquarePlus,
  ChevronDown,
  ChevronUp,
  AlignLeft,
  ListChecks,
} from 'lucide-react';
import { PatientNursingOrderItem } from '../types/clinical.ts';
import { InfoPopover } from './InfoPopover.tsx';

export interface UnifiedNursingOrdersPanelProps {
  title?: string;
  subtitle?: string;
  orders: PatientNursingOrderItem[];
  nursingRepository: string[];
  onChange: (
    nextStructured: PatientNursingOrderItem[],
    nextPlainLines: string[]
  ) => void;
  onOpenSettings?: (tab?: string) => void;
  defaultShowCatalog?: boolean;
  accentColor?: 'teal' | 'emerald' | 'cyan';
  compact?: boolean;
}

export function normalizeNursingOrdersToStructured(
  structured?: PatientNursingOrderItem[],
  plain?: string[] | string
): PatientNursingOrderItem[] {
  if (Array.isArray(structured) && structured.length > 0) {
    return structured.filter((item) => item && typeof item.text === 'string' && item.text.trim().length > 0);
  }
  const lines = Array.isArray(plain)
    ? plain
    : typeof plain === 'string'
    ? plain.split('\n')
    : [];
  return lines
    .map((l) => String(l).replace(/^[•\-*\d.)]+\s*/, '').trim())
    .filter(Boolean)
    .map((text, idx) => ({
      id: `nurs-${idx}-${text.slice(0, 12).replace(/\s+/g, '_')}`,
      text,
      note: '',
      active: true,
    }));
}

export const UnifiedNursingOrdersPanel: React.FC<UnifiedNursingOrdersPanelProps> = ({
  title = 'Indicaciones de Enfermería y Medidas Generales',
  subtitle,
  orders,
  nursingRepository,
  onChange,
  onOpenSettings,
  defaultShowCatalog = true,
}) => {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [showCatalog, setShowCatalog] = useState<boolean>(defaultShowCatalog);
  const [rawTextMode, setRawTextMode] = useState<boolean>(false);
  const [expandedNoteIds, setExpandedNoteIds] = useState<Record<string, boolean>>({});

  const emitChange = (nextList: PatientNursingOrderItem[]) => {
    const plainLines = nextList
      .map((item) => item.text.trim())
      .filter(Boolean);
    onChange(nextList, plainLines);
  };

  const handleToggleFromCatalog = (catalogText: string) => {
    const exists = orders.some(
      (o) => o.text.trim().toLowerCase() === catalogText.trim().toLowerCase()
    );
    if (exists) {
      emitChange(
        orders.filter(
          (o) => o.text.trim().toLowerCase() !== catalogText.trim().toLowerCase()
        )
      );
    } else {
      emitChange([
        ...orders,
        {
          id: `nurs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          text: catalogText,
          note: '',
          active: true,
        },
      ]);
    }
  };

  const handleAddBlankRow = () => {
    const newId = `nurs-custom-${Date.now()}`;
    emitChange([
      ...orders,
      {
        id: newId,
        text: 'Signos vitales por turno y cuidados generales de enfermería',
        note: '',
        active: true,
      },
    ]);
  };

  const handleMoveOrder = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= orders.length || fromIdx === toIdx) return;
    const copy = [...orders];
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    emitChange(copy);
  };

  const handleUpdateText = (idx: number, newText: string) => {
    emitChange(
      orders.map((item, i) => (i === idx ? { ...item, text: newText } : item))
    );
  };

  const handleUpdateNote = (idx: number, newNote: string) => {
    emitChange(
      orders.map((item, i) => (i === idx ? { ...item, note: newNote } : item))
    );
  };

  const handleDeleteOrder = (idx: number) => {
    emitChange(orders.filter((_, i) => i !== idx));
  };

  const toggleNoteField = (id: string) => {
    setExpandedNoteIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
      {/* Compact Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide truncate">
            {title} ({orders.length})
          </label>
          <InfoPopover
            title="Panel Unificado de Indicaciones de Enfermería"
            content="1) Toca las barritas del Banco Rápido para activar o quitar indicaciones con un clic. 2) Reordena por prioridad arrastrando (⋮⋮) o con ↑/↓. 3) Edita el texto directamente o pulsa 'Aclaración' para añadir una nota puntual bajo esa indicación. 4) Usa el ícono de tuerca (⚙️) para personalizar el repertorio en Preferencias."
          />
          {subtitle && (
            <span className="hidden sm:inline text-[10px] text-teal-600 dark:text-teal-400 font-semibold">
              • {subtitle}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {onOpenSettings && (
            <button
              type="button"
              onClick={() => onOpenSettings('nursing')}
              title="Personalizar catálogo de Indicaciones de Enfermería en Preferencias"
              aria-label="Personalizar Indicaciones de Enfermería en Preferencias"
              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 dark:bg-slate-800 dark:hover:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-slate-200 dark:border-slate-700 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Settings className="w-3 h-3 shrink-0" />
              <span>Preferencias</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowCatalog((prev) => !prev)}
            title="Mostrar u ocultar las barritas seleccionables del Banco Rápido"
            className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
              showCatalog
                ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-200 border-teal-300 dark:border-teal-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            <span>Banco Rápido ({nursingRepository.length})</span>
            {showCatalog ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setRawTextMode((prev) => !prev)}
            title="Alternar entre filas interactivas y edición rápida por renglones de texto"
            className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
          >
            {rawTextMode ? (
              <>
                <ListChecks className="w-3 h-3 text-teal-600" />
                <span>Vista Filas</span>
              </>
            ) : (
              <>
                <AlignLeft className="w-3 h-3" />
                <span>Texto</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleAddBlankRow}
            className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>+ Fila</span>
          </button>
        </div>
      </div>

      {/* Selectable Quick-Bar Chips (Compact Pill Bars) */}
      {showCatalog && nursingRepository.length > 0 && (
        <div className="p-2 bg-slate-50 dark:bg-slate-950/70 rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-0.5">
            {nursingRepository.map((orderItem, idx) => {
              const isSelected = orders.some(
                (o) =>
                  o.text.trim().toLowerCase() === orderItem.trim().toLowerCase()
              );
              return (
                <button
                  key={`${idx}-${orderItem.slice(0, 15)}`}
                  type="button"
                  onClick={() => handleToggleFromCatalog(orderItem)}
                  title={orderItem}
                  className={`text-[10.5px] px-2 py-0.5 rounded-md border transition-all cursor-pointer text-left flex items-center gap-1 ${
                    isSelected
                      ? 'bg-teal-600 text-white border-teal-700 font-bold shadow-2xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-teal-400'
                  }`}
                >
                  <span className="font-mono font-bold shrink-0">
                    {isSelected ? '✓' : '+'}
                  </span>
                  <span className="truncate max-w-[260px] sm:max-w-[340px]">
                    {orderItem}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Nursing Orders: Compact Reorderable Rows OR Raw Textarea Mode */}
      {rawTextMode ? (
        <textarea
          rows={3}
          value={orders.map((o) => o.text).join('\n')}
          onChange={(e) => {
            const rawLines = e.target.value
              .split('\n')
              .map((l) => l.replace(/^[•\-*\d.)]+\s*/, ''));
            const nextStructured: PatientNursingOrderItem[] = rawLines.map(
              (line, idx) => ({
                id: orders[idx]?.id || `nurs-raw-${idx}`,
                text: line,
                note: orders[idx]?.note || '',
                active: true,
              })
            );
            onChange(
              nextStructured,
              rawLines.map((l) => l.trim()).filter(Boolean)
            );
          }}
          onBlur={(e) => {
            const cleanLines = e.target.value
              .split('\n')
              .map((l) => l.replace(/^[•\-*\d.)]+\s*/, '').trim())
              .filter(Boolean);
            const nextStructured: PatientNursingOrderItem[] = cleanLines.map(
              (line, idx) => ({
                id: orders[idx]?.id || `nurs-raw-${idx}`,
                text: line,
                note: orders[idx]?.note || '',
                active: true,
              })
            );
            onChange(nextStructured, cleanLines);
          }}
          placeholder="Escribe o pega indicaciones de enfermería (una por renglón)..."
          className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono leading-relaxed"
        />
      ) : orders.length > 0 ? (
        <div className="space-y-1 max-h-52 overflow-y-auto pr-0.5">
          {orders.map((ord, idx) => {
            const hasNote = Boolean(ord.note && ord.note.trim().length > 0);
            const showNoteInput = hasNote || Boolean(expandedNoteIds[ord.id]);

            return (
              <div
                key={ord.id || idx}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedIdx !== null && draggedIdx !== idx) {
                    handleMoveOrder(draggedIdx, idx);
                  }
                  setDraggedIdx(null);
                }}
                className="px-2 py-1 rounded-lg border border-teal-200/80 dark:border-teal-800/60 bg-teal-50/30 dark:bg-teal-950/20 space-y-1"
              >
                <div className="flex items-center gap-1">
                  <span
                    draggable
                    onDragStart={() => setDraggedIdx(idx)}
                    onDragEnd={() => setDraggedIdx(null)}
                    className="cursor-grab active:cursor-grabbing shrink-0 text-slate-400 hover:text-teal-600"
                    title="Arrastrar para reordenar"
                  >
                    <GripVertical className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-[10px] font-mono font-bold text-teal-700 dark:text-teal-400 w-4 text-center shrink-0">
                    {idx + 1}.
                  </span>
                  <input
                    type="text"
                    value={ord.text}
                    onChange={(e) => handleUpdateText(idx, e.target.value)}
                    placeholder="Indicación de enfermería..."
                    className="flex-1 min-w-0 text-xs px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded font-medium text-slate-900 dark:text-white"
                  />
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleNoteField(ord.id)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-0.5 transition-colors cursor-pointer ${
                        showNoteInput
                          ? 'bg-teal-600 text-white'
                          : 'text-slate-500 hover:text-teal-700 hover:bg-teal-100/60 dark:hover:bg-slate-800'
                      }`}
                      title="Agregar o mostrar aclaración específica debajo de esta indicación"
                    >
                      <MessageSquarePlus className="w-3 h-3" />
                      <span className="hidden md:inline">Nota</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveOrder(idx, idx - 1)}
                      disabled={idx === 0}
                      className="p-0.5 text-slate-400 hover:text-teal-600 disabled:opacity-30 cursor-pointer"
                      title="Subir indicación"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveOrder(idx, idx + 1)}
                      disabled={idx === orders.length - 1}
                      className="p-0.5 text-slate-400 hover:text-teal-600 disabled:opacity-30 cursor-pointer"
                      title="Bajar indicación"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteOrder(idx)}
                      className="p-0.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                      title="Eliminar indicación"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {showNoteInput && (
                  <div className="pl-6 pr-1">
                    <input
                      type="text"
                      value={ord.note || ''}
                      onChange={(e) => handleUpdateNote(idx, e.target.value)}
                      placeholder="Aclaración específica bajo esta indicación (ej. horario, meta de PAM, parámetro de alarma)..."
                      className="w-full text-[11px] px-2 py-0.5 bg-white/80 dark:bg-slate-900/80 border border-dashed border-teal-300 dark:border-teal-800 rounded text-slate-700 dark:text-slate-300"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-dashed border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 text-center">
          Selecciona indicaciones en las barritas superiores o pulsa <strong>+ Fila</strong> para agregar una indicación.
        </div>
      )}
    </div>
  );
};
