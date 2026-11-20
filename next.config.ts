import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      // DANA Finish Notify (webhook) — daftarkan URL ini di dashboard DANA:
      // https://<domain-vercel-anda>/v1.0/debit/notify
      { source: "/v1.0/debit/notify", destination: "/api/dana/notify" },
    ];
  },
};

export default nextConfig;
