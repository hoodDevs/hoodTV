import re
import time
import urllib.parse
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response, StreamingResponse
from curl_cffi import requests as cffi_requests

router = APIRouter()

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

_REFERER_MAP = {
    "vidplus.dev":                  ("https://player.videasy.net/", "https://player.videasy.net"),
    "videasy.net":                  ("https://player.videasy.net/", "https://player.videasy.net"),
    "megafiles.store":              ("https://player.videasy.net/", "https://player.videasy.net"),
    "serversicuro.cc":              ("https://player.videasy.net/", "https://player.videasy.net"),
    "uskevinpowell89.workers.dev":  ("https://player.videasy.net/", "https://player.videasy.net"),
    "skyember44.online":            ("https://player.videasy.net/", "https://player.videasy.net"),
    "skyember":                     ("https://player.videasy.net/", "https://player.videasy.net"),
}

def _get_headers(url: str) -> dict:
    parsed = urllib.parse.urlparse(url)
    host = parsed.netloc.lower()
    for domain, (referer, origin) in _REFERER_MAP.items():
        if domain in host:
            return {
                "User-Agent": UA,
                "Referer": referer,
                "Origin": origin,
                "Accept": "*/*",
                "Accept-Language": "en-US,en;q=0.9",
            }
    return {
        "User-Agent": UA,
        "Referer": "https://vidlink.pro/",
        "Origin": "https://vidlink.pro",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
    }


def _fetch_with_retry(url: str, max_retries: int = 2, timeout: int = 25):
    """Returns (response, final_url_after_redirects)."""
    last_err = None
    headers = _get_headers(url)
    for attempt in range(max_retries + 1):
        try:
            session = cffi_requests.Session(impersonate="chrome131")
            resp = session.get(url, headers=headers, timeout=timeout, allow_redirects=True)
            final_url = getattr(resp, "url", None) or url
            if resp.status_code == 200:
                return resp, final_url
            if resp.status_code in (429, 503) and attempt < max_retries:
                time.sleep(1.5 * (attempt + 1))
                continue
            return resp, final_url
        except Exception as e:
            last_err = e
            if attempt < max_retries:
                time.sleep(1.0 * (attempt + 1))
    if last_err:
        raise last_err
    raise RuntimeError("All retries failed")


def _absolute_url(base: str, path: str) -> str:
    return urllib.parse.urljoin(base, path)


def _is_media_playlist(content: str) -> bool:
    """True when the m3u8 is a media playlist (has #EXTINF segments)."""
    return "#EXTINF" in content


def _is_master_playlist(content: str) -> bool:
    """True when the m3u8 already has variant streams."""
    return "#EXT-X-STREAM-INF" in content


def _rewrite_m3u8(content: str, base_url: str, proxy_prefix: str) -> str:
    parsed = urllib.parse.urlparse(base_url)
    base_domain = f"{parsed.scheme}://{parsed.netloc}"

    lines = content.splitlines()
    out = []
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            out.append(line)
            continue
        if stripped.startswith("http://") or stripped.startswith("https://"):
            abs_url = stripped
        elif stripped.startswith("/"):
            abs_url = base_domain + stripped
        else:
            abs_url = _absolute_url(base_url, stripped)
        out.append(f"{proxy_prefix}{urllib.parse.quote(abs_url, safe='')}")
    return "\n".join(out)


def _guess_bandwidth(content: str) -> int:
    """Rough bandwidth guess from resolution hint in the URL or default 2 Mbps."""
    if "1080" in content or "MTA4MA" in content:
        return 4_000_000
    if "720" in content or "NzIw" in content:
        return 2_000_000
    if "360" in content or "MzYw" in content:
        return 800_000
    return 2_000_000


def _guess_resolution(content: str) -> str:
    if "1080" in content or "MTA4MA" in content:
        return "1920x1080"
    if "720" in content or "NzIw" in content:
        return "1280x720"
    if "360" in content or "MzYw" in content:
        return "640x360"
    return "1280x720"


def _build_master_playlist(media_playlist_proxy_url: str, upstream_url: str) -> str:
    """Wrap a media playlist URL in a synthetic master playlist.
    No CODECS attribute — let the player auto-detect from segments."""
    bw = _guess_bandwidth(upstream_url)
    res = _guess_resolution(upstream_url)
    return (
        "#EXTM3U\n"
        "#EXT-X-VERSION:3\n"
        f"#EXT-X-STREAM-INF:BANDWIDTH={bw},RESOLUTION={res}\n"
        f"{media_playlist_proxy_url}\n"
    )


@router.api_route("/proxy/hls", methods=["GET", "HEAD"])
async def proxy_hls(request: Request, url: str, as_media: int = 0):
    """
    Proxy an HLS m3u8 or video segment.
    - Media playlists (with #EXTINF) are served via ?as_media=1 and wrapped in a
      synthetic master playlist at the root URL so that Shaka Player receives
      CODECS information and can activate its MPEG-TS transmuxer.
    """
    if not url.startswith("http"):
        raise HTTPException(status_code=400, detail="Invalid URL")
    is_head = request.method == "HEAD"

    try:
        resp, final_url = _fetch_with_retry(url)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upstream fetch failed: {e}")

    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Upstream error")

    content_type = resp.headers.get("content-type", "")
    is_m3u8 = "mpegurl" in content_type.lower() or url.split("?")[0].endswith(".m3u8")

    if is_m3u8:
        if is_head:
            return Response(
                content=b"",
                media_type="application/vnd.apple.mpegurl",
                headers={"Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache"},
            )

        body_text = resp.text
        proxy_prefix = "/api/proxy/hls?url="
        # Use the final URL after any CDN redirects as the base for resolving
        # relative paths — ensures segment URLs point to the correct origin server
        base_url = final_url

        # If this is a master playlist already (has variant streams), just rewrite it
        if _is_master_playlist(body_text):
            rewritten = _rewrite_m3u8(body_text, base_url, proxy_prefix)
            return Response(
                content=rewritten,
                media_type="application/vnd.apple.mpegurl",
                headers={"Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache"},
            )

        # Media playlist: either serve as master wrapper or as the raw rewritten playlist
        if as_media:
            # Return the rewritten media playlist directly (segment URLs proxied)
            rewritten = _rewrite_m3u8(body_text, base_url, proxy_prefix)
            return Response(
                content=rewritten,
                media_type="application/vnd.apple.mpegurl",
                headers={"Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache"},
            )
        else:
            # Wrap the media playlist in a synthetic master playlist with codec info
            # The media playlist is referenced via &as_media=1 so it is served raw
            encoded_url = urllib.parse.quote(url, safe="")
            media_playlist_proxy_url = f"/api/proxy/hls?url={encoded_url}&as_media=1"
            master = _build_master_playlist(media_playlist_proxy_url, url)
            return Response(
                content=master,
                media_type="application/vnd.apple.mpegurl",
                headers={"Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache"},
            )
    else:
        # Segments may be disguised with fake extensions (.jpg, .html, .css, etc.)
        # Always serve as MPEG-TS so the player can decode them correctly
        raw_path = url.split("?")[0].lower()
        non_ts_exts = (".m3u8", ".vtt", ".srt", ".ass", ".key")
        if any(raw_path.endswith(ext) for ext in non_ts_exts):
            media_type = content_type if content_type else "application/octet-stream"
        else:
            media_type = "video/mp2t"
        return Response(
            content=b"" if is_head else resp.content,
            media_type=media_type,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "max-age=3600",
            },
        )
