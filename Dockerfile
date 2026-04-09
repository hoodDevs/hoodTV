# ─────────────────────────────────────────────────────────────────
# Stage 1: Build the React/Vite frontend
# ─────────────────────────────────────────────────────────────────
FROM node:22-slim AS frontend-builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /workspace

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/db/package.json ./lib/db/
COPY artifacts/hoodtv/package.json ./artifacts/hoodtv/

RUN pnpm install --filter @workspace/hoodtv... --frozen-lockfile

COPY lib/ ./lib/
COPY artifacts/hoodtv/ ./artifacts/hoodtv/

ARG TMDB_API_KEY=""
ENV TMDB_API_KEY=${TMDB_API_KEY} \
    PORT=3000 \
    BASE_PATH=/ \
    NODE_ENV=production

RUN pnpm --filter @workspace/hoodtv run build


# ─────────────────────────────────────────────────────────────────
# Stage 2: Python API backend + nginx
# ─────────────────────────────────────────────────────────────────
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx supervisor curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY artifacts/api-server-py/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY artifacts/api-server-py/ ./api/

COPY --from=frontend-builder /workspace/artifacts/hoodtv/dist/public /var/www/html

COPY docker/nginx.conf /etc/nginx/sites-enabled/default
RUN rm -f /etc/nginx/sites-enabled/default.conf 2>/dev/null || true

COPY docker/supervisord.conf /etc/supervisor/conf.d/hoodtv.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -sf http://localhost/api/health || exit 1

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/hoodtv.conf"]
