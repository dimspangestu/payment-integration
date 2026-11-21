import { NextResponse } from "next/server";
import { baseUrl, notifyUrlFor, verifyCheckout } from "@/lib/checkout-token";
import { createCustomOrder } from "@/lib/dana/payment-gateway";
import { DanaConfigError } from "@/lib/dana/config";
import { clientIp, readJson } from "@/lib/dana/route-helpers";
import { saveTxnStatus } from "@/lib/dana/store";
import { DanaInputError, generateRef } from "@/lib/dana/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Buat order Payment Gateway mode Custom (scenario API) dari halaman checkout */
export async function POST(req: Request) {
  const b = await readJson(req);
  const v = verifyCheckout(b.t as string);
  if (!v.ok) return NextResponse.json({ ok: false, responseMessage: v.error }, { status: 400 });
  const { order } = v;

  const partnerReferenceNo = generateRef("PGC");
  try {
    const r = await createCustomOrder({
      partnerReferenceNo,
      amount: order.amount,
      orderTitle: order.title,
      goods: order.goods,
      buyerName: order.buyerName,
      payMethod: b.payMethod as string,
      payOption: b.payOption as string,
      phoneNumber: b.phoneNumber as string,
      validMinutes: 30,
      returnUrl: `${baseUrl(req)}/checkout/result?ref=${partnerReferenceNo}`,
      notifyUrl: notifyUrlFor(req),
      clientIp: clientIp(req),
    });

    if (r.ok) {
      await saveTxnStatus({
        partnerReferenceNo,
        referenceNo: r.data.referenceNo,
        status: "01",
        statusDesc: "INITIATED",
        amount: order.amount,
        updatedAt: new Date().toISOString(),
        source: "query",
      }).catch(() => {});
    }

    // Response publik: hanya yang dibutuhkan customer (tanpa request/debug)
    return NextResponse.json({
      ok: r.ok,
      responseCode: r.responseCode,
      responseMessage: r.responseMessage,
      partnerReferenceNo,
      referenceNo: r.data?.referenceNo,
      paymentCode: r.meta?.paymentCode,
      webRedirectUrl: r.meta?.webRedirectUrl,
      validUpTo: r.meta?.validUpTo,
      amount: order.amount,
      method: r.meta?.method,
    });
  } catch (e) {
    if (e instanceof DanaInputError) return NextResponse.json({ ok: false, responseCode: "INPUT_ERROR", responseMessage: e.message }, { status: 400 });
    if (e instanceof DanaConfigError) return NextResponse.json({ ok: false, responseCode: "CONFIG_ERROR", responseMessage: "Konfigurasi merchant belum lengkap" }, { status: 500 });
    console.error("[checkout:order]", e);
    return NextResponse.json({ ok: false, responseCode: "SERVER_ERROR", responseMessage: "Terjadi kesalahan, coba lagi" }, { status: 500 });
  }
}
