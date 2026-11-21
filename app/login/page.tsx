import type { Metadata } from "next";
import LoginClient from "@/components/LoginClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Masuk · DANA Console", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <LoginClient next={next ?? "/"} env={(process.env.DANA_ENV || "sandbox").toLowerCase()} />;
}
