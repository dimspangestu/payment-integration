"use client";

import { Check, ChevronDown, Copy, Loader2 } from "lucide-react";
import { ReactNode, useState } from "react";
import type { ApiResult } from "@/lib/client/api";

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({
  title,
  subtitle,
  icon,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("card p-5 sm:p-6", className)}>
      {(title || actions) && (
        <header className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {icon && (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-dana-500/15 text-dana-300 ring-1 ring-dana-400/20">
                {icon}
              </div>
            )}
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-white">{title}</h2>
              {subtitle && <p className="mt-0.5 text-sm text-ink-400">{subtitle}</p>}
            </div>
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children, optional }: { label: string; hint?: ReactNode; children: ReactNode; optional?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-[13px] font-medium text-ink-300">
        {label}
        {optional && <span className="rounded bg-ink-700/70 px-1.5 py-px text-[10px] uppercase tracking-wide text-ink-400">opsional</span>}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-ink-400">{hint}</span>}
    </label>
  );
}

export function AmountInput({ value, onChange, placeholder = "10000" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-400">Rp</span>
      <input
        className="input pl-10 font-mono text-base"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
        placeholder={placeholder}
      />
    </div>
  );
}

export function QuickAmounts({ onPick }: { onPick: (v: string) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {["1000", "10000", "25000", "50000", "100000"].map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onPick(v)}
          className="rounded-lg border border-ink-700 bg-ink-900/60 px-2.5 py-1 text-xs text-ink-300 transition hover:border-dana-500/60 hover:text-white"
        >
          {Number(v).toLocaleString("id-ID")}
        </button>
      ))}
    </div>
  );
}

export function Button({
  children,
  loading,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: "primary" | "ghost" | "danger" | "soft" }) {
  const styles = {
    primary:
      "bg-gradient-to-b from-dana-400 to-dana-600 text-white shadow-lg shadow-dana-500/25 hover:brightness-110 ring-1 ring-inset ring-white/15",
    ghost: "border border-ink-700 bg-ink-900/40 text-ink-300 hover:border-ink-600 hover:text-white",
    soft: "bg-dana-500/15 text-dana-300 hover:bg-dana-500/25 ring-1 ring-inset ring-dana-400/20",
    danger: "bg-gradient-to-b from-rose-500 to-rose-700 text-white shadow-lg shadow-rose-600/20 hover:brightness-110",
  }[variant];
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        styles,
        className
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

const TONES = {
  ok: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/25",
  warn: "bg-amber-500/15 text-amber-300 ring-amber-400/25",
  bad: "bg-rose-500/15 text-rose-300 ring-rose-400/25",
  info: "bg-dana-500/15 text-dana-300 ring-dana-400/25",
  muted: "bg-ink-700/50 text-ink-300 ring-ink-600/40",
};

export function Badge({ tone = "muted", children, dot }: { tone?: keyof typeof TONES; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", TONES[tone])}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        });
      }}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-ink-400 transition hover:bg-ink-700/60 hover:text-white"
      title="Copy"
    >
      {done ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

export function KV({ k, v, mono = true, copy }: { k: string; v?: ReactNode; mono?: boolean; copy?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-ink-700/50 py-2 last:border-0">
      <span className="text-xs text-ink-400">{k}</span>
      <span className={cn("flex min-w-0 items-center gap-1 text-right text-sm text-white", mono && "font-mono text-[13px]")}>
        <span className="truncate">{v ?? "—"}</span>
        {copy && <CopyButton text={copy} />}
      </span>
    </div>
  );
}

export function JsonBlock({ value }: { value: unknown }) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <div className="relative">
      <div className="absolute right-2 top-2">
        <CopyButton text={text} />
      </div>
      <pre className="max-h-80 overflow-auto rounded-xl border border-ink-700/60 bg-ink-950/80 p-4 font-mono text-[12px] leading-relaxed text-dana-300/90">
        {text}
      </pre>
    </div>
  );
}

function Collapse({ title, children, defaultOpen }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="rounded-xl border border-ink-700/60">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-ink-400 hover:text-white"
      >
        {title}
        <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

export function ResultPanel({ result, extra }: { result: ApiResult | null; extra?: ReactNode }) {
  if (!result) return null;
  return (
    <div className="mt-5 space-y-3">
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3",
          result.ok ? "border-emerald-500/25 bg-emerald-500/5" : "border-rose-500/25 bg-rose-500/5"
        )}
      >
        <div className="flex items-center gap-3">
          <Badge tone={result.ok ? "ok" : "bad"} dot>
            {result.responseCode}
          </Badge>
          <span className="text-sm text-white">{result.responseMessage}</span>
        </div>
        <span className="text-xs text-ink-400">
          {result.httpStatus ? `HTTP ${result.httpStatus}` : ""} {result.durationMs ? `· ${result.durationMs} ms` : ""}
        </span>
      </div>
      {extra}
      {result.data && <Collapse title="Response body" defaultOpen={!result.ok}>{<JsonBlock value={result.data} />}</Collapse>}
      {result.request && (
        <Collapse title="Request (headers & body)">
          <JsonBlock value={{ url: result.request.url, headers: result.request.headers, body: result.request.body }} />
        </Collapse>
      )}
      {result.debug && (
        <Collapse title="Debug: stringToSign">
          <JsonBlock value={result.debug.stringToSign} />
        </Collapse>
      )}
    </div>
  );
}
