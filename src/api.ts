import * as SecureStore from "expo-secure-store";
import { API_BASE } from "./config";

const TOKEN_KEY = "ls_driver_token";
const NAME_KEY = "ls_driver_name";
const EMAIL_KEY = "ls_driver_email";

let memoryToken: string | null = null;

export async function saveSession(token: string, name: string, email: string) {
  memoryToken = token;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(NAME_KEY, name || "");
  await SecureStore.setItemAsync(EMAIL_KEY, email || "");
}

export async function loadSession(): Promise<{ token: string; name: string; email: string } | null> {
  const token = memoryToken ?? (await SecureStore.getItemAsync(TOKEN_KEY));
  if (!token) return null;
  memoryToken = token;
  const name = (await SecureStore.getItemAsync(NAME_KEY)) || "";
  const email = (await SecureStore.getItemAsync(EMAIL_KEY)) || "";
  return { token, name, email };
}

export async function clearSession() {
  memoryToken = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(NAME_KEY);
  await SecureStore.deleteItemAsync(EMAIL_KEY);
}

async function authHeader(): Promise<Record<string, string>> {
  const token = memoryToken ?? (await SecureStore.getItemAsync(TOKEN_KEY));
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<ApiResult<T>> {
  const { method = "GET", body, auth = true } = options;
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (auth) Object.assign(headers, await authHeader());
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      return { ok: false, error: `Server returned an unexpected response (${res.status}).` };
    }
    if (!res.ok || json.ok === false) {
      return { ok: false, error: json.error || `Request failed (${res.status}).` };
    }
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: "Network error. Check your connection and the site URL." };
  }
}

/* ---------- typed endpoints ---------- */

export type DriverLogin = {
  ok: boolean;
  token: string;
  driver: { id: string; name: string; email: string };
};

export function login(email: string, password: string) {
  return request<DriverLogin>("/api/driver/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
}

// Register a brand-new driver using the one-time invite code from the dispatcher.
// Returns a session token just like login.
export function claimByCode(code: string, name: string, password: string) {
  return request<DriverLogin>("/api/driver/claim", {
    method: "POST",
    body: { code, name, password },
    auth: false,
  });
}

export type LoadListItem = {
  id: string;
  ref: string;
  originName: string;
  destName: string;
  status: string;
  docCount: number;
  photoCount: number;
  sharing?: boolean;
};

export function getMyLoads() {
  return request<{ ok: boolean; loads: LoadListItem[]; name: string }>(
    "/api/driver/my-loads"
  );
}

export type LoadDoc = { id: string; type: string; name: string; dataUrl: string };
export type LoadPhoto = { id: string; dataUrl: string; phase: string };
export type LoadMessage = {
  id: string;
  authorName: string;
  authorRole: string;
  text: string;
};

export type LoadDetail = {
  id: string;
  ref: string;
  originName: string;
  destName: string;
  status: string;
  documents: LoadDoc[];
  photos: LoadPhoto[];
  messages: LoadMessage[];
  driverShareLocation?: boolean;
  remainingMeters?: number;
  etaSeconds?: number;
};

export type RouteStep = { text: string; lengthMeters: number };
export type TruckRoute = {
  distanceMeters: number;
  durationSeconds: number;
  steps: RouteStep[];
};

export function getLoad(id: string) {
  return request<{ ok: boolean; load: LoadDetail }>(`/api/loads/${id}`);
}

export function actOnLoad(id: string, body: Record<string, unknown>) {
  return request<{ ok: boolean; load: LoadDetail }>(`/api/loads/${id}`, {
    method: "POST",
    body,
  });
}

// Build a truck-legal route (HERE) to delivery: distance, ETA and turn-by-turn.
export function buildRoute(id: string) {
  return request<{ ok: boolean; route: TruckRoute; load: LoadDetail }>(
    `/api/loads/${id}`,
    { method: "POST", body: { action: "route" } }
  );
}

// Driver reports real GPS for this load (only used while sharing is on).
export function postDriverLocation(id: string, lat: number, lng: number) {
  return actOnLoad(id, { action: "driver_location", lat, lng });
}

// Driver toggles their own location sharing on/off.
export function setDriverShare(id: string, value: boolean) {
  return actOnLoad(id, { action: "driver_share", value });
}

export type Notif = {
  id: string;
  text: string;
  loadRef: string;
  createdAt: string;
  read: boolean;
};

export function getNotifications() {
  return request<{ ok: boolean; items: Notif[]; unread: number }>("/api/notifications");
}

export function markNotificationsRead() {
  return request<{ ok: boolean }>("/api/notifications", { method: "POST" });
}
