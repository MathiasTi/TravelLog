// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MobileBottomNav } from './MobileBottomNav';
import { Trip, Collaborator } from '../../types';

afterEach(() => {
  cleanup();
});

const mockTrip: Trip = {
  id: 'trip-1',
  title: 'Alpen Tour 2026',
  description: 'Wanderurlaub in den Bergen',
  startDate: '2026-08-01',
  endDate: '2026-08-10',
  coverImage: 'https://images.unsplash.com/photo-alps',
  countryCodes: ['DE', 'AT'],
  passwordProtected: false,
  isPublic: false,
  shareToken: 'tok123',
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
  defaultCoordinates: [47.5, 11.5],
  defaultZoom: 8,
  collaborators: [
    { id: 'user-1', name: 'Max', avatar: '', color: '#E2725B', role: 'owner' },
    { id: 'user-2', name: 'Anna', avatar: '', color: '#8A9A5B', role: 'editor' },
    { id: 'user-3', name: 'Lukas', avatar: '', color: '#D4A373', role: 'viewer' },
  ],
};

const ownerUser: Collaborator = { id: 'user-1', name: 'Max', avatar: '', color: '#E2725B', role: 'owner' };
const viewerUser: Collaborator = { id: 'user-3', name: 'Lukas', avatar: '', color: '#D4A373', role: 'viewer' };

describe('MobileBottomNav Component', () => {
  it('renders all four primary view tabs and quick-add FAB', () => {
    const handleChangeMode = vi.fn();
    const handleAddNew = vi.fn();

    render(
      <MobileBottomNav
        viewMode="map"
        onChangeViewMode={handleChangeMode}
        onAddNewEntry={handleAddNew}
        activeTrip={mockTrip}
        currentUser={ownerUser}
        entriesCount={5}
        mediaCount={12}
      />
    );

    expect(screen.getByText('Karte')).toBeDefined();
    expect(screen.getByText('Chronik')).toBeDefined();
    expect(screen.getByText('Galerie')).toBeDefined();
    expect(screen.getByText('Stats')).toBeDefined();
    expect(screen.getByLabelText('Neuen Reiseeintrag hinzufügen')).toBeDefined();
  });

  it('triggers onChangeViewMode when tabs are clicked', () => {
    const handleChangeMode = vi.fn();
    const handleAddNew = vi.fn();

    render(
      <MobileBottomNav
        viewMode="map"
        onChangeViewMode={handleChangeMode}
        onAddNewEntry={handleAddNew}
        activeTrip={mockTrip}
        currentUser={ownerUser}
      />
    );

    fireEvent.click(screen.getByText('Chronik'));
    expect(handleChangeMode).toHaveBeenCalledWith('timeline');

    fireEvent.click(screen.getByText('Galerie'));
    expect(handleChangeMode).toHaveBeenCalledWith('gallery');

    fireEvent.click(screen.getByText('Stats'));
    expect(handleChangeMode).toHaveBeenCalledWith('stats');
  });

  it('allows owner/editor to click the center add FAB', () => {
    const handleAddNew = vi.fn();

    render(
      <MobileBottomNav
        viewMode="map"
        onChangeViewMode={vi.fn()}
        onAddNewEntry={handleAddNew}
        activeTrip={mockTrip}
        currentUser={ownerUser}
      />
    );

    const addBtn = screen.getByLabelText('Neuen Reiseeintrag hinzufügen');
    expect(addBtn.hasAttribute('disabled')).toBe(false);
    fireEvent.click(addBtn);
    expect(handleAddNew).toHaveBeenCalled();
  });

  it('disables add FAB for read-only viewer users', () => {
    const handleAddNew = vi.fn();

    render(
      <MobileBottomNav
        viewMode="map"
        onChangeViewMode={vi.fn()}
        onAddNewEntry={handleAddNew}
        activeTrip={mockTrip}
        currentUser={viewerUser}
      />
    );

    const addBtn = screen.getByLabelText('Neuen Reiseeintrag hinzufügen');
    expect(addBtn.hasAttribute('disabled')).toBe(true);
    fireEvent.click(addBtn);
    expect(handleAddNew).not.toHaveBeenCalled();
  });

  it('displays correct badge counters for entries and media', () => {
    render(
      <MobileBottomNav
        viewMode="map"
        onChangeViewMode={vi.fn()}
        onAddNewEntry={vi.fn()}
        activeTrip={mockTrip}
        currentUser={ownerUser}
        entriesCount={8}
        mediaCount={24}
      />
    );

    expect(screen.getByText('8')).toBeDefined();
    expect(screen.getByText('24')).toBeDefined();
  });
});
