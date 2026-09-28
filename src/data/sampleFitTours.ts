import { FitTrackData, FitTrackPoint, FitHighlight } from '../types';

// Helper to generate smooth GPS waypoints along a curve/switchbacks with altitude & metrics
function generateTrack(
  startLat: number,
  startLng: number,
  pointsCount: number,
  baseAlt: number,
  peakAlt: number,
  endAlt: number,
  totalDistanceKm: number,
  avgSpeed: number,
  avgHr: number,
  avgPower: number
): { points: FitTrackPoint[]; highlights: FitHighlight[] } {
  const points: FitTrackPoint[] = [];
  const baseTime = new Date('2026-08-15T09:00:00Z').getTime();
  let maxAlt = -9999;
  let maxAltIdx = 0;
  let maxSpd = 0;
  let maxSpdIdx = 0;

  for (let i = 0; i < pointsCount; i++) {
    const progress = i / (pointsCount - 1);
    
    // Simulate winding mountain road / switchbacks (sin/cos serpentines)
    const latWobble = Math.sin(progress * Math.PI * 14) * 0.008;
    const lngWobble = Math.cos(progress * Math.PI * 18) * 0.009;

    const lat = startLat + progress * 0.18 + latWobble;
    const lng = startLng + progress * 0.22 + lngWobble;

    // Altitude profile: climb up to peak (progress ~ 0.65), then descend
    let alt = baseAlt;
    if (progress <= 0.65) {
      const climbProgress = progress / 0.65;
      alt = baseAlt + (peakAlt - baseAlt) * Math.sin(climbProgress * (Math.PI / 2));
    } else {
      const descProgress = (progress - 0.65) / 0.35;
      alt = peakAlt - (peakAlt - endAlt) * Math.sin(descProgress * (Math.PI / 2));
    }

    if (alt > maxAlt) {
      maxAlt = alt;
      maxAltIdx = i;
    }

    // Speed: slower uphill (11-18 km/h), faster downhill (45-68 km/h)
    let speed = avgSpeed;
    if (progress <= 0.65) {
      speed = Math.max(10, avgSpeed * 0.6 + Math.sin(i * 0.5) * 3);
    } else {
      speed = Math.min(72, avgSpeed * 2.2 + Math.cos(i * 0.8) * 8);
    }

    if (speed > maxSpd) {
      maxSpd = speed;
      maxSpdIdx = i;
    }

    // HR and Power higher on climbs
    const hr = progress <= 0.65
      ? Math.round(avgHr + 18 + Math.sin(i * 0.2) * 8)
      : Math.round(avgHr - 22 + Math.sin(i * 0.2) * 5);

    const power = progress <= 0.65
      ? Math.round(avgPower + 45 + Math.cos(i * 0.3) * 35)
      : Math.round(avgPower - 110 + Math.cos(i * 0.3) * 20);

    const cadence = progress <= 0.65 ? 78 + Math.round(Math.sin(i) * 5) : 92 + Math.round(Math.cos(i) * 6);

    const dist = Number((progress * totalDistanceKm).toFixed(2));
    const timeDeltaSec = (dist / (avgSpeed || 25)) * 3600;
    const timestamp = new Date(baseTime + timeDeltaSec * 1000).toISOString();

    const slope = progress <= 0.65 ? Math.round(7 + Math.sin(i * 0.4) * 4) : Math.round(-8 - Math.sin(i * 0.4) * 5);

    points.push({
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      altitude: Math.round(alt),
      speed: Number(speed.toFixed(1)),
      heartRate: hr,
      cadence,
      power: Math.max(0, power),
      temperature: Math.round(24 - (alt - baseAlt) / 150),
      distance: dist,
      timestamp,
      slope,
    });
  }

  const halfwayIdx = Math.floor(pointsCount / 2);
  const highlights: FitHighlight[] = [
    {
      type: 'summit',
      title: 'Passhöhe / Gipfelkreuz',
      description: `Höchster Punkt der Tour auf ${Math.round(maxAlt)} m ü. M.`,
      pointIndex: maxAltIdx,
      point: points[maxAltIdx],
      metricValue: `${Math.round(maxAlt)} m`,
    },
    {
      type: 'max_speed',
      title: 'Highspeed Abfahrt',
      description: `Spitzengeschwindigkeit von ${maxSpd.toFixed(1)} km/h in den Kehren`,
      pointIndex: maxSpdIdx,
      point: points[maxSpdIdx],
      metricValue: `${maxSpd.toFixed(1)} km/h`,
    },
    {
      type: 'halfway',
      title: 'Halbzeit (50%)',
      description: `${points[halfwayIdx].distance} km geschafft`,
      pointIndex: halfwayIdx,
      point: points[halfwayIdx],
      metricValue: `${points[halfwayIdx].distance} km`,
    },
  ];

  return { points, highlights };
}

// 1. Stilfser Joch (Passo dello Stelvio, Italien/Südtirol)
const stelvioData = generateTrack(46.5290, 10.5180, 180, 915, 2758, 1200, 48.5, 21.5, 158, 265);
export const SAMPLE_FIT_STELVIO: FitTrackData = {
  id: 'fit-sample-stelvio-2026',
  filename: 'stilfser_joch_koenigsetappe.fit',
  title: 'Stilfser Joch (Passo dello Stelvio) Königsetappe',
  description: 'Legendäre 48 Kehren, 2.758 m Passhöhe – Traumtag im Vinschgau / Südtirol mit atemberaubendem Bergpanorama.',
  summary: {
    sport: 'cycling',
    subSport: 'road',
    totalDistanceKm: 48.5,
    totalDurationSec: 8100, // 2h 15m
    movingDurationSec: 7800,
    elevationGainM: 1870,
    elevationLossM: 1560,
    maxAltitudeM: 2758,
    minAltitudeM: 915,
    avgSpeedKmh: 22.4,
    maxSpeedKmh: 71.2,
    avgHeartRate: 156,
    maxHeartRate: 182,
    avgCadence: 82,
    maxCadence: 108,
    avgPower: 268,
    maxPower: 540,
    totalCalories: 2140,
    startTime: '2026-08-15T09:00:00Z',
    endTime: '2026-08-15T11:15:00Z',
  },
  points: stelvioData.points,
  highlights: stelvioData.highlights,
  createdAt: '2026-08-15T12:00:00Z',
};

// 2. Mallorca Sa Calobra Rennradklassiker (Spanien)
const calobraData = generateTrack(39.8180, 2.7950, 150, 40, 682, 120, 62.0, 27.2, 148, 235);
export const SAMPLE_FIT_CALOBRA: FitTrackData = {
  id: 'fit-sample-calobra-2026',
  filename: 'mallorca_sa_calobra_loop.fit',
  title: 'Mallorca Sa Calobra & Coll dels Reis',
  description: 'Der spektakulärste Krawattenknoten des Mittelmeers – steile Felswände, glasklares Meer und Traumkurven.',
  summary: {
    sport: 'cycling',
    subSport: 'road',
    totalDistanceKm: 62.0,
    totalDurationSec: 8200,
    movingDurationSec: 7900,
    elevationGainM: 1150,
    elevationLossM: 1070,
    maxAltitudeM: 682,
    minAltitudeM: 12,
    avgSpeedKmh: 27.6,
    maxSpeedKmh: 68.4,
    avgHeartRate: 147,
    maxHeartRate: 176,
    avgCadence: 86,
    maxCadence: 114,
    avgPower: 238,
    maxPower: 490,
    totalCalories: 1780,
    startTime: '2026-08-10T08:30:00Z',
    endTime: '2026-08-10T10:46:00Z',
  },
  points: calobraData.points,
  highlights: calobraData.highlights,
  createdAt: '2026-08-10T11:30:00Z',
};

// 3. Schwarzwald Panoramaweg & Gravel Tour (Deutschland)
const gravelData = generateTrack(47.9950, 7.8520, 120, 310, 1120, 450, 38.4, 20.8, 142, 215);
export const SAMPLE_FIT_BLACK_FOREST: FitTrackData = {
  id: 'fit-sample-blackforest-2026',
  filename: 'schwarzwald_gravel_trail.fit',
  title: 'Schwarzwald Schauinsland Gravel Tour',
  description: 'Knackige Schotteranstiege durch tiefe Tannenwälder mit Weitblick bis zu den Vogesen.',
  summary: {
    sport: 'cycling',
    subSport: 'gravel',
    totalDistanceKm: 38.4,
    totalDurationSec: 6600,
    movingDurationSec: 6300,
    elevationGainM: 890,
    elevationLossM: 750,
    maxAltitudeM: 1120,
    minAltitudeM: 310,
    avgSpeedKmh: 21.2,
    maxSpeedKmh: 54.8,
    avgHeartRate: 144,
    maxHeartRate: 169,
    avgCadence: 79,
    maxCadence: 102,
    avgPower: 218,
    maxPower: 460,
    totalCalories: 1420,
    startTime: '2026-08-04T13:00:00Z',
    endTime: '2026-08-04T14:50:00Z',
  },
  points: gravelData.points,
  highlights: gravelData.highlights,
  createdAt: '2026-08-04T15:30:00Z',
};

export const SAMPLE_FIT_TOURS: FitTrackData[] = [
  SAMPLE_FIT_STELVIO,
  SAMPLE_FIT_CALOBRA,
  SAMPLE_FIT_BLACK_FOREST,
];
