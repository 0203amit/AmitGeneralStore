/**
 * Shared Service Account utilities for admin authentication.
 * Used by /api/verify-admin, /api/refresh-admin-token, and /api/exchange-code.
 */
import crypto from 'node:crypto';

const SA_EMAIL = process.env.SA_CLIENT_EMAIL;
const SA_PRIVATE_KEY = process.env.SA_PRIVATE_KEY;
const SPREADSHEET_ID = process.env.SA_SPREADSHEET_ID;
const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

/** Session JWT lifetime: no expiry (null = never expires). */
const SESSION_EXPIRY_SECONDS = null;

/** SA only needs Sheets access (for credential verification + token storage). */
const SA_SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

const TOKENS_WORKSHEET = 'admin_tokens';

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

export function base64url(str) {
  return Buffer.from(str).toString('base64url');
}

/**
 * Create an RS256-signed JWT for Google token exchange.
 * @param {{ iss: string, scope: string, aud: string, iat: number, exp: number }} payload
 * @returns {string}
 */
export function signJwt(payload) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const pem = SA_PRIVATE_KEY.replace(/\\n/g, '\n');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign(pem, 'base64url');

  return `${signingInput}.${signature}`;
}

// ---------------------------------------------------------------------------
// Session JWT (HMAC-SHA256) — long-lived client token for refresh requests
// ---------------------------------------------------------------------------

/** Derive a fixed-length HMAC key from the SA private key PEM. */
function getHmacSecret() {
  const pem = SA_PRIVATE_KEY.replace(/\\n/g, '\n');
  return crypto.createHash('sha256').update(pem).digest();
}

/**
 * Create an HMAC-SHA256 signed session JWT.
 * @param {{ sub: string, name: string, email: string }} claims
 * @returns {string}
 */
export function createSessionToken(claims) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { ...claims, iat: now };
  if (SESSION_EXPIRY_SECONDS) payload.exp = now + SESSION_EXPIRY_SECONDS;

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', getHmacSecret())
    .update(signingInput)
    .digest('base64url');

  return `${signingInput}.${signature}`;
}

/**
 * Verify an HMAC-SHA256 session JWT and return its payload.
 * @param {string} token
 * @returns {{ sub: string, name: string, email: string, iat: number, exp: number }}
 * @throws {Error} If signature is invalid or token is expired
 */
export function verifySessionToken(token) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw Object.assign(new Error('Invalid session token format'), { status: 401 });
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const expectedSig = crypto
    .createHmac('sha256', getHmacSecret())
    .update(signingInput)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    throw Object.assign(new Error('Invalid session token signature'), { status: 401 });
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString());
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw Object.assign(new Error('Session token has expired'), { status: 401 });
  }

  return payload;
}

// ---------------------------------------------------------------------------
// SA access token — for Sheets operations (credential verification, token storage)
// ---------------------------------------------------------------------------

/**
 * Get an SA access token with Sheets scope.
 * @returns {Promise<string>} access_token
 */
export async function getSAAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: SA_EMAIL,
    scope: SA_SCOPES,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const jwt = signJwt(payload);

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw Object.assign(new Error(`SA token exchange failed: ${text}`), { status: 500 });
  }

  const data = await response.json();
  return data.access_token;
}

// ---------------------------------------------------------------------------
// AES-256-GCM encryption for refresh token storage
// ---------------------------------------------------------------------------

/** Derive AES key from SA private key. */
function getEncryptionKey() {
  const pem = SA_PRIVATE_KEY.replace(/\\n/g, '\n');
  return crypto.createHash('sha256').update(pem).digest();
}

/** Encrypt text using AES-256-GCM. Returns iv:tag:ciphertext (all base64). */
export function encrypt(text) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted}`;
}

/** Decrypt AES-256-GCM encrypted text. */
export function decrypt(data) {
  const [ivB64, tagB64, encrypted] = data.split(':');
  const key = getEncryptionKey();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ---------------------------------------------------------------------------
// Refresh token storage (admin_tokens worksheet in the admin spreadsheet)
// ---------------------------------------------------------------------------

/**
 * Store an encrypted refresh token for an admin user.
 * Creates the admin_tokens worksheet if it doesn't exist.
 * @param {string} username
 * @param {string} refreshToken - plaintext refresh token (will be encrypted)
 * @param {string} googleEmail - the Google account email
 */
export async function storeRefreshToken(username, refreshToken, googleEmail) {
  const saToken = await getSAAccessToken();
  const encryptedToken = encrypt(refreshToken);
  const now = new Date().toISOString();

  // Ensure admin_tokens worksheet exists
  await ensureTokensWorksheet(saToken);

  // Check if user already has a row
  const range = encodeURIComponent(`${TOKENS_WORKSHEET}!A:A`);
  const readUrl = `${SHEETS_BASE}/${SPREADSHEET_ID}/values/${range}`;
  const readRes = await fetch(readUrl, {
    headers: { Authorization: `Bearer ${saToken}` },
  });

  let rowIndex = -1;
  if (readRes.ok) {
    const data = await readRes.json();
    const rows = data.values || [];
    for (let i = 1; i < rows.length; i++) {
      if ((rows[i][0] || '').trim().toLowerCase() === username.trim().toLowerCase()) {
        rowIndex = i + 1; // 1-based sheet row
        break;
      }
    }
  }

  if (rowIndex > 0) {
    // Update existing row
    const updateRange = encodeURIComponent(`${TOKENS_WORKSHEET}!A${rowIndex}:D${rowIndex}`);
    const updateUrl = `${SHEETS_BASE}/${SPREADSHEET_ID}/values/${updateRange}?valueInputOption=RAW`;
    await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${saToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [[username, encryptedToken, googleEmail, now]],
      }),
    });
  } else {
    // Append new row
    const appendRange = encodeURIComponent(`${TOKENS_WORKSHEET}!A:D`);
    const appendUrl = `${SHEETS_BASE}/${SPREADSHEET_ID}/values/${appendRange}:append?valueInputOption=RAW`;
    await fetch(appendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${saToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [[username, encryptedToken, googleEmail, now]],
      }),
    });
  }
}

/**
 * Get the stored refresh token for an admin user (decrypted).
 * @param {string} username
 * @returns {Promise<string|null>} decrypted refresh token or null
 */
export async function getStoredRefreshToken(username) {
  const saToken = await getSAAccessToken();

  const range = encodeURIComponent(`${TOKENS_WORKSHEET}!A:B`);
  const url = `${SHEETS_BASE}/${SPREADSHEET_ID}/values/${range}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${saToken}` },
  });

  if (!res.ok) {
    // Worksheet might not exist yet (first-time login)
    return null;
  }

  const data = await res.json();
  const rows = data.values || [];
  for (let i = 1; i < rows.length; i++) {
    if ((rows[i][0] || '').trim().toLowerCase() === username.trim().toLowerCase()) {
      const encryptedToken = rows[i][1];
      if (!encryptedToken) return null;
      try {
        return decrypt(encryptedToken);
      } catch {
        return null; // corrupted token
      }
    }
  }

  return null;
}

/** Ensure admin_tokens worksheet exists; create it with headers if not. */
async function ensureTokensWorksheet(saToken) {
  // Try reading the worksheet — if it fails, create it
  const range = encodeURIComponent(`${TOKENS_WORKSHEET}!A1`);
  const url = `${SHEETS_BASE}/${SPREADSHEET_ID}/values/${range}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${saToken}` },
  });

  if (res.ok) return; // already exists

  // Create the worksheet
  const addSheetUrl = `${SHEETS_BASE}/${SPREADSHEET_ID}:batchUpdate`;
  await fetch(addSheetUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${saToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: { title: TOKENS_WORKSHEET },
          },
        },
      ],
    }),
  });

  // Write header row
  const headerRange = encodeURIComponent(`${TOKENS_WORKSHEET}!A1:D1`);
  const headerUrl = `${SHEETS_BASE}/${SPREADSHEET_ID}/values/${headerRange}?valueInputOption=RAW`;
  await fetch(headerUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${saToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [['username', 'encrypted_refresh_token', 'google_email', 'updated_at']],
    }),
  });
}

// ---------------------------------------------------------------------------
// User OAuth token refresh — uses stored refresh token
// ---------------------------------------------------------------------------

/**
 * Use a refresh token to get a fresh user OAuth access token.
 * @param {string} refreshToken - decrypted refresh token
 * @returns {Promise<{ access_token: string, expires_in: number }>}
 */
export async function refreshUserOAuthToken(refreshToken) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw Object.assign(new Error(`OAuth token refresh failed: ${text}`), { status: 401 });
  }

  const data = await response.json();
  return { access_token: data.access_token, expires_in: data.expires_in };
}

/**
 * Exchange an authorization code for tokens.
 * @param {string} code - authorization code from Google OAuth
 * @returns {Promise<{ access_token: string, expires_in: number, refresh_token?: string }>}
 */
export async function exchangeAuthCode(code) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: 'postmessage',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw Object.assign(new Error(`Auth code exchange failed: ${text}`), { status: 500 });
  }

  return response.json();
}
