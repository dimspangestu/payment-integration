import { cancelPg } from "@/lib/dana/payment-gateway";
import { handleError, readJson, respond } from "@/lib/dana/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const b = await readJson(req);
    return respond(
      await cancelPg({
        originalPartnerReferenceNo: b.originalPartnerReferenceNo as string,
        originalReferenceNo: b.originalReferenceNo as string,
        amount: (b.amount as string) || undefined,
        reason: b.reason as string,
      })
    );
  } catch (e) {
    return handleError(e);
  }
}
