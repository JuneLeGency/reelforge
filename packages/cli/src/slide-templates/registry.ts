import { archDiagram, ARCH_DIAGRAM_CSS } from './arch-diagram';
import { bulletStagger, BULLET_STAGGER_CSS } from './bullet-stagger';
import { dataChartReveal, DATA_CHART_REVEAL_CSS } from './data-chart-reveal';
import { endCard, END_CARD_CSS } from './end-card';
import { heroFadeUp, HERO_FADE_UP_CSS } from './hero-fade-up';
import {
  imageLeftText,
  imageRightText,
  IMAGE_TEXT_SPLIT_CSS,
} from './image-left-text';
import { kenBurnsZoom, KEN_BURNS_CSS } from './ken-burns';
import { kineticType, KINETIC_TYPE_CSS } from './kinetic-type';
import { logoOutro, LOGO_OUTRO_CSS } from './logo-outro';
import { lowerThird, LOWER_THIRD_CSS } from './lower-third';
import { photoCard, PHOTO_CARD_CSS } from './photo-card';
import { pictureInPicture, PIP_CSS } from './picture-in-picture';
import { quoteCard, QUOTE_CARD_CSS } from './quote-card';
import { splitReveal, SPLIT_REVEAL_CSS } from './split-reveal';
import { testimonial, TESTIMONIAL_CSS } from './testimonial';
import { timelineRoadmap, TIMELINE_ROADMAP_CSS } from './timeline-roadmap';
import type { SlideTemplate } from './types';

export const SLIDE_TEMPLATES: Readonly<Record<string, SlideTemplate>> = {
  'hero-fade-up': heroFadeUp,
  'ken-burns-zoom': kenBurnsZoom,
  'bullet-stagger': bulletStagger,
  'split-reveal': splitReveal,
  'image-left-text': imageLeftText,
  'image-right-text': imageRightText,
  'photo-card': photoCard,
  'quote-card': quoteCard,
  'kinetic-type': kineticType,
  'logo-outro': logoOutro,
  'data-chart-reveal': dataChartReveal,
  testimonial: testimonial,
  'lower-third': lowerThird,
  'picture-in-picture': pictureInPicture,
  'timeline-roadmap': timelineRoadmap,
  'end-card': endCard,
  'arch-diagram': archDiagram,
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
  'image-left-text': IMAGE_TEXT_SPLIT_CSS,
  'image-right-text': IMAGE_TEXT_SPLIT_CSS,
  'photo-card': PHOTO_CARD_CSS,
  'quote-card': QUOTE_CARD_CSS,
  'kinetic-type': KINETIC_TYPE_CSS,
  'logo-outro': LOGO_OUTRO_CSS,
  'data-chart-reveal': DATA_CHART_REVEAL_CSS,
  testimonial: TESTIMONIAL_CSS,
  'lower-third': LOWER_THIRD_CSS,
  'picture-in-picture': PIP_CSS,
  'timeline-roadmap': TIMELINE_ROADMAP_CSS,
  'end-card': END_CARD_CSS,
  'arch-diagram': ARCH_DIAGRAM_CSS,
};

export function resolveTemplate(name: string | undefined): SlideTemplate | null {
  if (!name) return null;
  return SLIDE_TEMPLATES[name] ?? null;
}

export function listTemplateNames(): string[] {
  return Object.keys(SLIDE_TEMPLATES);
}
