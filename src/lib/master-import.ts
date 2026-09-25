/**
 * Master-data import — parsing and normalisation for the business's master
 * workbook (products, dealers, sub-dealers).
 *
 * Pure: no database, no server-only import, no spreadsheet library. Callers
 * hand in plain row arrays (cell values in sheet column order), so the same
 * rules serve the CLI importer today and an Admin upload screen later, and
 * are unit-tested in __tests__/master-import.test.ts.
 *
 * Every row either becomes a clean record or an Issue explaining why it was
 * changed or skipped. Nothing is dropped silently.
 */

export type Cell = string | number | boolean | Date | null | undefined;
export type Row = Cell[];

export type Issue = {
  sheet: string;
  /** 1-based spreadsheet row, header included, so it matches what Excel shows. */
  row: number;
  kind: "skipped" | "corrected" | "warning";
  message: string;
};

// ── Cell normalisers ──

/** Trimmed, whitespace-collapsed, upper-cased text; null when blank. */
export function text(v: Cell): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, " ").trim().toUpperCase();
  return s === "" ? null : s;
}

/** SKU / dealer code: every whitespace character removed ("AFSMAT50 -BL"). */
export function code(v: Cell): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, "").toUpperCase();
  return s === "" ? null : s;
}

export type SeatType = "SINGLE" | "DUAL";

/** SINGLE / DUAL; "N/A" and blank mean the product has no seat configuration. */
export function seat(v: Cell): SeatType | null | "INVALID" {
  const s = text(v);
  if (s === null || s === "N/A" || s === "NA") return null;
  if (s === "SINGLE") return "SINGLE";
  if (s === "DUAL" || s === "DOUBLE") return "DUAL";
  return "INVALID";
}

/** The sheet says PCS; the schema's enum says PC. */
export function packing(v: Cell): "PC" | "SET" | null {
  const s = text(v);
  if (s === "PCS" || s === "PC") return "PC";
  if (s === "SET" || s === "SETS") return "SET";
  return null;
}

/** A positive rupee amount as a 2dp string, or null. Never a float in the DB. */
export function money(v: Cell): string | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[,₹\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  // Round through integer paise so 12.345 cannot drift.
  return (Math.round(n * 100) / 100).toFixed(2);
}

/** GST slabs in force in India: 0/5/18/40 since GST 2.0, 12/28 still on older goods. */
export const GST_SLABS = ["0", "5", "12", "18", "28", "40"] as const;

/**
 * GST rate as a percent string ("18"). Excel stores a percent-formatted cell
 * as a fraction (0.18), so anything at or below 1 is read as a fraction;
 * "18%" and 18 are accepted too. Anything that is not a real slab is refused.
 */
export function gstRate(v: Cell): string | null | "INVALID" {
  if (v === null || v === undefined || v === "") return null;
  const raw = typeof v === "number" ? v : Number(String(v).replace(/[%\s]/g, ""));
  if (!Number.isFinite(raw) || raw < 0) return "INVALID";
  // 0.18 → 18. Round away float noise (0.18 * 100 = 18.000000000000004).
  const pct = raw > 0 && raw <= 1 ? Math.round(raw * 10000) / 100 : raw;
  const s = String(pct);
  return (GST_SLABS as readonly string[]).includes(s) ? s : "INVALID";
}

/**
 * Six-digit pincode as text. Excel stores pins as numbers, so a pin that
 * lost digits (60006 for 600006) is reported rather than guessed at.
 */
export function pincode(v: Cell): { value: string | null; valid: boolean } {
  if (v === null || v === undefined || v === "") return { value: null, valid: false };
  const s = String(v).replace(/\D/g, "");
  return { value: s || null, valid: /^[1-9][0-9]{5}$/.test(s) };
}

/**
 * Sales person label, unified across the three spellings the sheets use:
 * "Mr. Kundan", "KUNDAN" and territory codes like "ASM_WEST".
 */
export function salesPerson(v: Cell): string | null {
  const s = text(v);
  if (s === null) return null;
  return s.replace(/^(MR|MRS|MS)\.?\s+/, "").trim() || null;
}

// ── States ──

/**
 * GSTIN state codes. The first two digits of a GSTIN are the legal state of
 * registration, which also decides IGST vs CGST+SGST — so when a GSTIN is
 * present it wins over whatever the sheet's STATE column says.
 */
export const GST_STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
};

const STATE_BY_KEY: Record<string, string> = Object.fromEntries(
  Object.values(GST_STATE_CODES).map((name) => [stateKey(name), name]),
);

/** Misspellings seen in the business's sheets, keyed by stateKey(). */
const STATE_ALIASES: Record<string, string> = {
  MAHARASTHRA: "Maharashtra",
  UTTARPARDESH: "Uttar Pradesh",
  UP: "Uttar Pradesh",
  ORISSA: "Odisha",
  TAMILNAD: "Tamil Nadu",
  JAMMUKASHMIR: "Jammu and Kashmir",
  JK: "Jammu and Kashmir",
  PONDICHERRY: "Puducherry",
  CHATTISGARH: "Chhattisgarh",
  CHHATISGARH: "Chhattisgarh",
};

/** Letters only, upper-cased: "Tamil Nadu", "TAMILNADU", "tamil-nadu" → "TAMILNADU". */
function stateKey(s: string): string {
  return s.toUpperCase().replace(/&/g, "AND").replace(/[^A-Z]/g, "");
}

/** Canonical state name from free text, or null when unrecognised. */
export function stateFromText(v: Cell): string | null {
  if (v === null || v === undefined) return null;
  const k = stateKey(String(v));
  if (!k) return null;
  return STATE_BY_KEY[k] ?? STATE_ALIASES[k] ?? null;
}

export function stateFromGstin(gstin: string | null): string | null {
  if (!gstin) return null;
  return GST_STATE_CODES[gstin.slice(0, 2)] ?? null;
}

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function isGstin(v: string | null): v is string {
  return v !== null && GSTIN_PATTERN.test(v);
}

// ── Colour inference ──

/**
 * Colour suffix → colour, learned from the product rows themselves (every
 * "-BU" code with a colour says BLUE). Only unambiguous suffixes are kept, so
 * a suffix used for two different colours never drives an inference.
 */
export function learnColourSuffixes(
  rows: { code: string; colour: string | null }[],
): Map<string, string> {
  const seen = new Map<string, Set<string>>();
  for (const r of rows) {
    const suffix = colourSuffix(r.code);
    if (!suffix || !r.colour) continue;
    if (!seen.has(suffix)) seen.set(suffix, new Set());
    seen.get(suffix)!.add(r.colour);
  }
  const out = new Map<string, string>();
  for (const [suffix, colours] of seen) {
    if (colours.size === 1) out.set(suffix, [...colours][0]);
  }
  return out;
}

function colourSuffix(sku: string): string | null {
  const i = sku.lastIndexOf("-");
  return i > 0 && i < sku.length - 1 ? sku.slice(i + 1) : null;
}

// ── Products ──

/** Column order of the "PRODUCT LIST WITH CODE & MRP" sheet. */
const P = { oem: 0, style: 1, code: 2, item: 3, vehicleType: 4, colour: 5, seat: 6, packing: 7, mrp: 8, gst: 9 };

export type ProductSku = {
  row: number;
  oem: string;
  /** Vehicle (or, for accessories, the product line) — the sheet's ITEMS. */
  vehicle: string;
  /** The sheet's PART NO. — actually a style (U-ACTIVE, U-IMPRESS…). */
  style: string;
  code: string;
  colour: string | null;
  seatType: SeatType | null;
  packingUnit: "PC" | "SET";
  vehicleType: string | null;
  mrp: string;
  /** Percent, e.g. "18". */
  gstRatePct: string;
};

/** Stable key for a Part: one style for one vehicle of one OEM. */
export const partKey = (s: { oem: string; vehicle: string; style: string }) =>
  `${s.oem}\u0000${s.vehicle}\u0000${s.style}`;

export function parseProducts(
  rows: Row[],
  sheet = "PRODUCTS",
  firstRow = 2,
): { skus: ProductSku[]; issues: Issue[] } {
  const issues: Issue[] = [];
  const skip = (row: number, message: string) =>
    issues.push({ sheet, row, kind: "skipped", message });

  const candidates: ProductSku[] = [];
  rows.forEach((r, i) => {
    const row = firstRow + i;
    if (r.every((c) => c === null || c === undefined || c === "")) return;

    const oem = text(r[P.oem]);
    const vehicle = text(r[P.item]);
    const style = text(r[P.style]);
    const sku = code(r[P.code]);
    if (!oem || !vehicle || !style || !sku) {
      return skip(row, "Missing OEM, ITEMS, PART NO. or CODE.");
    }
    if (sku !== String(r[P.code]).trim().toUpperCase()) {
      issues.push({ sheet, row, kind: "corrected", message: `Code "${r[P.code]}" had stray spaces; imported as ${sku}.` });
    }

    const seatType = seat(r[P.seat]);
    if (seatType === "INVALID") return skip(row, `Unrecognised SEAT "${r[P.seat]}".`);

    const packingUnit = packing(r[P.packing]);
    if (!packingUnit) return skip(row, `Unrecognised PCS/SET "${r[P.packing]}".`);

    const mrp = money(r[P.mrp]);
    if (!mrp) return skip(row, `MRP "${r[P.mrp] ?? ""}" is missing or not a positive amount.`);

    // Without a rate the SKU cannot be ordered (createOrder refuses it), so
    // importing it would only add an unusable row.
    const gstRatePct = gstRate(r[P.gst]);
    if (gstRatePct === null) return skip(row, "GST is missing.");
    if (gstRatePct === "INVALID") return skip(row, `GST "${r[P.gst]}" is not a valid slab (${GST_SLABS.join("/")}%).`);

    candidates.push({
      row,
      oem,
      vehicle,
      style,
      code: sku,
      colour: text(r[P.colour]),
      seatType,
      packingUnit,
      vehicleType: text(r[P.vehicleType]),
      mrp,
      gstRatePct,
    });
  });

  // Fill a blank colour from the code suffix only when the data itself proves
  // what that suffix means.
  const suffixes = learnColourSuffixes(candidates);
  for (const s of candidates) {
    if (s.colour) continue;
    const suffix = colourSuffix(s.code);
    const inferred = suffix ? suffixes.get(suffix) : undefined;
    if (inferred) {
      s.colour = inferred;
      issues.push({ sheet, row: s.row, kind: "corrected", message: `${s.code}: blank COLOUR filled as ${inferred} from its "-${suffix}" suffix.` });
    }
  }

  // Codes are the business's SKU identity: the first occurrence wins.
  const byCode = new Map<string, ProductSku>();
  const skus: ProductSku[] = [];
  for (const s of candidates) {
    const first = byCode.get(s.code);
    if (first) {
      skip(s.row, `Duplicate CODE ${s.code} (first seen on row ${first.row}).`);
      continue;
    }
    byCode.set(s.code, s);
    skus.push(s);
  }

  // Seat, packing, vehicle type and GST describe the style, so they must
  // agree across its colours. Disagreement means a data error, not a variant.
  const byPart = new Map<string, ProductSku>();
  const kept: ProductSku[] = [];
  for (const s of skus) {
    const first = byPart.get(partKey(s));
    if (
      first &&
      (first.seatType !== s.seatType ||
        first.packingUnit !== s.packingUnit ||
        first.vehicleType !== s.vehicleType ||
        first.gstRatePct !== s.gstRatePct)
    ) {
      skip(s.row, `${s.code}: SEAT / PCS/SET / VEHICLE TYPE / GST disagrees with row ${first.row} for the same style and vehicle.`);
      continue;
    }
    if (!first) byPart.set(partKey(s), s);
    kept.push(s);
  }

  // Two codes for one (style, colour). With a named colour the database's
  // unique (part, colour) would reject the second, so it is skipped. Without
  // a colour both can be stored, but the order form's picker cannot tell
  // them apart — import both and say so.
  const byChoice = new Map<string, ProductSku>();
  const out: ProductSku[] = [];
  for (const s of kept) {
    const k = `${partKey(s)}\u0000${s.colour ?? ""}`;
    const first = byChoice.get(k);
    if (first && s.colour) {
      skip(s.row, `${s.code}: same style, vehicle and colour (${s.colour}) as ${first.code} on row ${first.row}.`);
      continue;
    }
    if (first) {
      issues.push({ sheet, row: s.row, kind: "warning", message: `${s.code} and ${first.code} share style and vehicle with no colour; the order form cannot tell them apart.` });
    } else byChoice.set(k, s);
    out.push(s);
  }

  for (const s of out) {
    if ([s.oem, s.vehicle, s.style].some((v) => v.includes("�"))) {
      issues.push({ sheet, row: s.row, kind: "warning", message: `${s.code}: name contains an unreadable character (�) — fix it in the sheet.` });
    }
  }

  return { skus: out, issues };
}

// ── Dealers ──

/** Column order of the "DEALER LIST" sheet. */
const D = { serial: 0, salesPerson: 1, gstin: 2, code: 3, name: 4, city: 5, address: 6, pincode: 7, state: 8 };

export type DealerRecord = {
  row: number;
  code: string;
  name: string;
  gstin: string | null;
  address: string;
  city: string;
  state: string;
  pincode: string;
  salesPerson: string | null;
};

export function parseDealers(
  rows: Row[],
  sheet = "DEALER LIST",
  firstRow = 2,
): { dealers: DealerRecord[]; issues: Issue[] } {
  const issues: Issue[] = [];
  const add = (row: number, kind: Issue["kind"], message: string) =>
    issues.push({ sheet, row, kind, message });

  const dealers: DealerRecord[] = [];
  const byCode = new Map<string, DealerRecord>();

  rows.forEach((r, i) => {
    const row = firstRow + i;
    if (r.slice(0, 9).every((c) => c === null || c === undefined || c === "")) return;

    const name = text(r[D.name]);
    const dealerCode = code(r[D.code]);
    if (!name) return add(row, "skipped", "Missing PARTY'S NAME.");
    if (!dealerCode) return add(row, "skipped", `${name}: no DEALER CODE.`);

    const first = byCode.get(dealerCode);
    if (first) {
      return add(row, "skipped", `Duplicate DEALER CODE ${dealerCode} (${name}); kept row ${first.row} (${first.name}).`);
    }

    let gstin = code(r[D.gstin]);
    if (gstin && !isGstin(gstin)) {
      add(row, "warning", `${dealerCode}: GSTIN "${r[D.gstin]}" is not valid; imported without it.`);
      gstin = null;
    }

    // Addresses in the sheet carry hard line breaks; keep them readable.
    const address = r[D.address] == null
      ? null
      : String(r[D.address]).replace(/\s*\n\s*/g, ", ").replace(/\s+/g, " ").replace(/,\s*,/g, ",").trim().replace(/[,\s]+$/, "");
    const city = text(r[D.city]);
    if (!address || !city) return add(row, "skipped", `${dealerCode}: missing ADDRESS or LOCATION.`);

    let pin = pincode(r[D.pincode]);
    if (!pin.valid) {
      // A PIN cell Excel mangled (60006) is usually still right in the
      // address text ("…Tamil Nadu,-600006"). Use it only when the address
      // names exactly one pincode.
      const inAddress = [...new Set(address.match(/(?<!\d)[1-9]\d{5}(?!\d)/g) ?? [])];
      if (inAddress.length === 1) {
        add(row, "corrected", `${dealerCode}: PIN CODE ${pin.value ?? "(blank)"} is not valid; used ${inAddress[0]} from the address.`);
        pin = { value: inAddress[0], valid: true };
      }
    }
    if (!pin.value) return add(row, "skipped", `${dealerCode}: missing PIN CODE.`);
    if (!pin.valid) add(row, "warning", `${dealerCode}: PIN CODE ${pin.value} is not a valid 6-digit pincode; imported as-is, needs fixing.`);

    const fromGst = stateFromGstin(gstin);
    const fromSheet = stateFromText(r[D.state]);
    const state = fromGst ?? fromSheet;
    if (!state) return add(row, "skipped", `${dealerCode}: STATE "${r[D.state] ?? ""}" not recognised and no GSTIN to derive it from.`);
    if (fromGst && fromSheet && fromGst !== fromSheet) {
      add(row, "corrected", `${dealerCode}: STATE says ${fromSheet} but GSTIN is registered in ${fromGst}; using ${fromGst}.`);
    } else if (!fromGst && text(r[D.state]) !== text(state)) {
      add(row, "corrected", `${dealerCode}: STATE "${r[D.state]}" normalised to ${state}.`);
    }

    const rec: DealerRecord = {
      row,
      code: dealerCode,
      name,
      gstin,
      address,
      city,
      state,
      pincode: pin.value,
      salesPerson: salesPerson(r[D.salesPerson]),
    };
    byCode.set(dealerCode, rec);
    dealers.push(rec);
  });

  return { dealers, issues };
}

// ── Sub-dealers ──

/** Column order of the "SUB DEALER LIST" sheet. COUNT is ignored. */
const S = { salesPerson: 0, parent: 1, name: 2 };

export type SubDealerRecord = {
  row: number;
  dealerCode: string;
  name: string;
  salesPerson: string | null;
};

/**
 * The sheet links sub-dealers to their dealer by NAME, not code, so parents
 * are resolved against the parsed dealer list. A name matching no dealer, or
 * more than one, is reported rather than guessed.
 */
export function parseSubDealers(
  rows: Row[],
  dealers: DealerRecord[],
  sheet = "SUB DEALER LIST",
  firstRow = 2,
): { subDealers: SubDealerRecord[]; issues: Issue[] } {
  const issues: Issue[] = [];
  const add = (row: number, kind: Issue["kind"], message: string) =>
    issues.push({ sheet, row, kind, message });

  const byName = new Map<string, DealerRecord[]>();
  for (const d of dealers) {
    const k = nameKey(d.name);
    byName.set(k, [...(byName.get(k) ?? []), d]);
  }

  const subDealers: SubDealerRecord[] = [];
  const seen = new Set<string>();

  rows.forEach((r, i) => {
    const row = firstRow + i;
    if (r.slice(0, 3).every((c) => c === null || c === undefined || c === "")) return;

    const name = text(r[S.name]);
    const parent = text(r[S.parent]);
    if (!name || !parent) return add(row, "skipped", "Missing PARTY'S NAME or SUB DEALER'S NAME.");

    const matches = byName.get(nameKey(parent)) ?? [];
    if (matches.length === 0) return add(row, "skipped", `${name}: parent "${parent}" matches no dealer in DEALER LIST.`);
    if (matches.length > 1) return add(row, "skipped", `${name}: parent "${parent}" matches ${matches.length} dealers (${matches.map((m) => m.code).join(", ")}).`);

    const dealerCode = matches[0].code;
    const k = `${dealerCode}\u0000${nameKey(name)}`;
    if (seen.has(k)) return add(row, "skipped", `${name} is listed twice under ${parent}.`);
    seen.add(k);

    subDealers.push({ row, dealerCode, name, salesPerson: salesPerson(r[S.salesPerson]) });
  });

  return { subDealers, issues };
}

/** Name comparison ignoring case, punctuation and spacing. */
function nameKey(s: string): string {
  return s.toUpperCase().replace(/&/g, "AND").replace(/[^A-Z0-9]/g, "");
}
