import { watch } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve as resolvePath } from 'node:path';
import { defineCommand } from 'citty';

export const HOT_RELOAD_SNIPPET = `
<script>
(function () {
  var loc = window.location;
  var proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  var wsUrl = proto + '//' + loc.host + '/__reelforge_ws';
  var retryMs = 500;
  function connect() {
    var ws;
    try { ws = new WebSocket(wsUrl); } catch (e) { setTimeout(connect, retryMs); return; }
    ws.onmessage = function (e) { if (e.data === 'reload') location.reload(); };
    ws.onclose = function () { setTimeout(connect, retryMs); };
  }
  connect();
})();
</script>`;

export const MIME_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
};

export function injectHotReload(html: string, snippet: string = HOT_RELOAD_SNIPPET): string {
  if (html.includes('</body>')) {
    return html.replace('</body>', `${snippet}\n</body>`);
  }
  return html + snippet;
}

/**
 * Decide which file to serve for a given request pathname.
 * Returns `null` if the path escapes `baseDir` (path traversal guard).
 *
 * - `/` or `/index.html` → map to `htmlPath` (and should have hot-reload injected).
 * - Other paths are resolved relative to `baseDir`.
 */
export function resolveServePath(
  pathname: string,
  baseDir: string,
  htmlPath: string,
): { path: string; injectReload: boolean } | null {
  const decoded = decodeURIComponent(pathname);

  if (decoded === '/' || decoded === '/index.html') {
    return { path: htmlPath, injectReload: true };
  }

  const relative = decoded.replace(/^\/+/, '');
  const resolved = resolvePath(baseDir, relative);
  const baseWithSep = baseDir.endsWith('/') ? baseDir : `${baseDir}/`;
  if (resolved !== baseDir && !resolved.startsWith(baseWithSep)) {
    return null;
  }

  return {
    path: resolved,
    injectReload: resolved === htmlPath,
  };
}

export function mimeFor(path: string): string {
  return MIME_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream';
}

interface PreviewHandle {
  port: number;
  stop(): void;
}

interface WebSocketLike {
  send(data: string): void;
}

async function startPreviewServer(opts: {
  htmlPath: string;
  baseDir: string;
  port: number;
}): Promise<PreviewHandle> {
  const { htmlPath, baseDir, port } = opts;
  const connections = new Set<WebSocketLike>();

  const bunModule = (await import('bun')) as {
    serve: (cfg: unknown) => { port: number; stop: () => void };
  };

  const server = bunModule.serve({
    port,
    async fetch(req: Request, srv: { upgrade: (r: Request) => boolean }) {
      const url = new URL(req.url);
      if (url.pathname === '/__reelforge_ws') {
        return srv.upgrade(req) ? undefined : new Response('Upgrade failed', { status: 400 });
      }
      const resolved = resolveServePath(url.pathname, baseDir, htmlPath);
      if (!resolved) return new Response('Not Found', { status: 404 });
      try {
        const buf = await readFile(resolved.path);
        if (resolved.injectReload) {
          const html = buf.toString('utf8');
          return new Response(injectHotReload(html), {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        }
        return new Response(new Uint8Array(buf), {
          headers: { 'Content-Type': mimeFor(resolved.path) },
        });
      } catch {
        return new Response('Not Found', { status: 404 });
      }
    },
    websocket: {
      open(ws: WebSocketLike) {
        connections.add(ws);
      },
      close(ws: WebSocketLike) {
        connections.delete(ws);
      },
      message() {
        /* ignore client messages */
      },
    },
  });

  const watcher = watch(baseDir, { recursive: true }, () => {
    for (const ws of connections) {
      try {
        ws.send('reload');
      } catch {
        /* ignore */
      }
    }
  });

  return {
    port: server.port,
    stop() {
      watcher.close();
      server.stop();
    },
  };
}

export const previewCommand = defineCommand({
  meta: {
    name: 'preview',
    description: 'Live-reloading HTML preview server',
  },
  args: {
    input: {
      type: 'positional',
      description: 'HTML file',
      required: true,
    },
    port: {
      type: 'string',
      alias: 'p',
      description: 'Port',
      default: '3000',
    },
  },
  async run({ args }) {
    const htmlPath = resolvePath(args.input);
    const baseDir = dirname(htmlPath);
    const port = Number.parseInt(args.port, 10);
    if (Number.isNaN(port) || port <= 0 || port > 65535) {
      console.error(`Invalid port: ${args.port}`);
      process.exit(2);
    }

    const handle = await startPreviewServer({ htmlPath, baseDir, port });

    console.error(`🚀 Preview: http://localhost:${handle.port}/`);
    console.error(`   Watching: ${baseDir}`);
    console.error(`   Press Ctrl+C to stop.`);

    const shutdown = () => {
      handle.stop();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  },
});
