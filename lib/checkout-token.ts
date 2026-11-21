import "server-only";
import crypto from "crypto";
import { getDanaConfig } from "./dana/config";

/**
 * Link checkout ditandatangani HMAC-SHA256 supaya amount/item tidak bisa diubah customer.
 * Secret: CHECKOUT_SECRET, atau fallback turunan dari DANA_PRIVATE_KEY.
 */

export interface CheckoutOrder {
  amount: string; // "25000.00"
  title: string;
  goods?: { name: string; price: string; quantity: number }[];
  buyerName?: string;
  /** externalStoreId — wajib untuk QRIS */
  storeId?: string;
  /** epoch ms — link kedaluwarsa */
  exp: number;
  /** id unik link, mencegah dua order dari satu link dianggap sama */
  nonce: string;
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

function secret() {
  const cfg = getDanaConfig();
  const s = cfg.checkoutSecret || (cfg.privateKey ? crypto.createHash("sha256").update("checkout:" + cfg.privateKey).digest("hex") : "");
  if (!s) throw new Error("CHECKOUT_SECRET belum di-set");
  return s;
}

export function signCheckout(order: Omit<CheckoutOrder, "exp" | "nonce">, ttlMinutes = 60 * 24): string {
  const full: CheckoutOrder = { ...order, exp: Date.now() + ttlMinutes * 60_000, nonce: crypto.randomBytes(6).toString("hex") };
  const payload = b64url(JSON.stringify(full));
  const sig = b64url(crypto.createHmac("sha256", secret()).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifyCheckout(token: string | null | undefined): { ok: true; order: CheckoutOrder } | { ok: false; error: string } {
  if (!token || !token.includes(".")) return { ok: false, error: "Link checkout tidak valid" };
  const [payload, sig] = token.split(".");
  let expected: string;
  try {
    expected = b64url(crypto.createHmac("sha256", secret()).update(payload).digest());
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, error: "Link checkout tidak valid" };
  try {
    const order = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as CheckoutOrder;
    if (Date.now() > order.exp) return { ok: false, error: "Link checkout sudah kedaluwarsa" };
    return { ok: true, order };
  } catch {
    return { ok: false, error: "Link checkout rusak" };
  }
}

/** Base URL publik aplikasi (untuk returnUrl & notifyUrl) */
export function baseUrl(req: Request) {
  const cfg = getDanaConfig();
  if (cfg.appUrl) return cfg.appUrl;
  const h = req.headers;
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}

export function notifyUrlFor(req: Request) {
  const cfg = getDanaConfig();
  return cfg.notifyUrl || `${baseUrl(req)}${cfg.webhookPath}`;
}
