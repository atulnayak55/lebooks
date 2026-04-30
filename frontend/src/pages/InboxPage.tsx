import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AuthSession } from "../features/auth/session";
import {
  createChatMessage,
  fetchChatRoom,
  fetchChatHistory,
  fetchChatRooms,
  markChatRoomRead,
  uploadChatImage,
  type ChatRoomDetail,
  type MessageResponse,
  type ReadReceiptResponse,
} from "../features/chat/api";
import {
  getMessageTimestampValue,
  type ChatMessage,
  mergeChatMessages,
} from "../features/chat/messageUtils";
import { deleteListing } from "../features/listings/api";
import type { useWebSocket } from "../hooks/useWebSocket";
import { useI18n } from "../i18n/useI18n";
import { backendBaseUrl } from "../lib/api";
import { formatConversationTime, formatEuro, formatMessageTime } from "../utils/format";

type InboxPageProps = {
  session: AuthSession | null;
  chatConnection: ReturnType<typeof useWebSocket>;
};

type RoomSummary = {
  room: ChatRoomDetail;
  isSeller: boolean;
  otherPerson: ChatRoomDetail["buyer"] | ChatRoomDetail["seller"];
  latestMessage: ChatMessage | null;
  preview: string;
  unreadCount: number;
};

function previewMessage(message: ChatMessage | null, imageLabel: string, emptyLabel: string): string {
  if (!message) {
    return emptyLabel;
  }
  if (message.image_url) {
    return imageLabel;
  }

  const content = message.content?.trim();
  return content ? content : emptyLabel;
}

export function InboxPage({ session, chatConnection }: InboxPageProps) {
  const { locale, t } = useI18n();
  const userId = session?.userId;
  const token = session?.token;

  const [rooms, setRooms] = useState<ChatRoomDetail[]>([]);
  const [historyByRoom, setHistoryByRoom] = useState<Record<number, MessageResponse[]>>({});
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const markingRoomIdsRef = useRef<Set<number>>(new Set());
  const messagesPaneRef = useRef<HTMLDivElement | null>(null);
  const draftInputRef = useRef<HTMLInputElement | null>(null);

  const {
    messages: liveMessages,
    readReceipts,
    addMessage,
    addReadReceipt,
  } = chatConnection;

  const applyReadReceiptToHistory = useCallback((receipt: ReadReceiptResponse) => {
    if (receipt.message_ids.length === 0) {
      return;
    }

    setHistoryByRoom((currentHistory) => {
      const roomHistory = currentHistory[receipt.room_id];
      if (!roomHistory) {
        return currentHistory;
      }

      return {
        ...currentHistory,
        [receipt.room_id]: roomHistory.map((message) =>
          receipt.message_ids.includes(message.id)
            ? { ...message, seen_at: receipt.seen_at }
            : message,
        ),
      };
    });
  }, []);

  const syncReadReceipt = useCallback((receipt: ReadReceiptResponse) => {
    addReadReceipt(receipt);
    applyReadReceiptToHistory(receipt);
  }, [addReadReceipt, applyReadReceiptToHistory]);

  const markRoomAsRead = useCallback(async (roomId: number) => {
    if (!token || markingRoomIdsRef.current.has(roomId)) {
      return;
    }

    markingRoomIdsRef.current.add(roomId);
    try {
      const receipt = await markChatRoomRead(roomId, token);
      syncReadReceipt(receipt);
    } catch (error) {
      console.error("Failed to mark room as read", error);
    } finally {
      markingRoomIdsRef.current.delete(roomId);
    }
  }, [syncReadReceipt, token]);

  useEffect(() => {
    let cancelled = false;

    async function loadRoomsAndHistories() {
      if (!token) {
        setRooms([]);
        setHistoryByRoom({});
        setSelectedRoomId(null);
        setLoadingRooms(false);
        return;
      }

      setLoadingRooms(true);
      try {
        const fetchedRooms = await fetchChatRooms(token);
        if (cancelled) {
          return;
        }

        setRooms(fetchedRooms);

        const roomHistories = await Promise.all(
          fetchedRooms.map(async (room) => {
            try {
              const messages = await fetchChatHistory(room.id, token);
              return [room.id, messages] as const;
            } catch (error) {
              console.error(`Failed to load history for room ${room.id}`, error);
              return [room.id, []] as const;
            }
          }),
        );

        if (cancelled) {
          return;
        }

        setHistoryByRoom(Object.fromEntries(roomHistories));
      } catch (error) {
        console.error("Failed to load chat rooms", error);
        if (!cancelled) {
          setRooms([]);
          setHistoryByRoom({});
        }
      } finally {
        if (!cancelled) {
          setLoadingRooms(false);
        }
      }
    }

    void loadRoomsAndHistories();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || liveMessages.length === 0) {
      return;
    }

    const knownRoomIds = new Set(rooms.map((room) => room.id));
    const unknownRoomIds = Array.from(
      new Set(
        liveMessages
          .map((message) => message.room_id)
          .filter((roomId) => !knownRoomIds.has(roomId)),
      ),
    );

    if (unknownRoomIds.length === 0) {
      return;
    }

    let cancelled = false;
    const authToken = token;

    async function loadUnknownRooms() {
      const roomDetails = await Promise.all(
        unknownRoomIds.map(async (roomId) => {
          try {
            const room = await fetchChatRoom(roomId, authToken);
            return room;
          } catch (error) {
            console.error(`Failed to load room ${roomId}`, error);
            return null;
          }
        }),
      );

      const resolvedRooms = roomDetails.filter((room): room is ChatRoomDetail => room !== null);
      if (cancelled || resolvedRooms.length === 0) {
        return;
      }

      setRooms((currentRooms) => {
        const roomsById = new Map(currentRooms.map((room) => [room.id, room]));
        for (const room of resolvedRooms) {
          roomsById.set(room.id, room);
        }
        return Array.from(roomsById.values());
      });

      const missingHistoryIds = resolvedRooms
        .map((room) => room.id)
        .filter((roomId) => historyByRoom[roomId] === undefined);

      if (missingHistoryIds.length === 0) {
        return;
      }

      const loadedHistories = await Promise.all(
        missingHistoryIds.map(async (roomId) => {
          try {
            const messages = await fetchChatHistory(roomId, authToken);
            return [roomId, messages] as const;
          } catch (error) {
            console.error(`Failed to load history for room ${roomId}`, error);
            return [roomId, []] as const;
          }
        }),
      );

      if (cancelled) {
        return;
      }

      setHistoryByRoom((currentHistory) => ({
        ...currentHistory,
        ...Object.fromEntries(loadedHistories),
      }));
    }

    void loadUnknownRooms();
    return () => {
      cancelled = true;
    };
  }, [historyByRoom, liveMessages, rooms, token]);

  const roomSummaries = useMemo(() => {
    if (!userId) {
      return [];
    }

    return rooms
      .map((room): RoomSummary => {
        const isSeller = userId === room.seller_id;
        const otherPerson = isSeller ? room.buyer : room.seller;
        const roomMessages = mergeChatMessages(
          historyByRoom[room.id] ?? [],
          liveMessages.filter((message) => message.room_id === room.id),
        );
        const latestMessage = roomMessages.at(-1) ?? null;
        const unreadCount = roomMessages.filter((message) => {
          return message.sender_id !== userId && !message.seen_at;
        }).length;

        return {
          room,
          isSeller,
          otherPerson,
          latestMessage,
          preview: previewMessage(latestMessage, t("inbox.photoMessage"), t("inbox.noMessages")),
          unreadCount,
        };
      })
      .sort((left, right) => {
        const rightTime = right.latestMessage ? getMessageTimestampValue(right.latestMessage) : 0;
        const leftTime = left.latestMessage ? getMessageTimestampValue(left.latestMessage) : 0;
        if (rightTime !== leftTime) {
          return rightTime - leftTime;
        }
        return right.room.id - left.room.id;
      });
  }, [historyByRoom, liveMessages, rooms, t, userId]);

  const activeRoomId = selectedRoomId !== null
    && roomSummaries.some((summary) => summary.room.id === selectedRoomId)
    ? selectedRoomId
    : null;

  const activeRoomSummary = useMemo(() => {
    return roomSummaries.find((summary) => summary.room.id === activeRoomId) ?? null;
  }, [activeRoomId, roomSummaries]);

  const activeRoom = activeRoomSummary?.room ?? null;
  const activeRoomOtherPerson = activeRoomSummary?.otherPerson ?? null;

  const currentMessages = useMemo(() => {
    if (!activeRoomId) {
      return [];
    }

    return mergeChatMessages(
      historyByRoom[activeRoomId] ?? [],
      liveMessages.filter((message) => message.room_id === activeRoomId),
    );
  }, [activeRoomId, historyByRoom, liveMessages]);

  const scrollMessagesToBottom = useCallback(() => {
    const messagesPane = messagesPaneRef.current;
    if (!messagesPane) {
      return;
    }

    messagesPane.scrollTop = messagesPane.scrollHeight;
  }, []);

  useEffect(() => {
    window.requestAnimationFrame(scrollMessagesToBottom);
  }, [activeRoomId, currentMessages.length, scrollMessagesToBottom]);

  useEffect(() => {
    if (!activeRoomId || !token || historyByRoom[activeRoomId]) {
      return;
    }

    let cancelled = false;
    const roomId = activeRoomId;
    const authToken = token;

    async function loadActiveRoomHistory() {
      setLoadingConversation(true);
      try {
        const messages = await fetchChatHistory(roomId, authToken);
        if (!cancelled) {
          setHistoryByRoom((currentHistory) => ({
            ...currentHistory,
            [roomId]: messages,
          }));
        }
      } catch (error) {
        console.error(`Failed to load history for room ${roomId}`, error);
      } finally {
        if (!cancelled) {
          setLoadingConversation(false);
        }
      }
    }

    void loadActiveRoomHistory();
    return () => {
      cancelled = true;
    };
  }, [activeRoomId, historyByRoom, token]);

  useEffect(() => {
    if (!activeRoomId || !userId) {
      return;
    }

    const hasUnreadIncomingLiveMessage = currentMessages.some((message) => {
      return message.sender_id !== userId && !message.seen_at;
    });

    if (hasUnreadIncomingLiveMessage) {
      const timeoutId = window.setTimeout(() => {
        void markRoomAsRead(activeRoomId);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [activeRoomId, currentMessages, markRoomAsRead, userId]);

  const receiptSeenByMessageId = useMemo(() => {
    const seenByMessageId = new Map<number, string>();
    for (const receipt of readReceipts) {
      if (receipt.room_id !== activeRoomId) {
        continue;
      }
      for (const messageId of receipt.message_ids) {
        seenByMessageId.set(messageId, receipt.seen_at);
      }
    }
    return seenByMessageId;
  }, [activeRoomId, readReceipts]);

  const latestSeenOwnMessageId = useMemo(() => {
    const seenOwnMessage = [...currentMessages].reverse().find((message) => {
      if (message.id === undefined || message.sender_id !== userId) {
        return false;
      }
      return Boolean(message.seen_at || receiptSeenByMessageId.get(message.id));
    });

    return seenOwnMessage?.id;
  }, [currentMessages, receiptSeenByMessageId, userId]);

  const totalUnreadCount = useMemo(() => {
    return roomSummaries.reduce((count, summary) => count + summary.unreadCount, 0);
  }, [roomSummaries]);

  async function sendCurrentDraft() {
    const messageText = draft.trim();
    if (!messageText || !activeRoom || !token) {
      return;
    }

    setDraft("");
    try {
      const newMessage = await createChatMessage(activeRoom.id, messageText, token);
      addMessage(newMessage);
    } catch (error) {
      console.error("Failed to send message", error);
      setDraft(messageText);
    } finally {
      window.requestAnimationFrame(() => {
        draftInputRef.current?.focus();
      });
    }
  }

  function handleSendText(event: React.FormEvent) {
    event.preventDefault();
    void sendCurrentDraft();
  }

  function handleSendButtonPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    void sendCurrentDraft();
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !activeRoom || !userId || !token) {
      return;
    }

    setUploading(true);
    const receiverId = userId === activeRoom.seller_id ? activeRoom.buyer_id : activeRoom.seller_id;

    try {
      const newMessage = await uploadChatImage(activeRoom.id, receiverId, file, token);
      addMessage(newMessage);
      setHistoryByRoom((currentHistory) => ({
        ...currentHistory,
        [activeRoom.id]: mergeChatMessages(currentHistory[activeRoom.id] ?? [], [newMessage])
          .filter((message): message is MessageResponse => message.id !== undefined),
      }));
    } catch (error) {
      console.error("Failed to upload image", error);
      alert(t("inbox.uploadFailed"));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleDeleteListingFromChat() {
    if (!activeRoom || !token) {
      return;
    }

    const confirmed = window.confirm(
      t("inbox.deleteConfirm", { title: activeRoom.listing.title }),
    );
    if (!confirmed) {
      return;
    }

    try {
      await deleteListing(activeRoom.listing_id, token);
      alert(t("inbox.deleteSuccess"));
      window.location.reload();
    } catch (error) {
      console.error("Failed to delete listing", error);
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
      <aside className={`inbox-sidebar ${activeRoom ? "has-active-room" : ""}`}>
        <div className="inbox-sidebar-header">
          <div className="inbox-sidebar-copy">
            <h2 className="inbox-title">{t("inbox.messages")}</h2>
            <p className="inbox-subtitle">{t("inbox.subtitle")}</p>
          </div>
          <div className="inbox-sidebar-metrics">
            {totalUnreadCount > 0 ? (
              <span
                className="inbox-total-unread"
                aria-label={t("nav.unreadMessages", { count: totalUnreadCount })}
              >
                {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
              </span>
            ) : null}
            <span className="inbox-room-count">{roomSummaries.length}</span>
          </div>
        </div>

        {loadingRooms ? <p className="inbox-sidebar-status">{t("inbox.loading")}</p> : null}
        {!loadingRooms && roomSummaries.length === 0 ? (
          <p className="inbox-empty">{t("inbox.noChats")}</p>
        ) : null}

        <div className="inbox-room-list">
          {roomSummaries.map((summary) => (
            <button
              key={summary.room.id}
              className={`inbox-room-btn ${activeRoomId === summary.room.id ? "active" : ""}`}
              onClick={() => setSelectedRoomId(summary.room.id)}
            >
              <span className="room-avatar" aria-hidden="true">
                {summary.otherPerson.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="room-copy">
                <span className="room-topline">
                  <span className="room-listing">{summary.room.listing.title}</span>
                  {summary.latestMessage ? (
                    <span className="room-time">
                      {formatConversationTime(summary.latestMessage.timestamp, locale)}
                    </span>
                  ) : null}
                </span>
                <span className="room-person">
                  {summary.isSeller ? t("inbox.buyer") : t("inbox.seller")}: {summary.otherPerson.name}
                </span>
                <span className="room-preview-row">
                  <span className={`room-preview ${summary.unreadCount > 0 ? "unread" : ""}`}>
                    {summary.preview}
                  </span>
                  {summary.unreadCount > 0 ? (
                    <span
                      className="room-unread-badge"
                      aria-label={t("nav.unreadMessages", { count: summary.unreadCount })}
                    >
                      {summary.unreadCount > 99 ? "99+" : summary.unreadCount}
                    </span>
                  ) : null}
                </span>
                <span className="room-price-pill">{formatEuro(summary.room.listing.price, locale)}</span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className={`inbox-main ${activeRoom ? "has-active-room" : ""}`}>
        {!activeRoom ? (
          <div className="inbox-empty">{t("inbox.selectConversation")}</div>
        ) : (
          <div className="chat-panel">
            <div className="inbox-header">
              <button
                className="chat-panel-back-button"
                type="button"
                onClick={() => setSelectedRoomId(null)}
              >
                {t("inbox.backToRooms")}
              </button>
              <div className="inbox-conversation-title">
                <span className="conversation-avatar" aria-hidden="true">
                  {activeRoomOtherPerson?.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="conversation-copy">
                  <div className="conversation-title-row">
                    <h3>{activeRoomOtherPerson?.name}</h3>
                    <span className="conversation-price">
                      {formatEuro(activeRoom.listing.price, locale)}
                    </span>
                  </div>
                  <span className="conversation-listing-title">
                    {t("inbox.aboutListing", { title: activeRoom.listing.title })}
                  </span>
                </div>
              </div>
              <div className="chat-panel-actions">
                <button
                  className="chat-panel-mobile-close-button"
                  type="button"
                  onClick={() => setSelectedRoomId(null)}
                  aria-label={t("chat.close")}
                >
                  ×
                </button>
                {userId === activeRoom.seller_id ? (
                  <button
                    className="delete-listing-chat-button"
                    type="button"
                    onClick={handleDeleteListingFromChat}
                  >
                    {t("inbox.deleteListing")}
                  </button>
                ) : null}
                <button
                  className="chat-panel-close-button"
                  type="button"
                  onClick={() => setSelectedRoomId(null)}
                >
                  {t("chat.close")}
                </button>
              </div>
            </div>

            <div className="inbox-messages" ref={messagesPaneRef}>
              {loadingConversation && currentMessages.length === 0 ? (
                <p className="inbox-empty">{t("inbox.loadingConversation")}</p>
              ) : null}
              {!loadingConversation && currentMessages.length === 0 ? (
                <p className="inbox-empty">{t("inbox.noMessages")}</p>
              ) : null}
              {currentMessages.map((message, index) => {
                const isMine = message.sender_id === userId;
                const seenAt =
                  message.id !== undefined
                    ? message.seen_at || receiptSeenByMessageId.get(message.id)
                    : null;

                return (
                  <div
                    key={message.id ?? `local-${index}`}
                    className={`message-row ${isMine ? "mine" : "theirs"}`}
                  >
                    <div
                      className={`message-bubble ${isMine ? "mine" : "theirs"} ${
                        message.image_url ? "with-image" : ""
                      }`}
                    >
                      {message.image_url ? (
                        <img
                          src={`${backendBaseUrl}${message.image_url}`}
                          alt={t("inbox.imageAlt")}
                          className="message-image"
                          onLoad={scrollMessagesToBottom}
                          onClick={() => setPreviewImageUrl(`${backendBaseUrl}${message.image_url}`)}
                        />
                      ) : null}
                      {message.content ? <span>{message.content}</span> : null}
                      <span className="message-time">{formatMessageTime(message.timestamp, locale)}</span>
                    </div>
                    {isMine && message.id === latestSeenOwnMessageId ? (
                      <span className="message-seen">
                        {t("chat.seen", { time: formatMessageTime(seenAt, locale) })}
                      </span>
                    ) : null}
                  </div>
                );
              })}
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
                ref={draftInputRef}
                type="text"
                name="chat-message"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={t("chat.placeholder")}
                disabled={uploading}
                inputMode="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="sentences"
                spellCheck={false}
                enterKeyHint="send"
                data-form-type="other"
              />
              <button
                type="submit"
                disabled={!draft.trim() || uploading}
                onPointerDown={handleSendButtonPointerDown}
              >
                {t("chat.send")}
              </button>
            </form>
          </div>
        )}
      </section>

      {previewImageUrl ? (
        <div
          className="chat-image-preview"
          role="dialog"
          aria-modal="true"
          aria-label={t("inbox.imagePreview")}
        >
          <button
            type="button"
            className="chat-image-backdrop"
            onClick={() => setPreviewImageUrl(null)}
            aria-label={t("inbox.closeImagePreview")}
          />
          <img
            src={previewImageUrl}
            alt={t("inbox.imagePreviewAlt")}
            className="chat-image-full"
          />
        </div>
      ) : null}
    </div>
  );
}
