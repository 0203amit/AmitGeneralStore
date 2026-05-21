# Implementation Plan: Receipt Tracker

**Branch**: `001-receipt-tracker` | **Date**: 2026-05-21 | **Spec**: [spec.md](specs/001-receipt-tracker/spec.md)

**Input**: Feature specification from `/specs/001-receipt-tracker/spec.md`

## Summary

Build a client-side-only web application for Amit General Store to archive trader bills paired with their payment receipts as long-term proof of payment for dispute resolution. The app uses React 18 + Vite with Tailwind CSS, authenticates via Google OAuth 2.0, and communicates directly with Google Drive API v3 (image storage), Sheets API v4 (structured records), and Tesseract.js (browser-based OCR extraction) — all from the browser. No backend server.

## Technical Context

**Language/Version**: JavaScript (ES2022+), React 18, Node.js 18+ (build only)

**Primary Dependencies**:
- React 18 with Vite (build tooling)
- Tailwind CSS (styling)
- React Router v6 (routing)
- @react-oauth/google (Google OAuth 2.0 sign-in)
- gapi-script (Google API client loader for Drive, Sheets)
- tesseract.js (browser-based OCR engine — runs entirely client-side, no cloud billing)
- jsPDF (client-side PDF generation for proof packets via programmatic text/image placement)
- browser-image-compression (image compression for files > 5 MB, quality 0.9)
- recharts (dashboard charts)
- lucide-react (icons)
- lodash (debounce, sortBy)
- date-fns (date formatting)
- react-dropzone (drag-and-drop file upload)
- uuid (client-side UUID v4 generation for record_id)
- heic2any (HEIC→JPEG conversion for iOS photos)
- jszip (ZIP generation for full backup export)
- file-saver (trigger browser file downloads for CSV/PDF/ZIP exports)

**Storage**: Google Drive API v3 (image files) + Google Sheets API v4 (structured records) — all in the user's own Google account

**Testing**: Manual verification per phase (as per Constitution VII). No automated test framework in v1 — the app is single-user and manually tested with real bill/payment images.

**Target Platform**: Modern browsers (Chrome, Safari, Firefox, Edge). Mobile-first design (primary use case is phone camera capture). Deployed as static site on Vercel free tier.

**Project Type**: Single-page web application (client-side only, no backend)

**Performance Goals**:
- Search/filter results in < 50ms (in-memory JavaScript operations)
- Initial History page load < 2 seconds for up to 5,000 records
- OCR extraction shows progress indicator (no frozen UI)

**Constraints**:
- No backend server, no external database
- All Google API calls from browser with user's OAuth token
- Free tier hosting (Vercel)
- Image quality preservation: compression only for files > 5 MB, quality 0.9, max width 2500px
- Single-user application (one Google account)

**Scale/Scope**:
- ~100 records/month, ~1,200/year, designed for up to 50,000 total records
- 6 page routes, ~17 components, 5 service modules, 3 hooks, 5 utility modules
- Single Google Sheet with one worksheet

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Code Quality | PASS | Small single-purpose service modules (googleAuth, driveService, sheetsService, ocrService, recordService). All dependencies justified by concrete needs (see Primary Dependencies). JSDoc on all exported service functions. |
| II. Data Ownership | PASS | No backend server. All data in user's Google account (Drive + Sheets). No analytics or telemetry. Static client-side app communicating only with Google APIs via user's OAuth token. |
| III. Data Preservation | PASS | Soft-archive only (status='archived'), no hard delete UI. Images immutable after upload. record_id, created_at, image file IDs/URLs are immutable fields. No image modification by the app. |
| IV. Integrity | PASS | Atomic save with rollback: Sheet write fails → delete both images; second image fails → delete first image; first image fails → abort. No orphaned files, no incomplete rows. |
| V. UX Consistency | PASS | Mobile-first responsive design. Both images required before save (button disabled otherwise). Confirmation dialogs for archive/sign-out. Toast notifications on all state-changing operations. |
| VI. Performance | PASS | In-memory search/filter with lodash debounce (< 50ms). Full record fetch on page load (< 2s for 5,000 rows). Progress indicator during OCR. browser-image-compression at quality 0.9 for files > 5 MB. |
| VII. Testing Discipline | PASS | Phased build order with manual verification per phase. OCR testing with 10+ real images. Atomic save/rollback tested with simulated failures. Duplicate detection edge cases tested. |

**Gate Result**: ALL PASS — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-receipt-tracker/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── google-api-contracts.md
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── auth/
│   │   ├── SignInButton.jsx
│   │   └── ProtectedRoute.jsx
│   ├── upload/
│   │   ├── ImageDropzone.jsx
│   │   ├── CameraCapture.jsx
│   │   ├── ExtractionForm.jsx
│   │   └── UploadPage.jsx
│   ├── history/
│   │   ├── RecordsTable.jsx
│   │   ├── RecordDetail.jsx
│   │   ├── FilterBar.jsx
│   │   └── HistoryPage.jsx
│   ├── dashboard/
│   │   ├── MonthlySummary.jsx
│   │   ├── PaymentModeChart.jsx
│   │   └── DashboardPage.jsx
│   ├── settings/
│   │   └── SettingsPage.jsx
│   └── shared/
│       ├── Navbar.jsx
│       ├── Toast.jsx
│       └── LoadingSpinner.jsx
├── services/
│   ├── googleAuth.js
│   ├── driveService.js
│   ├── sheetsService.js
│   ├── ocrService.js
│   └── recordService.js
├── hooks/
│   ├── useAuth.js
│   ├── useRecords.js
│   └── useUpload.js
├── utils/
│   ├── parseOcrText.js
│   ├── paymentModeDetector.js
│   ├── imageProcessor.js
│   ├── csvExporter.js
│   └── dateHelpers.js
├── context/
│   └── AuthContext.jsx
├── config/
│   └── branding.js
├── App.jsx
├── main.jsx
└── index.css

public/
└── favicon.svg

# Root config files
.env.example
.gitignore
index.html
package.json
tailwind.config.js
vite.config.js
```

**Structure Decision**: Single-project client-side SPA. No backend directory, no separate test directory (manual testing per Constitution VII). All source code under `src/` organized by feature area (components) and concern (services, hooks, utils, context, config).

## Complexity Tracking

No constitution violations to justify. All design decisions align with constitution principles.

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design completion.*

| Principle | Status | Post-Design Evidence |
|-----------|--------|---------------------|
| I. Code Quality | PASS | 4 additional dependencies identified (heic2any, uuid, jszip, file-saver) — each justified by a concrete functional requirement (FR-011, data model, FR-062, export UX). No unnecessary additions. Service module contracts defined with clear single-responsibility boundaries. |
| II. Data Ownership | PASS | OCR runs entirely in-browser via Tesseract.js (no cloud API calls for OCR). No server proxy needed. Google APIs (Drive, Sheets) use browser-based OAuth flow. No `cloud-platform` scope required. |
| III. Data Preservation | PASS | Data model explicitly marks 6 fields as IMMUTABLE. State machine has only 2 states (active/archived) with no delete transition. Image files stored in user's Drive are never re-compressed or modified post-upload. |
| IV. Integrity | PASS | Atomic save contract explicitly defines rollback for all 3 failure scenarios (bill upload fail, payment upload fail, Sheet write fail). Rollback cleanup failure is also handled (logged + user notified). |
| V. UX Consistency | PASS | ImageDropzone component design separates camera capture (native `<input capture>`) from drag-and-drop (react-dropzone), giving mobile users the right primary action per zone. Bill zone → camera primary; Payment zone → gallery primary. |
| VI. Performance | PASS | Sheets API fetches all records in one call. In-memory search with lodash debounce (300ms). Row-number tracking avoids full re-scan on updates. jsPDF generates PDFs client-side via programmatic API without server round-trip. |
| VII. Testing Discipline | PASS | Quickstart documents the manual verification steps. Phased delivery ensures each integration (OAuth, Drive, Sheets, Tesseract.js OCR) is independently testable before combining. |

**Post-Design Gate Result**: ALL PASS — ready for task generation (`/speckit-tasks`).
