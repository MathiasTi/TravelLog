// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

// Mock leaflet before importing TravelMap
vi.mock('leaflet', () => {
  return {
    default: {
      map: vi.fn(() => ({
        remove: vi.fn(),
        on: vi.fn(),
        setView: vi.fn(),
        fitBounds: vi.fn(),
        flyTo: vi.fn(),
      })),
      tileLayer: vi.fn(() => ({
        addTo: vi.fn(),
      })),
      layerGroup: vi.fn(() => ({
        addTo: vi.fn(),
        clearLayers: vi.fn(),
        addLayer: vi.fn(),
      })),
      divIcon: vi.fn(),
      marker: vi.fn(() => ({
        addTo: vi.fn(),
        bindPopup: vi.fn(),
        on: vi.fn(),
      })),
      polyline: vi.fn(() => ({
        addTo: vi.fn(),
      })),
      latLngBounds: vi.fn(() => ({
        isValid: vi.fn(() => true),
      })),
      control: {
        attribution: vi.fn(() => ({ addTo: vi.fn() })),
        zoom: vi.fn(() => ({ addTo: vi.fn() })),
      },
    },
  };
});

import { TILE_LAYERS } from './TravelMap';

describe('Map OpenStreetMap (OSM) Layers Configuration', () => {
  it('has OpenStreetMap Standard as the primary tile provider', () => {
    expect(TILE_LAYERS.osm).toBeDefined();
    expect(TILE_LAYERS.osm.name).toContain('OpenStreetMap');
    expect(TILE_LAYERS.osm.url).toContain('tile.openstreetmap.org');
    expect(TILE_LAYERS.osm.attribution).toContain('OpenStreetMap');
  });

  it('provides OpenStreetMap German/Regional style layer', () => {
    expect(TILE_LAYERS.osm_de).toBeDefined();
    expect(TILE_LAYERS.osm_de.url).toContain('tile.openstreetmap.de');
    expect(TILE_LAYERS.osm_de.attribution).toContain('OpenStreetMap');
  });

  it('provides OpenStreetMap Humanitarian (HOT) layer', () => {
    expect(TILE_LAYERS.osm_hot).toBeDefined();
    expect(TILE_LAYERS.osm_hot.url).toContain('tile.openstreetmap.fr/hot');
    expect(TILE_LAYERS.osm_hot.attribution).toContain('OpenStreetMap');
  });

  it('provides OpenTopoMap topographical layer based on OSM data', () => {
    expect(TILE_LAYERS.topo).toBeDefined();
    expect(TILE_LAYERS.topo.url).toContain('tile.opentopomap.org');
    expect(TILE_LAYERS.topo.attribution).toContain('OpenStreetMap');
  });

  it('provides CyclOSM outdoor and trail layer based on OSM data', () => {
    expect(TILE_LAYERS.cyclosm).toBeDefined();
    expect(TILE_LAYERS.cyclosm.url).toContain('tile-cyclosm.openstreetmap.fr');
    expect(TILE_LAYERS.cyclosm.attribution).toContain('OpenStreetMap');
  });

  it('contains valid secure https URLs for all tile layers', () => {
    Object.values(TILE_LAYERS).forEach((layer) => {
      expect(layer.url.startsWith('https://')).toBe(true);
      expect(layer.attribution.length).toBeGreaterThan(0);
      expect(layer.name.length).toBeGreaterThan(0);
    });
  });
});
