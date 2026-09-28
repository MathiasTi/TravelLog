import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { JournalEntry, Trip, Coordinates, EntrySortMode, ThemeMode, Collaborator, GpsTrackData, GpsTrackPoint, CategoryType } from '../../types';
import { CATEGORIES, CURRENT_USER } from '../../data/initialData';
import { syncEngine } from '../../services/syncEngine';
import { findNearestTrackPoint } from '../../services/trackParser';
import { ConfirmDeleteModal } from '../Modals/ConfirmDeleteModal';
import { ReorderEntriesModal } from '../Modals/ReorderEntriesModal';
import { MapWaypointBottomSheet } from './MapWaypointBottomSheet';
import { TrackPointInspectorSheet } from '../Tracks/TrackPointInspectorSheet';
import { sortJournalEntries } from '../../utils/entrySorting';
import {
  MapPin,
  Layers,
  Search,
  Plus,
  Maximize2,
  Navigation,
  Eye,
  Camera,
  Heart,
  MessageCircle,
  Calendar,
  Sparkles,
  Info,
  Trash2,
  Edit,
  X,
  ListOrdered,
  Milestone,
  ChevronDown
} from 'lucide-react';

interface TravelMapProps {
  entries: JournalEntry[];
  activeTrip: Trip | null;
  allTrips: Trip[];
  currentUser?: Collaborator;
  onSelectEntry: (entry: JournalEntry) => void;
  onAddEntryAtCoordinates: (
    coords: Coordinates,
    address?: string,
    extra?: {
      title?: string;
      note?: string;
      date?: string;
      category?: CategoryType;
    }
  ) => void;
  onEditEntry?: (entry: JournalEntry) => void;
  onDeleteEntry?: (entryId: string) => void;
  onReorderEntries?: (orderedEntries: JournalEntry[]) => void;
  sortMode?: EntrySortMode;
  focusedEntryId?: string | null;
  theme?: ThemeMode;
  onOpenTrackUpload?: () => void;
  onOpenFitUpload?: () => void;
  onRemoveTrackFromTrip?: (trackId: string) => void;
}

export type TileLayerType = 'osm' | 'osm_de' | 'osm_hot' | 'topo' | 'cyclosm';

export const TILE_LAYERS: Record<TileLayerType, { name: string; url: string; attribution: string }> = {
  osm: {
    name: 'OpenStreetMap (Standard)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors (API-frei)',
  },
  osm_de: {
    name: 'OpenStreetMap (DE / Deutsch)',
    url: 'https://tile.openstreetmap.de/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors (Regional / OSM DE)',
  },
  osm_hot: {
    name: 'OpenStreetMap (Humanitarian)',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors (HOT Style)',
  },
  topo: {
    name: 'OpenTopoMap (Topographie & Höhen)',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>, SRTM | &copy; OpenTopoMap',
  },
  cyclosm: {
    name: 'CyclOSM (Wander- & Radwege)',
    url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors | CyclOSM',
  },
};

export const TravelMap: React.FC<TravelMapProps> = ({
  entries,
  activeTrip,
  allTrips,
  currentUser,
  onSelectEntry,
  onAddEntryAtCoordinates,
  onEditEntry,
  onDeleteEntry,
  onReorderEntries,
  sortMode,
  focusedEntryId,
  theme = 'light',
  onOpenTrackUpload,
  onOpenFitUpload,
  onRemoveTrackFromTrip,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const trackPolylinesRef = useRef<L.Polyline[]>([]);

  const handleOpenTrackModal = onOpenTrackUpload || onOpenFitUpload;

  const [currentLayerType, setCurrentLayerType] = useState<TileLayerType>('osm');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showRoute, setShowRoute] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{ name: string; lat: number; lng: number }[]>([]);
  const [selectedPlacePreview, setSelectedPlacePreview] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [clickCoordMode, setClickCoordMode] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<JournalEntry | null>(null);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [selectedWaypointForSheet, setSelectedWaypointForSheet] = useState<JournalEntry | null>(null);
  const [activeTrackProbe, setActiveTrackProbe] = useState<{ track: GpsTrackData; pointIndex: number } | null>(null);
  const [showMobileCategories, setShowMobileCategories] = useState(false);
  const [isTracksWidgetExpanded, setIsTracksWidgetExpanded] = useState(false);
  const probeMarkerRef = useRef<L.Marker | null>(null);

  // Manage Active Track Point Marker on the Map
  useEffect(() => {
    if (!mapRef.current) return;

    if (probeMarkerRef.current) {
      probeMarkerRef.current.remove();
      probeMarkerRef.current = null;
    }

    if (activeTrackProbe && activeTrackProbe.track.points) {
      const pts = activeTrackProbe.track.points;
      const safeIdx = Math.max(0, Math.min(activeTrackProbe.pointIndex, pts.length - 1));
      const pt = pts[safeIdx];
      if (!pt) return;

      const distKm = pt.distance !== undefined
        ? pt.distance
        : Number(((safeIdx / Math.max(1, pts.length - 1)) * activeTrackProbe.track.summary.totalDistanceKm).toFixed(1));

      const probeIcon = L.divIcon({
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; cursor: pointer;">
            <div style="position: absolute; width: 38px; height: 38px; border-radius: 9999px; background: rgba(226, 114, 91, 0.35); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="width: 30px; height: 30px; border-radius: 9999px; background: #E2725B; color: white; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; border: 2.5px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.35); z-index: 2;">
              📍
            </div>
            <div style="position: absolute; bottom: 36px; left: 50%; transform: translateX(-50%); background: #1A1815; color: #EDE8DF; padding: 3px 8px; border-radius: 9999px; font-size: 10px; font-weight: 800; font-family: monospace; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.2); z-index: 3;">
              km ${distKm.toFixed(1)}${pt.altitude ? ` · ${Math.round(pt.altitude)}m` : ''}
            </div>
          </div>
        `,
        className: 'custom-track-probe-marker',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });

      const marker = L.marker([pt.lat, pt.lng], {
        icon: probeIcon,
        draggable: true,
        zIndexOffset: 1500,
      }).addTo(mapRef.current);

      marker.on('drag', (e) => {
        const markerLatLng = e.target.getLatLng();
        const nearest = findNearestTrackPoint(markerLatLng.lat, markerLatLng.lng, activeTrackProbe.track, 30000);
        if (nearest) {
          marker.setLatLng([nearest.point.lat, nearest.point.lng]);
          setActiveTrackProbe((prev) => (prev ? { ...prev, pointIndex: nearest.pointIndex } : null));
        }
      });

      probeMarkerRef.current = marker;
    }

    return () => {
      if (probeMarkerRef.current) {
        probeMarkerRef.current.remove();
        probeMarkerRef.current = null;
      }
    };
  }, [activeTrackProbe?.track.id, activeTrackProbe?.pointIndex]);


  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialCenter: [number, number] = activeTrip ? activeTrip.defaultCoordinates : [48.137154, 11.576124];
    const initialZoom = activeTrip ? activeTrip.defaultZoom : 6;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: false,
    });

    // Add Attribution in bottom right with sleek styling
    L.control.attribution({ position: 'bottomright' }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const tileLayer = L.tileLayer(TILE_LAYERS[currentLayerType].url, {
      attribution: TILE_LAYERS[currentLayerType].attribution,
      maxZoom: 19,
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;

    // Handle Map Click to Add Memory
    map.on('click', async (e: L.LeafletMouseEvent) => {
      const coords = { lat: Number(e.latlng.lat.toFixed(6)), lng: Number(e.latlng.lng.toFixed(6)) };
      const addr = await syncEngine.reverseGeocode(coords.lat, coords.lng);
      onAddEntryAtCoordinates(coords, addr);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Tile Layer when layer type changes
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;
    mapRef.current.removeLayer(tileLayerRef.current);
    const newLayer = L.tileLayer(TILE_LAYERS[currentLayerType].url, {
      attribution: TILE_LAYERS[currentLayerType].attribution,
      maxZoom: 19,
    }).addTo(mapRef.current);
    tileLayerRef.current = newLayer;
  }, [currentLayerType]);

  // Center map when activeTrip or attached tracks change
  useEffect(() => {
    if (!mapRef.current || !activeTrip) return;
    const allCoords: [number, number][] = [];
    entries.forEach((e) => allCoords.push([e.coordinates.lat, e.coordinates.lng]));
    (activeTrip.tracks || []).forEach((t) => t.points?.forEach((p) => allCoords.push([p.lat, p.lng])));
    entries.filter((e) => e.track).forEach((e) => e.track?.points?.forEach((p) => allCoords.push([p.lat, p.lng])));

    if (allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords);
      mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    } else {
      mapRef.current.setView(activeTrip.defaultCoordinates, activeTrip.defaultZoom);
    }
  }, [activeTrip?.id, activeTrip?.tracks?.length]);

  // Handle focused entry from timeline/list/new entry
  useEffect(() => {
    if (!mapRef.current || !focusedEntryId) return;
    const target = entries.find((e) => e.id === focusedEntryId);
    if (target) {
      const lat = target.coordinates.lat;
      const lng = target.coordinates.lng;
      mapRef.current.flyTo([lat, lng], 14, {
        duration: 1.2,
      });

      const timer = setTimeout(() => {
        if (!markersLayerRef.current) return;
        markersLayerRef.current.eachLayer((layer: any) => {
          if (layer.getLatLng) {
            const pos = layer.getLatLng();
            if (Math.abs(pos.lat - lat) < 0.0001 && Math.abs(pos.lng - lng) < 0.0001) {
              layer.openPopup();
            }
          }
        });
      }, 1300);

      return () => clearTimeout(timer);
    }
  }, [focusedEntryId, entries]);

  // Update Markers & Route
  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    if (routeLayerRef.current) {
      mapRef.current.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    // Clear existing track polylines
    trackPolylinesRef.current.forEach((poly) => {
      if (mapRef.current) mapRef.current.removeLayer(poly);
    });
    trackPolylinesRef.current = [];

    const filteredEntries = entries.filter((entry) => {
      if (selectedCategory !== 'all' && entry.category !== selectedCategory) return false;
      return true;
    });

    // Draw attached GPS Tracks (from trip.tracks or entry.track)
    const allGpsTracks = [
      ...(activeTrip?.tracks || []),
      ...entries.filter((e) => e.track).map((e) => e.track!),
    ];

    allGpsTracks.forEach((gpsTrack) => {
      if (gpsTrack.points && gpsTrack.points.length > 1 && mapRef.current) {
        const trackLatLngs: [number, number][] = gpsTrack.points.map((pt) => [pt.lat, pt.lng]);

        // Casing polyline for maximum readability against all map textures
        const trackCasing = L.polyline(trackLatLngs, {
          color: '#1E293B',
          weight: 7,
          opacity: 0.35,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(mapRef.current);
        trackPolylinesRef.current.push(trackCasing);

        // Main polyline
        const trackPolyline = L.polyline(trackLatLngs, {
          color: '#10B981',
          weight: 4.5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(mapRef.current);

        // Invisible wider touch-buffer polyline for effortless mobile and desktop point selection
        const touchBuffer = L.polyline(trackLatLngs, {
          weight: 34,
          opacity: 0,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(mapRef.current);
        trackPolylinesRef.current.push(touchBuffer);

        const handleTrackTouch = (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          const nearest = findNearestTrackPoint(e.latlng.lat, e.latlng.lng, gpsTrack, 30000);
          if (nearest) {
            setActiveTrackProbe({
              track: gpsTrack,
              pointIndex: nearest.pointIndex,
            });
          }
        };

        touchBuffer.on('click', handleTrackTouch);
        trackPolyline.on('click', handleTrackTouch);

        const summary = gpsTrack.summary;
        const isTripTrack = (activeTrip?.tracks || []).some((t) => t.id === gpsTrack.id);

        const popupHtml = `
          <div style="font-family: system-ui, -apple-system, sans-serif; padding: 4px 6px; min-width: 230px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 4px;">
              <span style="font-size: 10px; font-weight: 700; color: #10B981; text-transform: uppercase; letter-spacing: 0.05em;">
                🚴 GPS-Route (${gpsTrack.fileFormat?.toUpperCase() || 'FIT'})
              </span>
              ${isTripTrack ? '<span style="font-size: 9px; background: #ECFDF5; color: #047857; padding: 2px 6px; border-radius: 9999px; font-weight: 700;">Angeheftet</span>' : ''}
            </div>
            <div style="font-weight: 800; color: #1E293B; font-size: 13px; line-height: 1.3; margin-bottom: 6px;">
              ${gpsTrack.title}
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; background: #F8FAFC; padding: 6px; border-radius: 8px; font-size: 11px; margin-bottom: 8px; border: 1px solid #E2E8F0;">
              <div>📏 Distanz: <b>${summary.totalDistanceKm} km</b></div>
              <div>⛰️ Anstieg: <b>+${summary.elevationGainM} m</b></div>
              ${summary.avgSpeedKmh ? `<div>⚡ Schnitt: <b>${summary.avgSpeedKmh} km/h</b></div>` : ''}
              ${summary.maxElevationM ? `<div>🏔️ Max Höhe: <b>${summary.maxElevationM} m</b></div>` : ''}
            </div>
            <div style="display: flex; gap: 4px; margin-top: 4px;">
              <button id="btn-explore-track-${gpsTrack.id}" style="flex: 1; background: #E2725B; color: white; border: none; padding: 6px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">
                📍 Stopps planen
              </button>
              <button id="btn-zoom-track-${gpsTrack.id}" style="background: #10B981; color: white; border: none; padding: 6px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">
                🔍 Zoom
              </button>
              ${isTripTrack && onRemoveTrackFromTrip ? `
                <button id="btn-remove-track-${gpsTrack.id}" style="background: #FEE2E2; color: #DC2626; border: 1px solid #FECACA; padding: 6px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;" title="Von Reise lösen">
                  🗑️
                </button>
              ` : ''}
            </div>
          </div>
        `;

        trackPolyline.bindPopup(popupHtml, { maxWidth: 290 });

        trackPolyline.on('popupopen', () => {
          const btnExplore = document.getElementById(`btn-explore-track-${gpsTrack.id}`);
          if (btnExplore) {
            btnExplore.onclick = () => {
              mapRef.current?.closePopup();
              setActiveTrackProbe({
                track: gpsTrack,
                pointIndex: Math.floor(gpsTrack.points.length / 2),
              });
            };
          }
          const btnZoom = document.getElementById(`btn-zoom-track-${gpsTrack.id}`);
          if (btnZoom && mapRef.current) {
            btnZoom.onclick = () => {
              const b = L.latLngBounds(trackLatLngs);
              mapRef.current?.fitBounds(b, { padding: [60, 60], maxZoom: 15 });
            };
          }
          const btnRemove = document.getElementById(`btn-remove-track-${gpsTrack.id}`);
          if (btnRemove && onRemoveTrackFromTrip) {
            btnRemove.onclick = () => {
              onRemoveTrackFromTrip(gpsTrack.id);
            };
          }
        });

        // Add Start marker (🟢) and Finish marker (🏁)
        const startPt = trackLatLngs[0];
        const endPt = trackLatLngs[trackLatLngs.length - 1];

        const startIcon = L.divIcon({
          html: `<div style="background: #10B981; color: white; width: 26px; height: 26px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; border: 2.5px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.35);" title="Start: ${gpsTrack.title}">▶</div>`,
          className: 'custom-track-start-marker',
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        const startMarker = L.marker(startPt, { icon: startIcon });
        startMarker.bindPopup(`<b>Start:</b> ${gpsTrack.title}`);
        markersLayerRef.current?.addLayer(startMarker);

        const endIcon = L.divIcon({
          html: `<div style="background: #E11D48; color: white; width: 26px; height: 26px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; border: 2.5px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.35);" title="Ziel: ${gpsTrack.title}">🏁</div>`,
          className: 'custom-track-end-marker',
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        const endMarker = L.marker(endPt, { icon: endIcon });
        endMarker.bindPopup(`<b>Ziel:</b> ${gpsTrack.title} (${summary.totalDistanceKm} km)`);
        markersLayerRef.current?.addLayer(endMarker);

        trackPolylinesRef.current.push(trackPolyline);
      }
    });

    // Sorted coordinates according to sortMode/custom order
    const sortedEntries = sortJournalEntries(filteredEntries, sortMode || 'date_asc');

    // Draw route polyline
    if (showRoute && sortedEntries.length > 1) {
      const latlngs: [number, number][] = sortedEntries.map((e) => [
        e.coordinates.lat,
        e.coordinates.lng,
      ]);

      const routePolyline = L.polyline(latlngs, {
        color: '#E2725B',
        weight: 3.5,
        opacity: 0.85,
        dashArray: '8, 8',
        lineCap: 'round',
        lineJoin: 'round',
        className: 'animated-route-line',
      }).addTo(mapRef.current);

      routeLayerRef.current = routePolyline;
    }

    // Add custom markers
    sortedEntries.forEach((entry, index) => {
      const catConfig = CATEGORIES.find((c) => c.id === entry.category) || CATEGORIES[0];
      const hasPhoto = entry.media && entry.media.length > 0 && entry.media[0].type === 'photo';
      const photoUrl = hasPhoto ? entry.media[0].url : null;

      const markerHtml = `
        <div class="relative group cursor-pointer" id="marker-${entry.id}">
          <div class="w-10 h-10 rounded-2xl shadow-lg flex items-center justify-center p-0.5 border-2 transition-all transform hover:scale-110"
               style="background-color: #FFFFFF; border-color: ${catConfig.color};">
            ${
              photoUrl
                ? `<img src="${photoUrl}" alt="${entry.title}" class="w-full h-full object-cover rounded-xl" />`
                : `<div class="w-full h-full rounded-xl flex items-center justify-center text-xs font-bold" style="background-color: ${catConfig.color}20; color: ${catConfig.color};">${index + 1}</div>`
            }
            <span class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border border-white flex items-center justify-center text-[9px] font-bold text-white shadow" style="background-color: ${catConfig.color};">
              ${index + 1}
            </span>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-leaflet-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -22],
      });

      const marker = L.marker([entry.coordinates.lat, entry.coordinates.lng], {
        icon: customIcon,
      });

      // Custom Popup HTML
      const firstMedia = entry.media?.[0];
      const popupHtml = `
        <div class="w-64 overflow-hidden rounded-2xl bg-white text-[#4E3B31] p-0 border border-[#E5E1D8] shadow-2xl">
          ${
            firstMedia
              ? `<div class="h-28 w-full relative overflow-hidden">
                  <img src="${firstMedia.url}" class="w-full h-full object-cover" />
                  <div class="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                  <span class="absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider backdrop-blur-md bg-white/90 border border-white/40 shadow-sm flex items-center gap-1" style="color: ${catConfig.color}">
                    <span>${catConfig.label}</span>
                    ${entry.weather ? `<span class="text-[#E2725B] font-bold">· ${entry.weather.temp !== undefined ? `${entry.weather.temp}°C` : entry.weather.label}</span>` : ''}
                  </span>
                </div>`
              : `<div class="px-3 pt-3 flex items-center justify-between">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-[#F1EDE6] border border-[#E5E1D8]" style="color: ${catConfig.color}">
                    ${catConfig.label}
                  </span>
                  ${entry.weather ? `<span class="text-[11px] text-[#E2725B] font-semibold">🌤️ ${entry.weather.temp !== undefined ? `${entry.weather.temp}°C` : ''}</span>` : ''}
                </div>`
          }
          <div class="p-3.5">
            ${
              entry.locationName
                ? `<div class="flex items-center gap-1 text-[11px] font-bold text-[#E2725B] uppercase tracking-wider mb-1">
                    <span>📍 ${entry.locationName.split(',')[0]}</span>
                   </div>`
                : ''
            }
            <h4 class="font-bold text-sm text-[#4E3B31] line-clamp-1 mb-1 font-serif">${entry.title}</h4>
            <p class="text-xs text-[#6B5E55] line-clamp-2 mb-2.5">${entry.note || entry.locationName}</p>
            <div class="flex items-center justify-between text-[11px] text-[#8C8273] pt-2 border-t border-[#E5E1D8]">
              <div class="flex items-center gap-1.5">
                <img src="${entry.author.avatar}" class="w-4 h-4 rounded-full object-cover border border-[#E5E1D8]" />
                <span class="truncate max-w-[70px] text-[#4E3B31]">${entry.author.name}</span>
              </div>
              <div class="flex items-center gap-1">
                <button id="btn-edit-${entry.id}" class="px-2 py-1 rounded-lg bg-[#F1EDE6] hover:bg-[#E5E1D8] text-[#4E3B31] font-semibold text-[10px] transition border border-[#E5E1D8]" title="Bearbeiten">
                  ✏️
                </button>
                <button id="btn-del-${entry.id}" class="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-[10px] transition border border-red-200" title="Löschen">
                  🗑️
                </button>
                <button id="btn-open-${entry.id}" class="px-2.5 py-1 rounded-lg bg-[#E2725B] hover:bg-[#D46049] text-white font-bold text-[11px] transition shadow-sm">
                  Öffnen →
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 280, closeButton: false });

      marker.on('click', () => {
        setSelectedWaypointForSheet(entry);
      });

      marker.on('popupopen', () => {
        setSelectedWaypointForSheet(entry);
        const btnOpen = document.getElementById(`btn-open-${entry.id}`);
        if (btnOpen) {
          btnOpen.onclick = () => onSelectEntry(entry);
        }

        const btnEdit = document.getElementById(`btn-edit-${entry.id}`);
        if (btnEdit && onEditEntry) {
          btnEdit.onclick = () => onEditEntry(entry);
        }

        const btnDel = document.getElementById(`btn-del-${entry.id}`);
        if (btnDel && onDeleteEntry) {
          btnDel.onclick = () => {
            setEntryToDelete(entry);
          };
        }
      });

      markersLayerRef.current?.addLayer(marker);
    });
  }, [entries, selectedCategory, showRoute, activeTrip, activeTrip?.tracks, sortMode]);

  // Search Address / Place
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        searchQuery
      )}&limit=5`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'de, en' } });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(
          data.map((d: any) => ({
            name: d.display_name,
            lat: parseFloat(d.lat),
            lng: parseFloat(d.lon),
          }))
        );
      }
    } catch (err) {
      console.warn('Search place error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: { name: string; lat: number; lng: number }) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo([result.lat, result.lng], 14, { duration: 1.2 });
    setSelectedPlacePreview(result);
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleFitAllPoints = () => {
    if (!mapRef.current || entries.length === 0) return;
    const bounds = L.latLngBounds(entries.map((e) => [e.coordinates.lat, e.coordinates.lng]));
    mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
  };

  return (
    <div className="relative w-full h-full min-h-[400px] overflow-hidden bg-[#FDFBF7] flex flex-col select-none">
      {/* Map Container */}
      <div id="leaflet-map-root" ref={mapContainerRef} className="w-full h-full z-0 cursor-crosshair" />

      {/* Top Floating Bar: Search & Quick Filters */}
      <div className="absolute top-3 left-3 right-3 sm:right-auto sm:left-4 z-20 flex flex-col gap-2 max-w-md">
        {/* Search Box */}
        <form onSubmit={handleSearch} className="relative flex items-center shadow-lg">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8273]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ort oder Sehenswürdigkeit suchen..."
              className="w-full pl-10 pr-20 py-2.5 rounded-xl bg-white/95 backdrop-blur-md text-sm text-[#4E3B31] placeholder-[#8C8273] border border-[#E5E1D8] focus:outline-none focus:border-[#8A9A5B] shadow-md transition"
            />
            {isSearching ? (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8A9A5B] animate-pulse font-medium">
                Suchen...
              </span>
            ) : (
              searchQuery && (
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-[#8A9A5B] hover:bg-[#7D8C68] text-white text-xs font-bold transition shadow-sm"
                >
                  Finden
                </button>
              )
            )}
          </div>

          {/* Search Dropdown Results */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#FDFBF7]/95 backdrop-blur-md rounded-xl border border-[#E5E1D8] shadow-2xl overflow-hidden divide-y divide-[#E5E1D8] z-50">
              {searchResults.map((res, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectSearchResult(res)}
                  className="w-full px-3.5 py-2.5 text-left text-xs text-[#4E3B31] hover:bg-[#F1EDE6] flex items-start gap-2 transition"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#E2725B] mt-0.5 shrink-0" />
                  <span className="line-clamp-2">{res.name}</span>
                </button>
              ))}
            </div>
          )}
        </form>

        {/* Mobile Filter Toggle Button */}
        <div className="sm:hidden flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowMobileCategories(!showMobileCategories)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur-md border border-[#E5E1D8] text-xs font-semibold text-[#4E3B31] shadow-sm transition"
          >
            <span className="w-2 h-2 rounded-full" style={{
              backgroundColor: selectedCategory === 'all'
                ? '#8A9A5B'
                : CATEGORIES.find(c => c.id === selectedCategory)?.color || '#8A9A5B'
            }} />
            <span>
              {selectedCategory === 'all'
                ? `Filter: Alle (${entries.length})`
                : `Filter: ${CATEGORIES.find(c => c.id === selectedCategory)?.label || selectedCategory}`}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-[#8C8273] transition-transform ${showMobileCategories ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Categories Bar: Always visible on desktop, toggleable on mobile */}
        <div className={`${showMobileCategories ? 'flex' : 'hidden sm:flex'} items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none flex-wrap sm:flex-nowrap`}>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('all');
              setShowMobileCategories(false);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition backdrop-blur-md border ${
              selectedCategory === 'all'
                ? 'bg-[#8A9A5B] text-white border-[#8A9A5B] shadow-md'
                : 'bg-white/90 text-[#6B5E55] border-[#E5E1D8] hover:bg-[#F1EDE6]'
            }`}
          >
            Alle ({entries.length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = entries.filter((e) => e.category === cat.id).length;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setShowMobileCategories(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition backdrop-blur-md border flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-white text-[#4E3B31] border-[#8A9A5B] shadow-md font-semibold'
                    : 'bg-white/90 text-[#6B5E55] border-[#E5E1D8] hover:bg-[#F1EDE6]'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }}></span>
                <span>{cat.label}</span>
                {count > 0 && <span className="opacity-70 text-[10px]">({count})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Map Action Floating Buttons (Top Right) */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
        {/* GPS Track Import Button */}
        {handleOpenTrackModal && (
          <button
            type="button"
            onClick={handleOpenTrackModal}
            className="p-2.5 rounded-xl bg-[#8A9A5B] hover:bg-[#78884E] text-white backdrop-blur-md border border-[#78884E]/50 shadow-lg transition hover:scale-105 active:scale-95 flex items-center justify-center font-bold text-sm"
            title="GPS-Track (.gpx / .fit) importieren"
          >
            <span className="text-sm">📍</span>
          </button>
        )}

        {/* Layer Switcher */}
        <div className="relative group">
          <button
            type="button"
            className="p-2.5 rounded-xl bg-white/95 backdrop-blur-md text-[#6B5E55] border border-[#E5E1D8] hover:text-[#4E3B31] hover:bg-[#F1EDE6] shadow-md transition"
            title="Kartenstil ändern"
          >
            <Layers className="w-5 h-5" />
          </button>

          <div className="hidden group-hover:flex absolute right-0 top-full mt-2 w-56 bg-[#FDFBF7] dark:bg-[#25201C] backdrop-blur-md rounded-2xl border border-[#E5E1D8] dark:border-[#38322C] shadow-2xl p-2 flex-col gap-1 z-30 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#8C8273] border-b border-[#E5E1D8] dark:border-[#38322C] mb-0.5">
              Kartenstil wählen
            </div>
            {(Object.keys(TILE_LAYERS) as TileLayerType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setCurrentLayerType(type)}
                className={`px-2.5 py-1.5 rounded-xl text-left text-xs transition flex items-center justify-between gap-1.5 cursor-pointer ${
                  currentLayerType === type
                    ? 'bg-[#8A9A5B] text-white font-bold shadow-xs'
                    : 'text-[#4E3B31] dark:text-[#EDE8DF] hover:bg-[#F1EDE6] dark:hover:bg-[#322B25]'
                }`}
              >
                <span className="truncate">{TILE_LAYERS[type].name}</span>
                {currentLayerType === type && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Toggle Route Path */}
        <button
          type="button"
          onClick={() => setShowRoute(!showRoute)}
          className={`p-2.5 rounded-xl backdrop-blur-md border shadow-md transition ${
            showRoute
              ? 'bg-[#8A9A5B]/15 text-[#8A9A5B] border-[#8A9A5B]/40 font-bold'
              : 'bg-white/95 text-[#8C8273] border-[#E5E1D8] hover:text-[#4E3B31]'
          }`}
          title={showRoute ? 'Reiseroute ausblenden' : 'Reiseroute einblenden'}
        >
          <Navigation className="w-5 h-5" />
        </button>

        {/* Reorder Stops & Route Order Button */}
        {entries.length > 1 && (
          <button
            type="button"
            onClick={() => setIsReorderModalOpen(true)}
            className="p-2.5 rounded-xl bg-white/95 backdrop-blur-md text-[#6B5E55] border border-[#E5E1D8] hover:text-[#8A9A5B] hover:bg-[#F1EDE6] shadow-md transition"
            title="Reihenfolge der Stopps & Route anpassen"
          >
            <ListOrdered className="w-5 h-5" />
          </button>
        )}

        {/* Center & Fit all points */}
        <button
          type="button"
          onClick={handleFitAllPoints}
          className="p-2.5 rounded-xl bg-white/95 backdrop-blur-md text-[#6B5E55] border border-[#E5E1D8] hover:text-[#4E3B31] hover:bg-[#F1EDE6] shadow-md transition"
          title="Alle Reise-Stopps & Routen zentrieren"
        >
          <Maximize2 className="w-5 h-5" />
        </button>
      </div>

      {/* Attached GPS Tracks Floating Widget */}
      {activeTrip?.tracks && activeTrip.tracks.length > 0 && (
        <div className="absolute top-16 right-3 z-20 flex flex-col gap-1 max-w-[240px] items-end animate-in fade-in slide-in-from-right-2 duration-200">
          {/* Mobile Collapsible Pill */}
          <div className="sm:hidden">
            <button
              type="button"
              onClick={() => setIsTracksWidgetExpanded(!isTracksWidgetExpanded)}
              className="px-2.5 py-1.5 rounded-xl bg-white/95 dark:bg-[#1E1B18]/95 backdrop-blur-md border border-[#10B981]/30 shadow-md text-[11px] font-bold text-[#10B981] flex items-center gap-1.5 cursor-pointer"
            >
              <span>🚴</span>
              <span>{activeTrip.tracks.length} {activeTrip.tracks.length === 1 ? 'Route' : 'Routen'}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${isTracksWidgetExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <div className={`${isTracksWidgetExpanded ? 'flex' : 'hidden sm:flex'} bg-white/95 dark:bg-[#1E1B18]/95 backdrop-blur-md px-3 py-2 rounded-2xl border border-[#10B981]/30 shadow-xl flex-col gap-1.5 text-xs w-full mt-1 sm:mt-0`}>
            <div className="flex items-center justify-between gap-2 border-b border-[#E5E1D8] dark:border-[#38322C] pb-1">
              <span className="font-bold text-[#10B981] flex items-center gap-1 text-[11px] uppercase tracking-wider">
                <span>🚴</span> {activeTrip.tracks.length} {activeTrip.tracks.length === 1 ? 'Route' : 'Routen'}
              </span>
              {handleOpenTrackModal && (
                <button
                  type="button"
                  onClick={handleOpenTrackModal}
                  className="text-[10px] font-bold text-[#8A9A5B] hover:text-[#78884E] underline cursor-pointer"
                  title="Weiteren Track importieren"
                >
                  + Neu
                </button>
              )}
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
              {activeTrip.tracks.map((track) => (
                <div key={track.id} className="flex items-center justify-between gap-1.5 text-[#4E3B31] dark:text-[#EDE8DF] py-0.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[11px]" title={track.title}>
                      {track.title}
                    </p>
                    <p className="text-[10px] text-[#8C8273]">
                      {track.summary.totalDistanceKm} km · +{track.summary.elevationGainM}m
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTrackProbe({
                          track,
                          pointIndex: Math.floor(track.points.length / 2),
                        });
                        if (mapRef.current && track.points && track.points.length > 0) {
                          const midPt = track.points[Math.floor(track.points.length / 2)];
                          mapRef.current.flyTo([midPt.lat, midPt.lng], 14, { duration: 0.6 });
                        }
                      }}
                      className="px-1.5 py-0.5 rounded bg-[#E2725B]/15 hover:bg-[#E2725B]/25 text-[#E2725B] font-bold text-[10px] transition cursor-pointer flex items-center gap-0.5"
                      title="Stopps & Reiseeinträge entlang der Route planen"
                    >
                      <Milestone className="w-2.5 h-2.5" />
                      <span>Stopps</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!mapRef.current || !track.points || track.points.length === 0) return;
                        const b = L.latLngBounds(track.points.map((p) => [p.lat, p.lng]));
                        mapRef.current.fitBounds(b, { padding: [60, 60], maxZoom: 15 });
                      }}
                      className="px-1.5 py-0.5 rounded bg-[#10B981]/15 hover:bg-[#10B981]/25 text-[#10B981] font-bold text-[10px] transition cursor-pointer"
                      title="Auf diese Route zoomen"
                    >
                      Zoom
                    </button>
                    {onRemoveTrackFromTrip && (
                      <button
                        type="button"
                        onClick={() => onRemoveTrackFromTrip(track.id)}
                        className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                        title="Route von Karte entfernen"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Selected Search Place Quick Action Card */}
      {selectedPlacePreview && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl border border-[#E5E1D8] shadow-2xl flex items-center gap-3 max-w-sm w-[90%] sm:w-auto animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="p-2 rounded-xl bg-[#E2725B]/15 text-[#E2725B] shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[#4E3B31] truncate">{selectedPlacePreview.name.split(',')[0]}</p>
            <p className="text-[10px] text-[#8C8273] truncate">{selectedPlacePreview.name}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              onAddEntryAtCoordinates(
                { lat: selectedPlacePreview.lat, lng: selectedPlacePreview.lng },
                selectedPlacePreview.name
              );
              setSelectedPlacePreview(null);
            }}
            className="px-3 py-1.5 rounded-xl bg-[#8A9A5B] hover:bg-[#7D8C68] text-white font-bold text-xs flex items-center gap-1 shrink-0 shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Stopp erstellen</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedPlacePreview(null)}
            className="p-1 rounded-lg text-[#8C8273] hover:text-[#4E3B31] transition"
            title="Schließen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bottom Hint Banner */}
      <div className="absolute bottom-4 left-4 z-20 pointer-events-none hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FDFBF7]/90 dark:bg-[#1E1B18]/90 backdrop-blur-md border border-[#E5E1D8] dark:border-[#38322C] text-[11px] text-[#6B5E55] dark:text-[#C4B9AA] shadow-md">
        <Sparkles className="w-3.5 h-3.5 text-[#E2725B]" />
        <span>Tipp: Klicke auf eine beliebige Stelle der Karte, um eine Notiz mit Foto anzuheften!</span>
      </div>

      {/* Mobile-first Waypoint Bottom Sheet */}
      <MapWaypointBottomSheet
        entry={selectedWaypointForSheet}
        activeTrip={activeTrip}
        currentUser={currentUser || (activeTrip?.collaborators[0] ?? CURRENT_USER)}
        indexInRoute={
          selectedWaypointForSheet
            ? sortJournalEntries(entries, sortMode || 'date_asc').findIndex(
                (e) => e.id === selectedWaypointForSheet.id
              ) + 1
            : 1
        }
        onClose={() => setSelectedWaypointForSheet(null)}
        onSelectEntry={(entry) => {
          setSelectedWaypointForSheet(null);
          onSelectEntry(entry);
        }}
        onEditEntry={(entry) => {
          setSelectedWaypointForSheet(null);
          if (onEditEntry) onEditEntry(entry);
        }}
        onDeleteEntry={(entry) => {
          setSelectedWaypointForSheet(null);
          setEntryToDelete(entry);
        }}
        onFocusCoordinates={(coords) => {
          if (mapRef.current) {
            mapRef.current.flyTo([coords.lat, coords.lng], 14, { duration: 0.8 });
          }
        }}
      />

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!entryToDelete}
        onClose={() => setEntryToDelete(null)}
        itemName={entryToDelete?.title}
        title="Reiseeintrag löschen?"
        description={`Möchtest du die Erinnerung an "${entryToDelete?.title || 'diesen Ort'}" wirklich unwiderruflich von der Weltkarte und aus deiner Chronik entfernen?`}
        confirmText="Eintrag löschen"
        onConfirm={() => {
          if (entryToDelete && onDeleteEntry) {
            onDeleteEntry(entryToDelete.id);
            setEntryToDelete(null);
          }
        }}
      />

      {/* Reorder Entries Modal */}
      <ReorderEntriesModal
        isOpen={isReorderModalOpen}
        onClose={() => setIsReorderModalOpen(false)}
        entries={sortJournalEntries(entries, sortMode || 'date_asc')}
        activeTrip={activeTrip}
        onSaveOrder={(reordered) => {
          if (onReorderEntries) {
            onReorderEntries(reordered);
          }
        }}
      />

      {/* Interactive Track Point Inspector & Stop Planner Sheet (Mobile & Desktop) */}
      {activeTrackProbe && (
        <TrackPointInspectorSheet
          track={activeTrackProbe.track}
          pointIndex={activeTrackProbe.pointIndex}
          onSeekToIndex={(idx) => {
            setActiveTrackProbe((prev) => (prev ? { ...prev, pointIndex: idx } : null));
          }}
          onClose={() => {
            setActiveTrackProbe(null);
          }}
          onCenterOnPoint={(pt) => {
            if (mapRef.current) {
              mapRef.current.flyTo([pt.lat, pt.lng], Math.max(14, mapRef.current.getZoom()), { duration: 0.5 });
            }
          }}
          onAddEntry={async (point, track, pointIndex, locationName) => {
            const coords: Coordinates = { lat: point.lat, lng: point.lng };
            const distKm = point.distance !== undefined
              ? point.distance
              : Number(((pointIndex / Math.max(1, (track.points?.length || 1) - 1)) * track.summary.totalDistanceKm).toFixed(1));

            const resolvedAddress = locationName || (await syncEngine.reverseGeocode(point.lat, point.lng));
            const shortAddress = resolvedAddress ? resolvedAddress.split(',')[0].trim() : `km ${distKm.toFixed(1)}`;

            const title = `Stopp bei km ${distKm.toFixed(1)} · ${shortAddress}`;
            const altStr = point.altitude ? `${Math.round(point.altitude)} m Höhe` : '';
            const slopeStr = point.slope !== undefined ? `, ${point.slope > 0 ? '+' : ''}${point.slope}% Steigung` : '';
            const speedStr = point.speed !== undefined ? `, ${point.speed.toFixed(1)} km/h` : '';
            const note = `📍 Streckenpunkt auf der Route "${track.title}" bei km ${distKm.toFixed(1)}${altStr ? ` (${altStr}${slopeStr}${speedStr})` : ''}`;
            const date = point.timestamp ? point.timestamp.split('T')[0] : undefined;

            onAddEntryAtCoordinates(coords, resolvedAddress, {
              title,
              note,
              date,
              category: 'activity',
            });
          }}
          theme={theme === 'dark' ? 'dark' : 'light'}
        />
      )}
    </div>
  );
};
