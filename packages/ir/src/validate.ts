import type { ZodIssue } from 'zod';
import { VideoProjectSchema, type VideoProject } from './project';

export interface IntegrityIssue {
  path: string;
  message: string;
}

export class VideoProjectValidationError extends Error {
  public readonly issues: ReadonlyArray<IntegrityIssue | ZodIssue>;

  constructor(message: string, issues: ReadonlyArray<IntegrityIssue | ZodIssue>) {
    super(message);
    this.name = 'VideoProjectValidationError';
    this.issues = issues;
  }
}

export type ParseResult =
  | { success: true; data: VideoProject }
  | { success: false; error: VideoProjectValidationError };

/**
 * Parse and validate an unknown input as a VideoProject.
 * Throws `VideoProjectValidationError` on failure.
 */
export function parse(input: unknown): VideoProject {
  const result = safeParse(input);
  if (!result.success) throw result.error;
  return result.data;
}

/**
 * Non-throwing variant of {@link parse}. Returns a tagged result object.
 */
export function safeParse(input: unknown): ParseResult {
  const shape = VideoProjectSchema.safeParse(input);
  if (!shape.success) {
    return {
      success: false,
      error: new VideoProjectValidationError(
        `Invalid VideoProject: ${shape.error.issues.length} schema issue(s)`,
        shape.error.issues,
      ),
    };
  }

  const integrity = checkReferentialIntegrity(shape.data);
  if (integrity.length > 0) {
    return {
      success: false,
      error: new VideoProjectValidationError(
        `Invalid VideoProject: ${integrity.length} integrity issue(s)`,
        integrity,
      ),
    };
  }

  return { success: true, data: shape.data };
}

/**
 * Total project duration in milliseconds.
 * Uses `config.duration` (seconds) if set; otherwise derives from the latest clip end.
 */
export function planDuration(project: VideoProject): number {
  if (project.config.duration !== undefined) {
    return project.config.duration * 1000;
  }
  let max = 0;
  for (const track of project.timeline.tracks) {
    for (const clip of track.clips) {
      const end = clip.startMs + clip.durationMs;
      if (end > max) max = end;
    }
  }
  return max;
}

/**
 * Collect all asset ids referenced by the timeline. Useful for preloading.
 */
export function collectAssetRefs(project: VideoProject): Set<string> {
  const refs = new Set<string>();
  for (const track of project.timeline.tracks) {
    for (const clip of track.clips) {
      refs.add(clip.assetRef);
    }
  }
  return refs;
}

function checkReferentialIntegrity(project: VideoProject): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const knownAssets = new Set(Object.keys(project.assets));
  const effectLib = new Set(Object.keys(project.effectsLibrary ?? {}));
  const transitionLib = new Set(Object.keys(project.transitionsLibrary ?? {}));

  project.timeline.tracks.forEach((track, ti) => {
    track.clips.forEach((clip, ci) => {
      const base = `timeline.tracks[${ti}].clips[${ci}]`;

      if (!knownAssets.has(clip.assetRef)) {
        issues.push({
          path: `${base}.assetRef`,
          message: `unknown assetRef "${clip.assetRef}"`,
        });
      }

      clip.effects?.forEach((eff, ei) => {
        if (typeof eff === 'string' && !effectLib.has(eff)) {
          issues.push({
            path: `${base}.effects[${ei}]`,
            message: `unknown effect reference "${eff}"`,
          });
        }
      });

      for (const key of ['transitionIn', 'transitionOut'] as const) {
        const t = clip[key];
        if (typeof t === 'string' && !transitionLib.has(t)) {
          issues.push({
            path: `${base}.${key}`,
            message: `unknown transition reference "${t}"`,
          });
        }
      }
    });
  });

  return issues;
}
