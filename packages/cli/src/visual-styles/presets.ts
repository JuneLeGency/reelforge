import type { VisualStyle } from './types';

/**
 * Six curated visual styles. Each is a quiet, coherent choice — not a
 * "flashy unique look". The goal is to let agents reach for a style by
 * name (`style: "swiss-pulse"`) and get a consistent-looking video.
 *
 * Inspired by Hyperframes' `visual-styles.md` presets; colours and
 * typography are all original (no direct copy) but the structure —
 * "style pack = background + palette + ink colours + fonts" — is the
 * same bottom-up idea.
 */

const SANS_CJK =
  '-apple-system, "PingFang SC", "Heiti SC", "Microsoft YaHei", "Segoe UI", Roboto, sans-serif';
const SERIF_CJK =
  'ui-serif, "Songti SC", "Source Han Serif SC", "Noto Serif CJK SC", Georgia, serif';
const MONO =
  'ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, "Courier New", monospace';

export const VISUAL_STYLES: Readonly<Record<string, VisualStyle>> = {
  'swiss-pulse': {
    name: 'swiss-pulse',
    description:
      'High-contrast, precision grid. Bold sans-serif, black/white/accent-red. Editorial rhythm.',
    background: '#000000',
    palette: ['#ffffff', '#ff2d2d', '#f5f5f5', '#1a1a1a', '#ffe600'],
    color: '#ffffff',
    colorMuted: 'rgba(255,255,255,0.72)',
    fontFamilyHeading: `"Helvetica Neue", "Helvetica", ${SANS_CJK}`,
    fontFamilyBody: SANS_CJK,
    extraCss: `
      .slide .title { letter-spacing: -3px; }
      .slide .subtitle { text-transform: uppercase; letter-spacing: 4px; font-weight: 600; font-size: 28px !important; }
      .slide .accent-rule { background: #ff2d2d !important; height: 6px !important; }
    `,
  },

  'dark-premium': {
    name: 'dark-premium',
    description:
      'Deep midnight gradient, soft glow, generous spacing. Quiet luxury. Good for product reveals.',
    background:
      'radial-gradient(ellipse at 20% 10%, #1e2a4a 0%, #0a0a18 55%, #06060c 100%)',
    palette: ['#c6a969', '#eae0c3', '#8b93a8', '#1a1f36', '#0a0a18'],
    color: '#f2e8c8',
    colorMuted: 'rgba(234, 224, 195, 0.68)',
    fontFamilyHeading: `"Inter", "SF Pro Display", ${SANS_CJK}`,
    fontFamilyBody: SANS_CJK,
    extraCss: `
      .slide .title { font-weight: 300 !important; letter-spacing: 1px; color: #eae0c3 !important; }
      .slide .subtitle { color: rgba(234,224,195,0.72) !important; letter-spacing: 2px; }
      .slide .accent-rule { background: linear-gradient(90deg, #c6a969, transparent) !important; }
    `,
  },

  'neon-electric': {
    name: 'neon-electric',
    description:
      'Cyberpunk gradient, neon glow on titles, magenta/cyan accents. Short-form, high energy.',
    background: 'linear-gradient(135deg, #1a0033 0%, #05002a 60%, #000014 100%)',
    palette: ['#ff2a6d', '#05d9e8', '#d1f7ff', '#7209b7', '#0a0a18'],
    color: '#d1f7ff',
    colorMuted: 'rgba(209, 247, 255, 0.7)',
    fontFamilyHeading: `"Inter", ${SANS_CJK}`,
    fontFamilyBody: SANS_CJK,
    extraCss: `
      .slide .title {
        background: linear-gradient(135deg, #ff2a6d 0%, #05d9e8 100%);
        -webkit-background-clip: text; background-clip: text;
        -webkit-text-fill-color: transparent;
        text-shadow: 0 0 40px rgba(255, 42, 109, 0.5);
      }
      .slide .subtitle { color: #05d9e8 !important; text-shadow: 0 0 20px rgba(5, 217, 232, 0.4); }
      .slide .accent-rule { background: #ff2a6d !important; box-shadow: 0 0 16px #ff2a6d; }
    `,
  },

  'warm-editorial': {
    name: 'warm-editorial',
    description:
      'Off-white paper, warm orange accent, serif headlines. Magazine / essay aesthetic.',
    background: '#faf5ea',
    palette: ['#1a1a1a', '#d65a31', '#8b7355', '#f1e6d2', '#faf5ea'],
    color: '#1a1a1a',
    colorMuted: 'rgba(26, 26, 26, 0.64)',
    fontFamilyHeading: SERIF_CJK,
    fontFamilyBody: SANS_CJK,
    extraCss: `
      .slide .title { font-weight: 700 !important; letter-spacing: -1px; }
      .slide .subtitle { font-style: italic; color: #8b7355 !important; }
      .slide .accent-rule { background: #d65a31 !important; }
      .slide .scene-index, .slide .watermark { color: rgba(26,26,26,0.45) !important; }
    `,
  },

  'mint-fresh': {
    name: 'mint-fresh',
    description:
      'Light mint + charcoal ink, rounded feel, generous air. Tech product explainer.',
    background: 'linear-gradient(135deg, #a8e6cf 0%, #7bcec0 100%)',
    palette: ['#1a3a36', '#2d5a52', '#a8e6cf', '#fefae0', '#f9a826'],
    color: '#1a3a36',
    colorMuted: 'rgba(26, 58, 54, 0.65)',
    fontFamilyHeading: `"Inter", ${SANS_CJK}`,
    fontFamilyBody: SANS_CJK,
    extraCss: `
      .slide .title { color: #1a3a36 !important; letter-spacing: -1px; }
      .slide .subtitle { color: rgba(26,58,54,0.72) !important; }
      .slide .accent-rule { background: #f9a826 !important; }
      .slide .scene-index, .slide .watermark { color: rgba(26,58,54,0.55) !important; }
    `,
  },

  'terminal-green': {
    name: 'terminal-green',
    description:
      'Pitch-black background, phosphor green mono type, scanline feel. Dev / hacker demos.',
    background: '#000000',
    palette: ['#00ff41', '#00cc33', '#00561c', '#1a1a1a', '#ffffff'],
    color: '#00ff41',
    colorMuted: 'rgba(0, 255, 65, 0.55)',
    fontFamilyHeading: MONO,
    fontFamilyBody: MONO,
    extraCss: `
      .slide .title { font-family: ${MONO} !important; letter-spacing: 2px; text-shadow: 0 0 8px #00ff41; }
      .slide .subtitle { font-family: ${MONO} !important; color: rgba(0,255,65,0.7) !important; }
      .slide .accent-rule { background: #00ff41 !important; box-shadow: 0 0 10px #00ff41; }
      #stage::before {
        content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 50;
        background: repeating-linear-gradient(0deg, rgba(0,255,65,0.03), rgba(0,255,65,0.03) 2px, transparent 2px, transparent 4px);
      }
    `,
  },
};

export function resolveVisualStyle(name: string | undefined): VisualStyle | null {
  if (!name) return null;
  return VISUAL_STYLES[name] ?? null;
}

export function listVisualStyleNames(): string[] {
  return Object.keys(VISUAL_STYLES);
}
