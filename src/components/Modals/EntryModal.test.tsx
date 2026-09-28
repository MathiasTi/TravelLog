// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { EntryModal } from './EntryModal';
import { Collaborator } from '../../types';
import * as weatherService from '../../services/weatherService';

// Mock weatherService
vi.mock('../../services/weatherService', async () => {
  const actual = await vi.importActual<typeof weatherService>('../../services/weatherService');
  return {
    ...actual,
    fetchHistoricalWeather: vi.fn().mockResolvedValue({
      weather: {
        icon: 'sun',
        label: 'Sonnig & heiter',
        temp: 23,
        tempMin: 15,
        tempMax: 26,
        precipitation: 0,
        windSpeed: 10,
        source: 'Open-Meteo ERA5 Reanalysis',
        isHistorical: true,
      },
      source: 'Open-Meteo ERA5 Reanalysis',
      isHistorical: true,
      date: '2023-07-20',
    }),
  };
});

// Mock LocationPickerMap
vi.mock('../Map/LocationPickerMap', () => ({
  LocationPickerMap: ({ onSelectLocation }: any) => (
    <div data-testid="location-picker-map">
      <button
        type="button"
        onClick={() => onSelectLocation({ lat: 51.5074, lng: -0.1278 }, 'London, UK')}
      >
        Select London
      </button>
    </div>
  ),
}));

describe('EntryModal Weather Integration', () => {
  const mockUser: Collaborator = {
    id: 'user1',
    name: 'Traveler',
    email: 'traveler@test.de',
    avatar: '🦊',
    color: '#8A9A5B',
    role: 'owner',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders historical weather card when modal is open', async () => {
    render(
      <EntryModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        tripId="trip1"
        currentUser={mockUser}
        initialCoords={{ lat: 48.137, lng: 11.576 }}
        initialDate="2023-07-20"
      />
    );

    expect(screen.getByText('Historische Wetterdaten')).toBeDefined();
    expect(screen.getByText('Open-Meteo')).toBeDefined();

    await waitFor(() => {
      expect(weatherService.fetchHistoricalWeather).toHaveBeenCalled();
    });
  });

  it('allows manual adjustment of weather values', async () => {
    render(
      <EntryModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        tripId="trip1"
        currentUser={mockUser}
        initialCoords={{ lat: 48.137, lng: 11.576 }}
        initialDate="2023-07-20"
      />
    );

    // Toggle manual weather edit
    const editBtn = screen.getByTitle('Werte manuell anpassen');
    fireEvent.click(editBtn);

    expect(screen.getByText('Wetter manuell anpassen')).toBeDefined();

    // Select different weather option
    const select = screen.getByDisplayValue('Sonnig & heiter');
    fireEvent.change(select, { target: { value: 'Regnerisch' } });
    expect(screen.getByDisplayValue('Regnerisch')).toBeDefined();
  });

  it('re-fetches weather when date changes', async () => {
    render(
      <EntryModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        tripId="trip1"
        currentUser={mockUser}
        initialCoords={{ lat: 48.137, lng: 11.576 }}
        initialDate="2023-07-20"
      />
    );

    const dateInput = screen.getByDisplayValue('2023-07-20');
    fireEvent.change(dateInput, { target: { value: '2023-08-15' } });

    await waitFor(() => {
      expect(weatherService.fetchHistoricalWeather).toHaveBeenCalledWith(
        expect.objectContaining({ lat: 48.137, lng: 11.576 }),
        '2023-08-15'
      );
    });
  });

  it('saves entry with retrieved weather payload on form submission', async () => {
    const handleSave = vi.fn();
    render(
      <EntryModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={handleSave}
        tripId="trip1"
        currentUser={mockUser}
        initialCoords={{ lat: 48.137, lng: 11.576 }}
        initialDate="2023-07-20"
        initialTitle="München Erkundung"
      />
    );

    const submitBtn = screen.getByText('Eintrag speichern');
    fireEvent.click(submitBtn);

    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'München Erkundung',
        weather: expect.objectContaining({
          label: expect.any(String),
          isHistorical: true,
        }),
      })
    );
  });

  it('renders photo media and handles existing entries correctly', () => {
    const existingPhotoEntry = {
      id: 'entry-photo-1',
      tripId: 'trip1',
      title: 'Delfine im Meer',
      note: 'Wundervolles Foto der Delfine aufgenommen.',
      date: '2023-07-20',
      locationName: 'München',
      coordinates: { lat: 48.137, lng: 11.576 },
      category: 'nature' as const,
      media: [
        {
          id: 'media-p1',
          url: 'data:image/jpeg;base64,AAAA',
          type: 'photo' as const,
          caption: 'Delfin Sprung',
          size: 1500000,
        },
      ],
      author: mockUser,
      createdAt: '2023-07-20T10:00:00Z',
    };

    render(
      <EntryModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        tripId="trip1"
        currentUser={mockUser}
        editingEntry={existingPhotoEntry}
      />
    );

    // Verify title and cover badge are rendered
    expect(screen.getByText('Titelbild')).toBeDefined();
    expect(screen.getByDisplayValue('Delfine im Meer')).toBeDefined();
  });
});
