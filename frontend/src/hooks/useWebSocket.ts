import { useEffect, useRef, useState, useCallback } from "react";

export type WebSocketMessage = {
  id?: number;
  content?: string | null;
  image_url?: string | null;
  room_id: number;
  receiver_id?: number;
  sender_id?: number;
  timestamp?: string;
};

export function useWebSocket(userId: number | undefined, token: string | undefined) {
  const ws = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);

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

      setMessages((prev) => [
        ...prev,
        {
          ...msg,
          id: Date.now(),
          sender_id: userId,
          timestamp: new Date().toISOString(),
        },
      ]);
    } else {
      console.error("Cannot send: WebSocket is not connected.");
    }
  }, [userId]);

  const addMessage = useCallback((msg: WebSocketMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  return { messages, sendMessage, addMessage };
}
