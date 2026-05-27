/**
 * Shared Service Account utilities for admin authentication.
 * Used by /api/verify-admin and /api/refresh-admin-token.
 */
import crypto from 'node:crypto';

const SA_EMAIL = process.env.SA_CLIENT_EMAIL;
const SA_PRIVATE_KEY = process.env.SA_PRIVATE_KEY;
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** Session JWT lifetime: no expiry (null = never expires). */
const SESSION_EXPIRY_SECONDS = null;

/** Scopes for admin Drive + Sheets access. */
const ADMIN_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
].join(' ');

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
 * Create an HMAC-SHA256 signed session JWT (7-day expiry).
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

  // Constant-time comparison to prevent timing attacks
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
// SA access token — short-lived Google API token for Drive + Sheets
// ---------------------------------------------------------------------------

/**
 * Get a Google access token using SA JWT exchange with admin-level scopes.
 * @returns {Promise<{ access_token: string, expires_in: number }>}
 */
export async function getAdminAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: SA_EMAIL,
    scope: ADMIN_SCOPES,
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
    throw Object.assign(new Error(`SA admin token exchange failed: ${text}`), { status: 500 });
  }

  const data = await response.json();
  return { access_token: data.access_token, expires_in: data.expires_in };
}
