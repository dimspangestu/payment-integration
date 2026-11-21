import { NextResponse } from "next/server";
import {
  bankAccountInquiry,
  danaAccountInquiry,
  transferToBank,
  transferToBankStatus,
  transferToDana,
  transferToDanaStatus,
} from "@/lib/dana/disbursement";
import { handleError, readJson, respond } from "@/lib/dana/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */
const ACTIONS: Record<string, (b: any) => Promise<any>> = {
  "dana-inquiry": danaAccountInquiry,
  "dana-transfer": transferToDana,
  "dana-status": transferToDanaStatus,
  "bank-inquiry": bankAccountInquiry,
  "bank-transfer": transferToBank,
  "bank-status": transferToBankStatus,
};

export async function POST(req: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  const fn = ACTIONS[action];
  if (!fn) return NextResponse.json({ ok: false, responseCode: "NOT_FOUND", responseMessage: `Aksi ${action} tidak dikenal` }, { status: 404 });
  try {
    const result = await fn(await readJson(req));
    if (!result.ok) console.warn(`[disbursement:${action}] DANA menolak`, result.responseCode, result.responseMessage);
    return respond(result);
  } catch (e) {
    return handleError(e);
  }
}
