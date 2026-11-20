import crypto from "crypto";
import { NextResponse } from "next/server";
import { DANA_PATHS, getDanaConfig } from "@/lib/dana/config";
import { saveTxnStatus, saveWebhook } from "@/lib/dana/store";
import { jakartaTimestamp } from "@/lib/dana/utils";
import { verifyWebhookSignature } from "@/lib/dana/webhook";
import { TX_STATUS } from "@/lib/dana/qris";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DANA Finish Notify (webhook)
 * URL publik: https://<domain>/v1.0/debit/notify  (di-rewrite ke route ini lewat next.config.mjs)
 * Response sukses wajib: {"responseCode":"2005600","responseMessage":"Successful"}
 */
export async function POST(req: Request) {
  const cfg = getDanaConfig();
  const rawBody = await req.text();
  const timestamp = req.headers.get("x-timestamp");
  const signature = req.headers.get("x-signature");

  const candidatePaths = Array.from(
    new Set([cfg.webhookPath, DANA_PATHS.notify, new URL(req.url).pathname, "/api/dana/notify"])
  );
  const verify = verifyWebhookSignature({ rawBody, timestamp, signature, candidatePaths });

  let body: Record<string, unknown> | null = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    body = null;
  }

  const amountObj = body?.amount as { value?: string } | undefined;
  const additional = body?.additionalInfo as { paidTime?: string } | undefined;
  const ref = body?.originalPartnerReferenceNo as string | undefined;
  const status = body?.latestTransactionStatus as string | undefined;

  try {
    await saveWebhook({
      id: crypto.randomUUID(),
      receivedAt: new Date().toISOString(),
      verified: verify.valid,
      verifyError: verify.error,
      matchedPath: verify.matchedPath,
      partnerReferenceNo: ref,
      referenceNo: body?.originalReferenceNo as string | undefined,
      status,
      amount: amountObj?.value,
      headers: {
        "x-timestamp": timestamp ?? "",
        "x-partner-id": req.headers.get("x-partner-id") ?? "",
        "x-external-id": req.headers.get("x-external-id") ?? "",
        "channel-id": req.headers.get("channel-id") ?? "",
      },
      body: body ?? rawBody,
    });

    // Hanya update status transaksi jika signature valid
    if ((verify.valid || cfg.webhookSkipVerify) && ref) {
      await saveTxnStatus({
        partnerReferenceNo: ref,
        referenceNo: body?.originalReferenceNo as string | undefined,
        status,
        statusDesc: status ? TX_STATUS[status] ?? (body?.transactionStatusDesc as string) : undefined,
        amount: amountObj?.value,
        paidTime: additional?.paidTime,
        updatedAt: new Date().toISOString(),
        source: "webhook",
      });
    }
  } catch (e) {
    console.error("[dana:notify] store error", e);
    // Storage gagal → minta DANA retry
    return NextResponse.json(
      { responseCode: "5005601", responseMessage: "Internal Server Error" },
      { status: 500, headers: { "X-TIMESTAMP": jakartaTimestamp() } }
    );
  }

  if (!verify.valid && !cfg.webhookSkipVerify) {
    console.warn("[dana:notify] invalid signature", verify.error);
    return NextResponse.json(
      { responseCode: "4015600", responseMessage: "Unauthorized. Invalid Signature" },
      { status: 401, headers: { "X-TIMESTAMP": jakartaTimestamp() } }
    );
  }

  return NextResponse.json(
    { responseCode: "2005600", responseMessage: "Successful" },
    { status: 200, headers: { "X-TIMESTAMP": jakartaTimestamp() } }
  );
}
