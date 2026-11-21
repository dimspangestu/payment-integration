import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * Next.js 16 Proxy (pengganti middleware) — runtime Node.js.
 * Basic Auth untuk dashboard + API internal (aktif jika DASHBOARD_PASSWORD di-set).
 * Selalu publik : webhook DANA (/v1.0/debit/notify & /api/dana/notify).
 * Publik opsional: halaman checkout customer (/checkout, /api/checkout/*) jika CHECKOUT_PUBLIC=true.
 *   Endpoint admin (/api/pg/*, /api/qris/*: cancel, refund, dll) TETAP terproteksi.
 */

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function isPublicCheckout(pathname: string) {
  return pathname === "/checkout" || pathname.startsWith("/checkout/") || pathname.startsWith("/api/checkout/");
}

export function proxy(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();
  if (process.env.CHECKOUT_PUBLIC === "true" && isPublicCheckout(req.nextUrl.pathname)) return NextResponse.next();

  const user = process.env.DASHBOARD_USER || "admin";
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx > -1 && safeEqual(decoded.slice(0, idx), user) && safeEqual(decoded.slice(idx + 1), password)) {
      return NextResponse.next();
    }
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="DANA QRIS Dashboard"' },
  });
}

export const config = {
  matcher: ["/((?!api/dana/notify|v1\\.0/debit/notify|_next/static|_next/image|favicon.ico).*)"],
};
