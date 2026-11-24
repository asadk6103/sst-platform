// Checks every page's content against its template schema (what the admin form enforces).
import { PrismaClient } from '@prisma/client';
import { templateSchema, TEMPLATE_MAP } from '@sst/shared';
const prisma = new PrismaClient();
const pages = await prisma.page.findMany({ orderBy: { slug: 'asc' } });
let bad = 0;
for (const p of pages) {
  if (!TEMPLATE_MAP[p.template]) { console.log(`✗ ${p.slug}: unknown template ${p.template}`); bad++; continue; }
  const r = templateSchema(p.template).safeParse(p.content);
  if (!r.success) { bad++; console.log(`✗ ${p.slug} (${p.template}):`, r.error.issues.slice(0, 4).map((i) => `${i.path.join('.')}: ${i.message}`).join(' | ')); }
}
console.log(`${pages.length} pages checked, ${bad} invalid`);
await prisma.$disconnect();
