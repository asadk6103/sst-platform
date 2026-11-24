import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';

/** Error with an HTTP status; rendered by the error middleware as a consistent JSON body. */
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, 'BAD_REQUEST', msg, details);
export const unauthorized = (msg = 'Authentication required') => new HttpError(401, 'UNAUTHORIZED', msg);
export const forbidden = (msg = 'You do not have permission to perform this action') => new HttpError(403, 'FORBIDDEN', msg);
export const notFound = (what = 'Resource') => new HttpError(404, 'NOT_FOUND', `${what} not found`);
export const conflict = (msg: string) => new HttpError(409, 'CONFLICT', msg);

/** Wraps async handlers so rejected promises reach the error middleware (Express 4). */
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) =>
    fn(req, res, next).catch(next);

export function parse<T extends ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) throw validationError(r.error);
  return r.data;
}

export function validationError(e: ZodError) {
  return new HttpError(422, 'VALIDATION_ERROR', 'Validation failed', e.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) err = validationError(err);
  if (err?.code === 'P2002') err = conflict(`A record with this ${(err.meta?.target as string[] | undefined)?.join(', ') ?? 'value'} already exists`);
  if (err?.code === 'P2025') err = new HttpError(404, 'NOT_FOUND', 'Resource not found');
  if (err?.code === 'LIMIT_FILE_SIZE') err = new HttpError(413, 'FILE_TOO_LARGE', 'File exceeds the maximum upload size');
  if (err?.type === 'entity.too.large') err = new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Request body too large');
  if (err?.type === 'entity.parse.failed') err = badRequest('Malformed JSON body');
  if (!(err instanceof HttpError)) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    err = new HttpError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
  res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
}
