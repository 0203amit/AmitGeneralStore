# Data Model: Receipt Tracker

**Branch**: `001-receipt-tracker` | **Date**: 2026-05-21

## Entities

### 1. Receipt Record

The central entity. Each record links one trader bill to its proof of payment. Stored as a single row in the Google Sheet worksheet named `records`.

#### Fields

| Field | Type | Default | Mutable | Nullable | Description |
|-------|------|---------|---------|----------|-------------|
| record_id | string (UUID v4) | generated client-side | **IMMUTABLE** | no | Primary identifier |
| created_at | string (ISO 8601) | set at creation | **IMMUTABLE** | no | When the record was first saved |
| updated_at | string (ISO 8601) | set at creation | yes | no | Last modification timestamp |
| status | enum: `active`, `archived` | `active` | yes | no | Record lifecycle state (never `deleted`) |
| archived_at | string (ISO 8601) | null | yes | yes | When the record was archived |
| archived_reason | string | null | yes | yes | User-provided reason for archiving |

**Bill Fields** (editable — OCR-extracted, may need correction):

| Field | Type | Default | Mutable | Nullable | Description |
|-------|------|---------|---------|----------|-------------|
| trader_name | string | from OCR | yes | no | Name of the trader/supplier |
| trader_address | string | from OCR | yes | yes | Trader address or branch code |
| invoice_number | string | from OCR | yes | no | Bill/invoice number |
| bill_date | string (YYYY-MM-DD) | from OCR | yes | no | Date on the bill |
| bill_amount | number (decimal) | from OCR | yes | no | Total amount on the bill |
| currency | string | `INR` | yes | no | Currency code |

**Uniqueness**:

| Field | Type | Default | Mutable | Nullable | Description |
|-------|------|---------|---------|----------|-------------|
| composite_key | string | auto-computed | yes (recomputed on edit of key fields) | no | `lowercase(trim(trader_name))\|lowercase(trim(invoice_number))\|bill_date` — used for O(1) duplicate lookup |

**Payment Fields** (editable — OCR-extracted, may need correction):

| Field | Type | Default | Mutable | Nullable | Description |
|-------|------|---------|---------|----------|-------------|
| utr_number | string | from OCR/regex | yes | no | UTR / transaction reference number |
| payment_date | string (YYYY-MM-DD) | from OCR/regex | yes | no | Date of payment |
| payment_mode | enum: `gpay`, `phonepe`, `paytm`, `net_banking`, `card`, `other` | auto-detected | yes | no | Payment method |
| paid_amount | number (decimal) | from OCR/regex | yes | no | Amount paid |
| payer_name | string | from OCR | yes | yes | Name of the payer |
| payee_name | string | from OCR | yes | yes | Name of the payee |

**Drive References** (immutable — the actual proof):

| Field | Type | Default | Mutable | Nullable | Description |
|-------|------|---------|---------|----------|-------------|
| bill_image_file_id | string | from Drive upload | **IMMUTABLE** | no | Google Drive file ID for the bill image |
| bill_image_url | string | from Drive upload | **IMMUTABLE** | no | webViewLink for the bill image |
| payment_image_file_id | string | from Drive upload | **IMMUTABLE** | no | Google Drive file ID for the payment image |
| payment_image_url | string | from Drive upload | **IMMUTABLE** | no | webViewLink for the payment image |

**OCR Metadata**:

| Field | Type | Default | Mutable | Nullable | Description |
|-------|------|---------|---------|----------|-------------|
| bill_ocr_confidence | number (0.0–1.0) | from Tesseract.js | no | no | OCR confidence score for bill extraction |
| payment_ocr_confidence | number (0.0–1.0) | from Tesseract.js | no | no | OCR confidence score for payment extraction |
| needs_review | boolean | `true` if any confidence < 0.7 | yes | no | Flag for low-confidence extractions |

**Audit Trail**:

| Field | Type | Default | Mutable | Nullable | Description |
|-------|------|---------|---------|----------|-------------|
| edit_count | integer | `0` | yes (increment only) | no | Number of times the record has been edited |
| last_edited_field | string | null | yes | yes | Name of the last field that was changed |
| last_edited_at | string (ISO 8601) | null | yes | yes | Timestamp of the last edit |

**Optional**:

| Field | Type | Default | Mutable | Nullable | Description |
|-------|------|---------|---------|----------|-------------|
| notes | string | null | yes | yes | User's private notes (e.g., "settled in person") |
| tags | string | null | yes | yes | Comma-separated tags (e.g., "groceries,monthly") |

#### Total Column Count: 31 columns

#### Column Order in Sheet

```text
A: record_id
B: created_at
C: updated_at
D: status
E: archived_at
F: archived_reason
G: trader_name
H: trader_address
I: invoice_number
J: bill_date
K: bill_amount
L: currency
M: composite_key
N: utr_number
O: payment_date
P: payment_mode
Q: paid_amount
R: payer_name
S: payee_name
T: bill_image_file_id
U: bill_image_url
V: payment_image_file_id
W: payment_image_url
X: bill_ocr_confidence
Y: payment_ocr_confidence
Z: needs_review
AA: edit_count
AB: last_edited_field
AC: last_edited_at
AD: notes
AE: tags
```

Note: 31 columns total (A through AE). The header row (row 1) contains the field names exactly as listed. Data rows start at row 2.

### 2. Bill Image (Google Drive File)

Not a database entity — a file stored in Google Drive.

| Property | Value |
|----------|-------|
| Location | `My Drive/Amit General Store - Receipts/bills/` |
| Filename | `{record_id}_bill.{ext}` (e.g., `a1b2c3d4_bill.jpg`) |
| Formats | JPG, JPEG, PNG |
| Max size | 10 MB (compressed to ≤5 MB if originally >5 MB) |
| Mutability | **IMMUTABLE** — never modified after upload |

### 3. Payment Image (Google Drive File)

| Property | Value |
|----------|-------|
| Location | `My Drive/Amit General Store - Receipts/payments/` |
| Filename | `{record_id}_payment.{ext}` (e.g., `a1b2c3d4_payment.jpg`) |
| Formats | JPG, JPEG, PNG |
| Max size | 10 MB (compressed to ≤5 MB if originally >5 MB) |
| Mutability | **IMMUTABLE** — never modified after upload |

### 4. Google Drive Folder Structure

```text
My Drive/
└── Amit General Store - Receipts/    ← root app folder (created on first sign-in)
    ├── bills/                         ← bill images subfolder
    │   ├── {record_id}_bill.jpg
    │   └── ...
    └── payments/                      ← payment images subfolder
        ├── {record_id}_payment.jpg
        └── ...
```

- Folder names sourced from `src/config/branding.js`
- Root folder and subfolders created via Drive API v3 on first sign-in
- Existence checked on every sign-in (idempotent creation using `name` + `mimeType` query)

### 5. Google Sheet Structure

| Property | Value |
|----------|-------|
| Spreadsheet name | `Amit General Store - Receipt Database` |
| Worksheet name | `records` |
| Header row | Row 1 (field names as column headers) |
| Data rows | Row 2 onwards |
| Created on | First sign-in (idempotent — checks by name before creating) |

## Relationships

```text
Receipt Record (1) ──has── (1) Bill Image
Receipt Record (1) ──has── (1) Payment Image

Both images are REQUIRED. A record without both images cannot exist.
```

## Validation Rules

### On Create (Save New Record)

1. Both `bill_image_file_id` and `payment_image_file_id` MUST be present
2. `record_id` MUST be a valid UUID v4, generated client-side
3. `created_at` MUST be set to current ISO 8601 timestamp
4. `status` MUST be `active`
5. `composite_key` MUST be computed from (trader_name, invoice_number, bill_date)
6. `composite_key` MUST NOT match any existing active record (unless user force-saves)
7. `edit_count` MUST be `0`
8. `bill_date` and `payment_date` MUST be valid YYYY-MM-DD strings
9. `payment_mode` MUST be one of: `gpay`, `phonepe`, `paytm`, `net_banking`, `card`, `other`
10. `bill_amount` and `paid_amount` MUST be non-negative numbers

### On Update (Edit Record)

1. Immutable fields MUST NOT change: `record_id`, `created_at`, `bill_image_file_id`, `bill_image_url`, `payment_image_file_id`, `payment_image_url`
2. `edit_count` MUST increment by 1
3. `updated_at` and `last_edited_at` MUST update to current timestamp
4. `last_edited_field` MUST be set to the name of the changed field
5. If `trader_name`, `invoice_number`, or `bill_date` changed → recompute `composite_key` and re-run duplicate detection

### On Archive

1. `status` changes from `active` to `archived`
2. `archived_at` MUST be set to current ISO 8601 timestamp
3. `archived_reason` MAY be set (optional user input)
4. Sheet row MUST be preserved (not deleted)
5. Drive images MUST be preserved (not deleted)

### On Restore

1. `status` changes from `archived` to `active`
2. `archived_at` and `archived_reason` MUST be preserved (not cleared) for audit trail
3. Record reappears in default History view

## State Transitions

```text
┌──────────┐         archive()          ┌──────────┐
│          │ ───────────────────────────►│          │
│  active  │                             │ archived │
│          │ ◄───────────────────────────│          │
└──────────┘         restore()           └──────────┘

There is NO "deleted" state. No transition leads to permanent removal.
```

## Composite Key Examples

| trader_name (input) | invoice_number (input) | bill_date | composite_key (computed) |
|---------------------|----------------------|-----------|--------------------------|
| Sharma Traders | INV-001 | 2026-05-15 | `sharma traders\|inv-001\|2026-05-15` |
| sharma traders | INV-001 | 2026-05-15 | `sharma traders\|inv-001\|2026-05-15` (matches above → duplicate) |
| SHARMA TRADERS | inv-001 | 2026-05-15 | `sharma traders\|inv-001\|2026-05-15` (matches above → duplicate) |
| Sharma Traders | INV-001 | 2026-06-15 | `sharma traders\|inv-001\|2026-06-15` (different date → allowed) |
| Patel Wholesale | INV-001 | 2026-05-15 | `patel wholesale\|inv-001\|2026-05-15` (different trader → allowed) |
