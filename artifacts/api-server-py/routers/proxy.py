import re
import time
import urllib.parse
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response, StreamingResponse
from curl_cffi import requests as cffi_requests

router = APIRouter()

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

_REFERER_MAP = {
    "vidplus.dev": ("https://player.videasy.net/", "https://player.videasy.net"),
    "videasy.net": ("https://player.videasy.net/", "https://player.videasy.net"),
    "megafiles.store": ("https://player.videasy.net/", "https://player.videasy.net"),
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


def _fetch_with_retry(url: str, max_retries: int = 2, timeout: int = 25) -> cffi_requests.Response:
    last_err = None
    headers = _get_headers(url)
    for attempt in range(max_retries + 1):
        try:
            session = cffi_requests.Session(impersonate="chrome131")
            resp = session.get(url, headers=headers, timeout=timeout)
            if resp.status_code == 200:
                return resp
            if resp.status_code in (429, 503) and attempt < max_retries:
                time.sleep(1.5 * (attempt + 1))
                continue
            return resp
        except Exception as e:
            last_err = e
            if attempt < max_retries:
                time.sleep(1.0 * (attempt + 1))
    if last_err:
        raise last_err
    raise RuntimeError("All retries failed")


def _absolute_url(base: str, path: str) -> str:
    return urllib.parse.urljoin(base, path)


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


@router.get("/proxy/hls")
async def proxy_hls(url: str):
    """Proxy an HLS m3u8 or video segment with Chrome fingerprinting to bypass Cloudflare."""
    if not url.startswith("http"):
        raise HTTPException(status_code=400, detail="Invalid URL")

    try:
        resp = _fetch_with_retry(url)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upstream fetch failed: {e}")

    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Upstream error")

    content_type = resp.headers.get("content-type", "")
    is_m3u8 = "mpegurl" in content_type.lower() or url.split("?")[0].endswith(".m3u8")

    if is_m3u8:
        body_text = resp.text
        proxy_prefix = "/api/proxy/hls?url="
        rewritten = _rewrite_m3u8(body_text, url, proxy_prefix)
        return Response(
            content=rewritten,
            media_type="application/vnd.apple.mpegurl",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-cache",
            },
        )
    else:
        # Segments may be disguised with fake extensions (.jpg, .html, .css, etc.)
        # Always serve as MPEG-TS so VideoJS can decode them correctly
        raw_path = url.split("?")[0].lower()
        non_ts_exts = (".m3u8", ".vtt", ".srt", ".ass", ".key")
        if any(raw_path.endswith(ext) for ext in non_ts_exts):
            media_type = content_type if content_type else "application/octet-stream"
        else:
            media_type = "video/mp2t"
        return Response(
            content=resp.content,
            media_type=media_type,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "max-age=3600",
            },
        )
