import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import * as googleAuth from '../services/googleAuth';
import { ensureAppFolder, clearFolderCache } from '../services/driveService';
import { ensureAppSheet, clearSheetCache } from '../services/sheetsService';

export const AuthContext = createContext(null);

const ADMIN_SESSION_KEY = 'admin_session';

/** Save admin session to localStorage (persists across browser restarts). */
function saveAdminSession(userInfo) {
  try {
    localStorage.setItem(
      ADMIN_SESSION_KEY,
      JSON.stringify({ name: userInfo.name, email: userInfo.email, isAdmin: true })
    );
  } catch {
    // localStorage may be unavailable in some contexts
  }
}

/** Read admin session from localStorage (persists across browser restarts), or null if none. */
function getAdminSession() {
  try {
    const stored = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.isAdmin ? parsed : null;
  } catch {
    return null;
  }
}

/** Clear admin session from localStorage. */
function clearAdminSession() {
  try {
    localStorage.removeItem(ADMIN_SESSION_KEY);
  } catch {
    // ignore
  }
}

/**
 * Provides authentication state, sign-in/sign-out actions, and
 * post-sign-in provisioning of Drive folders and Sheets.
 * Supports both Google OAuth and admin login (server-side credential verification).
 * Must be rendered inside GoogleOAuthProvider.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [folderIds, setFolderIds] = useState(null);
  const [spreadsheetId, setSpreadsheetId] = useState(null);
  const [error, setError] = useState(null);
  const [adminLoginPhase, setAdminLoginPhase] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const initRef = useRef(false);

  /** Restore an admin session: silent OAuth for Drive access, then provision. */
  const restoreAdminSession = useCallback(async (adminUser) => {
    try {
      setLoading(true);
      setError(null);

      // Silent OAuth — works if Google session exists in browser
      const tokenResponse = await googleAuth.requestOAuthToken({ silent: true });
      googleAuth.setAccessToken(tokenResponse.access_token, tokenResponse.expires_in);

      setProvisioning(true);
      const [folders, sheetId] = await Promise.all([
        ensureAppFolder(),
        ensureAppSheet(),
      ]);
      setFolderIds(folders);
      setSpreadsheetId(sheetId);
      setUser({ name: adminUser.name, email: adminUser.email, picture: null });
      setIsAdmin(true);
      setProvisioning(false);
    } catch (err) {
      console.warn('Admin session restore skipped (re-login required):', err.message);
      clearAdminSession();
      googleAuth.clearAuth();
      setUser(null);
      setProvisioning(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize gapi on mount (once), then check for saved admin session
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    googleAuth
      .initGapi()
      .then(() => {
        const savedSession = getAdminSession();
        if (savedSession) {
          restoreAdminSession(savedSession);
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to initialize gapi:', err);
        setError('Failed to load Google API client');
        setLoading(false);
      });
  }, [restoreAdminSession]);

  // Register auth error handler to surface token refresh failures
  useEffect(() => {
    googleAuth.setAuthErrorCallback((err) => {
      setError(err.message);
      setUser(null);
      setFolderIds(null);
      setSpreadsheetId(null);
      clearFolderCache();
      clearSheetCache();
      clearAdminSession();
    });

    return () => {
      googleAuth.setAuthErrorCallback(null);
    };
  }, []);

  /** Handle successful token acquisition from Google sign-in. */
  const handleSignInSuccess = useCallback(async (tokenResponse) => {
    try {
      setLoading(true);
      setError(null);

      // Verify required scopes were granted (Google's granular consent
      // allows users to deselect individual permissions)
      const grantedScopes = tokenResponse.scope || '';
      const hasDriveScope = grantedScopes.includes('drive.file') || grantedScopes.includes('drive');
      const hasSheetsScope = grantedScopes.includes('spreadsheets');

      if (!hasDriveScope || !hasSheetsScope) {
        const missing = [];
        if (!hasDriveScope) missing.push('Google Drive');
        if (!hasSheetsScope) missing.push('Google Sheets');
        setError(
          `Access to ${missing.join(' and ')} was not granted. ` +
          'Please sign in again and allow all requested permissions.'
        );
        setLoading(false);
        return;
      }

      googleAuth.setAccessToken(
        tokenResponse.access_token,
        tokenResponse.expires_in
      );

      const userInfo = await googleAuth.fetchUserInfo(tokenResponse.access_token);
      setUser(userInfo);

      // Provision Drive folders and Sheet (idempotent)
      setProvisioning(true);
      const [folders, sheetId] = await Promise.all([
        ensureAppFolder(),
        ensureAppSheet(),
      ]);
      setFolderIds(folders);
      setSpreadsheetId(sheetId);
      setProvisioning(false);
    } catch (err) {
      console.error('Post-sign-in setup failed:', err);
      setError(err.message || 'Sign-in setup failed');
      googleAuth.clearAuth();
      setUser(null);
      setProvisioning(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useGoogleLogin({
    flow: 'implicit',
    scope: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/spreadsheets',
    ].join(' '),
    onSuccess: handleSignInSuccess,
    onError: (err) => {
      console.error('Google login error:', err);
      setError('Google sign-in failed');
      setLoading(false);
    },
  });

  const signIn = useCallback(() => {
    setError(null);
    login();
  }, [login]);

  /**
   * Hybrid admin sign-in:
   * 1. Server-side API verifies credentials (SA key stays on server)
   * 2. Silent OAuth (no popup) → fallback to consent popup (first time only)
   * 3. Provision Drive folders and Sheet with OAuth token
   */
  const adminSignIn = useCallback(async (username, password) => {
    try {
      setLoading(true);
      setError(null);

      // Phase 1: Verify credentials via server-side API
      setAdminLoginPhase('verifying');
      const verifyRes = await fetch('/api/verify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!verifyRes.ok) {
        const errData = await verifyRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Invalid username or password');
      }
      const adminUser = await verifyRes.json();

      // Phase 2: Get OAuth token (silent-first, popup fallback)
      setAdminLoginPhase('google-signin');
      let tokenResponse;
      try {
        tokenResponse = await googleAuth.requestOAuthToken({ silent: true });
      } catch {
        // Silent failed (first-time login or expired Google session) — show popup
        tokenResponse = await googleAuth.requestOAuthToken({ silent: false });
      }

      // Verify required scopes were granted
      const grantedScopes = tokenResponse.scope || '';
      const hasDriveScope = grantedScopes.includes('drive.file') || grantedScopes.includes('drive');
      const hasSheetsScope = grantedScopes.includes('spreadsheets');
      if (!hasDriveScope || !hasSheetsScope) {
        const missing = [];
        if (!hasDriveScope) missing.push('Google Drive');
        if (!hasSheetsScope) missing.push('Google Sheets');
        throw new Error(
          `Access to ${missing.join(' and ')} was not granted. ` +
          'Please sign in again and allow all requested permissions.'
        );
      }

      // Phase 3: Provision with OAuth token
      setAdminLoginPhase('provisioning');
      googleAuth.setAccessToken(tokenResponse.access_token, tokenResponse.expires_in);

      const googleUserInfo = await googleAuth.fetchUserInfo(tokenResponse.access_token);

      setProvisioning(true);
      const [folders, sheetId] = await Promise.all([
        ensureAppFolder(),
        ensureAppSheet(),
      ]);
      setFolderIds(folders);
      setSpreadsheetId(sheetId);
      setUser({
        name: adminUser.name,
        email: googleUserInfo.email,
        picture: googleUserInfo.picture || null,
      });
      setProvisioning(false);

      setIsAdmin(true);
      // Save session so page refresh can restore via silent OAuth
      saveAdminSession(adminUser);
    } catch (err) {
      console.error('Admin sign-in failed:', err);
      const msg =
        err?.result?.error?.message || err?.message || 'Admin sign-in failed';
      setError(msg);
      googleAuth.clearAuth();
      clearFolderCache();
      clearSheetCache();
      setUser(null);
      setFolderIds(null);
      setSpreadsheetId(null);
      setProvisioning(false);
    } finally {
      setAdminLoginPhase(null);
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await googleAuth.signOut();
    clearFolderCache();
    clearSheetCache();
    clearAdminSession();
    setUser(null);
    setIsAdmin(false);
    setFolderIds(null);
    setSpreadsheetId(null);
    setError(null);
  }, []);

  const value = {
    user,
    loading,
    provisioning,
    folderIds,
    spreadsheetId,
    error,
    adminLoginPhase,
    signIn,
    adminSignIn,
    signOut,
    isAdmin,
    isAuthenticated: !!user && googleAuth.isAuthenticated(),
    isAdminLoginAvailable: import.meta.env.VITE_ADMIN_LOGIN_ENABLED === 'true',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
