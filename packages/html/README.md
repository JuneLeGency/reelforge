# @reelforge/html

**HTML frontend** — compile HTML compositions into the `VideoProject` IR.

## How a composition is declared

Put timing on any element with `data-start` + `data-duration` (in seconds). Media tags (`<img>`, `<video>`, `<audio>`) become IR `Asset`s automatically.

```html
<html data-rf-width="1920" data-rf-height="1080" data-rf-fps="30">
  <body>
    <img src="./hero.jpg" data-start="0" data-duration="5" data-fit="cover">
    <video src="./product.mp4" data-start="5" data-duration="8" data-source-start="2"></video>
    <audio src="./narration.mp3" data-start="0" data-duration="13" data-volume="1"></audio>
  </body>
</html>
```

## Supported attributes

| Attribute | Type | Maps to |
|---|---|---|
| `data-rf-width` / `data-rf-height` / `data-rf-fps` (on `<html>`) | number | `config.*` |
| `data-start` | seconds | `clip.startMs` |
| `data-duration` | seconds | `clip.durationMs` |
| `data-source-start` | seconds | `clip.sourceStartMs` |
| `data-z` | integer | `clip.z` |
| `data-volume` | 0..1 | `clip.volume` |
| `data-fit` | cover/contain/fill | `clip.fit` |
| `data-effect` | id or comma-list | `clip.effects` |
| `data-id` | string | `clip.id` (default is auto-generated) |
| `data-has-audio` on `<video>` | boolean | `asset.hasAudio` |

## API

```ts
import { compileHtml, compileHtmlFile } from '@reelforge/html';

const { project, htmlPath, baseDir } = compileHtml(source, { baseDir: '.' });
const resultFromDisk = await compileHtmlFile('./my-video.html');
```

## Non-media elements

MVP scope: only `<img>`, `<video>`, `<audio>` elements with `data-start`+`data-duration` are compiled into IR clips. Other elements (titles, animated divs, etc.) remain in the HTML file and are rendered natively by the Chrome backend. The IR describes just the media time-line; the full visual scene lives in the HTML.
