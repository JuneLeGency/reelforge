import type { HTMLElement } from 'node-html-parser';
import type { AssetSource } from '@reelforge/ir';

export function readNumber(el: HTMLElement | null, attr: string): number | undefined {
  if (!el) return undefined;
  const raw = el.getAttribute(attr);
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function readInt(el: HTMLElement | null, attr: string): number | undefined {
  const n = readNumber(el, attr);
  return n === undefined ? undefined : Math.trunc(n);
}

export function readString(el: HTMLElement | null, attr: string): string | undefined {
  if (!el) return undefined;
  const raw = el.getAttribute(attr);
  return raw === undefined || raw === null || raw === '' ? undefined : raw;
}

export function readBoolean(el: HTMLElement | null, attr: string): boolean | undefined {
  if (!el) return undefined;
  const raw = el.getAttribute(attr);
  if (raw === undefined || raw === null) return undefined;
  if (raw === '' || raw === 'true' || raw === attr) return true;
  if (raw === 'false') return false;
  return undefined;
}

export function deriveSource(src: string): AssetSource {
  if (src.startsWith('data:')) return { scheme: 'data', uri: src };
  if (/^https?:\/\//i.test(src)) return { scheme: 'url', uri: src };
  if (src.startsWith('s3://')) return { scheme: 's3', uri: src };
  if (src.startsWith('gs://')) return { scheme: 'gs', uri: src };
  return { scheme: 'file', uri: src };
}

export function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
