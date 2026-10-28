import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FlaskConical,
  FileImage,
  Calendar,
  Clock,
  Check,
  Plus,
  ArrowLeft,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Patient, LabRecord, DiagnosticStudy, LabExtraParamValue } from '../types/clinical.ts';
import { LAB_PANELS_CATALOG } from '../data/labPanels.ts';
import { InfoPopover } from './InfoPopover.tsx';

interface DirectLabStudyModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetPatient: Patient | null;
  allPatients: Patient[];
  onSaveLab: (patientId: string, lab: LabRecord) => void;
  onSaveStudy: (patientId: string, study: DiagnosticStudy) => void;
  onBackToExpediente?: (patient: Patient) => void;
}

const IMAGING_QUICK_TEMPLATES: Array<{
  label: string;
  category: DiagnosticStudy['category'];
  title: string;
  skeleton: string;
}> = [
  {
    label: 'Rx Tórax PA/AP',
    category: 'Radiografía',
    title: 'Radiografía de Tórax PA / Portátil',
    skeleton:
      'Tejidos blandos y estructuras óseas sin alteraciones. Tráquea central. Ángulos costofrénicos y cardiofrénicos libres. Índice cardiotorácico conservado. Parénquima pulmonar con: ',
  },
  {
    label: 'TAC Cráneo Simple',
    category: 'TAC',
    title: 'TAC de Cráneo Simple',
    skeleton:
      'Adecuada diferenciación córtico-subcortical. Línea media central sin desplazamientos. Sistema ventricular simétrico. Cisternas basales libres. Sin datos de sangrado agudo intra o extraaxial. Conclusión: ',
  },
  {
    label: 'TAC Tórax AR',
    category: 'TAC',
    title: 'TAC de Tórax de Alta Resolución',
    skeleton:
      'Ventana mediastinal sin adenopatías significativas ni derrame pericárdico. Ventana pulmonar con hallazgos de: ',
  },
  {
    label: 'TAC Abdominopélvica',
    category: 'TAC',
    title: 'TAC de Abdomen y Pelvis Simple y Contrastada',
    skeleton:
      'Hígado de dimensiones y densidad conservadas, vía biliar no dilatada. Páncreas y bazo sin alteraciones. Riñones con adecuada concentración y excreción. Sin líquido libre en cavidad. Conclusión: ',
  },
  {
    label: 'USG Renal / Vías Urinarias',
    category: 'Ultrasonido',
    title: 'Ultrasonido Renal y de Vías Urinarias',
    skeleton:
      'Riñón derecho e izquierdo de tamaño conservado, adecuada relación córtico-medular, sin ectasia pielocalicial ni litiasis visible. Vejiga de pared regular. Conclusión: ',
  },
  {
    label: 'USG Hepatobiliar',
    category: 'Ultrasonido',
    title: 'Ultrasonido de Hígado y Vías Biliares',
    skeleton:
      'Hígado de ecogenicidad homogénea. Colédoco de calibre normal. Vesícula biliar con pared de __ mm, en su interior: ',
  },
  {
    label: 'Ecocardiograma TT',
    category: 'Ecocardiograma',
    title: 'Ecocardiograma Transtorácico (ETT)',
    skeleton:
      'FEVI __%. Función diastólica: __. Movilidad global y segmentaria: __. Válvulas sin vegetaciones. PSAP estimada __ mmHg. Pericardio libre.',
  },
  {
    label: 'Cultivo / Antibiograma',
    category: 'Cultivo / Microbiología',
    title: 'Reporte de Cultivo y Antibiograma',
    skeleton:
      'Muestra: __. Aislamiento: __ (>100,000 UFC/ml). Sensible a: __. Resistente a: __.',
  },
];

export const DirectLabStudyModal: React.FC<DirectLabStudyModalProps> = ({
  isOpen,
  onClose,
  targetPatient,
  allPatients,
  onSaveLab,
  onSaveStudy,
  onBackToExpediente,
}) => {
  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    targetPatient?.id || (allPatients[0]?.id ?? '')
  );

  const [entryType, setEntryType] = useState<'lab' | 'study'>('lab');

  // Common Date & Time
  const now = new Date();
  const currentDateStr = now.toISOString().split('T')[0];
  const currentTimeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  const [date, setDate] = useState<string>(currentDateStr);
  const [time, setTime] = useState<string>(currentTimeStr);

  // Selected Laboratory Panels (default to BHC, QS, Electrolitos)
  const [selectedPanelIds, setSelectedPanelIds] = useState<string[]>(['bhc', 'qs', 'electrolitos']);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [labNotes, setLabNotes] = useState<string>('');

  // Diagnostic Study Fields
  const [studyCategory, setStudyCategory] = useState<DiagnosticStudy['category']>('TAC');
  const [studyTitle, setStudyTitle] = useState<string>('');
  const [studySummary, setStudySummary] = useState<string>('');

  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (targetPatient) {
      setSelectedPatientId(targetPatient.id);
    } else if (
      !selectedPatientId ||
      !allPatients.some((p) => p.id === selectedPatientId && p.status === 'active')
    ) {
      const firstActive = allPatients.find((p) => p.status === 'active') || allPatients[0];
      setSelectedPatientId(firstActive?.id || '');
    }
  }, [targetPatient, allPatients, selectedPatientId]);

  useEffect(() => {
    if (isOpen) {
      setFieldValues({});
      setLabNotes('');
      setStudyTitle('');
      setStudySummary('');
      setSavedSuccess(false);
    }
  }, [isOpen]);

  // Handle ESC key to close only when not typing in an input/textarea/select
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const togglePanel = (panelId: string) => {
    setSelectedPanelIds((prev) =>
      prev.includes(panelId) ? prev.filter((id) => id !== panelId) : [...prev, panelId]
    );
  };

  const handleFieldChange = (key: string, val: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: val }));
  };

  // Live preview of filled parameters across all panels
  const filledPreviewItems = useMemo(() => {
    const seenKeys = new Set<string>();
    const list: Array<{ key: string; label: string; value: string; unit: string; color: string }> = [];
    for (const panel of LAB_PANELS_CATALOG) {
      for (const field of panel.fields) {
        if (seenKeys.has(field.key)) continue;
        const val = (fieldValues[field.key] || '').trim();
        if (val) {
          seenKeys.add(field.key);
          list.push({
            key: field.key,
            label: field.shortLabel,
            value: val,
            unit: field.unit,
            color: panel.accentColor,
          });
        }
      }
    }
    return list;
  }, [fieldValues]);

  if (!isOpen) return null;

  const currentPatient = allPatients.find((p) => p.id === selectedPatientId) || targetPatient;

  const parseNum = (key: string): number | undefined => {
    const raw = (fieldValues[key] || '').trim();
    if (!raw) return undefined;
    const parsed = parseFloat(raw.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const handleSaveLabSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) return;

    const extraParams: Record<string, LabExtraParamValue> = {};
    const standardStrings: Partial<LabRecord> = {};

    const seenKeys = new Set<string>();
    for (const panel of LAB_PANELS_CATALOG) {
      for (const field of panel.fields) {
        if (seenKeys.has(field.key)) continue;
        const rawVal = (fieldValues[field.key] || '').trim();
        if (!rawVal) continue;
        seenKeys.add(field.key);

        if (field.standardField) {
          (standardStrings as Record<string, unknown>)[field.standardField as string] = rawVal;
        } else {
          extraParams[field.key] = {
            label: field.shortLabel,
            value: rawVal,
            unit: field.unit,
            panel: panel.shortName,
          };
        }
      }
    }

    const newLab: LabRecord = {
      id: `lab-${Date.now()}`,
      date,
      time,
      ...standardStrings,
      hb: parseNum('hb'),
      leucos: parseNum('wbc'),
      plaquetas: parseNum('platelets'),
      glucosa: parseNum('glucose'),
      creatinina: parseNum('creatinine'),
      bun: parseNum('bun'),
      urea: parseNum('urea'),
      na: parseNum('sodium'),
      k: parseNum('potassium'),
      cl: parseNum('chloride'),
      lactato: parseNum('lactate'),
      pcr: parseNum('pcr'),
      procalcitonina: parseNum('pct'),
      ph: parseNum('ph'),
      po2: parseNum('po2'),
      pco2: parseNum('pco2'),
      hco3: parseNum('hco3'),
      selectedPanels: selectedPanelIds,
      extraParams: Object.keys(extraParams).length > 0 ? extraParams : undefined,
      otherNotes: labNotes.trim() || undefined,
      notes: labNotes.trim() || undefined,
      isNew: true,
    };

    onSaveLab(selectedPatientId, newLab);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 700);
  };

  const handleSaveStudySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !studyTitle.trim() || !studySummary.trim()) return;

    const newStudy: DiagnosticStudy = {
      id: `study-${Date.now()}`,
      date,
      time,
      category: studyCategory,
      title: studyTitle.trim(),
      summary: studySummary.trim(),
      isNew: true,
    };

    onSaveStudy(selectedPatientId, newStudy);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 700);
  };

  const activePanels = LAB_PANELS_CATALOG.filter((p) => selectedPanelIds.includes(p.id));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[93vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Bar */}
        <div className="px-4 sm:px-5 py-3 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-teal-500/20 border border-teal-500/30 rounded-xl">
              {entryType === 'lab' ? (
                <FlaskConical className="w-5 h-5 text-teal-400" />
              ) : (
                <FileImage className="w-5 h-5 text-cyan-400" />
              )}
            </span>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold leading-tight">
                Ingreso Rápido de Paraclínicos por Paneles
              </h2>
              {/* Color Symbol Badge + Popover instead of noisy text banner */}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-extrabold">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                DISTINTIVO NUEVO
              </span>
              <InfoPopover
                title="Sistema de Paneles y Simbología de Color"
                content="1) Selecciona arriba los grupos o paneles de laboratorio solicitados (Química Sanguínea, PFH, Función Renal, Gasometría, Perfil Tiroideo, Suprarrenal, Lípidos, Coagulación, Marcadores Tumorales, etc.). 2) Solo los parámetros que llenes se reportarán en el Censo y en la Nota de Evolución. 3) El punto ámbar (NUEVO) indica que el estudio destacará en el censo hasta que redactes la siguiente nota."
              />
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
            title="Cerrar cuadro (Esc)"
          >
            <X className="w-4 h-4" />
            <span>Cerrar</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Patient + Date/Time Compact Header Bar */}
          <div className="bg-slate-50 dark:bg-slate-800/70 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-6">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Paciente Seleccionado
              </label>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-teal-500"
              >
                {allPatients
                  .filter((p) => p.status === 'active')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.bed}] {p.name} ({p.age}a) • {p.service}
                    </option>
                  ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
                <Calendar className="w-3 h-3 text-teal-600" /> Fecha del Reporte
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"
              />
            </div>

            <div className="md:col-span-3">
              <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
                <Clock className="w-3 h-3 text-teal-600" /> Hora de Emisión
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"
              />
            </div>
          </div>

          {/* Type Selector Tabs */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
            <div className="flex">
              <button
                type="button"
                onClick={() => setEntryType('lab')}
                className={`flex items-center gap-2 px-4 py-2 font-bold text-xs border-b-2 transition-all cursor-pointer ${
                  entryType === 'lab'
                    ? 'border-teal-600 text-teal-600 dark:text-teal-400 bg-teal-50/50 dark:bg-teal-950/20'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <FlaskConical className="w-4 h-4" />
                <span>Paneles de Laboratorio ({selectedPanelIds.length} activos)</span>
              </button>
              <button
                type="button"
                onClick={() => setEntryType('study')}
                className={`flex items-center gap-2 px-4 py-2 font-bold text-xs border-b-2 transition-all cursor-pointer ${
                  entryType === 'study'
                    ? 'border-cyan-600 text-cyan-600 dark:text-cyan-400 bg-cyan-50/50 dark:bg-cyan-950/20'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <FileImage className="w-4 h-4" />
                <span>Estudio de Imagen / Gabinete / Cultivos</span>
              </button>
            </div>

            {entryType === 'lab' && (
              <div className="hidden sm:flex items-center gap-1.5 pr-1">
                <button
                  type="button"
                  onClick={() => setSelectedPanelIds(['bhc', 'qs', 'electrolitos'])}
                  className="px-2 py-1 text-[10px] font-bold rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Rutina Ingreso (BHC+QS+ES6)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPanelIds(LAB_PANELS_CATALOG.map((p) => p.id))}
                  className="px-2 py-1 text-[10px] font-bold rounded bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 cursor-pointer"
                >
                  Mostrar Todos (14)
                </button>
              </div>
            )}
          </div>

          {/* Forms */}
          {entryType === 'lab' ? (
            <form id="direct-lab-form" onSubmit={handleSaveLabSubmit} className="space-y-4 text-xs">
              {/* Panel Selector Chips */}
              <div className="bg-slate-50/80 dark:bg-slate-850 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-teal-600" />
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      Selecciona los Conjuntos / Paneles Solicitados ({selectedPanelIds.length}/14):
                    </span>
                    <InfoPopover
                      title="Selección Modular de Paneles"
                      content="Activa uno o varios conjuntos de laboratorio (ej. Química Sanguínea, PFH, Gasometría, Perfil Tiroideo, Suprarrenal, Lípidos). Al seleccionarlos se despliegan todos sus parámetros constituyentes; únicamente los campos con valor capturado se incluirán en el censo y en la nota."
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {LAB_PANELS_CATALOG.map((panel) => {
                    const isSelected = selectedPanelIds.includes(panel.id);
                    const filledCount = panel.fields.filter(
                      (f) => (fieldValues[f.key] || '').trim().length > 0
                    ).length;

                    return (
                      <button
                        key={panel.id}
                        type="button"
                        onClick={() => togglePanel(panel.id)}
                        style={
                          isSelected
                            ? {
                                backgroundColor: `${panel.accentColor}15`,
                                borderColor: panel.accentColor,
                                color: panel.accentColor,
                              }
                            : undefined
                        }
                        className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'shadow-xs ring-1 ring-current/20'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                        }`}
                      >
                        <span
                          style={{ backgroundColor: panel.accentColor }}
                          className="w-2 h-2 rounded-full shrink-0"
                        />
                        <span>{panel.shortName}</span>
                        {filledCount > 0 && (
                          <span
                            style={{ backgroundColor: panel.accentColor }}
                            className="text-white text-[9.5px] font-mono px-1.5 py-0.2 rounded-full font-extrabold"
                          >
                            {filledCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Summary of Filled Parameters to Report */}
              {filledPreviewItems.length > 0 && (
                <div className="px-3 py-2 bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/70 rounded-xl flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-800 dark:text-teal-300 mr-1">
                    Se reportarán ({filledPreviewItems.length}):
                  </span>
                  {filledPreviewItems.map((item) => (
                    <span
                      key={item.key}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800 text-[10.5px] font-mono font-bold text-slate-800 dark:text-slate-200"
                    >
                      <span
                        style={{ backgroundColor: item.color }}
                        className="w-1.5 h-1.5 rounded-full"
                      />
                      <span>{item.label}:</span>
                      <strong className="text-teal-700 dark:text-teal-300">{item.value}</strong>
                      {item.unit && <span className="text-[9px] text-slate-400">{item.unit}</span>}
                    </span>
                  ))}
                </div>
              )}

              {/* Active Panels Fields Grid */}
              {activePanels.length === 0 ? (
                <div className="p-8 text-center text-slate-400 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                  Selecciona al menos un panel de laboratorio arriba para desplegar sus parámetros.
                </div>
              ) : (
                <div className="space-y-4">
                  {activePanels.map((panel) => (
                    <div
                      key={panel.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/90 space-y-2.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            style={{ backgroundColor: panel.accentColor }}
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                          />
                          <h4 className="font-extrabold text-slate-900 dark:text-white text-xs">
                            {panel.name}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-medium">
                            ({panel.category})
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          Llena solo los reportados
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                        {panel.fields.map((field) => {
                          const val = fieldValues[field.key] || '';
                          const isFilled = val.trim().length > 0;
                          return (
                            <div key={`${panel.id}-${field.key}`}>
                              <label
                                className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-between mb-0.5 truncate"
                                title={`${field.label} ${field.unit ? `(${field.unit})` : ''}`}
                              >
                                <span className="truncate">{field.label}</span>
                                {field.unit && (
                                  <span className="text-[9px] text-slate-400 font-mono ml-1 shrink-0">
                                    {field.unit}
                                  </span>
                                )}
                              </label>
                              <input
                                type="text"
                                placeholder={field.placeholder}
                                value={val}
                                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                                className={`w-full px-2.5 py-1.5 rounded-lg font-mono text-xs border transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                                  isFilled
                                    ? 'bg-teal-50/60 dark:bg-teal-950/30 border-teal-400 dark:border-teal-700 font-bold text-slate-900 dark:text-white'
                                    : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                                }`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Additional Free-Text Lab Notes */}
              <div className="pt-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Observaciones Adicionales de Laboratorio / Parámetros Especiales:
                </label>
                <input
                  type="text"
                  placeholder="ej. Muestra ligeramente hemolizada, control seriado en 6h..."
                  value={labNotes}
                  onChange={(e) => setLabNotes(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-sans text-xs"
                />
              </div>
            </form>
          ) : (
            /* Form: STUDY ENTRY (Report-based + Quick Modality Templates) */
            <form id="direct-study-form" onSubmit={handleSaveStudySubmit} className="space-y-4 text-xs">
              {/* Quick Clinical Templates Bar */}
              <div className="bg-cyan-50/50 dark:bg-cyan-950/20 p-3 rounded-xl border border-cyan-200/80 dark:border-cyan-900/50 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
                  <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-cyan-900 dark:text-cyan-300">
                    Plantillas Rápidas de Reporte por Modalidad:
                  </span>
                  <InfoPopover
                    title="Plantillas de Imagen y Gabinete"
                    content="Haz clic en cualquier estudio frecuente para prellenar su estructura de reporte estándar y editar únicamente los hallazgos patológicos."
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {IMAGING_QUICK_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => {
                        setStudyCategory(tpl.category);
                        setStudyTitle(tpl.title);
                        if (!studySummary.trim()) {
                          setStudySummary(tpl.skeleton);
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-cyan-600 hover:text-white text-slate-700 dark:text-slate-300 border border-cyan-200 dark:border-cyan-800 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      + {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Modalidad / Categoría *
                  </label>
                  <select
                    value={studyCategory}
                    onChange={(e) => setStudyCategory(e.target.value as DiagnosticStudy['category'])}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold"
                  >
                    <option value="TAC">TAC (Tomografía Computarizada)</option>
                    <option value="Radiografía">Radiografía (Rx Tórax / Simple)</option>
                    <option value="Ultrasonido">Ultrasonido (USG / Doppler)</option>
                    <option value="Ecocardiograma">Ecocardiograma Transtorácico</option>
                    <option value="Cultivo / Microbiología">Cultivo / Microbiología / Antibiograma</option>
                    <option value="Endoscopía">Endoscopía / Colonoscopía</option>
                    <option value="Resonancia Magnética">Resonancia Magnética</option>
                    <option value="Laboratorio Especial">Laboratorio Especial (LCR, Biopsia)</option>
                    <option value="Otro Estudio">Otro Estudio Diagnóstico (ECG, EEG)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Título o Nombre del Estudio *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej. TAC simple y contrastada de abdomen y pelvis"
                    value={studyTitle}
                    onChange={(e) => setStudyTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Resumen de Hallazgos y Conclusión Diagnóstica *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe los hallazgos relevantes y la conclusión diagnóstica que se integrará en el Censo y en la Nota de Evolución..."
                  value={studySummary}
                  onChange={(e) => setStudySummary(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-sans leading-relaxed"
                />
              </div>
            </form>
          )}
        </div>

        {/* STICKY FOOTER ACTIONS */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Salir sin guardar
            </button>
            {currentPatient && onBackToExpediente && (
              <button
                type="button"
                onClick={() => onBackToExpediente(currentPatient)}
                className="px-3.5 py-2 bg-teal-50 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-800 text-teal-800 dark:text-teal-300 font-bold rounded-xl text-xs flex items-center gap-1.5 hover:bg-teal-100 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Regresar al Expediente</span>
              </button>
            )}
          </div>

          <button
            type="submit"
            form={entryType === 'lab' ? 'direct-lab-form' : 'direct-study-form'}
            disabled={savedSuccess}
            className={`flex items-center gap-2 text-white px-5 py-2 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer ${
              entryType === 'lab'
                ? 'bg-teal-600 hover:bg-teal-700 shadow-teal-500/20'
                : 'bg-cyan-600 hover:bg-cyan-700 shadow-cyan-500/20'
            }`}
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-200" />
                <span>¡Reportado en Censo y Nota!</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>
                  {entryType === 'lab'
                    ? `Guardar Parámetros Capturados (${filledPreviewItems.length})`
                    : 'Guardar Estudio de Gabinete'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
