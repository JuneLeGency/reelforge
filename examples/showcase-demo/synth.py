#!/usr/bin/env python3
"""
One-shot TTS driver for the 30-template showcase.

Each line introduces one template, in the same order the slides
appear in config.json. Keeping lines short (≤ 14 chars) gives the
camera ~2–3 s per template — long enough for the viewer to read
the template name + see the visual, short enough that 30 slides
come in around 75–90 s.

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
    # 00 intro
    "Reelforge,三十个模板巡展。",
    # text + layout fundamentals
    "hero fade up,中央大标题。",
    "kinetic type,逐字弹跳。",
    "split reveal,标题一刀切开。",
    "bullet stagger,要点依次登场。",
    "quote card,金句放大。",
    # data viz
    "data chart reveal,柱状图。",
    "data grid,仪表盘卡片。",
    "chart line,折线趋势。",
    "chart pie,环形占比。",
    "timeline roadmap,水平时间轴。",
    # structure & comparison
    "arch diagram,渲染流水线。",
    "flowchart,决策树分叉。",
    "split compare,前后对比。",
    "code block,语法高亮窗口。",
    # banner & ambient
    "news title,突发新闻条。",
    "gradient bg,动感渐变背景。",
    # photo-driven
    "ken burns zoom,图片慢推拉。",
    "photo card,大图加卡片。",
    "image left text,左图右文。",
    "image right text,右图左文。",
    "image grid,九宫格画廊。",
    "picture in picture,主画面画中画。",
    "testimonial,用户证言。",
    "lower third,新闻条。",
    # media widgets
    "ui 3d reveal,三维翻转登场。",
    "audio waveform,频谱可视化。",
    "music card,正在播放。",
    "social follow,关注订阅卡。",
    # composite(嵌套布局)
    "composite,一屏多 widget 组合。",
    "hero-kpi 布局,左主右侧 KPI。",
    # closing
    "logo outro,Logo 收束。",
    "end card,谢谢观看。",
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
