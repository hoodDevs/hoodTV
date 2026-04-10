/**
 * YouTube Music Service — powered by YouTube.js (youtubei.js)
 *
 * Architecture:
 *  • Platform.load() provides Node.js vm-based JS evaluator for URL deciphering
 *  • Single long-lived Innertube instance (lazy-initialized, singleton)
 *  • TrackInfo cache (5 min TTL) to avoid repeated YT API calls per stream
 *  • All streaming uses TrackInfo.download() — no yt-dlp required
 *  • Rich YTMusic endpoints: home, explore, lyrics, up-next, search (all types), artist, album
 */

import express from "express";
import cors from "cors";
import { Innertube, Platform } from "youtubei.js";
import vm from "vm";
import crypto from "crypto";

// ─── Node.js Platform Shim ────────────────────────────────────────────────────
//
// YouTube.js needs a runtime shim to evaluate YouTube's player JS (for URL
// deciphering). We use Node's vm module to run the extracted script safely.

Platform.load({
  runtime: "node",
  server: true,

  async sha1Hash(data) {
    return crypto.createHash("sha1").update(data).digest("hex");
  },

  uuidv4() {
    return crypto.randomUUID();
  },

  /**
   * Run the extracted player script (BuildScriptResult) in a sandboxed vm.
   * The script may contain top-level return statements, so we wrap it in an
   * IIFE, passing env vars as arguments.
   */
  eval(buildResult, env) {
    const keys = Object.keys(env);
    const vals = keys.map((k) => env[k]);
    // Wrap in IIFE so top-level `return` is legal
    const fn = `(function(${keys.join(",")}) { ${buildResult.output} })`;
    const result = vm.runInNewContext(fn, {})(
      ...vals.map((v) => (v === undefined ? undefined : v))
    );
    if (typeof result === "object" && result !== null) return result;
    // Fallback: variables may have been set directly on the context
    return Object.fromEntries(buildResult.exported.map((n) => [n, undefined]));
  },

  fetch: globalThis.fetch,
  Request: globalThis.Request,
  Response: globalThis.Response,
  Headers: globalThis.Headers,
  FormData: globalThis.FormData,
  File: globalThis.File,
  ReadableStream: globalThis.ReadableStream,
  CustomEvent: globalThis.CustomEvent,

  // No persistent cache needed for the server
  Cache: class NoCache {
    get() {}
    set() {}
    remove() {}
  },
});

// ─── Innertube Singleton ───────────────────────────────────────────────────────

let _yt = null;

async function getYT() {
  if (!_yt) {
    // retrieve_player: true fetches YouTube's player JS so we can decipher URLs
    _yt = await Innertube.create({ retrieve_player: true });
    console.log("[yt-service] Innertube ready (player loaded)");
  }
  return _yt;
}

// ─── TrackInfo Cache ──────────────────────────────────────────────────────────
//
// TrackInfo/VideoInfo caches:
//  TRACK_CACHE — music metadata, 5-min TTL (info only, no format URLs)
//  VIDEO_CACHE — VideoInfo for /info and /stream, 30-sec TTL
//    30s is long enough for a browser's multi-range playback requests to reuse
//    the same format URL, but short enough that format URLs are refreshed for
//    each new playback session.

const TRACK_CACHE = new Map(); // videoId → { trackInfo, expiresAt }
const VIDEO_CACHE = new Map(); // videoId → { videoInfo, expiresAt }
const TRACK_TTL_MS = 5 * 60 * 1000;
const VIDEO_TTL_MS = 30 * 1000; // 30 seconds

async function getTrackInfo(videoId) {
  const now = Date.now();
  const cached = TRACK_CACHE.get(videoId);
  if (cached && cached.expiresAt > now) return cached.trackInfo;
  const yt = await getYT();
  const trackInfo = await yt.music.getInfo(videoId);
  TRACK_CACHE.set(videoId, { trackInfo, expiresAt: now + TRACK_TTL_MS });
  return trackInfo;
}

/**
 * Get regular YouTube VideoInfo (not music-focused) — has proper muxed video formats.
 * Used for video streaming (/video/stream) and metadata (/info/:videoId).
 */
async function getVideoInfo(videoId) {
  const now = Date.now();
  const cached = VIDEO_CACHE.get(videoId);
  if (cached && cached.expiresAt > now) return cached.videoInfo;
  const yt = await getYT();
  const videoInfo = await yt.getInfo(videoId);
  VIDEO_CACHE.set(videoId, { videoInfo, expiresAt: now + VIDEO_TTL_MS });
  return videoInfo;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Map a MusicResponsiveListItem / MusicTwoRowItem / compact video to a track */
function mapMusicTrack(item) {
  const videoId = item.id || item.video_id || "";
  const title =
    typeof item.title === "object"
      ? item.title?.text || item.title?.runs?.[0]?.text || ""
      : item.title || "";
  const artistName =
    item.artists?.[0]?.name ||
    item.author?.name ||
    (typeof item.short_byline_text === "object"
      ? item.short_byline_text?.text
      : item.short_byline_text) ||
    "";
  const channelId =
    item.artists?.[0]?.id || item.author?.id || item.channel_id || "";
  const albumName =
    typeof item.album === "object"
      ? item.album?.name || ""
      : item.album || "";
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
    artworkUrl100: thumbnail,
    previewUrl: videoId ? `/api/yt/music/stream?videoId=${videoId}` : null,
    trackTimeMillis: durationSec * 1000,
    primaryGenreName: "Music",
  };
}

/** Map a MusicCarouselShelf to a section with tracks */
function mapCarouselSection(shelf) {
  const title =
    typeof shelf.header?.title === "object"
      ? shelf.header?.title?.text || shelf.header?.title?.runs?.[0]?.text || ""
      : shelf.header?.title || "";
  const items = [];
  for (const item of shelf.contents || []) {
    const mapped = mapMusicTrack(item);
    if (mapped.videoId) items.push(mapped);
  }
  return { title, items };
}

/** Stream a ReadableStream<Uint8Array> into an Express response */
async function pipeReadableStream(readable, res) {
  const reader = readable.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done || res.writableEnded) break;
      res.write(value);
    }
  } finally {
    reader.releaseLock();
    if (!res.writableEnded) res.end();
  }
}

// ─── Express App ──────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

// ═══════════════════════════════════════════════════════════════════════════════
// MUSIC STREAMING ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/yt/music/stream?videoId=xxx
 *
 * Audio-only stream using YouTube.js native deciphering.
 * Supports Range requests for seeking.
 */
app.get("/api/yt/music/stream", async (req, res) => {
  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: "videoId required" });

  try {
    const trackInfo = await getTrackInfo(videoId);

    // Parse Range header
    const rangeHeader = req.headers["range"];
    let downloadOpts = { type: "audio", quality: "best", format: "any" };
    if (rangeHeader) {
      const [, start, end] = /bytes=(\d+)-(\d*)/.exec(rangeHeader) || [];
      if (start !== undefined) {
        downloadOpts.range = {
          start: parseInt(start, 10),
          end: end ? parseInt(end, 10) : undefined,
        };
      }
    }

    const stream = await trackInfo.download(downloadOpts);

    // Determine content type from available formats
    const sd = trackInfo.streaming_data;
    const audioFmt = (sd?.adaptive_formats || []).find(
      (f) => f.has_audio && !f.has_video
    );
    const mimeType = audioFmt?.mime_type?.split(";")[0] || "audio/mp4";

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store");
    res.status(rangeHeader ? 206 : 200);

    await pipeReadableStream(stream, res);
  } catch (err) {
    console.error("[stream/audio] error:", err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/yt/video/stream?videoId=xxx
 *
 * Muxed video+audio stream (itag 22 = 720p MP4, itag 18 = 360p MP4).
 *
 * Uses yt.getInfo() for proper muxed format metadata, then proxies the
 * deciphered format URL directly via fetch() with YouTube-compatible headers.
 * This bypasses YouTube.js's download() which can fail on server IPs.
 *
 * Sets Content-Range + Content-Length on all Range responses for proper
 * browser <video> seeking and duration detection.
 */
app.get("/api/yt/video/stream", async (req, res) => {
  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: "videoId required" });

  try {
    const yt = await getYT();
    // Use a short-lived cache (30s) so multiple range requests within the same
    // playback session reuse the same VideoInfo and format URL, which is what
    // YouTube's CDN expects (same URL, sequential range requests).
    const info = await getVideoInfo(videoId);

    const sd = info.streaming_data;
    const muxedFormats = sd?.formats || [];

    // Prefer 720p muxed, fall back to 360p muxed
    const fmt = muxedFormats.find((f) => f.itag === 22)
             || muxedFormats.find((f) => f.itag === 18);

    if (!fmt) {
      console.error(`[stream/video] no muxed format for ${videoId}. Available itags: ${muxedFormats.map(f=>f.itag).join(',')}`);
      return res.status(404).json({ error: "No muxed video format available for this video" });
    }

    const totalLength = fmt.content_length ? parseInt(fmt.content_length, 10) : null;
    const rangeHeader = req.headers["range"];

    // Parse range header to pass as options to download()
    let rangeStart = 0;
    let rangeEnd = totalLength !== null ? totalLength - 1 : undefined;

    if (rangeHeader) {
      const m = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
      rangeStart = m ? parseInt(m[1], 10) : 0;
      if (m && m[2]) rangeEnd = parseInt(m[2], 10);
    }

    // YouTube.js's range-based download path (using &range= URL param) is
    // what actually works from server IPs — the full-download path (no range)
    // gets 403. Always pass a range to force the range-based code path.
    const downloadOpts = {
      itag: fmt.itag,
      range: { start: rangeStart, end: rangeEnd },
    };

    // Try download — if it fails (stale cached URL), clear cache and retry once.
    let stream;
    try {
      stream = await info.download(downloadOpts);
    } catch (dlErr) {
      if (dlErr.message?.includes("non 2xx")) {
        VIDEO_CACHE.delete(videoId);
        const freshInfo = await getVideoInfo(videoId);
        stream = await freshInfo.download(downloadOpts);
      } else {
        throw dlErr;
      }
    }

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store");

    if (rangeHeader && totalLength !== null && rangeEnd !== undefined) {
      res.setHeader("Content-Range", `bytes ${rangeStart}-${rangeEnd}/${totalLength}`);
      res.setHeader("Content-Length", rangeEnd - rangeStart + 1);
      res.status(206);
    } else if (totalLength !== null) {
      res.setHeader("Content-Length", totalLength);
      res.status(200);
    } else {
      res.status(200);
    }

    await pipeReadableStream(stream, res);
  } catch (err) {
    console.error("[stream/video] error:", err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// YTMUSIC DATA ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/yt/music/home
 *
 * YouTube Music home feed — curated shelves (Hot, New Releases, etc.)
 * Response: { sections: [{ title, items: Track[] }] }
 */
app.get("/api/yt/music/home", async (req, res) => {
  try {
    const yt = await getYT();
    const home = await yt.music.getHomeFeed();
    const sections = [];
    for (const shelf of home.sections || []) {
      if (shelf.type === "MusicCarouselShelf") {
        const section = mapCarouselSection(shelf);
        if (section.items.length > 0) sections.push(section);
      }
    }
    res.json({ sections, filters: home.filters || [] });
  } catch (err) {
    console.error("[music/home] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/yt/music/explore
 *
 * YouTube Music explore page — trending, new releases, charts.
 * Response: { sections: [{ title, items: Track[] }] }
 */
app.get("/api/yt/music/explore", async (req, res) => {
  try {
    const yt = await getYT();
    const explore = await yt.music.getExplore();
    const sections = [];
    for (const shelf of explore.sections || []) {
      if (shelf.type === "MusicCarouselShelf") {
        const section = mapCarouselSection(shelf);
        if (section.items.length > 0) sections.push(section);
      }
    }
    res.json({ sections });
  } catch (err) {
    console.error("[music/explore] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/yt/music/search?q=...&type=song|video|album|artist|playlist&limit=20
 *
 * YouTube Music search. type defaults to "song".
 * Response: { tracks } or { albums } or { artists } depending on type.
 */
app.get("/api/yt/music/search", async (req, res) => {
  const { q, type = "song", limit = "20" } = req.query;
  if (!q) return res.status(400).json({ error: "q required" });

  try {
    const yt = await getYT();
    const max = parseInt(limit, 10);

    const filterMap = {
      song: "song",
      video: "video",
      album: "album",
      artist: "artist",
      playlist: "community_playlist",
      featured: "featured_playlist",
    };
    const filter = filterMap[type] || "song";

    const results = await yt.music.search(q, { type: filter });

    if (type === "artist") {
      const artists = [];
      for (const section of results.sections || []) {
        for (const item of section.contents || []) {
          if (artists.length >= max) break;
          const name = typeof item.name === "object" ? item.name?.text : item.name;
          const id = item.id || item.channel_id || "";
          const thumb = item.thumbnail?.contents?.[0]?.url || "";
          if (name) artists.push({ id, artistId: simpleHash(id || name), name, thumbnail: thumb });
        }
      }
      return res.json({ artists });
    }

    if (type === "album") {
      const albums = [];
      for (const section of results.sections || []) {
        for (const item of section.contents || []) {
          if (albums.length >= max) break;
          const title = typeof item.title === "object" ? item.title?.text : item.title;
          const artist = item.artists?.[0]?.name || "";
          const browseId = item.id || "";
          const thumb = item.thumbnail?.contents?.[0]?.url || "";
          if (title) albums.push({ browseId, title, artist, thumbnail: thumb });
        }
      }
      return res.json({ albums });
    }

    // Default: song / video tracks
    const tracks = [];
    // Try named shelf accessors first
    const shelf = type === "video" ? results.videos : results.songs;
    const sources = shelf ? shelf.contents : (results.sections?.flatMap(s => s.contents || []) || []);
    for (const item of sources) {
      if (tracks.length >= max) break;
      const mapped = mapMusicTrack(item);
      if (mapped.videoId) tracks.push(mapped);
    }
    res.json({ tracks });
  } catch (err) {
    console.error("[music/search] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/yt/music/suggestions?q=...
 *
 * YouTube Music search autocomplete suggestions.
 * Response: { suggestions: string[] }
 */
app.get("/api/yt/music/suggestions", async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ suggestions: [] });
  try {
    const yt = await getYT();
    const sections = await yt.music.getSearchSuggestions(q);
    const suggestions = [];
    for (const section of sections || []) {
      for (const item of section.contents || []) {
        const text = item.suggestion?.text || item.query;
        if (text && !suggestions.includes(text)) suggestions.push(text);
      }
    }
    res.json({ suggestions: suggestions.slice(0, 10) });
  } catch (err) {
    console.error("[music/suggestions] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/yt/music/track/:videoId
 *
 * Full track info — title, artist, album, thumbnail, duration, lyrics URL.
 * Response: TrackDetail
 */
app.get("/api/yt/music/track/:videoId", async (req, res) => {
  const { videoId } = req.params;
  try {
    const trackInfo = await getTrackInfo(videoId);
    const bi = trackInfo.basic_info;
    const thumbnail =
      bi.thumbnail?.[0]?.url || "";
    res.json({
      videoId,
      title: bi.title || "",
      author: bi.author || bi.channel?.name || "",
      channelId: bi.channel?.id || "",
      duration: bi.duration || 0,
      thumbnail,
      description: bi.short_description || "",
      streamUrl: `/api/yt/music/stream?videoId=${videoId}`,
      videoStreamUrl: `/api/yt/video/stream?videoId=${videoId}`,
    });
  } catch (err) {
    console.error("[music/track] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/yt/music/lyrics/:videoId
 *
 * Lyrics for a track.
 * Response: { lyrics: string | null, footer: string | null }
 */
app.get("/api/yt/music/lyrics/:videoId", async (req, res) => {
  const { videoId } = req.params;
  try {
    const yt = await getYT();
    const shelf = await yt.music.getLyrics(videoId);
    if (!shelf) return res.json({ lyrics: null, footer: null });
    const lyricsText =
      shelf.description?.text ||
      shelf.description?.runs?.map((r) => r.text).join("") ||
      null;
    const footer =
      shelf.footer?.text ||
      shelf.footer?.runs?.map((r) => r.text).join("") ||
      null;
    res.json({ lyrics: lyricsText, footer });
  } catch (err) {
    console.error("[music/lyrics] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/yt/music/upnext/:videoId?automix=true
 *
 * Up next queue / radio starting from a given track.
 * Response: { queue: Track[] }
 */
app.get("/api/yt/music/upnext/:videoId", async (req, res) => {
  const { videoId } = req.params;
  const automix = req.query.automix !== "false";
  try {
    const yt = await getYT();
    const panel = await yt.music.getUpNext(videoId, automix);
    const queue = [];
    for (const item of panel.contents || []) {
      const mapped = mapMusicTrack(item);
      if (mapped.videoId && mapped.videoId !== videoId) queue.push(mapped);
    }
    res.json({ queue });
  } catch (err) {
    console.error("[music/upnext] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/yt/music/related/:videoId
 *
 * Related tracks / albums / artists after a track.
 * Response: { sections: [{ title, items: Track[] }] }
 */
app.get("/api/yt/music/related/:videoId", async (req, res) => {
  const { videoId } = req.params;
  try {
    const yt = await getYT();
    const result = await yt.music.getRelated(videoId);
    const sections = [];
    if (result && result.type !== "Message") {
      for (const shelf of result.contents || []) {
        if (shelf.type === "MusicCarouselShelf") {
          const section = mapCarouselSection(shelf);
          if (section.items.length > 0) sections.push(section);
        }
      }
    }
    res.json({ sections });
  } catch (err) {
    console.error("[music/related] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/yt/music/artist/:channelId
 *
 * Artist page — header info + songs + albums + related.
 * Response: { name, thumbnail, sections: [{ title, items }] }
 */
app.get("/api/yt/music/artist/:channelId", async (req, res) => {
  const { channelId } = req.params;
  try {
    const yt = await getYT();
    const artist = await yt.music.getArtist(channelId);

    const header = artist.header;
    const name =
      header?.title?.text ||
      header?.title ||
      "";
    const thumbnail =
      header?.thumbnail?.contents?.[0]?.url ||
      header?.thumbnail?.[0]?.url ||
      "";

    const sections = [];
    for (const shelf of artist.sections || []) {
      if (shelf.type === "MusicCarouselShelf") {
        const section = mapCarouselSection(shelf);
        if (section.items.length > 0) sections.push(section);
      } else if (shelf.type === "MusicShelf") {
        const items = [];
        for (const item of shelf.contents || []) {
          const mapped = mapMusicTrack(item);
          if (mapped.videoId) items.push(mapped);
        }
        if (items.length > 0) {
          const title = typeof shelf.title === "object" ? shelf.title?.text : shelf.title || "Songs";
          sections.push({ title, items });
        }
      }
    }
    res.json({ channelId, name, thumbnail, sections });
  } catch (err) {
    console.error("[music/artist] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/yt/music/album/:browseId
 *
 * Album page — header info + track list.
 * Response: { title, artist, thumbnail, year, tracks: Track[] }
 */
app.get("/api/yt/music/album/:browseId", async (req, res) => {
  const { browseId } = req.params;
  try {
    const yt = await getYT();
    const album = await yt.music.getAlbum(browseId);

    const header = album.header;
    const title =
      header?.title?.text ||
      header?.title ||
      "";
    const artist =
      header?.artist?.runs?.[0]?.text ||
      header?.subtitle?.runs?.[0]?.text ||
      "";
    const year =
      header?.subtitle?.runs?.slice(-1)[0]?.text || "";
    const thumbnail =
      header?.thumbnail?.contents?.[0]?.url ||
      album.background?.contents?.[0]?.url ||
      "";

    const tracks = [];
    for (const item of album.contents || []) {
      const mapped = mapMusicTrack(item);
      if (mapped.videoId) {
        // For album tracks, override the collection name
        mapped.collectionName = title;
        tracks.push(mapped);
      }
    }
    res.json({ browseId, title, artist, year, thumbnail, tracks });
  } catch (err) {
    console.error("[music/album] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/yt/music/playlist/:playlistId
 *
 * YT Music playlist tracks.
 * Response: { title, tracks: Track[] }
 */
app.get("/api/yt/music/playlist/:playlistId", async (req, res) => {
  const { playlistId } = req.params;
  try {
    const yt = await getYT();
    const playlist = await yt.music.getPlaylist(playlistId);
    const tracks = [];
    for (const item of playlist.tracks || []) {
      const mapped = mapMusicTrack(item);
      if (mapped.videoId) tracks.push(mapped);
    }
    const title =
      playlist.header?.title?.text ||
      playlist.header?.title ||
      "";
    res.json({ playlistId, title, tracks });
  } catch (err) {
    console.error("[music/playlist] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// VIDEO / GENERAL YOUTUBE ENDPOINTS (unchanged interface)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/yt/videos?q=...&limit=24
 * Browse / search music videos on standard YouTube.
 */
app.get("/api/yt/videos", async (req, res) => {
  try {
    const { q, limit = "24" } = req.query;
    const query = q?.trim() || "official music video 2024";
    const yt = await getYT();
    const results = await yt.search(query, { type: "video" });
    const videos = (results.videos || [])
      .filter((v) => v.type === "Video" && v.id)
      .slice(0, parseInt(limit, 10))
      .map(mapYtVideo);
    res.json({ query, videos });
  } catch (err) {
    console.error("[videos] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/yt/info/:videoId
 * Full video info + related videos.
 * Uses the VIDEO_CACHE so the same VideoInfo object powers both this endpoint
 * and the /video/stream endpoint without duplicate API calls.
 */
app.get("/api/yt/info/:videoId", async (req, res) => {
  try {
    const { videoId } = req.params;
    // Use cached VideoInfo (shared with video stream endpoint)
    const info = await getVideoInfo(videoId);
    const basic = info.basic_info ?? {};

    // Collect related from watch_next_feed — accept any item that has an id
    // and looks like a video (broad check to handle YouTube.js version differences)
    const related = [];
    for (const item of info.watch_next_feed ?? []) {
      if (related.length >= 20) break;
      const id = item.id ?? item.video_id;
      if (!id) continue;
      const title =
        (typeof item.title === "object" ? item.title?.text : item.title) ?? "";
      if (!title) continue;
      related.push({
        id,
        title,
        author:
          item.author?.name ??
          (typeof item.short_byline_text === "object"
            ? item.short_byline_text?.text
            : item.short_byline_text) ??
          "",
        duration: item.duration?.text ?? "",
        thumbnail:
          item.best_thumbnail?.url ??
          item.thumbnails?.[0]?.url ??
          item.thumbnail?.contents?.[0]?.url ??
          `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        views:
          item.view_count?.text ??
          item.short_view_count?.text ??
          "",
        publishedAt: item.published?.text ?? "",
      });
    }

    // If watch_next_feed gave us nothing, fall back to YT Music related tracks
    if (related.length === 0) {
      try {
        const yt = await getYT();
        const musicRelated = await yt.music.getRelated(videoId);
        for (const shelf of musicRelated?.contents ?? []) {
          if (shelf.type !== "MusicCarouselShelf") continue;
          for (const item of shelf.contents ?? []) {
            if (related.length >= 20) break;
            const id = item.id ?? item.video_id ?? "";
            if (!id) continue;
            const title =
              (typeof item.title === "object" ? item.title?.text : item.title) ?? "";
            if (!title) continue;
            related.push({
              id,
              title,
              author: item.artists?.[0]?.name ?? item.author?.name ?? "",
              duration: item.duration?.text ?? "",
              thumbnail:
                item.thumbnail?.contents?.[0]?.url ??
                item.thumbnails?.[0]?.url ??
                `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
              views: "",
              publishedAt: "",
            });
          }
          if (related.length >= 20) break;
        }
      } catch {
        // Related is non-critical — ignore errors
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
      thumbnail:
        basic.thumbnail?.[0]?.url ??
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      duration: basic.duration ?? 0,
      related,
    });
  } catch (err) {
    console.error("[info] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/yt/search?title=...&type=music|tv|movie
 * Search for music video or content by title.
 */
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
    const yt = await getYT();
    const results = await yt.search(query, { type: "video" });
    const videos = (results.videos || [])
      .filter((v) => v.type === "Video" && v.id)
      .slice(0, 8)
      .map(mapYtVideo);
    res.json({ query, videos });
  } catch (err) {
    console.error("[search] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/** Map a standard YT video search result */
function mapYtVideo(v) {
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

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get("/api/yt/health", (_req, res) => {
  res.json({
    status: "ok",
    yt_ready: _yt !== null,
    track_cache_size: TRACK_CACHE.size,
    video_cache_size: VIDEO_CACHE.size,
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const port = parseInt(process.env.PORT ?? "8099");
app.listen(port, "0.0.0.0", () => {
  console.log(`[yt-service] listening on port ${port}`);
  // Warm up Innertube on startup
  getYT()
    .then(() => console.log("[yt-service] ready"))
    .catch(console.error);
});
