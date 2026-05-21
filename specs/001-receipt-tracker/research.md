# Research: Receipt Tracker

**Branch**: `001-receipt-tracker` | **Date**: 2026-05-21

## Research Task 1: OAuth Library Strategy (@react-oauth/google + gapi-script)

### Decision
Use **@react-oauth/google** for the sign-in UI and initial token acquisition, then **gapi-script** to load the Google API client library (`gapi.client`) for making Drive and Sheets API calls with that token. OCR is handled by Tesseract.js in-browser (no Google API needed).

### Rationale
- `@react-oauth/google` wraps Google Identity Services (GIS), which is Google's current recommended library for OAuth sign-in in SPAs. It provides the `<GoogleOAuthProvider>` and `useGoogleLogin` hook that handle the consent flow and return an access token.
- `gapi.client` (loaded via `gapi-script`) provides typed request builders for Google REST APIs (`gapi.client.drive.files.create`, `gapi.client.sheets.spreadsheets.values.append`, etc.), handling serialization, headers, and error parsing.
- The two libraries serve distinct roles: GIS handles authentication, gapi handles API calls. They compose cleanly: after GIS returns an access token, call `gapi.client.setToken({ access_token })` to configure gapi for all subsequent API calls.

### Alternatives Considered
- **gapi.auth2 (legacy)**: Deprecated by Google since March 2023. Must not be used.
- **googleapis (npm)**: This is the Node.js server-side SDK. It bundles server-specific dependencies (http, crypto) and is not designed for browser use. Rejected.
- **Raw fetch with manual headers**: Works but loses the convenience of `gapi.client` discovery docs, automatic pagination, and structured error responses. More code, more bugs.
- **GIS token client only (no gapi)**: Possible — use `google.accounts.oauth2.initTokenClient` for token, then raw `fetch()` for API calls. This avoids the gapi dependency entirely but requires manually constructing all API request URLs, headers, and parsing responses. For 2 different APIs (Drive, Sheets), gapi.client is worth the dependency.

### Token Refresh Note
The implicit OAuth flow (used by `useGoogleLogin({ flow: 'implicit' })`) returns short-lived access tokens (~1 hour) and does **not** issue refresh tokens. Refresh tokens require the authorization code flow, which needs a backend to exchange the code. For the no-backend architecture:
- Store the `expires_in` value from the token response
- Before it expires, call `google.accounts.oauth2.initTokenClient()` with `prompt: ''` to attempt a silent re-authorization
- If silent refresh fails (e.g., session lapsed), the user sees a brief consent popup
- The spec's mention of "Refresh token handled by Google client library" should be understood as this silent re-auth pattern, not actual refresh tokens

### Implementation Notes
- Load gapi via `gapi-script` in `main.jsx` (or `useEffect` in `AuthContext`)
- Use `useGoogleLogin({ flow: 'implicit', scope: '...' })` to get an access token
- After sign-in, call `gapi.client.init()` with discovery docs for Drive v3 and Sheets v4
- Set the token on gapi: `gapi.client.setToken({ access_token })`
- OCR is handled by Tesseract.js (in-browser) — no Google API call needed for OCR

---

## Research Task 2: OCR Engine Selection

### Decision
Use **Tesseract.js** for browser-based OCR instead of Google Document AI.

### Rationale
- Document AI requires ₹5,000 prepayment (Google Cloud billing) which isn't justified for personal-use volume (~100 receipts/month)
- Tesseract.js runs entirely in the browser — no cloud API calls, no billing, no IAM configuration
- No `cloud-platform` OAuth scope needed (reduces permission surface)
- Trade-off: lower accuracy (~75-85% vs Document AI's ~92%), but the mandatory manual review form compensates

### Implementation
- Tesseract.js v5 with singleton worker pattern (create once, reuse)
- English language model downloaded from CDN on first use (~15MB)
- Regex-based field extraction from plain OCR text (no entity mapping)
- Per-field confidence assigned by extraction pattern quality
- Overall confidence weighted by Tesseract's word-level confidence score

### Alternatives Considered
- **Google Document AI**: Best accuracy but requires ₹5,000 prepayment + cloud-platform OAuth scope + IAM setup. Rejected due to cost.
- **Cloud Vision API**: Requires billing. Similar cost concerns. Rejected.
- **Self-hosted OCR server**: Violates no-backend constraint. Rejected.

---

## Research Task 3: Google Drive API v3 from Browser (Best Practices)

### Decision
Use `gapi.client.drive` for metadata operations (folder creation, file queries, deletion) and **multipart upload via `fetch()`** for file uploads (gapi.client doesn't handle multipart binary uploads cleanly).

### Rationale
- `gapi.client.drive.files.list()`, `.create()` (metadata only), `.delete()` work well for folder management
- For uploading binary files (images), the `uploadType=multipart` endpoint requires constructing a multipart/related body with both JSON metadata and binary content. This is easier and more reliable with raw `fetch()` than with gapi's request builder.

### Key Patterns

**Folder creation (idempotent)**:
1. Query: `name='Amit General Store - Receipts' and mimeType='application/vnd.google-apps.folder' and trashed=false`
2. If found → use existing folder ID
3. If not found → create folder

**File upload (multipart)**:
1. Build multipart/related body with boundary
2. Part 1: JSON metadata (`name`, `parents`)
3. Part 2: Binary image data with content-type
4. POST to `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink`

**File download (for PDF embedding)**:
1. GET `https://www.googleapis.com/drive/v3/files/{fileId}?alt=media` with Authorization header
2. Response is binary blob
3. Convert to data URL via `FileReader.readAsDataURL()` or `URL.createObjectURL()`

### Alternatives Considered
- **gapi.client for uploads**: gapi.client.request can technically send binary, but the multipart boundary handling is fragile and poorly documented. Raw fetch is more predictable.
- **Resumable uploads**: Overkill for files ≤10 MB. Resumable uploads add complexity (initiate session, then upload chunks). Simple multipart is sufficient.

---

## Research Task 4: Google Sheets API v4 from Browser (Best Practices)

### Decision
Use `gapi.client.sheets` for all Sheets operations. The API handles reads, appends, and updates cleanly.

### Rationale
- `gapi.client.sheets.spreadsheets.values.get()` for reading all records
- `gapi.client.sheets.spreadsheets.values.append()` for adding new records
- `gapi.client.sheets.spreadsheets.values.update()` for editing existing records
- `gapi.client.sheets.spreadsheets.create()` for creating the spreadsheet on first sign-in

### Key Patterns

**Read all records**:
```text
gapi.client.sheets.spreadsheets.values.get({
  spreadsheetId: SHEET_ID,
  range: 'records!A:AE'
})
```
Returns all rows including header. Parse in client: row 0 = headers, rows 1+ = data.

**Append a record**:
```text
gapi.client.sheets.spreadsheets.values.append({
  spreadsheetId: SHEET_ID,
  range: 'records!A:AE',
  valueInputOption: 'RAW',
  insertDataOption: 'INSERT_ROWS',
  resource: { values: [[...rowData]] }
})
```

**Update a record** (by row number):
1. First, find the row number: scan the in-memory records array for the matching record_id. The row number = array index + 2 (row 1 is header, data starts at row 2).
2. Then update:
```text
gapi.client.sheets.spreadsheets.values.update({
  spreadsheetId: SHEET_ID,
  range: `records!A${rowNum}:AE${rowNum}`,
  valueInputOption: 'RAW',
  resource: { values: [[...updatedRowData]] }
})
```

### Row Number Tracking
- When records are fetched, store the row index alongside each record in memory
- On update, use this row index to target the correct Sheets row
- After an append, the new row's index = previous last row + 1

### Alternatives Considered
- **batchUpdate for multiple edits**: Unnecessary in v1 — edits are one-at-a-time
- **Named ranges**: Adds complexity without benefit for a single-worksheet model

---

## Research Task 5: jsPDF + html2canvas for Proof Packets

### Decision
Use **jsPDF** directly (without html2canvas) for text-based pages (cover, data summary), and use jsPDF's `addImage()` method for image pages. Fetch Drive images as blobs using the authenticated Drive API endpoint, convert to data URLs, then embed in the PDF.

### Rationale
- jsPDF's `addImage()` accepts data URLs (base64) and renders them on PDF pages at specified coordinates
- html2canvas is useful for converting rendered HTML to canvas, but for this use case, the PDF content is structured data (text fields, images) that can be built programmatically with jsPDF's API — no need to render and capture HTML
- Drive images must be fetched via authenticated API calls (they are private files), so there are no CORS issues when using `gapi.client.request()` or `fetch()` with the OAuth token — the response is a blob that can be converted to a data URL

### CORS Handling
- **Do NOT use Drive image URLs directly** (e.g., `https://drive.google.com/uc?id=...`) — these trigger CORS errors when fetched from JavaScript
- **DO use the Drive API download endpoint**: `GET https://www.googleapis.com/drive/v3/files/{fileId}?alt=media` with `Authorization: Bearer {token}` — this returns the binary data without CORS issues because Google API endpoints have proper CORS headers for authenticated requests

### html2canvas Role
- Keep html2canvas as a dependency but use it only if needed for rendering complex HTML layouts (e.g., the cover page if CSS styling is desired). For v1, programmatic jsPDF text/image placement is simpler and more predictable.

### Alternatives Considered
- **pdf-lib**: More modern and supports async operations natively. However, jsPDF has a larger ecosystem and more examples for the image-embedding use case. Either would work; jsPDF chosen because it's specified in the tech stack.
- **Server-side PDF generation**: Violates the no-backend constraint. Rejected.
- **Print-to-PDF via browser**: Not automatable; cannot produce consistent branded PDFs across browsers.

---

## Research Task 6: HEIC to JPEG Conversion in Browser

### Decision
Use **heic2any** library for HEIC→JPEG conversion. **browser-image-compression** does NOT handle HEIC conversion.

### Rationale
- `browser-image-compression` handles JPEG/PNG compression and resizing but does not convert HEIC to other formats
- `heic2any` is a browser-compatible library that converts HEIC/HEIF images to JPEG or PNG using a WASM-based decoder
- The conversion should happen as the first step in the image processing pipeline, before compression

### Processing Pipeline
```text
1. User selects/captures image
2. If HEIC/HEIF → convert to JPEG via heic2any
3. Read EXIF orientation → auto-rotate (browser-image-compression handles this)
4. If file > 5 MB → compress via browser-image-compression (quality: 0.9, maxWidthOrHeight: 2500)
5. Result: optimized JPEG ready for upload and OCR
```

### Dependency Addition
- Add `heic2any` to package.json
- This is justified per Constitution I (no unnecessary dependencies): HEIC is common on iOS devices, and the store owner may use an iPhone. Without this library, iOS photos would fail to upload.

### Alternatives Considered
- **libheif-js**: Lower-level WASM binding. Works but heic2any provides a simpler API (`heic2any({ blob, toType: 'image/jpeg', quality: 0.9 })`).
- **Reject HEIC uploads entirely**: Poor UX for iOS users. Rejected per Constitution V (minimize taps, forgiving of mistakes).
- **Server-side conversion**: Violates no-backend constraint. Rejected.

---

## Research Task 7: react-dropzone and Camera Capture

### Decision
Use **react-dropzone** for drag-and-drop and file browsing. Use a **separate native `<input>` element** for camera capture, since react-dropzone does not support the `capture` attribute.

### Rationale
- react-dropzone manages the drop zone UI, drag events, file selection dialog, and file type/size validation
- The HTML `capture="environment"` attribute must be on an `<input type="file">` element to trigger the device camera. react-dropzone uses a hidden file input internally but does not expose the `capture` attribute in its API
- Solution: render two input methods per drop zone:
  1. The react-dropzone zone itself (for drag-and-drop + "Browse" clicks)
  2. A separate button with a hidden `<input type="file" accept="image/*" capture="environment">` for "Take photo"

### Component Design
```text
ImageDropzone.jsx:
├── react-dropzone zone (handles drag-and-drop + browse)
├── "Take photo" button → triggers hidden <input capture="environment">
├── "Choose from gallery" button → triggers react-dropzone's open()
├── Preview area (shows selected image with Replace/Remove)
└── Validation messages (file type, file size)

Bill zone:     "Take photo" is primary button on mobile
Payment zone:  "Choose from gallery" is primary button on mobile
```

### Alternatives Considered
- **react-dropzone inputProps with capture**: The `getInputProps()` function from react-dropzone accepts extra props, and you could try `getInputProps({ capture: 'environment' })`. However, this forces ALL file selections through the camera (even the browse/drop path), which is undesirable. The camera input must be a separate action.
- **react-camera-pro or react-webcam**: These provide custom camera UIs within the page. Overkill — the native browser camera UI (triggered by `<input capture>`) is sufficient and familiar to users.
- **MediaDevices.getUserMedia()**: Low-level camera access API. Requires building a custom viewfinder, shutter button, and image capture. Way too complex for this use case.

---

## Summary of Dependencies

### Confirmed from User's Tech Stack
| Package | Version | Purpose |
|---------|---------|---------|
| react | ^18 | UI framework |
| react-dom | ^18 | React DOM renderer |
| react-router-dom | ^6 | Client-side routing |
| @react-oauth/google | latest | Google OAuth 2.0 sign-in |
| gapi-script | latest | Google API client loader |
| jspdf | latest | PDF generation |
| html2canvas | latest | HTML-to-canvas (backup for PDF, may not be needed for v1) |
| browser-image-compression | latest | Image compression for files > 5 MB |
| recharts | latest | Dashboard charts |
| lucide-react | latest | Icons |
| lodash | latest | Utility functions (debounce, sortBy) |
| date-fns | latest | Date formatting |
| react-dropzone | latest | Drag-and-drop file upload |

### Additional Dependencies Identified by Research
| Package | Version | Purpose | Justification |
|---------|---------|---------|---------------|
| heic2any | latest | HEIC→JPEG conversion | iOS users capture HEIC photos; required by FR-011 |
| uuid | latest | UUID v4 generation for record_id | Client-side unique ID generation; required by data model |
| jszip | latest | ZIP file generation for full backup | Required by FR-062 (full backup as ZIP) |
| file-saver | latest | Trigger browser file download for exports | Clean download API for CSV, PDF, ZIP exports |

### Dev Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| vite | latest | Build tool |
| @vitejs/plugin-react | latest | Vite React plugin |
| tailwindcss | ^3 | Utility-first CSS |
| postcss | latest | CSS processing (Tailwind requirement) |
| autoprefixer | latest | CSS vendor prefixing (Tailwind requirement) |
