/**
 * Master-data import rules. Run with: npm run test:import
 *
 * Every case here is a value that actually occurs in the business's master
 * workbook — the point is that each quirk is handled on purpose.
 */
import {
  code,
  gstRate,
  money,
  packing,
  parseDealers,
  parseProducts,
  parseSubDealers,
  pincode,
  salesPerson,
  seat,
  stateFromGstin,
  stateFromText,
  text,
} from "../master-import";

let pass = 0;
let fail = 0;

function eq(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
    console.log(`  OK   ${label} = ${a}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}: got ${a}, want ${e}`);
  }
}

console.log("cell normalisers");
eq("text trims + collapses + uppercases", text("  kinertic   e luna "), "KINERTIC E LUNA");
eq("text blank is null", text("   "), null);
eq("code strips inner spaces", code("AFSMAT50 -BL"), "AFSMAT50-BL");
eq("seat SINGLE", seat("SINGLE"), "SINGLE");
eq("seat DOUBLE means DUAL", seat("Double"), "DUAL");
eq("seat N/A is null", seat("N/A"), null);
eq("seat blank is null", seat(null), null);
eq("seat junk is INVALID", seat("SOFA"), "INVALID");
eq("packing PCS -> PC", packing("PCS"), "PC");
eq("packing SET", packing("set"), "SET");
eq("packing junk", packing("BOX"), null);
eq("money integer", money(565), "565.00");
eq("money with rupee and commas", money("₹1,250.5"), "1250.50");
eq("money zero rejected", money(0), null);
eq("money text rejected", money("TBD"), null);
eq("gst Excel fraction", gstRate(0.18), "18");
eq("gst 5% fraction", gstRate(0.05), "5");
eq("gst percent text", gstRate("18%"), "18");
eq("gst whole number", gstRate(28), "28");
eq("gst zero-rated", gstRate(0), "0");
eq("gst not a slab", gstRate(0.17), "INVALID");
eq("gst blank", gstRate(null), null);
eq("pincode ok", pincode(695001), { value: "695001", valid: true });
eq("pincode lost a digit", pincode(60006), { value: "60006", valid: false });
eq("sales person Mr. prefix", salesPerson("Mr. Kundan"), "KUNDAN");
eq("sales person already bare", salesPerson("KUNDAN"), "KUNDAN");
eq("sales person territory code", salesPerson("ASM_WEST"), "ASM_WEST");

console.log("states");
eq("TAMILNADU", stateFromText("TAMILNADU"), "Tamil Nadu");
eq("TAMIL NADU", stateFromText("TAMIL NADU"), "Tamil Nadu");
eq("MAHARASTHRA typo", stateFromText("MAHARASTHRA"), "Maharashtra");
eq("UTTAR PARDESH typo", stateFromText("UTTAR PARDESH"), "Uttar Pradesh");
eq("unknown", stateFromText("NARNIA"), null);
eq("GSTIN 32 is Kerala", stateFromGstin("32AAQFA7506H1ZI"), "Kerala");
eq("GSTIN 09 is UP", stateFromGstin("09ABCDE1234F1Z5"), "Uttar Pradesh");

console.log("products");
{
  // OEM, PART NO., CODE, ITEMS, VEHICLE TYPE, COLOUR, SEAT, PCS/SET, MRP, GST
  const rows = [
    ["ATHER", "U-ACTIVE", "AFATS350-BU", "ATHER", "SCOOTER", "BLUE", "SINGLE", "PCS", 820, 0.18],
    ["ATHER", "U-ACTIVE", "AFATS350-RD", "ATHER", "SCOOTER", "RED", "SINGLE", "PCS", 820, 0.18],
    ["HERO", "U-ACTIVE", "AFHHS355A-BU", "VIDA VX2 PLUS", "SCOOTER", null, "SINGLE", "PCS", 820, 0.18],
    ["OTHER", "QUILTED SPIKE", "AFSMAT50 -BL", "ATHER", "ACCESSORIES", null, null, "PCS", 730, 0.18],
    ["OTHER", "BAG", "AFCB01", "CARRY BAG", "ACCESSORIES", null, null, "PCS", 265, 0.18],
    ["ATHER", "U-ACTIVE", "AFATS350-BU", "ATHER", "SCOOTER", "BLUE", "SINGLE", "PCS", 820, 0.18],
    ["ATHER", "U-ACTIVE", "AFATS350-WX", "ATHER", "SCOOTER", "WHITE", "DUAL", "PCS", 820, 0.18],
    ["ATHER", "U-SPORTZ", "AFATS250", "ATHER", "SCOOTER", null, "SINGLE", "PCS", null, 0.18],
    [null, null, null, null, null, null, null, null, null, null],
  ];
  const { skus, issues } = parseProducts(rows);
  const byCode = Object.fromEntries(skus.map((s) => [s.code, s]));

  eq("kept", skus.map((s) => s.code), ["AFATS350-BU", "AFATS350-RD", "AFHHS355A-BU", "AFSMAT50-BL", "AFCB01"]);
  eq("colour from -BU suffix", byCode["AFHHS355A-BU"].colour, "BLUE");
  eq("stray space removed and -BL left blank (no BL evidence)", byCode["AFSMAT50-BL"].colour, null);
  eq("no suffix, no colour", byCode["AFCB01"].colour, null);
  eq("PCS -> PC", byCode["AFCB01"].packingUnit, "PC");
  eq("accessory has no seat", byCode["AFCB01"].seatType, null);
  eq("mrp as money string", byCode["AFATS350-BU"].mrp, "820.00");
  eq("gst as percent", byCode["AFATS350-BU"].gstRatePct, "18");
  eq("duplicate code skipped", issues.some((i) => i.row === 7 && i.kind === "skipped" && i.message.includes("Duplicate CODE")), true);
  eq("seat conflict within a style skipped", issues.some((i) => i.row === 8 && i.message.includes("disagrees")), true);
  eq("missing MRP skipped", issues.some((i) => i.row === 9 && i.message.includes("MRP")), true);
  eq("blank row ignored silently", issues.some((i) => i.row === 10), false);

  const clash = parseProducts([
    ["HERO", "U-ACTIVE", "AFX1-BU", "SPLENDOR", "BIKE", "BLUE", "SINGLE", "PCS", 500, 0.18],
    ["HERO", "U-ACTIVE", "AFX2-BU", "SPLENDOR", "BIKE", "BLUE", "SINGLE", "PCS", 500, 0.18],
    ["HERO", "U-IMPRESS", "AFY1", "SPLENDOR", "BIKE", null, "SINGLE", "PCS", 400, 0.18],
    ["HERO", "U-IMPRESS", "AFY2", "SPLENDOR", "BIKE", null, "SINGLE", "PCS", 400, 0.18],
  ]);
  eq("same named colour twice: second skipped", clash.skus.map((s) => s.code), ["AFX1-BU", "AFY1", "AFY2"]);
  const gst = parseProducts([
    ["OTHER", "ROPES", "AFEFR01", "ECO FLAT ROPE", "ACCESSORIES", null, null, "PCS", 120, null],
    ["OTHER", "ROPES", "AFEFR02", "ECO FLAT ROPE", "ACCESSORIES", null, null, "PCS", 120, 0.17],
    ["OTHER", "NET", "AFBN01", "BIKE NET", "ACCESSORIES", "BLACK", null, "PCS", 150, 0.05],
    ["OTHER", "NET", "AFBN02", "BIKE NET", "ACCESSORIES", "RED", null, "PCS", 150, 0.18],
  ]);
  eq("missing GST skipped", gst.issues.some((i) => i.row === 2 && i.message === "GST is missing."), true);
  eq("non-slab GST skipped", gst.issues.some((i) => i.row === 3 && i.message.includes("not a valid slab")), true);
  eq("GST must agree within a style", [gst.skus.map((s) => s.code), gst.issues.some((i) => i.row === 5 && i.message.includes("GST disagrees"))], [["AFBN01"], true]);
  eq("same colourless choice twice: warned, both kept", clash.issues.some((i) => i.kind === "warning" && i.message.includes("AFY2")), true);
  eq("spaces in code reported", issues.some((i) => i.kind === "corrected" && i.message.includes("stray spaces")), true);
}

console.log("dealers");
{
  // S.NO, SALES PERSON, GST NO., DEALER CODE, PARTY'S NAME, LOCATION, ADDRESS, PIN CODE, STATE
  const rows = [
    [1, "ASM_SOUTH", "32AAQFA7506H1ZI", "AF-KRAO001", "A-ONE AUTO DISTRIBUTORS", "THIRUVANANTHAPURAM", "T C 26/1283-6\nCHEMPAKA NAGAR,", 695001, "KERALA"],
    [2, "ASM_SOUTH", "33BPEPA5216C1ZQ", "AF-TNFI006", "FORTUNE INTERNATIONAL", "CHENNAI", "193 Anna Salai, Chennai, Tamil Nadu,-600006\n", 60006, "TAMILNADU"],
    [7, "ASM_SOUTH", null, "AF-TNXX007", "NO PIN IN ADDRESS", "CHENNAI", "12 Mount Road", 60012, "TAMIL NADU"],
    [3, "KUNDAN", null, "AF-MHXX001", "NO GST MOTORS", "PUNE", "1 MG Road", 411001, "MAHARASTHRA"],
    [4, "RAHUL", "09ABCDE1234F1Z5", "AF-MPSA001", "FIRST", "BHOPAL", "x", 462001, "MADHYA PRADESH"],
    [5, "RAHUL", null, "AF-MPSA001", "SECOND", "BHOPAL", "y", 462001, "MADHYA PRADESH"],
    [6, "RAHUL", null, null, "NO CODE CO", "BHOPAL", "z", 462001, "MADHYA PRADESH"],
  ];
  const { dealers, issues } = parseDealers(rows);
  const byCode = Object.fromEntries(dealers.map((d) => [d.code, d]));

  eq("kept", dealers.map((d) => d.code), ["AF-KRAO001", "AF-TNFI006", "AF-TNXX007", "AF-MHXX001", "AF-MPSA001"]);
  eq("newlines flattened, trailing comma dropped", byCode["AF-KRAO001"].address, "T C 26/1283-6, CHEMPAKA NAGAR");
  eq("state from GSTIN", byCode["AF-KRAO001"].state, "Kerala");
  eq("typo normalised without GSTIN", byCode["AF-MHXX001"].state, "Maharashtra");
  eq("GSTIN beats sheet state", byCode["AF-MPSA001"].state, "Uttar Pradesh");
  eq("GSTIN/sheet mismatch reported", issues.some((i) => i.row === 6 && i.message.includes("registered in Uttar Pradesh")), true);
  eq("mangled pin recovered from address", [byCode["AF-TNFI006"].pincode, issues.some((i) => i.row === 3 && i.kind === "corrected" && i.message.includes("600006"))], ["600006", true]);
  eq("mangled pin with no address pin kept but warned", [byCode["AF-TNXX007"].pincode, issues.some((i) => i.row === 4 && i.kind === "warning")], ["60012", true]);
  eq("duplicate code skipped", issues.some((i) => i.row === 7 && i.message.includes("Duplicate DEALER CODE")), true);
  eq("missing code skipped", issues.some((i) => i.row === 8 && i.message.includes("no DEALER CODE")), true);

  console.log("sub-dealers");
  // SALES PERSON, PARTY'S NAME, SUB DEALER'S NAME, COUNT
  const subRows = [
    ["Mr. Rishu", "A-One Auto Distributors", "A A AUTOMOBILE", 39],
    ["Mr. Rishu", "A-ONE AUTO DISTRIBUTORS", "A A AUTOMOBILE", 39],
    ["Mr. Kundan", "SUNIL AUTO SPARE", "ORPHAN MOTORS", 3],
  ];
  const sub = parseSubDealers(subRows, dealers);
  eq("parent matched by name ignoring case/punctuation", sub.subDealers.map((s) => [s.dealerCode, s.name, s.salesPerson]), [["AF-KRAO001", "A A AUTOMOBILE", "RISHU"]]);
  eq("duplicate under same parent skipped", sub.issues.some((i) => i.row === 3 && i.message.includes("listed twice")), true);
  eq("orphan parent skipped", sub.issues.some((i) => i.row === 4 && i.message.includes("matches no dealer")), true);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
