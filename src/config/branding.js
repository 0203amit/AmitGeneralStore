/**
 * Centralized branding configuration for Amit General Store.
 * Every component that displays the store name imports from this file.
 * To rebrand, change only this file.
 */

export const BUSINESS_NAME = 'Amit General Store';
export const BUSINESS_TAGLINE = 'Receipt archive';
export const APP_TITLE_SUFFIX = 'Receipts';

// Google Drive folder names
export const DRIVE_ROOT_FOLDER = `${BUSINESS_NAME} - Receipts`;
export const DRIVE_BILLS_FOLDER = 'bills';
export const DRIVE_PAYMENTS_FOLDER = 'payments';

// Google Sheet name
export const SHEET_NAME = `${BUSINESS_NAME} - Receipt Database`;
export const SHEET_WORKSHEET = 'records';

// Export file naming patterns
export const CSV_FILENAME_PREFIX = 'amit_general_store_receipts';
export const BACKUP_FILENAME_PREFIX = 'amit_general_store_backup';

// PDF branding
export const PDF_TITLE = 'Payment Proof';
export const PDF_FOOTER = BUSINESS_NAME;

// Sign-in page
export const SIGN_IN_HEADLINE = BUSINESS_NAME;
export const SIGN_IN_SUBHEADLINE = 'Receipt & payment archive';

// Page titles (used in browser tab: "Amit General Store · {page}")
export const PAGE_TITLES = {
  landing: APP_TITLE_SUFFIX,
  dashboard: 'Dashboard',
  upload: 'Upload',
  history: 'History',
  detail: 'Record Detail',
  settings: 'Settings',
};

/**
 * Build a browser tab title for a given page key.
 * @param {string} pageKey - One of the keys in PAGE_TITLES
 * @returns {string} e.g. "Amit General Store · Dashboard"
 */
export function buildPageTitle(pageKey) {
  const pageName = PAGE_TITLES[pageKey] || pageKey;
  return `${BUSINESS_NAME} \u00b7 ${pageName}`;
}
