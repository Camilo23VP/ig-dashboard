# AGENTS.md — IG Dashboard

FastAPI (backend) + React/Vite (frontend) para mostrar publicaciones de Instagram. Repositorio pequeño y sin pipeline: no hay tests, linter, formatter ni CI configurados.

## Estructura real

- `backend/` — API FastAPI. No es un paquete instalable; corre directamente con `uvicorn`.
- `frontend/` — App React con Vite. Tiene su propio `package.json`; no hay manifiesto en la raíz.
- `README.md` — Fuente de verdad para endpoints, modos y setup inicial.

## Comandos de desarrollo

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env          # Windows (macOS/Linux: cp .env.example .env)
uvicorn main:app --reload --port 8000
```

Docs interactivos: `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

URL: `http://localhost:5173`

## Modos de operación (`backend/.env`)

La variable `IG_MODE` decide el origen de datos:

| Modo | Origen | Requisitos |
|---|---|---|
| `mock` | Datos sintéticos en `mock.py` | Nada. Útil para trabajar la UI sin token. |
| `instagram` | `graph.instagram.com` | `IG_ACCESS_TOKEN` de *API setup with Instagram Login*. No trae reposteos. |
| `facebook` | `graph.facebook.com` | `IG_ACCESS_TOKEN` + `IG_USER_ID` de cuenta IG vinculada a página de FB. Sí trae reposteos. |

Para obtener `IG_USER_ID` en modo `facebook`:
```
GET https://graph.facebook.com/v25.0/{PAGE_ID}?fields=instagram_business_account&access_token=...
```

## Convenciones y gotchas

- **Siempre arranca el backend antes que el frontend en desarrollo.** El proxy de Vite apunta a `http://localhost:8000` (`frontend/vite.config.js`); sin backend, las llamadas a `/api` fallan.
- **No expongas el token al frontend.** `IG_ACCESS_TOKEN` vive solo en `backend/.env`. El CORS del backend solo permite el origen configurado en `FRONTEND_ORIGIN`.
- **El frontend no tiene tests, lint ni typecheck.** No busques configuración de Jest, ESLint, Prettier ni TypeScript; no existe.
- **El backend no tiene tests ni formatter configurado.** No hay `pytest.ini`, `pyproject.toml` ni `setup.cfg`.
- **Las claves de los comentarios son `id` reales de Instagram.** Úsalas como `key` en React; son estables.
- **Algunos campos pueden venir vacíos** (likes ocultos, vistas no disponibles, reposteos según modo); el frontend ya maneja el fallback a `"—"`.
- **Build de producción:** `cd frontend && npm run build` genera `frontend/dist/`. No hay deploy automatizado configurado.

## Verificación rápida

1. Backend levantado: `http://localhost:8000/api/status` debe devolver el modo actual.
2. Frontend levantado: abre `http://localhost:5173` y confirma que las llamadas a `/api/*` responden.

## Seguridad

- `.env` está en `.gitignore`. Nunca lo subas.
- No incluyas tokens, secrets ni credenciales de Meta en el código.
