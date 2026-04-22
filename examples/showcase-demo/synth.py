#!/usr/bin/env python3
"""
One-shot TTS synthesis driver for the showcase demo.

Sends each Chinese line to VoxCPM2 on the GPU server (192.168.31.47:9094),
writes individual .wav files, then emits a durations.json the next
pipeline step uses to build the concatenated narration + SRT.

Run from repo root:
  python3 examples/showcase-demo/synth.py
"""

import base64
import json
import os
import sys
import urllib.request

TTS_URL = "http://192.168.31.47:9094/v1/tts"
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "audio")

LINES = [
    "Reelforge,程序化视频生成框架。",
    "十三个包,十六个模板,十个特效。",
    "开箱即用,从配置到视频一条命令。",
    "核心流程,四步贯通。",
    "对比手写,更短更清晰。",
    "测试覆盖,全线通过。",
    "六套命名视觉风格。",
    "持续演进,开源共建。",
    "让 AI 直接开箱生成视频。",
    "这就是 Reelforge。",
    "访问 GitHub,开始你的视频。",
]


def synth(text: str):
    body = json.dumps(
        {
            "text": text,
            "cfg_value": 2.0,
            "inference_timesteps": 10,
            "stream": False,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        TTS_URL,
        data=body,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        return json.load(resp)


def main() -> int:
    os.makedirs(OUT_DIR, exist_ok=True)
    durations = []
    sample_rate = None
    for i, line in enumerate(LINES, 1):
        resp = synth(line)
        wav_path = os.path.join(OUT_DIR, f"s{i:02d}.wav")
        with open(wav_path, "wb") as f:
            f.write(base64.b64decode(resp["audio_base64"]))
        dur = resp["duration_seconds"]
        sample_rate = resp.get("sample_rate", sample_rate)
        durations.append(dur)
        print(
            f"[{i}/{len(LINES)}] {wav_path}  dur={dur:.3f}s  infer={resp.get('inference_time', 0):.2f}s"
        )
    with open(os.path.join(OUT_DIR, "durations.json"), "w") as f:
        json.dump(
            {
                "sample_rate": sample_rate,
                "lines": LINES,
                "durations": durations,
                "total": sum(durations),
            },
            f,
            ensure_ascii=False,
            indent=2,
        )
    print(f"\nTotal duration: {sum(durations):.2f}s  sample_rate={sample_rate}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
