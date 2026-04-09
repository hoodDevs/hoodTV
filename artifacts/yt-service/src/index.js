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

// Search YouTube for a movie or TV episode and return matching video candidates
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
      .map((v) => ({
        id: v.id,
        title: v.title?.text ?? "",
        author: v.author?.name ?? "",
        duration: v.duration?.text ?? "",
        thumbnail: v.best_thumbnail?.url ?? "",
        views: v.view_count?.text ?? "",
      }));

    res.json({ query, videos });
  } catch (err) {
    console.error("/api/yt/search error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get stream URLs for a specific video ID
app.get("/api/yt/stream/:videoId", async (req, res) => {
  try {
    const { videoId } = req.params;
    if (!videoId) return res.status(400).json({ error: "videoId required" });

    const innertube = await getYT();
    const info = await innertube.getBasicInfo(videoId, "WEB");

    if (!info.streaming_data) {
      return res.status(404).json({ error: "No streaming data available" });
    }

    // Combined formats (video + audio in one stream, max 720p)
    const combined = (info.streaming_data.formats ?? [])
      .filter((f) => f.url && f.mime_type?.startsWith("video/"))
      .sort((a, b) => (b.quality_label?.includes("720") ? 1 : 0) - (a.quality_label?.includes("720") ? 1 : 0));

    // Adaptive video-only for high-res reference
    const adaptive = (info.streaming_data.adaptive_formats ?? [])
      .filter((f) => f.url && f.mime_type?.startsWith("video/mp4") && f.audio_quality === undefined)
      .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));

    const formats = combined.map((f) => ({
      url: f.url,
      quality: f.quality_label ?? f.quality ?? "unknown",
      mime_type: f.mime_type,
      has_audio: true,
      itag: f.itag,
    }));

    if (formats.length === 0) {
      return res.status(404).json({ error: "No usable stream formats found" });
    }

    const title = info.basic_info?.title ?? "";
    const author = info.basic_info?.channel?.name ?? "";
    const thumbnail = info.basic_info?.thumbnail?.[0]?.url ?? "";

    res.json({ videoId, title, author, thumbnail, formats });
  } catch (err) {
    console.error("/api/yt/stream error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get("/api/yt/health", (_req, res) => {
  res.json({ status: "ok", yt_ready: yt !== null });
});

const port = parseInt(process.env.PORT ?? "8070");
app.listen(port, "0.0.0.0", () => {
  console.log(`[yt-service] listening on port ${port}`);
  // Warm up InnerTube connection in background
  getYT().then(() => console.log("[yt-service] InnerTube ready")).catch(console.error);
});
