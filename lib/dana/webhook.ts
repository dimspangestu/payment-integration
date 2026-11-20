import "server-only";
import { KeyObject } from "crypto";
import { getDanaConfig } from "./config";
import { buildStringToSign, loadPublicKey, sha256Hex, verifyAsymmetric } from "./signature";

/** Public key gateway sandbox DANA (dari SDK resmi DANA) */
export const SANDBOX_WEBHOOK_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAnaKVGRbin4Wh4KN35OPh
ytJBjYTz7QZKSZjmHfiHxFmulfT87rta+IvGJ0rCBgg+1EtKk1hX8G5gPGJs1htJ
5jHa3/jCk9l+luzjnuT9UVlwJahvzmFw+IoDoM7hIPjsLtnIe04SgYo0tZBpEmkQ
vUGhmHPqYnUGSSMIpDLJDvbyr8gtwluja1SbRphgDCoYVXq+uUJ5HzPS049aaxTS
nfXh/qXuDoB9EzCrgppLDS2ubmk21+dr7WaO/3RFjnwx5ouv6w+iC1XOJKar3CTk
X6JV1OSST1C9sbPGzMHZ8AGB51BM0mok7davD/5irUk+f0C25OgzkwtxAt80dkDo
/QIDAQAB
-----END PUBLIC KEY-----`;

/**
 * Public key kandidat untuk verifikasi webhook.
 * SDK Python DANA: kalau env sandbox → SELALU pakai sandbox key (DANA_PUBLIC_KEY diabaikan).
 * Di sini: sandbox → sandbox key dulu, lalu DANA_PUBLIC_KEY (kalau di-set) sebagai cadangan.
 * Production → DANA_PUBLIC_KEY wajib.
 */
function getWebhookPublicKeys(): { label: string; key: KeyObject }[] {
  const cfg = getDanaConfig();
  const keys: { label: string; key: KeyObject }[] = [];
  if (cfg.isSandbox) keys.push({ label: "sandbox", key: loadPublicKey(SANDBOX_WEBHOOK_PUBLIC_KEY) });
  if (cfg.publicKey) {
    try {
      keys.push({ label: "DANA_PUBLIC_KEY", key: loadPublicKey(cfg.publicKey) });
    } catch (e) {
      if (!keys.length) throw e;
    }
  }
  if (!keys.length) throw new Error("DANA_PUBLIC_KEY wajib diisi untuk production");
  return keys;
}

/* ------------------------------------------------------------------ */
/* Port 1:1 dari dana.webhook.WebhookParser (SDK Python resmi DANA)    */
/* ------------------------------------------------------------------ */

const BS3Q = '\\\\\\"'; // \\\"  (3 backslash + quote)
const BS2Q = '\\\\"'; //  \\"   (2 backslash + quote)
const BS1Q = '\\"'; //    \"    (1 backslash + quote)

const replaceAll = (s: string, a: string, b: string) => s.split(a).join(b);

function isValidJson(s: string) {
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
}

function isJsonMinified(s: string) {
  return ![": ", ", ", "{ ", "[ ", "\n", "\t", "\r"].some((i) => s.includes(i));
}

/** Python json.dumps default ensure_ascii=True → non-ASCII jadi \uXXXX */
function asciiEscape(s: string) {
  return s.replace(/[\u007f-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

function minifyJson(s: string): string | null {
  try {
    return JSON.stringify(JSON.parse(s));
  } catch {
    return null;
  }
}

const hasTripleEscapedJsonStringField = (s: string) => s.includes('":"{' + BS3Q);
const collapseTripleBackslashQuotes = (s: string) => (s.includes(BS3Q) ? replaceAll(s, BS3Q, BS1Q) : s);
const collapseDoubleBackslashQuotes = (s: string) => (s.includes(BS2Q) ? replaceAll(s, BS2Q, '"') : s);
const removeColonSpaceBeforeQuotedValue = (s: string) => (s.includes(": " + BS1Q) ? replaceAll(s, ": " + BS1Q, ":" + BS1Q) : s);
const normalizeOverEscapedQuotes = (s: string) => (s.includes(BS2Q) ? replaceAll(s, BS2Q, BS1Q) : s);

function processNestedJsonFields(s: string) {
  const normalized = replaceAll(s, BS2Q, BS1Q);
  return normalized.replace(/"(\w+)":"(\{.*?\})"/g, (_m, field: string, value: string) => `"${field}":"${value.replace(/"/g, '\\"')}"`);
}

function processOverEscapedMinifiedJson(s: string) {
  return processNestedJsonFields(replaceAll(s, BS2Q, '"'));
}

function removeSpacesInJsonKeyNames(body: string) {
  return body.replace(/(\\*)"((?:\w+\s)+\w+)(\\*)"(\s*:)/g, (_m, a, k: string, b, c) => `${a}"${k.replace(/ /g, "")}${b}"${c}`);
}

function ensureMinifiedJson(s: string): string | null {
  if (isJsonMinified(s) && !hasTripleEscapedJsonStringField(s)) return s;
  if (isJsonMinified(s)) return processOverEscapedMinifiedJson(s);
  const processed = processNestedJsonFields(replaceAll(s, BS2Q, BS1Q));
  if (isJsonMinified(processed)) return processed;
  return minifyJson(processed);
}

/** Urutan & aturan sama persis dengan WebhookParser._body_forms_for_signature */
export function bodyFormsForSignature(raw: string): string[] {
  const forms: string[] = [];
  const add = (f: string | null | undefined) => {
    if (f && !forms.includes(f)) forms.push(f);
  };

  let collapsed = collapseTripleBackslashQuotes(raw);
  if (collapsed !== raw && isValidJson(collapsed)) add(collapsed);

  const collapsedSpaced = removeColonSpaceBeforeQuotedValue(collapsed);
  if (collapsedSpaced !== raw && isValidJson(collapsedSpaced)) add(collapsedSpaced);

  collapsed = collapseDoubleBackslashQuotes(raw);
  if (collapsed !== raw && isValidJson(collapsed)) add(collapsed);

  const spaced = removeColonSpaceBeforeQuotedValue(raw);
  if (spaced !== raw && isValidJson(spaced)) add(spaced);

  collapsed = collapseTripleBackslashQuotes(spaced);
  if (collapsed !== raw && isValidJson(collapsed)) add(collapsed);

  if (isValidJson(raw)) add(raw);

  const normalized = normalizeOverEscapedQuotes(raw);
  if (normalized !== raw && isJsonMinified(normalized) && isValidJson(normalized)) add(normalized);

  const nested = processNestedJsonFields(raw);
  if (nested !== raw) add(nested);

  const keyDespace = removeSpacesInJsonKeyNames(raw);
  if (keyDespace !== raw) add(keyDespace);

  const keyDespaceCollapsed = removeSpacesInJsonKeyNames(collapseTripleBackslashQuotes(raw));
  if (keyDespaceCollapsed !== raw) add(keyDespaceCollapsed);

  const minified = ensureMinifiedJson(raw);
  add(minified);

  // Tambahan di luar SDK: raw apa adanya (walau bukan JSON valid) + minify ala Python (ensure_ascii)
  add(raw);
  const plainMin = minifyJson(raw);
  add(plainMin);
  if (plainMin) add(asciiEscape(plainMin));
  if (minified) add(asciiEscape(minified));

  return forms;
}

/* ------------------------------------------------------------------ */

export interface VerifyResult {
  valid: boolean;
  matchedPath?: string;
  matchedKey?: string;
  matchedForm?: number;
  error?: string;
  debug: {
    bodySha256: string;
    bodyLength: number;
    formsTried: number;
    pathsTried: string[];
    keysTried: string[];
    stringToSignRaw?: string;
  };
}

export function verifyWebhookSignature(opts: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  candidatePaths: string[];
  method?: string;
}): VerifyResult {
  const { rawBody, timestamp, signature, candidatePaths, method = "POST" } = opts;
  const forms = bodyFormsForSignature(rawBody);
  const debug: VerifyResult["debug"] = {
    bodySha256: sha256Hex(rawBody),
    bodyLength: rawBody.length,
    formsTried: forms.length,
    pathsTried: candidatePaths,
    keysTried: [],
    stringToSignRaw: timestamp ? buildStringToSign(method, candidatePaths[0] ?? "", rawBody, timestamp) : undefined,
  };

  if (!timestamp || !signature) return { valid: false, error: "Missing X-TIMESTAMP / X-SIGNATURE", debug };

  let keys: { label: string; key: KeyObject }[];
  try {
    keys = getWebhookPublicKeys();
  } catch (e) {
    return { valid: false, error: (e as Error).message, debug };
  }
  debug.keysTried = keys.map((k) => k.label);

  for (const { label, key } of keys) {
    for (const path of candidatePaths) {
      for (let i = 0; i < forms.length; i++) {
        if (verifyAsymmetric(key, buildStringToSign(method, path, forms[i], timestamp), signature)) {
          return { valid: true, matchedPath: path, matchedKey: label, matchedForm: i, debug };
        }
      }
    }
  }
  return { valid: false, error: "Signature verification failed", debug };
}