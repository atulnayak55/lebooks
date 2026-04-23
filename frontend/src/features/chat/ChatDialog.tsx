import { useMemo, useState, useEffect } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { createOrGetChatRoom, fetchChatHistory, type ChatRoomResponse, type MessageResponse } from "./api";
import type { Listing } from "../../types/domain";

type ChatDialogProps = {
  open: boolean;
  listing: Listing | null;
  currentUserId: number; // The ID of the logged-in buyer
  token: string;
  onClose: () => void;
};

export function ChatDialog({ open, listing, currentUserId, token, onClose }: ChatDialogProps) {
  const [roomId, setRoomId] = useState<number | null>(null);
  const [roomInfo, setRoomInfo] = useState<ChatRoomResponse | null>(null);
  const [history, setHistory] = useState<MessageResponse[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Connect to the WebSocket using our custom hook!
  const { messages, sendMessage } = useWebSocket(currentUserId, token);

  // When the dialog opens, ping the backend to create/fetch the room
  useEffect(() => {
    async function initRoom() {
      if (!open || !listing || !currentUserId || !token) return;
      
      try {
        const room = await createOrGetChatRoom({ listing_id: listing.id }, token);
        const messageHistory = await fetchChatHistory(room.id, token);
        setRoomId(room.id);
        setRoomInfo(room);
        setHistory(messageHistory);
        setError(null);
      } catch {
        setError("Could not initialize chat room.");
      }
    }

    initRoom();
  }, [open, listing, currentUserId, token]);

  // Filter messages to only show ones for THIS specific room
  const roomMessages = useMemo(() => {
    const liveRoomMessages = messages.filter(m => m.room_id === roomId);
    const seenIds = new Set<number>();
    return [...history, ...liveRoomMessages].filter((message) => {
      if (message.id === undefined) {
        return true;
      }
      if (seenIds.has(message.id)) {
        return false;
      }
      seenIds.add(message.id);
      return true;
    });
  }, [history, messages, roomId]);

  if (!open || !listing) return null;

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !roomId || !roomInfo) return;

    const receiverId =
      currentUserId === roomInfo.seller_id ? roomInfo.buyer_id : roomInfo.seller_id;

    sendMessage({
      content: draft,
      room_id: roomId,
      receiver_id: receiverId
    });
    
    setDraft(""); // Clear input
  }

  function handleClose() {
    setRoomId(null);
    setRoomInfo(null);
    setHistory([]);
    setDraft("");
    setError(null);
    onClose();
  }

  return (
    <div className="auth-overlay" role="dialog" aria-modal="true">
      <div className="auth-dialog chat-dialog" style={{ display: 'flex', flexDirection: 'column', height: '400px' }}>
        
        <div className="auth-topbar">
          <h2>Chat about: {listing.title}</h2>
          <button className="auth-close" onClick={handleClose}>x</button>
        </div>

        {error ? <p className="auth-error">{error}</p> : null}

        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', padding: '0.5rem' }}>
          {roomMessages.length === 0 && !error ? (
            <p style={{ color: '#64748b', textAlign: 'center', marginTop: '2rem' }}>Send a message to start chatting!</p>
          ) : (
            roomMessages.map((msg, idx) => {
              const isMine = msg.sender_id === currentUserId;
              return (
                <div key={msg.id ?? `local-${idx}`} style={{ textAlign: isMine ? 'right' : 'left', marginBottom: '0.5rem' }}>
                  <span style={{ 
                    display: 'inline-block', 
                    background: isMine ? '#0ea5e9' : '#e2e8f0', 
                    color: isMine ? '#fff' : '#0f172a',
                    padding: '0.4rem 0.8rem', 
                    borderRadius: '1rem' 
                  }}>
                    {msg.content}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <form style={{ display: 'flex', gap: '0.5rem' }} onSubmit={handleSend}>
          <input 
            style={{ flex: 1, border: '1px solid #cbd5e1', borderRadius: '0.5rem', padding: '0.5rem' }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message..."
            disabled={!roomId}
          />
          <button className="auth-submit" type="submit" disabled={!roomId || !draft.trim()}>
            Send
          </button>
        </form>

      </div>
    </div>
  );
}
