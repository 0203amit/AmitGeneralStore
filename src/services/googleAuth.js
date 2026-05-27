/**
 * Google OAuth and GAPI initialization service.
 * Manages access token in memory (never localStorage) and provides
 * helpers for authentication state and silent token refresh.
 */
import { loadGapiInsideDOM } from 'gapi-script';

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
].join(' ');

const DISCOVERY_DOCS = [
  'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
  'https://www.googleapis.com/discovery/v1/apis/sheets/v4/rest',
];

let accessToken = null;
let tokenExpiresAt = null;
let refreshTimerId = null;
let tokenRefreshCallbacks = [];
let customTokenRefresher = null;
let authErrorCallback = null;

/**
 * Initialize the Google API client library with discovery documents.
 * Must be called once before making any Drive or Sheets API calls.
 * @returns {Promise<void>}
 * @throws {Error} If gapi fails to load or initialize
 */
export async function initGapi() {
  await loadGapiInsideDOM();
  await new Promise((resolve, reject) => {
    window.gapi.load('client', { callback: resolve, onerror: reject });
  });
  await window.gapi.client.init({ discoveryDocs: DISCOVERY_DOCS });
}

/**
 * Store the access token in memory and configure the gapi client.
 * Schedules automatic silent refresh before token expiry.
 * @param {string} token - OAuth 2.0 access token
 * @param {number} expiresIn - Token lifetime in seconds
 */
export function setAccessToken(token, expiresIn) {
  accessToken = token;
  tokenExpiresAt = Date.now() + expiresIn * 1000;
  window.gapi.client.setToken({ access_token: token });
  scheduleRefresh(expiresIn);
}

/**
 * Return the current access token from memory.
 * @returns {string|null}
 */
export function getAccessToken() {
  if (!accessToken || Date.now() >= tokenExpiresAt) return null;
  return accessToken;
}

/**
 * Check whether the user has a valid (non-expired) access token.
 * @returns {boolean}
 */
export function isAuthenticated() {
  return !!accessToken && Date.now() < tokenExpiresAt;
}

/**
 * Set a custom token refresh function (used by Service Account auth).
 * When set, scheduleRefresh will call this instead of attemptSilentRefresh.
 * @param {(() => Promise<{access_token: string, expires_in: number}>)|null} refresher
 */
export function setTokenRefresher(refresher) {
  customTokenRefresher = refresher;
}

/**
 * Set a callback invoked when token refresh fails (session expired).
 * Used by AuthProvider to surface refresh failures to the UI.
 * @param {((err: Error) => void)|null} callback
 */
export function setAuthErrorCallback(callback) {
  authErrorCallback = callback;
}

/**
 * Clear all auth state. Called during sign-out.
 */
export function clearAuth() {
  accessToken = null;
  tokenExpiresAt = null;
  customTokenRefresher = null;
  if (refreshTimerId) {
    clearTimeout(refreshTimerId);
    refreshTimerId = null;
  }
  if (window.gapi?.client) {
    window.gapi.client.setToken(null);
  }
}

/**
 * Revoke the current access token via Google Identity Services,
 * then clear local auth state.
 * @returns {Promise<void>}
 */
export async function signOut() {
  if (accessToken && window.google?.accounts?.oauth2?.revoke) {
    await new Promise((resolve) => {
      window.google.accounts.oauth2.revoke(accessToken, resolve);
    });
  }
  clearAuth();
}

/**
 * Fetch the authenticated user's profile from Google's userinfo endpoint.
 * @param {string} token - Access token
 * @returns {Promise<{email: string, name: string, picture: string}>}
 * @throws {Error} If the userinfo request fails
 */
export async function fetchUserInfo(token) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch user info');
  return res.json();
}

/**
 * Register a callback invoked when the token is silently refreshed.
 * @param {Function} callback - Receives the new access token string
 */
export function onTokenRefresh(callback) {
  tokenRefreshCallbacks.push(callback);
}

/**
 * Remove a previously registered token-refresh callback.
 * @param {Function} callback
 */
export function offTokenRefresh(callback) {
  tokenRefreshCallbacks = tokenRefreshCallbacks.filter((cb) => cb !== callback);
}

/**
 * Attempt a silent token re-authorization via Google Identity Services.
 * If the user's session is still valid, this succeeds without any popup.
 * If the session has lapsed, a brief consent popup appears.
 * @param {string} clientId - OAuth 2.0 client ID
 * @returns {Promise<{access_token: string, expires_in: number}>}
 * @throws {Error} If GIS is not loaded or refresh fails
 */
export function attemptSilentRefresh(clientId) {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services not loaded'));
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      prompt: '',
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        setAccessToken(response.access_token, response.expires_in);
        tokenRefreshCallbacks.forEach((cb) => cb(response.access_token));
        resolve(response);
      },
      error_callback: (err) => reject(err),
    });
    client.requestAccessToken({ prompt: '' });
  });
}

/**
 * Trigger a Google OAuth token request.
 * When silent=true, uses prompt:'none' to refresh without a popup
 * (works if the user has an existing Google session in the browser).
 * When silent=false, shows the consent popup (required for first-time auth).
 * Does NOT call setAccessToken — the caller is responsible.
 * @param {{ silent?: boolean }} options
 * @returns {Promise<{access_token: string, expires_in: number, scope: string}>}
 */
export function requestOAuthToken({ silent = false } = {}) {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services not loaded'));
      return;
    }
    const promptValue = silent ? 'none' : 'consent';
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        resolve(response);
      },
      error_callback: (err) => {
        if (silent) {
          // Silent refresh failed — expected when no active Google session
          reject(new Error('Silent token refresh failed — re-authentication required.'));
        } else if (err.type === 'popup_closed') {
          reject(new Error('Google sign-in was cancelled.'));
        } else {
          reject(new Error(err.message || 'OAuth failed'));
        }
      },
    });
    client.requestAccessToken({ prompt: promptValue });
  });
}

/**
 * Return the full OAuth scopes string for sign-in requests.
 * @returns {string}
 */
export function getScopes() {
  return SCOPES;
}

/** Schedule a silent token refresh before expiry. */
function scheduleRefresh(expiresIn) {
  if (refreshTimerId) clearTimeout(refreshTimerId);
  // Refresh 5 minutes before expiry, or at half-life if token is short-lived
  const refreshSec = expiresIn > 600 ? expiresIn - 300 : expiresIn / 2;
  const refreshMs = refreshSec * 1000;
  if (refreshMs > 0) {
    refreshTimerId = setTimeout(async () => {
      try {
        if (customTokenRefresher) {
          // Service Account: re-sign JWT and exchange for new token
          const { access_token, expires_in } = await customTokenRefresher();
          setAccessToken(access_token, expires_in);
          tokenRefreshCallbacks.forEach((cb) => cb(access_token));
        } else {
          // Google OAuth: silent re-authorization via GIS
          const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
          await attemptSilentRefresh(clientId);
        }
      } catch (err) {
        console.error('Token refresh failed:', err);
        // Clear the expired token so getAccessToken() returns null
        accessToken = null;
        tokenExpiresAt = null;
        if (window.gapi?.client) {
          window.gapi.client.setToken(null);
        }
        // Notify the UI layer so it can prompt re-authentication
        if (authErrorCallback) {
          authErrorCallback(new Error('Your session has expired. Please sign in again.'));
        }
      }
    }, refreshMs);
  }
}
