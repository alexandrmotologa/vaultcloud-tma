import React, { useState } from 'react';
import { KeyRound, Delete, X, Clock } from 'lucide-react';

interface PinLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlockWithPin?: (pin: string) => boolean;
  onSetPin?: (pin: string) => void;
  isSettingPin?: boolean;
  currentAutoLockMinutes?: number;
  onSetAutoLockMinutes?: (minutes: number) => void;
  onFallbackToPassphrase?: () => void;
}

export const PinLockModal: React.FC<PinLockModalProps> = ({
  isOpen,
  onClose,
  onUnlockWithPin,
  onSetPin,
  isSettingPin = false,
  currentAutoLockMinutes = 5,
  onSetAutoLockMinutes,
  onFallbackToPassphrase,
}) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    setError(null);
    if (isSettingPin) {
      if (step === 'enter') {
        const next = pin + digit;
        if (next.length <= 4) setPin(next);
        if (next.length === 4) setStep('confirm');
      } else {
        const next = confirmPin + digit;
        if (next.length <= 4) setConfirmPin(next);
        if (next.length === 4) {
          if (next === pin) {
            onSetPin?.(pin);
            onClose();
          } else {
            setError('PINs do not match. Try again.');
            setPin('');
            setConfirmPin('');
            setStep('enter');
          }
        }
      }
    } else {
      const next = pin + digit;
      if (next.length <= 4) setPin(next);
      if (next.length === 4) {
        const success = onUnlockWithPin?.(next);
        if (!success) {
          setError('Incorrect PIN.');
          setPin('');
        } else {
          onClose();
        }
      }
    }
  };

  const handleDelete = () => {
    setError(null);
    if (isSettingPin && step === 'confirm') {
      setConfirmPin((prev) => prev.slice(0, -1));
    } else {
      setPin((prev) => prev.slice(0, -1));
    }
  };

  const currentDisplayPin = isSettingPin && step === 'confirm' ? confirmPin : pin;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-xs bg-vault-card border border-slate-800 rounded-2xl p-6 shadow-2xl animate-fade-in flex flex-col items-center">
        {onClose && isSettingPin && (
          <button
            onClick={onClose}
            className="self-end -mt-2 -mr-2 p-1 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-3">
          <KeyRound className="w-6 h-6" />
        </div>

        <h3 className="text-base font-bold text-white text-center">
          {isSettingPin
            ? step === 'enter'
              ? 'Set Quick PIN'
              : 'Confirm Quick PIN'
            : 'Enter Quick PIN'}
        </h3>
        <p className="text-xs text-slate-400 text-center mt-0.5 mb-5">
          {isSettingPin
            ? 'Set a 4-digit code for instant session access'
            : 'Unlock your drive session'}
        </p>

        {/* PIN Dots */}
        <div className="flex items-center gap-3 mb-6">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-3.5 h-3.5 rounded-full border transition-all ${
                currentDisplayPin.length > idx
                  ? 'bg-blue-500 border-blue-400 scale-110 shadow-sm shadow-blue-500/50'
                  : 'bg-slate-800 border-slate-700'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-xs text-rose-400 mb-4 bg-rose-500/10 px-2.5 py-1 rounded-md">
            {error}
          </p>
        )}

        {/* Number Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[220px] mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => handleDigit(num)}
              className="h-12 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-white font-semibold text-lg border border-slate-800/80 transition-all active:scale-95 flex items-center justify-center shadow-sm"
            >
              {num}
            </button>
          ))}
          <div />
          <button
            onClick={() => handleDigit('0')}
            className="h-12 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-white font-semibold text-lg border border-slate-800/80 transition-all active:scale-95 flex items-center justify-center shadow-sm"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="h-12 rounded-xl bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800/80 transition-all active:scale-95 flex items-center justify-center"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Auto-lock timer option if setting PIN */}
        {isSettingPin && onSetAutoLockMinutes && (
          <div className="w-full pt-3 border-t border-slate-800 text-xs">
            <label className="flex items-center justify-between text-slate-400 mb-2">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-400" /> Auto-Lock Timer:
              </span>
              <select
                value={currentAutoLockMinutes}
                onChange={(e) => onSetAutoLockMinutes(parseInt(e.target.value, 10))}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-[11px]"
              >
                <option value={1}>1 Minute</option>
                <option value={5}>5 Minutes</option>
                <option value={15}>15 Minutes</option>
                <option value={0}>Never</option>
              </select>
            </label>
          </div>
        )}

        {/* Fallback to Passphrase */}
        {!isSettingPin && onFallbackToPassphrase && (
          <button
            onClick={onFallbackToPassphrase}
            className="text-xs text-blue-400 hover:text-blue-300 mt-2 hover:underline"
          >
            Unlock with Master Passphrase
          </button>
        )}
      </div>
    </div>
  );
};
