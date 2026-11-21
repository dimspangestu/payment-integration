import { NextResponse } from "next/server";
import { baseUrl, signCheckout } from "@/lib/checkout-token";
import { getDanaConfig } from "@/lib/dana/config";
import { formatAmount } from "@/lib/dana/utils";
import { handleError, readJson } from "@/lib/dana/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Buat link checkout custom yang ditandatangani (amount & item tidak bisa diubah customer) */
export async function POST(req: Request) {
  try {
    const b = await readJson(req);
    const goods = (Array.isArray(b.goods) ? b.goods : [])
      .filter((g: { name?: string }) => g?.name)
      .map((g: { name: string; price: string | number; quantity?: number }) => ({
        name: String(g.name).slice(0, 64),
        price: formatAmount(g.price),
        quantity: Math.max(1, Number(g.quantity) || 1),
      }));
    const amount = goods.length
      ? formatAmount(goods.reduce((s: number, g: { price: string; quantity: number }) => s + Number(g.price) * g.quantity, 0))
      : formatAmount(b.amount as string);

    const token = signCheckout(
      {
        amount,
        title: String(b.title || "Pembayaran").slice(0, 64),
        goods: goods.length ? goods : undefined,
        buyerName: (b.buyerName as string) || undefined,
      },
      Number(b.linkTtlMinutes) || 60 * 24
    );
    const cfg = getDanaConfig();
    return NextResponse.json({ ok: true, url: `${baseUrl(req)}/checkout?t=${token}`, amount, publicCheckout: cfg.checkoutPublic });
  } catch (e) {
    return handleError(e);
  }
}
