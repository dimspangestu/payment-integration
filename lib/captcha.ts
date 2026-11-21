import crypto from "crypto";

/**
 * Captcha bawaan tanpa layanan pihak ketiga.
 * Digit digambar sebagai garis vektor (bukan <text>), jadi tidak bisa dibaca dari source SVG.
 * Token stateless: HMAC(secret, jawaban + nonce + exp). Cocok untuk sandbox.
 */

type Pt = [number, number];
// Font garis sederhana di grid 4×6 (digit 0/1 dihindari karena mirip O/I)
const GLYPHS: Record<string, Pt[][]> = {
  "2": [[[0, 1], [1, 0], [3, 0], [4, 1], [4, 2], [0, 6], [4, 6]]],
  "3": [[[0, 0.5], [1, 0], [3, 0], [4, 1], [4, 2], [3, 3], [1.5, 3]], [[3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5.5]]],
  "4": [[[3, 6], [3, 0], [0, 4], [4, 4]]],
  "5": [[[4, 0], [0, 0], [0, 2.7], [3, 2.7], [4, 3.7], [4, 5], [3, 6], [0, 6]]],
  "6": [[[3.5, 0], [1, 0], [0, 1.5], [0, 5], [1, 6], [3, 6], [4, 5], [4, 3.7], [3, 2.7], [0, 2.7]]],
  "7": [[[0, 0], [4, 0], [1.5, 6]], [[1, 3], [3.3, 3]]],
  "8": [[[1, 0], [3, 0], [4, 1], [4, 2], [3, 3], [1, 3], [0, 2], [0, 1], [1, 0]], [[1, 3], [3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5], [0, 4], [1, 3]]],
  "9": [[[4, 3.3], [1, 3.3], [0, 2.3], [0, 1], [1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [0.5, 6]]],
};
const CHARS = Object.keys(GLYPHS);
const LENGTH = 5;
const TTL_MS = 3 * 60_000;

const rnd = (a: number, b: number) => a + crypto.randomInt(0, 10_000) / 10_000 * (b - a);
const pick = <T,>(arr: T[]) => arr[crypto.randomInt(0, arr.length)];

function secret() {
  const s =
    process.env.SESSION_SECRET ||
    process.env.CHECKOUT_SECRET ||
    (process.env.DANA_PRIVATE_KEY ? crypto.createHash("sha256").update("session:" + process.env.DANA_PRIVATE_KEY).digest("hex") : "");
  if (!s) throw new Error("SESSION_SECRET belum di-set");
  return s;
}

const hmac = (data: string) => crypto.createHmac("sha256", secret()).update(data).digest("base64url");

function renderSvg(code: string) {
  const W = 240,
    H = 80;
  const colors = ["#7cc4f8", "#3fa9f5", "#a5f3fc", "#93c5fd", "#c4b5fd", "#86efac"];
  const parts: string[] = [];

  // noise belakang
  for (let i = 0; i < 6; i++) {
    parts.push(
      `<path d="M${rnd(0, 40).toFixed(1)} ${rnd(0, H).toFixed(1)} C${rnd(40, 100).toFixed(1)} ${rnd(-20, H + 20).toFixed(1)},${rnd(100, 170).toFixed(1)} ${rnd(-20, H + 20).toFixed(1)},${rnd(180, W).toFixed(1)} ${rnd(0, H).toFixed(1)}" stroke="${pick(colors)}" stroke-opacity="${rnd(0.15, 0.35).toFixed(2)}" stroke-width="${rnd(1, 2.5).toFixed(1)}" fill="none"/>`
    );
  }
  for (let i = 0; i < 40; i++) {
    parts.push(`<circle cx="${rnd(0, W).toFixed(1)}" cy="${rnd(0, H).toFixed(1)}" r="${rnd(0.6, 1.8).toFixed(1)}" fill="${pick(colors)}" fill-opacity="${rnd(0.2, 0.6).toFixed(2)}"/>`);
  }

  // digit
  const step = (W - 36) / LENGTH;
  [...code].forEach((ch, i) => {
    // tinggi glyph = 6 × scale ≈ 35–41px → muat di H=80 walau diputar
    const scale = rnd(5.8, 6.8);
    const cx = 22 + i * step + rnd(-2, 2);
    const cy = (H - 6 * scale) / 2 + rnd(-5, 5);
    const rot = rnd(-18, 18);
    const skew = rnd(-10, 10);
    const color = pick(colors);
    const d = GLYPHS[ch]
      .map((poly) => poly.map(([x, y], j) => `${j ? "L" : "M"}${(x * scale + rnd(-1.2, 1.2)).toFixed(1)} ${(y * scale + rnd(-1.2, 1.2)).toFixed(1)}`).join(" "))
      .join(" ");
    parts.push(
      `<g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${rot.toFixed(1)} ${(2 * scale).toFixed(1)} ${(3 * scale).toFixed(1)}) skewX(${skew.toFixed(1)})"><path d="${d}" stroke="${color}" stroke-width="${rnd(3, 4.2).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g>`
    );
  });

  // noise depan (garis tipis memotong digit)
  for (let i = 0; i < 3; i++) {
    parts.push(
      `<path d="M0 ${rnd(15, H - 15).toFixed(1)} Q${rnd(60, 160).toFixed(1)} ${rnd(0, H).toFixed(1)} ${W} ${rnd(15, H - 15).toFixed(1)}" stroke="${pick(colors)}" stroke-opacity="0.55" stroke-width="1.4" fill="none"/>`
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" rx="12" fill="#0a1224"/>${parts.join("")}</svg>`;
}

/** Buat captcha baru → { token, image (data URL) } */
export function createCaptcha() {
  const code = Array.from({ length: LENGTH }, () => pick(CHARS)).join("");
  const nonce = crypto.randomBytes(8).toString("base64url");
  const exp = Date.now() + TTL_MS;
  const payload = `${exp}.${nonce}`;
  const token = `${payload}.${hmac(`${code}.${payload}`)}`;
  const svg = renderSvg(code);
  return { token, image: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, length: LENGTH };
}

/** Nonce dari token (dipakai untuk menandai token sekali pakai) */
export function captchaNonce(token: unknown) {
  return typeof token === "string" ? token.split(".")[1] || null : null;
}

export function verifyCaptcha(token: unknown, answer: unknown): { ok: true } | { ok: false; error: string } {
  if (typeof token !== "string" || typeof answer !== "string") return { ok: false, error: "Captcha wajib diisi" };
  const [exp, nonce, sig] = token.split(".");
  if (!exp || !nonce || !sig) return { ok: false, error: "Captcha tidak valid" };
  if (Date.now() > Number(exp)) return { ok: false, error: "Captcha kedaluwarsa, muat ulang" };
  const code = answer.replace(/\s+/g, "");
  const expected = hmac(`${code}.${exp}.${nonce}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, error: "Kode captcha salah" };
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Session cookie                                                       */
/* ------------------------------------------------------------------ */
export const SESSION_COOKIE = "dq_session";
export const SESSION_HOURS = Number(process.env.SESSION_HOURS) || 12;

export function createSession() {
  const exp = Date.now() + SESSION_HOURS * 3_600_000;
  const payload = `${exp}.${crypto.randomBytes(8).toString("base64url")}`;
  return { value: `${payload}.${hmac(`session.${payload}`)}`, maxAge: SESSION_HOURS * 3600 };
}

export function verifySession(value: string | undefined | null) {
  if (!value) return false;
  const [exp, nonce, sig] = value.split(".");
  if (!exp || !nonce || !sig || Date.now() > Number(exp)) return false;
  try {
    const expected = hmac(`session.${exp}.${nonce}`);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** "captcha" (default) | "basic" (pakai DASHBOARD_PASSWORD) | "none" */
export function authMode(): "captcha" | "basic" | "none" {
  const m = (process.env.DASHBOARD_AUTH || "captcha").toLowerCase();
  return m === "basic" || m === "none" ? m : "captcha";
}
