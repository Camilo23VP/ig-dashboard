"""Configuración leída desde variables de entorno (.env)."""
import os
from dotenv import load_dotenv

load_dotenv()

# mock      -> datos falsos, no necesita token (para trabajar el frontend)
# instagram -> Instagram API with Instagram Login (graph.instagram.com)
# facebook  -> Instagram API with Facebook Login (graph.facebook.com), trae reposteos
MODE = os.getenv("IG_MODE", "mock").lower()

ACCESS_TOKEN = os.getenv("IG_ACCESS_TOKEN", "")
API_VERSION = os.getenv("IG_API_VERSION", "v25.0")

# Solo para modo facebook: el ID de la cuenta de Instagram vinculada a la página
IG_USER_ID = os.getenv("IG_USER_ID", "")

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

if MODE not in {"mock", "instagram", "facebook"}:
    raise ValueError(f"IG_MODE inválido: {MODE!r}. Usa mock, instagram o facebook.")

if MODE != "mock" and not ACCESS_TOKEN:
    raise ValueError("Falta IG_ACCESS_TOKEN en el .env")

if MODE == "facebook" and not IG_USER_ID:
    raise ValueError("En modo facebook necesitas IG_USER_ID en el .env")
