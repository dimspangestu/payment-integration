import { NextResponse } from "next/server";
import { clearWebhooks, listWebhooks, storeMode } from "@/lib/dana/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || 50, 200);
  try {
    return NextResponse.json({ storeMode, items: await listWebhooks(limit) });
  } catch (e) {
    return NextResponse.json({ storeMode, items: [], error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE() {
  await clearWebhooks();
  return NextResponse.json({ ok: true });
}
