import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import {
  resolveAdminCredentials,
  SeedConfigError,
  upsertPengurus,
  warnAboutDemoCredentials,
} from "./admin";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const credentials = resolveAdminCredentials();
  const admin = await upsertPengurus(prisma, credentials);

  console.log(`Akun pengurus siap: ${admin.email}`);
  warnAboutDemoCredentials(credentials);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    if (error instanceof SeedConfigError) console.error(error.message);
    else console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
