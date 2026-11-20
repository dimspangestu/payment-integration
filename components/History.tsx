"use client";

import { Ban, History as HistoryIcon, Search, Trash2, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { STATUS_META, rupiah } from "@/lib/client/api";
import { HistoryItem, clearHistory, getHistory, onHistoryChange } from "@/lib/client/history";
import { Badge, Button, Card, CopyButton } from "./ui";
import type { Navigate } from "./types";

export function useHistory() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  useEffect(() => {
    setItems(getHistory());
    return onHistoryChange(() => setItems(getHistory()));
  }, []);
  return items;
}

export default function History({ navigate, compact }: { navigate: Navigate; compact?: boolean }) {
  const all = useHistory();
  const items = compact ? all.slice(0, 6) : all;

  return (
    <Card
      icon={<HistoryIcon className="h-5 w-5" />}
      title="Riwayat transaksi"
      subtitle="Disimpan di browser ini (localStorage)"
      actions={
        !compact && all.length > 0 ? (
          <Button variant="ghost" onClick={() => confirm("Hapus riwayat?") && clearHistory()}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null
      }
    >
      {items.length === 0 ? (
        <div className="grid h-32 place-items-center rounded-xl border border-dashed border-ink-700 text-sm text-ink-400">Belum ada transaksi</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-700/60">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-ink-900/70 text-left text-xs uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-4 py-2.5">Ref</th>
                <th className="px-4 py-2.5">Tipe</th>
                <th className="px-4 py-2.5">Amount</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Waktu</th>
                <th className="px-4 py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700/50">
              {items.map((h) => {
                const st = h.status ? STATUS_META[h.status] : null;
                const qrisType = h.type === "MPM" || h.type === "CPM" ? h.type : undefined;
                return (
                  <tr key={h.type + h.partnerReferenceNo} className="hover:bg-ink-800/30">
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 font-mono text-[13px] text-white">
                        {h.partnerReferenceNo}
                        <CopyButton text={h.partnerReferenceNo} />
                      </span>
                      {h.note && <div className="text-xs text-ink-400">{h.note}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={h.type === "REFUND" ? "warn" : "info"}>{h.type}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-ink-300">{h.amount ? rupiah(h.amount) : "—"}</td>
                    <td className="px-4 py-2.5">
                      {!h.ok ? (
                        <Badge tone="bad">{h.responseCode}</Badge>
                      ) : st ? (
                        <Badge tone={st.tone} dot>{st.label}</Badge>
                      ) : (
                        <Badge tone="ok">{h.responseCode}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-ink-400">{new Date(h.createdAt).toLocaleString("id-ID")}</td>
                    <td className="px-4 py-2.5">
                      {qrisType && h.ok && (
                        <div className="flex justify-end gap-1">
                          <IconBtn title="Query" onClick={() => navigate("query", { ref: h.partnerReferenceNo, referenceNo: h.referenceNo, type: qrisType })}>
                            <Search className="h-4 w-4" />
                          </IconBtn>
                          <IconBtn title="Cancel" onClick={() => navigate("cancel", { ref: h.partnerReferenceNo, referenceNo: h.referenceNo, amount: h.amount, type: qrisType })}>
                            <Ban className="h-4 w-4" />
                          </IconBtn>
                          <IconBtn title="Refund" onClick={() => navigate("refund", { ref: h.partnerReferenceNo, referenceNo: h.referenceNo, amount: h.amount, type: qrisType })}>
                            <Undo2 className="h-4 w-4" />
                          </IconBtn>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function IconBtn({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...p} className="rounded-lg p-1.5 text-ink-400 transition hover:bg-dana-500/15 hover:text-dana-300">
      {children}
    </button>
  );
}
