#!/usr/bin/env python3
"""
Stitch the per-sentence .wav files into one narration track with
configurable silence padding between sentences, and emit the SRT
timings file rf generate consumes (one entry per sentence; each
sentence ends with 。 so splitSentences() treats each SRT entry as
one sentence = one slide).

Run after synth.py. Produces:
  - narration.wav
  - narration.srt
  - timings.json (convenience: {slide_starts_ms: [...]} for the config)

Run from repo root:
  python3 examples/showcase-demo/stitch.py
"""

import json
import os
import struct
import sys
import wave

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIO_DIR = os.path.join(HERE, "audio")
SILENCE_MS = 600  # breathing room between sentences
# Cross-fade overlap — extend each slide's endMs this much past the
# next slide's startMs so the 400 ms template fade-out overlaps the
# next slide's fade-in. Without this there's a ~400 ms black gap
# between adjacent slides.
OVERLAP_MS = 500


def read_wav(path: str):
    with wave.open(path, "rb") as w:
        params = w.getparams()
        frames = w.readframes(w.getnframes())
        return params, frames


def write_wav(path: str, params, frames: bytes) -> None:
    with wave.open(path, "wb") as w:
        w.setparams(params)
        w.writeframes(frames)


def silence_frames(params, ms: int) -> bytes:
    samples = int(params.framerate * ms / 1000) * params.nchannels
    # 16-bit little-endian zero samples.
    return b"\x00" * (samples * params.sampwidth)


def fmt_srt_time(ms: int) -> str:
    h = ms // 3_600_000
    m = (ms // 60_000) % 60
    s = (ms // 1000) % 60
    ms_part = ms % 1000
    return f"{h:02d}:{m:02d}:{s:02d},{ms_part:03d}"


def main() -> int:
    with open(os.path.join(AUDIO_DIR, "durations.json"), "r") as f:
        meta = json.load(f)
    lines = meta["lines"]

    first_params = None
    combined = bytearray()
    # slide start times (cumulative), in ms
    starts_ms = []
    ends_ms = []
    cursor_ms = 0

    for i, _line in enumerate(lines, 1):
        wav_path = os.path.join(AUDIO_DIR, f"s{i:02d}.wav")
        params, frames = read_wav(wav_path)
        if first_params is None:
            first_params = params
        else:
            assert params.framerate == first_params.framerate, "sample-rate mismatch"
            assert params.nchannels == first_params.nchannels, "channel mismatch"
            assert params.sampwidth == first_params.sampwidth, "bit-depth mismatch"

        start_ms = cursor_ms
        # Duration from actual audio length (not the reported duration_seconds
        # — eliminates any rounding error).
        dur_ms = int(
            round(len(frames) / (params.framerate * params.nchannels * params.sampwidth) * 1000)
        )
        starts_ms.append(start_ms)
        ends_ms.append(start_ms + dur_ms)

        combined += frames
        cursor_ms += dur_ms

        if i < len(lines):
            combined += silence_frames(first_params, SILENCE_MS)
            cursor_ms += SILENCE_MS

    # Extend each slide's endMs past the next slide's startMs so the
    # fade-out and next slide's fade-in overlap. Without overlap each
    # cross-fade leaves a ~400 ms black gap. Last slide keeps its real
    # endMs (no next slide to overlap with).
    for i in range(len(ends_ms) - 1):
        next_start = starts_ms[i + 1]
        ends_ms[i] = next_start + OVERLAP_MS

    # Write combined narration
    narration_path = os.path.join(HERE, "narration.wav")
    write_wav(narration_path, first_params, bytes(combined))
    total_ms = cursor_ms
    print(f"→ {narration_path}  total={total_ms/1000:.2f}s")

    # Emit word-level SRT (each line is one "word" = one sentence, since
    # each ends in 。 splitSentences treats it as one sentence → one slide).
    srt_lines = []
    for i, (line, s, e) in enumerate(zip(lines, starts_ms, ends_ms), 1):
        srt_lines.append(str(i))
        srt_lines.append(f"{fmt_srt_time(s)} --> {fmt_srt_time(e)}")
        srt_lines.append(line)
        srt_lines.append("")
    srt_path = os.path.join(HERE, "narration.srt")
    with open(srt_path, "w") as f:
        f.write("\n".join(srt_lines))
    print(f"→ {srt_path}  entries={len(lines)}")

    # Emit per-slide timing so the config can derive startMs/endMs if needed.
    timings_path = os.path.join(HERE, "timings.json")
    with open(timings_path, "w") as f:
        json.dump(
            {
                "silence_ms": SILENCE_MS,
                "total_ms": total_ms,
                "slides": [
                    {"i": i, "line": line, "startMs": s, "endMs": e}
                    for i, (line, s, e) in enumerate(zip(lines, starts_ms, ends_ms))
                ],
            },
            f,
            ensure_ascii=False,
            indent=2,
        )
    print(f"→ {timings_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
