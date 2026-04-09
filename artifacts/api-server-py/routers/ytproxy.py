"""
Forward /api/yt/* requests to the Node.js yt-service on port 8099.
This avoids Vite proxy ordering issues where /api matches before /api/yt.
"""
import httpx
from fastapi import APIRouter, Request
from fastapi.responses import Response

router = APIRouter()

_YT_SERVICE = "http://localhost:8099"
_CORS = {"Access-Control-Allow-Origin": "*"}

_client = httpx.AsyncClient(timeout=20.0)


@router.api_route("/yt/{path:path}", methods=["GET", "HEAD", "OPTIONS"])
async def forward_yt(request: Request, path: str):
    if request.method == "OPTIONS":
        return Response(headers={**_CORS, "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS", "Access-Control-Allow-Headers": "*"})

    target = f"{_YT_SERVICE}/api/yt/{path}"
    qs = request.url.query
    if qs:
        target += f"?{qs}"

    try:
        resp = await _client.request(request.method, target)
    except Exception as exc:
        return Response(content=str(exc), status_code=502, headers=_CORS)

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=resp.headers.get("content-type", "application/json"),
        headers=_CORS,
    )
