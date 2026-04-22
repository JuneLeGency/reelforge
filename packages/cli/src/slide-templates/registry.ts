import { bulletStagger, BULLET_STAGGER_CSS } from './bullet-stagger';
import { heroFadeUp, HERO_FADE_UP_CSS } from './hero-fade-up';
import { kenBurnsZoom, KEN_BURNS_CSS } from './ken-burns';
import { splitReveal, SPLIT_REVEAL_CSS } from './split-reveal';
import type { SlideTemplate } from './types';

export const SLIDE_TEMPLATES: Readonly<Record<string, SlideTemplate>> = {
  'hero-fade-up': heroFadeUp,
  'ken-burns-zoom': kenBurnsZoom,
  'bullet-stagger': bulletStagger,
  'split-reveal': splitReveal,
};

/**
 * CSS blocks, keyed by template name. The caller uses the set of
 * templates actually referenced in a composition to decide which CSS to
 * inject — no dead styles reach the browser.
 */
export const SLIDE_TEMPLATE_CSS: Readonly<Record<string, string>> = {
  'hero-fade-up': HERO_FADE_UP_CSS,
  'ken-burns-zoom': KEN_BURNS_CSS,
  'bullet-stagger': BULLET_STAGGER_CSS,
  'split-reveal': SPLIT_REVEAL_CSS,
};

export function resolveTemplate(name: string | undefined): SlideTemplate | null {
  if (!name) return null;
  return SLIDE_TEMPLATES[name] ?? null;
}

export function listTemplateNames(): string[] {
  return Object.keys(SLIDE_TEMPLATES);
}
