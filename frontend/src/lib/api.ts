import axios from "axios";

const browserHost = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
const DEFAULT_BASE_URL = `http://${browserHost}:8000`;

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? DEFAULT_BASE_URL,
  timeout: 10000,
});

export const backendBaseUrl = api.defaults.baseURL ?? DEFAULT_BASE_URL;
