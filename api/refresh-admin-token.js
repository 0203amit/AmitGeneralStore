import { verifySessionToken, getAdminAccessToken } from './_lib/sa-utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing session token' });
  }

  const sessionToken = authHeader.slice(7);

  try {
    // Validate session JWT (checks signature + expiry)
    verifySessionToken(sessionToken);

    // Generate a fresh SA access token with drive.file + spreadsheets scopes
    const { access_token, expires_in } = await getAdminAccessToken();

    return res.status(200).json({ access_token, expires_in });
  } catch (err) {
    const status = err.status || 401;
    return res.status(status).json({ error: err.message });
  }
}
