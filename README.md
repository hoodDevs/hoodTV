# hoodTV

A self-hosted, Netflix-style streaming platform built with a polyglot microservices architecture. Browse movies and TV shows powered by TMDB metadata, watch via multiple streaming sources, and explore YouTube Music — all from a single dark-themed UI.

![hoodTV](https://img.shields.io/badge/hoodTV-streaming-7F77DD?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square)
![Python](https://img.shields.io/badge/python-3.11+-blue?style=flat-square)

---

## Features

**Movies & TV**
- Full Netflix-style UI — hero section, content rows, genre tiles, spotlight cinema cards
- TMDB-powered metadata: posters, backdrops, cast, ratings, episode guides
- 4-source parallel streaming fallback chain: Videasy HLS → NontonGo HLS → MovieBox MP4 → VidSrc embed
- Season/episode navigation, source switcher, fullscreen player
- Watchlist (My List), Continue Watching with progress tracking, trending charts

**Music**
- YouTube Music integration — home feed, explore, search (songs, videos, albums, artists)
- Custom `<video>` player for music videos — no iframes, full keyboard controls
- Lyrics, up-next radio queue, artist pages, album pages, search autocomplete
- Native YouTube URL deciphering via [YouTube.js](https://github.com/LuanRT/YouTube.js) — no yt-dlp

**UX**
- Fully dark theme (`#0a0a0a` base, `#7F77DD` accent, DM Sans + Bebas Neue)
- Keyboard shortcuts: `⌘K`/`Ctrl+K` for search, `Space`/`F`/`M`/Arrow keys in player
- Shimmer skeleton loading states, intersection-observer fade-in animations
- Profile page with watch stats, continue watching manager, My List overview

---

## Architecture

hoodTV is a monorepo (`pnpm workspaces`) of six independent services:

| Service | Language | Port | Role |
|---|---|---|---|
| **hoodtv** | React + Vite + TypeScript | 20820 | Frontend SPA |
| **api-server-py** | Python + FastAPI | 8080 | TMDB proxy, streaming resolvers (Videasy, NontonGo) |
| **api-server** | Node.js + Express + TypeScript | — | MovieBox & Gifted Tech streaming sources |
| **yt-service** | Node.js + Express | 8099 | YouTube Music data + audio/video streaming |
| **go-proxy** | Go | 8090 | Reverse proxy / load balancer |
| **scala-gateway** | Scala (scala-cli) | 8000 | API gateway that fans out to all backend services |
| **rust-health** | Rust (Axum) | 9000 | CDN health checker |

```
Browser → Scala Gateway (8000)
             ├── Python FastAPI (8080)  — TMDB metadata, Videasy, NontonGo
             ├── Go Proxy (8090)        — reverse proxy
             └── Rust Health (9000)     — CDN health checks

Browser → YouTube Service (8099)       — music data, audio/video streaming
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- [pnpm](https://pnpm.io/) ≥ 8
- [Python](https://www.python.org/) ≥ 3.11
- [Go](https://go.dev/) ≥ 1.21
- [Rust](https://www.rust-lang.org/) (stable)
- [Scala CLI](https://scala-cli.virtuslab.org/) ≥ 1.0

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/your-username/hoodtv.git
cd hoodtv

# 2. Install Node dependencies
pnpm install

# 3. Install Python dependencies
pip install -r artifacts/api-server-py/requirements.txt

# 4. Configure environment variables
cp .env.example .env
# Edit .env and add your TMDB_API_KEY (required)
```

### Running

Each service is an independent process. Start them all:

```bash
# Frontend (React/Vite)
PORT=20820 pnpm --filter @workspace/hoodtv run dev

# Python backend
PORT=8080 python artifacts/api-server-py/main.py

# YouTube Music service
PORT=8099 node artifacts/yt-service/src/index.js

# Go proxy (optional)
PORT=8090 go run artifacts/go-proxy/main.go

# Scala gateway (optional)
PORT=8000 scala-cli run artifacts/scala-gateway/Gateway.scala

# Rust health checker (optional)
PORT=9000 cargo run --manifest-path artifacts/rust-health/Cargo.toml
```

Then open [http://localhost:20820](http://localhost:20820).

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `TMDB_API_KEY` | ✅ | [TMDB API key](https://www.themoviedb.org/settings/api) — used by the Python backend |
| `VITE_TMDB_API_KEY` | ✅ | Same key, exposed to the Vite frontend |
| `MOVIEBOX_SECRET_KEY` | ☐ | MovieBox streaming source auth key |
| `MOVIEBOX_SECRET_KEY_ALT` | ☐ | MovieBox alternate auth key |
| `GIFTED_API_KEY` | ☐ | Gifted Tech alternative streaming source |
| `VITE_GIFTED_API_KEY` | ☐ | Same, exposed to Vite frontend |

The platform works with only `TMDB_API_KEY` set. Optional keys enable additional streaming sources.

---

## Tech Stack

**Frontend**
- React 18, TypeScript, Vite
- Wouter (routing), TanStack Query, Tailwind CSS
- Lucide React icons, Framer Motion animations

**Backend**
- FastAPI + httpx (Python streaming proxy)
- Express.js (Node.js — MovieBox, YouTube service)
- [YouTube.js](https://github.com/LuanRT/YouTube.js) for native YTMusic API + URL deciphering via Node.js `vm`
- Go `net/http` reverse proxy
- Scala + sttp (API gateway)
- Rust + Axum (health service)

**Data**
- [TMDB API](https://developer.themoviedb.org/) — all movie/TV metadata
- YouTube Music — music library, lyrics, radio
- LocalStorage — watchlist, continue watching progress

---

## Streaming Sources

hoodTV tries each source in parallel and uses the first to respond successfully:

1. **Videasy** — HLS adaptive streaming
2. **NontonGo** — HLS (requires IMDB ID lookup via TMDB)
3. **MovieBox** — Direct MP4 links (requires auth keys)
4. **VidSrc** — iframe embed fallback

Music video streaming uses YouTube.js to resolve and proxy audio/video streams natively with Range request support for seeking.

---

## Project Structure

```
├── artifacts/
│   ├── hoodtv/          # React/Vite frontend
│   │   └── src/
│   │       ├── components/   # Navbar, HeroSection, MediaCard, ContentRow…
│   │       ├── pages/        # HomePage, TitlePage, WatchPage, ProfilePage…
│   │       ├── music/        # Music player, MusicVideoWatchPage, artist pages
│   │       ├── hooks/        # useWatchlist, useContinueWatching
│   │       └── lib/          # api.ts (TMDB calls), config.ts
│   ├── api-server-py/   # Python FastAPI backend
│   │   └── routers/          # videasy.py, nontongo.py, tmdb.py…
│   ├── api-server/      # Node.js/TS streaming sources
│   │   └── src/routes/       # moviebox.ts, proxy.ts, vidsrc.ts…
│   ├── yt-service/      # YouTube Music service
│   │   └── src/index.js      # Platform shim, streaming, YTMusic endpoints
│   ├── go-proxy/        # Go reverse proxy
│   ├── scala-gateway/   # Scala API gateway
│   └── rust-health/     # Rust Axum health checker
├── .env.example         # Environment variable template
├── LICENSE              # MIT
└── README.md
```

---

## License

[MIT](LICENSE) — see the LICENSE file for details.

> **Disclaimer:** This project is for educational purposes. Respect the terms of service of any third-party APIs you use. The streaming source integrations are provided as-is and may stop working if upstream services change their APIs.
