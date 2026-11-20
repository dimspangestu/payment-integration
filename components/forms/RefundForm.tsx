"use client";

import { Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiResult, postApi, rupiah } from "@/lib/client/api";
import { addHistory } from "@/lib/client/history";
import { AmountInput, Button, Card, Field, KV, ResultPanel } from "../ui";
import type { Prefill } from "../types";

export default function RefundForm({ prefill }: { prefill?: Prefill }) {
  const [ref, setRef] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);

  useEffect(() => {
    if (prefill?.ref) setRef(prefill.ref);
    if (prefill?.referenceNo) setReferenceNo(prefill.referenceNo);
    if (prefill?.amount) setAmount(String(Number(prefill.amount)));
  }, [prefill]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm(`Refund ${rupiah(amount)} untuk ${ref}?`)) return;
    setLoading(true);
    const r = await postApi("/api/qris/refund", {
      originalPartnerReferenceNo: ref,
      originalReferenceNo: referenceNo || undefined,
      amount,
      reason,
    });
    setResult(r);
    setLoading(false);
    if (r.meta?.partnerRefundNo) {
      addHistory({
        partnerReferenceNo: r.meta.partnerRefundNo,
        type: "REFUND",
        amount: r.meta.amount,
        createdAt: new Date().toISOString(),
        ok: r.ok,
        responseCode: r.responseCode,
        note: `refund of ${ref}`,
      });
    }
  }

  return (
    <Card icon={<Undo2 className="h-5 w-5" />} title="Refund" subtitle="POST /v1.0/debit/refund.htm — partnerRefundNo dibuat otomatis">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="originalPartnerReferenceNo">
            <input className="input font-mono" value={ref} onChange={(e) => setRef(e.target.value.trim())} required />
          </Field>
          <Field label="originalReferenceNo (DANA)" optional>
            <input className="input font-mono" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value.trim())} />
          </Field>
          <Field label="Refund amount" hint="Bisa partial, maks sebesar nominal transaksi">
            <AmountInput value={amount} onChange={setAmount} />
          </Field>
          <Field label="Reason" optional>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Customer request" />
          </Field>
        </div>
        <Button type="submit" loading={loading}>
          <Undo2 className="h-4 w-4" /> Proses Refund
        </Button>
      </form>
      <ResultPanel
        result={result}
        extra={
          result?.meta?.partnerRefundNo ? (
            <div className="rounded-xl border border-ink-700/60 px-4 py-1">
              <KV k="partnerRefundNo" v={result.meta.partnerRefundNo} copy={result.meta.partnerRefundNo} />
              <KV k="refundNo (DANA)" v={result.data?.refundNo} copy={result.data?.refundNo} />
              <KV k="refundAmount" v={rupiah(result.meta.amount)} mono={false} />
              <KV k="refundTime" v={result.data?.refundTime} />
            </div>
          ) : null
        }
      />
    </Card>
  );
}
