import { NextResponse } from "next/server";
import { getDanaConfig } from "@/lib/dana/config";
import { storeMode } from "@/lib/dana/store";
import { authMode } from "@/lib/captcha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mask = (s: string) => (s.length > 8 ? `${s.slice(0, 4)}••••${s.slice(-4)}` : s ? "••••" : "");

/** Info konfigurasi non-rahasia untuk UI */
export async function GET() {
  const c = getDanaConfig();
  return NextResponse.json({
    env: c.env,
    baseUrl: c.baseUrl,
    merchantId: mask(c.merchantId),
    partnerId: mask(c.partnerId),
    defaultStoreId: c.storeId,
    defaultExternalStoreId: c.externalStoreId,
    webhookPath: c.webhookPath,
    storeMode,
    authMode: authMode(),
    authEnabled: authMode() === "captcha" || (authMode() === "basic" && Boolean(process.env.DASHBOARD_PASSWORD)),
    configured: {
      partnerId: Boolean(c.partnerId),
      merchantId: Boolean(c.merchantId),
      privateKey: Boolean(c.privateKey),
      publicKey: Boolean(c.publicKey) || c.isSandbox,
    },
  });
}
