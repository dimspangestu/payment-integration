import "server-only";

/**
 * Penyimpanan webhook + status transaksi.
 *  - Vercel: pakai Upstash Redis / Vercel KV (REST, tanpa dependency tambahan).
 *  - Lokal tanpa Redis: in-memory (hilang saat restart, dan di Vercel tiap instance beda memori).
 */

export interface WebhookEntry {
  id: string;
  receivedAt: string;
  verified: boolean;
  verifyError?: string;
  matchedPath?: string;
  matchedKey?: string;
  matchedForm?: number;
  verifyDebug?: unknown;
  rawBody?: string;
  partnerReferenceNo?: string;
  referenceNo?: string;
  status?: string;
  amount?: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface TxnStatus {
  partnerReferenceNo: string;
  referenceNo?: string;
  status?: string;
  statusDesc?: string;
  amount?: string;
  paidTime?: string;
  updatedAt: string;
  source: "webhook" | "query";
}

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
export const storeMode: "redis" | "memory" = REDIS_URL && REDIS_TOKEN ? "redis" : "memory";

const LIST_KEY = "dana:webhooks";
const TXN_KEY = (ref: string) => `dana:txn:${ref}`;
const MAX_LOGS = 200;
const TXN_TTL = 60 * 60 * 24 * 14; // 14 hari

async function redis<T = unknown>(cmd: (string | number)[]): Promise<T> {
  const res = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  const json = (await res.json()) as { result?: T; error?: string };
  if (json.error) throw new Error(`Redis: ${json.error}`);
  return json.result as T;
}

type Mem = { logs: WebhookEntry[]; txns: Map<string, TxnStatus> };
const g = globalThis as unknown as { __danaStore?: Mem };
const mem: Mem = (g.__danaStore ??= { logs: [], txns: new Map() });

export async function saveWebhook(entry: WebhookEntry) {
  if (storeMode === "redis") {
    await redis(["LPUSH", LIST_KEY, JSON.stringify(entry)]);
    await redis(["LTRIM", LIST_KEY, 0, MAX_LOGS - 1]);
  } else {
    mem.logs.unshift(entry);
    mem.logs.length = Math.min(mem.logs.length, MAX_LOGS);
  }
}

export async function listWebhooks(limit = 50): Promise<WebhookEntry[]> {
  if (storeMode === "redis") {
    const rows = await redis<string[]>(["LRANGE", LIST_KEY, 0, limit - 1]);
    return (rows ?? []).map((r) => JSON.parse(r));
  }
  return mem.logs.slice(0, limit);
}

export async function clearWebhooks() {
  if (storeMode === "redis") await redis(["DEL", LIST_KEY]);
  else mem.logs = [];
}

export async function saveTxnStatus(t: TxnStatus) {
  if (storeMode === "redis") await redis(["SET", TXN_KEY(t.partnerReferenceNo), JSON.stringify(t), "EX", TXN_TTL]);
  else mem.txns.set(t.partnerReferenceNo, t);
}

export async function getTxnStatus(ref: string): Promise<TxnStatus | null> {
  if (storeMode === "redis") {
    const v = await redis<string | null>(["GET", TXN_KEY(ref)]);
    return v ? JSON.parse(v) : null;
  }
  return mem.txns.get(ref) ?? null;
}