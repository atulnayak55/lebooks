import { api } from "../../lib/api";

export type LoginResponse = {
  access_token: string;
  token_type: string;
  user_id: number;
};

export type SignUpPayload = {
  name: string;
  email: string;
  unipd_id?: string;
  password: string;
};

export async function loginWithEmail(email: string, password: string): Promise<LoginResponse> {
  const payload = new URLSearchParams();
  payload.set("username", email);
  payload.set("password", password);

  const response = await api.post<LoginResponse>("/login", payload, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  return response.data;
}

export async function registerUser(payload: SignUpPayload): Promise<void> {
  await api.post("/users/", payload);
}
