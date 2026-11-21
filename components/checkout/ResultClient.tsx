"use client";

import { CircleAlert, CircleCheck, Clock, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { idr } from "./parts";

type View = "loading" | "success" | "pending" | "failed" | "unknown";

export default function ResultClient({ refNo, merchantName }: { refNo: string | null; merchantName: string }) {
  const [view, setView] = useState<View>(refNo ? "loading" : "unknown");
  const [amount, setAmount] = useState<string | null>(null);
  const [paidTime, setPaidTime] = useState<string | null>(null);
  const tries = useRef(0);

  useEffect(() => {
    if (!refNo) return;
    let stop = false;
    const check = async () => {
      tries.current += 1;
      try {
        const j = await fetch(`/api/checkout/status?ref=${encodeURIComponent(refNo)}&query=1`).then((r) => r.json());
        if (j.amount) setAmount(j.amount);
        if (j.paidTime) setPaidTime(j.paidTime);
        if (j.status === "00") return setView("success"), true;
        if (j.status === "05" || j.status === "06") return setView("failed"), true;
        setView("pending");
      } catch {
        setView("pending");
      }
      return false;
    };
    (async () => {
      while (!stop && tries.current < 20) {
        if (await check()) break;
        await new Promise((r) => setTimeout(r, 3000));
      }
    })();
    return () => {
      stop = true;
    };
  }, [refNo]);

  const content = {
    loading: { icon: <Loader2 className="h-10 w-10 animate-spin text-sky-600" />, bg: "bg-sky-50", title: "Memeriksa pembayaran…", desc: "Mohon tunggu sebentar." },
    success: { icon: <CircleCheck className="h-11 w-11 text-white" />, bg: "bg-emerald-500 shadow-xl shadow-emerald-500/30", title: "Pembayaran berhasil", desc: `Terima kasih telah berbelanja di ${merchantName}.` },
    pending: { icon: <Clock className="h-10 w-10 text-amber-600" />, bg: "bg-amber-50", title: "Menunggu konfirmasi", desc: "Pembayaranmu sedang diproses. Halaman ini akan diperbarui otomatis." },
    failed: { icon: <CircleAlert className="h-10 w-10 text-rose-600" />, bg: "bg-rose-50", title: "Pembayaran tidak berhasil", desc: "Transaksi dibatalkan atau gagal. Silakan coba lagi." },
    unknown: { icon: <CircleAlert className="h-10 w-10 text-slate-500" />, bg: "bg-slate-100", title: "Kembali dari DANA", desc: "Cek status pesananmu di halaman penjual." },
  }[view];

  return (
    <div className="grid min-h-screen place-items-center bg-[#F3F6FB] p-6 text-slate-900">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white text-center shadow-[0_8px_32px_-12px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/60">
        <div className="px-8 pb-6 pt-10">
          <div className={`mx-auto grid h-20 w-20 place-items-center rounded-full ${content.bg}`}>{content.icon}</div>
          <h1 className="mt-5 text-xl font-extrabold tracking-tight">{content.title}</h1>
          <p className="mt-1.5 text-sm text-slate-500">{content.desc}</p>
        </div>
        {refNo && (
          <div className="space-y-2 border-t border-slate-100 bg-slate-50/70 px-8 py-5 text-left text-sm">
            {amount && (
              <div className="flex justify-between">
                <span className="text-slate-500">Jumlah</span>
                <b>{idr(amount)}</b>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">No. pesanan</span>
              <span className="truncate font-mono text-xs">{refNo}</span>
            </div>
            {paidTime && (
              <div className="flex justify-between">
                <span className="text-slate-500">Dibayar</span>
                <span className="text-xs">{new Date(paidTime).toLocaleString("id-ID")}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
