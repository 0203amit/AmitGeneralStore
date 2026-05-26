# Amit General Store - Receipt Tracker

A single-page web app for digitizing, storing, and managing bill and payment receipts. Built with React + Vite, using Google Drive for image storage and Google Sheets as the database. All data stays in the user's own Google account.

## Tech Stack

- **Frontend**: React 18, Tailwind CSS, React Router v6
- **OCR**: Tesseract.js (in-browser, no server needed)
- **Storage**: Google Drive API (images), Google Sheets API (records)
- **Auth**: Google OAuth 2.0 (implicit flow)
- **Hosting**: Vercel (static SPA + serverless functions)

## Quick Start

```bash
git clone <repo-url>
cd amit-general-store
cp .env.example .env
# Fill in VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_PROJECT_NUMBER
npm install
npm run dev
```

See [quickstart.md](specs/001-receipt-tracker/quickstart.md) for detailed setup instructions including Google Cloud configuration.

## Google Cloud Setup

See [GOOGLE_CLOUD_SETUP.md](GOOGLE_CLOUD_SETUP.md) for step-by-step GCP project, OAuth, and Service Account configuration.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server on port 5173 |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |

## Environment Variables

### Client-side (prefixed with `VITE_`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_GOOGLE_CLIENT_ID` | Yes | OAuth 2.0 Client ID |
| `VITE_GOOGLE_PROJECT_NUMBER` | Yes | GCP project number |
| `VITE_ADMIN_LOGIN_ENABLED` | No | Set to `true` to show admin login form |

### Server-side (Vercel env vars, no `VITE_` prefix)

| Variable | Required | Description |
|----------|----------|-------------|
| `SA_CLIENT_EMAIL` | For admin login | Service Account email |
| `SA_PRIVATE_KEY` | For admin login | Service Account private key (PEM) |
| `SA_SPREADSHEET_ID` | For admin login | Google Sheet ID for credential verification |

## Project Structure

```
src/
  components/    # React components (auth, upload, history, dashboard, settings, shared)
  context/       # AuthContext provider
  hooks/         # Custom hooks (useAuth, useRecords, useUpload)
  services/      # Google API wrappers (Drive, Sheets, OCR, records)
  utils/         # Parsing, export, image processing utilities
  config/        # Branding constants
api/             # Vercel serverless functions
specs/           # Feature specifications and design docs
```

## Documentation

- [Description.md](Description.md) - Full project specification
- [specs/001-receipt-tracker/spec.md](specs/001-receipt-tracker/spec.md) - Formal feature spec
- [specs/001-receipt-tracker/plan.md](specs/001-receipt-tracker/plan.md) - Implementation plan
- [GOOGLE_CLOUD_SETUP.md](GOOGLE_CLOUD_SETUP.md) - GCP setup guide
