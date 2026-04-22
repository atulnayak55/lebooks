import { useEffect, useRef, useState, useCallback } from "react";

export type WebSocketMessage = {
  id?: number;
  content: string;
  room_id: number;
  receiver_id?: number;
  sender_id?: number;
  timestamp?: string;
};

export function useWebSocket(userId: number | undefined) {
  const ws = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);

  useEffect(() => {
    if (!userId) return;

    const baseUrl = import.meta.env.VITE_WS_BASE_URL ?? "ws://127.0.0.1:8000";
    const wsUrl = `${baseUrl}/chat/ws/${userId}`;

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
      }
    };
  }, [userId]);

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

  return { messages, sendMessage };
}