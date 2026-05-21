# Tasks: Receipt Tracker

**Input**: Design documents from `/specs/001-receipt-tracker/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/google-api-contracts.md, quickstart.md

**Tests**: No automated tests — manual verification per phase (Constitution VII). Dedicated manual verification tasks for constitution-mandated testing scenarios are included in Phase 10.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing. User Story 8 (Sign-In & Storage Setup) is mapped to Phase 2 (Foundational) since authentication and storage provisioning are prerequisites for all other stories.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, build tooling, styling, and routing scaffold

- [x] T001 Initialize Vite + React 18 project with all production and dev dependencies in package.json and vite.config.js
- [x] T002 [P] Configure Tailwind CSS with PostCSS in tailwind.config.js, postcss.config.js, and base styles in src/index.css
- [x] T003 [P] Create .env.example with VITE_GOOGLE_CLIENT_ID, VITE_GOOGLE_PROJECT_NUMBER and create .gitignore
- [x] T004 [P] Create centralized branding configuration with all store name constants, folder names, sheet names, and file naming patterns in src/config/branding.js
- [x] T005 Create index.html with meta tags and branding, public/favicon.svg, src/main.jsx entry point, and src/App.jsx with React Router v6 defining 6 routes (/, /dashboard, /upload, /history, /history/:recordId, /settings)

**Checkpoint**: Project builds with `npm run dev`, all routes render placeholder content, Tailwind styles apply.

---

## Phase 2: Foundational (Auth & Storage Provisioning)

**Purpose**: Google OAuth authentication, Drive/Sheets provisioning, and shared UI components. Covers User Story 8 (First-Time Sign-In & Storage Setup, P8) as foundational infrastructure.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T006 Implement Google OAuth service (initGoogleAuth, signIn, signOut, getAccessToken, isAuthenticated, silent token re-auth) in src/services/googleAuth.js
- [x] T007 Create AuthContext provider with Google OAuth state, access token in memory, gapi client initialization, and post-sign-in provisioning trigger in src/context/AuthContext.jsx
- [x] T008 [P] Create useAuth hook exposing user info, sign-in/out actions, and loading state in src/hooks/useAuth.js
- [x] T009 [P] Create SignInButton component with Google branding and store headline in src/components/auth/SignInButton.jsx
- [x] T010 [P] Create ProtectedRoute component that redirects unauthenticated users to landing page in src/components/auth/ProtectedRoute.jsx
- [x] T011 Implement Drive folder provisioning (ensureAppFolder with idempotent root folder + /bills/ and /payments/ subfolders creation) in src/services/driveService.js
- [x] T012 Implement Sheets provisioning (ensureAppSheet with idempotent spreadsheet creation, records worksheet, and 31-column header row A:AE) in src/services/sheetsService.js
- [x] T013 [P] Create Navbar with store wordmark, "Receipt archive" subtitle, nav links (Dashboard, Upload, History, Settings), user avatar with email, and sign-out dropdown in src/components/shared/Navbar.jsx
- [x] T014 [P] Create Toast notification component with success/error/info variants and auto-dismiss in src/components/shared/Toast.jsx
- [x] T015 [P] Create LoadingSpinner component for async operations in src/components/shared/LoadingSpinner.jsx
- [x] T016 Wire up landing page with "Amit General Store" headline, "Receipt & payment archive" subheadline, SignInButton, and post-sign-in redirect to /dashboard in src/App.jsx

**Checkpoint**: User can sign in with Google, Drive folder structure and Sheet are auto-created, Navbar shows user email, sign-out works and clears state, browser tab shows "Amit General Store · {page}".

---

## Phase 3: User Story 1 — Capture & Save a Bill-Payment Record (Priority: P1) MVP

**Goal**: Owner can upload a bill image and payment receipt, review OCR-extracted fields, and save a complete record with atomic rollback guarantees.

**Independent Test**: Sign in, navigate to Upload, add bill photo + payment screenshot, tap "Extract & Save," review extracted fields, save, verify row in Google Sheet and images in Drive folder.

### Implementation for User Story 1

- [x] T017 [P] [US1] Create image processing pipeline (HEIC→JPEG via heic2any, EXIF auto-rotation, compression for files >5MB at quality 0.9 / max 2500px via browser-image-compression) in src/utils/imageProcessor.js
- [x] T018 [P] [US1] Create payment mode auto-detection with pattern matching (GPay, PhonePe, Paytm, Net Banking, Card, Other) from OCR text in src/utils/paymentModeDetector.js
- [x] T019 [P] [US1] Create OCR text parser with regex-based field extraction (trader name from first line, invoice number from INV-/BL-/BILL- patterns or labels, date from DD/MM/YY patterns, amount from ₹ symbol or Total/Amount labels) with confidence scoring in src/utils/parseOcrText.js
- [x] T020 [US1] Implement Tesseract.js OCR service (extractBillFields, extractPaymentFields) using browser-based Tesseract.js worker with singleton pattern in src/services/ocrService.js. OCR accuracy ~75-85% (lower than Document AI's ~92%; manual review form compensates)
- [x] T021 [US1] Implement Drive image upload (multipart/related via fetch), image URL retrieval, image blob download (for PDF), and image deletion (for rollback) in src/services/driveService.js
- [x] T022 [US1] Implement Sheets record append (appendRecord with 31 columns), fetch all records (getAllRecords with header→object mapping and row index tracking), and composite key computation (computeCompositeKey) in src/services/sheetsService.js
- [x] T023 [US1] Implement atomic save orchestration (saveRecord: upload bill → upload payment → append sheet, with rollback on failure per error handling contracts) and duplicate detection against active records in src/services/recordService.js
- [x] T024 [P] [US1] Create ImageDropzone component with react-dropzone for drag-and-drop/browse, separate camera input via hidden native input with capture attribute, preview with Replace/Remove, file type/size validation (JPG/JPEG/PNG only, 10MB max), and contextual helper text in src/components/upload/ImageDropzone.jsx
- [x] T025 [P] [US1] Create CameraCapture component with rear-camera default (capture="environment") for bill zone and gallery default for payment zone in src/components/upload/CameraCapture.jsx
- [x] T026 [US1] Create ExtractionForm component displaying all OCR-extracted fields as editable inputs, flagging low-confidence fields (<0.7) as "needs review," with field validation in src/components/upload/ExtractionForm.jsx
- [x] T027 [US1] Create useUpload hook orchestrating the full workflow (image processing → parallel OCR extraction → form display → duplicate check → atomic save) with progress state in src/hooks/useUpload.js
- [x] T028 [US1] Create UploadPage with dual image zones (bill primary=camera, payment primary=gallery), "Extract & Save" button (disabled until both images provided), submit handler MUST independently re-validate both images are present regardless of button state (defense against DOM manipulation), progress indicators during OCR, ExtractionForm for review, duplicate detection modal with View/Save Anyway/Cancel options, and success toast in src/components/upload/UploadPage.jsx

**Checkpoint**: Owner can capture/upload two images, OCR extracts fields, review and edit fields, save record atomically. Row appears in Sheet, images appear in Drive. Duplicate detection blocks matching composite keys. Rollback cleans up on failure.

---

## Phase 4: User Story 2 — Search & Find Past Payments (Priority: P2)

**Goal**: Owner can search, filter, sort, and paginate through all saved records to quickly find proof of payment during a dispute.

**Independent Test**: Load History page with existing records, search by trader name or invoice number, apply date/mode/amount filters, verify results appear within 50ms, verify URL query params persist filter state.

### Implementation for User Story 2

- [x] T029 [P] [US2] Create date helper utilities (DD MMM YYYY formatting, YYYY-MM-DD parsing, quick filter presets: This Month, Last Month, Last 3 Months, This Year, All Time) in src/utils/dateHelpers.js
- [x] T030 [US2] Create useRecords hook with in-memory search (case-insensitive substring across trader_name, invoice_number, utr_number, payer_name, payee_name, trader_address), multi-filter with AND logic, sortBy (date/amount/trader/created), pagination (10/25/50/100 per page), and lodash debounce (300ms) in src/hooks/useRecords.js
- [x] T031 [P] [US2] Create FilterBar with free-text search box, date range picker with quick presets, payment mode multi-select checkboxes, amount range (min/max), trader name multi-select dropdown, removable filter chips, and "Clear All Filters" button in src/components/history/FilterBar.jsx
- [x] T032 [US2] Create RecordsTable with sortable columns (Date, Trader, Invoice, Amount, Payment Mode, UTR, Actions), pagination controls with total count, desktop layout (full columns) and mobile layout (stacked date+trader, amount+mode), clickable trader→detail, clickable invoice→copy, "Needs review" badge, and colored payment mode badges in src/components/history/RecordsTable.jsx
- [x] T033 [US2] Create RecordDetail view displaying all bill fields, payment fields, audit trail, and both original images side-by-side (stacked on mobile) fetched from Drive, with "Download Images" option at route /history/:recordId in src/components/history/RecordDetail.jsx
- [x] T034 [US2] Create HistoryPage integrating FilterBar and RecordsTable, syncing filter/search/sort/pagination state to URL query parameters for shareable/bookmarkable views, and fetching records via useRecords in src/components/history/HistoryPage.jsx

**Checkpoint**: History page loads all active records sorted by date descending. Search finds records by partial trader name or invoice number in <50ms. Filters combine with AND logic. URL reflects filter state and can be bookmarked.

---

## Phase 5: User Story 3 — Generate & Share Proof Packet (Priority: P3)

**Goal**: Owner can generate a branded 4-page Proof Packet PDF for any record and share it via WhatsApp, email, or as plain text for dispute resolution.

**Independent Test**: Open a record detail, tap "Generate Proof Packet," verify 4-page PDF (cover, bill image, payment image, data summary), download PDF, test WhatsApp share (Web Share API), email link, and copy plain-text summary.

### Implementation for User Story 3

- [x] T035 [P] [US3] Implement single-record 4-page Proof Packet PDF generation using jsPDF (Page 1: branded cover with store name, trader, invoice, dates, amounts, UTR, mode; Page 2: bill image fetched from Drive as blob→dataURL; Page 3: payment image; Page 4: data summary table with generation timestamp and footer) and plain-text proof summary (generatePlainTextSummary) in src/services/recordService.js
- [x] T036 [US3] Implement bulk Proof Packet PDF generation (cover page listing all selected records, followed by each record's 4 individual pages) via generateBulkProofPacketPDF in src/services/recordService.js
- [x] T037 [US3] Add proof packet UI to RecordDetail: "Generate Proof Packet" button, "Download PDF" via file-saver, "Share via WhatsApp" via Web Share API, "Share via Email" via mailto with pre-filled subject/body, and "Copy proof summary" to clipboard in src/components/history/RecordDetail.jsx
- [x] T038 [US3] Add multi-record checkbox selection and "Export selected as proof" button triggering bulk PDF generation to HistoryPage in src/components/history/HistoryPage.jsx

**Checkpoint**: Single-record proof packet generates a 4-page branded PDF. Share via WhatsApp/email works on mobile. Plain-text summary copies to clipboard. Bulk proof packet works for multiple selected records.

---

## Phase 6: User Story 4 — Review & Correct Record Details (Priority: P4)

**Goal**: Owner can edit OCR-extracted fields to correct extraction errors while preserving immutable image evidence and maintaining an audit trail.

**Independent Test**: Open a record, tap "Edit," change trader_name, save, verify edit_count incremented, last_edited_at updated, and immutable fields unchanged.

### Implementation for User Story 4

- [x] T039 [US4] Implement record update with audit trail (updateRecord targeting row by record_id, incrementing edit_count, setting updated_at, last_edited_at, last_edited_field) in src/services/sheetsService.js and editRecord orchestration in src/services/recordService.js
- [x] T040 [US4] Add edit mode to RecordDetail: "Edit" button toggles all OCR-extracted fields to editable inputs, displays immutable fields (record_id, created_at, image file IDs) as read-only, and "Save" button commits changes with audit trail update in src/components/history/RecordDetail.jsx
- [x] T041 [US4] Implement composite key recomputation when trader_name, invoice_number, or bill_date are edited, re-run duplicate detection against all other active records, and show duplicate warning modal if collision found in src/services/recordService.js

**Checkpoint**: Owner can edit any non-immutable field, edit_count increments, last_edited_at updates. Immutable fields are read-only. Editing composite key fields triggers duplicate re-detection.

---

## Phase 7: User Story 5 — Archive & Restore Records (Priority: P5)

**Goal**: Owner can soft-archive records (never delete) and restore them from the Archive page in Settings.

**Independent Test**: Archive a record from its detail page, verify it disappears from History, navigate to Settings → Archive, find and restore it, verify it reappears in History.

### Implementation for User Story 5

- [x] T042 [US5] Implement archive (set status='archived', set archived_at, accept optional archived_reason) and restore (set status='active', preserve archived_at/reason for audit) operations in src/services/sheetsService.js
- [x] T043 [US5] Add archive button with confirmation dialog ("Archive this record? It will be hidden from the main view but never deleted. You can restore it anytime from the Archive page.") to RecordDetail, hide archive button for already-archived records, show "Restore" instead in src/components/history/RecordDetail.jsx
- [x] T044 [US5] Create SettingsPage at /settings with archive management section (list archived records, restore button for each), sign-out button, app info, and direct links to owner's Drive folder and Sheet in src/components/settings/SettingsPage.jsx

**Checkpoint**: Archiving hides record from History default view. No delete button exists anywhere. Archived records visible and restorable from Settings → Archive. Restored records reappear in History.

---

## Phase 8: User Story 6 — Dashboard & Spending Overview (Priority: P6)

**Goal**: Owner sees at-a-glance monthly spending, record counts, payment mode breakdown, and top traders on the Dashboard.

**Independent Test**: Load Dashboard with existing records, verify summary cards show correct totals (aggregated by bill_date for spending, by created_at for record count), and charts display accurate data.

### Implementation for User Story 6

- [x] T045 [P] [US6] Create MonthlySummary component with summary cards: total spent this month (by bill_date), total spent last month (by bill_date), and records created this month (by created_at), all formatted with ₹ currency in src/components/dashboard/MonthlySummary.jsx
- [x] T046 [P] [US6] Create PaymentModeChart (payment mode distribution pie/bar chart across GPay, PhonePe, Paytm, Net Banking, Card, Other) and top-5 traders bar chart (ranked by total spend) using recharts in src/components/dashboard/PaymentModeChart.jsx
- [x] T047 [US6] Create DashboardPage fetching all active records via sheetsService.getAllRecords (direct call, no useRecords dependency), computing aggregations in-component (monthly totals by bill_date, record count by created_at, payment mode distribution, top-5 traders by total spend), and rendering MonthlySummary + PaymentModeChart + top traders chart in src/components/dashboard/DashboardPage.jsx

**Checkpoint**: Dashboard displays correct monthly totals, record counts, payment mode distribution, and top-5 traders chart.

---

## Phase 9: User Story 7 — Export Data & Full Backup (Priority: P7)

**Goal**: Owner can export filtered records as CSV and download a full backup ZIP with all data and images.

**Independent Test**: Export CSV from History page (verify columns match data model), trigger full backup from Settings (verify ZIP contains CSV + /bills/ + /payments/ folders + README).

### Implementation for User Story 7

- [x] T048 [P] [US7] Create CSV export utility generating CSV string with all 31 data model columns, branded filename (amit_general_store_receipts_{date}.csv), and optional archived record inclusion in src/utils/csvExporter.js
- [x] T049 [US7] Add "Export to CSV" button with "Include archived" toggle to HistoryPage, exporting current filtered view (or all records if no filter) via file-saver in src/components/history/HistoryPage.jsx
- [x] T050 [US7] Implement full backup ZIP generation (downloadFullBackup: full CSV of all records including archived, /bills/ folder with all bill images fetched from Drive, /payments/ folder with all payment images, and README.txt) using jszip and file-saver with branded filename (amit_general_store_backup_{date}.zip) in src/services/recordService.js
- [x] T051 [US7] Add "Download full backup" button with progress bar to SettingsPage, add backup best practices documentation section in src/components/settings/SettingsPage.jsx

**Checkpoint**: CSV export downloads with correct columns and branding. Full backup ZIP contains CSV, all images organized in folders, and README. Progress bar shows during large backups.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final polish affecting multiple user stories, mobile responsiveness, and deployment readiness

- [x] T052 [P] Add toast notifications for all state-changing operations (save, edit, archive, restore, export, sign-out) with success/error feedback in src/components/upload/UploadPage.jsx, src/components/history/RecordDetail.jsx, src/components/history/HistoryPage.jsx, src/components/settings/SettingsPage.jsx
- [x] T053 [P] Add confirmation dialogs for all destructive/significant actions (archive, bulk export, sign-out) in src/components/history/RecordDetail.jsx, src/components/history/HistoryPage.jsx, src/components/shared/Navbar.jsx
- [x] T054 Mobile responsive polish across all components: mobile-first layouts, touch-friendly tap targets, stacked layouts on small screens, proper viewport meta in src/index.css and all page/component files
- [x] T055 [P] Add "Needs review" badge (low OCR confidence) display in src/components/history/RecordsTable.jsx and src/components/history/RecordDetail.jsx
- [x] T056 Configure Vite production build optimization and verify Vercel deployment configuration in vite.config.js
- [x] T057 Run quickstart.md validation: complete manual walkthrough of sign-in, folder/sheet creation, upload, search, proof packet, edit, archive, dashboard, export, and backup
- [ ] T058 Verify OCR extraction with 10+ real bill images (printed and handwritten) and 10+ real payment screenshots (GPay, PhonePe, Paytm, net banking, card) per Constitution VII in src/services/ocrService.js. Expected accuracy: ~75-85% with Tesseract.js (lower than Document AI's ~92%; manual review form compensates). *(requires real images — manual testing, no cloud credentials needed)*
- [ ] T059 Test atomic save/rollback by simulating failures at each step (Drive bill upload failure, Drive payment upload failure, Sheet write failure) and verifying no orphaned files remain in Drive and no incomplete rows in Sheet per Constitution VII in src/services/recordService.js *(requires live Google API credentials — manual testing)*
- [ ] T060 Test duplicate detection edge cases: same invoice number across different traders, same trader with same invoice on different dates, case variations ("Sharma" vs "SHARMA"), and whitespace variations per Constitution VII in src/services/sheetsService.js *(requires live Google Sheets data — manual testing)*

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Foundational — no other story dependencies
- **US2 (Phase 4)**: Depends on US1 (sheetsService.getAllRecords, records must exist)
- **US3 (Phase 5)**: Depends on US2 (RecordDetail view)
- **US4 (Phase 6)**: Depends on US2 (RecordDetail view)
- **US5 (Phase 7)**: Depends on US2 (RecordDetail view, HistoryPage filtering)
- **US6 (Phase 8)**: Depends on US1 (sheetsService.getAllRecords directly — does NOT depend on useRecords hook from US2)
- **US7 (Phase 9)**: Depends on US2 (HistoryPage for CSV) and US5 (SettingsPage for backup)
- **Polish (Phase 10)**: Depends on all user stories being complete

### User Story Dependency Graph

```text
                    ┌──── US3 (Proof Packet)
                    │
Setup → Foundation → US1 → US2 ──┼──── US4 (Edit)
                    │             │
                    │             └──── US5 (Archive) ──┐
                    │                                    │
                    └──── US6 (Dashboard)    US7 (Export) ◄─── US2 + US5
```

### Within Each User Story

- Utilities before services (utils/ before services/)
- Services before components (services/ before components/)
- Hooks before pages (hooks/ before page components)
- Core implementation before integration
- Complete story before moving to next priority

### Parallel Opportunities

**Phase 1**: T002, T003, T004 can run in parallel after T001
**Phase 2**: T008, T009, T010 can run in parallel; T013, T014, T015 can run in parallel
**Phase 3**: T017, T018, T019 (utilities) in parallel; T024, T025 (dropzone components) in parallel
**Phase 4**: T029, T031 can run in parallel
**Phase 5**: T035 can run in parallel with other Phase 5 prep
**Phase 6**: US3, US4, US5 can all start in parallel after US2 completes
**Phase 8**: T045, T046 (dashboard components) in parallel
**Phase 9**: T048 can run in parallel with other Phase 9 prep

---

## Parallel Example: User Story 1

```bash
# Launch all utility modules in parallel (different files, no deps):
Task: T017 "Image processing pipeline in src/utils/imageProcessor.js"
Task: T018 "Payment mode detector in src/utils/paymentModeDetector.js"
Task: T019 "OCR text parser in src/utils/parseOcrText.js"

# After utilities, launch dropzone components in parallel:
Task: T024 "ImageDropzone in src/components/upload/ImageDropzone.jsx"
Task: T025 "CameraCapture in src/components/upload/CameraCapture.jsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 — Capture & Save
4. **STOP and VALIDATE**: Upload real bill + payment images, verify OCR extraction, save to Sheet + Drive, test atomic rollback
5. Deploy to Vercel as MVP

### Incremental Delivery

1. Setup + Foundational → Sign-in and storage provisioning work
2. Add US1 (Capture & Save) → **MVP deployed** — owner can archive receipts
3. Add US2 (Search & Find) → Owner can find records during disputes
4. Add US3 (Proof Packet) → Owner can generate and share proof PDFs
5. Add US4 (Edit) → Owner can correct OCR errors
6. Add US5 (Archive) → Owner can clean up History view
7. Add US6 (Dashboard) → Owner sees spending overview
8. Add US7 (Export & Backup) → Owner has data portability
9. Polish → Mobile-responsive, toast notifications, deployment

### After US2 — Parallel Story Strategy

Once US2 (History + RecordDetail) is complete, US3, US4, and US5 can proceed in parallel since they extend RecordDetail and HistoryPage independently:
- US3 adds proof packet generation UI
- US4 adds edit mode UI
- US5 adds archive button and SettingsPage

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in the same phase
- [Story] label maps task to specific user story for traceability
- No automated tests — manual verification per phase per Constitution VII
- All branding sourced from src/config/branding.js — single file for rebranding
- All Google API calls from browser with user's OAuth token — no backend
- Token stored in memory only — never in localStorage or cookies
- Atomic save with rollback ensures no orphaned Drive files or incomplete Sheet rows
