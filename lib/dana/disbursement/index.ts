import "server-only";
import { danaPost } from "../client";
import { DANA_PATHS, SERVICE_CODE } from "../config";
import { DanaInputError, clean, generateRef, jakartaTimestamp, money, optionalString, requireString } from "../utils";

/**
 * DANA Disbursement (SDK dana-python: dana.disbursement.v1)
 *  - Transfer ke DANA : DANA Account Inquiry → Transfer to DANA (topup) → Inquiry Status (serviceCode 38)
 *  - Transfer ke Bank : Bank Account Inquiry → Transfer to Bank → Inquiry Status (serviceCode 00)
 */

const FUND_TYPE_DANA = "AGENT_TOPUP_FOR_USER_SETTLE";
const FUND_TYPE_BANK = "MERCHANT_WITHDRAW_FOR_CORPORATE";
const OPTS = { module: "DISBURSEMENT" as const, requireMerchant: false };

/** 08xx / +628xx / 628xx → 628xx (format wajib DANA) */
export function normalizeMsisdn(input: unknown, field = "Nomor HP") {
  let s = requireString(input, field).replace(/[\s\-()]/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("0")) s = "62" + s.slice(1);
  if (!/^62\d{7,13}$/.test(s)) throw new DanaInputError(`${field} harus format 628xxxxxxxx`);
  return s;
}

/* ------------------------------ DANA ------------------------------ */

export async function danaAccountInquiry(input: { customerNumber: string; amount: string | number }) {
  const body = clean({
    partnerReferenceNo: generateRef("DAI"),
    customerNumber: normalizeMsisdn(input.customerNumber),
    amount: money(input.amount),
    transactionDate: jakartaTimestamp(),
    additionalInfo: { fundType: FUND_TYPE_DANA },
  });
  return danaPost<{
    customerName?: string;
    minAmount?: { value: string };
    maxAmount?: { value: string };
    amount?: { value: string };
    feeAmount?: { value: string };
    customerMonthlyInLimit?: { value: string };
  }>(DANA_PATHS.disbursement.danaAccountInquiry, body, OPTS);
}

export async function transferToDana(input: { customerNumber: string; amount: string | number; feeAmount?: string | number; notes?: string }) {
  const partnerReferenceNo = generateRef("DTD");
  const body = clean({
    partnerReferenceNo,
    customerNumber: normalizeMsisdn(input.customerNumber),
    amount: money(input.amount),
    // feeAmount wajib; 0 diperbolehkan → ambil dari hasil inquiry
    feeAmount: { value: Number(input.feeAmount ?? 0).toFixed(2), currency: "IDR" },
    transactionDate: jakartaTimestamp(),
    notes: optionalString(input.notes)?.slice(0, 255),
    additionalInfo: { fundType: FUND_TYPE_DANA },
  });
  const r = await danaPost<{ referenceNo?: string; transactionDate?: string }>(DANA_PATHS.disbursement.transferToDana, body, OPTS);
  r.meta = { partnerReferenceNo, amount: body.amount.value, feeAmount: body.feeAmount.value };
  return r;
}

export async function transferToDanaStatus(input: { originalPartnerReferenceNo: string; originalReferenceNo?: string }) {
  const body = clean({
    originalPartnerReferenceNo: requireString(input.originalPartnerReferenceNo, "originalPartnerReferenceNo", 64),
    originalReferenceNo: optionalString(input.originalReferenceNo),
    serviceCode: SERVICE_CODE.TRANSFER_TO_DANA,
  });
  return danaPost<{ latestTransactionStatus?: string; transactionStatusDesc?: string }>(DANA_PATHS.disbursement.transferToDanaStatus, body, OPTS);
}

/* ------------------------------ BANK ------------------------------ */

export async function bankAccountInquiry(input: {
  customerNumber: string;
  beneficiaryAccountNumber: string;
  beneficiaryBankCode: string;
  amount: string | number;
  beneficiaryAccountName?: string;
}) {
  const bankCode = requireString(input.beneficiaryBankCode, "Kode bank", 8);
  const body = clean({
    partnerReferenceNo: generateRef("BAI"),
    customerNumber: normalizeMsisdn(input.customerNumber, "Customer number"),
    beneficiaryAccountNumber: requireString(input.beneficiaryAccountNumber, "Nomor rekening", 32).replace(/\D/g, ""),
    amount: money(input.amount),
    additionalInfo: {
      fundType: FUND_TYPE_BANK,
      beneficiaryBankCode: bankCode,
      beneficiaryAccountName: optionalString(input.beneficiaryAccountName)?.slice(0, 64),
    },
  });
  return danaPost<{
    referenceNo?: string;
    beneficiaryAccountName?: string;
    beneficiaryBankShortName?: string;
    beneficiaryBankName?: string;
    amount?: { value: string };
    additionalInfo?: { feeAmount?: { value: string } };
  }>(DANA_PATHS.disbursement.bankAccountInquiry, body, OPTS);
}

export async function transferToBank(input: {
  customerNumber: string;
  beneficiaryAccountNumber: string;
  beneficiaryBankCode: string;
  amount: string | number;
  beneficiaryAccountName?: string;
}) {
  const partnerReferenceNo = generateRef("DTB");
  const body = clean({
    partnerReferenceNo,
    customerNumber: normalizeMsisdn(input.customerNumber, "Customer number"),
    beneficiaryAccountNumber: requireString(input.beneficiaryAccountNumber, "Nomor rekening", 32).replace(/\D/g, ""),
    beneficiaryBankCode: requireString(input.beneficiaryBankCode, "Kode bank", 8),
    amount: money(input.amount),
    additionalInfo: {
      fundType: FUND_TYPE_BANK,
      beneficiaryAccountName: optionalString(input.beneficiaryAccountName)?.slice(0, 64),
    },
  });
  const r = await danaPost<{ referenceNo?: string; transactionDate?: string; referenceNumber?: string }>(DANA_PATHS.disbursement.transferToBank, body, OPTS);
  r.meta = { partnerReferenceNo, amount: body.amount.value };
  return r;
}

export async function transferToBankStatus(input: { originalPartnerReferenceNo: string; originalReferenceNo?: string }) {
  const body = clean({
    originalPartnerReferenceNo: requireString(input.originalPartnerReferenceNo, "originalPartnerReferenceNo", 64),
    originalReferenceNo: optionalString(input.originalReferenceNo),
    serviceCode: SERVICE_CODE.TRANSFER_TO_BANK,
  });
  return danaPost<{ latestTransactionStatus?: string; transactionStatusDesc?: string }>(DANA_PATHS.disbursement.transferToBankStatus, body, OPTS);
}
