import {
  verifySessionToken,
  getStoredRefreshToken,
  refreshUserOAuthToken,
} from './_lib/sa-utils.js';

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
    const session = verifySessionToken(sessionToken);

    // Get stored refresh token for this user
    const refreshToken = await getStoredRefreshToken(session.sub);
    if (!refreshToken) {
      throw Object.assign(
        new Error('No refresh token stored. Please sign in again.'),
        { status: 401 },
      );
    }

    // Use refresh token to get a fresh user OAuth access token
    const { access_token, expires_in } = await refreshUserOAuthToken(refreshToken);

    return res.status(200).json({ access_token, expires_in });
  } catch (err) {
    const status = err.status || 401;
    return res.status(status).json({ error: err.message });
  }
}
