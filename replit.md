# Workspace

## Overview

pnpm workspace monorepo (TypeScript frontend) + **multi-language polyglot backend** (Python + Go + Rust + Scala). hoodTV is a Netflix-style streaming platform. The backend is a four-service fortress: stream extraction (Python), HLS proxy (Go), CDN circuit breaker (Rust), API gateway (Scala).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (hoodTV)
- **Routing**: Wouter
- **Python version**: 3.12 (uv managed)
- **Go version**: 1.24
- **Rust version**: 1.88 (stable)
- **Scala version**: 3.3.4 via scala-cli 1.8.0 (Java 19 GraalVM)

## Artifacts

### hoodTV (artifacts/hoodtv)
Netflix-style streaming platform with dark purple theme.
- **Route**: `/` (port: 20820)
- **Theme**: Dark `#05050c` bg, `#7F77DD` accent, Bebas Neue headings, DM Sans body
- **Pages**: HomePage, SearchPage, BrowsePage (Movies/TV), TitlePage, WatchPage, MyListPage, TrendingPage
- **Layout**: Fixed 220px left sidebar Navbar, WatchPage is full-screen (no sidebar)
- **Key components**: Navbar (sidebar), HeroSection, ContentRow, MediaCard, SpotlightSection, VideoPlayer
- **Hooks**: useWatchlist (localStorage), useContinueWatching (localStorage)
- **API layer**: `src/lib/api.ts` — TMDB for content discovery, `/api/stream/...` for streams

## Multi-Language Fortress Backend

### Request Flow

```
Browser
  │
  └── /api/* → Vite proxy → Python (8080) — stream extraction + HLS proxy

Monitoring / Health (not in critical streaming path):
  Go   (8090) → /health — high-perf HLS proxy
  Rust (9000) → /health, /health/cdn, /health/status — circuit breaker
  Scala(8000) → /api/health aggregates all services
```

> **Note**: Go's HLS proxy (stdlib net/http) handles all m3u8/TS proxying.
> Go/Rust/Scala run as health/monitoring services alongside the Python stream extractor.

### Python API Server (artifacts/api-server-py, port 8080)
FastAPI + Uvicorn. Stream source extraction + HLS proxy.
- **Routers**:
  - `routers/videasy.py` — Videasy stream source via WASM + CryptoJS decrypt; async CDN reachability validation
  - `routers/nontongo.py` — NontonGo HLS source (uses TMDB → IMDB ID lookup)
  - `routers/moviebox.ts` — MovieBox MP4 source (keys via env vars)
  - `routers/vidsrc.py` — VidSrc iframe embed fallback
  - `routers/proxy.py` — Fallback HLS proxy
  - `routers/health.py` — health check endpoint
- Dependencies: `fastapi`, `uvicorn`, `httpx`, `moviebox-api`, `python-dotenv`

### Go HLS Proxy (artifacts/go-proxy, port 8090)
High-performance reverse proxy for all HLS traffic — every m3u8 playlist and TS segment.
- `main.go` — single-file Go server using only stdlib (`net/http`)
- Connection pool: 300 max idle, 100 per host, 90s timeout
- Domain-aware referer headers (same Videasy domain map as Python)
- m3u8 rewriting: master playlist passthrough, media playlist master-wrapping, segment URL proxying
- CORS headers on all responses
- Workflow: `Go Proxy` — `go run artifacts/go-proxy/main.go`

### Rust CDN Circuit Breaker (artifacts/rust-health, port 9000)
Actix-web service tracking CDN health with a three-state circuit breaker (Closed/Half-Open/Open).
- `src/main.rs` — Tokio async runtime, `reqwest` for upstream checks
- Circuit opens after 3 failures, half-opens after 30s cooldown
- Endpoints: `GET /health`, `GET /health/cdn?url=...`, `GET /health/status`
- Workflow: `Rust CDN Health` — `cargo run --manifest-path artifacts/rust-health/Cargo.toml`

### Scala API Gateway (artifacts/scala-gateway, port 8000)
JDK-native HTTP gateway (zero external dependencies, compiles in seconds).
- `Gateway.scala` — `com.sun.net.httpserver.HttpServer` with `CachedThreadPool`
- Aggregated health at `/api/health` — pings Python + Rust + Go in parallel
- Delegates `/api/health/*` to Rust, all other `/api/*` to Python
- CORS headers + `X-Gateway: scala-gateway/1.0` on all responses
- Workflow: `Scala Gateway` — `scala-cli run artifacts/scala-gateway/Gateway.scala`

## Streaming Architecture (Video.js + Direct m3u8)

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

### Go HLS Proxy (`/api/proxy/hls?url=<encoded>&as_media=1`)
- Proxies any m3u8/TS URL with correct Videasy referer headers
- **Domain-aware referer map**: `fast.vidplus.dev`, `videasy.net`, `megafiles.store`, `serversicuro.cc`, `uskevinpowell89.workers.dev` → `player.videasy.net` referer
- Rewrites relative segment paths → root-relative proxied URLs (`/api/proxy/hls?url=...`)
- Media playlists wrapped in synthetic HLS master playlist (BANDWIDTH/RESOLUTION hint)
- TS segments served as `video/mp2t`, cached 1 hour; m3u8 served no-cache

### Video Player (VideoPlayer.tsx)
- Video.js v8 + built-in VHS (HTTP Streaming)
- hoodTV purple control bar, progress bar, spinner
- `enableWorker: false` for main-thread transmux compatibility
- `application/x-mpegURL` source type
- Black screen in Replit embedded preview is expected (headless Chrome has no H.264 decoder)

## API Data Sources

### TMDB API (Primary Content Source)
- Key in Replit Secrets (`TMDB_API_KEY`), injected into frontend via Vite `define` block
- All content discovery: trending, search, genres, details, cast, trailers, seasons/episodes
- WatchPage URL carries: `title`, `type`, `year`, `total_seasons`, `season`, `episode`

## Key Config Notes
- TMDB key in Replit Secrets (`TMDB_API_KEY`); also `VITE_TMDB_API_KEY` for Vite frontend
- MovieBox keys in env vars: `MOVIEBOX_SECRET_KEY`, `MOVIEBOX_SECRET_KEY_ALT` (optional)
- Python packages via `pip install -r artifacts/api-server-py/requirements.txt`
- Videasy WASM lives at `artifacts/api-server-py/videasy_wasm/module.wasm`
- crypto-js installed in `artifacts/api-server-py/videasy_wasm/node_modules/`
- Vite proxies: `/api/proxy` → Go (8090), `/api` → Scala (8000) → Python (8080)
- `.env.example` → copy to `.env` for local development; `.env` is gitignored

## WatchPage Architecture
- URL: `/watch/:tmdbId?title=...&type=movie|tv&year=...&total_seasons=N[&season=N&episode=N]`
- Calls `/api/stream/{type}/{id}/videasy` for HLS stream sources
- Shows loading spinner → Video.js player on success → quality source switcher
- TV shows show episode navigation bar (prev/next episode)
- Continue watching progress saved to localStorage on mount

## Key Commands

- `make setup` — install all Node.js + Python dependencies
- `make dev` — start all six services in background
- `make stop` — kill all background services
- `pnpm --filter @workspace/hoodtv run dev` — run hoodTV frontend only
- `PORT=8080 python artifacts/api-server-py/main.py` — run Python API server
- `PORT=8090 go run artifacts/go-proxy/main.go` — run Go HLS proxy
- `PORT=9000 cargo run --manifest-path artifacts/rust-health/Cargo.toml` — run Rust health
- `PORT=8000 scala-cli run artifacts/scala-gateway/Gateway.scala` — run Scala gateway
- `pip install -r artifacts/api-server-py/requirements.txt` — install Python deps

## Open-Source Setup Files
- `README.md` — project overview, architecture, setup guide
- `.env.example` — all required/optional env vars with descriptions
- `LICENSE` — MIT
- `Makefile` — `make setup`, `make dev`, `make stop`, per-service targets
- `.gitignore` — covers `.env*`, `node_modules`, build artifacts, all language caches

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
