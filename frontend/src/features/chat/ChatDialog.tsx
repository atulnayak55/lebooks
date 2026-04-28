import { useMemo, useState, useEffect } from "react";
import { useI18n } from "../../i18n/useI18n";
import {
  createChatMessage,
  createOrGetChatRoom,
  fetchChatHistory,
  markChatRoomRead,
  type ChatRoomResponse,
  type MessageResponse,
} from "./api";
import { mergeChatMessages } from "./messageUtils";
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

  const { messages, readReceipts, addMessage, addReadReceipt } = chatConnection;

  // When the dialog opens, ping the backend to create/fetch the room
  useEffect(() => {
    let cancelled = false;

    async function initRoom() {
      if (!open || !listing || !currentUserId || !token) return;
      
      try {
        const room = await createOrGetChatRoom({ listing_id: listing.id }, token);
        const messageHistory = await fetchChatHistory(room.id, token);
        if (cancelled) {
          return;
        }
        setRoomId(room.id);
        setRoomInfo(room);
        setHistory(messageHistory);
        const receipt = await markChatRoomRead(room.id, token);
        if (cancelled) {
          return;
        }
        addReadReceipt(receipt);
        setError(null);
      } catch {
        if (!cancelled) {
          setError(t("chat.initError"));
        }
      }
    }

    void initRoom();
    return () => {
      cancelled = true;
    };
  }, [addReadReceipt, currentUserId, listing, open, t, token]);

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
      void markChatRoomRead(roomId, token).then(addReadReceipt).catch(() => undefined);
    }
  }, [addReadReceipt, currentUserId, messages, open, roomId, token]);

  // Filter messages to only show ones for THIS specific room
  const roomMessages = useMemo(() => {
    const liveRoomMessages = messages.filter((message) => message.room_id === roomId);
    return mergeChatMessages(history, liveRoomMessages);
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

  const otherPersonName = listing.seller.name;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !roomId || !roomInfo) return;

    const messageText = draft.trim();
    setDraft("");
    setError(null);

    try {
      const newMessage = await createChatMessage(roomId, messageText, token);
      addMessage(newMessage);
    } catch {
      setDraft(messageText);
      setError(t("chat.sendError"));
    }
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
            <h2>{otherPersonName}</h2>
            <span className="chat-dialog-subtitle">
              {t("inbox.aboutListing", { title: listing.title })}
            </span>
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
