import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve as resolvePath, basename } from 'node:path';
import { defineCommand } from 'citty';
import { HELLO_HTML, HELLO_README, renderTemplate } from '../templates/hello';

export interface ScaffoldOptions {
  targetDir: string;
  name: string;
  force: boolean;
  writeFile?: (path: string, contents: string) => Promise<void>;
  mkdir?: (path: string) => Promise<void>;
  exists?: (path: string) => boolean;
}

export interface ScaffoldResult {
  targetDir: string;
  files: string[];
}

/**
 * Write the hello template into `targetDir`. Exposed without citty so it can
 * be unit-tested with a fake fs.
 */
export async function scaffoldHello(opts: ScaffoldOptions): Promise<ScaffoldResult> {
  const exists = opts.exists ?? existsSync;
  const doMkdir = opts.mkdir ?? (async (p: string) => {
    await mkdir(p, { recursive: true });
  });
  const doWrite = opts.writeFile ?? (async (p: string, c: string) => {
    await writeFile(p, c);
  });

  if (exists(opts.targetDir) && !opts.force) {
    throw new ScaffoldError(
      `"${opts.targetDir}" already exists. Pass --force to overwrite.`,
    );
  }

  await doMkdir(opts.targetDir);

  const titleVar = toTitleCase(opts.name);
  const html = renderTemplate(HELLO_HTML, { TITLE: titleVar });
  const readme = renderTemplate(HELLO_README, { NAME: opts.name });

  const htmlPath = `${opts.targetDir}/index.html`;
  const readmePath = `${opts.targetDir}/README.md`;
  await doWrite(htmlPath, html);
  await doWrite(readmePath, readme);

  return { targetDir: opts.targetDir, files: [htmlPath, readmePath] };
}

export class ScaffoldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScaffoldError';
  }
}

function toTitleCase(raw: string): string {
  return raw
    .split(/[-_\s]+/)
    .filter((s) => s !== '')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

export const initCommand = defineCommand({
  meta: {
    name: 'init',
    description: 'Scaffold a new Reelforge video project directory',
  },
  args: {
    name: {
      type: 'positional',
      description: 'Directory to create (also used as the project name)',
      required: true,
    },
    force: {
      type: 'boolean',
      description: 'Overwrite if the directory already exists',
      default: false,
    },
  },
  async run({ args }) {
    const targetDir = resolvePath(args.name);
    const projectName = basename(targetDir);

    try {
      const result = await scaffoldHello({
        targetDir,
        name: projectName,
        force: args.force,
      });
      console.error(`✓ Scaffolded ${targetDir}`);
      for (const file of result.files) {
        console.error(`  · ${file}`);
      }
      console.error(`\nNext:`);
      console.error(`  reelforge render ${args.name}/index.html -o ${args.name}/out.mp4`);
      console.error(`  open ${args.name}/out.mp4`);
    } catch (e) {
      if (e instanceof ScaffoldError) {
        console.error(e.message);
        process.exit(1);
      }
      throw e;
    }
  },
});
