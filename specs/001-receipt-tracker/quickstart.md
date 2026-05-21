# Quickstart: Receipt Tracker

**Branch**: `001-receipt-tracker` | **Date**: 2026-05-21

## Prerequisites

- Node.js 18+ and npm 9+
- A Google account (Gmail)
- A Google Cloud project with billing enabled (free tier covers usage)

## 1. Google Cloud Setup

### Create Project & Enable APIs

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (e.g., `receipt-tracker`)
3. Enable these APIs:
   - Google Drive API
   - Google Sheets API

### Create OAuth 2.0 Credentials

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Authorized JavaScript origins:
   - `http://localhost:5173` (dev)
   - `https://<your-app>.vercel.app` (production)
5. Authorized redirect URIs: same as above
6. Copy the **Client ID**

### Configure OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. User type: **External**
3. Add scopes:
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/spreadsheets`
   - `openid`, `email`, `profile`
4. Add your Gmail as a test user

> **Note**: No Document AI setup required — OCR is handled by Tesseract.js in the browser.

## 2. Project Setup

### Clone & Install

```bash
git clone <repo-url>
cd amit-general-store
npm install
```

### Environment Variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
VITE_GOOGLE_PROJECT_ID=<your-gcp-project-id>
```

### Run Development Server

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

## 3. First-Time Sign-In

1. Click **"Sign in with Google"**
2. Authorize the requested permissions
3. The app will automatically create:
   - Drive folder: `Amit General Store - Receipts/` (with `bills/` and `payments/` subfolders)
   - Google Sheet: `Amit General Store - Receipt Database` (with `records` worksheet and header row)
4. You'll be redirected to the Dashboard

## 4. Upload Your First Record

1. Navigate to **Upload**
2. Add a bill image (take photo or browse files)
3. Add a payment receipt image
4. Click **"Extract & Save"**
5. Review the OCR-extracted fields, correct if needed
6. Click **"Save Record"**
7. Verify: check your Google Drive for the uploaded images, and your Google Sheet for the new row

## 5. Build for Production

```bash
npm run build
```

Output is in the `dist/` directory — deploy to Vercel or any static hosting.

## 6. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

After deployment:
1. Update your OAuth credentials with the production URL
2. Add the Vercel URL to **Authorized JavaScript origins** and **redirect URIs**

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server on port 5173 |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_GOOGLE_CLIENT_ID` | Yes | OAuth 2.0 Client ID from Google Cloud Console |
| `VITE_GOOGLE_PROJECT_ID` | Yes | Google Cloud project ID |
