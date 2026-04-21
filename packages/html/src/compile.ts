import { parse as parseDocument, type HTMLElement } from 'node-html-parser';
import type {
  Asset,
  AudioAsset,
  Clip,
  EffectRef,
  ImageAsset,
  ProjectConfig,
  Track,
  VideoAsset,
  VideoProject,
} from '@reelforge/ir';
import { parse as parseProject } from '@reelforge/ir';
import {
  deriveSource,
  readBoolean,
  readInt,
  readNumber,
  readString,
  sanitizeId,
} from './attrs';

export interface CompileHtmlOptions {
  baseDir: string;
  /** Absolute filesystem path of the HTML source, when available. */
  htmlPath?: string;
}

export interface HtmlCompilationResult {
  project: VideoProject;
  htmlPath: string | undefined;
  baseDir: string;
}

const MEDIA_TAGS = new Set(['IMG', 'VIDEO', 'AUDIO']);
const DEFAULT_CONFIG: ProjectConfig = { width: 1920, height: 1080, fps: 30 };

export function compileHtml(source: string, opts: CompileHtmlOptions): HtmlCompilationResult {
  const root = parseDocument(source, { lowerCaseTagName: false });

  const config = extractConfig(root);

  const assets = new Map<string, Asset>();
  const clips: { tag: string; clip: Clip }[] = [];

  const candidates = root.querySelectorAll('[data-start]');
  for (const el of candidates) {
    if (el.getAttribute('data-duration') === undefined) continue;

    const tag = el.tagName.toUpperCase();
    if (!MEDIA_TAGS.has(tag)) continue; // MVP: media-only

    const src = el.getAttribute('src');
    if (src === undefined || src === '') {
      throw new HtmlCompileError(
        `<${tag.toLowerCase()}> with data-start is missing "src": ${el.toString().slice(0, 120)}`,
      );
    }

    const asset = ensureAsset(assets, tag, src, el);
    const clip = buildClip(el, asset.id);
    clips.push({ tag, clip });
  }

  const tracks = groupIntoTracks(clips);

  const project = parseProject({
    version: '1',
    config,
    assets: Object.fromEntries(assets),
    timeline: { tracks },
  });

  return { project, htmlPath: opts.htmlPath, baseDir: opts.baseDir };
}

export async function compileHtmlFile(filepath: string): Promise<HtmlCompilationResult> {
  const { readFile } = await import('node:fs/promises');
  const { dirname, resolve } = await import('node:path');
  const absolute = resolve(filepath);
  const source = await readFile(absolute, 'utf8');
  return compileHtml(source, { baseDir: dirname(absolute), htmlPath: absolute });
}

export class HtmlCompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HtmlCompileError';
  }
}

function extractConfig(root: HTMLElement): ProjectConfig {
  const htmlEl = root.querySelector('html');
  return {
    width: readInt(htmlEl, 'data-rf-width') ?? DEFAULT_CONFIG.width,
    height: readInt(htmlEl, 'data-rf-height') ?? DEFAULT_CONFIG.height,
    fps: readNumber(htmlEl, 'data-rf-fps') ?? DEFAULT_CONFIG.fps,
  };
}

function ensureAsset(
  assets: Map<string, Asset>,
  tag: string,
  src: string,
  el: HTMLElement,
): Asset {
  const kind = tagToAssetKind(tag);
  const id = `${kind}_${sanitizeId(src)}`;
  const existing = assets.get(id);
  if (existing) return existing;

  const source = deriveSource(src);
  let asset: Asset;
  switch (kind) {
    case 'image': {
      const image: ImageAsset = { id, kind: 'image', source };
      asset = image;
      break;
    }
    case 'video': {
      const hasAudio = readBoolean(el, 'data-has-audio');
      const video: VideoAsset = {
        id,
        kind: 'video',
        source,
        ...(hasAudio !== undefined ? { hasAudio } : {}),
      };
      asset = video;
      break;
    }
    case 'audio': {
      const durationSec = readNumber(el, 'data-duration') ?? 0;
      const audio: AudioAsset = {
        id,
        kind: 'audio',
        source,
        durationMs: Math.max(0, Math.round(durationSec * 1000)),
      };
      asset = audio;
      break;
    }
  }
  assets.set(id, asset);
  return asset;
}

function buildClip(el: HTMLElement, assetRef: string): Clip {
  const startSec = readNumber(el, 'data-start');
  const durationSec = readNumber(el, 'data-duration');
  if (startSec === undefined) {
    throw new HtmlCompileError(`Element with data-duration is missing data-start`);
  }
  if (durationSec === undefined || durationSec <= 0) {
    throw new HtmlCompileError(
      `Element data-duration must be a positive number (got "${el.getAttribute('data-duration')}")`,
    );
  }

  const sourceStartSec = readNumber(el, 'data-source-start');
  const z = readInt(el, 'data-z');
  const volume = readNumber(el, 'data-volume');
  const fit = readString(el, 'data-fit') as Clip['fit'];
  const dataId = readString(el, 'data-id');
  const effects = parseEffects(readString(el, 'data-effect'));

  const clip: Clip = {
    id: dataId ?? `clip_${assetRef}_${Math.round(startSec * 1000)}`,
    assetRef,
    startMs: Math.max(0, Math.round(startSec * 1000)),
    durationMs: Math.max(1, Math.round(durationSec * 1000)),
    ...(sourceStartSec !== undefined
      ? { sourceStartMs: Math.max(0, Math.round(sourceStartSec * 1000)) }
      : {}),
    ...(z !== undefined ? { z } : {}),
    ...(volume !== undefined ? { volume } : {}),
    ...(fit ? { fit } : {}),
    ...(effects.length > 0 ? { effects } : {}),
  };

  return clip;
}

function parseEffects(raw: string | undefined): EffectRef[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
    .map((name) => ({ name }));
}

function tagToAssetKind(tag: string): 'image' | 'video' | 'audio' {
  switch (tag) {
    case 'IMG':
      return 'image';
    case 'VIDEO':
      return 'video';
    case 'AUDIO':
      return 'audio';
    default:
      throw new HtmlCompileError(`Unsupported media tag: ${tag}`);
  }
}

function groupIntoTracks(items: { tag: string; clip: Clip }[]): Track[] {
  const videoClips: Clip[] = [];
  const audioClips: Clip[] = [];
  for (const { tag, clip } of items) {
    if (tag === 'AUDIO') audioClips.push(clip);
    else videoClips.push(clip);
  }
  const tracks: Track[] = [{ id: 'main', kind: 'video', clips: videoClips }];
  if (audioClips.length > 0) {
    tracks.push({ id: 'audio', kind: 'audio', clips: audioClips });
  }
  return tracks;
}
