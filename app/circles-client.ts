export type Status = { budgetPct?: number; goal?: { name: string; pct: number }; daysLogged?: number };
export type Member = { user_id: string; display_name: string; status: Status; updated_at: string };
export type Circle = { id: string; name: string; code: string; created_by: string | null; circle_members: Member[] };
export type Sharing = { budget: boolean; goal: boolean; days: boolean; paused: boolean };

export const codePattern = /^[A-HJ-NP-Z2-9]{8}$/;
const sharingKey = "evenfold-circle-sharing-v1";
export const defaultSharing: Sharing = { budget: true, goal: false, days: true, paused: false };

export function readSharing(): Sharing {
  try { return { ...defaultSharing, ...JSON.parse(localStorage.getItem(sharingKey) || "{}") }; } catch { return defaultSharing; }
}
export function writeSharing(value: Sharing) { localStorage.setItem(sharingKey, JSON.stringify(value)); }

async function call(path: string, method: "GET" | "POST" | "PATCH", body?: unknown) {
  if (!navigator.onLine) throw new Error("Reconnect to use friend circles.");
  const c = window.EVENFOLD_CONFIG;
  if (!c || !window.EVENFOLD_TOKEN) throw new Error("Sign in to use friend circles.");
  const response = await fetch(`${c.url}/rest/v1/${path}`, {
    method,
    headers: { apikey: c.key, Authorization: `Bearer ${window.EVENFOLD_TOKEN}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { message?: string; code?: string };
    if (error.code === "PGRST202" || error.code === "42P01") throw new Error("Friend circles are not set up on this server yet.");
    throw new Error(error.message || "Something went wrong. Please try again.");
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export const listCircles = () => call("circles?select=id,name,code,created_by,circle_members(user_id,display_name,status,updated_at)&order=created_at.asc", "GET") as Promise<Circle[]>;
export const createCircle = (name: string, displayName: string) => call("rpc/create_circle", "POST", { p_name: name, p_display_name: displayName }) as Promise<string>;
export const joinCircle = (code: string, displayName: string) => call("rpc/join_circle", "POST", { p_code: code, p_display_name: displayName }) as Promise<string>;
export const leaveCircle = (id: string) => call("rpc/leave_circle", "POST", { p_circle: id });
export const rotateCode = (id: string) => call("rpc/rotate_circle_code", "POST", { p_circle: id }) as Promise<string>;
export async function pushStatus(circles: Circle[], userId: string, status: Status) {
  await Promise.all(circles.map(circle => call(`circle_members?circle_id=eq.${circle.id}&user_id=eq.${userId}`, "PATCH", { status, updated_at: new Date().toISOString() })));
}

export function inviteLink(code: string) {
  return `${window.location.origin}${import.meta.env.BASE_URL}#join=${code}`;
}
export function ago(iso: string) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 90) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return `${Math.round(seconds / 86400)} d ago`;
}
