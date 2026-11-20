import "server-only";
import { danaPost } from "../client";
import { DANA_PATHS, SERVICE_CODE, getDanaConfig } from "../config";
import {
  DanaInputError,
  clean,
  formatAmount,
  generateRef,
  jakartaTimestampPlus,
  money,
  optionalString,
  requireString,
} from "../utils";

const ENV_INFO = { sourcePlatform: "IPG", terminalType: "SYSTEM", orderTerminalType: "APP" };

/* ------------------------------------------------------------------ */
/* MPM — Generate QRIS (merchant menampilkan QR, user scan)            */
/* ------------------------------------------------------------------ */
export interface MpmInput {
  amount: string | number;
  storeId?: string;
  /** menit, opsional → validityPeriod */
  validityMinutes?: number;
}

export async function generateMpm(input: MpmInput) {
  const cfg = getDanaConfig();
  const storeId = optionalString(input.storeId) || cfg.storeId;
  if (!storeId) throw new DanaInputError("storeId wajib diisi (atau set DANA_STORE_ID)");

  const partnerReferenceNo = generateRef("MPM");
  const body = clean({
    merchantId: cfg.merchantId,
    partnerReferenceNo,
    amount: money(input.amount),
    storeId,
    validityPeriod: input.validityMinutes ? jakartaTimestampPlus(input.validityMinutes) : undefined,
    additionalInfo: {
      terminalSource: "MER",
      envInfo: ENV_INFO,
    },
  });

  const result = await danaPost<{
    qrContent?: string;
    qrUrl?: string;
    qrImage?: string;
    referenceNo?: string;
    redirectUrl?: string;
  }>(DANA_PATHS.qris.mpmGenerate, body);
  result.meta = { partnerReferenceNo, amount: body.amount.value, storeId, type: "MPM" };
  return result;
}

/* ------------------------------------------------------------------ */
/* CPM — merchant scan QR dari aplikasi user                            */
/* ------------------------------------------------------------------ */
export interface CpmInput {
  qrContent: string;
  amount: string | number;
  qrContentType?: string;
  externalStoreId?: string;
  deviceIp?: string;
}

export async function payCpm(input: CpmInput) {
  const cfg = getDanaConfig();
  const qrContent = requireString(input.qrContent, "qrContent");
  const externalStoreId = optionalString(input.externalStoreId) || cfg.externalStoreId;
  if (!externalStoreId) throw new DanaInputError("externalStoreId wajib (set DANA_EXTERNAL_STORE_ID)");

  const partnerReferenceNo = generateRef("CPM");
  const amount = money(input.amount);

  const body = clean({
    partnerReferenceNo,
    qrContent,
    amount,
    merchantId: cfg.merchantId,
    title: cfg.cpmTitle,
    expiryTime: jakartaTimestampPlus(15),
    externalStoreId,
    scannerInfo: {
      deviceId: cfg.cpmDeviceId,
      deviceIp: input.deviceIp || "127.0.0.1",
    },
    additionalInfo: {
      qrContentType: input.qrContentType || "BAR_CODE",
      mcc: cfg.cpmMcc,
      productCode: cfg.cpmProductCode,
      notifyUrl: cfg.notifyUrl || undefined,
      envInfo: ENV_INFO,
    },
  });

  const result = await danaPost<{ referenceNo?: string; transactionDate?: string }>(DANA_PATHS.qris.cpmPayment, body);
  result.meta = { partnerReferenceNo, amount: amount.value, type: "CPM" };
  return result;
}

/* ------------------------------------------------------------------ */
/* Query status                                                         */
/* ------------------------------------------------------------------ */
export interface QueryInput {
  type: "MPM" | "CPM";
  originalPartnerReferenceNo?: string;
  originalReferenceNo?: string;
}

export const TX_STATUS: Record<string, string> = {
  "00": "SUCCESS",
  "01": "INITIATED",
  "02": "PAYING",
  "05": "CANCELLED",
  "07": "NOT_FOUND",
};

export async function queryPayment(input: QueryInput) {
  const cfg = getDanaConfig();
  const originalPartnerReferenceNo = optionalString(input.originalPartnerReferenceNo);
  const originalReferenceNo = optionalString(input.originalReferenceNo);
  if (!originalPartnerReferenceNo && !originalReferenceNo) {
    throw new DanaInputError("Isi partnerReferenceNo atau referenceNo");
  }
  if (originalPartnerReferenceNo && originalPartnerReferenceNo.length > 25) {
    throw new DanaInputError("originalPartnerReferenceNo QRIS maksimal 25 karakter");
  }

  const body = clean({
    originalPartnerReferenceNo,
    originalReferenceNo,
    serviceCode: input.type === "CPM" ? SERVICE_CODE.QRIS_CPM : SERVICE_CODE.QRIS_MPM,
    merchantId: cfg.merchantId,
  });

  const result = await danaPost<{ latestTransactionStatus?: string; transactionStatusDesc?: string }>(
    DANA_PATHS.qris.query,
    body
  );
  const st = result.data?.latestTransactionStatus;
  result.meta = { statusLabel: st ? TX_STATUS[st] ?? st : undefined };
  return result;
}

/* ------------------------------------------------------------------ */
/* Cancel                                                               */
/* ------------------------------------------------------------------ */
export interface CancelInput {
  originalPartnerReferenceNo: string;
  originalReferenceNo?: string;
  amount?: string | number;
  reason?: string;
}

export async function cancelPayment(input: CancelInput) {
  const cfg = getDanaConfig();
  const body = clean({
    originalPartnerReferenceNo: requireString(input.originalPartnerReferenceNo, "originalPartnerReferenceNo", 64),
    originalReferenceNo: optionalString(input.originalReferenceNo),
    merchantId: cfg.merchantId,
    reason: optionalString(input.reason) || "Cancel from dashboard",
    amount: input.amount ? money(input.amount) : undefined,
  });
  return danaPost(DANA_PATHS.qris.cancel, body);
}

/* ------------------------------------------------------------------ */
/* Refund                                                               */
/* ------------------------------------------------------------------ */
export interface RefundInput {
  originalPartnerReferenceNo: string;
  originalReferenceNo?: string;
  amount: string | number;
  reason?: string;
}

export async function refundPayment(input: RefundInput) {
  const cfg = getDanaConfig();
  const partnerRefundNo = generateRef("RFD");
  const refundAmount = money(input.amount);

  const body = clean({
    merchantId: cfg.merchantId,
    originalPartnerReferenceNo: requireString(input.originalPartnerReferenceNo, "originalPartnerReferenceNo", 64),
    originalReferenceNo: optionalString(input.originalReferenceNo),
    partnerRefundNo,
    refundAmount,
    reason: optionalString(input.reason) || "Refund from dashboard",
    additionalInfo: {
      envInfo: ENV_INFO,
      actorContext: { actorId: cfg.refundActorId, actorType: cfg.refundActorType },
      refundOptionBill: cfg.refundPayMethod
        ? [{ payMethod: cfg.refundPayMethod, transAmount: refundAmount }]
        : undefined,
    },
  });

  const result = await danaPost<{ refundNo?: string; refundTime?: string }>(DANA_PATHS.qris.refund, body);
  result.meta = { partnerRefundNo, amount: formatAmount(input.amount) };
  return result;
}
