import { useEffect, useState, useMemo } from "react";
import { getAuthSession } from "../features/auth/session";
import { fetchChatRooms, fetchChatHistory, type ChatRoomDetail, type MessageResponse } from "../features/chat/api";
import { useWebSocket } from "../hooks/useWebSocket";

export function InboxPage() {
  const session = getAuthSession();
  const userId = session?.userId;
  const token = session?.token;

  const [rooms, setRooms] = useState<ChatRoomDetail[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoomDetail | null>(null);
  const [history, setHistory] = useState<MessageResponse[]>([]);
  const [draft, setDraft] = useState("");

  // Connect to the WebSocket
  const { messages: liveMessages, sendMessage } = useWebSocket(userId);

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
    // Merge them (in a real app, you'd deduplicate here, but this is fine for now)
    return [...history, ...activeLiveMessages];
  }, [activeRoom, history, liveMessages]);

  function handleSend(e: React.FormEvent) {
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
              <h3>{activeRoom.listing.title}</h3>
              <span>{userId === activeRoom.seller_id ? activeRoom.buyer.name : activeRoom.seller.name}</span>
            </div>
            
            <div className="inbox-messages">
              {currentMessages.length === 0 ? (
                <p className="inbox-empty">No messages yet.</p>
              ) : (
                currentMessages.map((msg, idx) => {
                  const isMine = msg.sender_id === userId;
                  return (
                    <div key={idx} className={`message-bubble ${isMine ? "mine" : "theirs"}`}>
                      <span>{msg.content}</span>
                    </div>
                  );
                })
              )}
            </div>

            <form className="inbox-form" onSubmit={handleSend}>
              <input 
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Type a message..."
              />
              <button type="submit" disabled={!draft.trim()}>Send</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}