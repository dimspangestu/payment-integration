import { NextResponse } from "next/server";
import { getTxnStatus } from "@/lib/dana/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Status transaksi dari penyimpanan lokal (diperbarui oleh webhook / query). Dipakai UI untuk polling. */
export async function GET(req: Request) {
  const ref = new URL(req.url).searchParams.get("ref");
  if (!ref) return NextResponse.json({ error: "ref wajib" }, { status: 400 });
  try {
    return NextResponse.json({ status: await getTxnStatus(ref) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
