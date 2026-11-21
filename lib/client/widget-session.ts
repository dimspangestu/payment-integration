"use client";

/**
 * Sesi binding Widget disimpan di browser ini (sandbox).
 * Production: simpan accessToken/refreshToken di server (DB, terenkripsi) per user — jangan di localStorage.
 */
export interface WidgetSession {
  accessToken: string;
  refreshToken?: string;
  accessTokenExpiryTime?: string;
  refreshTokenExpiryTime?: string;
  publicUserId?: string;
  boundAt: string;
}

const KEY = "dana-widget-session:v1";
const STATE_KEY = "dana-widget-oauth-state";
const EVT = "dana-widget-session";

export function getWidgetSession(): WidgetSession | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

export function setWidgetSession(s: WidgetSession | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVT));
  } catch {
    /* storage tidak tersedia */
  }
}

export function onWidgetSessionChange(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function saveOauthState(state: string) {
  try {
    sessionStorage.setItem(STATE_KEY, state);
  } catch {
    /* noop */
  }
}

export function takeOauthState() {
  try {
    const v = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    return v;
  } catch {
    return null;
  }
}
