import crypto, { KeyObject } from "crypto";

/**
 * DANA SNAP asymmetric signature (SHA256withRSA):
 *   stringToSign = METHOD + ":" + PATH + ":" + lowercase(hex(sha256(minifiedBody))) + ":" + X-TIMESTAMP
 *   X-SIGNATURE  = base64(RSA-SHA256(privateKey, stringToSign))
 * Sama persis dengan contoh Python (PKCS1_v1_5 + SHA256).
 */

function normalizeRaw(raw: string) {
  let k = raw.trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) k = k.slice(1, -1);
  return k.replace(/\\n/g, "\n").trim();
}

function wrapPem(b64: string, label: string) {
  const body = b64.replace(/\s+/g, "").match(/.{1,64}/g)?.join("\n") ?? "";
  return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----`;
}

const keyCache = new Map<string, KeyObject>();

export function loadPrivateKey(raw: string): KeyObject {
  const cached = keyCache.get("priv:" + raw);
  if (cached) return cached;
  const k = normalizeRaw(raw);
  let key: KeyObject | undefined;
  if (k.includes("-----BEGIN")) {
    key = crypto.createPrivateKey(k);
  } else {
    for (const label of ["PRIVATE KEY", "RSA PRIVATE KEY"]) {
      try {
        key = crypto.createPrivateKey(wrapPem(k, label));
        break;
      } catch {
        /* coba format berikutnya */
      }
    }
  }
  if (!key) throw new Error("DANA_PRIVATE_KEY tidak valid (bukan PKCS#1 / PKCS#8 PEM)");
  keyCache.set("priv:" + raw, key);
  return key;
}

export function loadPublicKey(raw: string): KeyObject {
  const cached = keyCache.get("pub:" + raw);
  if (cached) return cached;
  const k = normalizeRaw(raw);
  let key: KeyObject | undefined;
  if (k.includes("-----BEGIN")) {
    key = crypto.createPublicKey(k);
  } else {
    for (const label of ["PUBLIC KEY", "RSA PUBLIC KEY"]) {
      try {
        key = crypto.createPublicKey(wrapPem(k, label));
        break;
      } catch {
        /* next */
      }
    }
  }
  if (!key) throw new Error("Public key tidak valid");
  keyCache.set("pub:" + raw, key);
  return key;
}

export function sha256Hex(data: string) {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex").toLowerCase();
}

export function buildStringToSign(method: string, path: string, body: string, timestamp: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${method.toUpperCase()}:${p}:${sha256Hex(body)}:${timestamp}`;
}

export function signAsymmetric(privateKeyRaw: string, method: string, path: string, body: string, timestamp: string) {
  const stringToSign = buildStringToSign(method, path, body, timestamp);
  const signature = crypto.sign("RSA-SHA256", Buffer.from(stringToSign, "utf8"), loadPrivateKey(privateKeyRaw)).toString("base64");
  return { signature, stringToSign };
}

export function verifyAsymmetric(publicKey: KeyObject, stringToSign: string, signatureB64: string): boolean {
  try {
    return crypto.verify("RSA-SHA256", Buffer.from(stringToSign, "utf8"), publicKey, Buffer.from(signatureB64, "base64"));
  } catch {
    return false;
  }
}

/** Sign string apa adanya (dipakai Apply Token: clientKey|timestamp, dan Open API) */
export function signRaw(privateKeyRaw: string, data: string) {
  return crypto.sign("RSA-SHA256", Buffer.from(data, "utf8"), loadPrivateKey(privateKeyRaw)).toString("base64");
}
