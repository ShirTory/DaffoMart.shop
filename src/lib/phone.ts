/** Bangladesh phone helpers shared by checkout, CRM, Excel import and WhatsApp. Pure: no I/O. */
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** "+880 1712-345678" / "8801712345678" / "০১৭১২৩৪৫৬৭৮" -> "01712345678"; null when it is not a valid BD mobile number. */
export function normalizeBdPhone(v: unknown): string | null {
  let s = String(v ?? "").trim();
  if (!s) return null;
  s = s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d))).replace(/[\s\-().]/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  if (/^8801[3-9]\d{8}$/.test(s)) s = s.slice(2);
  else if (/^1[3-9]\d{8}$/.test(s)) s = "0" + s; // Excel drops the leading zero of numeric cells
  return /^01[3-9]\d{8}$/.test(s) ? s : null;
}

/** Digits-only international number for the WhatsApp API ("01712345678" -> "8801712345678"). null when it cannot be a real number. */
export function waNumber(v: unknown, countryCode = "880"): string | null {
  const bd = normalizeBdPhone(v);
  if (bd) return countryCode.replace(/\D/g, "") + bd.slice(1);
  const d = String(v ?? "").replace(/\D/g, "");
  return d.length >= 10 && d.length <= 15 && !d.startsWith("0") ? d : null;
}
export const maskPhone = (p: string) => (p.length > 6 ? p.slice(0, 3) + "•".repeat(p.length - 6) + p.slice(-3) : p);
