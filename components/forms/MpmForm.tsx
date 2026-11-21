"use client";

import { Ban, QrCode, RefreshCw, Search, Undo2 } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { ApiResult, STATUS_META, postApi, rupiah } from "@/lib/client/api";
import { addHistory, updateHistory } from "@/lib/client/history";
import { AmountInput, Badge, Button, Card, CopyButton, Field, KV, QuickAmounts, ResultPanel } from "../ui";
import type { AppConfig, Navigate } from "../types";

export default function MpmForm({ config, navigate }: { config: AppConfig | null; navigate: Navigate }) {
  const [storeId, setStoreId] = useState("");
  const [amount, setAmount] = useState("");
  const [validity, setValidity] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (config?.defaultStoreId && !storeId) setStoreId(config.defaultStoreId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  useEffect(() => () => stopPolling(), []);

  const ref: string | undefined = result?.meta?.partnerReferenceNo;
  const referenceNo: string | undefined = result?.data?.referenceNo;

  function stopPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    setPolling(false);
  }

  function startPolling(r: string) {
    stopPolling();
    setPolling(true);
    const started = Date.now();
    pollRef.current = setInterval(async () => {
      if (Date.now() - started > 10 * 60_000) return stopPolling();
      try {
        const res = await fetch(`/api/qris/status?ref=${encodeURIComponent(r)}`);
        const j = await res.json();
        const st = j?.status?.status as string | undefined;
        if (st) {
          setStatus(st);
          updateHistory(r, { status: st });
          if (["00", "05", "07"].includes(st)) stopPolling();
        }
      } catch {
        /* abaikan */
      }
    }, 4000);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    stopPolling();
    setLoading(true);
    setQrSrc(null);
    setStatus(null);
    const r = await postApi("/api/qris/mpm", {
      storeId,
      amount,
      validityMinutes: validity ? Number(validity) : undefined,
    });
    setResult(r);
    setLoading(false);

    if (r.meta?.partnerReferenceNo) {
      addHistory({
        partnerReferenceNo: r.meta.partnerReferenceNo,
        referenceNo: r.data?.referenceNo,
        type: "MPM",
        amount: r.meta.amount,
        createdAt: new Date().toISOString(),
        ok: r.ok,
        responseCode: r.responseCode,
        status: r.ok ? "01" : undefined,
      });
    }
    if (r.ok) {
      const content = r.data?.qrContent as string | undefined;
      if (content) setQrSrc(await QRCode.toDataURL(content, { width: 560, margin: 1, errorCorrectionLevel: "M" }));
      else if (r.data?.qrImage) setQrSrc(String(r.data.qrImage).startsWith("data:") ? r.data.qrImage : `data:image/png;base64,${r.data.qrImage}`);
      else if (r.data?.qrUrl) setQrSrc(r.data.qrUrl);
      setStatus("01");
      startPolling(r.meta!.partnerReferenceNo);
    }
  }

  async function queryNow() {
    if (!ref) return;
    const r = await postApi("/api/qris/query", { type: "MPM", originalPartnerReferenceNo: ref });
    const st = r.data?.latestTransactionStatus;
    if (st) {
      setStatus(st);
      updateHistory(ref, { status: st });
    }
  }

  const st = status ? STATUS_META[status] : null;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Card
        icon={<QrCode className="h-5 w-5" />}
        title="QRIS MPM — Generate QR"
        subtitle="Merchant menampilkan QR, customer scan & bayar. partnerReferenceNo dibuat otomatis."
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Store ID" hint={config?.defaultStoreId ? "Default dari DANA_STORE_ID" : undefined}>
              <input className="input font-mono" value={storeId} onChange={(e) => setStoreId(e.target.value)} placeholder="storeId" />
            </Field>
            <Field label="Masa berlaku (menit)" optional hint="Dikirim sebagai validityPeriod">
              <input className="input" inputMode="numeric" value={validity} onChange={(e) => setValidity(e.target.value.replace(/\D/g, ""))} placeholder="mis. 15" />
            </Field>
          </div>
          <Field label="Amount">
            <AmountInput value={amount} onChange={setAmount} />
            <QuickAmounts onPick={setAmount} />
          </Field>
          <Button type="submit" loading={loading} className="w-full sm:w-auto">
            <QrCode className="h-4 w-4" /> Generate QRIS
          </Button>
        </form>
        <ResultPanel
          result={result}
          extra={
            result?.meta?.partnerReferenceNo ? (
              <div className="rounded-xl border border-ink-700/60 px-4 py-1">
                <KV k="partnerReferenceNo" v={result.meta.partnerReferenceNo} copy={result.meta.partnerReferenceNo} />
                <KV k="referenceNo (DANA)" v={referenceNo} copy={referenceNo} />
                <KV k="amount" v={rupiah(result.meta.amount)} mono={false} />
              </div>
            ) : null
          }
        />
      </Card>

      {/* QR preview */}
      <div className="card flex min-w-0 flex-col items-center p-5 sm:p-6">
        <div className="mb-4 flex w-full items-center justify-between">
          <span className="text-sm font-semibold text-white">Preview QRIS</span>
          {st && (
            <Badge tone={st.tone} dot>
              {st.label}
            </Badge>
          )}
        </div>
        {qrSrc ? (
          <>
            <div className={`qr-frame rounded-3xl p-4 ${status === "01" ? "pulse-ring" : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc} alt="QRIS" className="h-64 w-64 rounded-lg" />
            </div>
            <div className="mt-4 text-center">
              <div className="text-xs uppercase tracking-widest text-ink-400">Total bayar</div>
              <div className="mt-1 text-2xl font-bold text-white">{rupiah(result?.meta?.amount)}</div>
              <div className="mt-1 font-mono text-xs text-ink-400">{ref}</div>
            </div>
            {status === "00" && (
              <div className="mt-4 w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center text-sm font-semibold text-emerald-300">
                ✓ Pembayaran berhasil
              </div>
            )}
            <div className="mt-5 grid w-full grid-cols-2 gap-2">
              <Button variant="soft" onClick={queryNow}>
                <Search className="h-4 w-4" /> Cek Query
              </Button>
              <Button variant="ghost" onClick={() => (polling ? stopPolling() : ref && startPolling(ref))}>
                <RefreshCw className={`h-4 w-4 ${polling ? "animate-spin" : ""}`} /> {polling ? "Stop" : "Auto"}
              </Button>
              <Button variant="ghost" onClick={() => navigate("cancel", { ref, referenceNo, amount: result?.meta?.amount, type: "MPM" })}>
                <Ban className="h-4 w-4" /> Cancel
              </Button>
              <Button variant="ghost" onClick={() => navigate("refund", { ref, referenceNo, amount: result?.meta?.amount, type: "MPM" })}>
                <Undo2 className="h-4 w-4" /> Refund
              </Button>
            </div>
            {result?.data?.qrContent && (
              <div className="mt-3 flex w-full min-w-0 items-center justify-between gap-2 rounded-lg bg-ink-950/60 px-3 py-2">
                <span className="min-w-0 truncate font-mono text-[11px] text-ink-400">{String(result.data.qrContent).slice(0, 38)}…</span>
                <CopyButton text={String(result.data.qrContent)} label="qrContent" />
              </div>
            )}
            {polling && <p className="mt-3 text-center text-xs text-ink-400">Menunggu webhook / status setiap 4 detik…</p>}
          </>
        ) : (
          <div className="grid h-72 w-full place-items-center rounded-2xl border border-dashed border-ink-700 text-center text-sm text-ink-400">
            <div>
              <QrCode className="mx-auto mb-3 h-10 w-10 opacity-40" />
              QR akan tampil di sini
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
