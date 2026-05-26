/**
 * Centralized branding configuration for Amit General Store.
 * Every component that displays the store name imports from this file.
 * To rebrand, change only this file.
 *
 * Translatable strings (tagline, sign-in subheadline, PDF title) have been
 * moved to src/i18n/locales/{en,hi}.json under the "branding" and "pdf" keys.
 */

export const BUSINESS_NAME = 'Amit General Store';
export const APP_TITLE_SUFFIX = 'Receipts';

// Google Drive folder names
export const DRIVE_ROOT_FOLDER = `${BUSINESS_NAME} - Receipts`;
export const DRIVE_BILLS_FOLDER = 'bills';
export const DRIVE_PAYMENTS_FOLDER = 'payments';

// Google Sheet name
export const SHEET_NAME = `${BUSINESS_NAME} - Receipt Database`;
export const SHEET_WORKSHEET = 'records';
export const ADMIN_USERS_WORKSHEET = 'admin_users';

// Export file naming patterns
export const CSV_FILENAME_PREFIX = 'amit_general_store_receipts';
export const BACKUP_FILENAME_PREFIX = 'amit_general_store_backup';

// Sign-in page (business name is not translated)
export const SIGN_IN_HEADLINE = BUSINESS_NAME;

/**
 * Build a browser tab title.
 * Accepts either a PAGE_TITLES key (for backwards compat) or a pre-translated string.
 * @param {string} pageName - Translated page name (e.g., "Dashboard", "डैशबोर्ड")
 * @returns {string} e.g. "Amit General Store · Dashboard"
 */
export function buildPageTitle(pageName) {
  return `${BUSINESS_NAME} \u00b7 ${pageName}`;
}
