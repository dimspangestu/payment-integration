"use client";

import { ArrowDownToLine, BadgeCheck, Landmark, RefreshCw, Search, Send, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiResult, STATUS_META, postApi, rupiah } from "@/lib/client/api";
import { addHistory } from "@/lib/client/history";
import { AmountInput, Badge, Button, Card, Field, KV, QuickAmounts, ResultPanel, cn } from "../ui";
import type { AppConfig } from "../types";

/** Kode bank kliring umum — cek lagi daftar resmi bank yang didukung DANA */
const BANKS: { code: string; name: string }[] = [
  { code: "014", name: "BCA" },
  { code: "002", name: "BRI" },
  { code: "008", name: "Mandiri" },
  { code: "009", name: "BNI" },
  { code: "451", name: "BSI" },
  { code: "022", name: "CIMB Niaga" },
  { code: "013", name: "Permata" },
  { code: "011", name: "Danamon" },
  { code: "200", name: "BTN" },
  { code: "213", name: "SMBC Indonesia (BTPN)" },
  { code: "019", name: "Panin" },
  { code: "028", name: "OCBC" },
  { code: "016", name: "Maybank" },
  { code: "426", name: "Mega" },
  { code: "147", name: "Muamalat" },
  { code: "535", name: "SeaBank" },
  { code: "542", name: "Bank Jago" },
  { code: "501", name: "blu (BCA Digital)" },
];

type Target = "dana" | "bank";

function Steps({ step }: { step: number }) {
  const labels = ["Cek akun", "Kirim", "Status"];
  return (
    <ol className="mb-5 grid grid-cols-3 gap-2">
      {labels.map((l, i) => (
        <li key={l} className="flex items-center gap-2">
          <span
            className={cn(
              "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ring-1",
              step > i ? "bg-dana-500 text-white ring-dana-400" : step === i ? "bg-dana-500/15 text-dana-300 ring-dana-400/40" : "bg-ink-900 text-ink-400 ring-ink-700"
            )}
          >
            {i + 1}
          </span>
          <span className={cn("truncate text-xs font-medium sm:text-sm", step >= i ? "text-white" : "text-ink-400")}>{l}</span>
        </li>
      ))}
    </ol>
  );
}

export default function DisbursementPanel({ config }: { config: AppConfig | null }) {
  const [target, setTarget] = useState<Target>("dana");

  // form
  const [phone, setPhone] = useState("");
  const [customerNumber, setCustomerNumber] = useState("");
  const [bankCode, setBankCode] = useState("014");
  const [customBank, setCustomBank] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [accountName, setAccountName] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  // state
  const [inquiry, setInquiry] = useState<ApiResult | null>(null);
  const [transfer, setTransfer] = useState<ApiResult | null>(null);
  const [status, setStatus] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState<"" | "inquiry" | "transfer" | "status">("");
  const [statusRef, setStatusRef] = useState("");

  useEffect(() => {
    if (config?.disbursementCustomerNumber && !customerNumber) setCustomerNumber(config.disbursementCustomerNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  function reset(t?: Target) {
    if (t) setTarget(t);
    setInquiry(null);
    setTransfer(null);
    setStatus(null);
  }

  const code = bankCode === "other" ? customBank : bankCode;
  const step = status ? 3 : transfer?.ok ? 2 : inquiry?.ok ? 1 : 0;

  async function doInquiry(e: React.FormEvent) {
    e.preventDefault();
    setLoading("inquiry");
    setTransfer(null);
    setStatus(null);
    const r =
      target === "dana"
        ? await postApi("/api/disbursement/dana-inquiry", { customerNumber: phone, amount })
        : await postApi("/api/disbursement/bank-inquiry", {
            customerNumber,
            beneficiaryAccountNumber: accountNo,
            beneficiaryBankCode: code,
            beneficiaryAccountName: accountName || undefined,
            amount,
          });
    setInquiry(r);
    setLoading("");
  }

  async function doTransfer() {
    const name = target === "dana" ? inquiry?.data?.customerName : inquiry?.data?.beneficiaryAccountName;
    if (!confirm(`Kirim ${rupiah(amount)} ke ${name ?? (target === "dana" ? phone : accountNo)}?`)) return;
    setLoading("transfer");
    const r =
      target === "dana"
        ? await postApi("/api/disbursement/dana-transfer", { customerNumber: phone, amount, feeAmount: inquiry?.data?.feeAmount?.value ?? 0, notes })
        : await postApi("/api/disbursement/bank-transfer", {
            customerNumber,
            beneficiaryAccountNumber: accountNo,
            beneficiaryBankCode: code,
            beneficiaryAccountName: inquiry?.data?.beneficiaryAccountName || accountName || undefined,
            amount,
          });
    setTransfer(r);
    setLoading("");
    if (r.meta?.partnerReferenceNo) {
      setStatusRef(r.meta.partnerReferenceNo);
      addHistory({
        partnerReferenceNo: r.meta.partnerReferenceNo,
        referenceNo: r.data?.referenceNo,
        type: "DISB",
        amount: r.meta.amount,
        createdAt: new Date().toISOString(),
        ok: r.ok,
        responseCode: r.responseCode,
        note: target === "dana" ? `ke DANA ${phone}` : `ke bank ${code} ${accountNo}`,
      });
    }
  }

  async function doStatus(ref = statusRef) {
    if (!ref) return;
    setLoading("status");
    const r = await postApi(`/api/disbursement/${target}-status`, { originalPartnerReferenceNo: ref });
    setStatus(r);
    setLoading("");
  }

  const inq = inquiry?.data;
  const st = status?.data?.latestTransactionStatus ? STATUS_META[status.data.latestTransactionStatus] : null;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card icon={<ArrowDownToLine className="h-5 w-5" />} title="Disbursement" subtitle="Kirim dana dari saldo merchant ke akun DANA atau rekening bank">
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl border border-ink-700 bg-ink-950/50 p-1">
          {(
            [
              { k: "dana", l: "Ke DANA", icon: <Wallet className="h-4 w-4" /> },
              { k: "bank", l: "Ke Bank", icon: <Landmark className="h-4 w-4" /> },
            ] as const
          ).map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => reset(t.k)}
              className={cn("flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition", target === t.k ? "bg-dana-500 text-white" : "text-ink-400 hover:text-white")}
            >
              {t.icon} {t.l}
            </button>
          ))}
        </div>

        <Steps step={step} />

        <form onSubmit={doInquiry} className="space-y-4">
          {target === "dana" ? (
            <Field label="Nomor DANA penerima" hint="08xx atau 628xx — otomatis diubah ke format 628xx">
              <input className="input font-mono" inputMode="tel" value={phone} onChange={(e) => (setPhone(e.target.value), reset())} placeholder="0811742234" required />
            </Field>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Bank tujuan">
                  <select className="input" value={bankCode} onChange={(e) => (setBankCode(e.target.value), reset())}>
                    {BANKS.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                    <option value="other">Lainnya…</option>
                  </select>
                </Field>
                {bankCode === "other" ? (
                  <Field label="Kode bank">
                    <input className="input font-mono" value={customBank} onChange={(e) => (setCustomBank(e.target.value.replace(/\D/g, "").slice(0, 8)), reset())} placeholder="mis. 014" required />
                  </Field>
                ) : (
                  <Field label="Nomor rekening">
                    <input className="input font-mono" inputMode="numeric" value={accountNo} onChange={(e) => (setAccountNo(e.target.value.replace(/\D/g, "")), reset())} placeholder="2460888509" required />
                  </Field>
                )}
              </div>
              {bankCode === "other" && (
                <Field label="Nomor rekening">
                  <input className="input font-mono" inputMode="numeric" value={accountNo} onChange={(e) => (setAccountNo(e.target.value.replace(/\D/g, "")), reset())} required />
                </Field>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Nama pemilik rekening" optional hint="Untuk validasi nama">
                  <input className="input" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
                </Field>
                <Field label="Customer number" hint="Nomor akun DANA merchant (628xx)">
                  <input className="input font-mono" inputMode="tel" value={customerNumber} onChange={(e) => setCustomerNumber(e.target.value)} placeholder="62811742234" required />
                </Field>
              </div>
            </>
          )}

          <Field label="Nominal">
            <AmountInput value={amount} onChange={(v) => (setAmount(v), reset())} />
            <QuickAmounts onPick={(v) => (setAmount(v), reset())} />
          </Field>
          {target === "dana" && (
            <Field label="Catatan" optional>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={255} />
            </Field>
          )}

          <Button type="submit" loading={loading === "inquiry"} variant={inquiry?.ok ? "ghost" : "primary"}>
            <Search className="h-4 w-4" /> 1. Cek {target === "dana" ? "akun DANA" : "rekening"}
          </Button>
        </form>

        {inquiry && !inquiry.ok && <ResultPanel result={inquiry} />}

        {inquiry?.ok && (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                <BadgeCheck className="h-4 w-4" /> Akun ditemukan
              </div>
              <div className="mt-3 text-lg font-bold text-white">{target === "dana" ? inq?.customerName ?? "—" : inq?.beneficiaryAccountName ?? "—"}</div>
              <div className="text-xs text-ink-400">
                {target === "dana" ? phone : `${inq?.beneficiaryBankShortName ?? inq?.beneficiaryBankName ?? code} · ${accountNo}`}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-ink-700/50 pt-3 text-sm sm:grid-cols-3">
                <div>
                  <div className="text-xs text-ink-400">Nominal</div>
                  <div className="font-semibold text-white">{rupiah(amount)}</div>
                </div>
                <div>
                  <div className="text-xs text-ink-400">Biaya</div>
                  <div className="font-semibold text-white">{rupiah(target === "dana" ? inq?.feeAmount?.value : inq?.additionalInfo?.feeAmount?.value)}</div>
                </div>
                {target === "dana" && (inq?.minAmount || inq?.maxAmount) && (
                  <div className="col-span-2 sm:col-span-1">
                    <div className="text-xs text-ink-400">Limit</div>
                    <div className="text-xs text-white">
                      {rupiah(inq?.minAmount?.value)} – {rupiah(inq?.maxAmount?.value)}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {!transfer?.ok && (
              <Button onClick={doTransfer} loading={loading === "transfer"} className="w-full sm:w-auto">
                <Send className="h-4 w-4" /> 2. Kirim {rupiah(amount)}
              </Button>
            )}
          </div>
        )}

        {transfer && (
          <ResultPanel
            result={transfer}
            extra={
              transfer.meta?.partnerReferenceNo ? (
                <div className="rounded-xl border border-ink-700/60 px-4 py-1">
                  <KV k="partnerReferenceNo" v={transfer.meta.partnerReferenceNo} copy={transfer.meta.partnerReferenceNo} />
                  <KV k="referenceNo (DANA)" v={transfer.data?.referenceNo} copy={transfer.data?.referenceNo} />
                  <div className="py-3">
                    <Button variant="soft" onClick={() => doStatus(transfer.meta!.partnerReferenceNo)} loading={loading === "status"}>
                      <RefreshCw className="h-4 w-4" /> 3. Cek status
                    </Button>
                  </div>
                </div>
              ) : null
            }
          />
        )}
      </Card>

      {/* Status manual */}
      <Card title="Cek status transfer" subtitle={`serviceCode ${target === "dana" ? "38 · Transfer ke DANA" : "00 · Transfer ke Bank"}`} className="xl:self-start">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            doStatus();
          }}
          className="space-y-3"
        >
          <Field label="partnerReferenceNo">
            <input className="input font-mono" value={statusRef} onChange={(e) => setStatusRef(e.target.value.trim())} placeholder={target === "dana" ? "DTD…" : "DTB…"} required />
          </Field>
          <Button type="submit" variant="soft" loading={loading === "status"} className="w-full">
            <Search className="h-4 w-4" /> Cek status
          </Button>
        </form>
        {status && (
          <ResultPanel
            result={status}
            extra={
              status.ok ? (
                <div className="rounded-xl border border-ink-700/60 px-4 py-1">
                  <KV
                    k="Status"
                    mono={false}
                    v={st ? <Badge tone={st.tone} dot>{status.data?.latestTransactionStatus} · {st.label}</Badge> : status.data?.latestTransactionStatus}
                  />
                  <KV k="Keterangan" v={status.data?.transactionStatusDesc} />
                  <KV k="Nominal" v={status.data?.amount?.value ? rupiah(status.data.amount.value) : undefined} mono={false} />
                </div>
              ) : null
            }
          />
        )}
      </Card>
    </div>
  );
}
