import express from "express";
import cors from "cors";
import { Innertube } from "youtubei.js";

const app = express();
app.use(cors());
app.use(express.json());

let yt = null;
async function getYT() {
  if (!yt) {
    yt = await Innertube.create({
      cache: undefined,
      generate_session_locally: true,
    });
  }
  return yt;
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function mapVideo(v) {
  return {
    id: v.id,
    title: v.title?.text ?? v.title ?? "",
    author: v.author?.name ?? v.short_byline_text?.text ?? "",
    authorId: v.author?.id ?? "",
    duration: v.duration?.text ?? "",
    durationSeconds: v.duration?.seconds ?? 0,
    thumbnail: v.best_thumbnail?.url ?? v.thumbnails?.[0]?.url ?? "",
    views: v.view_count?.text ?? v.short_view_count?.text ?? "",
    publishedAt: v.published?.text ?? "",
  };
}

function mapMusicTrack(item) {
  const videoId = item.id || "";
  const title =
    typeof item.title === "object" ? (item.title?.text || "") : (item.title || "");
  const artistName =
    item.artists?.[0]?.name ||
    item.author?.name ||
    (typeof item.short_byline_text === "object"
      ? item.short_byline_text?.text
      : item.short_byline_text) ||
    "";
  const channelId = item.artists?.[0]?.id || item.author?.id || "";
  const albumName =
    typeof item.album === "object"
      ? item.album?.name || artistName
      : item.album || artistName;
  const durationSec =
    item.duration_seconds || item.duration?.seconds || 0;
  const thumbnail =
    item.thumbnail?.contents?.[0]?.url ||
    item.thumbnails?.[0]?.url ||
    item.best_thumbnail?.url ||
    "";

  return {
    trackId: simpleHash(videoId || title),
    videoId,
    trackName: title,
    artistName,
    artistId: simpleHash(channelId || artistName),
    channelId,
    collectionName: albumName,
    collectionId: 0,
    artworkUrl100: thumbnail,
    previewUrl: videoId ? `/api/yt/music/stream?videoId=${videoId}` : null,
    trackTimeMillis: durationSec * 1000,
    primaryGenreName: "Music",
  };
}

// ─── Music endpoints ──────────────────────────────────────────────────────────

// YouTube Music search (songs)
// GET /api/yt/music/search?q=...&limit=20
app.get("/api/yt/music/search", async (req, res) => {
  try {
    const { q, limit = "20" } = req.query;
    if (!q) return res.status(400).json({ error: "q required" });
    const innertube = await getYT();
    const results = await innertube.music.search(q, { type: "song" });
    const tracks = [];
    const max = parseInt(limit, 10);
    for (const section of results.sections || []) {
      for (const item of section.contents || []) {
        if (tracks.length >= max) break;
        const mapped = mapMusicTrack(item);
        if (mapped.videoId) tracks.push(mapped);
      }
      if (tracks.length >= max) break;
    }
    res.json({ tracks });
  } catch (err) {
    console.error("/api/yt/music/search error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Stream audio for a YouTube videoId (proxied to avoid CORS)
// GET /api/yt/music/stream?videoId=xxx
app.get("/api/yt/music/stream", async (req, res) => {
  try {
    const { videoId } = req.query;
    if (!videoId) return res.status(400).json({ error: "videoId required" });

    const innertube = await getYT();
    const info = await innertube.getInfo(videoId);

    res.setHeader("Content-Type", "audio/mp4");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Transfer-Encoding", "chunked");

    const stream = await info.download({ type: "audio", quality: "best", format: "any" });
    for await (const chunk of stream) {
      if (!res.writableEnded) res.write(chunk);
    }
    if (!res.writableEnded) res.end();
  } catch (err) {
    console.error("/api/yt/music/stream error:", err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ─── Video endpoints ───────────────────────────────────────────────────────────

// Browse / search music videos
// GET /api/yt/videos?q=...&limit=24
app.get("/api/yt/videos", async (req, res) => {
  try {
    const { q, limit = "24" } = req.query;
    const query = q?.trim() || "official music video 2024";
    const innertube = await getYT();
    const results = await innertube.search(query, { type: "video" });
    const videos = (results.videos || [])
      .filter((v) => v.type === "Video" && v.id)
      .slice(0, parseInt(limit, 10))
      .map(mapVideo);
    res.json({ query, videos });
  } catch (err) {
    console.error("/api/yt/videos error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Full video info + related videos
// GET /api/yt/info/:videoId
app.get("/api/yt/info/:videoId", async (req, res) => {
  try {
    const { videoId } = req.params;
    const innertube = await getYT();
    const info = await innertube.getInfo(videoId);

    const basic = info.basic_info ?? {};
    const related = [];
    const feed = info.watch_next_feed ?? [];
    for (const item of feed) {
      if ((item.type === "CompactVideo" || item.type === "Video") && item.id && related.length < 20) {
        related.push({
          id: item.id,
          title: item.title?.text ?? "",
          author: item.author?.name ?? item.short_byline_text?.text ?? "",
          duration: item.duration?.text ?? "",
          thumbnail: item.best_thumbnail?.url ?? item.thumbnails?.[0]?.url ?? "",
          views: item.view_count?.text ?? item.short_view_count?.text ?? "",
          publishedAt: item.published?.text ?? "",
        });
      }
    }

    res.json({
      id: videoId,
      title: basic.title ?? "",
      author: basic.channel?.name ?? basic.author ?? "",
      authorId: basic.channel?.id ?? "",
      views: basic.view_count ? `${basic.view_count.toLocaleString()} views` : "",
      publishedAt: basic.start_timestamp ?? "",
      description: basic.short_description ?? "",
      keywords: basic.keywords ?? [],
      thumbnail: basic.thumbnail?.[0]?.url ?? "",
      duration: basic.duration ?? 0,
      related,
    });
  } catch (err) {
    console.error("/api/yt/info error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Search for music video (used by TrackRow MV button)
// GET /api/yt/search?title=...&type=music|tv|movie
app.get("/api/yt/search", async (req, res) => {
  try {
    const { title, type, year, season, episode } = req.query;
    if (!title) return res.status(400).json({ error: "title required" });

    let query;
    if (type === "music") {
      query = `${title} official music video`;
    } else if (type === "tv" && season && episode) {
      query = `${title} season ${season} episode ${episode} full episode`;
    } else {
      query = `${title}${year ? ` ${year}` : ""} full movie`;
    }

    const innertube = await getYT();
    const results = await innertube.search(query, { type: "video" });
    const videos = (results.videos || [])
      .filter((v) => v.type === "Video" && v.id)
      .slice(0, 8)
      .map(mapVideo);

    res.json({ query, videos });
  } catch (err) {
    console.error("/api/yt/search error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get("/api/yt/health", (_req, res) => {
  res.json({ status: "ok", yt_ready: yt !== null });
});

const port = parseInt(process.env.PORT ?? "8099");
app.listen(port, "0.0.0.0", () => {
  console.log(`[yt-service] listening on port ${port}`);
  getYT().then(() => console.log("[yt-service] InnerTube ready")).catch(console.error);
});
