const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());

const CLIENT_ID = "6e405988d72e4a5798f9f04aeb033ea3";
const CLIENT_SECRET = "21d4c18237d64e2a8e5a8a229356fe16";

let token = "";
let tokenExpiresAt = 0;

async function getAccessToken() {
  const now = Date.now();
  if (token && tokenExpiresAt > now) return token;

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
  return token;
}

// Route: Search tracks (basic results only)
app.get("/search", async (req, res) => {
  const q = req.query.q;
  const accessToken = await getAccessToken();

  try {
    const response = await axios.get(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=50`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    res.json(response.data.tracks.items);
  } catch (err) {
    console.error("Search route failed:", err.message);
    res.status(500).json({ error: "Search failed" });
  }
});

// ✅ Route: Get genre for a specific artist
app.get("/genre/:artistId", async (req, res) => {
  const { artistId } = req.params;
  const accessToken = await getAccessToken();

  try {
    const response = await axios.get(
      `https://api.spotify.com/v1/artists/${artistId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const genres = response.data.genres;
    const genre = genres.length > 0 ? genres[0] : "Unknown";
    res.json({ genre });
  } catch (err) {
    console.error("Failed to fetch artist genre:", err.message);
    res.status(500).json({ error: "Failed to fetch genre" });
  }
});

const cheerio = require("cheerio");

// ✅ Route: Get mood features from Musicstax (server-side scrape)
app.get("/musicstax/:slug/:trackId", async (req, res) => {
  const { slug, trackId } = req.params;

  try {
    const response = await axios.get(`https://musicstax.com/track/${slug}/${trackId}`, {
      headers: { "User-Agent": "Mozilla/5.0" } // act like a browser
    });

    const $ = cheerio.load(response.data);

    // Helper to find the next <div> after a label
    const getVal = (label) => {
      const el = $(`div:contains("${label}")`).next("div").text().trim();
      return el || null;
    };

    const features = {
      energy: getVal("Energy"),
      danceability: getVal("Danceability"),
      happiness: getVal("Valence"),
      acousticness: getVal("Acousticness"),
      instrumentalness: getVal("Instrumentalness"),
      speechiness: getVal("Speechiness"),
    };

    res.json(features);
  } catch (err) {
    console.error("❌ Failed to fetch from Musicstax:", err.message);
    res.status(500).json({ error: "Failed to fetch Musicstax data" });
  }
});

app.listen(3000, () => {
  console.log("✅ Server running on port 3000");
});
