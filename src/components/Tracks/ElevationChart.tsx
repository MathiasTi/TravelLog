import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import { GpsTrackData, GpsTrackPoint, GpsHighlight } from '../../types';
import {
  getGradientColor,
  getGradientLabel,
} from '../../services/trackParser';
import {
  Mountain,
  Gauge,
  Heart,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Flame,
  Flag,
} from 'lucide-react';

export interface ElevationChartProps {
  track?: GpsTrackData;
  points?: GpsTrackPoint[];
  highlights?: GpsHighlight[];
  height?: number;
  className?: string;
  onPointHover?: (point: GpsTrackPoint | null, index: number | null) => void;
  onPointClick?: (point: GpsTrackPoint, index: number) => void;
}

interface ChartDataPoint {
  index: number;
  distance: number; // in km
  formattedDistance: string;
  altitude: number; // in m
  slope: number; // in %
  gradientColor: string;
  gradientLabel: string;
  speed?: number; // in km/h
  heartRate?: number; // in bpm
  cadence?: number; // in rpm
  power?: number; // in watts
  rawPoint: GpsTrackPoint;
}

/**
 * Custom Tooltip for the Recharts Elevation Profile
 * Clearly highlights the gradient / slope on hover with color-coded badges and metrics.
 */
const CustomElevationTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: any[];
}) => {
  if (!active || !payload || !payload.length) return null;

  const data: ChartDataPoint = payload[0]?.payload;
  if (!data) return null;

  const slope = data.slope;
  const slopeColor = data.gradientColor;
  const slopeLabel = data.gradientLabel;

  return (
    <div
      id="elevation-chart-tooltip"
      className="rounded-2xl bg-[#1E1B18]/95 dark:bg-[#151210]/95 text-[#FDFBF7] p-3.5 shadow-2xl border border-[#38322C] backdrop-blur-md min-w-[200px] text-xs pointer-events-none transition-all"
    >
      {/* Distance & Altitude Main Header */}
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-[#38322C]">
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#A89C8F]">
          <span>📍</span>
          <span className="font-bold text-[#FDFBF7]">{data.distance.toFixed(2)} km</span>
        </div>
        <div className="flex items-center gap-1 font-mono text-[12px] font-bold text-[#E2725B]">
          <Mountain className="w-3.5 h-3.5 text-[#E2725B]" />
          <span>{Math.round(data.altitude)} m</span>
        </div>
      </div>

      {/* Slope / Gradient Highlight Badge (Primary Feature) */}
      <div className="mt-2.5 p-2 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center text-white shadow-xs font-bold shrink-0"
            style={{ backgroundColor: slopeColor }}
          >
            {slope > 3 ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : slope < -3 ? (
              <TrendingDown className="w-3.5 h-3.5" />
            ) : (
              <Minus className="w-3.5 h-3.5" />
            )}
          </div>
          <div>
            <div className="text-[10px] text-[#A89C8F] uppercase font-bold tracking-wider">
              Steigung / Neigung
            </div>
            <div className="text-xs font-bold text-white leading-tight">
              {slopeLabel}
            </div>
          </div>
        </div>

        <div
          className="px-2 py-0.5 rounded-md font-mono text-[11px] font-extrabold text-white shadow-xs"
          style={{ backgroundColor: slopeColor }}
        >
          {slope >= 0 ? `+${slope.toFixed(1)}%` : `${slope.toFixed(1)}%`}
        </div>
      </div>

      {/* Additional Sensor / Telemetry Metrics if available */}
      {(data.speed !== undefined || data.heartRate !== undefined || data.power !== undefined) && (
        <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2 border-t border-[#38322C] text-[11px] font-mono">
          {data.speed !== undefined && (
            <div className="flex items-center gap-1.5 text-[#A89C8F]">
              <Gauge className="w-3 h-3 text-[#8A9A5B]" />
              <span className="text-[#FDFBF7] font-bold">{data.speed.toFixed(1)} km/h</span>
            </div>
          )}
          {data.heartRate !== undefined && (
            <div className="flex items-center gap-1.5 text-[#A89C8F]">
              <Heart className="w-3 h-3 text-red-500 fill-red-500/80" />
              <span className="text-red-400 font-bold">{data.heartRate} bpm</span>
            </div>
          )}
          {data.power !== undefined && (
            <div className="flex items-center gap-1.5 text-[#A89C8F]">
              <Zap className="w-3 h-3 text-amber-400" />
              <span className="text-amber-300 font-bold">{data.power} W</span>
            </div>
          )}
          {data.cadence !== undefined && (
            <div className="flex items-center gap-1.5 text-[#A89C8F]">
              <Activity className="w-3 h-3 text-blue-400" />
              <span className="text-blue-300 font-bold">{data.cadence} rpm</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const ElevationChart: React.FC<ElevationChartProps> = ({
  track,
  points: rawPointsProp,
  highlights: highlightsProp,
  height = 200,
  className = '',
  onPointHover,
  onPointClick,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<ChartDataPoint | null>(null);

  const points = useMemo(() => {
    return rawPointsProp || track?.points || [];
  }, [rawPointsProp, track]);

  const highlights = useMemo(() => {
    return highlightsProp || track?.highlights || [];
  }, [highlightsProp, track]);

  // Compute processed chart data and stats
  const { chartData, minAltitude, maxAltitude, maxSlope, minSlope, totalDistance, peakPoint } =
    useMemo(() => {
      if (!points || points.length < 2) {
        return {
          chartData: [],
          minAltitude: 0,
          maxAltitude: 100,
          maxSlope: 0,
          minSlope: 0,
          totalDistance: 0,
          peakPoint: null,
        };
      }

      let minAlt = 99999;
      let maxAlt = -99999;
      let topSlope = -999;
      let lowestSlope = 999;
      let peakIdx = 0;

      // Downsample if dataset is excessively large (> 1200 points) to keep 60fps recharts interaction silky smooth
      const maxDataPoints = 1000;
      const step = Math.max(1, Math.floor(points.length / maxDataPoints));

      const sampled: ChartDataPoint[] = [];

      for (let i = 0; i < points.length; i += step) {
        const pt = points[i];
        const alt = pt.altitude !== undefined ? pt.altitude : 0;
        const dist = pt.distance !== undefined ? pt.distance : (i / points.length) * (track?.summary.totalDistanceKm || 1);
        const slope = pt.slope !== undefined ? pt.slope : 0;

        if (alt < minAlt) minAlt = alt;
        if (alt > maxAlt) {
          maxAlt = alt;
          peakIdx = sampled.length;
        }
        if (slope > topSlope) topSlope = slope;
        if (slope < lowestSlope) lowestSlope = slope;

        sampled.push({
          index: i,
          distance: Number(dist.toFixed(2)),
          formattedDistance: `${dist.toFixed(1)} km`,
          altitude: Math.round(alt),
          slope: Number(slope.toFixed(1)),
          gradientColor: getGradientColor(slope),
          gradientLabel: getGradientLabel(slope),
          speed: pt.speed,
          heartRate: pt.heartRate,
          cadence: pt.cadence,
          power: pt.power,
          rawPoint: pt,
        });
      }

      // Always ensure the very last point is included
      if (points.length > 1 && (points.length - 1) % step !== 0) {
        const lastPt = points[points.length - 1];
        const alt = lastPt.altitude !== undefined ? lastPt.altitude : 0;
        const dist = lastPt.distance !== undefined ? lastPt.distance : track?.summary.totalDistanceKm || 0;
        const slope = lastPt.slope !== undefined ? lastPt.slope : 0;

        sampled.push({
          index: points.length - 1,
          distance: Number(dist.toFixed(2)),
          formattedDistance: `${dist.toFixed(1)} km`,
          altitude: Math.round(alt),
          slope: Number(slope.toFixed(1)),
          gradientColor: getGradientColor(slope),
          gradientLabel: getGradientLabel(slope),
          speed: lastPt.speed,
          heartRate: lastPt.heartRate,
          cadence: lastPt.cadence,
          power: lastPt.power,
          rawPoint: lastPt,
        });
      }

      const altSpan = Math.max(20, maxAlt - minAlt);
      const paddedMin = Math.max(0, Math.floor(minAlt - altSpan * 0.08));
      const paddedMax = Math.ceil(maxAlt + altSpan * 0.12);
      const totalDist = sampled[sampled.length - 1]?.distance || 0;

      return {
        chartData: sampled,
        minAltitude: paddedMin,
        maxAltitude: paddedMax,
        maxSlope: topSlope > -900 ? topSlope : 0,
        minSlope: lowestSlope < 900 ? lowestSlope : 0,
        totalDistance: totalDist,
        peakPoint: sampled[peakIdx] || null,
      };
    }, [points, track]);

  if (chartData.length < 2) {
    return (
      <div
        id="elevation-chart-empty"
        className="p-6 rounded-2xl bg-[#F8F5EE] dark:bg-[#1E1B18] border border-[#E5E1D8] dark:border-[#38322C] text-center text-xs text-[#8C8273]"
      >
        Keine Höhenprofil-Daten verfügbar.
      </div>
    );
  }

  const activePoint = hoveredPoint || peakPoint;

  return (
    <div
      id="elevation-chart-container"
      className={`relative w-full rounded-2xl bg-[#FDFBF7] dark:bg-[#1E1B18] border border-[#E5E1D8] dark:border-[#38322C] p-4 shadow-xs transition-colors duration-200 ${className}`}
    >
      {/* Header with Title and Key Summary Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-[#E5E1D8] dark:border-[#38322C]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#E2725B]/15 text-[#E2725B] flex items-center justify-center">
            <Mountain className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-[#4E3B31] dark:text-[#EDE8DF] font-serif">
              Interaktives Höhenprofil & Steigung
            </h4>
            <p className="text-[10px] text-[#8C8273] dark:text-[#9C9182]">
              Bewege die Maus über das Profil, um Steigungsprozente & Telemetrie zu analysieren
            </p>
          </div>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-2 text-[11px] font-mono">
          <div className="px-2.5 py-1 rounded-lg bg-[#F8F5EE] dark:bg-[#2A2622] border border-[#E5E1D8] dark:border-[#38322C] text-[#6B5E55] dark:text-[#C4B9AA] flex items-center gap-1.5">
            <span>Passhöhe:</span>
            <b className="text-[#E2725B]">
              {track?.summary.maxAltitudeM || (peakPoint ? Math.round(peakPoint.altitude) : maxAltitude)} m
            </b>
          </div>

          <div className="px-2.5 py-1 rounded-lg bg-[#F8F5EE] dark:bg-[#2A2622] border border-[#E5E1D8] dark:border-[#38322C] text-[#6B5E55] dark:text-[#C4B9AA] flex items-center gap-1.5">
            <span>Max. Steigung:</span>
            <b
              className="px-1.5 py-0.2 rounded-md text-white font-bold"
              style={{ backgroundColor: getGradientColor(maxSlope) }}
            >
              +{maxSlope.toFixed(1)}%
            </b>
          </div>
        </div>
      </div>

      {/* Dynamic Hover Highlight Bar (Provides immediate visual feedback when hovering) */}
      {activePoint && (
        <div
          id="elevation-chart-live-bar"
          className="mb-3 px-3.5 py-2 rounded-xl bg-[#F8F5EE]/90 dark:bg-[#26221E]/90 border border-[#E5E1D8] dark:border-[#38322C] flex flex-wrap items-center justify-between gap-3 text-xs transition-all animate-fadeIn"
        >
          {/* Active location & altitude */}
          <div className="flex items-center gap-3 font-mono">
            <span className="text-[#6B5E55] dark:text-[#A89C8F]">
              Distanz: <b className="text-[#4E3B31] dark:text-[#EDE8DF]">{activePoint.distance.toFixed(2)} km</b>
            </span>
            <span className="text-[#E5E1D8] dark:text-[#38322C]">•</span>
            <span className="text-[#6B5E55] dark:text-[#A89C8F]">
              Höhe: <b className="text-[#E2725B] font-bold">{Math.round(activePoint.altitude)} m</b>
            </span>
          </div>

          {/* Steigung / Gradient Highlight Badge with dynamic color */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#8C8273] dark:text-[#9C9182] font-medium hidden sm:inline">
              Aktuelle Steigung:
            </span>
            <div
              className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-white font-bold text-xs shadow-xs font-mono transition-colors"
              style={{ backgroundColor: activePoint.gradientColor }}
            >
              {activePoint.slope > 3 ? (
                <TrendingUp className="w-3 h-3" />
              ) : activePoint.slope < -3 ? (
                <TrendingDown className="w-3 h-3" />
              ) : (
                <Minus className="w-3 h-3" />
              )}
              <span>{activePoint.slope >= 0 ? `+${activePoint.slope}%` : `${activePoint.slope}%`}</span>
              <span className="text-[10px] font-sans font-normal opacity-90 hidden md:inline">
                ({activePoint.gradientLabel})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Recharts Area Chart */}
      <div style={{ width: '100%', height: `${height}px` }} className="relative select-none">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 12, right: 12, left: -20, bottom: 0 }}
            onMouseMove={(state: any) => {
              if (state && state.activePayload && state.activePayload.length > 0) {
                const pt = state.activePayload[0].payload as ChartDataPoint;
                setHoveredPoint(pt);
                if (onPointHover) onPointHover(pt.rawPoint, pt.index);
              }
            }}
            onMouseLeave={() => {
              setHoveredPoint(null);
              if (onPointHover) onPointHover(null, null);
            }}
            onClick={(state: any) => {
              if (state && state.activePayload && state.activePayload.length > 0 && onPointClick) {
                const pt = state.activePayload[0].payload as ChartDataPoint;
                onPointClick(pt.rawPoint, pt.index);
              }
            }}
          >
            <defs>
              <linearGradient id="elevationGradFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E2725B" stopOpacity={0.45} />
                <stop offset="50%" stopColor="#D4A373" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#8A9A5B" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="elevationGradStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#8A9A5B" />
                <stop offset="40%" stopColor="#E2725B" />
                <stop offset="80%" stopColor="#D4A373" />
                <stop offset="100%" stopColor="#8A9A5B" />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#E5E1D8"
              strokeOpacity={0.6}
              vertical={false}
            />

            <XAxis
              dataKey="distance"
              tickLine={false}
              axisLine={{ stroke: '#E5E1D8', strokeWidth: 1 }}
              tickFormatter={(val) => `${val} km`}
              tick={{ fontSize: 10, fill: '#8C8273', fontFamily: 'monospace' }}
              minTickGap={35}
            />

            <YAxis
              domain={[minAltitude, maxAltitude]}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => `${val}m`}
              tick={{ fontSize: 10, fill: '#8C8273', fontFamily: 'monospace' }}
              width={45}
            />

            <Tooltip
              content={<CustomElevationTooltip />}
              cursor={{
                stroke: '#E2725B',
                strokeWidth: 1.5,
                strokeDasharray: '3 3',
              }}
            />

            {/* Peak / Highest Summit Reference Marker */}
            {peakPoint && (
              <ReferenceDot
                x={peakPoint.distance}
                y={peakPoint.altitude}
                r={4.5}
                fill="#E2725B"
                stroke="#FFFFFF"
                strokeWidth={2}
              />
            )}

            <Area
              type="monotone"
              dataKey="altitude"
              name="Höhe"
              stroke="url(#elevationGradStroke)"
              strokeWidth={2.5}
              fill="url(#elevationGradFill)"
              isAnimationActive={true}
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Legend for Slope Scale */}
      <div className="mt-3 pt-2.5 border-t border-[#E5E1D8] dark:border-[#38322C] flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#8C8273] dark:text-[#9C9182]">
        <span className="font-semibold text-[#6B5E55] dark:text-[#C4B9AA]">
          Steigungs-Kategorien:
        </span>
        <div className="flex flex-wrap items-center gap-1.5 font-mono">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#06B6D4]" />
            <span>Abfahrt (&lt;-5%)</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
            <span>Flach (0-2%)</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
            <span>Moderat (2-6%)</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E2725B]" />
            <span>Steil (6-10%)</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" />
            <span>Sehr steil (&gt;10%)</span>
          </span>
        </div>
      </div>
    </div>
  );
};
