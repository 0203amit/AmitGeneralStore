<!--
  SYNC IMPACT REPORT
  ==================
  Version change: 0.0.0 (template placeholders) → 1.0.0
  Modified principles: N/A (initial ratification — all principles are new)
  Added sections:
    - I. Code Quality
    - II. Data Ownership
    - III. Data Preservation (CRITICAL)
    - IV. Integrity
    - V. UX Consistency
    - VI. Performance
    - VII. Testing Discipline
    - Governance (fully defined)
  Removed sections:
    - [SECTION_2_NAME] (template placeholder — not needed)
    - [SECTION_3_NAME] (template placeholder — not needed)
  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ compatible (Constitution Check is a per-feature placeholder)
    - .specify/templates/spec-template.md ✅ compatible (no constitution references)
    - .specify/templates/tasks-template.md ✅ compatible (phase structure supports testing discipline)
    - .specify/templates/commands/*.md ✅ no files present
  Follow-up TODOs: None
-->

# Amit General Store Receipt Tracker Constitution

## Core Principles

### I. Code Quality

- All code MUST prefer simplicity over cleverness. If a reviewer
  cannot understand a function within 30 seconds, it is too complex.
- No unnecessary dependencies. Every `npm install` MUST be justified
  by a concrete need that cannot be met with existing code or
  browser-native APIs.
- Functions MUST be small and single-purpose. A function that does
  two things MUST be split into two functions.
- Comments MUST only appear where the logic is non-obvious. Do not
  comment what the code already says.
- Every exported service function MUST have a JSDoc block describing
  its purpose, parameters, return value, and thrown errors.

**Rationale**: This is a long-lived proof archive. The codebase MUST
remain maintainable by the owner years after initial development,
without relying on any third-party contributor's memory.

### II. Data Ownership

- All user data MUST stay within the user's own Google account
  (Google Drive for images, Google Sheets for structured data).
- There MUST be no third-party backend server, database, or API
  that stores, processes, or proxies user data.
- There MUST be no analytics, telemetry, or tracking of user data
  by the application or any bundled dependency.
- The application MUST be fully functional as a static client-side
  app communicating only with Google APIs using the user's own
  OAuth token.

**Rationale**: The user is storing legal proof of financial
transactions. Routing this data through any third party introduces
risk of data loss, unauthorized access, or service discontinuation.

### III. Data Preservation (CRITICAL)

- Records are legal proof of payment and MUST NEVER be permanently
  deleted from within the application. Only soft-archive (setting
  `status = 'archived'`) is permitted.
- Original uploaded images MUST NEVER be modified by the application
  after upload. No cropping, no filters, no watermarks, no
  annotations, no re-compression of already-stored images.
- The following fields are immutable once a record is saved and
  MUST NEVER be changed:
  - `record_id`
  - `created_at`
  - `bill_image_file_id` / `bill_image_url`
  - `payment_image_file_id` / `payment_image_url`
- Timestamps (`created_at`, `archived_at`) MUST be set at creation
  time and MUST NEVER be retroactively altered.

**Rationale**: This is the single most important principle. The
entire application exists to preserve proof. Any feature that risks
data loss or image modification undermines the app's core purpose.

### IV. Integrity

- Save operations MUST be atomic. If any part of a record save
  fails (image upload to Drive, row append to Sheet), all partial
  changes MUST be rolled back.
- There MUST be no orphaned files in Google Drive (images uploaded
  without a corresponding Sheet row).
- There MUST be no incomplete rows in Google Sheets (rows written
  without both corresponding Drive images).
- Rollback sequence on failure:
  1. If Sheet write fails → delete both uploaded images from Drive.
  2. If second image upload fails → delete the first image from
     Drive; do not write to Sheet.
  3. If first image upload fails → do not proceed with anything.

**Rationale**: Partial records are worse than no record at all.
A row without images provides no proof; an image without a row
is unfindable. Atomicity ensures every record is complete or absent.

### V. UX Consistency

- The application MUST be mobile-first. The owner captures bills
  on their phone; this is the primary device.
- Every user flow MUST minimize the number of taps required to
  complete it.
- All destructive or significant actions (archive, bulk export,
  sign-out) MUST require explicit confirmation before executing.
- Toast notifications MUST appear for all save, edit, archive,
  and restore operations to confirm the outcome to the user.
- Both a bill image and a payment image MUST be present before
  a record can be saved. No exceptions. The save button MUST
  remain disabled until both images are provided.

**Rationale**: The user is a shop owner capturing receipts during
business hours. The UI must be fast, forgiving of mistakes, and
impossible to use incorrectly for critical operations.

### VI. Performance

- Search results on the History page MUST appear within 50ms of
  the user finishing typing (after debounce). All search and filter
  operations run in-memory on the client.
- Initial page load (History page with all records) MUST complete
  within 2 seconds for up to 5,000 records fetched from Google
  Sheets API.
- OCR extraction via Document AI MUST display a progress indicator
  to the user. The UI MUST NOT appear frozen during extraction.
- Image compression (for files > 5 MB) MUST NOT reduce quality
  below readability. Target: quality 0.9, max width 2500px.
  Legibility of text in the image MUST NEVER be sacrificed for
  file size.

**Rationale**: The app must feel instant for the common case
(searching past records during a phone call with a disputing
trader). Slow search directly undermines the dispute-resolution
use case.

### VII. Testing Discipline

- Each implementation phase defined in plan.md MUST be
  manually verified as working before development proceeds to the
  next phase.
- OCR extraction MUST be tested with a minimum of 10 real bill
  images and 10 real payment screenshots covering variety:
  printed bills, handwritten bills, GPay, PhonePe, Paytm,
  net banking, and card receipts.
- Atomic save/rollback logic MUST be tested by simulating
  failures at each step (Drive upload failure, Sheet write
  failure) and verifying no orphaned data remains.
- Duplicate detection MUST be tested with edge cases:
  same invoice number across different traders, same trader
  with same invoice on different dates, case and whitespace
  variations.

**Rationale**: This application handles legal proof. Untested
code paths that silently lose data or create incomplete records
are unacceptable. Manual verification with real-world data
catches issues that synthetic tests miss.

## Governance

- This constitution supersedes all other development practices
  and guidelines for this project.
- All technical decisions MUST trace back to one or more of the
  principles above. When a decision cannot be justified by a
  principle, it MUST be re-evaluated.
- When in doubt between two valid approaches, prefer the option
  that better preserves user data and proof integrity over the
  option that is faster to implement or more technically elegant.
- Amendments to this constitution MUST be documented with:
  1. The principle(s) affected.
  2. The rationale for the change.
  3. A version bump following semantic versioning:
     - MAJOR: Principle removed, redefined, or made incompatible.
     - MINOR: New principle added or existing one materially expanded.
     - PATCH: Clarification, wording fix, or non-semantic refinement.
  4. Updated `Last Amended` date.
- Compliance with these principles MUST be reviewed before any
  feature is considered complete.

**Version**: 1.0.0 | **Ratified**: 2026-05-21 | **Last Amended**: 2026-05-21
