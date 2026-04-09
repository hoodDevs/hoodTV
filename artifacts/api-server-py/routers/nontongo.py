"""
NontonGo stream extractor.

Chain (movies):
  1. GET stream/movie_upcloud/view1.php?id={imdb_id}  (Referer: getPlay.php)
     → iframe data-src (videoplayback.php + encoded id1)
  2. GET videoplayback.php?id1=…  → 302 → vibuxer.com/e/{code}
  3. GET vibuxer.com page  → decode p,a,c,k,e,d packed JS → m3u8 URLs

Chain (TV):
  1. GET embed/tv/tv_nontongo.php?id={tmdb_id}&s={s}&e={e}  → data-link list
  2. GET /videoplayback?id1=…  → 302 → getPlayTV.php?id={tmdb_id}&s=…&e=…&sv=Nontongo
  3. GET getPlayTV.php  → window.location.href JS redirect → view1.php URL
  4. GET view1.php  → iframe data-src  → videoplayback.php
  5. GET videoplayback.php  → 302 → vibuxer.com/e/{code}
  6. GET vibuxer.com page  → decode packed JS → m3u8 URLs

All HTTP calls use plain curl via subprocess to avoid Scrapling's TLS fingerprint
being blocked by Cloudflare on nontongo.win.
"""
import asyncio
import os
import re
import subprocess
import tempfile
import time
import urllib.parse
from typing import List, Optional

import httpx
from fastapi import APIRouter, Query
from pydantic import BaseModel

router = APIRouter()

# ── TMDB helper ───────────────────────────────────────────────────────────────
_TMDB_KEY = os.environ.get("TMDB_API_KEY", "")
_TMDB_BASE = "https://api.themoviedb.org/3"


async def _get_imdb_id(tmdb_id: int, media_type: str) -> Optional[str]:
    """Fetch IMDB ID from TMDB external_ids endpoint."""
    if not _TMDB_KEY:
        return None
    url = f"{_TMDB_BASE}/{media_type}/{tmdb_id}/external_ids?api_key={_TMDB_KEY}"
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(url)
            if r.status_code == 200:
                return r.json().get("imdb_id") or None
    except Exception:
        pass
    return None


# ── Cache ─────────────────────────────────────────────────────────────────────
_cache: dict = {}
_CACHE_TTL = 3600  # 1 hour


def _cache_key(tmdb_id: int, kind: str, season: int = 0, episode: int = 0) -> str:
    return f"nontongo:{kind}:{tmdb_id}:{season}:{episode}"


def _get_cached(key: str):
    entry = _cache.get(key)
    if entry and time.time() < entry["exp"]:
        return entry["val"]
    return None


def _set_cached(key: str, val):
    _cache[key] = {"val": val, "exp": time.time() + _CACHE_TTL}


# ── Models ────────────────────────────────────────────────────────────────────
class Caption(BaseModel):
    language: str
    url: str


class StreamSource(BaseModel):
    name: str
    url: str
    source_type: str = "hls"
    captions: List[Caption] = []


class StreamResponse(BaseModel):
    sources: List[StreamSource]


# ── curl helpers ──────────────────────────────────────────────────────────────
_CURL_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


def _curl_get(url: str, referer: Optional[str] = None, timeout: int = 8) -> str:
    """Fetch URL body via curl. Returns empty string on failure."""
    args = [
        "curl", "-s",
        "--max-time", str(timeout),
        "-H", f"User-Agent: {_CURL_UA}",
        "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "-H", "Accept-Language: en-US,en;q=0.9",
    ]
    if referer:
        args += ["-H", f"Referer: {referer}"]
    args.append(url)
    try:
        result = subprocess.run(args, capture_output=True, timeout=timeout + 3)
        return result.stdout.decode("utf-8", "replace")
    except Exception:
        return ""


def _curl_location(url: str, referer: Optional[str] = None, timeout: int = 8) -> Optional[str]:
    """HEAD request → return Location header value on 3xx, else None."""
    args = [
        "curl", "-sI",
        "--max-time", str(timeout),
        "-H", f"User-Agent: {_CURL_UA}",
    ]
    if referer:
        args += ["-H", f"Referer: {referer}"]
    args.append(url)
    try:
        result = subprocess.run(args, capture_output=True, timeout=timeout + 3)
        headers = result.stdout.decode("utf-8", "replace")
        m = re.search(r"^[Ll]ocation:\s*(.+)$", headers, re.MULTILINE)
        return m.group(1).strip() if m else None
    except Exception:
        return None


def _decode_packer(script: str) -> str:
    """Unpack a p,a,c,k,e,d obfuscated script block using Node.js.

    Transforms:
        eval(function(p,a,c,k,e,d){...}('...',N,N,'...'.split('|')))
    into:
        process.stdout.write(String(function(p,a,c,k,e,d){...}('...',N,N,'...'.split('|'))))
    """
    # Replace 'eval(' with 'process.stdout.write(String('
    # This adds one extra open paren, so we must add one extra close paren at the end
    decoded_script = script.replace("eval(", "process.stdout.write(String(", 1)
    # Strip trailing whitespace/newlines, then add closing ) for process.stdout.write(
    decoded_script = decoded_script.rstrip() + ")"

    with tempfile.NamedTemporaryFile(mode="w", suffix=".js", delete=False) as f:
        f.write(decoded_script)
        fname = f.name
    try:
        result = subprocess.run(
            ["node", fname], capture_output=True, text=True, timeout=10
        )
        return result.stdout
    except Exception:
        return ""
    finally:
        try:
            os.unlink(fname)
        except OSError:
            pass


def _extract_m3u8_from_vibuxer(vibuxer_url: str, referer: str) -> List[str]:
    """
    Fetch a vibuxer.com embed page, decode the packed JS, and return all
    m3u8 URLs found inside.
    """
    body = _curl_get(vibuxer_url, referer=referer)
    if not body:
        return []

    # Extract all <script> blocks and look for eval(function(p,a,c,k,e,d){...})
    scripts = re.findall(r"<script[^>]*>(.*?)</script>", body, re.DOTALL)
    packed_script = None
    for s in scripts:
        if "eval(function(p,a,c,k,e,d)" in s:
            packed_script = s.strip()
            break

    if not packed_script:
        # Try to find raw m3u8 URLs directly (some pages don't use packer)
        return re.findall(r'"(https?://[^"]+\.m3u8[^"]*)"', body)

    decoded = _decode_packer(packed_script)
    if not decoded:
        return []

    # Extract all m3u8 URLs from the decoded JS
    links_obj = re.search(r'var\s+links\s*=\s*\{([^}]+)\}', decoded)
    if links_obj:
        all_urls = re.findall(r'"(https?://[^"]+\.m3u8[^"]*)"', links_obj.group(1))
        if all_urls:
            return all_urls

    # Fallback: grab any m3u8 URL in the decoded output
    return re.findall(r'"(https?://[^"]+\.m3u8[^"]*)"', decoded)


def _follow_videoplayback_to_vibuxer(
    vplay_url: str, referer: str
) -> Optional[str]:
    """
    Follow a nontongo.win/stream/.../videoplayback.php?id1=… URL,
    which 302-redirects to vibuxer.com. Return the vibuxer URL.
    """
    loc = _curl_location(vplay_url, referer=referer)
    if loc and "vibuxer.com" in loc:
        return loc
    return None


# ── Movie extractor ──────────────────────────────────────────────────────────
def _extract_movie(imdb_id: str) -> List[str]:
    """
    Return a list of m3u8 URLs for a movie using imdb_id (e.g. 'tt4154796').
    """
    if not imdb_id:
        return []

    # Step 1: view1.php (shortcuts past play-movie.php + first redirect)
    view_url = f"https://nontongo.win/stream/movie_upcloud/view1.php?id={imdb_id}"
    body = _curl_get(view_url, referer="https://nontongo.win/embed/movie/getPlay.php")
    if not body or "File not found" in body:
        return []

    iframe = re.search(r'data-src="(https://[^"]+)"', body)
    if not iframe:
        return []
    vplay_url = iframe.group(1)

    # Step 2: videoplayback.php → 302 → vibuxer.com
    vibuxer_url = _follow_videoplayback_to_vibuxer(vplay_url, referer=view_url)
    if not vibuxer_url:
        return []

    # Step 3: decode vibuxer page → m3u8
    return _extract_m3u8_from_vibuxer(vibuxer_url, referer="https://nontongo.win/")


# ── Player API extractor (server7.php + cloudloop.php) ───────────────────────
def _extract_via_player_api(
    media_type: str,
    tmdb_id: int,
    season: int = 0,
    episode: int = 0,
) -> List[str]:
    """
    Use the player.nontongo.win internal API to get stream URLs.

    Chain:
      1. GET /api/server7.php?type={type}&tmdbid={id}[&season={s}&episode={e}]
         with Referer = /embed/index6.php?... → JSON {sources: [{url: <encrypted>}]}
      2. The encrypted URL is decoded server-side by /cloudloop.php?u={encrypted}
         which returns a valid HLS master playlist.
    """
    if media_type == "tv":
        api_url = (
            f"https://player.nontongo.win/api/server7.php"
            f"?type=tv&tmdbid={tmdb_id}&season={season}&episode={episode}"
        )
        embed_ref = (
            f"https://player.nontongo.win/embed/index6.php"
            f"?id={tmdb_id}&season={season}&episode={episode}&type=tv"
        )
    else:
        api_url = (
            f"https://player.nontongo.win/api/server7.php"
            f"?type=movie&tmdbid={tmdb_id}"
        )
        embed_ref = (
            f"https://player.nontongo.win/embed/index6.php"
            f"?id={tmdb_id}&type=movie"
        )

    body = _curl_get(api_url, referer=embed_ref)
    if not body:
        return []

    try:
        import json as _json
        data = _json.loads(body)
    except Exception:
        return []

    if not data.get("success") or not data.get("sources"):
        return []

    # The player prefers sources[1] when available, falls back to sources[0]
    sources = data["sources"]
    chosen = sources[1] if len(sources) > 1 and sources[1].get("url") else sources[0]
    encrypted_url = chosen.get("url", "")
    if not encrypted_url:
        return []

    import urllib.parse as _up
    cloudloop_url = (
        "https://player.nontongo.win/cloudloop.php?u="
        + _up.quote(encrypted_url, safe="")
    )
    return [cloudloop_url]


# ── TV extractor ─────────────────────────────────────────────────────────────
def _extract_tv(tmdb_id: int, season: int, episode: int) -> List[str]:
    """
    Return a list of m3u8 URLs for a TV episode using the
    player.nontongo.win API (server7.php + cloudloop.php).
    """
    return _extract_via_player_api("tv", tmdb_id, season, episode)


# ── Routes ────────────────────────────────────────────────────────────────────
def _proxied_url(m3u8_url: str) -> str:
    return "/api/proxy/hls?url=" + urllib.parse.quote(m3u8_url, safe="")


def _build_sources(m3u8_list: List[str]) -> List[StreamSource]:
    """
    Build StreamSource objects from a list of m3u8 URLs.
    Prefer hls2 (m3u8) over hls3 (.txt). Label them by index.
    """
    sources = []
    seen = set()
    for url in m3u8_list:
        if url in seen:
            continue
        seen.add(url)
        # Accept .m3u8 URLs and cloudloop.php proxy URLs (which serve m3u8 playlists)
        if ".m3u8" not in url and "cloudloop.php" not in url:
            continue
        sources.append(
            StreamSource(
                name="NontonGo",
                url=_proxied_url(url),
                source_type="hls",
                captions=[],
            )
        )
    return sources[:1]  # Return first working source only


@router.get("/stream/movie/{tmdb_id}/nontongo", response_model=StreamResponse)
async def nontongo_movie(
    tmdb_id: int,
    imdb_id: str = Query(default=""),
):
    key = _cache_key(tmdb_id, "movie")
    cached = _get_cached(key)
    if cached:
        return cached

    # Auto-fetch IMDB ID from TMDB if not supplied
    resolved_imdb = imdb_id
    if not resolved_imdb:
        resolved_imdb = await _get_imdb_id(tmdb_id, "movie") or ""

    if not resolved_imdb:
        return StreamResponse(sources=[])

    loop = asyncio.get_event_loop()
    m3u8_list = await loop.run_in_executor(None, lambda: _extract_movie(resolved_imdb))
    sources = _build_sources(m3u8_list)

    resp = StreamResponse(sources=sources)
    if sources:
        _set_cached(key, resp)
    return resp


@router.get("/stream/tv/{tmdb_id}/{season}/{episode}/nontongo", response_model=StreamResponse)
async def nontongo_tv(
    tmdb_id: int,
    season: int,
    episode: int,
):
    key = _cache_key(tmdb_id, "tv", season, episode)
    cached = _get_cached(key)
    if cached:
        return cached

    loop = asyncio.get_event_loop()
    m3u8_list = await loop.run_in_executor(
        None, lambda: _extract_tv(tmdb_id, season, episode)
    )
    sources = _build_sources(m3u8_list)

    resp = StreamResponse(sources=sources)
    if sources:
        _set_cached(key, resp)
    return resp
