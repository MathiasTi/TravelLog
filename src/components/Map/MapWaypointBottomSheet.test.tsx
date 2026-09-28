// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MapWaypointBottomSheet } from './MapWaypointBottomSheet';
import { JournalEntry, Trip, Collaborator } from '../../types';

afterEach(() => {
  cleanup();
});

const mockOwner: Collaborator = { id: 'u1', name: 'Max Mustermann', avatar: 'https://example.com/avatar.jpg', color: '#E2725B', role: 'owner' };
const mockViewer: Collaborator = { id: 'u3', name: 'Lukas Gast', avatar: 'https://example.com/avatar3.jpg', color: '#D4A373', role: 'viewer' };

const mockTrip: Trip = {
  id: 'trip-1',
  title: 'Alpen Tour',
  description: 'Wanderurlaub',
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
  collaborators: [mockOwner, mockViewer],
};

const mockEntry: JournalEntry = {
  id: 'entry-1',
  tripId: 'trip-1',
  title: 'Zugspitze Gipfelkreuz',
  locationName: 'Garmisch-Partenkirchen, Deutschland',
  coordinates: { lat: 47.421, lng: 10.985 },
  date: '2026-08-03T10:30:00Z',
  category: 'sight',
  note: 'Traumhafte Fernsicht über die gesamten Nordalpen.',
  author: mockOwner,
  media: [
    { id: 'm1', type: 'photo', url: 'https://images.unsplash.com/photo-zugspitze', timestamp: '2026-08-03T10:30:00Z' },
  ],
  weather: { label: 'Sonnig', temp: 14, icon: 'sun' },
  comments: [],
  likes: [],
  createdAt: '2026-08-03T10:30:00Z',
  updatedAt: '2026-08-03T10:30:00Z',
};

describe('MapWaypointBottomSheet Component', () => {
  it('renders waypoint details correctly', () => {
    render(
      <MapWaypointBottomSheet
        entry={mockEntry}
        activeTrip={mockTrip}
        currentUser={mockOwner}
        indexInRoute={3}
        onClose={vi.fn()}
        onSelectEntry={vi.fn()}
      />
    );

    expect(screen.getByText('Zugspitze Gipfelkreuz')).toBeDefined();
    expect(screen.getByText('Garmisch-Partenkirchen, Deutschland')).toBeDefined();
    expect(screen.getByText('Traumhafte Fernsicht über die gesamten Nordalpen.')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('14°C')).toBeDefined();
    expect(screen.getByText('Max Mustermann')).toBeDefined();
  });

  it('calls onSelectEntry when "Erinnerung öffnen" is clicked', () => {
    const handleSelect = vi.fn();
    render(
      <MapWaypointBottomSheet
        entry={mockEntry}
        activeTrip={mockTrip}
        currentUser={mockOwner}
        indexInRoute={1}
        onClose={vi.fn()}
        onSelectEntry={handleSelect}
      />
    );

    const openBtn = screen.getByRole('button', { name: /Erinnerung öffnen/i });
    fireEvent.click(openBtn);
    expect(handleSelect).toHaveBeenCalledWith(mockEntry);
  });

  it('calls onEditEntry and onDeleteEntry when triggered by authorized user', () => {
    const handleEdit = vi.fn();
    const handleDelete = vi.fn();

    render(
      <MapWaypointBottomSheet
        entry={mockEntry}
        activeTrip={mockTrip}
        currentUser={mockOwner}
        indexInRoute={1}
        onClose={vi.fn()}
        onSelectEntry={vi.fn()}
        onEditEntry={handleEdit}
        onDeleteEntry={handleDelete}
      />
    );

    const editBtn = screen.getByLabelText('Stopp bearbeiten');
    fireEvent.click(editBtn);
    expect(handleEdit).toHaveBeenCalledWith(mockEntry);

    const deleteBtn = screen.getByLabelText('Stopp löschen');
    fireEvent.click(deleteBtn);
    expect(handleDelete).toHaveBeenCalledWith(mockEntry);
  });

  it('hides edit and delete buttons for read-only viewers', () => {
    render(
      <MapWaypointBottomSheet
        entry={mockEntry}
        activeTrip={mockTrip}
        currentUser={mockViewer}
        indexInRoute={1}
        onClose={vi.fn()}
        onSelectEntry={vi.fn()}
        onEditEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
      />
    );

    expect(screen.queryByLabelText('Stopp bearbeiten')).toBeNull();
    expect(screen.queryByLabelText('Stopp löschen')).toBeNull();
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <MapWaypointBottomSheet
        entry={mockEntry}
        activeTrip={mockTrip}
        currentUser={mockOwner}
        indexInRoute={1}
        onClose={handleClose}
        onSelectEntry={vi.fn()}
      />
    );

    const closeBtn = screen.getByLabelText('Stopp-Vorschau schließen');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });

  it('renders null when no entry is selected', () => {
    const { container } = render(
      <MapWaypointBottomSheet
        entry={null}
        activeTrip={mockTrip}
        currentUser={mockOwner}
        indexInRoute={1}
        onClose={vi.fn()}
        onSelectEntry={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
