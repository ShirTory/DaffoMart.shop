/**
 * Minimal, dependency-free .xlsx (Office Open XML) writer and reader.
 * Why not a library: the project keeps its dependency list small, and import/export only needs plain tables.
 *
 * Safety:
 *  - export: every text cell is written as a string; text that starts with = + - @ is prefixed with an apostrophe-safe
 *    marker so Excel never executes it as a formula (CSV/formula injection).
 *  - import: formulas are never evaluated (cached values only); zip entry count, inflated size, row and column counts are capped
 *    (zip-bomb protection); anything that is not a well-formed .xlsx is rejected with a plain error message.
 */
import { deflateRawSync, inflateRawSync } from "zlib";

export type Cell = string | number | boolean | null | undefined;
export interface SheetIn { name: string; headers: string[]; rows: Cell[][]; widths?: number[] }
export interface SheetOut { name: string; rows: string[][] }
export class XlsxError extends Error {}

export const XLSX_LIMITS = { maxFileBytes: 5 * 1024 * 1024, maxEntries: 200, maxInflatedBytes: 25 * 1024 * 1024, maxRows: 5001, maxCols: 60 } as const;

/* ---------- CRC32 ---------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b: Buffer) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

/* ---------- XML helpers ---------- */
// eslint-disable-next-line no-control-regex
const BAD_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;
const esc = (s: string) => s.replace(BAD_XML, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const unesc = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_m, e: string) => {
  const l = e.toLowerCase();
  if (l === "amp") return "&"; if (l === "lt") return "<"; if (l === "gt") return ">"; if (l === "quot") return '"'; if (l === "apos") return "'";
  const code = l.startsWith("#x") ? parseInt(l.slice(2), 16) : parseInt(l.slice(1), 10);
  return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
});
/** Column index (0-based) -> letters. */
const colName = (i: number) => { let s = ""; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
const colIndex = (letters: string) => { let n = 0; for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };

/** Text starting with = + - @ (or a tab / CR) could be run as a formula when opened in Excel, so it is written with a leading apostrophe. Imports strip it again (see `cleanCell`). */
export const safeText = (s: string) => (/^[=+\-@\t\r]/.test(s) ? "'" + s : s);

/* ---------- ZIP writer ---------- */
function zip(files: { name: string; data: Buffer }[]): Buffer {
  const parts: Buffer[] = []; const central: Buffer[] = []; let offset = 0;
  const dos = { time: 0x6000, date: 0x5a21 }; // fixed timestamp: deterministic output
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8"); const comp = deflateRawSync(f.data); const crc = crc32(f.data);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(dos.time, 10); lh.writeUInt16LE(dos.date, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(f.data.length, 22); lh.writeUInt16LE(name.length, 26);
    parts.push(lh, name, comp);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(dos.time, 12); ch.writeUInt16LE(dos.date, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(f.data.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42);
    central.push(ch, name);
    offset += lh.length + name.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

/* ---------- Writer ---------- */
const sheetName = (n: string, used: Set<string>) => {
  let base = (n || "Sheet").replace(/[\[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Sheet"; let name = base, i = 2;
  while (used.has(name.toLowerCase())) name = base.slice(0, 28) + " " + i++;
  used.add(name.toLowerCase()); return name;
};

export function buildXlsx(sheets: SheetIn[]): Buffer {
  if (!sheets.length) throw new XlsxError("A workbook needs at least one sheet");
  const used = new Set<string>(); const names = sheets.map((s) => sheetName(s.name, used));
  const cell = (v: Cell, r: number, c: number, style = 0) => {
    const ref = colName(c) + (r + 1); const s = style ? ` s="${style}"` : "";
    if (v === null || v === undefined || v === "") return "";
    if (typeof v === "number") return Number.isFinite(v) ? `<c r="${ref}"${s}><v>${v}</v></c>` : "";
    const text = typeof v === "boolean" ? (v ? "Yes" : "No") : safeText(String(v)).slice(0, 32000);
    return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(text)}</t></is></c>`;
  };
  const sheetXml = (s: SheetIn) => {
    const cols = s.headers.length; const widths = s.headers.map((h, i) => s.widths?.[i] ?? Math.min(48, Math.max(10, h.length + 4)));
    const rows = [`<row r="1">${s.headers.map((h, c) => cell(h, 0, c, 1)).join("")}</row>`];
    s.rows.forEach((row, r) => rows.push(`<row r="${r + 2}">${row.slice(0, cols).map((v, c) => cell(v, r + 1, c)).join("")}</row>`));
    const last = colName(Math.max(0, cols - 1)) + Math.max(1, s.rows.length + 1);
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${last}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${rows.join("")}</sheetData>${cols ? `<autoFilter ref="A1:${colName(cols - 1)}${Math.max(1, s.rows.length + 1)}"/>` : ""}</worksheet>`;
  };
  const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const files = [
    { name: "[Content_Types].xml", data: `${X}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>` },
    { name: "_rels/.rels", data: `${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", data: `${X}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", data: `${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/styles.xml", data: `${X}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1E3A8A"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) })),
  ].map((f) => ({ name: f.name, data: Buffer.from(f.data, "utf8") }));
  return zip(files);
}

/* ---------- ZIP reader (with limits) ---------- */
function unzip(buf: Buffer): Map<string, Buffer> {
  if (buf.length < 22) throw new XlsxError("This file is not a valid .xlsx workbook");
  let eocd = -1; for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new XlsxError("This file is not a valid .xlsx workbook (it is not a zip archive). Save it as “Excel Workbook (.xlsx)”.");
  const total = buf.readUInt16LE(eocd + 10); let p = buf.readUInt32LE(eocd + 16);
  if (total > XLSX_LIMITS.maxEntries) throw new XlsxError("The workbook contains too many internal files");
  const out = new Map<string, Buffer>(); let inflated = 0;
  for (let i = 0; i < total; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new XlsxError("The workbook is damaged");
    const flags = buf.readUInt16LE(p + 8), method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24);
    const nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lo = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nl).replace(/\\/g, "/"); p += 46 + nl + el + cl;
    if (name.endsWith("/")) continue;
    if (flags & 1) throw new XlsxError("Password-protected workbooks are not supported");
    if (!/^(\[Content_Types\]\.xml|_rels\/.*|xl\/(workbook\.xml|sharedStrings\.xml|_rels\/.*|worksheets\/[^/]+\.xml))$/.test(name)) continue; // only what we need
    if (usize > XLSX_LIMITS.maxInflatedBytes) throw new XlsxError("The workbook is too large to import");
    if (lo + 30 > buf.length || buf.readUInt32LE(lo) !== 0x04034b50) throw new XlsxError("The workbook is damaged");
    const start = lo + 30 + buf.readUInt16LE(lo + 26) + buf.readUInt16LE(lo + 28); const raw = buf.subarray(start, start + csize);
    let data: Buffer;
    try { data = method === 0 ? Buffer.from(raw) : method === 8 ? inflateRawSync(raw, { maxOutputLength: XLSX_LIMITS.maxInflatedBytes }) : (() => { throw new XlsxError("Unsupported compression in workbook"); })(); }
    catch (e) { if (e instanceof XlsxError) throw e; throw new XlsxError("The workbook is damaged or too large to import"); }
    inflated += data.length; if (inflated > XLSX_LIMITS.maxInflatedBytes) throw new XlsxError("The workbook is too large to import");
    out.set(name, data);
  }
  return out;
}

const attr = (tag: string, name: string) => { const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag); return m ? unesc(m[1]) : undefined; };
const textOf = (xml: string) => { let s = ""; const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t\s*\/>/g; let m; while ((m = re.exec(xml))) s += unesc(m[1] ?? ""); return s; };

/** Reads every sheet as a grid of strings (first row = headers). Formulas are NOT executed; their cached value is returned. */
export function parseXlsx(buf: Buffer): SheetOut[] {
  if (buf.length > XLSX_LIMITS.maxFileBytes) throw new XlsxError("File is too large (max 5 MB)");
  const files = unzip(buf);
  const wb = files.get("xl/workbook.xml"); if (!wb) throw new XlsxError("This does not look like an Excel (.xlsx) workbook");
  const rels = files.get("xl/_rels/workbook.xml.rels")?.toString("utf8") ?? "";
  const relTarget = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) { const id = attr(m[0], "Id"), t = attr(m[0], "Target"); if (id && t) relTarget.set(id, t.startsWith("/") ? t.slice(1) : "xl/" + t.replace(/^\.\//, "")); }
  const shared: string[] = []; const ss = files.get("xl/sharedStrings.xml")?.toString("utf8");
  if (ss) for (const m of ss.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>|<si\s*\/>/g)) shared.push(textOf(m[1] ?? ""));
  const out: SheetOut[] = [];
  for (const m of wb.toString("utf8").matchAll(/<sheet\b[^>]*>/g)) {
    const name = attr(m[0], "name") ?? "Sheet"; const rid = attr(m[0], "r:id") ?? attr(m[0], "id");
    const path = rid ? relTarget.get(rid) : undefined; const xml = path ? files.get(path)?.toString("utf8") : undefined;
    if (!xml) continue;
    const rows: string[][] = [];
    for (const rm of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const ri = Number(attr(rm[1], "r")) - 1; const rowIdx = Number.isFinite(ri) && ri >= 0 ? ri : rows.length;
      if (rowIdx >= XLSX_LIMITS.maxRows) throw new XlsxError(`Too many rows (max ${XLSX_LIMITS.maxRows - 1} data rows per import)`);
      const cells: string[] = [];
      for (const cm of (rm[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = attr(cm[1], "r"); const letters = ref ? /^[A-Z]+/.exec(ref)?.[0] : undefined;
        const ci = letters ? colIndex(letters) : cells.length; if (ci >= XLSX_LIMITS.maxCols) continue;
        const t = attr(cm[1], "t"); const body = cm[2] ?? ""; let v = "";
        if (t === "inlineStr") v = textOf(body);
        else { const vm = /<v>([\s\S]*?)<\/v>/.exec(body); const raw = vm ? unesc(vm[1]) : ""; v = t === "s" ? (shared[Number(raw)] ?? "") : t === "b" ? (raw === "1" ? "TRUE" : "FALSE") : raw; }
        while (cells.length < ci) cells.push(""); cells[ci] = v;
      }
      while (rows.length < rowIdx) rows.push([]); rows[rowIdx] = cells;
    }
    out.push({ name, rows });
  }
  if (!out.length) throw new XlsxError("The workbook has no readable sheets");
  return out;
}

/** Excel stores dates as serial day numbers; convert to YYYY-MM-DD (1900 date system). */
export const excelSerialToDate = (n: number) => (n > 0 && n < 2958466 ? new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0, 10) : "");

/** Import-side cleaning of one cell: trims, and removes the apostrophe `safeText` added in front of formula-like text. */
export const cleanCell = (v: unknown) => String(v ?? "").replace(/^'(?=[=+\-@\t\r])/, "").trim();
