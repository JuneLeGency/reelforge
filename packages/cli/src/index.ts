import { defineCommand } from 'citty';
import { renderCommand } from './commands/render';
import { ttsCommand } from './commands/tts';

export const main = defineCommand({
  meta: {
    name: 'reelforge',
    version: '0.0.0',
    description: 'Programmatic forge for reels — universal video generation framework',
  },
  subCommands: {
    render: renderCommand,
    tts: ttsCommand,
  },
});

export { renderCommand, ttsCommand };
export { resolveChrome, CHROME_PATHS } from './util/chrome';
