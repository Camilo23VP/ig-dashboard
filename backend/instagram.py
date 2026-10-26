"""
Cliente de la API de Instagram.

Encapsula las diferencias entre los dos tipos de login:
  - instagram: host graph.instagram.com, el usuario es "me"
  - facebook:  host graph.facebook.com, el usuario es el IG_USER_ID y hay más campos
"""
import httpx

import config


class InstagramError(Exception):
    def __init__(self, status: int, message: str, code=None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.code = code


# Campos base, disponibles con ambos logins
BASE_MEDIA_FIELDS = [
    "id", "caption", "media_type", "media_product_type", "media_url",
    "thumbnail_url", "permalink", "timestamp", "like_count", "comments_count",
]

# Solo existen con Facebook Login
FACEBOOK_ONLY_MEDIA_FIELDS = ["reposts_count", "shares_count", "total_like_count", "total_comments_count"]

COMMENT_FIELDS = "id,text,username,timestamp,like_count,hidden"

# Tope de páginas extra al completar las respuestas de un solo comentario
MAX_REPLY_PAGES = 10


class InstagramClient:
    def __init__(self):
        if config.MODE == "facebook":
            self.base = f"https://graph.facebook.com/{config.API_VERSION}"
            self.user = config.IG_USER_ID
            self.media_fields = BASE_MEDIA_FIELDS + FACEBOOK_ONLY_MEDIA_FIELDS
            self.profile_fields = "id,username,name,profile_picture_url,followers_count,follows_count,media_count"
        else:
            self.base = f"https://graph.instagram.com/{config.API_VERSION}"
            self.user = "me"
            self.media_fields = BASE_MEDIA_FIELDS
            self.profile_fields = "user_id,username,name,profile_picture_url,account_type,followers_count,follows_count,media_count"
        self.http = httpx.AsyncClient(timeout=30)

    async def _request(self, method: str, path: str, **params) -> dict:
        params["access_token"] = config.ACCESS_TOKEN
        try:
            resp = await self.http.request(method, f"{self.base}/{path}", params=params)
            data = resp.json()
        except (httpx.HTTPError, ValueError):
            # No propagamos el detalle de httpx: la URL incluye el token
            raise InstagramError(502, "No se pudo contactar a Instagram") from None
        if "error" in data:
            err = data["error"]
            raise InstagramError(resp.status_code, err.get("message", "Error desconocido"), err.get("code"))
        return data

    async def _get(self, path: str, **params) -> dict:
        return await self._request("GET", path, **params)

    @staticmethod
    def _next_cursor(data: dict) -> str | None:
        paging = data.get("paging", {})
        return paging.get("cursors", {}).get("after") if paging.get("next") else None

    # ---------- Perfil ----------
    async def profile(self) -> dict:
        return await self._get(self.user, fields=self.profile_fields)

    # ---------- Publicaciones (paginadas con cursor) ----------
    async def posts(self, limit: int = 12, after: str | None = None) -> dict:
        params = {"fields": ",".join(self.media_fields), "limit": limit}
        if after:
            params["after"] = after
        data = await self._get(f"{self.user}/media", **params)
        return {
            "data": [self._normalize_post(p) for p in data.get("data", [])],
            "next_cursor": self._next_cursor(data),
        }

    async def post(self, media_id: str) -> dict:
        fields = ",".join(self.media_fields) + ",is_comment_enabled,children{id,media_type,media_url,thumbnail_url}"
        data = await self._get(media_id, fields=fields)
        post = self._normalize_post(data)
        post["children"] = data.get("children", {}).get("data", [])
        return post

    # ---------- Comentarios (paginados con cursor) ----------
    async def comments(self, media_id: str, limit: int = 50, after: str | None = None) -> dict:
        params = {"fields": f"{COMMENT_FIELDS},replies{{{COMMENT_FIELDS}}}", "limit": limit}
        if after:
            params["after"] = after
        data = await self._get(f"{media_id}/comments", **params)
        return {
            "data": [await self._normalize_comment(c) for c in data.get("data", [])],
            "next_cursor": self._next_cursor(data),
        }

    async def _normalize_comment(self, comment: dict) -> dict:
        """Deja `replies` como lista plana, siguiendo la paginación de la expansión si hace falta."""
        replies = comment.get("replies", {})
        result = list(replies.get("data", []))
        after = self._next_cursor(replies)
        for _ in range(MAX_REPLY_PAGES):
            if not after:
                break
            page = await self._get(f"{comment['id']}/replies", fields=COMMENT_FIELDS, limit=50, after=after)
            result.extend(page.get("data", []))
            after = self._next_cursor(page)
        comment["replies"] = result
        return comment

    # ---------- Moderación ----------
    async def hide_comment(self, comment_id: str, hidden: bool) -> dict:
        await self._request("POST", comment_id, hide=str(hidden).lower())
        return {"id": comment_id, "hidden": hidden}

    async def delete_comment(self, comment_id: str) -> None:
        await self._request("DELETE", comment_id)

    async def set_comments_enabled(self, media_id: str, enabled: bool) -> dict:
        await self._request("POST", media_id, comment_enabled=str(enabled).lower())
        return {"id": media_id, "is_comment_enabled": enabled}

    def _normalize_post(self, p: dict) -> dict:
        """Garantiza que el frontend siempre reciba las mismas llaves.
        None significa 'no disponible' (oculto por el dueño o no soportado por el login)."""
        for f in FACEBOOK_ONLY_MEDIA_FIELDS + ["like_count", "comments_count", "is_comment_enabled"]:
            p.setdefault(f, None)
        return p
