import { Router, type Request, type Response } from "express";
import { Readable } from "node:stream";

const router = Router();

const GIFTED_BASE_URL = "https://movieapi.giftedtech.co.ke/api/v2";
const GIFTED_API_KEY = process.env.GIFTED_API_KEY || "";

const GIFTED_HEADERS = {
  Authorization: `Bearer ${GIFTED_API_KEY}`,
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Referer": "https://movieapi.giftedtech.co.ke/",
  "Origin": "https://movieapi.giftedtech.co.ke",
  "Accept": "*/*",
};

async function fetchGiftedSources(subjectId: string, season?: string, episode?: string) {
  let path = `/sources/${subjectId}`;
  if (season && episode) {
    path += `?season=${season}&episode=${episode}&_t=${Date.now()}`;
  } else {
    path += `?_t=${Date.now()}`;
  }
  const url = `${GIFTED_BASE_URL}${path}`;
  const res = await fetch(url, { headers: GIFTED_HEADERS });
  if (!res.ok) throw new Error(`Sources error: ${res.status}`);
  return res.json();
}

async function tryStreamCdnUrl(cdnUrl: string, clientHeaders: Record<string, string>): Promise<Response | null> {
  try {
    const r = await fetch(cdnUrl, {
      headers: {
        ...clientHeaders,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Referer": "https://movieapi.giftedtech.co.ke/",
        "Accept": "video/mp4,video/*;q=0.9,*/*;q=0.8",
      },
    });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("video") && !ct.includes("octet-stream")) return null;
    return r as unknown as Response;
  } catch {
    return null;
  }
}

async function tryGiftedDownload(cdnUrl: string, quality: string): Promise<Response | null> {
  try {
    const upstream = `${GIFTED_BASE_URL}/download?url=${encodeURIComponent(cdnUrl)}&title=video&quality=${quality}`;
    const r = await fetch(upstream, { headers: GIFTED_HEADERS });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "";
    if (ct.includes("text/html") || ct.includes("text/plain")) return null;
    const preview = await r.clone().text().catch(() => "");
    if (preview.slice(0, 100).toLowerCase().includes("<html")) return null;
    return r as unknown as Response;
  } catch {
    return null;
  }
}

async function pipeVideoResponse(upstreamRes: any, res: Response, quality: string, isDownload: boolean) {
  res.status(200);
  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "no-cache");

  if (isDownload) {
    res.setHeader("Content-Disposition", `attachment; filename="video-${quality}.mp4"`);
  }

  const cl = upstreamRes.headers?.get?.("content-length");
  if (cl) res.setHeader("Content-Length", cl);

  if (!upstreamRes.body) {
    res.end();
    return;
  }

  const nodeStream = Readable.fromWeb(upstreamRes.body as any);
  nodeStream.pipe(res);
  res.on("close", () => nodeStream.destroy());
  res.on("error", () => nodeStream.destroy());
}

async function handleStreamBySubjectId(req: Request, res: Response) {
  const subjectId = req.query.subjectId as string;
  const quality = (req.query.quality as string) || "360";
  const season = req.query.season as string | undefined;
  const episode = req.query.episode as string | undefined;
  const isDownload = req.query.download === "1";

  if (!subjectId) {
    res.status(400).json({ error: "Missing subjectId parameter" });
    return;
  }

  try {
    const data = await fetchGiftedSources(subjectId, season, episode);
    const arr: any[] = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

    if (arr.length === 0) {
      res.status(503).json({ error: "No sources available" });
      return;
    }

    const qualityOrder = ["1080p", "720p", "480p", "360p"];
    const targetQuality = quality.endsWith("p") ? quality : `${quality}p`;
    const sorted = [...arr].sort((a, b) => {
      const ai = qualityOrder.indexOf(a.quality);
      const bi = qualityOrder.indexOf(b.quality);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    const preferred = sorted.find((s) => s.quality === targetQuality) || sorted[0];
    if (!preferred) {
      res.status(503).json({ error: "No matching source quality" });
      return;
    }

    const streamUrlStr: string = preferred.stream_url || preferred.url || "";
    if (!streamUrlStr) {
      res.status(503).json({ error: "Empty stream URL" });
      return;
    }

    let cdnUrl = streamUrlStr;
    try {
      const parsed = new URL(streamUrlStr);
      const inner = parsed.searchParams.get("url");
      if (inner) cdnUrl = inner;
    } catch {}

    const q = targetQuality.replace("p", "");

    const direct = await tryStreamCdnUrl(cdnUrl, {});
    if (direct) {
      await pipeVideoResponse(direct, res, targetQuality, isDownload);
      return;
    }

    const downloaded = await tryGiftedDownload(cdnUrl, q);
    if (downloaded) {
      await pipeVideoResponse(downloaded, res, targetQuality, isDownload);
      return;
    }

    res.status(503).json({ error: "Stream unavailable — CDN access denied" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stream proxy error";
    if (!res.headersSent) {
      res.status(502).json({ error: message });
    }
  }
}

async function handleStreamProxy(req: Request, res: Response) {
  const cdnUrl = req.query.url as string;
  const quality = (req.query.quality as string) || "360";
  const isDownload = req.query.download === "1";

  if (!cdnUrl) {
    res.status(400).json({ error: "Missing url parameter" });
    return;
  }

  try {
    const direct = await tryStreamCdnUrl(cdnUrl, {});
    if (direct) {
      await pipeVideoResponse(direct, res, quality, isDownload);
      return;
    }

    const upstream = `${GIFTED_BASE_URL}/download?url=${encodeURIComponent(cdnUrl)}&title=video&quality=${quality}`;
    const upstreamRes = await fetch(upstream, { headers: GIFTED_HEADERS });

    if (!upstreamRes.ok) {
      const text = await upstreamRes.text().catch(() => "");
      throw new Error(`Upstream error: ${upstreamRes.status} - ${text.slice(0, 200)}`);
    }

    const ct = upstreamRes.headers.get("content-type") || "";
    if (ct.includes("text/html") || ct.includes("text/plain")) {
      const body = await upstreamRes.text().catch(() => "");
      if (body.toLowerCase().includes("<html") || body.toLowerCase().includes("access denied")) {
        throw new Error("CDN access denied — stream URL may have expired");
      }
    }

    await pipeVideoResponse(upstreamRes, res, quality, isDownload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stream proxy error";
    if (!res.headersSent) {
      res.status(503).json({ error: message });
    }
  }
}

async function handleGiftedProxy(req: Request, res: Response) {
  const rawPath = req.path.replace(/^\/gifted/, "") || "/";
  const qs = new URLSearchParams(req.query as Record<string, string>).toString();
  const fullPath = qs ? `${rawPath}?${qs}` : rawPath;
  const url = `${GIFTED_BASE_URL}${fullPath}`;

  const clientIp =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    (req.headers["x-real-ip"] as string) ||
    req.ip ||
    "";

  const forwardHeaders = {
    ...GIFTED_HEADERS,
    ...(clientIp ? { "X-Forwarded-For": clientIp, "X-Real-IP": clientIp } : {}),
  };

  try {
    const upstreamRes = await fetch(url, { headers: forwardHeaders });
    if (!upstreamRes.ok) {
      const text = await upstreamRes.text().catch(() => "");
      throw new Error(`Gifted API error: ${upstreamRes.status} - ${text.slice(0, 200)}`);
    }
    const data = await upstreamRes.json();
    res.json(data);
  } catch (err: unknown) {
    req.log?.error?.({ err, path: fullPath }, "Gifted API proxy error");
    const message = err instanceof Error ? err.message : "Gifted API error";
    res.status(502).json({ error: message });
  }
}

router.get("/gifted/stream-by-id", (req, res) => handleStreamBySubjectId(req, res));
router.get("/gifted/stream", (req, res) => handleStreamProxy(req, res));
router.use("/gifted", (req, res) => handleGiftedProxy(req, res));

export default router;
