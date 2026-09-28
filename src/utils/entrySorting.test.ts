import { describe, it, expect } from 'vitest';
import { sortJournalEntries, moveEntryInList } from './entrySorting';
import { JournalEntry, Collaborator } from '../types';

const author: Collaborator = {
  id: 'u1',
  name: 'Sam',
  avatar: 'https://avatar.url',
  color: '#8A9A5B',
  role: 'editor',
};

const entries: JournalEntry[] = [
  {
    id: 'e1',
    tripId: 't1',
    title: 'Munich Departure',
    note: 'Starting journey',
    coordinates: { lat: 48.1, lng: 11.5 },
    locationName: 'Munich',
    category: 'sight',
    date: '2025-06-01T08:00:00Z',
    author,
    orderIndex: 0,
    media: [],
    comments: [],
    likes: [],
    syncStatus: 'synced',
    createdAt: '2025-06-01T08:00:00Z',
    updatedAt: '2025-06-01T08:00:00Z',
  },
  {
    id: 'e2',
    tripId: 't1',
    title: 'Innsbruck Stop',
    note: 'Mountain break',
    coordinates: { lat: 47.2, lng: 11.3 },
    locationName: 'Innsbruck',
    category: 'nature',
    date: '2025-06-03T12:00:00Z',
    author,
    orderIndex: 1,
    media: [],
    comments: [],
    likes: [],
    syncStatus: 'synced',
    createdAt: '2025-06-03T12:00:00Z',
    updatedAt: '2025-06-03T12:00:00Z',
  },
  {
    id: 'e3',
    tripId: 't1',
    title: 'Bolzano Vineyard',
    note: 'South Tyrol evening',
    coordinates: { lat: 46.4, lng: 11.3 },
    locationName: 'Bolzano',
    category: 'food',
    date: '2025-06-02T18:00:00Z',
    author,
    orderIndex: 2,
    media: [],
    comments: [],
    likes: [],
    syncStatus: 'synced',
    createdAt: '2025-06-02T18:00:00Z',
    updatedAt: '2025-06-02T18:00:00Z',
  },
];

describe('Entry Sorting & Reordering Utilities', () => {
  it('sorts by chronological travel date ascending (date_asc)', () => {
    const sorted = sortJournalEntries(entries, 'date_asc');
    expect(sorted.map((e) => e.id)).toEqual(['e1', 'e3', 'e2']);
  });

  it('sorts by newest first (date_desc)', () => {
    const sorted = sortJournalEntries(entries, 'date_desc');
    expect(sorted.map((e) => e.id)).toEqual(['e2', 'e3', 'e1']);
  });

  it('sorts alphabetically by title (title_asc)', () => {
    const sorted = sortJournalEntries(entries, 'title_asc');
    expect(sorted.map((e) => e.id)).toEqual(['e3', 'e2', 'e1']);
  });

  it('moves an item up or down cleanly in custom order', () => {
    const movedDown = moveEntryInList(entries, 'e1', 'down');
    expect(movedDown.map((e) => e.id)).toEqual(['e2', 'e1', 'e3']);

    const movedUp = moveEntryInList(movedDown, 'e1', 'up');
    expect(movedUp.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
  });
});
