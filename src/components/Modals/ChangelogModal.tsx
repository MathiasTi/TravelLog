import React from 'react';
import { X, Sparkles, Tag, GitCommit, ShieldCheck, Users, ArrowUpDown, Smartphone, Lock, CheckCircle2, Moon, Sun, Palette, Compass, Layers, Mountain, Play, Maximize2, Film, Camera, CloudSun, History, Droplets, Thermometer, Video, Share2, Link as LinkIcon } from 'lucide-react';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ReleaseEntry {
  version: string;
  date: string;
  badge?: string;
  title: string;
  highlights: { icon: any; title: string; desc: string }[];
}

const RELEASES: ReleaseEntry[] = [
  {
    version: 'v2.0.0',
    date: '2026-09-02',
    badge: 'Aktuell',
    title: 'Vollständiges ZIP-Backup inklusive aller Fotos & reine Foto-Fokussierung',
    highlights: [
      {
        icon: Sparkles,
        title: 'ZIP-Datensicherung inklusive aller Originalfotos',
        desc: 'Lokale Backups werden als vollständige ZIP-Archive mit JSON-Datenbank, GPX-Tracks und allen hochauflösenden Fotos exportiert und importiert.',
      },
      {
        icon: Camera,
        title: 'Fokussierte Medienverwaltung & Galerie',
        desc: 'Vollständige Konzentration auf Fotos mit EXIF-Metadaten, Geo-Tagging, Vollbild-Diashows und Fotobuch-Generierung ohne überladene Videofunktionen.',
      },
      {
        icon: ShieldCheck,
        title: 'Sicherheit, Firestore-Regeln & Testsuite-Verifikation',
        desc: 'Alle 137 Systemtests, Linter-Prüfungen und Firestore-Sicherheitsregeln wurden validiert und erfolgreich bereitgestellt.',
      },
    ],
  },
  {
    version: 'v1.9.8',
    date: '2026-08-27',
    title: 'Mobile-Optimierung, Schlankere Oberfläche & Schnappschuss-Kamera',
    highlights: [
      {
        icon: Camera,
        title: 'Direkter Smartphone-Kamera-Auslöser',
        desc: 'Beim Hinzufügen von Reiseeinträgen kann auf dem Smartphone mit einem Tap direkt die Handykamera geöffnet werden, um Schnappschüsse sofort festzuhalten.',
      },
      {
        icon: Smartphone,
        title: 'Entrümpelte Mobilansicht & maximale Kartenfläche',
        desc: 'Auf Mobilgeräten wurden selten genutzte redundante Schaltflächen (wie QR-Sync auf dem Handy selbst oder überfüllte Header-Buttons) entfernt oder eingeklappt. Kategoriefilter und Routenanzeigen auf der Karte lassen sich kompakt ein- und ausklappen.',
      },
      {
        icon: Tag,
        title: 'Changelog & Profil-Zugriff im mobilen Nutzermenü',
        desc: 'Das Changelog und Versionsdetails sind nun direkt im Nutzer-Dropdown auf mobilen Geräten jederzeit bequem erreichbar.',
      },
    ],
  },
  {
    version: 'v1.9.7',
    date: '2026-08-27',
    title: 'Direkte Reise-Verlinkung per URL (?trip=...), Auto-Sync & 1-Klick Link-Freigabe',
    highlights: [
      {
        icon: Share2,
        title: 'Reise-ID & Share-Token in der Browser-URL',
        desc: 'Die aktuell gewählte Reise wird automatisch in der Browser-URL (?trip=...) abgebildet. Beim Verschicken oder Öffnen des Links wird direkt die richtige Reise geladen.',
      },
      {
        icon: LinkIcon,
        title: '1-Klick Schnell-Kopieren im Header & Trip-Menü',
        desc: 'Über den Schnell-Teilen-Button im Header sowie im Reise-Dropdown kann der Direktlink zu jeder Reise mit einem Klick in die Zwischenablage kopiert werden.',
      },
      {
        icon: Compass,
        title: 'Nahtlose Browser-Navigation (Vor/Zurück)',
        desc: 'Browser-Verlaufsnavigation wechselt automatisch zwischen den aufgerufenen Reisen inklusive Berücksichtigung von Passwörtern und Berechtigungen.',
      },
    ],
  },
  {
    version: 'v1.9.6',
    date: '2026-08-27',
    title: 'OpenStreetMap (OSM) Karten-Integration & Provider-Standardisierung',
    highlights: [
      {
        icon: Compass,
        title: 'OpenStreetMap als Standard-Kartenprovider',
        desc: 'Vollständige Umstellung der Haupt- und Ortspicker-Karten auf OpenStreetMap (OSM) Standard-Tiles ohne externe Abhängigkeiten.',
      },
      {
        icon: Layers,
        title: 'Erweiterte OSM-Kartenstile im Ebenen-Umschalter',
        desc: 'Flexible Auswahl zwischen OpenStreetMap Standard, OSM Regional/DE, OpenTopoMap (Topographie) sowie CARTO Voyager, Dunkel- und Hell-Modus.',
      },
      {
        icon: ShieldCheck,
        title: 'Datenschutz & Open-Source Konformität',
        desc: 'Vollständige Einhaltung von OpenStreetMap Lizenz- und Copyright-Attributionen für transparente, offene Kartendaten.',
      },
    ],
  },
  {
    version: 'v1.9.5',
    date: '2026-08-27',
    title: 'Code-Verschlankung, Sub-Komponenten-Modularisierung & IndexedDB-Speicherarchitektur',
    highlights: [
      {
        icon: Layers,
        title: 'Modularisierung des Reiseeintrags-Modals',
        desc: 'Aufspaltung des monolithischen EntryModals in spezialisierte, wiederverwendbare Komponenten (MediaUploadSection, WeatherSection, LocationSection und VideoPreviewModal).',
      },
      {
        icon: ShieldCheck,
        title: 'IndexedDB Offline- & Media-Storage Service',
        desc: 'Integration einer robusten IndexedDB-Caching-Schicht für hochauflösende Medien, Offline-Warteschlangen und zuverlässiges lokales Datenmanagement ohne LocalStorage-Quotenlimit.',
      },
      {
        icon: Sparkles,
        title: 'Optimierte Renderzyklen & erweiterte Testabdeckung',
        desc: 'Schnellere Modal-Öffnungszeiten, saubere Trennung von Geschäftslogik und UI-Rendering sowie 100% isolierte Unit-Tests für alle neuen Sub-Module.',
      },
    ],
  },
  {
    version: 'v1.9.4',
    date: '2026-08-27',
    title: 'Videoclip-Uploads, automatische Thumbnail-Generierung & Video-Wiedergabe',
    highlights: [
      {
        icon: Video,
        title: 'Upload von kurzen Videoclips (.mp4, .mov, .webm, .m4v)',
        desc: 'Einfaches Hinzufügen von Reisevideos direkt im Tagebuch-Modal mit automatischer Dateityp-Erkennung, Sicherheitsvalidierung und Größenprüfung.',
      },
      {
        icon: Film,
        title: 'Automatische Thumbnail- & Metadaten-Extraktion',
        desc: 'Browser-seitige Generierung von Video-Vorschaubildern (Canvas-Snapshot), Bestimmung der exakten Videodauer in Minuten:Sekunden und Dimensionen.',
      },
      {
        icon: Play,
        title: 'Videovorschau & Fullscreen-Wiedergabe',
        desc: 'Interaktive Video-Vorschau mit Abspiel-Dialog im Tagebuchmodal sowie nahtlose Einbindung mit Dauer-Badge in Timeline, Galerie und Vollbild-Diashow.',
      },
    ],
  },
  {
    version: 'v1.9.3',
    date: '2026-08-26',
    title: 'Automatische historische Wetterdaten-Integration (Open-Meteo) im Tagebuch-Modal',
    highlights: [
      {
        icon: CloudSun,
        title: 'Automatische historische Wetterdaten per Open-Meteo API',
        desc: 'Automatischer Abruf der genauen historischen Wetterdaten (Temperatur, Min/Max-Bereich, Regenmenge, Wind & Wetterlage) basierend auf Standort-Koordinaten und Reisedatum.',
      },
      {
        icon: History,
        title: 'Reaktive Wetteraktualisierung bei Orts- & Datumswechsel',
        desc: 'Sofortige Aktualisierung beim Auswählen von Orten auf der Karte, Ändern des Datums, manuellem Koordinateneintrag oder EXIF-GPS-Uploads.',
      },
      {
        icon: Thermometer,
        title: 'Wetterkarte & manuelle Überschreibungsoption',
        desc: 'Übersichtliche Wetter-Vorschaukarte im Bearbeitungsmodal mit 1-Klick-Aktualisierung und flexibler manueller Anpassung von Temperatur und Wettersymbol.',
      },
    ],
  },
  {
    version: 'v1.9.2',
    date: '2026-08-25',
    title: 'Interaktive Full-Screen Slideshow & Mediathek-Upgrade in der Galerie',
    highlights: [
      {
        icon: Play,
        title: 'Kino-Slideshow mit Autoplay & Fortschrittsbalken',
        desc: 'Vollbild-Diashow mit konfigurierbarem Wechselintervall (3s–12s), weicher Fortschrittsanzeige und Tastatursteuerung (Leertaste für Play/Pause).',
      },
      {
        icon: Maximize2,
        title: 'Multi-Level Zoom, Pan & Touch-Gesten',
        desc: 'Detailgenaues Zoomen bis 300%, Bildausschnitt-Verschiebung (Pan), Doppelklick-Zoom sowie intuitive Wischgesten auf Mobilgeräten.',
      },
      {
        icon: Film,
        title: 'Interaktive Filmstreifen-Leiste & Live-Zentrierung',
        desc: 'Horizontale Bildleiste mit automatischer Zentrierung der aktiven Aufnahme und 1-Klick-Sprung zu jedem Reisefoto.',
      },
      {
        icon: Sparkles,
        title: 'Reisekontext, GPS/EXIF-Daten & Kategorie-Filter',
        desc: 'Umschaltbare Informationseinblendung mit Reisedatum, Ort, EXIF-Kameradaten, Direktlink zum Tagebucheintrag und dynamischen Kategorie-Filtern.',
      },
    ],
  },
  {
    version: 'v1.9.1',
    date: '2026-08-21',
    title: 'Interaktives Recharts Höhenprofil mit dynamischer Steigungs-Hervorhebung',
    highlights: [
      {
        icon: Mountain,
        title: 'Interaktives Recharts ElevationChart',
        desc: 'Reaktionsschnelles SVG-Höhenprofil im Tagebuch-Detaildialog mit fließender Cursor-Abtastung und Höhenmeter-Statistiken.',
      },
      {
        icon: Compass,
        title: 'Echtzeit-Steigungserkennung bei Mouseover',
        desc: 'Farbkodierte Indikatoren und Prozentangaben heben Flachstücke, mittlere Anstiege, steile Rampen und extreme Steilhänge dynamisch hervor.',
      },
      {
        icon: Sparkles,
        title: 'Sensor- & Telemetrie-Einblendung',
        desc: 'Live-Einblendung von Geschwindigkeit, Herzfrequenz, Watt- und Trittfrequenzwerten direkt am Cursorpunkt.',
      },
    ],
  },
  {
    version: 'v1.9.0',
    date: '2026-08-21',
    title: 'Direkter GPS-Track Import (.GPX & .FIT) mit Höhenprofil & Karteneinbindung',
    highlights: [
      {
        icon: Compass,
        title: 'Universeller .GPX & .FIT Datei-Import',
        desc: 'Direktes Einlesen beliebiger GPS-Tracks von Garmin, Strava, Komoot, Wahoo, Apple Watch oder Outdooractive ohne externe Umwege.',
      },
      {
        icon: Mountain,
        title: 'Interaktives Höhenprofil mit Telemetriedaten',
        desc: 'Detaillierte Auswertung von Höhenmetern, Anstiegen, Distanz, Durchschnitts- und Höchstgeschwindigkeit, Herzfrequenz und Wattwerten.',
      },
      {
        icon: Layers,
        title: 'Ein-Klick Einbindung als Tagebucheintrag oder Kartenroute',
        desc: 'Strecken können direkt als reichhaltiger Tagebuchstopp angelegt oder als sichtbare Route dauerhaft an die Reisekarte angeheftet werden.',
      },
    ],
  },
  {
    version: 'v1.8.0',
    date: '2026-08-21',
    title: 'Echte 3D-Topographie & 2D/3D-Kartenansicht-Umschaltung für Radtouren',
    highlights: [
      {
        icon: Mountain,
        title: 'Echte 3D-Topographie mit globalem DEM-Höhennetz',
        desc: 'Reale Alpenpässe, Berge, Täler und Schluchten werden plastisch in 3D gerendert mit anpassbarer Höhenüberhöhung (1.0x bis 3.0x).',
      },
      {
        icon: Layers,
        title: '2D & 3D Kartenansichts-Umschalter',
        desc: 'Flexibler Umschalter in der Menüleiste und Steuerungs-Schublade zwischen klassischer 2D-Draufsicht und plastischem 3D-Geländerelief.',
      },
      {
        icon: Compass,
        title: '3D Relive Kamera-Verfolgung & Blickwinkel-Presets',
        desc: 'Dynamische 3D Drohnen-Kamerafahrt (Chase-Cam), Bergpanorama-Weitwinkel, First-Person Lenker-Perspektive oder freie 360° Orbit-Erkundung.',
      },
      {
        icon: Layers,
        title: 'Vier 3D Karten-Topologien & Satellitengelände',
        desc: 'Wechsel zwischen fotorealistischem 3D Satellitengelände (Relive Original), 3D Topo-Höhenlinien (OpenTopoMap), Natur-Relief und Cyber Night Mode.',
      },
    ],
  },
  {
    version: 'v1.7.0',
    date: '2026-08-21',
    title: '.FIT Datei-Upload & Animierte Relive 3D Radtouren-Wiedergabe',
    highlights: [
      {
        icon: Compass,
        title: '.FIT Datei-Parser für Garmin, Wahoo, Strava & Radcomputer',
        desc: 'Direktes Einlesen binärer FIT-Aktivitäten im Browser mit GPS-Tracks, Höhenprofil, Tempo, Trittfrequenz, Watt und Herzfrequenz.',
      },
      {
        icon: Sparkles,
        title: 'Animierter Relive 3D Tour-Player',
        desc: 'Interaktive 3D-Kameraverfolgung mit dynamischem Neigungswinkel, farbiger Steigungs-Strecke, Telemetrie-Cockpit und automatischen Pässen/Sprint-Highlights.',
      },
      {
        icon: Layers,
        title: 'Interaktives Höhenprofil & Ein-Klick Reisespeicherung',
        desc: 'SVG-Höhenprofil mit Scrubbing/Seeking und Speicherung als reichhaltiger Reisetagebucheintrag inklusive aller Leistungsdaten.',
      },
    ],
  },
  {
    version: 'v1.6.0',
    date: '2026-08-21',
    title: 'Mobile First: Ergonomische Bottom Navigation & Wischbares Stopp-Bottom-Sheet',
    highlights: [
      {
        icon: Smartphone,
        title: 'Ergonomische Mobile Tab Bar (Bottom Nav)',
        desc: 'Feste, iOS/Android-sichere Daumenzonen-Navigationsleiste für Karte, Chronik, Galerie, Statistiken und zentriertem Schnellzugriff-FAB.',
      },
      {
        icon: Compass,
        title: 'Wischbares Stopp-Bottom-Sheet',
        desc: 'Interaktives Bottom-Sheet für Kartenstopps mit Wischgesten (Minimieren/Maximieren), Fotogalerie, Wetter, Notizvorschau und Aktionen.',
      },
      {
        icon: Layers,
        title: 'Aufgeräumter mobiler Header & Safe-Area Insets',
        desc: 'Optimierte Header-Höhe und native Berücksichtigung von iOS Home-Balken und Android Gestennavigation.',
      },
    ],
  },
  {
    version: 'v1.5.0',
    date: '2026-08-21',
    title: 'Globaler Dark Mode (Nachtansicht) für augenschonendes Bearbeiten',
    highlights: [
      {
        icon: Moon,
        title: 'Augenschonendes Nacht-Theme',
        desc: 'Warme, harmonische Dunkeltöne (Anthrazit & Naturfarben) ohne grelles Blenden bei nächtlicher Reiseplanung.',
      },
      {
        icon: Palette,
        title: 'Dunkle Karten- & Popup-Kacheln',
        desc: 'Automatische Umschaltung auf CARTO Dark Matter Kacheln und abgedunkelte Leaflet-Detailkarten.',
      },
      {
        icon: Sun,
        title: 'Ein-Klick Header-Umschaltung & Persistenz',
        desc: 'Schneller Theme-Toggle im Header und Benutzermenü mit automatischer Speicherung in den lokalen Einstellungen.',
      },
    ],
  },
  {
    version: 'v1.4.0',
    date: '2026-08-21',
    title: 'Kollaborative Rollenverwaltung (Inhaber, Editor & Nur Lesen)',
    highlights: [
      {
        icon: Users,
        title: 'Rollen-Zuweisung im TripModal',
        desc: 'Reiseinhaber können Mitreisenden feingranulare Rollen wie "Bearbeiter (Editor)" oder "Nur Lesen (Read-Only)" zuweisen.',
      },
      {
        icon: ShieldCheck,
        title: 'Berechtigungs-Schutz (RBAC)',
        desc: 'Rechte werden systemweit durchgesetzt: Nur-Lese-Gäste können die Reiseroute erkunden, während Schreiboperationen geschützt sind.',
      },
      {
        icon: Tag,
        title: 'Rollen-Status & Abzeichen',
        desc: 'Klare visuelle Indikatoren in Header, Reisedialog und Chronik zeigen die aktuelle Berechtigungsstufe jedes Mitreisenden an.',
      },
    ],
  },
  {
    version: 'v1.3.0',
    date: '2026-08-20',
    title: 'Individuelle Stopp-Reihenfolge & Routenanpassung',
    highlights: [
      {
        icon: ArrowUpDown,
        title: 'Manuelle Stopp-Sortierung',
        desc: 'Schnelles Verschieben von Stopps per Hoch-/Runter-Tasten oder im interaktiven Reihungs-Dialog.',
      },
      {
        icon: CheckCircle2,
        title: 'Synchronisierte Weltkarten-Route',
        desc: 'Stopp-Nummerierung und berechnete Routenlinien auf Leaflet-Karten passen sich nahtlos an.',
      },
    ],
  },
  {
    version: 'v1.2.0',
    date: '2026-08-19',
    title: 'Offline-Synchronisierung & Passwortschutz',
    highlights: [
      {
        icon: Lock,
        title: 'Reiseschutz per PIN/Passwort',
        desc: 'Private Reisetagebücher mit Passwortschutz und Offline-Schlüsselentsperrung.',
      },
      {
        icon: GitCommit,
        title: 'Zwei-Wege-Sync Engine',
        desc: 'Offline-First Warteschlange mit automatischer Hintergrund-Synchronisation bei Reconnect.',
      },
    ],
  },
  {
    version: 'v1.1.0',
    date: '2026-08-18',
    title: 'Mobiles Medien-Studio & EXIF-Erkennung',
    highlights: [
      {
        icon: Smartphone,
        title: 'Direkt-Upload von iOS & Android',
        desc: 'Kamerazugriff, automatische EXIF-Datums- & Metadatenanalyse und Client-Bildkomprimierung.',
      },
    ],
  },
];

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#4E3B31]/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-[#FDFBF7] border border-[#E5E1D8] rounded-3xl shadow-2xl overflow-hidden my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E1D8] bg-[#F1EDE6]/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#8A9A5B]/15 border border-[#8A9A5B]/30 text-[#8A9A5B]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-[#4E3B31] font-serif">Versions-Changelog</h3>
                <span className="px-2 py-0.5 rounded-full bg-[#8A9A5B] text-white text-[10px] font-bold">
                  v1.4.0
                </span>
              </div>
              <p className="text-xs text-[#6B5E55]">Neuerungen, Updates & Feature-Historie</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#6B5E55] hover:text-[#4E3B31] hover:bg-[#E5E1D8] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {RELEASES.map((release, index) => (
            <div
              key={release.version}
              className={`p-4 rounded-2xl border transition ${
                index === 0
                  ? 'bg-white border-[#8A9A5B]/40 shadow-sm ring-1 ring-[#8A9A5B]/20'
                  : 'bg-white/60 border-[#E5E1D8]'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-[#F1EDE6]">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-[#4E3B31]">{release.version}</span>
                  {release.badge && (
                    <span className="px-2 py-0.5 rounded-full bg-[#8A9A5B]/15 text-[#8A9A5B] border border-[#8A9A5B]/30 text-[10px] font-bold">
                      {release.badge}
                    </span>
                  )}
                </div>
                <span className="text-xs text-[#8C8273]">{release.date}</span>
              </div>

              <h4 className="text-xs font-bold text-[#4E3B31] mb-2.5">{release.title}</h4>

              <div className="space-y-2">
                {release.highlights.map((h, i) => {
                  const Icon = h.icon;
                  return (
                    <div key={i} className="flex items-start gap-2.5 text-xs text-[#6B5E55]">
                      <div className="p-1 rounded-lg bg-[#F1EDE6] text-[#8A9A5B] shrink-0 mt-0.5">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <strong className="text-[#4E3B31] font-semibold">{h.title}: </strong>
                        <span>{h.desc}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-[#E5E1D8] bg-[#F1EDE6]/40">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#8A9A5B] hover:bg-[#7D8C68] text-white font-bold text-xs transition shadow-sm"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
