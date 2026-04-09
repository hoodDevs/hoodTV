import json
import subprocess
import asyncio
import time
import urllib.parse
from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

WASM_DIR = Path(__file__).parent.parent / "vidlink_wasm"
RUNNER = WASM_DIR / "runner.cjs"

_cache: dict = {}
_CACHE_TTL = 3600


def _cache_key(tmdb_id: int, media_type: str, season: int = 0, episode: int = 0) -> str:
    return f"{media_type}:{tmdb_id}:{season}:{episode}"


def _get_cached(key: str):
    entry = _cache.get(key)
    if entry and time.time() < entry["expires"]:
        return entry["data"]
    return None


def _set_cache(key: str, data: dict):
    _cache[key] = {"data": data, "expires": time.time() + _CACHE_TTL}


def _run_wasm(tmdb_id: int, media_type: str, season: int = 0, episode: int = 0) -> Optional[dict]:
    args = ["node", str(RUNNER), str(tmdb_id), media_type]
    if media_type == "tv":
        args += [str(season), str(episode)]
    try:
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=25,
            cwd=str(WASM_DIR),
        )
        stdout = result.stdout.strip()
        if not stdout:
            return None
        parsed = json.loads(stdout)
        if parsed.get("success") and parsed.get("data"):
            return parsed["data"]
        return None
    except Exception:
        return None


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


def _wasm_result_to_source(data: dict) -> Optional[StreamSource]:
    stream = data.get("stream", {})
    playlist = stream.get("playlist")
    if not playlist:
        return None

    proxied_url = f"/api/proxy/hls?url={urllib.parse.quote(playlist, safe='')}"

    captions = []
    for cap in stream.get("captions", []):
        lang = cap.get("language", "")
        url = cap.get("url", "")
        if url and lang:
            captions.append(Caption(language=lang, url=url))

    return StreamSource(
        name="VidLink",
        url=proxied_url,
        source_type="hls",
        captions=captions,
    )


@router.get("/stream/movie/{tmdb_id}", response_model=StreamResponse)
async def get_movie_stream(tmdb_id: int):
    key = _cache_key(tmdb_id, "movie")
    cached = _get_cached(key)
    if cached:
        return cached

    data = await asyncio.get_event_loop().run_in_executor(
        None, _run_wasm, tmdb_id, "movie", 0, 0
    )
    source = _wasm_result_to_source(data) if data else None
    sources = [source] if source else []
    response = StreamResponse(sources=sources)
    if sources:
        _set_cache(key, response)
    return response


@router.get("/stream/tv/{tmdb_id}/{season}/{episode}", response_model=StreamResponse)
async def get_tv_stream(tmdb_id: int, season: int, episode: int):
    key = _cache_key(tmdb_id, "tv", season, episode)
    cached = _get_cached(key)
    if cached:
        return cached

    data = await asyncio.get_event_loop().run_in_executor(
        None, _run_wasm, tmdb_id, "tv", season, episode
    )
    source = _wasm_result_to_source(data) if data else None
    sources = [source] if source else []
    response = StreamResponse(sources=sources)
    if sources:
        _set_cache(key, response)
    return response
