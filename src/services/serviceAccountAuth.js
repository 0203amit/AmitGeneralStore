/**
 * Google Service Account authentication for admin login.
 * Creates JWTs signed with RS256 using Web Crypto API (no external libraries)
 * and exchanges them for Google API access tokens.
 */

const SA_EMAIL = import.meta.env.VITE_SA_CLIENT_EMAIL;
const SA_PRIVATE_KEY = import.meta.env.VITE_SA_PRIVATE_KEY;

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
].join(' ');

/**
 * Check whether Service Account credentials are configured.
 * @returns {boolean}
 */
export function isServiceAccountConfigured() {
  return !!(SA_EMAIL && SA_PRIVATE_KEY);
}

/**
 * Get an access token for the Service Account by signing a JWT
 * and exchanging it at Google's token endpoint.
 * @returns {Promise<{access_token: string, expires_in: number}>}
 * @throws {Error} If SA credentials are missing or token exchange fails
 */
export async function getServiceAccountAccessToken() {
  if (!SA_EMAIL || !SA_PRIVATE_KEY) {
    throw new Error(
      'Service Account credentials not configured. Set VITE_SA_CLIENT_EMAIL and VITE_SA_PRIVATE_KEY in .env'
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: SA_EMAIL,
    scope: SCOPES,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const jwt = await createSignedJwt(payload);

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Service Account token exchange failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return { access_token: data.access_token, expires_in: data.expires_in };
}

/**
 * Create a signed JWT (RS256) using Web Crypto API.
 * @param {Object} payload - JWT claims
 * @returns {Promise<string>} The signed JWT string
 */
async function createSignedJwt(payload) {
  const header = { alg: 'RS256', typ: 'JWT' };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const privateKey = await importPrivateKey(SA_PRIVATE_KEY);
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    new TextEncoder().encode(signingInput)
  );

  const encodedSignature = base64UrlEncodeBuffer(signature);
  return `${signingInput}.${encodedSignature}`;
}

/**
 * Import a PEM-encoded RSA private key for use with Web Crypto API.
 * @param {string} pem - PEM-encoded private key (may contain \n literals from env var)
 * @returns {Promise<CryptoKey>}
 */
async function importPrivateKey(pem) {
  // Normalize: env vars may store \n as literal backslash-n
  const normalized = pem.replace(/\\n/g, '\n');
  const pemBody = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const binaryDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

/** Base64url-encode a string. */
function base64UrlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Base64url-encode an ArrayBuffer. */
function base64UrlEncodeBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
