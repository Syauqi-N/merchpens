import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
// Seed runs under tsx (plain Node), so tsconfig path aliases are not available:
// import the generated client via a relative path.
import { PrismaClient } from "../src/generated/prisma/client";
import {
  DEMO_ADMIN_PASSWORD,
  resolveAdminCredentials,
  SeedConfigError,
  upsertPengurus,
  warnAboutDemoCredentials,
} from "./admin";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

const IS_PRODUCTION = process.env.NODE_ENV === "production";

type VariantSeed = {
  name: string;
  size?: string;
  design?: string;
  sku: string;
  priceDelta?: number;
  quota: number;
  image?: string;
};

type ProductSeed = {
  name: string;
  slug: string;
  description: string;
  price: number;
  unit: string;
  category: string;
  image: string;
  featured?: boolean;
  poPrice?: number;
  variants: VariantSeed[];
};

const PRODUCTS: ProductSeed[] = [
  {
    name: "PDH (Kemeja)",
    slug: "pdh-kemeja",
    description:
      "Kemeja PDH resmi PENS. Pilih ukuran sesuai tabel size. Bahan drill yang nyaman dipakai harian.",
    price: 150000,
    unit: "pcs",
    category: "PDH",
    image: "/uploads/pdh-kemeja.webp",
    featured: true,
    poPrice: 145000,
    variants: [
      { name: "Size S", size: "S", sku: "PDH-S", quota: 20 },
      { name: "Size M", size: "M", sku: "PDH-M", quota: 30 },
      { name: "Size L", size: "L", sku: "PDH-L", quota: 30 },
      { name: "Size XL", size: "XL", sku: "PDH-XL", quota: 20 },
      { name: "Size XXL", size: "XXL", sku: "PDH-XXL", priceDelta: 15000, quota: 10 },
    ],
  },
  {
    name: "Tumbler",
    slug: "tumbler",
    description:
      "Tumbler minum 500ml dengan desain eksklusif PENS. Tersedia dalam beberapa pilihan desain.",
    price: 85000,
    unit: "pcs",
    category: "Tumbler",
    image: "/uploads/tumbler.webp",
    featured: true,
    variants: [
      { name: "Hitam Logo PENS", design: "Hitam Logo PENS", sku: "TMB-HITAM", quota: 50, image: "/uploads/tumbler-hitam.webp" },
      { name: "Putih Nebula", design: "Putih Nebula", sku: "TMB-NEBULA", quota: 50, image: "/uploads/tumbler-nebula.webp" },
      { name: "Silver Premium", design: "Silver Premium", sku: "TMB-SILVER", priceDelta: 10000, quota: 30, image: "/uploads/tumbler-silver.webp" },
    ],
  },
  {
    name: "Lanyard",
    slug: "lanyard",
    description: "Tali ID card / gantungan kunci dengan desain khas PENS.",
    price: 35000,
    unit: "pcs",
    category: "Lanyard",
    image: "/uploads/lanyard.webp",
    variants: [
      { name: "Biru PENS", design: "Biru PENS", sku: "LYD-BIRU", quota: 60, image: "/uploads/lanyard-biru.webp" },
      { name: "Hitam", design: "Hitam", sku: "LYD-HITAM", quota: 60, image: "/uploads/lanyard-hitam.webp" },
      { name: "Merah", design: "Merah", sku: "LYD-MERAH", quota: 40, image: "/uploads/lanyard-merah.webp" },
    ],
  },
  {
    name: "Keychain",
    slug: "keychain",
    description: "Gantungan kunci akrilik/laser cut edisi PENS.",
    price: 20000,
    unit: "pcs",
    category: "Keychain",
    image: "/uploads/keychain.webp",
    variants: [
      { name: "Logo PENS", design: "Logo PENS", sku: "KEY-LOGO", quota: 80 },
      { name: "Maskot", design: "Maskot", sku: "KEY-MASKOT", quota: 80 },
    ],
  },
  {
    name: "Sticker Pack",
    slug: "sticker-pack",
    description: "Paket stiker vinyl anti air, isi 10 pcs per pack.",
    price: 15000,
    unit: "pack",
    category: "Sticker Pack",
    image: "/uploads/sticker-pack.webp",
    variants: [
      { name: "Pack A", design: "Pack A", sku: "STK-A", quota: 100 },
      { name: "Pack B", design: "Pack B", sku: "STK-B", quota: 100 },
    ],
  },
];

const SETTINGS: Array<[string, string]> = [
  ["store_name", "Merch PENS"],
  ["store_tagline", "Merchandise resmi PENS"],
  ["store_address", "Kampus PENS, Surabaya"],
  [
    "store_about",
    "Pemesanan merchandise PENS lewat pre-order berkuota. Bisa diambil di kampus atau dikirim ke alamat (ongkir manual via WhatsApp admin).",
  ],
  ["hero_heading", "Merchandise PENS, pesan pre-order sekarang"],
  [
    "hero_subheading",
    "Ikut periode pre-order yang sedang dibuka untuk dapat harga terbaik selama kuota masih ada.",
  ],
  ["pickup_location", "Sekretariat, Kampus PENS"],
  ["pickup_schedule", "Senin-Jumat, 10.00-15.00 WIB"],
  ["pickup_note", "Tunjukkan kode pesanan ke panitia saat pengambilan."],
  ["social_whatsapp", "6281234567890"],
  ["angkatan_list", JSON.stringify(["2021", "2022", "2023", "2024", "2025"])],
  [
    "jurusan_list",
    JSON.stringify([
      "Teknik Elektronika",
      "Teknik Telekomunikasi",
      "Teknik Elektro Industri",
      "Informatika",
      "Teknik Mekatronika",
      "Multimedia Broadcasting",
    ]),
  ],
];

async function main() {
  if (IS_PRODUCTION) {
    throw new SeedConfigError(
      "db:seed khusus data demo dan DILARANG di production. Gunakan db:admin.",
    );
  }

  const admin = resolveAdminCredentials();
  console.log("Seeding database (Merch PENS)...");

  // ---- Admin ----
  await upsertPengurus(prisma, admin);

  // ---- Settings ----
  for (const [key, value] of SETTINGS) {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  // ---- Categories ----
  for (const [i, p] of PRODUCTS.entries()) {
    await prisma.category.upsert({
      where: { slug: p.slug },
      update: { name: p.category, sortOrder: i },
      create: {
        name: p.category,
        slug: p.slug,
        description: `Kategori ${p.category}`,
        imageUrl: p.image,
        sortOrder: i,
      },
    });
  }

  // ---- Products + variants ----
  for (const p of PRODUCTS) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        description: p.description,
        price: p.price,
        unit: p.unit,
        isActive: true,
        isFeatured: p.featured ?? false,
      },
      create: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: p.price,
        unit: p.unit,
        isActive: true,
        isFeatured: p.featured ?? false,
        categories: { connect: { slug: p.slug } },
        images: {
          create: [{ url: p.image, alt: p.name, sortOrder: 0, isPrimary: true }],
        },
      },
      select: { id: true },
    });

    // gambar utama: pastikan ada
    await prisma.productImage.upsert({
      where: { id: `seed-img-${p.slug}` },
      update: { url: p.image },
      create: {
        id: `seed-img-${p.slug}`,
        productId: product.id,
        url: p.image,
        alt: p.name,
        sortOrder: 0,
        isPrimary: true,
      },
    });

    for (const [vi, v] of p.variants.entries()) {
      await prisma.productVariant.upsert({
        where: { sku: v.sku },
        update: {
          name: v.name,
          size: v.size ?? null,
          design: v.design ?? null,
          priceDelta: v.priceDelta ?? 0,
          imageUrl: v.image ?? null,
          isActive: true,
          sortOrder: vi,
          productId: product.id,
        },
        create: {
          productId: product.id,
          name: v.name,
          size: v.size ?? null,
          design: v.design ?? null,
          sku: v.sku,
          priceDelta: v.priceDelta ?? 0,
          imageUrl: v.image ?? null,
          isActive: true,
          sortOrder: vi,
        },
      });
    }
  }

  // ---- Periode PO aktif ----
  const period = await prisma.preOrderPeriod.upsert({
    where: { slug: "po-batch-1" },
    update: { status: "ACTIVE", startAt: daysFromNow(-1), endAt: daysFromNow(14) },
    create: {
      name: "PO Batch 1",
      slug: "po-batch-1",
      description: "Periode pre-order merchandise batch pertama.",
      startAt: daysFromNow(-1),
      endAt: daysFromNow(14),
      status: "ACTIVE",
      estimatedPickupAt: daysFromNow(44),
      pickupLocation: "Sekretariat, Kampus PENS",
      pickupSchedule: "Senin-Jumat, 10.00-15.00 WIB",
      pickupNote: "Tunjukkan kode pesanan ke panitia saat pengambilan.",
      shippingNote:
        "Pesanan kirim: setelah pembayaran terkonfirmasi, chat admin via WhatsApp untuk ongkir.",
    },
    select: { id: true },
  });

  // ---- Kuota varian per produk ----
  const variantQuotaIdBySku = new Map<string, string>();
  const preOrderItemIdBySlug = new Map<string, string>();
  for (const p of PRODUCTS) {
    const product = await prisma.product.findUniqueOrThrow({
      where: { slug: p.slug },
      select: { id: true, price: true },
    });
    const item = await prisma.preOrderItem.upsert({
      where: { periodId_productId: { periodId: period.id, productId: product.id } },
      update: { price: p.poPrice ?? null },
      create: {
        periodId: period.id,
        productId: product.id,
        price: p.poPrice ?? null,
      },
      select: { id: true },
    });
    preOrderItemIdBySlug.set(p.slug, item.id);

    for (const v of p.variants) {
      const variant = await prisma.productVariant.findUniqueOrThrow({
        where: { sku: v.sku },
        select: { id: true },
      });
      const quota = await prisma.preOrderVariantQuota.upsert({
        where: {
          preOrderItemId_variantId: { preOrderItemId: item.id, variantId: variant.id },
        },
        update: { quota: v.quota, price: null },
        create: { preOrderItemId: item.id, variantId: variant.id, quota: v.quota },
        select: { id: true },
      });
      variantQuotaIdBySku.set(v.sku, quota.id);
    }
  }

  // ---- Demo customers ----
  const demoUsers = [
    {
      email: "budi.mahasiswa@pens.ac.id",
      name: "Budi Santoso",
      phone: "081211112222",
      role: "CUSTOMER" as const,
    },
    {
      email: "siti.mahasiswa@pens.ac.id",
      name: "Siti Rahmawati",
      phone: "081233344401",
      role: "CUSTOMER" as const,
    },
    {
      email: "agus.alumni@pens.ac.id",
      name: "Agus Wijaya",
      phone: "081233344402",
      role: "CUSTOMER" as const,
    },
  ];
  const passwordHash = await bcrypt.hash("customer123", 10);
  for (const u of demoUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash, isActive: true },
    });
  }

  // ---- Demo orders (konsisten dengan reserved kuota) ----
  const budi = await prisma.user.findUniqueOrThrow({
    where: { email: "budi.mahasiswa@pens.ac.id" },
  });
  const siti = await prisma.user.findUniqueOrThrow({
    where: { email: "siti.mahasiswa@pens.ac.id" },
  });

  // Order 1: PAID, pickup — PDH L x1 (harga PO 145000)
  await prisma.order.upsert({
    where: { orderNumber: "INV-DEMO-PAID1" },
    update: {},
    create: {
      orderNumber: "INV-DEMO-PAID1",
      userId: budi.id,
      customerName: "Budi Santoso",
      customerEmail: budi.email,
      customerPhone: "081211112222",
      customerType: "MAHASISWA",
      customerBatch: "2023",
      customerProgram: "Informatika",
      fulfillmentType: "PICKUP",
      subtotal: 145000,
      total: 145000,
      status: "PAID",
      hasPreOrder: true,
      items: {
        create: [
          {
            product: { connect: { slug: "pdh-kemeja" } },
            preOrderItem: { connect: { id: preOrderItemIdBySlug.get("pdh-kemeja")! } },
            variantQuota: { connect: { id: variantQuotaIdBySku.get("PDH-L")! } },
            variantName: "Size L",
            productName: "PDH (Kemeja)",
            productPrice: 145000,
            quantity: 1,
            subtotal: 145000,
          },
        ],
      },
      payment: {
        create: {
          provider: "DUITKU",
          merchantOrderId: "INV-DEMO-PAID1",
          reference: "DEMO-REF-1",
          amount: 145000,
          status: "PAID",
          paidAt: new Date(),
          expiresAt: daysFromNow(-1),
        },
      },
    },
  });

  // Order 2: PAID, shipped — Tumbler Silver x1 (95000) + Sticker A x2 (30000)
  await prisma.order.upsert({
    where: { orderNumber: "INV-DEMO-PAID2" },
    update: {},
    create: {
      orderNumber: "INV-DEMO-PAID2",
      userId: siti.id,
      customerName: "Siti Rahmawati",
      customerEmail: siti.email,
      customerPhone: "081233344401",
      customerType: "ALUMNI",
      customerBatch: "2021",
      customerProgram: "Teknik Telekomunikasi",
      fulfillmentType: "SHIPPED",
      shippingAddress: "Jl. Mawar No. 10, Surabaya 60111",
      subtotal: 125000,
      total: 125000,
      status: "PAID",
      hasPreOrder: true,
      items: {
        create: [
          {
            product: { connect: { slug: "tumbler" } },
            preOrderItem: { connect: { id: preOrderItemIdBySlug.get("tumbler")! } },
            variantQuota: { connect: { id: variantQuotaIdBySku.get("TMB-SILVER")! } },
            variantName: "Silver Premium",
            productName: "Tumbler",
            productPrice: 95000,
            quantity: 1,
            subtotal: 95000,
          },
          {
            product: { connect: { slug: "sticker-pack" } },
            preOrderItem: {
              connect: { id: preOrderItemIdBySlug.get("sticker-pack")! },
            },
            variantQuota: { connect: { id: variantQuotaIdBySku.get("STK-A")! } },
            variantName: "Pack A",
            productName: "Sticker Pack",
            productPrice: 15000,
            quantity: 2,
            subtotal: 30000,
          },
        ],
      },
      payment: {
        create: {
          provider: "DUITKU",
          merchantOrderId: "INV-DEMO-PAID2",
          reference: "DEMO-REF-2",
          amount: 125000,
          status: "PAID",
          paidAt: new Date(),
          expiresAt: daysFromNow(-1),
        },
      },
    },
  });

  // Sinkronkan reserved kuota dengan demo order di atas
  const reservedBySku = new Map<string, number>([
    ["PDH-L", 1],
    ["TMB-SILVER", 1],
    ["STK-A", 2],
  ]);
  for (const [sku, reserved] of reservedBySku) {
    await prisma.preOrderVariantQuota.update({
      where: { id: variantQuotaIdBySku.get(sku)! },
      data: { reserved },
    });
  }

  const variantCount = await prisma.productVariant.count();
  console.log(
    `Seed OK: 5 produk, ${variantCount} varian, PO aktif "PO Batch 1", 2 demo order PAID.`,
  );
  warnAboutDemoCredentials(admin);
  console.log("");
  console.log(`  Admin    : ${admin.email} / ${DEMO_ADMIN_PASSWORD}`);
  console.log("  Customer : budi.mahasiswa@pens.ac.id / customer123");
  console.log("");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    if (error instanceof SeedConfigError) console.error(error.message);
    else console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
