import { existsSync } from 'node:fs';
import { platform } from 'node:os';

export const CHROME_PATHS: Readonly<Record<string, readonly string[]>> = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
};

export interface ResolveChromeOptions {
  platformOverride?: string | undefined;
  exists?: ((path: string) => boolean) | undefined;
  /** Environment variable (e.g. CHROME_PATH) to check first. */
  envValue?: string | undefined;
}

export function resolveChrome(opts: ResolveChromeOptions = {}): string | null {
  const exists = opts.exists ?? existsSync;
  if (opts.envValue && exists(opts.envValue)) return opts.envValue;
  const os = opts.platformOverride ?? platform();
  const candidates = CHROME_PATHS[os] ?? [];
  for (const p of candidates) {
    if (exists(p)) return p;
  }
  return null;
}
