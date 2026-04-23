import { useEffect, useRef, useState, useCallback } from "react";

export type WebSocketMessage = {
  id?: number;
  content?: string | null;
  image_url?: string | null;
  room_id: number;
  receiver_id?: number;
  sender_id?: number;
  timestamp?: string;
  seen_at?: string | null;
};

export type ReadReceipt = {
  room_id: number;
  message_ids: number[];
  seen_at: string;
};

export function useWebSocket(userId: number | undefined, token: string | undefined) {
  const ws = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [readReceipts, setReadReceipts] = useState<ReadReceipt[]>([]);

  useEffect(() => {
    if (!userId || !token) return;

    const browserHost = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
    const defaultWsBaseUrl = `ws://${browserHost}:8000`;
    const baseUrl = import.meta.env.VITE_WS_BASE_URL ?? defaultWsBaseUrl;
    const wsUrl = `${baseUrl}/chat/ws?token=${encodeURIComponent(token)}`;

    console.log(`Attempting to connect to WebSocket: ${wsUrl}`);
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => console.log("WebSocket Connected");
    ws.current.onerror = (err) => console.error("WebSocket Error:", err);
    ws.current.onclose = () => console.log("WebSocket Disconnected");

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Incoming message from server:", data);

      if (data.type === "read_receipt") {
        setReadReceipts((prev) => [
          ...prev,
          {
            room_id: data.room_id,
            message_ids: data.message_ids ?? [],
            seen_at: data.seen_at,
          },
        ]);
        setMessages((prev) =>
          prev.map((message) =>
            message.id !== undefined && data.message_ids?.includes(message.id)
              ? { ...message, seen_at: data.seen_at }
              : message,
          ),
        );
        return;
      }

      setMessages((prev) => [...prev, data]);
    };

    return () => {
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
    };
  }, [userId, token]);

  const sendMessage = useCallback((msg: WebSocketMessage) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      console.log("Sending message to server:", msg);
      ws.current.send(JSON.stringify(msg));
    } else {
      console.error("Cannot send: WebSocket is not connected.");
    }
  }, []);

  const addMessage = useCallback((msg: WebSocketMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  return { messages, readReceipts, sendMessage, addMessage };
}
