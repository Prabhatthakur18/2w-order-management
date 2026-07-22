import { PrismaClient, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const DEMO_PASSWORD = "Passw0rd!";

const users: { email: string; name: string; roles: Role[] }[] = [
  { email: "admin@autoformindia.com", name: "Admin User", roles: ["ADMIN"] },
  { email: "asm@autoformindia.com", name: "ASM User", roles: ["ASM"] },
  { email: "plant@autoformindia.com", name: "Plant Ops User", roles: ["PLANT_OPS"] },
  { email: "accounts@autoformindia.com", name: "Accounts User", roles: ["ACCOUNTS"] },
  { email: "dispatch@autoformindia.com", name: "Dispatch User", roles: ["DISPATCH"] },
];

/** Business rules the report left open. Admin edits these at runtime. */
const config: {
  key: string;
  value: string;
  valueType: string;
  category: string;
  label: string;
  description: string;
}[] = [
  {
    key: "cash_discount.eligible_payment_mode",
    value: "CREDIT",
    valueType: "string",
    category: "Discounts",
    label: "Cash discount applies to",
    description:
      "Which payment mode qualifies for cash discount: CREDIT, ADVANCE or BOTH. The flowchart shows CREDIT; the analysis notes convention usually favours ADVANCE. Set per business direction.",
  },
  {
    key: "discount.max_combined_pct",
    value: "25",
    valueType: "number",
    category: "Discounts",
    label: "Maximum combined discount %",
    description: "Cap across dealer discount and scheme together.",
  },
  {
    key: "discount.approval_above_pct",
    value: "15",
    valueType: "number",
    category: "Discounts",
    label: "Approval required above %",
    description: "Combined discount above this needs Admin approval.",
  },
  {
    key: "sla.review_reminder_hours",
    value: "24",
    valueType: "number",
    category: "SLA",
    label: "Order review reminder (hours)",
    description: "Hours before a reminder is sent on a pending approval.",
  },
  {
    key: "sla.review_escalation_hours",
    value: "48",
    valueType: "number",
    category: "SLA",
    label: "Order review escalation (hours)",
    description: "Hours before an unanswered approval escalates.",
  },
  {
    key: "payment.block_production_until_receipt_verified",
    value: "true",
    valueType: "boolean",
    category: "Payments",
    label: "Advance: block production until receipt verified",
    description:
      "For advance payment orders, hold production until payment proof is verified.",
  },
  {
    key: "gst.compute_in_app",
    value: "true",
    valueType: "boolean",
    category: "Tax",
    label: "Compute GST in-app",
    description:
      "GST calculated from per-item slabs. The ERP remains system of record for filing.",
  },
  {
    key: "notify.dispatch_confirmation",
    value: "true",
    valueType: "boolean",
    category: "Notifications",
    label: "Notify dealer on dispatch",
    description:
      "Closes the communication loop the analysis flagged as missing.",
  },
  {
    key: "dealer.portal_enabled",
    value: "false",
    valueType: "boolean",
    category: "Access",
    label: "Dealer portal enabled",
    description:
      "Dealer logins stay off until the business confirms in-app approval.",
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const u of users) {
    const user = await db.user.upsert({
      where: { email: u.email },
      update: { name: u.name, isActive: true },
      create: {
        email: u.email,
        name: u.name,
        passwordHash,
        isActive: true,
      },
    });

    for (const role of u.roles) {
      await db.userRole.upsert({
        where: { userId_role: { userId: user.id, role } },
        update: {},
        create: { userId: user.id, role },
      });
    }
    console.log(`  user: ${u.email} [${u.roles.join(", ")}]`);
  }

  for (const c of config) {
    await db.systemConfig.upsert({
      where: { key: c.key },
      update: { label: c.label, description: c.description, category: c.category },
      create: c,
    });
  }
  console.log(`  config: ${config.length} settings`);

  // Financial year 2026-27 document numbering
  for (const docType of ["PI", "INVOICE", "ORDER"]) {
    await db.documentSequence.upsert({
      where: { docType_financialYear: { docType, financialYear: "2026-27" } },
      update: {},
      create: {
        docType,
        financialYear: "2026-27",
        prefix: `${docType}/2026-27/`,
        lastNumber: 0,
      },
    });
  }
  console.log("  sequences: PI, INVOICE, ORDER for FY 2026-27");
}

main()
  .then(async () => {
    console.log("\nSeed complete. Demo password:", DEMO_PASSWORD);
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
