// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { WeatherSection } from './WeatherSection';
import { LocationSection } from './LocationSection';
import { MediaUploadSection } from './MediaUploadSection';
import { MediaItem } from '../../../types';

// Mock LocationPickerMap
vi.mock('../../Map/LocationPickerMap', () => ({
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

describe('EntryModal Modular Components', () => {
  afterEach(() => {
    cleanup();
  });
  describe('WeatherSection', () => {
    it('renders historical weather info correctly', () => {
      const mockToggle = vi.fn();
      const mockRefresh = vi.fn();
      const mockLabelChange = vi.fn();
      const mockTempChange = vi.fn();

      render(
        <WeatherSection
          coordinates={{ lat: 48.137, lng: 11.576 }}
          date="2023-08-15"
          weatherDetails={{
            temp: 24,
            label: 'Sonnig & heiter',
            icon: 'sun',
            tempMin: 18,
            tempMax: 26,
            precipitation: 0,
            windSpeed: 12,
            source: 'Open-Meteo ERA5',
          }}
          weatherLabel="Sonnig & heiter"
          weatherTemp={24}
          isLoadingWeather={false}
          showManualWeatherEdit={false}
          onToggleManualEdit={mockToggle}
          onRefreshWeather={mockRefresh}
          onWeatherLabelChange={mockLabelChange}
          onWeatherTempChange={mockTempChange}
        />
      );

      expect(screen.getByText('Historische Wetterdaten')).toBeDefined();
      expect(screen.getByText(/24°C/)).toBeDefined();
      expect(screen.getByText(/18° bis 26°C/)).toBeDefined();
      expect(screen.getByText(/12\s*km\/h/)).toBeDefined();
    });

    it('triggers refresh and manual edit toggle', () => {
      const mockToggle = vi.fn();
      const mockRefresh = vi.fn();

      render(
        <WeatherSection
          coordinates={{ lat: 48.137, lng: 11.576 }}
          date="2023-08-15"
          weatherDetails={null}
          weatherLabel="Sonnig & heiter"
          weatherTemp={22}
          isLoadingWeather={false}
          showManualWeatherEdit={true}
          onToggleManualEdit={mockToggle}
          onRefreshWeather={mockRefresh}
          onWeatherLabelChange={vi.fn()}
          onWeatherTempChange={vi.fn()}
        />
      );

      fireEvent.click(screen.getByTitle('Wetterdaten für aktuellen Ort & Datum neu abrufen'));
      expect(mockRefresh).toHaveBeenCalled();

      expect(screen.getByText('Wetter manuell anpassen')).toBeDefined();
    });
  });

  describe('LocationSection', () => {
    it('renders location input and allows typing', () => {
      const mockNameChange = vi.fn();
      const mockToggleMap = vi.fn();

      render(
        <LocationSection
          locationName="Neuschwanstein"
          coordinates={{ lat: 47.557, lng: 10.749 }}
          showMapPicker={false}
          isGeocoding={false}
          showAdvancedOptions={false}
          photoThumbnail={null}
          hasExifGps={false}
          onLocationNameChange={mockNameChange}
          onToggleMapPicker={mockToggleMap}
          onCloseMapPicker={vi.fn()}
          onToggleAdvancedOptions={vi.fn()}
          onSelectLocation={vi.fn()}
          onCoordinatesChange={vi.fn()}
        />
      );

      expect(screen.getByDisplayValue('Neuschwanstein')).toBeDefined();
      const mapBtn = screen.getByText('Karte anzeigen');
      fireEvent.click(mapBtn);
      expect(mockToggleMap).toHaveBeenCalled();
    });
  });

  describe('MediaUploadSection', () => {
    it('renders media tiles and upload buttons', () => {
      const mediaList: MediaItem[] = [
        {
          id: 'media-1',
          url: 'https://example.com/photo.jpg',
          type: 'photo',
          caption: 'Foto 1',
          timestamp: new Date().toISOString(),
        },
      ];

      render(
        <MediaUploadSection
          mediaList={mediaList}
          isProcessingMedia={false}
          processingProgressText=""
          exifNotice="📍 GPS übernommen"
          showMapPicker={false}
          onFilesSelected={vi.fn()}
          onRemoveMedia={vi.fn()}
          onOpenQrModal={vi.fn()}
          onToggleMapPicker={vi.fn()}
          onExifLocationJump={vi.fn()}
          onClearExifNotice={vi.fn()}
        />
      );

      expect(screen.getByText(/Bilder & Mediathek/)).toBeDefined();
      expect(screen.getByText('Titelbild')).toBeDefined();
      expect(screen.getByText('📍 GPS übernommen')).toBeDefined();
    });

    it('renders progress bar and file status during processing', () => {
      render(
        <MediaUploadSection
          mediaList={[]}
          isProcessingMedia={true}
          processingProgressText="[1/2] dolomites.jpg: Bild komprimieren..."
          processingProgressPercent={65}
          processingCurrentFile="dolomites.jpg"
          processingStats={{ current: 1, total: 2 }}
          exifNotice={null}
          showMapPicker={false}
          onFilesSelected={vi.fn()}
          onRemoveMedia={vi.fn()}
          onOpenQrModal={vi.fn()}
          onToggleMapPicker={vi.fn()}
          onExifLocationJump={vi.fn()}
          onClearExifNotice={vi.fn()}
        />
      );

      expect(screen.getByText(/dolomites\.jpg: Bild komprimieren/)).toBeDefined();
      expect(screen.getByText('65%')).toBeDefined();
      expect(screen.getByText('1/2')).toBeDefined();
      expect(screen.getByText('dolomites.jpg')).toBeDefined();
    });

    it('renders photo date badge and triggers onExifDateJump when clicked', () => {
      const mockDateJump = vi.fn();
      const mediaList: MediaItem[] = [
        {
          id: 'media-date-1',
          url: 'https://example.com/photo.jpg',
          type: 'photo',
          caption: 'Foto mit Datum',
          timestamp: '2023-09-14T15:30:00Z',
          exifDate: '2023-09-14T15:30:00Z',
          exifLocation: { lat: 48.137, lng: 11.576 },
        },
      ];

      render(
        <MediaUploadSection
          mediaList={mediaList}
          isProcessingMedia={false}
          processingProgressText=""
          exifNotice={null}
          showMapPicker={false}
          onFilesSelected={vi.fn()}
          onRemoveMedia={vi.fn()}
          onOpenQrModal={vi.fn()}
          onToggleMapPicker={vi.fn()}
          onExifLocationJump={vi.fn()}
          onExifDateJump={mockDateJump}
          onClearExifNotice={vi.fn()}
        />
      );

      const dateBtn = screen.getByTitle('Aufnahmedatum für den Eintrag übernehmen');
      expect(dateBtn).toBeDefined();
      fireEvent.click(dateBtn);
      expect(mockDateJump).toHaveBeenCalledWith('2023-09-14T15:30:00Z', { lat: 48.137, lng: 11.576 });
    });
  });
});
