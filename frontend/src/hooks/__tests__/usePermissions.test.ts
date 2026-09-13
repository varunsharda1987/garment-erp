/**
 * usePermissions decides from the keys the server granted (user.permissions), never from a
 * client-side role map — the Permissions page is the source of truth. ADMIN holds every key.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/stores/auth.store';
import { PERMISSION_KEYS } from '@/config/permissions.config';

function signIn(role: string, permissions?: string[]) {
  useAuthStore.setState({
    user: { id: 'u1', email: 'u@test', firstName: 'T', lastName: 'U', role, permissions },
    token: 't',
    refreshToken: 'r',
    isAuthenticated: true,
  });
}

describe('usePermissions', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null, refreshToken: null, isAuthenticated: false });
  });

  it('grants exactly the keys the server sent, whatever the role', () => {
    signIn('SALES', ['orders', 'customers']);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can('orders')).toBe(true);
    expect(result.current.can('customers')).toBe(true);
    expect(result.current.can('costSheets')).toBe(false);
    expect(result.current.can('permissions')).toBe(false);
    expect(result.current.userPermissions).toEqual(['orders', 'customers']);
  });

  it('a role with no granted keys can do nothing', () => {
    signIn('SALES', []);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can('orders')).toBe(false);
    expect(result.current.userPermissions).toEqual([]);
  });

  it('a session persisted before permissions existed behaves as no keys (App refreshes it)', () => {
    signIn('SALES', undefined);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can('orders')).toBe(false);
  });

  it('ADMIN holds every key regardless of what was sent', () => {
    signIn('ADMIN', []);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.can('permissions')).toBe(true);
    expect(result.current.userPermissions).toEqual([...PERMISSION_KEYS]);
  });

  it('route access follows the granted keys; unmapped routes are open', () => {
    signIn('SALES', ['orders']);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canAccessRoute('/orders')).toBe(true);
    expect(result.current.canAccessRoute('/orders/123')).toBe(true);
    expect(result.current.canAccessRoute('/cost-sheets')).toBe(false);
    expect(result.current.canAccessRoute('/profile')).toBe(true);
  });

  it('signed out: nothing is allowed', () => {
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can('dashboard')).toBe(false);
    expect(result.current.userPermissions).toEqual([]);
  });
});
