# main.py
import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from database.database import engine
from database import models

# Import both of your routers!
from routers import users, auth, taxonomy, listings, chat

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Bobooks API",
    description="Hyper-local textbook marketplace for Unipd",
    version="0.1.0"
)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
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