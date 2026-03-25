// ════════════════════════════════════════
// auth.js — Google OAuth 2.0 via GIS
// ════════════════════════════════════════

let gisClient = null;
let googleClientId = null;

// ── Load saved user from localStorage
function loadSavedUser() {
  try {
    const saved = localStorage.getItem('yt_google_user');
    if (saved) {
      googleUser = JSON.parse(saved);
      renderUserBtn();
    }
  } catch(e) {}
}

// ── Fetch Google Client ID from backend config
async function initGoogleAuth() {
  try {
    const r = await fetch('/api/config');
    const d = await r.json();
    googleClientId = d.googleClientId || null;
  } catch(e) {
    googleClientId = null;
  }

  loadSavedUser();

  if (!googleClientId) {
    console.warn('Google Client ID tidak dikonfigurasi. Tambahkan GOOGLE_CLIENT_ID di env Vercel.');
    G('google-login-btn').style.display = 'none';
    return;
  }

  // Wait for GIS library
  if (typeof google !== 'undefined') {
    setupGIS();
  } else {
    window.addEventListener('gis-loaded', setupGIS, { once: true });
  }
}

function setupGIS() {
  if (!googleClientId) return;
  gisClient = google.accounts.oauth2.initTokenClient({
    client_id: googleClientId,
    scope: 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
    callback: handleOAuthResponse,
  });
  renderUserBtn();
}

async function handleOAuthResponse(response) {
  if (response.error) {
    toast('❌ Login Google gagal: ' + response.error);
    return;
  }

  const accessToken = response.access_token;

  try {
    // Get user profile
    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + accessToken }
    });
    const profile = await r.json();

    googleUser = {
      name:        profile.name        || profile.email,
      email:       profile.email       || '',
      picture:     profile.picture     || '',
      accessToken: accessToken,
    };

    localStorage.setItem('yt_google_user', JSON.stringify(googleUser));
    renderUserBtn();
    toast(`✅ Masuk sebagai ${googleUser.name}`);

    // Reload home with personalized content
    await loadPersonalizedFeed();
  } catch(e) {
    toast('❌ Gagal mengambil profil Google');
  }
}

// ── Login button click
function signInWithGoogle() {
  if (!gisClient) {
    if (!googleClientId) {
      toast('⚠️ Google Client ID belum dikonfigurasi di server');
    } else {
      toast('⏳ Menginisialisasi login...');
    }
    return;
  }
  gisClient.requestAccessToken();
}

// ── Sign out
function signOutGoogle() {
  if (googleUser?.accessToken) {
    try { google.accounts.oauth2.revoke(googleUser.accessToken); } catch(e) {}
  }
  googleUser = null;
  localStorage.removeItem('yt_google_user');
  renderUserBtn();
  G('user-menu').classList.remove('show');
  toast('👋 Keluar dari akun Google');
}

// ── Render user/login button in navbar
function renderUserBtn() {
  const loginBtn  = G('google-login-btn');
  const avatarBtn = G('user-avatar-btn');
  if (!loginBtn || !avatarBtn) return;

  if (googleUser) {
    loginBtn.style.display  = 'none';
    avatarBtn.style.display = 'flex';
    if (googleUser.picture) {
      avatarBtn.innerHTML = `<img src="${googleUser.picture}" alt="${esc(googleUser.name)}" onerror="this.parentElement.textContent='${(googleUser.name || 'U')[0].toUpperCase()}'"/>`;
    } else {
      avatarBtn.textContent = (googleUser.name || 'U')[0].toUpperCase();
    }

    // Update user menu header
    const hdr = G('user-menu-header-info');
    if (hdr) {
      hdr.querySelector('.uname').textContent = googleUser.name || '';
      hdr.querySelector('.uemail').textContent = googleUser.email || '';
    }
  } else {
    loginBtn.style.display  = 'flex';
    avatarBtn.style.display = 'none';
  }
}

// ── Toggle user menu
function toggleUserMenu() {
  const menu = G('user-menu');
  if (!googleUser) { signInWithGoogle(); return; }
  menu.classList.toggle('show');
}

// Click outside to close
document.addEventListener('click', e => {
  const menu = G('user-menu');
  const btn  = G('user-avatar-btn');
  if (menu && !menu.contains(e.target) && e.target !== btn && !btn?.contains(e.target)) {
    menu.classList.remove('show');
  }
});

// ── Personalized feed from subscriptions
async function loadPersonalizedFeed() {
  if (!googleUser?.accessToken) return;
  try {
    // Get subscriptions
    const d = await apiAuth('subscriptions', {
      part: 'snippet',
      mine: 'true',
      maxResults: '50',
      order: 'relevance'
    });
    if (!d?.items?.length) return;

    const channelIds = d.items.map(item => item.snippet?.resourceId?.channelId).filter(Boolean);
    if (!channelIds.length) return;

    // Store for home personalization
    localStorage.setItem('yt_sub_channels', JSON.stringify(channelIds.slice(0, 20)));
    toast(`📺 ${channelIds.length} langganan dimuat untuk rekomendasi`);
  } catch(e) {}
}

// ── Get subscribed channel ids (cached)
function getSubChannels() {
  try {
    return JSON.parse(localStorage.getItem('yt_sub_channels') || '[]');
  } catch(e) { return []; }
}

// GIS library loaded callback
function onGISLoaded() {
  window.dispatchEvent(new Event('gis-loaded'));
}
