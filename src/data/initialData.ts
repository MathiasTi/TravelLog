import { Trip, JournalEntry, Collaborator } from '../types';

export const CURRENT_USER: Collaborator = {
  id: 'user-default',
  name: 'AlpenGravel Entdecker',
  avatar: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=150&auto=format&fit=crop&q=80',
  color: '#8A9A5B',
  role: 'owner',
  email: undefined
};

export const COMPANIONS: Collaborator[] = [];

export const INITIAL_TRIPS: Trip[] = [];

export const INITIAL_ENTRIES: JournalEntry[] = [];

export const CATEGORIES: { id: string; label: string; icon: string; color: string; bg: string }[] = [
  { id: 'sight', label: 'Sehenswürdigkeit', icon: 'Landmark', color: '#E2725B', bg: 'bg-[#E2725B]/15 text-[#E2725B] border-[#E2725B]/30' },
  { id: 'nature', label: 'Natur & Aussicht', icon: 'Mountain', color: '#8A9A5B', bg: 'bg-[#8A9A5B]/15 text-[#8A9A5B] border-[#8A9A5B]/30' },
  { id: 'food', label: 'Essen & Trinken', icon: 'Utensils', color: '#C88A58', bg: 'bg-[#C88A58]/15 text-[#C88A58] border-[#C88A58]/30' },
  { id: 'stay', label: 'Unterkunft', icon: 'Hotel', color: '#6B8E8E', bg: 'bg-[#6B8E8E]/15 text-[#6B8E8E] border-[#6B8E8E]/30' },
  { id: 'activity', label: 'Aktivität & Sport', icon: 'Compass', color: '#B37D4E', bg: 'bg-[#B37D4E]/15 text-[#B37D4E] border-[#B37D4E]/30' },
  { id: 'transport', label: 'Route & Transport', icon: 'Navigation', color: '#7D8C68', bg: 'bg-[#7D8C68]/15 text-[#7D8C68] border-[#7D8C68]/30' },
  { id: 'general', label: 'Notiz & Moment', icon: 'FileText', color: '#8C8273', bg: 'bg-[#8C8273]/15 text-[#8C8273] border-[#8C8273]/30' }
];
