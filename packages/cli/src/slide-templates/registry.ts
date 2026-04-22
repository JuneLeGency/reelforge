import { archDiagram, ARCH_DIAGRAM_CSS } from './arch-diagram';
import { audioWaveform, AUDIO_WAVEFORM_CSS } from './audio-waveform';
import { bulletStagger, BULLET_STAGGER_CSS } from './bullet-stagger';
import { chartLine, CHART_LINE_CSS } from './chart-line';
import { chartPie, CHART_PIE_CSS } from './chart-pie';
import { codeBlock, CODE_BLOCK_CSS } from './code-block';
import { dataChartReveal, DATA_CHART_REVEAL_CSS } from './data-chart-reveal';
import { dataGrid, DATA_GRID_CSS } from './data-grid';
import { endCard, END_CARD_CSS } from './end-card';
import { flowchart, FLOWCHART_CSS } from './flowchart';
import { gradientBg, GRADIENT_BG_CSS } from './gradient-bg';
import { musicCard, MUSIC_CARD_CSS } from './music-card';
import { newsTitle, NEWS_TITLE_CSS } from './news-title';
import { socialFollow, SOCIAL_FOLLOW_CSS } from './social-follow';
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
import { splitCompare, SPLIT_COMPARE_CSS } from './split-compare';
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
  'split-compare': splitCompare,
  'code-block': codeBlock,
  'data-grid': dataGrid,
  'news-title': newsTitle,
  'gradient-bg': gradientBg,
  'chart-line': chartLine,
  'chart-pie': chartPie,
  'audio-waveform': audioWaveform,
  'social-follow': socialFollow,
  'music-card': musicCard,
  flowchart: flowchart,
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
  'split-compare': SPLIT_COMPARE_CSS,
  'code-block': CODE_BLOCK_CSS,
  'data-grid': DATA_GRID_CSS,
  'news-title': NEWS_TITLE_CSS,
  'gradient-bg': GRADIENT_BG_CSS,
  'chart-line': CHART_LINE_CSS,
  'chart-pie': CHART_PIE_CSS,
  'audio-waveform': AUDIO_WAVEFORM_CSS,
  'social-follow': SOCIAL_FOLLOW_CSS,
  'music-card': MUSIC_CARD_CSS,
  flowchart: FLOWCHART_CSS,
};

export function resolveTemplate(name: string | undefined): SlideTemplate | null {
  if (!name) return null;
  return SLIDE_TEMPLATES[name] ?? null;
}

export function listTemplateNames(): string[] {
  return Object.keys(SLIDE_TEMPLATES);
}
