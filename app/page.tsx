"use client";

import {
  Ban,
  CreditCard,
  Globe,
  LayoutTemplate,
  ArrowDownToLine,
  AppWindow,
  LogOut,
  History as HistoryIcon,
  LayoutDashboard,
  Menu,
  QrCode,
  ScanLine,
  Search,
  ShieldAlert,
  Undo2,
  Webhook,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import CancelForm from "@/components/forms/CancelForm";
import CpmForm from "@/components/forms/CpmForm";
import MpmForm from "@/components/forms/MpmForm";
import QueryForm from "@/components/forms/QueryForm";
import RefundForm from "@/components/forms/RefundForm";
import History from "@/components/History";
import Overview from "@/components/Overview";
import CheckoutBuilder from "@/components/pg/CheckoutBuilder";
import DisbursementPanel from "@/components/disbursement/DisbursementPanel";
import WidgetPanel from "@/components/widget/WidgetPanel";
import HostedForm from "@/components/pg/HostedForm";
import PgOps from "@/components/pg/PgOps";
import WebhookLogs from "@/components/WebhookLogs";
import { Badge, cn } from "@/components/ui";
import type { AppConfig, Prefill, TabKey } from "@/components/types";

const NAV: { group: string; items: { key: TabKey; label: string; icon: React.ReactNode; soon?: boolean }[] }[] = [
  { group: "", items: [{ key: "overview", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> }] },
  {
    group: "QRIS",
    items: [
      { key: "mpm", label: "MPM · Generate QR", icon: <QrCode className="h-4 w-4" /> },
      { key: "cpm", label: "CPM · Scan QR", icon: <ScanLine className="h-4 w-4" /> },
      { key: "query", label: "Cek Query", icon: <Search className="h-4 w-4" /> },
      { key: "cancel", label: "Cancel", icon: <Ban className="h-4 w-4" /> },
      { key: "refund", label: "Refund", icon: <Undo2 className="h-4 w-4" /> },
    ],
  },
  {
    group: "Monitoring",
    items: [
      { key: "webhooks", label: "Webhook Logs", icon: <Webhook className="h-4 w-4" /> },
      { key: "history", label: "Riwayat", icon: <HistoryIcon className="h-4 w-4" /> },
    ],
  },
  {
    group: "Payment Gateway",
    items: [
      { key: "pg-hosted", label: "Hosted Checkout", icon: <Globe className="h-4 w-4" /> },
      { key: "pg-custom", label: "Custom Checkout", icon: <LayoutTemplate className="h-4 w-4" /> },
      { key: "pg-ops", label: "Query · Cancel · Refund", icon: <CreditCard className="h-4 w-4" /> },
    ],
  },
  {
    group: "Lainnya",
    items: [
      { key: "disbursement", label: "Disbursement", icon: <ArrowDownToLine className="h-4 w-4" /> },
      { key: "widget", label: "Widget", icon: <AppWindow className="h-4 w-4" /> },
    ],
  },
];

const TITLES: Record<TabKey, string> = {
  overview: "Overview",
  mpm: "QRIS MPM",
  cpm: "QRIS CPM",
  query: "Query Payment",
  cancel: "Cancel",
  refund: "Refund",
  webhooks: "Webhook",
  history: "Riwayat",
  "pg-hosted": "Hosted Checkout",
  "pg-custom": "Custom Checkout",
  "pg-ops": "Payment Gateway Ops",
  disbursement: "Disbursement",
  widget: "Widget",
};

export default function Home() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [prefill, setPrefill] = useState<Prefill | undefined>();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => {});
  }, []);

  // Deep link: /#mpm, /#pg-custom, dst.
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1) as TabKey;
      if (h && h in TITLES) setTab(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }, []);

  const navigate = useCallback((t: TabKey, p?: Prefill) => {
    if (window.location.hash.slice(1) !== t) history.replaceState(null, "", `#${t}`);
    setPrefill(p ? { ...p } : undefined);
    setTab(t);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const sidebar = (
    <nav className="flex h-full flex-col overflow-y-auto overscroll-contain">
      <div className="flex shrink-0 items-center gap-3 px-5 pb-4 pt-5 [@media(max-height:760px)]:pb-3 [@media(max-height:760px)]:pt-4">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-dana-400 to-dana-600 shadow-lg shadow-dana-500/30">
          <QrCode className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="text-[15px] font-bold tracking-tight text-white">DANA Console</div>
          <div className="text-xs text-ink-400">Payment Console</div>
        </div>
      </div>
      <div className="flex-1 space-y-4 px-3 [@media(max-height:760px)]:space-y-2.5">
        {NAV.map((g) => (
          <div key={g.group || "root"}>
            {g.group && <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-widest text-ink-400/70">{g.group}</div>}
            <ul className="space-y-0.5">
              {g.items.map((it) => (
                <li key={it.key}>
                  <button
                    onClick={() => navigate(it.key)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition [@media(max-height:760px)]:py-1.5 [@media(min-height:860px)]:py-2.5",
                      tab === it.key
                        ? "bg-dana-500/15 font-semibold text-white ring-1 ring-inset ring-dana-400/25"
                        : "text-ink-300 hover:bg-ink-800/60 hover:text-white"
                    )}
                  >
                    <span className={cn("shrink-0", tab === it.key && "text-dana-300")}>{it.icon}</span>
                    <span className="truncate">{it.label}</span>
                    {it.soon && <span className="ml-auto rounded bg-amber-500/15 px-1.5 py-px text-[10px] font-semibold text-amber-300">SOON</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {/* ikut ter-scroll bersama menu, jadi tidak menutupi item di layar laptop pendek */}
      <div className="m-3 mt-5 shrink-0 rounded-xl border border-ink-700/60 bg-ink-900/60 p-3 text-xs text-ink-400 [@media(max-height:760px)]:hidden">
        <div className="flex items-center justify-between">
          <span>Environment</span>
          <Badge tone={config?.env === "production" ? "bad" : "info"} dot>
            {config?.env ?? "…"}
          </Badge>
        </div>
        <div className="mt-2 truncate font-mono text-[11px]">{config?.baseUrl}</div>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-ink-800 bg-ink-950/60 backdrop-blur lg:block">{sidebar}</aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-ink-800 bg-ink-950">
            <button className="absolute right-3 top-3 p-2 text-ink-400" onClick={() => setMobileOpen(false)}>
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-ink-800/70 bg-ink-950/70 px-4 py-3 backdrop-blur sm:px-8 sm:py-4">
          <button className="-ml-1 shrink-0 rounded-lg p-1.5 text-ink-300 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <div className="hidden truncate text-xs text-ink-400 sm:block">DANA / {TITLES[tab]}</div>
            <h1 className="truncate text-base font-bold tracking-tight text-white sm:text-lg">{TITLES[tab]}</h1>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {config && !config.authEnabled && (
              <span className="hidden items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-300 ring-1 ring-amber-400/20 sm:inline-flex">
                <ShieldAlert className="h-3.5 w-3.5" /> Dashboard tanpa login
              </span>
            )}
            {config && !config.authEnabled && (
              <span className="grid h-7 w-7 place-items-center rounded-full bg-amber-500/10 text-amber-300 ring-1 ring-amber-400/20 sm:hidden" title="Dashboard tanpa login">
                <ShieldAlert className="h-3.5 w-3.5" />
              </span>
            )}
            {config?.env && (
              <span className="sm:hidden">
                <Badge tone={config.env === "production" ? "bad" : "info"}>{config.env}</Badge>
              </span>
            )}
            {config?.merchantId && (
              <span className="hidden sm:inline-flex">
                <Badge>MID {config.merchantId}</Badge>
              </span>
            )}
            {config?.authMode === "captcha" && (
              <button
                onClick={logout}
                className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 transition hover:bg-ink-800 hover:text-white sm:w-auto sm:gap-1.5 sm:px-2.5 sm:[display:inline-flex] sm:items-center"
                title="Keluar"
                aria-label="Keluar"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden text-xs font-medium sm:inline">Keluar</span>
              </button>
            )}
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-3 py-5 sm:px-8 sm:py-8">
          {tab === "overview" && <Overview config={config} navigate={navigate} />}
          {tab === "mpm" && <MpmForm config={config} navigate={navigate} />}
          {tab === "cpm" && <CpmForm config={config} navigate={navigate} />}
          {tab === "query" && <QueryForm prefill={prefill} />}
          {tab === "cancel" && <CancelForm prefill={prefill} />}
          {tab === "refund" && <RefundForm prefill={prefill} />}
          {tab === "webhooks" && <WebhookLogs config={config} />}
          {tab === "history" && <History navigate={navigate} />}
          {tab === "pg-hosted" && <HostedForm config={config} navigate={navigate} />}
          {tab === "pg-custom" && <CheckoutBuilder config={config} />}
          {tab === "pg-ops" && <PgOps prefill={prefill} />}
          {tab === "disbursement" && <DisbursementPanel config={config} />}
          {tab === "widget" && <WidgetPanel config={config} prefill={prefill} />}
        </div>
      </main>
    </div>
  );
}
