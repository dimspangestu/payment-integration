import "server-only";
import crypto from "crypto";
import { danaOpenApiPost, danaPost } from "../client";
import { DANA_PATHS, SERVICE_CODE, getDanaConfig, getModuleCreds } from "../config";
import { signRaw } from "../signature";
import { DanaInputError, clean, generateRef, jakartaTimestamp, jakartaTimestampPlus, money, optionalString, requireString } from "../utils";

/**
 * DANA Widget (SDK dana-python: dana.widget.v1) — port dari WidgetApi + widget/v1/util.py
 *
 * Alur:
 *  1. oauthUrl()        → user login/izin di DANA → redirect ke /widget/callback?authCode=...&state=...
 *  2. applyToken()      → authCode ditukar accessToken (signature: clientKey|timestamp)
 *  3. widgetPayment()   → webRedirectUrl;  applyOtt(accessToken) → OTT;  URL bayar = webRedirectUrl + &ott=
 *  4. balance / profile / query / cancel / refund / unbinding
 */

const MOD = { module: "WIDGET" as const };

export interface DeviceContext {
  ip?: string;
  deviceId?: string;
  latitude?: string;
  longitude?: string;
}

/** Header khusus skenario customer token (SDK: apply_ott, unbinding_account, balance_inquiry) */
function customerHeaders(accessToken: string, d: DeviceContext, withIpAndGeo: boolean) {
  const h: Record<string, string> = {
    "Authorization-Customer": `Bearer ${accessToken}`,
    "X-DEVICE-ID": d.deviceId || "DANA-Console-Web",
  };
  if (withIpAndGeo) {
    h["X-IP-ADDRESS"] = d.ip || "127.0.0.1";
    if (d.latitude) h["X-LATITUDE"] = d.latitude;
    if (d.longitude) h["X-LONGITUDE"] = d.longitude;
  }
  return h;
}

function customerAdditionalInfo(accessToken: string, d: DeviceContext) {
  return clean({
    accessToken,
    endUserIpAddress: d.ip || "127.0.0.1",
    deviceId: d.deviceId || "DANA-Console-Web",
    latitude: d.latitude,
    longitude: d.longitude,
  });
}

const ipOk = (ip?: string) => (ip && ip.length <= 32 ? ip : undefined);

/* ---------------------------- 1. OAuth URL ---------------------------- */

const OAUTH_ESCAPE = new Set(["redirectUrl", "timestamp", "seamlessData", "seamlessSign"]);

export function oauthUrl(input: { redirectUrl: string; state?: string; mobile?: string; scopes?: string }) {
  const cfg = getDanaConfig();
  const creds = getModuleCreds("WIDGET");
  if (!creds.partnerId) throw new DanaInputError("DANA_WIDGET_PARTNER_ID / DANA_PARTNER_ID belum di-set");
  const base = cfg.isSandbox ? "https://m.sandbox.dana.id/v1.0/get-auth-code" : "https://m.dana.id/v1.0/get-auth-code";
  const scopes =
    input.scopes || cfg.widgetScopes || (cfg.isSandbox ? "CASHIER,AGREEMENT_PAY,QUERY_BALANCE,DEFAULT_BASIC_PROFILE,MINI_DANA" : "MINI_DANA,CASHIER,QUERY_BALANCE,DEFAULT_BASIC_PROFILE");
  const state = input.state || crypto.randomUUID();

  const params: Record<string, string> = {
    partnerId: creds.partnerId,
    scopes,
    externalId: crypto.randomUUID(),
    channelId: cfg.channelId.slice(0, 5),
    redirectUrl: requireString(input.redirectUrl, "redirectUrl"),
    timestamp: jakartaTimestamp(),
    state,
    isSnapBI: "true",
  };
  if (creds.merchantId && cfg.widgetOauthMerchant) params.merchantId = creds.merchantId;

  // seamlessData: prefill nomor HP di halaman login DANA (opsional), ditandatangani private key
  const mobile = optionalString(input.mobile)?.replace(/\D/g, "");
  if (mobile) {
    const seamless = JSON.stringify({ mobile: mobile.startsWith("0") ? "62" + mobile.slice(1) : mobile });
    params.seamlessData = seamless;
    params.seamlessSign = signRaw(creds.privateKey, seamless);
  }

  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${OAUTH_ESCAPE.has(k) ? encodeURIComponent(v) : v}`)
    .join("&");
  return { url: `${base}?${qs}`, state, params };
}

/* ---------------------------- 2. Apply Token ---------------------------- */

export async function applyToken(input: { authCode?: string; refreshToken?: string }) {
  const authCode = optionalString(input.authCode);
  const refreshToken = optionalString(input.refreshToken);
  if (!authCode && !refreshToken) throw new DanaInputError("authCode atau refreshToken wajib");
  const body = authCode ? { grantType: "AUTHORIZATION_CODE", authCode } : { grantType: "REFRESH_TOKEN", refreshToken };
  return danaPost<{
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiryTime?: string;
    refreshTokenExpiryTime?: string;
    additionalInfo?: { userInfo?: { publicUserId?: string } };
  }>(DANA_PATHS.widget.applyToken, body, { ...MOD, auth: "applyToken" });
}

/* ---------------------------- 3. Payment + OTT ---------------------------- */

export async function applyOtt(accessToken: string, d: DeviceContext) {
  const body = { userResources: ["OTT"], additionalInfo: customerAdditionalInfo(accessToken, d) };
  return danaPost<{ userResources?: { resourceType?: string; value?: string }[] }>(DANA_PATHS.widget.applyOtt, body, {
    ...MOD,
    requireMerchant: false,
    extraHeaders: customerHeaders(accessToken, d, true),
  });
}

/** Sama dengan Util.generate_complete_payment_url: tambahkan ?ott= ke webRedirectUrl */
export function completePaymentUrl(webRedirectUrl?: string, ott?: string) {
  if (!webRedirectUrl || !ott) return webRedirectUrl;
  const u = new URL(webRedirectUrl);
  u.searchParams.set("ott", ott);
  return u.toString();
}

export async function widgetPayment(input: {
  amount: string | number;
  orderTitle: string;
  returnUrl: string;
  notifyUrl: string;
  validMinutes?: number;
  accessToken?: string;
  device?: DeviceContext;
  partnerReferenceNo?: string;
}) {
  const cfg = getDanaConfig();
  const creds = getModuleCreds("WIDGET");
  const partnerReferenceNo = optionalString(input.partnerReferenceNo) || generateRef("WGT");
  let minutes = Math.max(1, Math.round(Number(input.validMinutes) || 15));
  if (cfg.isSandbox) minutes = Math.min(minutes, 25); // SDK: maks 30 menit di sandbox

  const body = clean({
    partnerReferenceNo,
    merchantId: creds.merchantId,
    amount: money(input.amount),
    validUpTo: jakartaTimestampPlus(minutes),
    urlParams: [
      { url: requireString(input.returnUrl, "returnUrl"), type: "PAY_RETURN", isDeeplink: "N" },
      { url: requireString(input.notifyUrl, "notifyUrl"), type: "NOTIFICATION", isDeeplink: "N" },
    ],
    additionalInfo: {
      productCode: cfg.widgetProductCode,
      mcc: cfg.pgMcc,
      order: { orderTitle: requireString(input.orderTitle, "orderTitle", 64), createdTime: jakartaTimestamp() },
      envInfo: { sourcePlatform: "IPG", terminalType: "SYSTEM", orderTerminalType: "WEB", clientIp: ipOk(input.device?.ip) },
    },
  });

  const r = await danaPost<{ referenceNo?: string; webRedirectUrl?: string }>(DANA_PATHS.widget.payment, body, MOD);
  let paymentUrl = r.data?.webRedirectUrl;
  let ottStatus: string | undefined;

  // Kalau user sudah binding: tambahkan OTT supaya tidak perlu login lagi di halaman DANA
  if (r.ok && input.accessToken && paymentUrl) {
    const ott = await applyOtt(input.accessToken, input.device ?? {});
    const value = ott.data?.userResources?.find((x) => x.resourceType === "OTT")?.value;
    ottStatus = ott.ok && value ? "OK" : `${ott.responseCode} ${ott.responseMessage}`;
    if (value) paymentUrl = completePaymentUrl(paymentUrl, value);
  }

  r.meta = { partnerReferenceNo, amount: body.amount.value, validUpTo: body.validUpTo, paymentUrl, ottStatus };
  return r;
}

/* ---------------------------- 4. Lainnya ---------------------------- */

export async function balanceInquiry(accessToken: string, d: DeviceContext) {
  const body = { partnerReferenceNo: generateRef("WBL"), balanceTypes: ["BALANCE"], additionalInfo: customerAdditionalInfo(accessToken, d) };
  return danaPost<{ accountInfos?: { balanceType?: string; amount?: { value: string }; availableBalance?: { value: string } }[] }>(
    DANA_PATHS.widget.balance,
    body,
    { ...MOD, requireMerchant: false, extraHeaders: customerHeaders(accessToken, d, false) }
  );
}

export async function queryUserProfile(accessToken: string, resources = ["MASK_DANA_ID", "NICKNAME", "BALANCE", "USER_KYC"]) {
  const r = await danaOpenApiPost(DANA_PATHS.widget.userProfile, "dana.member.query.queryUserProfile", { userResources: resources }, { ...MOD, accessToken });
  const info = (r.data as { response?: { body?: { resultInfo?: { resultCodeId?: string; resultMsg?: string; resultCode?: string } } } }).response?.body?.resultInfo;
  if (info) {
    r.responseCode = info.resultCodeId || info.resultCode || r.responseCode;
    r.responseMessage = info.resultMsg || r.responseMessage;
  }
  return r;
}

export async function unbinding(accessToken: string, d: DeviceContext) {
  const creds = getModuleCreds("WIDGET");
  const body = { merchantId: creds.merchantId, partnerReferenceNo: generateRef("WUB"), additionalInfo: customerAdditionalInfo(accessToken, d) };
  return danaPost(DANA_PATHS.widget.unbinding, body, { ...MOD, extraHeaders: customerHeaders(accessToken, d, true) });
}

export async function widgetQuery(input: { originalPartnerReferenceNo?: string; originalReferenceNo?: string }) {
  const creds = getModuleCreds("WIDGET");
  const originalPartnerReferenceNo = optionalString(input.originalPartnerReferenceNo);
  const originalReferenceNo = optionalString(input.originalReferenceNo);
  if (!originalPartnerReferenceNo && !originalReferenceNo) throw new DanaInputError("Isi partnerReferenceNo atau referenceNo");
  const body = clean({ originalPartnerReferenceNo, originalReferenceNo, serviceCode: SERVICE_CODE.WIDGET, merchantId: creds.merchantId });
  return danaPost<{ latestTransactionStatus?: string; transactionStatusDesc?: string }>(DANA_PATHS.widget.query, body, MOD);
}

export async function widgetCancel(input: { originalPartnerReferenceNo: string; originalReferenceNo?: string; reason?: string }) {
  const creds = getModuleCreds("WIDGET");
  const body = clean({
    originalPartnerReferenceNo: requireString(input.originalPartnerReferenceNo, "originalPartnerReferenceNo", 64),
    originalReferenceNo: optionalString(input.originalReferenceNo),
    merchantId: creds.merchantId,
    reason: optionalString(input.reason) || "Cancel from dashboard",
  });
  return danaPost(DANA_PATHS.widget.cancel, body, MOD);
}

export async function widgetRefund(input: { originalPartnerReferenceNo: string; originalReferenceNo?: string; amount: string | number; reason?: string }) {
  const cfg = getDanaConfig();
  const creds = getModuleCreds("WIDGET");
  const partnerRefundNo = generateRef("WRF");
  const body = clean({
    merchantId: creds.merchantId,
    originalPartnerReferenceNo: requireString(input.originalPartnerReferenceNo, "originalPartnerReferenceNo", 64),
    originalReferenceNo: optionalString(input.originalReferenceNo),
    partnerRefundNo,
    refundAmount: money(input.amount),
    reason: optionalString(input.reason) || "Refund from dashboard",
    additionalInfo: {
      actorType: cfg.refundActorType,
      envInfo: { sourcePlatform: "IPG", terminalType: "SYSTEM", orderTerminalType: "WEB" },
    },
  });
  const r = await danaPost<{ refundNo?: string; refundTime?: string }>(DANA_PATHS.widget.refund, body, MOD);
  r.meta = { partnerRefundNo, amount: body.refundAmount.value };
  return r;
}
