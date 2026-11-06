import React, { useState } from 'react';
import { Lock, Delete, LogOut } from 'lucide-react';
import { AuthSessionUser } from '@algions/contracts';

interface LockScreenProps {
  user: AuthSessionUser;
  onUnlock: (pin: string) => Promise<boolean>;
  onFullLogout: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ user, onUnlock, onFullLogout }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleKeyPress = async (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(null);

      if (nextPin.length === 4) {
        setIsSubmitting(true);
        const success = await onUnlock(nextPin);
        setIsSubmitting(false);
        if (!success) {
          setError('Incorrect quick unlock PIN. Try again.');
          setPin('');
        }
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-50 flex items-center justify-center select-none">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm text-center border border-slate-100">
        <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-bold text-slate-800">Terminal Locked</h2>
        <p className="text-xs text-slate-500 mt-1 mb-6">
          Logged in as <span className="font-semibold text-slate-700">{user.name}</span>
        </p>

        {/* PIN Dots Display */}
        <div className="flex justify-center gap-3 mb-6">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                pin.length > index
                  ? 'bg-teal-600 border-teal-600 scale-110'
                  : 'bg-slate-100 border-slate-300'
              }`}
            />
          ))}
        </div>

        {error && <div className="text-xs font-semibold text-red-600 mb-4 animate-shake">{error}</div>}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2.5 max-w-[220px] mx-auto mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num.toString())}
              disabled={isSubmitting}
              className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-lg font-bold text-slate-700 transition"
            >
              {num}
            </button>
          ))}
          <div />
          <button
            onClick={() => handleKeyPress('0')}
            disabled={isSubmitting}
            className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-lg font-bold text-slate-700 transition"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={onFullLogout}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-600 font-medium transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Switch User / Log Out</span>
        </button>
      </div>
    </div>
  );
};
