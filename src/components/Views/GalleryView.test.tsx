// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { GalleryView } from './GalleryView';
import { JournalEntry, Trip } from '../../types';

afterEach(() => {
  cleanup();
});

const mockTrip: Trip = {
  id: 'trip-1',
  title: 'Alpen Tour 2026',
  description: 'Gravel Tour über die Alpen',
  startDate: '2026-08-01',
  coverImage: 'https://images.unsplash.com/photo-alps',
  countryCodes: ['DE', 'AT', 'IT'],
  passwordProtected: false,
  isPublic: false,
  shareToken: 'tok123',
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
  defaultCoordinates: [47.5, 11.5],
  defaultZoom: 8,
  collaborators: [
    { id: 'u1', name: 'Max', avatar: '', color: '#E2725B', role: 'owner' },
  ],
};

const mockEntries: JournalEntry[] = [
  {
    id: 'entry-1',
    tripId: 'trip-1',
    title: 'Gavia Pass Anstieg',
    note: 'Wilder Schotteranstieg.',
    coordinates: { lat: 46.34, lng: 10.48 },
    locationName: 'Passo di Gavia',
    date: '2026-08-05',
    category: 'nature',
    media: [
      {
        id: 'm-1',
        type: 'photo',
        url: 'https://images.unsplash.com/photo-gavia-1',
        caption: 'Blick auf den Lago Bianco',
        timestamp: '2026-08-05T10:00:00Z',
      },
      {
        id: 'm-2',
        type: 'photo',
        url: 'https://images.unsplash.com/photo-gavia-2',
        caption: 'Abfahrt im Schotter',
        timestamp: '2026-08-05T11:00:00Z',
      },
    ],
    author: { id: 'u1', name: 'Max', avatar: '', color: '#E2725B', role: 'owner' },
    comments: [],
    likes: [],
    createdAt: '2026-08-05T10:00:00Z',
    updatedAt: '2026-08-05T10:00:00Z',
  },
  {
    id: 'entry-2',
    tripId: 'trip-1',
    title: 'Bormio Altstadt Pizza',
    note: 'Abendessen nach der Königsetappe.',
    coordinates: { lat: 46.46, lng: 10.37 },
    locationName: 'Bormio, Italien',
    date: '2026-08-05',
    category: 'food',
    media: [
      {
        id: 'm-3',
        type: 'photo',
        url: 'https://images.unsplash.com/photo-bormio-1',
        caption: 'Knusprige Steinofenpizza',
        timestamp: '2026-08-05T19:00:00Z',
      },
    ],
    author: { id: 'u1', name: 'Max', avatar: '', color: '#E2725B', role: 'owner' },
    comments: [],
    likes: [],
    createdAt: '2026-08-05T19:00:00Z',
    updatedAt: '2026-08-05T19:00:00Z',
  },
];

describe('GalleryView Component', () => {
  it('renders gallery header, stats and media grid', () => {
    render(
      <GalleryView
        entries={mockEntries}
        activeTrip={mockTrip}
        onSelectEntry={vi.fn()}
      />
    );

    expect(screen.getByText('Fotogalerie')).toBeDefined();
    expect(screen.getByText('3 von 3 Fotos aus 2 Reise-Stopps')).toBeDefined();
    expect(screen.getByText('Diashow starten')).toBeDefined();
  });

  it('filters media by category', () => {
    render(
      <GalleryView
        entries={mockEntries}
        activeTrip={mockTrip}
        onSelectEntry={vi.fn()}
      />
    );

    // Click the category filter pill for Essen & Trinken
    const foodCategoryPill = screen.getAllByText('Essen & Trinken')[0];
    fireEvent.click(foodCategoryPill);

    expect(screen.getByText('1 von 3 Fotos aus 2 Reise-Stopps')).toBeDefined();
  });

  it('opens FullScreenSlideshow when "Diashow starten" button is clicked', () => {
    render(
      <GalleryView
        entries={mockEntries}
        activeTrip={mockTrip}
        onSelectEntry={vi.fn()}
      />
    );

    const startBtn = screen.getByText('Diashow starten');
    fireEvent.click(startBtn);

    expect(document.getElementById('fullscreen-slideshow-overlay')).toBeDefined();
    expect(screen.getByText('1 / 3')).toBeDefined();
  });

  it('clicking a grid item opens FullScreenSlideshow at that image', () => {
    render(
      <GalleryView
        entries={mockEntries}
        activeTrip={mockTrip}
        onSelectEntry={vi.fn()}
      />
    );

    const itemCard = screen.getByTitle('Bormio Altstadt Pizza - In Vollbild-Diashow öffnen');
    fireEvent.click(itemCard);

    expect(document.getElementById('fullscreen-slideshow-overlay')).toBeDefined();
    expect(screen.getByText('3 / 3')).toBeDefined();
    expect(screen.getAllByText('Bormio Altstadt Pizza').length).toBeGreaterThan(0);
  });

  it('shows empty state when no media matches filters', () => {
    render(
      <GalleryView
        entries={[]}
        activeTrip={mockTrip}
        onSelectEntry={vi.fn()}
      />
    );

    expect(screen.getByText('Keine Fotos gefunden')).toBeDefined();
  });
});
