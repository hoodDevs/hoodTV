"""
Stream resolution router.

Calls the Videasy WASM runner (Node.js subprocess) to decrypt and return
HLS source URLs, which are then proxied through /api/proxy/hls.
Scrapling is used in the proxy layer for stealthy CDN fetching.
"""
import json
import subprocess
import asyncio
import time
import urllib.parse
import httpx
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

router = APIRouter()

# ── WASM runner path ──────────────────────────────────────────────────────────
_WASM_DIR = Path(__file__).parent.parent / "videasy_wasm"
_RUNNER   = _WASM_DIR / "runner.cjs"

# ── In-memory cache ───────────────────────────────────────────────────────────
_cache: dict = {}
_CACHE_TTL   = 900   # 15 minutes — Videasy CDN workers can go offline


def _cache_key(tmdb_id: int, kind: str, season: int = 0, episode: int = 0) -> str:
    return f"{kind}:{tmdb_id}:{season}:{episode}"


def _get_cached(key: str):
    entry = _cache.get(key)
    if entry and time.time() < entry["exp"]:
        return entry["val"]
    return None


def _set_cached(key: str, val):
    _cache[key] = {"val": val, "exp": time.time() + _CACHE_TTL}


# ── Videasy WASM runner ───────────────────────────────────────────────────────
def _run_wasm(
    tmdb_id: int,
    media_type: str,
    season: int = 0,
    episode: int = 0,
    title: str = "",
    year: str = "",
    imdb_id: str = "",
    total_seasons: str = "1",
) -> Optional[dict]:
    """
    Call the Node.js WASM runner that hits the Videasy API and decrypts sources.
    Returns the parsed JSON dict on success, None on failure.
    """
    args = [
        "node", str(_RUNNER),
        str(tmdb_id),
        media_type,
        str(season) if season else "",
        str(episode) if episode else "",
        title, year, imdb_id, total_seasons,
    ]
    try:
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=40,
            cwd=str(_WASM_DIR),
        )
        out = result.stdout.strip()
        if not out:
            return None
        data = json.loads(out)
        return data if data.get("success") else None
    except Exception:
        return None



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


# ── Helpers ───────────────────────────────────────────────────────────────────
def _quality_rank(q: str) -> int:
    s = str(q).lower()
    if "1080" in s: return 0
    if "720"  in s: return 1
    if "480"  in s: return 2
    if "360"  in s: return 3
    return 4


def _quality_label(q: str) -> str:
    s = str(q).lower()
    if "1080" in s: return "1080p"
    if "720"  in s: return "720p"
    if "480"  in s: return "480p"
    if "360"  in s: return "360p"
    return "Auto"


def _proxied_url(m3u8_url: str) -> str:
    return "/api/proxy/hls?url=" + urllib.parse.quote(m3u8_url, safe="")


_QUALITY_BW = {"1080p": "8000000", "720p": "3000000", "480p": "1500000", "360p": "800000"}
_QUALITY_RES = {"1080p": "1920x1080", "720p": "1280x720", "480p": "854x480", "360p": "640x360"}


def _build_master_url(candidate_sources: list) -> str:
    """
    Build a /api/proxy/master URL that wraps multiple Videasy media playlists
    in a synthetic HLS master playlist so HLS.js follows the master→level→segment
    code path (which probes the first segment before calling addSourceBuffer).
    This avoids the bufferAddCodecError that occurs when loading bare media
    playlists whose codec HLS.js cannot determine before the first segment fetch.
    """
    parts: list[str] = []
    for s in candidate_sources:
        label   = _quality_label(s.get("quality", ""))
        proxied = _proxied_url(s["url"])
        bw      = _QUALITY_BW.get(label, "2000000")
        res     = _QUALITY_RES.get(label, "1280x720")
        parts.append("url=" + urllib.parse.quote(proxied, safe=""))
        parts.append("bw="  + bw)
        parts.append("res=" + urllib.parse.quote(res, safe=""))
    return "/api/proxy/master?" + "&".join(parts)


def _build_captions(subtitles: list) -> List[Caption]:
    caps = []
    seen = set()
    for sub in subtitles:
        lang = sub.get("language") or sub.get("lang", "")
        url  = sub.get("url", "")
        if lang and url and lang not in seen:
            seen.add(lang)
            caps.append(Caption(language=lang, url=url))
    return caps


async def _url_reachable(url: str) -> bool:
    """Quick HEAD check to confirm the upstream CDN URL is alive."""
    parsed = urllib.parse.urlparse(url)
    host = parsed.netloc.lower()
    if any(d in host for d in ("vidplus.dev", "videasy.net", "megafiles.store",
                                "nightbreeze", "shadowpanda", "quietlynx",
                                "aurorabird", "skyember", "cloudrabbit")):
        ref = "https://player.videasy.net/"
    else:
        ref = "https://vidlink.pro/"
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            r = await client.head(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
                    "Referer": ref,
                },
                follow_redirects=True,
            )
            return r.status_code < 500
    except Exception:
        return True  # assume reachable if check times out — player will handle errors


async def _resolve(
    tmdb_id: int,
    media_type: str,
    season: int = 0,
    episode: int = 0,
    title: str = "",
    year: str = "",
    imdb_id: str = "",
    total_seasons: str = "1",
) -> StreamResponse:
    """Run WASM in a thread → validate URLs → return proxied sources sorted by quality."""
    loop = asyncio.get_event_loop()

    result = await loop.run_in_executor(
        None,
        lambda: _run_wasm(tmdb_id, media_type, season, episode, title, year, imdb_id, total_seasons),
    )
    if not result:
        return StreamResponse(sources=[])

    captions    = _build_captions(result.get("subtitles", []))
    raw_sources = sorted(result.get("sources", []), key=lambda s: _quality_rank(s.get("quality", "")))

    candidate_sources = [
        s for s in raw_sources
        if s.get("url") and ".m3u8" in s["url"]
    ]

    if not candidate_sources:
        return StreamResponse(sources=[])

    # Validate the first (best quality) source URL is actually reachable.
    # If the CDN worker is dead, skip all sources rather than returning a broken URL.
    first_url = candidate_sources[0]["url"]
    if not await _url_reachable(first_url):
        return StreamResponse(sources=[])

    # Wrap all quality levels in a synthetic master playlist so HLS.js
    # probes the first segment before creating the SourceBuffer. This avoids
    # the bufferAddCodecError that occurs with raw media playlists.
    sources = [
        StreamSource(
            name="Videasy",
            url=_build_master_url(candidate_sources),
            source_type="hls",
            captions=captions,
        )
    ]
    return StreamResponse(sources=sources)


# ── Routes ────────────────────────────────────────────────────────────────────
@router.get("/stream/movie/{tmdb_id}/videasy", response_model=StreamResponse)
async def stream_movie(
    tmdb_id: int,
    title:   str = Query(default=""),
    year:    str = Query(default=""),
    imdb_id: str = Query(default=""),
):
    key    = _cache_key(tmdb_id, "movie")
    cached = _get_cached(key)
    if cached:
        return cached

    resp = await _resolve(tmdb_id, "movie", title=title, year=year, imdb_id=imdb_id)
    if resp.sources:
        _set_cached(key, resp)
    return resp


@router.get("/stream/tv/{tmdb_id}/{season}/{episode}/videasy", response_model=StreamResponse)
async def stream_tv(
    tmdb_id:       int,
    season:        int,
    episode:       int,
    title:         str = Query(default=""),
    year:          str = Query(default=""),
    imdb_id:       str = Query(default=""),
    total_seasons: str = Query(default="1"),
):
    key    = _cache_key(tmdb_id, "tv", season, episode)
    cached = _get_cached(key)
    if cached:
        return cached

    resp = await _resolve(
        tmdb_id, "tv", season, episode,
        title=title, year=year, imdb_id=imdb_id, total_seasons=total_seasons,
    )
    if resp.sources:
        _set_cached(key, resp)
    return resp
