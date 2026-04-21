import type { Caption } from '@reelforge/ir';

/**
 * Serialize Caption[] to SRT. Each caption becomes one cue.
 * Most commonly you'll pass phrase-level captions (e.g. built from
 * TikTokPage) rather than per-word — otherwise the SRT is noisy.
 */
export function captionsToSrt(captions: readonly Caption[]): string {
  return captions
    .map((c, i) => {
      const cue =
        `${i + 1}\n` +
        `${formatSrtTime(c.startMs)} --> ${formatSrtTime(c.endMs)}\n` +
        `${c.text.trim()}`;
      return cue;
    })
    .join('\n\n') + '\n';
}

/**
 * Parse SRT text into Caption[]. Handles multi-line cues; tolerates both
 * comma and dot as the millisecond separator.
 */
export function parseSrt(srt: string): Caption[] {
  const normalized = srt.replace(/\r\n/g, '\n').trim();
  if (normalized === '') return [];

  const blocks = normalized.split(/\n{2,}/);
  const captions: Caption[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    if (lines.length < 2) continue;

    // Find the `xx:xx:xx,xxx --> xx:xx:xx,xxx` line — it may be lines[0] if no index.
    const timeLineIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeLineIdx === -1) continue;

    const timeLine = lines[timeLineIdx]!;
    const parts = timeLine.split('-->').map((s) => s.trim());
    if (parts.length !== 2) continue;
    const startMs = parseSrtTime(parts[0]!);
    const endMs = parseSrtTime(parts[1]!);
    if (startMs === null || endMs === null) continue;

    const text = lines.slice(timeLineIdx + 1).join('\n');
    captions.push({
      text,
      startMs,
      endMs,
      timestampMs: null,
      confidence: null,
    });
  }

  return captions;
}

function formatSrtTime(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms));
  const h = Math.floor(clamped / 3_600_000);
  const m = Math.floor((clamped % 3_600_000) / 60_000);
  const s = Math.floor((clamped % 60_000) / 1000);
  const milli = clamped % 1000;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${pad3(milli)}`;
}

function parseSrtTime(t: string): number | null {
  const m = t.match(/^(\d+):(\d{1,2}):(\d{1,2})[,.](\d{1,3})$/);
  if (!m) return null;
  const [, hh, mm, ss, ms] = m;
  return (
    Number(hh) * 3_600_000 +
    Number(mm) * 60_000 +
    Number(ss) * 1000 +
    Number(ms!.padEnd(3, '0'))
  );
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
function pad3(n: number): string {
  return String(n).padStart(3, '0');
}
