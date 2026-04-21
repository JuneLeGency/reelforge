export interface AudioInput {
  filePath: string;
  /** Timeline offset in ms (where the clip begins on the output). */
  startMs: number;
  /** Clip length in ms. */
  durationMs: number;
  /** Trim start within the source media, in ms. */
  sourceStartMs: number;
  /** Linear gain, 0..N (1 = unity). */
  volume: number;
}

export interface BuildMuxArgsOptions {
  silentVideoPath: string;
  audioInputs: readonly AudioInput[];
  outputPath: string;
  /** AAC bitrate, e.g. '192k'. */
  audioBitrate?: string;
}

export function buildMuxArgs(opts: BuildMuxArgsOptions): string[] {
  const { silentVideoPath, audioInputs, outputPath } = opts;
  const audioBitrate = opts.audioBitrate ?? '192k';

  const args: string[] = [
    '-y',
    '-hide_banner',
    '-loglevel',
    'warning',
    '-i',
    silentVideoPath,
  ];

  for (const a of audioInputs) {
    args.push('-i', a.filePath);
  }

  const filterParts: string[] = [];
  audioInputs.forEach((a, i) => {
    const inputIdx = i + 1;
    const ss = toSeconds(a.sourceStartMs);
    const d = toSeconds(a.durationMs);
    const delay = Math.max(0, Math.round(a.startMs));
    const vol = a.volume.toFixed(3);
    filterParts.push(
      `[${inputIdx}:a]atrim=start=${ss}:duration=${d},` +
        `asetpts=PTS-STARTPTS,adelay=${delay}|${delay},volume=${vol}[a${i}]`,
    );
  });

  const mixLabels = audioInputs.map((_, i) => `[a${i}]`).join('');
  filterParts.push(
    `${mixLabels}amix=inputs=${audioInputs.length}:normalize=0[aout]`,
  );

  args.push('-filter_complex', filterParts.join(';'));
  args.push('-map', '0:v', '-map', '[aout]');
  args.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', audioBitrate);
  args.push('-shortest');
  args.push(outputPath);
  return args;
}

export function buildCopyArgs(
  inputPath: string,
  outputPath: string,
): string[] {
  return [
    '-y',
    '-hide_banner',
    '-loglevel',
    'warning',
    '-i',
    inputPath,
    '-c',
    'copy',
    outputPath,
  ];
}

function toSeconds(ms: number): string {
  return (Math.max(0, ms) / 1000).toFixed(3);
}
