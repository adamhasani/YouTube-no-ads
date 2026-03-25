// ════════════════════════════════════════
// ui.js — Cards, pages, settings, playlist, etc.
// ════════════════════════════════════════

// ── Skeleton card
function skelC() {
  return `<div><div class="sk" style="width:100%;aspect-ratio:16/9;border-radius:12px"></div>
    <div style="display:flex;gap:10px;margin-top:10px">
      <div class="sk" style="width:36px;height:36px;border-radius:50%;flex-shrink:0"></div>
      <div style="flex:1"><div class="sk" style="height:13px;border-radius:4px;margin-bottom:7px;width:90%"></div>
      <div class="sk" style="height:12px;border-radius:4px;width:60%"></div></div>
    </div></div>`;
}

// ── Video card (grid or horizontal)
function cardH(v, horiz = false) {
  const id  = v.id?.videoId || v.id;
  const sn  = v.snippet || {}, st = v.statistics || {}, cd = v.contentDetails || {};
  const th  = dataSaver ? ytThumb(id, 'default') : (sn.thumbnails?.high?.url || sn.thumbnails?.medium?.url || ytThumb(id));
  const d   = dur(cd.duration), views = fv(st.viewCount), ta = sn.publishedAt ? ago(sn.publishedAt) : '';
  const title = esc(sn.title || ''), ch = esc(sn.channelTitle || ''), chId = sn.channelId || '';
  const avU = avCache[chId] || '', avC = avc(ch);
  const avH = avU ? `<img src="${avU}" loading="lazy" onerror="this.style.display='none'"/>` : (ch || '?')[0].toUpperCase();
  const isLive     = v.snippet?.liveBroadcastContent === 'live';
  const isUpcoming = v.snippet?.liveBroadcastContent === 'upcoming';
  const safeTitle  = (sn.title || '').replace(/'/g, "\\'");
  const safeCh     = (sn.channelTitle || '').replace(/'/g, "\\'");

  if (horiz) return `<div class="rcard" onclick="nav('watch','${id}')">
    <div class="rthumb">
      <img src="${th}" loading="lazy" onerror="this.src='${ytThumb(id, 'mqdefault')}'"/>
      ${isLive ? `<div class="live-badge"><span class="live-dot"></span>LIVE</div>` : ''}
      <span class="rdur">${isLive ? '' : d}</span>
    </div>
    <div style="flex:1;min-width:0">
      <div class="rtitle">${title}</div>
      <div class="rch">${ch}</div>
      <div class="rch">${ta}</div>
    </div>
  </div>`;

  return `<div class="vc">
    <div class="vt" onclick="nav('watch','${id}')">
      <img src="${th}" loading="lazy" onerror="this.src='${ytThumb(id, 'mqdefault')}'"/>
      ${isLive ? `<div class="live-badge"><span class="live-dot"></span>LIVE</div>` : ''}
      ${isUpcoming ? `<div class="live-badge" style="background:#333;">🔔 SEGERA</div>` : ''}
      <span class="vdur">${isLive ? '' : d}</span>
      <button class="vsavebtn" onclick="event.stopPropagation();openSaveModal('${id}','${safeTitle}','${safeCh}','${th}')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>Simpan
      </button>
      <button class="vq-btn" onclick="event.stopPropagation();addToQueueById('${id}','${safeTitle}','${safeCh}','${th}')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm4 0h14v-2H7v2zm0-4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>+
      </button>
    </div>
    <div class="vmi">
      <div class="vav" style="background:${avC}" onclick="event.stopPropagation();nav('channel','${chId}')">${avH}</div>
      <div style="flex:1;min-width:0;cursor:pointer" onclick="nav('watch','${id}')">
        <div class="vnm">${title}</div>
        <div class="vch">${ch}</div>
        <div class="vst">${views ? views + ' penayangan' : ''}${ta ? ' · ' + ta : ''}</div>
      </div>
    </div>
  </div>`;
}

// ── Categories
const CATS = [
  {id:'',   l:'Semua'},   {id:'10', l:'🎵 Musik'},    {id:'20', l:'🎮 Gaming'},
  {id:'25', l:'📰 Berita'},{id:'17', l:'⚽ Olahraga'},{id:'28', l:'💻 Teknologi'},
  {id:'24', l:'🎭 Hiburan'},{id:'22', l:'👤 Vlog'},   {id:'23', l:'😂 Komedi'},
  {id:'27', l:'📚 Edukasi'},
];
function buildCats() {
  G('cats').innerHTML = CATS.map(c => `<button class="cpill${c.id === curCat ? ' on' : ''}" onclick="loadCat('${c.id}')">${c.l}</button>`).join('');
}

// ── Home page
async function showHome() {
  buildCats();
  const subChannels = getSubChannels();
  const terms = subChannels.length > 0
    ? [] // will do subscription-based below
    : Object.entries(wHist.slice(0, 20).reduce((a, v) => { if (v.ch) a[v.ch] = (a[v.ch] || 0) + 1; return a; }, {}))
        .sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]);

  if (subChannels.length) {
    G('pbanner').style.display = 'flex';
    G('pbtext').textContent = `📺 Feed dari ${subChannels.length} langgananmu`;
    await Promise.all([loadFromSubscriptions(subChannels), loadHomeShorts()]);
  } else if (terms.length) {
    G('pbanner').style.display = 'flex';
    G('pbtext').textContent = `Untukmu: ${terms.join(', ')}`;
    await Promise.all([loadPersonalized(terms), loadHomeShorts()]);
  } else {
    G('pbanner').style.display = 'none';
    await Promise.all([loadCat(''), loadHomeShorts()]);
  }
}

// ── Feed from subscriptions (Google login)
async function loadFromSubscriptions(channelIds) {
  const g = G('grid');
  g.innerHTML = Array(12).fill(0).map(skelC).join('');
  const seen = new Set(), merged = [];
  const rssPromises = channelIds.slice(0, 6).map(id => rssChannel(id, 4));
  const allRss = await Promise.all(rssPromises);
  for (const vids of allRss) {
    for (const v of vids) {
      if (!seen.has(v.id)) { seen.add(v.id); merged.push(v); }
    }
  }
  // Fill in with trending if not enough
  if (merged.length < 8) {
    const trend = await getTrendAPI('', 12);
    (trend || []).forEach(v => { const id = v.id?.videoId || v.id; if (!seen.has(id)) { seen.add(id); merged.push(v); } });
  }
  await fetchAv(merged.map(v => v.snippet?.channelId).filter(Boolean));
  g.innerHTML = merged.map(v => cardH(v)).join('') || '<div class="empty">Gagal memuat</div>';
}

// ── Personalized feed from watch history
async function loadPersonalized(terms) {
  const g = G('grid');
  g.innerHTML = Array(12).fill(0).map(skelC).join('');
  const qs  = [...terms.map(t => searchAPI(t, 6)), getTrendAPI('', 6)];
  const res = await Promise.all(qs);
  const seen = new Set(), merged = [];
  for (const b of res) {
    for (const v of (b || [])) {
      const id = v.id?.videoId || v.id;
      if (!seen.has(id)) { seen.add(id); merged.push(v); }
    }
  }
  await fetchAv(merged.map(v => v.snippet?.channelId).filter(Boolean));
  g.innerHTML = merged.map(v => cardH(v)).join('') || '<div class="empty">Gagal memuat</div>';
}

async function loadCat(c) {
  curCat = c; buildCats();
  const g = G('grid');
  g.innerHTML = Array(12).fill(0).map(skelC).join('');
  const shortsSec = G('home-shorts-sec');
  if (c === '') {
    if (!shortsSec.querySelector('.hs-card')) loadHomeShorts();
    else shortsSec.style.display = 'block';
  } else {
    shortsSec.style.display = 'none';
  }
  const d = await getTrendAPI(c, 24);
  if (!d) { g.innerHTML = '<div class="empty">Gagal memuat</div>'; return; }
  await fetchAv(d.map(v => v.snippet?.channelId).filter(Boolean));
  g.innerHTML = d.map(v => cardH(v)).join('');
  G('pbanner').style.display = 'none';
}

// ── Search
async function doSearchTerm(q, isR) {
  if (!isR) return nav('search', q);
  G('search-input').value = q;
  addSHist(q);
  G('sq-title').innerHTML = `Hasil untuk: <strong style="color:var(--text)">"${esc(q)}"</strong>`;
  const g = G('sq-grid');
  g.innerHTML = Array(8).fill(0).map(skelC).join('');
  const items = await searchAPI(q, 12);
  await fetchAv(items.map(v => v.snippet?.channelId).filter(Boolean));
  g.innerHTML = items.length ? items.map(v => cardH(v)).join('') : '<div class="empty">Tidak ada hasil</div>';
}

// ── Watch page
function setShortWatchMode(isShort) {
  document.body.classList.toggle('is-short-watch', isShort);
  const rCol = G('w-related');
  if (rCol) rCol.style.display = isShort ? 'none' : '';
}

async function openWatch(vid) {
  curVidId = vid;
  G('vtitle').textContent = 'Memuat...';
  G('dstats').textContent = ''; G('dtxt').textContent = '';
  G('dtxt').classList.remove('exp'); G('dtoggle').textContent = 'Lebih banyak';
  G('lbar-wrap').style.display = 'none'; G('notesec').style.display = 'none';
  G('chavatar').innerHTML = ''; G('chname').textContent = ''; G('chsubs').textContent = '';
  G('mini-title').textContent = ''; G('mini-ch').textContent = '';
  G('loop-ui').classList.remove('show'); G('loop-btn').classList.remove('active');
  if (loopTimer) { clearInterval(loopTimer); loopTimer = null; }
  G('rlist').innerHTML = Array(5).fill(0).map(() =>
    `<div style="display:flex;gap:8px;margin-bottom:10px"><div class="sk" style="width:168px;height:94px;border-radius:8px;flex-shrink:0"></div><div style="flex:1"><div class="sk" style="height:12px;border-radius:4px;margin-bottom:6px;width:90%"></div><div class="sk" style="height:11px;border-radius:4px;width:65%"></div></div></div>`
  ).join('');

  if (ytReady) loadP(vid); else pendVid = vid;

  const d = await api('videos', { part: 'snippet,statistics,contentDetails', id: vid });
  if (!d?.items?.length) return;
  const v = d.items[0]; curVidData = v;
  const sn = v.snippet || {}, st = v.statistics || {};

  const isShort = await checkIsShort(vid);
  setShortWatchMode(isShort);

  document.title = `${sn.title || ''} - YourTube`;
  G('vtitle').textContent = sn.title || '';
  G('dstats').textContent = `${fvl(st.viewCount)} penayangan · ${ago(sn.publishedAt)}`;
  G('dtxt').textContent = sn.description || '';
  G('mini-title').textContent = sn.title || '';
  G('mini-ch').textContent = sn.channelTitle || '';

  if (st.likeCount && st.viewCount) {
    const r = Math.min(100, (parseInt(st.likeCount) / parseInt(st.viewCount)) * 500);
    G('llike').textContent = `👍 ${fv(st.likeCount)} suka`;
    G('lratio').textContent = `Disukai ${r.toFixed(1)}% penonton`;
    G('lbar-fill').style.width = `${Math.min(100, r * 2)}%`;
    G('lbar-wrap').style.display = 'block';
  }

  const chId = sn.channelId;
  G('chname').textContent = sn.channelTitle || '';
  G('chinfo').dataset.chid = chId || '';

  if (chId && avCache[chId]) {
    G('chavatar').innerHTML = `<img src="${avCache[chId]}" alt=""/>`;
  } else if (chId) {
    G('chavatar').textContent = (sn.channelTitle || '?')[0].toUpperCase();
    G('chavatar').style.background = avc(sn.channelTitle || '');
    const obs = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return;
      obs.disconnect();
      api('channels', { part: 'snippet,statistics', id: chId }).then(cd => {
        if (!cd?.items?.length) return;
        const c = cd.items[0];
        G('chsubs').textContent = `${fv(c.statistics?.subscriberCount || 0)} subscriber`;
        const img = c.snippet?.thumbnails?.medium?.url || c.snippet?.thumbnails?.default?.url;
        if (img) { G('chavatar').innerHTML = `<img src="${img}" alt=""/>`; avCache[chId] = img; try { localStorage.setItem('yt_avcache', JSON.stringify(avCache)); } catch(e) {} }
      });
    }, { threshold: 0.1 });
    obs.observe(G('chinfo'));
  }

  const notes = JSON.parse(localStorage.getItem('yt_notes') || '{}');
  G('notearea').value = notes[vid] || '';
  G('notearea').style.display = 'none';

  addHist(v); renderQueue();

  commentNextPage = null; commentVidId = vid;
  G('comments-list').innerHTML = '';
  G('comments-list').style.display = 'none';
  G('comment-count').textContent = '';
  G('load-more-comments').style.display = 'none';
  G('show-comments-btn').style.display = 'block';
  G('show-comments-btn').textContent = '💬 Tampilkan Komentar';

  G('rss-badge').style.display = 'none';
  G('rlist').innerHTML = `<div id="related-lazy-trigger" style="color:var(--text2);font-size:13px;padding:8px 0">
    <div class="sk" style="width:100%;height:94px;border-radius:8px;margin-bottom:8px"></div>
    <div class="sk" style="width:100%;height:94px;border-radius:8px;margin-bottom:8px"></div>
    <div class="sk" style="width:100%;height:94px;border-radius:8px"></div>
  </div>`;

  const relObs = new IntersectionObserver(async entries => {
    if (!entries[0].isIntersecting) return;
    relObs.disconnect();
    if (chId) {
      const rssVids = await rssChannel(chId, 12);
      const filtered = rssVids.filter(r => r.id !== vid);
      if (filtered.length >= 3) {
        G('rlist').innerHTML = filtered.map(r => cardH(r, true)).join('');
        G('rss-badge').style.display = 'inline-flex';
        return;
      }
    }
    const rel = await searchAPI(sn.channelTitle || '', 8);
    await fetchAv(rel.map(r => r.snippet?.channelId).filter(Boolean));
    G('rlist').innerHTML = rel.filter(r => (r.id?.videoId || r.id) !== vid).map(r => cardH(r, true)).join('');
  }, { threshold: 0.1 });
  const trigger = document.getElementById('related-lazy-trigger');
  if (trigger) relObs.observe(trigger);
}

// ── Channel page
let curOpenChId = null;
async function openChannel(chId) {
  if (!chId) return nav('home');
  curOpenChId = chId;
  G('ch-banner').innerHTML = ''; G('ch-big-av').innerHTML = '';
  G('ch-big-name').textContent = 'Memuat...'; G('ch-big-subs').textContent = '';
  G('ch-grid').innerHTML = Array(8).fill(0).map(skelC).join('');
  G('pin-ch-btn').textContent = isChannelPinned(chId) ? '✅ Di-pin' : '📌 Pin';
  const d = await api('channels', { part: 'snippet,brandingSettings,statistics', id: chId });
  if (!d?.items?.length) return;
  const ch = d.items[0], sn = ch.snippet, st = ch.statistics, bs = ch.brandingSettings;
  if (bs?.image?.bannerExternalUrl) G('ch-banner').innerHTML = `<img src="${bs.image.bannerExternalUrl}" style="width:100%;height:100%;object-fit:cover"/>`;
  const hiAvUrl = sn?.thumbnails?.high?.url;
  if (hiAvUrl) G('ch-big-av').innerHTML = `<img src="${hiAvUrl}" style="width:100%;height:100%;object-fit:cover"/>`;
  else { G('ch-big-av').textContent = (sn?.title || '?')[0].toUpperCase(); G('ch-big-av').style.background = avc(sn?.title || ''); }
  G('ch-big-name').textContent = sn?.title || '';
  G('ch-big-subs').textContent = `${fv(st?.subscriberCount || 0)} subscriber · ${fv(st?.videoCount || 0)} video`;
  if (sn?.thumbnails?.default?.url) avCache[chId] = sn.thumbnails.default.url;

  const rssVids = await rssChannel(chId, 16);
  if (rssVids.length >= 4) {
    G('ch-grid').innerHTML = rssVids.map(v => cardH(v)).join('');
  } else {
    const sv = await api('search', { part: 'snippet', channelId: chId, order: 'date', type: 'video', maxResults: 16 });
    if (!sv?.items?.length) { G('ch-grid').innerHTML = '<div class="empty">Belum ada video</div>'; }
    else {
      const vd = await api('videos', { part: 'snippet,statistics,contentDetails', id: sv.items.map(i => i.id.videoId).join(',') });
      G('ch-grid').innerHTML = vd?.items?.map(v => cardH(v)).join('') || '';
    }
  }

  const chShorts = await getChannelShorts(chId, 8);
  if (chShorts.length > 0) {
    G('ch-grid').innerHTML += `<div style="grid-column:1/-1;font-size:18px;font-weight:700;margin-top:20px;border-top:1px solid var(--border);padding-top:16px;">🔥 Shorts Channel Ini</div>`;
    G('ch-grid').innerHTML += chShorts.map(v => cardH(v)).join('');
  }
}

// ── Comments
let commentNextPage = null;
let commentVidId    = null;

function showComments() {
  G('show-comments-btn').style.display = 'none';
  G('comments-list').style.display = 'block';
  if (!commentVidId) return;
  loadComments(commentVidId);
}
async function loadComments(vid, pageToken = null) {
  if (!vid) return;
  commentVidId = vid;
  const params = { part: 'snippet', videoId: vid, maxResults: 10, order: 'relevance' };
  if (pageToken) params.pageToken = pageToken;
  if (!pageToken) { G('comments-list').innerHTML = '<div style="color:var(--text2);padding:20px 0;text-align:center">⏳ Memuat komentar...</div>'; G('load-more-comments').style.display = 'none'; }
  const d = await api('commentThreads', params);
  if (!d) { if (!pageToken) G('comments-list').innerHTML = '<div style="color:var(--text2);padding:12px 0;font-size:13px">💬 Komentar tidak tersedia atau dinonaktifkan.</div>'; return; }
  const total = d.pageInfo?.totalResults || 0;
  if (!pageToken) { G('comment-count').textContent = fv(total) + ' komentar'; G('comments-list').innerHTML = ''; }
  commentNextPage = d.nextPageToken || null;
  const html = (d.items || []).map(item => {
    const c = item.snippet?.topLevelComment?.snippet || {};
    const author = esc(c.authorDisplayName || '');
    const text   = esc(c.textOriginal || c.textDisplay || '');
    const img    = c.authorProfileImageUrl || '';
    const likes  = c.likeCount || 0;
    const time   = c.publishedAt ? ago(c.publishedAt) : '';
    const avC    = avc(author);
    const avH    = img ? `<img src="${img}" loading="lazy" onerror="this.style.display='none'"/>` : (author[0] || '?').toUpperCase();
    const replyCount = item.snippet?.totalReplyCount || 0;
    return `<div class="comment-item">
      <div class="comment-av" style="background:${avC}">${avH}</div>
      <div style="flex:1;min-width:0">
        <div class="comment-author">${author}</div>
        <div class="comment-text">${text}</div>
        <div class="comment-meta">
          <span>${time}</span>
          ${likes ? `<span>👍 ${fv(likes)}</span>` : ''}
          ${replyCount ? `<span>💬 ${replyCount} balasan</span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
  G('comments-list').innerHTML += html;
  G('load-more-comments').style.display = commentNextPage ? 'block' : 'none';
}
async function loadMoreComments() {
  if (!commentNextPage || !commentVidId) return;
  G('load-more-comments').textContent = 'Memuat...'; G('load-more-comments').disabled = true;
  await loadComments(commentVidId, commentNextPage);
  G('load-more-comments').textContent = 'Muat lebih banyak komentar'; G('load-more-comments').disabled = false;
}

// ── Playlist
function openSaveModalCur() {
  if (curVidData) openSaveModal(curVidData.id, curVidData.snippet?.title || '', curVidData.snippet?.channelTitle || '', curVidData.snippet?.thumbnails?.medium?.url || ytThumb(curVidData.id));
}
function openSaveModal(id, t, c, th) {
  const m = G('pl-modal'); m.dataset.vid = id; m.dataset.vt = t; m.dataset.vc = c; m.dataset.vth = th;
  G('pl-list-modal').innerHTML = Object.keys(playlists).map(p => `<label style="display:flex;align-items:center;gap:12px;margin-bottom:12px;cursor:pointer;font-size:15px"><input type="checkbox" style="width:18px;height:18px" ${playlists[p].some(v => v.id === id) ? 'checked' : ''} onchange="togglePlItem('${p}','${id}','${esc(t)}','${esc(c)}','${th}',this.checked)">${esc(p)}</label>`).join('');
  m.classList.add('show');
}
function togglePlItem(p, id, t, c, th, chk) {
  if (chk) { if (!playlists[p].some(v => v.id === id)) { playlists[p].unshift({ id, title: t, ch: c, thumb: th }); toast(`✅ Disimpan ke "${p}"`); } }
  else { playlists[p] = playlists[p].filter(v => v.id !== id); toast(`Dihapus dari "${p}"`); }
  localStorage.setItem('yt_playlists', JSON.stringify(playlists));
  if (G('pl-panel').classList.contains('open')) renderPL();
}
function createNewPl() {
  const n = G('new-pl-inp').value.trim(); if (!n || playlists[n]) return;
  playlists[n] = []; G('new-pl-inp').value = '';
  const m = G('pl-modal'); togglePlItem(n, m.dataset.vid, m.dataset.vt, m.dataset.vc, m.dataset.vth, true);
  openSaveModal(m.dataset.vid, m.dataset.vt, m.dataset.vc, m.dataset.vth);
}
function renderPL() {
  G('pl-select').innerHTML = Object.keys(playlists).map(p => `<option value="${p}" ${p === curPlView ? 'selected' : ''}>${esc(p)}</option>`).join('');
  const items = playlists[curPlView] || [];
  G('wl-list').innerHTML = items.length ? items.map(v => `<div class="wlitem" onclick="nav('watch','${v.id}');closePLPanel()"><div class="wlthumb"><img src="${v.thumb || ytThumb(v.id, 'mqdefault')}" loading="lazy"/></div><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(v.title)}</div><div style="font-size:12px;color:var(--text2);margin-top:2px">${esc(v.ch || '')}</div></div><button onclick="event.stopPropagation();playlists['${curPlView}']=playlists['${curPlView}'].filter(x=>x.id!=='${v.id}');localStorage.setItem('yt_playlists',JSON.stringify(playlists));renderPL()" style="width:28px;height:28px;border-radius:50%;background:var(--surface2);border:none;cursor:pointer;color:var(--text);flex-shrink:0">✕</button></div>`).join('') :
    '<div class="empty" style="padding:40px 20px">Playlist kosong</div>';
}
function togglePLPanel() { G('pl-panel').classList.toggle('open'); renderPL(); }
function openPLPanel()   { if (window.innerWidth <= 640) toggleSidebar(); G('pl-panel').classList.add('open'); renderPL(); }
function closePLPanel()  { G('pl-panel').classList.remove('open'); }
function bgClose(e, id)  { if (e.target === G(id)) G(id).classList.remove('show'); }

// ── History
function addHist(v) {
  const id = v.id?.videoId || v.id;
  wHist = wHist.filter(x => x.id !== id);
  wHist.unshift({ id, title: v.snippet?.title, ch: v.snippet?.channelTitle, chId: v.snippet?.channelId, thumb: v.snippet?.thumbnails?.medium?.url || ytThumb(id, 'mqdefault'), ts: Date.now() });
  wHist = wHist.slice(0, 60); localStorage.setItem('yt_hist', JSON.stringify(wHist));
}
function showHistory() {
  const g = G('hist-grid');
  if (!wHist.length) { g.innerHTML = '<div class="empty">Belum ada riwayat tontonan</div>'; return; }
  g.innerHTML = wHist.map(v => cardH({ id: v.id, snippet: { title: v.title, channelTitle: v.ch, channelId: v.chId, thumbnails: { medium: { url: v.thumb } } } })).join('');
}
function clearHistory() { if (!confirm('Hapus semua riwayat?')) return; wHist = []; localStorage.setItem('yt_hist', JSON.stringify(wHist)); showHistory(); toast('Riwayat dihapus'); }
function addSHist(q) { sHist = sHist.filter(x => x !== q); sHist.unshift(q); localStorage.setItem('yt_shist', JSON.stringify(sHist.slice(0, 12))); }

// ── Search suggestions
function onSugInput(v) { clearTimeout(sugTimer); if (!v || v.length < 2) { showRecentSearch(); return; } sugTimer = setTimeout(() => fetchSug(v), 300); }
function onSugFocus() { const v = G('search-input').value.trim(); if (v.length >= 2) fetchSug(v); else showRecentSearch(); }
function onSugBlur()  { setTimeout(hideSug, 200); }
function showRecentSearch() { if (!sHist.length) { hideSug(); return; } G('suggest-box').innerHTML = '<div style="padding:8px 16px;font-size:12px;color:var(--text2);font-weight:600">PENCARIAN TERAKHIR</div>' + sHist.map(s => `<div class="sug-item" onmousedown="pickSug('${esc(s)}')"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>${esc(s)}</div>`).join(''); G('suggest-box').style.display = 'block'; }
function fetchSug(q) { const cb = '_yts_' + Date.now(); const s = document.createElement('script'); const t = setTimeout(() => { hideSug(); try { delete window[cb]; s.remove(); } catch(e) {} }, 3000); window[cb] = data => { clearTimeout(t); try { delete window[cb]; s.remove(); } catch(e) {} renderSug(data[1] ? data[1].map(x => Array.isArray(x) ? x[0] : x) : []); }; s.src = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&hl=id&q=${encodeURIComponent(q)}&callback=${cb}`; document.head.appendChild(s); }
function renderSug(items) { if (!items.length) return; G('suggest-box').innerHTML = items.slice(0, 8).map(s => `<div class="sug-item" onmousedown="pickSug('${esc(s)}')"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>${esc(s)}</div>`).join(''); G('suggest-box').style.display = 'block'; }
function hideSug()     { G('suggest-box').style.display = 'none'; }
function pickSug(s)    { G('search-input').value = s; hideSug(); nav('search', s); }
function doSearch(e)   { e.preventDefault(); const q = G('search-input').value.trim(); if (q) nav('search', q); }

// ── Stats
function showStats() {
  const hist  = JSON.parse(localStorage.getItem('yt_hist') || '[]');
  const notes = JSON.parse(localStorage.getItem('yt_notes') || '{}');
  const pl    = JSON.parse(localStorage.getItem('yt_playlists') || '{}');
  const total = hist.length;
  const chCount = {};
  hist.forEach(v => { if (v.ch) chCount[v.ch] = (chCount[v.ch] || 0) + 1; });
  const topCh  = Object.entries(chCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCh  = topCh[0]?.[1] || 1;
  const totalPl = Object.values(pl).reduce((a, v) => a + v.length, 0);
  const totalNotes = Object.keys(notes).length;
  G('stats-content').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:28px">
      ${[['📺','Total Ditonton',total+' video'],['📝','Dicatat',totalNotes+' video'],['🗂️','Di Playlist',totalPl+' video'],['🔍','Cari',sHist.length+' pencarian']].map(([ic,lb,vl])=>`
      <div style="background:var(--surface);border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:28px">${ic}</div>
        <div style="font-size:22px;font-weight:700;margin:6px 0">${vl.split(' ')[0]}</div>
        <div style="font-size:12px;color:var(--text2)">${lb}</div>
      </div>`).join('')}
    </div>
    <div style="background:var(--surface);border-radius:12px;padding:16px;margin-bottom:16px">
      <h3 style="font-size:15px;font-weight:700;margin-bottom:16px">🏆 Channel Paling Sering Ditonton</h3>
      <div id="stats-bars">${topCh.length ? topCh.map(([ch,n])=>`
        <div class="stat-bar-row">
          <div class="stat-bar-label" title="${esc(ch)}">${esc(ch.length>10?ch.slice(0,10)+'…':ch)}</div>
          <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${Math.round((n/maxCh)*100)}%"></div></div>
          <div class="stat-bar-val">${n}x</div>
        </div>`).join('') : '<div style="color:var(--text2);font-size:14px">Belum ada data</div>'}</div>
    </div>
    <div style="background:var(--surface);border-radius:12px;padding:16px">
      <h3 style="font-size:15px;font-weight:700;margin-bottom:12px">🗑️ Kelola Data</h3>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button onclick="clearHistory()" style="padding:8px 16px;border-radius:99px;background:var(--surface2);color:var(--text);font-size:13px;border:none;cursor:pointer">Hapus Riwayat</button>
        <button onclick="exportAllNotes()" style="padding:8px 16px;border-radius:99px;background:var(--accent);color:#fff;font-size:13px;border:none;cursor:pointer">Export Catatan</button>
        <button onclick="if(confirm('Hapus semua catatan?')){localStorage.removeItem('yt_notes');toast('Catatan dihapus');}" style="padding:8px 16px;border-radius:99px;background:var(--surface2);color:var(--text);font-size:13px;border:none;cursor:pointer">Hapus Catatan</button>
        ${googleUser ? `<button onclick="signOutGoogle()" style="padding:8px 16px;border-radius:99px;background:#3a1010;color:#ef9a9a;font-size:13px;border:none;cursor:pointer">🔓 Keluar Google</button>` : ''}
      </div>
    </div>`;
}

// ── Notes
function toggleNotes() { const ns = G('notesec'); ns.style.display = ns.style.display === 'block' ? 'none' : 'block'; }
function saveNote()  { if (!curVidId) return; const n = JSON.parse(localStorage.getItem('yt_notes') || '{}'); n[curVidId] = G('notearea').value; localStorage.setItem('yt_notes', JSON.stringify(n)); }
function exportNotes() { if (!curVidId) return; const notes = JSON.parse(localStorage.getItem('yt_notes') || '{}'); const note = notes[curVidId] || ''; if (!note) { toast('Belum ada catatan untuk video ini'); return; } const title = curVidData?.snippet?.title || curVidId; downloadTxt(`Video: ${title}\nURL: https://youtu.be/${curVidId}\n\n${note}`, `catatan-${curVidId}.txt`); }
function exportAllNotes() { const notes = JSON.parse(localStorage.getItem('yt_notes') || '{}'); if (!Object.keys(notes).length) { toast('Belum ada catatan tersimpan'); return; } const lines = Object.entries(notes).map(([id, n]) => `===== https://youtu.be/${id} =====\n${n}`).join('\n\n'); downloadTxt(lines, 'semua-catatan-yourtube.txt'); toast('✅ Catatan berhasil diexport!'); }

// ── Share
function shareVid() { const u = `https://youtu.be/${curVidId}`; if (navigator.share) navigator.share({ title: G('vtitle').textContent, url: u }); else if (navigator.clipboard) navigator.clipboard.writeText(u).then(() => toast('🔗 Link disalin!')); else toast(u); }
function toggleDesc() { const e = G('dtxt').classList.toggle('exp'); G('dtoggle').textContent = e ? 'Lebih sedikit' : 'Lebih banyak'; }

// ── Settings
function showSettings() {
  G('settings-modal').classList.add('show');
  G('theme-toggle').classList.toggle('on', document.body.classList.contains('light'));
  G('datasaver-toggle').classList.toggle('on', dataSaver);
  G('sub-size-range').value = subSize; G('sub-size-label').textContent = subSize + '%';
  const saved = localStorage.getItem('yt_accent') || '#3ea6ff';
  document.querySelectorAll('.color-dot').forEach(d => d.classList.toggle('active', d.dataset.color === saved));
}
function toggleTheme() { document.body.classList.toggle('light'); localStorage.setItem('yt_theme', document.body.classList.contains('light') ? 'light' : 'dark'); G('theme-toggle').classList.toggle('on', document.body.classList.contains('light')); }
function setAccent(color, el) { document.documentElement.style.setProperty('--accent', color); localStorage.setItem('yt_accent', color); document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active')); el.classList.add('active'); toast('🎨 Warna diubah!'); }
function setSubSize(v) { subSize = parseInt(v); document.documentElement.style.setProperty('--sub-size', subSize + '%'); G('sub-size-label').textContent = subSize + '%'; localStorage.setItem('yt_subsize', subSize); let st = document.getElementById('sub-style'); if (!st) { st = document.createElement('style'); st.id = 'sub-style'; document.head.appendChild(st); } st.textContent = `.ytp-caption-segment{font-size:${subSize}% !important}`; }
function toggleDataSaver() { dataSaver = !dataSaver; localStorage.setItem('yt_datasaver', dataSaver ? '1' : '0'); document.body.classList.toggle('data-saver', dataSaver); G('datasaver-bar').classList.toggle('show', dataSaver); G('datasaver-toggle').classList.toggle('on', dataSaver); toast(dataSaver ? '📉 Mode Hemat Data ON' : 'Mode Hemat Data OFF'); }

// ── Pin Channel
let pinnedChannels = JSON.parse(localStorage.getItem('yt_pinned') || '[]');
function isChannelPinned(id) { return pinnedChannels.some(c => c.id === id); }
function togglePinChannel() {
  if (!curOpenChId) return;
  const chName = G('ch-big-name').textContent;
  const chImg  = G('ch-big-av').querySelector('img')?.src || '';
  if (isChannelPinned(curOpenChId)) {
    pinnedChannels = pinnedChannels.filter(c => c.id !== curOpenChId);
    G('pin-ch-btn').textContent = '📌 Pin';
    toast('Dihapus dari Channel Favorit');
  } else {
    pinnedChannels.push({ id: curOpenChId, name: chName, img: chImg, addedAt: Date.now() });
    G('pin-ch-btn').textContent = '✅ Di-pin';
    toast('📌 Channel ditambahkan ke Favorit!');
  }
  localStorage.setItem('yt_pinned', JSON.stringify(pinnedChannels));
}
async function showPinnedPage() {
  const g = G('pinned-grid');
  if (!pinnedChannels.length) { g.innerHTML = ''; G('pinned-empty').style.display = 'block'; return; }
  G('pinned-empty').style.display = 'none';
  g.innerHTML = pinnedChannels.map(ch => `
    <div class="pin-card" onclick="nav('channel','${ch.id}')">
      <div class="pin-av" style="background:${avc(ch.name)}">
        ${ch.img ? `<img src="${ch.img}" onerror="this.style.display='none'" loading="lazy"/>` : (ch.name[0] || '?').toUpperCase()}
      </div>
      <div style="font-size:14px;font-weight:700;margin-bottom:4px">${esc(ch.name)}</div>
      <button onclick="event.stopPropagation();removePinned('${ch.id}')" style="margin-top:8px;padding:4px 12px;border-radius:99px;background:var(--surface2);color:var(--text2);border:none;cursor:pointer;font-size:12px">Hapus Pin</button>
    </div>`).join('');
  await checkAllPinned();
}
async function checkAllPinned() {
  if (!pinnedChannels.length) return;
  toast('🔄 Mengecek update channel...');
  const liveMap = await checkLiveStatus(pinnedChannels.map(c => c.id));
  for (const ch of pinnedChannels) {
    try {
      const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent('https://www.youtube.com/feeds/videos.xml?channel_id=' + ch.id)}`);
      const j = await r.json(); if (!j.contents) continue;
      const xml = new DOMParser().parseFromString(j.contents, 'text/xml');
      const latest = xml.querySelector('entry'), latestId = latest?.querySelector('videoId')?.textContent;
      const lastSeen = localStorage.getItem('yt_lastseen_' + ch.id);
      if (latestId && latestId !== lastSeen) { if (lastSeen) sendNotif(`🆕 ${ch.name} upload baru!`, latest?.querySelector('title')?.textContent || '', `/#watch=${latestId}`); localStorage.setItem('yt_lastseen_' + ch.id, latestId); }
    } catch(e) {}
  }
  const cards = G('pinned-grid').querySelectorAll('.pin-card');
  pinnedChannels.forEach((ch, i) => {
    if (!cards[i]) return;
    const old = cards[i].querySelector('.pin-live, .pin-new'); if (old) old.remove();
    if (liveMap[ch.id]) { const badge = document.createElement('div'); badge.className = 'pin-live'; badge.innerHTML = `<span style="width:6px;height:6px;background:#fff;border-radius:50%;animation:livepulse 1s infinite"></span> LIVE`; badge.onclick = e => { e.stopPropagation(); nav('watch', liveMap[ch.id]); }; cards[i].appendChild(badge); }
  });
  toast('✅ Selesai dicek!');
}
function removePinned(id) { pinnedChannels = pinnedChannels.filter(c => c.id !== id); localStorage.setItem('yt_pinned', JSON.stringify(pinnedChannels)); showPinnedPage(); }

// ── Live check
async function checkLiveStatus(channelIds) {
  if (!channelIds.length) return {};
  const liveMap = {};
  try {
    const d = await api('search', { part: 'snippet', channelId: channelIds.slice(0, 5).join(','), eventType: 'live', type: 'video', maxResults: 10 }, false);
    (d?.items || []).forEach(item => { liveMap[item.snippet?.channelId] = item.id?.videoId; });
  } catch(e) {}
  return liveMap;
}

// ── Notifications
async function toggleNotif() {
  if (Notification.permission === 'granted') { toast('🔔 Notifikasi sudah aktif!'); return; }
  if (Notification.permission === 'denied')  { toast('❌ Notifikasi diblokir. Izinkan dari pengaturan browser.'); return; }
  const perm = await Notification.requestPermission();
  if (perm === 'granted') { toast('🔔 Notifikasi diizinkan!'); new Notification('YourTube', { body: 'Notifikasi berhasil diaktifkan! 🎉' }); }
  else toast('Notifikasi tidak diizinkan.');
}
function sendNotif(title, body, url) {
  if (Notification.permission !== 'granted') return;
  const n = new Notification(title, { body, icon: 'https://www.youtube.com/favicon.ico' });
  n.onclick = () => { window.focus(); if (url) window.location.hash = url.replace('/#', ''); };
}
async function startPeriodicCheck() {
  if (!pinnedChannels.length || Notification.permission !== 'granted') return;
  setInterval(async () => {
    for (const ch of pinnedChannels.slice(0, 3)) {
      try {
        const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent('https://www.youtube.com/feeds/videos.xml?channel_id=' + ch.id)}`);
        const j = await r.json(); if (!j.contents) continue;
        const xml = new DOMParser().parseFromString(j.contents, 'text/xml');
        const latest = xml.querySelector('entry'), latestId = latest?.querySelector('videoId')?.textContent;
        const lastSeen = localStorage.getItem('yt_lastseen_' + ch.id);
        if (latestId && latestId !== lastSeen) { if (lastSeen) sendNotif(`🆕 ${ch.name} upload baru!`, latest?.querySelector('title')?.textContent || '', `/#watch=${latestId}`); localStorage.setItem('yt_lastseen_' + ch.id, latestId); }
      } catch(e) {}
    }
  }, 15 * 60 * 1000);
}

// ── PWA
let pwaInstallEvent = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); pwaInstallEvent = e; if (!localStorage.getItem('pwa_dismissed')) setTimeout(() => G('pwa-banner').classList.add('show'), 4000); });
window.addEventListener('appinstalled', () => { G('pwa-banner').classList.remove('show'); localStorage.setItem('pwa_installed', '1'); toast('✅ YourTube berhasil diinstall!'); });
async function installPWA() {
  if (pwaInstallEvent) { pwaInstallEvent.prompt(); const r = await pwaInstallEvent.userChoice; G('pwa-banner').classList.remove('show'); if (r.outcome !== 'accepted') localStorage.setItem('pwa_dismissed', '1'); pwaInstallEvent = null; }
  else { const ua = navigator.userAgent.toLowerCase(); if (/iphone|ipad|ipod/.test(ua)) alert('Di iPhone/iPad:\n1. Ketuk tombol Share\n2. Pilih "Add to Home Screen"\n3. Ketuk "Add"'); else alert('Cara install:\n1. Ketuk menu browser (⋮)\n2. Pilih "Install app"\n3. Ketuk "Install"'); G('pwa-banner').classList.remove('show'); }
}
