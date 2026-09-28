import React, { useState } from 'react';
import { AuthUser, Collaborator, SyncState, Trip, JournalEntry, UserRole } from '../../types';
import { authService } from '../../services/firebase';
import { ROLE_DEFINITIONS, isTripOwner, getUserRoleInTrip } from '../../utils/permissions';
import { getTripShareUrl } from '../../utils/urlTripSync';
import { QRCodeSVG } from 'qrcode.react';
import {
  User,
  Lock,
  LogOut,
  ShieldCheck,
  RefreshCw,
  X,
  AlertCircle,
  CheckCircle2,
  Database,
  Sparkles,
  Camera,
  Crown,
  UserPlus,
  Trash2,
  Compass,
  Users,
  ShieldAlert,
  Info,
  Link,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Share2,
} from 'lucide-react';

export interface AccountManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  authUser: AuthUser | null;
  currentUser?: Collaborator | null;
  trips?: Trip[];
  activeTripId?: string;
  entries?: JournalEntry[];
  onSignOut: () => void;
  onProfileUpdated?: (updatedUser: AuthUser) => void;
  onUpdateUser?: (updatedCollab: Collaborator) => void;
  onUpdateTrip?: (updatedTrip: Trip) => void;
  syncState: SyncState;
  onTriggerSync?: () => void;
  onManualSync?: () => void;
  onOpenBackupModal?: (tab?: 'backup' | 'restore') => void;
}

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=150&auto=format&fit=crop&q=80', // Berggipfel
  'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=150&auto=format&fit=crop&q=80', // Gravelbike
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=150&auto=format&fit=crop&q=80', // Bergsee
  'https://images.unsplash.com/photo-1511497584788-87676104235f?w=150&auto=format&fit=crop&q=80', // Bergwald
  'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=150&auto=format&fit=crop&q=80', // Kompass
  'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=150&auto=format&fit=crop&q=80', // Alpencamp
];

const COLLAB_COLORS = ['#8A9A5B', '#E2725B', '#D4A373', '#606C38', '#283618', '#BC6C25', '#457B9D', '#E76F51'];

export const AccountManagementModal: React.FC<AccountManagementModalProps> = ({
  isOpen,
  onClose,
  authUser,
  currentUser,
  trips = [],
  activeTripId,
  entries = [],
  onSignOut,
  onProfileUpdated,
  onUpdateUser,
  onUpdateTrip,
  syncState,
  onTriggerSync,
  onManualSync,
  onOpenBackupModal,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'roles' | 'security' | 'cloud'>('profile');
  
  // Profile edit states
  const [displayName, setDisplayName] = useState(authUser?.displayName || currentUser?.name || '');
  const [photoURL, setPhotoURL] = useState(authUser?.photoURL || currentUser?.avatar || AVATAR_PRESETS[0]);
  const [customPhotoInput, setCustomPhotoInput] = useState('');
  
  // Security states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Trip admin management states
  const [selectedTripId, setSelectedTripId] = useState<string>(() => {
    if (activeTripId && trips.some((t) => t.id === activeTripId)) {
      return activeTripId;
    }
    return trips.length > 0 ? trips[0].id : '';
  });

  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<UserRole>('editor');
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [copiedTripLink, setCopiedTripLink] = useState(false);
  const [showTripQr, setShowTripQr] = useState(false);
  const [selectedLinkTarget, setSelectedLinkTarget] = useState<string>('all');
  const [qrModalMember, setQrModalMember] = useState<Collaborator | null>(null);
  const [copiedMemberId, setCopiedMemberId] = useState<string | null>(null);

  // Feedback states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen || !authUser) return null;

  const handleSyncTrigger = onTriggerSync || onManualSync || (() => {});

  const resetStatus = () => {
    setError(null);
    setSuccessMsg(null);
  };

  const selectedTrip = trips.find((t) => t.id === selectedTripId) || (trips.length > 0 ? trips[0] : null);
  const isOwnerOfSelectedTrip = selectedTrip ? isTripOwner(selectedTrip, authUser || currentUser) : false;
  const userRoleOnTrip = selectedTrip ? getUserRoleInTrip(selectedTrip, authUser || currentUser) : 'viewer';

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    resetStatus();
    setIsLoading(true);

    try {
      const finalPhoto = customPhotoInput.trim() || photoURL;
      const updated = await authService.updateUserProfile(displayName.trim() || 'Reisender', finalPhoto);
      
      if (typeof onProfileUpdated === 'function') {
        onProfileUpdated(updated);
      }

      if (typeof onUpdateUser === 'function') {
        const collab: Collaborator = {
          id: updated.uid,
          name: updated.displayName || 'Reisender',
          email: updated.email || '',
          avatar: updated.photoURL || '',
          color: currentUser?.color || '#8A9A5B',
          role: currentUser?.role || 'owner',
        };
        onUpdateUser(collab);
      }

      setSuccessMsg('Profil erfolgreich aktualisiert!');
    } catch (err: any) {
      console.error('Update profile error:', err);
      setError('Fehler beim Aktualisieren des Profils: ' + (err.message || ''));
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    resetStatus();

    if (newPassword.length < 6) {
      setError('Das neue Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }

    setIsLoading(true);
    try {
      await authService.changePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMsg('Passwort erfolgreich geändert!');
    } catch (err: any) {
      console.error('Change password error:', err);
      if (err.code === 'auth/requires-recent-login') {
        setError('Aus Sicherheitsgründen musst du dich vor der Passwortänderung erneut anmelden.');
      } else {
        setError('Fehler bei der Passwortänderung: ' + (err.message || ''));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!authUser.email) return;
    resetStatus();
    setIsLoading(true);
    try {
      await authService.sendPasswordReset(authUser.email);
      setSuccessMsg(`Passwort-Reset-Link wurde an ${authUser.email} versendet.`);
    } catch (err: any) {
      setError('Fehler beim Senden der E-Mail.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Role & Admin Management Handlers ---
  const handleRoleChange = (userId: string, newRole: UserRole) => {
    if (!selectedTrip || !isOwnerOfSelectedTrip) {
      setError('Nur der Inhaber dieser Reise kann Berechtigungen ändern.');
      return;
    }

    const collaborators = selectedTrip.collaborators || [];
    const targetUser = collaborators.find((c) => c.id === userId);
    if (!targetUser) return;

    // Safety check: ensure at least one owner remains
    if (targetUser.role === 'owner' && newRole !== 'owner') {
      const ownerCount = collaborators.filter((c) => c.role === 'owner').length;
      if (ownerCount <= 1) {
        setError('Die Reise muss mindestens einen Inhaber (Owner/Admin) behalten.');
        return;
      }
    }

    const updatedCollaborators = collaborators.map((c) =>
      c.id === userId ? { ...c, role: newRole } : c
    );

    const updatedTrip: Trip = {
      ...selectedTrip,
      collaborators: updatedCollaborators,
      updatedAt: new Date().toISOString(),
    };

    if (onUpdateTrip) {
      onUpdateTrip(updatedTrip);
    }

    setSuccessMsg(
      `Rolle von "${targetUser.name}" erfolgreich auf "${ROLE_DEFINITIONS[newRole].shortLabel}" geändert.`
    );
  };

  const handleRevokePermissions = (userId: string) => {
    if (!selectedTrip || !isOwnerOfSelectedTrip) {
      setError('Nur der Inhaber dieser Reise kann Berechtigungen entziehen.');
      return;
    }

    const collaborators = selectedTrip.collaborators || [];
    const targetUser = collaborators.find((c) => c.id === userId);
    if (!targetUser) return;

    if (targetUser.role === 'owner') {
      const remainingOwners = collaborators.filter((c) => c.id !== userId && c.role === 'owner');
      if (remainingOwners.length === 0) {
        setError('Der einzige Inhaber kann nicht entfernt werden. Befördere zuerst einen anderen Benutzer.');
        return;
      }
    }

    const updatedCollaborators = collaborators.filter((c) => c.id !== userId);
    const updatedTrip: Trip = {
      ...selectedTrip,
      collaborators: updatedCollaborators,
      updatedAt: new Date().toISOString(),
    };

    if (onUpdateTrip) {
      onUpdateTrip(updatedTrip);
    }

    setSuccessMsg(`Berechtigungen für "${targetUser.name}" wurden entzogen.`);
  };

  const handleAddCollaborator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrip || !isOwnerOfSelectedTrip) {
      setError('Nur der Inhaber dieser Reise kann neue Benutzer hinzufügen.');
      return;
    }

    if (!newMemberName.trim()) {
      setError('Bitte gib einen Namen für den neuen Benutzer ein.');
      return;
    }

    const collaborators = selectedTrip.collaborators || [];
    const newId = `collab-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const randomColor = COLLAB_COLORS[collaborators.length % COLLAB_COLORS.length];
    const randomAvatar = AVATAR_PRESETS[collaborators.length % AVATAR_PRESETS.length];

    const newCollaborator: Collaborator = {
      id: newId,
      name: newMemberName.trim(),
      email: newMemberEmail.trim() || undefined,
      avatar: randomAvatar,
      color: randomColor,
      role: newMemberRole,
    };

    const updatedTrip: Trip = {
      ...selectedTrip,
      collaborators: [...collaborators, newCollaborator],
      updatedAt: new Date().toISOString(),
    };

    if (onUpdateTrip) {
      onUpdateTrip(updatedTrip);
    }

    setNewMemberName('');
    setNewMemberEmail('');
    setNewMemberRole('editor');
    setShowAddMemberForm(false);
    setSuccessMsg(
      `"${newCollaborator.name}" wurde mit der Rolle "${ROLE_DEFINITIONS[newMemberRole].shortLabel}" hinzugefügt!`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#4E3B31]/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-[#FDFBF7] border border-[#E5E1D8] rounded-3xl shadow-2xl overflow-hidden my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E1D8] bg-[#F1EDE6]/80">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={authUser.photoURL || AVATAR_PRESETS[0]}
                alt={authUser.displayName || 'User'}
                className="w-10 h-10 rounded-full object-cover border-2 border-[#8A9A5B] shadow-sm"
              />
              {authUser.isAnonymous && (
                <span className="absolute -bottom-1 -right-1 p-0.5 bg-[#8A9A5B] text-white rounded-full">
                  <Sparkles className="w-2.5 h-2.5" />
                </span>
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#4E3B31] font-serif">
                {authUser.displayName || 'Reisender'}
              </h3>
              <p className="text-xs text-[#6B5E55]">
                {authUser.isAnonymous
                  ? 'Als anonymer Gast angemeldet'
                  : authUser.email || 'Konto verwalten'}
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

        {/* Tab Navigation */}
        <div className="flex border-b border-[#E5E1D8] bg-[#F1EDE6]/30">
          <button
            type="button"
            onClick={() => {
              setActiveTab('profile');
              resetStatus();
            }}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 sm:gap-2 ${
              activeTab === 'profile'
                ? 'border-[#8A9A5B] text-[#8A9A5B]'
                : 'border-transparent text-[#6B5E55] hover:text-[#4E3B31]'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profil</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('roles');
              resetStatus();
            }}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 sm:gap-2 ${
              activeTab === 'roles'
                ? 'border-[#8A9A5B] text-[#8A9A5B]'
                : 'border-transparent text-[#6B5E55] hover:text-[#4E3B31]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Admins & Rechte</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('security');
              resetStatus();
            }}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 sm:gap-2 ${
              activeTab === 'security'
                ? 'border-[#8A9A5B] text-[#8A9A5B]'
                : 'border-transparent text-[#6B5E55] hover:text-[#4E3B31]'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Sicherheit</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('cloud');
              resetStatus();
            }}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 sm:gap-2 ${
              activeTab === 'cloud'
                ? 'border-[#8A9A5B] text-[#8A9A5B]'
                : 'border-transparent text-[#6B5E55] hover:text-[#4E3B31]'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Cloud & Sync</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Status alerts */}
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

          {/* TAB 1: PROFILE */}
          {activeTab === 'profile' && (
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#6B5E55] uppercase tracking-wider mb-1.5">
                  Anzeigename *
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8273]" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Dein Name"
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-[#E5E1D8] focus:border-[#8A9A5B] text-[#4E3B31] text-xs focus:outline-none shadow-sm"
                  />
                </div>
              </div>

              {/* Avatar Presets */}
              <div>
                <label className="block text-xs font-semibold text-[#6B5E55] uppercase tracking-wider mb-2">
                  Profilbild-Vorlage wählen
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {AVATAR_PRESETS.map((av, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setPhotoURL(av);
                        setCustomPhotoInput('');
                      }}
                      className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition ${
                        photoURL === av && !customPhotoInput
                          ? 'border-[#8A9A5B] scale-105 shadow-md ring-2 ring-[#8A9A5B]/30'
                          : 'border-[#E5E1D8] opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={av} alt="Avatar" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Image URL */}
              <div>
                <label className="block text-xs font-semibold text-[#6B5E55] uppercase tracking-wider mb-1.5">
                  Oder eigenes Bild per URL einfügen
                </label>
                <div className="relative">
                  <Camera className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8273]" />
                  <input
                    type="url"
                    value={customPhotoInput}
                    onChange={(e) => setCustomPhotoInput(e.target.value)}
                    placeholder="https://..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-[#E5E1D8] focus:border-[#8A9A5B] text-[#4E3B31] text-xs focus:outline-none shadow-sm"
                  />
                </div>
              </div>

              {/* User Metadata Overview */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5E1D8] text-xs space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between text-[#6B5E55]">
                  <span>Benutzer-ID (UID):</span>
                  <span className="font-mono text-[#4E3B31] font-semibold truncate max-w-[200px]">
                    {authUser.uid}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#6B5E55]">
                  <span>Anmeldeart:</span>
                  <span className="capitalize font-semibold text-[#8A9A5B]">
                    {authUser.isAnonymous ? 'Gastkonto' : authUser.providerId || 'E-Mail'}
                  </span>
                </div>
                {authUser.createdAt && (
                  <div className="flex items-center justify-between text-[#6B5E55]">
                    <span>Konto erstellt:</span>
                    <span className="text-[#4E3B31]">
                      {new Date(authUser.createdAt).toLocaleDateString('de-DE')}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 rounded-2xl bg-[#E2725B] hover:bg-[#D46049] text-white font-bold text-xs shadow-md shadow-[#E2725B]/20 transition"
                >
                  {isLoading ? 'Speichern...' : 'Profil aktualisieren'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: ROLES & ADMIN MANAGEMENT */}
          {activeTab === 'roles' && (
            <div className="space-y-4">
              {/* Trip Selector */}
              {trips.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#6B5E55] uppercase tracking-wider flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-[#8A9A5B]" />
                      <span>Reise auswählen</span>
                    </label>
                    <span className="text-[11px] text-[#8C8273]">
                      {trips.length} {trips.length === 1 ? 'Reise' : 'Reisen'}
                    </span>
                  </div>

                  <select
                    value={selectedTripId}
                    onChange={(e) => {
                      setSelectedTripId(e.target.value);
                      resetStatus();
                      setShowAddMemberForm(false);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-[#E5E1D8] text-[#4E3B31] text-xs font-semibold focus:border-[#8A9A5B] focus:outline-none shadow-sm cursor-pointer"
                  >
                    {trips.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} {isTripOwner(t, authUser || currentUser) ? '👑 (Inhaber)' : ''}
                      </option>
                    ))}
                  </select>

                  {/* Role Status Card */}
                  {selectedTrip && (
                    <div
                      className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                        isOwnerOfSelectedTrip
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                          : 'bg-amber-50/70 border-amber-200 text-amber-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold">
                        {isOwnerOfSelectedTrip ? (
                          <>
                            <Crown className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Inhaber-Rechte aktiv für diese Reise</span>
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Eingeschränkte Rechte für diese Reise</span>
                          </>
                        )}
                      </div>
                      <p className="text-[11px] leading-relaxed opacity-90">
                        {isOwnerOfSelectedTrip
                          ? 'Du besitzt volle Administrationsrechte: Du kannst andere Benutzer zu Admins (Inhaber) befördern, Bearbeitungsrechte erteilen oder Berechtigungen entziehen.'
                          : `Du bist in dieser Reise als "${ROLE_DEFINITIONS[userRoleOnTrip]?.shortLabel || userRoleOnTrip}" eingetragen. Nur ein Inhaber (Admin) dieser Reise kann Rollen zuweisen oder Berechtigungen verwalten.`}
                      </p>
                    </div>
                  )}

                  {/* Direct Trip Link Card for Co-Travelers */}
                  {selectedTrip && (
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-[#8A9A5B]/15 via-[#F1EDE6]/60 to-white border border-[#8A9A5B]/30 shadow-xs space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-xl bg-[#8A9A5B] text-white shadow-2xs">
                            <Link className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-[#4E3B31]">
                              Direktlink für Mitreisende
                            </h4>
                            <p className="text-[11px] text-[#6B5E55]">
                              Öffnet sofort „{selectedTrip.title}“ zur gemeinsamen Bearbeitung
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowTripQr(!showTripQr)}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                            showTripQr
                              ? 'bg-[#8A9A5B] text-white border-[#8A9A5B] shadow-2xs'
                              : 'bg-white text-[#4E3B31] border-[#E5E1D8] hover:border-[#8A9A5B]/40 hover:bg-[#FDFBF7]'
                          }`}
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>{showTripQr ? 'QR-Code schließen' : 'QR-Code'}</span>
                        </button>
                      </div>

                      {/* Recipient / User Selector (Allgemein vs. Spezifischer Mitreisender) */}
                      {selectedTrip.collaborators && selectedTrip.collaborators.length > 0 && (
                        <div className="flex items-center gap-2 pt-0.5">
                          <label className="text-[11px] font-bold text-[#6B5E55] shrink-0">
                            Link personalisieren für:
                          </label>
                          <select
                            value={selectedLinkTarget}
                            onChange={(e) => setSelectedLinkTarget(e.target.value)}
                            className="text-[11px] font-semibold text-[#4E3B31] bg-white border border-[#E5E1D8] rounded-xl px-2.5 py-1 focus:outline-none focus:border-[#8A9A5B] cursor-pointer"
                          >
                            <option value="all">👥 Allgemeiner Einladungslink (ohne Name)</option>
                            {selectedTrip.collaborators.map((c) => (
                              <option key={c.id} value={c.id}>
                                👤 {c.name} ({ROLE_DEFINITIONS[c.role]?.label || c.role})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* URL Box with 1-Click Copy */}
                      {(() => {
                        const targetCollab =
                          selectedLinkTarget !== 'all'
                            ? selectedTrip.collaborators?.find((c) => c.id === selectedLinkTarget)
                            : undefined;
                        const currentShareUrl = getTripShareUrl(selectedTrip, { user: targetCollab });

                        return (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <input
                                  type="text"
                                  readOnly
                                  value={currentShareUrl}
                                  className="w-full pl-3 pr-8 py-2 bg-white rounded-xl border border-[#E5E1D8] text-[11px] font-mono text-[#4E3B31] select-all focus:outline-none focus:border-[#8A9A5B] shadow-inner"
                                  onClick={(e) => (e.target as HTMLInputElement).select()}
                                />
                                <a
                                  href={currentShareUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="In neuem Tab öffnen & testen"
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C8273] hover:text-[#4E3B31] transition p-0.5"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(currentShareUrl);
                                  setCopiedTripLink(true);
                                  setTimeout(() => setCopiedTripLink(false), 2000);
                                }}
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs shrink-0 cursor-pointer ${
                                  copiedTripLink
                                    ? 'bg-emerald-600 text-white border border-emerald-600'
                                    : 'bg-[#8A9A5B] hover:bg-[#7D8C68] text-white active:scale-95'
                                }`}
                              >
                                {copiedTripLink ? (
                                  <>
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Kopiert!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>{targetCollab ? `Link für ${targetCollab.name} kopieren` : 'Link kopieren'}</span>
                                  </>
                                )}
                              </button>
                            </div>

                            {/* Expandable QR Code */}
                            {showTripQr && (
                              <div className="p-4 bg-white rounded-2xl border border-[#8A9A5B]/30 flex flex-col items-center justify-center text-center space-y-2 animate-fade-in shadow-xs">
                                <div className="p-3 bg-white rounded-xl border border-[#E5E1D8] shadow-inner">
                                  <QRCodeSVG
                                    value={currentShareUrl}
                                    size={160}
                                    level="M"
                                    includeMargin={true}
                                  />
                                </div>
                                <p className="text-[11px] font-bold text-[#4E3B31]">
                                  {targetCollab
                                    ? `Persönlicher QR-Code für ${targetCollab.name}`
                                    : 'QR-Code für Mitreisende'}
                                </p>
                                <p className="text-[10px] text-[#6B5E55] max-w-xs leading-relaxed">
                                  {targetCollab
                                    ? `${targetCollab.name} scannt diesen Code, wird automatisch begrüßt und landet direkt in dieser Reise.`
                                    : 'Dein Mitreisender scannt diesen QR-Code und landet direkt in dieser Reise. Alle Einträge synchronisieren sich in Echtzeit.'}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div className="flex items-start gap-2 text-[11px] text-[#6B5E55] bg-white/70 p-2.5 rounded-xl border border-[#E5E1D8]/80">
                        <Info className="w-3.5 h-3.5 text-[#8A9A5B] shrink-0 mt-0.5" />
                        <span>
                          <strong>Persönlicher Direktlink:</strong> Wenn du den Link mit Benutzernamen verschickst, wird der Name beim Login automatisch vorausgefüllt und der Mitreisende landet direkt in <em>{selectedTrip.title}</em>.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Collaborators List */}
                  {selectedTrip && (
                    <div className="space-y-2.5 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#4E3B31] flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-[#8A9A5B]" />
                          <span>Mitreisende & Rollen ({selectedTrip.collaborators?.length || 0})</span>
                        </span>

                        {isOwnerOfSelectedTrip && (
                          <button
                            type="button"
                            onClick={() => setShowAddMemberForm(!showAddMemberForm)}
                            className="text-xs font-bold text-[#8A9A5B] hover:text-[#7D8C68] flex items-center gap-1 transition"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>{showAddMemberForm ? 'Abbrechen' : 'Benutzer hinzufügen'}</span>
                          </button>
                        )}
                      </div>

                      {/* Add Member Form */}
                      {showAddMemberForm && isOwnerOfSelectedTrip && (
                        <form
                          onSubmit={handleAddCollaborator}
                          className="p-3.5 rounded-2xl bg-white border border-[#8A9A5B]/40 shadow-sm space-y-3"
                        >
                          <h4 className="text-xs font-bold text-[#4E3B31]">Neuen Benutzer zur Reise einladen</h4>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-[#6B5E55] uppercase mb-1">
                                Name *
                              </label>
                              <input
                                type="text"
                                required
                                value={newMemberName}
                                onChange={(e) => setNewMemberName(e.target.value)}
                                placeholder="z. B. Julia Becker"
                                className="w-full px-3 py-1.5 rounded-xl bg-[#FDFBF7] border border-[#E5E1D8] text-xs text-[#4E3B31] focus:border-[#8A9A5B] focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-[#6B5E55] uppercase mb-1">
                                E-Mail (optional)
                              </label>
                              <input
                                type="email"
                                value={newMemberEmail}
                                onChange={(e) => setNewMemberEmail(e.target.value)}
                                placeholder="julia@example.com"
                                className="w-full px-3 py-1.5 rounded-xl bg-[#FDFBF7] border border-[#E5E1D8] text-xs text-[#4E3B31] focus:border-[#8A9A5B] focus:outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-[#6B5E55] uppercase mb-1">
                              Rolle zuweisen
                            </label>
                            <select
                              value={newMemberRole}
                              onChange={(e) => setNewMemberRole(e.target.value as UserRole)}
                              className="w-full px-3 py-1.5 rounded-xl bg-[#FDFBF7] border border-[#E5E1D8] text-xs text-[#4E3B31] font-semibold focus:border-[#8A9A5B] focus:outline-none cursor-pointer"
                            >
                              <option value="owner">👑 Inhaber / Admin (Voller Zugriff & Rollenverwaltung)</option>
                              <option value="editor">✏️ Bearbeiter (Einträge verfassen & Fotos hochladen)</option>
                              <option value="viewer">👁️ Nur Lesen (Reiseroute & Chronik ansehen)</option>
                            </select>
                          </div>

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setShowAddMemberForm(false)}
                              className="px-3 py-1.5 rounded-xl bg-[#F1EDE6] text-[#6B5E55] text-xs font-semibold hover:bg-[#E5E1D8] transition"
                            >
                              Abbrechen
                            </button>
                            <button
                              type="submit"
                              className="px-4 py-1.5 rounded-xl bg-[#8A9A5B] hover:bg-[#7D8C68] text-white text-xs font-bold shadow-sm transition"
                            >
                              Benutzer hinzufügen
                            </button>
                          </div>
                        </form>
                      )}

                      {/* List of members */}
                      <div className="space-y-2">
                        {(selectedTrip.collaborators && selectedTrip.collaborators.length > 0
                          ? selectedTrip.collaborators
                          : [currentUser || { id: 'default', name: 'Inhaber', avatar: AVATAR_PRESETS[0], color: '#8A9A5B', role: 'owner' }]
                        ).map((member) => {
                          const isCurrentUser =
                            member.id === authUser.uid ||
                            member.id === currentUser?.id ||
                            (member.email && authUser.email && member.email.toLowerCase() === authUser.email.toLowerCase());

                          return (
                            <div
                              key={member.id}
                              className="p-3 rounded-2xl bg-white border border-[#E5E1D8] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="relative">
                                  {member.avatar ? (
                                    <img
                                      src={member.avatar}
                                      alt={member.name}
                                      className="w-8 h-8 rounded-full object-cover border border-[#E5E1D8]"
                                    />
                                  ) : (
                                    <div
                                      style={{ backgroundColor: member.color || '#8A9A5B' }}
                                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                    >
                                      {member.name.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  {member.role === 'owner' && (
                                    <span className="absolute -top-1 -right-1 p-0.5 bg-[#E2725B] text-white rounded-full">
                                      <Crown className="w-2.5 h-2.5" />
                                    </span>
                                  )}
                                </div>

                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-[#4E3B31]">
                                      {member.name}
                                    </span>
                                    {isCurrentUser && (
                                      <span className="px-1.5 py-0.2 rounded-md bg-[#8A9A5B]/15 text-[#8A9A5B] text-[10px] font-bold">
                                        Du
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-[#8C8273]">
                                    {member.email || 'Keine E-Mail angegeben'}
                                  </span>
                                </div>
                              </div>

                              {/* Controls */}
                              <div className="flex items-center gap-2 self-end sm:self-center">
                                {/* Copy Personal Link */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const url = getTripShareUrl(selectedTrip, { user: member });
                                    navigator.clipboard.writeText(url);
                                    setCopiedMemberId(member.id);
                                    setTimeout(() => setCopiedMemberId(null), 2000);
                                  }}
                                  title={`Persönlichen Direktlink für ${member.name} kopieren`}
                                  className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                                    copiedMemberId === member.id
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                      : 'text-[#6B5E55] hover:text-[#4E3B31] bg-[#FDFBF7] hover:bg-[#F1EDE6] border-[#E5E1D8]'
                                  }`}
                                >
                                  {copiedMemberId === member.id ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                      <span className="text-[10px] font-bold">Kopiert!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Share2 className="w-3.5 h-3.5 text-[#8A9A5B]" />
                                      <span className="text-[10px] font-bold">Link für {member.name}</span>
                                    </>
                                  )}
                                </button>

                                {/* Show QR Code for this member */}
                                <button
                                  type="button"
                                  onClick={() => setQrModalMember(member)}
                                  title={`Persönlichen QR-Code für ${member.name} anzeigen`}
                                  className="p-1.5 rounded-xl border text-[11px] font-semibold text-[#6B5E55] hover:text-[#4E3B31] bg-[#FDFBF7] hover:bg-[#F1EDE6] border-[#E5E1D8] transition cursor-pointer"
                                >
                                  <QrCode className="w-3.5 h-3.5 text-[#8A9A5B]" />
                                </button>

                                {isOwnerOfSelectedTrip ? (
                                  <>
                                    <select
                                      value={member.role}
                                      onChange={(e) => handleRoleChange(member.id, e.target.value as UserRole)}
                                      className="px-2.5 py-1 rounded-xl bg-[#FDFBF7] border border-[#E5E1D8] text-[11px] font-semibold text-[#4E3B31] focus:border-[#8A9A5B] focus:outline-none cursor-pointer"
                                    >
                                      <option value="owner">👑 Inhaber / Admin</option>
                                      <option value="editor">✏️ Bearbeiter</option>
                                      <option value="viewer">👁️ Nur Lesen</option>
                                    </select>

                                    <button
                                      type="button"
                                      onClick={() => handleRevokePermissions(member.id)}
                                      title="Berechtigungen entziehen"
                                      className="p-1.5 rounded-xl text-red-500 hover:bg-red-50 border border-transparent hover:border-red-200 transition"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <span
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                      ROLE_DEFINITIONS[member.role]?.badgeBg || 'bg-stone-50'
                                    } ${ROLE_DEFINITIONS[member.role]?.badgeText || 'text-stone-700'} ${
                                      ROLE_DEFINITIONS[member.role]?.badgeBorder || 'border-stone-200'
                                    }`}
                                  >
                                    {ROLE_DEFINITIONS[member.role]?.label || member.role}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Role explanation overview */}
                  <div className="p-3.5 rounded-2xl bg-[#F1EDE6]/50 border border-[#E5E1D8] text-[11px] text-[#6B5E55] space-y-1.5">
                    <div className="font-bold text-[#4E3B31] flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-[#8A9A5B]" />
                      <span>Rollen & Berechtigungsstufen im Überblick:</span>
                    </div>
                    <ul className="space-y-1 pl-1">
                      <li>
                        <strong className="text-[#E2725B]">Inhaber / Admin:</strong> Volle Reiseverwaltung, Admins & Mitreisende ernennen, Passwörter verwalten & Reise löschen.
                      </li>
                      <li>
                        <strong className="text-[#8A9A5B]">Bearbeiter:</strong> Tagebucheinträge verfassen, GPS-Tracks, Fotos hochladen & Stopps verändern.
                      </li>
                      <li>
                        <strong className="text-sky-700">Nur Lesen:</strong> Route, Chronik, Fotos und Statistiken ansehen (kein Schreibzugriff).
                      </li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-[#8C8273] bg-white rounded-2xl border border-[#E5E1D8]">
                  Keine Reisen vorhanden. Erstelle zuerst eine Reise, um Berechtigungen zu verwalten.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SECURITY */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              {authUser.isAnonymous ? (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>Gastkonto in vollwertiges Konto umwandeln</span>
                  </div>
                  <p>
                    Du bist derzeit als Gast angemeldet. Wenn du deinen Browser-Cache leerst, gehen deine Anmeldedaten verloren. Melde dich mit E-Mail oder Google an, um dauerhaften Zugriff auf all deine Reisen zu sichern.
                  </p>
                </div>
              ) : authUser.providerId === 'google.com' ? (
                <div className="p-4 rounded-2xl bg-white border border-[#E5E1D8] text-xs space-y-2 shadow-sm">
                  <div className="flex items-center gap-2 text-[#4E3B31] font-bold">
                    <ShieldCheck className="w-4 h-4 text-[#8A9A5B]" />
                    <span>Mit Google gesichert</span>
                  </div>
                  <p className="text-[#6B5E55]">
                    Dein Konto ist über Google Authentifizierung geschützt. Du kannst dein Passwort direkt in deinem Google-Konto verwalten.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-3.5">
                  <div className="p-3.5 rounded-2xl bg-white border border-[#E5E1D8] text-xs text-[#6B5E55] shadow-sm">
                    Passwort ändern für <span className="font-semibold text-[#4E3B31]">{authUser.email}</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#6B5E55] uppercase tracking-wider mb-1">
                      Neues Passwort *
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8273]" />
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mindestens 6 Zeichen"
                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-[#E5E1D8] focus:border-[#8A9A5B] text-[#4E3B31] text-xs focus:outline-none shadow-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#6B5E55] uppercase tracking-wider mb-1">
                      Neues Passwort bestätigen *
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8273]" />
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Wiederhole das Passwort"
                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-[#E5E1D8] focus:border-[#8A9A5B] text-[#4E3B31] text-xs focus:outline-none shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={handleSendResetEmail}
                      disabled={isLoading}
                      className="text-xs text-[#8A9A5B] hover:underline font-semibold"
                    >
                      Reset-Link per E-Mail senden
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-5 py-2.5 rounded-2xl bg-[#8A9A5B] hover:bg-[#7D8C68] text-white font-bold text-xs shadow-md shadow-[#8A9A5B]/20 transition"
                    >
                      {isLoading ? 'Ändern...' : 'Passwort aktualisieren'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 4: CLOUD SYNC */}
          {activeTab === 'cloud' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white border border-[#E5E1D8] shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-[#8A9A5B]" />
                    <div>
                      <h4 className="text-xs font-bold text-[#4E3B31]">Firebase Firestore Status</h4>
                      <p className="text-[11px] text-[#6B5E55]">
                        {syncState.isOnline ? 'Echtzeit-Synchronisierung aktiv' : 'Offline-Modus'}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      syncState.isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {syncState.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>

                <div className="text-xs text-[#6B5E55] pt-2 border-t border-[#E5E1D8] space-y-1">
                  <div className="flex justify-between">
                    <span>Ausstehende Änderungen:</span>
                    <span className="font-semibold text-[#4E3B31]">{syncState.pendingCount} Elemente</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Letzte Synchronisierung:</span>
                    <span className="font-semibold text-[#4E3B31]">
                      {syncState.lastSyncedAt
                        ? new Date(syncState.lastSyncedAt).toLocaleTimeString('de-DE')
                        : 'Jetzt'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSyncTrigger}
                  disabled={syncState.isSyncing}
                  className="w-full py-2.5 rounded-xl bg-white hover:bg-[#F1EDE6] border border-[#E5E1D8] text-[#4E3B31] text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncState.isSyncing ? 'animate-spin text-[#8A9A5B]' : ''}`} />
                  <span>{syncState.isSyncing ? 'Synchronisiere mit Firestore...' : 'Jetzt manuell synchronisieren'}</span>
                </button>
              </div>

              {/* Local Backup & Restore Card */}
              {onOpenBackupModal && (
                <div className="p-4 rounded-2xl bg-white border border-[#E5E1D8] shadow-sm space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#8A9A5B]/15 text-[#8A9A5B] flex items-center justify-center">
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#4E3B31]">Lokale Datensicherung (Offline-Backup)</h4>
                      <p className="text-[11px] text-[#6B5E55]">
                        Sichere alle deine Reisen als .json Datei auf deiner Festplatte
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenBackupModal('backup');
                      }}
                      className="py-2.5 px-3 rounded-xl bg-[#8A9A5B] hover:bg-[#7D8C68] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer"
                    >
                      <Database className="w-3.5 h-3.5" />
                      <span>Backup erstellen</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenBackupModal('restore');
                      }}
                      className="py-2.5 px-3 rounded-xl bg-white hover:bg-[#F1EDE6] border border-[#E5E1D8] text-[#E2725B] text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Wiederherstellen</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions (Sign Out) */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#E5E1D8] bg-[#F1EDE6]/60">
          <button
            type="button"
            onClick={onSignOut}
            className="px-4 py-2 rounded-2xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold flex items-center gap-2 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Abmelden</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-2xl bg-white hover:bg-[#F1EDE6] border border-[#E5E1D8] text-[#4E3B31] text-xs font-semibold transition"
          >
            Schließen
          </button>
        </div>
      </div>

      {/* Individual Collaborator QR Code Popup Modal */}
      {qrModalMember && selectedTrip && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-[#E5E1D8] shadow-2xl space-y-4 text-center">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  style={{ backgroundColor: qrModalMember.color || '#8A9A5B' }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-xs"
                >
                  {qrModalMember.name.charAt(0).toUpperCase()}
                </div>
                <div className="text-left">
                  <h4 className="text-sm font-bold text-[#4E3B31]">
                    QR-Code für {qrModalMember.name}
                  </h4>
                  <p className="text-[10px] text-[#8C8273]">
                    {ROLE_DEFINITIONS[qrModalMember.role]?.label || qrModalMember.role}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setQrModalMember(null)}
                className="p-1 rounded-full hover:bg-[#F1EDE6] text-[#8C8273] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* QR Box */}
            <div className="p-4 bg-[#FDFBF7] rounded-2xl border border-[#E5E1D8] flex flex-col items-center justify-center shadow-inner">
              <QRCodeSVG
                value={getTripShareUrl(selectedTrip, { user: qrModalMember })}
                size={180}
                level="M"
                includeMargin={true}
              />
            </div>

            <div className="space-y-1 text-left bg-[#8A9A5B]/10 p-3 rounded-xl border border-[#8A9A5B]/20">
              <p className="text-xs font-bold text-[#4E3B31]">
                So funktioniert es:
              </p>
              <p className="text-[11px] text-[#6B5E55] leading-relaxed">
                {qrModalMember.name} scannt diesen QR-Code mit der Handykamera. Die App öffnet automatisch <strong>{selectedTrip.title}</strong> und loggt den Benutzer mit dem Namen <strong>{qrModalMember.name}</strong> ein.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const url = getTripShareUrl(selectedTrip, { user: qrModalMember });
                  navigator.clipboard.writeText(url);
                  setCopiedMemberId(qrModalMember.id);
                  setTimeout(() => setCopiedMemberId(null), 2000);
                }}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  copiedMemberId === qrModalMember.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#8A9A5B] hover:bg-[#7D8C68] text-white'
                }`}
              >
                {copiedMemberId === qrModalMember.id ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Link kopiert!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Link kopieren</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setQrModalMember(null)}
                className="py-2.5 px-4 rounded-xl bg-white hover:bg-[#F1EDE6] border border-[#E5E1D8] text-[#4E3B31] text-xs font-bold transition"
              >
                Fertig
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
