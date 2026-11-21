"use client";

import { ChevronRight, RefreshCw, ShieldAlert, ShieldCheck, Trash2, Webhook } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { STATUS_META, rupiah } from "@/lib/client/api";
import { Badge, Button, Card, CopyButton, JsonBlock, cn } from "./ui";
import type { AppConfig } from "./types";

interface Entry {
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

export default function WebhookLogs({ config }: { config: AppConfig | null }) {
  const [items, setItems] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [auto, setAuto] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await (await fetch("/api/webhooks?limit=100", { cache: "no-store" })).json();
      setItems(j.items ?? []);
      setError(j.error ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    if (!auto) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [auto, load]);

  const notifyUrl = `${origin}${config?.webhookPath ?? "/v1.0/debit/notify"}`;

  return (
    <div className="space-y-6">
      <Card icon={<Webhook className="h-5 w-5" />} title="Webhook (Finish Notify)" subtitle="Daftarkan URL ini sebagai Notification URL di dashboard DANA">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dana-500/25 bg-dana-500/5 px-4 py-3">
          <Badge tone="info">POST</Badge>
          <code className="flex-1 break-all font-mono text-sm text-white">{notifyUrl}</code>
          <CopyButton text={notifyUrl} label="Copy" />
        </div>
        <div className="mt-3 grid gap-2 text-xs text-ink-400 sm:grid-cols-3">
          <div>
            Storage: <Badge tone={config?.storeMode === "redis" ? "ok" : "warn"}>{config?.storeMode ?? "…"}</Badge>
          </div>
          <div>Signature: diverifikasi dengan public key DANA ({config?.env})</div>
          <div>Response: <code className="font-mono text-ink-300">2005600 Successful</code></div>
        </div>
        {config?.storeMode === "memory" && (
          <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            Mode memory: di Vercel log webhook bisa tidak muncul karena tiap request bisa berjalan di instance berbeda. Pasang Upstash Redis (UPSTASH_REDIS_REST_URL / TOKEN).
          </p>
        )}
      </Card>

      <Card
        title={`Log masuk (${items.length})`}
        subtitle="Auto-refresh tiap 5 detik"
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setAuto(!auto)}>
              <RefreshCw className={cn("h-4 w-4", auto && loading && "animate-spin")} /> <span className="hidden sm:inline">{auto ? "Auto: on" : "Auto: off"}</span><span className="sm:hidden">{auto ? "On" : "Off"}</span>
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                if (!confirm("Hapus semua log webhook?")) return;
                await fetch("/api/webhooks", { method: "DELETE" });
                load();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        }
      >
        {error && <p className="mb-3 text-sm text-rose-300">{error}</p>}
        {items.length === 0 ? (
          <div className="grid h-40 place-items-center rounded-xl border border-dashed border-ink-700 text-sm text-ink-400">Belum ada webhook masuk</div>
        ) : (
          <ul className="divide-y divide-ink-700/50 overflow-hidden rounded-xl border border-ink-700/60">
            {items.map((it) => {
              const st = it.status ? STATUS_META[it.status] : null;
              const isOpen = open === it.id;
              return (
                <li key={it.id} className="bg-ink-950/30">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : it.id)}
                    className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-ink-800/40"
                  >
                    <ChevronRight className={cn("h-4 w-4 text-ink-400 transition", isOpen && "rotate-90")} />
                    {it.verified ? (
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <span title={it.verifyError}><ShieldAlert className="h-4 w-4 text-rose-400" /></span>
                    )}
                    <span className="font-mono text-sm text-white">{it.partnerReferenceNo ?? "—"}</span>
                    {st && <Badge tone={st.tone}>{st.label}</Badge>}
                    <span className="text-sm text-ink-300">{it.amount ? rupiah(it.amount) : ""}</span>
                    <span className="ml-auto text-xs text-ink-400">{new Date(it.receivedAt).toLocaleString("id-ID")}</span>
                  </button>
                  {isOpen && (
                    <div className="space-y-2 px-4 pb-4">
                      {!it.verified && <p className="text-xs text-rose-300">Signature tidak valid: {it.verifyError}</p>}
                      <JsonBlock
                        value={
                          it.verified
                            ? { matched: { path: it.matchedPath, key: it.matchedKey, form: it.matchedForm }, headers: it.headers, body: it.body }
                            : { verifyDebug: it.verifyDebug, headers: it.headers, rawBody: it.rawBody, body: it.body }
                        }
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
