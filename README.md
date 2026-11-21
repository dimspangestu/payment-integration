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
4. Login dashboard default pakai **captcha** (`DASHBOARD_AUTH=captcha`): halaman `/login`, tanpa username/password, sesi 12 jam (cookie HMAC). Mode lain: `basic` (DASHBOARD_USER/PASSWORD) atau `none`. Webhook & checkout customer tetap publik.
   > Captcha hanya menahan bot, bukan membatasi siapa yang boleh masuk — cocok untuk sandbox. Untuk production pakai `basic` atau login sungguhan.
5. Daftarkan Notification URL di dashboard DANA:

```
https://<project>.vercel.app/v1.0/debit/notify
```

URL ini di-rewrite ke `/api/dana/notify` (lihat `next.config.ts`). Jadi **ya, webhook jalan di Vercel** — route handler Node.js biasa, respons `{"responseCode":"2005600","responseMessage":"Successful"}` dalam batas timeout 8 detik DANA.

## Payment Gateway (Gapura)

| Mode | Cara kerja | Menu |
|---|---|---|
| **Hosted** | `scenario: REDIRECT` → customer diarahkan ke `webRedirectUrl` (cashier DANA). Isi **Store ID** agar QRIS tersedia | Hosted Checkout |
| **Custom** | `scenario: API` + `payOptionDetails` → nomor VA / QRIS tampil di halaman `/checkout` milik merchant. **Store ID** ikut ditandatangani di link (wajib untuk QRIS) | Custom Checkout |

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

## Disbursement

| Alur | Endpoint (SDK `dana.disbursement.v1`) |
|---|---|
| **Ke DANA**: cek akun → kirim → status | `/rest/v1.0/emoney/account-inquiry` → `/rest/v1.0/emoney/topup` → `/rest/v1.0/emoney/topup-status` (serviceCode 38) |
| **Ke Bank**: cek rekening → kirim → status | `/v1.0/emoney/bank-account-inquiry.htm` → `/v1.0/emoney/transfer-bank.htm` → `/v1.0/emoney/transfer-bank-status.htm` (serviceCode 00) |

- `fundType`: `AGENT_TOPUP_FOR_USER_SETTLE` (ke DANA), `MERCHANT_WITHDRAW_FOR_CORPORATE` (ke bank).
- Nomor HP otomatis dinormalisasi ke `628xx`. Biaya dari inquiry dipakai sebagai `feeAmount` saat transfer.
- `DANA_DISBURSEMENT_CUSTOMER_NUMBER` = nomor akun DANA merchant untuk Transfer ke Bank.

## Widget

1. **Binding**: tombol "Hubungkan akun DANA" → `m.sandbox.dana.id/v1.0/get-auth-code` → DANA redirect ke **`/widget/callback?authCode=…`** → Apply Token (`/v1.0/access-token/b2b2c.htm`, signature `clientKey|timestamp`).
   Daftarkan redirect URL `https://<domain>/widget/callback` di dashboard DANA.
2. **Widget Payment** (`/rest/redirection/v1.0/debit/payment-host-to-host`) → `webRedirectUrl`. Kalau sudah binding, otomatis **Apply OTT** dan URL bayar ditambah `&ott=…` (tanpa login ulang).
3. Saldo (`/v1.0/balance-inquiry.htm`), Profil (Open API `queryUserProfile`, butuh `DANA_CLIENT_SECRET`), Refresh token, Unbinding, Query/Cancel/Refund.
- Header customer (`Authorization-Customer`, `X-DEVICE-ID`, `X-IP-ADDRESS`) mengikuti `SnapHeader` SDK.
- Sesi binding disimpan di **localStorage browser** (cukup untuk sandbox). Production: simpan token di server per user.

## Kredensial per modul

Di sandbox tiap produk sering beda merchant/client. Isi `DANA_<MODUL>_PARTNER_ID`, `_MERCHANT_ID`, `_PRIVATE_KEY`, `_CLIENT_SECRET` (MODUL = `QRIS`, `PG`, `DISBURSEMENT`, `WIDGET`); kosong = pakai nilai global. Status tiap modul tampil di kartu Konfigurasi (Overview).

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

## URL di DANA Dashboard (Mandatory Endpoints)

Ketiga field harus berbeda:

| Field | URL | Respons sukses |
|---|---|---|
| Finish Payment URL | `https://<domain>/v1.0/debit/notify` | `2005600` |
| Disburse to Bank Notify URL | `https://<domain>/v1.0/debit/emoney/transfer-bank/notify.htm` | `2004300` |
| Finish Redirect URL | `https://<domain>/widget/callback` | (halaman browser, bukan webhook) |

Kedua endpoint notify bisa diakses publik tanpa login, dan signature-nya diverifikasi dengan public key DANA.
