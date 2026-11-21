import type { Metadata } from "next";
import ResultClient from "@/components/checkout/ResultClient";
import { getDanaConfig } from "@/lib/dana/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Status Pembayaran", robots: { index: false } };

/** Halaman tujuan PAY_RETURN dari DANA (hosted & custom redirect) */
export default async function ResultPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  return <ResultClient refNo={ref ?? null} merchantName={getDanaConfig().merchantName} />;
}
