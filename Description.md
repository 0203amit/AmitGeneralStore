# Amit General Store — Bill & Payment Receipt Tracker

## Project Overview
A web application for **Amit General Store** (a Kirana / small retail grocery store) to maintain a long-term, searchable archive of trader bills and their corresponding payment receipts — primarily for use as **proof of payment in case of future disputes**. The shop owner buys inventory from multiple traders/suppliers, pays via UPI/net banking, and currently has no organized way to prove past payments if a trader later disputes whether a bill was paid. This application solves that by digitizing both the bill and the payment receipt together, extracting key fields via OCR, storing original images in the user's own Google Drive, and maintaining a searchable database in Google Sheets. When a dispute arises years later, the user can search by trader name, invoice number, or date and instantly produce a shareable proof packet containing both original images and extracted data.

### Primary Objective: Proof of Payment Archive
**The core purpose of this app is dispute resolution, not just organization.** Every design decision should prioritize:
- **Permanence:** Records must survive for 5+ years without loss or corruption
- **Retrievability:** Find any past payment within seconds, even after thousands of records
- **Shareability:** Generate a clean proof packet to send to a disputing party
- **Authenticity:** Original images preserved at high quality, with timestamps that can't be easily faked
- **Audit trail:** Track when records were created and what was edited

### Business Context
- **Business name:** Amit General Store
- **Business type:** Kirana / small retail grocery store
- **User:** The owner of Amit General Store (single-user app)
- **Use case:** Long-term proof archive for inventory purchase payments made to suppliers/traders
- Multiple traders → each issues their own bills with their own numbering
- Different traders may coincidentally use the same invoice number (e.g., both "INV-001")
- Payment is typically made via UPI (GPay, PhonePe, Paytm), net banking, or sometimes cash
- Typical dispute timeline: 6 months to 3 years after payment
- Common dispute: "You didn't pay invoice INV-001 from May 2024" → user must produce proof

### Real-World Scenario This App Solves
```
Day 1 (15 May 2026):
  - Amit General Store receives bill INV-001 from Sharma Traders for ₹4,250
  - Owner pays via GPay, gets confirmation screenshot
  - Owner opens app, uploads both images, app extracts and saves the record
  - Takes 30 seconds total

Day 1095 (3 years later, May 2029):
  - Sharma Traders calls: "Amit General Store never paid INV-001 from May 2026"
  - Owner opens app, searches "Sharma INV-001"
  - Finds record instantly with: bill image, payment screenshot, UTR number, GPay timestamp
  - Generates proof packet (PDF with both images + extracted details)
  - Shares via WhatsApp/email with Sharma Traders
  - Dispute resolved with clear evidence
```

## Branding & App Identity

The app is branded as belonging to **Amit General Store**. The store name should appear consistently across the app and any artifacts the app generates.

### Where the store name appears
```
1. Browser tab title:
   "Amit General Store · Receipts" (default)
   "Amit General Store · Upload" (on upload page)
   "Amit General Store · History" (on history page)
   etc.

2. Navbar (top of every page):
   - Logo icon + "Amit General Store" wordmark on the left
   - Below the wordmark, small subtitle: "Receipt archive"

3. Sign-in page:
   - Headline: "Amit General Store"
   - Subhead: "Receipt & payment archive"

4. Browser favicon:
   - Custom favicon (a receipt or "A" monogram)

5. Proof Packet PDF (cover page):
   - Top of page: "Amit General Store" (large, store branding)
   - Below: "Payment Proof for <trader name>"
   - Footer of every PDF page: "Amit General Store · Page X of Y"

6. Plain-text proof summary (copyable):
   - First line: "Payment proof from Amit General Store"

7. CSV export filename:
   - amit_general_store_receipts_<YYYY-MM-DD>.csv

8. Full backup ZIP filename:
   - amit_general_store_backup_<YYYY-MM-DD>.zip

9. Drive folder name (created on first sign-in):
   - /Amit General Store - Receipts/
       /bills/
       /payments/

10. Google Sheet name (created on first sign-in):
    - "Amit General Store - Receipt Database"

11. README and documentation:
    - Project name in docs: "Amit General Store - Receipt Tracker"
```

### Branding as a Configurable Constant
```
The store name lives in a single constant for easy future change:

  // src/config/branding.js
  export const BUSINESS_NAME = "Amit General Store";
  export const BUSINESS_TAGLINE = "Receipt archive";
  export const APP_TITLE_SUFFIX = "Receipts";
  export const DRIVE_FOLDER_NAME = `${BUSINESS_NAME} - Receipts`;
  export const SHEET_NAME = `${BUSINESS_NAME} - Receipt Database`;

Every component that displays the store name should import from this file.
If the store ever rebrands, only this file changes.
```

### Visual Identity Suggestions (Optional Polish)
```
- Color palette: warm, trustworthy tones suitable for a small business
  * Primary: deep indigo (#3C3489) or warm green (#085041)
  * Accent: warm amber (#BA7517) for highlights
- Logo: a simple receipt or "A" monogram (a Lucide/Tabler icon works for v1)
- Tone of UI text: friendly, no jargon, Hindi-friendly term choices
  (e.g., "Trader" rather than "Vendor" or "Supplier")
```


- Frontend: React 18 (with Vite), Tailwind CSS, React Router
- Authentication: Google OAuth 2.0 (@react-oauth/google)
- Database: Google Sheets (via Sheets API v4)
- File Storage: Google Drive (via Drive API v3)
- OCR: Tesseract.js (browser-based, no cloud billing required)
- Hosting: Vercel (free tier)
- Version Control: Git + GitHub
- Architecture: Serverless / no backend — React talks directly to Google APIs using the user's OAuth token

## Architecture Decision: No Backend

This application deliberately uses a **client-side-only architecture** with no backend server. All data operations (read, write, search, filter) happen either in the browser or directly against Google APIs.

**Why this works:**
- User volume is small (max 100 records/month = ~1,200/year)
- Even after 10 years (~12,000 records), all data fits comfortably in browser memory
- Search and filter are instant (in-memory JavaScript operations)
- Google Sheets API handles bulk reads efficiently (1-2 seconds for thousands of rows)

**Data flow:**
```
Browser (React) ─OAuth token─► Google OAuth
              ─upload image──► Google Drive API
              ─OCR in browser─► Tesseract.js (no cloud API)
              ─append row────► Google Sheets API
              ─fetch all─────► Google Sheets API (on History page load)
              [in-memory search/filter] ◄── instant results
```

**Benefits:**
- Zero hosting costs (Vercel free tier serves static files)
- No server to maintain, patch, or secure
- All user data stays in the user's own Google account
- Search is faster than a backend approach (no network round-trip per query)
- Works offline after initial data load (read-only)

**Trade-offs accepted:**
- Single-user only (each user has their own data in their own Google account)
- No automated background jobs (no cron, no scheduled tasks)
- No webhook integrations
- Initial page load fetches all records (acceptable for < 50,000 records)

## User Roles & Permissions

### 1. Owner (Single User)
This application is single-user. The signed-in Google account is the owner of all data. There are no admin roles, no multi-tenancy.

**Access Rights:**
- Sign in with own Google account
- Upload bill and payment receipt images
- Trigger OCR extraction on uploaded images
- View, edit, and delete records
- Search and filter records
- Export data as CSV
- View original images stored in own Drive

**Cannot:**
- Access any other user's data (data is fully isolated by Google account)
- Bypass OAuth authentication

## Core Features

### 1. Authentication

#### Google Sign-In
- **Sign-In Flow**
  ```
  - "Sign in with Google" button on landing page
  - OAuth 2.0 consent screen requests scopes:
    * https://www.googleapis.com/auth/drive.file
    * https://www.googleapis.com/auth/spreadsheets
    * openid, email, profile
  - On first sign-in, app creates:
    * Folder in Drive: /Amit General Store - Receipts/
    * Subfolders: /Amit General Store - Receipts/bills/, /Amit General Store - Receipts/payments/
    * Spreadsheet: Amit General Store - Receipt Database
  - Access token stored in memory only (not localStorage)
  - Refresh token handled by Google client library
  ```

- **Sign-Out**
  ```
  - Revoke access token
  - Clear in-memory state
  - Redirect to landing page
  ```

### 2. Upload & Extraction

#### Upload Page
- **Mandatory Paired Upload (Both Images Required)**
  ```
  CORE RULE: Every record MUST contain both a bill image AND a payment receipt image.
  Saving with only one image is NOT allowed — by design.
  
  Reasoning:
  - The app's purpose is to link a bill to its proof of payment
  - A bill without payment proof is incomplete
  - A payment without a matching bill cannot be categorized
  - Standalone uploads defeat the purpose of the app
  ```

- **Dual Image Upload Layout**
  ```
  - Two drop zones displayed side by side (stacked on mobile):
    * Bill Receipt (left / top on mobile) — REQUIRED
    * Payment Receipt (right / bottom on mobile) — REQUIRED
  - Both drop zones marked with red asterisk (*) indicating required
  - Accepted formats: JPG, JPEG, PNG, PDF
  - Max file size: 10 MB per image
  - Image preview shown after selection
  - "Replace" and "Remove" buttons per zone
  ```

- **Input Methods (Three Ways to Add an Image)**
  ```
  Each drop zone offers THREE input methods:
  
  1. Drag & Drop (desktop primary)
     - Drag image file from file explorer into the zone
     - Zone highlights when file is hovering over it
  
  2. Browse Files (universal)
     - Click "Browse" button or zone itself
     - Opens OS file picker
     - Filter by image types (JPG, PNG, PDF)
  
  3. Take Photo with Camera (mobile primary, also works on desktop)
     - "Take photo" button opens device camera
     - Implementation: HTML <input type="file" accept="image/*" capture="environment">
     - The `capture="environment"` attribute hints to use rear camera (best for documents)
     - For payment receipt zone: use capture="user" or no capture attribute
       (since payment screenshots are usually already in the gallery, not taken live)
     - Falls back to file picker on devices without a camera
  ```

- **Camera Capture Behavior (Per Zone)**
  ```
  Bill Receipt Zone:
  - Primary action button on mobile: "Take photo" (camera icon)
  - Secondary: "Choose from gallery" / "Browse files"
  - Tertiary on desktop: drag & drop
  - Rationale: Paper bills are physical objects → user is more likely to capture live
  
  Payment Receipt Zone:
  - Primary action button on mobile: "Choose from gallery" (image icon)
  - Secondary: "Take photo"
  - Tertiary on desktop: drag & drop
  - Rationale: Payment receipts are usually screenshots already saved in gallery
  - User can still take a photo (e.g., of an ATM slip or printed bank receipt)
  ```

- **Camera UX Details**
  ```
  - Mobile browsers natively handle camera permission prompt — no custom permission UI needed
  - On first "Take photo" click:
    * Browser asks user for camera permission
    * If denied: show friendly message "Camera access needed. Use Browse instead, 
      or enable camera in browser settings."
    * If allowed: native camera UI opens (full screen, with shutter button)
  - After photo capture:
    * Image preview appears in the drop zone
    * User can retake (clicks "Take photo" again) or "Remove"
    * No image editing/cropping in v1 (use device's built-in cropping if needed)
  - Image quality:
    * Use device's native resolution (usually 8-12 MP)
    * Compress to JPEG quality 85% before upload (reduces size by ~60%)
    * Auto-rotate based on EXIF orientation data
  ```

- **Image Optimization Before Upload**
  ```
  Before sending to Tesseract.js OCR and Drive:
  - Read image as data URL or blob
  - If file > 5 MB: apply MILD compression using browser-image-compression
    * Target: max 5 MB, quality 0.9, max width 2500px (preserves readability)
    * NEVER compress to under 5 MB at the cost of legibility
    * Goal: file size reduction WITHOUT losing the ability to read text in the image
  - Strip EXIF metadata except orientation (privacy + smaller file)
  - Convert HEIC to JPEG (iOS photos sometimes come as HEIC)
  - Resulting file is what gets uploaded to Drive
  ```

- **Button States & Validation**
  ```
  "Extract & Save" button states:
  
  State 1: Neither image uploaded
  - Button: disabled (greyed out)
  - Helper text: "Add both a bill image and payment receipt to continue"
  
  State 2: Only bill uploaded
  - Button: disabled (greyed out)
  - Helper text: "Add a payment receipt to continue"
  - Payment drop zone: highlighted with warning border
  
  State 3: Only payment uploaded
  - Button: disabled (greyed out)
  - Helper text: "Add a bill image to continue"
  - Bill drop zone: highlighted with warning border
  
  State 4: Both images uploaded
  - Button: enabled (primary action color)
  - Helper text hidden
  - Both zones show success state with preview
  ```

- **Extraction Flow**
  ```
  Step 1: User selects bill image
  Step 2: User selects payment image (or in reverse order)
  Step 3: App validates: both images present, both within size/format limits
  Step 4: "Extract & Save" button enables only when both are present
  Step 5: User clicks "Extract & Save"
  Step 6: App shows loading state with progress (e.g., "Extracting bill...", "Extracting payment...")
  Step 7: Both images processed by Tesseract.js OCR in parallel
  Step 8: Extracted fields from both images shown in editable form
  Step 9: User reviews/edits the extracted fields
  Step 10: User clicks "Save Record"
  Step 11: App computes composite_key from (trader_name + invoice_number + bill_date)
  Step 12: App checks against existing records for duplicate (see Duplicate Detection below)
           - If exact duplicate found → show duplicate modal, halt save
           - If no duplicate → proceed
  Step 13: Both images uploaded to Drive together (atomic — if one fails, neither saves)
  Step 14: Row with both Drive file IDs + composite_key appended to Sheet
  Step 15: Success toast + redirect to history page
  ```

- **Atomic Save (No Partial Records)**
  ```
  The save operation is all-or-nothing:
  - If bill image upload to Drive fails → don't upload payment image, don't write to Sheet
  - If payment image upload to Drive fails → delete already-uploaded bill image, don't write to Sheet
  - If Sheet write fails → delete both uploaded images from Drive (rollback)
  - User sees error message: "Save failed. Please try again."
  - No orphaned files in Drive, no incomplete rows in Sheet
  ```

- **What Happens If User Tries to Bypass**
  ```
  Even if a user inspects the DOM and force-enables the button:
  - Client-side: form submission handler re-validates both images before proceeding
  - If validation fails: show error toast "Both bill and payment receipt are required"
  - Save flow does not start
  ```

#### Bill Field Extraction
- **Fields Extracted from Bill**
  ```
  - Trader Name (string)
  - Trader Address / Branch Code (string, optional)
  - Invoice Number (string) — also referred to as "Inv No" or "Bill No." on physical bills
  - Bill Date (date, format: YYYY-MM-DD)
  - Total Amount (decimal)
  - Currency (string, default: INR)
  ```

- **Fallback Behavior**
  ```
  - If OCR confidence < 0.7 for a field, mark it as "needs review"
  - User can manually edit any field before saving
  - If a field is completely missing, show empty editable input
  ```

#### Payment Field Extraction
- **Fields Extracted from Payment Receipt**
  ```
  - UTR Number / Transaction Reference (string)
  - Payment Date (date, format: YYYY-MM-DD)
  - Payment Mode (enum: GPay, PhonePe, Paytm, Net Banking, Card, Other)
  - Paid Amount (decimal)
  - Payer Name (string, optional)
  - Payee Name (string, optional)
  ```

- **Payment Mode Detection**
  ```
  - Detect from extracted text patterns:
    * "Google Pay" / "GPay" → GPay
    * "PhonePe" → PhonePe
    * "Paytm" → Paytm
    * "IMPS" / "NEFT" / "RTGS" / bank name → Net Banking
    * Card number patterns → Card
    * Otherwise → Other
  - User can override in confirmation form
  ```

### 3. History & Search

#### Records List
- **Table View**
  ```
  Columns (desktop):
  - Date (Bill Date, sortable, format: DD MMM YYYY)
  - Trader Name (sortable, clickable → opens detail view)
  - Invoice Number (clickable → copies to clipboard)
  - Amount (sortable, right-aligned, format: ₹1,250.00)
  - Payment Mode (badge with color: GPay=blue, PhonePe=purple, etc.)
  - UTR Number (truncated with tooltip showing full value)
  - Actions (View, Edit, Delete icons)
  
  Columns (mobile - condensed):
  - Date + Trader Name (stacked)
  - Amount + Payment Mode (stacked)
  - Tap row → opens detail view
  
  Row Features:
  - Hover highlight (desktop)
  - "Needs review" badge if OCR confidence was low
  - Click anywhere on row → opens detail view (except action icons)
  
  Default sort: Bill Date descending (newest first)
  Pagination: 25 rows per page (configurable: 10, 25, 50, 100)
  Total records count displayed: "Showing 1-25 of 247 records"
  ```

- **Search & Filter (Client-Side, Instant Results)**
  ```
  Architecture:
  - On History page load, fetch ALL records from Google Sheet in one API call
  - Store records in React state (in-memory)
  - All search/filter/sort operations run on this in-memory array
  - No API calls during search → results are instant (< 10ms)
  - Re-fetch from Sheet only when: user creates/edits/deletes a record
  
  Search Box (free-text, case-insensitive):
  - Searches across these fields simultaneously:
    * trader_name
    * invoice_number
    * utr_number
    * payer_name
    * payee_name
    * trader_address
  - Match type: "contains" (substring match)
  - Examples:
    * Search "Sharma" → all records from Sharma Traders
    * Search "INV-001" → matches all bills with this invoice number (across traders)
    * Search "412345" → finds record with UTR containing 412345
    * Search "patel" → matches "Patel Wholesale", "Patel & Sons", etc.
  
  Filters (combinable with search):
  - Date Range:
    * From date (bill_date >= from)
    * To date (bill_date <= to)
    * Quick presets: This Month, Last Month, Last 3 Months, This Year, All Time
  - Payment Mode (multi-select checkboxes):
    * GPay, PhonePe, Paytm, Net Banking, Card, Other
    * If none selected → show all
    * If multiple selected → OR logic (show any matching)
  - Amount Range:
    * Min amount (bill_amount >= min)
    * Max amount (bill_amount <= max)
  - Trader Name (dropdown, auto-populated):
    * List of unique trader names from existing records
    * Multi-select supported
  
  Sort Options:
  - By Bill Date (newest first / oldest first) — default: newest first
  - By Amount (highest first / lowest first)
  - By Trader Name (A-Z / Z-A)
  - By Created Date (newest first / oldest first)
  
  Combined Filtering Logic:
  - All active filters apply with AND logic
  - Example: Search "Sharma" + Mode "GPay" + Date "May 2026" + Amount > ₹500
    → Shows only records matching ALL conditions
  
  Filter State:
  - Active filters shown as removable chips above the table
  - "Clear All Filters" button
  - URL query params reflect active filters (shareable/bookmarkable)
    * Example: /history?search=sharma&mode=gpay&from=2026-05-01
  
  Empty States:
  - No records yet → "Upload your first bill" CTA
  - Filters return no results → "No records match your filters. Try adjusting."
  
  Performance:
  - Use lodash debounce on search input (300ms) to avoid re-render on every keystroke
  - useMemo for filtered/sorted array to avoid recomputation
  - Virtualized table (react-window) if records > 500 (future optimization)
  ```

- **Why Client-Side Search Works for This Scale**
  ```
  - User volume: max 100 records/month = ~1,200 records/year
  - After 10 years of usage: ~12,000 records
  - Loading 12,000 rows from Google Sheets API: ~1-2 seconds (one-time on page load)
  - Filtering 12,000 rows in JavaScript: < 50ms (instant feel)
  - No backend needed → no server costs, no maintenance
  - Search works offline once data is loaded
  ```

#### Record Detail View
- **Detail Modal/Page**
  ```
  - Display all bill fields
  - Display all payment fields
  - Show both original images side by side (fetched from Drive)
  - "Edit" button → opens editable form
  - "Delete" button → confirmation dialog
  - "Download Images" button → downloads both images as a zip
  ```

#### Record Edit
- **Editable Form**
  ```
  - All extracted fields editable
  - Cannot change linked Drive image file IDs (read-only)
  - On save: update the corresponding row in Google Sheet
  - On cancel: discard changes
  ```

#### Record Archive (Not True Delete)
- **Archive Flow (Soft Delete Only)**
  ```
  CRITICAL: True deletion is NEVER allowed in this application.
  Records are PROOF documents — losing them defeats the entire purpose.
  
  The "Delete" button is actually an "Archive" button:
  - Confirmation dialog: 
    "Archive this record? It will be hidden from the main view but never deleted.
    You can restore it anytime from the Archive page."
  
  On confirm:
  - Set status = 'archived' in the Sheet row
  - Set archived_at = current ISO timestamp
  - Set archived_reason = optional user-provided reason (e.g., "duplicate entry")
  - DO NOT delete the row from the Sheet
  - DO NOT delete the images from Drive
  - Hide from default History view
  - Available in Settings → Archive
  
  Restore Flow:
  - Settings → Archive → select record → "Restore"
  - Sets status back to 'active'
  - Record reappears in History
  - archived_at and archived_reason preserved for audit trail
  ```

- **No Hard Delete UI**
  ```
  There is NO button anywhere in the app that permanently deletes a record.
  If user truly wants to remove data (rare), they must:
  1. Manually open the Google Sheet
  2. Manually delete the row
  3. Manually open Drive and delete the image files
  
  Rationale: Make accidental data loss impossible from within the app.
  If the user is determined to delete, they can still do it via Google's
  own interfaces — but it requires deliberate effort, not a single click.
  ```

### 4. Export & Reporting

#### Proof Packet Export (Primary Feature for Disputes)
- **Single-Record Proof Packet (PDF)**
  ```
  Purpose: Generate a shareable proof document for ONE record, to send to 
  a disputing trader. This is the core use case of the application.
  
  Available from:
  - Record Detail view → "Generate Proof Packet" button (primary action)
  - History row → action menu → "Export as Proof"
  
  Contents of the PDF:
  Page 1: Cover page
    - Title: "Payment Proof"
    - Trader name (large)
    - Invoice number, bill date, amount (prominent)
    - UTR number, payment date, payment mode (prominent)
    - Generated on: <current date>
    - Record created on: <created_at timestamp>
  
  Page 2: Bill image (full page)
    - Original bill image, scaled to fit
    - Caption: "Original bill from <trader> dated <bill_date>"
  
  Page 3: Payment receipt image (full page)
    - Original payment receipt image, scaled to fit
    - Caption: "Payment receipt - <payment_mode> - UTR <utr_number>"
  
  Page 4: Extracted data summary
    - All extracted fields in a clean table
    - Footer: "Generated by Receipt Tracker on <date>"
  
  Filename: proof_<trader_name>_<invoice_number>_<bill_date>.pdf
  Example: proof_sharma-traders_INV-001_2026-05-15.pdf
  
  Implementation: jsPDF library, client-side generation
  ```

- **Share Proof Packet**
  ```
  After PDF generation, show options:
  - "Download PDF" (default)
  - "Share via WhatsApp" (uses Web Share API on mobile)
  - "Share via Email" (mailto: link with pre-filled subject and body)
  - "Copy proof summary" (copies plain-text version to clipboard for chat messages)
  
  Plain-text summary format:
  ----
  Payment proof for INV-001
  Trader: Sharma Traders
  Bill date: 15 May 2026
  Amount: ₹4,250
  Paid via: GPay
  UTR: 412345678901
  Paid on: 15 May 2026
  (Bill and payment images attached separately)
  ----
  ```

- **Bulk Proof Packet**
  ```
  Multiple records can be exported into one combined PDF:
  - History page → select checkbox on multiple rows → "Export selected as proof"
  - Useful when: trader disputes multiple invoices over a period
  - Combined PDF: cover page lists all records, then each record's pages follow
  - Useful for tax/audit purposes too
  ```

#### CSV Export
- **Export All / Filtered**
  ```
  - "Export to CSV" button on history page
  - Exports current filtered view (or all if no filter)
  - Columns: all fields from Sheet
  - Filename: receipts_export_YYYY-MM-DD.csv
  - Includes all archived records (with status column) if "Include archived" toggle is on
  ```

#### Monthly Summary
- **Summary Dashboard**
  ```
  - Total spent this month
  - Total spent last month
  - Number of records this month
  - Breakdown by payment mode (pie chart)
  - Top 5 traders by spend (bar chart)
  - Charts use recharts library
  ```

### 5. Data Integrity & Audit Trail

#### Audit Trail
- **Tracking Changes**
  ```
  Every record maintains an audit trail of changes:
  - created_at (set on first save, NEVER editable)
  - updated_at (set on every edit)
  - edit_count (incremented on every edit, NEVER decreases)
  - last_edited_field (which field was last changed)
  
  Purpose: If a dispute arises about whether data was tampered with,
  the audit trail shows when and what was modified.
  ```

- **Edit Restrictions**
  ```
  These fields can NEVER be edited once set (they are the legal proof):
  - record_id
  - created_at
  - bill_image_file_id
  - bill_image_url
  - payment_image_file_id
  - payment_image_url
  
  These fields CAN be edited (in case OCR got them wrong):
  - All extracted bill fields (trader_name, invoice_number, bill_date, etc.)
  - All extracted payment fields (utr_number, payment_mode, etc.)
  
  Each edit increments edit_count and updates updated_at.
  
  Rationale: The IMAGES are the immutable truth. Extracted text fields 
  are a convenience for search and may need correction.
  ```

#### Image Preservation Rules
- **High-Quality Image Storage**
  ```
  Since images are the legal proof, they must remain readable for years:
  - Original uploaded image is preserved as-is in Drive (no destructive compression)
  - If compression is applied (for files > 5 MB), only mild compression (quality 90%)
  - Minimum dimensions preserved: 1500px on longest side
  - Text must remain legible when zoomed in
  - No watermarks added by the app (would compromise authenticity)
  
  This differs from earlier spec (which mentioned aggressive 2 MB compression).
  For proof-of-payment use case, file size matters less than image clarity.
  ```

- **No Image Editing**
  ```
  The app NEVER modifies image content:
  - No cropping
  - No filters
  - No text annotations
  - No rotation beyond EXIF auto-orient
  - No drawing or markup
  
  Rationale: Any modification compromises the image's evidentiary value.
  If user wants to crop, they should do it BEFORE uploading.
  ```

#### Backup Strategy
- **Recommended User Habits (Documented in App)**
  ```
  Settings page shows backup guidance:
  - "Your data is stored in your own Google Drive and Google Sheets"
  - "We recommend the following backup practices:"
    1. Enable Google Drive sync to your computer
    2. Periodically download a CSV export and store locally
    3. Periodically download a full ZIP of /Amit General Store - Receipts/ folder
    4. Enable 2-Step Verification on your Google account
  - "Annual backup reminder" (optional in-app notification)
  ```

- **One-Click Full Backup**
  ```
  Settings → "Download full backup" button:
  - Generates a ZIP file containing:
    * receipts_full_export.csv (all records including archived)
    * /bills/ folder with all bill images
    * /payments/ folder with all payment images
    * README.txt explaining how to reconstruct the database
  - For 5 years of data (~6,000 records, ~12 GB), this is a large download
  - Done in chunks; shows progress bar
  ```

## Data Model

### Uniqueness & Duplicate Detection

#### Composite Unique Key
```
The unique identifier for a bill record is the COMBINATION of three fields:

  UNIQUE KEY = (trader_name, invoice_number, bill_date)

Why all three are needed:
- invoice_number alone is NOT unique (different traders use the same numbering: 
  Trader A and Trader B can both have "INV-001")
- (trader_name, invoice_number) alone is mostly unique but not guaranteed 
  (rare case: a trader uses the same number across different days, or 
   numbering resets each year)
- (trader_name, invoice_number, bill_date) is reliably unique in practice
```

#### Duplicate Detection Behavior
```
Before saving a new record, the app checks:
  "Does an active record exist with the same trader_name + invoice_number + bill_date?"

Case 1: No duplicate found
  → Save normally

Case 2: Exact duplicate found (all 3 fields match an existing record)
  → Block save
  → Show modal:
      "This bill already exists in your records"
      [shows the existing record's preview: trader, invoice no, date, amount, payment mode]
      Options:
        - "View existing record" → opens detail view
        - "Save anyway as new record" → forces save (rare case: legitimate duplicate)
        - "Cancel" → returns to upload form

Case 3: Same trader_name + invoice_number but DIFFERENT bill_date
  → Allow save (different transaction, just reused invoice number)
  → Optional: show informational toast 
    "Note: You've used invoice {INV-001} from {trader_name} before on {prev_date}"

Case 4: Same invoice_number but DIFFERENT trader_name
  → Allow save without any warning
  → This is normal — different traders, different bills
```

#### Matching Rules (Case-Insensitive, Whitespace-Trimmed)
```
- trader_name comparison: case-insensitive, trim whitespace, normalize spacing
  Example: "Sharma Traders" === "sharma traders" === "  SHARMA TRADERS  "
- invoice_number comparison: case-insensitive, trim whitespace
  Example: "INV-001" === "inv-001" === " INV-001 "
- bill_date comparison: exact match on YYYY-MM-DD format

Reasoning: OCR may produce slight variations in casing/spacing across uploads;
normalize for reliable duplicate detection.
```

### Google Sheet Structure

The application uses a single Google Sheet named `Amit General Store - Receipt Database` with one worksheet named `records`. Each row represents one bill+payment record.

**records sheet columns:**
```
- record_id (string, UUID v4, generated client-side, IMMUTABLE)
- created_at (ISO 8601 timestamp, IMMUTABLE)
- updated_at (ISO 8601 timestamp)
- status (active, archived) — NOTE: never 'deleted', only archived
- archived_at (ISO 8601 timestamp, nullable)
- archived_reason (string, nullable)

-- Bill fields (editable) --
- trader_name (string)
- trader_address (string, nullable)
- invoice_number (string)
- bill_date (YYYY-MM-DD)
- bill_amount (decimal)
- currency (string, default: INR)

-- Uniqueness --
- composite_key (string, auto-computed: lowercase(trim(trader_name)) + "|" + lowercase(trim(invoice_number)) + "|" + bill_date)
  Example: "sharma traders|inv-001|2026-05-15"
  Used for fast O(1) duplicate lookup before save

-- Payment fields (editable) --
- utr_number (string)
- payment_date (YYYY-MM-DD)
- payment_mode (gpay, phonepe, paytm, net_banking, card, other)
- paid_amount (decimal)
- payer_name (string, nullable)
- payee_name (string, nullable)

-- Drive references (IMMUTABLE — the actual proof) --
- bill_image_file_id (string, Google Drive file ID, IMMUTABLE)
- bill_image_url (string, webViewLink, IMMUTABLE)
- payment_image_file_id (string, Google Drive file ID, IMMUTABLE)
- payment_image_url (string, webViewLink, IMMUTABLE)

-- OCR metadata --
- bill_ocr_confidence (decimal, 0.0 to 1.0)
- payment_ocr_confidence (decimal, 0.0 to 1.0)
- needs_review (boolean)

-- Audit trail --
- edit_count (integer, default 0, increments on each edit)
- last_edited_field (string, nullable — name of last field changed)
- last_edited_at (ISO 8601 timestamp, nullable)

-- Optional notes --
- notes (string, nullable — user can add private notes, e.g., "settled in person")
- tags (string, nullable — comma-separated tags for categorization, e.g., "groceries,monthly")
```

### Google Drive Structure

```
My Drive/
└── Amit General Store - Receipts/
    ├── bills/
    │   ├── <record_id>_bill.jpg
    │   └── ...
    └── payments/
        ├── <record_id>_payment.jpg
        └── ...
```

File naming convention: `<record_id>_<type>.<ext>` where `<type>` is `bill` or `payment`.

## Google APIs & Configuration

### Required Google Cloud Setup

1. **Create Google Cloud Project**
   - Project name: `receipt-tracker` (or any name)
   - No billing required (OCR is handled by Tesseract.js in-browser)

2. **Enable APIs**
   ```
   - Google Drive API
   - Google Sheets API
   ```

3. **Create OAuth 2.0 Credentials**
   ```
   - Application type: Web application
   - Authorized JavaScript origins:
     * http://localhost:5173 (Vite dev)
     * https://<your-app>.vercel.app (production)
   - Authorized redirect URIs:
     * Same as above
   - Copy Client ID → store in .env as VITE_GOOGLE_CLIENT_ID
   ```

4. **Configure OAuth Consent Screen**
   ```
   - User type: External
   - Scopes:
     * .../auth/drive.file
     * .../auth/spreadsheets
     * openid, email, profile
   - Test users: add your own Gmail (until app is verified)
   ```

### Environment Variables (.env)
```
VITE_GOOGLE_CLIENT_ID=<your-oauth-client-id>.apps.googleusercontent.com
VITE_GOOGLE_PROJECT_ID=<your-gcp-project-id>
VITE_APP_FOLDER_NAME="Amit General Store - Receipts"
VITE_APP_SHEET_NAME="Amit General Store - Receipt Database"
```

> **Note**: No Document AI environment variables needed — OCR is handled entirely in-browser by Tesseract.js.

## Application Architecture

### Folder Structure
```
receipt-tracker/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── SignInButton.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   ├── upload/
│   │   │   ├── ImageDropzone.jsx
│   │   │   ├── CameraCapture.jsx
│   │   │   ├── ExtractionForm.jsx
│   │   │   └── UploadPage.jsx
│   │   ├── history/
│   │   │   ├── RecordsTable.jsx
│   │   │   ├── RecordDetail.jsx
│   │   │   ├── FilterBar.jsx
│   │   │   └── HistoryPage.jsx
│   │   ├── dashboard/
│   │   │   ├── MonthlySummary.jsx
│   │   │   ├── PaymentModeChart.jsx
│   │   │   └── DashboardPage.jsx
│   │   └── shared/
│   │       ├── Navbar.jsx
│   │       ├── Toast.jsx
│   │       └── LoadingSpinner.jsx
│   ├── services/
│   │   ├── googleAuth.js
│   │   ├── driveService.js
│   │   ├── sheetsService.js
│   │   ├── ocrService.js
│   │   └── recordService.js
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useRecords.js
│   │   └── useUpload.js
│   ├── utils/
│   │   ├── parseOcrText.js
│   │   ├── paymentModeDetector.js
│   │   ├── imageProcessor.js
│   │   ├── csvExporter.js
│   │   └── dateHelpers.js
│   ├── context/
│   │   └── AuthContext.jsx
│   ├── config/
│   │   └── branding.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── .env
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.js
└── README.md
```

### Service Modules

#### googleAuth.js
```
Responsibilities:
- Initialize Google OAuth client
- Handle sign-in / sign-out
- Provide access token to other services
- Refresh token when expired
```

#### driveService.js
```
Functions:
- ensureAppFolder()         → Creates /Amit General Store - Receipts/ if missing, returns folder ID
- uploadImage(file, type, recordId) → Uploads to /Amit General Store - Receipts/<type>s/, returns file ID + URL
- getImageUrl(fileId)       → Returns webViewLink for displaying image
- deleteImage(fileId)       → Deletes file from Drive
```

#### sheetsService.js
```
Functions:
- ensureAppSheet()                       → Creates Amit General Store - Receipt Database if missing, returns sheet ID
- appendRecord(record)                   → Appends row to records sheet
- getAllRecords()                        → Returns all rows where status = 'active'
- updateRecord(recordId, fields)         → Updates matching row by record_id
- deleteRecord(recordId)                 → Soft or hard delete
- findByCompositeKey(compositeKey)       → Returns matching record if exists, null otherwise
                                          Used for duplicate detection before save
- computeCompositeKey(traderName, invNo, billDate)
                                         → Returns normalized composite key string
                                          Example: ("Sharma Traders", "INV-001", "2026-05-15")
                                          → "sharma traders|inv-001|2026-05-15"
```

#### ocrService.js
```
Functions:
- extractBillFields(imageBlob)    → Runs Tesseract.js OCR, parses text with regex patterns
- extractPaymentFields(imageBlob) → Runs Tesseract.js OCR, parses text with regex patterns
- terminateOcrWorker()            → Cleanup: terminates the singleton Tesseract worker

Implementation:
- Uses Tesseract.js (browser-based OCR, no cloud API)
- Singleton worker pattern: created once, reused for all OCR calls
- No Google Auth dependency, no environment variables needed
- Expected accuracy: ~75-85% (manual review form compensates)
```

## OCR Extraction Logic

### Bill Extraction Algorithm (Tesseract.js + Regex)
```
1. Send image to Tesseract.js (browser-based OCR, no cloud API)
2. Receive plain text + overall confidence score (0-100, normalized to 0-1)
3. Apply regex patterns to extract bill fields:
   - Trader name: first non-empty line of text (confidence: 0.6)
   - Invoice number: patterns like INV-XXX, BL-XXX, BILL-XXX, or text near
     labels "Inv No", "Bill No", "Invoice No" (confidence: 0.75)
   - Bill date: DD/MM/YY or DD/MM/YYYY patterns (confidence: 0.7)
   - Bill amount: number after ₹ symbol, or near "Total", "Net Bill",
     "Amount", "Grand Total" labels (confidence: 0.7)
   - Currency: default INR (confidence: 1.0)
4. For any field with confidence < 0.7, set needs_review = true
5. Return extracted fields + raw OCR text + per-field confidence scores

Expected accuracy: ~75-85% on printed bills (lower than Document AI's ~92%).
The manual review form is critical for correcting extraction errors.

Example:
Input: bill_image.jpg
Tesseract raw text: "Sharma Traders\nShop No 42, Main Market\nInv No: INV-001\nDate: 15/05/2026\nTotal: ₹4,250.00"

Output:
{
  trader_name: "Sharma Traders",
  invoice_number: "INV-001",
  bill_date: "2026-05-15",
  bill_amount: "4250.00",
  needs_review: false
}
```

### Payment Extraction Algorithm (Tesseract.js + Regex)
```
1. Send image to Tesseract.js (browser-based OCR)
2. Receive plain text + overall confidence score
3. Apply regex patterns to extract payment fields:
   - UTR number: 12-digit number near "UTR" label, or standalone 12-22 digit number
   - Payment date: DD/MM/YY or DD/MM/YYYY patterns
   - Paid amount: number after ₹ symbol, or near "Total"/"Amount" labels
   - Payment mode: pattern matching (GPay, PhonePe, Paytm, etc.) via paymentModeDetector.js
4. Return extracted fields + confidence + raw text

Example:
Input: gpay_screenshot.png
Raw text: "Google Pay\n₹1,250\nPaid successfully\nUPI transaction ID 412345678901\n15/05/2026, 2:34 PM"

Output:
{
  payment_mode: "gpay",
  paid_amount: "1250",
  utr_number: "412345678901",
  payment_date: "2026-05-15",
  needs_review: false
}
```

### Payment Mode Detection
```
Detection rules (applied in order):
1. If text contains "Google Pay" or "GPay" → gpay
2. If text contains "PhonePe" → phonepe
3. If text contains "Paytm" → paytm
4. If text contains "IMPS" / "NEFT" / "RTGS" → net_banking
5. If text contains known bank names (HDFC, SBI, ICICI, Axis, Kotak, etc.) → net_banking
6. If text matches card patterns (16-digit number, "ending in", "Visa", "Mastercard") → card
7. Otherwise → other

User can override the detected value in the confirmation form.
```

## UI / Pages

### Page List
```
- / (Landing)              → Sign-in screen if not authenticated, else redirect to /dashboard
- /dashboard               → Monthly summary + charts + quick stats
- /upload                  → Two-image upload + extraction form
- /history                 → Table of all records with search/filter
- /history/:recordId       → Detail view of a single record
- /settings                → Sign-out, app info, link to Drive folder, link to Sheet
```

### Navbar
```
- Logo / app name (left)
- Links: Dashboard | Upload | History | Settings (center)
- User avatar + email (right, dropdown with Sign Out)
```

### Design System
```
- Tailwind CSS utility classes
- Color palette:
  * Primary: indigo-600
  * Success: emerald-600
  * Warning: amber-500
  * Danger: red-600
  * Neutral: slate (50-900)
- Typography: system font stack
- Rounded corners: rounded-lg (8px)
- Shadows: shadow-sm for cards, shadow-md on hover
- Mobile-responsive: works on phone (primary use case: capture receipt → upload)
```

## Build Order (Recommended Implementation Sequence)

Build in this order so each step is independently testable:

```
Phase 1: Project Setup
1. Create Vite + React project, install Tailwind, set up routing
2. Set up Google Cloud project, enable APIs, create OAuth credentials
3. Implement Google sign-in flow
4. Verify sign-in works → see user email displayed

Phase 2: Drive Integration
5. Implement ensureAppFolder() — creates /Amit General Store - Receipts/ folders
6. Implement uploadImage() — upload a test image, verify it appears in Drive
7. Implement getImageUrl() — display uploaded image in app

Phase 3: Sheets Integration
8. Implement ensureAppSheet() — creates the spreadsheet
9. Implement appendRecord() — write a dummy row, verify in Sheet
10. Implement getAllRecords() — read rows back, display in basic table

Phase 4: OCR Integration (Tesseract.js)
11. Integrate Tesseract.js browser-based OCR (no cloud setup required)
12. Implement extractBillFields() with regex patterns — test with 5 real bill images
13. Implement extractPaymentFields() with regex patterns — test with 5 UPI screenshots
14. Refine regex patterns based on real data

Phase 5: End-to-End Upload Flow
15. Build UploadPage with dual drop zones
16. Wire up: upload → extract → show confirmation form → save
17. Verify: row appears in Sheet, images appear in Drive

Phase 6: History Page
18. Build RecordsTable with sort and pagination
19. Add FilterBar with search and date range
20. Build RecordDetail modal with image preview

Phase 7: Edit & Delete
21. Implement update flow
22. Implement delete flow (with confirmation)

Phase 8: Dashboard
23. Build monthly summary cards
24. Build charts with recharts

Phase 9: Polish & Deploy
25. Add CSV export
26. Add toast notifications
27. Mobile responsive polish
28. Deploy to Vercel
29. Update OAuth credentials with production URL
```

## Deliverables

1. **Source Code**
   - React + Vite project
   - All components, services, hooks, utils as per folder structure
   - Tailwind CSS configured
   - Environment variables documented in `.env.example`

2. **Documentation**
   - `README.md` — setup, run locally, deploy
   - `Description.md` — this file (project spec)
   - `GOOGLE_CLOUD_SETUP.md` — step-by-step GCP setup with screenshots
   - Inline JSDoc comments on all service functions

3. **Testing Data**
   - 10 sample bill images (variety: supermarket, pharmacy, restaurant, utility, handwritten)
   - 10 sample payment screenshots (GPay, PhonePe, Paytm, net banking, card)
   - Test that OCR extraction works on all 20 samples

4. **Deployment**
   - Live URL on Vercel
   - OAuth credentials configured for both localhost and production
   - First-time sign-in tested end-to-end

## Success Criteria

- ✅ User can sign in with Google account
- ✅ Browser tab title shows "Amit General Store · <page name>"
- ✅ Navbar displays "Amit General Store" wordmark on every page
- ✅ Proof Packet PDFs show "Amit General Store" prominently on cover and footer
- ✅ CSV exports and backup ZIPs use store-branded filenames
- ✅ App auto-creates `/Amit General Store - Receipts/` folder structure in Drive on first sign-in
- ✅ App auto-creates `Amit General Store - Receipt Database` spreadsheet on first sign-in
- ✅ User MUST upload both bill image and payment image to save a record
- ✅ Cannot save record with only bill image (button stays disabled)
- ✅ Cannot save record with only payment image (button stays disabled)
- ✅ Helper text guides user on which image is missing
- ✅ User can take a photo with device camera for bill image
- ✅ User can take a photo with device camera for payment image
- ✅ User can choose existing image from device gallery / file system
- ✅ User can drag & drop images on desktop browsers
- ✅ Camera defaults to rear (environment) camera for bill capture
- ✅ Images > 2 MB are auto-compressed before upload
- ✅ HEIC images (iOS) are auto-converted to JPEG
- ✅ Images auto-rotate based on EXIF orientation data
- ✅ Save operation is atomic — partial records never created in Sheet
- ✅ If save fails partway, already-uploaded Drive files are cleaned up
- ✅ Duplicate detection uses composite key (trader_name + invoice_number + bill_date)
- ✅ Saving a record with all 3 fields matching an existing record is blocked
- ✅ Duplicate modal shows the existing matching record with option to view it
- ✅ User can force-save a duplicate as a new record (rare case)
- ✅ Different traders with same invoice number can both be saved without conflict
- ✅ Same trader with same invoice number on different dates can be saved without conflict
- ✅ Duplicate matching is case-insensitive and whitespace-trimmed
- ✅ Tesseract.js extracts bill fields with > 70% accuracy on printed bills (manual review compensates)
- ✅ Regex + OCR extracts UTR number, amount, date from UPI screenshots
- ✅ Payment mode auto-detected for GPay, PhonePe, Paytm, net banking
- ✅ User can review and edit extracted fields before saving
- ✅ Saving a record uploads both images to Drive and appends a row to the Sheet
- ✅ History page shows all records sorted by date descending
- ✅ Search box finds records by trader name (e.g., "Sharma" finds all Sharma Traders bills)
- ✅ Search box finds records by invoice number (exact or partial match)
- ✅ Search box finds records by UTR number (exact or partial match)
- ✅ Search results appear instantly as user types (< 50ms response)
- ✅ Filter by date range works (from / to)
- ✅ Filter by payment mode works (multi-select)
- ✅ Filter by amount range works (min / max)
- ✅ Multiple filters combine with AND logic
- ✅ Active filters shown as removable chips
- ✅ Filter state persists in URL (shareable links)
- ✅ Sort by date, amount, or trader name works
- ✅ User can edit editable fields of an existing record (trader, invoice no, amounts, etc.)
- ✅ User CANNOT edit immutable fields (record_id, created_at, image file IDs)
- ✅ Editing a record increments edit_count and updates last_edited_at
- ✅ Records are archived, NEVER deleted from within the app
- ✅ Archived records remain in Drive and Sheet (just hidden from default view)
- ✅ User can restore archived records anytime from Settings → Archive
- ✅ User can view both original images in the detail view
- ✅ User can generate a single-record Proof Packet PDF with cover + both images + data
- ✅ Proof Packet PDF can be downloaded, shared via WhatsApp, or emailed
- ✅ User can generate a Bulk Proof Packet for multiple selected records
- ✅ User can copy a plain-text proof summary for chat messages
- ✅ CSV export works for filtered records (with option to include archived)
- ✅ Settings page provides "Download full backup" (ZIP with CSV + all images)
- ✅ Settings page documents backup best practices
- ✅ Original images preserved at high quality (no aggressive compression)
- ✅ App never modifies image content (no cropping, filters, watermarks)
- ✅ Dashboard shows monthly total, count, and payment mode breakdown
- ✅ All data stored in user's own Google account (full data ownership)
- ✅ App runs on free tier indefinitely for 100 records/month volume
- ✅ Responsive on mobile (capture receipt with phone → upload)
- ✅ No backend server required
- ✅ Deployed and accessible via public URL
- ✅ Records remain searchable and proof-packet-exportable 3+ years after creation

## Out of Scope (Explicitly Not Building)

To keep the project focused for personal use, the following are **not** part of v1:
- Multi-user / shared records
- Admin dashboard
- Backend server / database other than Google Sheets
- Mobile native app (web app only, but mobile responsive)
- Automatic recurring bill detection
- Bank account integration / auto-import
- Email parsing of e-bills
- Tax categorization / GST handling
- Multi-currency conversion
- Receipt forgery detection
- Notification system (email/SMS reminders)

These can be considered for future versions once v1 is stable.
