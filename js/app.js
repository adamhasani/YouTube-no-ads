// ════════════════════════════════════════
// app.js — Routing + sidebar + init
// ════════════════════════════════════════

// ── Navigation
function nav(page, arg) {
  if (history.state?.page === page && history.state?.arg === arg) return;
  history.pushState({ page, arg }, '', `#${page}${arg ? '=' + encodeURIComponent(arg) : ''}`);
  applyRoute({ page, arg });
}

window.addEventListener('popstate', e => applyRoute(e.state || { page: 'home' }));

function applyRoute(state) {
  // Close sidebar on mobile when navigating
  if (window.innerWidth <= 640 && G('sidebar').classList.contains('exp')) toggleSidebar();

  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  window.scrollTo(0, 0);

  const page = state.page || 'home';
  const pgEl = G(page + '-page');

  if (pgEl) pgEl.style.display = (page === 'watch') ? 'contents' : 'block';

  if (page === 'watch') {
    document.body.classList.add('is-watch');
    document.body.classList.remove('is-mini', 'is-shorts');
    if (curVidId !== state.arg) openWatch(state.arg);
  } else {
    document.body.classList.remove('is-watch', 'is-short-watch');
    document.body.classList.toggle('is-shorts', page === 'shorts');
    if (curVidId) document.body.classList.add('is-mini');
    else          document.body.classList.remove('is-mini');

    if (page === 'home')    showHome();
    if (page === 'channel') openChannel(state.arg);
    if (page === 'search')  doSearchTerm(state.arg, true);
    if (page === 'history') showHistory();
    if (page === 'stats')   showStats();
    if (page === 'pinned')  showPinnedPage();
    if (page === 'shorts')  { if (!shortsData.length) loadShorts('viral'); }
  }

  // Update sidebar active state
  document.querySelectorAll('.si').forEach(el => el.classList.remove('on'));
  const an = G('sb-' + page); if (an) an.classList.add('on');
}

// ── Sidebar toggle
function toggleSidebar() {
  const sb = G('sidebar'), mn = G('main'), ov = G('sb-overlay');
  if (window.innerWidth <= 640) {
    sb.classList.toggle('exp');
    ov.classList.toggle('show', sb.classList.contains('exp'));
  } else {
    sideExp = !sideExp;
    sb.classList.toggle('exp', sideExp);
    mn.classList.toggle('exp', sideExp);
  }
}

// ── Init
document.addEventListener('DOMContentLoaded', async () => {
  cleanCache();

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // Theme
  if (localStorage.getItem('yt_theme') === 'light') document.body.classList.add('light');

  // Data saver
  if (dataSaver) { document.body.classList.add('data-saver'); G('datasaver-bar').classList.add('show'); }

  // Accent color
  const accent = localStorage.getItem('yt_accent');
  if (accent) document.documentElement.style.setProperty('--accent', accent);

  // Subtitle size
  if (subSize !== 100) setSubSize(subSize);

  // Sidebar state
  if (sideExp && window.innerWidth > 640) { G('sidebar').classList.add('exp'); G('main').classList.add('exp'); }

  // Initial route
  if (!history.state) history.replaceState({ page: 'home' }, '', window.location.pathname);
  const hash = window.location.hash.substring(1);
  if (hash) {
    const [page, ...rest] = hash.split('=');
    applyRoute({ page, arg: decodeURIComponent(rest.join('=')) });
  } else {
    applyRoute({ page: 'home' });
  }

  // Init Google Auth
  await initGoogleAuth();

  // Periodic channel check
  setTimeout(startPeriodicCheck, 5000);
});

// ── Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'k' || e.key === ' ') { e.preventDefault(); ytP?.getPlayerState?.() === 1 ? yc('pauseVideo') : yc('playVideo'); }
  if (e.key === 'f') goFS();
  if (e.key === 'm') toggleAudioMode();
  if (e.key === 'ArrowRight' && e.altKey) playNextQueue();
  if (e.key === 'Escape') {
    G('settings-modal').classList.remove('show');
    G('pl-modal').classList.remove('show');
    G('user-menu').classList.remove('show');
  }
});
