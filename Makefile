# hoodTV — Development convenience commands
# Run `make help` to see all available targets.
#
# Quick start:
#   make setup   # install all dependencies
#   make dev     # start all services

.PHONY: help setup dev frontend backend yt-service go-proxy rust-health scala-gateway install-py install-node

## Display this help message
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "  Copy .env.example → .env and fill in TMDB_API_KEY before running."

## Install all Node.js and Python dependencies
setup: install-node install-py
	@echo "\n✓ All dependencies installed. Copy .env.example to .env and fill in your keys."

install-node: ## Install Node.js dependencies (pnpm)
	pnpm install

install-py: ## Install Python dependencies
	pip install -r artifacts/api-server-py/requirements.txt

## Start every service in the background (logs go to /tmp/hoodtv-*.log)
dev:
	@echo "Starting all hoodTV services..."
	@mkdir -p /tmp/hoodtv-logs
	PORT=8080  python artifacts/api-server-py/main.py                            > /tmp/hoodtv-logs/api-py.log     2>&1 &
	PORT=8099  node   artifacts/yt-service/src/index.js                          > /tmp/hoodtv-logs/yt-service.log 2>&1 &
	PORT=8090  go     run artifacts/go-proxy/main.go                             > /tmp/hoodtv-logs/go-proxy.log   2>&1 &
	PORT=9000  cargo  run --manifest-path artifacts/rust-health/Cargo.toml       > /tmp/hoodtv-logs/rust.log       2>&1 &
	PORT=8000  PYTHON_URL=http://localhost:8080 RUST_URL=http://localhost:9000 \
	           GO_URL=http://localhost:8090 \
	           scala-cli run artifacts/scala-gateway/Gateway.scala               > /tmp/hoodtv-logs/scala.log      2>&1 &
	PORT=20820 pnpm --filter @workspace/hoodtv run dev                           > /tmp/hoodtv-logs/frontend.log   2>&1 &
	@echo "All services started. Logs in /tmp/hoodtv-logs/"
	@echo "Frontend: http://localhost:20820"
	@echo "API:      http://localhost:8080"
	@echo "YT Svc:   http://localhost:8099"

## Start only the React frontend
frontend: ## Start the React/Vite frontend (port 20820)
	PORT=20820 pnpm --filter @workspace/hoodtv run dev

## Start only the Python FastAPI backend
backend: ## Start the Python FastAPI backend (port 8080)
	PORT=8080 python artifacts/api-server-py/main.py

## Start only the YouTube Music service
yt-service: ## Start the YouTube Music Node.js service (port 8099)
	PORT=8099 node artifacts/yt-service/src/index.js

## Start only the Go HLS proxy
go-proxy: ## Start the Go reverse proxy (port 8090)
	PORT=8090 go run artifacts/go-proxy/main.go

## Start only the Rust CDN health checker
rust-health: ## Start the Rust Actix-web health service (port 9000)
	PORT=9000 cargo run --manifest-path artifacts/rust-health/Cargo.toml

## Start only the Scala API gateway
scala-gateway: ## Start the Scala API gateway (port 8000)
	PORT=8000 \
	PYTHON_URL=http://localhost:8080 \
	RUST_URL=http://localhost:9000 \
	GO_URL=http://localhost:8090 \
	scala-cli run artifacts/scala-gateway/Gateway.scala

## Stop all background services started by `make dev`
stop:
	@pkill -f "artifacts/api-server-py/main.py" 2>/dev/null || true
	@pkill -f "artifacts/yt-service/src/index.js" 2>/dev/null || true
	@pkill -f "artifacts/go-proxy/main.go" 2>/dev/null || true
	@pkill -f "rust-health" 2>/dev/null || true
	@pkill -f "Gateway.scala" 2>/dev/null || true
	@pkill -f "hoodtv.*dev" 2>/dev/null || true
	@echo "All hoodTV services stopped."
