// api/youtube.js — Proxy dengan rotasi API key otomatis + caching
// Dukung hingga 10 key — otomatis ganti kalau satu habis quota

const BASE = 'https://www.googleapis.com/youtube/v3';

const CACHE_TTL = {
  videos:   3600,   // trending: cache 1 jam
  search:   1800,   // search: cache 30 menit
  channels: 86400,  // channel: cache 24 jam
  default:  1800,
};

function getKeys() {
  const keys = [];
  // Support format lama (YOUTUBE_API_KEY)
  if (process.env.YOUTUBE_API_KEY) keys.push(process.env.YOUTUBE_API_KEY);
  // Support format baru (YOUTUBE_API_KEY_1 sampai YOUTUBE_API_KEY_10)
  for (let i = 1; i <= 10; i++) {
    const k = process.env[`YOUTUBE_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  return [...new Set(keys)]; // hapus duplikat kalau ada
}

let keyIndex = 0; // rotasi round-robin

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const keys = getKeys();
  if (!keys.length) {
    return res.status(500).json({
      error: { message: 'Belum ada API key. Set YOUTUBE_API_KEY_1 s/d YOUTUBE_API_KEY_5 di Vercel.' }
    });
  }

  const { endpoint, ...params } = req.query;
  if (!endpoint) return res.status(400).json({ error: { message: 'Parameter endpoint wajib.' } });

  const ALLOWED = ['videos', 'search', 'channels'];
  if (!ALLOWED.includes(endpoint)) return res.status(403).json({ error: { message: 'Endpoint tidak diizinkan.' } });

  // Coba semua key satu per satu sampai berhasil
  let lastError = null;

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const idx = (keyIndex + attempt) % keys.length;

    try {
      const url = `${BASE}/${endpoint}?` + new URLSearchParams({ ...params, key: keys[idx] });
      const ytRes = await fetch(url);
      const data = await ytRes.json();

      if (data.error) {
        const code = data.error.code;
        const reason = data.error.errors?.[0]?.reason || '';

        // Quota habis / key tidak valid → coba key berikutnya
        if (code === 403 || reason === 'quotaExceeded' || reason === 'keyInvalid') {
          console.warn(`Key #${idx + 1} habis/invalid (${reason}), coba key berikutnya...`);
          lastError = data.error;
          keyIndex = (idx + 1) % keys.length;
          continue;
        }

        // Error lain → langsung return
        return res.status(400).json(data);
      }

      // ✅ Sukses!
      keyIndex = idx; // pakai key ini untuk request berikutnya juga

      const ttl = CACHE_TTL[endpoint] || CACHE_TTL.default;
      res.setHeader('Cache-Control', `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`);
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json(data);

    } catch (e) {
      lastError = { message: e.message };
    }
  }

  // Semua key gagal
  return res.status(503).json({
    error: {
      message: `Semua ${keys.length} API key habis quota. Coba lagi besok atau tambah key baru.`
    }
  });
}
