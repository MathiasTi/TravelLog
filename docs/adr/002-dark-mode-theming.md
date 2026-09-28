# ADR 002: Global Dark Mode Theming Architecture

## Status
Accepted (v1.5.0)

## Context
Travelers frequently organize itineraries, write diary entries, and review captured photos late at night in low-light environments (e.g. tents, trains, hotels). The default bright cream `#FDFBF7` theme causes eye strain under nocturnal conditions. 

Requirements:
1. Provide a global, instantaneous switch between Light and Dark themes.
2. Ensure warm, organic dark tones (soft dark slate/anthracite `#12161A`, `#1A2026`) that match WanderLog's nature/earthy brand identity rather than harsh high-contrast black or oversaturated cyan/purple gradients.
3. Automatically switch Leaflet map tiles (CARTO Dark Matter) and map popups to dark styling without disrupting user coordinate markers or route polylines.
4. Support automatic detection of user system preferences (`prefers-color-scheme: dark`) with explicit user overrides persisted across sessions in `localStorage`.
5. Seamlessly adapt all existing modals, dialogs, drawers, and form controls without breaking contrast accessibility (WCAG AA).

## Decision
We implemented a class-based CSS custom-property and selector engine combined with a dedicated React theme management layer:

1. **State & Persistence Layer (`src/utils/theme.ts`)**:
   - `getInitialTheme()` checks `localStorage` first (`wanderlog_theme_mode`), falling back to `window.matchMedia('(prefers-color-scheme: dark)')`.
   - `applyThemeToDOM(theme)` applies the `.dark` class to `document.documentElement` and sets `data-theme="dark"`.
   - Persists state immediately upon user toggles.

2. **Styling & CSS Architecture (`src/index.css`)**:
   - Global `html.dark` rules systematically remap light container backgrounds (`bg-[#FDFBF7]`, `bg-white`), borders (`border-[#E5E1D8]`), and dark brown text (`text-[#4E3B31]`) to warm dark palette tokens.
   - Smooth 200ms background and border color transitions (`transition: background-color 0.2s ease, border-color 0.2s ease`).
   - Leaflet popup wrappers and zoom controls are styled with dark glassmorphic cards and readable off-white typography.

3. **Map Integration (`src/components/Map/TravelMap.tsx` & `LocationPickerMap.tsx`)**:
   - Integrated CARTO Dark Matter tile layer (`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`).
   - Dynamically reloads tiles when the global theme changes, allowing manual override in the map layer picker if desired.

4. **UI Triggers**:
   - Quick one-click theme toggle in the main Header toolbar with animated Moon/Sun state icons.
   - Supplementary theme toggle inside the user profile dropdown.

## Consequences

### Positive
- Zero visual glare during night-time journal editing and itinerary planning.
- Preserves all marker colors, badges, and category tags with high contrast.
- Zero external heavyweight theme libraries required, keeping bundle size minimal.
- Comprehensive unit test coverage verifying storage, DOM manipulation, and toggle state transitions.

### Negative / Trade-offs
- Custom tile layers from third-party map providers must be accessible via HTTPS.
