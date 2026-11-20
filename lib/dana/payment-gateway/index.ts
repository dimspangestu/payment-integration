import "server-only";
/**
 * ============================================================
 *  Payment Gateway (Gapura) — RUMAH MODUL, BELUM DIIMPLEMENTASI
 * ============================================================
 * Struktur sudah disiapkan agar implementasi nanti tinggal mengikuti pola QRIS:
 *
 *   import { danaPost } from "../client";
 *   import { DANA_PATHS, SERVICE_CODE, getDanaConfig } from "../config";
 *   import { generateRef, money, clean } from "../utils";
 *
 *   export async function createOrder(input) {
 *     const cfg = getDanaConfig();
 *     const partnerReferenceNo = generateRef("PGW");
 *     const body = clean({ partnerReferenceNo, merchantId: cfg.merchantId, amount: money(input.amount), ... });
 *     return danaPost(DANA_PATHS.paymentGateway.createOrder, body);
 *   }
 *
 * Endpoint (lihat DANA_PATHS.paymentGateway):
 *   - Create Order  : /payment-gateway/v1.0/debit/payment-host-to-host.htm
 *   - Query Payment : /payment-gateway/v1.0/debit/status.htm   (serviceCode 54)
 *   - Cancel Order  : /payment-gateway/v1.0/debit/cancel.htm
 *   - Refund Order  : /payment-gateway/v1.0/debit/refund.htm
 *   - Finish Notify : /v1.0/debit/notify  (sudah ditangani oleh webhook yang sama)
 *
 * Signature, header SNAP, timestamp, webhook, dan storage sudah reusable.
 */

export const PAYMENT_GATEWAY_READY = false;

export async function createOrder(): Promise<never> {
  throw new Error("Payment Gateway belum diimplementasi");
}
