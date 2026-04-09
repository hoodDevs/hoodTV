"""
VidSrc embed router.

Returns embed iframe URLs for movies and TV shows using vidsrc.to and vidsrc.me.
These are last-resort sources — the player renders them in an iframe instead of
via HLS.js. They require no extraction chain and have extremely broad coverage.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter()


class Caption(BaseModel):
    language: str
    url: str


class StreamSource(BaseModel):
    name: str
    url: str
    source_type: str = "embed"
    captions: List[Caption] = []


class StreamResponse(BaseModel):
    sources: List[StreamSource]


@router.get("/stream/movie/{tmdb_id}/vidsrc", response_model=StreamResponse)
async def stream_movie_vidsrc(tmdb_id: int):
    sources = [
        StreamSource(
            name="VidSrc",
            url=f"https://vidsrc.to/embed/movie/{tmdb_id}",
            source_type="embed",
        ),
        StreamSource(
            name="VidSrc Alt",
            url=f"https://vidsrc.me/embed/movie?tmdb={tmdb_id}",
            source_type="embed",
        ),
    ]
    return StreamResponse(sources=sources)


@router.get("/stream/tv/{tmdb_id}/{season}/{episode}/vidsrc", response_model=StreamResponse)
async def stream_tv_vidsrc(tmdb_id: int, season: int, episode: int):
    sources = [
        StreamSource(
            name="VidSrc",
            url=f"https://vidsrc.to/embed/tv/{tmdb_id}/{season}/{episode}",
            source_type="embed",
        ),
        StreamSource(
            name="VidSrc Alt",
            url=f"https://vidsrc.me/embed/tv?tmdb={tmdb_id}&season={season}&episode={episode}",
            source_type="embed",
        ),
    ]
    return StreamResponse(sources=sources)
