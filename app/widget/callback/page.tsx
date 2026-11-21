import type { Metadata } from "next";
import WidgetCallback from "@/components/widget/WidgetCallback";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Menghubungkan DANA…", robots: { index: false } };

/** Redirect URL OAuth binding: DANA mengirim ?authCode=...&state=... */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return <WidgetCallback authCode={sp.authCode ?? sp.auth_code ?? null} state={sp.state ?? null} error={sp.error ?? sp.resultCode ?? null} />;
}
