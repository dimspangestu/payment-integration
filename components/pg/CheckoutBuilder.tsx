"use client";

import { ExternalLink, LayoutTemplate, Link2, RefreshCw, ShieldCheck } from "lucide-react";
import QRCode from "qrcode";
import { useState } from "react";
import { rupiah } from "@/lib/client/api";
import { AmountInput, Badge, Button, Card, CopyButton, Field, QuickAmounts } from "../ui";
import ItemsEditor, { ItemRow, itemsTotal } from "./ItemsEditor";

const SAMPLE: ItemRow[] = [
  { name: "Kopi Susu Gula Aren", price: "22000", quantity: 2 },
  { name: "Croissant Butter", price: "28000", quantity: 1 },
];

export default function CheckoutBuilder() {
  const [title, setTitle] = useState("Pesanan #1024");
  const [items, setItems] = useState<ItemRow[]>(SAMPLE);
  const [amount, setAmount] = useState("");
  const [ttl, setTtl] = useState("1440");
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<{ url: string; amount: string; publicCheckout: boolean } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [frameKey, setFrameKey] = useState(0);

  const total = items.length ? itemsTotal(items) : Number(amount || 0);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/pg/checkout-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, goods: items.filter((i) => i.name && i.price), amount: String(total), linkTtlMinutes: Number(ttl) }),
      }).then((x) => x.json());
      if (!r.ok) throw new Error(r.responseMessage || "Gagal membuat link");
      setLink(r);
      setQr(await QRCode.toDataURL(r.url, { width: 320, margin: 1 }));
      setFrameKey((k) => k + 1);
    } catch (err) {
      setError((err as Error).message);
    }
    setLoading(false);
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_414px]">
      <div className="space-y-6">
        <Card
          icon={<LayoutTemplate className="h-5 w-5" />}
          title="Custom Checkout"
          subtitle="Halaman checkout milik merchant: customer pilih metode (Consult Pay), nomor VA / QRIS tampil di halaman sendiri (scenario API)."
        >
          <form onSubmit={generate} className="space-y-4">
            <Field label="Judul pesanan">
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={64} required />
            </Field>
            <Field label="Item">
              <ItemsEditor items={items} onChange={setItems} />
            </Field>
            {items.length === 0 && (
              <Field label="Amount">
                <AmountInput value={amount} onChange={setAmount} />
                <QuickAmounts onPick={setAmount} />
              </Field>
            )}
            <Field label="Link berlaku" hint="Setelah customer memilih metode, order DANA berlaku 20 menit">
              <select className="input" value={ttl} onChange={(e) => setTtl(e.target.value)}>
                <option value="60">1 jam</option>
                <option value="1440">1 hari</option>
                <option value="10080">7 hari</option>
              </select>
            </Field>
            <Button type="submit" loading={loading} disabled={!total}>
              <Link2 className="h-4 w-4" /> Buat link checkout · {rupiah(total)}
            </Button>
            {error && <p className="text-sm text-rose-300">{error}</p>}
          </form>
        </Card>

        {link && (
          <Card title="Link siap dibagikan" subtitle="Amount & item ditandatangani HMAC — tidak bisa diubah customer">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-[auto_1fr]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {qr && <img src={qr} alt="QR checkout" className="mx-auto h-36 w-36 rounded-xl bg-white p-2 sm:mx-0" />}
              <div className="min-w-0 space-y-3">
                <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-ink-950/60 px-3 py-2">
                  <span className="min-w-0 truncate font-mono text-[11px] text-ink-400">{link.url}</span>
                  <CopyButton text={link.url} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href={link.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-dana-400 to-dana-600 px-4 py-2 text-sm font-semibold text-white">
                    Buka checkout <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                {link.publicCheckout ? (
                  <Badge tone="ok" dot>Publik — customer bisa buka tanpa login</Badge>
                ) : (
                  <p className="flex items-start gap-1.5 text-xs text-amber-300">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Set <code className="font-mono">CHECKOUT_PUBLIC=true</code> agar customer bisa membuka link tanpa password dashboard.
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Preview di bingkai ponsel */}
      <div className="xl:sticky xl:top-24 xl:self-start">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">Preview</span>
          {link && (
            <button onClick={() => setFrameKey((k) => k + 1)} className="inline-flex items-center gap-1 text-xs text-ink-400 hover:text-white">
              <RefreshCw className="h-3.5 w-3.5" /> Reload
            </button>
          )}
        </div>
        <div className="mx-auto w-[414px] max-w-full rounded-[48px] border border-ink-700 bg-ink-950 p-3 shadow-2xl shadow-black/50">
          <div className="flex h-[760px] flex-col overflow-hidden rounded-[38px] bg-white">
            {/* status bar + dynamic island, di luar iframe agar tidak menutupi konten */}
            <div className="relative flex h-9 shrink-0 items-center justify-between bg-white px-7 text-[11px] font-semibold text-slate-900">
              <span>9:41</span>
              <span className="absolute left-1/2 top-2 h-5 w-24 -translate-x-1/2 rounded-full bg-ink-950" />
              <span>5G ▮▮▮</span>
            </div>
            {link ? (
              <iframe key={frameKey} src={link.url} title="Checkout preview" className="w-full flex-1 border-0 bg-[#F3F6FB]" />
            ) : (
              <div className="grid flex-1 place-items-center bg-[#F3F6FB] p-8 text-center text-sm text-slate-400">
                <div>
                  <LayoutTemplate className="mx-auto mb-3 h-10 w-10 opacity-40" />
                  Buat link untuk melihat halaman checkout di sini
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
