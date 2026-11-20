import { payCpm } from "@/lib/dana/qris";
import { clientIp, handleError, readJson, respond } from "@/lib/dana/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const b = await readJson(req);
    const result = await payCpm({
      qrContent: b.qrContent as string,
      amount: b.amount as string,
      qrContentType: b.qrContentType as string,
      externalStoreId: b.externalStoreId as string,
      deviceIp: clientIp(req),
    });
    return respond(result);
  } catch (e) {
    return handleError(e);
  }
}
