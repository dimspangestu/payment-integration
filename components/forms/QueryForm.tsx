"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiResult, STATUS_META, postApi, rupiah } from "@/lib/client/api";
import { updateHistory } from "@/lib/client/history";
import { Badge, Button, Card, Field, KV, ResultPanel, cn } from "../ui";
import type { Prefill } from "../types";

export function TypeToggle({ value, onChange }: { value: "MPM" | "CPM"; onChange: (v: "MPM" | "CPM") => void }) {
  return (
    <div className="inline-flex rounded-xl border border-ink-700 bg-ink-950/50 p-1">
      {(["MPM", "CPM"] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={cn(
            "rounded-lg px-4 py-1.5 text-sm font-semibold transition",
            value === t ? "bg-dana-500 text-white shadow" : "text-ink-400 hover:text-white"
          )}
        >
          {t} <span className="font-mono text-[11px] opacity-70">({t === "MPM" ? 47 : 60})</span>
        </button>
      ))}
    </div>
  );
}

export default function QueryForm({ prefill }: { prefill?: Prefill }) {
  const [type, setType] = useState<"MPM" | "CPM">("MPM");
  const [ref, setRef] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);

  useEffect(() => {
    if (prefill?.ref) setRef(prefill.ref);
    if (prefill?.referenceNo) setReferenceNo(prefill.referenceNo);
    if (prefill?.type) setType(prefill.type);
  }, [prefill]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const r = await postApi("/api/qris/query", { type, originalPartnerReferenceNo: ref, originalReferenceNo: referenceNo || undefined });
    setResult(r);
    setLoading(false);
    if (r.ok && ref && r.data?.latestTransactionStatus) updateHistory(ref, { status: r.data.latestTransactionStatus });
  }

  const st = result?.data?.latestTransactionStatus ? STATUS_META[result.data.latestTransactionStatus] : null;

  return (
    <Card icon={<Search className="h-5 w-5" />} title="Cek Status (Query Payment)" subtitle="POST /rest/v1.1/debit/status — serviceCode 47 (MPM) / 60 (CPM)">
      <form onSubmit={submit} className="space-y-4">
        <TypeToggle value={type} onChange={setType} />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="originalPartnerReferenceNo" hint="Maks 25 karakter untuk QRIS">
            <input className="input font-mono" value={ref} onChange={(e) => setRef(e.target.value.trim())} placeholder="MPM261120094100123456" />
          </Field>
          <Field label="originalReferenceNo (DANA)" optional>
            <input className="input font-mono" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value.trim())} />
          </Field>
        </div>
        <Button type="submit" loading={loading}>
          <Search className="h-4 w-4" /> Cek Status
        </Button>
      </form>
      <ResultPanel
        result={result}
        extra={
          result?.ok ? (
            <div className="rounded-xl border border-ink-700/60 px-4 py-1">
              <KV k="latestTransactionStatus" v={st ? <Badge tone={st.tone} dot>{result.data?.latestTransactionStatus} · {st.label}</Badge> : result.data?.latestTransactionStatus} mono={false} />
              <KV k="transactionStatusDesc" v={result.data?.transactionStatusDesc} />
              <KV k="referenceNo" v={result.data?.originalReferenceNo} copy={result.data?.originalReferenceNo} />
              <KV k="amount" v={result.data?.amount?.value ? rupiah(result.data.amount.value) : undefined} mono={false} />
              <KV k="paidTime" v={result.data?.paidTime ?? result.data?.additionalInfo?.paidTime} />
            </div>
          ) : null
        }
      />
    </Card>
  );
}
