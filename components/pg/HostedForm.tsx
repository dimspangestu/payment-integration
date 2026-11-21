"use client";

import { ExternalLink, Globe, Search } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { ApiResult, postApi, rupiah } from "@/lib/client/api";
import { addHistory } from "@/lib/client/history";
import { AmountInput, Button, Card, CopyButton, Field, KV, QuickAmounts, ResultPanel, cn } from "../ui";
import ItemsEditor, { ItemRow, itemsTotal } from "./ItemsEditor";
import type { AppConfig, Navigate } from "../types";

const DISABLE_OPTIONS = [
  { v: "BALANCE", l: "Saldo DANA" },
  { v: "VIRTUAL_ACCOUNT", l: "Virtual Account" },
  { v: "NETWORK_PAY", l: "QRIS / E-wallet lain" },
  { v: "CREDIT_CARD", l: "Kartu kredit" },
  { v: "DEBIT_CARD", l: "Kartu debit" },
];

export default function HostedForm({ config, navigate }: { config: AppConfig | null; navigate: Navigate }) {
  const [title, setTitle] = useState("Pembayaran pesanan");
  const [amount, setAmount] = useState("");
  const [items, setItems] = useState<ItemRow[]>([]);
  const [validMinutes, setValidMinutes] = useState("15");
  const [storeId, setStoreId] = useState("");
  useEffect(() => {
    if (config?.defaultExternalStoreId && !storeId) setStoreId(config.defaultExternalStoreId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);
  const [disabled, setDisabled] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  const total = items.length ? itemsTotal(items) : Number(amount || 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setQr(null);
    const r = await postApi("/api/pg/hosted", {
      orderTitle: title,
      amount: String(total),
      goods: items.filter((i) => i.name && i.price),
      validMinutes,
      disabledPayMethods: disabled.join(",") || undefined,
      externalStoreId: storeId || undefined,
    });
    setResult(r);
    setLoading(false);
    if (r.meta?.partnerReferenceNo) {
      addHistory({
        partnerReferenceNo: r.meta.partnerReferenceNo,
        referenceNo: r.data?.referenceNo,
        type: "PG",
        amount: r.meta.amount,
        createdAt: new Date().toISOString(),
        ok: r.ok,
        responseCode: r.responseCode,
        status: r.ok ? "01" : undefined,
        note: "Hosted",
      });
    }
    const url = r.data?.webRedirectUrl as string | undefined;
    if (r.ok && url) setQr(await QRCode.toDataURL(url, { width: 360, margin: 1 }));
  }

  const url = result?.data?.webRedirectUrl as string | undefined;
  const ref = result?.meta?.partnerReferenceNo as string | undefined;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card icon={<Globe className="h-5 w-5" />} title="Hosted Checkout" subtitle="Order dibuat via API, customer membayar di halaman DANA (scenario REDIRECT). Paling cepat diintegrasikan.">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Store ID (externalStoreId)" hint={storeId ? "Wajib untuk QRIS — terdaftar di DANA (Create Shop)" : "Kosong → QRIS tidak bisa dipakai di halaman DANA"}>
            <input className="input font-mono" value={storeId} onChange={(e) => setStoreId(e.target.value.trim())} placeholder="mis. coba_testing" maxLength={64} />
          </Field>
          <Field label="Judul order">
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={64} required />
          </Field>
          <Field label="Item" optional hint="Kalau diisi, total dihitung dari item">
            <ItemsEditor items={items} onChange={setItems} />
          </Field>
          {items.length === 0 && (
            <Field label="Amount">
              <AmountInput value={amount} onChange={setAmount} />
              <QuickAmounts onPick={setAmount} />
            </Field>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Berlaku (menit)" hint="Sandbox maks 25 menit (batas DANA 30)">
              <input className="input" inputMode="numeric" value={validMinutes} onChange={(e) => setValidMinutes(e.target.value.replace(/\D/g, ""))} />
            </Field>
            <Field label="Sembunyikan metode" optional>
              <div className="flex flex-wrap gap-1.5">
                {DISABLE_OPTIONS.map((o) => {
                  const on = disabled.includes(o.v);
                  return (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setDisabled(on ? disabled.filter((d) => d !== o.v) : [...disabled, o.v])}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-xs transition",
                        on ? "border-rose-400/40 bg-rose-500/10 text-rose-300 line-through" : "border-ink-700 text-ink-300 hover:text-white"
                      )}
                    >
                      {o.l}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
          <Button type="submit" loading={loading} disabled={!total}>
            <Globe className="h-4 w-4" /> Buat order {total ? `· ${rupiah(total)}` : ""}
          </Button>
        </form>
        <ResultPanel
          result={result}
          extra={
            ref ? (
              <div className="rounded-xl border border-ink-700/60 px-4 py-1">
                <KV k="partnerReferenceNo" v={ref} copy={ref} />
                <KV k="referenceNo (DANA)" v={result?.data?.referenceNo} copy={result?.data?.referenceNo} />
                <KV k="validUpTo" v={result?.meta?.validUpTo} />
                <div className="py-3">
                  <Button variant="soft" type="button" onClick={() => navigate("pg-ops", { ref, referenceNo: result?.data?.referenceNo, amount: result?.meta?.amount })}>
                    <Search className="h-4 w-4" /> Query / Cancel / Refund
                  </Button>
                </div>
              </div>
            ) : null
          }
        />
      </Card>

      <div className="card flex min-w-0 flex-col items-center p-5 text-center sm:p-6">
        <div className="mb-4 w-full text-left text-sm font-semibold text-white">Link pembayaran</div>
        {url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr && <img src={qr} alt="QR link" className="h-52 w-52 rounded-2xl bg-white p-3" />}
            <p className="mt-3 text-xs text-ink-400">Scan dari HP untuk membuka halaman pembayaran DANA</p>
            <div className="mt-4 text-2xl font-bold text-white">{rupiah(result?.meta?.amount)}</div>
            <div className="mt-4 grid w-full min-w-0 grid-cols-1 gap-2">
              <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-dana-400 to-dana-600 px-4 py-2.5 text-sm font-semibold text-white">
                Buka halaman DANA <ExternalLink className="h-4 w-4" />
              </a>
              <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-ink-950/60 px-3 py-2">
                <span className="min-w-0 truncate font-mono text-[11px] text-ink-400">{url}</span>
                <CopyButton text={url} />
              </div>
            </div>
          </>
        ) : (
          <div className="grid h-64 w-full place-items-center rounded-2xl border border-dashed border-ink-700 text-sm text-ink-400">
            <div>
              <Globe className="mx-auto mb-3 h-10 w-10 opacity-40" />
              webRedirectUrl akan tampil di sini
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
