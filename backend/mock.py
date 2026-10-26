"""Cliente falso con la misma interfaz que InstagramClient. Útil para desarrollar el frontend."""
import random
from datetime import datetime, timedelta, timezone

from instagram import InstagramError

random.seed(7)

USERS = ["laura.dev", "andres_mde", "sofi.law", "juanpa.codes", "vale_rios", "mateo.ux"]
TEXTS = [
    "¡Brutal este contenido! 🔥", "¿Qué stack usaste?", "Me sirvió muchísimo, gracias",
    "Esto debería tener más alcance", "¿Haces mentorías?", "Jajaja totalmente cierto",
    "Guardado para verlo con calma", "Excelente explicación 👏",
]
CAPTIONS = [
    "Conectando la API de Instagram con Python y React 🚀",
    "Derecho + tecnología: el punto donde quiero estar",
    "Un día de trabajo en Medellín ☕",
    "Low-code no es menos código, es código donde importa",
    "Aprendiendo ingeniería de datos paso a paso",
]

now = datetime.now(timezone.utc)


def _comment(i: int, base_id: int) -> dict:
    return {
        "id": str(base_id + i),
        "text": random.choice(TEXTS),
        "username": random.choice(USERS),
        "timestamp": (now - timedelta(hours=random.randint(1, 400))).isoformat(),
        "like_count": random.randint(0, 25),
        "hidden": False,
    }


POSTS = []
COMMENTS = {}
for n in range(30):
    media_id = str(17900000000000000 + n * 137)
    media_type = random.choice(["IMAGE", "VIDEO", "CAROUSEL_ALBUM"])
    n_comments = random.randint(0, 8)
    comments = []
    for i in range(n_comments):
        c = _comment(i, int(media_id) * 10 + i * 100)
        c["replies"] = [_comment(j, int(c["id"]) + 1) for j in range(random.randint(0, 2))]
        comments.append(c)
    COMMENTS[media_id] = comments
    POSTS.append({
        "id": media_id,
        "caption": random.choice(CAPTIONS),
        "media_type": media_type,
        "media_product_type": "REELS" if media_type == "VIDEO" else "FEED",
        "media_url": f"https://picsum.photos/seed/{n}/600/600",
        "thumbnail_url": f"https://picsum.photos/seed/{n}/600/600" if media_type == "VIDEO" else None,
        "permalink": "https://www.instagram.com/",
        "timestamp": (now - timedelta(days=n * 3)).isoformat(),
        "like_count": random.randint(10, 900),
        "comments_count": n_comments + sum(len(c["replies"]) for c in comments),
        "reposts_count": random.randint(0, 40),
        "shares_count": random.randint(0, 60),
        "total_like_count": None,
        "total_comments_count": None,
        "is_comment_enabled": True,
    })


class MockClient:
    async def profile(self) -> dict:
        return {
            "user_id": "mock", "username": "camilo.mock", "name": "Modo demo",
            "profile_picture_url": "https://picsum.photos/seed/avatar/200/200",
            "account_type": "MEDIA_CREATOR", "followers_count": 1234,
            "follows_count": 321, "media_count": len(POSTS),
        }

    async def posts(self, limit: int = 12, after: str | None = None) -> dict:
        start = int(after or 0)
        end = start + limit
        return {"data": POSTS[start:end], "next_cursor": str(end) if end < len(POSTS) else None}

    async def post(self, media_id: str) -> dict:
        return {**self._find_post(media_id), "children": []}

    async def comments(self, media_id: str, limit: int = 50, after: str | None = None) -> dict:
        all_comments = COMMENTS.get(media_id, [])
        start = int(after or 0)
        end = start + limit
        return {"data": all_comments[start:end], "next_cursor": str(end) if end < len(all_comments) else None}

    # ---------- Moderación (muta los datos en memoria) ----------
    async def hide_comment(self, comment_id: str, hidden: bool) -> dict:
        _, comment, _ = self._find_comment(comment_id)
        comment["hidden"] = hidden
        return {"id": comment_id, "hidden": hidden}

    async def delete_comment(self, comment_id: str) -> None:
        media_id, comment, siblings = self._find_comment(comment_id)
        removed = 1 + len(comment.get("replies", []))
        siblings.remove(comment)
        post = self._find_post(media_id)
        post["comments_count"] = max(0, post["comments_count"] - removed)

    async def set_comments_enabled(self, media_id: str, enabled: bool) -> dict:
        self._find_post(media_id)["is_comment_enabled"] = enabled
        return {"id": media_id, "is_comment_enabled": enabled}

    @staticmethod
    def _find_post(media_id: str) -> dict:
        for post in POSTS:
            if post["id"] == media_id:
                return post
        raise InstagramError(404, "Publicación no encontrada")

    @staticmethod
    def _find_comment(comment_id: str) -> tuple[str, dict, list[dict]]:
        """Devuelve (media_id, comentario, lista que lo contiene) para comentarios y respuestas."""
        for media_id, comments in COMMENTS.items():
            for comment in comments:
                if comment["id"] == comment_id:
                    return media_id, comment, comments
                for reply in comment["replies"]:
                    if reply["id"] == comment_id:
                        return media_id, reply, comment["replies"]
        raise InstagramError(404, "Comentario no encontrado")
