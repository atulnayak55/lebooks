import { useCallback, useEffect, useReducer, useRef } from "react";

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

type WebSocketState = {
  messages: WebSocketMessage[];
  readReceipts: ReadReceipt[];
};

type WebSocketAction =
  | { type: "append_message"; message: WebSocketMessage }
  | { type: "apply_read_receipt"; receipt: ReadReceipt }
  | { type: "reset" };

const initialState: WebSocketState = {
  messages: [],
  readReceipts: [],
};

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

function resolveWsBaseUrl(configuredBaseUrl?: string): string {
  const trimmedBaseUrl = configuredBaseUrl?.trim();
  const wsProtocol = typeof window !== "undefined" && window.location.protocol === "https:"
    ? "wss"
    : "ws";

  if (trimmedBaseUrl) {
    if (/^wss?:\/\//.test(trimmedBaseUrl)) {
      return trimTrailingSlash(trimmedBaseUrl);
    }

    if (trimmedBaseUrl.startsWith("/") && typeof window !== "undefined") {
      return `${wsProtocol}://${window.location.host}${trimmedBaseUrl}`;
    }

    return trimTrailingSlash(`${wsProtocol}://${trimmedBaseUrl}`);
  }

  if (typeof window !== "undefined") {
    return `${wsProtocol}://${window.location.host}/api`;
  }

  return "ws://127.0.0.1:8000";
}

function websocketReducer(state: WebSocketState, action: WebSocketAction): WebSocketState {
  switch (action.type) {
    case "append_message":
      return {
        ...state,
        messages: [...state.messages, action.message],
      };
    case "apply_read_receipt":
      return {
        readReceipts: [...state.readReceipts, action.receipt],
        messages: state.messages.map((message) =>
          message.id !== undefined && action.receipt.message_ids.includes(message.id)
            ? { ...message, seen_at: action.receipt.seen_at }
            : message,
        ),
      };
    case "reset":
      return initialState;
    default:
      return state;
  }
}

export function useWebSocket(userId: number | undefined, token: string | undefined) {
  const ws = useRef<WebSocket | null>(null);
  const [state, dispatch] = useReducer(websocketReducer, initialState);

  const applyReadReceipt = useCallback((receipt: ReadReceipt) => {
    dispatch({ type: "apply_read_receipt", receipt });
  }, []);

  useEffect(() => {
    if (userId && token) {
      return;
    }

    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    dispatch({ type: "reset" });
  }, [userId, token]);

  useEffect(() => {
    if (!userId || !token) {
      return;
    }

    const baseUrl = resolveWsBaseUrl(import.meta.env.VITE_WS_BASE_URL);
    const wsUrl = `${baseUrl}/chat/ws?token=${encodeURIComponent(token)}`;

    dispatch({ type: "reset" });
    console.log(`Attempting to connect to WebSocket: ${wsUrl}`);
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => console.log("WebSocket Connected");
    ws.current.onerror = (err) => console.error("WebSocket Error:", err);
    ws.current.onclose = () => console.log("WebSocket Disconnected");

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Incoming message from server:", data);

      if (data.type === "read_receipt") {
        applyReadReceipt({
          room_id: data.room_id,
          message_ids: data.message_ids ?? [],
          seen_at: data.seen_at,
        });
        return;
      }

      dispatch({ type: "append_message", message: data });
    };

    return () => {
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
    };
  }, [applyReadReceipt, userId, token]);

  const sendMessage = useCallback((msg: WebSocketMessage) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      console.log("Sending message to server:", msg);
      ws.current.send(JSON.stringify(msg));
    } else {
      console.error("Cannot send: WebSocket is not connected.");
    }
  }, []);

  const addMessage = useCallback((msg: WebSocketMessage) => {
    dispatch({ type: "append_message", message: msg });
  }, []);

  return {
    messages: state.messages,
    readReceipts: state.readReceipts,
    sendMessage,
    addMessage,
    addReadReceipt: applyReadReceipt,
  };
}
