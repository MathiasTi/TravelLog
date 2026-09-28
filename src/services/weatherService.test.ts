import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  mapWmoCodeToWeather,
  formatWeatherSummary,
  clearWeatherCache,
  fetchHistoricalWeather
} from './weatherService';

describe('weatherService', () => {
  beforeEach(() => {
    clearWeatherCache();
    vi.restoreAllMocks();
  });

  describe('mapWmoCodeToWeather', () => {
    it('maps 0 to sunny', () => {
      const res = mapWmoCodeToWeather(0);
      expect(res.label).toBe('Sonnig & heiter');
      expect(res.icon).toBe('sun');
    });

    it('maps 2 to slightly cloudy', () => {
      const res = mapWmoCodeToWeather(2);
      expect(res.label).toBe('Leicht bewölkt');
      expect(res.icon).toBe('cloud-sun');
    });

    it('maps 3 to overcast', () => {
      const res = mapWmoCodeToWeather(3);
      expect(res.label).toBe('Bedeckt');
      expect(res.icon).toBe('cloud');
    });

    it('maps rain codes correctly', () => {
      const res61 = mapWmoCodeToWeather(61);
      expect(res61.label).toBe('Leichter Regen');
      expect(res61.icon).toBe('cloud-rain');

      const res65 = mapWmoCodeToWeather(65);
      expect(res65.label).toBe('Starker Regen');
      expect(res65.icon).toBe('cloud-rain');
    });

    it('maps snow codes correctly', () => {
      const res71 = mapWmoCodeToWeather(71);
      expect(res71.label).toBe('Schneefall');
      expect(res71.icon).toBe('snowflake');
    });

    it('maps thunderstorm codes correctly', () => {
      const res95 = mapWmoCodeToWeather(95);
      expect(res95.label).toBe('Gewitter');
      expect(res95.icon).toBe('cloud-rain');
    });

    it('falls back to sunny for unknown code', () => {
      const res = mapWmoCodeToWeather(999);
      expect(res.label).toBe('Sonnig & heiter');
      expect(res.icon).toBe('sun');
    });
  });

  describe('formatWeatherSummary', () => {
    it('returns empty string for null or undefined', () => {
      expect(formatWeatherSummary(null)).toBe('');
      expect(formatWeatherSummary(undefined)).toBe('');
    });

    it('formats complete weather info', () => {
      const formatted = formatWeatherSummary({
        icon: 'sun',
        label: 'Sonnig & heiter',
        temp: 24,
        tempMin: 15,
        tempMax: 27,
        precipitation: 0,
        windSpeed: 12,
      });
      expect(formatted).toContain('24°C');
      expect(formatted).toContain('Sonnig & heiter');
      expect(formatted).toContain('(15°C bis 27°C)');
      expect(formatted).toContain('12 km/h Wind');
    });

    it('includes precipitation if greater than 0', () => {
      const formatted = formatWeatherSummary({
        icon: 'cloud-rain',
        label: 'Regnerisch',
        temp: 14,
        precipitation: 4.5,
      });
      expect(formatted).toContain('4.5 mm Regen');
    });
  });

  describe('fetchHistoricalWeather', () => {
    it('returns null for invalid coordinates or dates', async () => {
      // @ts-ignore
      expect(await fetchHistoricalWeather(null, '2023-05-10')).toBeNull();
      expect(await fetchHistoricalWeather({ lat: 48, lng: 11 }, 'invalid-date')).toBeNull();
    });

    it('fetches weather via backend proxy successfully', async () => {
      const fakeWeatherData = {
        weather: {
          icon: 'sun',
          label: 'Sonnig & heiter',
          temp: 22,
          tempMin: 14,
          tempMax: 25,
          precipitation: 0,
          windSpeed: 10,
          source: 'Open-Meteo ERA5 Reanalysis',
          isHistorical: true,
        },
        source: 'Open-Meteo ERA5 Reanalysis',
        isHistorical: true,
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => fakeWeatherData,
      } as any);

      const result = await fetchHistoricalWeather({ lat: 48.137, lng: 11.576 }, '2022-07-15');
      expect(result).not.toBeNull();
      expect(result?.weather.temp).toBe(22);
      expect(result?.isHistorical).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/weather/historical'));
    });

    it('falls back to direct Open-Meteo client call when backend proxy fails', async () => {
      // First call (backend) fails, second call (Open-Meteo) succeeds
      global.fetch = vi.fn()
        .mockRejectedValueOnce(new Error('Backend offline'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            daily: {
              time: ['2020-06-15'],
              weather_code: [1],
              temperature_2m_max: [28.2],
              temperature_2m_min: [16.4],
              temperature_2m_mean: [22.3],
              precipitation_sum: [0.0],
              wind_speed_10m_max: [14.0],
            },
          }),
        } as any);

      const result = await fetchHistoricalWeather({ lat: 50.11, lng: 8.68 }, '2020-06-15');
      expect(result).not.toBeNull();
      expect(result?.weather.temp).toBe(22);
      expect(result?.weather.tempMax).toBe(28);
      expect(result?.weather.tempMin).toBe(16);
      expect(result?.weather.label).toBe('Überwiegend heiter');
    });

    it('uses memory cache for consecutive identical requests', async () => {
      const fakeWeatherData = {
        weather: {
          icon: 'sun',
          label: 'Sonnig & heiter',
          temp: 20,
        },
        source: 'Cache Test',
        isHistorical: true,
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => fakeWeatherData,
      } as any);

      const res1 = await fetchHistoricalWeather({ lat: 48.137, lng: 11.576 }, '2023-01-01');
      const res2 = await fetchHistoricalWeather({ lat: 48.137, lng: 11.576 }, '2023-01-01');

      expect(res1).toEqual(res2);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('calculates average temperature from min and max when mean is absent', async () => {
      global.fetch = vi.fn()
        .mockRejectedValueOnce(new Error('Backend error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            daily: {
              time: ['2021-08-20'],
              weather_code: [3],
              temperature_2m_max: [26.0],
              temperature_2m_min: [14.0],
              precipitation_sum: [1.2],
              wind_speed_10m_max: [18.5],
            },
          }),
        } as any);

      const result = await fetchHistoricalWeather({ lat: 52.52, lng: 13.405 }, '2021-08-20');
      expect(result).not.toBeNull();
      expect(result?.weather.temp).toBe(20); // (26 + 14) / 2 = 20
      expect(result?.weather.tempMin).toBe(14);
      expect(result?.weather.tempMax).toBe(26);
      expect(result?.weather.precipitation).toBe(1.2);
      expect(result?.weather.windSpeed).toBe(19);
      expect(result?.weather.label).toBe('Bedeckt');
    });
  });
});
