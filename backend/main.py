# main.py
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from database.database import engine
from database import models

# Import both of your routers!
from routers import users, auth, taxonomy, listings, chat


BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"


def ensure_lightweight_schema_updates() -> None:
    inspector = inspect(engine)
    if "messages" not in inspector.get_table_names():
        return

    message_columns = {column["name"] for column in inspector.get_columns("messages")}
    if "seen_at" not in message_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE messages ADD COLUMN seen_at TIMESTAMP WITH TIME ZONE"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    models.Base.metadata.create_all(bind=engine)
    ensure_lightweight_schema_updates()
    yield

app = FastAPI(
    title="Bobooks API",
    description="Hyper-local textbook marketplace for Unipd",
    version="0.1.0",
    lifespan=lifespan,
)

os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://10.190.169.144:5173",
        "http://10.190.169.144:5174",
    ],
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
