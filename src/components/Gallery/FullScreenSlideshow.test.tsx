// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { FullScreenSlideshow, GalleryMediaItem } from './FullScreenSlideshow';
import { JournalEntry } from '../../types';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const mockEntry1: JournalEntry = {
  id: 'entry-1',
  tripId: 'trip-1',
  title: 'Passo dello Stelvio Gipfel',
  note: 'Traumhafte Passstraße auf 2757m Höhe.',
  coordinates: { lat: 46.528, lng: 10.453 },
  locationName: 'Stilfser Joch, Italien',
  date: '2026-08-10',
  category: 'nature',
  media: [
    {
      id: 'm-1',
      type: 'photo',
      url: 'https://images.unsplash.com/photo-stelvio-1',
      caption: 'Blick über die Kehren',
      timestamp: '2026-08-10T12:00:00Z',
      deviceInfo: 'Sony A7 IV',
    },
    {
      id: 'm-2',
      type: 'photo',
      url: 'https://images.unsplash.com/photo-stelvio-2',
      caption: 'Gipfelstein 2757m',
      timestamp: '2026-08-10T12:30:00Z',
    },
  ],
  author: { id: 'u1', name: 'Max', avatar: 'https://avatar.url', color: '#E2725B', role: 'owner' },
  comments: [],
  likes: [],
  createdAt: '2026-08-10T12:00:00Z',
  updatedAt: '2026-08-10T12:00:00Z',
};

const mockEntry2: JournalEntry = {
  id: 'entry-2',
  tripId: 'trip-1',
  title: 'Rifugio Berghütte',
  note: 'Köstliche Tiroler Knödel nach der Tour.',
  coordinates: { lat: 46.51, lng: 10.42 },
  locationName: 'Südtirol, Italien',
  date: '2026-08-11',
  category: 'food',
  media: [
    {
      id: 'm-3',
      type: 'photo',
      url: 'https://images.unsplash.com/photo-food-1',
      caption: 'Traditionelle Knödelsuppe',
      timestamp: '2026-08-11T18:00:00Z',
    },
  ],
  author: { id: 'u2', name: 'Anna', avatar: 'https://avatar2.url', color: '#8A9A5B', role: 'editor' },
  comments: [],
  likes: [],
  createdAt: '2026-08-11T18:00:00Z',
  updatedAt: '2026-08-11T18:00:00Z',
};

const mockItems: GalleryMediaItem[] = [
  { media: mockEntry1.media[0], entry: mockEntry1 },
  { media: mockEntry1.media[1], entry: mockEntry1 },
  { media: mockEntry2.media[0], entry: mockEntry2 },
];

describe('FullScreenSlideshow Component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <FullScreenSlideshow
        items={mockItems}
        isOpen={false}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders initial slide and metadata correctly when open', () => {
    render(
      <FullScreenSlideshow
        items={mockItems}
        initialIndex={0}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('1 / 3')).toBeDefined();
    expect(screen.getByText('Passo dello Stelvio Gipfel')).toBeDefined();
    expect(screen.getByText('Stilfser Joch, Italien')).toBeDefined();
    expect(screen.getByText('"Blick über die Kehren"')).toBeDefined();
    expect(screen.getByText('Sony A7 IV')).toBeDefined();
  });

  it('navigates next and previous slides via buttons', () => {
    render(
      <FullScreenSlideshow
        items={mockItems}
        initialIndex={0}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const nextBtn = screen.getByTitle('Nächstes Bild (Pfeil rechts)');
    fireEvent.click(nextBtn);
    expect(screen.getByText('2 / 3')).toBeDefined();
    expect(screen.getByText('"Gipfelstein 2757m"')).toBeDefined();

    const prevBtn = screen.getByTitle('Vorheriges Bild (Pfeil links)');
    fireEvent.click(prevBtn);
    expect(screen.getByText('1 / 3')).toBeDefined();
  });

  it('navigates with keyboard shortcuts', () => {
    const handleClose = vi.fn();
    render(
      <FullScreenSlideshow
        items={mockItems}
        initialIndex={0}
        isOpen={true}
        onClose={handleClose}
      />
    );

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('2 / 3')).toBeDefined();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('1 / 3')).toBeDefined();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalled();
  });

  it('toggles autoplay mode on button click or space key', () => {
    render(
      <FullScreenSlideshow
        items={mockItems}
        initialIndex={0}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const autoplayBtn = screen.getByTitle('Diashow starten (Leertaste)');
    expect(screen.getByText('Autoplay')).toBeDefined();

    fireEvent.click(autoplayBtn);
    expect(screen.getByText('Pause')).toBeDefined();
    expect(screen.getByText('Live')).toBeDefined();

    fireEvent.keyDown(window, { key: ' ' });
    expect(screen.getByText('Autoplay')).toBeDefined();
  });

  it('zooms in and out with controls', () => {
    render(
      <FullScreenSlideshow
        items={mockItems}
        initialIndex={0}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('100%')).toBeDefined();
    const zoomInBtn = screen.getByTitle('Vergrößern (+)');
    fireEvent.click(zoomInBtn);
    expect(screen.getByText('150%')).toBeDefined();

    const zoomOutBtn = screen.getByTitle('Verkleinern (-)');
    fireEvent.click(zoomOutBtn);
    expect(screen.getByText('100%')).toBeDefined();
  });

  it('toggles information overlay with I key', () => {
    render(
      <FullScreenSlideshow
        items={mockItems}
        initialIndex={0}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Passo dello Stelvio Gipfel')).toBeDefined();
    fireEvent.keyDown(window, { key: 'i' });
    expect(screen.queryByText('Passo dello Stelvio Gipfel')).toBeNull();

    fireEvent.keyDown(window, { key: 'i' });
    expect(screen.getByText('Passo dello Stelvio Gipfel')).toBeDefined();
  });

  it('clicking thumbnail in filmstrip selects slide', () => {
    render(
      <FullScreenSlideshow
        items={mockItems}
        initialIndex={0}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const thumb3 = screen.getByTitle('3. Rifugio Berghütte');
    fireEvent.click(thumb3);
    expect(screen.getByText('3 / 3')).toBeDefined();
    expect(screen.getByText('Rifugio Berghütte')).toBeDefined();
  });

  it('calls onSelectEntry and closes when "Tagebucheintrag öffnen" is clicked', () => {
    const handleSelectEntry = vi.fn();
    const handleClose = vi.fn();

    render(
      <FullScreenSlideshow
        items={mockItems}
        initialIndex={0}
        isOpen={true}
        onClose={handleClose}
        onSelectEntry={handleSelectEntry}
      />
    );

    const openEntryBtn = screen.getByText('Tagebucheintrag öffnen');
    fireEvent.click(openEntryBtn);

    expect(handleClose).toHaveBeenCalled();
    expect(handleSelectEntry).toHaveBeenCalledWith(mockEntry1);
  });
});
