# Feature Specification: Receipt Tracker

**Feature Branch**: `001-receipt-tracker`

**Created**: 2026-05-21

**Status**: Draft

**Input**: User description: "Amit General Store Receipt Tracker — a web app for archiving paid trader bills with their payment receipts as long-term proof for dispute resolution."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Capture & Save a Bill-Payment Record (Priority: P1)

The store owner receives a paper bill from a trader (e.g., Sharma Traders, INV-001, ₹4,250). The owner pays via GPay and gets a confirmation screenshot. The owner opens the app on their phone, uploads the bill photo and the payment screenshot, reviews OCR-extracted fields, and saves the record. The entire flow takes under 60 seconds. After saving, the bill image, payment image, and extracted data are stored permanently in the owner's own Google account.

**Why this priority**: Without data capture, nothing else works. This is the foundational flow that creates the proof archive the entire app exists for.

**Independent Test**: Can be fully tested by signing in, uploading two images, reviewing extracted fields, and confirming the record appears in the owner's Google Sheet and Drive folder.

**Acceptance Scenarios**:

1. **Given** the owner is signed in and on the Upload page, **When** they add only a bill image but no payment image, **Then** the "Extract & Save" button remains disabled and helper text says "Add a payment receipt to continue."
2. **Given** the owner has added both a bill image and a payment image, **When** they tap "Extract & Save," **Then** the app sends both images for OCR in parallel and shows a progress indicator (e.g., "Extracting bill... Extracting payment...").
3. **Given** the OCR extraction is complete, **When** the extracted fields are displayed in the confirmation form, **Then** the owner can review and edit any extracted field (trader name, invoice number, amounts, dates, UTR, payment mode) before saving.
4. **Given** the owner clicks "Save Record," **When** the composite key (trader_name + invoice_number + bill_date) matches an existing active record, **Then** the app blocks the save and shows a duplicate modal with options: "View existing record," "Save anyway as new record," or "Cancel."
5. **Given** the owner clicks "Save Record" and no duplicate exists, **When** the save completes, **Then** both images are uploaded to the owner's Google Drive, a row is appended to the Google Sheet, and a success toast appears.
6. **Given** the payment image upload fails after the bill image was already uploaded, **When** the save operation detects the failure, **Then** the already-uploaded bill image is deleted from Drive and no row is written to the Sheet (atomic rollback).
7. **Given** the owner is on mobile, **When** they tap the bill image zone, **Then** the primary action is "Take photo" using the rear camera; for the payment zone, the primary action is "Choose from gallery."

---

### User Story 2 — Search & Find Past Payments (Priority: P2)

Three years after saving a record, a trader calls claiming the owner never paid invoice INV-001. The owner opens the app, types "Sharma INV-001" in the search box, and instantly sees the matching record with bill date, amount, UTR number, and payment mode. The owner can also filter by date range, payment mode, amount, or trader name to narrow results.

**Why this priority**: The entire app exists for dispute resolution. If the owner cannot find a record within seconds during a phone call with a trader, the app has failed its purpose.

**Independent Test**: Can be tested by loading the History page with pre-existing records, typing partial trader names or invoice numbers in the search box, and verifying results appear in under 50ms.

**Acceptance Scenarios**:

1. **Given** the History page is loaded with all active records, **When** the owner types "Sharma" in the search box, **Then** all records with "Sharma" in trader_name, payer_name, payee_name, or trader_address appear instantly (within 50ms after debounce).
2. **Given** the owner has typed "INV-001" in the search box, **When** records from multiple traders share that invoice number, **Then** all matching records are shown (different traders can have the same invoice number).
3. **Given** the owner selects date range "May 2026" and payment mode "GPay," **When** results are filtered, **Then** only records matching ALL active filters are shown (AND logic).
4. **Given** multiple filters are active, **When** the owner views the filter area, **Then** each active filter is shown as a removable chip, and a "Clear All Filters" button is available.
5. **Given** filters are applied, **When** the owner copies the URL from the browser, **Then** the filter state is encoded in URL query parameters and opening that URL restores the same filtered view.
6. **Given** the History page is loaded with 5,000 records, **When** the page finishes loading, **Then** the total load time is under 2 seconds.

---

### User Story 3 — Generate & Share Proof Packet (Priority: P3)

During a dispute call, the owner finds the matching record and taps "Generate Proof Packet." The app creates a 4-page PDF: a branded cover page with "Amit General Store" and all key details, the original bill image, the original payment screenshot, and a data summary. The owner shares the PDF via WhatsApp or email directly from the app. Alternatively, the owner copies a plain-text proof summary for quick chat messages.

**Why this priority**: This is the headline feature — the culmination of the dispute-resolution workflow. Capturing and searching are enablers; the proof packet is what actually resolves disputes.

**Independent Test**: Can be tested by opening a record detail view, tapping "Generate Proof Packet," verifying the 4-page PDF contents, and testing each share option (download, WhatsApp, email, copy text).

**Acceptance Scenarios**:

1. **Given** the owner is viewing a record's detail page, **When** they tap "Generate Proof Packet," **Then** a 4-page PDF is generated client-side containing: Page 1 (cover with store branding, trader name, invoice number, bill date, amount, UTR, payment date, payment mode, record creation timestamp), Page 2 (full-page bill image with caption), Page 3 (full-page payment image with caption), Page 4 (extracted data summary table with generation timestamp).
2. **Given** a proof packet PDF has been generated, **When** the owner taps "Share via WhatsApp," **Then** the device's native share sheet opens with the PDF attached (via Web Share API on mobile).
3. **Given** a proof packet PDF has been generated, **When** the owner taps "Share via Email," **Then** a mailto link opens with pre-filled subject and body referencing the record.
4. **Given** the owner taps "Copy proof summary," **When** the text is copied to clipboard, **Then** it contains a plain-text summary with trader name, invoice number, bill date, amount, payment mode, UTR, and payment date — ready to paste into a chat.
5. **Given** the owner selects multiple records on the History page, **When** they tap "Export selected as proof," **Then** a combined PDF is generated with a cover page listing all records followed by each record's individual pages.

---

### User Story 4 — Review & Correct Record Details (Priority: P4)

The owner notices that OCR misread the trader name as "Shrma Traders" instead of "Sharma Traders." The owner opens the record detail, taps "Edit," corrects the trader name, and saves. The edit count increments, the last_edited_at timestamp updates, but the original images and created_at timestamp remain unchanged.

**Why this priority**: OCR is imperfect, especially for handwritten bills. The owner must be able to correct extracted text to ensure accurate search results, while the immutable image evidence remains untouched.

**Independent Test**: Can be tested by opening a record, editing a text field, saving, and verifying: the field is updated, edit_count increased, last_edited_at set, and immutable fields (record_id, created_at, image IDs) are unchanged.

**Acceptance Scenarios**:

1. **Given** the owner opens a record detail view, **When** they tap "Edit," **Then** all editable fields become available: OCR-extracted fields (trader name, invoice number, bill date, bill amount, currency, trader address, UTR, payment date, payment mode, paid amount, payer name, payee name) and user-added fields (notes, tags).
2. **Given** the owner is in edit mode, **When** they view the record_id, created_at, and image file ID fields, **Then** these fields are displayed as read-only and cannot be modified.
3. **Given** the owner edits the trader_name from "Shrma Traders" to "Sharma Traders" and saves, **When** the save completes, **Then** edit_count increments by 1, last_edited_at is set to the current timestamp, last_edited_field is set to "trader_name," and a success toast appears.
4. **Given** the owner views the record detail, **When** both original images are displayed, **Then** they are shown side by side (or stacked on mobile) fetched from Drive, unmodified from the original upload.

---

### User Story 5 — Archive & Restore Records (Priority: P5)

The owner realizes they accidentally created a duplicate record. They open the record, tap the archive button, confirm in the dialog, and the record disappears from the default History view. Months later, the owner goes to Settings → Archive, finds the record, and restores it.

**Why this priority**: Records are legal proof and must never be permanently deleted from within the app. Soft-archive prevents accidental data loss while keeping the History view clean.

**Independent Test**: Can be tested by archiving a record, verifying it disappears from History, navigating to Settings → Archive, and restoring it.

**Acceptance Scenarios**:

1. **Given** the owner taps "Archive" on a record, **When** the confirmation dialog appears, **Then** it reads: "Archive this record? It will be hidden from the main view but never deleted. You can restore it anytime from the Archive page."
2. **Given** the owner confirms archiving, **When** the operation completes, **Then** the record's status is set to 'archived,' archived_at is set to the current timestamp, the owner can optionally provide an archived_reason, the row remains in the Sheet, images remain in Drive, and the record is hidden from the default History view.
3. **Given** the owner navigates to Settings → Archive, **When** they find a previously archived record, **Then** they can tap "Restore" to set status back to 'active' and the record reappears in History.
4. **Given** any page in the app, **When** the owner looks for a "Delete" or "Permanently remove" button, **Then** no such button exists anywhere in the application.

---

### User Story 6 — Dashboard & Spending Overview (Priority: P6)

The owner opens the Dashboard to review monthly spending. They see total amount spent this month and last month, the number of records created this month, a breakdown of spending by payment mode, and the top 5 traders by total spend.

**Why this priority**: Provides at-a-glance financial awareness. While not critical for dispute resolution, it helps the owner understand spending patterns and spot anomalies.

**Independent Test**: Can be tested by loading the Dashboard with pre-existing records and verifying summary cards and charts display correct aggregated data.

**Acceptance Scenarios**:

1. **Given** the owner navigates to the Dashboard, **When** the page loads, **Then** summary cards display: total spent this month, total spent last month, and number of records created this month.
2. **Given** records exist with various payment modes, **When** the Dashboard loads, **Then** a payment mode breakdown chart shows the distribution across GPay, PhonePe, Paytm, Net Banking, Card, and Other.
3. **Given** records exist from multiple traders, **When** the Dashboard loads, **Then** a top-5 traders chart shows the five traders with the highest total spend.

---

### User Story 7 — Export Data & Full Backup (Priority: P7)

The owner wants a local copy of all data. From the History page, they export the current filtered view as CSV. From Settings, they tap "Download full backup" to get a ZIP file containing a complete CSV export plus all bill and payment images.

**Why this priority**: Data portability and redundancy. Even though data lives in the owner's Google account, local backups provide an additional safety net against account issues.

**Independent Test**: Can be tested by exporting a CSV from the History page and verifying columns match the data model, and by triggering a full backup and verifying the ZIP contains the CSV and all images.

**Acceptance Scenarios**:

1. **Given** the owner is on the History page with filters applied, **When** they tap "Export to CSV," **Then** a CSV file is downloaded containing all records matching the current filter (or all records if no filter is active), with columns matching the full data model.
2. **Given** the owner toggles "Include archived" before exporting CSV, **When** the export runs, **Then** archived records are included with a status column showing their archived state.
3. **Given** the owner navigates to Settings and taps "Download full backup," **When** the backup completes, **Then** a ZIP file is downloaded containing: a full CSV of all records (including archived), a /bills/ folder with all bill images, a /payments/ folder with all payment images, and a README explaining how to reconstruct the database.
4. **Given** the backup involves 5+ years of data, **When** the download is in progress, **Then** a progress bar shows download progress.

---

### User Story 8 — First-Time Sign-In & Storage Setup (Priority: P8)

A new user opens the app for the first time and sees the sign-in page with "Amit General Store" branding. They sign in with their Google account. The app automatically creates the required folder structure in their Google Drive and a spreadsheet in Google Sheets. The user is redirected to the Dashboard.

**Why this priority**: This is the gateway to the app. Without authentication and storage provisioning, no other feature functions. Ranked P8 because it's a one-time setup that only happens once per user — it's foundational infrastructure, not a recurring workflow.

**Independent Test**: Can be tested by signing in with a fresh Google account and verifying the Drive folder structure and Sheet are created, then signing out and back in to verify no duplicate folders/sheets are created.

**Acceptance Scenarios**:

1. **Given** a user visits the app for the first time without being signed in, **When** the landing page loads, **Then** it shows "Amit General Store" as the headline, "Receipt & payment archive" as the subheadline, and a "Sign in with Google" button.
2. **Given** the user taps "Sign in with Google," **When** they complete the OAuth consent flow, **Then** the app creates a folder "/Amit General Store - Receipts/" with subfolders "/bills/" and "/payments/" in their Google Drive, and a spreadsheet named "Amit General Store - Receipt Database" in Google Sheets.
3. **Given** the user has previously signed in and the folder/sheet already exist, **When** they sign in again, **Then** the app detects the existing folder and sheet and does not create duplicates.
4. **Given** the user is signed in, **When** they navigate to any page, **Then** the browser tab title shows "Amit General Store · {page name}" and the navbar displays the store wordmark with "Receipt archive" subtitle.
5. **Given** the user taps "Sign Out" from the navbar dropdown, **When** the sign-out completes, **Then** the access token is revoked, in-memory state is cleared, and the user is redirected to the landing page.

---

### Edge Cases

- What happens when both images are identical (same file uploaded to both zones)? The app accepts it — the owner may have a legitimate reason.
- What happens when OCR returns zero fields (completely blank extraction)? All fields are shown as empty editables; the owner fills them manually. The record is flagged as "needs review."
- What happens when the Google Sheets API is temporarily unavailable during save? The atomic save fails, both uploaded images are rolled back (deleted from Drive), and the owner sees an error toast: "Save failed. Please try again."
- What happens when a user inspects the DOM and force-enables the disabled save button? The form submission handler re-validates both images before proceeding. If validation fails, an error toast appears: "Both bill and payment receipt are required." The save flow does not start.
- What happens when two records from different traders have the same invoice number (e.g., both "INV-001")? This is normal and expected. The composite key includes trader_name, so these are distinct records saved without any warning.
- What happens when the same trader reuses an invoice number on a different date? The composite key includes bill_date, so these are distinct records. An informational toast appears: "Note: You've used invoice {INV-001} from {trader_name} before on {prev_date}."
- What happens when the owner tries to archive a record that is already archived? The archive button is not shown for already-archived records. Only "Restore" is available.
- What happens when image file size exceeds 10 MB? The upload zone rejects the file immediately with an error message: "File too large. Maximum size is 10 MB."
- What happens when the owner uploads a HEIC image (common on iOS)? The app auto-converts it to JPEG before uploading to Drive.
- What happens when the owner has no internet during search/filter? Search and filter operate on in-memory data already loaded. They work offline once the initial data fetch is complete. New saves require internet.
- What happens when the owner edits trader_name, invoice_number, or bill_date and the new values match another record's composite key? The system recomputes the composite key, re-runs duplicate detection, and shows the same duplicate warning modal used during initial save. The owner can proceed, view the conflicting record, or cancel the edit.

## Requirements *(mandatory)*

### Functional Requirements

**Authentication & Storage Setup**

- **FR-001**: The system MUST authenticate the owner via their Google account using OAuth 2.0, requesting scopes for Drive file access, Sheets access, and user profile.
- **FR-002**: On first sign-in, the system MUST auto-create a designated folder structure in the owner's Google Drive (root folder with /bills/ and /payments/ subfolders) and a spreadsheet in Google Sheets for the receipt database.
- **FR-003**: On subsequent sign-ins, the system MUST detect existing storage resources and not create duplicates.
- **FR-004**: The system MUST store access credentials in volatile memory only — never in persistent browser storage.
- **FR-005**: On sign-out, the system MUST revoke the access token, clear all in-memory state, and redirect to the landing page.

**Image Upload & Handling**

- **FR-006**: The system MUST require both a bill image AND a payment receipt image before allowing a record to be saved. The save control MUST remain disabled until both images are provided.
- **FR-007**: Each image drop zone MUST support three input methods: (a) take a photo with the device camera, (b) choose an existing image from the gallery/file system, (c) drag and drop a file (desktop).
- **FR-008**: The bill image zone MUST default to rear camera capture (for photographing physical paper bills). The payment image zone MUST default to gallery selection (payment screenshots are usually pre-existing).
- **FR-009**: The system MUST accept JPG, JPEG, and PNG image formats, with a maximum file size of 10 MB per image. PDF uploads are not supported — bills are photographed paper invoices and payment receipts are phone screenshots, both of which are always image files.
- **FR-010**: For images exceeding 5 MB, the system MUST apply mild compression (quality 0.9, max width 2500px) while preserving text legibility. The system MUST NEVER compress to the point where text becomes unreadable.
- **FR-011**: The system MUST auto-convert HEIC images to JPEG and auto-rotate images based on EXIF orientation data.
- **FR-012**: The system MUST NEVER modify original image content after upload — no cropping, no filters, no watermarks, no annotations, no re-compression of stored images.
- **FR-013**: After image selection, the system MUST display a preview with "Replace" and "Remove" options.
- **FR-014**: The system MUST display contextual helper text indicating which image is missing (e.g., "Add a payment receipt to continue" when only the bill is uploaded).

**OCR Extraction**

- **FR-015**: The system MUST extract bill fields from the bill image via OCR: trader name, trader address (optional), invoice number, bill date, total amount, and currency (default: INR).
- **FR-016**: The system MUST extract payment fields from the payment receipt via OCR with regex fallback for UPI screenshots: UTR number, payment date, payment mode, paid amount, payer name (optional), and payee name (optional).
- **FR-017**: The system MUST auto-detect payment mode from OCR text using pattern matching: "Google Pay"/"GPay" → GPay, "PhonePe" → PhonePe, "Paytm" → Paytm, "IMPS"/"NEFT"/"RTGS"/bank names → Net Banking, card patterns → Card, otherwise → Other.
- **FR-018**: For any OCR-extracted field with confidence below 0.7, the system MUST flag the field as "needs review."
- **FR-019**: The system MUST display ALL extracted fields in an editable confirmation form before saving. The owner MUST be able to correct any field.
- **FR-020**: During OCR extraction, the system MUST display a progress indicator. The UI MUST NOT appear frozen.

**Atomic Save & Data Integrity**

- **FR-021**: Save operations MUST be atomic. If any step fails (first image upload, second image upload, or Sheet row write), all previously completed steps in that save MUST be rolled back.
- **FR-022**: Rollback sequence: (a) If Sheet write fails → delete both images from Drive. (b) If second image upload fails → delete the first image from Drive; do not write to Sheet. (c) If first image upload fails → abort entirely.
- **FR-023**: There MUST be no orphaned files in Drive (images without a Sheet row) and no incomplete rows in the Sheet (rows without both images).
- **FR-024**: The system MUST compute a composite key as: lowercase(trim(trader_name)) + "|" + lowercase(trim(invoice_number)) + "|" + bill_date. Comparison is case-insensitive and whitespace-trimmed.
- **FR-025**: Before saving a new record, the system MUST check the composite key against all existing active records. If an exact match is found, the save MUST be blocked and a duplicate modal shown with options: "View existing record," "Save anyway as new record," or "Cancel."
- **FR-026**: Records from different traders sharing the same invoice number MUST save without any warning (this is normal).
- **FR-027**: The same trader reusing an invoice number on a different date MUST save normally, with an optional informational toast noting the previous use.

**Record Immutability & Audit Trail**

- **FR-028**: The following fields are immutable once a record is created and MUST NEVER be modifiable through the app: record_id, created_at, bill_image_file_id, bill_image_url, payment_image_file_id, payment_image_url.
- **FR-029**: All OCR-extracted text fields (trader name, invoice number, bill date, bill amount, currency, trader address, UTR number, payment date, payment mode, paid amount, payer name, payee name) MUST be editable to correct OCR errors.
- **FR-030**: Each edit MUST increment edit_count (which MUST never decrease), update updated_at and last_edited_at timestamps, and record the last_edited_field name.
- **FR-030a**: When trader_name, invoice_number, or bill_date are edited, the system MUST recompute the composite key and re-run duplicate detection against all other active records. If the new composite key collides with another record, the system MUST warn the owner with the same duplicate modal used during initial save (FR-025), offering options to proceed, view the conflicting record, or cancel the edit.
- **FR-031**: The status field MUST only have two values: 'active' and 'archived.' There is no 'deleted' status.

**History, Search & Filter**

- **FR-032**: The History page MUST display all active records in a table, sorted by bill date descending (newest first) by default.
- **FR-033**: Desktop table MUST show columns: Date (DD MMM YYYY), Trader Name (clickable → detail), Invoice Number (clickable → copies to clipboard), Amount (₹ formatted, right-aligned), Payment Mode (colored badge), UTR Number (truncated with tooltip), and Actions (View, Edit, Archive).
- **FR-034**: Mobile table MUST show a condensed layout: Date + Trader Name stacked, Amount + Payment Mode stacked, with tap-to-open detail.
- **FR-035**: The search box MUST perform free-text, case-insensitive substring search across: trader_name, invoice_number, utr_number, payer_name, payee_name, and trader_address simultaneously.
- **FR-036**: Filters MUST include: date range (from/to with quick presets: This Month, Last Month, Last 3 Months, This Year, All Time), payment mode (multi-select checkboxes with OR logic among selected modes), amount range (min/max), and trader name (multi-select dropdown auto-populated from existing records).
- **FR-037**: All active filters MUST combine with AND logic (e.g., search "Sharma" AND mode "GPay" AND date range "May 2026" shows only records matching all conditions).
- **FR-038**: Active filters MUST be shown as removable chips with a "Clear All Filters" button.
- **FR-039**: Filter state MUST persist in URL query parameters (e.g., /history?search=sharma&mode=gpay&from=2026-05-01) so filtered views are shareable and bookmarkable.
- **FR-040**: Sorting MUST be available by: Bill Date (newest/oldest), Amount (highest/lowest), Trader Name (A-Z/Z-A), and Created Date (newest/oldest).
- **FR-041**: Pagination MUST default to 25 rows per page with configurable options: 10, 25, 50, 100. Total record count MUST be displayed (e.g., "Showing 1-25 of 247 records").
- **FR-042**: Records with low OCR confidence MUST display a "Needs review" badge.

**Record Detail & Edit**

- **FR-043**: The record detail view MUST display all bill fields, all payment fields, and both original images side by side (stacked on mobile), fetched from Drive.
- **FR-044**: The detail view MUST provide an "Edit" button that makes all non-immutable fields editable.
- **FR-045**: Immutable fields (record_id, created_at, image file IDs/URLs) MUST be displayed as read-only in edit mode.
- **FR-046**: The detail view MUST include a "Download Images" option to download both images.

**Archive (No Hard Delete)**

- **FR-047**: The archive action MUST show a confirmation dialog: "Archive this record? It will be hidden from the main view but never deleted. You can restore it anytime from the Archive page."
- **FR-048**: On archive confirmation, the system MUST set status='archived,' set archived_at to the current timestamp, and accept an optional archived_reason. The Sheet row and Drive images MUST be preserved.
- **FR-049**: Archived records MUST be hidden from the default History view but accessible from Settings → Archive.
- **FR-050**: The restore flow MUST set status back to 'active,' and the record MUST reappear in the History view. The archived_at and archived_reason MUST be preserved in the record for audit trail.
- **FR-051**: There MUST be NO hard-delete button, "permanently remove" option, or any mechanism within the app that permanently destroys a record, its Sheet row, or its Drive images.

**Proof Packet PDF**

- **FR-052**: The system MUST generate a single-record Proof Packet as a 4-page PDF: Page 1 (cover with store branding, "Payment Proof" title, trader name, invoice number, bill date, amount, UTR number, payment date, payment mode, generation date, record creation timestamp), Page 2 (full-page original bill image with caption), Page 3 (full-page original payment receipt image with caption), Page 4 (extracted data summary table with footer).
- **FR-053**: The Proof Packet MUST be generated entirely client-side (no server round-trip).
- **FR-054**: After generation, the system MUST offer share options: download PDF, share via WhatsApp (Web Share API), share via email (mailto link with pre-filled subject/body), and copy plain-text proof summary to clipboard.
- **FR-055**: The plain-text proof summary MUST include: trader name, invoice number, bill date, amount, payment mode, UTR number, and payment date in a clean, paste-ready format.
- **FR-056**: The system MUST support bulk proof packet generation: select multiple records on History page → generate a combined PDF with a cover listing all records, followed by each record's individual pages.

**Dashboard**

- **FR-057**: The Dashboard MUST display summary cards: total amount spent this month, total amount spent last month (both aggregated by bill_date, not created_at), and number of records created this month (aggregated by created_at).
- **FR-058**: The Dashboard MUST display a payment mode breakdown chart showing distribution across all payment modes.
- **FR-059**: The Dashboard MUST display a top-5 traders chart ranked by total spend amount.

**Export & Backup**

- **FR-060**: The History page MUST provide a "Export to CSV" button that exports the current filtered view (or all records if no filter is active).
- **FR-061**: CSV export MUST include a toggle to include archived records (with status column).
- **FR-062**: The Settings page MUST provide a "Download full backup" button that generates a ZIP containing: full CSV of all records (including archived), a /bills/ folder with all bill images, a /payments/ folder with all payment images, and a README file.
- **FR-063**: Full backup MUST show a progress bar during download for large datasets.

**Branding**

- **FR-064**: The store name "Amit General Store" MUST appear consistently in: navbar wordmark (with "Receipt archive" subtitle), browser tab title ("Amit General Store · {page name}"), sign-in page headline, Proof Packet PDF cover and page footers, CSV export filenames (amit_general_store_receipts_{date}.csv), backup ZIP filenames (amit_general_store_backup_{date}.zip), Drive folder name ("Amit General Store - Receipts"), and Sheet name ("Amit General Store - Receipt Database").
- **FR-065**: All branding text MUST be sourced from a single configuration file so that rebranding requires changing only one file.

**Notifications & Confirmations**

- **FR-066**: Toast notifications MUST appear for all save, edit, archive, and restore operations confirming the outcome.
- **FR-067**: All destructive or significant actions (archive, bulk export, sign-out) MUST require explicit confirmation via a dialog before executing.

**Pages & Navigation**

- **FR-068**: The app MUST have six page routes: Landing/Sign-in (/), Dashboard (/dashboard), Upload (/upload), History (/history), Record Detail (/history/:recordId), and Settings (/settings).
- **FR-069**: Every authenticated page MUST display a persistent navbar with: store branding (left), navigation links — Dashboard, Upload, History, Settings (center), and user avatar with email and sign-out dropdown (right).
- **FR-070**: The Settings page MUST include: sign-out, archive management (view/restore archived records), full backup download, backup best practices documentation, app info, and direct links to the owner's Drive folder and Sheet.

**Architecture & Data Ownership**

- **FR-071**: The application MUST operate as a fully client-side app with no backend server. All data operations (read, write, search, filter) MUST happen in the browser or directly against Google APIs.
- **FR-072**: All user data (images and structured records) MUST reside exclusively in the owner's own Google account.
- **FR-073**: The application MUST NOT include any analytics, telemetry, or tracking of user behavior or data.

### Key Entities

- **Receipt Record**: The central entity linking a trader's bill to its proof of payment. Contains bill fields (trader name, address, invoice number, date, amount, currency), payment fields (UTR, date, mode, amount, payer, payee), references to both original images, OCR confidence scores, audit trail (created_at, edit_count, last_edited_at), status (active/archived), and optional notes/tags. Uniquely identified by record_id (UUID) and uniqueness-checked via composite_key (trader_name + invoice_number + bill_date).

- **Bill Image**: A photograph or scan of a physical paper bill from a trader. Stored in the owner's Drive under /bills/. The file reference (file_id, URL) is immutable once saved. The image content is never modified by the app.

- **Payment Image**: A screenshot or photo of a payment confirmation (UPI, net banking, card receipt). Stored in the owner's Drive under /payments/. The file reference is immutable once saved. The image content is never modified by the app.

- **Composite Key**: A derived uniqueness identifier computed as lowercase(trim(trader_name)) + "|" + lowercase(trim(invoice_number)) + "|" + bill_date. Used for duplicate detection before save. Case-insensitive and whitespace-normalized.

- **Proof Packet**: A generated 4-page PDF document combining store branding, record metadata, both original images, and an extracted data summary. Used to resolve payment disputes by sharing with traders via WhatsApp, email, or as plain text.

## Success Criteria *(mandatory)*

### Measurable Outcomes

**Authentication & Setup**

- **SC-001**: Owner can sign in with their Google account and see their email displayed in the navbar.
- **SC-002**: Browser tab title shows "Amit General Store · {page name}" on every page.
- **SC-003**: Navbar displays "Amit General Store" wordmark with "Receipt archive" subtitle on every authenticated page.
- **SC-004**: On first sign-in, the app auto-creates the "/Amit General Store - Receipts/" folder structure in Drive (with /bills/ and /payments/ subfolders).
- **SC-005**: On first sign-in, the app auto-creates the "Amit General Store - Receipt Database" spreadsheet in Sheets.

**Upload & Image Handling**

- **SC-006**: Owner MUST upload both a bill image and a payment image to save a record.
- **SC-007**: The save button stays disabled when only a bill image is uploaded.
- **SC-008**: The save button stays disabled when only a payment image is uploaded.
- **SC-009**: Helper text guides the owner on which image is missing.
- **SC-010**: Owner can take a photo with the device camera for the bill image.
- **SC-011**: Owner can take a photo with the device camera for the payment image.
- **SC-012**: Owner can choose an existing image from the device gallery or file system.
- **SC-013**: Owner can drag and drop images on desktop browsers.
- **SC-014**: Camera defaults to rear (environment) camera for bill capture.
- **SC-015**: Images exceeding the compression threshold are auto-compressed before upload while preserving legibility.
- **SC-016**: HEIC images (iOS) are auto-converted to JPEG.
- **SC-017**: Images auto-rotate based on EXIF orientation data.

**Data Integrity**

- **SC-018**: Save operation is atomic — partial records are never created in the Sheet.
- **SC-019**: If save fails partway, already-uploaded Drive files are cleaned up (no orphaned files).
- **SC-020**: Duplicate detection uses composite key (trader_name + invoice_number + bill_date).
- **SC-021**: Saving a record with all 3 composite key fields matching an existing active record is blocked.
- **SC-022**: Duplicate modal shows the existing matching record with options to view it, force-save, or cancel.
- **SC-023**: Owner can force-save a duplicate as a new record for rare legitimate cases.
- **SC-024**: Different traders with the same invoice number can both be saved without conflict.
- **SC-025**: Same trader with the same invoice number on different dates can be saved without conflict.
- **SC-026**: Duplicate matching is case-insensitive and whitespace-trimmed.

**OCR Extraction**

- **SC-027**: OCR extracts bill fields with >70% accuracy on printed bills (Tesseract.js; manual review compensates for lower accuracy).
- **SC-028**: Regex + OCR extracts UTR number, amount, and date from UPI payment screenshots.
- **SC-029**: Payment mode is auto-detected for GPay, PhonePe, Paytm, and net banking.
- **SC-030**: Owner can review and edit all extracted fields before saving.

**Record Save**

- **SC-031**: Saving a record uploads both images to Drive and appends a complete row to the Sheet.

**History & Search**

- **SC-032**: History page shows all active records sorted by date descending.
- **SC-033**: Search box finds records by trader name (e.g., "Sharma" finds all Sharma Traders bills).
- **SC-034**: Search box finds records by invoice number (exact or partial match).
- **SC-035**: Search box finds records by UTR number (exact or partial match).
- **SC-036**: Search results appear within 50ms of the owner finishing typing.
- **SC-037**: Filter by date range works (from/to with quick presets).
- **SC-038**: Filter by payment mode works (multi-select).
- **SC-039**: Filter by amount range works (min/max).
- **SC-040**: Multiple filters combine with AND logic.
- **SC-041**: Active filters are shown as removable chips.
- **SC-042**: Filter state persists in URL query parameters (shareable links).
- **SC-043**: Sort by date, amount, or trader name works.

**Edit & Audit Trail**

- **SC-044**: Owner can edit all non-immutable fields of an existing record.
- **SC-045**: Owner CANNOT edit immutable fields (record_id, created_at, image file IDs).
- **SC-046**: Editing a record increments edit_count and updates last_edited_at.

**Archive**

- **SC-047**: Records are archived, NEVER deleted from within the app.
- **SC-048**: Archived records remain in Drive and Sheet (just hidden from the default History view).
- **SC-049**: Owner can restore archived records anytime from Settings → Archive.

**Proof Packet**

- **SC-050**: Owner can view both original images in the record detail view.
- **SC-051**: Owner can generate a single-record Proof Packet PDF with cover page, both images, and data summary.
- **SC-052**: Proof Packet PDF can be downloaded, shared via WhatsApp, or emailed.
- **SC-053**: Proof Packet PDFs show "Amit General Store" prominently on cover and in page footers.
- **SC-054**: Owner can generate a Bulk Proof Packet for multiple selected records.
- **SC-055**: Owner can copy a plain-text proof summary for chat messages.

**Export & Backup**

- **SC-056**: CSV export works for filtered records (with option to include archived).
- **SC-057**: CSV exports use store-branded filenames.
- **SC-058**: Settings page provides "Download full backup" (ZIP with CSV + all images).
- **SC-059**: Backup ZIP uses store-branded filename.
- **SC-060**: Settings page documents backup best practices.

**Image Preservation**

- **SC-061**: Original images are preserved at high quality (no aggressive compression by the app).
- **SC-062**: App never modifies image content (no cropping, filters, or watermarks applied).

**Dashboard**

- **SC-063**: Dashboard shows monthly total spent, record count, and payment mode breakdown.

**Architecture & Ownership**

- **SC-064**: All data is stored in the owner's own Google account (full data ownership).
- **SC-065**: App runs on free hosting tier indefinitely for 100 records/month volume.
- **SC-066**: App is responsive on mobile (capture receipt with phone → upload).
- **SC-067**: No backend server is required.
- **SC-068**: App is deployed and accessible via a public URL.

**Longevity**

- **SC-069**: Records remain searchable and proof-packet-exportable 3+ years after creation.

## Phased Delivery Plan

Build in this order so each phase is independently testable:

**Phase 1: Project Setup**
1. Create project with build tooling, styling framework, and routing
2. Set up Google Cloud project, enable APIs, create OAuth credentials
3. Implement Google sign-in flow
4. Verify sign-in works → see user email displayed

**Phase 2: Drive Integration**
5. Implement folder provisioning — creates the branded receipt folder structure
6. Implement image upload — upload a test image, verify it appears in Drive
7. Implement image retrieval — display uploaded image in app

**Phase 3: Sheets Integration**
8. Implement spreadsheet provisioning — creates the receipt database
9. Implement record append — write a dummy row, verify in Sheet
10. Implement record fetch — read rows back, display in a basic table

**Phase 4: OCR Integration (Tesseract.js)**
11. Integrate Tesseract.js browser-based OCR engine (no cloud setup required)
12. Implement bill field extraction with regex patterns — test with 10+ real bill images (printed and handwritten, per Constitution VII). Expected accuracy: ~75-85%
13. Implement payment field extraction with regex patterns — test with 10+ real payment screenshots (GPay, PhonePe, Paytm, net banking, card, per Constitution VII)
14. Refine regex patterns based on real-world data

**Phase 5: End-to-End Upload Flow**
15. Build Upload page with dual image drop zones
16. Wire up: upload → extract → show confirmation form → save
17. Verify: row appears in Sheet, images appear in Drive, atomic rollback works

**Phase 6: History Page**
18. Build records table with sort and pagination
19. Add filter bar with search, date range, payment mode, amount, trader
20. Build record detail view with image preview

**Phase 7: Edit & Archive**
21. Implement record edit flow (with audit trail updates)
22. Implement archive flow with confirmation (soft-delete only)

**Phase 8: Dashboard**
23. Build monthly summary cards
24. Build payment mode and top-trader charts

**Phase 9: Polish & Deploy**
25. Add CSV export and Proof Packet PDF generation
26. Add toast notifications and confirmation dialogs
27. Mobile responsive polish
28. Deploy to hosting platform
29. Update OAuth credentials with production URL

## Assumptions

- The owner has a Google account with sufficient Drive storage (Google provides 15 GB free, and 10 years of receipts at ~100/month is estimated at ~12 GB of images).
- The owner has a stable internet connection when uploading new records (search/filter works offline after initial data load).
- The application is single-user: one Google account owns all data. Multi-user or shared access is out of scope for v1.
- Record volume is approximately 100 records per month (~1,200 per year). The application is designed for up to 50,000 total records before any architectural changes would be needed.
- The owner primarily uses a mobile phone to capture bill photos and payment screenshots, making mobile-first design essential.
- Traders issue paper bills with printed or handwritten text. OCR accuracy varies; the editable confirmation form compensates for extraction errors.
- UPI payment apps (GPay, PhonePe, Paytm) are the primary payment methods. Net banking and card payments are secondary.
- Disputes typically arise 6 months to 3 years after payment, making long-term data retention and fast retrieval critical.
- The owner is the sole user of the app and does not need role-based access control, admin features, or multi-tenancy.
- Currency is Indian Rupees (INR) by default. Multi-currency conversion is out of scope for v1.

## Clarifications

### Session 2026-05-21

- Q: When the owner edits trader_name, invoice_number, or bill_date (the three composite key fields), should the system recompute the composite key and re-run duplicate detection? → A: Yes — recompute composite key on edit, re-run duplicate detection, and warn the owner if a collision is found (same duplicate modal as initial save).
- Q: Should dashboard "total spent this month/last month" aggregate by bill_date (when the purchase happened) or created_at (when the record was entered)? → A: Aggregate spending by bill_date. Record count ("records created this month") uses created_at.

## Out of Scope

The following are explicitly **not** part of v1:

- Multi-user or shared records
- Admin dashboard or role-based access
- Backend server or database other than Google Sheets
- Mobile native app (web app only, but mobile-responsive)
- Automatic recurring bill detection
- Bank account integration or auto-import
- Email parsing of e-bills
- Tax categorization or GST handling
- Multi-currency conversion
- Receipt forgery detection
- Notification system (email/SMS reminders)
