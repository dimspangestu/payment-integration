import type { Metadata } from "next";
import { CircleAlert } from "lucide-react";
import CheckoutClient from "@/components/checkout/CheckoutClient";
import { verifyCheckout } from "@/lib/checkout-token";
import { getDanaConfig } from "@/lib/dana/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout · Pembayaran", robots: { index: false } };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const cfg = getDanaConfig();
  const v = verifyCheckout(t);

  if (!v.ok) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F3F6FB] p-6 text-slate-900">
        <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-xl ring-1 ring-slate-200/60">
          <CircleAlert className="mx-auto h-10 w-10 text-rose-500" />
          <h1 className="mt-3 text-lg font-bold">Link pembayaran tidak bisa dibuka</h1>
          <p className="mt-1 text-sm text-slate-500">{v.error}. Minta link baru ke penjual.</p>
        </div>
      </div>
    );
  }

  const { order } = v;
  return (
    <CheckoutClient
      token={t!}
      order={{ amount: order.amount, title: order.title, goods: order.goods, buyerName: order.buyerName }}
      merchantName={cfg.merchantName}
      isSandbox={cfg.isSandbox}
    />
  );
}
