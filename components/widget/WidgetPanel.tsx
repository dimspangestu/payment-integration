"use client";

import { ExternalLink, Link2, Link2Off, RefreshCw, ShieldCheck, User, Wallet, Zap } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { ApiResult, postApi, rupiah } from "@/lib/client/api";
import { addHistory } from "@/lib/client/history";
import { WidgetSession, getWidgetSession, onWidgetSessionChange, saveOauthState, setWidgetSession } from "@/lib/client/widget-session";
import PgOps from "../pg/PgOps";
import { AmountInput, Badge, Button, Card, CopyButton, Field, KV, QuickAmounts, ResultPanel } from "../ui";
import type { AppConfig, Prefill } from "../types";

function fmtTime(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString("id-ID");
}

export default function WidgetPanel({ config, prefill }: { config: AppConfig | null; prefill?: Prefill }) {
  const [session, setSession] = useState<WidgetSession | null>(null);
  const [mobile, setMobile] = useState("");
  const [busy, setBusy] = useState<"" | "bind" | "balance" | "profile" | "refresh" | "unbind" | "pay">("");
  const [accountResult, setAccountResult] = useState<ApiResult | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [inspect, setInspect] = useState<{ url: string; state: string; params: Record<string, string> } | null>(null);

  const [title, setTitle] = useState("Pembayaran via DANA Widget");
  const [amount, setAmount] = useState("");
  const [payResult, setPayResult] = useState<ApiResult | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    setSession(getWidgetSession());
    return onWidgetSessionChange(() => setSession(getWidgetSession()));
  }, []);

  const mod = config?.modules?.WIDGET;

  async function bind() {
    setBusy("bind");
    const r = (await postApi("/api/widget/oauth-url", { mobile: mobile || undefined })) as ApiResult & {
      url?: string;
      state?: string;
      inspect?: Record<string, string>;
    };
    if (r.ok && r.url) {
      saveOauthState(r.state ?? "");
      if (r.inspect) {
        // DANA_DEBUG=true: tampilkan parameter dulu, user klik "Lanjut ke DANA"
        setInspect({ url: r.url, state: r.state ?? "", params: r.inspect });
        setBusy("");
        return;
      }
      window.location.href = r.url;
      return;
    }
    setAccountResult(r);
    setBusy("");
  }

  async function call(kind: "balance" | "profile" | "refresh" | "unbind") {
    if (!session) return;
    if (kind === "unbind" && !confirm("Putuskan hubungan akun DANA ini?")) return;
    setBusy(kind);
    let r: ApiResult;
    if (kind === "refresh") {
      r = await postApi("/api/widget/token", { refreshToken: session.refreshToken });
      if (r.ok && r.data?.accessToken) {
        setWidgetSession({
          ...session,
          accessToken: r.data.accessToken,
          refreshToken: r.data.refreshToken ?? session.refreshToken,
          accessTokenExpiryTime: r.data.accessTokenExpiryTime,
          refreshTokenExpiryTime: r.data.refreshTokenExpiryTime ?? session.refreshTokenExpiryTime,
        });
      }
    } else {
      r = await postApi(`/api/widget/${kind === "unbind" ? "unbinding" : kind}`, { accessToken: session.accessToken });
      if (kind === "balance" && r.ok) {
        const info = r.data?.accountInfos?.[0];
        setBalance(info?.availableBalance?.value ?? info?.amount?.value ?? null);
      }
      if (kind === "unbind" && r.ok) {
        setWidgetSession(null);
        setBalance(null);
      }
    }
    setAccountResult(r);
    setBusy("");
  }

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setBusy("pay");
    setQr(null);
    const r = await postApi("/api/widget/payment", { amount, orderTitle: title, accessToken: session?.accessToken });
    setPayResult(r);
    setBusy("");
    const url = r.meta?.paymentUrl as string | undefined;
    if (url) setQr(await QRCode.toDataURL(url, { width: 360, margin: 1 }));
    if (r.meta?.partnerReferenceNo) {
      addHistory({
        partnerReferenceNo: r.meta.partnerReferenceNo,
        referenceNo: r.data?.referenceNo,
        type: "WIDGET",
        amount: r.meta.amount,
        createdAt: new Date().toISOString(),
        ok: r.ok,
        responseCode: r.responseCode,
        status: r.ok ? "01" : undefined,
        note: session ? "dengan OTT" : "tanpa binding",
      });
    }
  }

  const paymentUrl = payResult?.meta?.paymentUrl as string | undefined;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Akun / binding */}
        <Card
          icon={<Link2 className="h-5 w-5" />}
          title="Akun DANA (binding)"
          subtitle="OAuth → Apply Token. Setelah terhubung: saldo, profil, dan pembayaran tanpa login ulang (OTT)."
          actions={session ? <Badge tone="ok" dot>Terhubung</Badge> : <Badge>Belum</Badge>}
        >
          {session ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-ink-700/60 px-4 py-1">
                <KV k="publicUserId" v={session.publicUserId} copy={session.publicUserId} />
                <KV k="accessToken" v={`${session.accessToken.slice(0, 10)}…`} />
                <KV k="Berlaku sampai" v={fmtTime(session.accessTokenExpiryTime)} mono={false} />
                <KV k="Terhubung" v={fmtTime(session.boundAt)} mono={false} />
              </div>

              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-dana-500 to-indigo-600 p-5">
                <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10 blur-xl" />
                <div className="relative flex items-end justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-sky-100">Saldo DANA</div>
                    <div className="mt-1 text-2xl font-bold text-white">{balance ? rupiah(balance) : "••••••"}</div>
                  </div>
                  <button onClick={() => call("balance")} className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25">
                    <Wallet className="h-3.5 w-3.5" /> {busy === "balance" ? "Memuat…" : "Cek saldo"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Button variant="ghost" onClick={() => call("profile")} loading={busy === "profile"} title={mod?.clientSecret ? "" : "Butuh DANA_CLIENT_SECRET"}>
                  <User className="h-4 w-4" /> Profil
                </Button>
                <Button variant="ghost" onClick={() => call("refresh")} loading={busy === "refresh"} disabled={!session.refreshToken}>
                  <RefreshCw className="h-4 w-4" /> Refresh
                </Button>
                <Button variant="ghost" onClick={() => call("unbind")} loading={busy === "unbind"}>
                  <Link2Off className="h-4 w-4" /> Putuskan
                </Button>
              </div>
              {!mod?.clientSecret && <p className="text-xs text-ink-400">Profil (Open API) butuh env DANA_CLIENT_SECRET.</p>}
              <button onClick={() => (setWidgetSession(null), setBalance(null))} className="text-xs text-ink-400 underline-offset-2 hover:text-white hover:underline">
                Hapus sesi dari browser ini saja
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <ol className="space-y-2 text-sm text-ink-300">
                <li className="flex gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-dana-500/20 text-[11px] font-bold text-dana-300">1</span>
                  <span>Klik hubungkan → login & izinkan di halaman DANA</span>
                </li>
                <li className="flex gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-dana-500/20 text-[11px] font-bold text-dana-300">2</span>
                  <span>
                    DANA kembali ke <code className="font-mono text-xs text-white">/widget/callback</code> dengan authCode
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-dana-500/20 text-[11px] font-bold text-dana-300">3</span>
                  <span>authCode ditukar access token otomatis</span>
                </li>
              </ol>
              <Field label="Nomor HP" optional hint="Prefill di halaman login DANA (seamlessData)">
                <input className="input font-mono" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="0811742234" />
              </Field>
              <Button onClick={bind} loading={busy === "bind"} className="w-full sm:w-auto">
                <Link2 className="h-4 w-4" /> Hubungkan akun DANA
              </Button>
              {inspect && (
                <div className="space-y-3 rounded-xl border border-amber-400/25 bg-amber-500/5 p-4">
                  <div className="text-sm font-semibold text-amber-200">Periksa URL OAuth (DANA_DEBUG)</div>
                  <p className="text-xs text-ink-300">
                    Pastikan <b>redirectUrl</b> sama persis dengan Redirect URL di dashboard DANA, dan <b>partnerId</b>/<b>merchantId</b> milik client yang mengaktifkan
                    produk Widget.
                  </p>
                  <div className="overflow-hidden rounded-lg border border-ink-700/60">
                    {Object.entries(inspect.params)
                      .filter(([, v]) => v !== undefined)
                      .map(([k, v]) => (
                        <div key={k} className="grid grid-cols-[110px_minmax(0,1fr)] gap-2 border-b border-ink-700/50 px-3 py-1.5 text-xs last:border-0">
                          <span className="text-ink-400">{k}</span>
                          <span className="break-all font-mono text-white">{String(v)}</span>
                        </div>
                      ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => (window.location.href = inspect.url)}>
                      <ExternalLink className="h-4 w-4" /> Lanjut ke DANA
                    </Button>
                    <span className="inline-flex items-center rounded-xl ring-1 ring-ink-700">
                      <CopyButton text={inspect.url} label="Salin URL" />
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
          {accountResult && <ResultPanel result={accountResult} />}
        </Card>

        {/* Payment */}
        <Card icon={<Zap className="h-5 w-5" />} title="Widget Payment" subtitle={session ? "Akun terhubung → link bayar dilengkapi OTT (tanpa login ulang)" : "Tanpa binding → user login di halaman DANA"}>
          <form onSubmit={pay} className="space-y-4">
            <Field label="Judul order">
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={64} required />
            </Field>
            <Field label="Amount">
              <AmountInput value={amount} onChange={setAmount} />
              <QuickAmounts onPick={setAmount} />
            </Field>
            <Button type="submit" loading={busy === "pay"} disabled={!amount}>
              <Zap className="h-4 w-4" /> Buat pembayaran
            </Button>
          </form>

          {paymentUrl && (
            <div className="mt-5 grid grid-cols-1 gap-4 rounded-xl border border-ink-700/60 p-4 sm:grid-cols-[auto_1fr]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {qr && <img src={qr} alt="QR link pembayaran" className="mx-auto h-32 w-32 rounded-xl bg-white p-2 sm:mx-0" />}
              <div className="min-w-0 space-y-2">
                <div className="text-lg font-bold text-white">{rupiah(payResult?.meta?.amount)}</div>
                <div className="flex flex-wrap items-center gap-2">
                  {payResult?.meta?.ottStatus === "OK" ? (
                    <Badge tone="ok" dot>
                      <ShieldCheck className="h-3 w-3" /> OTT aktif
                    </Badge>
                  ) : payResult?.meta?.ottStatus ? (
                    <Badge tone="warn">OTT gagal: {payResult.meta.ottStatus}</Badge>
                  ) : (
                    <Badge>Tanpa OTT</Badge>
                  )}
                </div>
                <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-ink-950/60 px-3 py-2">
                  <span className="min-w-0 truncate font-mono text-[11px] text-ink-400">{paymentUrl}</span>
                  <CopyButton text={paymentUrl} />
                </div>
                <a href={paymentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-dana-400 to-dana-600 px-4 py-2 text-sm font-semibold text-white">
                  Buka halaman bayar <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          )}
          <ResultPanel
            result={payResult}
            extra={
              payResult?.meta?.partnerReferenceNo ? (
                <div className="rounded-xl border border-ink-700/60 px-4 py-1">
                  <KV k="partnerReferenceNo" v={payResult.meta.partnerReferenceNo} copy={payResult.meta.partnerReferenceNo} />
                  <KV k="referenceNo (DANA)" v={payResult.data?.referenceNo} copy={payResult.data?.referenceNo} />
                  <KV k="validUpTo" v={payResult.meta.validUpTo} />
                </div>
              ) : null
            }
          />
        </Card>
      </div>

      <PgOps api="widget" prefill={prefill ?? (payResult?.meta?.partnerReferenceNo ? { ref: payResult.meta.partnerReferenceNo, referenceNo: payResult.data?.referenceNo, amount: payResult.meta.amount } : undefined)} />
    </div>
  );
}
