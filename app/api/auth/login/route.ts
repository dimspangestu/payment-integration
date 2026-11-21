import { NextResponse } from "next/server";
import { SESSION_COOKIE, captchaNonce, createSession, verifyCaptcha } from "@/lib/captcha";
import { consumeOnce } from "@/lib/dana/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Hanya path relatif di domain sendiri (cegah open redirect) */
function safeNext(next: unknown) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* kosong */
  }

  // Satu token captcha = satu percobaan (benar atau salah) → cegah brute force pada gambar yang sama
  const nonce = captchaNonce(body.token);
  if (!nonce) return NextResponse.json({ ok: false, error: "Captcha tidak valid" }, { status: 400 });
  if (!(await consumeOnce(`captcha:${nonce}`, 300).catch(() => true))) {
    return NextResponse.json({ ok: false, error: "Captcha sudah dipakai, muat ulang" }, { status: 400 });
  }

  const v = verifyCaptcha(body.token, body.answer);
  if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });

  const session = createSession();
  const res = NextResponse.json({ ok: true, next: safeNext(body.next) });
  const https = (req.headers.get("x-forwarded-proto") || new URL(req.url).protocol.replace(":", "")) === "https";
  res.cookies.set(SESSION_COOKIE, session.value, {
    httpOnly: true,
    secure: https,
    sameSite: "lax",
    path: "/",
    maxAge: session.maxAge,
  });
  return res;
}
