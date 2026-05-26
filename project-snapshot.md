# Project Snapshot — Amit General Store Receipt Tracker

**Generated**: 2026-05-26
**Sources scanned**: 10 project markdown files (CLAUDE.md, Description.md, and the eight files under `specs/001-receipt-tracker/`) plus all `.jsx`/`.js` files under `src/`.

---

## Current state of the spec

The spec describes a single-user, client-side-only React + Vite web app that lets the owner of "Amit General Store" archive trader bills paired with their payment receipts as long-term proof for dispute resolution. Authentication is Google OAuth 2.0, storage is the user's own Google Drive (images) and Google Sheets (a 31-column `records` worksheet), OCR runs entirely in the browser via Tesseract.js, and the deployment target is the Vercel free tier. The spec is marked Draft (created 2026-05-21), the spec-quality checklist is fully ticked, and `plan.md` records two "ALL PASS" constitution gates (pre- and post-design). `tasks.md` decomposes the work into 10 phases and 60 numbered tasks, of which 57 are checked off (T001–T057) and 3 remain unchecked (T058–T060, all of which are manual-verification tasks under Constitution VII: OCR accuracy on real images, atomic save/rollback simulation, and duplicate-detection edge cases).

---

## Features by status

Status is derived from `tasks.md`, where `[x]` = done and `[ ]` = pending. Each user story (US1–US8) is named with its priority and the contributing tasks.

### Done

- **Phase 1 — Project Setup (T001–T005)**: Vite + React 18 scaffold, Tailwind + PostCSS config, `.env.example`, `.gitignore`, branding constants in `src/config/branding.js`, six routes wired in `App.jsx`.
- **Phase 2 — Foundational / US8 First-Time Sign-In & Storage Setup, P8 (T006–T016)**: `googleAuth.js`, `AuthContext`, `useAuth`, `SignInButton`, `ProtectedRoute`, idempotent `ensureAppFolder()` and `ensureAppSheet()`, `Navbar`, `Toast`, `LoadingSpinner`, landing page.
- **Phase 3 — US1 Capture & Save, P1 (T017–T028)**: image processing pipeline (HEIC→JPEG, EXIF rotate, conditional compression), payment-mode detector, OCR text parser, Tesseract.js OCR service, Drive multipart upload + delete, Sheets append/fetch/composite-key, atomic `saveRecord` orchestration with rollback, `ImageDropzone`, `CameraCapture`, `ExtractionForm`, `useUpload`, full `UploadPage` with duplicate modal.
- **Phase 4 — US2 Search & Find, P2 (T029–T034)**: `dateHelpers`, `useRecords` (debounced in-memory search/sort/paginate), `FilterBar`, `RecordsTable` (desktop + mobile), `RecordDetail`, `HistoryPage` with URL-synced filter state.
- **Phase 5 — US3 Proof Packet, P3 (T035–T038)**: single-record 4-page jsPDF generation, bulk PDF generation, share/download UI in `RecordDetail`, multi-select export in `HistoryPage`.
- **Phase 6 — US4 Review & Correct, P4 (T039–T041)**: `updateRecord` with audit trail, edit mode in `RecordDetail`, composite-key recomputation + re-duplicate-detection on edit.
- **Phase 7 — US5 Archive & Restore, P5 (T042–T044)**: archive/restore in `sheetsService`, archive button + confirm dialog, `SettingsPage` with archive list.
- **Phase 8 — US6 Dashboard, P6 (T045–T047)**: `MonthlySummary`, `PaymentModeChart`, `DashboardPage` with in-component aggregations.
- **Phase 9 — US7 Export & Backup, P7 (T048–T051)**: `csvExporter` utility, CSV export button on `HistoryPage`, full-backup ZIP generation via JSZip + file-saver, backup section in `SettingsPage`.
- **Phase 10 — Polish (T052–T057)**: toast notifications, confirmation dialogs, mobile-responsive polish, "Needs review" badge, Vite production build config, and the quickstart walkthrough (T057).

### In progress / pending verification (none coded as "in flight"; these are unchecked manual-verification tasks)

- **T058** Verify OCR extraction with 10+ real bill images and 10+ real payment screenshots — requires real images.
- **T059** Test atomic save/rollback by simulating failures at each step — requires live Google API credentials.
- **T060** Test duplicate-detection edge cases (case, whitespace, cross-trader, same trader/different date) — requires live Sheets data.

### Planned but never started

None at the user-story level — all eight user stories have implementation tasks marked done. The only un-ticked tasks are the three Constitution VII verification items listed above. The "Out of Scope" sections in both Description.md and spec.md list the same eleven exclusions (multi-user, admin dashboard, server backend, native app, recurring-bill detection, bank-account integration, e-bill parsing, GST handling, multi-currency, forgery detection, notifications) and these are explicitly not planned.

---

## Open questions and TODOs

A grep for `TODO`, `FIXME`, `XXX`, `TBD`, `[NEEDS CLARIFICATION]`, and "open question" across the project docs and `src/` returned **zero unresolved items in the spec docs or application code**. The matches that came back are all either (a) inside the `.specify/` and `.claude/` skill templates (tooling, not project content), or (b) literal pattern strings used by the OCR regex (e.g. `INV-XXX`, `BL-XXX`) — not actual TODOs.

The `Clarifications` section of `spec.md` records two questions that were asked and **resolved** during session 2026-05-21:

1. *Should editing a composite-key field re-run duplicate detection?* → Yes (added as FR-030a).
2. *Should dashboard monthly totals aggregate by bill_date or created_at?* → Spending by bill_date, record count by created_at.

The `requirements.md` quality checklist confirms "No [NEEDS CLARIFICATION] markers remain."

The only standing open items are the three unchecked verification tasks called out above (T058, T059, T060), and the two undelivered docs called out in Implementation Gaps below.

---

## Inconsistencies between Description.md and spec.md

`Description.md` is the earlier project brief; `spec.md` is the formal Speckit specification produced from it. They mostly agree, but four substantive contradictions and one internal contradiction inside Description.md are worth flagging:

**1. Accepted upload formats.** Description.md §"Dual Image Upload Layout" (line 226) says accepted formats are "JPG, JPEG, PNG, PDF". spec.md FR-009 says "The system MUST accept JPG, JPEG, and PNG image formats… PDF uploads are not supported — bills are photographed paper invoices and payment receipts are phone screenshots, both of which are always image files." The implementation follows the spec (T024 explicitly: "JPG/JPEG/PNG only, 10MB max").

**2. Compression threshold (Description.md is internally inconsistent).** Description.md §"Image Optimization Before Upload" (line 290) says "If file > 5 MB: apply MILD compression". Description.md §"Success Criteria" (line 1236) says "Images > 2 MB are auto-compressed before upload". The body and the success criteria disagree. spec.md FR-010 settles on 5 MB and that's what the code uses.

**3. CSV export filename (Description.md is internally inconsistent).** Description.md §"Branding" (line 74) says `amit_general_store_receipts_<YYYY-MM-DD>.csv`. Description.md §"CSV Export" (line 645) says `receipts_export_YYYY-MM-DD.csv`. spec.md FR-064 settles on the branded prefix, which is what the implementation uses (`buildCsvFilename` in `csvExporter.js`).

**4. Documentation deliverables.** Description.md §"Deliverables" lists `README.md` and `GOOGLE_CLOUD_SETUP.md` as required deliverables. spec.md does not restate this. Neither file exists in the repo root today.

**5. Phased delivery / build order.** Description.md describes a 9-phase build order (Phases 1–9). spec.md describes the same phases but `tasks.md` reorganises them into 10 phases (the extra phase is "Phase 10: Polish & Cross-Cutting Concerns"). The numbering shift is harmless but worth knowing — when you see "Phase 9" in Description.md it maps to roughly "Phase 9 + Phase 10" in tasks.md.

Otherwise the two documents are aligned: same composite-key rules, same atomic-save semantics, same archive-not-delete policy, same six-route page list, same 8 user stories (spec.md adds explicit priorities P1–P8), same 11 out-of-scope items.

---

## Implementation gaps

The user asked me to compare what's specced against code in `app/` and `routes/`. **Neither directory exists** — this is a Vite + React project and all source lives under `src/`. I compared the spec against `src/` instead.

Below are deviations between the spec/plan/data-model and what's actually in `src/`. They fall into three buckets: spec features missing in code, code that exists but isn't specced, and spec/code data-model disagreements.

### Major architectural deviation — admin login via Service Account

The most significant gap is an undocumented second authentication path that doesn't appear in any spec doc:

- `src/services/serviceAccountAuth.js` accepts `VITE_SA_CLIENT_EMAIL` and `VITE_SA_PRIVATE_KEY` from Vite env vars, builds an RS256-signed JWT in the browser, and exchanges it for a Google access token with full `drive` and `spreadsheets` scopes.
- `src/services/adminAuth.js` reads usernames and **plain-text passwords** from an `admin_users` tab on the same Google Sheet, then authenticates an admin against them.
- `src/components/auth/AdminLoginForm.jsx` renders a username/password form alongside the Google sign-in button.
- `src/context/AuthContext.jsx` orchestrates a hybrid flow: Service Account verifies credentials → silent OAuth gets a user token → OAuth token is then used for ongoing operations.

This conflicts with the spec on several counts:

- **FR-072** ("All user data… MUST reside exclusively in the owner's own Google account") — the admin flow targets a shared Drive/Sheet owned by whoever owns the Service Account.
- **FR-001 / FR-002** (single Google OAuth path, single-user app) — there is now a second sign-in entry point and a notion of multiple admins.
- **FR-004** ("MUST store access credentials in volatile memory only — never in persistent browser storage") — `AuthContext.jsx` writes an `admin_session` blob to `sessionStorage` and silently restores the session on page reload.
- **Security concern, not just a spec gap**: any `VITE_*` env var is inlined into the production JS bundle at build time. Putting an RS256 private key in `VITE_SA_PRIVATE_KEY` means it ships to every browser that loads the app. Passwords in the `admin_users` sheet are also stored in plaintext (the code comment in `adminAuth.js` says so explicitly).
- `User Roles & Permissions` in Description.md states "no admin roles, no multi-tenancy"; this path introduces both.

The Service Account is gated by `isServiceAccountConfigured()`, so if `VITE_SA_CLIENT_EMAIL` and `VITE_SA_PRIVATE_KEY` are blank (as they are in `.env.example`), the admin form is hidden. The path is wired up but optional. It still warrants a spec update or removal decision.

### Data-model disagreement: 31 columns specced, 33 implemented

`data-model.md` and `contracts/google-api-contracts.md` both define a 31-column `records` worksheet spanning **A through AE**. `src/services/sheetsService.js` defines `HEADER_ROW` with 33 entries spanning **A through AG**, and the comment on line 7 says so explicitly: "All 33 column headers in sheet order (A through AG)." The two extra columns are:

- `upi_transaction_id` (column AF)
- `google_transaction_id` (column AG)

These aren't mentioned in `data-model.md`, `spec.md`, `Description.md`, `research.md`, or `contracts/google-api-contracts.md`. Either the spec is out of date or these columns were added speculatively and should be documented or removed.

### Extra page route not in spec

`spec.md` FR-068 enumerates **six** routes: `/`, `/dashboard`, `/upload`, `/history`, `/history/:recordId`, `/settings`. `src/App.jsx` defines a **seventh**: `/drive-test`, mounted to `src/components/upload/DriveTestPage.jsx`. It's behind `ProtectedRoute` and isn't linked from `Navbar`. Looks like a leftover developer-only page; either link it, document it, or remove it before shipping.

### Extra shared component not in plan

`plan.md` lists `Navbar`, `Toast`, and `LoadingSpinner` under `components/shared/`. The codebase also has `components/shared/ConfirmDialog.jsx`, which is used by the polish tasks (T053). Reasonable addition, just not in the planned folder structure.

### Undelivered documentation

Description.md §Deliverables lists:

- `README.md` — **missing from repo root**.
- `Description.md` — present.
- `GOOGLE_CLOUD_SETUP.md` — **missing from repo root**.
- Inline JSDoc on all service functions — present (spot-checked in `sheetsService.js`, `recordService.js`, `serviceAccountAuth.js`, `adminAuth.js`; all have JSDoc).

### Spec-listed dependency not installed

`research.md` lists `html2canvas` in the dependency table but flags it as "may not be needed for v1". `package.json` omits it. Consistent with the research note; mentioning here only because it's the kind of thing a reader might wonder about. No action needed.

### Env-var naming drift

`Description.md` and `quickstart.md` reference `VITE_GOOGLE_PROJECT_ID`. `.env.example` and the actual code use `VITE_GOOGLE_PROJECT_NUMBER`. Functionally fine (the project number is what GCP actually uses for OAuth), but the docs should be updated to match.

### Tooling left in `package.json` "dependencies" instead of "devDependencies"

`@vitejs/plugin-react`, `autoprefixer`, `postcss`, `tailwindcss`, and `vite` are listed under `dependencies` rather than `devDependencies` in `package.json`. Not a spec gap, but worth a cleanup pass — these are build-time only.

### What is fully implemented and matches the spec

To be balanced: the *substantive* feature surface — image upload with both-required validation, dual OCR with Tesseract.js, composite-key duplicate detection (including the FR-030a edit-time re-detection), atomic save with rollback, History page with in-memory search/filter/sort and URL-synced state, Record Detail with image preview and edit mode, single-record and bulk Proof Packet PDFs, archive/restore (no hard delete), Dashboard with monthly summary and charts, CSV export, full-backup ZIP, branded filenames everywhere, mobile-responsive layout — all of these are present in `src/` and match the spec's intent. The implementation is essentially feature-complete against the eight specced user stories; the deviations are concentrated in authentication, the data-model column count, and missing documentation.

---

## Recommended next actions

1. **Decide on the admin/Service Account path**: either remove it and revert to the spec's single-user OAuth model, or update spec.md (FR-001, FR-002, FR-004, FR-072) and Description.md to formalise it — and address the bundled-private-key security issue if keeping it.
2. **Reconcile the 33-vs-31 column count**: update `data-model.md` and `contracts/google-api-contracts.md` to document `upi_transaction_id` and `google_transaction_id`, or remove them from `HEADER_ROW`.
3. **Resolve the `/drive-test` route**: document, link, or delete.
4. **Fix Description.md's internal inconsistencies** (compression threshold 2 MB vs 5 MB, CSV filename pattern).
5. **Write the two missing docs**: `README.md` and `GOOGLE_CLOUD_SETUP.md`.
6. **Run the three remaining manual-verification tasks** (T058, T059, T060) and tick them off in `tasks.md`.
7. **Move build tooling to `devDependencies`** in `package.json`.
