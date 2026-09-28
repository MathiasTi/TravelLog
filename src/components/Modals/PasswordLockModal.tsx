import React, { useState } from 'react';
import { Trip } from '../../types';
import { Lock, KeyRound, X, AlertCircle } from 'lucide-react';

interface PasswordLockModalProps {
  trip: Trip | null;
  isOpen: boolean;
  onClose: () => void;
  onUnlock: (password: string) => Promise<boolean> | boolean;
}

export const PasswordLockModal: React.FC<PasswordLockModalProps> = ({
  trip,
  isOpen,
  onClose,
  onUnlock,
}) => {
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen || !trip) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;

    setError(null);
    setIsVerifying(true);

    try {
      const isValid = await onUnlock(passwordInput.trim());
      if (!isValid) {
        setError('Das eingegebene Passwort ist leider nicht korrekt.');
      } else {
        setPasswordInput('');
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Fehler beim Entsperren.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#4E3B31]/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-[#FDFBF7] border border-[#E5E1D8] rounded-3xl shadow-2xl overflow-hidden p-6 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#E2725B]/15 border border-[#E2725B]/30 text-[#E2725B] flex items-center justify-center shadow-md">
          <Lock className="w-7 h-7" />
        </div>

        <h3 className="text-xl font-bold text-[#4E3B31] font-serif mb-1">Geschützte Reise</h3>
        <p className="text-xs text-[#6B5E55] mb-6">
          Die Reise <span className="text-[#4E3B31] font-semibold">"{trip.title}"</span> ist passwortgeschützt. Bitte gib das Passwort ein, um die Erinnerungen zu entsperren.
        </p>

        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs text-left">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8273]" />
            <input
              type="password"
              required
              autoFocus
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Passwort oder PIN eingeben..."
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-[#E5E1D8] focus:border-[#8A9A5B] text-[#4E3B31] placeholder-[#8C8273] text-sm focus:outline-none transition shadow-sm"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-[#6B5E55] hover:text-[#4E3B31] hover:bg-[#E5E1D8] text-xs font-semibold transition"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isVerifying || !passwordInput}
              className="flex-1 py-2.5 rounded-xl bg-[#E2725B] hover:bg-[#D46049] disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-[#E2725B]/20 transition"
            >
              {isVerifying ? 'Prüfen...' : 'Entsperren'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
