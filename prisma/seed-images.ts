/**
 * Generate placeholder product/category/banner images locally using sharp.
 * Run before seed: npx tsx prisma/seed-images.ts
 *
 * Idempotent — skips files that already exist.
 * Creates colored placeholder images with product name labels.
 */
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const UPLOADS_DIR = resolve(process.cwd(), "public", "uploads");

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Palet placeholder selaras design.md: obsidian + emas + krem.
const MERCH_BG = "#161616";
const MERCH_GOLD = "#D4A359";
const MERCH_GOLD_LIGHT = "#E5B869";
const MERCH_MUTED = "#A1A1A1";

function getColorForSeed() {
  return { bg: MERCH_BG, text: MERCH_GOLD };
}

async function generatePlaceholder(
  filename: string,
  width: number,
  height: number,
  label: string,
): Promise<boolean> {
  const destPath = resolve(UPLOADS_DIR, filename);
  if (existsSync(destPath)) return false;

  const color = getColorForSeed();
  const fontSize = Math.min(width, height) / 12;
  const shortLabel = label.length > 30 ? label.substring(0, 27) + "..." : label;
  const subSize = Math.max(12, fontSize * 0.32);

  // Placeholder bertema merch: latar obsidian, motif lingkaran emas tipis,
  // label emas, bingkai garis emas halus.
  const svgText = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${color.bg}"/>
      <g fill="none" stroke="${MERCH_GOLD}" stroke-opacity="0.18" stroke-width="1.5">
        <circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) * 0.32}"/>
        <circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) * 0.22}"/>
        <circle cx="0" cy="0" r="${Math.min(width, height) * 0.28}"/>
        <circle cx="${width}" cy="0" r="${Math.min(width, height) * 0.28}"/>
        <circle cx="0" cy="${height}" r="${Math.min(width, height) * 0.28}"/>
        <circle cx="${width}" cy="${height}" r="${Math.min(width, height) * 0.28}"/>
      </g>
      <rect x="8" y="8" width="${width - 16}" height="${height - 16}" fill="none"
            stroke="${MERCH_GOLD}" stroke-opacity="0.45" stroke-width="2" rx="14"/>
      <text x="50%" y="47%" font-family="Arial, sans-serif" font-size="${fontSize}"
            fill="${MERCH_GOLD_LIGHT}" text-anchor="middle" dominant-baseline="middle"
            font-weight="bold">
        ${escapeXml(shortLabel)}
      </text>
      <text x="50%" y="60%" font-family="Arial, sans-serif" font-size="${subSize}"
            fill="${MERCH_MUTED}" text-anchor="middle" dominant-baseline="middle"
            letter-spacing="2">
        MERCH PENS
      </text>
    </svg>
  `;

  await sharp(Buffer.from(svgText))
    .resize(width, height)
    .webp({ quality: 82 })
    .toFile(destPath);

  return true;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function main() {
  mkdirSync(UPLOADS_DIR, { recursive: true });

  let downloaded = 0;
  let skipped = 0;

  const allImages: Array<{ name: string; width: number; height: number; label: string }> = [];

  // Category images
  for (const name of ["PDH", "Tumbler", "Lanyard", "Keychain", "Sticker Pack"]) {
    allImages.push({
      name: `kategori-${name}`,
      width: 800,
      height: 600,
      label: `Kategori ${name}`,
    });
  }

  // Banner images
  allImages.push({
    name: "banner-po-batch-1",
    width: 1600,
    height: 600,
    label: "PO Batch 1 Merch PENS",
  });
  allImages.push({
    name: "banner-merch-pens",
    width: 1600,
    height: 600,
    label: "Merchandise Resmi PENS",
  });

  // Merch products (+ variant images) — mirror prisma/seed.ts
  const MERCH_PRODUCTS = [
    "pdh-kemeja",
    "tumbler",
    "tumbler-hitam",
    "tumbler-nebula",
    "tumbler-silver",
    "lanyard",
    "lanyard-biru",
    "lanyard-hitam",
    "lanyard-merah",
    "keychain",
    "sticker-pack",
  ];

  for (const name of MERCH_PRODUCTS) {
    allImages.push({ name, width: 800, height: 800, label: name });
  }

  console.log(`Generating ${allImages.length} placeholder images...`);

  for (const img of allImages) {
    const filename = `${slugify(img.name)}.webp`;
    const wasNew = await generatePlaceholder(filename, img.width, img.height, img.label);
    if (wasNew) {
      downloaded++;
      if (downloaded % 20 === 0) console.log(`  Generated ${downloaded}...`);
    } else {
      skipped++;
    }
  }

  console.log(`Done: ${downloaded} generated, ${skipped} already existed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
