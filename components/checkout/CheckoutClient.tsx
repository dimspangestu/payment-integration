"use client";

import {
  ArrowLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock,
  CreditCard,
  Download,
  ExternalLink,
  Landmark,
  Loader2,
  Lock,
  QrCode,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Store,
  Wallet,
} from "lucide-react";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GROUP_LABEL, GROUP_ORDER, MethodGroup, PayMethodOption } from "@/lib/dana/payment-gateway/methods";
import { Accordion, CopyText, MethodBadge, cx, groupDigits, idr, useCountdown } from "./parts";

export interface CheckoutOrderView {
  amount: string;
  title: string;
  goods?: { name: string; price: string; quantity: number }[];
  buyerName?: string;
}

interface OrderResult {
  ok: boolean;
  responseCode: string;
  responseMessage: string;
  partnerReferenceNo?: string;
  referenceNo?: string;
  paymentCode?: string;
  webRedirectUrl?: string;
  validUpTo?: string;
  amount?: string;
  method?: PayMethodOption;
}

const GROUP_ICON: Record<MethodGroup, React.ReactNode> = {
  wallet: <Wallet className="h-4 w-4" />,
  qris: <QrCode className="h-4 w-4" />,
  va: <Landmark className="h-4 w-4" />,
  card: <CreditCard className="h-4 w-4" />,
  other: <Store className="h-4 w-4" />,
};

const GROUP_HINT: Record<MethodGroup, string> = {
  wallet: "Bayar langsung dari aplikasi",
  qris: "Scan pakai e-wallet / m-banking apa pun",
  va: "Transfer via ATM, m-banking, atau internet banking",
  card: "Visa, Mastercard, JCB",
  other: "",
};

export default function CheckoutClient({
  token,
  order,
  merchantName,
  isSandbox,
}: {
  token: string;
  order: CheckoutOrderView;
  merchantName: string;
  isSandbox: boolean;
}) {
  const [methods, setMethods] = useState<PayMethodOption[] | null>(null);
  const [methodsError, setMethodsError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PayMethodOption | null>(null);
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OrderResult | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  useEffect(() => {
    fetch("/api/checkout/methods", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token }) })
      .then((r) => r.json())
      .then((j) => (j.ok ? setMethods(j.methods) : setMethodsError(j.error || "Metode bayar tidak tersedia")))
      .catch(() => setMethodsError("Gagal memuat metode bayar"));
  }, [token]);

  const grouped = useMemo(() => {
    const g = new Map<MethodGroup, PayMethodOption[]>();
    (methods ?? []).forEach((m) => g.set(m.group, [...(g.get(m.group) ?? []), m]));
    return GROUP_ORDER.filter((k) => g.has(k)).map((k) => ({ group: k, items: g.get(k)! }));
  }, [methods]);

  async function pay() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const r: OrderResult = await fetch("/api/checkout/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, payMethod: selected.payMethod, payOption: selected.payOption, phoneNumber: phone || undefined }),
      }).then((x) => x.json());
      if (!r.ok) {
        setError(`${r.responseMessage || "Pembayaran gagal dibuat"}${r.responseCode && !/ERROR$/.test(r.responseCode) ? ` (${r.responseCode})` : ""}`);
      } else {
        setResult(r);
        setStatus("01");
        // Saldo DANA / kartu / e-wallet → lanjut ke halaman DANA
        if (r.webRedirectUrl && !r.paymentCode) setTimeout(() => (window.location.href = r.webRedirectUrl!), 1200);
      }
    } catch {
      setError("Koneksi bermasalah, coba lagi");
    }
    setSubmitting(false);
  }

  function changeMethod() {
    setResult(null);
    setStatus(null);
    setError(null);
  }

  const paid = status === "00";

  return (
    <div className="min-h-screen bg-[#F3F6FB] text-slate-900 [font-feature-settings:'tnum']">
      {/* top bar */}
      <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 text-sm font-bold text-white shadow-md shadow-sky-500/30">
              {merchantName.slice(0, 1).toUpperCase()}
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold">{merchantName}</div>
              <div className="flex items-center gap-1 text-[11px] text-slate-500">
                <Lock className="h-3 w-3" /> Pembayaran aman
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSandbox && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">Sandbox</span>}
            <span className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex">
              <ShieldCheck className="h-4 w-4 text-sky-600" /> Diproses oleh <b className="text-sky-700">DANA</b>
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:py-10">
        {/* Ringkasan (mobile: di atas, collapsible) */}
        <aside className="min-w-0 lg:order-2">
          <div className="sticky top-6 overflow-hidden rounded-3xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_32px_-12px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/60">
            <div className="relative overflow-hidden bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-700 px-6 py-6 text-white">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -bottom-16 left-10 h-40 w-40 rounded-full bg-cyan-300/20 blur-2xl" />
              <div className="relative">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-sky-100">Total pembayaran</div>
                <div className="mt-1.5 text-3xl font-extrabold tracking-tight">{idr(order.amount)}</div>
                <div className="mt-2 flex items-center gap-1.5 text-sm text-sky-100">
                  <ShoppingBag className="h-4 w-4" /> {order.title}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSummaryOpen(!summaryOpen)}
              className="flex w-full items-center justify-between px-6 py-3 text-xs font-semibold text-slate-500 lg:hidden"
            >
              {summaryOpen ? "Sembunyikan detail" : "Lihat detail pesanan"}
              <ChevronRight className={cx("h-4 w-4 transition", summaryOpen && "rotate-90")} />
            </button>
            <div className={cx("px-6 pb-6 lg:block lg:pt-5", !summaryOpen && "hidden")}>
              {order.goods?.length ? (
                <ul className="space-y-3">
                  {order.goods.map((g, i) => (
                    <li key={i} className="flex items-start justify-between gap-3 text-sm">
                      <div>
                        <div className="font-medium text-slate-800">{g.name}</div>
                        <div className="text-xs text-slate-400">
                          {g.quantity} × {idr(g.price)}
                        </div>
                      </div>
                      <div className="font-semibold text-slate-700">{idr(Number(g.price) * g.quantity)}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-slate-500">{order.title}</div>
              )}
              <div className="mt-4 space-y-2 border-t border-dashed border-slate-200 pt-4 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Biaya layanan</span>
                  <span>Rp0</span>
                </div>
                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span>{idr(order.amount)}</span>
                </div>
              </div>
              {result?.partnerReferenceNo && (
                <div className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                  No. pesanan
                  <div className="mt-0.5 font-mono text-[13px] font-semibold text-slate-800">{result.partnerReferenceNo}</div>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Alur pembayaran */}
        <section className="min-w-0 lg:order-1">
          {paid && result ? (
            <SuccessPanel result={result} />
          ) : result ? (
            <InstructionPanel result={result} status={status} setStatus={setStatus} onChangeMethod={changeMethod} />
          ) : (
            <div className="rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_32px_-12px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/60 sm:p-7">
              <h1 className="text-xl font-bold tracking-tight">Pilih metode pembayaran</h1>
              <p className="mt-1 text-sm text-slate-500">Semua transaksi dienkripsi dan diproses oleh DANA.</p>

              {!methods && !methodsError && (
                <div className="mt-6 space-y-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-[68px] animate-pulse rounded-2xl bg-slate-100" />
                  ))}
                </div>
              )}
              {methodsError && (
                <div className="mt-6 flex items-center gap-2 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
                  <CircleAlert className="h-5 w-5" /> {methodsError}
                </div>
              )}

              <div className="mt-6 space-y-6">
                {grouped.map(({ group, items }) => (
                  <div key={group}>
                    <div className="mb-2.5 flex items-center gap-2">
                      <span className="grid h-6 w-6 place-items-center rounded-md bg-slate-100 text-slate-500">{GROUP_ICON[group]}</span>
                      <span className="text-sm font-bold text-slate-700">{GROUP_LABEL[group]}</span>
                      {GROUP_HINT[group] && <span className="hidden text-xs text-slate-400 sm:inline">· {GROUP_HINT[group]}</span>}
                    </div>
                    <div className={cx("grid gap-2.5", group === "va" && "sm:grid-cols-2")}>
                      {items.map((m) => {
                        const active = selected?.id === m.id;
                        return (
                          <div key={m.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelected(m);
                                setError(null);
                              }}
                              className={cx(
                                "group flex w-full items-center gap-3.5 rounded-2xl border bg-white p-3.5 text-left transition",
                                active
                                  ? "border-sky-500 shadow-[0_0_0_4px_rgba(14,165,233,0.12)]"
                                  : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                              )}
                            >
                              <MethodBadge short={m.short} color={m.color} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-slate-800">{m.group === "va" ? m.label.replace(/ Virtual Account$/, "") : m.label}</span>
                                <span className="block text-xs text-slate-400">
                                  {m.group === "va" ? "Virtual Account · dicek otomatis" : m.group === "qris" ? "Semua e-wallet & m-banking" : m.needsPhone ? "Butuh nomor HP" : "Instan"}
                                </span>
                              </span>
                              <span
                                className={cx(
                                  "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition",
                                  active ? "border-sky-500 bg-sky-500" : "border-slate-300"
                                )}
                              >
                                {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                              </span>
                            </button>
                            {active && m.needsPhone && (
                              <div className="mt-2 rounded-2xl bg-slate-50 p-3.5">
                                <label className="text-xs font-semibold text-slate-600">Nomor HP</label>
                                <div className="mt-1.5 flex items-center rounded-xl border border-slate-200 bg-white focus-within:border-sky-500 focus-within:ring-4 focus-within:ring-sky-500/10">
                                  <Smartphone className="ml-3 h-4 w-4 text-slate-400" />
                                  <input
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, "").slice(0, 15))}
                                    inputMode="tel"
                                    placeholder="08xxxxxxxxxx"
                                    className="w-full bg-transparent px-2.5 py-2.5 text-sm outline-none"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <div className="mt-5 flex items-start gap-2 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                </div>
              )}

              <button
                type="button"
                onClick={pay}
                disabled={!selected || submitting || (selected.needsPhone && phone.length < 8)}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-sky-500 to-blue-600 py-4 text-base font-bold text-white shadow-lg shadow-sky-600/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-4 w-4" />}
                {selected ? `Bayar ${idr(order.amount)}` : "Pilih metode pembayaran"}
              </button>
              <p className="mt-3 text-center text-[11px] text-slate-400">Dengan melanjutkan, kamu menyetujui syarat & ketentuan {merchantName}.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function InstructionPanel({
  result,
  status,
  setStatus,
  onChangeMethod,
}: {
  result: OrderResult;
  status: string | null;
  setStatus: (s: string) => void;
  onChangeMethod: () => void;
}) {
  const m = result.method!;
  const countdown = useCountdown(result.validUpTo);
  const [qr, setQr] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const tick = useRef(0);
  const isQris = m.group === "qris";
  const isVa = m.group === "va";
  const isRedirect = !result.paymentCode && Boolean(result.webRedirectUrl);

  useEffect(() => {
    if (isQris && result.paymentCode) QRCode.toDataURL(result.paymentCode, { width: 640, margin: 1 }).then(setQr).catch(() => setQr(null));
  }, [isQris, result.paymentCode]);

  const poll = useCallback(
    async (forceQuery = false) => {
      if (!result.partnerReferenceNo) return;
      tick.current += 1;
      const q = forceQuery || tick.current % 3 === 0 ? "&query=1" : "";
      try {
        const j = await fetch(`/api/checkout/status?ref=${result.partnerReferenceNo}${q}`).then((r) => r.json());
        if (j.status) setStatus(j.status);
      } catch {
        /* abaikan */
      }
    },
    [result.partnerReferenceNo, setStatus]
  );

  useEffect(() => {
    if (countdown.expired) return;
    const t = setInterval(() => poll(), 4000);
    return () => clearInterval(t);
  }, [poll, countdown.expired]);

  const failed = status === "05" || status === "06";

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_32px_-12px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/60">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-7">
        <button type="button" onClick={onChangeMethod} className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Ganti metode
        </button>
        {result.validUpTo && !countdown.expired && (
          <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
            <Clock className="h-3.5 w-3.5" /> Bayar dalam {countdown.text}
          </span>
        )}
      </div>

      <div className="p-5 sm:p-7">
        <div className="flex items-center gap-3">
          <MethodBadge short={m.short} color={m.color} size="lg" />
          <div>
            <div className="text-lg font-bold">{m.label}</div>
            <div className="text-sm text-slate-500">
              Total <b className="text-slate-800">{idr(result.amount)}</b>
            </div>
          </div>
        </div>

        {countdown.expired || failed ? (
          <div className="mt-6 rounded-2xl bg-rose-50 p-5 text-center">
            <CircleAlert className="mx-auto h-8 w-8 text-rose-500" />
            <div className="mt-2 font-bold text-rose-700">{failed ? "Pembayaran dibatalkan / gagal" : "Waktu pembayaran habis"}</div>
            <button type="button" onClick={onChangeMethod} className="mt-4 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-rose-700">
              Buat pembayaran baru
            </button>
          </div>
        ) : isVa && result.paymentCode ? (
          <>
            <div className="mt-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Nomor Virtual Account</div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <div className="font-mono text-2xl font-bold tracking-wider text-slate-900 sm:text-[28px]">{groupDigits(result.paymentCode)}</div>
                <CopyText text={result.paymentCode} />
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-slate-200 pt-4">
                <div>
                  <div className="text-xs text-slate-400">Jumlah transfer (harus sama persis)</div>
                  <div className="text-lg font-bold">{idr(result.amount)}</div>
                </div>
                <CopyText text={String(Math.round(Number(result.amount)))} label="Salin jumlah" />
              </div>
            </div>
            <div className="mt-6">
              <div className="mb-1 text-sm font-bold">Cara bayar</div>
              <Accordion title="ATM" defaultOpen>
                <ol className="list-decimal space-y-1 pl-5">
                  <li>Masukkan kartu ATM dan PIN.</li>
                  <li>Pilih <b>Transfer</b> → <b>Virtual Account</b>.</li>
                  <li>Masukkan nomor VA <b className="font-mono">{result.paymentCode}</b>.</li>
                  <li>Periksa nama & nominal, lalu konfirmasi.</li>
                </ol>
              </Accordion>
              <Accordion title="Mobile banking">
                <ol className="list-decimal space-y-1 pl-5">
                  <li>Buka aplikasi m-banking dan login.</li>
                  <li>Pilih menu <b>Transfer / Bayar</b> → <b>Virtual Account</b>.</li>
                  <li>Tempel nomor VA, lalu ikuti instruksi hingga selesai.</li>
                </ol>
              </Accordion>
              <Accordion title="Internet banking">
                <ol className="list-decimal space-y-1 pl-5">
                  <li>Login ke internet banking.</li>
                  <li>Pilih <b>Transfer</b> → <b>Virtual Account</b>, masukkan nomor VA.</li>
                  <li>Konfirmasi dengan token / OTP.</li>
                </ol>
              </Accordion>
            </div>
          </>
        ) : isQris && result.paymentCode ? (
          <div className="mt-6 flex flex-col items-center">
            <div className="rounded-3xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 p-[3px] shadow-xl shadow-sky-600/20">
              <div className="rounded-[22px] bg-white p-4">
                <div className="mb-2 text-center text-xs font-extrabold tracking-[0.3em] text-slate-800">QRIS</div>
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr} alt="QRIS" className="h-60 w-60 sm:h-64 sm:w-64" />
                ) : (
                  <div className="grid h-60 w-60 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
                )}
              </div>
            </div>
            <p className="mt-4 max-w-xs text-center text-sm text-slate-500">
              Scan dengan aplikasi <b>DANA</b>, e-wallet, atau m-banking yang mendukung QRIS.
            </p>
            {qr && (
              <a href={qr} download={`QRIS-${result.partnerReferenceNo}.png`} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                <Download className="h-3.5 w-3.5" /> Unduh QR
              </a>
            )}
          </div>
        ) : isRedirect ? (
          <div className="mt-6 rounded-2xl bg-sky-50 p-6 text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-sky-600" />
            <div className="mt-3 font-bold text-slate-800">Mengarahkan ke halaman DANA…</div>
            <p className="mt-1 text-sm text-slate-500">Selesaikan pembayaran di halaman berikutnya.</p>
            <a href={result.webRedirectUrl} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-sky-700">
              Lanjutkan <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
            Order dibuat. Kode pembayaran: <span className="font-mono font-semibold">{result.paymentCode ?? "-"}</span>
          </div>
        )}

        {!countdown.expired && !failed && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3">
            <div className="flex items-center gap-2.5 text-sm text-slate-600">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" />
              </span>
              Menunggu pembayaran… status diperbarui otomatis
            </div>
            <button
              type="button"
              onClick={async () => {
                setChecking(true);
                await poll(true);
                setChecking(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              {checking && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Cek status
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SuccessPanel({ result }: { result: OrderResult }) {
  return (
    <div className="overflow-hidden rounded-3xl bg-white text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_32px_-12px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/60">
      <div className="bg-gradient-to-b from-emerald-50 to-white px-6 pb-2 pt-10">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-500 shadow-xl shadow-emerald-500/30 [animation:pop_.5s_ease-out]">
          <CircleCheck className="h-11 w-11 text-white" />
        </div>
        <h2 className="mt-5 text-2xl font-extrabold tracking-tight">Pembayaran berhasil</h2>
        <p className="mt-1 text-sm text-slate-500">Terima kasih! Pesananmu sudah kami terima.</p>
      </div>
      <div className="mx-auto max-w-sm px-6 pb-8 pt-4">
        <div className="space-y-2.5 rounded-2xl bg-slate-50 p-4 text-left text-sm">
          <Row k="Jumlah" v={idr(result.amount)} bold />
          <Row k="Metode" v={result.method?.label} />
          <Row k="No. pesanan" v={result.partnerReferenceNo} mono />
          {result.referenceNo && <Row k="Ref. DANA" v={result.referenceNo} mono />}
        </div>
      </div>
      <style>{`@keyframes pop{0%{transform:scale(.4);opacity:0}70%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}`}</style>
    </div>
  );
}

function Row({ k, v, mono, bold }: { k: string; v?: string; mono?: boolean; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{k}</span>
      <span className={cx("truncate text-right text-slate-800", mono && "font-mono text-xs", bold && "font-bold")}>{v ?? "—"}</span>
    </div>
  );
}
