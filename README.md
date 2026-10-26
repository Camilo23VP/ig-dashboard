# IG Dashboard

Backend en **FastAPI** + frontend en **React (Vite)** para listar las publicaciones de una cuenta profesional de Instagram, con likes, comentarios (cada uno con su ID único), respuestas y reposteos cuando la API los ofrece.

```
ig-dashboard/
├── backend/
│   ├── main.py          # Endpoints REST (/api/...)
│   ├── instagram.py     # Cliente de la Graph API (Instagram o Facebook Login)
│   ├── mock.py          # Datos falsos con la misma interfaz
│   ├── config.py        # Lee el .env
│   └── .env.example
└── frontend/
    ├── vite.config.js   # Proxy /api -> localhost:8000
    └── src/
        ├── App.jsx
        ├── api.js
        └── components/  # ProfileHeader, StatsBar, PostGrid, PostDetail
```

## Arrancar

**Backend**
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows  (en macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env        # (cp en macOS/Linux)
uvicorn main:app --reload --port 8000
```
Documentación interactiva: http://localhost:8000/docs

**Frontend**
```bash
cd frontend
npm install
npm run dev
```
Abre http://localhost:5173

## Modos (`IG_MODE` en `backend/.env`)

| Modo | Host | Qué necesitas | Reposteos |
|---|---|---|---|
| `mock` | — | Nada. Datos falsos para trabajar la UI | Sí (falsos) |
| `instagram` | graph.instagram.com | `IG_ACCESS_TOKEN` de *API setup with Instagram login* | No |
| `facebook` | graph.facebook.com | `IG_ACCESS_TOKEN` (de usuario/página) + `IG_USER_ID` y página de FB vinculada | Sí (`reposts_count`, `shares_count`) |

Para obtener `IG_USER_ID` en modo facebook:
`GET https://graph.facebook.com/v25.0/{PAGE_ID}?fields=instagram_business_account&access_token=...`

## Endpoints

| Método | Ruta | Devuelve |
|---|---|---|
| GET | `/api/status` | Modo actual y si hay reposteos |
| GET | `/api/profile` | Perfil |
| GET | `/api/posts?limit=12&after=CURSOR` | Página de publicaciones + `next_cursor` |
| GET | `/api/posts/{id}` | Publicación (sin comentarios) |
| GET | `/api/posts/{id}/comments?limit=50&after=CURSOR` | Página de comentarios con sus respuestas + `next_cursor` |
| POST | `/api/comments/{id}/hide` `{"hidden": bool}` | Oculta / muestra un comentario |
| DELETE | `/api/comments/{id}` | Elimina un comentario (irreversible) |
| POST | `/api/posts/{id}/comments/enabled` `{"enabled": bool}` | Activa / desactiva los comentarios de una publicación |

Las acciones de moderación necesitan el permiso `instagram_business_manage_comments` (modo `instagram`) o `instagram_manage_comments` (modo `facebook`). No tienen autenticación: son para uso local; protégelas antes de desplegar (CORS no es autenticación).

## Limitaciones de la API (no del proyecto)

- Los likes son un **conteo**; Meta no expone quién dio like.
- Si el dueño oculta likes o vistas, el campo no llega y se muestra "—".
- `reposts_count` solo existe con Facebook Login.
- Cada comentario trae su `id` de Instagram: es único y estable, úsalo como llave.

## Seguridad

- El token vive solo en el backend; el frontend nunca lo ve.
- `.env` está en `.gitignore`. No lo subas.
