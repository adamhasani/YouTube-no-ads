// ════════════════════════════════════════
// player.js — YT IFrame player + queue + loop + sleep
// ════════════════════════════════════════

// ── IFrame API ready
window.onYouTubeIframeAPIReady = function() {
  ytReady = true;
  if (pendVid) { loadP(pendVid); pendVid = null; }
};

function loadP(vid) {
  const saved = localStorage.getItem('ytt_' + vid);
  if (ytP) { ytP.loadVideoById(vid, saved ? parseFloat(saved) : 0); return; }
  ytP = new YT.Player('yt-player', {
    videoId: vid,
    playerVars: {
      autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1,
      enablejsapi: 1, hl: 'id', cc_lang_pref: 'id',
      origin: window.location.origin
    },
    events: {
      onReady(e) {
        e.target.setPlaybackRate(curSpd);
        if (saved) e.target.seekTo(parseFloat(saved));
        try {
          const p = e.target.playVideo();
          if (p && p.catch) p.catch(() => { e.target.mute(); e.target.playVideo(); });
        } catch(err) { e.target.mute(); e.target.playVideo(); }
      },
      onStateChange(e) {
        if (e.data === YT.PlayerState.ENDED) {
          if (autoRep) { ytP.seekTo(0); return; }
          playNextQueue();
        }
        if (e.data === YT.PlayerState.PLAYING) {
          ttTimer = setInterval(() => {
            if (ytP?.getCurrentTime && curVidId) {
              localStorage.setItem('ytt_' + curVidId, ytP.getCurrentTime());
            }
          }, 4000);
        } else {
          clearInterval(ttTimer);
        }
      }
    }
  });
}

function yc(cmd) { if (ytP && ytP[cmd]) ytP[cmd](); }
function setSpd(v) { curSpd = parseFloat(v); if (ytP) ytP.setPlaybackRate(curSpd); }
function setCap(l) {
  try {
    if (!l) ytP.unloadModule('captions');
    else { ytP.loadModule('captions'); ytP.setOption('captions', 'track', { languageCode: l }); }
  } catch(e) {}
}
function toggleAudioMode() {
  audioMode = !audioMode;
  G('audio-overlay').style.display = audioMode ? 'flex' : 'none';
  G('audio-btn').classList.toggle('active', audioMode);
  toast(audioMode ? '🎧 Mode Audio — Hemat Data' : 'Mode Audio OFF');
}
function closeMini() {
  if (ytP?.pauseVideo) ytP.pauseVideo();
  document.body.classList.remove('is-mini');
  curVidId = null;
}
async function goFS() {
  const el = G('player-wrapper');
  try {
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    setTimeout(async () => { try { await screen.orientation.lock('landscape'); toast('📱 Auto landscape!'); } catch(e) {} }, 200);
  } catch(e) {}
}
function toggleRep() {
  autoRep = !autoRep;
  G('rep-btn').classList.toggle('active', autoRep);
  toast(autoRep ? '🔁 Putar Ulang ON' : 'Putar Ulang OFF');
}
document.addEventListener('fullscreenchange', async () => {
  if (document.fullscreenElement) {
    try { await screen.orientation.lock('landscape'); } catch(e) {}
  } else {
    try { screen.orientation.unlock(); } catch(e) {}
  }
});

// ── Loop Timestamp
function toggleLoopUI() {
  const ui = G('loop-ui');
  ui.classList.toggle('show');
  G('loop-btn').classList.toggle('active', ui.classList.contains('show'));
}
function startLoop() {
  const s = parseMSS(G('loop-start').value), e = parseMSS(G('loop-end').value);
  if (isNaN(s) || isNaN(e) || e <= s) { toast('⚠️ Timestamp tidak valid! Format: mm:ss'); return; }
  if (loopTimer) clearInterval(loopTimer);
  if (ytP) ytP.seekTo(s);
  loopTimer = setInterval(() => {
    if (!ytP?.getCurrentTime) return;
    if (ytP.getCurrentTime() >= e) ytP.seekTo(s);
  }, 300);
  G('loop-status').textContent = `Looping ${G('loop-start').value} → ${G('loop-end').value}`;
  toast(`🔁 Loop aktif: ${G('loop-start').value} → ${G('loop-end').value}`);
}
function stopLoop() {
  if (loopTimer) clearInterval(loopTimer);
  loopTimer = null;
  G('loop-status').textContent = '';
  toast('Loop dihentikan');
}

// ── Queue
function addToQueue(v) {
  const id = v.id?.videoId || v.id;
  if (queue.some(q => q.id === id)) { toast('Video sudah ada di antrian'); return; }
  queue.push({ id, title: v.snippet?.title || '', ch: v.snippet?.channelTitle || '', thumb: v.snippet?.thumbnails?.medium?.url || ytThumb(id, 'mqdefault') });
  updQBadge(); renderQueue(); toast('➕ Ditambah ke Antrian');
}
function addToQueueCur() { if (curVidData) addToQueue(curVidData); }
function addToQueueById(id, title, ch, thumb) {
  if (queue.some(q => q.id === id)) { toast('Sudah ada di antrian'); return; }
  queue.push({ id, title, ch, thumb }); updQBadge(); renderQueue(); toast('➕ Ditambah ke Antrian');
}
function playNextQueue() {
  if (!queue.length) return;
  const idx = queue.findIndex(q => q.id === curVidId);
  const next = queue[idx + 1] || queue[0];
  if (next) nav('watch', next.id);
}
function clearQueue() { queue = []; updQBadge(); renderQueue(); }
function updQBadge() {
  const b = G('q-badge');
  if (queue.length) { b.textContent = queue.length; b.style.display = 'flex'; }
  else b.style.display = 'none';
}
function renderQueue() {
  const now = curVidId;
  G('q-now').textContent = queue.length ? `${queue.length} video` : 'Kosong';
  G('q-list').innerHTML = queue.length ? queue.map((v, i) => `
    <div class="q-item${v.id === now ? ' playing' : ''}" onclick="nav('watch','${v.id}')">
      <div style="color:var(--text2);font-size:12px;font-weight:600;flex-shrink:0;width:18px">${i + 1}</div>
      <div class="q-thumb"><img src="${v.thumb}" loading="lazy" onerror="this.src='${ytThumb(v.id, 'mqdefault')}'"/></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(v.title)}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:2px">${esc(v.ch)}</div>
      </div>
      <button onclick="event.stopPropagation();queue.splice(${i},1);updQBadge();renderQueue()" style="width:26px;height:26px;border-radius:50%;background:var(--surface2);border:none;cursor:pointer;color:var(--text);flex-shrink:0;font-size:14px">✕</button>
    </div>`).join('') :
    '<div class="empty" style="padding:40px 20px">Antrian kosong<br><span style="font-size:13px">Tambah video dengan tombol ⋮ di thumbnail</span></div>';
}
function toggleQueuePanel() { G('queue-panel').classList.toggle('open'); renderQueue(); }
function closeQueuePanel() { G('queue-panel').classList.remove('open'); }

// ── Sleep Timer
let sleepTimer = null, sleepEnd = null;
function startSleepTimer(minutes) {
  if (sleepTimer) clearInterval(sleepTimer);
  sleepEnd = Date.now() + minutes * 60 * 1000;
  G('sleep-indicator').classList.add('show');
  sleepTimer = setInterval(() => {
    const left = sleepEnd - Date.now();
    if (left <= 0) { yc('pauseVideo'); cancelSleep(); toast('😴 Sleep timer — video dijeda'); return; }
    const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
    G('sleep-label').textContent = `Pause dalam ${m}:${String(s).padStart(2, '0')}`;
  }, 1000);
  toast(`⏰ Sleep timer: ${minutes} menit`);
}
function cancelSleep() {
  if (sleepTimer) clearInterval(sleepTimer);
  sleepTimer = null;
  G('sleep-indicator').classList.remove('show');
}

// ── Download
async function downloadVideo() {
  if (!curVidId) return;
  const btn = G('dl-btn');
  const origText = btn.innerHTML;
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" style="width:17px;height:17px"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg> Memproses...';
  btn.disabled = true;
  try {
    const vidUrl = `https://youtube.com/watch?v=${curVidId}`;
    const r = await fetch(`${FAA_BASE}/ytplayvid?url=${encodeURIComponent(vidUrl)}`);
    const d = await r.json();
    if (!d.status || !d.result?.download_url) { toast('❌ Gagal mendapat link download'); btn.innerHTML = origText; btn.disabled = false; return; }
    const { download_url, format, searched_title } = d.result;
    showDownloadModal(download_url, format, searched_title, curVidId);
  } catch(e) { toast('❌ Error: ' + e.message); }
  btn.innerHTML = origText; btn.disabled = false;
}

function showDownloadModal(url, format, title, vidId) {
  let modal = G('dl-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'dl-modal'; modal.className = 'moverlay';
    modal.onclick = e => { if (e.target === modal) modal.classList.remove('show'); };
    document.body.appendChild(modal);
  }
  modal.innerHTML = `<div class="mbox" style="max-width:400px">
    <h2 style="margin-bottom:16px">⬇️ Download Video</h2>
    <img src="${ytThumb(vidId, 'mqdefault')}" style="width:100%;border-radius:10px;margin-bottom:14px;aspect-ratio:16/9;object-fit:cover"/>
    <div style="font-size:13px;font-weight:600;margin-bottom:16px;line-height:1.4;color:var(--text2)">${esc(title || '')}</div>
    <a href="${url}" target="_blank" download
       style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:13px;background:linear-gradient(135deg,#1a3a1a,#0d2010);color:#6fef6f;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;margin-bottom:10px;border:1px solid #2a5a2a"
       onclick="toast('⬇️ Download dimulai!')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
      Download ${format?.toUpperCase() || 'MP4'}
    </a>
    <button onclick="G('dl-modal').classList.remove('show')"
      style="width:100%;padding:10px;background:var(--surface2);color:var(--text2);border:1px solid var(--border);border-radius:10px;font-size:14px;font-weight:500;cursor:pointer">Tutup</button>
    <p style="font-size:11px;color:var(--text3);text-align:center;margin-top:10px">Link download aktif ~1 jam. Jika gagal, coba lagi.</p>
  </div>`;
  modal.classList.add('show');
}
