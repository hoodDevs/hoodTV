"""
HLS proxy router.

All HLS playlists and media segments are fetched through Scrapling's Fetcher
(stealthy headers, Chrome fingerprint, anti-bot bypass) and served with
correct CORS headers so the browser player can consume them without CORS errors.
"""
import urllib.parse
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from scrapling.fetchers import Fetcher

router  = APIRouter()

# One shared Fetcher instance — Scrapling handles session/connection pooling
_fetcher = Fetcher()

# Every CDN we've seen serving Videasy content uses the same referer/origin
_VIDEASY_DOMAINS = [
    "vidplus.dev",
    "videasy.net",
    "megafiles.store",
    "serversicuro.cc",
    "uskevinpowell89.workers.dev",
    "skyember44.online",
    "skyember",
    "cloudrabbit99.online",
    "cloudrabbit",
]

_PLAYLIST_CT = "application/vnd.apple.mpegurl"
_SEGMENT_CT  = "video/mp2t"
_VTT_CT      = "text/vtt; charset=utf-8"

_CORS = {"Access-Control-Allow-Origin": "*"}


def _extra_headers(url: str) -> dict:
    """
    Return CDN-specific Referer/Origin headers.
    Videasy CDNs require player.videasy.net as the referrer.
    Everything else gets vidlink.pro as a safe fallback.
    """
    host = urllib.parse.urlparse(url).netloc.lower()
    if any(d in host for d in _VIDEASY_DOMAINS):
        return {
            "Referer": "https://player.videasy.net/",
            "Origin":  "https://player.videasy.net",
        }
    return {
        "Referer": "https://vidlink.pro/",
        "Origin":  "https://vidlink.pro",
    }


def _fetch(url: str):
    """
    Fetch a URL with Scrapling (stealthy Chrome fingerprint, auto-headers).
    Returns the Scrapling Response object or raises an exception.
    """
    return _fetcher.get(
        url,
        stealthy_headers=True,
        headers=_extra_headers(url),
        follow_redirects=True,
        timeout=25,
    )


def _proxify(url: str) -> str:
    return "/api/proxy/hls?url=" + urllib.parse.quote(url, safe="")


def _rewrite_playlist(text: str, base_url: str) -> str:
    """
    Rewrite every non-comment line in an m3u8 so all URLs go through this proxy.
    Resolves relative paths against base_url (the final URL after any redirects).
    """
    parsed = urllib.parse.urlparse(base_url)
    scheme_host = f"{parsed.scheme}://{parsed.netloc}"
    out = []
    for line in text.splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            out.append(line)
            continue
        if s.startswith("http://") or s.startswith("https://"):
            abs_url = s
        elif s.startswith("//"):
            abs_url = "https:" + s
        elif s.startswith("/"):
            abs_url = scheme_host + s
        else:
            abs_url = urllib.parse.urljoin(base_url, s)
        out.append(_proxify(abs_url))
    return "\n".join(out)


def _wrap_media_as_master(media_proxy_url: str, upstream_url: str) -> str:
    """
    Wrap a single media-playlist URL in a synthetic master playlist.
    HLS.js works most reliably when given a master playlist first.
    """
    u = upstream_url.upper()
    if "1080" in u or "MTA4MA" in u:
        bw, res = 4_000_000, "1920x1080"
    elif "720" in u or "NzIw" in u:
        bw, res = 2_000_000, "1280x720"
    elif "480" in u or "NDgw" in u:
        bw, res = 1_200_000, "854x480"
    else:
        bw, res = 2_000_000, "1280x720"

    return (
        "#EXTM3U\n"
        "#EXT-X-VERSION:3\n"
        f"#EXT-X-STREAM-INF:BANDWIDTH={bw},RESOLUTION={res}\n"
        f"{media_proxy_url}\n"
    )


# ── Main endpoint ─────────────────────────────────────────────────────────────
@router.api_route("/proxy/hls", methods=["GET", "HEAD", "OPTIONS"])
async def proxy_hls(request: Request, url: str = "", as_media: int = 0):
    """
    GET  /api/proxy/hls?url=<upstream>          → master playlist (or segment)
    GET  /api/proxy/hls?url=<upstream>&as_media=1 → raw media playlist (segments proxied)
    HEAD /api/proxy/hls?url=<upstream>          → headers only
    OPTIONS                                      → CORS preflight
    """
    if request.method == "OPTIONS":
        return Response(
            headers={
                **_CORS,
                "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
                "Access-Control-Allow-Headers": "*",
            }
        )

    if not url.startswith("http"):
        raise HTTPException(400, "url param must start with http")

    # Fetch via Scrapling — stealthy Chrome fingerprint, correct referer
    try:
        resp = _fetch(url)
    except Exception as exc:
        raise HTTPException(502, f"upstream fetch failed: {exc}")

    if resp.status >= 400:
        raise HTTPException(resp.status, "upstream returned error")

    # Determine resource type
    ct       = (resp.headers.get("content-type") or "").lower()
    raw_path = url.split("?")[0].lower()
    is_m3u8  = "mpegurl" in ct or raw_path.endswith(".m3u8")
    is_vtt   = raw_path.endswith(".vtt")
    is_sub   = raw_path.endswith(".srt") or raw_path.endswith(".ass")

    # ── Playlist ──────────────────────────────────────────────────────────────
    if is_m3u8:
        if request.method == "HEAD":
            return Response(headers={**_CORS, "Content-Type": _PLAYLIST_CT, "Cache-Control": "no-cache"})

        body     = resp.text
        base_url = str(resp.url) if resp.url else url  # post-redirect URL for correct relative resolution

        # Real master playlist (multiple variants) → just rewrite variant URLs
        if "#EXT-X-STREAM-INF" in body:
            return Response(
                content=_rewrite_playlist(body, base_url),
                headers={**_CORS, "Content-Type": _PLAYLIST_CT, "Cache-Control": "no-cache"},
            )

        # Media playlist requested directly (&as_media=1) → rewrite segments
        if as_media:
            return Response(
                content=_rewrite_playlist(body, base_url),
                headers={**_CORS, "Content-Type": _PLAYLIST_CT, "Cache-Control": "no-cache"},
            )

        # Media playlist first call → wrap in synthetic master so HLS.js gets quality info
        media_proxy = _proxify(url) + "&as_media=1"
        return Response(
            content=_wrap_media_as_master(media_proxy, url),
            headers={**_CORS, "Content-Type": _PLAYLIST_CT, "Cache-Control": "no-cache"},
        )

    # ── Subtitle / caption files ───────────────────────────────────────────────
    if is_vtt:
        return Response(
            content=b"" if request.method == "HEAD" else resp.body,
            headers={**_CORS, "Content-Type": _VTT_CT, "Cache-Control": "max-age=3600"},
        )

    if is_sub:
        return Response(
            content=b"" if request.method == "HEAD" else resp.body,
            headers={**_CORS, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "max-age=3600"},
        )

    # ── Segment ───────────────────────────────────────────────────────────────
    # CDNs disguise TS segments with fake extensions (.jpg .html .js .css).
    # Always serve as video/mp2t — the player ignores the fake extension.
    return Response(
        content=b"" if request.method == "HEAD" else resp.body,
        headers={**_CORS, "Content-Type": _SEGMENT_CT, "Cache-Control": "max-age=3600"},
    )
