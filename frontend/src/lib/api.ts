import axios from "axios";

const DEFAULT_BASE_URL = "/api";
const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const resolvedBaseUrl = (configuredBaseUrl && configuredBaseUrl.length > 0
  ? configuredBaseUrl
  : DEFAULT_BASE_URL).replace(/\/$/, "");

export const api = axios.create({
  baseURL: resolvedBaseUrl,
  timeout: 10000,
});

export const backendBaseUrl = api.defaults.baseURL ?? DEFAULT_BASE_URL;
