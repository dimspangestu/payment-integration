import type { Metadata } from "next";
import WidgetCallback from "@/components/widget/WidgetCallback";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Menghubungkan DANA…", robots: { index: false } };

/** Redirect URL OAuth binding: DANA mengirim ?authCode=...&state=... */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  // Gagal: DANA mengirim responseCode & responseMessage (mis. 4001001 Invalid Field Format, 4041008 Invalid Merchant)
  const failed = sp.responseCode && !sp.responseCode.startsWith("200") ? `${sp.responseCode} ${sp.responseMessage ?? ""}`.trim() : null;
  return (
    <WidgetCallback
      authCode={failed ? null : sp.authCode ?? sp.auth_code ?? null}
      state={sp.state ?? null}
      error={failed ?? sp.error ?? sp.resultCode ?? null}
    />
  );
}
