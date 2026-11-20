import { generateMpm } from "@/lib/dana/qris";
import { handleError, readJson, respond } from "@/lib/dana/route-helpers";
import { saveTxnStatus } from "@/lib/dana/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const b = await readJson(req);
    const result = await generateMpm({
      amount: b.amount as string,
      storeId: b.storeId as string,
      validityMinutes: b.validityMinutes ? Number(b.validityMinutes) : undefined,
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
