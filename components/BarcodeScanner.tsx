"use client";

import { Camera, ImageUp, Loader2, SwitchCamera, X, Zap, ZapOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, cn } from "./ui";

/**
 * Scanner QR / barcode via kamera.
 * - Chrome Android / Edge: pakai BarcodeDetector native (cepat, tanpa download).
 * - Safari / Firefox / desktop: fallback ke ponyfill `barcode-detector` (ZXing WASM),
 *   di-load dinamis hanya saat dibutuhkan.
 * Kamera hanya bisa diakses lewat HTTPS atau localhost.
 */

export interface ScanResult {
  rawValue: string;
  format: string;
}

const FORMATS = ["qr_code", "code_128", "code_39", "code_93", "ean_13", "itf", "pdf417", "data_matrix", "aztec"];

interface Detector {
  detect(source: CanvasImageSource | ImageBitmap): Promise<{ rawValue: string; format: string }[]>;
}

async function createDetector(): Promise<Detector> {
  const NativeBD = (globalThis as unknown as { BarcodeDetector?: any }).BarcodeDetector;
  if (NativeBD) {
    try {
      const supported: string[] = await NativeBD.getSupportedFormats();
      const formats = FORMATS.filter((f) => supported.includes(f));
      if (formats.includes("qr_code")) return new NativeBD({ formats });
    } catch {
      /* fallback ke ponyfill */
    }
  }
  const { BarcodeDetector } = await import("barcode-detector/ponyfill");
  return new BarcodeDetector({ formats: FORMATS as any }) as unknown as Detector;
}

function cameraError(err: unknown): string {
  const name = (err as DOMException)?.name;
  if (!window.isSecureContext) return "Kamera hanya bisa diakses lewat HTTPS atau localhost.";
  if (name === "NotAllowedError") return "Izin kamera ditolak. Izinkan akses kamera di pengaturan browser lalu coba lagi.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "Kamera tidak ditemukan di perangkat ini.";
  if (name === "NotReadableError") return "Kamera sedang dipakai aplikasi lain.";
  return `Gagal membuka kamera: ${(err as Error)?.message ?? name ?? "unknown"}`;
}

export default function BarcodeScanner({
  open,
  onClose,
  onDetected,
}: {
  open: boolean;
  onClose: () => void;
  onDetected: (r: ScanResult) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<Detector | null>(null);
  const loopRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const doneRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<"idle" | "loading" | "scanning" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>();
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const stop = useCallback(() => {
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    loopRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setTorchOn(false);
  }, []);

  const finish = useCallback(
    (r: ScanResult) => {
      if (doneRef.current) return;
      doneRef.current = true;
      navigator.vibrate?.(80);
      stop();
      onDetected(r);
      onClose();
    },
    [onClose, onDetected, stop]
  );

  const loop = useCallback(() => {
    let last = 0;
    const tick = async (t: number) => {
      loopRef.current = requestAnimationFrame(tick);
      const video = videoRef.current;
      const detector = detectorRef.current;
      if (!video || !detector || busyRef.current || doneRef.current) return;
      if (video.readyState < 2 || t - last < 120) return; // ~8 fps sudah cukup
      last = t;
      busyRef.current = true;
      try {
        const codes = await detector.detect(video);
        const hit = codes.find((c) => c.rawValue);
        if (hit) finish({ rawValue: hit.rawValue, format: hit.format });
      } catch {
        /* frame gagal dibaca, lanjut frame berikutnya */
      } finally {
        busyRef.current = false;
      }
    };
    loopRef.current = requestAnimationFrame(tick);
  }, [finish]);

  const start = useCallback(
    async (id?: string) => {
      stop();
      doneRef.current = false;
      setError(null);
      setStatus("loading");
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Browser tidak mendukung akses kamera");
        detectorRef.current ??= await createDetector();

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: id
            ? { deviceId: { exact: id }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        streamRef.current = stream;

        const track = stream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
        setTorchSupported(Boolean(caps.torch));
        setDeviceId(track.getSettings().deviceId);

        // label kamera baru tersedia setelah izin diberikan
        const all = await navigator.mediaDevices.enumerateDevices();
        setDevices(all.filter((d) => d.kind === "videoinput"));

        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setStatus("scanning");
        loop();
      } catch (err) {
        stop();
        setStatus("error");
        setError(cameraError(err));
      }
    },
    [loop, stop]
  );

  useEffect(() => {
    if (open) start();
    else stop();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn(!torchOn);
    } catch {
      setTorchSupported(false);
    }
  }

  function switchCamera() {
    if (devices.length < 2) return;
    const idx = devices.findIndex((d) => d.deviceId === deviceId);
    start(devices[(idx + 1) % devices.length].deviceId);
  }

  async function scanFile(file: File) {
    setError(null);
    try {
      detectorRef.current ??= await createDetector();
      const bitmap = await createImageBitmap(file);
      const codes = await detectorRef.current.detect(bitmap);
      bitmap.close();
      const hit = codes.find((c) => c.rawValue);
      if (hit) finish({ rawValue: hit.rawValue, format: hit.format });
      else setError("Tidak ada QR / barcode yang terbaca di gambar.");
    } catch (e) {
      setError(`Gagal membaca gambar: ${(e as Error).message}`);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="card w-full max-w-lg overflow-hidden rounded-b-none sm:rounded-b-[1.25rem]">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Camera className="h-4 w-4 text-dana-300" /> Scan QR / Barcode customer
          </div>
          <button
            onClick={() => {
              stop();
              onClose();
            }}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-700/60 hover:text-white"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative aspect-[4/3] w-full bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />

          {/* bingkai bidik */}
          {status === "scanning" && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="relative h-[62%] w-[78%] rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                {["left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl", "right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl", "left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl", "right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl"].map((c) => (
                  <span key={c} className={cn("absolute h-8 w-8 border-dana-400", c)} />
                ))}
                <span className="absolute inset-x-4 top-1/2 h-0.5 animate-pulse bg-dana-400/80 shadow-[0_0_12px_2px_rgba(63,169,245,0.7)]" />
              </div>
            </div>
          )}

          {status === "loading" && (
            <div className="absolute inset-0 grid place-items-center text-sm text-ink-300">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /> Membuka kamera…
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-rose-300">{error}</div>
          )}
        </div>

        <div className="space-y-3 px-5 py-4">
          {status === "scanning" && <p className="text-center text-xs text-ink-400">Arahkan kamera ke QR atau barcode di aplikasi customer</p>}
          {error && status !== "error" && <p className="text-center text-xs text-rose-300">{error}</p>}

          <div className="flex flex-wrap justify-center gap-2">
            {devices.length > 1 && (
              <Button variant="ghost" onClick={switchCamera}>
                <SwitchCamera className="h-4 w-4" /> Ganti kamera
              </Button>
            )}
            {torchSupported && (
              <Button variant="ghost" onClick={toggleTorch}>
                {torchOn ? <ZapOff className="h-4 w-4" /> : <Zap className="h-4 w-4" />} Senter
              </Button>
            )}
            <Button variant="ghost" onClick={() => fileRef.current?.click()}>
              <ImageUp className="h-4 w-4" /> Dari gambar
            </Button>
            {status === "error" && (
              <Button variant="soft" onClick={() => start(deviceId)}>
                Coba lagi
              </Button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) scanFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>
    </div>
  );
}