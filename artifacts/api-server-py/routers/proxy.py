"""
HLS proxy router.

All HLS playlists and media segments are fetched through httpx with correct
Referer/Origin spoofing and served with CORS headers so the browser player
can consume them without errors.

Uses an async httpx client for fast concurrent segment downloads.
"""
import urllib.parse
import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

router = APIRouter()

_BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

_client = httpx.AsyncClient(
    follow_redirects=True,
    timeout=30.0,
    limits=httpx.Limits(max_connections=100, max_keepalive_connections=40),
    headers={"User-Agent": _BROWSER_UA},
)

_VIDEASY_DOMAINS = [
    "vidplus.dev",
    "videasy.net",
    "megafiles.store",
    "serversicuro.cc",
    "uskevinpowell89.workers.dev",
    "skyember",
    "cloudrabbit",
    "nightbreeze",
    "shadowpanda",
    "quietlynx",
    "aurorabird",
]

_NONTONGO_PLAYER_DOMAINS = [
    "player.nontongo.win",
    "nontongo.playerp2p.online",
]

_PLAYLIST_CT = "application/vnd.apple.mpegurl"
_SEGMENT_CT  = "video/mp2t"
_VTT_CT      = "text/vtt; charset=utf-8"

_CORS = {"Access-Control-Allow-Origin": "*"}


def _extra_headers(url: str) -> dict:
    host = urllib.parse.urlparse(url).netloc.lower()
    if any(d in host for d in _VIDEASY_DOMAINS):
        return {
            "Referer": "https://player.videasy.net/",
            "Origin":  "https://player.videasy.net",
        }
    if any(d in host for d in _NONTONGO_PLAYER_DOMAINS):
        return {
            "Referer": "https://player.nontongo.win/",
            "Origin":  "https://player.nontongo.win",
        }
    return {
        "Referer": "https://vidlink.pro/",
        "Origin":  "https://vidlink.pro",
    }


async def _fetch(url: str) -> httpx.Response:
    try:
        resp = await _client.get(url, headers=_extra_headers(url))
    except Exception as exc:
        raise HTTPException(502, f"upstream fetch failed: {exc}")
    if resp.status_code >= 400:
        raise HTTPException(resp.status_code, f"upstream error {resp.status_code}")
    return resp


def _proxify(url: str) -> str:
    return "/api/proxy/hls?url=" + urllib.parse.quote(url, safe="")


def _rewrite_playlist(text: str, base_url: str) -> str:
    """
    Rewrite all non-comment lines in an HLS playlist (master or media)
    so every URL is routed through our proxy.
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


@router.api_route("/proxy/hls", methods=["GET", "HEAD", "OPTIONS"])
async def proxy_hls(request: Request, url: str = ""):
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

    resp = await _fetch(url)

    ct       = (resp.headers.get("content-type") or "").lower()
    raw_path = url.split("?")[0].lower()
    is_m3u8  = "mpegurl" in ct or raw_path.endswith(".m3u8")
    is_vtt   = raw_path.endswith(".vtt")
    is_sub   = raw_path.endswith(".srt") or raw_path.endswith(".ass")

    if is_m3u8:
        if request.method == "HEAD":
            return Response(headers={**_CORS, "Content-Type": _PLAYLIST_CT, "Cache-Control": "no-cache"})

        body     = resp.content.decode("utf-8", "replace")
        base_url = str(resp.url)

        # Rewrite all URLs (works for both master and media playlists).
        # Never wrap media playlists in a fake master — HLS.js handles them
        # directly, and double-wrapping causes "corrupt file" errors.
        return Response(
            content=_rewrite_playlist(body, base_url),
            headers={**_CORS, "Content-Type": _PLAYLIST_CT, "Cache-Control": "no-cache"},
        )

    if is_vtt:
        return Response(
            content=b"" if request.method == "HEAD" else resp.content,
            headers={**_CORS, "Content-Type": _VTT_CT, "Cache-Control": "max-age=3600"},
        )

    if is_sub:
        return Response(
            content=b"" if request.method == "HEAD" else resp.content,
            headers={**_CORS, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "max-age=3600"},
        )

    # Media segment — guard against CDN returning an HTML error page with 200 OK,
    # which would cause HLS.js to push non-MPEG-TS data into the SourceBuffer
    # and trigger the browser's "file is corrupt" error.
    content = resp.content
    if content and content[:5].lstrip(b" \t\r\n").startswith(b"<"):
        raise HTTPException(502, "upstream returned HTML instead of segment data")

    return Response(
        content=b"" if request.method == "HEAD" else content,
        headers={**_CORS, "Content-Type": _SEGMENT_CT, "Cache-Control": "max-age=3600"},
    )
