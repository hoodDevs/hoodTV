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

    // walk watch_next_feed for related videos
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
