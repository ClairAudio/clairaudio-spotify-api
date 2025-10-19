// ─────────────────────────────────────────────────────────────────────────────
// ClairAudio Spotify Proxy API
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());

// ⚠️ For security, move these to Render Environment Variables later:
// In Render dashboard → Environment → add:
// SPOTIFY_CLIENT_ID=xxxxx
// SPOTIFY_CLIENT_SECRET=xxxxx
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "6e405988d72e4a5798f9f04aeb033ea3";
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "21d4c18237d64e2a8e5a8a229356fe16";

let token = "";
let tokenExpiresAt = 0;

// ─── FUNCTION: GET ACCESS TOKEN ──────────────────────────────────────────────
async function getAccessToken() {
  const now = Date.now();
  if (token && tokenExpiresAt > now) return token;

  try {
    const res = await axios.post(
      "https://accounts.spotify.com/api/token",
      "grant_type=client_credentials",
      {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(CLIENT_ID + ":" + CLIENT_SECRET).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    token = res.data.access_token;
    tokenExpiresAt = now + res.data.expires_in * 1000;
    console.log("🔑 Refreshed Spotify token");
    return token;
  } catch (err) {
    console.error("❌ Failed to get Spotify token:", err.message);
    throw err;
  }
}

// ─── ROUTE: SEARCH TRACKS ────────────────────────────────────────────────────
// Example: /search?q=chuttak chuttak
app.get("/search", async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: "Missing query parameter 'q'" });

  try {
    const accessToken = await getAccessToken();
    const response = await axios.get(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    res.json(response.data.tracks.items);
  } catch (err) {
    console.error("❌ Search route failed:", err.message);
    res.status(500).json({ error: "Search failed" });
  }
});

// ─── ROUTE: GET GENRE FOR ARTIST ─────────────────────────────────────────────
// Example: /genre/1Xyo4u8uXC1ZmMpatF05PJ
app.get("/genre/:artistId", async (req, res) => {
  const { artistId } = req.params;

  try {
    const accessToken = await getAccessToken();
    const response = await axios.get(
      `https://api.spotify.com/v1/artists/${artistId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const genres = response.data.genres;
    const genre = genres.length > 0 ? genres[0] : "Unknown";
    res.json({ genre });
  } catch (err) {
    console.error("❌ Failed to fetch artist genre:", err.message);
    res.status(500).json({ error: "Failed to fetch genre" });
  }
});

// ─── ROUTE: GET AUDIO FEATURES (ENERGY, DANCEABILITY, ETC.) ──────────────────
// Example: /audio-features/14lYDJ67Kuf1kioFTA4E8Z
app.get("/audio-features/:trackId", async (req, res) => {
  const { trackId } = req.params;

  try {
    const accessToken = await getAccessToken();
    const response = await axios.get(
      `https://api.spotify.com/v1/audio-features/${trackId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const data = response.data;
    res.json({
      energy: data.energy,
      danceability: data.danceability,
      happiness: data.valence, // renamed valence → happiness
      acousticness: data.acousticness,
      instrumentalness: data.instrumentalness,
      speechiness: data.speechiness,
    });
  } catch (err) {
    console.error("❌ Failed to fetch audio features:", err.message);
    res.status(500).json({ error: "Failed to fetch audio features" });
  }
});

// ─── ROOT ROUTE (OPTIONAL) ───────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("✅ ClairAudio Spotify API is running");
});

// ─── START SERVER ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

