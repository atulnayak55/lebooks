# models.py
from sqlalchemy import Boolean, Column, Integer, String, Float, DateTime, ForeignKey, Table, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

# ---------------------------------------------------------
# JUNCTION TABLE (Many-to-Many)
# ---------------------------------------------------------
# This maps which subjects belong to which programs.
# We use a Table instead of a Class because it holds no extra data.
program_subjects = Table(
    "program_subjects",
    Base.metadata,
    Column("program_id", Integer, ForeignKey("programs.id", ondelete="CASCADE"), primary_key=True),
    Column("subject_id", Integer, ForeignKey("subjects.id", ondelete="CASCADE"), primary_key=True)
)

# ---------------------------------------------------------
# ACADEMIC HIERARCHY
# ---------------------------------------------------------
class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True) 
    
    programs = relationship("Program", back_populates="department")

class Program(Base):
    __tablename__ = "programs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True) 
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="CASCADE"))
    
    department = relationship("Department", back_populates="programs")
    # Link to Subjects via the junction table
    subjects = relationship("Subject", secondary=program_subjects, back_populates="programs")

class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True) # e.g., "Calculus 1"
    
    programs = relationship("Program", secondary=program_subjects, back_populates="subjects")
    listings = relationship("Listing", back_populates="subject")

# ---------------------------------------------------------
# MARKETPLACE (Users & Listings)
# ---------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    unipd_id = Column(String, unique=True, nullable=True) 
    hashed_password = Column(String)
    is_verified = Column(Boolean, default=False, nullable=False)
    email_verified_at = Column(DateTime(timezone=True), nullable=True)
    
    listings = relationship("Listing", back_populates="seller")
    
    # We need explicit foreign_keys here because ChatRoom has two User keys
    chats_as_buyer = relationship("ChatRoom", foreign_keys="[ChatRoom.buyer_id]", back_populates="buyer")
    chats_as_seller = relationship("ChatRoom", foreign_keys="[ChatRoom.seller_id]", back_populates="seller")
    messages = relationship("Message", back_populates="sender")
    auth_tokens = relationship("AuthToken", back_populates="user", cascade="all, delete-orphan")

class Listing(Base):
    __tablename__ = "listings"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    price = Column(Float)
    condition = Column(String)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    seller_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True)
    
    seller = relationship("User", back_populates="listings")
    subject = relationship("Subject", back_populates="listings")
    
    images = relationship("ListingImage", back_populates="listing", cascade="all, delete-orphan")
    chat_rooms = relationship("ChatRoom", back_populates="listing")

class ListingImage(Base):
    __tablename__ = "listing_images"

    id = Column(Integer, primary_key=True, index=True)
    image_url = Column(String)
    listing_id = Column(Integer, ForeignKey("listings.id", ondelete="CASCADE"))
    
    listing = relationship("Listing", back_populates="images")

# ---------------------------------------------------------
# COMMUNICATION (Chats)
# ---------------------------------------------------------
class ChatRoom(Base):
    __tablename__ = "chat_rooms"

    id = Column(Integer, primary_key=True, index=True)
    listing_id = Column(Integer, ForeignKey("listings.id", ondelete="CASCADE"))
    buyer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    seller_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    
    listing = relationship("Listing", back_populates="chat_rooms")
    buyer = relationship("User", foreign_keys=[buyer_id], back_populates="chats_as_buyer")
    seller = relationship("User", foreign_keys=[seller_id], back_populates="chats_as_seller")
    
    messages = relationship("Message", back_populates="room", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text)
    image_url = Column(String, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    seen_at = Column(DateTime(timezone=True), nullable=True)
    
    room_id = Column(Integer, ForeignKey("chat_rooms.id", ondelete="CASCADE"))
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    
    room = relationship("ChatRoom", back_populates="messages")
    sender = relationship("User", back_populates="messages")


class AuthToken(Base):
    __tablename__ = "auth_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String, unique=True, nullable=False, index=True)
    purpose = Column(String, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="auth_tokens")
