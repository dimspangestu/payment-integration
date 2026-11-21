"use client";

import { CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { postApi } from "@/lib/client/api";
import { setWidgetSession, takeOauthState } from "@/lib/client/widget-session";

export default function WidgetCallback({ authCode, state, error }: { authCode: string | null; state: string | null; error: string | null }) {
  const [view, setView] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("Menukar authCode menjadi access token…");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      if (!authCode) {
        setView("error");
        setMessage(error ? `DANA mengembalikan: ${error}` : "authCode tidak ditemukan di URL redirect");
        return;
      }
      const expected = takeOauthState();
      if (expected && state && expected !== state) {
        setView("error");
        setMessage("State OAuth tidak cocok — ulangi proses binding dari dashboard");
        return;
      }
      const r = await postApi("/api/widget/token", { authCode });
      if (!r.ok || !r.data?.accessToken) {
        setView("error");
        setMessage(`Apply Token gagal: ${r.responseCode} ${r.responseMessage}`);
        return;
      }
      setWidgetSession({
        accessToken: r.data.accessToken,
        refreshToken: r.data.refreshToken,
        accessTokenExpiryTime: r.data.accessTokenExpiryTime,
        refreshTokenExpiryTime: r.data.refreshTokenExpiryTime,
        publicUserId: r.data.additionalInfo?.userInfo?.publicUserId,
        boundAt: new Date().toISOString(),
      });
      setView("ok");
      setMessage("Akun DANA terhubung. Mengarahkan kembali…");
      setTimeout(() => (window.location.href = "/#widget"), 1200);
    })();
  }, [authCode, state, error]);

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="card w-full max-w-sm p-8 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-dana-500/15">
          {view === "loading" && <Loader2 className="h-8 w-8 animate-spin text-dana-300" />}
          {view === "ok" && <CircleCheck className="h-9 w-9 text-emerald-400" />}
          {view === "error" && <CircleAlert className="h-9 w-9 text-rose-400" />}
        </div>
        <h1 className="mt-4 text-lg font-bold text-white">{view === "error" ? "Binding gagal" : view === "ok" ? "Berhasil terhubung" : "Menghubungkan DANA"}</h1>
        <p className="mt-1.5 text-sm text-ink-300">{message}</p>
        {view === "error" && (
          <a href="/#widget" className="mt-5 inline-block rounded-xl bg-dana-500 px-4 py-2 text-sm font-semibold text-white">
            Kembali ke dashboard
          </a>
        )}
      </div>
    </div>
  );
}
