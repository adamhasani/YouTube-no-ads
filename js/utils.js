// ════════════════════════════════════════
// utils.js — Global state + helper functions
// ════════════════════════════════════════

const FAA_BASE = 'https://api-faa.my.id/faa';

const INV_INSTANCES = [
  'https://iv.datura.network',
  'https://invidious.privacyredirect.com',
  'https://invidious.fdn.fr',
  'https://inv.nadeko.net',
];

const AVC = ['#e53935','#8e24aa','#1e88e5','#00897b','#f4511e','#6d4c41','#546e7a','#43a047','#fb8c00','#d81b60'];

// ── Global state
let sideExp = window.innerWidth > 1024;
let curCat   = '';
let curVidId = null;
let curVidData = null;

let ytP      = null;
let ytReady  = false;
let pendVid  = null;

let autoRep  = false;
let curSpd   = 1;
let audioMode = false;

let sugTimer = null;
let ttTimer  = null;
let loopTimer = null;

let avCache = (() => {
  try { return JSON.parse(localStorage.getItem('yt_avcache') || '{}'); }
  catch(e) { return {}; }
})();

let wHist     = JSON.parse(localStorage.getItem('yt_hist')      || '[]');
let sHist     = JSON.parse(localStorage.getItem('yt_shist')     || '[]');
let playlists = JSON.parse(localStorage.getItem('yt_playlists') || '{"Tonton Nanti":[]}');
let curPlView = 'Tonton Nanti';

let queue    = [];
let queueIdx = 0;

let dataSaver = localStorage.getItem('yt_datasaver') === '1';
let subSize   = parseInt(localStorage.getItem('yt_subsize') || '100');

// ── Google auth state
let googleUser = null; // { name, email, picture, accessToken }

// ── DOM shorthand
function G(id) { return document.getElementById(id); }

// ── Toast notification
function toast(msg, ms = 3000) {
  const t = G('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), ms);
}

// ── Number formatters
function fv(n) {
  if (!n) return '0';
  n = parseInt(n);
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'M';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'jt';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'rb';
  return n.toString();
}
function fvl(n) {
  if (!n) return '0';
  return parseInt(n).toLocaleString('id');
}

// ── Time formatters
function ago(d) {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return 'baru saja';
  const m = Math.floor(s / 60); if (m < 60) return m + 'm lalu';
  const h = Math.floor(m / 60); if (h < 24) return h + ' jam lalu';
  const dy = Math.floor(h / 24); if (dy < 7) return dy + ' hari lalu';
  const w = Math.floor(dy / 7); if (w < 5) return w + ' minggu lalu';
  const mo = Math.floor(dy / 30); if (mo < 12) return mo + ' bulan lalu';
  return Math.floor(dy / 365) + ' tahun lalu';
}

function dur(d) {
  if (!d) return '';
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const h = parseInt(m[1] || 0), mn = parseInt(m[2] || 0), s = parseInt(m[3] || 0);
  if (h > 0) return `${h}:${String(mn).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${mn}:${String(s).padStart(2, '0')}`;
}

// ── Escape HTML
function esc(s) {
  return (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Avatar color from string
function avc(s) {
  let h = 0;
  for (let c of (s || '')) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVC[Math.abs(h) % AVC.length];
}

// ── Shuffle array (Fisher-Yates)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// ── YouTube thumbnail
function ytThumb(id, q = 'hqdefault') {
  return `https://i.ytimg.com/vi/${id}/${q}.jpg`;
}

// ── Duration ISO → mm:ss parse
function parseMSS(s) {
  const p = s.split(':').map(Number);
  return p.length === 2 ? p[0] * 60 + p[1]
       : p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2]
       : NaN;
}

// ── Download text file
function downloadTxt(content, filename) {
  const a = document.createElement('a');
  a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content);
  a.download = filename;
  a.click();
}
