"""
API del dashboard. Ejecutar:
    uvicorn main:app --reload --port 8000
Docs interactivas en http://localhost:8000/docs
"""
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import config
from instagram import InstagramClient, InstagramError
from mock import MockClient

app = FastAPI(title="IG Dashboard API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.FRONTEND_ORIGIN],
    allow_methods=["GET"],
    allow_headers=["*"],
)

client = MockClient() if config.MODE == "mock" else InstagramClient()


@app.exception_handler(InstagramError)
async def instagram_error_handler(_, exc: InstagramError):
    # Nunca reenviamos el token; solo el mensaje de Meta
    return JSONResponse(status_code=exc.status if exc.status >= 400 else 502,
                        content={"error": exc.message, "code": exc.code})


@app.get("/api/status")
async def status():
    return {
        "mode": config.MODE,
        "api_version": config.API_VERSION,
        "reposts_available": config.MODE in {"facebook", "mock"},
    }


@app.get("/api/profile")
async def profile():
    return await client.profile()


@app.get("/api/posts")
async def posts(limit: int = Query(12, ge=1, le=50), after: str | None = None):
    return await client.posts(limit=limit, after=after)


@app.get("/api/posts/{media_id}")
async def post_detail(media_id: str):
    post = await client.post(media_id)
    post["comments"] = await client.comments(media_id)
    return post
