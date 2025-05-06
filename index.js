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

// Route: Search tracks and get basic data + genre
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

    const tracks = response.data.tracks.items;

    // Add genre from the first artist
    const enrichedTracks = await Promise.all(
      tracks.map(async (track) => {
        const artistId = track.artists[0]?.id;
        let genre = "Unknown";

        try {
          const artistRes = await axios.get(
            `https://api.spotify.com/v1/artists/${artistId}`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );
          genre = artistRes.data.genres[0] || "Unknown";
        } catch (err) {
          console.warn("Error fetching genre for artist:", err.message);
        }

        return {
          ...track,
          genre,
        };
      })
    );

    res.json(enrichedTracks);
  } catch (err) {
    console.error("Search route failed:", err.message);
    res.status(500).json({ error: "Search failed" });
  }
});

// Route: Fetch audio features after user selects a track
app.get("/audio-features/:trackId", async (req, res) => {
  const { trackId } = req.params;
  const accessToken = await getAccessToken();

  console.log("Track ID:", trackId);
  console.log("Access token:", accessToken); // <-- log the token

  try {
    const response = await axios.get(
      `https://api.spotify.com/v1/audio-features/${trackId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`, // make sure this line runs
        },
      }
    );
    res.json(response.data);
  } catch (err) {
    console.error("Spotify error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch audio features" });
  }
});

app.listen(3000, () => {
  console.log("✅ Server running on port 3000");
});

