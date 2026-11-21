"use client";

import { Check, Copy } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export const idr = (v: string | number | undefined | null) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(v ?? 0));

/** Badge inisial berwarna — pengganti logo bank/e-wallet */
export function MethodBadge({ short, color, size = "md" }: { short: string; color: string; size?: "sm" | "md" | "lg" }) {
  const s = { sm: "h-8 w-11 text-[10px]", md: "h-10 w-14 text-[11px]", lg: "h-14 w-20 text-sm" }[size];
  return (
    <span
      className={cx("grid shrink-0 place-items-center rounded-lg font-extrabold tracking-wide text-white shadow-sm", s)}
      style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
    >
      {short}
    </span>
  );
}

export function CopyText({ text, label = "Salin", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        })
      }
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
        done ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700 hover:bg-sky-100",
        className
      )}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? "Tersalin" : label}
    </button>
  );
}

/** Hitung mundur ke validUpTo (format DANA YYYY-MM-DDTHH:mm:ss+07:00) */
export function useCountdown(until?: string | null) {
  const target = until ? Date.parse(until) : NaN;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!Number.isFinite(target)) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  if (!Number.isFinite(target)) return { expired: false, text: "" };
  const left = Math.max(0, target - now);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  const h = Math.floor(m / 60);
  return {
    expired: left === 0,
    text: h > 0 ? `${h}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
  };
}

export function Accordion({ title, children, defaultOpen }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between py-3.5 text-left text-sm font-semibold text-slate-800">
        {title}
        <span className={cx("text-slate-400 transition", open && "rotate-180")}>⌄</span>
      </button>
      {open && <div className="pb-4 text-sm leading-relaxed text-slate-600">{children}</div>}
    </div>
  );
}

/** Kelompokkan angka VA per 4 digit agar mudah dibaca */
export const groupDigits = (s: string) => s.replace(/\s+/g, "").replace(/(.{4})(?=.)/g, "$1 ");
