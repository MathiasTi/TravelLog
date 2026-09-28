import React, { useState, useEffect } from 'react';
import { Lock, KeyRound, User, Eye, EyeOff, ShieldCheck, Compass, Sparkles, Check, AlertCircle, Mountain, ChevronRight, Link, UserCheck } from 'lucide-react';
import { ADMIN_PASSWORD, VIEWER_PASSWORD, AVATAR_PRESETS, AppAuthSession, validateAppPassword } from '../../utils/appAuth';
import { getTripIdentifierFromUrl, getUserFromUrl, getPendingUserData } from '../../utils/urlTripSync';

interface AppGateScreenProps {
  onUnlock: (session: AppAuthSession) => void;
}

export const AppGateScreen: React.FC<AppGateScreenProps> = ({ onUnlock }) => {
  const initialUser = getUserFromUrl() || getPendingUserData();
  const [userName, setUserName] = useState(initialUser?.name || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_PRESETS[0]);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ role: 'owner' | 'viewer'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pendingTripToken = getTripIdentifierFromUrl();
  const isPersonalInvite = Boolean(initialUser?.name);

  useEffect(() => {
    if (initialUser?.name && !userName) {
      setUserName(initialUser.name);
    }
  }, [initialUser?.name]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = userName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setError('Bitte gib deinen Namen oder Rufnamen ein (mind. 2 Zeichen).');
      return;
    }

    if (!password) {
      setError('Bitte gib das Zugangspasswort ein.');
      return;
    }

    const validatedRole = validateAppPassword(password);

    if (!validatedRole) {
      setError('Ungültiges Passwort. Bitte überprüfe deine Eingabe.');
      return;
    }

    setIsSubmitting(true);
    const isOwner = validatedRole === 'owner';
    const message = isOwner
      ? `Willkommen, ${trimmedName}! Vollzugriff (Admin & Editionen) freigeschaltet.`
      : `Willkommen, ${trimmedName}! Lesezugriff (Nur Schauen) freigeschaltet.`;

    setSuccessInfo({
      role: validatedRole,
      message,
    });

    const session: AppAuthSession = {
      userName: trimmedName,
      role: validatedRole,
      avatar: selectedAvatar.url,
      color: selectedAvatar.color,
      unlockedAt: new Date().toISOString(),
      rememberMe,
    };

    // Short animated transition before entering
    setTimeout(() => {
      onUnlock(session);
    }, 600);
  };

  return (
    <div
      id="app-gate-screen"
      className="min-h-screen w-full flex items-center justify-center p-4 bg-[#12161A] text-[#EDE8DF] relative overflow-hidden font-sans select-none"
    >
      {/* Mountain Landscape Background Glow / Atmosphere */}
      <div className="absolute inset-0 bg-radial from-[#243428]/40 via-[#161B1E]/90 to-[#0D1012] pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#8A9A5B]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#E2725B]/15 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="relative w-full max-w-md bg-[#1B2024]/90 backdrop-blur-xl rounded-3xl border border-[#333C43] shadow-2xl p-6 sm:p-8 overflow-hidden z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#8A9A5B] to-[#A8BA76] text-white flex items-center justify-center shadow-lg shadow-[#8A9A5B]/20 mb-1 border border-white/20">
            <Mountain className="w-8 h-8" />
          </div>
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#8A9A5B]/15 border border-[#8A9A5B]/30 text-[#A8BA76] text-xs font-mono font-bold tracking-wide">
            <Lock className="w-3 h-3" />
            <span>AlpenGravel 2026 • Zugriffsschutz</span>
          </div>

          <h1 className="text-2xl font-bold font-serif text-white tracking-tight">
            {isPersonalInvite ? `Willkommen, ${initialUser?.name}!` : 'Willkommen im Reisetagebuch'}
          </h1>
          <p className="text-xs text-[#9EADB6] max-w-xs leading-relaxed">
            {isPersonalInvite
              ? 'Du wurdest persönlich zu dieser Reise eingeladen. Bitte gib dein Zugangspasswort ein.'
              : 'Bitte gib deinen Namen und das Zugangspasswort ein, um fortzufahren.'}
          </p>

          {isPersonalInvite && (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-medium animate-fade-in mt-1 shadow-inner">
              <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Eingeladen als <strong>{initialUser?.name}</strong></span>
            </div>
          )}

          {pendingTripToken && !isPersonalInvite && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#8A9A5B]/20 border border-[#8A9A5B]/40 text-[#C7DDB5] text-[11px] font-medium animate-fade-in mt-1">
              <Link className="w-3.5 h-3.5 text-[#A8BA76] shrink-0" />
              <span>Einladungslink aktiv: Deine Reise wird sofort nach dem Login geöffnet</span>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Step 1: Who are you? (Name) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-[#C8D6DF] uppercase tracking-wider">
                1. Wer bist du? (Dein Name)
              </label>
              {isPersonalInvite && (
                <span className="text-[10px] text-emerald-400 font-medium">
                  Aus Einladung übernommen
                </span>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8A9A5B]">
                <User className="w-4 h-4" />
              </div>
              <input
                id="input-user-name"
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="z. B. Alex, Lukas, Sarah..."
                required
                autoFocus={!isPersonalInvite}
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#14181B] border border-[#333C43] focus:border-[#8A9A5B] focus:ring-2 focus:ring-[#8A9A5B]/20 text-sm text-white placeholder-[#5A6872] outline-none transition"
              />
            </div>
          </div>

          {/* Avatar / Character Selection */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-[#9EADB6]">
              Wähle dein Profilbild:
            </label>
            <div className="grid grid-cols-6 gap-2">
              {AVATAR_PRESETS.map((preset) => {
                const isSelected = selectedAvatar.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedAvatar(preset)}
                    className={`relative rounded-xl p-0.5 transition transform active:scale-95 ${
                      isSelected
                        ? 'ring-2 ring-[#8A9A5B] scale-105 shadow-md shadow-[#8A9A5B]/30'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                    title={preset.label}
                  >
                    <img
                      src={preset.url}
                      alt={preset.label}
                      className="w-full aspect-square rounded-lg object-cover"
                    />
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#8A9A5B] rounded-full flex items-center justify-center text-white text-[9px] shadow">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Password */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-[#C8D6DF] uppercase tracking-wider">
                2. Passwort eingeben
              </label>
              <span className="text-[10px] text-[#8A9A5B] font-medium flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" />
                <span>Passwortschutz</span>
              </span>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8A9A5B]">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                id="input-app-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Passwort eingeben..."
                required
                autoFocus={isPersonalInvite}
                className="w-full pl-10 pr-11 py-3 rounded-2xl bg-[#14181B] border border-[#333C43] focus:border-[#8A9A5B] focus:ring-2 focus:ring-[#8A9A5B]/20 text-sm text-white placeholder-[#5A6872] outline-none font-mono transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#8C9AA3] hover:text-white transition cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember me checkbox */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-xs text-[#9EADB6] cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded text-[#8A9A5B] bg-[#14181B] border-[#333C43] focus:ring-0 focus:ring-offset-0 accent-[#8A9A5B]"
              />
              <span>Auf diesem Gerät merken</span>
            </label>
          </div>

          {/* Error Notice */}
          {error && (
            <div className="p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-start gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Notice */}
          {successInfo && (
            <div className={`p-3 rounded-2xl border text-xs flex items-center gap-2 ${
              successInfo.role === 'owner'
                ? 'bg-[#8A9A5B]/20 border-[#8A9A5B]/40 text-[#A8BA76]'
                : 'bg-sky-500/20 border-sky-500/40 text-sky-300'
            }`}>
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span className="font-bold">{successInfo.message}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            id="btn-unlock-app"
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#8A9A5B] to-[#78884E] hover:from-[#94A564] hover:to-[#819256] active:scale-[0.98] text-white font-bold text-sm shadow-lg shadow-[#8A9A5B]/25 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>Prüfe Berechtigung...</span>
              </>
            ) : (
              <>
                <span>Tagebuch entsperren</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Security & Access Info Footer */}
        <div className="mt-6 pt-4 border-t border-[#2A3238] flex items-center justify-center gap-2 text-[11px] text-[#7E8D96]">
          <Lock className="w-3.5 h-3.5 text-[#8A9A5B]" />
          <span>Geschützter Zugriff • Bitte dein zugewiesenes Passwort eingeben</span>
        </div>
      </div>
    </div>
  );
};
