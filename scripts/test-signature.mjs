// Padanan script Python: cetak stringToSign + X-SIGNATURE untuk payload MPM.
// Pakai: DANA_PRIVATE_KEY="$(cat private.pem)" node scripts/test-signature.mjs
import crypto from "crypto";

const raw = (process.env.DANA_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
if (!raw) {
  console.error("Set DANA_PRIVATE_KEY dulu");
  process.exit(1);
}
const key = raw.includes("-----BEGIN")
  ? crypto.createPrivateKey(raw)
  : crypto.createPrivateKey(`-----BEGIN PRIVATE KEY-----\n${raw.match(/.{1,64}/g).join("\n")}\n-----END PRIVATE KEY-----`);

const j = new Date(Date.now() + 7 * 3600_000);
const p = (n) => String(n).padStart(2, "0");
const timestamp = `${j.getUTCFullYear()}-${p(j.getUTCMonth() + 1)}-${p(j.getUTCDate())}T${p(j.getUTCHours())}:${p(j.getUTCMinutes())}:${p(j.getUTCSeconds())}+07:00`;

const path = "/v1.0/qr/qr-mpm-generate.htm";
const payload = JSON.stringify({
  merchantId: process.env.DANA_MERCHANT_ID || "",
  partnerReferenceNo: "TEST" + Date.now(),
  amount: { value: "10000.00", currency: "IDR" },
  storeId: process.env.DANA_STORE_ID || "",
  additionalInfo: { terminalSource: "MER", envInfo: { terminalType: "SYSTEM", orderTerminalType: "APP" } },
});
const hash = crypto.createHash("sha256").update(payload).digest("hex").toLowerCase();
const stringToSign = `POST:${path}:${hash}:${timestamp}`;
const signature = crypto.sign("RSA-SHA256", Buffer.from(stringToSign), key).toString("base64");

console.log("payload        :", payload);
console.log("string to sign :", stringToSign);
console.log("timestamp      :", timestamp);
console.log("signature      :", signature);
