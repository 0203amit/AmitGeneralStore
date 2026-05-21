import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import * as googleAuth from '../services/googleAuth';
import { ensureAppFolder, clearFolderCache } from '../services/driveService';
import { ensureAppSheet, clearSheetCache } from '../services/sheetsService';

export const AuthContext = createContext(null);

/**
 * Provides authentication state, sign-in/sign-out actions, and
 * post-sign-in provisioning of Drive folders and Sheets.
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

  // Initialize gapi on mount (once)
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    googleAuth
      .initGapi()
      .then(() => setLoading(false))
      .catch((err) => {
        console.error('Failed to initialize gapi:', err);
        setError('Failed to load Google API client');
        setLoading(false);
      });
  }, []);

  /** Handle successful token acquisition from Google sign-in. */
  const handleSignInSuccess = useCallback(async (tokenResponse) => {
    try {
      setLoading(true);
      setError(null);

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

  const signOut = useCallback(async () => {
    await googleAuth.signOut();
    clearFolderCache();
    clearSheetCache();
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
    signOut,
    isAuthenticated: !!user && googleAuth.isAuthenticated(),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
