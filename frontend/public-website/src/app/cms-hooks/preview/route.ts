import { cookies, draftMode } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { PREVIEW_COOKIE } from '@/lib/api';

/** Enables preview of unpublished content using a short-lived token issued by the admin portal. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const path = req.nextUrl.searchParams.get('path') ?? '/';
  if (!token || !path.startsWith('/') || path.startsWith('//')) return new NextResponse('Invalid preview link', { status: 400 });
  // The API validates the token on every request; an invalid token simply shows published content.
  (await draftMode()).enable();
  const https = req.headers.get('x-forwarded-proto') === 'https' || req.nextUrl.protocol === 'https:';
  (await cookies()).set(PREVIEW_COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 30 * 60, secure: https });
  // Relative redirect keeps the visitor on the address they used (nginx forwards the Host header).
  return new NextResponse(null, { status: 307, headers: { Location: path } });
}
