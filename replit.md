# Workspace

## Overview

pnpm workspace monorepo (TypeScript frontend) + Python FastAPI backend. hoodTV is a Netflix-style streaming platform. The backend uses Scrapling for web scraping and curl_cffi for Cloudflare bypass.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (hoodTV)
- **Routing**: Wouter
- **Python version**: 3.12 (uv managed)
- **Backend framework**: FastAPI + Uvicorn
- **HTTP**: curl_cffi (Chrome fingerprinting for Cloudflare bypass)

## Artifacts

### hoodTV (artifacts/hoodtv)
Netflix-style streaming platform with dark purple theme.
- **Route**: `/` (port: auto from PORT env)
- **Theme**: Dark `#0a0a0a` bg, `#7F77DD` accent, Bebas Neue headings, DM Sans body
- **Pages**: HomePage, SearchPage, BrowsePage (Movies/TV), TitlePage, WatchPage, MyListPage, TrendingPage
- **Key components**: Navbar, HeroSection, ContentRow, MediaCard, SpotlightSection, shimmer skeletons
- **Hooks**: useWatchlist (localStorage), useContinueWatching (localStorage)
- **API layer**: `src/lib/api.ts` — TMDB for all content discovery

### API Server (artifacts/api-server → runs artifacts/api-server-py)
Python FastAPI backend.
- **Route**: `/api` (port 8080)
- **Source code**: `artifacts/api-server-py/` (main.py + routers/)
- **Artifact registered at**: `artifacts/api-server/.replit-artifact/artifact.toml`
- **Run command**: `PORT=8080 uv run python artifacts/api-server-py/main.py`
- **Routers**:
  - `routers/vidsrc.py` — VidLink (vidlink.pro) streaming via WASM token
  - `routers/videasy.py` — Videasy (cineby.sc/vidking.net backend) via patched WASM + CryptoJS decrypt
  - `routers/proxy.py` — HLS proxy with per-domain referer headers
  - `routers/health.py` — health check

## Streaming Architecture (Video.js + Real HLS)

### VidLink Source (`/api/stream/movie/{id}`, `/api/stream/tv/{id}/{s}/{e}`)
- **WASM runner**: `artifacts/api-server-py/vidlink_wasm/runner.cjs`
- Uses Go WASM (`fu.wasm`) + libsodium to generate tokens
- Calls `https://vidlink.pro/api/b/movie/{token}` for stream data
- Returns HLS m3u8 via `storm.vodvidl.site` proxy

### Videasy Source (`/api/stream/movie/{id}/videasy`, `/api/stream/tv/{id}/{s}/{e}/videasy`)
- **WASM runner**: `artifacts/api-server-py/videasy_wasm/runner.cjs`
- Uses patched `module.wasm` (global 70 patched 0→1 to bypass verify())
- Decryption chain:
  1. GET `api.videasy.net/myflixerzupcloud/sources-with-title?tmdbId=...` → encrypted hex
  2. WASM `decrypt(hex, tmdbId)` → base64 CryptoJS salted cipher
  3. `CryptoJS.AES.decrypt(stage1, "")` → JSON `{sources, subtitles}`
- Module 3589 (Hashids) `encode(hexKey)` returns `""` for non-numeric hex → CryptoJS key = `""`
- Returns HLS m3u8 from `fast.vidplus.dev` (multi-quality: 1080p/720p/360p)
- Includes subtitles from `cca.megafiles.store`

### HLS Proxy (`/api/proxy/hls?url=<encoded>`)
- Proxies any m3u8 URL through curl_cffi with Chrome impersonation
- **Domain-aware referer**: `fast.vidplus.dev` → `player.videasy.net`, default → `vidlink.pro`
- Rewrites relative segment paths → absolute proxied URLs
- `artifacts/api-server-py/routers/proxy.py`

### Frontend Stream Loading
- `getStreamSources()` in `api.ts` calls **both** endpoints in parallel (`Promise.allSettled`)
- VidLink source is named "VidLink", videasy sources named "Videasy 1080p/720p/360p"
- WatchPage shows source switcher when multiple sources available

## API Data Sources

### TMDB API (Primary Content Source)
- Key in Replit Secrets (`TMDB_API_KEY`), injected into frontend via Vite `define` block
- All content discovery: trending, search, genres, details, cast, trailers, seasons/episodes
- Item fields: TMDB posters, backdrops, overviews, similar titles

## Key Config Notes
- API keys (`TMDB_API_KEY`, `GIFTED_API_KEY`, `SESSION_SECRET`) are in Replit Secrets
- TMDB key injected into Vite frontend via `define` block in `vite.config.ts` (NOT .env.local)
- Python packages managed via `uv` — virtual env at `.pythonlibs/`
- Patched WASM lives at `artifacts/api-server-py/videasy_wasm/module.wasm`
- crypto-js installed in `artifacts/api-server-py/videasy_wasm/node_modules/`

## WatchPage Architecture
- URL: `/watch/:tmdbId?title=...&type=movie|tv[&season=N&episode=N]`
- Calls both `/api/stream/movie/{id}` (VidLink) and `/api/stream/movie/{id}/videasy` (Videasy) in parallel
- Shows loading spinner → Video.js HLS player on success → source switcher (multiple sources)
- TV shows show episode navigation bar (prev/next episode)
- Continue watching progress saved to localStorage on mount
- Subtitles/captions supported via Video.js text tracks

## Key Commands

- `pnpm --filter @workspace/hoodtv run dev` — run hoodTV frontend
- `PORT=8080 uv run python artifacts/api-server-py/main.py` — run Python API server
- `uv add <package>` — add Python package

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
