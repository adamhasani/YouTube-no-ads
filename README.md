# YourTube v2

YouTube tanpa iklan — direfaktor menjadi beberapa file.

## Struktur File

```
/
├── index.html          ← HTML utama (lean, ~36KB)
├── css/
│   └── styles.css      ← Semua CSS (~33KB)
├── js/
│   ├── utils.js        ← State global + helper functions
│   ├── api.js          ← YouTube API, RSS, FAA fallback, Shorts fetch
│   ├── auth.js         ← Google OAuth login (GIS)
│   ├── player.js       ← YT IFrame player, antrian, loop, sleep timer
│   ├── shorts.js       ← Shorts full-screen player
│   ├── ui.js           ← Cards, halaman, playlist, history, settings
│   └── app.js          ← Routing + sidebar + init
├── api/
│   ├── youtube.js      ← Proxy API YouTube (Vercel serverless)
│   └── config.js       ← Return GOOGLE_CLIENT_ID ke frontend
├── sw.js               ← Service Worker (PWA)
├── manifest.json       ← PWA manifest
└── vercel.json         ← Vercel routing config
```

## Setup

### 1. Environment Variables di Vercel
```
YOUTUBE_API_KEY=AIza...           # Wajib
YOUTUBE_API_KEY_1=AIza...         # Opsional (rotasi)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com  # Untuk login Google
```

### 2. Setup Google OAuth (untuk Login Google)
1. Buka [Google Cloud Console](https://console.cloud.google.com)
2. Buat/pilih project → APIs & Services → Credentials
3. Buat OAuth 2.0 Client ID (Web application)
4. Tambahkan domain Vercel ke "Authorized JavaScript origins"
   - `https://yourdomain.vercel.app`
5. Copy Client ID → set sebagai `GOOGLE_CLIENT_ID` di Vercel

### 3. Deploy ke Vercel
```bash
vercel deploy
```

## Fitur Baru v2

### Login Google
- Tombol **Masuk** di navbar kanan
- Setelah login, beranda otomatis menampilkan video dari channel yang kamu subscribe
- Algoritma rekomendasi berdasarkan riwayat langganan YouTube asli

### Shorts Full-Screen (Diperbaiki)
- Layout persis seperti YouTube Shorts — video 9:16 full-height
- **FIX**: Video sebelumnya langsung berhenti saat scroll ke video berikutnya (tidak ada tabrakan suara)
- Right sidebar: Like, Komentar, Share, Antrian, Lainnya
- Progress bar di atas layar
- Navigasi panah atas/bawah
- 6 kategori: Viral, Gaming, Musik, Lucu, Masak, Travel
- Infinite scroll otomatis

### Performa
- CSS terpisah → browser cache efisien
- JS terpisah per modul → load paralel
- Kode lebih mudah dimaintain
