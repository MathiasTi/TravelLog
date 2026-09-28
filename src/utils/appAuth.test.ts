// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateAppPassword,
  ADMIN_PASSWORD,
  VIEWER_PASSWORD,
  storeAppSession,
  getStoredAppSession,
  clearAppSession,
  createCollaboratorFromSession,
  AppAuthSession,
} from './appAuth';

describe('appAuth utility', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('validates admin password AlpenGravel2026A as owner', () => {
    expect(validateAppPassword('AlpenGravel2026A')).toBe('owner');
    expect(validateAppPassword('  AlpenGravel2026A  ')).toBe('owner');
  });

  it('validates viewer password AlpenGravel2026 as viewer', () => {
    expect(validateAppPassword('AlpenGravel2026')).toBe('viewer');
    expect(validateAppPassword('  AlpenGravel2026  ')).toBe('viewer');
  });

  it('rejects invalid passwords with null', () => {
    expect(validateAppPassword('wrongPassword')).toBeNull();
    expect(validateAppPassword('')).toBeNull();
    expect(validateAppPassword('123456')).toBeNull();
    expect(validateAppPassword('AlpenGravel')).toBeNull();
  });

  it('persists and restores rememberMe session via localStorage', () => {
    const session: AppAuthSession = {
      userName: 'Lukas Gravel',
      role: 'owner',
      avatar: 'https://example.com/avatar.jpg',
      color: '#8A9A5B',
      unlockedAt: '2026-08-24T12:00:00Z',
      rememberMe: true,
    };

    storeAppSession(session);
    const retrieved = getStoredAppSession();
    expect(retrieved).not.toBeNull();
    expect(retrieved?.userName).toBe('Lukas Gravel');
    expect(retrieved?.role).toBe('owner');

    clearAppSession();
    expect(getStoredAppSession()).toBeNull();
  });

  it('creates Collaborator object accurately from session', () => {
    const session: AppAuthSession = {
      userName: 'Anna Berg',
      role: 'viewer',
      avatar: 'https://example.com/avatar2.jpg',
      color: '#E2725B',
      unlockedAt: '2026-08-24T12:00:00Z',
      rememberMe: false,
    };

    const collab = createCollaboratorFromSession(session);
    expect(collab.name).toBe('Anna Berg');
    expect(collab.role).toBe('viewer');
    expect(collab.avatar).toBe('https://example.com/avatar2.jpg');
    expect(collab.color).toBe('#E2725B');
    expect(collab.id).toContain('user-anna-berg');
  });
});
