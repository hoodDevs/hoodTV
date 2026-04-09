"""
MovieBox stream router.

Uses the moviebox-api library to search for movies/TV shows on moviebox.ph
and return direct CDN MP4 URLs (no iframes, no embeds).

CDN URLs are signed and expire in ~60 min, so we cache for 25 min.
"""
import time
from typing import List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from moviebox_api.v2.requests import Session as MBSession
from moviebox_api.v2.core import Search
from moviebox_api.v2.download import (
    DownloadableSingleFilesDetail,
    DownloadableTVSeriesFilesDetail,
)

router = APIRouter()

# ── Shared session (one per process) ─────────────────────────────────────────
_session: Optional[MBSession] = None


def _get_session() -> MBSession:
    global _session
    if _session is None:
        _session = MBSession()
    return _session


# ── In-memory cache ───────────────────────────────────────────────────────────
_cache: dict = {}
_CACHE_TTL = 1500  # 25 min — CDN signed URLs expire in ~60 min


def _cache_key(tmdb_id: int, kind: str, season: int = 0, episode: int = 0) -> str:
    return f"mb:{kind}:{tmdb_id}:{season}:{episode}"


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
    source_type: str = "mp4"
    captions: List[Caption] = []


class StreamResponse(BaseModel):
    sources: List[StreamSource]


# ── Constants ─────────────────────────────────────────────────────────────────
_SUBJECT_MOVIE = 1
_SUBJECT_TV    = 2


# ── Helpers ───────────────────────────────────────────────────────────────────
def _quality_label(res: int) -> str:
    return f"{res}p"


def _build_captions(raw_captions: list) -> List[Caption]:
    out = []
    seen: set = set()
    for c in raw_captions:
        lang = c.get("lan") or ""
        url  = str(c.get("url") or "")
        if lang and url and lang not in seen:
            seen.add(lang)
            out.append(Caption(language=lang, url=url))
    return out


async def _search_best_match(title: str, subject_type: int):
    """Return the best-matching MovieBox item for *title* and *subject_type*."""
    session = _get_session()
    search  = Search(session, title)
    results = await search.get_content_model()

    candidates = [i for i in results.items if i.subjectType == subject_type]
    if not candidates:
        return None

    if subject_type == _SUBJECT_TV:
        # pick the entry with the most seasons so all episodes are available
        return max(candidates, key=lambda i: i.season)
    return candidates[0]


async def _resolve_movie(title: str, year: str) -> StreamResponse:
    try:
        session = _get_session()
        item = await _search_best_match(title, _SUBJECT_MOVIE)
        if not item:
            return StreamResponse(sources=[])

        dl      = DownloadableSingleFilesDetail(session, item)
        content = await dl.get_content()

        downloads = content.get("downloads", [])
        if not downloads or content.get("limited"):
            return StreamResponse(sources=[])

        captions   = _build_captions(content.get("captions", []))
        sorted_dl  = sorted(downloads, key=lambda d: d.get("resolution", 0), reverse=True)

        return StreamResponse(sources=[
            StreamSource(
                name=_quality_label(d.get("resolution", 0)),
                url=str(d.get("url", "")),
                source_type="mp4",
                captions=captions,
            )
            for d in sorted_dl if d.get("url")
        ])
    except Exception:
        return StreamResponse(sources=[])


async def _resolve_tv(title: str, year: str, season: int, episode: int) -> StreamResponse:
    try:
        session = _get_session()
        item = await _search_best_match(title, _SUBJECT_TV)
        if not item:
            return StreamResponse(sources=[])

        dl      = DownloadableTVSeriesFilesDetail(session, item)
        content = await dl.get_content(season=season, episode=episode)

        downloads = content.get("downloads", [])
        if not downloads or content.get("limited"):
            return StreamResponse(sources=[])

        captions  = _build_captions(content.get("captions", []))
        sorted_dl = sorted(downloads, key=lambda d: d.get("resolution", 0), reverse=True)

        return StreamResponse(sources=[
            StreamSource(
                name=_quality_label(d.get("resolution", 0)),
                url=str(d.get("url", "")),
                source_type="mp4",
                captions=captions,
            )
            for d in sorted_dl if d.get("url")
        ])
    except Exception:
        return StreamResponse(sources=[])


# ── Routes ────────────────────────────────────────────────────────────────────
@router.get("/stream/movie/{tmdb_id}/moviebox", response_model=StreamResponse)
async def stream_movie_moviebox(
    tmdb_id: int,
    title:   str = Query(default=""),
    year:    str = Query(default=""),
):
    key    = _cache_key(tmdb_id, "movie")
    cached = _get_cached(key)
    if cached:
        return cached

    resp = await _resolve_movie(title, year)
    if resp.sources:
        _set_cached(key, resp)
    return resp


@router.get("/stream/tv/{tmdb_id}/{season}/{episode}/moviebox", response_model=StreamResponse)
async def stream_tv_moviebox(
    tmdb_id: int,
    season:  int,
    episode: int,
    title:   str = Query(default=""),
    year:    str = Query(default=""),
):
    key    = _cache_key(tmdb_id, "tv", season, episode)
    cached = _get_cached(key)
    if cached:
        return cached

    resp = await _resolve_tv(title, year, season, episode)
    if resp.sources:
        _set_cached(key, resp)
    return resp
