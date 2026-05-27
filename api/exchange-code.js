import {
  verifySessionToken,
  exchangeAuthCode,
  storeRefreshToken,
} from './_lib/sa-utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing session token' });
  }

  const { code } = req.body || {};
  if (!code) {
    return res.status(400).json({ error: 'Authorization code is required' });
  }

  const sessionToken = authHeader.slice(7);

  try {
    // Validate admin session
    const session = verifySessionToken(sessionToken);

    // Exchange auth code for tokens
    const tokenData = await exchangeAuthCode(code);

    if (!tokenData.refresh_token) {
      return res.status(400).json({
        error: 'No refresh token received. Please revoke app access in your Google Account settings and try again.',
      });
    }

    // Store encrypted refresh token in the spreadsheet
    await storeRefreshToken(session.sub, tokenData.refresh_token, session.email);

    return res.status(200).json({
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}
