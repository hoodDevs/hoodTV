import json
import subprocess
import asyncio
import time
import urllib.parse
import os
from pathlib import Path
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import List, Optional
from curl_cffi import requests as cffi_requests

router = APIRouter()

WASM_DIR = Path(__file__).parent.parent / "videasy_wasm"
RUNNER = WASM_DIR / "runner.cjs"

_cache: dict = {}
_CACHE_TTL = 3600

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
_VIDEASY_HEADERS = {
    "User-Agent": _UA,
    "Referer": "https://player.videasy.net/",
    "Origin": "https://player.videasy.net",
}


def _cache_key(tmdb_id: int, media_type: str, season: int = 0, episode: int = 0) -> str:
    return f"videasy:{media_type}:{tmdb_id}:{season}:{episode}"


def _get_cached(key: str):
    entry = _cache.get(key)
    if entry and time.time() < entry["expires"]:
        return entry["data"]
    return None


def _set_cache(key: str, data: dict):
    _cache[key] = {"data": data, "expires": time.time() + _CACHE_TTL}


def _run_videasy(
    tmdb_id: int,
    media_type: str,
    season: int = 0,
    episode: int = 0,
    title: str = "",
    year: str = "",
    imdb_id: str = "",
    total_seasons: str = "1",
) -> Optional[dict]:
    args = [
        "node",
        str(RUNNER),
        str(tmdb_id),
        media_type,
        str(season) if season else "",
        str(episode) if episode else "",
        title,
        year,
        imdb_id,
        total_seasons,
    ]
    try:
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=35,
            cwd=str(WASM_DIR),
        )
        stdout = result.stdout.strip()
        if not stdout:
            return None
        parsed = json.loads(stdout)
        if parsed.get("success"):
            return parsed
        return None
    except Exception:
        return None


async def _check_url_reachable(url: str, timeout_s: float = 5.0) -> bool:
    """Quick HEAD check to verify the CDN URL is reachable from this server."""
    try:
        async with cffi_requests.AsyncSession(impersonate="chrome131") as sess:
            resp = await asyncio.wait_for(
                sess.head(url, headers=_VIDEASY_HEADERS, timeout=int(timeout_s)),
                timeout=timeout_s + 1,
            )
            return resp.status_code < 500
    except Exception:
        return False


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


def quality_rank(q: str) -> int:
    q = str(q).lower()
    if "1080" in q:
        return 0
    if "720" in q:
        return 1
    if "480" in q:
        return 2
    if "360" in q:
        return 3
    return 4


def quality_label(q: str) -> str:
    q = str(q).lower()
    if "1080" in q:
        return "1080p"
    if "720" in q:
        return "720p"
    if "480" in q:
        return "480p"
    if "360" in q:
        return "360p"
    return "Auto"


def _make_stream_source(src: dict, captions: List[Caption]) -> Optional[StreamSource]:
    m3u8_url = src.get("url", "")
    if not m3u8_url or ".m3u8" not in m3u8_url:
        return None
    proxied_url = f"/api/proxy/hls?url={urllib.parse.quote(m3u8_url, safe='')}"
    qlabel = quality_label(src.get("quality", ""))
    return StreamSource(
        name=qlabel,
        url=proxied_url,
        source_type="hls",
        captions=captions,
    )


async def _build_sources(result: dict) -> List[StreamSource]:
    subtitles = result.get("subtitles", [])
    captions = []
    for sub in subtitles:
        lang = sub.get("language") or sub.get("lang", "")
        url = sub.get("url", "")
        if url and lang:
            captions.append(Caption(language=lang, url=url))

    raw_sources = result.get("sources", [])
    sorted_sources = sorted(raw_sources, key=lambda s: quality_rank(s.get("quality", "")))

    async def _check_and_build(src):
        m3u8_url = src.get("url", "")
        if not m3u8_url or ".m3u8" not in m3u8_url:
            return None
        reachable = await _check_url_reachable(m3u8_url)
        if not reachable:
            return None
        return _make_stream_source(src, captions)

    tasks = [_check_and_build(src) for src in sorted_sources]
    check_results = await asyncio.gather(*tasks)
    valid_sources = [r for r in check_results if r is not None]

    if valid_sources:
        return valid_sources

    # Fallback: if all CDN checks fail (e.g. server-side CDN restrictions),
    # include sources unvalidated so the player can attempt them directly.
    fallback = [_make_stream_source(s, captions) for s in sorted_sources]
    return [s for s in fallback if s is not None]


@router.get("/stream/movie/{tmdb_id}/videasy", response_model=StreamResponse)
async def get_movie_videasy(
    tmdb_id: int,
    title: str = Query(default=""),
    year: str = Query(default=""),
    imdb_id: str = Query(default=""),
):
    key = _cache_key(tmdb_id, "movie")
    cached = _get_cached(key)
    if cached:
        return cached

    result = await asyncio.get_event_loop().run_in_executor(
        None,
        lambda: _run_videasy(tmdb_id, "movie", title=title, year=year, imdb_id=imdb_id),
    )
    sources = await _build_sources(result) if result else []
    response = StreamResponse(sources=sources)
    if sources:
        _set_cache(key, response)
    return response


@router.get("/stream/tv/{tmdb_id}/{season}/{episode}/videasy", response_model=StreamResponse)
async def get_tv_videasy(
    tmdb_id: int,
    season: int,
    episode: int,
    title: str = Query(default=""),
    year: str = Query(default=""),
    imdb_id: str = Query(default=""),
    total_seasons: str = Query(default="1"),
):
    key = _cache_key(tmdb_id, "tv", season, episode)
    cached = _get_cached(key)
    if cached:
        return cached

    result = await asyncio.get_event_loop().run_in_executor(
        None,
        lambda: _run_videasy(
            tmdb_id, "tv", season, episode,
            title=title, year=year, imdb_id=imdb_id, total_seasons=total_seasons
        ),
    )
    sources = await _build_sources(result) if result else []
    response = StreamResponse(sources=sources)
    if sources:
        _set_cache(key, response)
    return response
