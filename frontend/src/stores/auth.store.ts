import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types/auth.types';

// BUG-AUTH9 fix: Security Consideration - localStorage Token Storage
// ====================================================================
// The JWT token is stored in localStorage, which is accessible to any JavaScript
// running on the page. This creates XSS (Cross-Site Scripting) vulnerability:
// if an attacker injects malicious JS, they can steal the token.
//
// MITIGATIONS IN PLACE:
// 1. Content-Security-Policy headers via Helmet.js (backend/src/app.ts)
// 2. Input sanitization on all user inputs (Zod schemas)
// 3. React's built-in XSS protection (auto-escapes rendered content)
// 4. Short-ish token expiry (7 days) limits damage window
// 5. Backend re-validates user status on every request (auth.middleware.ts:29-48)
// 6. Sentry scrubs tokens from error reports (frontend/src/lib/sentry.ts)
// 7. BUG-AUTH2: tokenVersion invalidates all sessions on password change
// 8. BUG-AUTH6: Refresh tokens enable session extension without re-login
//
// WHY NOT httpOnly COOKIES:
// - Architecture: SPA + separate API server (different ports in dev, potentially
//   different domains in prod) requires Bearer token auth for CORS compatibility
// - Complexity: httpOnly cookies need SameSite, Secure, domain config, CSRF tokens
// - Multi-client: B2B app and future mobile clients share the same Bearer API
// - Trade-off: CSRF protection (cookies) vs XSS protection (localStorage)
//   Both require defense-in-depth; neither is "more secure" without full analysis
//
// RECOMMENDED ADDITIONAL HARDENING (future):
// - Add fingerprinting (bind token to browser/device characteristics)
// - Monitor for suspicious token usage patterns
// ====================================================================

// Auth state interface
interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setAuth: (user: User, token: string, refreshToken: string) => void;
  setTokens: (token: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

// Create auth store with persistence
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      setAuth: (user: User, token: string, refreshToken: string) => {
        set({
          user,
          token,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      // Update tokens only (used after refresh)
      setTokens: (token: string, refreshToken: string) => {
        set({
          token,
          refreshToken,
        });
      },

      setUser: (user: User) => {
        set({ user });
      },

      clearAuth: () => {
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },
    }),
    {
      // BUG-AUTH9: Token stored in localStorage - see security comment at top of file
      name: 'auth-storage', // Key in localStorage
      partialize: (state) => ({
        user: state.user,
        token: state.token, // XSS-accessible; mitigations documented above
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
