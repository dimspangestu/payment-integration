import "server-only";
import { KeyObject } from "crypto";
import { getDanaConfig } from "./config";
import { buildStringToSign, loadPublicKey, verifyAsymmetric } from "./signature";

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

function getWebhookPublicKey(): KeyObject {
  const cfg = getDanaConfig();
  if (cfg.publicKey) return loadPublicKey(cfg.publicKey);
  if (cfg.isSandbox) return loadPublicKey(SANDBOX_WEBHOOK_PUBLIC_KEY);
  throw new Error("DANA_PUBLIC_KEY wajib diisi untuk production");
}

const isValidJson = (s: string) => {
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
};

/**
 * Port dari WebhookParser._body_forms_for_signature (SDK Python DANA):
 * DANA kadang mengirim body dengan escaping/spacing yang beda dari yang di-sign,
 * jadi kita coba beberapa bentuk body.
 */
export function bodyFormsForSignature(raw: string): string[] {
  const forms: string[] = [];
  const add = (f: string | undefined) => {
    if (f && !forms.includes(f)) forms.push(f);
  };

  const collapseTriple = (s: string) => s.split('\\\\\\"').join('\\"');
  const collapseDouble = (s: string) => s.split('\\\\"').join('"');
  const removeColonSpace = (s: string) => s.split(': \\"').join(':\\"');
  const despaceKeys = (s: string) =>
    s.replace(/(\\*)"((?:\w+\s)+\w+)(\\*)"(\s*:)/g, (_m, a, k: string, b, c) => `${a}"${k.replace(/ /g, "")}${b}"${c}`);
  const nestedFields = (s: string) =>
    s
      .split('\\\\"')
      .join('\\"')
      .replace(/"(\w+)":"(\{.*?\})"/g, (_m, k, v: string) => `"${k}":"${v.replace(/"/g, '\\"')}"`);

  add(raw); // bentuk paling umum: body persis seperti diterima

  for (const f of [collapseTriple(raw), removeColonSpace(collapseTriple(raw)), collapseDouble(raw), removeColonSpace(raw)]) {
    if (f !== raw && isValidJson(f)) add(f);
  }
  const n = nestedFields(raw);
  if (n !== raw) add(n);
  const d = despaceKeys(raw);
  if (d !== raw) add(d);

  // minified
  try {
    add(JSON.stringify(JSON.parse(raw)));
  } catch {
    /* ignore */
  }
  return forms;
}

export interface VerifyResult {
  valid: boolean;
  matchedPath?: string;
  error?: string;
}

export function verifyWebhookSignature(opts: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  candidatePaths: string[];
  method?: string;
}): VerifyResult {
  const { rawBody, timestamp, signature, candidatePaths, method = "POST" } = opts;
  if (!timestamp || !signature) return { valid: false, error: "Missing X-TIMESTAMP / X-SIGNATURE" };

  let key: KeyObject;
  try {
    key = getWebhookPublicKey();
  } catch (e) {
    return { valid: false, error: (e as Error).message };
  }

  const forms = bodyFormsForSignature(rawBody);
  for (const path of candidatePaths) {
    for (const body of forms) {
      if (verifyAsymmetric(key, buildStringToSign(method, path, body, timestamp), signature)) {
        return { valid: true, matchedPath: path };
      }
    }
  }
  return { valid: false, error: "Signature verification failed" };
}
