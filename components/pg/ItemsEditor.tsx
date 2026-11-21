"use client";

import { Plus, Trash2 } from "lucide-react";
import { rupiah } from "@/lib/client/api";

export interface ItemRow {
  name: string;
  price: string;
  quantity: number;
}

export const itemsTotal = (items: ItemRow[]) =>
  items.reduce((s, i) => s + (Number(String(i.price).replace(/[^\d.]/g, "")) || 0) * (i.quantity || 1), 0);

export default function ItemsEditor({ items, onChange }: { items: ItemRow[]; onChange: (v: ItemRow[]) => void }) {
  const set = (i: number, patch: Partial<ItemRow>) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-[1fr_120px_64px_36px] gap-2">
          <input className="input" placeholder="Nama item" value={it.name} onChange={(e) => set(i, { name: e.target.value })} />
          <input className="input font-mono" placeholder="Harga" inputMode="numeric" value={it.price} onChange={(e) => set(i, { price: e.target.value.replace(/[^\d]/g, "") })} />
          <input className="input text-center" type="number" min={1} value={it.quantity} onChange={(e) => set(i, { quantity: Math.max(1, Number(e.target.value) || 1) })} />
          <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="grid place-items-center rounded-xl text-ink-400 hover:bg-rose-500/10 hover:text-rose-300">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => onChange([...items, { name: "", price: "", quantity: 1 }])}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-dana-300 hover:bg-dana-500/10"
        >
          <Plus className="h-3.5 w-3.5" /> Tambah item
        </button>
        {items.length > 0 && <span className="text-sm text-ink-300">Subtotal <b className="text-white">{rupiah(itemsTotal(items))}</b></span>}
      </div>
    </div>
  );
}
