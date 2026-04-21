import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve as resolvePath } from 'node:path';
import JSON5 from 'json5';
import type { HtmlCompilationResult } from '@reelforge/html';
import { compileHtml } from '@reelforge/html';
import { buildDslHtml } from './html';
import { parseDsl } from './schema';

export interface CompileDslOptions {
  baseDir: string;
  /** If set, the generated HTML is written to this absolute path. */
  outputHtmlPath?: string;
}

export interface CompileDslResult extends HtmlCompilationResult {
  /** The generated HTML string (always populated, even when not written). */
  html: string;
  /** Total duration of the compiled composition, in milliseconds. */
  totalDurationMs: number;
}

/**
 * Compile a DSL config object into HTML → IR.
 * @param raw  Parsed JSON/JSON5 object (already JS; call compileDslFile if you have a file path).
 */
export function compileDsl(raw: unknown, opts: CompileDslOptions): CompileDslResult {
  const project = parseDsl(raw);
  const { html, totalDurationMs } = buildDslHtml(project);
  const compiled = compileHtml(html, {
    baseDir: opts.baseDir,
    ...(opts.outputHtmlPath ? { htmlPath: opts.outputHtmlPath } : {}),
  });
  return {
    ...compiled,
    html,
    totalDurationMs,
  };
}

/**
 * Read a JSON/JSON5 DSL file, compile it, and write the generated HTML
 * to disk (default: `<configDir>/__reelforge-dsl-<basename>.html`).
 */
export async function compileDslFile(
  configPath: string,
  opts?: { outputHtmlPath?: string },
): Promise<CompileDslResult> {
  const abs = resolvePath(configPath);
  const raw = JSON5.parse(await readFile(abs, 'utf8'));
  const baseDir = dirname(abs);
  const outputHtmlPath =
    opts?.outputHtmlPath ??
    join(baseDir, `__reelforge-dsl-${basenameWithoutExt(abs)}.html`);

  const result = compileDsl(raw, { baseDir, outputHtmlPath });
  await mkdir(dirname(outputHtmlPath), { recursive: true });
  await writeFile(outputHtmlPath, result.html, 'utf8');
  return { ...result, htmlPath: outputHtmlPath };
}

function basenameWithoutExt(path: string): string {
  const last = path.split('/').pop() ?? path;
  const dot = last.lastIndexOf('.');
  return dot === -1 ? last : last.slice(0, dot);
}
