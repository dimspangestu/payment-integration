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

const typeTone = (t: HistoryItem["type"]) => (t === "REFUND" ? "warn" : t === "PG" ? "ok" : "info");

function StatusBadge({ h }: { h: HistoryItem }) {
  const st = h.status ? STATUS_META[h.status] : null;
  if (!h.ok) return <Badge tone="bad">{h.responseCode}</Badge>;
  if (st) return <Badge tone={st.tone} dot>{st.label}</Badge>;
  return <Badge tone="ok">{h.responseCode}</Badge>;
}

function Actions({ h, navigate }: { h: HistoryItem; navigate: Navigate }) {
  const qrisType = h.type === "MPM" || h.type === "CPM" ? h.type : undefined;
  if (!h.ok) return null;
  if (qrisType) {
    return (
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
    );
  }
  if (h.type === "PG") {
    return (
      <div className="flex justify-end gap-1">
        <IconBtn title="Query / Cancel / Refund" onClick={() => navigate("pg-ops", { ref: h.partnerReferenceNo, referenceNo: h.referenceNo, amount: h.amount })}>
          <Search className="h-4 w-4" />
        </IconBtn>
      </div>
    );
  }
  return null;
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
          <Button variant="ghost" onClick={() => confirm("Hapus riwayat?") && clearHistory()} aria-label="Hapus riwayat">
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null
      }
    >
      {items.length === 0 ? (
        <div className="grid h-32 place-items-center rounded-xl border border-dashed border-ink-700 text-sm text-ink-400">Belum ada transaksi</div>
      ) : (
        <>
          {/* HP: daftar kartu */}
          <ul className="divide-y divide-ink-700/50 overflow-hidden rounded-xl border border-ink-700/60 md:hidden">
            {items.map((h) => (
              <li key={h.type + h.partnerReferenceNo} className="space-y-2 bg-ink-950/20 px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1 font-mono text-[12px] text-white">
                    <span className="truncate">{h.partnerReferenceNo}</span>
                    <CopyButton text={h.partnerReferenceNo} />
                  </span>
                  <Badge tone={typeTone(h.type)}>{h.type}</Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-white">{h.amount ? rupiah(h.amount) : "—"}</span>
                    <StatusBadge h={h} />
                  </div>
                  <Actions h={h} navigate={navigate} />
                </div>
                <div className="text-[11px] text-ink-400">
                  {new Date(h.createdAt).toLocaleString("id-ID")}
                  {h.note && ` · ${h.note}`}
                </div>
              </li>
            ))}
          </ul>

          {/* Tablet / laptop: tabel */}
          <div className="hidden overflow-x-auto rounded-xl border border-ink-700/60 md:block">
            <table className="w-full text-sm">
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
                {items.map((h) => (
                  <tr key={h.type + h.partnerReferenceNo} className="hover:bg-ink-800/30">
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 whitespace-nowrap font-mono text-[13px] text-white">
                        {h.partnerReferenceNo}
                        <CopyButton text={h.partnerReferenceNo} />
                      </span>
                      {h.note && <div className="text-xs text-ink-400">{h.note}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={typeTone(h.type)}>{h.type}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-ink-300">{h.amount ? rupiah(h.amount) : "—"}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge h={h} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-ink-400">{new Date(h.createdAt).toLocaleString("id-ID")}</td>
                    <td className="px-4 py-2.5">
                      <Actions h={h} navigate={navigate} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

function IconBtn({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...p} className="rounded-lg p-2 text-ink-400 transition hover:bg-dana-500/15 hover:text-dana-300">
      {children}
    </button>
  );
}
