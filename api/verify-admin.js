import bcrypt from 'bcryptjs';
import {
  signJwt,
  base64url,
  createSessionToken,
  getAdminAccessToken,
} from './_lib/sa-utils.js';

const SA_EMAIL = process.env.SA_CLIENT_EMAIL;
const SA_PRIVATE_KEY = process.env.SA_PRIVATE_KEY;
const SPREADSHEET_ID = process.env.SA_SPREADSHEET_ID;

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const ADMIN_WORKSHEET = 'admin_users';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (!SA_EMAIL || !SA_PRIVATE_KEY || !SPREADSHEET_ID) {
    return res.status(500).json({ error: 'Admin login is not configured on the server' });
  }

  try {
    // Verify credentials using a readonly-scoped SA token
    const readonlyToken = await getReadonlyToken();
    const rows = await readAdminUsers(readonlyToken);
    const admin = await verifyCredentials(rows, username, password);

    // Generate SA access token with admin scopes (drive.file + spreadsheets)
    const adminToken = await getAdminAccessToken();

    // Generate long-lived session JWT for token refresh
    const sessionToken = createSessionToken({
      sub: admin.email,
      name: admin.name,
      email: admin.email,
    });

    return res.status(200).json({
      success: true,
      name: admin.name,
      email: admin.email,
      sessionToken,
      accessToken: adminToken.access_token,
      expiresIn: adminToken.expires_in,
    });
  } catch (err) {
    const status = err.status || 401;
    return res.status(status).json({ error: err.message });
  }
}

/**
 * Get a readonly-scoped SA token for credential verification.
 * Separate from getAdminAccessToken which uses broader scopes.
 */
async function getReadonlyToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: SA_EMAIL,
    scope: SCOPES,
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

/**
 * Read the admin_users sheet tab (columns A:C = username, password, display_name).
 */
async function readAdminUsers(accessToken) {
  const range = encodeURIComponent(`${ADMIN_WORKSHEET}!A:C`);
  const url = `${SHEETS_BASE}/${SPREADSHEET_ID}/values/${range}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 400 || text.includes('Unable to parse range')) {
      throw Object.assign(
        new Error(
          'Admin users sheet tab not found. Create an "admin_users" tab with columns: username, password, display_name',
        ),
        { status: 500 },
      );
    }
    throw Object.assign(new Error(`Failed to read admin users: ${text}`), { status: 500 });
  }

  const data = await response.json();
  return data.values || [];
}

/**
 * Verify credentials against sheet rows.
 * Supports both bcrypt hashes (prefixed with $2) and plaintext (migration fallback).
 */
async function verifyCredentials(rows, username, password) {
  if (!rows || rows.length <= 1) {
    throw Object.assign(new Error('No admin users configured'), { status: 500 });
  }

  const trimmedUsername = username.trim().toLowerCase();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const storedUsername = (row[0] || '').trim().toLowerCase();
    const storedPassword = (row[1] || '').trim();
    const displayName = row[2] || storedUsername;

    if (storedUsername !== trimmedUsername) continue;

    let match = false;
    if (storedPassword.startsWith('$2')) {
      // bcrypt hash
      match = await bcrypt.compare(password, storedPassword);
    } else {
      // Plaintext fallback (temporary, until migration script is run)
      match = storedPassword === password;
    }

    if (match) {
      return { name: displayName, email: storedUsername };
    }
  }

  // Generic message to prevent username enumeration
  throw Object.assign(new Error('Invalid username or password'), { status: 401 });
}
