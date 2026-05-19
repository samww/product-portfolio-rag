# Stage 1: build frontend
FROM node:22-slim AS frontend-build
WORKDIR /app/src/frontend
COPY src/frontend/package.json src/frontend/package-lock.json ./
RUN npm ci
COPY src/frontend/ ./
# vite.config.ts sets outDir: '../api/static' — outputs to /app/src/api/static
# node_modules/.bin/tsc is a shell wrapper without execute permission in the remote
# Linux builder — invoke the JS entry points directly to bypass the permission check
RUN node node_modules/typescript/bin/tsc -b && node node_modules/vite/bin/vite.js build

# Stage 2: Python base — deps + source. Shared by ingest and runtime stages.
FROM python:3.12-slim AS python-base
WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Install Python dependencies into a virtualenv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Copy application source and data
COPY src/ src/
COPY scripts/ scripts/
COPY data/ data/

# Copy built frontend from Stage 1 (vite outputs to src/api/static)
COPY --from=frontend-build /app/src/api/static src/api/static

# Stage 3: Run ingestion — bakes ChromaDB, pca.npz, points.json. Isolated so the
# OPENAI_API_KEY build-arg does not appear in the final image's layer history.
FROM python-base AS ingest
ARG OPENAI_API_KEY
RUN OPENAI_API_KEY="$OPENAI_API_KEY" \
    uv run python scripts/ingest.py --reset --points-path src/api/static/points.json

# Stage 4: Final runtime — no ARG, no ENV for OPENAI_API_KEY. Copy ingest artifacts only.
FROM python-base AS runtime
COPY --from=ingest /app/.chroma /app/.chroma
COPY --from=ingest /app/src/api/static/points.json /app/src/api/static/points.json

# Ensure start script is executable
RUN chmod +x scripts/start.sh

# Put venv on PATH so start.sh can use bare python/uvicorn
ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

CMD ["bash", "scripts/start.sh"]
