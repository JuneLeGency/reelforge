export interface DslTitleStyle {
  color?: string;
  background?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number | string;
  padding?: string;
  borderRadius?: string;
  position?: 'top' | 'center' | 'bottom';
}

export type DslLayer =
  | { type: 'image'; src: string; fit?: 'cover' | 'contain' | 'fill' }
  | { type: 'title'; text: string; style?: DslTitleStyle; entrance?: 'fade' | 'slide-up' | 'none' }
  | { type: 'audio'; src: string; volume?: number };

export interface DslClip {
  duration: number; // seconds
  transition?: 'fade' | 'none';
  layers: DslLayer[];
}

export interface DslAudioTrack {
  src: string;
  volume?: number;
  start?: number; // seconds; default 0
  duration?: number; // seconds; default = project duration
}

export interface DslConfig {
  width?: number;
  height?: number;
  fps?: number;
  background?: string;
}

export interface DslDefaults {
  transition?: 'fade' | 'none';
  duration?: number; // seconds
}

export interface DslProject {
  config?: DslConfig;
  defaults?: DslDefaults;
  clips: DslClip[];
  audio?: DslAudioTrack[];
  meta?: { title?: string; description?: string; author?: string };
}

export class DslError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DslError';
  }
}

/**
 * Validate-and-normalize raw input into a strict DslProject. Throws on
 * structural problems (missing required fields, wrong types) rather than
 * silently coercing.
 */
export function parseDsl(raw: unknown): DslProject {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new DslError('DSL config must be a JSON object');
  }
  const r = raw as Record<string, unknown>;

  const clipsRaw = r.clips;
  if (!Array.isArray(clipsRaw) || clipsRaw.length === 0) {
    throw new DslError('DSL config.clips must be a non-empty array');
  }

  const clips: DslClip[] = clipsRaw.map((c, i) => parseClip(c, i));

  const project: DslProject = {
    clips,
  };
  if (r.config !== undefined) project.config = parseConfig(r.config);
  if (r.defaults !== undefined) project.defaults = parseDefaults(r.defaults);
  if (r.audio !== undefined) project.audio = parseAudioTracks(r.audio);
  if (r.meta !== undefined) project.meta = parseMeta(r.meta);
  return project;
}

function parseConfig(raw: unknown): DslConfig {
  if (typeof raw !== 'object' || raw === null) {
    throw new DslError('config must be an object');
  }
  const r = raw as Record<string, unknown>;
  const cfg: DslConfig = {};
  if (r.width !== undefined) cfg.width = assertNumber(r.width, 'config.width');
  if (r.height !== undefined) cfg.height = assertNumber(r.height, 'config.height');
  if (r.fps !== undefined) cfg.fps = assertNumber(r.fps, 'config.fps');
  if (r.background !== undefined) cfg.background = assertString(r.background, 'config.background');
  return cfg;
}

function parseDefaults(raw: unknown): DslDefaults {
  if (typeof raw !== 'object' || raw === null) {
    throw new DslError('defaults must be an object');
  }
  const r = raw as Record<string, unknown>;
  const d: DslDefaults = {};
  if (r.transition !== undefined) {
    const t = assertString(r.transition, 'defaults.transition');
    if (t !== 'fade' && t !== 'none') {
      throw new DslError(`defaults.transition must be "fade" or "none", got "${t}"`);
    }
    d.transition = t;
  }
  if (r.duration !== undefined) d.duration = assertNumber(r.duration, 'defaults.duration');
  return d;
}

function parseClip(raw: unknown, index: number): DslClip {
  if (typeof raw !== 'object' || raw === null) {
    throw new DslError(`clips[${index}] must be an object`);
  }
  const r = raw as Record<string, unknown>;
  const duration = r.duration !== undefined
    ? assertNumber(r.duration, `clips[${index}].duration`)
    : undefined;
  if (duration === undefined || duration <= 0) {
    throw new DslError(`clips[${index}].duration is required and must be > 0 (seconds)`);
  }

  const layersRaw = r.layers;
  if (!Array.isArray(layersRaw) || layersRaw.length === 0) {
    throw new DslError(`clips[${index}].layers must be a non-empty array`);
  }
  const layers = layersRaw.map((l, j) => parseLayer(l, index, j));

  const clip: DslClip = { duration, layers };
  if (r.transition !== undefined) {
    const t = assertString(r.transition, `clips[${index}].transition`);
    if (t !== 'fade' && t !== 'none') {
      throw new DslError(
        `clips[${index}].transition must be "fade" or "none", got "${t}"`,
      );
    }
    clip.transition = t;
  }
  return clip;
}

function parseLayer(raw: unknown, clipIndex: number, layerIndex: number): DslLayer {
  const ctx = `clips[${clipIndex}].layers[${layerIndex}]`;
  if (typeof raw !== 'object' || raw === null) {
    throw new DslError(`${ctx} must be an object`);
  }
  const r = raw as Record<string, unknown>;
  const type = assertString(r.type, `${ctx}.type`);
  switch (type) {
    case 'image': {
      const src = assertString(r.src, `${ctx}.src`);
      let fit: 'cover' | 'contain' | 'fill' | undefined;
      if (r.fit !== undefined) {
        const raw = assertString(r.fit, `${ctx}.fit`);
        if (raw !== 'cover' && raw !== 'contain' && raw !== 'fill') {
          throw new DslError(`${ctx}.fit must be cover/contain/fill`);
        }
        fit = raw;
      }
      return fit ? { type: 'image', src, fit } : { type: 'image', src };
    }
    case 'title': {
      const text = assertString(r.text, `${ctx}.text`);
      const style = r.style !== undefined
        ? parseTitleStyle(r.style, `${ctx}.style`)
        : undefined;
      const entranceRaw = r.entrance !== undefined
        ? assertString(r.entrance, `${ctx}.entrance`)
        : undefined;
      const entrance =
        entranceRaw && entranceRaw !== 'fade' && entranceRaw !== 'slide-up' && entranceRaw !== 'none'
          ? (() => {
              throw new DslError(`${ctx}.entrance must be fade/slide-up/none`);
            })()
          : (entranceRaw as DslLayer extends { type: 'title' } ? never : never) ?? undefined;
      const layer: DslLayer = { type: 'title', text };
      if (style) layer.style = style;
      if (entranceRaw === 'fade' || entranceRaw === 'slide-up' || entranceRaw === 'none') {
        (layer as { entrance?: 'fade' | 'slide-up' | 'none' }).entrance = entranceRaw;
      }
      return layer;
    }
    case 'audio': {
      const src = assertString(r.src, `${ctx}.src`);
      const layer: DslLayer = { type: 'audio', src };
      if (r.volume !== undefined) {
        (layer as { volume?: number }).volume = assertNumber(r.volume, `${ctx}.volume`);
      }
      return layer;
    }
    default:
      throw new DslError(`${ctx}.type "${type}" is not supported (image / title / audio)`);
  }
}

function parseTitleStyle(raw: unknown, ctx: string): DslTitleStyle {
  if (typeof raw !== 'object' || raw === null) throw new DslError(`${ctx} must be an object`);
  const r = raw as Record<string, unknown>;
  const s: DslTitleStyle = {};
  if (r.color !== undefined) s.color = assertString(r.color, `${ctx}.color`);
  if (r.background !== undefined) s.background = assertString(r.background, `${ctx}.background`);
  if (r.fontSize !== undefined) s.fontSize = assertNumber(r.fontSize, `${ctx}.fontSize`);
  if (r.fontFamily !== undefined) s.fontFamily = assertString(r.fontFamily, `${ctx}.fontFamily`);
  if (r.fontWeight !== undefined) {
    if (typeof r.fontWeight === 'number' || typeof r.fontWeight === 'string') {
      s.fontWeight = r.fontWeight;
    } else {
      throw new DslError(`${ctx}.fontWeight must be number or string`);
    }
  }
  if (r.padding !== undefined) s.padding = assertString(r.padding, `${ctx}.padding`);
  if (r.borderRadius !== undefined) s.borderRadius = assertString(r.borderRadius, `${ctx}.borderRadius`);
  if (r.position !== undefined) {
    const p = assertString(r.position, `${ctx}.position`);
    if (p !== 'top' && p !== 'center' && p !== 'bottom') {
      throw new DslError(`${ctx}.position must be top/center/bottom`);
    }
    s.position = p;
  }
  return s;
}

function parseAudioTracks(raw: unknown): DslAudioTrack[] {
  if (!Array.isArray(raw)) throw new DslError('audio must be an array');
  return raw.map((t, i) => {
    if (typeof t !== 'object' || t === null) {
      throw new DslError(`audio[${i}] must be an object`);
    }
    const r = t as Record<string, unknown>;
    const src = assertString(r.src, `audio[${i}].src`);
    const out: DslAudioTrack = { src };
    if (r.volume !== undefined) out.volume = assertNumber(r.volume, `audio[${i}].volume`);
    if (r.start !== undefined) out.start = assertNumber(r.start, `audio[${i}].start`);
    if (r.duration !== undefined) out.duration = assertNumber(r.duration, `audio[${i}].duration`);
    return out;
  });
}

function parseMeta(raw: unknown): NonNullable<DslProject['meta']> {
  if (typeof raw !== 'object' || raw === null) throw new DslError('meta must be an object');
  const r = raw as Record<string, unknown>;
  const m: NonNullable<DslProject['meta']> = {};
  if (r.title !== undefined) m.title = assertString(r.title, 'meta.title');
  if (r.description !== undefined) m.description = assertString(r.description, 'meta.description');
  if (r.author !== undefined) m.author = assertString(r.author, 'meta.author');
  return m;
}

function assertString(v: unknown, path: string): string {
  if (typeof v !== 'string' || v === '') {
    throw new DslError(`${path} must be a non-empty string`);
  }
  return v;
}

function assertNumber(v: unknown, path: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new DslError(`${path} must be a finite number`);
  }
  return v;
}
