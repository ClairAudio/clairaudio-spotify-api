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

app.get("/search", async (req, res) => {
  const q = req.query.q;
  const accessToken = await getAccessToken();

  const response = await axios.get(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=50`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const tracks = response.data.tracks.items;

  const enrichedTracks = await Promise.all(
    tracks.map(async (track) => {
      const artistId = track.artists[0]?.id;
      let genre = "Unknown";
      let audioFeatures = null;

      try {
        // Get genre from artist
        const artistRes = await axios.get(
          `https://api.spotify.com/v1/artists/${artistId}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        genre = artistRes.data.genres[0] || "Unknown";
      } catch (err) {
        genre = "Unknown";
      }

      try {
        // Get audio features for the track
        const audioRes = await axios.get(
          `https://api.spotify.com/v1/audio-features/${track.id}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        audioFeatures = audioRes.data;
      } catch (err) {
        audioFeatures = null;
      }

      return {
        ...track,
        genre,
        audioFeatures,
      };
    })
  );

  res.json(enrichedTracks);
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});

