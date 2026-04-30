import {
  useMemo,
  useState,
  useEffect,
  useRef,
  type CSSProperties,
  type FormEvent,
} from "react";
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

type NavigatorWithVirtualKeyboard = Navigator & {
  virtualKeyboard?: {
    overlaysContent: boolean;
    boundingRect?: DOMRectReadOnly;
    addEventListener: (type: "geometrychange", listener: () => void) => void;
    removeEventListener: (type: "geometrychange", listener: () => void) => void;
  };
};

type ChatMessageComposerProps = {
  draft: string;
  disabled: boolean;
  placeholder: string;
  sendLabel: string;
  onDraftChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function ChatMessageComposer({
  draft,
  disabled,
  placeholder,
  sendLabel,
  onDraftChange,
  onFocus,
  onBlur,
  onSubmit,
}: ChatMessageComposerProps) {
  return (
    <form className="chat-dialog-form" onSubmit={onSubmit} autoComplete="off">
      <input
        aria-hidden="true"
        className="chat-autofill-decoy"
        tabIndex={-1}
        type="text"
        name="username"
        autoComplete="off"
        inputMode="none"
      />
      <input
        type="text"
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        name="chat-message"
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="sentences"
        spellCheck={false}
        enterKeyHint="send"
        role="textbox"
        aria-label={placeholder}
        data-form-type="other"
      />
      <button
        className="auth-submit"
        type="submit"
        disabled={disabled || !draft.trim()}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.form?.requestSubmit();
        }}
      >
        {sendLabel}
      </button>
    </form>
  );
}

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
  const [mobileViewport, setMobileViewport] = useState({
    visibleHeight: 0,
    offsetTop: 0,
    keyboardInset: 0,
  });
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const composerFocusedRef = useRef(false);
  const baselineHeightRef = useRef(0);

  const { messages, readReceipts, addMessage, addReadReceipt } = chatConnection;

  useEffect(() => {
    if (!open) {
      return;
    }

    const virtualKeyboard = (navigator as NavigatorWithVirtualKeyboard).virtualKeyboard;
    const previousOverlaySetting = virtualKeyboard?.overlaysContent;
    if (virtualKeyboard) {
      virtualKeyboard.overlaysContent = false;
    }

    function syncViewport() {
      const visualViewport = window.visualViewport;
      const visibleHeight = visualViewport?.height ?? window.innerHeight;
      const offsetTop = visualViewport?.offsetTop ?? 0;
      if (!composerFocusedRef.current) {
        baselineHeightRef.current = Math.max(
          baselineHeightRef.current,
          window.innerHeight,
          visibleHeight,
        );
      }

      const baselineHeight = baselineHeightRef.current || window.innerHeight;
      const keyboardInsetFromViewport = Math.max(0, baselineHeight - visibleHeight - offsetTop);
      const keyboardInsetFromLayoutResize = composerFocusedRef.current
        ? Math.max(0, baselineHeight - window.innerHeight)
        : 0;
      const keyboardInsetFromApi = virtualKeyboard?.boundingRect?.height ?? 0;
      const measuredKeyboardInset = Math.max(
        keyboardInsetFromViewport,
        keyboardInsetFromLayoutResize,
        keyboardInsetFromApi,
      );
      const fallbackKeyboardInset =
        composerFocusedRef.current && measuredKeyboardInset < 120
          ? Math.round(baselineHeight * 0.48)
          : 0;
      const keyboardInset = Math.max(measuredKeyboardInset, fallbackKeyboardInset);
      const hasLayoutResize = keyboardInsetFromLayoutResize >= 120;

      setMobileViewport({
        visibleHeight: hasLayoutResize
          ? Math.max(280, window.innerHeight)
          : Math.max(280, baselineHeight - keyboardInset),
        offsetTop,
        keyboardInset,
      });
    }

    syncViewport();
    window.visualViewport?.addEventListener("resize", syncViewport);
    window.visualViewport?.addEventListener("scroll", syncViewport);
    window.addEventListener("resize", syncViewport);
    virtualKeyboard?.addEventListener("geometrychange", syncViewport);

    return () => {
      window.visualViewport?.removeEventListener("resize", syncViewport);
      window.visualViewport?.removeEventListener("scroll", syncViewport);
      window.removeEventListener("resize", syncViewport);
      virtualKeyboard?.removeEventListener("geometrychange", syncViewport);
      if (virtualKeyboard && previousOverlaySetting !== undefined) {
        virtualKeyboard.overlaysContent = previousOverlaySetting;
      }
    };
  }, [open]);

  function scrollMessagesToBottom(delay = 0) {
    window.setTimeout(() => {
      const messagesPane = messagesRef.current;
      if (messagesPane) {
        messagesPane.scrollTop = messagesPane.scrollHeight;
      }
    }, delay);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

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

  useEffect(() => {
    if (!open) {
      return;
    }

    scrollMessagesToBottom();
  }, [open, roomMessages.length, mobileViewport.keyboardInset]);

  if (!open || !listing) return null;

  const otherPersonName = listing.seller.name;

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

  const overlayStyle = {
    "--chat-visible-height": mobileViewport.visibleHeight ? `${mobileViewport.visibleHeight}px` : "100dvh",
    "--chat-viewport-offset-top": `${mobileViewport.offsetTop}px`,
    "--chat-keyboard-inset": `${mobileViewport.keyboardInset}px`,
  } as CSSProperties;

  return (
    <div className="auth-overlay chat-overlay" role="dialog" aria-modal="true" style={overlayStyle}>
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

        <div className="chat-dialog-messages" ref={messagesRef}>
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

        <ChatMessageComposer
          draft={draft}
          disabled={!roomId}
          placeholder={t("chat.placeholder")}
          sendLabel={t("chat.send")}
          onDraftChange={setDraft}
          onFocus={() => {
            composerFocusedRef.current = true;
            window.dispatchEvent(new Event("resize"));
            scrollMessagesToBottom(80);
            scrollMessagesToBottom(260);
          }}
          onBlur={() => {
            composerFocusedRef.current = false;
            window.dispatchEvent(new Event("resize"));
          }}
          onSubmit={handleSend}
        />

      </div>
    </div>
  );
}
