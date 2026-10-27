import React, { useState } from 'react';
import { ShieldAlert, X, AlertCircle } from 'lucide-react';
import { verifyStoredPin } from '../utils/storage.ts';

interface AdminAuthModalProps {
  isOpen: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  title = 'Autorización de Residente Titular',
  description = 'Esta acción protegida (eliminación de datos, egreso o ajustes de fondo) requiere el PIN Maestro del Administrador para evitar pérdidas o sabotajes en estaciones compartidas.',
  onClose,
  onSuccess,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyStoredPin(pin)) {
      setError(false);
      setPin('');
      onSuccess();
    } else {
      setError(true);
      setPin('');
    }
  };

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(false);
      if (nextPin.length === 4) {
        if (verifyStoredPin(nextPin)) {
          setTimeout(() => {
            setPin('');
            onSuccess();
          }, 150);
        } else {
          setError(true);
          setTimeout(() => setPin(''), 500);
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative text-slate-900 dark:text-slate-100 animate-in fade-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-500 mx-auto flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>

          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {title}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {description}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* PIN Dots */}
            <div className="flex justify-center gap-3 my-2">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                    pin.length > idx
                      ? 'bg-rose-600 border-rose-600 scale-110 shadow-sm'
                      : 'border-slate-300 dark:border-slate-700 bg-transparent'
                  }`}
                />
              ))}
            </div>

            {error && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-rose-500 font-semibold bg-rose-500/10 py-1.5 px-3 rounded-lg border border-rose-500/20">
                <AlertCircle className="w-4 h-4" />
                <span>PIN incorrecto. Autorización denegada.</span>
              </div>
            )}

            {/* Quick Keypad */}
            <div className="grid grid-cols-3 gap-2 max-w-[200px] mx-auto pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleDigit(digit)}
                  className="h-10 text-base font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 active:scale-95 transition-transform"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPin('')}
                className="h-10 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Borrar
              </button>
              <button
                type="button"
                onClick={() => handleDigit('0')}
                className="h-10 text-base font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 active:scale-95 transition-transform"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => setPin((prev) => prev.slice(0, -1))}
                className="h-10 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                ⌫
              </button>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
              💡 <em>PIN de fábrica inicial: <strong>1234</strong> (modificable en la Bóveda de Seguridad).</em>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
