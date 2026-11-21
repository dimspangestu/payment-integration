/**
 * Katalog metode bayar Payment Gateway (dipakai server & client).
 * Nama payMethod / payOption mengikuti enum di SDK resmi DANA.
 */

export type MethodGroup = "wallet" | "qris" | "va" | "card" | "other";

export interface PayMethodOption {
  /** id unik di UI = `${payMethod}:${payOption}` */
  id: string;
  payMethod: string;
  payOption: string;
  label: string;
  short: string;
  group: MethodGroup;
  /** warna badge inisial (bukan logo resmi) */
  color: string;
  needsPhone?: boolean;
  needsStore?: boolean;
}

export const GROUP_LABEL: Record<MethodGroup, string> = {
  wallet: "E-Wallet",
  qris: "QRIS",
  va: "Virtual Account",
  card: "Kartu Kredit / Debit",
  other: "Lainnya",
};

export const GROUP_ORDER: MethodGroup[] = ["wallet", "qris", "va", "card", "other"];

const CATALOG: Omit<PayMethodOption, "id">[] = [
  { payMethod: "BALANCE", payOption: "", label: "Saldo DANA", short: "DANA", group: "wallet", color: "#118EEA" },
  { payMethod: "NETWORK_PAY", payOption: "NETWORK_PAY_PG_OVO", label: "OVO", short: "OVO", group: "wallet", color: "#5B3CC4", needsPhone: true },
  { payMethod: "NETWORK_PAY", payOption: "NETWORK_PAY_PG_GOPAY", label: "GoPay", short: "GP", group: "wallet", color: "#00A5CF", needsPhone: true },
  { payMethod: "NETWORK_PAY", payOption: "NETWORK_PAY_PG_SPAY", label: "ShopeePay", short: "SP", group: "wallet", color: "#EE4D2D", needsPhone: true },
  { payMethod: "NETWORK_PAY", payOption: "NETWORK_PAY_PG_LINKAJA", label: "LinkAja", short: "LA", group: "wallet", color: "#E1251B", needsPhone: true },
  { payMethod: "NETWORK_PAY", payOption: "NETWORK_PAY_PG_QRIS", label: "QRIS", short: "QR", group: "qris", color: "#0F172A", needsStore: true },
  { payMethod: "VIRTUAL_ACCOUNT", payOption: "VIRTUAL_ACCOUNT_BCA", label: "BCA Virtual Account", short: "BCA", group: "va", color: "#0060AF" },
  { payMethod: "VIRTUAL_ACCOUNT", payOption: "VIRTUAL_ACCOUNT_BNI", label: "BNI Virtual Account", short: "BNI", group: "va", color: "#F15A23" },
  { payMethod: "VIRTUAL_ACCOUNT", payOption: "VIRTUAL_ACCOUNT_BRI", label: "BRI Virtual Account", short: "BRI", group: "va", color: "#00529C" },
  { payMethod: "VIRTUAL_ACCOUNT", payOption: "VIRTUAL_ACCOUNT_MANDIRI", label: "Mandiri Virtual Account", short: "MDR", group: "va", color: "#003D79" },
  { payMethod: "VIRTUAL_ACCOUNT", payOption: "VIRTUAL_ACCOUNT_BSI_PAYMENT", label: "BSI Virtual Account", short: "BSI", group: "va", color: "#00A39D" },
  { payMethod: "VIRTUAL_ACCOUNT", payOption: "VIRTUAL_ACCOUNT_CIMB", label: "CIMB Niaga Virtual Account", short: "CIMB", group: "va", color: "#7A0019" },
  { payMethod: "VIRTUAL_ACCOUNT", payOption: "VIRTUAL_ACCOUNT_PERMATA", label: "Permata Virtual Account", short: "PMT", group: "va", color: "#2E7D32" },
  { payMethod: "VIRTUAL_ACCOUNT", payOption: "VIRTUAL_ACCOUNT_BTPN", label: "BTPN Virtual Account", short: "BTPN", group: "va", color: "#F7941D" },
  { payMethod: "VIRTUAL_ACCOUNT", payOption: "VIRTUAL_ACCOUNT_PANI", label: "Panin Virtual Account", short: "PNN", group: "va", color: "#1F4E9D" },
  { payMethod: "NETWORK_PAY", payOption: "NETWORK_PAY_PG_CARD", label: "Kartu Kredit / Debit", short: "CARD", group: "card", color: "#334155", needsPhone: true },
  { payMethod: "NETWORK_PAY", payOption: "NETWORK_PAY_PC_INDOMARET", label: "Indomaret", short: "IDM", group: "other", color: "#D71920" },
  { payMethod: "NETWORK_PAY", payOption: "NETWORK_PAY_PL_INDODANA", label: "Indodana PayLater", short: "IDN", group: "other", color: "#0A7E4B" },
];

const key = (m: string, o: string) => `${m}:${o}`;
const BY_ID = new Map(CATALOG.map((c) => [key(c.payMethod, c.payOption), { ...c, id: key(c.payMethod, c.payOption) }]));
const BY_OPTION = new Map(CATALOG.filter((c) => c.payOption).map((c) => [c.payOption, { ...c, id: key(c.payMethod, c.payOption) }]));

/** Ubah pasangan payMethod/payOption (mis. dari Consult Pay) jadi opsi UI */
export function describeMethod(payMethod: string, payOption = ""): PayMethodOption {
  const found = BY_ID.get(key(payMethod, payOption)) ?? (payOption ? BY_OPTION.get(payOption) : undefined);
  if (found) return { ...found, payMethod, payOption };
  const label = (payOption || payMethod).replace(/^(VIRTUAL_ACCOUNT_|NETWORK_PAY_P[GCL]_)/, "").replace(/_/g, " ");
  const isCard = ["CREDIT_CARD", "DEBIT_CARD", "CARD", "DIRECT_DEBIT_CREDIT_CARD", "DIRECT_DEBIT_DEBIT_CARD"].includes(payMethod);
  return {
    id: key(payMethod, payOption),
    payMethod,
    payOption,
    label: payMethod === "VIRTUAL_ACCOUNT" ? `${label} Virtual Account` : label,
    short: label.slice(0, 4).toUpperCase(),
    group: payMethod === "VIRTUAL_ACCOUNT" ? "va" : isCard ? "card" : "other",
    color: "#475569",
    needsPhone: isCard,
  };
}

/** Daftar default saat Consult Pay tidak tersedia — sesuai whitelist sandbox SDK */
export const SANDBOX_FALLBACK_METHODS: PayMethodOption[] = [
  "BALANCE:",
  "NETWORK_PAY:NETWORK_PAY_PG_QRIS",
  "VIRTUAL_ACCOUNT:VIRTUAL_ACCOUNT_BRI",
  "VIRTUAL_ACCOUNT:VIRTUAL_ACCOUNT_CIMB",
  "VIRTUAL_ACCOUNT:VIRTUAL_ACCOUNT_BSI_PAYMENT",
  "VIRTUAL_ACCOUNT:VIRTUAL_ACCOUNT_BTPN",
  "VIRTUAL_ACCOUNT:VIRTUAL_ACCOUNT_PANI",
  "NETWORK_PAY:NETWORK_PAY_PG_CARD",
].map((id) => {
  const [m, o] = id.split(":");
  return describeMethod(m, o);
});

/** Whitelist sandbox dari dana-python custom_validation.py */
export const SANDBOX_ALLOWED_PAY_METHODS = new Set(["BALANCE", "CREDIT_CARD", "DEBIT_CARD", "VIRTUAL_ACCOUNT", "NETWORK_PAY"]);
export const SANDBOX_ALLOWED_PAY_OPTIONS = ["CARD", "QRIS", "BRI", "PANI", "CIMB", "BTPN", "BSI_PAYMENT"];

export function payOptionAllowedInSandbox(payOption: string) {
  if (!payOption) return true; // BALANCE tanpa payOption
  return SANDBOX_ALLOWED_PAY_OPTIONS.some((o) => payOption === o || payOption.endsWith("_" + o));
}

export const PG_STATUS: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "info" | "muted" }> = {
  "00": { label: "SUCCESS", tone: "ok" },
  "01": { label: "INITIATED", tone: "info" },
  "02": { label: "PAYING", tone: "warn" },
  "03": { label: "PENDING", tone: "warn" },
  "04": { label: "REFUNDED", tone: "muted" },
  "05": { label: "CANCELLED", tone: "bad" },
  "06": { label: "FAILED", tone: "bad" },
  "07": { label: "NOT FOUND", tone: "muted" },
};
