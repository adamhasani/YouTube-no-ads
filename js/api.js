// ════════════════════════════════════════
// api.js — Cache + API proxy + RSS + FAA
// ════════════════════════════════════════

const CACHE_TTL = {
  videos:          7200000,   // 2 jam
  search:          3600000,   // 1 jam
  channels:       172800000,  // 48 jam
  commentThreads:  3600000,   // 1 jam
  default:         3600000,
};

// ── Cache cleanup
function cleanCache() {
  const n = Date.now();
  Object.keys(localStorage)
    .filter(k => k.startsWith('ytc_'))
    .forEach(k => {
      try {
        const { exp } = JSON.parse(localStorage.getItem(k));
        if (n > exp) localStorage.removeItem(k);
      } catch(e) { localStorage.removeItem(k); }
    });
}

// ── Core API call (with localStorage cache)
async function api(ep, p, useCache = true) {
  const k = 'ytc_' + ep + '_' + JSON.stringify(p);

  if (useCache) {
    try {
      const r = localStorage.getItem(k);
      if (r) {
        const { data, exp } = JSON.parse(r);
        if (Date.now() < exp) return data;
        localStorage.removeItem(k);
      }
    } catch(e) {}
  }

  try {
    // If user is logged in, attach access_token for personalized results
    const params = { endpoint: ep, ...p };
    const r = await fetch('/api/youtube?' + new URLSearchParams(params));
    const d = await r.json();
    if (d.error) { console.error(d.error.message); return null; }
    if (useCache) {
      try {
        localStorage.setItem(k, JSON.stringify({
          data: d,
          exp: Date.now() + (CACHE_TTL[ep] || 1800000)
        }));
      } catch(e) {}
    }
    return d;
  } catch(e) { return null; }
}

// ── Authenticated API call (with user access token)
async function apiAuth(ep, p) {
  if (!googleUser?.accessToken) return null;
  try {
    const url = `https://www.googleapis.com/youtube/v3/${ep}?` +
      new URLSearchParams({ ...p, access_token: googleUser.accessToken });
    const r = await fetch(url);
    const d = await r.json();
    if (d.error) return null;
    return d;
  } catch(e) { return null; }
}

// ── RSS feed (free, no quota)
async function rssChannel(chId, max = 12) {
  try {
    const r = await fetch(
      `https://api.allorigins.win/get?url=${encodeURIComponent('https://www.youtube.com/feeds/videos.xml?channel_id=' + chId)}`
    );
    const j = await r.json();
    if (!j.contents) return [];
    const xml = new DOMParser().parseFromString(j.contents, 'text/xml');
    return [...xml.querySelectorAll('entry')].slice(0, max).map(e => {
      const id = e.querySelector('videoId')?.textContent || '';
      return {
        id,
        snippet: {
          title: e.querySelector('title')?.textContent || '',
          publishedAt: e.querySelector('published')?.textContent || '',
          channelTitle: e.querySelector('author name')?.textContent || '',
          channelId: chId,
          thumbnails: {
            high:   { url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` },
            medium: { url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }
          }
        },
        statistics: { viewCount: e.querySelector('statistics')?.getAttribute('views') || '0' },
        contentDetails: {}
      };
    }).filter(v => v.id);
  } catch(e) { return []; }
}

// ── FAA search fallback
async function faaSearch(query, max = 12) {
  try {
    const r = await fetch(`${FAA_BASE}/youtube?query=${encodeURIComponent(query)}`);
    const d = await r.json();
    if (!d.status || !d.result?.length) return [];
    return d.result.slice(0, max).map(v => {
      const vidId = v.link?.match(/[?&]v=([^&]+)/)?.[1] || '';
      return {
        id: vidId,
        snippet: {
          title: v.title || '',
          channelTitle: v.channel || '',
          channelId: '',
          publishedAt: '',
          thumbnails: {
            high:   { url: v.imageUrl || ytThumb(vidId) },
            medium: { url: v.imageUrl || ytThumb(vidId) }
          }
        },
        statistics: {},
        contentDetails: { duration: v.duration || '' }
      };
    }).filter(v => v.id);
  } catch(e) { return []; }
}

// ── Fetch helper with timeout
function fetchWithTimeout(url, ms = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
}

// ── Shorts from FAA
async function fetchFAAShorts(query) {
  try {
    const r = await fetchWithTimeout(`${FAA_BASE}/youtube?query=${encodeURIComponent(query + ' shorts indonesia')}`);
    const d = await r.json();
    if (!d.status || !d.result?.length) return [];
    return d.result.map(v => {
      const id = v.link?.match(/[?&]v=([^&]+)/)?.[1] || '';
      const [mm, ss] = (v.duration || '0:30').split(':').map(Number);
      return { id, title: v.title || '', channel: v.channel || '', channelId: '', thumb: v.imageUrl || ytThumb(id), views: 0, dur: (mm || 0) * 60 + (ss || 0) };
    }).filter(v => v.id);
  } catch(e) { return []; }
}

let invIdx = 0;
// ── Shorts from Invidious
async function fetchInvShorts(query, page = 1) {
  for (let i = 0; i < INV_INSTANCES.length; i++) {
    const base = INV_INSTANCES[(invIdx + i) % INV_INSTANCES.length];
    try {
      const r = await fetchWithTimeout(`${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video&page=${page}&region=ID`, 5000);
      if (!r.ok) continue;
      const data = await r.json();
      if (!Array.isArray(data) || !data.length) continue;
      invIdx = (invIdx + i) % INV_INSTANCES.length;
      const shorts = data.filter(v => v.lengthSeconds > 0 && v.lengthSeconds <= 90);
      if (!shorts.length) continue;
      return shorts.slice(0, 15).map(v => ({
        id: v.videoId, title: v.title || '', channel: v.author || '',
        channelId: v.authorId || '',
        thumb: v.videoThumbnails?.[0]?.url || ytThumb(v.videoId),
        views: v.viewCount || 0, dur: v.lengthSeconds || 0
      }));
    } catch(e) { continue; }
  }
  return [];
}

// ── Shorts from YouTube API
async function fetchYTShorts(query) {
  try {
    const d = await api('search', { part: 'snippet', q: query + ' shorts', type: 'video', videoDuration: 'short', maxResults: 12, regionCode: 'ID' }, true);
    if (!d?.items?.length) return [];
    return d.items.map(v => ({
      id: v.id?.videoId || '',
      title: v.snippet?.title || '',
      channel: v.snippet?.channelTitle || '',
      channelId: v.snippet?.channelId || '',
      thumb: v.snippet?.thumbnails?.high?.url || ytThumb(v.id?.videoId || ''),
      views: 0, dur: 30
    })).filter(v => v.id);
  } catch(e) { return []; }
}

// ── Aggregate shorts (FAA → Invidious → YouTube)
async function fetchShorts(query, page = 1) {
  let videos = await fetchFAAShorts(query);
  if (videos.length >= 3) return videos;
  const inv  = await fetchInvShorts(query + ' shorts', page);
  const seen = new Set(videos.map(v => v.id));
  inv.forEach(v => { if (!seen.has(v.id)) { seen.add(v.id); videos.push(v); } });
  if (videos.length >= 3) return videos;
  const yt = await fetchYTShorts(query);
  yt.forEach(v => { if (!seen.has(v.id)) { seen.add(v.id); videos.push(v); } });
  return videos;
}

// ── Search combined (API + FAA fallback)
async function searchAPI(q, m) {
  const d = await api('search', { part: 'snippet', q, type: 'video', maxResults: m });
  if (d?.items?.length) {
    const ids = d.items.map(x => x.id.videoId).filter(Boolean).join(',');
    const r = (await api('videos', { part: 'snippet,statistics,contentDetails', id: ids }))?.items || [];
    if (r.length) return r;
  }
  return faaSearch(q, m);
}

// ── Trending videos
async function getTrendAPI(c, m) {
  const d = await api('videos', {
    part: 'snippet,statistics,contentDetails',
    chart: 'mostPopular',
    maxResults: m,
    regionCode: 'ID',
    ...(c ? { videoCategoryId: c } : {})
  });
  return d?.items || null;
}

// ── Detect if video is a Short
async function checkIsShort(vidId) {
  try {
    const r = await fetch(`https://yt.lemnoslife.com/videos?part=short&id=${vidId}`);
    const d = await r.json();
    if (d?.items?.length) return d.items[0]?.short?.available === true;
  } catch(e) {}
  return false;
}

// ── Channel Shorts (UUSH playlist trick)
async function getChannelShorts(channelId, max = 12) {
  const shortsPlaylistId = channelId.replace(/^UC/, 'UUSH');
  try {
    const d = await api('playlistItems', { part: 'snippet', playlistId: shortsPlaylistId, maxResults: max });
    if (!d?.items?.length) return [];
    return d.items.map(v => {
      const vidId = v.snippet?.resourceId?.videoId || '';
      return {
        id: vidId,
        snippet: {
          title: v.snippet?.title || '',
          channelTitle: v.snippet?.channelTitle || '',
          channelId,
          thumbnails: v.snippet?.thumbnails || { medium: { url: ytThumb(vidId, 'mqdefault') } }
        },
        contentDetails: { duration: 'PT30S' }
      };
    }).filter(v => v.id);
  } catch(e) { return []; }
}

// ── Avatar batch fetch
async function fetchAv(ids) {
  const miss = [...new Set(ids)].filter(id => !avCache[id] && id);
  if (!miss.length) return;
  for (let i = 0; i < miss.length; i += 50) {
    const d = await api('channels', { part: 'snippet', id: miss.slice(i, i + 50).join(','), maxResults: 50 });
    if (d?.items) d.items.forEach(ch => { avCache[ch.id] = ch.snippet?.thumbnails?.default?.url || ''; });
    try { localStorage.setItem('yt_avcache', JSON.stringify(avCache)); } catch(e) {}
  }
}
