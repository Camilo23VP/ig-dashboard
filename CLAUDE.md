# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

FastAPI backend + React/Vite frontend that lists posts from an Instagram professional account. No tests, linter, formatter, typecheck or CI exist — don't look for their config. `README.md` and `AGENTS.md` are the source of truth for setup, endpoints and modes.

## Commands

Backend (run from `backend/`; it is not an installable package and uses flat imports like `import config`, so `uvicorn` must be launched from that directory):

```bash
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs frontend/dist/
```

Start the backend first: Vite proxies `/api` to `http://localhost:8000` (`frontend/vite.config.js`). Quick check: `GET /api/status` returns the current mode; interactive docs at `/docs`.

## Architecture

**Backend client abstraction (the key idea).** `main.py` builds one module-level `client` at import time: `MockClient` if `IG_MODE=mock`, otherwise `InstagramClient`. Both expose the same async interface — `profile()`, `posts(limit, after)`, `post(media_id)`, `comments(media_id)` — and the route handlers only talk to that interface. Any new data source or endpoint must be added to **both** clients so mock mode keeps working for UI development.

- `config.py` reads `.env` and validates at import (invalid `IG_MODE`, missing `IG_ACCESS_TOKEN`, or missing `IG_USER_ID` in facebook mode raise `ValueError`), so a bad config crashes startup rather than failing per request.
- `instagram.py` hides the two Graph API flavors behind one class: `instagram` mode → `graph.instagram.com`, user `me`, base fields only; `facebook` mode → `graph.facebook.com`, user `IG_USER_ID`, plus `FACEBOOK_ONLY_MEDIA_FIELDS` (reposts/shares). `_normalize_post` `setdefault`s every optional field to `None` so the frontend always sees the same keys; `None` means "hidden by the owner or unsupported by this login".
- `InstagramClient._get` appends the access token as a query param and converts Graph `error` payloads into `InstagramError`; `main.py`'s exception handler returns only `{error, code}` so the token never leaks. `MockClient.post` lazily imports `InstagramError` to raise the same error for unknown IDs.
- Comments have their own paginated endpoint (`GET /api/posts/{id}/comments`); `GET /api/posts/{id}` no longer embeds them. `InstagramClient.comments()` returns one page and flattens `replies` (following the replies edge if the expansion is paginated, capped by `MAX_REPLY_PAGES`).
- Moderation (`hide_comment`, `delete_comment`, `set_comments_enabled`) goes through `InstagramClient._request` (the single place that adds the token and maps httpx/JSON failures to `InstagramError`); `MockClient` implements the same actions by mutating in-memory data. These routes have no auth — local use only, protect them before deploying.
- `is_comment_enabled` is requested only in `InstagramClient.post()`; if Meta rejects that field for a login type, remove it there.
- Pagination is cursor-based: `next_cursor` is Meta's `paging.cursors.after` in real modes and a stringified list offset in mock mode — treat it as opaque on the frontend.
- `/api/status.reposts_available` is hardcoded to `mode in {"facebook", "mock"}` in `main.py`; the frontend uses it to show/hide repost UI.
- CORS only allows `FRONTEND_ORIGIN` and the `GET`/`POST`/`DELETE` methods.

**Frontend.** `App.jsx` owns all state (status, profile, accumulated posts, cursor, selected post id) and loads status/profile/first page in parallel. All HTTP goes through `api.js` (`request` throws `Error(data.error)` for non-2xx). `api.js` also holds the shared formatters (`fmt` renders `null`/`undefined` as `"—"`; `fmtDate` uses `es-CO`) and `downloadCSV`. Components in `src/components/` are presentational (`ProfileHeader`, `StatsBar`, `PostGrid`, `PostDetail`); `PostDetail` fetches its own post and (separately, paginated) comments by id, and owns the moderation actions (hide is optimistic with rollback; delete waits for confirmation).

## Gotchas

- Comment `id`s are real Instagram IDs and stable — use them as React `key`s.
- `load_dotenv()` walks up from `config.py`'s directory, so a `.env` in either `backend/` or the repo root is picked up (both are gitignored). Never commit it or expose `IG_ACCESS_TOKEN` to the frontend.
- UI strings and user-facing errors are in Spanish; code identifiers in English.
