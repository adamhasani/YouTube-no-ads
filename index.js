const express = require('express');
const ytSearch = require('yt-search');
const path = require('path');

const app = express();

// Nyuruh Express buat ngebaca folder 'public' sebagai tempat nyimpen file HTML/UI
app.use(express.static('public'));

// API buat nyari videonya
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "Isi pencariannya dulu bang!" });

    try {
        const result = await ytSearch(query);
        const videos = result.videos.slice(0, 12).map(vid => ({
            title: vid.title,
            videoId: vid.videoId,
            thumbnail: vid.thumbnail,
            author: vid.author.name,
            duration: vid.timestamp
        }));
        res.json({ status: "sukses", data: videos });
    } catch (error) {
        res.status(500).json({ error: "Gagal nyari video" });
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`Web YouTube No-Ads jalan di port ${PORT}`);
});
