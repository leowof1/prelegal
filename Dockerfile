# Stage 1: build the Next.js frontend as static files.
FROM node:24-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# The NDA page is prerendered from the repo's templates at build time.
COPY templates/ /app/templates/
RUN npm run build

# Stage 2: FastAPI backend serving the API and the exported frontend.
FROM python:3.14-slim
COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /uvx /bin/
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock backend/.python-version ./
RUN uv sync --locked --no-dev --no-install-project
COPY backend/src/ ./src/
RUN uv sync --locked --no-dev
COPY --from=frontend /app/frontend/out /app/frontend/out

ENV PATH="/app/backend/.venv/bin:$PATH" \
    PRELEGAL_STATIC_DIR=/app/frontend/out \
    PRELEGAL_DB_PATH=/app/backend/prelegal.db
EXPOSE 8000
CMD ["uvicorn", "prelegal_backend.main:app_from_env", "--factory", "--host", "0.0.0.0", "--port", "8000"]
