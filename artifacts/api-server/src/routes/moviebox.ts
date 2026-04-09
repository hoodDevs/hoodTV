import { Router, type Request, type Response } from "express";
import crypto from "crypto";

const router = Router();

const HOST_POOL = [
  "https://api6.aoneroom.com",
  "https://api5.aoneroom.com",
  "https://api4.aoneroom.com",
  "https://api4sg.aoneroom.com",
  "https://api3.aoneroom.com",
  "https://api6sg.aoneroom.com",
  "https://api.inmoviebox.com",
];

const SECRET_KEY_DEFAULT = process.env.MOVIEBOX_SECRET_KEY || "";
const SECRET_KEY_ALT = process.env.MOVIEBOX_SECRET_KEY_ALT || "";
const RETRY_STATUS_CODES = new Set([403, 407, 429, 500, 502, 503, 504]);

const ANDROID_VERSIONS = [
  { version: "9", build: "PQ3A.190605.03081104" },
  { version: "10", build: "QP1A.191005.007.A3" },
  { version: "11", build: "RP1A.200720.011" },
  { version: "12", build: "S1B.220414.015" },
  { version: "13", build: "TQ2A.230405.003" },
];
const REDMI_DEVICES = [
  { model: "23078RKD5C", brand: "Redmi" },
  { model: "2201117TY", brand: "Redmi" },
  { model: "2201117TG", brand: "Redmi" },
  { model: "22101316G", brand: "Redmi" },
  { model: "21121210G", brand: "Redmi" },
];
const VERSION_CODES = [50020042, 50020043, 50020044, 50020045, 50020046];
const NETWORKS = ["NETWORK_WIFI", "NETWORK_MOBILE"];
const TIMEZONES = ["Asia/Kolkata", "Asia/Shanghai", "Asia/Tokyo", "America/New_York", "Europe/London"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateClientInfo(): { userAgent: string; clientInfo: string } {
  const android = pick(ANDROID_VERSIONS);
  const device = pick(REDMI_DEVICES);
  const versionCode = pick(VERSION_CODES);
  const network = pick(NETWORKS);
  const timezone = pick(TIMEZONES);
  const gaid = crypto.randomUUID();
  const deviceId = crypto.randomBytes(16).toString("hex");

  const userAgent =
    `com.community.oneroom/${versionCode} ` +
    `(Linux; U; Android ${android.version}; en_US; ` +
    `${device.model}; Build/${android.build}; Cronet/135.0.7012.3)`;

  const clientInfo = JSON.stringify({
    package_name: "com.community.oneroom",
    version_name: "3.0.03.0529.03",
    version_code: versionCode,
    os: "android",
    os_version: android.version,
    install_ch: "ps",
    device_id: deviceId,
    install_store: "ps",
    gaid,
    brand: device.brand,
    model: device.model,
    system_language: "en",
    net: network,
    region: "US",
    timezone,
    sp_code: "40401",
    "X-Play-Mode": "2",
  });

  return { userAgent, clientInfo };
}

function md5Hex(data: Buffer | string): string {
  return crypto.createHash("md5").update(data).digest("hex");
}

function b64Decode(value: string): Buffer {
  const padding = (4 - (value.length % 4)) % 4;
  return Buffer.from(value + "=".repeat(padding), "base64");
}

function b64Encode(data: Buffer): string {
  return data.toString("base64");
}

function generateXClientToken(ts: number): string {
  const tsStr = String(ts);
  const reversed = tsStr.split("").reverse().join("");
  const hash = md5Hex(reversed);
  return `${tsStr},${hash}`;
}

function sortedQueryString(urlStr: string): string {
  const url = new URL(urlStr);
  const entries = [...url.searchParams.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return entries.map(([k, v]) => `${k}=${v}`).join("&");
}

function buildCanonicalString(
  method: string,
  accept: string,
  contentType: string,
  url: string,
  body: string | null,
  ts: number
): string {
  const parsed = new URL(url);
  const path = parsed.pathname;
  const query = sortedQueryString(url);
  const canonicalUrl = query ? `${path}?${query}` : path;

  let bodyHash = "";
  let bodyLength = "";
  if (body) {
    const bodyBytes = Buffer.from(body, "utf-8");
    const truncated = bodyBytes.slice(0, 102400);
    bodyHash = md5Hex(truncated);
    bodyLength = String(bodyBytes.length);
  }

  return [method.toUpperCase(), accept, contentType, bodyLength, String(ts), bodyHash, canonicalUrl].join("\n");
}

function generateXTrSignature(
  method: string,
  accept: string,
  contentType: string,
  url: string,
  body: string | null,
  useAltKey: boolean,
  ts: number
): string {
  const canonical = buildCanonicalString(method, accept, contentType, url, body, ts);
  const secretBytes = b64Decode(useAltKey ? SECRET_KEY_ALT : SECRET_KEY_DEFAULT);
  const mac = crypto.createHmac("md5", secretBytes).update(canonical, "utf-8").digest();
  return `${ts}|2|${b64Encode(mac)}`;
}

function buildSignedHeaders(
  method: string,
  url: string,
  accept: string,
  contentType: string,
  body: string | null,
  includePlayMode: boolean,
  authToken: string | null
): Record<string, string> {
  const ts = Date.now();
  const { userAgent, clientInfo } = generateClientInfo();

  const headers: Record<string, string> = {
    "User-Agent": userAgent,
    Accept: accept,
    "Content-Type": contentType,
    Connection: "keep-alive",
    "X-Client-Token": generateXClientToken(ts),
    "x-tr-signature": generateXTrSignature(method, accept, contentType, url, body, false, ts),
    "X-Client-Info": clientInfo,
    "X-Client-Status": "0",
  };

  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  if (includePlayMode) headers["X-Play-Mode"] = "2";

  return headers;
}

let runtimeToken: string | null = null;

function absorbXUser(responseHeaders: Headers): void {
  const xUser = responseHeaders.get("x-user");
  if (!xUser) return;
  try {
    const payload = JSON.parse(xUser);
    if (payload?.token) runtimeToken = payload.token;
  } catch {}
}

async function movieboxRequest(
  path: string,
  opts: {
    method?: "GET" | "POST";
    body?: string | null;
    accept?: string;
    contentType?: string;
    includePlayMode?: boolean;
  } = {}
): Promise<any> {
  const {
    method = "GET",
    body = null,
    accept = "application/json",
    contentType = "application/json",
    includePlayMode = false,
  } = opts;

  let lastError: Error = new Error("All moviebox hosts failed");

  for (const base of HOST_POOL) {
    const url = `${base}${path}`;
    const headers = buildSignedHeaders(method, url, accept, contentType, body, includePlayMode, runtimeToken);

    try {
      const fetchOpts: RequestInit = {
        method,
        headers,
        signal: AbortSignal.timeout(15000),
      };
      if (body) (fetchOpts as any).body = body;

      const res = await fetch(url, fetchOpts);
      absorbXUser(res.headers);

      if (RETRY_STATUS_CODES.has(res.status)) {
        lastError = new Error(`Host ${base} returned ${res.status}`);
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Moviebox API error: ${res.status} — ${text.slice(0, 200)}`);
      }

      const json = await res.json();
      if (json?.data !== undefined) return json.data;
      return json;
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Moviebox API error")) throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError;
}

const SEARCH_PATH = "/wefeed-mobile-bff/subject-api/search";
const PLAY_INFO_PATH = "/wefeed-mobile-bff/subject-api/play-info";
const RESOURCE_PATH = "/wefeed-mobile-bff/subject-api/resource";

const SUBJECT_TYPE_ALL = 0;

async function searchMoviebox(keyword: string, page = 1): Promise<any[]> {
  const body = JSON.stringify({ keyword, page, perPage: 20, subjectType: SUBJECT_TYPE_ALL });
  const data = await movieboxRequest(SEARCH_PATH, { method: "POST", body, includePlayMode: true });
  return data?.items || [];
}

async function getPlayInfo(subjectId: string, season: number, episode: number): Promise<any> {
  const path = `${PLAY_INFO_PATH}?subjectId=${subjectId}&se=${season}&ep=${episode}`;
  return movieboxRequest(path, { method: "GET", includePlayMode: true });
}

async function getResource(subjectId: string, season: number, episode: number): Promise<any> {
  const path = `${RESOURCE_PATH}?subjectId=${subjectId}&se=${season}&ep=${episode}`;
  return movieboxRequest(path, { method: "GET" });
}

const MEDIA_HINTS = [".m3u8", ".mpd", ".mp4", ".mkv", ".webm", "sign=", "resourcelink", "downloadurl="];

function isMediaUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return url.startsWith("http") && MEDIA_HINTS.some((h) => lower.includes(h));
}

function streamType(url: string): "hls" | "dash" | "mp4" {
  const lower = url.toLowerCase();
  if (lower.includes(".m3u8")) return "hls";
  if (lower.includes(".mpd")) return "dash";
  return "mp4";
}

function extractStreamUrls(obj: any, depth = 0): Array<{ url: string; type: "hls" | "dash" | "mp4" }> {
  const results: Array<{ url: string; type: "hls" | "dash" | "mp4" }> = [];
  if (depth > 8 || obj == null) return results;

  if (typeof obj === "string") {
    if (isMediaUrl(obj)) results.push({ url: obj, type: streamType(obj) });
    return results;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) results.push(...extractStreamUrls(item, depth + 1));
    return results;
  }

  if (typeof obj === "object") {
    const PRIORITY = ["url", "resourceLink", "sourceUrl", "download_url", "hls", "mp4", "playUrl", "videoAddress"];
    for (const key of PRIORITY) {
      if (obj[key]) results.push(...extractStreamUrls(obj[key], depth + 1));
    }
    for (const [k, v] of Object.entries(obj)) {
      if (!PRIORITY.includes(k)) results.push(...extractStreamUrls(v, depth + 1));
    }
  }

  return results;
}

function rankUrls(urls: Array<{ url: string; type: "hls" | "dash" | "mp4"; resolution?: number }>) {
  const order: Record<string, number> = { hls: 0, mp4: 1, dash: 2 };
  return [...urls].sort((a, b) => {
    const typeDiff = (order[a.type] ?? 9) - (order[b.type] ?? 9);
    if (typeDiff !== 0) return typeDiff;
    return (b.resolution ?? 0) - (a.resolution ?? 0);
  });
}

function resolutionLabel(resolution?: number): string {
  if (!resolution || resolution === 0) return "Auto";
  if (resolution >= 1080) return "1080p";
  if (resolution >= 720) return "720p";
  if (resolution >= 480) return "480p";
  if (resolution >= 360) return "360p";
  return `${resolution}p`;
}

function findBestMatch(items: any[], title: string, type: "movie" | "tv"): any | null {
  if (!items.length) return null;
  const typeValues =
    type === "tv"
      ? ["TV_SERIES", "TVSHOWS", "TV"]
      : ["MOVIES", "MOVIE", "ANIME", "EDUCATION", "MUSIC"];

  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const target = normalise(title);

  const byTypeAndExactTitle = items.find(
    (i) => typeValues.includes(i.subjectType) && normalise(i.title || "") === target
  );
  if (byTypeAndExactTitle) return byTypeAndExactTitle;

  const byType = items.find((i) => typeValues.includes(i.subjectType));
  if (byType) return byType;

  return items[0];
}

router.get("/search", async (req: Request, res: Response) => {
  const q = req.query.q as string;
  const type = (req.query.type as string) || "movie";

  if (!q) {
    res.status(400).json({ error: "Missing q parameter" });
    return;
  }

  try {
    const items = await searchMoviebox(q);
    res.json({ results: items, count: items.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    res.status(502).json({ error: message });
  }
});

function extractResourceDetectorUrls(
  item: any
): Array<{ url: string; type: "hls" | "dash" | "mp4"; resolution?: number }> {
  const results: Array<{ url: string; type: "hls" | "dash" | "mp4"; resolution?: number }> = [];
  const detectors: any[] = Array.isArray(item?.resourceDetectors) ? item.resourceDetectors : [];

  for (const det of detectors) {
    const resList: any[] = Array.isArray(det?.resolutionList) ? det.resolutionList : [];
    for (const r of resList) {
      const url = r.resourceLink || r.sourceUrl || r.downloadUrl || "";
      if (url && url.startsWith("http")) {
        results.push({ url, type: streamType(url), resolution: r.resolution ?? 0 });
      }
    }
    const dlUrl = det?.downloadUrl;
    if (dlUrl && dlUrl.startsWith("http") && !results.some((r) => r.url === dlUrl)) {
      results.push({ url: dlUrl, type: streamType(dlUrl) });
    }
  }

  return results;
}

router.get("/stream", async (req: Request, res: Response) => {
  const title = req.query.title as string;
  const type = (req.query.type as "movie" | "tv") || "movie";
  const season = parseInt((req.query.season as string) || "1", 10);
  const episode = parseInt((req.query.episode as string) || "1", 10);

  if (!title) {
    res.status(400).json({ error: "Missing title parameter" });
    return;
  }

  try {
    const items = await searchMoviebox(title);

    if (!items.length) {
      res.status(404).json({ error: "No results found on moviebox" });
      return;
    }

    const match = findBestMatch(items, title, type);
    if (!match?.subjectId) {
      res.status(404).json({ error: "Could not match title on moviebox" });
      return;
    }

    const subjectId = String(match.subjectId);
    const se = type === "tv" ? season : 0;
    const ep = type === "tv" ? episode : 0;

    let allUrls: Array<{ url: string; type: "hls" | "dash" | "mp4"; resolution?: number }> = [];

    const resourceDetectorUrls = extractResourceDetectorUrls(match);
    allUrls.push(...resourceDetectorUrls);

    try {
      const playData = await getPlayInfo(subjectId, se, ep);
      const playUrls = extractStreamUrls(playData).map((u) => ({ ...u, resolution: undefined }));
      allUrls.push(...playUrls);
    } catch {}

    if (!allUrls.length) {
      try {
        const resData = await getResource(subjectId, se, ep);
        allUrls.push(...extractStreamUrls(resData).map((u) => ({ ...u, resolution: undefined })));
      } catch {}
    }

    const ranked = rankUrls(allUrls);

    if (!ranked.length) {
      res.status(503).json({
        error: "No stream URL available from moviebox",
        subjectId,
        matchedTitle: match.title,
      });
      return;
    }

    const labelledUrls = ranked.slice(0, 6).map((u, i) => ({
      url: u.url,
      type: u.type,
      resolution: u.resolution,
      quality: i === 0 ? resolutionLabel(u.resolution) : resolutionLabel(u.resolution),
    }));

    res.json({
      subjectId,
      matchedTitle: match.title,
      url: ranked[0].url,
      streamType: ranked[0].type,
      quality: resolutionLabel(ranked[0].resolution),
      allUrls: labelledUrls,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stream lookup failed";
    res.status(502).json({ error: message });
  }
});

router.get("/play-info", async (req: Request, res: Response) => {
  const subjectId = req.query.subjectId as string;
  const season = parseInt((req.query.season as string) || "0", 10);
  const episode = parseInt((req.query.episode as string) || "0", 10);

  if (!subjectId) {
    res.status(400).json({ error: "Missing subjectId" });
    return;
  }

  try {
    const data = await getPlayInfo(subjectId, season, episode);
    const urls = rankUrls(extractStreamUrls(data));
    res.json({ raw: data, urls });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Play info error";
    res.status(502).json({ error: message });
  }
});

export default router;
