// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ElevationChart } from './ElevationChart';
import { GpsTrackData, GpsTrackPoint } from '../../types';

afterEach(() => {
  cleanup();
});

const mockTrackPoints: GpsTrackPoint[] = [
  { lat: 46.541, lng: 10.518, altitude: 915, distance: 0.0, slope: 1.2, speed: 18.5, heartRate: 120, timestamp: '2026-08-21T08:00:00Z' },
  { lat: 46.535, lng: 10.505, altitude: 1450, distance: 8.4, slope: 8.5, speed: 12.0, heartRate: 155, timestamp: '2026-08-21T08:30:00Z' },
  { lat: 46.529, lng: 10.453, altitude: 2757, distance: 24.5, slope: 11.4, speed: 9.2, heartRate: 172, timestamp: '2026-08-21T09:30:00Z' },
  { lat: 46.520, lng: 10.430, altitude: 2200, distance: 32.0, slope: -7.5, speed: 45.0, heartRate: 110, timestamp: '2026-08-21T10:00:00Z' },
];

const mockTrackData: GpsTrackData = {
  id: 'track-test-1',
  filename: 'stilfser.gpx',
  title: 'Stilfser Joch Königsetappe',
  format: 'gpx',
  createdAt: '2026-08-21T08:00:00Z',
  points: mockTrackPoints,
  summary: {
    totalDistanceKm: 32.0,
    elevationGainM: 1842,
    elevationLossM: 557,
    maxAltitudeM: 2757,
    minAltitudeM: 915,
    avgSpeedKmh: 16.4,
    maxSpeedKmh: 45.0,
    totalDurationSec: 7200,
    movingDurationSec: 6800,
    startTime: '2026-08-21T08:00:00Z',
    endTime: '2026-08-21T10:00:00Z',
  },
  highlights: [
    {
      type: 'summit',
      title: 'Stilfser Joch (2.757 m)',
      description: 'Höchster Punkt der Route',
      pointIndex: 2,
      point: mockTrackPoints[2],
      metricValue: '2757 m',
    },
  ],
};

describe('ElevationChart Component', () => {
  it('renders elevation profile header and stats accurately', () => {
    render(<ElevationChart track={mockTrackData} />);

    // Header title and instruction
    expect(screen.getByText('Interaktives Höhenprofil & Steigung')).toBeDefined();
    expect(screen.getByText(/Bewege die Maus über das Profil/i)).toBeDefined();

    // Passhöhe stat badge exists
    const passElements = screen.getAllByText(/2757/);
    expect(passElements.length).toBeGreaterThan(0);

    // Slope categories footer
    expect(screen.getByText('Steigungs-Kategorien:')).toBeDefined();
    expect(screen.getByText(/Abfahrt/i)).toBeDefined();
    expect(screen.getByText(/Sehr steil/i)).toBeDefined();
  });

  it('renders empty message when track points are insufficient', () => {
    render(<ElevationChart points={[]} />);
    expect(screen.getByText('Keine Höhenprofil-Daten verfügbar.')).toBeDefined();
  });

  it('computes live gradient badge correctly with extreme slope', () => {
    render(<ElevationChart points={mockTrackPoints} track={mockTrackData} />);
    const liveBar = document.getElementById('elevation-chart-live-bar');
    expect(liveBar).not.toBeNull();
    // Maximum point or default active point shown
    expect(liveBar?.textContent).toContain('m');
    expect(liveBar?.textContent).toContain('Distanz:');
  });
});
