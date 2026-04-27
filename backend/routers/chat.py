# routers/chat.py
from pathlib import Path

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.sql import func
from typing import Dict, List

from database.database import get_db
from database import models
from schemas import chat as chat_schemas  # Ensure you have created this schema!
from routers.auth import get_current_user, get_user_from_token
from services.uploads import save_validated_image

router = APIRouter(prefix="/chat", tags=["Chat"])
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.setdefault(user_id, []).append(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket):
        connections = self.active_connections.get(user_id)
        if not connections:
            return

        remaining_connections = [connection for connection in connections if connection is not websocket]
        if remaining_connections:
            self.active_connections[user_id] = remaining_connections
        else:
            del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: int):
        connections = list(self.active_connections.get(user_id, []))
        stale_connections: List[WebSocket] = []

        for websocket in connections:
            try:
                await websocket.send_json(message)
            except Exception:
                stale_connections.append(websocket)

        for websocket in stale_connections:
            self.disconnect(user_id, websocket)

manager = ConnectionManager()


def message_to_payload(message: models.Message) -> dict:
    return {
        "id": message.id,
        "content": message.content,
        "image_url": message.image_url,
        "sender_id": message.sender_id,
        "room_id": message.room_id,
        "timestamp": message.timestamp.isoformat() if message.timestamp else None,
        "seen_at": message.seen_at.isoformat() if message.seen_at else None,
    }


# --- NEW HTTP ROUTE (This will show up in Swagger) ---
@router.post("/rooms", response_model=chat_schemas.ChatRoomResponse)
def create_chat_room(
    room: chat_schemas.ChatRoomCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Create a chat room. The buyer comes from the authenticated user."""
    listing = db.query(models.Listing).filter(models.Listing.id == room.listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    if listing.seller_id == current_user.id:
        raise HTTPException(status_code=400, detail="Sellers cannot create buyer chats for their own listings")

    existing_room = db.query(models.ChatRoom).filter(
        models.ChatRoom.listing_id == room.listing_id,
        models.ChatRoom.buyer_id == current_user.id,
    ).first()
    
    if existing_room:
        return existing_room

    db_room = models.ChatRoom(
        listing_id=room.listing_id,
        buyer_id=current_user.id,
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
    room_ids = db.query(models.ChatRoom.id).outerjoin(
        models.Message,
        models.Message.room_id == models.ChatRoom.id,
    ).filter(
        or_(
            models.ChatRoom.buyer_id == current_user.id,
            models.ChatRoom.seller_id == current_user.id
        )
    ).group_by(
        models.ChatRoom.id,
    ).order_by(
        func.max(models.Message.timestamp).desc().nullslast(),
        models.ChatRoom.id.desc(),
    ).all()

    ordered_room_ids = [room_id for room_id, in room_ids]
    if not ordered_room_ids:
        return []

    rooms = db.query(models.ChatRoom).options(
        joinedload(models.ChatRoom.listing),
        joinedload(models.ChatRoom.buyer),
        joinedload(models.ChatRoom.seller),
    ).filter(
        models.ChatRoom.id.in_(ordered_room_ids),
    ).all()

    rooms_by_id = {room.id: room for room in rooms}
    return [rooms_by_id[room_id] for room_id in ordered_room_ids if room_id in rooms_by_id]


@router.get("/rooms/{room_id}", response_model=chat_schemas.ChatRoomDetail)
def get_chat_room(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    room = db.query(models.ChatRoom).options(
        joinedload(models.ChatRoom.listing),
        joinedload(models.ChatRoom.buyer),
        joinedload(models.ChatRoom.seller),
    ).filter(
        models.ChatRoom.id == room_id,
    ).first()

    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    if current_user.id not in [room.buyer_id, room.seller_id]:
        raise HTTPException(status_code=403, detail="Not authorized to view this room")

    return room


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


@router.post("/rooms/{room_id}/read", response_model=chat_schemas.ReadReceiptResponse)
async def mark_room_messages_read(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Mark messages from the other participant as seen."""
    room = db.query(models.ChatRoom).filter(models.ChatRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    if current_user.id not in [room.buyer_id, room.seller_id]:
        raise HTTPException(status_code=403, detail="Not authorized for this room")

    messages = db.query(models.Message).filter(
        models.Message.room_id == room_id,
        models.Message.sender_id != current_user.id,
        models.Message.seen_at.is_(None),
    ).all()

    seen_at = db.query(func.now()).scalar()
    message_ids: List[int] = []
    sender_ids: set[int] = set()

    for message in messages:
        message.seen_at = seen_at
        message_ids.append(message.id)
        sender_ids.add(message.sender_id)

    db.commit()

    receipt = {
        "type": "read_receipt",
        "room_id": room_id,
        "message_ids": message_ids,
        "seen_at": seen_at.isoformat(),
    }
    for sender_id in sender_ids:
        await manager.send_personal_message(receipt, sender_id)

    return {"room_id": room_id, "message_ids": message_ids, "seen_at": seen_at}


@router.post("/rooms/{room_id}/messages/image", response_model=chat_schemas.MessageResponse)
async def upload_chat_image(
    room_id: int,
    receiver_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Upload an image to a chat room and broadcast it via WebSocket."""
    room = db.query(models.ChatRoom).filter(models.ChatRoom.id == room_id).first()
    if not room or current_user.id not in [room.buyer_id, room.seller_id]:
        raise HTTPException(status_code=403, detail="Not authorized for this room")

    # Ensure receiver belongs to this room to avoid pushing messages to unrelated users.
    if receiver_id not in [room.buyer_id, room.seller_id]:
        raise HTTPException(status_code=400, detail="Receiver does not belong to this room")
    if receiver_id == current_user.id:
        raise HTTPException(status_code=400, detail="Receiver must be the other room participant")

    stored_filename = save_validated_image(file=file, upload_dir=UPLOAD_DIR, filename_prefix="chat_")
    image_url = f"/uploads/{stored_filename}"

    db_message = models.Message(
        content="",
        image_url=image_url,
        room_id=room_id,
        sender_id=current_user.id,
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)

    full_message = message_to_payload(db_message)
    await manager.send_personal_message(full_message, current_user.id)
    await manager.send_personal_message(full_message, receiver_id)

    return db_message


@router.post("/rooms/{room_id}/messages", response_model=chat_schemas.MessageResponse)
async def create_chat_message(
    room_id: int,
    message: chat_schemas.MessageTextCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Save a text chat message and broadcast it to connected participants."""
    room = db.query(models.ChatRoom).filter(models.ChatRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    if current_user.id not in [room.buyer_id, room.seller_id]:
        raise HTTPException(status_code=403, detail="Not authorized for this room")

    normalized_content = message.content.strip()
    if not normalized_content:
        raise HTTPException(status_code=400, detail="Message content cannot be empty")

    receiver_id = room.seller_id if current_user.id == room.buyer_id else room.buyer_id
    db_message = models.Message(
        content=normalized_content,
        room_id=room_id,
        sender_id=current_user.id,
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)

    full_message = message_to_payload(db_message)
    await manager.send_personal_message(full_message, current_user.id)
    await manager.send_personal_message(full_message, receiver_id)

    return db_message

# --- UPDATED WEBSOCKET ENDPOINT ---
@router.websocket("/ws")
@router.websocket("/ws/{_legacy_user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str,
    _legacy_user_id: int | None = None,
    db: Session = Depends(get_db),
):
    try:
        current_user = get_user_from_token(token=token, db=db)
    except HTTPException:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id = current_user.id
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

            if user_id not in [room.buyer_id, room.seller_id]:
                await websocket.send_json({"error": "Not authorized for this room"})
                continue

            expected_receiver_id = room.seller_id if user_id == room.buyer_id else room.buyer_id
            if receiver_id != expected_receiver_id:
                await websocket.send_json({"error": "Receiver does not belong to this conversation"})
                continue

            normalized_content = (content or "").strip()
            if not normalized_content:
                await websocket.send_json({"error": "Message content cannot be empty"})
                continue

            # Save to DB
            db_message = models.Message(content=normalized_content, room_id=room_id, sender_id=user_id)
            db.add(db_message)
            db.commit()
            db.refresh(db_message)

            full_message = message_to_payload(db_message)

            # Echo the persisted message to both participants so IDs match read receipts.
            await manager.send_personal_message(full_message, user_id)
            await manager.send_personal_message(full_message, receiver_id)
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(user_id, websocket)
