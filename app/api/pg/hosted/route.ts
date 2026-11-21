import { baseUrl, notifyUrlFor } from "@/lib/checkout-token";
import { createHostedOrder } from "@/lib/dana/payment-gateway";
import { clientIp, handleError, readJson, respond } from "@/lib/dana/route-helpers";
import { saveTxnStatus } from "@/lib/dana/store";
import { generateRef } from "@/lib/dana/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Hosted checkout: buat order lalu arahkan customer ke webRedirectUrl DANA */
export async function POST(req: Request) {
  try {
    const b = await readJson(req);
    const base = baseUrl(req);
    const partnerReferenceNo = generateRef("PGH");
    const result = await createHostedOrder({
      partnerReferenceNo,
      amount: b.amount as string,
      orderTitle: (b.orderTitle as string) || "Pembayaran",
      goods: Array.isArray(b.goods) ? (b.goods as never) : undefined,
      validMinutes: b.validMinutes ? Number(b.validMinutes) : undefined,
      buyerName: b.buyerName as string,
      disabledPayMethods: b.disabledPayMethods as string,
      externalStoreId: b.externalStoreId as string,
      returnUrl: `${base}/checkout/result?ref=${partnerReferenceNo}`,
      notifyUrl: notifyUrlFor(req),
      clientIp: clientIp(req),
    });
    if (result.ok && result.meta?.partnerReferenceNo) {
      await saveTxnStatus({
        partnerReferenceNo: String(result.meta.partnerReferenceNo),
        referenceNo: result.data.referenceNo,
        status: "01",
        statusDesc: "INITIATED",
        amount: String(result.meta.amount),
        updatedAt: new Date().toISOString(),
        source: "query",
      }).catch(() => {});
    }
    return respond(result);
  } catch (e) {
    return handleError(e);
  }
}
