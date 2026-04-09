import time
import urllib.parse
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from curl_cffi import requests as cffi_requests

router = APIRouter()

# Chrome UA for impersonation
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

# All known CDN hosts that serve Videasy content
VIDEASY_DOMAINS = [
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

VIDEASY_REFERER = "https://player.videasy.net/"
VIDEASY_ORIGIN  = "https://player.videasy.net"
DEFAULT_REFERER = "https://vidlink.pro/"
DEFAULT_ORIGIN  = "https://vidlink.pro"


def _headers_for(url: str) -> dict:
    host = urllib.parse.urlparse(url).netloc.lower()
    if any(d in host for d in VIDEASY_DOMAINS):
        ref, ori = VIDEASY_REFERER, VIDEASY_ORIGIN
    else:
        ref, ori = DEFAULT_REFERER, DEFAULT_ORIGIN
    return {
        "User-Agent": UA,
        "Referer": ref,
        "Origin": ori,
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
    }


def _fetch(url: str, retries: int = 2, timeout: int = 25):
    """Fetch url with Chrome impersonation. Returns (response, final_url)."""
    err = None
    for attempt in range(retries + 1):
        try:
            sess = cffi_requests.Session(impersonate="chrome131")
            r = sess.get(url, headers=_headers_for(url), timeout=timeout, allow_redirects=True)
            final = getattr(r, "url", None) or url
            if r.status_code == 200:
                return r, final
            if r.status_code in (429, 503) and attempt < retries:
                time.sleep(1.5 * (attempt + 1))
                continue
            return r, final
        except Exception as e:
            err = e
            if attempt < retries:
                time.sleep(1.0 * (attempt + 1))
    raise err or RuntimeError("fetch failed")


def _proxify(url: str) -> str:
    """Return a proxy URL for an upstream URL."""
    return "/api/proxy/hls?url=" + urllib.parse.quote(url, safe="")


def _rewrite_playlist(text: str, base: str) -> str:
    """
    Rewrite every non-comment line in an m3u8 to go through the proxy.
    Resolves relative URLs against `base` (the final URL after redirects).
    """
    scheme_host = urllib.parse.urlparse(base)
    scheme_host = f"{scheme_host.scheme}://{scheme_host.netloc}"
    out = []
    for line in text.splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            out.append(line)
            continue
        # Resolve to absolute
        if s.startswith("http://") or s.startswith("https://"):
            abs_url = s
        elif s.startswith("//"):
            abs_url = "https:" + s
        elif s.startswith("/"):
            abs_url = scheme_host + s
        else:
            abs_url = urllib.parse.urljoin(base, s)
        out.append(_proxify(abs_url))
    return "\n".join(out)


def _wrap_as_master(media_proxy_url: str, upstream_url: str) -> str:
    """
    Wrap a single media playlist URL in a minimal synthetic master playlist.
    This gives HLS.js a consistent entry point with STREAM-INF metadata.
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


PLAYLIST_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache, no-store",
    "Content-Type": "application/vnd.apple.mpegurl",
}

SEGMENT_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "max-age=3600",
    "Content-Type": "video/mp2t",
}


@router.api_route("/proxy/hls", methods=["GET", "HEAD", "OPTIONS"])
async def proxy_hls(request: Request, url: str, as_media: int = 0):
    """
    Single-endpoint HLS proxy.

    GET /api/proxy/hls?url=<upstream_url>
      → if it's an m3u8: returns a synthetic master playlist wrapping the media playlist
      → if it's a segment: returns the raw bytes as video/mp2t

    GET /api/proxy/hls?url=<upstream_url>&as_media=1
      → returns the rewritten media playlist directly (segments proxied)
    """
    if request.method == "OPTIONS":
        return Response(
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
                "Access-Control-Allow-Headers": "*",
            }
        )

    if not url.startswith("http"):
        raise HTTPException(400, "url must start with http")

    try:
        resp, final_url = _fetch(url)
    except Exception as exc:
        raise HTTPException(502, f"upstream error: {exc}")

    if resp.status_code != 200:
        raise HTTPException(resp.status_code, "upstream returned non-200")

    ct = resp.headers.get("content-type", "").lower()
    is_m3u8 = "mpegurl" in ct or url.split("?")[0].lower().endswith(".m3u8")

    # ── PLAYLIST ────────────────────────────────────────────────────────────
    if is_m3u8:
        body = resp.text

        # Already a master playlist (has variant stream entries) → just rewrite
        if "#EXT-X-STREAM-INF" in body:
            return Response(
                content=_rewrite_playlist(body, final_url),
                headers=PLAYLIST_HEADERS,
            )

        # Media playlist requested via &as_media=1 → rewrite segments and return
        if as_media:
            return Response(
                content=_rewrite_playlist(body, final_url),
                headers=PLAYLIST_HEADERS,
            )

        # Media playlist accessed directly (first call) →
        # return a synthetic master that points back here with as_media=1
        media_proxy = _proxify(url) + "&as_media=1"
        return Response(
            content=_wrap_as_master(media_proxy, url),
            headers=PLAYLIST_HEADERS,
        )

    # ── SUBTITLES ───────────────────────────────────────────────────────────
    raw_path = url.split("?")[0].lower()

    if raw_path.endswith(".vtt"):
        h = {"Access-Control-Allow-Origin": "*", "Cache-Control": "max-age=3600", "Content-Type": "text/vtt; charset=utf-8"}
        return Response(content=b"" if request.method == "HEAD" else resp.content, headers=h)

    if raw_path.endswith(".srt") or raw_path.endswith(".ass"):
        h = {"Access-Control-Allow-Origin": "*", "Cache-Control": "max-age=3600", "Content-Type": "text/plain; charset=utf-8"}
        return Response(content=b"" if request.method == "HEAD" else resp.content, headers=h)

    # ── SEGMENT ─────────────────────────────────────────────────────────────
    # CDN disguises TS segments with fake extensions (.jpg .html .js .css).
    # Always serve them as video/mp2t so the player can decode them.
    if request.method == "HEAD":
        return Response(headers=SEGMENT_HEADERS)

    return Response(content=resp.content, headers=SEGMENT_HEADERS)
