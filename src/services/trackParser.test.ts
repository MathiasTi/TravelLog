import { describe, it, expect } from 'vitest';
import {
  calculateHaversineDistance,
  calculateBearing,
  getGradientColor,
  getGradientLabel,
  formatTourDuration,
  parseGpxString,
} from './trackParser';

describe('GPS Track & GPX/FIT Parser Utilities', () => {
  it('calculates accurate Haversine distance between two GPS coordinates', () => {
    // Distance between Munich (48.137, 11.576) and Innsbruck (47.269, 11.404) is approx 97-100 km
    const dist = calculateHaversineDistance(48.137, 11.576, 47.269, 11.404);
    expect(dist).toBeGreaterThan(90);
    expect(dist).toBeLessThan(110);
  });

  it('calculates correct bearing degrees between coordinates', () => {
    // Directly North
    const bearingNorth = calculateBearing(45.0, 10.0, 46.0, 10.0);
    expect(Math.round(bearingNorth)).toBe(0);

    // Directly East
    const bearingEast = calculateBearing(45.0, 10.0, 45.0, 11.0);
    expect(Math.round(bearingEast)).toBe(90);

    // Directly South
    const bearingSouth = calculateBearing(46.0, 10.0, 45.0, 10.0);
    expect(Math.round(bearingSouth)).toBe(180);
  });

  it('assigns correct gradient color codes and human labels based on slope %', () => {
    // Downhill
    expect(getGradientColor(-8)).toBe('#06B6D4'); // Cyan
    expect(getGradientLabel(-8)).toContain('Abfahrt');

    // Flat / gentle
    expect(getGradientColor(1)).toBe('#10B981'); // Emerald Green
    expect(getGradientLabel(1)).toContain('Flach');

    // Climb
    expect(getGradientColor(7)).toBe('#E2725B'); // Terracotta
    expect(getGradientLabel(7)).toContain('Anstieg');

    // Steep ramp
    expect(getGradientColor(12)).toBe('#DC2626'); // Red
    expect(getGradientLabel(12)).toContain('Steile Rampe');

    // Extreme wall (>15%)
    expect(getGradientColor(18)).toBe('#7C3AED'); // Purple
    expect(getGradientLabel(18)).toContain('Extremer Steilhang');
  });

  it('formats tour duration in readable hours and minutes', () => {
    expect(formatTourDuration(3665)).toBe('1h 01m');
    expect(formatTourDuration(5400)).toBe('1h 30m');
    expect(formatTourDuration(125)).toBe('2m 05s');
  });

  it('correctly parses GPX XML string into structured track data', () => {
    const sampleGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Garmin Connect">
  <metadata>
    <name>Stilfser Joch Königsetappe</name>
  </metadata>
  <trk>
    <name>Stilfser Joch Königsetappe</name>
    <trkseg>
      <trkpt lat="46.541" lon="10.518">
        <ele>915.0</ele>
        <time>2026-08-20T08:00:00Z</time>
        <speed>4.5</speed>
      </trkpt>
      <trkpt lat="46.535" lon="10.505">
        <ele>1450.0</ele>
        <time>2026-08-20T08:30:00Z</time>
        <speed>3.8</speed>
      </trkpt>
      <trkpt lat="46.529" lon="10.453">
        <ele>2757.0</ele>
        <time>2026-08-20T09:45:00Z</time>
        <speed>3.2</speed>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;

    const track = parseGpxString(sampleGpx, 'stilfser_joch.gpx');
    expect(track).toBeDefined();
    expect(track.title).toContain('Stilfser Joch');
    expect(track.points.length).toBe(3);
    expect(track.points[0].altitude).toBe(915);
    expect(track.points[2].altitude).toBe(2757);
    expect(track.summary.maxAltitudeM).toBe(2757);
    expect(track.summary.elevationGainM).toBeGreaterThan(1500);
    expect(track.highlights.some((h) => h.type === 'summit')).toBe(true);
  });
});
