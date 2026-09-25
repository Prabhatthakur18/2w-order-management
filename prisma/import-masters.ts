/**
 * Imports the business's master workbook: products (with MRP), dealers and
 * sub-dealers.
 *
 *   npm run db:import -- "<path to .xlsx>"            dry run: report only
 *   npm run db:import -- "<path to .xlsx>" --apply    write to the database
 *   add  --report issues.csv  to save every issue for whoever owns the sheet
 *
 * Rules live in src/lib/master-import.ts (and its tests); this file only
 * reads the workbook and writes rows.
 *
 * Re-running is safe. Everything upserts on the business's own keys (SKU
 * code, dealer code), and only the columns the sheet actually carries are
 * written — a phone number an ASM added in the app survives the next import.
 * The catalog is synced: a SKU missing from the sheet is deactivated, never
 * deleted, because past orders still reference it. Dealers are not synced,
 * since ASMs create dealers in the app too.
 *
 * Prices: MRP loads as the untiered, date-effective list price. An unchanged
 * MRP is left alone; a changed one closes the old price and starts a new one,
 * so orders already placed keep the price they were placed at.
 *
 * GST: each style links to a slab named for its rate ("GST 18%"), created
 * on first use. Order lines snapshot the rate, so changing a style's GST in
 * the sheet never alters an order already placed.
 */
import { writeFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import {
  parseDealers,
  parseProducts,
  parseSubDealers,
  partKey,
  text,
  type Cell,
  type Issue,
  type Row,
} from "../src/lib/master-import";

const db = new PrismaClient();

const EXPECTED = {
  products: ["OEM'S", "PART NO.", "CODE", "ITEMS", "VEHICLE TYPE", "COLOUR", "SEAT", "PCS/SET", "MRP", "GST"],
  dealers: ["S.NO", "SALES PERSON", "GST NO.", "DEALER CODE", "PARTY'S NAME", "LOCATION", "ADDRESS", "PIN CODE", "STATE"],
  subDealers: ["SALES PERSON", "PARTY'S NAME", "SUB DEALER'S NAME"],
};

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--report");
  const apply = args.includes("--apply");
  const reportPath = args.includes("--report") ? args[args.indexOf("--report") + 1] : null;
  if (!file) {
    console.error('Usage: npm run db:import -- "<workbook.xlsx>" [--apply] [--report issues.csv]');
    process.exit(2);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);

  const productRows = readSheet(wb, /^PRODUCT LIST/i, EXPECTED.products);
  const dealerRows = readSheet(wb, /^DEALER LIST/i, EXPECTED.dealers);
  const subRows = readSheet(wb, /^SUB DEALER/i, EXPECTED.subDealers);

  const products = parseProducts(productRows.rows, productRows.name);
  const dealers = parseDealers(dealerRows.rows, dealerRows.name);
  const subDealers = parseSubDealers(subRows.rows, dealers.dealers, subRows.name);
  const issues = [...products.issues, ...dealers.issues, ...subDealers.issues];

  const skus = products.skus;
  const oems = new Set(skus.map((s) => s.oem));
  const vehicles = new Set(skus.map((s) => `${s.oem}\u0000${s.vehicle}`));
  const parts = new Map(skus.map((s) => [partKey(s), s]));

  // What the database already holds, to show what a run would change.
  const [existingCodes, existingDealers, activeSkus] = await Promise.all([
    db.partColour.findMany({ select: { productCode: true } }),
    db.dealer.findMany({ select: { code: true, isActive: true } }),
    db.partColour.findMany({ where: { isActive: true }, select: { productCode: true } }),
  ]);
  const have = new Set(existingCodes.map((c) => c.productCode));
  const sheetCodes = new Set(skus.map((s) => s.code));
  const haveDealers = new Set(existingDealers.map((d) => d.code));
  const sheetDealers = new Set(dealers.dealers.map((d) => d.code));
  const toDeactivate = activeSkus.filter((c) => !sheetCodes.has(c.productCode));
  const dealersNotInSheet = existingDealers.filter((d) => d.isActive && !sheetDealers.has(d.code));

  console.log(`\n${apply ? "IMPORT" : "DRY RUN"} — ${file}\n`);
  console.log(`  OEMs          ${oems.size}`);
  console.log(`  Vehicles      ${vehicles.size}`);
  console.log(`  Styles        ${parts.size}   (GST: ${[...new Set(skus.map((s) => s.gstRatePct))].sort((a, b) => Number(a) - Number(b)).map((r) => `${r}% × ${[...parts.values()].filter((p) => p.gstRatePct === r).length}`).join(", ")})`);
  console.log(`  SKUs          ${skus.length}   (${skus.filter((s) => !have.has(s.code)).length} new, ${skus.filter((s) => have.has(s.code)).length} existing)`);
  console.log(`  SKUs to deactivate (active in DB, not in sheet)   ${toDeactivate.length}`);
  console.log(`  Dealers       ${dealers.dealers.length}   (${dealers.dealers.filter((d) => !haveDealers.has(d.code)).length} new)`);
  console.log(`  Sub-dealers   ${subDealers.subDealers.length}`);
  if (dealersNotInSheet.length) {
    console.log(`  Active dealers not in sheet (left as-is): ${dealersNotInSheet.map((d) => d.code).join(", ")}`);
  }
  printIssues(issues);
  if (reportPath) {
    writeFileSync(reportPath, toCsv(issues), "utf8");
    console.log(`\nIssue report written to ${reportPath}`);
  }

  if (!apply) {
    console.log("\nNothing written. Re-run with --apply to import.");
    return;
  }

  const started = Date.now();
  const stats = await db.$transaction(
    async (tx) => {
      const now = new Date();
      const s = { pricesCreated: 0, pricesUnchanged: 0, pricesRevised: 0 };

      // GST slabs, one per rate. The sheet carries no HSN, so a slab holds
      // only its rate — clear any HSN a placeholder seed invented.
      const slabIds = new Map<string, string>();
      for (const rate of new Set(skus.map((x) => x.gstRatePct))) {
        const slab = await tx.gstSlab.upsert({
          where: { name: `GST ${rate}%` },
          update: { ratePct: rate, hsnCode: null, isActive: true, validTo: null },
          create: { name: `GST ${rate}%`, ratePct: rate, validFrom: new Date("2025-04-01") },
        });
        slabIds.set(rate, slab.id);
      }

      // Catalog: OEM → Vehicle → Part (style) → PartColour (SKU).
      const oemIds = new Map<string, string>();
      for (const name of oems) {
        const o = await tx.oem.upsert({
          where: { code: name },
          update: { name, isActive: true },
          create: { code: name, name },
        });
        oemIds.set(name, o.id);
      }

      const vehicleIds = new Map<string, string>();
      for (const key of vehicles) {
        const [oem, name] = key.split("\u0000");
        const oemId = oemIds.get(oem)!;
        const v = await tx.vehicle.upsert({
          where: { oemId_code: { oemId, code: name } },
          update: { name, isActive: true },
          create: { oemId, code: name, name },
        });
        vehicleIds.set(key, v.id);
      }

      const partIds = new Map<string, string>();
      for (const [key, p] of parts) {
        const vehicleId = vehicleIds.get(`${p.oem}\u0000${p.vehicle}`)!;
        const fields = {
          name: p.style,
          packingUnit: p.packingUnit,
          seatType: p.seatType,
          vehicleType: p.vehicleType,
          gstSlabId: slabIds.get(p.gstRatePct)!,
          isActive: true,
        };
        const row = await tx.part.upsert({
          where: { vehicleId_partNo: { vehicleId, partNo: p.style } },
          update: fields,
          create: { vehicleId, partNo: p.style, ...fields },
        });
        partIds.set(key, row.id);
      }

      for (const sku of skus) {
        const partId = partIds.get(partKey(sku))!;
        const pc = await tx.partColour.upsert({
          where: { productCode: sku.code },
          update: { partId, colour: sku.colour, isActive: true },
          create: { partId, colour: sku.colour, productCode: sku.code },
        });

        const current = await tx.priceList.findFirst({
          where: {
            partColourId: pc.id,
            priceTierId: null,
            isActive: true,
            validFrom: { lte: now },
            OR: [{ validTo: null }, { validTo: { gt: now } }],
          },
          orderBy: { validFrom: "desc" },
        });
        if (current && current.unitPrice.toFixed(2) === sku.mrp) {
          s.pricesUnchanged++;
          continue;
        }
        if (current) {
          await tx.priceList.update({ where: { id: current.id }, data: { validTo: now } });
          s.pricesRevised++;
        } else s.pricesCreated++;
        await tx.priceList.create({
          data: { partColourId: pc.id, unitPrice: sku.mrp, validFrom: now },
        });
      }

      // Sync: whatever the sheet no longer lists stops being orderable.
      const deactivated = {
        skus: (await tx.partColour.updateMany({
          where: { isActive: true, productCode: { notIn: [...sheetCodes] } },
          data: { isActive: false },
        })).count,
        parts: (await tx.part.updateMany({
          where: { isActive: true, colours: { none: { isActive: true } } },
          data: { isActive: false },
        })).count,
        vehicles: (await tx.vehicle.updateMany({
          where: { isActive: true, parts: { none: { isActive: true } } },
          data: { isActive: false },
        })).count,
        oems: (await tx.oem.updateMany({
          where: { isActive: true, vehicles: { none: { isActive: true } } },
          data: { isActive: false },
        })).count,
      };

      // Dealers: the sheet owns identity, address and sales person only.
      const dealerIds = new Map<string, string>();
      for (const d of dealers.dealers) {
        const owned = {
          name: d.name,
          address: d.address,
          city: d.city,
          state: d.state,
          pincode: d.pincode,
          salesPerson: d.salesPerson,
          // Never blank out a GSTIN the sheet happens to lack.
          ...(d.gstin ? { gstin: d.gstin } : {}),
          isActive: true,
          approvalStatus: "APPROVED" as const,
        };
        const row = await tx.dealer.upsert({
          where: { code: d.code },
          update: owned,
          create: { code: d.code, ...owned },
        });
        dealerIds.set(d.code, row.id);
      }

      let subCreated = 0;
      for (const sd of subDealers.subDealers) {
        const dealerId = dealerIds.get(sd.dealerCode)!;
        const existing = await tx.subDealer.findFirst({
          where: { dealerId, name: { equals: sd.name, mode: "insensitive" } },
          select: { id: true },
        });
        if (existing) {
          await tx.subDealer.update({
            where: { id: existing.id },
            data: { salesPerson: sd.salesPerson, isActive: true, approvalStatus: "APPROVED" },
          });
        } else {
          await tx.subDealer.create({
            data: { dealerId, name: sd.name, salesPerson: sd.salesPerson, approvalStatus: "APPROVED" },
          });
          subCreated++;
        }
      }

      await tx.auditLog.create({
        data: {
          entityType: "MasterImport",
          entityId: file.split(/[\\/]/).pop() ?? "workbook",
          action: "IMPORTED",
          toValue: {
            skus: skus.length,
            dealers: dealers.dealers.length,
            subDealers: subDealers.subDealers.length,
            deactivated,
            issues: issues.length,
          },
        },
      });

      return { ...s, deactivated, subCreated };
    },
    { timeout: 300_000, maxWait: 10_000 },
  );

  console.log(`\nWritten in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(`  Prices: ${stats.pricesCreated} new, ${stats.pricesRevised} revised, ${stats.pricesUnchanged} unchanged`);
  console.log(`  Deactivated: ${stats.deactivated.skus} SKUs, ${stats.deactivated.parts} styles, ${stats.deactivated.vehicles} vehicles, ${stats.deactivated.oems} OEMs`);
  console.log(`  Sub-dealers created: ${stats.subCreated}`);
}

/** Rows below the header as plain values, after checking the columns are where we expect. */
function readSheet(wb: ExcelJS.Workbook, name: RegExp, expected: string[]) {
  const ws = wb.worksheets.find((w) => name.test(w.name.trim()));
  if (!ws) throw new Error(`No sheet matching ${name} in the workbook.`);

  const header = expected.map((_, i) => text(cellValue(ws.getRow(1).getCell(i + 1).value)));
  const mismatch = expected.findIndex((h, i) => header[i] !== h);
  if (mismatch >= 0) {
    throw new Error(
      `Sheet "${ws.name}" column ${mismatch + 1} is "${header[mismatch]}", expected "${expected[mismatch]}". ` +
        "The column layout changed — update src/lib/master-import.ts before importing.",
    );
  }

  const rows: Row[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    rows.push(expected.map((_, c) => cellValue(row.getCell(c + 1).value)));
  }
  return { name: ws.name, rows };
}

/** Flattens ExcelJS's rich text, formula and hyperlink cells to a plain value. */
function cellValue(v: ExcelJS.CellValue): Cell {
  if (v === null || v === undefined) return null;
  if (v instanceof Date || typeof v !== "object") return v as Cell;
  if ("richText" in v) return v.richText.map((t) => t.text).join("");
  if ("result" in v) return cellValue(v.result as ExcelJS.CellValue);
  if ("text" in v) return String(v.text);
  return null;
}

function printIssues(issues: Issue[]) {
  if (!issues.length) {
    console.log("\nNo issues.");
    return;
  }
  const counts = (k: Issue["kind"]) => issues.filter((i) => i.kind === k).length;
  console.log(`\nIssues: ${counts("skipped")} skipped, ${counts("corrected")} corrected, ${counts("warning")} warnings`);
  for (const kind of ["skipped", "warning", "corrected"] as const) {
    const list = issues.filter((i) => i.kind === kind);
    if (!list.length) continue;
    console.log(`\n  ${kind.toUpperCase()}`);
    for (const i of list) console.log(`    ${i.sheet} row ${i.row}: ${i.message}`);
  }
}

function toCsv(issues: Issue[]): string {
  const q = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
  return ["Sheet,Row,Kind,Message", ...issues.map((i) => [i.sheet, i.row, i.kind, i.message].map(q).join(","))].join("\n") + "\n";
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
