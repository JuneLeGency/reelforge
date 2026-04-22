/**
 * Build the argv for a single-shot whisper.cpp transcription run.
 *
 * Flags used:
 * - `-m <model>`           — path to ggml model file (ggml-base.en.bin etc.)
 * - `-f <wav>`             — input (16kHz mono s16 wav)
 * - `-oj`                  — emit JSON output (contains word timings when
 *                            combined with `-ml 1` or newer whisper.cpp
 *                            builds that default to per-token timings)
 * - `-of <prefix>`         — output-file prefix; whisper writes
 *                            `<prefix>.json`
 * - `-ml 1`                — max-length 1 token per segment → ensures per-word
 *                            granularity across all whisper.cpp versions
 * - optional: `-l <lang>`  — force language, empty means auto-detect
 * - optional: `-nt`        — suppress non-timing output
 *
 * The JSON sidecar is read back with `parseWhisperJson`.
 */
export interface WhisperRunOptions {
  modelPath: string;
  wavPath: string;
  outputPrefix: string;
  language?: string | undefined;
  /** Extra flags appended verbatim. */
  extraArgs?: readonly string[];
}

export function buildWhisperArgs(opts: WhisperRunOptions): string[] {
  const args = [
    '-m',
    opts.modelPath,
    '-f',
    opts.wavPath,
    '-oj',
    '-of',
    opts.outputPrefix,
    '-ml',
    '1',
  ];
  if (opts.language && opts.language !== '') {
    args.push('-l', opts.language);
  }
  if (opts.extraArgs) {
    args.push(...opts.extraArgs);
  }
  return args;
}
