import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      // DANA Finish Notify (webhook) — daftarkan URL ini di dashboard DANA:
      // https://<domain-vercel-anda>/v1.0/debit/notify
      { source: "/v1.0/debit/notify", destination: "/api/dana/notify" },
      // Disburse to Bank Notify (Transfer to Bank Notify) — kode sukses 2004300
      { source: "/v1.0/debit/emoney/transfer-bank/notify.htm", destination: "/api/dana/notify/transfer-bank" },
    ];
  },
};

export default nextConfig;
