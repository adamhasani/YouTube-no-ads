// api/youtube.js — Vercel Serverless Proxy
// API key AMAN di server, user tidak bisa lihat sama sekali.
// Dilengkapi caching otomatis di Vercel Edge Network.

const BASE = 'https://www.googleapis.com/youtube/v3';

// Cache TTL per endpoint (detik)
const CACHE_TTL = {
  videos:    3600,  // trending: cache 1 jam
  search:    1800,  // search: cache 30 menit
  channels:  86400, // channel info: cache 24 jam
  default:   1800,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_KEY = process.env.YOUTUBE_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({
      error: { message: 'YOUTUBE_API_KEY belum diset di Vercel Environment Variables.' }
    });
  }

  // Ambil endpoint & params dari query string
  const { endpoint, ...params } = req.query;

  if (!endpoint) {
    return res.status(400).json({ error: { message: 'Parameter "endpoint" wajib ada.' } });
  }

  // Whitelist endpoint yang diizinkan (keamanan)
  const ALLOWED = ['videos', 'search', 'channels'];
  if (!ALLOWED.includes(endpoint)) {
    return res.status(403).json({ error: { message: 'Endpoint tidak diizinkan.' } });
  }

  try {
    params.key = API_KEY;
    const url = `${BASE}/${endpoint}?` + new URLSearchParams(params);
    const ytRes = await fetch(url);
    const data = await ytRes.json();

    // Set cache header — Vercel Edge akan cache response ini
    const ttl = CACHE_TTL[endpoint] || CACHE_TTL.default;
    res.setHeader('Cache-Control', `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`);
    res.setHeader('Content-Type', 'application/json');

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: { message: 'Gagal fetch ke YouTube API.' } });
  }
}
