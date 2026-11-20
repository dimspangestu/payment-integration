import "server-only";
import { assertCoreConfig, getDanaConfig } from "./config";
import { signAsymmetric } from "./signature";
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

function redact(headers: Record<string, string>) {
  const out = { ...headers };
  if (out["X-SIGNATURE"]) out["X-SIGNATURE"] = out["X-SIGNATURE"].slice(0, 16) + "…";
  return out;
}

/**
 * Kirim request SNAP ke DANA dengan signature asymmetric.
 * Body di-stringify SEKALI dan string yang sama dipakai untuk hash & dikirim,
 * sehingga signature selalu cocok.
 */
export async function danaPost<T = Record<string, unknown>>(path: string, body: unknown): Promise<DanaResult<T>> {
  const cfg = getDanaConfig();
  assertCoreConfig(cfg);

  const payload = JSON.stringify(body);
  const timestamp = jakartaTimestamp();
  const { signature, stringToSign } = signAsymmetric(cfg.privateKey, "POST", path, payload, timestamp);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-TIMESTAMP": timestamp,
    "X-SIGNATURE": signature,
    "X-PARTNER-ID": cfg.partnerId,
    "X-EXTERNAL-ID": generateExternalId(),
    "CHANNEL-ID": cfg.channelId,
  };
  if (cfg.origin) headers["ORIGIN"] = cfg.origin;

  const url = cfg.baseUrl + path;
  const started = Date.now();
  const request = { method: "POST" as const, url, path, headers: redact(headers), body };
  const debug = cfg.debug ? { stringToSign } : undefined;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: payload,
      cache: "no-store",
      signal: AbortSignal.timeout(cfg.timeoutMs),
    });
  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return {
      ok: false,
      httpStatus: 0,
      responseCode: isTimeout ? "TIMEOUT" : "NETWORK_ERROR",
      responseMessage: isTimeout
        ? "Timeout menunggu DANA. Status transaksi belum pasti — lakukan Cek Query."
        : `Gagal terhubung ke DANA: ${(err as Error).message}`,
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
    ok: res.ok && responseCode.startsWith("200"),
    httpStatus: res.status,
    responseCode,
    responseMessage,
    data: data as T,
    durationMs: Date.now() - started,
    request,
    debug,
  };
}
