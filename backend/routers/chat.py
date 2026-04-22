# routers/chat.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import Dict, List
import json

from database.database import get_db
from database import models
from schemas import chat as chat_schemas  # Ensure you have created this schema!
from routers.auth import get_current_user

router = APIRouter(prefix="/chat", tags=["Chat"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: int):
        print(f"Attempting to send message to User {user_id}")
        print(f"Currently online users: {list(self.active_connections.keys())}")

        if user_id in self.active_connections:
            websocket = self.active_connections[user_id]
            await websocket.send_json(message)
        else:
            print(f"FAILED: User {user_id} is not in active_connections.")

manager = ConnectionManager()

# --- NEW HTTP ROUTE (This will show up in Swagger) ---
@router.post("/rooms", response_model=chat_schemas.ChatRoomResponse)
def create_chat_room(room: chat_schemas.ChatRoomCreate, db: Session = Depends(get_db)):
    """Creates a chat room. Buyer ID comes from the request, Seller ID comes from the Listing."""
    # 1. Check if room already exists
    existing_room = db.query(models.ChatRoom).filter(
        models.ChatRoom.listing_id == room.listing_id,
        models.ChatRoom.buyer_id == room.buyer_id
    ).first()
    
    if existing_room:
        return existing_room

    # 2. Get the listing to find who the seller is
    listing = db.query(models.Listing).filter(models.Listing.id == room.listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    # 3. Create the room
    db_room = models.ChatRoom(
        listing_id=room.listing_id,
        buyer_id=room.buyer_id,
        seller_id=listing.seller_id
    )
    db.add(db_room)
    db.commit()
    db.refresh(db_room)
    return db_room


@router.get("/rooms", response_model=List[chat_schemas.ChatRoomDetail])
def get_user_chat_rooms(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Fetch all chat rooms where the current user is either the buyer or the seller."""
    rooms = db.query(models.ChatRoom).filter(
        or_(
            models.ChatRoom.buyer_id == current_user.id,
            models.ChatRoom.seller_id == current_user.id
        )
    ).all()
    return rooms


@router.get("/rooms/{room_id}/messages", response_model=List[chat_schemas.MessageResponse])
def get_chat_history(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Fetch the message history for a specific room."""
    room = db.query(models.ChatRoom).filter(models.ChatRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    if current_user.id not in [room.buyer_id, room.seller_id]:
        raise HTTPException(status_code=403, detail="Not authorized to view this room")

    messages = db.query(models.Message).filter(
        models.Message.room_id == room_id
    ).order_by(models.Message.timestamp.asc()).all()

    return messages

# --- UPDATED WEBSOCKET ENDPOINT ---
@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int, db: Session = Depends(get_db)):
    await manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            
            room_id = data.get("room_id")
            receiver_id = data.get("receiver_id")
            content = data.get("content")

            # SAFETY CHECK: Ensure the room exists before saving the message
            room = db.query(models.ChatRoom).filter(models.ChatRoom.id == room_id).first()
            if not room:
                await websocket.send_json({"error": f"Room {room_id} does not exist. Create it via POST /chat/rooms first."})
                continue

            # Save to DB
            db_message = models.Message(content=content, room_id=room_id, sender_id=user_id)
            db.add(db_message)
            db.commit()
            db.refresh(db_message)

            full_message = {
                "id": db_message.id,
                "content": db_message.content,
                "sender_id": db_message.sender_id,
                "room_id": db_message.room_id,
                "timestamp": db_message.timestamp.isoformat() if db_message.timestamp else None
            }

            # Forward the complete persisted message to receiver
            await manager.send_personal_message(full_message, receiver_id)
    except WebSocketDisconnect:
        manager.disconnect(user_id)