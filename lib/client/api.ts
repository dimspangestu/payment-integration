"use client";

export interface ApiResult {
  ok: boolean;
  httpStatus?: number;
  responseCode: string;
  responseMessage: string;
  data?: Record<string, any>;
  durationMs?: number;
  request?: { method: string; url: string; path: string; headers: Record<string, string>; body: unknown };
  debug?: { stringToSign: string };
  meta?: Record<string, any>;
}

export async function postApi(path: string, body: unknown): Promise<ApiResult> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return {
      ok: Boolean(json.ok),
      responseCode: json.responseCode ?? String(res.status),
      responseMessage: json.responseMessage ?? res.statusText,
      ...json,
    };
  } catch (e) {
    return { ok: false, responseCode: "CLIENT_ERROR", responseMessage: (e as Error).message };
  }
}

export function rupiah(v: string | number | undefined) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return String(v);
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 2 }).format(n);
}

export const STATUS_META: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "info" | "muted" }> = {
  "00": { label: "SUCCESS", tone: "ok" },
  "01": { label: "INITIATED", tone: "info" },
  "02": { label: "PAYING", tone: "warn" },
  "05": { label: "CANCELLED", tone: "bad" },
  "07": { label: "NOT FOUND", tone: "muted" },
};
