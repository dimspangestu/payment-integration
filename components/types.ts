export type TabKey = "overview" | "mpm" | "cpm" | "query" | "cancel" | "refund" | "webhooks" | "history" | "pg-hosted" | "pg-custom" | "pg-ops" | "disbursement" | "widget";

export interface Prefill {
  ref?: string;
  referenceNo?: string;
  amount?: string;
  type?: "MPM" | "CPM";
}

export type Navigate = (tab: TabKey, prefill?: Prefill) => void;

export interface AppConfig {
  env: string;
  baseUrl: string;
  merchantId: string;
  partnerId: string;
  defaultStoreId: string;
  defaultExternalStoreId: string;
  webhookPath: string;
  storeMode: "redis" | "memory";
  authEnabled: boolean;
  authMode: "captcha" | "basic" | "none";
  disbursementCustomerNumber: string;
  modules: Record<"QRIS" | "PG" | "DISBURSEMENT" | "WIDGET", { partnerId: string; merchantId: string; ready: boolean; clientSecret: boolean }>;
  configured: { partnerId: boolean; merchantId: boolean; privateKey: boolean; publicKey: boolean };
}
