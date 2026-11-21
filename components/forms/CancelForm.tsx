"use client";

import { Ban } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiResult, postApi } from "@/lib/client/api";
import { updateHistory } from "@/lib/client/history";
import { AmountInput, Button, Card, Field, ResultPanel } from "../ui";
import type { Prefill } from "../types";

export default function CancelForm({ prefill }: { prefill?: Prefill }) {
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
    if (!confirm(`Cancel transaksi ${ref}?`)) return;
    setLoading(true);
    const r = await postApi("/api/qris/cancel", {
      originalPartnerReferenceNo: ref,
      originalReferenceNo: referenceNo || undefined,
      amount: amount || undefined,
      reason,
    });
    setResult(r);
    setLoading(false);
    if (r.ok) updateHistory(ref, { status: "05" });
  }

  return (
    <Card icon={<Ban className="h-5 w-5" />} title="Cancel Transaksi" subtitle="POST /v1.0/debit/cancel.htm — untuk transaksi yang belum dibayar / perlu dibatalkan">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="originalPartnerReferenceNo">
            <input className="input font-mono" value={ref} onChange={(e) => setRef(e.target.value.trim())} required />
          </Field>
          <Field label="originalReferenceNo (DANA)" optional>
            <input className="input font-mono" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value.trim())} />
          </Field>
          <Field label="Amount" optional>
            <AmountInput value={amount} onChange={setAmount} placeholder="kosongkan jika tidak perlu" />
          </Field>
          <Field label="Reason" optional>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Customer cancelled" />
          </Field>
        </div>
        <Button type="submit" variant="danger" loading={loading}>
          <Ban className="h-4 w-4" /> Cancel Transaksi
        </Button>
      </form>
      <ResultPanel result={result} />
    </Card>
  );
}
