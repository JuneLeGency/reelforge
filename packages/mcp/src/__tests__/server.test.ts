import { describe, expect, test } from 'bun:test';
import { SERVER_INFO, TOOLS } from '../server';

describe('TOOLS advertisement', () => {
  test('exposes the four MVP tools', () => {
    const names = TOOLS.map((t) => t.name);
    expect(names).toEqual([
      'rf_compile_html',
      'rf_compile_dsl',
      'rf_compile_dsl_inline',
      'rf_plan_duration',
    ]);
  });

  test('every tool has a description and a valid JSON-schema-ish inputSchema', () => {
    for (const tool of TOOLS) {
      expect(tool.description).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties).toBeDefined();
      expect(Array.isArray(tool.inputSchema.required)).toBe(true);
    }
  });

  test('compile_html requires path', () => {
    const tool = TOOLS.find((t) => t.name === 'rf_compile_html')!;
    expect(tool.inputSchema.required).toContain('path');
  });

  test('compile_dsl_inline requires json5 but baseDir is optional', () => {
    const tool = TOOLS.find((t) => t.name === 'rf_compile_dsl_inline')!;
    expect(tool.inputSchema.required).toContain('json5');
    expect(tool.inputSchema.required).not.toContain('baseDir');
  });
});

describe('SERVER_INFO', () => {
  test('names the package correctly', () => {
    expect(SERVER_INFO.name).toBe('@reelforge/mcp');
  });
});
