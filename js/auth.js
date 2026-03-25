// ════════════════════════════════════════
// shorts.js — Shorts player (persis YouTube Shorts)
// FIX: video sebelumnya langsung berhenti saat ganti
// ════════════════════════════════════════

let shortsData    = [];
let shortsCurIdx  = 0;
let shortsLoading = false;
let shortsQuery   = 'shorts viral indonesia';
let shortsObserver = null;
let shortsCurrentCat = 'viral';

const SHORTS_QUERY_POOLS = {
  viral:  ['shorts viral indonesia terbaru','shorts fyp tiktok','shorts trending hari ini','shorts fakta unik','youtube shorts populer'],
  gaming: ['gaming shorts indonesia','shorts mlbb','shorts free fire','shorts pubg mobile','shorts minecraft'],
  musik:  ['shorts cover lagu','shorts musik galau','shorts gitar akustik','shorts lirik lagu'],
  lucu:   ['shorts lucu ngakak','shorts meme indonesia','shorts prank kocak','shorts kucing lucu'],
  masak:  ['shorts masak indonesia','shorts resep mudah','shorts makanan','shorts kuliner'],
  travel: ['shorts wisata indonesia','shorts vlog travel','shorts destinasi'],
};

// ── Load shorts for a category (VERSI ALGORITMA)
async function loadShorts(cat = 'viral') {
  if (shortsLoading) return;
  shortsLoading = true;
  shortsCurrentCat = cat;

  // Update active cat button
  document.querySelectorAll('.short-cat-btn').forEach(b => b.classList.toggle('on', b.dataset.cat === cat));

  const container = G('shorts-container');
  container.innerHTML = `<div class="short-loading"><div class="sring"></div></div>`;
  shortsData = []; shortsCurIdx = 0;

  let videos = [];
  
  // ALGORITMA: Tarik token login (kalau ada)
  let token = typeof getAuthToken === 'function' ? getAuthToken() : localStorage.getItem('yt_access_token');

  // Kalau lagi login dan buka tab Viral (Beranda Shorts) -> Tarik FYP Personal
  if (token && cat === 'viral') {
    try {
      videos = await fetchPersonalizedShorts(token);
    } catch (e) {
      console.log("Gagal tarik personal shorts, fallback ke pencarian umum.");
    }
  }

  // Kalau belum login atau pilih kategori spesifik (Gaming, Musik) -> Tarik Random
  if (!videos || videos.length === 0) {
    const pool = SHORTS_QUERY_POOLS[cat] || SHORTS_QUERY_POOLS['viral'];
    shortsQuery = pool[Math.floor(Math.random() * pool.length)];
    videos = await fetchShorts(shortsQuery);
  }

  if (!videos || !videos.length) {
    container.innerHTML = `<div class="short-loading" style="flex-direction:column;gap:12px">
      <div style="font-size:40px">😕</div>
      <div style="color:#aaa;font-size:14px">Gagal memuat Shorts. Coba lagi.</div>
      <button onclick="loadShorts('${cat}')" style="padding:8px 20px;border-radius:99px;background:var(--accent);color:#fff;border:none;cursor:pointer;font-weight:600">Coba Lagi</button>
    </div>`;
    shortsLoading = false;
    return;
  }

  videos = shuffleArray(videos);
  shortsData = videos;
  renderShorts(container);
  shortsLoading = false;
}

// ── Build a short card HTML
function shortCard(v, i) {
  const avLetter = (v.channel || '?')[0].toUpperCase();
  const avColor  = avc(v.channel || '');
  const titleE   = esc(v.title || '');
  const chE      = esc(v.channel || '');
  const safeTitle = (v.title || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
  const safeCh    = (v.channel || '').replace(/'/g, "\\'").replace(/"/g, '\\"');

  // Embed URL: autoplay=0 initially (will be set to 1 when visible)
  const embedSrc = `https://www.youtube.com/embed/${v.id}?autoplay=0&rel=0&modestbranding=1&playsinline=1&loop=1&playlist=${v.id}&enablejsapi=1`;

  return `<div class="short-item" id="short-${i}" data-idx="${i}" data-id="${v.id}">
    <div class="short-player-wrap">
      <iframe class="short-iframe" src="about:blank"
        data-src="${embedSrc}"
        allow="autoplay; encrypted-media; accelerometer; gyroscope; picture-in-picture"
        allowfullscreen></iframe>
    </div>

    <div class="short-overlay">
      <div class="short-ch-row">
        <div class="short-ch-av" style="background:${avColor}">${avLetter}</div>
        <span class="short-ch-name">${chE}</span>
        <button class="short-sub-btn" onclick="event.stopPropagation();toast('📺 Subscribe dari Shorts belum tersedia di versi ini')">Subscribe</button>
      </div>
      <div class="short-title">${titleE}</div>
      <div class="short-audio-row">
        <span class="short-note-spin">♪</span>
        <span>${chE} · Original audio</span>
      </div>
    </div>

    <div class="short-actions">
      <div class="short-act" onclick="event.stopPropagation();nav('watch','${v.id}')" title="Tonton penuh">
        <svg viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
        <span class="short-act-label">Tonton</span>
      </div>
      <div class="short-act" onclick="event.stopPropagation();toast('👍 Like di Shorts segera hadir')" title="Like">
        <svg viewBox="0 0 24 24" fill="#fff"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>
        <span class="short-act-label">${v.views ? fv(v.views) : 'Suka'}</span>
      </div>
      <div class="short-act" onclick="event.stopPropagation();toast('💬 Komentar Shorts segera hadir')" title="Komentar">
        <svg viewBox="0 0 24 24" fill="#fff"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
        <span class="short-act-label">Komentar</span>
      </div>
      <div class="short-act" onclick="event.stopPropagation();shareShort('${v.id}','${safeTitle}')" title="Bagikan">
        <svg viewBox="0 0 24 24" fill="#fff"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg>
        <span class="short-act-label">Bagikan</span>
      </div>
      <div class="short-act" onclick="event.stopPropagation();addToQueueById('${v.id}','${safeTitle}','${safeCh}','${v.thumb || ytThumb(v.id)}')" title="Tambah ke antrian">
        <svg viewBox="0 0 24 24" fill="#fff"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm4 0h14v-2H7v2zm0-4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>
        <span class="short-act-label">Antrian</span>
      </div>
      <div class="short-act" onclick="event.stopPropagation();showMoreShortOptions('${v.id}','${safeTitle}')" title="Lainnya">
        <svg viewBox="0 0 24 24" fill="#fff"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
        <span class="short-act-label">Lainnya</span>
      </div>
    </div>

    <div style="position:absolute;inset:0;z-index:5" onclick="toggleShortPlayback(${i})"></div>
  </div>`;
}

// ── Render all shorts into container
function renderShorts(container) {
  container.innerHTML = shortsData.map((v, i) => shortCard(v, i)).join('');
  setupShortsObserver(container);
}

function setupShortsObserver(container) {
  if (shortsObserver) shortsObserver.disconnect();

  shortsObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const el     = entry.target;
      const iframe = el.querySelector('iframe');
      const idx    = parseInt(el.dataset.idx);
      if (!iframe) return;

      if (entry.isIntersecting) {
        // ── STOP semua video lain SEGERA ──
        container.querySelectorAll('.short-item').forEach(other => {
          if (other === el) return;
          const otherIframe = other.querySelector('iframe');
          if (otherIframe && otherIframe.src !== 'about:blank') {
            otherIframe.src = 'about:blank'; // langsung hentikan
          }
        });

        // ── Play video ini ──
        if (!iframe.src.includes('youtube.com')) {
          iframe.src = iframe.dataset.src.replace('autoplay=0', 'autoplay=1');
        }

        shortsCurIdx = idx;
        updateShortsProgress();

        // Load more when near end
        if (idx >= shortsData.length - 3) loadMoreShorts();
      }
    });
  }, {
    root: container,
    threshold: 0.6  // Masuk saat 60% terlihat
  });

  container.querySelectorAll('.short-item').forEach(el => shortsObserver.observe(el));
}

// ── Update progress bar
function updateShortsProgress() {
  const fill = G('shorts-progress-fill');
  if (!fill || !shortsData.length) return;
  fill.style.width = ((shortsCurIdx + 1) / shortsData.length * 100) + '%';
}

// ── Load more shorts (infinite scroll)
async function loadMoreShorts() {
  if (shortsLoading) return;
  shortsLoading = true;
  const page = Math.ceil(shortsData.length / 15) + 1;
  const suffixes = [' terbaru', ' hd', ' viral', ' fyp', ' keren'];
  const randomSuffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  let more = await fetchShorts(shortsQuery + randomSuffix, page);
  more = shuffleArray(more);

  const seen = new Set(shortsData.map(v => v.id));
  const newVids = more.filter(v => !seen.has(v.id));

  if (newVids.length) {
    const container = G('shorts-container');
    const startIdx = shortsData.length;
    shortsData.push(...newVids);
    newVids.forEach((v, i) => {
      const tmp = document.createElement('template');
      tmp.innerHTML = shortCard(v, startIdx + i);
      const item = tmp.content.firstElementChild;
      container.appendChild(item);
      shortsObserver.observe(item);
    });
  }
  shortsLoading = false;
}

// ── Nav arrows
function shortNavPrev() {
  const container = G('shorts-container');
  if (shortsCurIdx <= 0) return;
  const target = container.querySelector(`.short-item[data-idx="${shortsCurIdx - 1}"]`);
  if (target) target.scrollIntoView({ behavior: 'smooth' });
}
function shortNavNext() {
  const container = G('shorts-container');
  if (shortsCurIdx >= shortsData.length - 1) return;
  const target = container.querySelector(`.short-item[data-idx="${shortsCurIdx + 1}"]`);
  if (target) target.scrollIntoView({ behavior: 'smooth' });
}

// ── Toggle playback via click overlay
function toggleShortPlayback(idx) {
  const el = G(`short-${idx}`);
  if (!el) return;
  const iframe = el.querySelector('iframe');
  if (!iframe || !iframe.src.includes('youtube.com')) return;
  // Post message to iframe to toggle play
  try {
    iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*');
  } catch(e) {}
}

// ── Share a short
function shareShort(id, title) {
  const u = `https://youtu.be/${id}`;
  if (navigator.share) navigator.share({ title, url: u });
  else if (navigator.clipboard) navigator.clipboard.writeText(u).then(() => toast('🔗 Link Shorts disalin!'));
  else toast(u);
}

// ── More options menu
function showMoreShortOptions(id, title) {
  toast('⋯ Opsi: Tonton penuh → klik tombol Tonton | Download → buka di YouTube');
}

// ── Home shorts grid (2 columns preview)
async function loadHomeShorts() {
  const sec  = G('home-shorts-sec');
  const grid = G('home-shorts-grid');
  sec.style.display = 'block';
  grid.innerHTML = Array(6).fill(0).map(() => `<div class="sk sk-short"></div>`).join('');

  let videos = await fetchShorts('shorts viral indonesia');
  if (!videos.length) { sec.style.display = 'none'; return; }

  grid.innerHTML = videos.slice(0, 6).map(v => `
    <div class="hs-card" onclick="nav('watch','${v.id}')">
      <img src="${v.thumb || ytThumb(v.id, 'mqdefault')}" loading="lazy" onerror="this.src='${ytThumb(v.id, 'mqdefault')}'"/>
      <div class="hs-card-info">
        <div class="hs-card-title">${esc(v.title)}</div>
        <div class="hs-card-ch">${esc(v.channel)}</div>
      </div>
    </div>`).join('');
}

// ══════════════════════════════════════════
// ALGORITMA TARIK SHORTS PERSONAL
// ══════════════════════════════════════════
async function fetchPersonalizedShorts(token) {
  let personalShorts = [];
  
  try {
    const subRes = await fetch(`https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=5`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const subData = await subRes.json();
    if (!subData.items) return [];

    const channelIds = subData.items.map(item => item.snippet.resourceId.channelId);

    // Pastikan API_KEY sudah didefinisikan di file api.js kamu
    for (let chId of channelIds) {
      const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${chId}&maxResults=3&q=%23shorts&type=video&videoDuration=short&key=${API_KEY}`);
      const searchData = await searchRes.json();
      
      if (searchData.items) {
        searchData.items.forEach(item => {
          personalShorts.push({
            id: item.id.videoId,
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            thumb: item.snippet.thumbnails.high.url
          });
        });
      }
    }
    return personalShorts;

  } catch (error) {
    console.error("Error algoritma personal:", error);
    return [];
  }
}
