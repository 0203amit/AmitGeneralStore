/**
 * Google Drive API v3 service for folder provisioning and file operations.
 * Uses gapi.client.drive for metadata operations and fetch() for
 * binary file uploads/downloads (multipart upload, alt=media download).
 */
import { DRIVE_ROOT_FOLDER, DRIVE_BILLS_FOLDER, DRIVE_PAYMENTS_FOLDER } from '../config/branding';
import { getAccessToken } from './googleAuth';

let cachedFolderIds = null;

/**
 * Ensure the app's folder structure exists in Google Drive.
 * Creates root folder with bills/ and payments/ subfolders idempotently.
 * Safe to call on every sign-in — skips creation if folders already exist.
 * @returns {Promise<{rootId: string, billsId: string, paymentsId: string}>}
 * @throws {Error} If Drive API calls fail
 */
export async function ensureAppFolder() {
  if (cachedFolderIds) return cachedFolderIds;

  const rootId = await findOrCreateFolder(DRIVE_ROOT_FOLDER, null);
  const [billsId, paymentsId] = await Promise.all([
    findOrCreateFolder(DRIVE_BILLS_FOLDER, rootId),
    findOrCreateFolder(DRIVE_PAYMENTS_FOLDER, rootId),
  ]);

  cachedFolderIds = { rootId, billsId, paymentsId };
  return cachedFolderIds;
}

/**
 * Return the cached folder IDs, or null if not yet provisioned.
 * @returns {{rootId: string, billsId: string, paymentsId: string}|null}
 */
export function getFolderIds() {
  return cachedFolderIds;
}

/**
 * Clear cached folder IDs. Called on sign-out.
 */
export function clearFolderCache() {
  cachedFolderIds = null;
}

/**
 * Find an existing folder by name (and optional parent), or create it.
 * @param {string} name - Folder name
 * @param {string|null} parentId - Parent folder ID, or null for root-level
 * @returns {Promise<string>} The folder's Drive file ID
 * @throws {Error} If Drive API calls fail
 */
async function findOrCreateFolder(name, parentId) {
  let q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) q += ` and '${parentId}' in parents`;

  const response = await window.gapi.client.drive.files.list({
    q,
    fields: 'files(id)',
    spaces: 'drive',
  });

  const files = response.result.files;
  if (files && files.length > 0) return files[0].id;

  const metadata = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) metadata.parents = [parentId];

  const createResponse = await window.gapi.client.drive.files.create({
    resource: metadata,
    fields: 'id',
  });

  return createResponse.result.id;
}

/**
 * Upload an image to the appropriate Drive subfolder via multipart/related upload.
 * Uses fetch() with binary-safe body construction (gapi.client does not
 * support multipart binary uploads).
 * @param {Blob} imageBlob - Processed JPEG image
 * @param {'bill'|'payment'} type - Determines subfolder (bills or payments)
 * @param {string} recordId - UUID for file naming
 * @returns {Promise<{fileId: string, webViewLink: string}>}
 * @throws {Error} If Drive upload fails
 */
export async function uploadImage(imageBlob, type, recordId) {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const folderIds = getFolderIds();
  if (!folderIds) throw new Error('Drive folders not provisioned');

  const parentId = type === 'bill' ? folderIds.billsId : folderIds.paymentsId;
  const fileName = `${recordId}_${type}.jpg`;

  // Build multipart/related body with binary-safe concatenation
  const boundary = '---receipt_tracker_boundary';
  const metadata = JSON.stringify({ name: fileName, parents: [parentId] });

  const metadataPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`;
  const mediaHeader = `--${boundary}\r\nContent-Type: image/jpeg\r\n\r\n`;
  const closingBoundary = `\r\n--${boundary}--`;

  const encoder = new TextEncoder();
  const metadataBytes = encoder.encode(metadataPart);
  const mediaHeaderBytes = encoder.encode(mediaHeader);
  const closingBytes = encoder.encode(closingBoundary);
  const imageBuffer = await imageBlob.arrayBuffer();

  const body = new Uint8Array(
    metadataBytes.length + mediaHeaderBytes.length + imageBuffer.byteLength + closingBytes.length,
  );
  let offset = 0;
  body.set(metadataBytes, offset);
  offset += metadataBytes.length;
  body.set(mediaHeaderBytes, offset);
  offset += mediaHeaderBytes.length;
  body.set(new Uint8Array(imageBuffer), offset);
  offset += imageBuffer.byteLength;
  body.set(closingBytes, offset);

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Drive upload failed (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  return { fileId: result.id, webViewLink: result.webViewLink };
}

/**
 * Get the web view URL for a Drive file.
 * @param {string} fileId
 * @returns {Promise<string>} webViewLink
 */
export async function getImageUrl(fileId) {
  const response = await window.gapi.client.drive.files.get({
    fileId,
    fields: 'webViewLink',
  });
  return response.result.webViewLink;
}

/**
 * Download image content as a Blob (for PDF embedding).
 * Uses alt=media endpoint with OAuth token for proper CORS support.
 * @param {string} fileId
 * @returns {Promise<Blob>}
 */
export async function getImageBlob(fileId) {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated. Please sign in again.');
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Failed to download image (${response.status})`);
  return response.blob();
}

/**
 * Delete a file from Drive. Used for atomic save rollback.
 * Treats 404 as success (file already deleted).
 * @param {string} fileId
 * @returns {Promise<void>}
 */
export async function deleteImage(fileId) {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete image (${response.status})`);
  }
}
