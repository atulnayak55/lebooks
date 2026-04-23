import { api } from "../../lib/api";

export type ChatRoomCreatePayload = {
  listing_id: number;
};

export type ChatRoomResponse = {
  id: number;
  listing_id: number;
  buyer_id: number;
  seller_id: number;
};

// --- NEW TYPES FOR INBOX ---
export type ListingMini = { id: number; title: string; price: number; };
export type UserMini = { id: number; name: string; };

export type ChatRoomDetail = ChatRoomResponse & {
  listing: ListingMini;
  buyer: UserMini;
  seller: UserMini;
};

export type MessageResponse = {
  id: number;
  content?: string | null;
  image_url?: string | null;
  sender_id: number;
  room_id: number;
  timestamp: string;
};

export async function createOrGetChatRoom(payload: ChatRoomCreatePayload, token: string): Promise<ChatRoomResponse> {
  const response = await api.post<ChatRoomResponse>("/chat/rooms", payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

// --- NEW GET REQUESTS ---
export async function fetchChatRooms(token: string): Promise<ChatRoomDetail[]> {
  const response = await api.get<ChatRoomDetail[]>("/chat/rooms", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

export async function fetchChatHistory(roomId: number, token: string): Promise<MessageResponse[]> {
  const response = await api.get<MessageResponse[]>(`/chat/rooms/${roomId}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

export async function uploadChatImage(
  roomId: number,
  receiverId: number,
  file: File,
  token: string,
): Promise<MessageResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("receiver_id", receiverId.toString());

  const response = await api.post<MessageResponse>(`/chat/rooms/${roomId}/messages/image`, formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
}
