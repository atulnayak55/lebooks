# schemas/chat.py
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from .user import UserResponse

class MessageBase(BaseModel):
    content: Optional[str] = None
    image_url: Optional[str] = None

class MessageCreate(MessageBase):
    room_id: int

class MessageResponse(MessageBase):
    id: int
    room_id: int
    sender_id: int
    timestamp: datetime
    
    model_config = ConfigDict(from_attributes=True)


class ChatRoomCreate(BaseModel):
    listing_id: int

class ChatRoomResponse(BaseModel):
    id: int
    listing_id: int
    buyer_id: int
    seller_id: int
    
    model_config = ConfigDict(from_attributes=True)


class ListingMini(BaseModel):
    id: int
    title: str
    price: float

    model_config = ConfigDict(from_attributes=True)


class ChatRoomDetail(ChatRoomResponse):
    listing: ListingMini
    buyer: UserResponse
    seller: UserResponse

    model_config = ConfigDict(from_attributes=True)
