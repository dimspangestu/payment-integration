import { refundPayment } from "@/lib/dana/qris";
import { handleError, readJson, respond } from "@/lib/dana/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const b = await readJson(req);
    const result = await refundPayment({
      originalPartnerReferenceNo: b.originalPartnerReferenceNo as string,
      originalReferenceNo: b.originalReferenceNo as string,
      amount: b.amount as string,
      reason: b.reason as string,
    });
    return respond(result);
  } catch (e) {
    return handleError(e);
  }
}
