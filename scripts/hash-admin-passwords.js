#!/usr/bin/env node
/**
 * One-time migration script: hash plaintext admin passwords with bcrypt.
 *
 * Usage:
 *   SA_CLIENT_EMAIL=... SA_PRIVATE_KEY=... SA_SPREADSHEET_ID=... node scripts/hash-admin-passwords.js
 *
 * What it does:
 *   1. Reads the admin_users sheet (columns A:C)
 *   2. For each row where column B is NOT already a bcrypt hash ($2a$/$2b$),
 *      replaces the plaintext password with a bcrypt hash (cost 10)
 *   3. Writes the hashed passwords back to column B
 *
 * This script is idempotent — running it twice won't re-hash already-hashed passwords.
 */

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const SA_EMAIL = process.env.SA_CLIENT_EMAIL;
const SA_PRIVATE_KEY = process.env.SA_PRIVATE_KEY;
const SPREADSHEET_ID = process.env.SA_SPREADSHEET_ID;

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const ADMIN_WORKSHEET = 'admin_users';

if (!SA_EMAIL || !SA_PRIVATE_KEY || !SPREADSHEET_ID) {
  console.error('Missing required env vars: SA_CLIENT_EMAIL, SA_PRIVATE_KEY, SA_SPREADSHEET_ID');
  process.exit(1);
}

async function main() {
  console.log('Getting Service Account token...');
  const accessToken = await getServiceAccountToken();

  console.log('Reading admin_users sheet...');
  const range = encodeURIComponent(`${ADMIN_WORKSHEET}!A:C`);
  const getUrl = `${SHEETS_BASE}/${SPREADSHEET_ID}/values/${range}`;
  const getRes = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!getRes.ok) {
    const text = await getRes.text();
    console.error(`Failed to read sheet: ${text}`);
    process.exit(1);
  }

  const data = await getRes.json();
  const rows = data.values || [];

  if (rows.length <= 1) {
    console.log('No admin users found (only header row or empty). Nothing to do.');
    return;
  }

  console.log(`Found ${rows.length - 1} admin user(s). Checking passwords...`);

  let updated = 0;
  const updates = []; // { row: 1-based sheet row, hash: bcrypt hash }

  for (let i = 1; i < rows.length; i++) {
    const password = (rows[i][1] || '').trim();
    if (!password) {
      console.log(`  Row ${i + 1}: empty password, skipping`);
      continue;
    }
    if (password.startsWith('$2')) {
      console.log(`  Row ${i + 1}: already hashed, skipping`);
      continue;
    }

    const hash = await bcrypt.hash(password, 10);
    updates.push({ row: i + 1, hash });
    console.log(`  Row ${i + 1}: will hash (username: ${rows[i][0]})`);
    updated++;
  }

  if (updates.length === 0) {
    console.log('All passwords are already hashed. Nothing to do.');
    return;
  }

  console.log(`\nHashing ${updated} password(s)...`);

  // Write each hashed password back to column B
  const batchData = updates.map((u) => ({
    range: `${ADMIN_WORKSHEET}!B${u.row}`,
    values: [[u.hash]],
  }));

  const batchUrl = `${SHEETS_BASE}/${SPREADSHEET_ID}/values:batchUpdate`;
  const batchRes = await fetch(batchUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: batchData,
    }),
  });

  if (!batchRes.ok) {
    const text = await batchRes.text();
    console.error(`Failed to write hashes: ${text}`);
    process.exit(1);
  }

  console.log(`Done! ${updated} password(s) hashed successfully.`);
}

async function getServiceAccountToken() {
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
    throw new Error(`Token exchange failed: ${text}`);
  }

  const data = await response.json();
  return data.access_token;
}

function signJwt(payload) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const pem = SA_PRIVATE_KEY.replace(/\\n/g, '\n');

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign(pem, 'base64url');

  return `${signingInput}.${signature}`;
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
