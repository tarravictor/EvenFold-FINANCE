export function preference(key: string, fallback = "") {
  try { return localStorage.getItem(`evenfold-${key}`) ?? fallback; } catch { return fallback; }
}
export function setPreference(key: string, value: string) {
  try { localStorage.setItem(`evenfold-${key}`, value); } catch { throw new Error("Device storage is unavailable."); }
}
export function offlinePreference() { return preference(`offline-${window.EVENFOLD_USER || "unsigned"}`) === "yes"; }
