import React, { useState } from 'react';
import { Lock, Unlock, ArrowRight } from 'lucide-react';
import { verifyStoredPin, getStoredPinHash } from '../utils/storage.ts';
import { ResidentProfile } from '../types/clinical.ts';

interface PinLockScreenProps {
  profile: ResidentProfile;
  onUnlock: () => void;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({ profile, onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const hasPinConfigured = Boolean(getStoredPinHash());

  const handleDigit = (digit: string) => {
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(false);
      // Auto check if length 4
      if (nextPin.length === 4 && hasPinConfigured) {
        if (verifyStoredPin(nextPin)) {
          onUnlock();
        }
      }
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
    setError(false);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!hasPinConfigured) {
      onUnlock();
      return;
    }

    if (verifyStoredPin(pin)) {
      onUnlock();
    } else {
      setError(true);
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-4 select-none">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 bg-gradient-to-tr from-teal-500/20 to-cyan-500/20 border border-teal-500/30 rounded-2xl mx-auto flex items-center justify-center text-teal-400">
          <Lock className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Sesión Médica Protegida</h2>
          <p className="text-xs text-slate-400 mt-1">
            {profile.name} • {profile.residencyYear}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">{profile.hospital}</p>
        </div>

        {hasPinConfigured ? (
          <div className="space-y-4">
            {/* PIN display dots */}
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full transition-all ${
                    pin.length > idx
                      ? 'bg-teal-400 scale-110 shadow-sm shadow-teal-400/50'
                      : 'border-2 border-slate-700 bg-slate-800'
                  }`}
                />
              ))}
            </div>

            {error && (
              <p className="text-xs text-rose-400 font-semibold animate-shake">
                PIN incorrecto. Intenta de nuevo.
              </p>
            )}

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2.5 max-w-[240px] mx-auto pt-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDigit(d)}
                  className="h-12 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-mono text-lg font-bold rounded-xl transition-all border border-slate-700/60"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={handleBackspace}
                className="h-12 bg-slate-800/60 hover:bg-slate-700 active:scale-95 text-slate-400 text-xs font-semibold rounded-xl transition-all"
              >
                Borrar
              </button>
              <button
                type="button"
                onClick={() => handleDigit('0')}
                className="h-12 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-mono text-lg font-bold rounded-xl transition-all border border-slate-700/60"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleSubmit()}
                className="h-12 bg-teal-600 hover:bg-teal-500 active:scale-95 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              No tienes un PIN configurado actualmente. Haz clic abajo para reanudar tu sesión o configura uno en la Bóveda.
            </p>
            <button
              onClick={onUnlock}
              className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-teal-500/20"
            >
              <Unlock className="w-4 h-4" />
              <span>Desbloquear y Continuar</span>
            </button>
          </div>
        )}

        <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-800">
          Protección activa contra intromisiones en computadoras compartidas del hospital.
        </div>
      </div>
    </div>
  );
};
