# @reelforge/mux

Mix IR audio clips into a silent video via `ffmpeg`. MVP scope:

- Reads `project.timeline` — for each clip on an `audio` track whose asset is `AudioAsset`, produces a filter chain:

  ```
  [N:a]atrim=start=SS:duration=D,
       asetpts=PTS-STARTPTS,
       adelay=OFFSET|OFFSET,
       volume=V[aN]
  ```

- Mixes all of them with `amix=inputs=...:normalize=0`.
- Maps the mix onto the silent video with `-c:v copy -c:a aac`.
- If there are no audio clips, the video is stream-copied unchanged.

Not yet supported (pushed to post-M1): ducking, side-chain compression, video-clip embedded audio, remote/S3 assets (only `file://` and `http(s)://` work today).

## API

```ts
import { muxAudio, buildMuxArgs } from '@reelforge/mux';

await muxAudio({
  silentVideoPath: 'out/silent.mp4',
  outputPath: 'out/final.mp4',
  project,                 // VideoProject from any frontend
  baseDir: '.',            // resolves file:// asset sources
});
```
