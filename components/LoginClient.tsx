"use client";

import { ArrowRight, Loader2, QrCode, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "./ui";

interface Captcha {
  token: string;
  image: string;
  length: number;
}

export default function LoginClient({ next, env }: { next: string; env: string }) {
  const [captcha, setCaptcha] = useState<Captcha | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setAnswer("");
    try {
      const r = await fetch("/api/auth/captcha", { cache: "no-store" });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setCaptcha(j);
    } catch (e) {
      setError((e as Error).message || "Gagal memuat captcha");
    }
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!captcha) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: captcha.token, answer, next }),
      });
      const j = await r.json();
      if (!j.ok) {
        setError(j.error || "Gagal masuk");
        setLoading(false);
        load();
        return;
      }
      // pertahankan #tab (mis. /#pg-custom) yang ikut ter-redirect
      window.location.href = j.next + (window.location.hash || "");
    } catch {
      setError("Koneksi bermasalah, coba lagi");
      setLoading(false);
    }
  }

  const len = captcha?.length ?? 5;

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-dana-400 to-dana-600 shadow-xl shadow-dana-500/30">
            <QrCode className="h-7 w-7 text-white" />
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-white">DANA Console</h1>
          <p className="mt-1 text-sm text-ink-400">QRIS · Payment Gateway</p>
        </div>

        <form onSubmit={submit} className="card space-y-5 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck className="h-4 w-4 text-dana-300" /> Verifikasi
            </div>
            <Badge tone={env === "production" ? "bad" : "info"} dot>
              {env}
            </Badge>
          </div>

          <div>
            <div className="flex items-stretch gap-2">
              <div className="min-w-0 flex-1 overflow-hidden rounded-xl ring-1 ring-ink-700">
                {captcha ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={captcha.image} alt="Kode captcha" className="block aspect-[3/1] h-auto w-full select-none" draggable={false} />
                ) : (
                  <div className="grid aspect-[3/1] place-items-center bg-ink-900">
                    <Loader2 className="h-5 w-5 animate-spin text-ink-400" />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={load}
                className="grid w-11 shrink-0 place-items-center rounded-xl text-ink-300 ring-1 ring-ink-700 transition hover:bg-ink-800 hover:text-white"
                aria-label="Muat ulang captcha"
                title="Muat ulang"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-xs text-ink-400">Ketik {len} angka pada gambar. Tidak terbaca? Klik ikon muat ulang.</p>
          </div>

          <input
            ref={inputRef}
            className="input text-center font-mono text-2xl tracking-[0.5em]"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            maxLength={len}
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value.replace(/\D/g, "").slice(0, len));
              setError(null);
            }}
            placeholder={"•".repeat(len)}
            aria-label="Kode captcha"
          />

          {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>}

          <button
            type="submit"
            disabled={!captcha || answer.length !== len || loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-dana-400 to-dana-600 py-3 text-sm font-semibold text-white shadow-lg shadow-dana-500/25 ring-1 ring-inset ring-white/15 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Masuk
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-ink-400">Sesi berlaku 12 jam di perangkat ini.</p>
      </div>
    </div>
  );
}
