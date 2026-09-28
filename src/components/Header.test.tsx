// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Header } from './Header';
import { Trip, Collaborator, SyncState } from '../types';

afterEach(() => {
  cleanup();
});

const MOCK_TRIPS: Trip[] = [
  {
    id: 'trip-1',
    title: 'Alpenüberquerung 2026',
    description: 'Wandern in den Alpen',
    startDate: '2026-08-01',
    endDate: '2026-08-10',
    coverImage: 'https://img.com/1',
    passwordProtected: false,
    collaborators: [],
    shareToken: 'wander-alps-892f',
    countryCodes: ['DE', 'AT', 'IT'],
    isPublic: true,
    defaultCoordinates: [47.5, 11.5],
    defaultZoom: 7,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
  },
  {
    id: 'trip-2',
    title: 'Japan Rundreise',
    description: 'Von Tokio nach Kyoto',
    startDate: '2026-09-01',
    endDate: '2026-09-15',
    coverImage: 'https://img.com/2',
    passwordProtected: true,
    collaborators: [],
    shareToken: 'wander-japan-441a',
    countryCodes: ['JP'],
    isPublic: false,
    defaultCoordinates: [35.68, 139.76],
    defaultZoom: 6,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
];

const MOCK_USER: Collaborator = {
  id: 'user-1',
  name: 'Max Mustermann',
  avatar: 'https://avatar.url',
  color: '#8A9A5B',
  role: 'owner',
};

const MOCK_SYNC: SyncState = {
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncedAt: new Date().toISOString(),
};

describe('Header Component', () => {
  it('renders trip title and version tag v1.9.8', () => {
    const onOpenChangelog = vi.fn();
    render(
      <Header
        trips={MOCK_TRIPS}
        activeTrip={MOCK_TRIPS[0]}
        onSelectTrip={vi.fn()}
        onOpenTripModal={vi.fn()}
        viewMode="map"
        onChangeViewMode={vi.fn()}
        syncState={MOCK_SYNC}
        onManualSync={vi.fn()}
        currentUser={MOCK_USER}
        onChangeCurrentUser={vi.fn()}
        onOpenAddEntry={vi.fn()}
        authUser={null}
        onOpenAuthModal={vi.fn()}
        onOpenAccountModal={vi.fn()}
        onSignOut={vi.fn()}
        onOpenChangelog={onOpenChangelog}
        theme="light"
        onToggleTheme={vi.fn()}
      />
    );

    const switcherBtn = screen.getByTestId('trip-switcher-button');
    expect(switcherBtn).toBeDefined();
    expect(switcherBtn.textContent).toContain('Alpenüberquerung 2026');
    expect(screen.getByText('v1.9.8')).toBeDefined();

    fireEvent.click(screen.getByText('v1.9.8'));
    expect(onOpenChangelog).toHaveBeenCalledTimes(1);
  });

  it('triggers onCopyTripLink when clicking the quick share button', () => {
    const onCopyTripLink = vi.fn();
    render(
      <Header
        trips={MOCK_TRIPS}
        activeTrip={MOCK_TRIPS[0]}
        onSelectTrip={vi.fn()}
        onOpenTripModal={vi.fn()}
        viewMode="map"
        onChangeViewMode={vi.fn()}
        syncState={MOCK_SYNC}
        onManualSync={vi.fn()}
        currentUser={MOCK_USER}
        onChangeCurrentUser={vi.fn()}
        onOpenAddEntry={vi.fn()}
        authUser={null}
        onOpenAuthModal={vi.fn()}
        onOpenAccountModal={vi.fn()}
        onSignOut={vi.fn()}
        onCopyTripLink={onCopyTripLink}
        theme="light"
        onToggleTheme={vi.fn()}
      />
    );

    const shareBtn = screen.getByTestId('trip-share-quick-btn');
    expect(shareBtn).toBeDefined();

    fireEvent.click(shareBtn);
    expect(onCopyTripLink).toHaveBeenCalledWith(MOCK_TRIPS[0]);
  });

  it('opens trip menu and allows selecting a different trip', () => {
    const onSelectTrip = vi.fn();
    render(
      <Header
        trips={MOCK_TRIPS}
        activeTrip={MOCK_TRIPS[0]}
        onSelectTrip={onSelectTrip}
        onOpenTripModal={vi.fn()}
        viewMode="map"
        onChangeViewMode={vi.fn()}
        syncState={MOCK_SYNC}
        onManualSync={vi.fn()}
        currentUser={MOCK_USER}
        onChangeCurrentUser={vi.fn()}
        onOpenAddEntry={vi.fn()}
        authUser={null}
        onOpenAuthModal={vi.fn()}
        onOpenAccountModal={vi.fn()}
        onSignOut={vi.fn()}
        theme="light"
        onToggleTheme={vi.fn()}
      />
    );

    // Click the trip selector button
    const tripDropdownBtn = screen.getByTestId('trip-switcher-button');
    fireEvent.click(tripDropdownBtn);

    // The dropdown should now show "Deine Reisen" and all trips
    expect(screen.getByText('Deine Reisen')).toBeDefined();
    expect(screen.getByText('Japan Rundreise')).toBeDefined();

    // Click the other trip
    fireEvent.click(screen.getByText('Japan Rundreise'));
    expect(onSelectTrip).toHaveBeenCalledWith('trip-2');
  });
});
