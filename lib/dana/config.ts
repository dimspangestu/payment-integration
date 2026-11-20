import "server-only";

export class DanaConfigError extends Error {}

function env(name: string, fallback = ""): string {
  let v = process.env[name] ?? fallback;
  v = v.trim();
  // Vercel kadang menyimpan nilai dengan tanda kutip
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

const BASE_URLS: Record<string, string> = {
  sandbox: "https://api.sandbox.dana.id",
  production: "https://api.saas.dana.id",
};

export function getDanaConfig() {
  const danaEnv = (env("DANA_ENV", "sandbox") || "sandbox").toLowerCase();
  return {
    env: danaEnv,
    isSandbox: danaEnv !== "production",
    baseUrl: (env("DANA_BASE_URL") || BASE_URLS[danaEnv] || BASE_URLS.sandbox).replace(/\/+$/, ""),
    partnerId: env("DANA_PARTNER_ID"),
    merchantId: env("DANA_MERCHANT_ID"),
    channelId: env("DANA_CHANNEL_ID", "95221") || "95221",
    origin: env("DANA_ORIGIN"),
    privateKey: env("DANA_PRIVATE_KEY"),
    publicKey: env("DANA_PUBLIC_KEY"),
    timeoutMs: Number(env("DANA_TIMEOUT_MS", "15000")) || 15000,
    debug: env("DANA_DEBUG") === "true",

    // QRIS defaults
    storeId: env("DANA_STORE_ID"),
    externalStoreId: env("DANA_EXTERNAL_STORE_ID"),
    cpmProductCode: env("DANA_CPM_PRODUCT_CODE", "51051000100000000040"),
    cpmMcc: env("DANA_CPM_MCC", "5732"),
    cpmTitle: env("DANA_CPM_TITLE", "QRIS CPM Payment"),
    cpmDeviceId: env("DANA_CPM_DEVICE_ID", "WEB-DASHBOARD"),
    notifyUrl: env("DANA_NOTIFY_URL"),

    // Refund
    refundActorId: env("DANA_REFUND_ACTOR_ID", "DASHBOARD"),
    refundActorType: env("DANA_REFUND_ACTOR_TYPE", "BACK_OFFICE"),
    refundPayMethod: env("DANA_REFUND_PAY_METHOD"),

    // Webhook
    webhookPath: env("DANA_WEBHOOK_PATH", "/v1.0/debit/notify") || "/v1.0/debit/notify",
    webhookSkipVerify: env("DANA_WEBHOOK_SKIP_VERIFY") === "true",
  };
}

export type DanaConfig = ReturnType<typeof getDanaConfig>;

export function assertCoreConfig(cfg: DanaConfig) {
  const missing: string[] = [];
  if (!cfg.partnerId) missing.push("DANA_PARTNER_ID");
  if (!cfg.merchantId) missing.push("DANA_MERCHANT_ID");
  if (!cfg.privateKey) missing.push("DANA_PRIVATE_KEY");
  if (missing.length) {
    throw new DanaConfigError(`Environment belum lengkap: ${missing.join(", ")}`);
  }
}

/** API paths — semua path DANA di satu tempat */
export const DANA_PATHS = {
  qris: {
    mpmGenerate: "/v1.0/qr/qr-mpm-generate.htm",
    cpmPayment: "/v1.0/qr/qr-cpm-payment.htm",
    query: "/rest/v1.1/debit/status",
    cancel: "/v1.0/debit/cancel.htm",
    refund: "/v1.0/debit/refund.htm",
  },
  // Disiapkan untuk modul Payment Gateway (Gapura)
  paymentGateway: {
    createOrder: "/payment-gateway/v1.0/debit/payment-host-to-host.htm",
    query: "/payment-gateway/v1.0/debit/status.htm",
    cancel: "/payment-gateway/v1.0/debit/cancel.htm",
    refund: "/payment-gateway/v1.0/debit/refund.htm",
  },
  notify: "/v1.0/debit/notify",
} as const;

/** SNAP service codes */
export const SERVICE_CODE = {
  QRIS_MPM: "47",
  QRIS_CPM: "60",
  PAYMENT_GATEWAY: "54",
} as const;
