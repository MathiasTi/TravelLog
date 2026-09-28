import React, { useMemo, useRef } from 'react';
import { GpsTrackPoint, GpsHighlight } from '../../types';
import { Mountain, Zap, Flag, Heart, Gauge, Plus } from 'lucide-react';

interface TrackElevationProfileProps {
  points: GpsTrackPoint[];
  highlights?: GpsHighlight[];
  currentPointIndex?: number;
  onSeekToIndex?: (index: number) => void;
  onAddEntryAtPoint?: (point: GpsTrackPoint, index: number) => void;
  height?: number;
}

export const TrackElevationProfile: React.FC<TrackElevationProfileProps> = ({
  points = [],
  highlights = [],
  currentPointIndex = 0,
  onSeekToIndex,
  onAddEntryAtPoint,
  height = 130,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute elevation min/max and distance
  const { minAlt, maxAlt, totalDist, chartData } = useMemo(() => {
    const safePoints = points || [];
    if (safePoints.length === 0) {
      return { minAlt: 0, maxAlt: 100, totalDist: 0, chartData: [] };
    }

    let min = 99999;
    let max = -99999;

    safePoints.forEach((p) => {
      const a = p.altitude || 0;
      if (a < min) min = a;
      if (a > max) max = a;
    });

    const span = Math.max(20, max - min);
    const paddedMin = Math.max(0, Math.floor(min - span * 0.05));
    const paddedMax = Math.ceil(max + span * 0.1);
    const lastDist = safePoints[safePoints.length - 1]?.distance || 1;

    const data = safePoints.map((p, idx) => {
      const d = p.distance || 0;
      const xPercent = (d / lastDist) * 100;
      const alt = p.altitude || min;
      const yPercent = 100 - ((alt - paddedMin) / (paddedMax - paddedMin)) * 100;
      return {
        idx,
        x: xPercent,
        y: yPercent,
        alt,
        dist: d,
        speed: p.speed,
        hr: p.heartRate,
        slope: p.slope,
      };
    });

    return {
      minAlt: paddedMin,
      maxAlt: paddedMax,
      totalDist: lastDist,
      chartData: data,
    };
  }, [points]);

  // Generate SVG path strings
  const { pathD, areaD } = useMemo(() => {
    if (chartData.length < 2) return { pathD: '', areaD: '' };

    let p = `M ${chartData[0].x},${chartData[0].y}`;
    for (let i = 1; i < chartData.length; i++) {
      p += ` L ${chartData[i].x},${chartData[i].y}`;
    }

    const a = `${p} L ${chartData[chartData.length - 1].x},100 L ${chartData[0].x},100 Z`;
    return { pathD: p, areaD: a };
  }, [chartData]);

  const currentPos = chartData[Math.min(currentPointIndex, chartData.length - 1)] || chartData[0];

  const handlePointerAction = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current || chartData.length === 0 || !onSeekToIndex) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = Math.max(rect.left, Math.min(rect.right, e.clientX));
    const ratio = (clientX - rect.left) / rect.width;
    const targetDist = ratio * totalDist;

    let bestIdx = 0;
    let bestDiff = 999999;
    points.forEach((p, idx) => {
      const diff = Math.abs((p.distance || 0) - targetDist);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = idx;
      }
    });

    onSeekToIndex(bestIdx);
  };

  if (points.length < 2) return null;

  return (
    <div
      id="track-elevation-profile"
      ref={containerRef}
      onPointerDown={(e) => {
        if (onSeekToIndex) {
          e.currentTarget.setPointerCapture(e.pointerId);
          handlePointerAction(e);
        }
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1 && onSeekToIndex) handlePointerAction(e);
      }}
      className={`relative w-full select-none bg-[#F8F5EE]/80 dark:bg-[#1C1815]/90 rounded-2xl border border-[#E5E1D8] dark:border-[#38322C] p-3 backdrop-blur-md overflow-hidden transition ${
        onSeekToIndex ? 'cursor-ew-resize group' : ''
      }`}
      style={{ minHeight: `${height}px` }}
    >
      {/* Top Header info */}
      <div className="flex items-center justify-between text-[11px] text-[#6B5E55] dark:text-[#A89C8F] font-semibold mb-1">
        <span className="flex items-center gap-1.5 font-bold text-[#4E3B31] dark:text-[#EDE8DF]">
          <Mountain className="w-3.5 h-3.5 text-[#E2725B]" />
          <span>Höhenprofil & Streckenverlauf</span>
        </span>
        <div className="flex items-center gap-3 font-mono">
          <span>Min: <b className="text-[#4E3B31] dark:text-[#EDE8DF]">{minAlt} m</b></span>
          <span>Max: <b className="text-[#E2725B] font-bold">{maxAlt} m</b></span>
          <span>Distanz: <b className="text-[#8A9A5B] font-bold">{totalDist.toFixed(1)} km</b></span>
        </div>
      </div>

      {/* SVG Elevation Chart Area */}
      <div className="relative w-full h-20 my-1">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full h-full overflow-visible"
        >
          <defs>
            <linearGradient id="trackElevationAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E2725B" stopOpacity="0.45" />
              <stop offset="60%" stopColor="#D4A373" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#8A9A5B" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="trackElevationLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#8A9A5B" />
              <stop offset="50%" stopColor="#E2725B" />
              <stop offset="100%" stopColor="#D4A373" />
            </linearGradient>
          </defs>

          {/* Area Fill */}
          <path d={areaD} fill="url(#trackElevationAreaGrad)" />

          {/* Line Stroke */}
          <path
            d={pathD}
            fill="none"
            stroke="url(#trackElevationLineGrad)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Highlight markers on SVG */}
          {highlights.map((h, i) => {
            const hData = chartData[Math.min(h.pointIndex, chartData.length - 1)];
            if (!hData) return null;
            return (
              <g key={i} transform={`translate(${hData.x}, ${hData.y})`}>
                <circle r="3.5" fill="#E2725B" stroke="#ffffff" strokeWidth="1.5" />
              </g>
            );
          })}

          {/* Active Cursor Line */}
          {currentPos && onSeekToIndex && (
            <g>
              <line
                x1={currentPos.x}
                y1="0"
                x2={currentPos.x}
                y2="100"
                stroke="#E2725B"
                strokeWidth="1.8"
                strokeDasharray="2 2"
              />
              <circle
                cx={currentPos.x}
                cy={currentPos.y}
                r="4.5"
                fill="#E2725B"
                stroke="#FFFFFF"
                strokeWidth="2"
                className="animate-pulse shadow-md"
              />
            </g>
          )}
        </svg>

        {/* Highlight Badges */}
        {highlights.map((h, i) => {
          const hData = chartData[Math.min(h.pointIndex, chartData.length - 1)];
          if (!hData) return null;
          return (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onSeekToIndex) onSeekToIndex(h.pointIndex);
              }}
              style={{ left: `${Math.min(92, Math.max(8, hData.x))}%` }}
              className="absolute -top-1 -translate-x-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/90 dark:bg-[#2A2622]/90 border border-[#E5E1D8] dark:border-[#38322C] text-[9px] font-bold text-[#4E3B31] dark:text-[#EDE8DF] shadow-xs hover:scale-110 transition z-10"
              title={`${h.title}: ${h.description}`}
            >
              {h.type === 'summit' && <Flag className="w-2.5 h-2.5 text-amber-500" />}
              {h.type === 'max_speed' && <Zap className="w-2.5 h-2.5 text-red-500" />}
              {h.type === 'halfway' && <span className="text-[9px]">🏁</span>}
              <span>{h.metricValue || h.title}</span>
            </button>
          );
        })}
      </div>

      {/* Telemetry Footer */}
      {currentPos && (
        <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-[#E5E1D8]/60 dark:border-[#38322C]/60 text-[10px] text-[#6B5E55] dark:text-[#A89C8F]">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-[#4E3B31] dark:text-[#EDE8DF]">
              📍 {currentPos.dist.toFixed(1)} km
            </span>
            <span>•</span>
            <span className="font-bold text-[#E2725B] font-mono">
              ⛰️ {Math.round(currentPos.alt)} m
            </span>
            {currentPos.slope !== undefined && (
              <>
                <span>•</span>
                <span
                  className={`font-bold font-mono px-1.5 py-0.2 rounded-md ${
                    currentPos.slope > 8
                      ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                      : currentPos.slope > 3
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : currentPos.slope < -4
                      ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {currentPos.slope > 0 ? `+${currentPos.slope}%` : `${currentPos.slope}%`}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 font-mono">
            {currentPos.speed !== undefined && (
              <span className="flex items-center gap-0.5 text-[#4E3B31] dark:text-[#EDE8DF]">
                <Gauge className="w-3 h-3 text-[#8A9A5B]" />
                <b>{currentPos.speed.toFixed(1)} km/h</b>
              </span>
            )}
            {currentPos.hr !== undefined && (
              <span className="flex items-center gap-0.5 text-red-500 font-bold">
                <Heart className="w-3 h-3 fill-red-500 animate-pulse" />
                <span>{currentPos.hr} bpm</span>
              </span>
            )}
            {onAddEntryAtPoint && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddEntryAtPoint(points[currentPos.idx] || points[0], currentPos.idx);
                }}
                className="ml-1 px-2 py-0.5 rounded-lg bg-[#E2725B] hover:bg-[#D0624C] text-white text-[9px] font-bold flex items-center gap-1 shadow-2xs transition active:scale-95 cursor-pointer"
                title="Reiseeintrag an diesem Punkt anlegen"
              >
                <Plus className="w-2.5 h-2.5 stroke-[3]" />
                <span>Stopp</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
