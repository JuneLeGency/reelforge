export const HELLO_HTML = `<!DOCTYPE html>
<html data-rf-width="1280" data-rf-height="720" data-rf-fps="30">
<head>
  <meta charset="utf-8">
  <title>{{TITLE}}</title>
  <style>
    html, body { margin: 0; padding: 0; background: #111; overflow: hidden; font-family: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif; }
    #stage { position: relative; width: 100vw; height: 100vh; }
    #bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    #title { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; text-align: center; }
    #title h1 { font-size: 96px; font-weight: 800; margin: 0; letter-spacing: -0.02em; text-shadow: 0 6px 32px rgba(0,0,0,0.35); opacity: 0; }
    #title p { font-size: 28px; margin-top: 16px; opacity: 0; color: rgba(255,255,255,0.85); }
  </style>
</head>
<body>
  <div id="stage">
    <img
      id="bg"
      data-start="0"
      data-duration="3"
      data-fit="cover"
      src='data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%2300cdac"/><stop offset="100%" stop-color="%2302aab0"/></linearGradient></defs><rect width="100%" height="100%" fill="url(%23g)"/></svg>'
    >
    <div id="title">
      <h1>{{TITLE}}</h1>
      <p>Built with Reelforge</p>
    </div>
  </div>
  <script>
    (function () {
      var h1 = document.querySelector('#title h1');
      var p = document.querySelector('#title p');
      h1.animate(
        [
          { opacity: 0, transform: 'translateY(24px) scale(0.96)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' }
        ],
        { duration: 900, delay: 200, fill: 'both', easing: 'cubic-bezier(.2,.7,0,1)' }
      );
      p.animate(
        [
          { opacity: 0, transform: 'translateY(16px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ],
        { duration: 900, delay: 600, fill: 'both', easing: 'cubic-bezier(.2,.7,0,1)' }
      );
    })();
  </script>
</body>
</html>
`;

export const HELLO_README = `# {{NAME}}

A Reelforge video project scaffolded by \`reelforge init\`.

## Render

\`\`\`bash
reelforge render ./index.html -o out.mp4
open out.mp4
\`\`\`

## Edit

- Open \`index.html\` in any editor.
- Use \`reelforge preview ./index.html\` to live-reload while editing (no full render).
- Media: add \`<img data-start data-duration>\`, \`<video data-start data-duration>\`, or \`<audio data-start data-duration>\`. Any other DOM animation via WAAPI or GSAP will be auto-seeked per frame.

## Narration (optional)

\`\`\`bash
export ELEVENLABS_API_KEY=...
reelforge tts "Your script here" --voice <voice-id> -o narration.mp3 --srt narration.srt
# then add <audio src="./narration.mp3" data-start="0" data-duration="<seconds>"></audio> to index.html
\`\`\`
`;

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => vars[key] ?? match);
}
