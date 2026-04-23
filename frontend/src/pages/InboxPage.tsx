import { useEffect, useState, useMemo } from "react";
import type { AuthSession } from "../features/auth/session";
import { fetchChatRooms, fetchChatHistory, uploadChatImage, type ChatRoomDetail, type MessageResponse } from "../features/chat/api";
import { deleteListing } from "../features/listings/api";
import { useWebSocket } from "../hooks/useWebSocket";
import { backendBaseUrl } from "../lib/api";

type InboxPageProps = {
  session: AuthSession | null;
};

export function InboxPage({ session }: InboxPageProps) {
  const userId = session?.userId;
  const token = session?.token;

  const [rooms, setRooms] = useState<ChatRoomDetail[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoomDetail | null>(null);
  const [history, setHistory] = useState<MessageResponse[]>([]);
  const [draft, setDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Connect to the WebSocket
  const { messages: liveMessages, sendMessage, addMessage } = useWebSocket(userId, token);

  // Load rooms when the page opens
  useEffect(() => {
    if (!token) return;
    fetchChatRooms(token).then(setRooms).catch(console.error);
  }, [token]);

  // Load history when you click on a room
  useEffect(() => {
    if (!activeRoom || !token) return;
    fetchChatHistory(activeRoom.id, token).then(setHistory).catch(console.error);
  }, [activeRoom, token]);

  // Combine database history with live WebSocket messages
  const currentMessages = useMemo(() => {
    if (!activeRoom) return [];
    const activeLiveMessages = liveMessages.filter(m => m.room_id === activeRoom.id);
    const seenIds = new Set<number>();
    return [...history, ...activeLiveMessages].filter((message) => {
      if (message.id === undefined) {
        return true;
      }
      if (seenIds.has(message.id)) {
        return false;
      }
      seenIds.add(message.id);
      return true;
    });
  }, [activeRoom, history, liveMessages]);

  function handleSendText(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !activeRoom || !userId) return;

    const receiverId = userId === activeRoom.seller_id ? activeRoom.buyer_id : activeRoom.seller_id;

    sendMessage({
      content: draft,
      room_id: activeRoom.id,
      receiver_id: receiverId,
    });
    setDraft("");
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeRoom || !userId || !token) return;

    setUploading(true);
    const receiverId = userId === activeRoom.seller_id ? activeRoom.buyer_id : activeRoom.seller_id;

    try {
      const newMsg = await uploadChatImage(activeRoom.id, receiverId, file, token);
      addMessage(newMsg);
    } catch (err) {
      console.error("Failed to upload image", err);
      alert("Failed to send image.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDeleteListingFromChat() {
    if (!activeRoom || !token) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${activeRoom.listing.title}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      await deleteListing(activeRoom.listing_id, token);
      alert("Listing deleted successfully!");
      window.location.reload();
    } catch (err) {
      console.error("Failed to delete listing", err);
      alert("Failed to delete listing.");
    }
  }

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPreviewImageUrl(null);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  if (!session) {
    return <div className="inbox-empty">Please sign in to view your messages.</div>;
  }

  return (
    <div className="inbox-container">
      <div className="inbox-sidebar">
        <h2 className="inbox-title">My Chats</h2>
        {rooms.length === 0 ? <p className="inbox-empty">No active chats.</p> : null}
        
        {rooms.map(room => {
          const isSeller = userId === room.seller_id;
          const otherPerson = isSeller ? room.buyer : room.seller;
          
          return (
            <button 
              key={room.id} 
              className={`inbox-room-btn ${activeRoom?.id === room.id ? "active" : ""}`}
              onClick={() => setActiveRoom(room)}
            >
              <div className="room-listing">{room.listing.title}</div>
              <div className="room-person">{isSeller ? "Buyer" : "Seller"}: {otherPerson.name}</div>
            </button>
          );
        })}
      </div>

      <div className="inbox-main">
        {!activeRoom ? (
          <div className="inbox-empty">Select a conversation to start chatting.</div>
        ) : (
          <>
            <div className="inbox-header">
              <div>
                <h3>{activeRoom.listing.title}</h3>
                <span>
                  Chatting with: {userId === activeRoom.seller_id ? activeRoom.buyer.name : activeRoom.seller.name}
                </span>
              </div>
              {userId === activeRoom.seller_id ? (
                <button
                  className="delete-listing-chat-button"
                  type="button"
                  onClick={handleDeleteListingFromChat}
                >
                  Delete Listing
                </button>
              ) : null}
            </div>
            
            <div className="inbox-messages">
              {currentMessages.length === 0 ? (
                <p className="inbox-empty">No messages yet.</p>
              ) : (
                currentMessages.map((msg, idx) => {
                  const isMine = msg.sender_id === userId;
                  return (
                    <div key={msg.id ?? `local-${idx}`} className={`message-bubble ${isMine ? "mine" : "theirs"}`}>
                      {msg.image_url ? (
                        <img
                          src={`${backendBaseUrl}${msg.image_url}`}
                          alt="Sent attachment"
                          className="message-image"
                          onClick={() => setPreviewImageUrl(`${backendBaseUrl}${msg.image_url}`)}
                        />
                      ) : null}
                      {msg.content ? <span>{msg.content}</span> : null}
                    </div>
                  );
                })
              )}
            </div>

            <form className="inbox-form" onSubmit={handleSendText}>
              <label
                className="attach-button"
                title="Attach an image"
                style={{ opacity: uploading ? 0.6 : 1 }}
              >
                +
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleImageUpload}
                  disabled={uploading}
                />
              </label>
              <input 
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Type a message..."
                disabled={uploading}
              />
              <button type="submit" disabled={!draft.trim() || uploading}>Send</button>
            </form>
          </>
        )}
      </div>

      {previewImageUrl ? (
        <div className="chat-image-preview" role="dialog" aria-modal="true" aria-label="Image preview">
          <button
            type="button"
            className="chat-image-backdrop"
            onClick={() => setPreviewImageUrl(null)}
            aria-label="Close image preview"
          />
          <img src={previewImageUrl} alt="Chat attachment preview" className="chat-image-full" />
        </div>
      ) : null}
    </div>
  );
}
