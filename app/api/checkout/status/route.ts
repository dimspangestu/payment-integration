import { NextResponse } from "next/server";
import { queryPg } from "@/lib/dana/payment-gateway";
import { widgetQuery } from "@/lib/dana/widget";
import { PG_STATUS } from "@/lib/dana/payment-gateway/methods";
import { getTxnStatus, saveTxnStatus } from "@/lib/dana/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Status order untuk halaman checkout.
 * Default: dari store (diisi webhook). `?query=1` → tanya DANA (Query Payment, serviceCode 54).
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const ref = sp.get("ref");
  if (!ref || !/^[A-Za-z0-9_-]{1,64}$/.test(ref)) return NextResponse.json({ error: "ref tidak valid" }, { status: 400 });

  let st = await getTxnStatus(ref).catch(() => null);

  if (sp.get("query") === "1" && st?.status !== "00") {
    try {
      // WGT… = order Widget (endpoint query berbeda), selain itu Payment Gateway
      const r = ref.startsWith("WGT") ? await widgetQuery({ originalPartnerReferenceNo: ref }) : await queryPg({ originalPartnerReferenceNo: ref });
      const d = r.data as Record<string, unknown>;
      if (r.ok && d.latestTransactionStatus) {
        const code = String(d.latestTransactionStatus);
        st = {
          partnerReferenceNo: ref,
          referenceNo: d.originalReferenceNo as string,
          status: code,
          statusDesc: PG_STATUS[code]?.label,
          amount: (d.amount as { value?: string })?.value,
          paidTime: d.paidTime as string,
          updatedAt: new Date().toISOString(),
          source: "query",
        };
        await saveTxnStatus(st).catch(() => {});
      }
    } catch {
      /* abaikan, kembalikan status store */
    }
  }

  return NextResponse.json({
    ref,
    status: st?.status ?? null,
    label: st?.status ? PG_STATUS[st.status]?.label ?? st.statusDesc : null,
    amount: st?.amount ?? null,
    paidTime: st?.paidTime ?? null,
    source: st?.source ?? null,
  });
}
