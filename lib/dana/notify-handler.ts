import "server-only";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { DANA_PATHS, getDanaConfig } from "@/lib/dana/config";
import { saveTxnStatus, saveWebhook } from "@/lib/dana/store";
import { jakartaTimestamp } from "@/lib/dana/utils";
import { verifyWebhookSignature } from "@/lib/dana/webhook";
import { TX_STATUS } from "@/lib/dana/qris";


function pathOf(url: string | undefined) {
  if (!url) return undefined;
  try {
    return new URL(url).pathname;
  } catch {
    return url.startsWith("/") ? url : undefined;
  }
}

/**
 * DANA Finish Notify (webhook)
 * URL publik: https://<domain>/v1.0/debit/notify  (di-rewrite ke route ini lewat next.config.ts)
 * Response sukses wajib: {"responseCode":"2005600","responseMessage":"Successful"}
 *
 * Transfer to Bank Notify memakai handler yang sama:
 * URL publik: https://<domain>/v1.0/debit/emoney/transfer-bank/notify.htm  (→ /api/dana/notify/transfer-bank)
 * Kode respons: 2004300 sukses, 4014300 signature salah, 5004301 error server
 */
/** Kode respons per jenis notify (service code 56 = Finish Notify, 43 = Transfer to Bank Notify) */
const CODES = {
  finish: { ok: "2005600", unauthorized: "4015600", error: "5005601" },
  "transfer-bank": { ok: "2004300", unauthorized: "4014300", error: "5004301" },
} as const;

export type NotifyKind = keyof typeof CODES;

export async function handleNotify(req: Request, kind: NotifyKind) {
  const codes = CODES[kind];
  const cfg = getDanaConfig();
  // Raw body persis seperti dikirim DANA — JANGAN pakai req.json() sebelum verifikasi
  const rawBody = await req.text();
  const timestamp = req.headers.get("x-timestamp");
  const signature = req.headers.get("x-signature");

  const candidatePaths = Array.from(
    new Set(
      [
        kind === "transfer-bank" ? "/v1.0/debit/emoney/transfer-bank/notify.htm" : undefined,
        cfg.webhookPath,
        DANA_PATHS.notify,
        pathOf(cfg.notifyUrl),
        new URL(req.url).pathname,
        "/api/dana/notify",
      ].filter((p): p is string => Boolean(p))
    )
  );
  const verify = verifyWebhookSignature({ rawBody, timestamp, signature, candidatePaths });

  let body: Record<string, unknown> | null = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    body = null;
  }

  const amountObj = body?.amount as { value?: string } | undefined;
  const additional = body?.additionalInfo as { paidTime?: string; paymentInfo?: { paidTime?: string } } | undefined;
  const ref = body?.originalPartnerReferenceNo as string | undefined;
  const status = body?.latestTransactionStatus as string | undefined;

  try {
    await saveWebhook({
      id: crypto.randomUUID(),
      receivedAt: new Date().toISOString(),
      verified: verify.valid,
      verifyError: verify.error,
      matchedPath: verify.matchedPath,
      matchedKey: verify.matchedKey,
      matchedForm: verify.matchedForm,
      partnerReferenceNo: ref,
      referenceNo: body?.originalReferenceNo as string | undefined,
      status,
      amount: amountObj?.value,
      headers: {
        "x-timestamp": timestamp ?? "",
        "x-signature": signature ?? "",
        "x-partner-id": req.headers.get("x-partner-id") ?? "",
        "x-external-id": req.headers.get("x-external-id") ?? "",
        "channel-id": req.headers.get("channel-id") ?? "",
        "content-type": req.headers.get("content-type") ?? "",
        kind,
      },
      verifyDebug: verify.debug,
      // raw disimpan hanya saat gagal verifikasi, untuk investigasi
      rawBody: verify.valid ? undefined : rawBody,
      body: body ?? rawBody,
    });

    if ((verify.valid || cfg.webhookSkipVerify) && ref) {
      await saveTxnStatus({
        partnerReferenceNo: ref,
        referenceNo: body?.originalReferenceNo as string | undefined,
        status,
        statusDesc: status ? TX_STATUS[status] ?? (body?.transactionStatusDesc as string) : undefined,
        amount: amountObj?.value,
        paidTime: additional?.paidTime ?? additional?.paymentInfo?.paidTime,
        updatedAt: new Date().toISOString(),
        source: "webhook",
      });
    }
  } catch (e) {
    console.error("[dana:notify] store error", e);
    return NextResponse.json(
      { responseCode: codes.error, responseMessage: "Internal Server Error" },
      { status: 500, headers: { "X-TIMESTAMP": jakartaTimestamp() } }
    );
  }

  if (!verify.valid && !cfg.webhookSkipVerify) {
    console.warn("[dana:notify] invalid signature", verify.error, verify.debug);
    return NextResponse.json(
      { responseCode: codes.unauthorized, responseMessage: "Unauthorized. Invalid Signature" },
      { status: 401, headers: { "X-TIMESTAMP": jakartaTimestamp() } }
    );
  }

  return NextResponse.json(
    { responseCode: codes.ok, responseMessage: "Successful" },
    { status: 200, headers: { "X-TIMESTAMP": jakartaTimestamp() } }
  );
}
