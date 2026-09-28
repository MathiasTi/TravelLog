import { WeatherInfo, Coordinates } from '../types';

export interface WeatherFetchResult {
  weather: WeatherInfo;
  source: string;
  isHistorical: boolean;
  date: string;
}

// Map WMO Weather Interpretation Codes to German descriptions and Lucide icon names
export function mapWmoCodeToWeather(code: number): { label: string; icon: string } {
  switch (code) {
    case 0:
      return { label: 'Sonnig & heiter', icon: 'sun' };
    case 1:
      return { label: 'Überwiegend heiter', icon: 'sun' };
    case 2:
      return { label: 'Leicht bewölkt', icon: 'cloud-sun' };
    case 3:
      return { label: 'Bedeckt', icon: 'cloud' };
    case 45:
    case 48:
      return { label: 'Neblig / Hochnebel', icon: 'cloud' };
    case 51:
    case 53:
    case 55:
      return { label: 'Leichter Nieselregen', icon: 'cloud-rain' };
    case 56:
    case 57:
      return { label: 'Gefrierender Nieselregen', icon: 'snowflake' };
    case 61:
      return { label: 'Leichter Regen', icon: 'cloud-rain' };
    case 63:
      return { label: 'Mäßiger Regen', icon: 'cloud-rain' };
    case 65:
      return { label: 'Starker Regen', icon: 'cloud-rain' };
    case 66:
    case 67:
      return { label: 'Gefrierender Regen', icon: 'snowflake' };
    case 71:
    case 73:
    case 75:
      return { label: 'Schneefall', icon: 'snowflake' };
    case 77:
      return { label: 'Schneegriesel', icon: 'snowflake' };
    case 80:
    case 81:
    case 82:
      return { label: 'Regenschauer', icon: 'cloud-rain' };
    case 85:
    case 86:
      return { label: 'Schneeschauer', icon: 'snowflake' };
    case 95:
      return { label: 'Gewitter', icon: 'cloud-rain' };
    case 96:
    case 99:
      return { label: 'Gewitter mit Hagel', icon: 'cloud-rain' };
    default:
      return { label: 'Sonnig & heiter', icon: 'sun' };
  }
}

// In-memory cache to prevent multiple fetches for same coords & date
const weatherCache = new Map<string, WeatherFetchResult>();

export function clearWeatherCache(): void {
  weatherCache.clear();
}

export function formatWeatherSummary(weather?: WeatherInfo | null): string {
  if (!weather) return '';
  const parts: string[] = [];
  if (weather.temp !== undefined) {
    parts.push(`${weather.temp}°C`);
  }
  if (weather.label) {
    parts.push(weather.label);
  }
  if (weather.tempMin !== undefined && weather.tempMax !== undefined) {
    parts.push(`(${weather.tempMin}°C bis ${weather.tempMax}°C)`);
  }
  if (weather.precipitation !== undefined && weather.precipitation > 0) {
    parts.push(`${weather.precipitation} mm Regen`);
  }
  if (weather.windSpeed !== undefined && weather.windSpeed > 0) {
    parts.push(`${weather.windSpeed} km/h Wind`);
  }
  return parts.join(' · ');
}

/**
 * Fetches historical or forecast weather for specific coordinates and date.
 * Uses Open-Meteo Archive API for historical dates (1940 to recent past),
 * and Open-Meteo Forecast API for recent/future dates.
 */
export async function fetchHistoricalWeather(
  coordinates: Coordinates,
  dateStr: string // YYYY-MM-DD
): Promise<WeatherFetchResult | null> {
  if (!coordinates || typeof coordinates.lat !== 'number' || typeof coordinates.lng !== 'number') {
    return null;
  }

  // Format date to YYYY-MM-DD
  const formattedDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(formattedDate)) {
    return null;
  }

  const cacheKey = `${coordinates.lat.toFixed(3)}_${coordinates.lng.toFixed(3)}_${formattedDate}`;
  if (weatherCache.has(cacheKey)) {
    return weatherCache.get(cacheKey)!;
  }

  // Try Server API first
  try {
    const serverUrl = `/api/weather/historical?lat=${encodeURIComponent(coordinates.lat)}&lng=${encodeURIComponent(coordinates.lng)}&date=${encodeURIComponent(formattedDate)}`;
    const serverRes = await fetch(serverUrl);
    if (serverRes.ok) {
      const data = await serverRes.json();
      if (data && data.weather) {
        const result: WeatherFetchResult = {
          weather: data.weather,
          source: data.source || 'Open-Meteo ERA5 Reanalysis',
          isHistorical: data.isHistorical ?? true,
          date: formattedDate,
        };
        weatherCache.set(cacheKey, result);
        return result;
      }
    }
  } catch (err) {
    console.warn('[WeatherService] Backend proxy call failed, fallback to direct Open-Meteo API:', err);
  }

  // Direct Client-Side Open-Meteo API Fallback
  try {
    const selectedDate = new Date(formattedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // If date is more than 5 days in the past, Open-Meteo Archive is best
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    let apiUrl = '';
    let isHistorical = true;

    if (selectedDate < fiveDaysAgo) {
      // Historical Archive API
      apiUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${coordinates.lat}&longitude=${coordinates.lng}&start_date=${formattedDate}&end_date=${formattedDate}&daily=weather_code,temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,wind_speed_10m_max&timezone=auto`;
      isHistorical = true;
    } else {
      // Forecast / Recent API
      apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${coordinates.lat}&longitude=${coordinates.lng}&start_date=${formattedDate}&end_date=${formattedDate}&daily=weather_code,temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,wind_speed_10m_max&timezone=auto`;
      isHistorical = selectedDate <= today;
    }

    const res = await fetch(apiUrl);
    if (!res.ok) {
      throw new Error(`Open-Meteo responded with status ${res.status}`);
    }

    const json = await res.json();
    if (!json.daily || !json.daily.time || json.daily.time.length === 0) {
      throw new Error('No daily weather data returned');
    }

    const weatherCode = json.daily.weather_code?.[0] ?? 0;
    const tempMax = json.daily.temperature_2m_max?.[0] !== undefined ? Math.round(json.daily.temperature_2m_max[0]) : undefined;
    const tempMin = json.daily.temperature_2m_min?.[0] !== undefined ? Math.round(json.daily.temperature_2m_min[0]) : undefined;
    const tempMean = json.daily.temperature_2m_mean?.[0] !== undefined
      ? Math.round(json.daily.temperature_2m_mean[0])
      : tempMax !== undefined && tempMin !== undefined
      ? Math.round((tempMax + tempMin) / 2)
      : tempMax;
    const precipitation = json.daily.precipitation_sum?.[0] !== undefined ? Number(json.daily.precipitation_sum[0].toFixed(1)) : 0;
    const windSpeed = json.daily.wind_speed_10m_max?.[0] !== undefined ? Math.round(json.daily.wind_speed_10m_max[0]) : undefined;

    const mapped = mapWmoCodeToWeather(weatherCode);

    const weather: WeatherInfo = {
      icon: mapped.icon,
      label: mapped.label,
      temp: tempMean,
      tempMin,
      tempMax,
      precipitation,
      windSpeed,
      weatherCode,
      source: isHistorical ? 'Historische Wetterdaten (Open-Meteo ERA5)' : 'Wetterdienst (Open-Meteo)',
      isHistorical,
    };

    const result: WeatherFetchResult = {
      weather,
      source: weather.source!,
      isHistorical,
      date: formattedDate,
    };

    weatherCache.set(cacheKey, result);
    return result;
  } catch (clientErr) {
    console.error('[WeatherService] Failed to retrieve weather data:', clientErr);
    return null;
  }
}

