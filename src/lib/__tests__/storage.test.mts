/**
 * Storage service assertions. Run with: npm run test:storage
 *
 * Covers the security-relevant behaviour: magic-number validation, declared
 * type matching, and path-traversal defence.
 */
import Module from "node:module";

// storage.ts imports "server-only", which throws outside the Next runtime.
const originalRequire = Module.prototype.require;
// @ts-expect-error deliberate test shim
Module.prototype.require = function (id: string) {
  if (id === "server-only") return {};
  // eslint-disable-next-line prefer-rest-params
  return originalRequire.apply(this, arguments as never);
};

process.env.UPLOAD_ROOT = "./.uploads-test";

const { storeFile, readStoredFile, deleteStoredFile } = await import(
  "../storage.ts"
);

let pass = 0;
let fail = 0;

function ok(label: string, condition: boolean) {
  if (condition) {
    pass++;
    console.log(`  OK   ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}`);
  }
}

async function expectReject(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    ok(label, false);
  } catch {
    ok(label, true);
  }
}

const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c636000000200010005fe02fa0000000049454e44ae426082",
  "hex",
);
const JPEG = Buffer.concat([
  Buffer.from("ffd8ffe000104a464946000101", "hex"),
  Buffer.alloc(64),
  Buffer.from("ffd9", "hex"),
]);
const EXE = Buffer.from("4d5a90000300000004000000ffff0000", "hex");
const PDF = Buffer.concat([Buffer.from("%PDF-1.4\n", "ascii"), Buffer.alloc(64)]);

const IMAGES = ["image/png", "image/jpeg"];

console.log("accepts genuine images");
const png = await storeFile(
  new File([new Uint8Array(PNG)], "a.png", { type: "image/png" }),
  "printing-frames",
  IMAGES,
);
ok("relative path only", !png.path.startsWith("/") && !png.path.includes(".."));
ok(
  "dated folder layout",
  /^printing-frames\/\d{4}\/\d{2}\/[0-9a-f-]+\.png$/.test(png.path),
);
ok("sha256 checksum", png.checksum.length === 64);
ok(
  "byte-identical round trip",
  Buffer.compare(await readStoredFile(png.path), PNG) === 0,
);

const jpeg = await storeFile(
  new File([new Uint8Array(JPEG)], "b.jpg", { type: "image/jpeg" }),
  "printing-frames",
  IMAGES,
);
ok("jpeg stored", /\.jpg$/.test(jpeg.path));

console.log("rejects bad content");
await expectReject("executable disguised as png", () =>
  storeFile(
    new File([new Uint8Array(EXE)], "evil.png", { type: "image/png" }),
    "pf",
    IMAGES,
  ),
);
await expectReject("pdf when only images allowed", () =>
  storeFile(
    new File([new Uint8Array(PDF)], "d.pdf", { type: "application/pdf" }),
    "pf",
    IMAGES,
  ),
);
await expectReject("png bytes declared as jpeg", () =>
  storeFile(
    new File([new Uint8Array(PNG)], "m.jpg", { type: "image/jpeg" }),
    "pf",
    IMAGES,
  ),
);
await expectReject("empty file", () =>
  storeFile(new File([], "e.png", { type: "image/png" }), "pf", IMAGES),
);
await expectReject("unrecognised bytes", () =>
  storeFile(
    new File([new Uint8Array(Buffer.alloc(200, 7))], "r.png", {
      type: "image/png",
    }),
    "pf",
    IMAGES,
  ),
);

console.log("pdf allowed when permitted");
const pdf = await storeFile(
  new File([new Uint8Array(PDF)], "d.pdf", { type: "application/pdf" }),
  "invoices",
  ["application/pdf"],
);
ok("pdf stored", /\.pdf$/.test(pdf.path));

console.log("path traversal blocked");
for (const p of ["../../../etc/passwd", "../../.env", "..\\..\\secret"]) {
  await expectReject(p, () => readStoredFile(p));
}

for (const f of [png, jpeg, pdf]) await deleteStoredFile(f.path);
await expectReject("gone after delete", () => readStoredFile(png.path));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
