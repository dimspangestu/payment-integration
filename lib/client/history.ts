"use client";

export interface HistoryItem {
  partnerReferenceNo: string;
  referenceNo?: string;
  type: "MPM" | "CPM" | "PG" | "DISB" | "WIDGET" | "REFUND" | "CANCEL";
  amount?: string;
  createdAt: string;
  status?: string;
  responseCode?: string;
  ok: boolean;
  note?: string;
}

const KEY = "dana-qris-history:v1";
const EVT = "dana-history-updated";

export function getHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function save(items: HistoryItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, 200)));
    window.dispatchEvent(new Event(EVT));
  } catch {
    /* storage tidak tersedia */
  }
}

export function addHistory(item: HistoryItem) {
  save([item, ...getHistory().filter((h) => !(h.partnerReferenceNo === item.partnerReferenceNo && h.type === item.type))]);
}

export function updateHistory(ref: string, patch: Partial<HistoryItem>) {
  save(getHistory().map((h) => (h.partnerReferenceNo === ref ? { ...h, ...patch } : h)));
}

export function clearHistory() {
  save([]);
}

export function onHistoryChange(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener("storage", cb);
  };
}
