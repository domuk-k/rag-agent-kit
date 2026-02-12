import { getDb, closeDb, pingDb } from '@repo/db';

async function main() {
  console.log(`[Setup] Checking MongoDB connection...`);

  await getDb();
  const ok = await pingDb();

  if (!ok) {
    console.error('[Setup] MongoDB connection failed!');
    process.exit(1);
  }

  console.log(`[Setup] MongoDB connected successfully`);
  console.log(`[Setup] Done! Ready for Atlas Search.`);

  await closeDb();
}

main().catch(console.error);
