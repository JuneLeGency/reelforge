import { defineCommand } from 'citty';
import { initCommand } from './commands/init';
import { previewCommand } from './commands/preview';
import { renderCommand } from './commands/render';
import { ttsCommand } from './commands/tts';

export const main = defineCommand({
  meta: {
    name: 'reelforge',
    version: '0.0.0',
    description: 'Programmatic forge for reels — universal video generation framework',
  },
  subCommands: {
    init: initCommand,
    preview: previewCommand,
    render: renderCommand,
    tts: ttsCommand,
  },
});

export { initCommand, previewCommand, renderCommand, ttsCommand };
export { scaffoldHello, ScaffoldError } from './commands/init';
export {
  HOT_RELOAD_SNIPPET,
  MIME_TYPES,
  injectHotReload,
  mimeFor,
  resolveServePath,
} from './commands/preview';
export { resolveChrome, CHROME_PATHS } from './util/chrome';
