# Google Cloud Setup Guide

Step-by-step instructions for configuring Google Cloud Platform for the Amit General Store Receipt Tracker.

## 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click **Select a project** (top bar) then **New Project**
3. Project name: `amit-general-store` (or any name)
4. Click **Create**
5. Note your **Project Number** from the project dashboard (you'll need it for `VITE_GOOGLE_PROJECT_NUMBER`)

## 2. Enable Required APIs

In your project, go to **APIs & Services > Library** and enable:

- **Google Drive API**
- **Google Sheets API**

## 3. Configure OAuth Consent Screen

1. Go to **APIs & Services > OAuth consent screen**
2. User type: **External**
3. Fill in app name, support email
4. Add scopes:
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/spreadsheets`
   - `openid`
   - `email`
   - `profile`
5. Add your Gmail address as a **Test user**
6. Click **Save**

## 4. Create OAuth 2.0 Client ID

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. Application type: **Web application**
4. Name: `Receipt Tracker Web`
5. **Authorized JavaScript origins**:
   - `http://localhost:5173` (development)
   - `https://your-app.vercel.app` (production)
6. **Authorized redirect URIs**: same URLs as above
7. Click **Create**
8. Copy the **Client ID** — this goes in `VITE_GOOGLE_CLIENT_ID`

## 5. Service Account Setup (for Admin Login)

The admin login feature uses a Service Account to verify credentials stored in a Google Sheet. The SA private key stays on the server (Vercel serverless function) and is never exposed to the browser.

### Create the Service Account

1. Go to **IAM & Admin > Service Accounts**
2. Click **Create Service Account**
3. Name: `admin-login`
4. Click **Create and Continue**
5. Skip the role assignment (no project-level roles needed)
6. Click **Done**

### Generate a Key

1. Click on your new Service Account
2. Go to the **Keys** tab
3. Click **Add Key > Create new key**
4. Key type: **JSON**
5. Download the JSON file
6. From the JSON file, copy:
   - `client_email` → this goes in `SA_CLIENT_EMAIL` (Vercel env var)
   - `private_key` → this goes in `SA_PRIVATE_KEY` (Vercel env var)

### Share Your Google Sheet

1. Open the Google Sheet used by the app (the one with the `records` tab)
2. Click **Share**
3. Add the Service Account email (e.g., `admin-login@your-project.iam.gserviceaccount.com`)
4. Give it **Editor** access (needed to read the `admin_users` tab)
5. Copy the **Spreadsheet ID** from the Sheet URL:
   `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
6. This goes in `SA_SPREADSHEET_ID` (Vercel env var)

### Set Up the admin_users Tab

1. In the same Google Sheet, create a new tab named `admin_users`
2. Add headers in row 1: `username`, `password`, `display_name`
3. Add admin users in subsequent rows
4. Run the password hash migration script to convert plaintext passwords to bcrypt:
   ```bash
   SA_CLIENT_EMAIL=... SA_PRIVATE_KEY=... SA_SPREADSHEET_ID=... node scripts/hash-admin-passwords.js
   ```

## 6. Vercel Environment Variables

In your Vercel project dashboard, go to **Settings > Environment Variables** and add:

### For all deployments (Production + Preview)

| Variable | Value |
|----------|-------|
| `VITE_GOOGLE_CLIENT_ID` | Your OAuth Client ID |
| `VITE_GOOGLE_PROJECT_NUMBER` | Your GCP project number |
| `VITE_ADMIN_LOGIN_ENABLED` | `true` |

### Server-only (for admin login serverless function)

| Variable | Value |
|----------|-------|
| `SA_CLIENT_EMAIL` | Service Account email from JSON key |
| `SA_PRIVATE_KEY` | Service Account private key from JSON key |
| `SA_SPREADSHEET_ID` | Spreadsheet ID from Google Sheet URL |

**Important**: The `SA_*` variables do NOT have the `VITE_` prefix. This ensures they are only available to serverless functions and never bundled into the client-side JavaScript.

## 7. Verify Setup

1. Deploy to Vercel: `vercel` or push to your production branch
2. Open the app URL
3. Test Google OAuth sign-in: click "Sign in with Google"
4. Test admin login: enter username/password from the `admin_users` sheet
5. Upload a bill and payment receipt to verify Drive access works
