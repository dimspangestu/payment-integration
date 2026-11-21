import { queryPg } from "@/lib/dana/payment-gateway";
import { PG_STATUS } from "@/lib/dana/payment-gateway/methods";
import { handleError, readJson, respond } from "@/lib/dana/route-helpers";
import { saveTxnStatus } from "@/lib/dana/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const b = await readJson(req);
    const result = await queryPg({
      originalPartnerReferenceNo: b.originalPartnerReferenceNo as string,
      originalReferenceNo: b.originalReferenceNo as string,
    });
    const d = result.data as Record<string, unknown>;
    const ref = (d.originalPartnerReferenceNo as string) || (b.originalPartnerReferenceNo as string);
    if (result.ok && ref && d.latestTransactionStatus) {
      const st = String(d.latestTransactionStatus);
      await saveTxnStatus({
        partnerReferenceNo: ref,
        referenceNo: d.originalReferenceNo as string,
        status: st,
        statusDesc: PG_STATUS[st]?.label ?? (d.transactionStatusDesc as string),
        updatedAt: new Date().toISOString(),
        source: "query",
      }).catch(() => {});
    }
    return respond(result);
  } catch (e) {
    return handleError(e);
  }
}
