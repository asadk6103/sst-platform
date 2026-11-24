import { mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { config } from '../../config';
import { HttpError } from '../../lib/http';

/** Allowed upload types, verified from the file's magic bytes (never the client's claim). */
export const ALLOWED: Record<string, { ext: string; kind: 'image' | 'document' }> = {
  'image/jpeg': { ext: 'jpg', kind: 'image' },
  'image/png': { ext: 'png', kind: 'image' },
  'image/webp': { ext: 'webp', kind: 'image' },
  'image/gif': { ext: 'gif', kind: 'image' },
  'image/avif': { ext: 'avif', kind: 'image' },
  'application/pdf': { ext: 'pdf', kind: 'document' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'docx', kind: 'document' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: 'xlsx', kind: 'document' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { ext: 'pptx', kind: 'document' },
};

const VARIANT_WIDTHS = [320, 640, 960, 1280, 1920];

export interface StoredFile {
  storageKey: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  variants: { width: number; key: string }[];
  checksum: string;
}

export async function detectType(buffer: Buffer) {
  const ft = await fileTypeFromBuffer(buffer);
  const mime = ft?.mime;
  if (!mime || !ALLOWED[mime]) {
    throw new HttpError(415, 'UNSUPPORTED_FILE_TYPE', 'Unsupported file type. Allowed: JPG, PNG, WebP, GIF, AVIF, PDF, DOCX, XLSX, PPTX');
  }
  return mime;
}

async function put(key: string, data: Buffer) {
  const abs = join(config.uploadDir, key);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, data);
}

/** Stores the original untouched and generates responsive WebP variants for images. */
export async function storeFile(id: string, buffer: Buffer, revision = 1): Promise<StoredFile> {
  const mimeType = await detectType(buffer);
  const { ext, kind } = ALLOWED[mimeType]!;
  const now = new Date();
  const storageKey = `originals/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${id}${revision > 1 ? `-r${revision}` : ''}.${ext}`;
  await put(storageKey, buffer);

  let width: number | null = null;
  let height: number | null = null;
  const variants: { width: number; key: string }[] = [];
  if (kind === 'image') {
    try {
      const meta = await sharp(buffer, { animated: false }).rotate().metadata();
      // .rotate() respects EXIF orientation; swap dimensions for rotated images
      const rotated = meta.orientation && meta.orientation >= 5;
      width = (rotated ? meta.height : meta.width) ?? null;
      height = (rotated ? meta.width : meta.height) ?? null;
      if (width && mimeType !== 'image/gif') {
        const widths = VARIANT_WIDTHS.filter((w) => w < width!);
        widths.push(Math.min(width, 2400));
        for (const w of [...new Set(widths)]) {
          const key = `variants/${id}/r${revision}-${w}.webp`;
          const out = await sharp(buffer).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
          await put(key, out);
          variants.push({ width: w, key });
        }
      }
    } catch {
      throw new HttpError(422, 'INVALID_IMAGE', 'The image could not be processed. It may be corrupt.');
    }
  }
  return { storageKey, mimeType, size: buffer.length, width, height, variants, checksum: createHash('sha256').update(buffer).digest('hex') };
}

/** Moves a replaced original to uploads/replaced/ so no uploaded file is ever lost. */
export async function archiveOriginal(storageKey: string) {
  const from = join(config.uploadDir, storageKey);
  const to = join(config.uploadDir, 'replaced', storageKey.replace(/^originals\//, ''));
  await mkdir(dirname(to), { recursive: true });
  await rename(from, to).catch(() => undefined);
}

export async function removeVariants(keys: { key: string }[]) {
  await Promise.all(keys.map((k) => rm(join(config.uploadDir, k.key), { force: true })));
}
