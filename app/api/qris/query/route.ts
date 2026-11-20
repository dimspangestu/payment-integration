import { queryPayment, TX_STATUS } from "@/lib/dana/qris";
import { handleError, readJson, respond } from "@/lib/dana/route-helpers";
import { saveTxnStatus } from "@/lib/dana/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const b = await readJson(req);
    const result = await queryPayment({
      type: b.type === "CPM" ? "CPM" : "MPM",
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
        statusDesc: TX_STATUS[st] ?? (d.transactionStatusDesc as string),
        updatedAt: new Date().toISOString(),
        source: "query",
      }).catch(() => {});
    }
    return respond(result);
  } catch (e) {
    return handleError(e);
  }
}
