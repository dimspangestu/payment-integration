"use client";

import { CreditCard, Landmark, Store, Wallet } from "lucide-react";
import { Badge, Card } from "./ui";

const PLANNED = [
  { icon: <Wallet className="h-4 w-4" />, title: "Create Order", path: "/payment-gateway/v1.0/debit/payment-host-to-host.htm" },
  { icon: <Landmark className="h-4 w-4" />, title: "Virtual Account / OTC", path: "payMethod: VIRTUAL_ACCOUNT, OTC" },
  { icon: <CreditCard className="h-4 w-4" />, title: "Query / Cancel / Refund", path: "/payment-gateway/v1.0/debit/{status|cancel|refund}.htm" },
  { icon: <Store className="h-4 w-4" />, title: "Finish Notify", path: "/v1.0/debit/notify (webhook yang sama)" },
];

export default function PaymentGatewaySoon() {
  return (
    <Card
      icon={<CreditCard className="h-5 w-5" />}
      title={
        <span className="flex items-center gap-2">
          Payment Gateway <Badge tone="warn">Segera</Badge>
        </span>
      }
      subtitle="Modul sudah disiapkan di lib/dana/payment-gateway — tinggal implementasi body request."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {PLANNED.map((p) => (
          <div key={p.title} className="rounded-xl border border-dashed border-ink-700 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <span className="text-dana-300">{p.icon}</span>
              {p.title}
            </div>
            <div className="mt-1.5 break-all font-mono text-[11px] text-ink-400">{p.path}</div>
          </div>
        ))}
      </div>
      <pre className="mt-5 overflow-auto rounded-xl bg-ink-950/70 p-4 font-mono text-[12px] leading-relaxed text-ink-300">{`lib/dana/
├── config.ts          # env + DANA_PATHS (qris & paymentGateway)
├── signature.ts       # SHA256withRSA sign / verify
├── client.ts          # danaPost() — header SNAP otomatis
├── webhook.ts         # verifikasi Finish Notify
├── store.ts           # Redis / memory
├── qris/              # ✅ MPM, CPM, query, cancel, refund
└── payment-gateway/   # 🏗️ disiapkan`}</pre>
    </Card>
  );
}
