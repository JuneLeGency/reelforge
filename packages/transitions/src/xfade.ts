/**
 * Every transition name ffmpeg's `xfade` filter accepts, as of ffmpeg 7.x.
 * New names ship in newer ffmpeg builds; validate against
 * `ffmpeg -h filter=xfade` for the exact set on the host machine — the
 * resolver below treats an unknown name as an error, so we never emit a
 * filter ffmpeg would reject.
 *
 * The list here is the union of documented options; it's intentionally a
 * tuple of string literals so consumers can `as const`-narrow it.
 */
export const XFADE_TRANSITIONS = [
  'fade',
  'fadeblack',
  'fadewhite',
  'fadegrays',
  'fadefast',
  'fadeslow',
  'distance',
  'wipeleft',
  'wiperight',
  'wipeup',
  'wipedown',
  'slideleft',
  'slideright',
  'slideup',
  'slidedown',
  'circlecrop',
  'rectcrop',
  'circleopen',
  'circleclose',
  'vertopen',
  'vertclose',
  'horzopen',
  'horzclose',
  'dissolve',
  'pixelize',
  'radial',
  'smoothleft',
  'smoothright',
  'smoothup',
  'smoothdown',
  'diagtl',
  'diagtr',
  'diagbl',
  'diagbr',
  'hlslice',
  'hrslice',
  'vuslice',
  'vdslice',
  'hblur',
  'wipetl',
  'wipetr',
  'wipebl',
  'wipebr',
  'squeezeh',
  'squeezev',
  'zoomin',
] as const;

export type XFadeName = (typeof XFADE_TRANSITIONS)[number];

export function isXFadeName(name: string): name is XFadeName {
  return (XFADE_TRANSITIONS as readonly string[]).includes(name);
}
