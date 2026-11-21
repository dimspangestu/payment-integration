import { handleNotify } from "@/lib/dana/notify-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Transfer to Bank Notify — https://<domain>/v1.0/debit/emoney/transfer-bank/notify.htm (kode sukses 2004300) */
export async function POST(req: Request) {
  return handleNotify(req, "transfer-bank");
}
