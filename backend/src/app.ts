import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { errorHandler, HttpError } from './lib/http';
import { openApiDocument } from './lib/openapi';
import { requireAuth } from './middleware/auth';
import { authRouter } from './modules/auth/auth.routes';
import { contentRouters } from './modules/content/entities';
import { committeesRouter } from './modules/committees/committees.routes';
import { mediaRouter } from './modules/media/media.routes';
import { siteRouter } from './modules/site/site.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { publicRouter } from './modules/public/public.routes';
import { listsRouter } from './modules/public/lists.routes';
import { publicFormsRouter, submissionsRouter } from './modules/submissions/submissions.routes';
import { prisma } from './lib/prisma';
import { system } from './lib/system';
import { setupRouter, systemRouter } from './modules/system/system.routes';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.TRUST_PROXY) app.set('trust proxy', config.TRUST_PROXY);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // uploads are embedded by the website
      contentSecurityPolicy: {
        useDefaults: true,
        directives: { 'img-src': ["'self'", 'data:'], 'script-src': ["'self'", "'unsafe-inline'"] }, // swagger-ui
      },
    }),
  );
  app.use(
    cors({
      // Same-origin requests (through nginx) carry no CORS needs; cross-origin requests are only
      // allowed from the public address configured in Administration → System.
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        system()
          .then((s) => cb(null, origin === new URL(s.publicUrl).origin || (!config.isProd && /^http:\/\/localhost:\d+$/.test(origin))))
          .catch(() => cb(null, false));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  // Uploaded files (originals + responsive variants). nginx serves these directly in production.
  app.use(
    '/uploads',
    express.static(config.uploadDir, {
      maxAge: '30d',
      index: false,
      dotfiles: 'deny',
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    }),
  );

  app.get('/api/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Public API (read-only, cached)
  app.use('/api/public', rateLimit({ windowMs: 60_000, limit: config.NODE_ENV === 'test' ? 10_000 : 600, standardHeaders: 'draft-7', legacyHeaders: false }));
  app.use('/api/public/forms', publicFormsRouter);
  app.use('/api/public', listsRouter);
  app.use('/api/public', publicRouter);

  // Administration API
  app.use('/api/admin', rateLimit({ windowMs: 60_000, limit: config.NODE_ENV === 'test' ? 10_000 : 300, standardHeaders: 'draft-7', legacyHeaders: false }));
  app.use('/api/admin/setup', setupRouter);
  app.use('/api/admin/auth', authRouter);
  app.use('/api/admin', requireAuth);
  for (const [path, router] of Object.entries(contentRouters)) app.use(`/api/admin/${path}`, router);
  app.use('/api/admin/committees', committeesRouter);
  app.use('/api/admin/media', mediaRouter);
  app.use('/api/admin/submissions', submissionsRouter);
  app.use('/api/admin/system', systemRouter);
  app.use('/api/admin', siteRouter);
  app.use('/api/admin', adminRouter);

  // API documentation
  const spec = openApiDocument();
  app.get('/api/openapi.json', (_req, res) => res.json(spec));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'SST API documentation' }));

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', 'Endpoint not found')));
  app.use(errorHandler);
  return app;
}
