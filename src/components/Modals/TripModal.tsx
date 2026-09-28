import React, { useState, useEffect } from 'react';
import { Trip, Collaborator, UserRole } from '../../types';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { ROLE_DEFINITIONS, isTripOwner } from '../../utils/permissions';
import { getTripShareUrl, copyTripShareLink } from '../../utils/urlTripSync';
import {
  X,
  Compass,
  Lock,
  Unlock,
  Users,
  Share2,
  Copy,
  Check,
  Calendar,
  Image as ImageIcon,
  Download,
  Trash2,
  Plus,
  ShieldCheck,
  Globe,
  Sparkles,
  Shield,
  Eye,
  Edit3,
  UserPlus,
  Info,
  Crown,
  CheckCircle2,
  UserCheck
} from 'lucide-react';

interface TripModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip | null;
  onSave: (tripData: Partial<Trip>) => void;
  onDelete?: (tripId: string) => void;
  currentUser: Collaborator;
}

const COVER_PRESETS = [
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1504893524553-b855bce32c67?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&auto=format&fit=crop&q=80',
];

export const TripModal: React.FC<TripModalProps> = ({
  isOpen,
  onClose,
  trip,
  onSave,
  onDelete,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'collaborators' | 'security' | 'share'>('details');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState(COVER_PRESETS[0]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [passwordProtected, setPasswordProtected] = useState(false);
  const [passwordHash, setPasswordHash] = useState('');
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [newCompanionName, setNewCompanionName] = useState('');
  const [newCompanionEmail, setNewCompanionEmail] = useState('');
  const [newCompanionRole, setNewCompanionRole] = useState<UserRole>('editor');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [collaboratorFeedback, setCollaboratorFeedback] = useState<string | null>(null);

  // Check if current user is owner of this trip
  const isOwner = !trip || isTripOwner(trip, currentUser) || collaborators.find(c => c.id === currentUser.id)?.role === 'owner';

  useEffect(() => {
    if (trip) {
      setTitle(trip.title);
      setDescription(trip.description);
      setCoverImage(trip.coverImage || COVER_PRESETS[0]);
      setStartDate(trip.startDate);
      setEndDate(trip.endDate || '');
      setPasswordProtected(trip.passwordProtected);
      setPasswordHash(trip.passwordHash || '');
      setCollaborators(trip.collaborators && trip.collaborators.length > 0 ? trip.collaborators : [{ ...currentUser, role: 'owner' }]);
    } else {
      const now = new Date();
      setTitle('Neues Reiseabenteuer');
      setDescription('');
      setCoverImage(COVER_PRESETS[0]);
      setStartDate(now.toISOString().split('T')[0]);
      setEndDate('');
      setPasswordProtected(false);
      setPasswordHash('');
      setCollaborators([{ ...currentUser, role: 'owner' }]);
    }
  }, [trip, currentUser, isOpen]);

  if (!isOpen) return null;

  const shareUrl = trip
    ? getTripShareUrl(trip)
    : (typeof window !== 'undefined' ? `${window.location.origin}/?trip=wander-alps-892f` : 'https://wanderlog.app/?trip=wander-alps-892f');

  const handleCopyLink = async () => {
    if (trip) {
      const res = await copyTripShareLink(trip);
      if (res.success) {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      }
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleAddCollaborator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanionName.trim()) return;

    // Check if collaborator already exists
    const existing = collaborators.find(
      (c) => c.name.toLowerCase() === newCompanionName.trim().toLowerCase() ||
             (newCompanionEmail && c.email?.toLowerCase() === newCompanionEmail.trim().toLowerCase())
    );

    if (existing) {
      setCollaboratorFeedback(`"${newCompanionName}" ist bereits als Mitreisender eingetragen.`);
      setTimeout(() => setCollaboratorFeedback(null), 3000);
      return;
    }

    const newCollab: Collaborator = {
      id: `user-${Date.now()}`,
      name: newCompanionName.trim(),
      email: newCompanionEmail.trim() || undefined,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(newCompanionName)}`,
      color: newCompanionRole === 'owner' ? '#E2725B' : newCompanionRole === 'editor' ? '#8A9A5B' : '#0284C7',
      role: newCompanionRole,
    };

    setCollaborators([...collaborators, newCollab]);
    setNewCompanionName('');
    setNewCompanionEmail('');
    setCollaboratorFeedback(`Mitreisender "${newCollab.name}" als ${ROLE_DEFINITIONS[newCompanionRole].shortLabel} hinzugefügt.`);
    setTimeout(() => setCollaboratorFeedback(null), 3500);
  };

  const handleQuickAddCompanion = (companion: Collaborator, defaultRole: UserRole = 'editor') => {
    const alreadyAdded = collaborators.some((c) => c.name === companion.name || c.id === companion.id);
    if (alreadyAdded) {
      setCollaboratorFeedback(`"${companion.name}" ist bereits in der Reise.`);
      setTimeout(() => setCollaboratorFeedback(null), 2500);
      return;
    }

    const newCollab: Collaborator = {
      ...companion,
      role: defaultRole,
      id: companion.id || `user-${Date.now()}`,
    };

    setCollaborators([...collaborators, newCollab]);
    setCollaboratorFeedback(`"${companion.name}" als ${ROLE_DEFINITIONS[defaultRole].shortLabel} hinzugefügt.`);
    setTimeout(() => setCollaboratorFeedback(null), 3000);
  };

  const handleRoleChange = (id: string, newRole: UserRole) => {
    // Prevent removing the only owner
    if (newRole !== 'owner') {
      const currentOwnerCount = collaborators.filter((c) => c.role === 'owner').length;
      const targetUser = collaborators.find((c) => c.id === id);
      if (targetUser?.role === 'owner' && currentOwnerCount <= 1) {
        setCollaboratorFeedback('Die Reise muss mindestens einen Inhaber (Owner) behalten.');
        setTimeout(() => setCollaboratorFeedback(null), 3000);
        return;
      }
    }

    const updated = collaborators.map((c) => (c.id === id ? { ...c, role: newRole } : c));
    setCollaborators(updated);
    const updatedUser = collaborators.find((c) => c.id === id);
    if (updatedUser) {
      setCollaboratorFeedback(`Rolle von "${updatedUser.name}" geändert zu "${ROLE_DEFINITIONS[newRole].shortLabel}".`);
      setTimeout(() => setCollaboratorFeedback(null), 3000);
    }
  };

  const handleRemoveCollaborator = (id: string) => {
    const targetUser = collaborators.find((c) => c.id === id);
    if (targetUser?.role === 'owner') {
      const remainingOwners = collaborators.filter((c) => c.id !== id && c.role === 'owner');
      if (remainingOwners.length === 0) {
        setCollaboratorFeedback('Der einzige Inhaber kann nicht entfernt werden. Übertrage zuerst die Inhaber-Rolle.');
        setTimeout(() => setCollaboratorFeedback(null), 3500);
        return;
      }
    }

    setCollaborators(collaborators.filter((c) => c.id !== id));
    if (targetUser) {
      setCollaboratorFeedback(`"${targetUser.name}" wurde aus der Reise entfernt.`);
      setTimeout(() => setCollaboratorFeedback(null), 3000);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!title.trim()) {
      setFormError('Bitte gib einen Titel für deine Reise ein.');
      return;
    }

    // Ensure at least one collaborator is owner
    let finalCollaborators = [...collaborators];
    if (!finalCollaborators.some((c) => c.role === 'owner')) {
      if (finalCollaborators.length > 0) {
        finalCollaborators[0].role = 'owner';
      } else {
        finalCollaborators = [{ ...currentUser, role: 'owner' }];
      }
    }

    const payload: Partial<Trip> = {
      title: title.trim(),
      description: description.trim(),
      coverImage,
      startDate,
      endDate: endDate || undefined,
      passwordProtected,
      passwordHash: passwordProtected ? passwordHash : '',
      collaborators: finalCollaborators,
    };

    onSave(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#4E3B31]/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#FDFBF7] border border-[#E5E1D8] rounded-3xl shadow-2xl overflow-hidden my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E1D8] bg-[#F1EDE6]/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#8A9A5B]/15 border border-[#8A9A5B]/30 text-[#8A9A5B]">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#4E3B31] font-serif">
                {trip ? 'Reise verwalten & Einstellungen' : 'Neue Reise anlegen'}
              </h3>
              <p className="text-xs text-[#6B5E55]">Titel, Mitreisende, Rollenrechte & Freigabe</p>
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
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-[#E5E1D8] bg-[#F1EDE6]/40 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`px-3 sm:px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 shrink-0 ${
              activeTab === 'details'
                ? 'border-[#8A9A5B] text-[#8A9A5B]'
                : 'border-transparent text-[#6B5E55] hover:text-[#4E3B31]'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Reisedaten</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('collaborators')}
            className={`px-3 sm:px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 shrink-0 ${
              activeTab === 'collaborators'
                ? 'border-[#8A9A5B] text-[#8A9A5B]'
                : 'border-transparent text-[#6B5E55] hover:text-[#4E3B31]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Mitreisende & Rollen ({collaborators.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`px-3 sm:px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 shrink-0 ${
              activeTab === 'security'
                ? 'border-[#8A9A5B] text-[#8A9A5B]'
                : 'border-transparent text-[#6B5E55] hover:text-[#4E3B31]'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Passwortschutz</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('share')}
            className={`px-3 sm:px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 shrink-0 ${
              activeTab === 'share'
                ? 'border-[#8A9A5B] text-[#8A9A5B]'
                : 'border-transparent text-[#6B5E55] hover:text-[#4E3B31]'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Freigabe-Link</span>
          </button>
        </div>

        {/* Form Error or Feedback Notification */}
        {formError && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-red-500" />
            <span>{formError}</span>
          </div>
        )}

        {collaboratorFeedback && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-[#8A9A5B]/15 border border-[#8A9A5B]/30 text-[#4E3B31] text-xs flex items-center gap-2 transition-all">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#8A9A5B]" />
            <span className="font-medium">{collaboratorFeedback}</span>
          </div>
        )}

        {/* Tab Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* TAB 1: DETAILS */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#6B5E55] uppercase tracking-wider mb-1.5">
                  Name der Reise *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="z.B. Roadtrip Island 2025"
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#E5E1D8] focus:border-[#8A9A5B] text-[#4E3B31] placeholder-[#8C8273] text-sm focus:outline-none transition shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B5E55] uppercase tracking-wider mb-1.5">
                  Beschreibung / Reiseroute
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Kurze Zusammenfassung der Route, Länder und Höhepunkte..."
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#E5E1D8] focus:border-[#8A9A5B] text-[#4E3B31] placeholder-[#8C8273] text-sm focus:outline-none transition resize-none shadow-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6B5E55] uppercase tracking-wider mb-1.5">
                    Startdatum
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#E5E1D8] focus:border-[#8A9A5B] text-[#4E3B31] text-xs focus:outline-none shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B5E55] uppercase tracking-wider mb-1.5">
                    Enddatum (optional)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#E5E1D8] focus:border-[#8A9A5B] text-[#4E3B31] text-xs focus:outline-none shadow-sm"
                  />
                </div>
              </div>

              {/* Cover Image Presets */}
              <div>
                <label className="block text-xs font-semibold text-[#6B5E55] uppercase tracking-wider mb-2">
                  Titelbild wählen
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {COVER_PRESETS.map((imgUrl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCoverImage(imgUrl)}
                      className={`relative aspect-video rounded-xl overflow-hidden border-2 transition ${
                        coverImage === imgUrl ? 'border-[#8A9A5B] scale-105 shadow-md' : 'border-[#E5E1D8] opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={imgUrl} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: COLLABORATORS & ROLES */}
          {activeTab === 'collaborators' && (
            <div className="space-y-5">
              {/* Owner Role Status Banner */}
              <div className={`p-4 rounded-2xl border ${isOwner ? 'bg-[#8A9A5B]/10 border-[#8A9A5B]/30' : 'bg-[#F1EDE6]/60 border-[#E5E1D8]'} flex items-start gap-3.5 shadow-sm`}>
                <div className={`p-2.5 rounded-xl ${isOwner ? 'bg-[#8A9A5B] text-white' : 'bg-[#8C8273] text-white'} shrink-0 shadow-sm`}>
                  {isOwner ? <Crown className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-[#4E3B31]">
                      {isOwner ? 'Inhaber-Rollenverwaltung' : 'Mitreisende & Berechtigungen'}
                    </h4>
                    {isOwner && (
                      <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-[#8A9A5B] text-white shadow-xs">
                        Reise-Inhaber
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#6B5E55] mt-1 leading-relaxed">
                    {isOwner
                      ? 'Als Inhaber dieser Reise kannst du Mitreisende einladen und feingranulare Rollen wie "Bearbeiter (Editor)" oder "Nur Lesen (Read-Only)" zuweisen.'
                      : 'Hier siehst du alle eingetragenen Mitreisenden und deren Berechtigungsstufe. Rollenänderungen können nur vom Reiseinhaber vorgenommen werden.'}
                  </p>
                </div>
              </div>

              {/* Add New Collaborator Form (Only visible to Owner) */}
              {isOwner && (
                <div className="p-4 rounded-2xl bg-white border border-[#E5E1D8] shadow-sm space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#4E3B31]">
                    <UserPlus className="w-4 h-4 text-[#8A9A5B]" />
                    <span>Neuen Mitreisenden hinzufügen & Rolle vergeben</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        value={newCompanionName}
                        onChange={(e) => setNewCompanionName(e.target.value)}
                        placeholder="Name (z.B. Sophia)"
                        className="w-full px-3 py-2 rounded-xl bg-[#FDFBF7] border border-[#E5E1D8] focus:border-[#8A9A5B] text-[#4E3B31] placeholder-[#8C8273] text-xs focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <input
                        type="email"
                        value={newCompanionEmail}
                        onChange={(e) => setNewCompanionEmail(e.target.value)}
                        placeholder="E-Mail (optional)"
                        className="w-full px-3 py-2 rounded-xl bg-[#FDFBF7] border border-[#E5E1D8] focus:border-[#8A9A5B] text-[#4E3B31] placeholder-[#8C8273] text-xs focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <select
                        value={newCompanionRole}
                        onChange={(e) => setNewCompanionRole(e.target.value as UserRole)}
                        className="w-full px-3 py-2 rounded-xl bg-[#FDFBF7] border border-[#E5E1D8] text-[#4E3B31] text-xs font-medium focus:outline-none"
                      >
                        <option value="editor">✏️ Bearbeiter (Editor)</option>
                        <option value="viewer">👁️ Nur Lesen (Read-Only)</option>
                        <option value="owner">👑 Inhaber (Co-Owner)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[11px] text-[#8C8273] flex items-center gap-1">
                      <Info className="w-3.5 h-3.5 text-[#8A9A5B]" />
                      <span>{ROLE_DEFINITIONS[newCompanionRole].permissionsSummary}</span>
                    </p>
                    <button
                      type="button"
                      onClick={handleAddCollaborator}
                      disabled={!newCompanionName.trim()}
                      className="px-4 py-2 rounded-xl bg-[#8A9A5B] hover:bg-[#7D8C68] disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Hinzufügen</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Collaborators List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-[#6B5E55] uppercase tracking-wider">
                    Eingetragene Mitreisende ({collaborators.length})
                  </span>
                  <span className="text-[11px] text-[#8C8273]">
                    {collaborators.filter(c => c.role === 'owner').length} Inhaber · {collaborators.filter(c => c.role === 'editor').length} Editor · {collaborators.filter(c => c.role === 'viewer').length} Nur Lesen
                  </span>
                </div>

                <div className="space-y-2">
                  {collaborators.map((c) => {
                    const roleMeta = ROLE_DEFINITIONS[c.role] || ROLE_DEFINITIONS.editor;
                    const isSelf = c.id === currentUser.id;

                    return (
                      <div
                        key={c.id}
                        className="p-3.5 rounded-2xl bg-white border border-[#E5E1D8] hover:border-[#D5CEC2] shadow-sm transition space-y-2.5"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          {/* User info */}
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <img
                                src={c.avatar}
                                alt={c.name}
                                className="w-9 h-9 rounded-full object-cover border border-[#E5E1D8] shadow-xs"
                              />
                              {c.role === 'owner' && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#E2725B] text-white flex items-center justify-center shadow-xs">
                                  <Crown className="w-2.5 h-2.5" />
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-[#4E3B31] flex items-center gap-1.5">
                                <span>{c.name}</span>
                                {isSelf && (
                                  <span className="text-[10px] text-[#8A9A5B] bg-[#8A9A5B]/10 px-1.5 py-0.2 rounded border border-[#8A9A5B]/30 font-semibold">
                                    (Du)
                                  </span>
                                )}
                              </div>
                              {c.email && (
                                <span className="text-[11px] text-[#8C8273] block">{c.email}</span>
                              )}
                            </div>
                          </div>

                          {/* Role selector / badge */}
                          <div className="flex items-center gap-2">
                            {isOwner ? (
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={c.role}
                                  onChange={(e) => handleRoleChange(c.id, e.target.value as UserRole)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition shadow-xs focus:outline-none cursor-pointer ${
                                    c.role === 'owner'
                                      ? 'bg-[#E2725B]/10 border-[#E2725B]/40 text-[#E2725B]'
                                      : c.role === 'editor'
                                      ? 'bg-[#8A9A5B]/10 border-[#8A9A5B]/40 text-[#8A9A5B]'
                                      : 'bg-sky-50 border-sky-300 text-sky-700'
                                  }`}
                                  aria-label={`Rolle für ${c.name} zuweisen`}
                                >
                                  <option value="editor">✏️ Bearbeiter (Editor)</option>
                                  <option value="viewer">👁️ Nur Lesen (Read-Only)</option>
                                  <option value="owner">👑 Inhaber (Owner)</option>
                                </select>

                                {!isSelf && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveCollaborator(c.id)}
                                    className="p-2 rounded-xl text-[#8C8273] hover:text-red-500 hover:bg-red-50 transition"
                                    title={`${c.name} entfernen`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-3 py-1 rounded-xl text-xs font-bold border ${roleMeta.badgeBg} ${roleMeta.badgeText} ${roleMeta.badgeBorder}`}
                                >
                                  {roleMeta.badgeLabel}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Permission description */}
                        <div className="text-[11px] text-[#6B5E55] bg-[#FDFBF7] px-3 py-1.5 rounded-xl border border-[#E5E1D8]/60 flex items-center gap-2">
                          {c.role === 'owner' ? (
                            <ShieldCheck className="w-3.5 h-3.5 text-[#E2725B] shrink-0" />
                          ) : c.role === 'editor' ? (
                            <Edit3 className="w-3.5 h-3.5 text-[#8A9A5B] shrink-0" />
                          ) : (
                            <Eye className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                          )}
                          <span className="truncate">{roleMeta.permissionsSummary}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SECURITY & PASSWORD */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white border border-[#E5E1D8] flex items-start gap-3 shadow-sm">
                <div className="p-2 rounded-xl bg-[#8A9A5B]/15 text-[#8A9A5B] shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#4E3B31]">Passwortschutz für dieses Reisetagebuch</h4>
                  <p className="text-xs text-[#6B5E55] mt-0.5">
                    Schütze private Notizen, Fotos und Reisekoordinaten vor neugierigen Blicken mit einem persönlichen Zugangscode.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-[#E5E1D8] shadow-sm">
                <div className="flex items-center gap-2">
                  <ShieldCheck className={`w-5 h-5 ${passwordProtected ? 'text-[#8A9A5B]' : 'text-[#8C8273]'}`} />
                  <div>
                    <span className="text-xs font-bold text-[#4E3B31]">Passwortschutz aktivieren</span>
                    <p className="text-[11px] text-[#6B5E55]">Erfordert Passworteingabe beim Öffnen der Reise</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={passwordProtected}
                  onChange={(e) => setPasswordProtected(e.target.checked)}
                  className="w-5 h-5 accent-[#8A9A5B] rounded cursor-pointer"
                />
              </div>

              {passwordProtected && (
                <div>
                  <label className="block text-xs font-semibold text-[#6B5E55] uppercase tracking-wider mb-1.5">
                    Passwort oder PIN festlegen *
                  </label>
                  <input
                    type="password"
                    value={passwordHash}
                    onChange={(e) => setPasswordHash(e.target.value)}
                    placeholder="z.B. Geheim2025"
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#E5E1D8] focus:border-[#8A9A5B] text-[#4E3B31] placeholder-[#8C8273] text-sm focus:outline-none shadow-sm"
                  />
                  <p className="text-[11px] text-[#8C8273] mt-1">
                    Teile dieses Passwort nur mit deinen gewünschten Mitreisenden.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SHARE & LINK */}
          {activeTab === 'share' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white border border-[#E5E1D8] flex items-start gap-3 shadow-sm">
                <div className="p-2 rounded-xl bg-[#8A9A5B]/15 text-[#8A9A5B] shrink-0">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#4E3B31]">Freunde per Direktlink teilhaben lassen</h4>
                  <p className="text-xs text-[#6B5E55] mt-0.5">
                    Sende diesen Link an Familie und Freunde, damit sie deine Route und Erinnerungen mitverfolgen können.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B5E55] uppercase tracking-wider mb-1.5">
                  Öffentlicher Reise-Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-[#E5E1D8] text-[#4E3B31] text-xs focus:outline-none font-mono shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-4 py-2.5 rounded-xl bg-[#8A9A5B] hover:bg-[#7D8C68] text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'Kopiert!' : 'Link kopieren'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-[#E5E1D8]">
            {trip && onDelete && isOwner ? (
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-50 border border-red-200 transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reise löschen</span>
              </button>
            ) : (
              <div></div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-[#6B5E55] hover:text-[#4E3B31] hover:bg-[#E5E1D8] text-xs font-semibold transition"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-[#E2725B] hover:bg-[#D46049] text-white font-bold text-xs shadow-md shadow-[#E2725B]/20 transition"
              >
                Speichern
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Confirm Delete Trip Modal */}
      {trip && (
        <ConfirmDeleteModal
          isOpen={isDeleteConfirmOpen}
          onClose={() => setIsDeleteConfirmOpen(false)}
          itemName={trip.title}
          title="Gesamte Reise löschen?"
          description={`Möchtest du die Reise "${trip.title}" samt aller dazugehörigen Notizen, Fotos und GPS-Stopps unwiderruflich löschen?`}
          confirmText="Reise löschen"
          onConfirm={() => {
            if (onDelete) {
              onDelete(trip.id);
              setIsDeleteConfirmOpen(false);
              onClose();
            }
          }}
        />
      )}
    </div>
  );
};

