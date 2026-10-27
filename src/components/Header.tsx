import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Calculator,
  PlusCircle,
  Stethoscope,
  Building2,
  UserCheck,
  Cloud,
  WifiOff,
  GitMerge,
  RefreshCw,
  Check,
  Edit3,
  ShieldCheck,
  X,
  PanelLeft,
} from 'lucide-react';
import { ResidentProfile } from '../types/clinical.ts';
import { PWAInstallButton } from './PWAInstallButton.tsx';

interface HeaderProps {
  currentTab: 'census' | 'printable' | 'vault';
  setCurrentTab: (tab: 'census' | 'printable' | 'vault') => void;
  profile: ResidentProfile;
  onUpdateProfileName: (newName: string) => void;
  activePatientCount: number;
  isAdmin: boolean;
  onRequestAdminMode: () => void;
  onSwitchToInternMode: () => void;
  onNewPatient: () => void;
  onLockSession: () => void;
  onQuickBackup: () => void;
  onOpenDriveSync: () => void;
  onOpenSettings: (tab?: string) => void;
  onOpenCalculators: () => void;
  onToggleMobileDrawer?: () => void;
  hasActiveCensusFilter?: boolean;
  isCalculatorOpen?: boolean;
  isOnline?: boolean;
  pendingChangesCount?: number;
  isSyncing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  profile,
  onUpdateProfileName,
  activePatientCount,
  onNewPatient,
  onOpenDriveSync,
  onOpenCalculators,
  onToggleMobileDrawer,
  hasActiveCensusFilter = false,
  isCalculatorOpen = false,
  isOnline = true,
  pendingChangesCount = 0,
  isSyncing = false,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(profile.name);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempName.trim()) {
      onUpdateProfileName(tempName.trim());
    }
    setIsEditingName(false);
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white print:hidden sticky top-0 z-[55] shadow-md w-full max-w-full overflow-x-clip">
      <div className="w-full px-2.5 sm:px-4 h-12 flex items-center justify-between gap-1.5 sm:gap-2.5 text-sm">
        {/* Zone 1: App Drawer Trigger (Mobile/Tablet < xl) + Brand + Hospital & Specialty */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
          {onToggleMobileDrawer && (
            <button
              type="button"
              onClick={() => {
                if (currentTab !== 'census') {
                  setCurrentTab('census');
                }
                onToggleMobileDrawer();
              }}
              title="Abrir panel lateral de censo, contadores y ajustes"
              aria-label="Abrir panel lateral"
              className="xl:hidden relative p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-400 border border-slate-700 shrink-0 cursor-pointer transition-colors"
            >
              <PanelLeft className="w-4 h-4" />
              {hasActiveCensusFilter && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-teal-400 ring-2 ring-slate-900" />
              )}
            </button>
          )}

          <div className="hidden sm:flex w-8 h-8 rounded-lg bg-teal-600 items-center justify-center shrink-0 shadow-xs">
            <Stethoscope className="w-4 h-4 text-white" />
          </div>

          <div className="flex items-center gap-1.5 px-1 sm:px-2 py-1 rounded-lg min-w-0">
            <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-400 shrink-0" />
            <span className="font-bold text-slate-100 text-xs sm:text-sm truncate max-w-[105px] sm:max-w-[170px] xl:max-w-[260px]">
              {profile.hospital}
            </span>
            <span className="hidden md:inline text-slate-500 shrink-0">·</span>
            <span className="hidden md:inline text-teal-400 font-semibold text-xs sm:text-sm truncate max-w-[130px] xl:max-w-none">
              {profile.service}
            </span>
          </div>
        </div>

        {/* Zone 2: Single-Row Navigation (Icon-first on Mobile/Tablet, Full Label on xl Desktop) */}
        <nav
          className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700/70 shrink-0"
          aria-label="Navegación principal"
        >
          <button
            type="button"
            onClick={() => setCurrentTab('census')}
            title={`Censo Activo (${activePatientCount} pacientes)`}
            aria-label="Censo Activo"
            className={`flex items-center justify-center gap-1.5 px-2.5 xl:px-3.5 py-1.5 text-xs sm:text-sm font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              currentTab === 'census'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span className="hidden xl:inline">Censo Activo</span>
            <span
              className={`px-1.5 py-0.2 rounded text-[11px] font-mono font-bold tabular-nums ${
                currentTab === 'census' ? 'bg-teal-800 text-teal-100' : 'bg-slate-700 text-slate-300'
              }`}
            >
              {activePatientCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('printable')}
            title="Censo Imprimible y PDF a Color"
            aria-label="Imprimible"
            className={`flex items-center justify-center gap-1.5 px-2.5 xl:px-3.5 py-1.5 text-xs sm:text-sm font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              currentTab === 'printable'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <Printer className="w-4 h-4 shrink-0" />
            <span className="hidden xl:inline">Imprimible</span>
          </button>

          <button
            type="button"
            onClick={onOpenCalculators}
            title="Calculadora de Fórmulas Médicas"
            aria-label="Abrir Calculadora de Fórmulas Médicas"
            className={`flex items-center justify-center gap-1.5 px-2.5 xl:px-3.5 py-1.5 text-xs sm:text-sm font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              isCalculatorOpen
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-cyan-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <Calculator className="w-4 h-4 shrink-0" />
            <span className="hidden xl:inline">Fórmulas</span>
          </button>

          {currentTab === 'vault' && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs sm:text-sm font-bold"
              title="Bóveda de Notas y Respaldos"
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden xl:inline">Bóveda</span>
            </span>
          )}
        </nav>

        {/* Zone 3: Active Doctor Name + Cloud Sync Indicator + Primary CTA (+ Ingreso) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {isEditingName ? (
            <form onSubmit={handleSaveName} className="flex items-center gap-1">
              <input
                type="text"
                autoFocus
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                placeholder="Médico activo"
                className="px-2 py-1 bg-slate-800 border border-teal-500 rounded-lg text-xs text-white w-28 sm:w-36 focus:outline-none"
              />
              <button
                type="submit"
                className="p-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-md cursor-pointer"
                title="Guardar nombre"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsEditingName(false)}
                className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md cursor-pointer"
                title="Cancelar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setTempName(profile.name);
                setIsEditingName(true);
              }}
              title={`Médico activo: ${profile.name} (Clic para editar)`}
              aria-label={`Médico activo: ${profile.name}`}
              className="flex items-center gap-1.5 p-2 xl:px-3 xl:py-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              <UserCheck className="w-4 h-4 text-teal-400 shrink-0" />
              <span className="hidden xl:inline font-semibold truncate max-w-[140px]">
                {profile.name}
              </span>
              <Edit3 className="w-3.5 h-3.5 text-slate-400 shrink-0 hidden xl:inline" />
            </button>
          )}

          {/* Installable Offline PWA Button */}
          <PWAInstallButton variant="header" />

          {/* Compact Cloud Sync Status */}
          <button
            type="button"
            onClick={onOpenDriveSync}
            title={
              !isOnline
                ? `Sin conexión (${pendingChangesCount} pendientes)`
                : pendingChangesCount > 0
                ? `Google Drive (${pendingChangesCount} cambios por sincronizar)`
                : 'Sincronizar con Google Drive'
            }
            aria-label="Sincronizar con Google Drive"
            className="relative p-2 text-teal-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            {!isOnline ? (
              <WifiOff className="w-4 h-4 text-amber-400" />
            ) : isSyncing ? (
              <RefreshCw className="w-4 h-4 text-teal-400 animate-spin" />
            ) : pendingChangesCount > 0 ? (
              <GitMerge className="w-4 h-4 text-teal-400" />
            ) : (
              <Cloud className="w-4 h-4 text-teal-400" />
            )}
            {pendingChangesCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-teal-500 text-slate-950 font-mono font-extrabold text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                {pendingChangesCount}
              </span>
            )}
          </button>

          {/* Primary CTA: Nuevo Ingreso */}
          <button
            type="button"
            onClick={onNewPatient}
            title="Registrar Nuevo Ingreso Hospitalario"
            aria-label="Nuevo Ingreso"
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white p-2 sm:px-3 sm:py-1.5 rounded-lg text-xs sm:text-sm font-bold shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">+ Ingreso</span>
          </button>
        </div>
      </div>
    </header>
  );
};
