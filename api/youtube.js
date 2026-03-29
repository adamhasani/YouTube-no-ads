// api/youtube.js — Proxy dengan rotasi API key + Invidious fallback + caching agresif
const BASE = 'https://www.googleapis.com/youtube/v3';
const CACHE_TTL = {
  videos: 7200,        // trending: 2 jam
  search: 3600,        // search: 1 jam
  channels: 172800,    // channel: 48 jam
  commentThreads: 3600,// komentar: 1 jam
  default: 3600,
};

const INV_INSTANCES = [
  'https://iv.datura.network',
  'https://invidious.privacyredirect.com',
  'https://invidious.fdn.fr',
  'https://inv.nadeko.net',
  'https://invidious.jing.rocks',
];

function getKeys() {
  const keys = [];
  // Support berbagai nama env var
  if (process.env.YOUTUBE_API_KEY) keys.push(process.env.YOUTUBE_API_KEY);
  if (process.env.YT_API_KEY)      keys.push(process.env.YT_API_KEY);
  for (let i = 1; i <= 10; i++) {
    const k = process.env[`YOUTUBE_API_KEY_${i}`] || process.env[`YT_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  return [...new Set(keys)];
}
let keyIndex = 0;

// ── Convert Invidious video object → YouTube API format
function invToYT(v) {
  const id = v.videoId || v.id || '';
  const dur = v.lengthSeconds
    ? `PT${Math.floor(v.lengthSeconds/3600) ? Math.floor(v.lengthSeconds/3600)+'H' : ''}${Math.floor((v.lengthSeconds%3600)/60) ? Math.floor((v.lengthSeconds%3600)/60)+'M' : ''}${v.lengthSeconds%60}S`
    : '';
  return {
    id,
    snippet: {
      title: v.title || '',
      channelTitle: v.author || v.channelTitle || '',
      channelId: v.authorId || v.channelId || '',
      publishedAt: v.published ? new Date(v.published * 1000).toISOString() : '',
      description: v.description || '',
      thumbnails: {
        high:   { url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` },
        medium: { url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` },
        default:{ url: `https://i.ytimg.com/vi/${id}/default.jpg` },
      },
      liveBroadcastContent: v.liveNow ? 'live' : 'none',
    },
    statistics: {
      viewCount: String(v.viewCount || 0),
      likeCount:  String(v.likeCount  || 0),
    },
    contentDetails: { duration: dur },
  };
}

// ── Invidious: trending
async function invTrending(categoryId, maxResults) {
  const catMap = { '10':'music','20':'gaming','25':'news','17':'sports','28':'science','24':'entertainment' };
  const type   = catMap[categoryId] || '';
  for (const base of INV_INSTANCES) {
    try {
      const url = `${base}/api/v1/trending?region=ID${type ? '&type='+type : ''}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!r.ok) continue;
      const data = await r.json();
      if (!Array.isArray(data) || !data.length) continue;
      const items = data.slice(0, maxResults || 24).map(invToYT);
      return { kind: 'youtube#videoListResponse', items, pageInfo: { totalResults: items.length } };
    } catch(e) { continue; }
  }
  return null;
}

// ── Invidious: search
async function invSearch(q, maxResults) {
  for (const base of INV_INSTANCES) {
    try {
      const url = `${base}/api/v1/search?q=${encodeURIComponent(q)}&type=video&region=ID`;
      const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!r.ok) continue;
      const data = await r.json();
      if (!Array.isArray(data) || !data.length) continue;
      const items = data.slice(0, maxResults || 12).map(v => ({
        id: { videoId: v.videoId || '' },
        snippet: {
          title: v.title || '',
          channelTitle: v.author || '',
          channelId: v.authorId || '',
          publishedAt: v.published ? new Date(v.published * 1000).toISOString() : '',
          thumbnails: {
            high:   { url: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg` },
            medium: { url: `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg` },
          },
          liveBroadcastContent: v.liveNow ? 'live' : 'none',
        },
      }));
      return { kind: 'youtube#searchListResponse', items, pageInfo: { totalResults: items.length } };
    } catch(e) { continue; }
  }
  return null;
}

// ── Invidious: video details
async function invVideos(ids) {
  const idArr = ids.split(',').map(s => s.trim()).filter(Boolean);
  const results = [];
  for (const base of INV_INSTANCES) {
    try {
      const fetches = idArr.map(id =>
        fetch(`${base}/api/v1/videos/${id}?fields=videoId,title,author,authorId,description,published,viewCount,likeCount,lengthSeconds,liveNow,videoThumbnails`, { signal: AbortSignal.timeout(5000) })
          .then(r => r.ok ? r.json() : null).catch(() => null)
      );
      const batch = await Promise.all(fetches);
      batch.forEach(v => { if (v && v.videoId) results.push(invToYT(v)); });
      if (results.length) return { kind: 'youtube#videoListResponse', items: results, pageInfo: { totalResults: results.length } };
    } catch(e) { continue; }
  }
  return null;
}

// ── Invidious: channel info
async function invChannel(channelId) {
  for (const base of INV_INSTANCES) {
    try {
      const r = await fetch(`${base}/api/v1/channels/${channelId}?fields=authorId,author,description,subCount,videoCount,authorThumbnails,authorBanners`, { signal: AbortSignal.timeout(5000) });
      if (!r.ok) continue;
      const d = await r.json();
      if (!d.authorId) continue;
      const thumb = d.authorThumbnails?.find(t => t.width >= 88)?.url || d.authorThumbnails?.[0]?.url || '';
      const banner = d.authorBanners?.[0]?.url || '';
      return {
        kind: 'youtube#channelListResponse',
        items: [{
          id: d.authorId,
          snippet: {
            title: d.author || '',
            description: d.description || '',
            thumbnails: { default: { url: thumb }, medium: { url: thumb }, high: { url: thumb } },
          },
          brandingSettings: banner ? { image: { bannerExternalUrl: banner } } : {},
          statistics: {
            subscriberCount: String(d.subCount || 0),
            videoCount: String(d.videoCount || 0),
          },
        }],
        pageInfo: { totalResults: 1 },
      };
    } catch(e) { continue; }
  }
  return null;
}

// ── Invidious fallback router
async function invFallback(endpoint, params) {
  if (endpoint === 'videos') {
    if (params.chart === 'mostPopular') return invTrending(params.videoCategoryId, parseInt(params.maxResults) || 24);
    if (params.id) return invVideos(params.id);
  }
  if (endpoint === 'search') {
    if (params.q) return invSearch(params.q, parseInt(params.maxResults) || 12);
  }
  if (endpoint === 'channels' && params.id) {
    return invChannel(params.id);
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const keys = getKeys();

  // ── No API keys: use Invidious fallback directly
  if (!keys.length) {
    const { endpoint, ...params } = req.query;
    if (!endpoint) return res.status(400).json({ error: { message: 'Parameter endpoint wajib.' } });
    const data = await invFallback(endpoint, params);
    if (data) {
      res.setHeader('Cache-Control', `public, s-maxage=${CACHE_TTL[endpoint] || 3600}, stale-while-revalidate=7200`);
      return res.status(200).json(data);
    }
    return res.status(503).json({ error: { message: 'Konten tidak tersedia. Coba lagi nanti.' } });
  }

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
  // All keys exhausted — try Invidious fallback before giving up
  const fallbackData = await invFallback(endpoint, params);
  if (fallbackData) {
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).json(fallbackData);
  }
  return res.status(503).json({ error: { message: `Semua ${keys.length} API key habis quota.` } });
}
