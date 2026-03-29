// api/youtube.js — Proxy dengan rotasi API key + caching agresif
const BASE = 'https://www.googleapis.com/youtube/v3';
const CACHE_TTL = {
  videos: 7200,        // trending: 2 jam
  search: 3600,        // search: 1 jam
  channels: 172800,    // channel: 48 jam
  commentThreads: 3600,// komentar: 1 jam
  default: 3600,
};

function getKeys() {
  const keys = [];
  if (process.env.YOUTUBE_API_KEY) keys.push(process.env.YOUTUBE_API_KEY);
  for (let i = 1; i <= 10; i++) {
    const k = process.env[`YOUTUBE_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  return [...new Set(keys)];
}
let keyIndex = 0;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const keys = getKeys();
  if (!keys.length) return res.status(500).json({ error: { message: 'Belum ada API key di Vercel.' } });

  const { endpoint, ...params } = req.query;
  if (!endpoint) return res.status(400).json({ error: { message: 'Parameter endpoint wajib.' } });

  // Tambah commentThreads ke whitelist
  const ALLOWED = ['videos', 'search', 'channels', 'commentThreads', 'playlistItems', 'subscriptions'];
  if (!ALLOWED.includes(endpoint)) return res.status(403).json({ error: { message: 'Endpoint tidak diizinkan.' } });

  let lastError = null;
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const idx = (keyIndex + attempt) % keys.length;
    try {
      const url = `${BASE}/${endpoint}?` + new URLSearchParams({ ...params, key: keys[idx] });
      const ytRes = await fetch(url);
      const data = await ytRes.json();
      if (data.error) {
        const reason = data.error.errors?.[0]?.reason || '';
        if (data.error.code === 403 || reason === 'quotaExceeded' || reason === 'keyInvalid') {
          lastError = data.error; keyIndex = (idx + 1) % keys.length; continue;
        }
        return res.status(400).json(data);
      }
      keyIndex = idx;
      const ttl = CACHE_TTL[endpoint] || CACHE_TTL.default;
      res.setHeader('Cache-Control', `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`);
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json(data);
    } catch (e) { lastError = { message: e.message }; }
  }
  return res.status(503).json({ error: { message: `Semua ${keys.length} API key habis quota.` } });
}
