import React, { useState } from 'react';
import {
  Droplets,
  Plus,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Trash2,
  SlidersHorizontal,
} from 'lucide-react';
import { ParenteralSolutionItem } from '../types/clinical.ts';
import { InfoPopover } from './InfoPopover.tsx';

export interface UnifiedSolutionsPanelProps {
  title?: string;
  solutions: ParenteralSolutionItem[];
  onChange: (
    nextSolutions: ParenteralSolutionItem[],
    summaryString: string
  ) => void;
}

export function formatSolutionsSummaryString(
  solutions: ParenteralSolutionItem[]
): string {
  return solutions
    .filter((s) => s && s.solutionType && s.solutionType.trim().length > 0)
    .map((s) => {
      const vol = s.volume ? ` ${s.volume}${/ml|cc|l/i.test(s.volume) ? '' : ' ml'}` : '';
      const med = s.addedConcentrateOrMed ? ` + ${s.addedConcentrateOrMed}` : '';
      const conc = s.concentration ? ` (${s.concentration})` : '';
      const route = s.route ? ` [${s.route}]` : '';
      const rate = s.infusionRate ? ` a ${s.infusionRate}` : '';
      const notes = s.specialNotes ? ` (${s.specialNotes})` : '';
      return `${s.solutionType.trim()}${vol}${med}${conc}${route}${rate}${notes}`;
    })
    .join(' + ');
}

export function normalizeSolutionsFromPatient(
  structured?: ParenteralSolutionItem[],
  ivFluidsText?: string
): ParenteralSolutionItem[] {
  if (Array.isArray(structured) && structured.length > 0) {
    return structured;
  }
  if (ivFluidsText && ivFluidsText.trim().length > 0) {
    return [
      {
        id: 'sol-init-1',
        solutionType: ivFluidsText.trim(),
        volume: '',
        addedConcentrateOrMed: '',
        concentration: '',
        route: 'IV',
        infusionRate: '',
        specialNotes: '',
      },
    ];
  }
  return [
    {
      id: 'sol-default-1',
      solutionType: 'Solución Salina 0.9%',
      volume: '1000 ml',
      addedConcentrateOrMed: '',
      concentration: '',
      route: 'IV',
      infusionRate: '42 ml/h p/24h',
      specialNotes: '',
    },
  ];
}

const QUICK_SOLUTION_PRESETS: Array<{
  label: string;
  solutionType: string;
  volume: string;
  rate: string;
  route: 'IV' | 'CVC' | 'IO';
  added?: string;
}> = [
  {
    label: 'Salina 0.9% 1000ml (42 ml/h)',
    solutionType: 'Solución Salina 0.9%',
    volume: '1000 ml',
    rate: '42 ml/h p/24h',
    route: 'IV',
  },
  {
    label: 'Hartmann 1000ml (42 ml/h)',
    solutionType: 'Solución Hartmann',
    volume: '1000 ml',
    rate: '42 ml/h p/24h',
    route: 'IV',
  },
  {
    label: 'Salina 0.9% 500ml p/24h (21 ml/h)',
    solutionType: 'Solución Salina 0.9%',
    volume: '500 ml',
    rate: '21 ml/h p/24h',
    route: 'IV',
  },
  {
    label: 'Catéter venoso salinizado',
    solutionType: 'Catéter venoso periférico salinizado / permeable',
    volume: '',
    rate: 'Sin infusión continua',
    route: 'IV',
  },
  {
    label: 'Norepinefrina 8mg / 100ml SG5%',
    solutionType: 'Solución Glucosada 5%',
    volume: '100 ml',
    added: 'Norepinefrina 8 mg',
    rate: 'Titular p/PAM ≥ 65 mmHg',
    route: 'CVC',
  },
];

export const UnifiedSolutionsPanel: React.FC<UnifiedSolutionsPanelProps> = ({
  title = '2. Soluciones y Terapia Parenteral / Infusiones',
  solutions,
  onChange,
}) => {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const emitChange = (nextList: ParenteralSolutionItem[]) => {
    onChange(nextList, formatSolutionsSummaryString(nextList));
  };

  const handleAddSolution = () => {
    emitChange([
      ...solutions,
      {
        id: `sol-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        solutionType: 'Solución Salina 0.9%',
        volume: '1000 ml',
        addedConcentrateOrMed: '',
        concentration: '',
        route: 'IV',
        infusionRate: '42 ml/h p/24h',
        specialNotes: '',
      },
    ]);
  };

  const handleApplyPreset = (preset: (typeof QUICK_SOLUTION_PRESETS)[number]) => {
    if (
      solutions.length === 1 &&
      (!solutions[0].solutionType.trim() ||
        solutions[0].solutionType === 'Solución Salina 0.9%') &&
      !solutions[0].addedConcentrateOrMed
    ) {
      emitChange([
        {
          ...solutions[0],
          solutionType: preset.solutionType,
          volume: preset.volume,
          infusionRate: preset.rate,
          route: preset.route,
          addedConcentrateOrMed: preset.added || '',
        },
      ]);
    } else {
      emitChange([
        ...solutions,
        {
          id: `sol-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          solutionType: preset.solutionType,
          volume: preset.volume,
          infusionRate: preset.rate,
          route: preset.route,
          addedConcentrateOrMed: preset.added || '',
          concentration: '',
          specialNotes: '',
        },
      ]);
    }
  };

  const handleMove = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= solutions.length || fromIdx === toIdx) return;
    const copy = [...solutions];
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    emitChange(copy);
  };

  const handleUpdateField = (
    idx: number,
    field: keyof ParenteralSolutionItem,
    value: string
  ) => {
    emitChange(
      solutions.map((item, i) =>
        i === idx ? { ...item, [field]: value } : item
      )
    );
  };

  const handleRemove = (idx: number) => {
    if (solutions.length <= 1) {
      emitChange([
        {
          id: solutions[0]?.id || `sol-${Date.now()}`,
          solutionType: '',
          volume: '',
          addedConcentrateOrMed: '',
          concentration: '',
          route: 'IV',
          infusionRate: '',
          specialNotes: '',
        },
      ]);
      return;
    }
    emitChange(solutions.filter((_, i) => i !== idx));
  };

  const toggleExtraDetails = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Droplets className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase">
            {title} ({solutions.filter((s) => s.solutionType.trim()).length})
          </span>
          <InfoPopover
            title="Soluciones e Infusiones Sincronizadas"
            content="Agrega soluciones de base, cargas o infusiones continuas. Puedes usar las barritas rápidas o pulsar 'Detalles / Mezcla' en cada fila para añadir concentrados (KCl, Norepinefrina), concentración y notas especiales."
          />
        </div>

        <button
          type="button"
          onClick={handleAddSolution}
          className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          <span>+ Solución / Infusión</span>
        </button>
      </div>

      {/* Quick Preset Bars */}
      <div className="flex flex-wrap items-center gap-1">
        {QUICK_SOLUTION_PRESETS.map((pr, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleApplyPreset(pr)}
            className="text-[10px] px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400 cursor-pointer"
          >
            + {pr.label}
          </button>
        ))}
      </div>

      {/* Compact Reorderable Solutions Rows */}
      <div className="space-y-1.5">
        {solutions.map((sol, idx) => {
          const hasExtra = Boolean(
            sol.addedConcentrateOrMed?.trim() ||
              sol.concentration?.trim() ||
              sol.specialNotes?.trim() ||
              expandedIds[sol.id]
          );

          return (
            <div
              key={sol.id || idx}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedIdx !== null && draggedIdx !== idx) {
                  handleMove(draggedIdx, idx);
                }
                setDraggedIdx(null);
              }}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/50 space-y-1.5"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  draggable
                  onDragStart={() => setDraggedIdx(idx)}
                  onDragEnd={() => setDraggedIdx(null)}
                  className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 shrink-0"
                  title="Arrastrar para reordenar"
                >
                  <GripVertical className="w-3.5 h-3.5" />
                </span>
                <span className="text-[10px] font-mono font-extrabold text-blue-600 dark:text-blue-400 shrink-0">
                  #{idx + 1}
                </span>

                <input
                  type="text"
                  list="unified-solutions-datalist"
                  value={sol.solutionType}
                  onChange={(e) =>
                    handleUpdateField(idx, 'solutionType', e.target.value)
                  }
                  placeholder="Solución base (ej. Solución Hartmann, Salina 0.9%)"
                  className="flex-1 min-w-[150px] text-xs px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded font-semibold"
                />

                <input
                  type="text"
                  value={sol.volume || ''}
                  onChange={(e) =>
                    handleUpdateField(idx, 'volume', e.target.value)
                  }
                  placeholder="Vol (ej. 1000 ml)"
                  className="w-24 text-xs px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded font-mono"
                />

                <input
                  type="text"
                  value={sol.infusionRate || ''}
                  onChange={(e) =>
                    handleUpdateField(idx, 'infusionRate', e.target.value)
                  }
                  placeholder="Vel (ej. 42 ml/h p/24h)"
                  className="w-36 text-xs px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded font-mono"
                />

                <select
                  value={sol.route}
                  onChange={(e) =>
                    handleUpdateField(
                      idx,
                      'route',
                      e.target.value as 'IV' | 'CVC' | 'IO'
                    )
                  }
                  className="px-1.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-300 dark:border-indigo-700 rounded text-[11px] font-extrabold text-indigo-800 dark:text-indigo-200"
                >
                  <option value="IV">IV</option>
                  <option value="CVC">CVC</option>
                  <option value="IO">IO</option>
                </select>

                <div className="flex items-center gap-0.5 ml-auto">
                  <button
                    type="button"
                    onClick={() => toggleExtraDetails(sol.id)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 cursor-pointer ${
                      hasExtra
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700'
                    }`}
                    title="Agregar o mostrar concentrado/medicamento, concentración o nota especial"
                  >
                    <SlidersHorizontal className="w-3 h-3" />
                    <span className="hidden sm:inline">Mezcla/Nota</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(idx, idx - 1)}
                    disabled={idx === 0}
                    className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(idx, idx + 1)}
                    disabled={idx === solutions.length - 1}
                    className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="p-0.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                    title="Limpiar o eliminar solución"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {hasExtra && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pl-6">
                  <input
                    type="text"
                    value={sol.addedConcentrateOrMed || ''}
                    onChange={(e) =>
                      handleUpdateField(
                        idx,
                        'addedConcentrateOrMed',
                        e.target.value
                      )
                    }
                    placeholder="+ Concentrado/Fármaco (ej. KCl 20 mEq, Norepi 8mg)"
                    className="text-[11px] px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded"
                  />
                  <input
                    type="text"
                    value={sol.concentration || ''}
                    onChange={(e) =>
                      handleUpdateField(idx, 'concentration', e.target.value)
                    }
                    placeholder="Concentración (ej. 80 mcg/ml)"
                    className="text-[11px] px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded font-mono"
                  />
                  <input
                    type="text"
                    value={sol.specialNotes || ''}
                    onChange={(e) =>
                      handleUpdateField(idx, 'specialNotes', e.target.value)
                    }
                    placeholder="Nota especial (ej. Titular p/PAM > 65, lumen exclusivo)"
                    className="text-[11px] px-2 py-0.5 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <datalist id="unified-solutions-datalist">
        <option value="Solución Salina 0.9%" />
        <option value="Solución Hartmann" />
        <option value="Solución Glucosada 5%" />
        <option value="Solución Mixta (Salina 0.9% + Glucosada 5%)" />
        <option value="Solución Salina 0.45% (Hipotónica)" />
        <option value="Catéter venoso periférico salinizado / permeable" />
      </datalist>
    </div>
  );
};
