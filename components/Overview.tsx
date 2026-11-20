"use client";

import { ArrowRight, Ban, CheckCircle2, QrCode, ScanLine, Search, Undo2, Webhook, XCircle } from "lucide-react";
import { rupiah } from "@/lib/client/api";
import History, { useHistory } from "./History";
import { Badge, Card } from "./ui";
import type { AppConfig, Navigate, TabKey } from "./types";

const ACTIONS: { tab: TabKey; title: string; desc: string; icon: React.ReactNode }[] = [
  { tab: "mpm", title: "Generate QRIS", desc: "MPM · storeId + amount", icon: <QrCode className="h-5 w-5" /> },
  { tab: "cpm", title: "Scan QR Customer", desc: "CPM · qrContent + amount", icon: <ScanLine className="h-5 w-5" /> },
  { tab: "query", title: "Cek Status", desc: "Query payment", icon: <Search className="h-5 w-5" /> },
  { tab: "cancel", title: "Cancel", desc: "Batalkan transaksi", icon: <Ban className="h-5 w-5" /> },
  { tab: "refund", title: "Refund", desc: "Full / partial", icon: <Undo2 className="h-5 w-5" /> },
  { tab: "webhooks", title: "Webhook", desc: "Finish notify log", icon: <Webhook className="h-5 w-5" /> },
];

export default function Overview({ config, navigate }: { config: AppConfig | null; navigate: Navigate }) {
  const history = useHistory();
  const today = new Date().toDateString();
  const todays = history.filter((h) => new Date(h.createdAt).toDateString() === today && (h.type === "MPM" || h.type === "CPM"));
  const paid = todays.filter((h) => h.status === "00");
  const volume = paid.reduce((s, h) => s + Number(h.amount || 0), 0);

  const checks = config
    ? [
        ["X-PARTNER-ID", config.configured.partnerId],
        ["Merchant ID", config.configured.merchantId],
        ["Private key", config.configured.privateKey],
        ["Public key (webhook)", config.configured.publicKey],
        ["Redis storage", config.storeMode === "redis"],
        ["Basic auth", config.authEnabled],
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Transaksi hari ini" value={String(todays.length)} />
        <Stat label="Berhasil dibayar" value={String(paid.length)} />
        <Stat label="Volume sukses" value={rupiah(volume)} accent />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ACTIONS.map((a) => (
            <button
              key={a.tab}
              onClick={() => navigate(a.tab)}
              className="card group flex items-center gap-4 p-4 text-left transition hover:-translate-y-0.5 hover:border-dana-400/30"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-dana-500/15 text-dana-300 ring-1 ring-dana-400/20">{a.icon}</div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">{a.title}</div>
                <div className="text-xs text-ink-400">{a.desc}</div>
              </div>
              <ArrowRight className="h-4 w-4 text-ink-400 transition group-hover:translate-x-0.5 group-hover:text-dana-300" />
            </button>
          ))}
        </div>

        <Card title="Konfigurasi" subtitle={config ? `${config.baseUrl}` : "Memuat…"}>
          <ul className="space-y-2">
            {checks.map(([label, ok]) => (
              <li key={String(label)} className="flex items-center justify-between text-sm">
                <span className="text-ink-300">{label}</span>
                {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-rose-400" />}
              </li>
            ))}
          </ul>
          {config && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone={config.env === "production" ? "bad" : "info"}>{config.env}</Badge>
              <Badge>MID {config.merchantId || "—"}</Badge>
            </div>
          )}
        </Card>
      </div>

      <History navigate={navigate} compact />
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card relative overflow-hidden p-5">
      {accent && <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-dana-500/20 blur-2xl" />}
      <div className="text-xs uppercase tracking-wider text-ink-400">{label}</div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-white">{value}</div>
    </div>
  );
}
