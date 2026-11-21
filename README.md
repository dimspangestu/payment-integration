# DANA QRIS Console (Next.js 16 + Vercel)

> Next.js 16.4 · React 19.3 · Tailwind CSS 4 · Turbopack · Node.js ≥ 20.9

Dashboard untuk DANA QRIS Acquirer: **MPM (generate QR)**, **CPM (scan QR customer)**, **Query**, **Cancel**, **Refund**, dan **Webhook Finish Notify** — siap deploy ke Vercel. Modul **Payment Gateway** sudah disiapkan strukturnya.

## Fitur

| Menu | Input user | Otomatis |
|---|---|---|
| MPM · Generate QR | `storeId`, `amount` (+ masa berlaku opsional) | `partnerReferenceNo`, render QR dari `qrContent`, polling status |
| CPM · Scan QR | `qrContent`, `amount` | `partnerReferenceNo`, `expiryTime`, `scannerInfo`, `additionalInfo` |
| Cek Query | ref + tipe MPM(47)/CPM(60) | `serviceCode`, mapping status `00/01/02/05/07` |
| Cancel | ref (+ amount/reason opsional) | — |
| Refund | ref, `amount` | `partnerRefundNo` |
| Webhook | — | verifikasi signature, simpan log, update status transaksi |

Semua request ditandatangani server-side (SHA256withRSA), sama persis dengan contoh Python:
`POST:{path}:{sha256(body)}:{X-TIMESTAMP}` → base64.

Header SNAP yang dikirim: `X-TIMESTAMP`, `X-SIGNATURE`, `X-PARTNER-ID`, `X-EXTERNAL-ID`, `CHANNEL-ID`, `ORIGIN`.

## Jalankan lokal

```bash
npm install
cp .env.example .env.local   # isi credential
npm run dev                  # http://localhost:3000
```

Cek signature tanpa UI (padanan script Python):

```bash
DANA_PRIVATE_KEY="$(cat private.pem)" npm run test:sign
```

## Deploy ke Vercel

1. Push ke GitHub → Import di Vercel.
2. **Settings → Environment Variables**: isi semua dari `.env.example`.
   - `DANA_PRIVATE_KEY`: paste PEM multi-line langsung (Vercel mendukung), atau satu baris dengan `\n`, atau base64 tanpa header.
3. **Storage → Marketplace → Upstash Redis** (gratis) → connect ke project. Env `KV_REST_API_URL`/`KV_REST_API_TOKEN` atau `UPSTASH_REDIS_REST_URL`/`TOKEN` otomatis terbaca.
   > Tanpa Redis, log webhook disimpan in-memory dan **tidak reliable di Vercel** (serverless, beda instance).
4. Set `DASHBOARD_PASSWORD` → dashboard & API internal terlindungi Basic Auth. Webhook tetap publik.
5. Daftarkan Notification URL di dashboard DANA:

```
https://<project>.vercel.app/v1.0/debit/notify
```

URL ini di-rewrite ke `/api/dana/notify` (lihat `next.config.ts`). Jadi **ya, webhook jalan di Vercel** — route handler Node.js biasa, respons `{"responseCode":"2005600","responseMessage":"Successful"}` dalam batas timeout 8 detik DANA.

## Payment Gateway (Gapura)

| Mode | Cara kerja | Menu |
|---|---|---|
| **Hosted** | `scenario: REDIRECT` → customer diarahkan ke `webRedirectUrl` (cashier DANA) | Hosted Checkout |
| **Custom** | `scenario: API` + `payOptionDetails` → nomor VA / QRIS tampil di halaman `/checkout` milik merchant | Custom Checkout |

- Metode bayar di `/checkout` diambil dari **Consult Pay**. Di sandbox ada fallback ke whitelist SDK (Saldo DANA, QRIS, VA BRI/CIMB/BSI/BTPN/Panin, Kartu).
- Link checkout ditandatangani **HMAC** (`CHECKOUT_SECRET`), jadi amount & item tidak bisa diubah customer.
- `CHECKOUT_PUBLIC=true` → `/checkout` & `/api/checkout/*` bisa dibuka tanpa password dashboard. Endpoint admin (`/api/pg/*` cancel/refund) tetap terproteksi.
- Status: webhook Finish Notify yang sama (`/v1.0/debit/notify`) + Query Payment (serviceCode 54) sebagai fallback.
- Aturan sandbox dari SDK resmi: `validUpTo` maks 30 menit, amount maks Rp10.000.000, kartu/e-wallet wajib `phoneNumber`, QRIS wajib `externalStoreId`.

```
lib/dana/payment-gateway/index.ts    # consultPay, createHostedOrder, createCustomOrder, queryPg, cancelPg, refundPg
lib/dana/payment-gateway/methods.ts  # katalog payMethod/payOption + label
lib/checkout-token.ts                # sign/verify link checkout
app/api/pg/*                         # admin: hosted, query, cancel, refund, checkout-link
app/api/checkout/*                   # publik: methods, order, status
app/checkout/ (+ /result)            # halaman checkout customer
components/checkout/*, components/pg/*
```

## Webhook

- Signature diverifikasi dengan public key DANA. Sandbox: kalau `DANA_PUBLIC_KEY` kosong, otomatis memakai sandbox public key dari SDK resmi DANA.
- Body dicoba dalam beberapa bentuk (raw, minified, normalisasi escaping), port dari `WebhookParser` SDK Python DANA.
- Path yang dicoba: `DANA_WEBHOOK_PATH`, `/v1.0/debit/notify`, dan path request aktual.
- Signature tidak valid → `401 4015600` (tetap dicatat di log, ditandai merah, status transaksi **tidak** di-update).
- Gagal simpan ke storage → `500 5005601` agar DANA retry.
- Debug sementara: `DANA_WEBHOOK_SKIP_VERIFY=true` (**jangan** di production).

## Struktur

```
app/
├── page.tsx                    # Dashboard UI
├── api/qris/{mpm,cpm,query,cancel,refund}/route.ts
├── api/qris/status/route.ts    # status dari webhook/query (polling UI)
├── api/dana/notify/route.ts    # WEBHOOK (publik)
├── api/webhooks/route.ts       # list / clear log
└── api/config/route.ts         # info non-rahasia untuk UI
lib/dana/
├── config.ts        # env + DANA_PATHS + SERVICE_CODE
├── signature.ts     # sign / verify (PKCS#1 & PKCS#8)
├── client.ts        # danaPost(): header SNAP + timeout
├── utils.ts         # timestamp WIB, generateRef (≤25 char), formatAmount
├── webhook.ts       # verifikasi Finish Notify
├── store.ts         # Upstash Redis REST / memory
├── qris/index.ts    # ✅ generateMpm, payCpm, queryPayment, cancelPayment, refundPayment
└── payment-gateway/ # 🏗️ rumah untuk Gapura (create order, VA, dst)
components/          # UI (forms, webhook log, riwayat, overview)
proxy.ts             # Basic Auth (Next 16 Proxy, pengganti middleware) — kecuali webhook
```

## Catatan field

- `partnerReferenceNo`: `MPM|CPM` + `yyMMddHHmmss` + 6 digit acak = 21 karakter (batas QRIS 25).
- Amount menerima `10000`, `10.000`, `10000.50` → dikirim `"10000.00"`.
- CPM: field wajib dari dokumentasi (`title`, `expiryTime`, `externalStoreId`, `scannerInfo`, `additionalInfo.qrContentType/mcc/productCode/envInfo`) diisi dari env. Sesuaikan `DANA_CPM_PRODUCT_CODE` & `DANA_CPM_MCC` dengan yang diberikan DANA.
- Refund: `refundOptionBill` hanya dikirim jika `DANA_REFUND_PAY_METHOD` di-set.
- Timeout ke DANA (MPM/CPM) → status `TIMEOUT`; selalu lanjutkan dengan **Cek Query** sebelum retry.
- Riwayat transaksi di UI disimpan di localStorage browser; status sumber kebenaran tetap Query / webhook.
