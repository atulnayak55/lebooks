import { useMemo, useState, useEffect } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { createOrGetChatRoom, fetchChatHistory, markChatRoomRead, type ChatRoomResponse, type MessageResponse } from "./api";
import type { useWebSocket } from "../../hooks/useWebSocket";
import type { Listing } from "../../types/domain";
import { formatMessageTime } from "../../utils/format";

type ChatDialogProps = {
  open: boolean;
  listing: Listing | null;
  currentUserId: number; // The ID of the logged-in buyer
  token: string;
  chatConnection: ReturnType<typeof useWebSocket>;
  onClose: () => void;
};

export function ChatDialog({
  open,
  listing,
  currentUserId,
  token,
  chatConnection,
  onClose,
}: ChatDialogProps) {
  const { locale, t } = useI18n();
  const [roomId, setRoomId] = useState<number | null>(null);
  const [roomInfo, setRoomInfo] = useState<ChatRoomResponse | null>(null);
  const [history, setHistory] = useState<MessageResponse[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { messages, readReceipts, sendMessage } = chatConnection;

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
        void markChatRoomRead(room.id, token);
        setError(null);
      } catch {
        setError(t("chat.initError"));
      }
    }

    initRoom();
  }, [open, listing, currentUserId, token]);

  useEffect(() => {
    if (!open || !roomId || !token) return;

    const hasUnreadIncomingLiveMessage = messages.some((message) => {
      return (
        message.room_id === roomId &&
        message.sender_id !== undefined &&
        message.sender_id !== currentUserId &&
        !message.seen_at
      );
    });

    if (hasUnreadIncomingLiveMessage) {
      void markChatRoomRead(roomId, token);
    }
  }, [currentUserId, messages, open, roomId, token]);

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

  const receiptSeenByMessageId = useMemo(() => {
    const seenByMessageId = new Map<number, string>();
    for (const receipt of readReceipts) {
      if (receipt.room_id !== roomId) {
        continue;
      }
      for (const messageId of receipt.message_ids) {
        seenByMessageId.set(messageId, receipt.seen_at);
      }
    }
    return seenByMessageId;
  }, [readReceipts, roomId]);

  const latestSeenOwnMessageId = useMemo(() => {
    const seenOwnMessage = [...roomMessages].reverse().find((message) => {
      if (message.id === undefined || message.sender_id !== currentUserId) {
        return false;
      }
      return Boolean(message.seen_at || receiptSeenByMessageId.get(message.id));
    });

    return seenOwnMessage?.id;
  }, [currentUserId, receiptSeenByMessageId, roomMessages]);

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
      <div className="auth-dialog chat-dialog">
        
        <div className="chat-dialog-header">
          <div>
            <p>{t("chat.conversation")}</p>
            <h2>{listing.title}</h2>
          </div>
          <button className="auth-close" onClick={handleClose} aria-label={t("chat.close")}>x</button>
        </div>

        {error ? <p className="auth-error">{error}</p> : null}

        <div className="chat-dialog-messages">
          {roomMessages.length === 0 && !error ? (
            <p className="chat-dialog-empty">{t("chat.empty")}</p>
          ) : (
            roomMessages.map((msg, idx) => {
              const isMine = msg.sender_id === currentUserId;
              const seenAt = msg.id !== undefined ? msg.seen_at || receiptSeenByMessageId.get(msg.id) : null;
              return (
                <div key={msg.id ?? `local-${idx}`} className={`chat-dialog-row ${isMine ? "mine" : "theirs"}`}>
                  <span className={`chat-dialog-bubble ${isMine ? "mine" : "theirs"}`}>
                    {msg.content}
                    <span className="chat-dialog-time">{formatMessageTime(msg.timestamp, locale)}</span>
                  </span>
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

        <form className="chat-dialog-form" onSubmit={handleSend}>
          <input 
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("chat.placeholder")}
            disabled={!roomId}
          />
          <button className="auth-submit" type="submit" disabled={!roomId || !draft.trim()}>
            {t("chat.send")}
          </button>
        </form>

      </div>
    </div>
  );
}
