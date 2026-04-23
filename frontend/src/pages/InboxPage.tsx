import { useEffect, useState, useMemo } from "react";
import type { AuthSession } from "../features/auth/session";
import { fetchChatRooms, fetchChatHistory, markChatRoomRead, uploadChatImage, type ChatRoomDetail, type MessageResponse } from "../features/chat/api";
import { deleteListing } from "../features/listings/api";
import type { useWebSocket } from "../hooks/useWebSocket";
import { useI18n } from "../i18n/I18nProvider";
import { backendBaseUrl } from "../lib/api";
import { formatEuro, formatMessageTime } from "../utils/format";

type InboxPageProps = {
  session: AuthSession | null;
  chatConnection: ReturnType<typeof useWebSocket>;
};

export function InboxPage({ session, chatConnection }: InboxPageProps) {
  const { locale, t } = useI18n();
  const userId = session?.userId;
  const token = session?.token;

  const [rooms, setRooms] = useState<ChatRoomDetail[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoomDetail | null>(null);
  const [history, setHistory] = useState<MessageResponse[]>([]);
  const [draft, setDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const { messages: liveMessages, readReceipts, sendMessage, addMessage } = chatConnection;

  // Load rooms when the page opens
  useEffect(() => {
    if (!token) return;
    fetchChatRooms(token).then(setRooms).catch(console.error);
  }, [token]);

  // Load history when you click on a room
  useEffect(() => {
    if (!activeRoom || !token) return;
    fetchChatHistory(activeRoom.id, token)
      .then((messages) => {
        setHistory(messages);
        void markChatRoomRead(activeRoom.id, token);
      })
      .catch(console.error);
  }, [activeRoom, token]);

  useEffect(() => {
    if (!activeRoom || !token || !userId) return;

    const hasUnreadIncomingLiveMessage = liveMessages.some((message) => {
      return (
        message.room_id === activeRoom.id &&
        message.sender_id !== undefined &&
        message.sender_id !== userId &&
        !message.seen_at
      );
    });

    if (hasUnreadIncomingLiveMessage) {
      void markChatRoomRead(activeRoom.id, token);
    }
  }, [activeRoom, liveMessages, token, userId]);

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

  const receiptSeenByMessageId = useMemo(() => {
    const seenByMessageId = new Map<number, string>();
    for (const receipt of readReceipts) {
      if (receipt.room_id !== activeRoom?.id) {
        continue;
      }
      for (const messageId of receipt.message_ids) {
        seenByMessageId.set(messageId, receipt.seen_at);
      }
    }
    return seenByMessageId;
  }, [activeRoom?.id, readReceipts]);

  const latestSeenOwnMessageId = useMemo(() => {
    const seenOwnMessage = [...currentMessages].reverse().find((message) => {
      if (message.id === undefined || message.sender_id !== userId) {
        return false;
      }
      return Boolean(message.seen_at || receiptSeenByMessageId.get(message.id));
    });

    return seenOwnMessage?.id;
  }, [currentMessages, receiptSeenByMessageId, userId]);

  const activeRoomOtherPerson = activeRoom
    ? userId === activeRoom.seller_id
      ? activeRoom.buyer
      : activeRoom.seller
    : null;

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
      alert(t("inbox.uploadFailed"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDeleteListingFromChat() {
    if (!activeRoom || !token) return;

    const confirmed = window.confirm(
      t("inbox.deleteConfirm", { title: activeRoom.listing.title }),
    );
    if (!confirmed) return;

    try {
      await deleteListing(activeRoom.listing_id, token);
      alert(t("inbox.deleteSuccess"));
      window.location.reload();
    } catch (err) {
      console.error("Failed to delete listing", err);
      alert(t("inbox.deleteFailed"));
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
    return <div className="inbox-empty">{t("inbox.signInRequired")}</div>;
  }

  return (
    <div className="inbox-container">
      <div className="inbox-sidebar">
        <div className="inbox-sidebar-header">
          <h2 className="inbox-title">{t("inbox.messages")}</h2>
          <span className="inbox-room-count">{rooms.length}</span>
        </div>
        {rooms.length === 0 ? <p className="inbox-empty">{t("inbox.noChats")}</p> : null}
        
        {rooms.map(room => {
          const isSeller = userId === room.seller_id;
          const otherPerson = isSeller ? room.buyer : room.seller;
          
          return (
            <button 
              key={room.id} 
              className={`inbox-room-btn ${activeRoom?.id === room.id ? "active" : ""}`}
              onClick={() => setActiveRoom(room)}
            >
              <span className="room-avatar" aria-hidden="true">
                {otherPerson.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="room-copy">
                <span className="room-listing">{room.listing.title}</span>
                <span className="room-person">
                  {isSeller ? t("inbox.buyer") : t("inbox.seller")}: {otherPerson.name}
                </span>
                <span className="room-price">{formatEuro(room.listing.price, locale)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="inbox-main">
        {!activeRoom ? (
          <div className="inbox-empty">{t("inbox.selectConversation")}</div>
        ) : (
          <>
            <div className="inbox-header">
              <div className="inbox-conversation-title">
                <span className="conversation-avatar" aria-hidden="true">
                  {activeRoomOtherPerson?.name.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <h3>{activeRoom.listing.title}</h3>
                  <span>
                    {userId === activeRoom.seller_id ? t("inbox.buyer") : t("inbox.seller")}: {activeRoomOtherPerson?.name}
                  </span>
                </div>
              </div>
              {userId === activeRoom.seller_id ? (
                <button
                  className="delete-listing-chat-button"
                  type="button"
                  onClick={handleDeleteListingFromChat}
                >
                  {t("inbox.deleteListing")}
                </button>
              ) : null}
            </div>
            
            <div className="inbox-messages">
              {currentMessages.length === 0 ? (
                <p className="inbox-empty">{t("inbox.noMessages")}</p>
              ) : (
                currentMessages.map((msg, idx) => {
                  const isMine = msg.sender_id === userId;
                  const seenAt = msg.id !== undefined ? msg.seen_at || receiptSeenByMessageId.get(msg.id) : null;
                  return (
                    <div key={msg.id ?? `local-${idx}`} className={`message-row ${isMine ? "mine" : "theirs"}`}>
                      <div className={`message-bubble ${isMine ? "mine" : "theirs"}`}>
                        {msg.image_url ? (
                          <img
                            src={`${backendBaseUrl}${msg.image_url}`}
                            alt={t("inbox.imageAlt")}
                            className="message-image"
                            onClick={() => setPreviewImageUrl(`${backendBaseUrl}${msg.image_url}`)}
                          />
                        ) : null}
                        {msg.content ? <span>{msg.content}</span> : null}
                        <span className="message-time">{formatMessageTime(msg.timestamp, locale)}</span>
                      </div>
                      {isMine && msg.id === latestSeenOwnMessageId ? (
                        <span className="message-seen">
                          {t("chat.seen", { time: formatMessageTime(seenAt, locale) })}
                        </span>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>

            <form className="inbox-form" onSubmit={handleSendText}>
              <label
                className="attach-button"
                title={t("inbox.attachImage")}
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
                placeholder={t("chat.placeholder")}
                disabled={uploading}
              />
              <button type="submit" disabled={!draft.trim() || uploading}>{t("chat.send")}</button>
            </form>
          </>
        )}
      </div>

      {previewImageUrl ? (
        <div className="chat-image-preview" role="dialog" aria-modal="true" aria-label={t("inbox.imagePreview")}>
          <button
            type="button"
            className="chat-image-backdrop"
            onClick={() => setPreviewImageUrl(null)}
            aria-label={t("inbox.closeImagePreview")}
          />
          <img src={previewImageUrl} alt={t("inbox.imagePreviewAlt")} className="chat-image-full" />
        </div>
      ) : null}
    </div>
  );
}
