import { NextResponse } from "next/server";
import { baseUrl, notifyUrlFor } from "@/lib/checkout-token";
import { clientIp, handleError, readJson, respond } from "@/lib/dana/route-helpers";
import { saveTxnStatus } from "@/lib/dana/store";
import { DanaInputError, generateRef, requireString } from "@/lib/dana/utils";
import {
  DeviceContext,
  applyToken,
  balanceInquiry,
  oauthUrl,
  queryUserProfile,
  unbinding,
  widgetCancel,
  widgetPayment,
  widgetQuery,
  widgetRefund,
} from "@/lib/dana/widget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function device(req: Request, b: Record<string, unknown>): DeviceContext {
  return {
    ip: clientIp(req),
    deviceId: (req.headers.get("user-agent") || "DANA-Console-Web").slice(0, 64),
    latitude: typeof b.latitude === "string" ? b.latitude : undefined,
    longitude: typeof b.longitude === "string" ? b.longitude : undefined,
  };
}

const token = (b: Record<string, unknown>) => requireString(b.accessToken, "accessToken (binding dulu)");

export async function POST(req: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  try {
    const b = await readJson(req);
    const d = device(req, b);
    switch (action) {
      case "oauth-url": {
        const { url, state } = oauthUrl({ redirectUrl: `${baseUrl(req)}/widget/callback`, mobile: b.mobile as string });
        return NextResponse.json({ ok: true, url, state });
      }
      case "token":
        return respond(await applyToken({ authCode: b.authCode as string, refreshToken: b.refreshToken as string }));
      case "payment": {
        const ref = generateRef("WGT");
        const r = await widgetPayment({
          partnerReferenceNo: ref,
          amount: b.amount as string,
          orderTitle: (b.orderTitle as string) || "Pembayaran",
          validMinutes: Number(b.validMinutes) || 15,
          accessToken: (b.accessToken as string) || undefined,
          device: d,
          returnUrl: `${baseUrl(req)}/checkout/result?ref=${ref}`,
          notifyUrl: notifyUrlFor(req),
        });
        if (r.ok && r.meta?.partnerReferenceNo) {
          await saveTxnStatus({
            partnerReferenceNo: String(r.meta.partnerReferenceNo),
            referenceNo: r.data.referenceNo,
            status: "01",
            statusDesc: "INITIATED",
            amount: String(r.meta.amount),
            updatedAt: new Date().toISOString(),
            source: "query",
          }).catch(() => {});
        }
        if (!r.ok) console.warn("[widget:payment] DANA menolak", r.responseCode, r.responseMessage, JSON.stringify(r.request?.body));
        return respond(r);
      }
      case "balance":
        return respond(await balanceInquiry(token(b), d));
      case "profile":
        return respond(await queryUserProfile(token(b)));
      case "unbinding":
        return respond(await unbinding(token(b), d));
      case "query":
        return respond(await widgetQuery({ originalPartnerReferenceNo: b.originalPartnerReferenceNo as string, originalReferenceNo: b.originalReferenceNo as string }));
      case "cancel":
        return respond(await widgetCancel({ originalPartnerReferenceNo: b.originalPartnerReferenceNo as string, originalReferenceNo: b.originalReferenceNo as string, reason: b.reason as string }));
      case "refund":
        return respond(
          await widgetRefund({
            originalPartnerReferenceNo: b.originalPartnerReferenceNo as string,
            originalReferenceNo: b.originalReferenceNo as string,
            amount: b.amount as string,
            reason: b.reason as string,
          })
        );
      default:
        throw new DanaInputError(`Aksi ${action} tidak dikenal`);
    }
  } catch (e) {
    return handleError(e);
  }
}
