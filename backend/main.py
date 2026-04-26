# main.py
import os
from pathlib import Path
from urllib.parse import urlparse

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings

# Import both of your routers!
from routers import users, auth, taxonomy, listings, chat


BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"


def _origin_from_url(url: str) -> str | None:
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}"


def build_allowed_origins() -> list[str]:
    origins = {
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    }

    for url in [settings.frontend_url, settings.backend_base_url]:
        origin = _origin_from_url(url)
        if origin:
            origins.add(origin)

    return sorted(origins)

app = FastAPI(
    title="Bobooks API",
    description="Hyper-local textbook marketplace for Unipd",
    version="0.1.0",
)

os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=build_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect BOTH routers to the app
app.include_router(auth.router)
app.include_router(users.router) 
app.include_router(taxonomy.router)
app.include_router(listings.router)
app.include_router(chat.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Bobooks API!"}


@app.get("/health")
def health():
    return {"status": "ok"}
