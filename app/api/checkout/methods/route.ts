import { NextResponse } from "next/server";
import { verifyCheckout } from "@/lib/checkout-token";
import { getDanaConfig } from "@/lib/dana/config";
import { consultPay } from "@/lib/dana/payment-gateway";
import { SANDBOX_FALLBACK_METHODS, payOptionAllowedInSandbox } from "@/lib/dana/payment-gateway/methods";
import { clientIp, readJson } from "@/lib/dana/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Metode bayar untuk halaman checkout — dari Consult Pay, fallback ke daftar sandbox */
export async function POST(req: Request) {
  const b = await readJson(req);
  const v = verifyCheckout(b.t as string);
  if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });

  const cfg = getDanaConfig();
  const hasStore = Boolean(cfg.externalStoreId);
  const usable = (m: { payOption: string; needsStore?: boolean }) =>
    (!m.needsStore || hasStore) && (!cfg.isSandbox || payOptionAllowedInSandbox(m.payOption));

  try {
    const r = await consultPay({ amount: v.order.amount, clientIp: clientIp(req) });
    const methods = ((r.meta?.methods as typeof SANDBOX_FALLBACK_METHODS) ?? []).filter(usable);
    if (r.ok && methods.length) return NextResponse.json({ ok: true, source: "consult", methods });
    if (!cfg.isSandbox) {
      return NextResponse.json({ ok: false, error: r.responseMessage || "Metode bayar tidak tersedia", responseCode: r.responseCode }, { status: 502 });
    }
  } catch (e) {
    if (!cfg.isSandbox) return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, source: "fallback", methods: SANDBOX_FALLBACK_METHODS.filter(usable) });
}
