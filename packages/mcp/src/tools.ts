/**
 * Tool implementations for the Reelforge MCP server. Each exported function
 * is pure with respect to its input arguments (reads files, returns JSON or
 * throws). They're framework-agnostic so the MCP binding in `./server.ts`
 * stays a thin transport layer.
 */
import { readFile } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';
import JSON5 from 'json5';
import { compileDsl, compileDslFile } from '@reelforge/dsl';
import { compileHtmlFile } from '@reelforge/html';
import type { VideoProject } from '@reelforge/ir';
import { planDuration } from '@reelforge/ir';

export interface CompileHtmlArgs {
  path: string;
}
export interface CompileDslArgs {
  path: string;
}
export interface CompileDslInlineArgs {
  json5: string;
  /** Base directory for asset-path resolution. Defaults to cwd. */
  baseDir?: string;
}
export interface PlanDurationArgs {
  project: VideoProject;
}

export interface CompileResult {
  project: VideoProject;
  durationMs: number;
}

export async function rfCompileHtml(args: CompileHtmlArgs): Promise<CompileResult> {
  assertNonEmptyString(args.path, 'path');
  const result = await compileHtmlFile(resolvePath(args.path));
  return {
    project: result.project,
    durationMs: planDuration(result.project),
  };
}

export async function rfCompileDsl(args: CompileDslArgs): Promise<CompileResult> {
  assertNonEmptyString(args.path, 'path');
  const result = await compileDslFile(resolvePath(args.path));
  return {
    project: result.project,
    durationMs: result.totalDurationMs,
  };
}

export async function rfCompileDslInline(args: CompileDslInlineArgs): Promise<CompileResult> {
  assertNonEmptyString(args.json5, 'json5');
  const raw = JSON5.parse(args.json5);
  const baseDir = args.baseDir ? resolvePath(args.baseDir) : process.cwd();
  const result = compileDsl(raw, { baseDir });
  return {
    project: result.project,
    durationMs: result.totalDurationMs,
  };
}

export function rfPlanDuration(args: PlanDurationArgs): { durationMs: number } {
  if (!args || typeof args !== 'object' || args.project == null) {
    throw new Error('plan_duration requires { project: VideoProject }');
  }
  return { durationMs: planDuration(args.project) };
}

export async function readFileTool(path: string): Promise<string> {
  return readFile(resolvePath(path), 'utf8');
}

function assertNonEmptyString(v: unknown, name: string): void {
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
}
