import { cookies, draftMode } from 'next/headers';
import { NextResponse } from 'next/server';
import { PREVIEW_COOKIE } from '@/lib/api';

export async function GET() {
  (await draftMode()).disable();
  (await cookies()).delete(PREVIEW_COOKIE);
  return new NextResponse(null, { status: 307, headers: { Location: '/' } });
}
