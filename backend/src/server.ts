import { config } from './config';
import { createApp } from './app';
import { prisma } from './lib/prisma';
import { runScheduledPublishing } from './modules/content/content-factory';
import { announceSetup } from './modules/system/system.routes';
import { secret } from './lib/secrets';

// Generate security secrets on first start (no .env required).
secret('jwtAccess');
const app = createApp();
const server = app.listen(config.PORT, () => {
  console.info(`SST API listening on http://localhost:${config.PORT}  (docs: /api/docs)`);
  announceSetup().catch((e) => console.error('[setup]', e));
});

// Scheduled publishing check every 30 seconds.
const timer = setInterval(() => runScheduledPublishing().catch((e) => console.error('[scheduler]', e)), 30_000);

const shutdown = async () => {
  clearInterval(timer);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
