# API Contracts: Google API Integration

**Branch**: `001-receipt-tracker` | **Date**: 2026-05-21

This document defines the contracts between the React SPA and the Google APIs it communicates with directly from the browser.

---

## 1. Google OAuth 2.0 (Authentication)

### Sign-In

**Library**: `@react-oauth/google` (Google Identity Services wrapper)

**OAuth Scopes Requested**:
```text
openid
email
profile
https://www.googleapis.com/auth/drive.file
https://www.googleapis.com/auth/spreadsheets
```

> **Note**: `cloud-platform` scope removed — no longer needed since OCR is handled by Tesseract.js in-browser.

**Sign-In Flow**:
```text
1. User clicks "Sign in with Google"
2. @react-oauth/google opens Google consent popup
3. User grants permissions
4. Library returns authorization code or access token
5. App initializes gapi client with the access token
6. App calls ensureAppFolder() + ensureAppSheet() for first-time setup
7. App stores token in memory (NOT localStorage)
```

**Token Management**:
- Access token stored in React context (in-memory only)
- Token refresh handled by gapi client library automatically
- On sign-out: revoke token via `google.accounts.oauth2.revoke(token)`

**Environment Variables**:
```text
VITE_GOOGLE_CLIENT_ID=<oauth-client-id>.apps.googleusercontent.com
VITE_GOOGLE_PROJECT_ID=<gcp-project-id>
```

---

## 2. Google Drive API v3 (File Storage)

### 2.1 Create Folder

**Purpose**: Create the app's folder structure on first sign-in

**Endpoint**: `POST https://www.googleapis.com/drive/v3/files`

**Request** (create root folder):
```json
{
  "name": "Amit General Store - Receipts",
  "mimeType": "application/vnd.google-apps.folder"
}
```

**Request** (create subfolder):
```json
{
  "name": "bills",
  "mimeType": "application/vnd.google-apps.folder",
  "parents": ["<root-folder-id>"]
}
```

**Idempotency Check** (before creating):
```text
GET /drive/v3/files?q=name='Amit General Store - Receipts' and mimeType='application/vnd.google-apps.folder' and trashed=false
```

**Response**: `{ id: "<folder-id>", name: "...", ... }`

### 2.2 Upload Image

**Purpose**: Upload bill or payment image to the appropriate subfolder

**Endpoint**: `POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`

**Request** (multipart: metadata + file):
```text
Content-Type: multipart/related; boundary=---boundary

---boundary
Content-Type: application/json

{
  "name": "<record_id>_bill.jpg",
  "parents": ["<bills-folder-id>"]
}

---boundary
Content-Type: image/jpeg

<binary image data>
---boundary--
```

**Response**:
```json
{
  "id": "<file-id>",
  "name": "<record_id>_bill.jpg",
  "webViewLink": "https://drive.google.com/file/d/<file-id>/view",
  "webContentLink": "https://drive.google.com/uc?id=<file-id>&export=download"
}
```

**Fields requested**: `id, name, webViewLink, webContentLink`

### 2.3 Get Image URL

**Purpose**: Retrieve display/download URL for an existing image

**Endpoint**: `GET https://www.googleapis.com/drive/v3/files/<file-id>?fields=webViewLink,webContentLink`

### 2.4 Get Image Content (for PDF generation)

**Purpose**: Fetch image binary to embed in Proof Packet PDF

**Endpoint**: `GET https://www.googleapis.com/drive/v3/files/<file-id>?alt=media`

**Response**: Binary image data (with appropriate Content-Type header)

**Note**: Uses authenticated fetch with OAuth token to avoid CORS issues. The image is fetched as a blob, converted to a data URL via `FileReader.readAsDataURL()`, then embedded in jsPDF via `doc.addImage()`. Do NOT use Drive `webViewLink` or `webContentLink` URLs directly — they fail CORS. The `googleapis.com/drive/v3/files/{id}?alt=media` endpoint has proper CORS headers for authenticated requests.

### 2.5 Delete Image (Rollback)

**Purpose**: Delete an uploaded image during atomic save rollback

**Endpoint**: `DELETE https://www.googleapis.com/drive/v3/files/<file-id>`

**Response**: `204 No Content`

---

## 3. Google Sheets API v4 (Database)

### 3.1 Create Spreadsheet

**Purpose**: Create the receipt database on first sign-in

**Endpoint**: `POST https://sheets.googleapis.com/v4/spreadsheets`

**Request**:
```json
{
  "properties": {
    "title": "Amit General Store - Receipt Database"
  },
  "sheets": [{
    "properties": {
      "title": "records"
    }
  }]
}
```

**Idempotency**: Check for existing spreadsheet by searching Drive:
```text
GET /drive/v3/files?q=name='Amit General Store - Receipt Database' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false
```

**After creation**: Write header row with all 31 column names to `records!A1:AE1`

### 3.2 Append Record

**Purpose**: Add a new record row to the sheet

**Endpoint**: `POST https://sheets.googleapis.com/v4/spreadsheets/<spreadsheet-id>/values/records!A:AE:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`

**Request**:
```json
{
  "values": [[
    "<record_id>",
    "<created_at>",
    "<updated_at>",
    "active",
    "",
    "",
    "<trader_name>",
    "<trader_address>",
    "<invoice_number>",
    "<bill_date>",
    "<bill_amount>",
    "INR",
    "<composite_key>",
    "<utr_number>",
    "<payment_date>",
    "<payment_mode>",
    "<paid_amount>",
    "<payer_name>",
    "<payee_name>",
    "<bill_image_file_id>",
    "<bill_image_url>",
    "<payment_image_file_id>",
    "<payment_image_url>",
    "<bill_ocr_confidence>",
    "<payment_ocr_confidence>",
    "<needs_review>",
    "0",
    "",
    "",
    "",
    ""
  ]]
}
```

### 3.3 Get All Records

**Purpose**: Fetch all records for the History page (in-memory search/filter)

**Endpoint**: `GET https://sheets.googleapis.com/v4/spreadsheets/<spreadsheet-id>/values/records!A:AE`

**Response**:
```json
{
  "range": "records!A1:AE1000",
  "values": [
    ["record_id", "created_at", ...],
    ["uuid-1", "2026-05-15T10:30:00Z", ...],
    ...
  ]
}
```

**Processing**: Row 0 is the header. Rows 1+ are data. Map each row array to a record object using header names as keys.

### 3.4 Update Record

**Purpose**: Update a specific record's mutable fields

**Strategy**: Find the row number by scanning for `record_id` match in column A, then update specific cells.

**Endpoint**: `PUT https://sheets.googleapis.com/v4/spreadsheets/<spreadsheet-id>/values/records!A<row>:AE<row>?valueInputOption=RAW`

**Request**: Full row array with updated values

### 3.5 Find by Composite Key (Duplicate Detection)

**Purpose**: Check if a record with the same composite key exists before saving

**Strategy**: Client-side — all records are already loaded in memory on the History page. Search the in-memory array for a matching `composite_key` where `status === 'active'`.

**Fallback** (if records not yet loaded): Fetch column M (composite_key) and D (status):
```text
GET /spreadsheets/<id>/values/records!D:D
GET /spreadsheets/<id>/values/records!M:M
```

---

## 4. OCR Extraction (Tesseract.js — Browser-Based)

### 4.1 Overview

**Purpose**: Extract text from bill/payment images using Tesseract.js (in-browser OCR)

**Engine**: Tesseract.js v5 — runs entirely client-side via Web Worker + WASM. No cloud API, no billing, no environment variables needed.

**Expected accuracy**: ~75-85% on printed text (lower on handwritten). Manual review form compensates.

### 4.2 Bill Field Extraction (Regex Patterns)

| Pattern | App Field | Confidence |
|---------|-----------|------------|
| First non-empty line of OCR text | trader_name | 0.6 |
| `INV-XXX`, `BL-XXX`, `BILL-XXX` or near "Inv No"/"Bill No"/"Invoice" labels | invoice_number | 0.65–0.75 |
| `DD/MM/YY` or `DD/MM/YYYY` patterns | bill_date | 0.7 |
| Number after `₹` symbol or near "Total"/"Net Bill"/"Amount"/"Grand Total" | bill_amount | 0.7–0.75 |
| Default `'INR'` | currency | 1.0 |

### 4.3 Payment Field Extraction (Regex Patterns)

| Pattern | App Field | Confidence |
|---------|-----------|------------|
| 12-digit number near "UTR" label, or standalone 12-22 digit number | utr_number | 0.65–0.8 |
| `DD/MM/YY` or `DD/MM/YYYY` patterns | payment_date | 0.7 |
| Number after `₹` symbol or near "Total"/"Amount" labels | paid_amount | 0.7–0.75 |
| Pattern matching: GPay, PhonePe, Paytm, etc. (via paymentModeDetector.js) | payment_mode | 0.5–1.0 |

**No environment variables required for OCR.**

---

## 5. Service Module Contracts

### googleAuth.js

```text
initGoogleAuth()          → Promise<void>     Initialize OAuth client and gapi
signIn()                  → Promise<UserInfo>  Trigger Google sign-in, return user profile
signOut()                 → Promise<void>      Revoke token, clear state
getAccessToken()          → string             Return current access token from memory
isAuthenticated()         → boolean            Check if user is signed in
onTokenRefresh(callback)  → void               Register callback for token refresh events
```

### driveService.js

```text
ensureAppFolder()                          → Promise<{rootId, billsId, paymentsId}>
uploadImage(file, type, recordId)          → Promise<{fileId, webViewLink}>
    file: File | Blob
    type: 'bill' | 'payment'
    recordId: string (UUID)
getImageUrl(fileId)                        → Promise<string>
getImageBlob(fileId)                       → Promise<Blob>   (for PDF embedding)
deleteImage(fileId)                        → Promise<void>    (for rollback)
```

### sheetsService.js

```text
ensureAppSheet()                           → Promise<string>  (spreadsheetId)
appendRecord(record)                       → Promise<void>
getAllRecords()                             → Promise<Record[]>
updateRecord(recordId, fields)             → Promise<void>
archiveRecord(recordId, reason?)           → Promise<void>
restoreRecord(recordId)                    → Promise<void>
computeCompositeKey(traderName, invNo, billDate) → string
```

### ocrService.js (Tesseract.js)

```text
extractBillFields(imageBlob)               → Promise<BillExtraction>
extractPaymentFields(imageBlob)            → Promise<PaymentExtraction>
terminateOcrWorker()                       → Promise<void>   (cleanup)

BillExtraction: {
  trader_name, trader_address, invoice_number,
  bill_date, bill_amount, currency,
  confidence: number, raw_text: string,
  field_confidences: Record<string, number>
}

PaymentExtraction: {
  utr_number, payment_date, payment_mode,
  paid_amount, payer_name, payee_name,
  confidence: number, raw_text: string,
  field_confidences: Record<string, number>
}
```

### recordService.js

```text
saveRecord(billFile, paymentFile, fields)  → Promise<Record>
    Orchestrates: upload bill → upload payment → append to sheet
    Atomic: rolls back on failure

editRecord(recordId, updatedFields)        → Promise<Record>
    Updates mutable fields, increments edit_count

archiveRecord(recordId, reason?)           → Promise<void>
restoreRecord(recordId)                    → Promise<void>

generateProofPacketPDF(record)             → Promise<Blob>
generateBulkProofPacketPDF(records)        → Promise<Blob>
generatePlainTextSummary(record)           → string

exportCSV(records, includeArchived)        → string
downloadFullBackup(records)                → Promise<Blob>   (ZIP)
```

---

## Error Handling Contracts

### Atomic Save Rollback

```text
saveRecord() failure scenarios:

1. Bill upload fails:
   → Error thrown, no cleanup needed
   → User sees: "Failed to upload bill image. Please try again."

2. Payment upload fails:
   → Delete bill image from Drive (deleteImage(billFileId))
   → Error thrown
   → User sees: "Failed to upload payment image. Please try again."

3. Sheet append fails:
   → Delete bill image from Drive
   → Delete payment image from Drive
   → Error thrown
   → User sees: "Failed to save record. Please try again."

4. Rollback cleanup fails:
   → Log error (console.error)
   → User sees: "Save failed. Some files may need manual cleanup in Drive."
```

### Rate Limiting

```text
Google API quotas (default):
- Drive API: 12,000 requests/minute
- Sheets API: 300 requests/minute per user
- OCR (Tesseract.js): No rate limits — runs locally in browser

At 100 records/month (~3/day), these limits are never approached.
No rate limiting logic needed in v1.
```
