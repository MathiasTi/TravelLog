import FitParser from 'fit-file-parser';
import { GpsTrackData, GpsTrackPoint, GpsActivitySummary, GpsHighlight } from '../types';

// Haversine distance in kilometers between two lat/lon points
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate bearing between two coordinates in degrees (0 = North, 90 = East, etc.)
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/**
 * Format duration in seconds to "1h 24m" or "45m 12s"
 */
export function formatTourDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

/**
 * Visual gradient hex color based on slope percentage.
 */
export function getGradientColor(slope?: number): string {
  if (slope === undefined || isNaN(slope)) return '#8A9A5B'; // sage green neutral
  if (slope < -5) return '#06B6D4'; // downhill cyan
  if (slope < 2) return '#10B981'; // flat emerald
  if (slope < 6) return '#F59E0B'; // moderate climb amber
  if (slope < 10) return '#E2725B'; // solid climb terracotta
  if (slope < 15) return '#DC2626'; // steep red
  return '#7C3AED'; // extreme wall purple (>15%)
}

/**
 * Human-readable label for slope percentage.
 */
export function getGradientLabel(slope?: number): string {
  if (slope === undefined || isNaN(slope)) return 'Ebene (0%)';
  if (slope < -5) return `Abfahrt (${slope.toFixed(1)}%)`;
  if (slope < 2) return `Flach (${slope >= 0 ? '+' : ''}${slope.toFixed(1)}%)`;
  if (slope < 6) return `Leichter Anstieg (+${slope.toFixed(1)}%)`;
  if (slope < 10) return `Mittlerer Anstieg (+${slope.toFixed(1)}%)`;
  if (slope < 15) return `Steile Rampe (+${slope.toFixed(1)}%)`;
  return `Extremer Steilhang (+${slope.toFixed(1)}%)`;
}

/**
 * Helper to compute highlights and stats from normalized raw points
 */
function buildTrackHighlightsAndSummary(
  points: GpsTrackPoint[],
  filename: string,
  format: 'gpx' | 'fit',
  detectedTitle?: string,
  extraMetadata?: Partial<GpsActivitySummary>
): GpsTrackData {
  if (points.length < 2) {
    throw new Error('Die Datei enthält zu wenige GPS-Messpunkte für eine Tour.');
  }

  let totalDistanceKm = 0;
  let totalEleGain = 0;
  let totalEleLoss = 0;
  let maxAlt = -9999;
  let minAlt = 9999;
  let maxSpd = 0;
  let sumSpeed = 0;
  let speedCount = 0;
  let sumHr = 0;
  let hrCount = 0;
  let maxHr = 0;
  let sumCad = 0;
  let cadCount = 0;
  let maxCad = 0;
  let sumPwr = 0;
  let pwrCount = 0;
  let maxPwr = 0;

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (pt.distance !== undefined) {
      totalDistanceKm = pt.distance;
    }
    if (pt.altitude !== undefined) {
      if (pt.altitude > maxAlt) maxAlt = pt.altitude;
      if (pt.altitude < minAlt) minAlt = pt.altitude;
    }
    if (pt.speed !== undefined && pt.speed > 0) {
      if (pt.speed > maxSpd) maxSpd = pt.speed;
      sumSpeed += pt.speed;
      speedCount++;
    }
    if (pt.heartRate !== undefined && pt.heartRate > 30) {
      if (pt.heartRate > maxHr) maxHr = pt.heartRate;
      sumHr += pt.heartRate;
      hrCount++;
    }
    if (pt.cadence !== undefined && pt.cadence > 0) {
      if (pt.cadence > maxCad) maxCad = pt.cadence;
      sumCad += pt.cadence;
      cadCount++;
    }
    if (pt.power !== undefined && pt.power > 0) {
      if (pt.power > maxPwr) maxPwr = pt.power;
      sumPwr += pt.power;
      pwrCount++;
    }
    if (i > 0 && pt.altitude !== undefined && points[i - 1].altitude !== undefined) {
      const diff = pt.altitude - points[i - 1].altitude!;
      if (diff > 0.5) totalEleGain += diff;
      else if (diff < -0.5) totalEleLoss += Math.abs(diff);
    }
  }

  const startTime = points[0].timestamp || new Date().toISOString();
  const endTime = points[points.length - 1].timestamp || startTime;
  let totalDurationSec = Math.max(
    1,
    Math.floor((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000)
  );

  if (isNaN(totalDurationSec) || totalDurationSec <= 0) {
    // If no timestamps or invalid timestamp difference, estimate duration based on distance and average speed of 20km/h
    totalDurationSec = Math.round((totalDistanceKm / 20) * 3600);
  }

  const avgSpeedKmh = speedCount > 0 
    ? Number((sumSpeed / speedCount).toFixed(1))
    : Number((totalDurationSec > 0 ? (totalDistanceKm / (totalDurationSec / 3600)) : 0).toFixed(1));

  const summary: GpsActivitySummary = {
    sport: extraMetadata?.sport || 'cycling',
    subSport: extraMetadata?.subSport || 'outdoor',
    totalDistanceKm: Number((extraMetadata?.totalDistanceKm !== undefined ? extraMetadata.totalDistanceKm : totalDistanceKm).toFixed(2)),
    totalDurationSec: extraMetadata?.totalDurationSec || totalDurationSec,
    movingDurationSec: extraMetadata?.movingDurationSec || totalDurationSec,
    elevationGainM: Math.round(extraMetadata?.elevationGainM !== undefined ? extraMetadata.elevationGainM : totalEleGain),
    elevationLossM: Math.round(extraMetadata?.elevationLossM !== undefined ? extraMetadata.elevationLossM : totalEleLoss),
    maxAltitudeM: Math.round(maxAlt > -9000 ? maxAlt : 0),
    minAltitudeM: Math.round(minAlt < 9000 ? minAlt : 0),
    avgSpeedKmh: extraMetadata?.avgSpeedKmh || avgSpeedKmh,
    maxSpeedKmh: Number((extraMetadata?.maxSpeedKmh || maxSpd).toFixed(1)),
    avgHeartRate: extraMetadata?.avgHeartRate || (hrCount > 0 ? Math.round(sumHr / hrCount) : undefined),
    maxHeartRate: extraMetadata?.maxHeartRate || (maxHr > 0 ? maxHr : undefined),
    avgCadence: extraMetadata?.avgCadence || (cadCount > 0 ? Math.round(sumCad / cadCount) : undefined),
    maxCadence: extraMetadata?.maxCadence || (maxCad > 0 ? maxCad : undefined),
    avgPower: extraMetadata?.avgPower || (pwrCount > 0 ? Math.round(sumPwr / pwrCount) : undefined),
    maxPower: extraMetadata?.maxPower || (maxPwr > 0 ? maxPwr : undefined),
    totalCalories: extraMetadata?.totalCalories,
    startTime,
    endTime,
  };

  // Highlights
  const highlights: GpsHighlight[] = [];

  // Summit
  if (summary.maxAltitudeM > 0) {
    let peakIdx = 0;
    let highest = -9999;
    points.forEach((p, idx) => {
      if ((p.altitude || 0) > highest) {
        highest = p.altitude || 0;
        peakIdx = idx;
      }
    });
    highlights.push({
      type: 'summit',
      title: 'Höchster Punkt / Gipfel',
      description: `Gipfel / Passhöhe auf ${Math.round(highest)} m ü. M.`,
      pointIndex: peakIdx,
      point: points[peakIdx],
      metricValue: `${Math.round(highest)} m`,
    });
  }

  // Max Speed Point
  if (summary.maxSpeedKmh > 15) {
    let maxSpdIdx = 0;
    let topSpd = 0;
    points.forEach((p, idx) => {
      if ((p.speed || 0) > topSpd) {
        topSpd = p.speed || 0;
        maxSpdIdx = idx;
      }
    });
    highlights.push({
      type: 'max_speed',
      title: 'Maximales Tempo',
      description: `Top-Speed von ${topSpd.toFixed(1)} km/h erreicht`,
      pointIndex: maxSpdIdx,
      point: points[maxSpdIdx],
      metricValue: `${topSpd.toFixed(1)} km/h`,
    });
  }

  // Halfway point
  const halfwayIdx = Math.floor(points.length / 2);
  highlights.push({
    type: 'halfway',
    title: 'Halbzeit (50%)',
    description: `${points[halfwayIdx].distance?.toFixed(1) || (summary.totalDistanceKm / 2).toFixed(1)} km absolviert`,
    pointIndex: halfwayIdx,
    point: points[halfwayIdx],
    metricValue: `${points[halfwayIdx].distance?.toFixed(1) || (summary.totalDistanceKm / 2).toFixed(1)} km`,
  });

  const cleanName = filename
    .replace(/\.(gpx|fit)$/i, '')
    .replace(/[_-]/g, ' ')
    .trim();
  const tourTitle = detectedTitle || (cleanName.charAt(0).toUpperCase() + cleanName.slice(1)) || 'GPS Track';

  return {
    id: `track-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    filename,
    format,
    title: tourTitle,
    description: `${summary.totalDistanceKm} km Strecke mit +${summary.elevationGainM} hm Höhenmetern.`,
    summary,
    points,
    highlights,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Robust GPX (GPS Exchange Format) XML string parser.
 * Supports GPX 1.0 & 1.1, tracks (<trkpt>), routes (<rtept>), waypoints (<wpt>),
 * elevation (<ele>), timestamps (<time>), speed, and Garmin/Strava extensions (hr, cad, temp).
 */
export function parseGpxString(gpxText: string, filename = 'track.gpx'): GpsTrackData {
  let detectedTitle: string | undefined;
  const rawWaypoints: Array<{ name: string; lat: number; lng: number; altitude?: number; description?: string }> = [];
  const points: GpsTrackPoint[] = [];

  // 1. Try browser DOMParser if available, otherwise fallback to robust regex XML tokenizer
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(gpxText, 'application/xml');
      const parseError = xmlDoc.getElementsByTagName('parsererror')[0];
      if (!parseError) {
        // Extract title from <metadata><name> or <trk><name>
        const nameEl = xmlDoc.querySelector('metadata > name') || xmlDoc.querySelector('trk > name') || xmlDoc.querySelector('name');
        if (nameEl && nameEl.textContent) {
          detectedTitle = nameEl.textContent.trim();
        }

        // Extract Waypoints (<wpt>)
        const wpts = xmlDoc.querySelectorAll('wpt');
        wpts.forEach((wpt) => {
          const lat = parseFloat(wpt.getAttribute('lat') || '');
          const lng = parseFloat(wpt.getAttribute('lon') || wpt.getAttribute('lng') || '');
          if (!isNaN(lat) && !isNaN(lng)) {
            const wName = wpt.querySelector('name')?.textContent?.trim() || 'Wegpunkt';
            const wDesc = wpt.querySelector('desc')?.textContent?.trim();
            const wEle = parseFloat(wpt.querySelector('ele')?.textContent || '');
            rawWaypoints.push({
              name: wName,
              lat,
              lng,
              altitude: !isNaN(wEle) ? wEle : undefined,
              description: wDesc,
            });
          }
        });

        // Extract track points (<trkpt>) or route points (<rtept>)
        let trkpts = xmlDoc.querySelectorAll('trkpt');
        if (trkpts.length === 0) {
          trkpts = xmlDoc.querySelectorAll('rtept');
        }

        let cumulativeDist = 0;
        let prevLat: number | null = null;
        let prevLng: number | null = null;
        let prevAlt: number | null = null;
        let prevTime: number | null = null;

        trkpts.forEach((pt) => {
          const lat = parseFloat(pt.getAttribute('lat') || '');
          const lng = parseFloat(pt.getAttribute('lon') || pt.getAttribute('lng') || '');
          if (isNaN(lat) || isNaN(lng)) return;

          const eleStr = pt.querySelector('ele')?.textContent;
          const timeStr = pt.querySelector('time')?.textContent;
          const speedStr = pt.querySelector('speed')?.textContent;

          const hrStr = pt.querySelector('hr')?.textContent || pt.querySelector('TrackPointExtension > hr')?.textContent || pt.querySelector('gpxtpx\\:hr')?.textContent;
          const cadStr = pt.querySelector('cad')?.textContent || pt.querySelector('TrackPointExtension > cad')?.textContent || pt.querySelector('gpxtpx\\:cad')?.textContent;
          const atempStr = pt.querySelector('atemp')?.textContent || pt.querySelector('TrackPointExtension > atemp')?.textContent || pt.querySelector('gpxtpx\\:atemp')?.textContent;
          const powerStr = pt.querySelector('power')?.textContent;

          const altitude = eleStr ? parseFloat(eleStr) : undefined;
          let speed = speedStr ? parseFloat(speedStr) * 3.6 : undefined; // m/s to km/h if from GPX
          const timestamp = timeStr ? new Date(timeStr).toISOString() : new Date().toISOString();
          const currTimeMs = timeStr ? new Date(timeStr).getTime() : null;

          if (prevLat !== null && prevLng !== null) {
            const d = calculateHaversineDistance(prevLat, prevLng, lat, lng);
            cumulativeDist += d;

            if (speed === undefined && prevTime !== null && currTimeMs !== null) {
              const timeSec = (currTimeMs - prevTime) / 1000;
              if (timeSec > 0 && timeSec < 60) {
                speed = (d / (timeSec / 3600));
              }
            }
          }

          let slope: number | undefined;
          if (altitude !== undefined && prevAlt !== null && prevLat !== null && prevLng !== null) {
            const eleDelta = altitude - prevAlt;
            const horizDistM = calculateHaversineDistance(prevLat, prevLng, lat, lng) * 1000;
            if (horizDistM > 5) {
              const s = (eleDelta / horizDistM) * 100;
              slope = Math.max(-35, Math.min(35, Number(s.toFixed(1))));
            }
          }

          points.push({
            lat: Number(lat.toFixed(6)),
            lng: Number(lng.toFixed(6)),
            altitude: altitude !== undefined && !isNaN(altitude) ? Number(altitude.toFixed(1)) : undefined,
            speed: speed !== undefined && !isNaN(speed) ? Number(speed.toFixed(1)) : undefined,
            heartRate: hrStr ? parseInt(hrStr, 10) : undefined,
            cadence: cadStr ? parseInt(cadStr, 10) : undefined,
            power: powerStr ? parseInt(powerStr, 10) : undefined,
            temperature: atempStr ? parseFloat(atempStr) : undefined,
            distance: Number(cumulativeDist.toFixed(2)),
            timestamp,
            slope,
          });

          prevLat = lat;
          prevLng = lng;
          if (altitude !== undefined && !isNaN(altitude)) prevAlt = altitude;
          if (currTimeMs !== null) prevTime = currTimeMs;
        });

        if (points.length >= 2) {
          const trackData = buildTrackHighlightsAndSummary(points, filename, 'gpx', detectedTitle);
          if (rawWaypoints.length > 0) {
            trackData.waypoints = rawWaypoints;
          }
          return trackData;
        }
      }
    } catch (e) {
      console.warn('DOMParser error, falling back to regex parser:', e);
    }
  }

  // 2. Fallback Regex XML Parser (for Node.js testing and non-DOM environments)
  const nameMatch = gpxText.match(/<name>([^<]+)<\/name>/i);
  if (nameMatch) {
    detectedTitle = nameMatch[1].trim();
  }

  const trkptRegex = /<(?:trkpt|rtept)\s+lat=["']([^"']+)["']\s+lon=["']([^"']+)["'][^>]*>([\s\S]*?)<\/(?:trkpt|rtept)>/gi;
  let match: RegExpExecArray | null;
  let cumulativeDist = 0;
  let prevLat: number | null = null;
  let prevLng: number | null = null;
  let prevAlt: number | null = null;

  while ((match = trkptRegex.exec(gpxText)) !== null) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (isNaN(lat) || isNaN(lng)) continue;

    const innerXml = match[3];
    const eleMatch = innerXml.match(/<ele>([^<]+)<\/ele>/i);
    const timeMatch = innerXml.match(/<time>([^<]+)<\/time>/i);
    const speedMatch = innerXml.match(/<speed>([^<]+)<\/speed>/i);
    const hrMatch = innerXml.match(/<(?:[a-zA-Z0-9]+:)?hr>([^<]+)<\/(?:[a-zA-Z0-9]+:)?hr>/i);
    const cadMatch = innerXml.match(/<(?:[a-zA-Z0-9]+:)?cad>([^<]+)<\/(?:[a-zA-Z0-9]+:)?cad>/i);
    const powerMatch = innerXml.match(/<power>([^<]+)<\/power>/i);

    const altitude = eleMatch ? parseFloat(eleMatch[1]) : undefined;
    const timestamp = timeMatch ? new Date(timeMatch[1]).toISOString() : new Date().toISOString();
    const speed = speedMatch ? parseFloat(speedMatch[1]) * 3.6 : undefined;

    if (prevLat !== null && prevLng !== null) {
      const d = calculateHaversineDistance(prevLat, prevLng, lat, lng);
      cumulativeDist += d;
    }

    let slope: number | undefined;
    if (altitude !== undefined && prevAlt !== null && prevLat !== null && prevLng !== null) {
      const eleDelta = altitude - prevAlt;
      const horizDistM = calculateHaversineDistance(prevLat, prevLng, lat, lng) * 1000;
      if (horizDistM > 5) {
        const s = (eleDelta / horizDistM) * 100;
        slope = Math.max(-35, Math.min(35, Number(s.toFixed(1))));
      }
    }

    points.push({
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      altitude: altitude !== undefined && !isNaN(altitude) ? Number(altitude.toFixed(1)) : undefined,
      speed: speed !== undefined && !isNaN(speed) ? Number(speed.toFixed(1)) : undefined,
      heartRate: hrMatch ? parseInt(hrMatch[1], 10) : undefined,
      cadence: cadMatch ? parseInt(cadMatch[1], 10) : undefined,
      power: powerMatch ? parseInt(powerMatch[1], 10) : undefined,
      distance: Number(cumulativeDist.toFixed(2)),
      timestamp,
      slope,
    });

    prevLat = lat;
    prevLng = lng;
    if (altitude !== undefined && !isNaN(altitude)) prevAlt = altitude;
  }

  if (points.length < 2) {
    throw new Error('Keine gültigen GPS-Streckenpunkte in der GPX-Datei gefunden.');
  }

  return buildTrackHighlightsAndSummary(points, filename, 'gpx', detectedTitle);
}

/**
 * Parses a Garmin / Wahoo / Strava .FIT file ArrayBuffer into structured GpsTrackData.
 */
export async function parseFitFile(
  arrayBuffer: ArrayBuffer,
  filename: string
): Promise<GpsTrackData> {
  return new Promise((resolve, reject) => {
    const parser = new (FitParser as any)({
      force: true,
      speedUnit: 'km/h',
      lengthUnit: 'km',
      temperatureUnit: 'celsius',
      elapsedRecordField: true,
      mode: 'cascade',
    });

    parser.parse(arrayBuffer, (error: any, data: any) => {
      if (error) {
        console.error('FIT parsing error:', error);
        reject(new Error(error.message || 'Die .fit Datei konnte nicht gelesen werden.'));
        return;
      }

      try {
        const rawRecords: any[] = [];
        
        if (data.records && Array.isArray(data.records)) {
          rawRecords.push(...data.records);
        } else if (data.record && Array.isArray(data.record)) {
          rawRecords.push(...data.record);
        }
        
        if (data.activity?.sessions) {
          for (const session of data.activity.sessions) {
            if (session.records && Array.isArray(session.records)) {
              rawRecords.push(...session.records);
            }
            if (session.laps) {
              for (const lap of session.laps) {
                if (lap.records && Array.isArray(lap.records)) {
                  rawRecords.push(...lap.records);
                }
              }
            }
          }
        } else if (data.sessions && Array.isArray(data.sessions)) {
          for (const session of data.sessions) {
            if (session.records && Array.isArray(session.records)) {
              rawRecords.push(...session.records);
            }
            if (session.laps) {
              for (const lap of session.laps) {
                if (lap.records && Array.isArray(lap.records)) {
                  rawRecords.push(...lap.records);
                }
              }
            }
          }
        }

        if (rawRecords.length === 0) {
          reject(new Error('Keine GPS-Streckenpunkte in der .fit Datei gefunden.'));
          return;
        }

        const points: GpsTrackPoint[] = [];
        let cumulativeDist = 0;
        let prevLat: number | null = null;
        let prevLng: number | null = null;
        let prevAlt: number | null = null;

        for (let i = 0; i < rawRecords.length; i++) {
          const rec = rawRecords[i];
          let lat = rec.position_lat ?? rec.positionLat ?? rec.lat ?? rec.latitude;
          let lng = rec.position_long ?? rec.positionLong ?? rec.lng ?? rec.lon ?? rec.longitude;

          if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) {
            continue;
          }

          // Convert Garmin/Wahoo semicircles to degrees if necessary
          if (Math.abs(lat) > 90) {
            lat = lat * (180 / Math.pow(2, 31));
          }
          if (Math.abs(lng) > 180) {
            lng = lng * (180 / Math.pow(2, 31));
          }

          // Validate bounds
          if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            continue;
          }

          if (prevLat !== null && prevLng !== null) {
            const d = calculateHaversineDistance(prevLat, prevLng, lat, lng);
            if (d < 5) {
              cumulativeDist += d;
            }
          }

          const altitude = rec.altitude !== undefined && !isNaN(rec.altitude) ? Number(rec.altitude) : undefined;
          let slope: number | undefined = undefined;

          if (altitude !== undefined) {
            if (prevAlt !== null && prevLat !== null && prevLng !== null) {
              const eleDelta = altitude - prevAlt;
              const horizDistM = calculateHaversineDistance(prevLat, prevLng, lat, lng) * 1000;
              if (horizDistM > 5) {
                const s = (eleDelta / horizDistM) * 100;
                slope = Math.max(-35, Math.min(35, Number(s.toFixed(1))));
              }
            }
            prevAlt = altitude;
          }

          let speed = rec.speed !== undefined && !isNaN(rec.speed) ? Number(rec.speed) : undefined;
          const hr = rec.heart_rate ?? rec.heartRate;
          const cadence = rec.cadence;
          const power = rec.power;
          const ts = rec.timestamp ? new Date(rec.timestamp).toISOString() : new Date().toISOString();

          points.push({
            lat: Number(lat.toFixed(6)),
            lng: Number(lng.toFixed(6)),
            altitude: altitude !== undefined ? Number(altitude.toFixed(1)) : undefined,
            speed: speed !== undefined ? Number(speed.toFixed(1)) : undefined,
            heartRate: hr && Number(hr) > 30 && Number(hr) < 240 ? Math.round(Number(hr)) : undefined,
            cadence: cadence && Number(cadence) > 0 && Number(cadence) < 220 ? Math.round(Number(cadence)) : undefined,
            power: power && Number(power) > 0 && Number(power) < 2500 ? Math.round(Number(power)) : undefined,
            temperature: rec.temperature !== undefined ? Number(rec.temperature) : undefined,
            distance: Number(cumulativeDist.toFixed(2)),
            timestamp: ts,
            slope,
          });

          prevLat = lat;
          prevLng = lng;
        }

        if (points.length < 2) {
          reject(new Error('Die Datei enthält zu wenige gültige GPS-Messpunkte für eine Tour.'));
          return;
        }

        const firstSession = data.activity?.sessions?.[0] || data.sessions?.[0] || {};
        const detectedName = data.course?.name || data.activity?.name || (data.file_id?.time_created ? `FIT-Tour ${new Date(data.file_id.time_created).toLocaleDateString('de-DE')}` : undefined);
        const extraMeta: Partial<GpsActivitySummary> = {
          sport: firstSession.sport || 'cycling',
          subSport: firstSession.sub_sport || 'road',
          totalDistanceKm: firstSession.total_distance !== undefined ? Number(firstSession.total_distance.toFixed(2)) : undefined,
          totalDurationSec: firstSession.total_elapsed_time ? Math.round(firstSession.total_elapsed_time) : undefined,
          movingDurationSec: firstSession.total_timer_time ? Math.round(firstSession.total_timer_time) : undefined,
          elevationGainM: firstSession.total_ascent !== undefined ? Math.round(firstSession.total_ascent) : undefined,
          elevationLossM: firstSession.total_descent !== undefined ? Math.round(firstSession.total_descent) : undefined,
          avgSpeedKmh: firstSession.avg_speed !== undefined ? Number(firstSession.avg_speed.toFixed(1)) : undefined,
          maxSpeedKmh: firstSession.max_speed !== undefined ? Number(firstSession.max_speed.toFixed(1)) : undefined,
          avgHeartRate: firstSession.avg_heart_rate,
          maxHeartRate: firstSession.max_heart_rate,
          avgCadence: firstSession.avg_cadence,
          maxCadence: firstSession.max_cadence,
          avgPower: firstSession.avg_power,
          maxPower: firstSession.max_power,
          totalCalories: firstSession.total_calories,
        };

        const result = buildTrackHighlightsAndSummary(points, filename, 'fit', detectedName, extraMeta);
        resolve(result);
      } catch (err: any) {
        console.error('Error post-processing FIT records:', err);
        reject(new Error(err.message || 'Fehler beim Verarbeiten der Streckendaten.'));
      }
    });
  });
}

/**
 * Nearest Track Point Result interface and Finder Function
 */
export interface NearestTrackPointResult {
  track: GpsTrackData;
  pointIndex: number;
  point: GpsTrackPoint;
  distanceFromClickM: number;
  cumulativeDistanceKm: number;
  altitudeM?: number;
  slope?: number;
  speedKmh?: number;
  timestamp?: string;
}

export function findNearestTrackPoint(
  lat: number,
  lng: number,
  track: GpsTrackData,
  maxDistanceThresholdM = 5000
): NearestTrackPointResult | null {
  if (!track.points || track.points.length === 0) return null;

  let bestIdx = 0;
  let minDistanceM = Infinity;

  for (let i = 0; i < track.points.length; i++) {
    const pt = track.points[i];
    const distM = calculateHaversineDistance(lat, lng, pt.lat, pt.lng) * 1000;
    if (distM < minDistanceM) {
      minDistanceM = distM;
      bestIdx = i;
    }
  }

  if (minDistanceM > maxDistanceThresholdM) {
    return null;
  }

  const bestPt = track.points[bestIdx];
  return {
    track,
    pointIndex: bestIdx,
    point: bestPt,
    distanceFromClickM: Math.round(minDistanceM),
    cumulativeDistanceKm: bestPt.distance !== undefined ? bestPt.distance : Number(((bestIdx / Math.max(1, track.points.length - 1)) * track.summary.totalDistanceKm).toFixed(2)),
    altitudeM: bestPt.altitude,
    slope: bestPt.slope,
    speedKmh: bestPt.speed,
    timestamp: bestPt.timestamp,
  };
}

/**
 * Universal Track File Parser supporting both GPX (.gpx) and FIT (.fit)
 */
export async function parseTrackFile(file: File): Promise<GpsTrackData> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.gpx')) {
    const text = await file.text();
    return parseGpxString(text, file.name);
  } else if (name.endsWith('.fit')) {
    const buffer = await file.arrayBuffer();
    return parseFitFile(buffer, file.name);
  }
  throw new Error('Nicht unterstütztes Format. Bitte lade eine .gpx oder .fit Datei hoch.');
}
