/**
 * Minimal demo catalog for exercising the ASM order flow before the real
 * data sheets are imported. Run with: npm run db:seed:demo
 *
 * Safe to re-run — everything upserts on a natural key.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const tier = await db.dealerPriceTier.upsert({
    where: { name: "Standard" },
    update: {},
    create: { name: "Standard", description: "Default dealer pricing" },
  });

  const gst18 = await db.gstSlab.upsert({
    where: { name: "GST 18%" },
    update: {},
    create: {
      name: "GST 18%",
      ratePct: "18",
      hsnCode: "8714",
      validFrom: new Date("2025-04-01"),
    },
  });

  const gst28 = await db.gstSlab.upsert({
    where: { name: "GST 28%" },
    update: {},
    create: {
      name: "GST 28%",
      ratePct: "28",
      hsnCode: "8711",
      validFrom: new Date("2025-04-01"),
    },
  });

  const dealers = [
    {
      code: "DLR001",
      name: "Sharma Auto Parts",
      address: "12 Nehru Market",
      city: "Kanpur",
      state: "Uttar Pradesh",
      pincode: "208001",
      contactNo: "9876543210",
      creditDays: 30,
      creditLimit: "500000",
    },
    {
      code: "DLR002",
      name: "Verma Motors",
      address: "45 GT Road",
      city: "Ludhiana",
      state: "Punjab",
      pincode: "141001",
      contactNo: "9876500011",
      creditDays: 45,
      creditLimit: "750000",
    },
  ];

  for (const d of dealers) {
    const dealer = await db.dealer.upsert({
      where: { code: d.code },
      update: {},
      create: { ...d, priceTierId: tier.id },
    });

    await db.subDealer.upsert({
      where: { id: `${dealer.id}-sd1` },
      update: {},
      create: {
        id: `${dealer.id}-sd1`,
        dealerId: dealer.id,
        name: `${d.name} — Branch 2`,
        address: `Branch outlet, ${d.city}`,
        city: d.city,
        state: d.state,
        pincode: d.pincode,
        contactNo: d.contactNo,
        isVerified: true,
      },
    });
  }

  // Catalog: OEM -> Vehicle -> Part -> Colour
  const catalog = [
    {
      oem: { code: "HERO", name: "Hero MotoCorp" },
      vehicles: [
        {
          code: "SPL125",
          name: "Splendor Plus",
          parts: [
            { partNo: "SP-BC-001", name: "Body Cover Set", unit: "SET" as const, gst: gst18.id, colours: ["Black", "Grey"], price: "1250.00" },
            { partNo: "SP-SC-002", name: "Seat Cover", unit: "PC" as const, gst: gst18.id, colours: ["Black", "Brown"], price: "480.00" },
          ],
        },
        {
          code: "HFD",
          name: "HF Deluxe",
          parts: [
            { partNo: "HF-BC-001", name: "Body Cover Set", unit: "SET" as const, gst: gst18.id, colours: ["Black"], price: "1180.00" },
          ],
        },
      ],
    },
    {
      oem: { code: "HONDA", name: "Honda Motorcycle" },
      vehicles: [
        {
          code: "ACT6G",
          name: "Activa 6G",
          parts: [
            { partNo: "AC-BC-001", name: "Body Cover Set", unit: "SET" as const, gst: gst28.id, colours: ["Black", "Silver", "Blue"], price: "1450.00" },
            { partNo: "AC-FM-003", name: "Floor Mat", unit: "PC" as const, gst: gst18.id, colours: ["Black"], price: "320.00" },
          ],
        },
      ],
    },
  ];

  for (const entry of catalog) {
    const oem = await db.oem.upsert({
      where: { code: entry.oem.code },
      update: {},
      create: entry.oem,
    });

    for (const v of entry.vehicles) {
      const vehicle = await db.vehicle.upsert({
        where: { oemId_code: { oemId: oem.id, code: v.code } },
        update: {},
        create: { oemId: oem.id, code: v.code, name: v.name },
      });

      for (const p of v.parts) {
        const part = await db.part.upsert({
          where: { vehicleId_partNo: { vehicleId: vehicle.id, partNo: p.partNo } },
          update: {},
          create: {
            vehicleId: vehicle.id,
            partNo: p.partNo,
            name: p.name,
            packingUnit: p.unit,
            gstSlabId: p.gst,
            hsnCode: "8714",
          },
        });

        for (const colour of p.colours) {
          const productCode = `${entry.oem.code}-${v.code}-${p.partNo}-${colour.slice(0, 3).toUpperCase()}`;
          const pc = await db.partColour.upsert({
            where: { partId_colour: { partId: part.id, colour } },
            update: {},
            create: { partId: part.id, colour, productCode },
          });

          const existing = await db.priceList.findFirst({
            where: { partColourId: pc.id, priceTierId: null },
          });
          if (!existing) {
            await db.priceList.create({
              data: {
                partColourId: pc.id,
                unitPrice: p.price,
                validFrom: new Date("2025-04-01"),
              },
            });
          }
        }
      }
    }
  }

  const schemes = [
    { code: "MONSOON25", name: "Monsoon Offer", discountPct: "5", flatAmount: null },
    { code: "BULK500", name: "Bulk Order Rebate", discountPct: null, flatAmount: "500" },
  ];
  for (const s of schemes) {
    await db.scheme.upsert({
      where: { code: s.code },
      update: {},
      create: { ...s, validFrom: new Date("2025-04-01") },
    });
  }

  const rule = await db.discountRule.findFirst({ where: { name: "Default" } });
  if (!rule) {
    await db.discountRule.create({
      data: {
        name: "Default",
        maxDealerPct: "20",
        maxSchemePct: "10",
        maxCombinedPct: "25",
        allowStacking: true,
        approvalAbovePct: "15",
      },
    });
  }

  for (const t of [
    { code: "TRP001", name: "Gati Logistics", contactNo: "1800123456" },
    { code: "TRP002", name: "VRL Roadlines", contactNo: "1800987654" },
  ]) {
    await db.transporter.upsert({
      where: { code: t.code },
      update: {},
      create: t,
    });
  }

  const counts = {
    dealers: await db.dealer.count(),
    oems: await db.oem.count(),
    vehicles: await db.vehicle.count(),
    parts: await db.part.count(),
    skus: await db.partColour.count(),
    prices: await db.priceList.count(),
    schemes: await db.scheme.count(),
  };
  console.log("Demo catalog seeded:", counts);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
