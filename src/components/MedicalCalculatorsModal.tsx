import React, { useState, useEffect } from 'react';
import {
  Calculator,
  Copy,
  Check,
  Search,
  Plus,
  Trash2,
  X,
  Sliders,
} from 'lucide-react';
import {
  calculateCKDEPI,
  calculateCURB65,
  evaluateCustomFormula,
} from '../utils/clinicalLogic.ts';
import {
  CustomMedicalFormula,
  CustomFormulaVariable,
  ResidentProfile,
} from '../types/clinical.ts';
import { defaultCustomFormulas } from '../data/seedPatients.ts';
import { InfoPopover } from './InfoPopover.tsx';

interface MedicalCalculatorsModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  profile?: ResidentProfile;
  isAdmin?: boolean;
  onUpdateProfile?: (updated: ResidentProfile) => void;
}

export const MedicalCalculatorsModal: React.FC<MedicalCalculatorsModalProps> = ({
  isOpen = true,
  onClose,
  profile,
  isAdmin = true,
  onUpdateProfile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormulaId, setSelectedFormulaId] = useState<string>('builtin-ckd');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);

  // CKD-EPI 2021 Built-in State
  const [ckdCr, setCkdCr] = useState<number>(1.2);
  const [ckdAge, setCkdAge] = useState<number>(65);
  const [ckdGender, setCkdGender] = useState<'male' | 'female'>('male');

  // CURB-65 Built-in State
  const [curbConfusion, setCurbConfusion] = useState(false);
  const [curbBun, setCurbBun] = useState(true);
  const [curbRr, setCurbRr] = useState(false);
  const [curbBp, setCurbBp] = useState(false);
  const [curbAge, setCurbAge] = useState(true);

  // Custom Formulas Repertoire
  const customFormulas: CustomMedicalFormula[] =
    profile?.customFormulas && profile.customFormulas.length > 0
      ? profile.customFormulas
      : defaultCustomFormulas;

  // Dynamic Variable Values for the active custom formula
  const [variableValues, setVariableValues] = useState<Record<string, number>>({});

  // Formula Builder Form State
  const [newFormulaName, setNewFormulaName] = useState('');
  const [newFormulaSpecialty, setNewFormulaSpecialty] = useState(profile?.service || 'Medicina Interna');
  const [newFormulaDesc, setNewFormulaDesc] = useState('');
  const [newFormulaVars, setNewFormulaVars] = useState<CustomFormulaVariable[]>([
    { symbol: 'x', label: 'Variable 1', defaultValue: 10 },
    { symbol: 'y', label: 'Variable 2', defaultValue: 5 },
  ]);
  const [newFormulaExpr, setNewFormulaExpr] = useState('x + y');
  const [newFormulaUnit, setNewFormulaUnit] = useState('unidades');
  const [newFormulaHint, setNewFormulaHint] = useState('');

  // Sync default variable values when selecting a custom formula
  useEffect(() => {
    const found = customFormulas.find((f) => f.id === selectedFormulaId);
    if (found) {
      const initialVars: Record<string, number> = {};
      found.variables.forEach((v) => {
        initialVars[v.symbol] = v.defaultValue;
      });
      setVariableValues(initialVars);
    }
  }, [selectedFormulaId, customFormulas.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && onClose) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2200);
  };

  // All searchable items (2 special built-ins + custom repertoire)
  const allItems = [
    {
      id: 'builtin-ckd',
      name: 'TFG Estimada (CKD-EPI 2021)',
      specialty: 'Nefrología / MI',
      isBuiltin: true,
    },
    {
      id: 'builtin-curb',
      name: 'Escala CURB-65 (Neumonía)',
      specialty: 'Neumología / MI',
      isBuiltin: true,
    },
    ...customFormulas.map((f) => ({
      id: f.id,
      name: f.name,
      specialty: f.specialty,
      isBuiltin: false,
    })),
  ];

  const filteredItems = allItems.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return item.name.toLowerCase().includes(q) || item.specialty.toLowerCase().includes(q);
  });

  const activeCustomFormula = customFormulas.find((f) => f.id === selectedFormulaId);

  const handleAddBuilderVar = () => {
    const nextIdx = newFormulaVars.length + 1;
    setNewFormulaVars([
      ...newFormulaVars,
      { symbol: `v${nextIdx}`, label: `Variable ${nextIdx}`, defaultValue: 1 },
    ]);
  };

  const handleRemoveBuilderVar = (idx: number) => {
    if (newFormulaVars.length <= 1) return;
    setNewFormulaVars(newFormulaVars.filter((_, i) => i !== idx));
  };

  const handleUpdateBuilderVar = (
    idx: number,
    field: keyof CustomFormulaVariable,
    value: string | number
  ) => {
    setNewFormulaVars(
      newFormulaVars.map((v, i) => {
        if (i !== idx) return v;
        if (field === 'symbol') {
          return {
            ...v,
            symbol: String(value)
              .replace(/[^a-zA-Z0-9_]/g, '')
              .toLowerCase(),
          };
        }
        if (field === 'defaultValue') {
          return { ...v, defaultValue: parseFloat(String(value)) || 0 };
        }
        return { ...v, [field]: String(value) };
      })
    );
  };

  const handleSaveNewFormula = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFormulaName.trim() || !newFormulaExpr.trim()) return;

    const created: CustomMedicalFormula = {
      id: `form-custom-${Date.now()}`,
      name: newFormulaName.trim(),
      specialty: newFormulaSpecialty.trim() || 'General',
      description: newFormulaDesc.trim() || undefined,
      variables: newFormulaVars.filter((v) => v.symbol.trim() !== ''),
      expression: newFormulaExpr.trim(),
      resultUnit: newFormulaUnit.trim() || 'pts',
      interpretationHint: newFormulaHint.trim() || undefined,
    };

    const updatedList = [created, ...customFormulas];
    if (profile && onUpdateProfile) {
      onUpdateProfile({
        ...profile,
        customFormulas: updatedList,
      });
    }
    setSelectedFormulaId(created.id);
    setShowBuilder(false);
    setNewFormulaName('');
    setNewFormulaDesc('');
    setNewFormulaHint('');
  };

  const handleDeleteCustomFormula = (idToDelete: string) => {
    const updatedList = customFormulas.filter((f) => f.id !== idToDelete);
    if (profile && onUpdateProfile) {
      onUpdateProfile({
        ...profile,
        customFormulas: updatedList,
      });
    }
    if (selectedFormulaId === idToDelete) {
      setSelectedFormulaId('builtin-ckd');
    }
  };

  const ckdResult = calculateCKDEPI(ckdCr, ckdAge, ckdGender);
  const curbResult = calculateCURB65({
    confusion: curbConfusion,
    bunAbove19: curbBun,
    rrAbove30: curbRr,
    hypotension: curbBp,
    age65OrMore: curbAge,
  });

  // Preview evaluation for formula builder
  const builderPreviewVars: Record<string, number> = {};
  newFormulaVars.forEach((v) => {
    if (v.symbol) builderPreviewVars[v.symbol] = v.defaultValue;
  });
  const builderPreviewResult = evaluateCustomFormula(newFormulaExpr, builderPreviewVars);

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Top Modal Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg">
              <Calculator className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Fórmulas de Medicina</span>
              <InfoPopover
                title="Repertorio Personalizable de Fórmulas"
                content="Busca cualquier fórmula por nombre o especialidad, calcula al instante sin cerrar tu nota médica y copia el resultado con 1 clic. El Administrador puede crear o personalizar nuevas fórmulas."
              />
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBuilder(!showBuilder)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                showBuilder
                  ? 'bg-slate-700 text-white'
                  : 'bg-teal-600 hover:bg-teal-500 text-white shadow-xs'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showBuilder ? 'Ver Calculadoras' : 'Crear Fórmula'}</span>
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Cerrar</span>
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        {showBuilder ? (
          /* FORMULA BUILDER VIEW */
          <form
            onSubmit={handleSaveNewFormula}
            className="flex-1 overflow-y-auto p-5 space-y-4 text-xs bg-slate-50/50 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-sm">
                <Sliders className="w-4 h-4 text-teal-500" />
                <span>Crear Nueva Fórmula Médica para el Repertorio</span>
                <InfoPopover
                  title="¿Cómo crear una fórmula?"
                  content="1. Define los símbolos de tus variables (ej. 'peso', 'talla', 'na'). 2. Escribe la ecuación usando +, -, *, /, ^ y paréntesis, por ejemplo: peso / ((talla / 100) ^ 2)."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Nombre de la Fórmula *
                </label>
                <input
                  type="text"
                  required
                  value={newFormulaName}
                  onChange={(e) => setNewFormulaName(e.target.value)}
                  placeholder="Ej. Índice de Kirby (PaO2/FiO2), Déficit de Agua Libre, IMC"
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Especialidad / Área
                </label>
                <input
                  type="text"
                  value={newFormulaSpecialty}
                  onChange={(e) => setNewFormulaSpecialty(e.target.value)}
                  placeholder="Ej. Medicina Interna, Cirugía, UCI"
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            {/* Variables Definition */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  1. Variables de Entrada (Símbolos para usar en la ecuación)
                </span>
                <button
                  type="button"
                  onClick={handleAddBuilderVar}
                  className="text-teal-600 dark:text-teal-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Agregar Variable</span>
                </button>
              </div>

              <div className="space-y-2">
                {newFormulaVars.map((v, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-3">
                      <input
                        type="text"
                        value={v.symbol}
                        onChange={(e) => handleUpdateBuilderVar(idx, 'symbol', e.target.value)}
                        placeholder="símbolo (ej. na)"
                        className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono font-bold text-teal-700 dark:text-teal-300"
                        required
                      />
                    </div>
                    <div className="col-span-6">
                      <input
                        type="text"
                        value={v.label}
                        onChange={(e) => handleUpdateBuilderVar(idx, 'label', e.target.value)}
                        placeholder="Nombre descriptivo (ej. Sodio sérico mEq/L)"
                        className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        step="any"
                        value={v.defaultValue}
                        onChange={(e) => handleUpdateBuilderVar(idx, 'defaultValue', e.target.value)}
                        placeholder="Valor prueba"
                        className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono text-center"
                      />
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveBuilderVar(idx)}
                        className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                        title="Quitar variable"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mathematical Expression & Unit */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  2. Ecuación Matemática * (usa los símbolos de arriba y +, -, *, /, ^, paréntesis)
                </label>
                <input
                  type="text"
                  required
                  value={newFormulaExpr}
                  onChange={(e) => setNewFormulaExpr(e.target.value)}
                  placeholder="Ej. (tas + 2 * tad) / 3"
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Unidad del Resultado
                </label>
                <input
                  type="text"
                  value={newFormulaUnit}
                  onChange={(e) => setNewFormulaUnit(e.target.value)}
                  placeholder="Ej. mmHg, mEq/L, ml/min"
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Valores de Referencia / Interpretación (Opcional)
                </label>
                <input
                  type="text"
                  value={newFormulaHint}
                  onChange={(e) => setNewFormulaHint(e.target.value)}
                  placeholder="Ej. Normal: 275 - 295 mOsm/kg"
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              {/* Live Formula Validation Box */}
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Resultado de prueba en vivo:
                </span>
                {builderPreviewResult !== null ? (
                  <span className="font-mono font-extrabold text-sm text-teal-600 dark:text-teal-400">
                    {builderPreviewResult} {newFormulaUnit}
                  </span>
                ) : (
                  <span className="text-rose-500 font-bold text-[11px]">
                    Revisa la sintaxis o variables
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBuilder(false)}
                className="px-4 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={builderPreviewResult === null}
                className="px-5 py-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg font-bold shadow-xs cursor-pointer"
              >
                Guardar Fórmula en el Repertorio
              </button>
            </div>
          </form>
        ) : (
          /* MAIN SEARCHABLE REPERTOIRE & CALCULATOR VIEW */
          <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden min-h-[420px]">
            {/* Left Sidebar: Search & Formula List */}
            <div className="md:col-span-5 border-r border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex flex-col overflow-hidden">
              <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar fórmula o especialidad..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-200/60 dark:divide-slate-800/60">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedFormulaId(item.id)}
                    className={`px-3.5 py-2.5 text-xs cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                      selectedFormulaId === item.id
                        ? 'bg-teal-600 text-white font-bold'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate">{item.name}</div>
                      <div
                        className={`text-[10px] ${
                          selectedFormulaId === item.id ? 'text-teal-100' : 'text-slate-400'
                        }`}
                      >
                        {item.specialty}
                      </div>
                    </div>
                    {!item.isBuiltin && isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCustomFormula(item.id);
                        }}
                        title="Eliminar fórmula del repertorio"
                        className={`p-1 rounded hover:bg-rose-500/20 ${
                          selectedFormulaId === item.id
                            ? 'text-teal-100 hover:text-white'
                            : 'text-slate-400 hover:text-rose-500'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right Pane: Active Formula Inputs & Instant Output */}
            <div className="md:col-span-7 p-5 overflow-y-auto flex flex-col justify-between space-y-5 text-xs">
              {selectedFormulaId === 'builtin-ckd' ? (
                <>
                  <div className="space-y-4">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                        TFG Estimada (CKD-EPI 2021)
                      </h3>
                      <InfoPopover content="Ecuación estándar actual KDIGO sin variable de raza para estadificación de ERC y ajuste de fármacos." />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                          Creatinina Sérica (mg/dL)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={ckdCr}
                          onChange={(e) => setCkdCr(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                          Edad (años)
                        </label>
                        <input
                          type="number"
                          value={ckdAge}
                          onChange={(e) => setCkdAge(parseInt(e.target.value, 10) || 0)}
                          className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex gap-4 pt-1">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="ckdGender"
                          checked={ckdGender === 'male'}
                          onChange={() => setCkdGender('male')}
                        />
                        <span>Masculino</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="ckdGender"
                          checked={ckdGender === 'female'}
                          onChange={() => setCkdGender('female')}
                        />
                        <span>Femenino</span>
                      </label>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] font-bold uppercase text-teal-600 dark:text-teal-400">
                        Resultado eGFR
                      </span>
                      <span className="text-2xl font-mono font-extrabold text-slate-900 dark:text-white tabular-nums">
                        {ckdResult} <span className="text-xs font-normal text-slate-500">ml/min/1.73m²</span>
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300">
                      <strong>Estadio KDIGO:</strong>{' '}
                      {ckdResult >= 90
                        ? 'G1 (>=90)'
                        : ckdResult >= 60
                        ? 'G2 (60-89)'
                        : ckdResult >= 45
                        ? 'G3a (45-59)'
                        : ckdResult >= 30
                        ? 'G3b (30-44)'
                        : ckdResult >= 15
                        ? 'G4 (15-29)'
                        : 'G5 (<15 Falla renal)'}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          `TFG (CKD-EPI 2021): ${ckdResult} ml/min/1.73m² (Cr ${ckdCr} mg/dL).`,
                          'ckd'
                        )
                      }
                      className="w-full flex items-center justify-center gap-1.5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      {copiedText === 'ckd' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedText === 'ckd' ? '¡Copiado al portapapeles!' : 'Copiar para la Nota'}</span>
                    </button>
                  </div>
                </>
              ) : selectedFormulaId === 'builtin-curb' ? (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                        Escala CURB-65 (Neumonía)
                      </h3>
                      <InfoPopover content="Estratificación de severidad y mortalidad en Neumonía Adquirida en la Comunidad." />
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { label: 'C - Confusión mental aguda', val: curbConfusion, set: setCurbConfusion },
                        { label: 'U - BUN > 19 mg/dL o Urea > 42 mg/dL', val: curbBun, set: setCurbBun },
                        { label: 'R - Frecuencia respiratoria >= 30 rpm', val: curbRr, set: setCurbRr },
                        { label: 'B - TAS < 90 mmHg o TAD <= 60 mmHg', val: curbBp, set: setCurbBp },
                        { label: '65 - Edad >= 65 años', val: curbAge, set: setCurbAge },
                      ].map((item, idx) => (
                        <label
                          key={idx}
                          className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={item.val}
                            onChange={(e) => item.set(e.target.checked)}
                            className="rounded text-teal-600"
                          />
                          <span>{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] font-bold uppercase text-teal-600 dark:text-teal-400">
                        Puntaje CURB-65
                      </span>
                      <span className="text-2xl font-mono font-extrabold text-slate-900 dark:text-white tabular-nums">
                        {curbResult.score} pts
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300">
                      Riesgo: {curbResult.mortalityRisk} · {curbResult.recommendation}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          `CURB-65: ${curbResult.score} pts (Riesgo ${curbResult.mortalityRisk}, ${curbResult.recommendation}).`,
                          'curb'
                        )
                      }
                      className="w-full flex items-center justify-center gap-1.5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      {copiedText === 'curb' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedText === 'curb' ? '¡Copiado!' : 'Copiar para la Nota'}</span>
                    </button>
                  </div>
                </>
              ) : activeCustomFormula ? (
                /* DYNAMIC CUSTOM FORMULA RENDERER */
                (() => {
                  const calcVal = evaluateCustomFormula(activeCustomFormula.expression, variableValues);
                  const copySummary = `${activeCustomFormula.name}: ${
                    calcVal !== null ? calcVal : '-'
                  } ${activeCustomFormula.resultUnit} (${activeCustomFormula.variables
                    .map((v) => `${v.symbol.toUpperCase()} ${variableValues[v.symbol] ?? v.defaultValue}`)
                    .join(', ')}).`;

                  return (
                    <>
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                                {activeCustomFormula.name}
                              </h3>
                              {activeCustomFormula.description && (
                                <InfoPopover content={activeCustomFormula.description} />
                              )}
                            </div>
                            <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                              {activeCustomFormula.expression}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {activeCustomFormula.variables.map((v) => (
                            <div key={v.symbol}>
                              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                                {v.label}{' '}
                                <span className="text-[10px] font-mono text-teal-600">({v.symbol})</span>
                              </label>
                              <input
                                type="number"
                                step="any"
                                value={variableValues[v.symbol] ?? v.defaultValue}
                                onChange={(e) =>
                                  setVariableValues({
                                    ...variableValues,
                                    [v.symbol]: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[11px] font-bold uppercase text-teal-600 dark:text-teal-400">
                            Resultado Calculado
                          </span>
                          <span className="text-2xl font-mono font-extrabold text-slate-900 dark:text-white tabular-nums">
                            {calcVal !== null ? calcVal : '-'}{' '}
                            <span className="text-xs font-normal text-slate-500">
                              {activeCustomFormula.resultUnit}
                            </span>
                          </span>
                        </div>
                        {activeCustomFormula.interpretationHint && (
                          <div className="text-[11px] text-slate-600 dark:text-slate-300">
                            <strong>Referencia:</strong> {activeCustomFormula.interpretationHint}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopy(copySummary, activeCustomFormula.id)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          {copiedText === activeCustomFormula.id ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                          <span>
                            {copiedText === activeCustomFormula.id
                              ? '¡Copiado al portapapeles!'
                              : 'Copiar para la Nota'}
                          </span>
                        </button>
                      </div>
                    </>
                  );
                })()
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
