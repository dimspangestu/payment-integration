import "server-only";
import { danaPost } from "../client";
import { DANA_PATHS, SERVICE_CODE, getDanaConfig } from "../config";
import { DanaInputError, clean, generateRef, jakartaTimestampPlus, money, optionalString, requireString } from "../utils";
import { PG_STATUS, SANDBOX_ALLOWED_PAY_METHODS, describeMethod, payOptionAllowedInSandbox } from "./methods";

/**
 * DANA Payment Gateway (Gapura)
 *  - Hosted  : CreateOrderByRedirectRequest  (scenario REDIRECT) → webRedirectUrl ke cashier DANA
 *  - Custom  : CreateOrderByApiRequest       (scenario API)      → paymentCode (VA / QRIS) atau webRedirectUrl
 *  - Consult Pay, Query (serviceCode 54), Cancel, Refund
 * Struktur body & aturan validasi mengikuti SDK resmi dana-python (Okt 2026).
 */

const SANDBOX_MAX_AMOUNT = 10_000_000;
// SDK: sandbox maks 30 menit. Pakai 25 agar tidak lewat batas karena selisih jam server.
const SANDBOX_MAX_VALID_MINUTES = 25;

export interface Goods {
  name: string;
  price: string | number;
  quantity?: number;
  category?: string;
}

export interface OrderInput {
  amount: string | number;
  orderTitle: string;
  goods?: Goods[];
  validMinutes?: number;
  externalStoreId?: string;
  buyerName?: string;
  buyerId?: string;
  /** URL tujuan setelah bayar (PAY_RETURN) */
  returnUrl: string;
  /** URL webhook (NOTIFICATION) */
  notifyUrl: string;
  clientIp?: string;
  /** Hosted saja: sembunyikan metode tertentu, mis. "VIRTUAL_ACCOUNT,NETWORK_PAY" */
  disabledPayMethods?: string;
}

export interface CustomOrderInput extends OrderInput {
  /** opsional: kalau tidak diisi dibuat otomatis (maks 25 char untuk QRIS) */
  partnerReferenceNo?: string;
  payMethod: string;
  payOption?: string;
  phoneNumber?: string;
}

/** IP valid untuk envInfo.clientIp (maks 32 char di SDK → IPv6 panjang dibuang) */
function safeClientIp(ip?: string) {
  const v = (ip || "").trim();
  if (!v || v.length > 32) return undefined;
  return /^[0-9a-fA-F:.]+$/.test(v) ? v : undefined;
}

/** Hanya field yang dipakai fixture SDK + field opsional yang aman */
function envInfo(clientIp?: string) {
  return clean({
    sourcePlatform: "IPG",
    terminalType: "SYSTEM",
    orderTerminalType: "WEB",
    clientIp: safeClientIp(clientIp),
  });
}

function validateAmount(amount: string | number) {
  const m = money(amount);
  const cfg = getDanaConfig();
  if (cfg.isSandbox && Number(m.value) > SANDBOX_MAX_AMOUNT) {
    throw new DanaInputError(`Sandbox: amount maksimal Rp${SANDBOX_MAX_AMOUNT.toLocaleString("id-ID")}`);
  }
  return m;
}

function validUpTo(minutes?: number) {
  const cfg = getDanaConfig();
  let m = Math.round(Number(minutes) || 15);
  // detik dibulatkan ke bawah lewat jakartaTimestampPlus; margin ekstra ada di SANDBOX_MAX_VALID_MINUTES
  if (m < 1) m = 1;
  if (cfg.isSandbox && m > SANDBOX_MAX_VALID_MINUTES) m = SANDBOX_MAX_VALID_MINUTES;
  if (m > 7 * 24 * 60) m = 7 * 24 * 60;
  return jakartaTimestampPlus(m);
}

function buildOrder(input: OrderInput, scenario: "API" | "REDIRECT") {
  const goods = (input.goods ?? [])
    .filter((g) => g && g.name)
    .map((g, i) => {
      const name = String(g.name).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 64);
      return {
        name,
        merchantGoodsId: `G${i + 1}`,
        description: name,
        category: (g.category || "GENERAL").slice(0, 64),
        price: money(g.price),
        quantity: String(Math.max(1, Math.round(Number(g.quantity ?? 1)))),
      };
    });
  const buyer =
    input.buyerId || input.buyerName
      ? clean({
          externalUserId: optionalString(input.buyerId),
          externalUserType: input.buyerId ? "MERCHANT" : undefined,
          nickname: optionalString(input.buyerName),
        })
      : undefined;

  return clean({
    orderTitle: requireString(input.orderTitle, "orderTitle", 64),
    scenario,
    buyer,
    goods: goods.length ? goods : undefined,
  });
}

function urlParams(input: OrderInput) {
  return [
    { url: requireString(input.returnUrl, "returnUrl"), type: "PAY_RETURN", isDeeplink: "N" },
    { url: requireString(input.notifyUrl, "notifyUrl"), type: "NOTIFICATION", isDeeplink: "N" },
  ];
}

/* ------------------------------------------------------------------ */
/* Consult Pay — metode bayar yang tersedia untuk merchant             */
/* ------------------------------------------------------------------ */
export async function consultPay(input: { amount: string | number; externalStoreId?: string; buyerId?: string; clientIp?: string }) {
  const cfg = getDanaConfig();
  const externalStoreId = optionalString(input.externalStoreId) || cfg.externalStoreId || undefined;
  const body = clean({
    merchantId: cfg.merchantId,
    amount: validateAmount(input.amount),
    externalStoreId,
    additionalInfo: {
      buyer: input.buyerId ? { externalUserId: input.buyerId, externalUserType: "MERCHANT" } : undefined,
      envInfo: envInfo(input.clientIp),
    },
  });
  const result = await danaPost<{ paymentInfos?: { payMethod: string; payOption?: string }[] }>(DANA_PATHS.paymentGateway.consultPay, body);
  const infos = result.data?.paymentInfos ?? [];
  const seen = new Set<string>();
  const methods = infos
    .map((p) => describeMethod(p.payMethod, p.payOption ?? ""))
    .filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
  result.meta = { methods };
  return result;
}

/* ------------------------------------------------------------------ */
/* Hosted — redirect ke halaman pembayaran DANA                        */
/* ------------------------------------------------------------------ */
export async function createHostedOrder(input: OrderInput & { partnerReferenceNo?: string }) {
  const cfg = getDanaConfig();
  const partnerReferenceNo = optionalString(input.partnerReferenceNo) || generateRef("PGH");
  const body = clean({
    partnerReferenceNo,
    merchantId: cfg.merchantId,
    amount: validateAmount(input.amount),
    externalStoreId: optionalString(input.externalStoreId) || cfg.externalStoreId || undefined,
    validUpTo: validUpTo(input.validMinutes),
    disabledPayMethods: optionalString(input.disabledPayMethods),
    urlParams: urlParams(input),
    additionalInfo: {
      mcc: cfg.pgMcc,
      envInfo: envInfo(input.clientIp),
      order: buildOrder(input, "REDIRECT"),
    },
  });
  const result = await danaPost<{ referenceNo?: string; webRedirectUrl?: string }>(DANA_PATHS.paymentGateway.createOrder, body);
  result.meta = { partnerReferenceNo, amount: body.amount.value, validUpTo: body.validUpTo, mode: "HOSTED" };
  return result;
}

/* ------------------------------------------------------------------ */
/* Custom — merchant pilih metode & tampilkan instruksi sendiri        */
/* ------------------------------------------------------------------ */
export async function createCustomOrder(input: CustomOrderInput) {
  const cfg = getDanaConfig();
  const payMethod = requireString(input.payMethod, "payMethod");
  const payOption = optionalString(input.payOption) ?? "";
  const method = describeMethod(payMethod, payOption);
  const amount = validateAmount(input.amount);
  const externalStoreId = optionalString(input.externalStoreId) || cfg.externalStoreId || undefined;
  const phone = optionalString(input.phoneNumber)?.replace(/[^\d+]/g, "");

  // Validasi ala SDK (custom_validation.py)
  if (cfg.isSandbox) {
    if (!SANDBOX_ALLOWED_PAY_METHODS.has(payMethod)) throw new DanaInputError(`Sandbox: payMethod ${payMethod} tidak didukung`);
    if (!payOptionAllowedInSandbox(payOption)) throw new DanaInputError(`Sandbox: ${method.label} tidak tersedia`);
  }
  if (method.needsPhone || ["CARD", "CREDIT_CARD", "DEBIT_CARD"].includes(payMethod)) {
    if (!phone) throw new DanaInputError(`Nomor HP wajib untuk ${method.label}`);
    if (phone.length > 15) throw new DanaInputError("Nomor HP maksimal 15 karakter");
  }
  if (payOption === "NETWORK_PAY_PG_QRIS" && !externalStoreId) {
    throw new DanaInputError("QRIS butuh externalStoreId (set DANA_EXTERNAL_STORE_ID)");
  }

  const partnerReferenceNo = optionalString(input.partnerReferenceNo) || generateRef("PGC"); // 21 char (QRIS maks 25)
  if (payOption === "NETWORK_PAY_PG_QRIS" && partnerReferenceNo.length > 25) {
    throw new DanaInputError("partnerReferenceNo maksimal 25 karakter untuk QRIS");
  }
  const body = clean({
    partnerReferenceNo,
    merchantId: cfg.merchantId,
    amount,
    externalStoreId,
    validUpTo: validUpTo(input.validMinutes),
    urlParams: urlParams(input),
    payOptionDetails: [
      {
        payMethod,
        payOption,
        transAmount: amount,
        additionalInfo: phone ? { phoneNumber: phone } : undefined,
      },
    ],
    additionalInfo: {
      mcc: cfg.pgMcc,
      envInfo: envInfo(input.clientIp),
      order: buildOrder(input, "API"),
    },
  });

  const result = await danaPost<{ referenceNo?: string; webRedirectUrl?: string; additionalInfo?: { paymentCode?: string } }>(
    DANA_PATHS.paymentGateway.createOrder,
    body
  );
  result.meta = {
    partnerReferenceNo,
    amount: amount.value,
    validUpTo: body.validUpTo,
    mode: "CUSTOM",
    method,
    paymentCode: result.data?.additionalInfo?.paymentCode,
    webRedirectUrl: result.data?.webRedirectUrl,
  };
  return result;
}

/* ------------------------------------------------------------------ */
/* Query / Cancel / Refund                                              */
/* ------------------------------------------------------------------ */
export async function queryPg(input: { originalPartnerReferenceNo?: string; originalReferenceNo?: string }) {
  const cfg = getDanaConfig();
  const originalPartnerReferenceNo = optionalString(input.originalPartnerReferenceNo);
  const originalReferenceNo = optionalString(input.originalReferenceNo);
  if (!originalPartnerReferenceNo && !originalReferenceNo) throw new DanaInputError("Isi partnerReferenceNo atau referenceNo");
  const body = clean({ originalPartnerReferenceNo, originalReferenceNo, serviceCode: SERVICE_CODE.PAYMENT_GATEWAY, merchantId: cfg.merchantId });
  const result = await danaPost<{ latestTransactionStatus?: string; transactionStatusDesc?: string }>(DANA_PATHS.paymentGateway.query, body);
  const st = result.data?.latestTransactionStatus;
  result.meta = { statusLabel: st ? PG_STATUS[st]?.label ?? st : undefined };
  return result;
}

export async function cancelPg(input: { originalPartnerReferenceNo: string; originalReferenceNo?: string; reason?: string; amount?: string | number }) {
  const cfg = getDanaConfig();
  const body = clean({
    originalPartnerReferenceNo: requireString(input.originalPartnerReferenceNo, "originalPartnerReferenceNo", 64),
    originalReferenceNo: optionalString(input.originalReferenceNo),
    merchantId: cfg.merchantId,
    reason: optionalString(input.reason) || "Cancel from dashboard",
    amount: input.amount ? money(input.amount) : undefined,
  });
  return danaPost(DANA_PATHS.paymentGateway.cancel, body);
}

export async function refundPg(input: { originalPartnerReferenceNo: string; originalReferenceNo?: string; amount: string | number; reason?: string }) {
  const cfg = getDanaConfig();
  const partnerRefundNo = generateRef("PGR");
  const refundAmount = money(input.amount);
  const body = clean({
    merchantId: cfg.merchantId,
    originalPartnerReferenceNo: requireString(input.originalPartnerReferenceNo, "originalPartnerReferenceNo", 64),
    originalReferenceNo: optionalString(input.originalReferenceNo),
    partnerRefundNo,
    refundAmount,
    reason: optionalString(input.reason) || "Refund from dashboard",
    additionalInfo: {
      actorType: cfg.refundActorType,
      actorContext: { actorId: cfg.refundActorId, actorType: cfg.refundActorType },
      envInfo: envInfo(),
    },
  });
  const result = await danaPost<{ refundNo?: string; refundTime?: string }>(DANA_PATHS.paymentGateway.refund, body);
  result.meta = { partnerRefundNo, amount: refundAmount.value };
  return result;
}
