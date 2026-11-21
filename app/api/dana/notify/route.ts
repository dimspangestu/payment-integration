import { handleNotify } from "@/lib/dana/notify-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Finish Notify — https://<domain>/v1.0/debit/notify (rewrite di next.config.ts) */
export async function POST(req: Request) {
  return handleNotify(req, "finish");
}
