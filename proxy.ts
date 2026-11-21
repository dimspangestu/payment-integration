import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, authMode, verifySession } from "@/lib/captcha";

/**
 * Next.js 16 Proxy (runtime Node.js) — proteksi dashboard.
 *   DASHBOARD_AUTH=captcha (default) → halaman /login dengan captcha, lalu session cookie
 *   DASHBOARD_AUTH=basic             → Basic Auth (DASHBOARD_USER / DASHBOARD_PASSWORD)
 *   DASHBOARD_AUTH=none              → tanpa proteksi
 * Selalu publik : webhook DANA, /login, /api/auth/*.
 * Publik opsional: /checkout & /api/checkout/* jika CHECKOUT_PUBLIC=true.
 */

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function isAlwaysPublic(path: string) {
  return path === "/login" || path.startsWith("/api/auth/");
}

function isPublicCheckout(path: string) {
  return process.env.CHECKOUT_PUBLIC === "true" && (path === "/checkout" || path.startsWith("/checkout/") || path.startsWith("/api/checkout/"));
}

export function proxy(req: NextRequest) {
  const mode = authMode();
  const path = req.nextUrl.pathname;
  // Sudah login tapi membuka /login → langsung ke dashboard
  if (mode === "captcha" && path === "/login" && verifySession(req.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (mode === "none" || isAlwaysPublic(path) || isPublicCheckout(path)) return NextResponse.next();

  if (mode === "basic") {
    const password = process.env.DASHBOARD_PASSWORD;
    if (!password) return NextResponse.next();
    const user = process.env.DASHBOARD_USER || "admin";
    const auth = req.headers.get("authorization");
    if (auth?.startsWith("Basic ")) {
      const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
      const idx = decoded.indexOf(":");
      if (idx > -1 && safeEqual(decoded.slice(0, idx), user) && safeEqual(decoded.slice(idx + 1), password)) return NextResponse.next();
    }
    return new NextResponse("Authentication required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="DANA Console"' } });
  }

  // captcha
  if (verifySession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (path.startsWith("/api/")) {
    return NextResponse.json({ ok: false, responseCode: "UNAUTHORIZED", responseMessage: "Sesi habis, silakan login ulang" }, { status: 401 });
  }
  const login = new URL("/login", req.url);
  const next = path + req.nextUrl.search;
  if (next !== "/") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!api/dana/notify|v1\\.0/debit/notify|_next/static|_next/image|favicon.ico).*)"],
};
