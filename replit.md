# Workspace

## Overview

pnpm workspace monorepo (TypeScript frontend) + Python FastAPI backend. hoodTV is a Netflix-style streaming platform. The backend uses curl_cffi for Cloudflare bypass and a Node.js WASM runner for stream decryption.

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
- **Theme**: Dark `#05050c` bg, `#7F77DD` accent, Bebas Neue headings, DM Sans body
- **Pages**: HomePage, SearchPage, BrowsePage (Movies/TV), TitlePage, WatchPage, MyListPage, TrendingPage
- **Layout**: Fixed 220px left sidebar Navbar, WatchPage is full-screen (no sidebar)
- **Key components**: Navbar (sidebar), HeroSection, ContentRow, MediaCard, SpotlightSection, VideoPlayer
- **Hooks**: useWatchlist (localStorage), useContinueWatching (localStorage)
- **API layer**: `src/lib/api.ts` — TMDB for content discovery, `/api/stream/...` for streams

### API Server (artifacts/api-server-py)
Python FastAPI backend.
- **Port**: 8080
- **Source code**: `artifacts/api-server-py/` (main.py + routers/)
- **Routers**:
  - `routers/videasy.py` — Videasy stream source via WASM + CryptoJS decrypt; async CDN reachability validation
  - `routers/proxy.py` — HLS proxy with per-domain referer headers, segment rewriting
  - `routers/health.py` — health check

## Streaming Architecture (HLS.js + Direct m3u8)

### Videasy Source (`/api/stream/movie/{id}/videasy`, `/api/stream/tv/{id}/{s}/{e}/videasy`)
- **Providers tried in parallel**: `myflixerzupcloud`, `visioncine`, `meine`, `hdmovie2`, `overflix`
- **WASM runner**: `artifacts/api-server-py/videasy_wasm/runner.cjs` (Node.js + AssemblyScript WASM)
- Decryption chain:
  1. GET `api.videasy.net/{provider}/sources-with-title?tmdbId=...` → encrypted hex
  2. WASM `decrypt(hex, tmdbId)` → base64 CryptoJS salted cipher
  3. `CryptoJS.AES.decrypt(stage1, "")` → JSON `{sources, subtitles}`
- Returns HLS m3u8 from `fast.vidplus.dev` (multi-quality: 1080p/720p/360p)
- Includes subtitles from `cca.megafiles.store`
- **CDN validation**: async HEAD checks filter out unreachable CDNs; fallback includes all sources if all fail
- Sources returned sorted: 1080p → 720p → 480p → 360p → Auto

### HLS Proxy (`/api/proxy/hls?url=<encoded>`)
- Proxies any m3u8 URL through curl_cffi with Chrome impersonation
- **Domain-aware referer map**: `fast.vidplus.dev`, `videasy.net`, `megafiles.store`, `serversicuro.cc`, `uskevinpowell89.workers.dev` → `player.videasy.net` referer
- Rewrites relative segment paths → absolute proxied URLs
- Media playlists wrapped in synthetic HLS master playlist (with BANDWIDTH/RESOLUTION)
- Segments always served as `video/mp2t`

### Frontend Stream Loading
- `getStreamSources()` in `api.ts` calls `/api/stream/{type}/{id}/videasy`
- WatchPage shows quality selector when multiple sources available (1080p/720p/360p)
- VideoPlayer uses HLS.js with 3-retry recovery; auto-advances to next source on failure

## API Data Sources

### TMDB API (Primary Content Source)
- Key in Replit Secrets (`TMDB_API_KEY`), injected into frontend via Vite `define` block
- All content discovery: trending, search, genres, details, cast, trailers, seasons/episodes
- WatchPage URL carries: `title`, `type`, `year`, `total_seasons`, `season`, `episode`

## Key Config Notes
- TMDB key injected into Vite frontend via `define` block in `vite.config.ts` (NOT .env.local)
- Python packages managed via `uv` — virtual env at `.pythonlibs/`
- Videasy WASM lives at `artifacts/api-server-py/videasy_wasm/module.wasm`
- crypto-js installed in `artifacts/api-server-py/videasy_wasm/node_modules/`
- CORS: `allow_origins=["*"]`, Vite proxies `/api` → `localhost:8080`

## WatchPage Architecture
- URL: `/watch/:tmdbId?title=...&type=movie|tv&year=...&total_seasons=N[&season=N&episode=N]`
- Calls `/api/stream/{type}/{id}/videasy` for HLS stream sources
- Shows loading spinner → HLS.js player on success → quality source switcher
- TV shows show episode navigation bar (prev/next episode)
- Continue watching progress saved to localStorage on mount

## Key Commands

- `pnpm --filter @workspace/hoodtv run dev` — run hoodTV frontend
- `PORT=8080 uv run python artifacts/api-server-py/main.py` — run Python API server
- `uv add <package>` — add Python package

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
