import crypto from "crypto";

export class DanaInputError extends Error {}

const pad = (n: number, l = 2) => String(n).padStart(l, "0");

function jakartaParts(d = new Date()) {
  const j = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return {
    Y: j.getUTCFullYear(),
    M: pad(j.getUTCMonth() + 1),
    D: pad(j.getUTCDate()),
    h: pad(j.getUTCHours()),
    m: pad(j.getUTCMinutes()),
    s: pad(j.getUTCSeconds()),
  };
}

/** ISO8601 Asia/Jakarta, presisi detik: 2026-11-20T09:41:00+07:00 */
export function jakartaTimestamp(d = new Date()): string {
  const p = jakartaParts(d);
  return `${p.Y}-${p.M}-${p.D}T${p.h}:${p.m}:${p.s}+07:00`;
}

/**
 * partnerReferenceNo otomatis. Maks 25 karakter (batas QRIS).
 * Format: PREFIX(3) + yyMMddHHmmss(12) + random(6) = 21 karakter
 */
export function generateRef(prefix = "REF"): string {
  const p = jakartaParts();
  const rand = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  return `${prefix.slice(0, 3).toUpperCase()}${String(p.Y).slice(2)}${p.M}${p.D}${p.h}${p.m}${p.s}${rand}`.slice(0, 25);
}

/** X-EXTERNAL-ID: numerik, unik per hari, maks 36 karakter */
export function generateExternalId(): string {
  return `${Date.now()}${crypto.randomInt(0, 1_000_000_000).toString().padStart(9, "0")}`;
}

/** "10000" | "10.000" | 10000 → "10000.00" */
export function formatAmount(input: string | number | undefined | null): string {
  if (input === undefined || input === null || input === "") throw new DanaInputError("Amount wajib diisi");
  let s = String(input).trim().replace(/\s|Rp/gi, "");
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) s = s.replace(/\./g, "").replace(",", "."); // format ID: 10.000,50
  else s = s.replace(/,/g, "");
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) throw new DanaInputError("Amount tidak valid");
  return n.toFixed(2);
}

export function money(value: string | number) {
  return { value: formatAmount(value), currency: "IDR" };
}

/** Waktu + N menit dalam format Jakarta */
export function jakartaTimestampPlus(minutes: number) {
  return jakartaTimestamp(new Date(Date.now() + minutes * 60_000));
}

export function requireString(v: unknown, field: string, max?: number): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) throw new DanaInputError(`${field} wajib diisi`);
  if (max && s.length > max) throw new DanaInputError(`${field} maksimal ${max} karakter`);
  return s;
}

export function optionalString(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s || undefined;
}

/** Hapus key yang undefined agar body JSON bersih (penting untuk signature konsisten) */
export function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
