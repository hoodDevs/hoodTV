import { Router } from "express";
import * as cheerio from "cheerio";

const router = Router();

const SITE_MIRRORS = ["https://fzmovies.live", "https://fzmovies.host"];
let activeMirror = SITE_MIRRORS[0];

const UA =
  "Mozilla/5.0 (X11; Linux x86_64; rv:129.0) Gecko/20100101 Firefox/129.0";

let sessionCookie = "";
let sessionInitAt = 0;
const SESSION_TTL = 30 * 60 * 1000;

const cache = new Map<string, { data: unknown; expiresAt: number }>();

function setCache(key: string, data: unknown, ttlMs: number) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

function getCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function abs(path: string) {
  if (path.startsWith("http")) return path;
  return `${activeMirror}/${path.replace(/^\//, "")}`;
}

async function initSession(): Promise<void> {
  if (sessionCookie && Date.now() - sessionInitAt < SESSION_TTL) return;
  for (const mirror of SITE_MIRRORS) {
    try {
      const res = await fetch(`${mirror}/`, {
        headers: { "User-Agent": UA },
        redirect: "follow",
      });
      if (!res.ok) continue;
      const setCookie = res.headers.get("set-cookie") || "";
      const match = setCookie.match(/PHPSESSID=([^;]+)/);
      if (match) {
        sessionCookie = `PHPSESSID=${match[1]}`;
        sessionInitAt = Date.now();
        activeMirror = mirror;
        return;
      }
    } catch {}
  }
  throw new Error("Failed to initialize fzmovies session");
}

async function fzFetch(url: string, opts: RequestInit = {}): Promise<string> {
  await initSession();
  const headers: Record<string, string> = {
    "User-Agent": UA,
    Referer: `${activeMirror}/`,
    Cookie: sessionCookie,
    ...(opts.headers as Record<string, string>),
  };
  const res = await fetch(url, { ...opts, headers, redirect: "follow" });
  if (!res.ok) throw new Error(`fzFetch ${url} → ${res.status}`);
  return res.text();
}

interface FzMovie {
  title: string;
  year: number;
  url: string;
  cover: string;
  about: string;
}

interface FzFile {
  title: string;
  url: string;
  size: string;
}

interface FzLinks {
  filename: string;
  size: string;
  urls: string[];
}

async function search(query: string): Promise<FzMovie[]> {
  const cacheKey = `search:${query.toLowerCase()}`;
  const cached = getCache<FzMovie[]>(cacheKey);
  if (cached) return cached;

  await initSession();
  const body = new URLSearchParams({
    searchname: query,
    Search: "Search",
    searchby: "Name",
    category: "All",
    vsearch: "",
  });

  const html = await fzFetch(`${activeMirror}/csearch.php`, {
    method: "POST",
    body: body.toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const $ = cheerio.load(html);
  const results: FzMovie[] = [];

  $("div.mainbox").each((_, el) => {
    const anchor = $(el).find("a").first();
    const url = anchor.attr("href") || "";
    if (!url.endsWith(".htm")) return;
    const smalls = $(el).find("span small");
    if (smalls.length < 2) return;
    const title = smalls.eq(0).text().trim();
    const year = parseInt(smalls.eq(1).text().replace(/[()]/g, "").trim()) || 0;
    const about = smalls.length >= 3 ? smalls.eq(smalls.length - 1).text().trim() : "";
    const cover = $(el).find("img").attr("src") || "";
    results.push({
      title,
      year,
      url: abs(url),
      cover: cover.startsWith("http") ? cover : abs(cover),
      about,
    });
  });

  setCache(cacheKey, results, 10 * 60 * 1000);
  return results;
}

async function getFiles(movieUrl: string): Promise<FzFile[]> {
  const cacheKey = `files:${movieUrl}`;
  const cached = getCache<FzFile[]>(cacheKey);
  if (cached) return cached;

  const html = await fzFetch(movieUrl);
  const $ = cheerio.load(html);
  const files: FzFile[] = [];

  $("ul.moviesfiles").each((_, el) => {
    const anchors = $(el).find("a");
    if (!anchors.length) return;
    const title = anchors.eq(0).text().trim();
    const url = anchors.eq(0).attr("href") || "";
    if (!url.includes("downloadoptionskey=")) return;
    const dcounter = $(el).find("dcounter").text().replace(/[(){}]/g, "").trim();
    const parts = dcounter.split(/\s+/);
    const size = parts.slice(0, 2).join(" ");
    files.push({ title, url: abs(url), size });
  });

  setCache(cacheKey, files, 60 * 60 * 1000);
  return files;
}

async function resolveLinks(fileUrl: string): Promise<FzLinks> {
  const cacheKey = `links:${fileUrl}`;
  const cached = getCache<FzLinks>(cacheKey);
  if (cached) return cached;

  const page1Html = await fzFetch(fileUrl);

  const dlKeyMatch =
    page1Html.match(/download\.php\?downloadkey=([^'"&\s]+)/) ||
    page1Html.match(/downloadkey=([^'"&\s]+)/);

  if (!dlKeyMatch) throw new Error("Could not find download key");
  const downloadKey = dlKeyMatch[1];
  const dlPageUrl = `${activeMirror}/download.php?downloadkey=${downloadKey}`;

  const page2Html = await fzFetch(dlPageUrl, {
    headers: { Referer: fileUrl },
  });

  const $2 = cheerio.load(page2Html);

  const filename =
    $2("textcolor1").first().text().trim() || "video.mp4";
  const size = $2("textcolor2").first().text().trim() || "";

  const urls: string[] = [];
  $2("input[name='download1']").each((_, el) => {
    const val = $2(el).attr("value");
    if (val && val.startsWith("http")) urls.push(val);
  });

  if (!urls.length) {
    $2("ul.downloadlinks li a").each((_, el) => {
      const href = $2(el).attr("href");
      if (href && href.startsWith("http") && !href.includes("fzmovies") && !href.includes("index")) {
        urls.push(href);
      }
    });
  }

  const result: FzLinks = { filename, size, urls };
  if (urls.length) setCache(cacheKey, result, 10 * 60 * 60 * 1000);
  return result;
}

function scoreMatch(movie: FzMovie, query: string, year?: number): number {
  const q = query.toLowerCase();
  const t = movie.title.toLowerCase();
  let score = 0;
  if (t === q) score += 100;
  else if (t.startsWith(q)) score += 60;
  else if (t.includes(q)) score += 30;
  if (year && movie.year === year) score += 50;
  else if (year && Math.abs(movie.year - year) <= 1) score += 20;
  return score;
}

function isBrowserPlayable(title: string): boolean {
  const lower = title.toLowerCase();
  return lower.endsWith(".mp4") || lower.includes("mp4");
}

router.get("/resolve", async (req, res) => {
  try {
    const q = (req.query.q as string)?.trim();
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;

    if (!q) return void res.status(400).json({ error: "q is required" });

    const movies = await search(q);
    if (!movies.length) return void res.json({ results: [], files: [], links: null });

    const scored = movies
      .map((m) => ({ movie: m, score: scoreMatch(m, q, year) }))
      .sort((a, b) => b.score - a.score);

    const best = scored[0].movie;
    const files = await getFiles(best.url);
    if (!files.length) return void res.json({ movie: best, files, links: null });

    const mp4File = files.find((f) => isBrowserPlayable(f.title));
    const file = mp4File || files[0];

    const links = await resolveLinks(file.url);
    const contentType = isBrowserPlayable(file.title) ? "video/mp4" : "video/x-matroska";

    res.json({
      movie: best,
      files,
      selectedFile: file,
      contentType,
      links,
    });
  } catch (err: unknown) {
    console.error("[fzmovies resolve]", err);
    res.status(500).json({ error: String(err) });
  }
});

router.get("/search", async (req, res) => {
  try {
    const q = (req.query.q as string)?.trim();
    if (!q) return void res.status(400).json({ error: "q is required" });
    const results = await search(q);
    res.json({ results });
  } catch (err: unknown) {
    console.error("[fzmovies search]", err);
    res.status(500).json({ error: String(err) });
  }
});

router.get("/stream", async (req, res) => {
  const url = (req.query.url as string)?.trim();
  if (!url || !url.startsWith("http")) {
    return void res.status(400).json({ error: "url is required" });
  }

  const allowedDomains = [".cyou", ".fzmovies", "fzcorp", "fzcloud", "cloudfront"];
  if (!allowedDomains.some((d) => url.includes(d))) {
    return void res.status(403).json({ error: "URL not from allowed CDN" });
  }

  try {
    const range = req.headers.range;
    const headers: Record<string, string> = {
      "User-Agent": UA,
      Referer: `${activeMirror}/`,
    };
    if (range) headers["Range"] = range;

    const upstream = await fetch(url, { headers });

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Accept-Ranges", "bytes");

    const ct = upstream.headers.get("content-type") || "video/mp4";
    const cl = upstream.headers.get("content-length");
    const cr = upstream.headers.get("content-range");

    res.setHeader("Content-Type", ct);
    if (cl) res.setHeader("Content-Length", cl);
    if (cr) res.setHeader("Content-Range", cr);

    res.status(upstream.status);

    const body = upstream.body;
    if (!body) return void res.end();

    const reader = body.getReader();
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const ok = res.write(value);
          if (!ok) await new Promise((r) => res.once("drain", r));
        }
        res.end();
      } catch {
        res.end();
      }
    };
    pump();

    req.on("close", () => reader.cancel().catch(() => {}));
  } catch (err: unknown) {
    console.error("[fzmovies stream]", err);
    if (!res.headersSent) res.status(502).json({ error: String(err) });
  }
});

export default router;
