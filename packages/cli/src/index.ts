import { defineCommand } from 'citty';
import { captionsCommand } from './commands/captions';
import { composeCommand } from './commands/compose';
import { generateCommand } from './commands/generate';
import { initCommand } from './commands/init';
import { mcpCommand } from './commands/mcp';
import { previewCommand } from './commands/preview';
import { renderCommand } from './commands/render';
import { sttCommand } from './commands/stt';
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
    stt: sttCommand,
    captions: captionsCommand,
    generate: generateCommand,
    compose: composeCommand,
    mcp: mcpCommand,
  },
});

export {
  captionsCommand,
  composeCommand,
  generateCommand,
  initCommand,
  mcpCommand,
  previewCommand,
  renderCommand,
  sttCommand,
  ttsCommand,
};
export {
  buildGenerateHtml,
  assignSlides,
  sentenceCaptions,
  splitSentences,
  parseGenerateConfig,
  GenerateConfigError,
} from './commands/generate';
export {
  parseComposeConfig,
  buildConcatList,
  ComposeConfigError,
} from './commands/compose';
export { scaffoldHello, ScaffoldError } from './commands/init';
export {
  HOT_RELOAD_SNIPPET,
  MIME_TYPES,
  injectHotReload,
  mimeFor,
  resolveServePath,
} from './commands/preview';
export { resolveChrome, CHROME_PATHS } from './util/chrome';
