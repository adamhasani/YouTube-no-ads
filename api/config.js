// api/config.js — Returns frontend config (Google Client ID, etc.)
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=3600');
  res.status(200).json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
  });
}
