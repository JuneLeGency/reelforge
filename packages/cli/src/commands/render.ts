import { unlink } from 'node:fs/promises';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { defineCommand } from 'citty';
import { compileHtmlFile } from '@reelforge/html';
import { renderChrome } from '@reelforge/engine-chrome';
import { muxAudio } from '@reelforge/mux';
import { resolveChrome } from '../util/chrome';

export const renderCommand = defineCommand({
  meta: {
    name: 'render',
    description: 'Render an HTML composition to MP4',
  },
  args: {
    input: {
      type: 'positional',
      description: 'HTML composition file',
      required: true,
    },
    output: {
      type: 'string',
      alias: 'o',
      description: 'Output MP4 path',
      default: 'out/video.mp4',
    },
    chrome: {
      type: 'string',
      description: 'Chrome/Chromium executable path (default: auto-detect)',
    },
    ffmpeg: {
      type: 'string',
      description: 'ffmpeg binary',
      default: 'ffmpeg',
    },
    keepSilent: {
      type: 'boolean',
      description: 'Keep the intermediate silent MP4',
      default: false,
    },
  },
  async run({ args }) {
    const chromePath =
      args.chrome ?? resolveChrome({ envValue: process.env.CHROME_PATH });
    if (!chromePath) {
      console.error(
        'Could not find Chrome/Chromium. Install it or pass --chrome <path>.',
      );
      process.exit(2);
    }

    const outputPath = resolvePath(args.output);
    const silentPath = join(dirname(outputPath), `__silent_${Date.now()}.mp4`);

    console.error(`→ compiling ${args.input}`);
    const compiled = await compileHtmlFile(args.input);
    if (!compiled.htmlPath) {
      console.error('compileHtmlFile did not return an htmlPath');
      process.exit(3);
    }

    console.error(
      `→ rendering ${compiled.project.config.width}x${compiled.project.config.height} @ ${compiled.project.config.fps}fps`,
    );
    const progressEvery = Math.max(1, Math.floor(compiled.project.config.fps));
    await renderChrome({
      project: compiled.project,
      htmlPath: compiled.htmlPath,
      outputPath: silentPath,
      executablePath: chromePath,
      ffmpegBinary: args.ffmpeg,
      onProgress: ({ frame, total }) => {
        if (frame % progressEvery === 0 || frame === total) {
          process.stderr.write(`\r  frame ${frame}/${total}`);
        }
      },
    });
    process.stderr.write('\n');

    console.error(`→ muxing audio`);
    const { audioClipCount } = await muxAudio({
      silentVideoPath: silentPath,
      outputPath,
      project: compiled.project,
      baseDir: compiled.baseDir,
      ffmpegBinary: args.ffmpeg,
    });

    if (!args.keepSilent) {
      await unlink(silentPath).catch(() => undefined);
    }

    console.error(
      `✓ ${outputPath} (${audioClipCount} audio clip${audioClipCount === 1 ? '' : 's'})`,
    );
  },
});
