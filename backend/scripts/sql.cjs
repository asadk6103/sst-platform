const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const sql = process.argv.slice(2).join(' ');
  const r = await p.$queryRawUnsafe(sql);
  console.log(JSON.stringify(r, (k, v) => (typeof v === "bigint" ? Number(v) : v)));
  await p.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
