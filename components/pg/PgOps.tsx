"use client";

import { Ban, Search, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiResult, postApi, rupiah } from "@/lib/client/api";
import { addHistory, updateHistory } from "@/lib/client/history";
import { PG_STATUS } from "@/lib/dana/payment-gateway/methods";
import { AmountInput, Badge, Button, Card, Field, KV, ResultPanel, cn } from "../ui";
import type { Prefill } from "../types";

type Op = "query" | "cancel" | "refund";

export default function PgOps({ prefill }: { prefill?: Prefill }) {
  const [op, setOp] = useState<Op>("query");
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
    if (op !== "query" && !confirm(`${op === "cancel" ? "Cancel" : `Refund ${rupiah(amount)}`} untuk ${ref}?`)) return;
    setLoading(true);
    const base = { originalPartnerReferenceNo: ref, originalReferenceNo: referenceNo || undefined };
    const r =
      op === "query"
        ? await postApi("/api/pg/query", base)
        : op === "cancel"
          ? await postApi("/api/pg/cancel", { ...base, reason })
          : await postApi("/api/pg/refund", { ...base, amount, reason });
    setResult(r);
    setLoading(false);
    if (op === "query" && r.ok && r.data?.latestTransactionStatus) updateHistory(ref, { status: r.data.latestTransactionStatus });
    if (op === "cancel" && r.ok) updateHistory(ref, { status: "05" });
    if (op === "refund" && r.meta?.partnerRefundNo) {
      addHistory({
        partnerReferenceNo: r.meta.partnerRefundNo,
        type: "REFUND",
        amount: r.meta.amount,
        createdAt: new Date().toISOString(),
        ok: r.ok,
        responseCode: r.responseCode,
        note: `refund PG ${ref}`,
      });
    }
  }

  const st = result?.data?.latestTransactionStatus ? PG_STATUS[result.data.latestTransactionStatus] : null;
  const va = result?.data?.additionalInfo?.virtualAccountInfo;

  const TABS: { k: Op; l: string; icon: React.ReactNode }[] = [
    { k: "query", l: "Query", icon: <Search className="h-4 w-4" /> },
    { k: "cancel", l: "Cancel", icon: <Ban className="h-4 w-4" /> },
    { k: "refund", l: "Refund", icon: <Undo2 className="h-4 w-4" /> },
  ];

  return (
    <Card icon={<Search className="h-5 w-5" />} title="Payment Gateway · Query / Cancel / Refund" subtitle="serviceCode 54 · berlaku untuk order Hosted maupun Custom">
      <div className="mb-5 inline-flex rounded-xl border border-ink-700 bg-ink-950/50 p-1">
        {TABS.map((t) => (
          <button
            key={t.k}
            type="button"
            onClick={() => {
              setOp(t.k);
              setResult(null);
            }}
            className={cn("inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition", op === t.k ? "bg-dana-500 text-white" : "text-ink-400 hover:text-white")}
          >
            {t.icon} {t.l}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="originalPartnerReferenceNo">
            <input className="input font-mono" value={ref} onChange={(e) => setRef(e.target.value.trim())} required />
          </Field>
          <Field label="originalReferenceNo (DANA)" optional>
            <input className="input font-mono" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value.trim())} />
          </Field>
          {op === "refund" && (
            <Field label="Refund amount">
              <AmountInput value={amount} onChange={setAmount} />
            </Field>
          )}
          {op !== "query" && (
            <Field label="Reason" optional>
              <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          )}
        </div>
        <Button type="submit" loading={loading} variant={op === "cancel" ? "danger" : "primary"}>
          {TABS.find((t) => t.k === op)!.icon} {op === "query" ? "Cek status" : op === "cancel" ? "Cancel order" : "Proses refund"}
        </Button>
      </form>
      <ResultPanel
        result={result}
        extra={
          result?.ok && op === "query" ? (
            <div className="rounded-xl border border-ink-700/60 px-4 py-1">
              <KV k="latestTransactionStatus" v={st ? <Badge tone={st.tone} dot>{result.data?.latestTransactionStatus} · {st.label}</Badge> : result.data?.latestTransactionStatus} mono={false} />
              <KV k="amount" v={result.data?.amount?.value ? rupiah(result.data.amount.value) : undefined} mono={false} />
              <KV k="paidTime" v={result.data?.paidTime} />
              {va?.virtualAccountCode && <KV k="VA" v={va.virtualAccountCode} copy={va.virtualAccountCode} />}
              <KV k="payMethod" v={result.data?.additionalInfo?.paymentViews?.[0]?.payOptionInfos?.[0]?.payMethod} />
            </div>
          ) : result?.ok && op === "refund" ? (
            <div className="rounded-xl border border-ink-700/60 px-4 py-1">
              <KV k="partnerRefundNo" v={result.meta?.partnerRefundNo} copy={result.meta?.partnerRefundNo} />
              <KV k="refundNo (DANA)" v={result.data?.refundNo} />
              <KV k="refundTime" v={result.data?.refundTime} />
            </div>
          ) : null
        }
      />
    </Card>
  );
}
