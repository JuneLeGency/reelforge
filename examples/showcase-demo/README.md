# Showcase demo — Reelforge 仓库介绍片

36 秒自我介绍视频,端到端展示当前仓库的完整能力。两个渲染版本:

| 输出 | caption 模式 | 用途 |
|---|---|---|
| `showcase.mp4` | 无(`--noCaptions`) | slide 本身内容丰富,不需要重复叠字幕 |
| `showcase-tiktok.mp4` | **TikTok per-word 高亮**(`--tiktokCaptions`) | 展示跟随语音的词级黄色高亮 caption 能力 |

两个 mp4 共用**同一份音频 + SRT + config**,只是渲染时加/不加 caption flag。

- **TTS**: VoxCPM2(远程 GPU 服务器,nano-vLLM 后端,RTF ~0.11)
- **模板**: 9 种混用(hero-fade-up / bullet-stagger / kinetic-type / **arch-diagram** / data-chart-reveal / split-reveal / timeline-roadmap / quote-card / logo-outro / end-card)
- **视觉风格**: dark-premium
- **动画**: kinetic-type 默认用 spring-bouncy 物理展开
- **Chrome effects**: 5 个(flash-white / wipe-sweep / rgb-split / radial-pulse / glitch-crack)
- **caption**: sentence 级(默认)/ TikTok 级(per-word 黄色高亮)/ 无 — 三档
- **渲染**: engine-chrome 单进程(headless-shell + manual-keyframes adapter)30 fps

## 流水线

```
文案 (9 句中文, synth.py 内嵌)
  │
  ▼
VoxCPM2 /v1/tts  ─────── 9 段 wav (synth.py)
  │
  ▼
stitch.py       ─────── narration.wav + narration.srt + timings.json
  │
  ▼
ffmpeg → narration.mp3 (48 kHz mono)
  │
  ▼
rf generate config.json  ─────── showcase.mp4 (1280×720 @ 30 fps)
```

每一步独立可中断 / 重跑。

## 从零复现

前置:
- `pi` SSH 配置可直连远程 GPU 服务器
- 服务器上 voice-router + voxcpm 在线(`ssh pi 'tinker-services.sh status'` 验证)
- 本地 ffmpeg + Chrome 可用

```bash
# 1. 合成 9 句(每句一个 wav)
python3 examples/showcase-demo/synth.py

# 2. 拼接 + 生成 SRT
python3 examples/showcase-demo/stitch.py

# 3. 编码 mp3
ffmpeg -y -i examples/showcase-demo/narration.wav \
  -codec:a libmp3lame -q:a 4 examples/showcase-demo/narration.mp3

# 4. 渲染视频 — 无 caption(slide 本身承载内容)
bun packages/cli/src/bin.ts generate examples/showcase-demo/config.json \
  --output examples/showcase-demo/showcase.mp4 \
  --noCaptions

# 4b. 同一输入 + TikTok per-word 高亮 caption
bun packages/cli/src/bin.ts generate examples/showcase-demo/config.json \
  --output examples/showcase-demo/showcase-tiktok.mp4 \
  --tiktokCaptions
```

⚠️ **flag 是 camelCase**:citty 把 kebab-case flag 映射到 JS 对象 key,所以必须写 `--noCaptions` / `--tiktokCaptions`,而不是 `--no-captions`。

最终产出:
- `showcase.mp4`(~1.6 MB,36 秒)— 纯 slide 内容
- `showcase-tiktok.mp4`(~1.7 MB,36 秒)— 带 TikTok per-word 高亮 caption

## 文件说明

| 文件 | 作用 |
|---|---|
| `synth.py` | 调 VoxCPM2 TTS,逐句合成 |
| `stitch.py` | 读 per-sentence wav,加 600 ms 停顿,输出合并 wav + SRT + timings.json |
| `audio/s0N.wav` | 单句音频(原始 48 kHz) |
| `audio/durations.json` | 每句的 TTS 返回时长(含 RTF) |
| `narration.wav` | 拼接后完整叙述(带停顿) |
| `narration.mp3` | 给 rf generate 用的压缩版 |
| `narration.srt` | 逐句 SRT(一个 entry = 一句 = 一个 slide);每句 endMs 被延展覆盖 silence,让 slide 之间无缝衔接 |
| `config.json` | rf generate 的 slide + style + transitions 配置 |
| `timings.json` | 每个 slide 的 startMs/endMs(与 SRT 语义一致,可读性更好) |
| `showcase.mp4` | 最终视频 |
| `showcase.srt` | 派生 SRT(由 rf generate 二次输出,作为字幕字幕文件交付) |

## 为什么要加 silence 延展

VoxCPM 输出的每句音频后面留 600 ms 静音,让听感更自然。但如果 SRT 只覆盖有声部分,`rf generate` 把每个 sentence 映射成一个 slide 后,slide 的结束时间会停在 TTS 末尾 —— 接下来的 600 ms 里当前 slide 已经 fade-out、下一个还没 fade-in,会出现一小段纯背景的黑屏/空屏。

`stitch.py` 把每句 SRT 的 endMs 延展到下一句的 startMs,让 slide 窗口首尾相接,静音期间由当前 slide 继续 hold。视觉上无缝。

## Transition 放哪几处

| slide 边界 | effect | 用意 |
|---|---|---|
| 1 → 2 | flash-white | 从正式 intro 到动感 kinetic 的情绪切换 |
| 3 → 4 | wipe-sweep | 能力列表 → 数据展示 |
| 5 → 6 | rgb-split | 风格声明 → 时间线(视觉抖动) |
| 7 → 8 | radial-pulse | quote 转 logo outro,柔和收束 |
| 8 → 9 | glitch-crack | 最后一个 impact,引出 CTA |

每个 slide 的入场动画由 template 决定,transition 只负责"穿插"一个短时视觉事件。
