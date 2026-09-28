import React from 'react';
import { Coordinates, WeatherInfo } from '../../../types';
import {
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  Snowflake,
  Wind,
  CloudLightning,
  Thermometer,
  Droplets,
  RefreshCw,
  Loader2,
  SlidersHorizontal,
  History,
} from 'lucide-react';

export const WEATHER_OPTIONS = [
  { icon: 'sun', label: 'Sonnig & heiter' },
  { icon: 'cloud-sun', label: 'Leicht bewölkt' },
  { icon: 'cloud', label: 'Bedeckt' },
  { icon: 'cloud-rain', label: 'Regnerisch' },
  { icon: 'cloud-lightning', label: 'Gewitter' },
  { icon: 'wind', label: 'Windig / Stürmisch' },
  { icon: 'snowflake', label: 'Schneefall' },
];

export const renderWeatherIcon = (iconName?: string, className = 'w-5 h-5') => {
  switch (iconName) {
    case 'sun':
      return <Sun className={`${className} text-amber-500`} />;
    case 'cloud-sun':
      return <CloudSun className={`${className} text-amber-400`} />;
    case 'cloud':
      return <Cloud className={`${className} text-slate-500`} />;
    case 'cloud-rain':
      return <CloudRain className={`${className} text-blue-500`} />;
    case 'cloud-lightning':
      return <CloudLightning className={`${className} text-purple-500`} />;
    case 'snowflake':
      return <Snowflake className={`${className} text-cyan-500`} />;
    case 'wind':
      return <Wind className={`${className} text-teal-600`} />;
    default:
      return <Sun className={`${className} text-amber-500`} />;
  }
};

interface WeatherSectionProps {
  coordinates: Coordinates | null;
  date: string;
  weatherDetails: WeatherInfo | null;
  weatherLabel: string;
  weatherTemp: number | '';
  isLoadingWeather: boolean;
  showManualWeatherEdit: boolean;
  onToggleManualEdit: () => void;
  onRefreshWeather: () => void;
  onWeatherLabelChange: (label: string) => void;
  onWeatherTempChange: (temp: number | '') => void;
}

export const WeatherSection: React.FC<WeatherSectionProps> = ({
  coordinates,
  date,
  weatherDetails,
  weatherLabel,
  weatherTemp,
  isLoadingWeather,
  showManualWeatherEdit,
  onToggleManualEdit,
  onRefreshWeather,
  onWeatherLabelChange,
  onWeatherTempChange,
}) => {
  return (
    <div className="p-3.5 rounded-2xl bg-white border border-[#E5E1D8] shadow-xs space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#8A9A5B]/15 text-[#8A9A5B]">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#4E3B31] flex items-center gap-1.5">
              <span>Historische Wetterdaten</span>
              <span className="px-1.5 py-0.5 rounded-md bg-[#8A9A5B]/15 text-[#8A9A5B] text-[10px] font-mono font-semibold">
                Open-Meteo
              </span>
            </h4>
            <p className="text-[11px] text-[#8C8273]">
              {coordinates
                ? `Automatisch anhand von Ort (${coordinates.lat.toFixed(2)}°, ${coordinates.lng.toFixed(2)}°) und Datum ermittelt`
                : 'Automatisch anhand von Standort und Reisedatum ermittelt'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onRefreshWeather}
            disabled={isLoadingWeather}
            className="px-2.5 py-1 rounded-xl bg-[#F1EDE6] hover:bg-[#E5E1D8] active:scale-95 text-[#4E3B31] text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
            title="Wetterdaten für aktuellen Ort & Datum neu abrufen"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#8A9A5B] ${isLoadingWeather ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Abrufen</span>
          </button>
          <button
            type="button"
            onClick={onToggleManualEdit}
            className={`p-1.5 rounded-xl border transition cursor-pointer ${
              showManualWeatherEdit
                ? 'bg-[#8A9A5B] text-white border-[#8A9A5B]'
                : 'bg-white text-[#6B5E55] border-[#E5E1D8] hover:bg-[#F1EDE6]'
            }`}
            title="Werte manuell anpassen"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Weather Data Display Banner */}
      {isLoadingWeather ? (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-[#F1EDE6]/60 border border-[#E5E1D8] text-xs text-[#6B5E55]">
          <Loader2 className="w-4 h-4 animate-spin text-[#8A9A5B]" />
          <span>Historische Wetterdaten werden aus dem Open-Meteo Archiv geladen...</span>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-[#FDFBF7] border border-[#E5E1D8] space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white shadow-2xs border border-[#E5E1D8] flex items-center justify-center">
                {renderWeatherIcon(weatherDetails?.icon || 'sun', 'w-6 h-6')}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-[#4E3B31] font-mono">
                    {weatherTemp !== '' ? `Ø ${weatherTemp}°C` : '–'}
                  </span>
                  <span className="text-xs font-semibold text-[#4E3B31]">
                    {weatherLabel}
                  </span>
                  {weatherDetails?.isHistorical && (
                    <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#8A9A5B]/15 text-[#8A9A5B]">
                      Historisch
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#8C8273] mt-0.5">
                  {weatherDetails?.tempMin !== undefined && weatherDetails?.tempMax !== undefined && (
                    <span className="flex items-center gap-0.5">
                      <Thermometer className="w-3 h-3 text-[#E2725B]" />
                      <span>{weatherDetails.tempMin}° bis {weatherDetails.tempMax}°C</span>
                    </span>
                  )}
                  {weatherDetails?.precipitation !== undefined && (
                    <span className="flex items-center gap-0.5 text-blue-600 font-medium">
                      <Droplets className="w-3 h-3" />
                      <span>{weatherDetails.precipitation} mm Regen</span>
                    </span>
                  )}
                  {weatherDetails?.windSpeed !== undefined && (
                    <span className="flex items-center gap-0.5 text-teal-700">
                      <Wind className="w-3 h-3" />
                      <span>{weatherDetails.windSpeed} km/h Wind</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#8C8273] font-medium bg-[#F1EDE6] px-2 py-1 rounded-md">
                {weatherDetails?.source || 'Open-Meteo ERA5'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 text-[10px] text-[#8C8273] border-t border-[#E5E1D8]/60">
            <span>
              {weatherDetails
                ? '✓ Automatisch in Tagebucheintrag eingefügt (Durchschnittstemperatur & WMO-Wetterlage)'
                : 'Klicke auf "Abrufen" oder wähle Standort/Datum zur automatischen Abfrage'}
            </span>
          </div>
        </div>
      )}

      {/* Manual Weather Edit Section */}
      {showManualWeatherEdit && (
        <div className="pt-2 border-t border-[#E5E1D8] space-y-2 animate-in fade-in duration-150">
          <div className="text-[11px] font-semibold text-[#6B5E55] flex items-center justify-between">
            <span>Wetter manuell anpassen</span>
            <span className="text-[10px] text-[#8C8273]">Überschreibt die automatischen Daten</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select
              value={weatherLabel}
              onChange={(e) => onWeatherLabelChange(e.target.value)}
              className="col-span-2 px-3 py-2 rounded-xl bg-white border border-[#E5E1D8] text-[#4E3B31] text-xs focus:outline-none"
            >
              {WEATHER_OPTIONS.map((w) => (
                <option key={w.label} value={w.label}>
                  {w.label}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1 bg-white px-3 py-2 rounded-xl border border-[#E5E1D8]">
              <input
                type="number"
                placeholder="22"
                value={weatherTemp}
                onChange={(e) => onWeatherTempChange(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-transparent text-[#4E3B31] text-xs font-bold focus:outline-none"
              />
              <span className="text-[#8C8273] text-xs font-bold">°C</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
