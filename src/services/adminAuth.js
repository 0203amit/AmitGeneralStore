/**
 * Admin credential verification against the "admin_users" sheet tab.
 * Passwords are stored as plain text in the spreadsheet.
 * Uses gapi.client.sheets which must already be initialized with a valid token.
 */
import { ADMIN_USERS_WORKSHEET } from '../config/branding';
import { getSpreadsheetId } from './sheetsService';

/**
 * Verify admin credentials against the admin_users sheet tab.
 * @param {string} username
 * @param {string} password - Plain text password
 * @returns {Promise<{name: string, email: string}>} Admin user info
 * @throws {Error} If credentials are invalid or sheet is not set up
 */
export async function verifyAdminCredentials(username, password) {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) throw new Error('Spreadsheet not provisioned');

  let rows;
  try {
    const response = await window.gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${ADMIN_USERS_WORKSHEET}!A:C`,
    });
    rows = response.result.values;
  } catch (err) {
    if (err.status === 400 || err.result?.error?.message?.includes('Unable to parse range')) {
      throw new Error(
        'Admin users sheet tab not found. Create an "admin_users" tab with columns: username, password, display_name'
      );
    }
    throw err;
  }

  if (!rows || rows.length <= 1) {
    throw new Error('No admin users configured. Add admin rows to the admin_users sheet tab.');
  }

  const trimmedUsername = username.trim().toLowerCase();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const storedUsername = (row[0] || '').trim().toLowerCase();
    const storedPassword = (row[1] || '').trim();
    const displayName = row[2] || storedUsername;

    if (storedUsername === trimmedUsername && storedPassword === password) {
      return { name: displayName, email: storedUsername };
    }
  }

  throw new Error('Invalid username or password');
}
