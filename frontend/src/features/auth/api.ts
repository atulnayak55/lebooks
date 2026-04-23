import { api } from "../../lib/api";

export type LoginResponse = {
  access_token: string;
  token_type: string;
  user_id: number;
};

export type MessageResponse = {
  message: string;
};

export type VerificationResponse = {
  message: string;
  expires_at: string;
};

export type SignUpPayload = {
  name: string;
  email: string;
  unipd_id?: string;
  password: string;
};

export type SignupVerifyPayload = {
  email: string;
  otp_code: string;
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

export async function startSignup(payload: SignUpPayload): Promise<VerificationResponse> {
  const response = await api.post<VerificationResponse>("/auth/signup/start", payload);
  return response.data;
}

export async function verifySignupOtp(payload: SignupVerifyPayload): Promise<MessageResponse> {
  await api.post("/auth/signup/verify", payload);
  return { message: "Account verified. You can sign in now." };
}

export async function requestPasswordReset(email: string): Promise<MessageResponse> {
  const response = await api.post<MessageResponse>("/auth/forgot-password", { email });
  return response.data;
}

export async function resetPassword(token: string, newPassword: string): Promise<MessageResponse> {
  const response = await api.post<MessageResponse>("/auth/reset-password", {
    token,
    new_password: newPassword,
  });
  return response.data;
}

export async function resendVerification(email: string): Promise<MessageResponse> {
  const response = await api.post<MessageResponse>("/auth/signup/resend-otp", { email });
  return response.data;
}
