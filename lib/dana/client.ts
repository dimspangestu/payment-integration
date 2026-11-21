import "server-only";
import crypto from "crypto";
import { DanaModule, assertModuleCreds, getDanaConfig, getModuleCreds } from "./config";
import { signAsymmetric, signRaw } from "./signature";
import { generateExternalId, jakartaTimestamp } from "./utils";

export interface DanaResult<T = Record<string, unknown>> {
  ok: boolean;
  httpStatus: number;
  responseCode: string;
  responseMessage: string;
  data: T;
  durationMs: number;
  request: {
    method: "POST";
    url: string;
    path: string;
    headers: Record<string, string>;
    body: unknown;
  };
  debug?: { stringToSign: string };
  /** Field tambahan dari service (mis. partnerReferenceNo yang di-generate) */
  meta?: Record<string, unknown>;
}

export interface DanaPostOptions {
  /** Kredensial modul (DANA_<MODUL>_*), default QRIS = kredensial global */
  module?: DanaModule;
  /**
   * snap       : METHOD:PATH:sha256(body):timestamp  (default, semua endpoint SNAP)
   * applyToken : clientKey|timestamp + header X-CLIENT-KEY (Widget Apply Token)
   */
  auth?: "snap" | "applyToken";
  /** Header tambahan, mis. Authorization-Customer, X-DEVICE-ID (Widget) */
  extraHeaders?: Record<string, string>;
  /** false = merchantId tidak wajib (Disbursement, Apply Token) */
  requireMerchant?: boolean;
  /** Kode sukses selain 200xxxx (Open API memakai resultStatus) */
  isOk?: (data: Record<string, unknown>, httpOk: boolean) => boolean;
}

const SENSITIVE = ["X-SIGNATURE", "Authorization-Customer"];

function redact(headers: Record<string, string>) {
  const out = { ...headers };
  for (const k of SENSITIVE) if (out[k]) out[k] = out[k].slice(0, 16) + "…";
  return out;
}

/** Kirim body string apa adanya, kembalikan DanaResult */
async function send<T>(
  path: string,
  payload: string,
  headers: Record<string, string>,
  bodyForLog: unknown,
  stringToSign: string,
  isOk?: DanaPostOptions["isOk"]
): Promise<DanaResult<T>> {
  const cfg = getDanaConfig();
  const url = cfg.baseUrl + path;
  const started = Date.now();
  const request = { method: "POST" as const, url, path, headers: redact(headers), body: bodyForLog };
  const debug = cfg.debug ? { stringToSign } : undefined;

  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers, body: payload, cache: "no-store", signal: AbortSignal.timeout(cfg.timeoutMs) });
  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return {
      ok: false,
      httpStatus: 0,
      responseCode: isTimeout ? "TIMEOUT" : "NETWORK_ERROR",
      responseMessage: isTimeout ? "Timeout menunggu DANA. Status transaksi belum pasti — lakukan Cek Query." : `Gagal terhubung ke DANA: ${(err as Error).message}`,
      data: {} as T,
      durationMs: Date.now() - started,
      request,
      debug,
    };
  }

  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  const responseCode = String(data.responseCode ?? res.status);
  const responseMessage = String(data.responseMessage ?? res.statusText ?? "");

  return {
    ok: isOk ? isOk(data, res.ok) : res.ok && responseCode.startsWith("200"),
    httpStatus: res.status,
    responseCode,
    responseMessage,
    data: data as T,
    durationMs: Date.now() - started,
    request,
    debug,
  };
}

/**
 * Request SNAP ke DANA dengan signature asymmetric.
 * Body di-stringify SEKALI dan string yang sama dipakai untuk hash & dikirim.
 */
export async function danaPost<T = Record<string, unknown>>(path: string, body: unknown, opts: DanaPostOptions = {}): Promise<DanaResult<T>> {
  const cfg = getDanaConfig();
  const creds = getModuleCreds(opts.module ?? "QRIS");
  assertModuleCreds(creds, { merchant: opts.requireMerchant !== false && opts.auth !== "applyToken" });

  const payload = JSON.stringify(body);
  const timestamp = jakartaTimestamp();

  let signature: string;
  let stringToSign: string;
  const headers: Record<string, string> = { "Content-Type": "application/json", "X-TIMESTAMP": timestamp };

  if (opts.auth === "applyToken") {
    // SDK SnapHeader scenario "apply_token": data = clientKey|timestamp
    stringToSign = `${creds.partnerId}|${timestamp}`;
    signature = signRaw(creds.privateKey, stringToSign);
    Object.assign(headers, { "X-SIGNATURE": signature, "X-CLIENT-KEY": creds.partnerId, "X-PARTNER-ID": creds.partnerId, "CHANNEL-ID": cfg.channelId });
  } else {
    ({ signature, stringToSign } = signAsymmetric(creds.privateKey, "POST", path, payload, timestamp));
    Object.assign(headers, { "X-SIGNATURE": signature, "X-PARTNER-ID": creds.partnerId, "X-EXTERNAL-ID": generateExternalId(), "CHANNEL-ID": cfg.channelId });
  }
  if (cfg.origin) headers["ORIGIN"] = cfg.origin;
  for (const [k, v] of Object.entries(opts.extraHeaders ?? {})) if (v) headers[k] = v;

  // Jangan tampilkan access token user di log/response dashboard
  const bodyForLog = JSON.parse(payload, (k, v) => (k === "accessToken" && typeof v === "string" ? v.slice(0, 8) + "…" : v));
  return send<T>(path, payload, headers, bodyForLog, stringToSign, opts.isOk);
}

/* ------------------------------------------------------------------ */
/* Open API (format lama DANA) — dipakai Widget Query User Profile      */
/* body: {"request": {"head": {...}, "body": {...}}, "signature": "..."} */
/* SDK: signature = RSA-SHA256(json.dumps(request)) — format Python      */
/* (spasi setelah ':' dan ','), dan body dikirim dengan format sama.    */
/* ------------------------------------------------------------------ */

/** Tiru json.dumps() Python default: separator ", " & ": ", ensure_ascii=True */
export function pyJsonDumps(v: unknown): string {
  const esc = (s: string) =>
    JSON.stringify(s).replace(/[\u007f-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
  if (v === null || v === undefined) return "null";
  if (typeof v === "string") return esc(v);
  if (typeof v === "number" || typeof v === "boolean") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(pyJsonDumps).join(", ") + "]";
  const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined);
  return "{" + entries.map(([k, x]) => `${esc(k)}: ${pyJsonDumps(x)}`).join(", ") + "}";
}

export async function danaOpenApiPost<T = Record<string, unknown>>(
  path: string,
  functionName: string,
  body: Record<string, unknown>,
  opts: { module?: DanaModule; accessToken?: string } = {}
): Promise<DanaResult<T>> {
  const cfg = getDanaConfig();
  const creds = getModuleCreds(opts.module ?? "WIDGET");
  assertModuleCreds(creds, { merchant: false });
  if (!creds.clientSecret) {
    return {
      ok: false,
      httpStatus: 0,
      responseCode: "CONFIG_ERROR",
      responseMessage: `Open API butuh DANA_${creds.module}_CLIENT_SECRET / DANA_CLIENT_SECRET`,
      data: {} as T,
      durationMs: 0,
      request: { method: "POST", url: cfg.baseUrl + path, path, headers: {}, body },
    };
  }

  // Urutan field mengikuti SDK: version, function, clientId, clientSecret, reqTime, reqMsgId, accessToken, reserve
  const head: Record<string, unknown> = {
    version: "2.0",
    function: functionName,
    clientId: creds.partnerId,
    clientSecret: creds.clientSecret,
    reqTime: jakartaTimestamp(),
    reqMsgId: "dq" + crypto.randomUUID().slice(2),
  };
  if (opts.accessToken) head.accessToken = opts.accessToken;
  head.reserve = "{}";

  const request = { head, body };
  const stringToSign = pyJsonDumps(request);
  const signature = signRaw(creds.privateKey, stringToSign);
  const payload = pyJsonDumps({ request, signature });

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const bodyForLog = {
    request: { head: { ...head, clientSecret: "••••", accessToken: opts.accessToken ? opts.accessToken.slice(0, 8) + "…" : undefined }, body },
    signature: signature.slice(0, 16) + "…",
  };

  return send<T>(path, payload, headers, bodyForLog, stringToSign, (data) => {
    const rs = (data as { response?: { body?: { resultInfo?: { resultStatus?: string } } } }).response?.body?.resultInfo?.resultStatus;
    return rs === "S";
  });
}
