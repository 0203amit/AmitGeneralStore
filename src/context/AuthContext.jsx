import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import * as googleAuth from '../services/googleAuth';
import { getServiceAccountAccessToken, isServiceAccountConfigured } from '../services/serviceAccountAuth';
import { verifyAdminCredentials } from '../services/adminAuth';
import { ensureAppFolder, clearFolderCache } from '../services/driveService';
import { ensureAppSheet, clearSheetCache } from '../services/sheetsService';

export const AuthContext = createContext(null);

const ADMIN_SESSION_KEY = 'admin_session';

/** Save admin session to sessionStorage (cleared when browser closes). */
function saveAdminSession(userInfo) {
  try {
    sessionStorage.setItem(
      ADMIN_SESSION_KEY,
      JSON.stringify({ name: userInfo.name, email: userInfo.email, isAdmin: true })
    );
  } catch {
    // sessionStorage may be unavailable in some contexts
  }
}

/** Read admin session from sessionStorage, or null if none. */
function getAdminSession() {
  try {
    const stored = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.isAdmin ? parsed : null;
  } catch {
    return null;
  }
}

/** Clear admin session from sessionStorage. */
function clearAdminSession() {
  try {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
  } catch {
    // ignore
  }
}

/**
 * Provides authentication state, sign-in/sign-out actions, and
 * post-sign-in provisioning of Drive folders and Sheets.
 * Supports both Google OAuth and admin (Service Account) login.
 * Must be rendered inside GoogleOAuthProvider.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [folderIds, setFolderIds] = useState(null);
  const [spreadsheetId, setSpreadsheetId] = useState(null);
  const [error, setError] = useState(null);
  const initRef = useRef(false);

  /** Restore an SA session: get fresh token, provision, set user. */
  const restoreAdminSession = useCallback(async (adminUser) => {
    try {
      setLoading(true);
      setError(null);

      const { access_token, expires_in } = await getServiceAccountAccessToken();

      googleAuth.setTokenRefresher(async () => {
        return getServiceAccountAccessToken();
      });

      googleAuth.setAccessToken(access_token, expires_in);

      setProvisioning(true);
      const [folders, sheetId] = await Promise.all([
        ensureAppFolder(),
        ensureAppSheet(),
      ]);
      setFolderIds(folders);
      setSpreadsheetId(sheetId);
      setUser({ name: adminUser.name, email: adminUser.email, picture: null });
      setProvisioning(false);
    } catch (err) {
      console.error('Admin session restore failed:', err);
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
        if (savedSession && isServiceAccountConfigured()) {
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

  /** Admin sign-in: authenticate via Service Account, verify credentials from Sheet. */
  const adminSignIn = useCallback(async (username, password) => {
    try {
      setLoading(true);
      setError(null);

      // 1. Get SA access token
      const { access_token, expires_in } = await getServiceAccountAccessToken();

      // 2. Set SA token refresher so auto-refresh uses JWT instead of OAuth
      googleAuth.setTokenRefresher(async () => {
        return getServiceAccountAccessToken();
      });

      // 3. Set token in googleAuth (configures gapi.client too)
      googleAuth.setAccessToken(access_token, expires_in);

      // 4. Provision Drive folders and Sheet (finds existing shared resources)
      setProvisioning(true);
      const [folders, sheetId] = await Promise.all([
        ensureAppFolder(),
        ensureAppSheet(),
      ]);
      setFolderIds(folders);
      setSpreadsheetId(sheetId);

      // 5. Verify admin credentials from the admin_users sheet tab
      const adminUser = await verifyAdminCredentials(username, password);
      const userInfo = { name: adminUser.name, email: adminUser.email, picture: null };
      setUser(userInfo);
      setProvisioning(false);

      // 6. Save session so page refresh doesn't require re-login
      saveAdminSession(adminUser);
    } catch (err) {
      console.error('Admin sign-in failed:', err);
      // Extract message from gapi errors ({result: {error: {message}}}) or standard errors
      const msg =
        err?.result?.error?.message || err?.message || 'Admin sign-in failed';
      setError(msg);
      googleAuth.clearAuth();
      setUser(null);
      setFolderIds(null);
      setSpreadsheetId(null);
      setProvisioning(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await googleAuth.signOut();
    clearFolderCache();
    clearSheetCache();
    clearAdminSession();
    setUser(null);
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
    signIn,
    adminSignIn,
    signOut,
    isAuthenticated: !!user && googleAuth.isAuthenticated(),
    isAdminLoginAvailable: isServiceAccountConfigured(),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
