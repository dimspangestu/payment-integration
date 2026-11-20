"use client";

import { ScanLine, Search, Undo2 } from "lucide-react";
import { useState } from "react";
import { ApiResult, postApi, rupiah } from "@/lib/client/api";
import { addHistory } from "@/lib/client/history";
import { AmountInput, Button, Card, Field, KV, QuickAmounts, ResultPanel } from "../ui";
import type { AppConfig, Navigate } from "../types";

export default function CpmForm({ config, navigate }: { config: AppConfig | null; navigate: Navigate }) {
  const [qrContent, setQrContent] = useState("");
  const [amount, setAmount] = useState("");
  const [qrContentType, setQrContentType] = useState("BAR_CODE");
  const [externalStoreId, setExternalStoreId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const r = await postApi("/api/qris/cpm", { qrContent, amount, qrContentType, externalStoreId: externalStoreId || undefined });
    setResult(r);
    setLoading(false);
    if (r.meta?.partnerReferenceNo) {
      addHistory({
        partnerReferenceNo: r.meta.partnerReferenceNo,
        referenceNo: r.data?.referenceNo,
        type: "CPM",
        amount: r.meta.amount,
        createdAt: new Date().toISOString(),
        ok: r.ok,
        responseCode: r.responseCode,
        status: r.ok ? "00" : undefined,
      });
    }
  }

  const ref = result?.meta?.partnerReferenceNo as string | undefined;
  const referenceNo = result?.data?.referenceNo as string | undefined;

  return (
    <Card
      icon={<ScanLine className="h-5 w-5" />}
      title="QRIS CPM — Scan QR Customer"
      subtitle="Tempel qrContent dari aplikasi customer (hasil scan), isi amount, lalu bayar."
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="qrContent" hint="String hasil scan QR/barcode dari aplikasi DANA customer">
          <textarea
            className="input min-h-28 resize-y font-mono text-[13px]"
            value={qrContent}
            onChange={(e) => setQrContent(e.target.value.trim())}
            placeholder="hQVDUFYwMWFaTwegAAAGAiAgUAdRUklT..."
          />
        </Field>
        <div className="grid gap-4 md:grid-cols-[1fr_180px]">
          <Field label="Amount">
            <AmountInput value={amount} onChange={setAmount} />
            <QuickAmounts onPick={setAmount} />
          </Field>
          <Field label="qrContentType">
            <select className="input" value={qrContentType} onChange={(e) => setQrContentType(e.target.value)}>
              <option value="BAR_CODE">BAR_CODE</option>
              <option value="QR_CODE">QR_CODE</option>
            </select>
          </Field>
        </div>
        <Field label="External Store ID" optional hint={`Default: ${config?.defaultExternalStoreId || "DANA_EXTERNAL_STORE_ID belum di-set"}`}>
          <input className="input font-mono" value={externalStoreId} onChange={(e) => setExternalStoreId(e.target.value)} placeholder={config?.defaultExternalStoreId || "externalStoreId"} />
        </Field>
        <Button type="submit" loading={loading}>
          <ScanLine className="h-4 w-4" /> Proses Pembayaran CPM
        </Button>
      </form>
      <ResultPanel
        result={result}
        extra={
          ref ? (
            <div className="rounded-xl border border-ink-700/60 px-4 py-1">
              <KV k="partnerReferenceNo" v={ref} copy={ref} />
              <KV k="referenceNo (DANA)" v={referenceNo} copy={referenceNo} />
              <KV k="amount" v={rupiah(result?.meta?.amount)} mono={false} />
              <KV k="paidTime" v={result?.data?.additionalInfo?.paidTime} />
              <div className="flex gap-2 py-3">
                <Button variant="soft" type="button" onClick={() => navigate("query", { ref, referenceNo, type: "CPM" })}>
                  <Search className="h-4 w-4" /> Query
                </Button>
                <Button variant="ghost" type="button" onClick={() => navigate("refund", { ref, referenceNo, amount: result?.meta?.amount, type: "CPM" })}>
                  <Undo2 className="h-4 w-4" /> Refund
                </Button>
              </div>
            </div>
          ) : null
        }
      />
    </Card>
  );
}
