import React, { useState } from 'react';
import {
  Brain,
  Wind,
  HeartPulse,
  Utensils,
  Droplets,
  Bug,
  Wand2,
  ChevronDown,
  ChevronUp,
  Check,
  Pencil,
} from 'lucide-react';
import { CriticalCareSystemsData, Patient } from '../types/clinical.ts';
import {
  calculateAntibioticDay,
  formatCriticalCareSystemsSummary,
} from '../utils/clinicalLogic.ts';
import { InfoPopover } from './InfoPopover.tsx';

interface CriticalCareSystemsEditorProps {
  value: CriticalCareSystemsData;
  onChange: (updated: CriticalCareSystemsData) => void;
  patient?: Patient;
  onCloseEditor?: () => void;
}

type SystemTabKey =
  | 'neuro'
  | 'respiratory'
  | 'hemodynamic'
  | 'gastroMetabolic'
  | 'renal'
  | 'infectious';

// Crisp Broom (Escoba) SVG icon for mobile/tablet ergonomics
const BroomIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="m13 11 9-9" />
    <path d="M14.6 12.6c.8.8.9 2.1.2 3L10 22l-8-8 6.4-4.8c.9-.7 2.2-.6 3 .2Z" />
    <path d="m6.8 10.4 6.8 6.8" />
    <path d="m5 17 1.5-1.5" />
    <path d="m8 20 1.5-1.5" />
  </svg>
);

export const CriticalCareSystemsEditor: React.FC<CriticalCareSystemsEditorProps> = ({
  value,
  onChange,
  patient,
  onCloseEditor,
}) => {
  const [activeTab, setActiveTab] = useState<SystemTabKey>('neuro');
  const [isExpanded, setIsExpanded] = useState<boolean>(
    Boolean(onCloseEditor) || Boolean(value?.enabled)
  );
  const [autoFillFeedback, setAutoFillFeedback] = useState<boolean>(false);

  const data: CriticalCareSystemsData = {
    enabled: Boolean(onCloseEditor) || (value?.enabled ?? false),
    neuro: value?.neuro || {},
    respiratory: value?.respiratory || {},
    hemodynamic: value?.hemodynamic || {},
    gastroMetabolic: value?.gastroMetabolic || {},
    renal: value?.renal || {},
    infectious: value?.infectious || {},
  };

  const updateSystemField = <K extends SystemTabKey>(
    system: K,
    field: keyof NonNullable<CriticalCareSystemsData[K]>,
    fieldValue: string
  ) => {
    onChange({
      ...data,
      enabled: true,
      [system]: {
        ...(data[system] || {}),
        [field]: fieldValue,
      },
    });
  };

  const appendChipToField = <K extends SystemTabKey>(
    system: K,
    field: keyof NonNullable<CriticalCareSystemsData[K]>,
    chipText: string
  ) => {
    const current = String((data[system] as Record<string, string | undefined>)?.[field as string] || '').trim();
    const next = current
      ? current.includes(chipText)
        ? current
        : `${current}, ${chipText}`
      : chipText;
    updateSystemField(system, field, next);
  };

  // Synchronize / Auto-populate relevant values from patient's latest vitals, labs, and active antibiotics
  const handleAutoFillFromPatient = () => {
    if (!patient) return;
    const latestLab = patient.labs && patient.labs.length > 0 ? patient.labs[0] : null;
    const prevLab = patient.labs && patient.labs.length > 1 ? patient.labs[1] : null;

    // Compute PAM from BP if format is "120/80"
    let bpAndMapStr = patient.vitals?.bp ? `TA ${patient.vitals.bp} mmHg` : '';
    const bpParts = (patient.vitals?.bp || '').split('/').map((n) => parseFloat(n.trim()));
    if (bpParts.length === 2 && !isNaN(bpParts[0]) && !isNaN(bpParts[1])) {
      const pam = Math.round((bpParts[0] + 2 * bpParts[1]) / 3);
      bpAndMapStr = `TA ${patient.vitals.bp} mmHg (PAM ${pam} mmHg)`;
    }

    // Gasometry string if present
    const gasParts: string[] = [];
    if (latestLab?.ph !== undefined) gasParts.push(`pH ${latestLab.ph}`);
    if (latestLab?.pco2 !== undefined) gasParts.push(`pCO2 ${latestLab.pco2}`);
    if (latestLab?.po2 !== undefined) gasParts.push(`pO2 ${latestLab.po2}`);
    if (latestLab?.hco3 !== undefined) gasParts.push(`HCO3 ${latestLab.hco3}`);
    if (latestLab?.lactato !== undefined) gasParts.push(`Lactato ${latestLab.lactato}`);

    // Renal function string
    const renalParts: string[] = [];
    if (latestLab?.creatinina !== undefined) {
      const prevCr = prevLab?.creatinina !== undefined ? ` (prev ${prevLab.creatinina})` : '';
      renalParts.push(`Cr ${latestLab.creatinina}${prevCr} mg/dL`);
    }
    if (latestLab?.urea !== undefined) renalParts.push(`Urea ${latestLab.urea}`);
    if (latestLab?.bun !== undefined) renalParts.push(`BUN ${latestLab.bun}`);
    if (latestLab?.na !== undefined) renalParts.push(`Na ${latestLab.na}`);
    if (latestLab?.k !== undefined) renalParts.push(`K ${latestLab.k}`);
    if (latestLab?.cl !== undefined) renalParts.push(`Cl ${latestLab.cl}`);

    // Reactants & Antibiotics
    const reactParts: string[] = [];
    if (latestLab?.leucos !== undefined) {
      const prevLeu = prevLab?.leucos !== undefined ? ` (prev ${prevLab.leucos})` : '';
      reactParts.push(`Leucos ${latestLab.leucos}${prevLeu}`);
    }
    if (latestLab?.pcr !== undefined) reactParts.push(`PCR ${latestLab.pcr}`);
    if (latestLab?.procalcitonina !== undefined)
      reactParts.push(`PCT ${latestLab.procalcitonina}`);

    const activeAtb = patient.medications
      .filter((m) => m.active && m.isAntibiotic)
      .map((m) => {
        const st = calculateAntibioticDay(m.startDate, m.plannedDays);
        return `${m.name} ${m.dose} ${m.route} ${m.frequency} [${st.displayString}]`;
      })
      .join(' + ');

    onChange({
      ...data,
      enabled: true,
      respiratory: {
        ...data.respiratory,
        spo2: patient.vitals?.spo2 ? `${patient.vitals.spo2}%` : data.respiratory?.spo2 || '',
        respRateVent: patient.vitals?.rr ? `${patient.vitals.rr} rpm` : data.respiratory?.respRateVent || '',
        bloodGas: gasParts.length > 0 ? gasParts.join(', ') : data.respiratory?.bloodGas || '',
      },
      hemodynamic: {
        ...data.hemodynamic,
        bpAndMap: bpAndMapStr || data.hemodynamic?.bpAndMap || '',
        hrAndRhythm:
          patient.vitals?.hr
            ? `${patient.vitals.hr} lpm · Sinusal`
            : data.hemodynamic?.hrAndRhythm || '',
      },
      gastroMetabolic: {
        ...data.gastroMetabolic,
        glycemias:
          patient.vitals?.glucose
            ? `${patient.vitals.glucose} mg/dL`
            : latestLab?.glucosa !== undefined
            ? `${latestLab.glucosa} mg/dL`
            : data.gastroMetabolic?.glycemias || '',
        feedingType: patient.diet || data.gastroMetabolic?.feedingType || '',
      },
      renal: {
        ...data.renal,
        renalFunction: renalParts.length > 0 ? renalParts.join(', ') : data.renal?.renalFunction || '',
      },
      infectious: {
        ...data.infectious,
        acutePhaseReactants:
          reactParts.length > 0 ? reactParts.join(', ') : data.infectious?.acutePhaseReactants || '',
        antibioticsInUse: activeAtb || data.infectious?.antibioticsInUse || '',
      },
    });
    setIsExpanded(true);
    setAutoFillFeedback(true);
    window.setTimeout(() => setAutoFillFeedback(false), 2600);
  };

  const handleSaveAndReturnToReadView = () => {
    if (onCloseEditor) {
      onCloseEditor();
    } else {
      setIsExpanded(false);
    }
  };

  const systemTabs: Array<{
    key: SystemTabKey;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
    activeColor: string;
    hasData: boolean;
  }> = [
    {
      key: 'neuro',
      label: 'Neurológico',
      shortLabel: 'Neuro',
      icon: <Brain className="w-3.5 h-3.5" />,
      activeColor: 'bg-indigo-600 text-white border-indigo-600',
      hasData: Object.values(data.neuro || {}).some((v) => Boolean(v && v.trim())),
    },
    {
      key: 'respiratory',
      label: 'Respiratorio / Vent',
      shortLabel: 'Respiratorio',
      icon: <Wind className="w-3.5 h-3.5" />,
      activeColor: 'bg-sky-600 text-white border-sky-600',
      hasData: Object.values(data.respiratory || {}).some((v) => Boolean(v && v.trim())),
    },
    {
      key: 'hemodynamic',
      label: 'Hemodinámico / Cardio',
      shortLabel: 'Hemodinámico',
      icon: <HeartPulse className="w-3.5 h-3.5" />,
      activeColor: 'bg-rose-600 text-white border-rose-600',
      hasData: Object.values(data.hemodynamic || {}).some((v) => Boolean(v && v.trim())),
    },
    {
      key: 'gastroMetabolic',
      label: 'GI / Metabólico',
      shortLabel: 'GI / Metab',
      icon: <Utensils className="w-3.5 h-3.5" />,
      activeColor: 'bg-amber-600 text-white border-amber-600',
      hasData: Object.values(data.gastroMetabolic || {}).some((v) => Boolean(v && v.trim())),
    },
    {
      key: 'renal',
      label: 'Renal / Hídrico',
      shortLabel: 'Renal',
      icon: <Droplets className="w-3.5 h-3.5" />,
      activeColor: 'bg-teal-600 text-white border-teal-600',
      hasData: Object.values(data.renal || {}).some((v) => Boolean(v && v.trim())),
    },
    {
      key: 'infectious',
      label: 'Infeccioso',
      shortLabel: 'Infeccioso',
      icon: <Bug className="w-3.5 h-3.5" />,
      activeColor: 'bg-purple-600 text-white border-purple-600',
      hasData: Object.values(data.infectious || {}).some((v) => Boolean(v && v.trim())),
    },
  ];

  const activeSystemsCount = systemTabs.filter((t) => t.hasData).length;
  const readSummaryItems = formatCriticalCareSystemsSummary(data);

  return (
    <div className="bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Compact Icon-First Header Bar */}
      <div className="px-3 py-2 bg-slate-100/90 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={() => {
              const nextExpand = !isExpanded;
              setIsExpanded(nextExpand);
              if (nextExpand && !data.enabled) {
                onChange({ ...data, enabled: true });
              }
            }}
            className="flex items-center gap-1.5 text-left cursor-pointer min-w-0"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500 shrink-0" />
            <span className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider truncate">
              Evolución por Sistemas
            </span>
            {activeSystemsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-teal-600 text-white font-mono font-bold text-[10px] shrink-0">
                {activeSystemsCount}
              </span>
            )}
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
            )}
          </button>
          <InfoPopover
            title="Evolución por Sistemas"
            content="Registra parámetros por aparato/sistema (Neurológico, Respiratorio, Hemodinámico, GI/Metabólico, Renal o Infeccioso). El botón de varita mágica (⚡ SV/Labs) jala automáticamente los signos vitales, PAM, gasometría, función renal y antibióticos actuales de la ficha del paciente. El botón de escoba limpia todos los sistemas."
          />
        </div>

        {/* Icon-First Action Toolbar for Mobile/Tablet/Desktop */}
        <div className="flex items-center gap-1.5 shrink-0">
          {patient && (
            <button
              type="button"
              onClick={handleAutoFillFromPatient}
              className="px-2 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
              title="Importar Signos Vitales, PAM, Gasometría, Función Renal y Antibióticos actuales del paciente a cada sistema"
              aria-label="Importar signos vitales y laboratorios actuales del paciente"
            >
              <Wand2 className="w-3.5 h-3.5 shrink-0" />
              <span>SV/Labs</span>
            </button>
          )}

          {activeSystemsCount > 0 && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  enabled: false,
                  neuro: {},
                  respiratory: {},
                  hemodynamic: {},
                  gastroMetabolic: {},
                  renal: {},
                  infectious: {},
                })
              }
              className="p-1.5 rounded-lg bg-slate-200/90 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-300/70 dark:border-slate-700 transition-colors flex items-center justify-center cursor-pointer"
              title="Limpiar todos los parámetros por sistemas (Escoba)"
              aria-label="Limpiar todos los parámetros por sistemas"
            >
              <BroomIcon className="w-3.5 h-3.5" />
            </button>
          )}

          {(isExpanded || onCloseEditor) && (
            <button
              type="button"
              onClick={handleSaveAndReturnToReadView}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
              title="Guardar cambios y volver a la vista de lectura"
              aria-label="Guardar y volver a vista de lectura"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
              <span className="hidden sm:inline">Listo</span>
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Banner when SV/Labs are imported */}
      {autoFillFeedback && (
        <div className="px-3.5 py-1.5 bg-teal-600 text-white text-[11px] font-bold flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 shrink-0" />
          <span>
            Se actualizaron Signos Vitales, PAM, Gasometría, Función Renal y Antibióticos desde la ficha del paciente.
          </span>
        </div>
      )}

      {/* Read-Only Summary View when collapsed inside Modals */}
      {!isExpanded && readSummaryItems.length > 0 && (
        <div
          onClick={() => setIsExpanded(true)}
          title="Clic para editar Evolución por Sistemas"
          className="p-2.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-1.5 cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Vista de lectura (toca para editar)</span>
            <span className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 font-bold">
              <Pencil className="w-3 h-3" />
              <span>Editar</span>
            </span>
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {readSummaryItems.map((sys) => (
              <div
                key={sys.key}
                className="text-xs leading-snug flex items-baseline gap-1.5"
              >
                <span
                  className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded border shrink-0 ${sys.badgeClass}`}
                >
                  {sys.shortLabel}
                </span>
                <span className="text-slate-800 dark:text-slate-200 break-words">
                  {sys.summary}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isExpanded && (
        <div className="p-3.5 space-y-3 text-xs">
          {/* 6 System Selector Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
            {systemTabs.map((tab) => {
              const isSelected = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-2.5 py-1.5 rounded-xl font-bold text-[11px] border flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? `${tab.activeColor} shadow-xs`
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    {tab.icon}
                    <span className="truncate">{tab.shortLabel}</span>
                  </span>
                  {tab.hasData && (
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isSelected ? 'bg-white' : 'bg-emerald-500'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* 1. NEUROLÓGICO */}
          {activeTab === 'neuro' && (
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-indigo-800 dark:text-indigo-300 uppercase block mb-1">
                    Escala de Glasgow (3 - 15)
                  </label>
                  <div className="flex items-center gap-1">
                    <select
                      value={data.neuro?.glasgow || ''}
                      onChange={(e) => updateSystemField('neuro', 'glasgow', e.target.value)}
                      className="flex-1 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-xs"
                    >
                      <option value="">-- Seleccionar --</option>
                      {['15', '14', '13', '12', '11', '10T', '10', '9', '8T', '8', '7', '6', '5', '4', '3T', '3'].map(
                        (g) => (
                          <option key={g} value={g}>
                            Glasgow {g}
                          </option>
                        )
                      )}
                    </select>
                    <input
                      type="text"
                      value={data.neuro?.glasgow || ''}
                      onChange={(e) => updateSystemField('neuro', 'glasgow', e.target.value)}
                      placeholder="Ej. 10T"
                      className="w-16 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-center font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-indigo-800 dark:text-indigo-300 uppercase block mb-1">
                    Escala FOUR (0 - 16)
                  </label>
                  <div className="flex items-center gap-1">
                    <select
                      value={data.neuro?.fourScore || ''}
                      onChange={(e) => updateSystemField('neuro', 'fourScore', e.target.value)}
                      className="flex-1 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-xs"
                    >
                      <option value="">-- Seleccionar --</option>
                      {['16', '15', '14', '13', '12', '10', '8', '6', '4', '2', '0'].map((f) => (
                        <option key={f} value={f}>
                          FOUR {f}/16
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={data.neuro?.fourScore || ''}
                      onChange={(e) => updateSystemField('neuro', 'fourScore', e.target.value)}
                      placeholder="0-16"
                      className="w-14 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-center font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-indigo-800 dark:text-indigo-300 uppercase block mb-1">
                    Escala RASS (-5 a +4)
                  </label>
                  <select
                    value={data.neuro?.rass || ''}
                    onChange={(e) => updateSystemField('neuro', 'rass', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-xs"
                  >
                    <option value="">-- Sin RASS / No aplica --</option>
                    <option value="+4">+4 (Combativo)</option>
                    <option value="+3">+3 (Muy agitado)</option>
                    <option value="+2">+2 (Agitado)</option>
                    <option value="+1">+1 (Inquieto)</option>
                    <option value="0">0 (Alerta y tranquilo)</option>
                    <option value="-1">-1 (Somnoliento)</option>
                    <option value="-2">-2 (Sedación ligera)</option>
                    <option value="-3">-3 (Sedación moderada)</option>
                    <option value="-4">-4 (Sedación profunda)</option>
                    <option value="-5">-5 (No despertable)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                    Estado de Conciencia
                  </label>
                  <input
                    type="text"
                    value={data.neuro?.consciousness || ''}
                    onChange={(e) => updateSystemField('neuro', 'consciousness', e.target.value)}
                    placeholder="Ej. Alerta y orientado / Bajo sedación..."
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {['Alerta y orientado', 'Somnoliento', 'Estuporoso', 'Bajo sedación', 'Delirium hiperactivo'].map(
                      (c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => updateSystemField('neuro', 'consciousness', c)}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                        >
                          {c}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                    Reflejos (Pupilares / Tallo)
                  </label>
                  <input
                    type="text"
                    value={data.neuro?.reflexes || ''}
                    onChange={(e) => updateSystemField('neuro', 'reflexes', e.target.value)}
                    placeholder="Ej. Pupilas isocóricas 3mm normorreactivas..."
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {[
                      'Pupilas isocóricas normorreactivas',
                      'Reflejo tusígeno y nauseoso (+)',
                      'Miosis puntiforme',
                      'Anisocoria',
                    ].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => appendChipToField('neuro', 'reflexes', c)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                      >
                        +{c}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                    Sedación / Analgesia (Tipo y Dosis)
                  </label>
                  <input
                    type="text"
                    value={data.neuro?.sedationAnalgesia || ''}
                    onChange={(e) =>
                      updateSystemField('neuro', 'sedationAnalgesia', e.target.value)
                    }
                    placeholder="Ej. Dexmedetomidina 0.5 mcg/kg/h + Fentanilo..."
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {[
                      'Sin sedación',
                      'Propofol',
                      'Dexmedetomidina',
                      'Midazolam',
                      'Fentanilo',
                      'Buprenorfina',
                    ].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => appendChipToField('neuro', 'sedationAnalgesia', c)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                      >
                        +{c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Notas Neurológicas Adicionales (Focalización, Fuerza, Ventana Neurológica)
                </label>
                <input
                  type="text"
                  value={data.neuro?.notes || ''}
                  onChange={(e) => updateSystemField('neuro', 'notes', e.target.value)}
                  placeholder="Escribir hallazgos neurológicos específicos..."
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>
          )}

          {/* 2. RESPIRATORIO */}
          {activeTab === 'respiratory' && (
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-sky-200 dark:border-sky-900/60 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-sky-800 dark:text-sky-300 uppercase block mb-1">
                    Tipo de Soporte Ventilatorio (Invasivo / No Invasivo / O2)
                  </label>
                  <input
                    type="text"
                    value={data.respiratory?.supportType || ''}
                    onChange={(e) =>
                      updateSystemField('respiratory', 'supportType', e.target.value)
                    }
                    placeholder="Ej. Ventilación Mecánica Invasiva (TOT #8.0) / CPAP / BiPAP / Puntas nasales..."
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold"
                  />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {[
                      'VMI (Intubación Endotraqueal)',
                      'VMNI (CPAP / BiPAP)',
                      'Cánula Alto Flujo (CNAF)',
                      'Mascarilla Reservorio',
                      'Puntas Nasales',
                      'Traqueostomía',
                      'Aire Ambiente',
                    ].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => updateSystemField('respiratory', 'supportType', s)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-sky-800 dark:text-sky-300 uppercase block mb-1">
                    Modo Ventilatorio
                  </label>
                  <select
                    value={data.respiratory?.ventMode || ''}
                    onChange={(e) => updateSystemField('respiratory', 'ventMode', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-bold"
                  >
                    <option value="">-- Sin ventilador / Espontáneo --</option>
                    <option value="A/C por Volumen">A/C por Volumen</option>
                    <option value="A/C por Presión">A/C por Presión</option>
                    <option value="CPAP / PSV (Presión Soporte)">CPAP / PSV (Presión Soporte)</option>
                    <option value="BiPAP S/T (IPAP/EPAP)">BiPAP S/T (IPAP/EPAP)</option>
                    <option value="SIMV + PSV">SIMV + PSV</option>
                    <option value="PRVC">PRVC</option>
                  </select>
                </div>
              </div>

              {/* Parámetros del Ventilador y SpO2 */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                    FiO₂ (%)
                  </label>
                  <input
                    type="text"
                    value={data.respiratory?.fio2 || ''}
                    onChange={(e) => updateSystemField('respiratory', 'fio2', e.target.value)}
                    placeholder="Ej. 40%"
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-center font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                    PEEP (cmH₂O)
                  </label>
                  <input
                    type="text"
                    value={data.respiratory?.peep || ''}
                    onChange={(e) => updateSystemField('respiratory', 'peep', e.target.value)}
                    placeholder="Ej. 8"
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-center font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                    Vol. Corriente (Vt)
                  </label>
                  <input
                    type="text"
                    value={data.respiratory?.tidalVolume || ''}
                    onChange={(e) =>
                      updateSystemField('respiratory', 'tidalVolume', e.target.value)
                    }
                    placeholder="Ej. 450 mL"
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-center font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                    FR (rpm)
                  </label>
                  <input
                    type="text"
                    value={data.respiratory?.respRateVent || ''}
                    onChange={(e) =>
                      updateSystemField('respiratory', 'respRateVent', e.target.value)
                    }
                    placeholder="Ej. 18 rpm"
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-center font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                    SpO₂ (%)
                  </label>
                  <input
                    type="text"
                    value={data.respiratory?.spo2 || ''}
                    onChange={(e) => updateSystemField('respiratory', 'spo2', e.target.value)}
                    placeholder="Ej. 95%"
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-center font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                    Gasometría Relevante (pH, pCO₂, pO₂, HCO₃, Lactato, PaO₂/FiO₂)
                  </label>
                  <input
                    type="text"
                    value={data.respiratory?.bloodGas || ''}
                    onChange={(e) => updateSystemField('respiratory', 'bloodGas', e.target.value)}
                    placeholder="Ej. pH 7.38, pCO2 38, pO2 82, HCO3 23, Lac 1.2, Kirby 230"
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                    Mecánica Ventilatoria / Secreciones / Auscultación
                  </label>
                  <input
                    type="text"
                    value={data.respiratory?.notes || ''}
                    onChange={(e) => updateSystemField('respiratory', 'notes', e.target.value)}
                    placeholder="Ej. Secreciones hialinas escasas, murmullo vesicular simétrico..."
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3. HEMODINÁMICO / CARDIOLÓGICO */}
          {activeTab === 'hemodynamic' && (
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-rose-800 dark:text-rose-300 uppercase block mb-1">
                    Estado Hemodinámico
                  </label>
                  <input
                    type="text"
                    value={data.hemodynamic?.hemodynamicStatus || ''}
                    onChange={(e) =>
                      updateSystemField('hemodynamic', 'hemodynamicStatus', e.target.value)
                    }
                    placeholder="Ej. Estable sin apoyo / Choque séptico con requerimiento vasopresor..."
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold"
                  />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {[
                      'Estable sin vasopresor',
                      'Choque en resolución',
                      'Dependiente de aminas',
                      'Doble vasopresor',
                      'Hipertensión en control',
                    ].map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => updateSystemField('hemodynamic', 'hemodynamicStatus', h)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-rose-800 dark:text-rose-300 uppercase block mb-1">
                    Presión Arterial y PAM (mmHg)
                  </label>
                  <input
                    type="text"
                    value={data.hemodynamic?.bpAndMap || ''}
                    onChange={(e) => updateSystemField('hemodynamic', 'bpAndMap', e.target.value)}
                    placeholder="Ej. TA 115/70 mmHg (PAM 85 mmHg)"
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                    Uso de Vasopresores o Inotrópicos (Tipo y Dosis)
                  </label>
                  <input
                    type="text"
                    value={data.hemodynamic?.vasopressorsInotropes || ''}
                    onChange={(e) =>
                      updateSystemField('hemodynamic', 'vasopressorsInotropes', e.target.value)
                    }
                    placeholder="Ej. Norepinefrina 0.12 mcg/kg/min + Vasopresina 0.03 UI/min"
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                  />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {[
                      'Sin vasopresores',
                      'Norepinefrina mcg/kg/min',
                      'Vasopresina UI/min',
                      'Dobutamina mcg/kg/min',
                      'Epinefrina mcg/kg/min',
                      'Levosimendán',
                    ].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => appendChipToField('hemodynamic', 'vasopressorsInotropes', v)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                      >
                        +{v}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                    Frecuencia Cardiaca y Ritmo (Sinusal o No Sinusal)
                  </label>
                  <input
                    type="text"
                    value={data.hemodynamic?.hrAndRhythm || ''}
                    onChange={(e) =>
                      updateSystemField('hemodynamic', 'hrAndRhythm', e.target.value)
                    }
                    placeholder="Ej. 82 lpm · Ritmo sinusal"
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {[
                      'Ritmo sinusal',
                      'Taquicardia sinusal',
                      'Fibrilación auricular',
                      'Flutter auricular',
                      'Bradicardia sinusal',
                      'Marcapasos',
                    ].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => appendChipToField('hemodynamic', 'hrAndRhythm', r)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                      >
                        +{r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Perfusión Tisular / Llenado Capilar / Notas Cardiológicas
                </label>
                <input
                  type="text"
                  value={data.hemodynamic?.notes || ''}
                  onChange={(e) => updateSystemField('hemodynamic', 'notes', e.target.value)}
                  placeholder="Ej. Llenado capilar 2 seg, extremidades eutérmicas, sin ingurgitación yugular..."
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>
          )}

          {/* 4. GASTROINTESTINAL / METABÓLICO */}
          {activeTab === 'gastroMetabolic' && (
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/60 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase block mb-1">
                    Glucemias y Control Metabólico
                  </label>
                  <input
                    type="text"
                    value={data.gastroMetabolic?.glycemias || ''}
                    onChange={(e) =>
                      updateSystemField('gastroMetabolic', 'glycemias', e.target.value)
                    }
                    placeholder="Ej. Glucemias 110 - 155 mg/dL, requerimiento de 8 UI Lispro en 24h"
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase block mb-1">
                    Tipo de Alimentación / Soporte Nutricional
                  </label>
                  <input
                    type="text"
                    value={data.gastroMetabolic?.feedingType || ''}
                    onChange={(e) =>
                      updateSystemField('gastroMetabolic', 'feedingType', e.target.value)
                    }
                    placeholder="Ej. Vía oral / Nutrición enteral por SNG / NPT / Ayuno..."
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {[
                      'Vía oral bien tolerada',
                      'Ayuno por protocolo',
                      'Nutrición enteral por SNG',
                      'Nutrición Parenteral Total (NPT)',
                    ].map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => updateSystemField('gastroMetabolic', 'feedingType', f)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                    Distensión Abdominal, Peristalsis y Evacuaciones
                  </label>
                  <input
                    type="text"
                    value={data.gastroMetabolic?.abdomenAndBowel || ''}
                    onChange={(e) =>
                      updateSystemField('gastroMetabolic', 'abdomenAndBowel', e.target.value)
                    }
                    placeholder="Ej. Sin distensión, peristalsis normoaudible, 2 evacuaciones Bristol 4"
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {[
                      'Sin distensión abdominal',
                      'Peristalsis presente',
                      'Evacuaciones normales',
                      'Estreñimiento',
                      'Diarrea',
                      'Sin datos de sangrado digestivo',
                    ].map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => appendChipToField('gastroMetabolic', 'abdomenAndBowel', b)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                      >
                        +{b}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Notas Gastrointestinales / Hepáticas Adicionales
                  </label>
                  <input
                    type="text"
                    value={data.gastroMetabolic?.notes || ''}
                    onChange={(e) =>
                      updateSystemField('gastroMetabolic', 'notes', e.target.value)
                    }
                    placeholder="Ej. Gasto por SNG / drenajes, perímetro abdominal..."
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 5. RENAL */}
          {activeTab === 'renal' && (
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-teal-200 dark:border-teal-900/60 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-teal-800 dark:text-teal-300 uppercase block mb-1">
                    Diuresis (Volumen 24h e Índice Urinario mL/kg/h)
                  </label>
                  <input
                    type="text"
                    value={data.renal?.diuresis || ''}
                    onChange={(e) => updateSystemField('renal', 'diuresis', e.target.value)}
                    placeholder="Ej. 1,850 mL/24h (1.1 mL/kg/h) espontánea / por sonda Foley"
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-teal-800 dark:text-teal-300 uppercase block mb-1">
                    Función Renal (Última Creatinina, Azoados y Electrolitos)
                  </label>
                  <input
                    type="text"
                    value={data.renal?.renalFunction || ''}
                    onChange={(e) => updateSystemField('renal', 'renalFunction', e.target.value)}
                    placeholder="Ej. Cr 1.1 mg/dL, BUN 18, Urea 38, Na 138, K 4.1, Cl 102"
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                    Balances Hídricos (Parcial / 24h / Global)
                  </label>
                  <input
                    type="text"
                    value={data.renal?.fluidBalance || ''}
                    onChange={(e) => updateSystemField('renal', 'fluidBalance', e.target.value)}
                    placeholder="Ej. Balance 24h: -450 mL | Global acumulado: +300 mL"
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                    Uso de Diuréticos o Terapia de Reemplazo Renal (TRR)
                  </label>
                  <input
                    type="text"
                    value={data.renal?.diureticsOrRrt || ''}
                    onChange={(e) => updateSystemField('renal', 'diureticsOrRrt', e.target.value)}
                    placeholder="Ej. Furosemida 20mg IV c/8h / Hemodiálisis intermitente / Sin diurético"
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {[
                      'Sin diurético',
                      'Furosemida bolos IV',
                      'Furosemida infusión',
                      'Espironolactona + Furosemida',
                      'Hemodiálisis intermitente',
                      'TRRC (Prisma)',
                    ].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => updateSystemField('renal', 'diureticsOrRrt', d)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 6. INFECCIOSO */}
          {activeTab === 'infectious' && (
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-purple-200 dark:border-purple-900/60 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-purple-800 dark:text-purple-300 uppercase block mb-1">
                    Datos de Infección y Curva Térmica
                  </label>
                  <input
                    type="text"
                    value={data.infectious?.infectionData || ''}
                    onChange={(e) =>
                      updateSystemField('infectious', 'infectionData', e.target.value)
                    }
                    placeholder="Ej. Afebril 48h, foco pulmonar en resolución..."
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {[
                      'Afebril >48h',
                      'Febrícula vespertina',
                      'Fiebre >38.3°C',
                      'Foco pulmonar',
                      'Foco urinario',
                      'Foco abdominal',
                    ].map((inf) => (
                      <button
                        key={inf}
                        type="button"
                        onClick={() => appendChipToField('infectious', 'infectionData', inf)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-purple-50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                      >
                        +{inf}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-purple-800 dark:text-purple-300 uppercase block mb-1">
                    Reactantes de Fase Aguda y Cultivos
                  </label>
                  <input
                    type="text"
                    value={data.infectious?.acutePhaseReactants || ''}
                    onChange={(e) =>
                      updateSystemField('infectious', 'acutePhaseReactants', e.target.value)
                    }
                    placeholder="Ej. Leucos 8,900, PCR 12 mg/L, PCT 0.3, Urocultivo (-)"
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-purple-800 dark:text-purple-300 uppercase block mb-1">
                    Antibióticos en Uso y Respuesta
                  </label>
                  <input
                    type="text"
                    value={data.infectious?.antibioticsInUse || ''}
                    onChange={(e) =>
                      updateSystemField('infectious', 'antibioticsInUse', e.target.value)
                    }
                    placeholder="Ej. Meropenem 1g IV c/8h [Día 6/10] con buena respuesta"
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer Action Bar to Save & Return to Read View without clicking another patient */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(data.enabled)}
                onChange={(e) => onChange({ ...data, enabled: e.target.checked })}
                className="rounded text-teal-600 focus:ring-teal-500"
              />
              <span>Mostrar en Censo y Nota</span>
            </label>
            <button
              type="button"
              onClick={handleSaveAndReturnToReadView}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Guardar y Vista de Lectura</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
