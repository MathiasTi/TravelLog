// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { EntryDetailModal } from './EntryDetailModal';
import { JournalEntry, Collaborator } from '../../types';
import * as weatherService from '../../services/weatherService';

vi.mock('../../services/weatherService', async () => {
  const actual = await vi.importActual<typeof weatherService>('../../services/weatherService');
  return {
    ...actual,
    fetchHistoricalWeather: vi.fn().mockResolvedValue({
      weather: {
        icon: 'cloud-sun',
        label: 'Leicht bewölkt',
        temp: 21,
        tempMin: 14,
        tempMax: 24,
        precipitation: 1.5,
        windSpeed: 12,
        weatherCode: 2,
        source: 'Open-Meteo ERA5 Reanalysis',
        isHistorical: true,
      },
      source: 'Open-Meteo ERA5 Reanalysis',
      isHistorical: true,
      date: '2023-08-15',
    }),
  };
});

// Mock ElevationChart
vi.mock('../Tracks/ElevationChart', () => ({
  ElevationChart: () => <div data-testid="elevation-chart" />,
}));

describe('EntryDetailModal Historical Weather Section', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockUser: Collaborator = {
    id: 'user1',
    name: 'Max Mustermann',
    avatar: 'https://example.com/avatar.jpg',
    color: '#8A9A5B',
    role: 'owner',
  };

  const sampleEntryWithWeather: JournalEntry = {
    id: 'entry-1',
    tripId: 'trip-1',
    title: 'Sonnenaufgang an den Drei Zinnen',
    note: 'Wunderschöne Morgenwanderung bei klarem Himmel und frischer Bergluft.',
    date: '2023-08-15T06:30:00Z',
    locationName: 'Dolomiten, Südtirol',
    coordinates: { lat: 46.6186, lng: 12.3028 },
    media: [],
    weather: {
      icon: 'sun',
      label: 'Sonnig & heiter',
      temp: 18,
      tempMin: 11,
      tempMax: 22,
      precipitation: 0,
      windSpeed: 8,
      weatherCode: 0,
      source: 'Open-Meteo ERA5 Reanalysis',
      isHistorical: true,
    },
    category: 'activity',
    author: mockUser,
    likes: [],
    comments: [],
    createdAt: '2023-08-15T08:00:00Z',
    updatedAt: '2023-08-15T08:00:00Z',
  };

  it('renders the dedicated historical weather section when weather data was retrieved', () => {
    render(
      <EntryDetailModal
        entry={sampleEntryWithWeather}
        isOpen={true}
        onClose={vi.fn()}
        currentUser={mockUser}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onAddComment={vi.fn()}
        onToggleLike={vi.fn()}
        onFocusOnMap={vi.fn()}
      />
    );

    // Section container should be rendered
    const weatherSection = document.getElementById('entry-detail-historical-weather-section');
    expect(weatherSection).not.toBeNull();
    const utils = within(weatherSection!);

    // Section title & badge
    expect(utils.getByText('Historische Wetterhistorie')).toBeDefined();
    expect(utils.getByText('Archivdaten')).toBeDefined();

    // Location and date context in weather section
    expect(utils.getByText('Dolomiten, Südtirol')).toBeDefined();
    expect(utils.getByText(/15\. August 2023/)).toBeDefined();

    // Metrics inside weather section
    expect(utils.getByText('18°C')).toBeDefined();
    expect(utils.getByText(/11° bis 22°C/)).toBeDefined();
    expect(utils.getByText('Sonnig & heiter')).toBeDefined();
    expect(utils.getByText('0 mm')).toBeDefined();
    expect(utils.getByText('8 km/h')).toBeDefined();

    // GPS coordinates footnote
    expect(utils.getByText(/46\.6186°/)).toBeDefined();
    expect(utils.getByText(/12\.3028°/)).toBeDefined();
  });

  it('allows fetching historical weather on demand if entry had no weather', async () => {
    const entryWithoutWeather: JournalEntry = {
      ...sampleEntryWithWeather,
      weather: undefined,
    };

    const mockOnEdit = vi.fn();

    render(
      <EntryDetailModal
        entry={entryWithoutWeather}
        isOpen={true}
        onClose={vi.fn()}
        currentUser={mockUser}
        onEdit={mockOnEdit}
        onDelete={vi.fn()}
        onAddComment={vi.fn()}
        onToggleLike={vi.fn()}
        onFocusOnMap={vi.fn()}
      />
    );

    expect(screen.getByText('Keine historischen Wetterdaten hinterlegt.')).toBeDefined();

    const fetchButton = screen.getByRole('button', { name: /Historische Wetterdaten abrufen/i });
    expect(fetchButton).toBeDefined();

    fireEvent.click(fetchButton);

    await waitFor(() => {
      expect(weatherService.fetchHistoricalWeather).toHaveBeenCalledWith(
        { lat: 46.6186, lng: 12.3028 },
        '2023-08-15'
      );
      expect(mockOnEdit).toHaveBeenCalledWith(
        expect.objectContaining({
          weather: expect.objectContaining({
            temp: 21,
            label: 'Leicht bewölkt',
          }),
        })
      );
    });
  });
});
