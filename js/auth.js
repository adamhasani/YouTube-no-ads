// ════════════════════════════════════════
// auth.js — Google OAuth 2.0 via GIS
// ════════════════════════════════════════

let gisClient = null;
let googleClientId = null;
let googleUser = null; // <--- FIX: Deklarasi di sini biar nggak ReferenceError

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
    const loginBtn = G('google-login-btn');
    if(loginBtn) loginBtn.style.display = 'none';
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
      name:        profile.name        || profile.email,
      email:       profile.email       || '',
      picture:     profile.picture     || '',
      accessToken: accessToken,
    };

    localStorage.setItem('yt_google_user', JSON.stringify(googleUser));
    
    // Simpan token terpisah buat dipake sama Shorts
    localStorage.setItem('yt_access_token', accessToken); 

    renderUserBtn();
    toast(`✅ Masuk sebagai ${googleUser.name}`);

    // Reload home with personalized content
    await loadPersonalizedFeed();
    
    // Refresh halaman kalau lagi di beranda biar videonya langsung ganti
    if(typeof loadCat === 'function') loadCat(''); 

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
  if (googleUser && googleUser.accessToken) {
    try { google.accounts.oauth2.revoke(googleUser.accessToken); } catch(e) {}
  }
  googleUser = null;
  localStorage.removeItem('yt_google_user');
  localStorage.removeItem('yt_access_token');
  localStorage.removeItem('yt_sub_channels');
  
  renderUserBtn();
  G('user-menu').classList.remove('show');
  toast('👋 Keluar dari akun Google');
  
  // Refresh balik ke tren umum
  if(typeof loadCat === 'function') loadCat('');
}

// ── Render user/login button in navbar & settings
function renderUserBtn() {
  const loginBtn  = G('google-login-btn');
  const avatarBtn = G('user-avatar-btn');
  const mobileLoginSetting = G('mobile-login-setting'); // <-- Elemen di Pengaturan

  if (googleUser) {
    // --- UI Navbar ---
    if(loginBtn) loginBtn.style.display  = 'none';
    if(avatarBtn) {
      avatarBtn.style.display = 'flex';
      if (googleUser.picture) {
        avatarBtn.innerHTML = `<img src="${googleUser.picture}" alt="${esc(googleUser.name)}" onerror="this.parentElement.textContent='${(googleUser.name || 'U')[0].toUpperCase()}'"/>`;
      } else {
        avatarBtn.textContent = (googleUser.name || 'U')[0].toUpperCase();
      }
    }

    // --- UI User Menu Header ---
    const hdr = G('user-menu-header-info');
    if (hdr) {
      hdr.querySelector('.uname').textContent = googleUser.name || '';
      hdr.querySelector('.uemail').textContent = googleUser.email || '';
    }
    
    // --- UI Pengaturan (Mobile) ---
    if (mobileLoginSetting) {
      mobileLoginSetting.innerHTML = `
        <div>
          <div class="setting-label">👤 ${esc(googleUser.name)}</div>
          <div class="setting-sub">${esc(googleUser.email)}</div>
        </div>
        <button class="mbtn" onclick="signOutGoogle(); G('settings-modal').classList.remove('show')" style="font-size:13px;padding:8px 14px;background:var(--surface3);color:#ef9a9a;">
          Keluar
        </button>
      `;
    }

  } else {
    // --- Reset UI Navbar ---
    if(loginBtn) loginBtn.style.display  = 'flex';
    if(avatarBtn) avatarBtn.style.display = 'none';
    
    // --- Reset UI Pengaturan (Mobile) ---
    if (mobileLoginSetting) {
      mobileLoginSetting.innerHTML = `
        <div>
          <div class="setting-label">👤 Akun Google</div>
          <div class="setting-sub">Masuk untuk simpan riwayat & playlist</div>
        </div>
        <button class="mbtn" onclick="signInWithGoogle(); G('settings-modal').classList.remove('show')" style="font-size:13px;padding:8px 14px;background:#4285F4;display:flex;align-items:center;gap:6px;">
          <svg width="16" height="16" viewBox="0 0 24 24" style="background:#fff;border-radius:50%;padding:2px"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Masuk
        </button>
      `;
    }
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
  const btn  = G('user-avatar-btn');
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

// ── Bantuan fungsi buat dipanggil di shorts.js
function getAuthToken() {
  if (typeof googleUser !== 'undefined' && googleUser && googleUser.accessToken) {
    return googleUser.accessToken;
  }
  return localStorage.getItem('yt_access_token');
}

// GIS library loaded callback
function onGISLoaded() {
  window.dispatchEvent(new Event('gis-loaded'));
}
