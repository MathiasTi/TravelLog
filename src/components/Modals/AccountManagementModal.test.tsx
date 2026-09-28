// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { AccountManagementModal } from './AccountManagementModal';
import { AuthUser, Collaborator, SyncState, Trip } from '../../types';
import { authService } from '../../services/firebase';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const mockAuthUser: AuthUser = {
  uid: 'user-123',
  email: 'test@traveler.com',
  displayName: 'Max Mustermann',
  photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
  isAnonymous: false,
  providerId: 'password',
  createdAt: '2026-08-01T12:00:00Z',
};

const mockCollab: Collaborator = {
  id: 'user-123',
  name: 'Max Mustermann',
  email: 'test@traveler.com',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
  color: '#8A9A5B',
  role: 'owner',
};

const mockOtherCollab: Collaborator = {
  id: 'user-456',
  name: 'Lisa Berg',
  email: 'lisa@traveler.com',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde',
  color: '#E2725B',
  role: 'editor',
};

const mockTrip: Trip = {
  id: 'trip-1',
  title: 'Alpen-Überquerung 2025',
  description: 'Wanderung',
  coverImage: 'https://example.com/cover.jpg',
  startDate: '2025-07-01',
  endDate: '2025-07-15',
  countryCodes: ['DE', 'AT'],
  passwordProtected: false,
  isPublic: true,
  shareToken: 'share-123',
  collaborators: [mockCollab, mockOtherCollab],
  defaultCoordinates: [47.5, 11.5],
  defaultZoom: 8,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

const mockSyncState: SyncState = {
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncedAt: '2026-08-21T09:00:00Z',
};

describe('AccountManagementModal', () => {
  it('renders user details and tabs when modal is open', () => {
    render(
      <AccountManagementModal
        isOpen={true}
        onClose={vi.fn()}
        authUser={mockAuthUser}
        currentUser={mockCollab}
        trips={[mockTrip]}
        onSignOut={vi.fn()}
        syncState={mockSyncState}
      />
    );

    expect(screen.getByText('Max Mustermann')).toBeDefined();
    expect(screen.getByText('test@traveler.com')).toBeDefined();
    expect(screen.getByText('Profil')).toBeDefined();
    expect(screen.getByText('Admins & Rechte')).toBeDefined();
    expect(screen.getByText('Sicherheit')).toBeDefined();
    expect(screen.getByText('Cloud & Sync')).toBeDefined();
  });

  it('does not render when isOpen is false or authUser is null', () => {
    const { container } = render(
      <AccountManagementModal
        isOpen={false}
        onClose={vi.fn()}
        authUser={mockAuthUser}
        onSignOut={vi.fn()}
        syncState={mockSyncState}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('allows trip owner to promote another collaborator to admin / owner', async () => {
    const onUpdateTripMock = vi.fn();

    render(
      <AccountManagementModal
        isOpen={true}
        onClose={vi.fn()}
        authUser={mockAuthUser}
        currentUser={mockCollab}
        trips={[mockTrip]}
        onUpdateTrip={onUpdateTripMock}
        onSignOut={vi.fn()}
        syncState={mockSyncState}
      />
    );

    // Switch to Admins & Rechte tab
    const rolesTab = screen.getByText('Admins & Rechte');
    fireEvent.click(rolesTab);

    expect(screen.getByText('Inhaber-Rechte aktiv für diese Reise')).toBeDefined();
    expect(screen.getByText('Lisa Berg')).toBeDefined();

    // Find select for Lisa Berg's role and change to owner
    const roleSelects = screen.getAllByRole('combobox');
    const lisaRoleSelect = roleSelects[roleSelects.length - 1];
    fireEvent.change(lisaRoleSelect, { target: { value: 'owner' } });

    expect(onUpdateTripMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'trip-1',
        collaborators: expect.arrayContaining([
          expect.objectContaining({ id: 'user-456', role: 'owner' }),
        ]),
      })
    );
    expect(screen.getByText('Rolle von "Lisa Berg" erfolgreich auf "Inhaber" geändert.')).toBeDefined();
  });

  it('allows trip owner to revoke permissions from a collaborator', async () => {
    const onUpdateTripMock = vi.fn();

    render(
      <AccountManagementModal
        isOpen={true}
        onClose={vi.fn()}
        authUser={mockAuthUser}
        currentUser={mockCollab}
        trips={[mockTrip]}
        onUpdateTrip={onUpdateTripMock}
        onSignOut={vi.fn()}
        syncState={mockSyncState}
      />
    );

    // Switch to Admins & Rechte tab
    fireEvent.click(screen.getByText('Admins & Rechte'));

    const revokeButtons = screen.getAllByTitle('Berechtigungen entziehen');
    fireEvent.click(revokeButtons[1]); // Click revoke for Lisa

    expect(onUpdateTripMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'trip-1',
        collaborators: [mockCollab],
      })
    );
    expect(screen.getByText('Berechtigungen für "Lisa Berg" wurden entzogen.')).toBeDefined();
  });

  it('displays direct trip link and toggles QR code in Admins & Rechte tab', async () => {
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    render(
      <AccountManagementModal
        isOpen={true}
        onClose={vi.fn()}
        authUser={mockAuthUser}
        currentUser={mockCollab}
        trips={[mockTrip]}
        onSignOut={vi.fn()}
        syncState={mockSyncState}
      />
    );

    // Switch to Admins & Rechte tab
    fireEvent.click(screen.getByText('Admins & Rechte'));

    // Check direct link card exists
    expect(screen.getByText('Direktlink für Mitreisende')).toBeDefined();
    expect(screen.getByDisplayValue(/trip=share-123/)).toBeDefined();

    // Click Copy Link
    const copyBtn = screen.getByText('Link kopieren');
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('trip=share-123'));
    await waitFor(() => {
      expect(screen.getByText('Kopiert!')).toBeDefined();
    });

    // Toggle QR Code
    const qrBtn = screen.getByText('QR-Code');
    fireEvent.click(qrBtn);
    expect(screen.getByText('QR-Code für Mitreisende')).toBeDefined();
  });

  it('calls onProfileUpdated and onUpdateUser when profile form is submitted', async () => {
    const onProfileUpdatedMock = vi.fn();
    const onUpdateUserMock = vi.fn();

    vi.spyOn(authService, 'updateUserProfile').mockResolvedValue({
      ...mockAuthUser,
      displayName: 'Maximilian Neu',
    });

    render(
      <AccountManagementModal
        isOpen={true}
        onClose={vi.fn()}
        authUser={mockAuthUser}
        currentUser={mockCollab}
        onSignOut={vi.fn()}
        onProfileUpdated={onProfileUpdatedMock}
        onUpdateUser={onUpdateUserMock}
        syncState={mockSyncState}
      />
    );

    const input = screen.getByPlaceholderText('Dein Name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Maximilian Neu' } });

    const submitBtn = screen.getByText('Profil aktualisieren');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(authService.updateUserProfile).toHaveBeenCalledWith(
        'Maximilian Neu',
        expect.any(String)
      );
      expect(onProfileUpdatedMock).toHaveBeenCalled();
      expect(onUpdateUserMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Maximilian Neu',
        })
      );
      expect(screen.getByText('Profil erfolgreich aktualisiert!')).toBeDefined();
    });
  });
});
