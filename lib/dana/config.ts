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

    // Payment Gateway
    pgMcc: env("DANA_PG_MCC", "5732") || "5732",
    // Widget (fixture SDK: 51051000100000000001)
    widgetProductCode: env("DANA_WIDGET_PRODUCT_CODE", "51051000100000000001") || "51051000100000000001",
    // Disbursement: nomor akun DANA merchant (628xx) untuk Transfer ke Bank
    disbursementCustomerNumber: env("DANA_DISBURSEMENT_CUSTOMER_NUMBER"),
    appUrl: env("APP_URL").replace(/\/+$/, ""),
    checkoutSecret: env("CHECKOUT_SECRET"),
    checkoutPublic: env("CHECKOUT_PUBLIC") === "true",
    merchantName: env("MERCHANT_NAME", "Toko Demo") || "Toko Demo",

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

/* ------------------------------------------------------------------ */
/* Kredensial per modul                                                 */
/* Di sandbox DANA, tiap produk sering punya merchant/client berbeda.   */
/* DANA_<MODUL>_PARTNER_ID / _MERCHANT_ID / _PRIVATE_KEY / _CLIENT_SECRET */
/* menimpa nilai global; kalau kosong → pakai DANA_PARTNER_ID, dst.     */
/* ------------------------------------------------------------------ */
export type DanaModule = "QRIS" | "PG" | "DISBURSEMENT" | "WIDGET";

export function getModuleCreds(module: DanaModule = "QRIS") {
  const cfg = getDanaConfig();
  const pick = (k: string, fallback: string) => env(`DANA_${module}_${k}`) || fallback;
  return {
    module,
    partnerId: pick("PARTNER_ID", cfg.partnerId),
    merchantId: pick("MERCHANT_ID", cfg.merchantId),
    privateKey: pick("PRIVATE_KEY", cfg.privateKey),
    clientSecret: pick("CLIENT_SECRET", env("DANA_CLIENT_SECRET")),
  };
}

export type ModuleCreds = ReturnType<typeof getModuleCreds>;

export function assertModuleCreds(c: ModuleCreds, opts: { merchant?: boolean } = {}) {
  const missing: string[] = [];
  if (!c.partnerId) missing.push(`DANA_${c.module}_PARTNER_ID / DANA_PARTNER_ID`);
  if (!c.privateKey) missing.push(`DANA_${c.module}_PRIVATE_KEY / DANA_PRIVATE_KEY`);
  if (opts.merchant !== false && !c.merchantId) missing.push(`DANA_${c.module}_MERCHANT_ID / DANA_MERCHANT_ID`);
  if (missing.length) throw new DanaConfigError(`Environment belum lengkap: ${missing.join(", ")}`);
}

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
    consultPay: "/v1.0/payment-gateway/consult-pay.htm",
    createOrder: "/payment-gateway/v1.0/debit/payment-host-to-host.htm",
    query: "/payment-gateway/v1.0/debit/status.htm",
    cancel: "/payment-gateway/v1.0/debit/cancel.htm",
    refund: "/payment-gateway/v1.0/debit/refund.htm",
  },
  disbursement: {
    danaAccountInquiry: "/rest/v1.0/emoney/account-inquiry",
    transferToDana: "/rest/v1.0/emoney/topup",
    transferToDanaStatus: "/rest/v1.0/emoney/topup-status",
    bankAccountInquiry: "/v1.0/emoney/bank-account-inquiry.htm",
    transferToBank: "/v1.0/emoney/transfer-bank.htm",
    transferToBankStatus: "/v1.0/emoney/transfer-bank-status.htm",
  },
  widget: {
    applyToken: "/v1.0/access-token/b2b2c.htm",
    applyOtt: "/rest/v1.1/qr/apply-ott",
    payment: "/rest/redirection/v1.0/debit/payment-host-to-host",
    query: "/rest/v1.1/debit/status",
    cancel: "/v1.0/debit/cancel.htm",
    refund: "/v1.0/debit/refund.htm",
    balance: "/v1.0/balance-inquiry.htm",
    unbinding: "/v1.0/registration-account-unbinding.htm",
    userProfile: "/dana/member/query/queryUserProfile.htm",
  },
    notify: "/v1.0/debit/notify",
} as const;

/** SNAP service codes */
export const SERVICE_CODE = {
  QRIS_MPM: "47",
  QRIS_CPM: "60",
  PAYMENT_GATEWAY: "54",
  WIDGET: "54",
  TRANSFER_TO_DANA: "38",
  TRANSFER_TO_BANK: "00",
} as const;
