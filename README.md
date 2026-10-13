# prelegal
A platform for drafting common legal agreements.

## Status

🚧 **Work in progress.** This project is under active development and is expected to be completed by **October 11, 2026**.

## Running

Requires Docker and a `.env` file in the project root (see `OPENROUTER_API_KEY`).

```bash
scripts/start-mac.sh     # or start-linux.sh / start-windows.ps1
scripts/stop-mac.sh      # or stop-linux.sh / stop-windows.ps1
```

The app runs at http://localhost:8000. The SQLite database (accounts and saved documents) is recreated on every start.

## Layout

- `frontend/` - Next.js app, statically exported (`npm run build` writes `frontend/out/`)
- `backend/` - FastAPI (uv project) serving `/api` and the exported frontend
- `templates/` - Common Paper agreement templates
- `documents.json` - the supported documents: party roles and the key terms the AI chat asks for

Backend locally: `cd backend && uv run uvicorn prelegal_backend.main:app_from_env --factory --reload` (after building the frontend). Tests: `uv run pytest`.
