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

    async def _get(self, path: str, **params) -> dict:
        params["access_token"] = config.ACCESS_TOKEN
        resp = await self.http.get(f"{self.base}/{path}", params=params)
        data = resp.json()
        if "error" in data:
            err = data["error"]
            raise InstagramError(resp.status_code, err.get("message", "Error desconocido"), err.get("code"))
        return data

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
            "next_cursor": data.get("paging", {}).get("cursors", {}).get("after")
            if data.get("paging", {}).get("next") else None,
        }

    async def post(self, media_id: str) -> dict:
        fields = ",".join(self.media_fields) + ",children{id,media_type,media_url,thumbnail_url}"
        data = await self._get(media_id, fields=fields)
        post = self._normalize_post(data)
        post["children"] = data.get("children", {}).get("data", [])
        return post

    # ---------- Comentarios (trae todas las páginas) ----------
    async def comments(self, media_id: str) -> list[dict]:
        fields = f"{COMMENT_FIELDS},replies{{{COMMENT_FIELDS}}}"
        result, after = [], None
        while True:
            params = {"fields": fields, "limit": 50}
            if after:
                params["after"] = after
            data = await self._get(f"{media_id}/comments", **params)
            for c in data.get("data", []):
                c["replies"] = c.get("replies", {}).get("data", [])
                result.append(c)
            paging = data.get("paging", {})
            if not paging.get("next"):
                return result
            after = paging.get("cursors", {}).get("after")

    def _normalize_post(self, p: dict) -> dict:
        """Garantiza que el frontend siempre reciba las mismas llaves.
        None significa 'no disponible' (oculto por el dueño o no soportado por el login)."""
        for f in FACEBOOK_ONLY_MEDIA_FIELDS + ["like_count", "comments_count"]:
            p.setdefault(f, None)
        return p
