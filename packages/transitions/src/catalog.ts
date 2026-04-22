import { isXFadeName, type XFadeName } from './xfade';

/**
 * Curated friendly names that map onto a single `xfade` built-in.
 * DSL configs author against these; the underlying xfade name is an
 * implementation detail.
 */
export const ALIAS_TO_XFADE: Readonly<Record<string, XFadeName>> = {
  fade: 'fade',
  'cross-fade': 'fade',
  crossfade: 'fade',
  'fade-black': 'fadeblack',
  'fade-white': 'fadewhite',
  'wipe-left': 'wipeleft',
  'wipe-right': 'wiperight',
  'wipe-up': 'wipeup',
  'wipe-down': 'wipedown',
  'slide-left': 'slideleft',
  'slide-right': 'slideright',
  'slide-up': 'slideup',
  'slide-down': 'slidedown',
  dissolve: 'dissolve',
  pixelize: 'pixelize',
  'circle-open': 'circleopen',
  'circle-close': 'circleclose',
  radial: 'radial',
  zoom: 'zoomin',
  'zoom-in': 'zoomin',
};

export const CURATED_NAMES: readonly string[] = Object.keys(ALIAS_TO_XFADE);

/**
 * Every name resolveTransition() will accept: curated aliases +
 * `xfade:<name>` passthroughs.
 */
export function listTransitions(): string[] {
  const raw = (ALIAS_TO_XFADE as Record<string, string>);
  return [
    ...Object.keys(raw),
    ...(Array.from({ length: 46 }, (_, i) => `xfade:${i}`).filter(
      (_, i) => isXFadeName(Object.values(ALIAS_TO_XFADE)[i] ?? ''),
    )),
  ];
}
