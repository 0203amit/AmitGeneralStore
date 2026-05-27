import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import * as googleAuth from '../services/googleAuth';
import { ensureAppFolder, clearFolderCache } from '../services/driveService';
import { ensureAppSheet, clearSheetCache } from '../services/sheetsService';

export const AuthContext = createContext(null);

const ADMIN_SESSION_KEY = 'admin_session';

/** Save admin session to localStorage (persists across browser restarts). */
function saveAdminSession(userInfo, sessionToken) {
  try {
    localStorage.setItem(
      ADMIN_SESSION_KEY,
      JSON.stringify({
        name: userInfo.name,
        email: userInfo.email,
        isAdmin: true,
        sessionToken,
      }),
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
    // Require sessionToken; old sessions without it force re-login
    return parsed?.isAdmin && parsed?.sessionToken ? parsed : null;
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
 * Create a token refresher that calls the server to get a fresh OAuth access token.
 * @param {string} sessionToken - The session JWT for authentication
 * @returns {() => Promise<{access_token: string, expires_in: number}>}
 */
function createAdminTokenRefresher(sessionToken) {
  return async () => {
    const res = await fetch('/api/refresh-admin-token', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Token refresh failed');
    }
    return res.json();
  };
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

  // Ref for Promise-based auth-code flow (one-time OAuth popup)
  const oauthResolveRef = useRef(null);

  /** Restore an admin session using stored session JWT to get a fresh token. */
  const restoreAdminSession = useCallback(async (adminSession) => {
    try {
      setLoading(true);
      setError(null);

      const { sessionToken } = adminSession;

      // Get a fresh OAuth access token using the stored session JWT + server-side refresh token
      const refresher = createAdminTokenRefresher(sessionToken);
      const { access_token, expires_in } = await refresher();

      googleAuth.setAccessToken(access_token, expires_in);
      googleAuth.setTokenRefresher(refresher);

      setProvisioning(true);
      const [folders, sheetId] = await Promise.all([ensureAppFolder(), ensureAppSheet()]);
      setFolderIds(folders);
      setSpreadsheetId(sheetId);
      setUser({ name: adminSession.name, email: adminSession.email, picture: null });
      setIsAdmin(true);
      setProvisioning(false);
    } catch (err) {
      console.warn('Admin session restore failed (re-login required):', err.message);
      clearAdminSession();
      googleAuth.clearAuth();
      setUser(null);
      setIsAdmin(false);
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
      setIsAdmin(false);
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

  /** Handle successful token acquisition from Google sign-in (non-admin flow). */
  const handleSignInSuccess = useCallback(async (tokenResponse) => {
    try {
      setLoading(true);
      setError(null);

      const grantedScopes = tokenResponse.scope || '';
      const hasDriveScope = grantedScopes.includes('drive.file') || grantedScopes.includes('drive');
      const hasSheetsScope = grantedScopes.includes('spreadsheets');

      if (!hasDriveScope || !hasSheetsScope) {
        const missing = [];
        if (!hasDriveScope) missing.push('Google Drive');
        if (!hasSheetsScope) missing.push('Google Sheets');
        setError(
          `Access to ${missing.join(' and ')} was not granted. ` +
            'Please sign in again and allow all requested permissions.',
        );
        setLoading(false);
        return;
      }

      googleAuth.setAccessToken(tokenResponse.access_token, tokenResponse.expires_in);

      const userInfo = await googleAuth.fetchUserInfo(tokenResponse.access_token);
      setUser(userInfo);

      setProvisioning(true);
      const [folders, sheetId] = await Promise.all([ensureAppFolder(), ensureAppSheet()]);
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

  // Regular Google OAuth login (non-admin, implicit flow)
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

  // Auth-code flow for one-time admin OAuth (to get refresh token)
  const adminOAuthLogin = useGoogleLogin({
    flow: 'auth-code',
    scope: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/spreadsheets',
    ].join(' '),
    onSuccess: (response) => {
      if (oauthResolveRef.current) {
        oauthResolveRef.current.resolve(response.code);
        oauthResolveRef.current = null;
      }
    },
    onError: (err) => {
      if (oauthResolveRef.current) {
        oauthResolveRef.current.reject(
          new Error(err?.type === 'popup_closed' ? 'Google sign-in was cancelled.' : 'Google sign-in failed'),
        );
        oauthResolveRef.current = null;
      }
    },
  });

  /** Request an authorization code via popup (returns a Promise). */
  const requestAuthCode = useCallback(() => {
    return new Promise((resolve, reject) => {
      oauthResolveRef.current = { resolve, reject };
      adminOAuthLogin();
    });
  }, [adminOAuthLogin]);

  const signIn = useCallback(() => {
    setError(null);
    login();
  }, [login]);

  /**
   * Admin sign-in:
   * 1. Server verifies credentials and checks for stored refresh token
   * 2. If refresh token exists: returns user OAuth token (no popup)
   * 3. If not: one-time Google popup to get auth code → exchange for tokens
   */
  const adminSignIn = useCallback(async (username, password) => {
    try {
      setLoading(true);
      setError(null);

      // Phase 1: Verify credentials
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
      const { name, email, sessionToken, needsOAuth, accessToken, expiresIn } = await verifyRes.json();

      let token = accessToken;
      let tokenExpiry = expiresIn;

      // Phase 2: If no stored refresh token, do one-time Google OAuth
      if (needsOAuth) {
        setAdminLoginPhase('google-signin');
        const code = await requestAuthCode();

        // Exchange auth code for tokens (server stores refresh token)
        const exchangeRes = await fetch('/api/exchange-code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ code }),
        });
        if (!exchangeRes.ok) {
          const errData = await exchangeRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Token exchange failed');
        }
        const exchangeData = await exchangeRes.json();
        token = exchangeData.access_token;
        tokenExpiry = exchangeData.expires_in;
      }

      // Phase 3: Set up token and provision
      setAdminLoginPhase('provisioning');
      googleAuth.setAccessToken(token, tokenExpiry);
      googleAuth.setTokenRefresher(createAdminTokenRefresher(sessionToken));

      setProvisioning(true);
      const [folders, sheetId] = await Promise.all([ensureAppFolder(), ensureAppSheet()]);
      setFolderIds(folders);
      setSpreadsheetId(sheetId);
      setUser({ name, email, picture: null });
      setProvisioning(false);

      setIsAdmin(true);
      saveAdminSession({ name, email }, sessionToken);
    } catch (err) {
      console.error('Admin sign-in failed:', err);
      const msg = err?.result?.error?.message || err?.message || 'Admin sign-in failed';
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
  }, [requestAuthCode]);

  const signOut = useCallback(async () => {
    if (isAdmin) {
      googleAuth.clearAuth();
    } else {
      await googleAuth.signOut();
    }
    clearFolderCache();
    clearSheetCache();
    clearAdminSession();
    setUser(null);
    setIsAdmin(false);
    setFolderIds(null);
    setSpreadsheetId(null);
    setError(null);
  }, [isAdmin]);

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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
