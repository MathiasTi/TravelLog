import React, { useState } from 'react';
import { AuthModalTab, AuthUser } from '../../types';
import { authService } from '../../services/firebase';
import {
  LogIn,
  UserPlus,
  KeyRound,
  Mail,
  Lock,
  User,
  X,
  AlertCircle,
  CheckCircle2,
  Compass,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Image as ImageIcon
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
  initialTab?: AuthModalTab;
}

const AVATAR_OPTIONS = [
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1511497584788-87676104235f?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=150&auto=format&fit=crop&q=80',
];

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialTab = 'login',
}) => {
  const [tab, setTab] = useState<AuthModalTab>(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetMessages = () => {
    setError(null);
    setSuccessMsg(null);
  };

  const handleGoogleSignIn = async () => {
    resetMessages();
    setIsLoading(true);
    try {
      const user = await authService.signInWithGoogle();
      onSuccess(user);
      onClose();
    } catch (err: any) {
      console.error('Google Sign In error:', err);
      setError(
        err.code === 'auth/popup-closed-by-user'
          ? 'Anmeldung abgebrochen.'
          : 'Fehler bei der Google-Anmeldung. Bitte versuche es erneut.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    resetMessages();
    setIsLoading(true);
    try {
      const user = await authService.signInAsGuest();
      onSuccess(user);
      onClose();
    } catch (err: any) {
      console.error('Guest Sign In error:', err);
      setError('Fehler bei der Gast-Anmeldung.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setIsLoading(true);

    try {
      if (tab === 'login') {
        const user = await authService.signInWithEmail(email, password);
        onSuccess(user);
        onClose();
      } else if (tab === 'register') {
        if (password.length < 6) {
          setError('Das Passwort muss mindestens 6 Zeichen lang sein.');
          setIsLoading(false);
          return;
        }
        const user = await authService.registerWithEmail(email, password, name, selectedAvatar);
        onSuccess(user);
        onClose();
      } else if (tab === 'forgot_password') {
        await authService.sendPasswordReset(email);
        setSuccessMsg(`Wir haben einen Link zum Zurücksetzen an ${email} gesendet.`);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let message = 'Ein Fehler ist aufgetreten.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        message = 'Ungültige E-Mail-Adresse oder falsches Passwort.';
      } else if (err.code === 'auth/email-already-in-use') {
        message = 'Diese E-Mail-Adresse wird bereits für ein Konto verwendet.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'Bitte gib eine gültige E-Mail-Adresse ein.';
      } else if (err.code === 'auth/weak-password') {
        message = 'Das Passwort ist zu schwach (mindestens 6 Zeichen erforderlich).';
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#4E3B31]/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-md bg-[#FDFBF7] border border-[#E5E1D8] rounded-3xl shadow-2xl overflow-hidden my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E1D8] bg-[#F1EDE6]/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#8A9A5B]/15 border border-[#8A9A5B]/30 text-[#8A9A5B]">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#4E3B31] font-serif">
                {tab === 'login' && 'Anmelden bei WanderLog'}
                {tab === 'register' && 'Neues Konto erstellen'}
                {tab === 'forgot_password' && 'Passwort zurücksetzen'}
              </h3>
              <p className="text-xs text-[#6B5E55]">
                {tab === 'login' && 'Synchronisiere deine Reisen & Erinnerungen'}
                {tab === 'register' && 'Werde Teil deiner Reise-Community'}
                {tab === 'forgot_password' && 'Erhalte einen Wiederherstellungslink'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#6B5E55] hover:text-[#4E3B31] hover:bg-[#E5E1D8] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-[#E5E1D8] bg-[#F1EDE6]/30">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              resetMessages();
            }}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 ${
              tab === 'login'
                ? 'border-[#8A9A5B] text-[#8A9A5B]'
                : 'border-transparent text-[#6B5E55] hover:text-[#4E3B31]'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Anmelden</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              resetMessages();
            }}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 ${
              tab === 'register'
                ? 'border-[#8A9A5B] text-[#8A9A5B]'
                : 'border-transparent text-[#6B5E55] hover:text-[#4E3B31]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Registrieren</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Status Alerts */}
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Social Sign-In (Google) */}
          {tab !== 'forgot_password' && (
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-2xl bg-white hover:bg-[#F1EDE6] border border-[#E5E1D8] text-[#4E3B31] text-xs font-bold flex items-center justify-center gap-2.5 transition shadow-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.1 9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.2-1.9.4-2.8L1.9 6.3C.7 8.7 0 11.3 0 14s.7 5.3 1.9 7.7l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.1-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"
                  />
                </svg>
                <span>Mit Google fortfahren</span>
              </button>

              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-[#E5E1D8]"></div>
                <span className="text-[10px] text-[#8C8273] font-semibold uppercase tracking-wider">
                  oder mit E-Mail
                </span>
                <div className="flex-1 h-px bg-[#E5E1D8]"></div>
              </div>
            </div>
          )}

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {tab === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-[#6B5E55] uppercase tracking-wider mb-1">
                    Dein Name / Anzeigename *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8273]" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="z.B. Sarah Meyer"
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-[#E5E1D8] focus:border-[#8A9A5B] text-[#4E3B31] placeholder-[#8C8273] text-xs focus:outline-none transition shadow-sm"
                    />
                  </div>
                </div>

                {/* Avatar Selection */}
                <div>
                  <label className="block text-xs font-semibold text-[#6B5E55] uppercase tracking-wider mb-1.5">
                    Wähle dein Profilbild
                  </label>
                  <div className="flex items-center gap-2 overflow-x-auto py-1">
                    {AVATAR_OPTIONS.map((av, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedAvatar(av)}
                        className={`relative w-10 h-10 rounded-full overflow-hidden shrink-0 border-2 transition ${
                          selectedAvatar === av
                            ? 'border-[#8A9A5B] scale-110 shadow-md ring-2 ring-[#8A9A5B]/30'
                            : 'border-[#E5E1D8] opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={av} alt="Avatar" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#6B5E55] uppercase tracking-wider mb-1">
                E-Mail-Adresse *
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8273]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@beispiel.de"
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-[#E5E1D8] focus:border-[#8A9A5B] text-[#4E3B31] placeholder-[#8C8273] text-xs focus:outline-none transition shadow-sm"
                />
              </div>
            </div>

            {tab !== 'forgot_password' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[#6B5E55] uppercase tracking-wider">
                    Passwort *
                  </label>
                  {tab === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setTab('forgot_password');
                        resetMessages();
                      }}
                      className="text-[11px] text-[#8A9A5B] hover:underline font-semibold"
                    >
                      Passwort vergessen?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8273]" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mindestens 6 Zeichen"
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-[#E5E1D8] focus:border-[#8A9A5B] text-[#4E3B31] placeholder-[#8C8273] text-xs focus:outline-none transition shadow-sm"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 px-4 rounded-2xl bg-[#E2725B] hover:bg-[#D46049] disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-[#E2725B]/20 transition flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span>Wird verarbeitet...</span>
              ) : tab === 'login' ? (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Jetzt anmelden</span>
                </>
              ) : tab === 'register' ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Konto erstellen</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Reset-Link anfordern</span>
                </>
              )}
            </button>
          </form>

          {/* Guest fallback & switch back link */}
          <div className="pt-3 border-t border-[#E5E1D8] flex flex-col items-center gap-2">
            {tab === 'forgot_password' ? (
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  resetMessages();
                }}
                className="text-xs text-[#8A9A5B] hover:underline font-semibold"
              >
                Zurück zur Anmeldung
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGuestSignIn}
                disabled={isLoading}
                className="text-xs text-[#6B5E55] hover:text-[#4E3B31] flex items-center gap-1.5 font-medium transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#8A9A5B]" />
                <span>Ohne Registrierung als Gast fortfahren</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
