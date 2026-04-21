# Reelforge — 通用程序化视频生成框架

> Programmatic forge for reels. 目录名 `slide_video_gen` 只代表首批场景,架构本身通用。
>
> 一句话: **多前端 → 单一 IR → 多渲染后端,以 TTS 音频时间驱动时间线,agent 为一等公民。**

---

## 0. 设计原则

1. **Author once, render anywhere.** 任何创作面都编译到同一 IR,同一 IR 可选择任意后端渲染。
2. **Agent as first-class user.** CLI 非交互式默认、skills/MCP 内建、IR 可结构化编辑、所有动作有确定性输出。
3. **Deterministic rendering.** 同样的 IR + 资产 = 同样的字节级输出。不依赖墙钟、不依赖网络、不依赖 `Date.now()`。
4. **Time is audio-driven.** 旁白+词级时间戳是主时钟,可视资产围绕音频时间线排布。(PPT/讲解视频的核心假设)
5. **Composable, not monolithic.** Provider / Layer / Transition / Effect / FrameAdapter 全部插件化,核心只定义协议。
6. **No invention where borrowing works.** `Caption` 用 Remotion 的模型,`gl-transitions` 用 editly 的,`BeginFrame` 用 Hyperframes 的。

---

## 1. 目标 / 非目标

### 目标
- **通用**:同时覆盖 slide/讲解视频、AI 生成短视频、社交营销、数据可视化、教程、产品宣传片。
- **多前端**:HTML / JSON5 / TS 代码 / Agent 自然语言 四种创作面并存。
- **多后端**:Chrome+HTML / Canvas+Generator / FFmpeg fast path / WebCodecs(未来)。
- **TTS 一等公民**:内建 ElevenLabs / OpenAI / Azure / 本地(F5/VITS)provider,词级对齐 → 自动字幕 → 节拍驱动。
- **图片/视频/音频插入零门槛**:在任一前端都只是一行声明。
- **Agent-first**:Skills(CLI agent)+ MCP(IDE/桌面 agent)双通道。
- **Node 为主运行时**,Python 仅作为可选的 AI provider 子进程。

### 非目标(至少 v1)
- 不做 GUI 编辑器 (Studio 交给社区 fork Twick/Motion Canvas 的 editor)。
- 不自研编解码 (依赖系统 ffmpeg;Lambda/Cloud Run 层面再谈静态二进制)。
- 不支持实时协作编辑 (IR 是文件,不是 CRDT)。
- 不做 text-to-video 扩散模型 (只做"程序化合成"一层;diffusion 视频可作为上游 asset provider)。

---

## 2. 顶层架构

```
┌─ ① Authoring Frontends ──────────────────────────────────────────┐
│  @reelforge/html         @reelforge/dsl        @reelforge/script        @reelforge/agent │
│  HTML + data-*     JSON5 config    TS generator       Skills/MCP │
└────────────────────────────┬─────────────────────────────────────┘
                   compile()  ↓  (每个前端都实现同一个接口 → IR)
┌─ ② IR ───────────────────────────────────────────────────────────┐
│  VideoProject {config, assets, timeline, captions, effects...}   │
│  @reelforge/ir  (运行时无关的纯 TS 类型 + Zod schema)                    │
└────────────────────────────┬─────────────────────────────────────┘
                             ↓
┌─ ③ Orchestrator ─────────────────────────────────────────────────┐
│  @reelforge/core                                                       │
│  Provider Registry (TTS / STT / LLM / Storage / Image)           │
│  Pipelines (script→tts→align→layout→render)                      │
│  Agent bridges (Skills installer / MCP server)                   │
└────────────────────────────┬─────────────────────────────────────┘
                             ↓  RendererRouter 按 IR 内容选后端
┌─ ④ Renderers ────────────────────────────────────────────────────┐
│  @reelforge/engine-chrome    @reelforge/engine-canvas    @reelforge/engine-ffmpeg  │
│  Path A: Chrome+HTML   Path B: Canvas+Gen    Path C: filter-cx   │
│  (default)             (for TS script)       (fast path)         │
│                                                                  │
│  @reelforge/engine-webcodecs (browser, future)                         │
│  @reelforge/parallel  (shared frame-segment coordinator)               │
└────────────────────────────┬─────────────────────────────────────┘
                             ↓
┌─ ⑤ Output ───────────────────────────────────────────────────────┐
│  @reelforge/mux  audio mixing · caption burn/SRT · MP4/WebM/GIF        │
│  @reelforge/deploy  local · Docker · Lambda · Cloud Run                │
└──────────────────────────────────────────────────────────────────┘
```

关键:**创作面不需要知道后端,后端不需要知道创作面**。两者只通过 IR 对话。

---

## 3. IR (VideoProject) 规范

IR 是框架的心脏,其它一切都是它的前后端。IR 必须:可序列化为 JSON、可被 agent 结构化修改、可被任一后端渲染。

### 3.1 顶层

```typescript
// @reelforge/ir
export interface VideoProject {
  version: '1';
  config: ProjectConfig;
  assets: Record<string, Asset>;           // id → Asset (mosaico 风格的不可变资产表)
  timeline: Timeline;                      // tracks → clips
  captions?: CaptionTrack[];               // Remotion Caption 数据模型
  effectsLibrary?: Record<string, EffectSpec>;  // 命名 effect 可在多处引用
  transitionsLibrary?: Record<string, TransitionSpec>;
  meta?: { title?: string; description?: string; author?: string; };
}

export interface ProjectConfig {
  width: number;          // e.g. 1920
  height: number;         // e.g. 1080
  fps: number;            // e.g. 30
  duration?: number;      // 秒;省略时由 timeline 推导
  background?: string;    // CSS color / gradient
}
```

### 3.2 Asset(不可变定义,可被多个 clip 引用)

```typescript
export type Asset =
  | ImageAsset | VideoAsset | AudioAsset
  | TextAsset | FontAsset | ShaderAsset | LottieAsset | ThreeSceneAsset;

interface AssetBase {
  id: string;
  kind: Asset['kind'];
  source: AssetSource;           // 'file' | 'url' | 's3://...' | data URI
  hash?: string;                 // 内容哈希,用于缓存
  meta?: Record<string, unknown>;// 探测得到的宽高/时长/采样率等
}

export interface ImageAsset  extends AssetBase { kind: 'image';  fit?: 'cover'|'contain'|'fill'; }
export interface VideoAsset  extends AssetBase { kind: 'video';  hasAudio?: boolean; }
export interface AudioAsset  extends AssetBase { kind: 'audio';  durationMs: number; }
export interface TextAsset   extends AssetBase { kind: 'text';   text: string; font?: string; style?: TextStyle; }
export interface FontAsset   extends AssetBase { kind: 'font';   family: string; weight?: number; style?: 'normal'|'italic'; }
export interface ShaderAsset extends AssetBase { kind: 'shader'; frag: string; vert?: string; }    // GL transition
export interface LottieAsset extends AssetBase { kind: 'lottie'; json: unknown; }
export interface ThreeSceneAsset extends AssetBase { kind: 'three'; sceneUrl: string; }
```

### 3.3 Timeline / Track / Clip

```typescript
export interface Timeline {
  tracks: Track[];
}

export interface Track {
  id: string;
  kind: 'video' | 'audio' | 'caption' | 'overlay';
  clips: Clip[];
}

export interface Clip {
  id: string;
  assetRef: string;              // Asset.id
  startMs: number;               // 绝对时间线位置
  durationMs: number;
  sourceStartMs?: number;        // 源媒体裁剪起点
  z?: number;                    // 同轨内层叠
  transform?: Transform;         // position/scale/rotate/opacity
  position?: Position;           // 见 3.5
  fit?: 'cover' | 'contain' | 'fill';
  effects?: EffectRef[];         // 引用 effectsLibrary 或内联
  volume?: number;
  transitionIn?: TransitionRef;
  transitionOut?: TransitionRef;
}
```

### 3.4 Caption(完全沿用 Remotion 模型)

```typescript
export interface Caption {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs: number | null;    // 通常是 (start+end)/2
  confidence: number | null;
}

export interface CaptionTrack {
  id: string;
  language: string;              // BCP-47
  captions: Caption[];
  style?: CaptionStyle;          // 字号/颜色/描边/高亮色/位置/最大行宽
  groupingStrategy?: 'tiktok' | 'sentence' | 'none';
}
```

### 3.5 Position — 三策略

```typescript
export type Position =
  | { mode: 'absolute'; x: number; y: number }              // 像素
  | { mode: 'relative'; x: number; y: number }              // 0..1 归一化
  | { mode: 'anchor';   anchor: Anchor; offset?: [number, number] };  // named

export type Anchor =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';
```

### 3.6 Effect / Transition Spec

Effect/Transition 都是"命名+参数"的声明;具体实现由 renderer 按后端能力匹配。

```typescript
export interface EffectSpec {
  name: string;                  // 'zoom-in' | 'ken-burns' | 'fade' | ...
  params?: Record<string, unknown>;
  // 可选:内联实现(给高级用户)
  glsl?: string;
  css?: string;
  canvas?: string;               // 序列化的函数字符串(谨慎)
}

export interface TransitionSpec {
  name: string;                  // 'cross-fade' | 'directional' | 'wipe' | GL shader name
  durationMs: number;
  params?: Record<string, unknown>;
  easing?: string;
}
```

### 3.7 IR 合法性

- `@reelforge/ir` 导出 **Zod schema**,所有前端编译器输出时强制校验。
- `AssetRef` 必须能在 `assets` 表中查到。
- Clip 时间戳必须 ≥ 0,且 `startMs + durationMs ≤ project.duration`(如果声明)。
- 至少一条 track。
- Zod 报错带 JSON Pointer,对 agent 友好。

---

## 4. Authoring Frontends

每个前端必须导出 `compile(source) → VideoProject`。

### 4.1 `@reelforge/html` — HTML-native 前端 (默认推荐)

HTML 文件即合成。借鉴 hyperframes。**图片视频插入最省心**(原生 `<img>/<video>`)。

```html
<!DOCTYPE html>
<html data-svg-width="1920" data-svg-height="1080" data-svg-fps="30">
<head>
  <link rel="stylesheet" href="style.css">
  <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
</head>
<body>
  <div id="stage">
    <!-- 图片 clip -->
    <img class="clip" src="./hero.jpg"
         data-start="0" data-duration="5"
         data-effect="ken-burns">

    <!-- 标题(GSAP 动画) -->
    <div class="clip" data-start="1" data-duration="4" data-track="overlay">
      <h1 class="title">Hello World</h1>
    </div>

    <!-- 旁白 -->
    <audio class="clip" src="./narration.mp3"
           data-start="0" data-duration="auto">
    </audio>

    <!-- 字幕由 caption track 自动渲染,不写在 HTML 里 -->
  </div>

  <script>
    gsap.registerSeekable('title-in', () => {
      return gsap.timeline({paused:true})
        .from('.title', {y: 50, opacity: 0, duration: 0.8});
    });
  </script>
</body>
</html>
```

HTML 前端特性:
- `data-start / data-duration / data-track / data-layer / data-effect / data-transition-in/out` 一套标注。
- 支持 `data-duration="auto"` → 从音频/视频长度自动推导。
- 支持 `data-sync-to="captions.0.word:5"` → 把 clip 开始对齐到第 N 个词的开始。
- `registerSeekable(name, fn)` = 告诉 frame adapter 这个 timeline 由框架 seek 控制。

### 4.2 `@reelforge/dsl` — JSON5 声明式(editly 风格)

给非程序员、脚本生成、agent 输出用。

```json5
{
  config: { width: 1920, height: 1080, fps: 30 },
  narration: { text: "...", tts: { provider: "elevenlabs", voice: "..." } },
  clips: [
    {
      duration: "auto",               // 从旁白句子长度推导
      layers: [
        { type: "image", path: "./hero.jpg", effect: "ken-burns" },
        { type: "title", text: "Hello", position: "center", animate: "fade-up" }
      ],
      transitionOut: { name: "cross-fade", durationMs: 500 }
    },
    {
      duration: 5,
      layers: [
        { type: "video", path: "./product.mp4", fit: "cover" },
        { type: "subtitle", bind: "captions" }
      ]
    }
  ],
  music: { path: "./bgm.mp3", volume: 0.3, duckUnderNarration: true }
}
```

编译规则:顶层 `narration` 触发 TTS pipeline → 生成 AudioAsset + CaptionTrack;`duration:"auto"` 按对应句子时长填充。

### 4.3 `@reelforge/script` — TS 代码式(motion-canvas 风格)

给动画师、可视化开发者。走 **Canvas + Generator** 后端。

```typescript
import { scene, image, text, tween, waitFor, all, parallel } from '@reelforge/script';

export default scene(function* (stage) {
  const hero = stage.add(image({ src: './hero.jpg', fit: 'cover' }));
  const title = stage.add(text({ content: 'Hello', fontSize: 96, opacity: 0 }));

  yield* all(
    tween(hero.scale, 1.1, 5, 'easeInOutSine'),  // ken-burns
    tween(title.opacity, 1, 0.8),
  );
  yield* waitFor(4);
});
```

底层:这个 API 把生成器的执行轨迹编译成 IR 的 clip/effect 序列。**不一定只跑 Canvas 后端**——也可以 transpile 成 HTML+GSAP 给 Chrome 后端跑。

### 4.4 `@reelforge/agent` — Agent 自然语言

不是"第五种 DSL",而是前三种的**元前端**:Skills / MCP 让 agent 产出 HTML / JSON / TS 的任意一种。

- **Skills**(Claude Code / Cursor / Codex):`npx reelforge skills add` 安装 `/reelforge`, `/reelforge-html`, `/reelforge-dsl`, `/reelforge-script`, `/reelforge-render` 命令,带风格预设、调色板、节奏指南(抄自 hyperframes 的 `skills/` 结构)。
- **MCP server**(`@reelforge/mcp`):开放 `list_assets`, `read_ir`, `patch_ir`, `render_preview`, `tts_synthesize`, `transcribe` 等工具。Agent 可直接改 IR,不需要生成 HTML/TS 源码。

---

## 5. Orchestrator: Provider Protocols

`@reelforge/core` 只定义协议,`@reelforge/providers-*` 实现。

### 5.1 TTS

```typescript
export interface TTSProvider {
  readonly id: string;                   // 'elevenlabs' | 'openai' | 'azure' | 'f5-tts-local'
  readonly capabilities: TTSCapabilities; // 支持的语言/音色/流式/词级对齐
  synthesize(input: TTSInput): Promise<TTSResult>;
}

export interface TTSInput {
  text: string;
  voice: string;
  language?: string;
  speed?: number;
  format?: 'mp3' | 'wav' | 'ogg';
}

export interface TTSResult {
  audio: Buffer | ReadableStream;
  mimeType: string;
  durationMs: number;
  wordTimings?: WordTiming[];           // 若 provider 支持词级对齐
}

export interface WordTiming { text: string; startMs: number; endMs: number; }
```

### 5.2 STT / Caption

```typescript
export interface STTProvider {
  readonly id: string;                  // 'whisper-cpp' | 'whisper-web' | 'openai-whisper' | 'assemblyai'
  transcribe(audio: Buffer | string, opts?: STTOptions): Promise<Caption[]>;
}
```

TTS 直接给时间戳时优先用,否则用 STT 对音频做强制对齐。

### 5.3 Storage

```typescript
export interface StorageProvider {
  resolve(uri: string): Promise<LocalPath>;  // 下载/挂载 → 本地可读路径
  put?(local: string, uri: string): Promise<void>;
}
```

内建:`file://`、`http(s)://`、`s3://`、`gs://`、`data:`。设计抄 mosaico 的 fsspec 思路。

### 5.4 LLM Script Generator(可选)

```typescript
export interface ScriptGenerator {
  generate(input: ScriptInput): Promise<ScriptPlan>;  // 返回可喂给 DSL 编译器的结构
}
```

典型输入:话题 / URL / PDF / CSV;输出:`narration` + `clips[]`(缺省视觉)+ 关键词 → 交给 ImageProvider 补图。

### 5.5 Image Provider(AI 生图)

```typescript
export interface ImageProvider {
  readonly id: string;                  // 'flux' | 'sdxl' | 'dall-e' | 'local-comfyui'
  generate(prompt: string, opts?: ImageGenOptions): Promise<Buffer>;
}
```

### 5.6 Pipeline: `script → tts → align → layout → render`

```typescript
// 伪代码
async function renderFromScript(plan: ScriptPlan) {
  const narration = await tts.synthesize({ text: plan.narration, voice });
  const captions = narration.wordTimings
    ? wordTimingsToCaptions(narration.wordTimings)
    : await stt.transcribe(narration.audio);

  const pages = createTikTokStyleCaptions(captions, { combineWithinMs: 1200 });
  const ir = await layoutPlanner.toIR(plan, narration, captions, pages);
  await ir.validate();
  return renderer.render(ir);
}
```

---

## 6. Renderer 多后端

### 6.1 路由策略(`RendererRouter`)

给定一个 IR,按以下规则选后端:

| IR 特征 | 选中后端 |
|---|---|
| HTML composition(assets 包含 HTML doc ref) | **Chrome** |
| 显式 `meta.preferredEngine` | 指定项 |
| 只含 image/video/audio/simple transitions,无自定义动画 | **FFmpeg fast path** |
| 来自 `@reelforge/script`(含 TS 生成轨迹) | **Canvas** |
| 浏览器运行时 | **WebCodecs**(未来) |

用户可通过 `renderer.render(ir, { engine: 'chrome' })` 强制。

### 6.2 Path A — `@reelforge/engine-chrome`(默认)

来自 hyperframes。核心:

- **HeadlessExperimental.beginFrame** CDP 调用(Linux 上是真确定性)。macOS/Windows 回退到 `Page.captureScreenshot` + rAF gating。
- **Library Clock Adapter Registry**:
  ```typescript
  export interface FrameAdapter {
    name: string;
    discover?(): void;
    seek(ctx: { timeMs: number; frameIndex: number }): void;
    pause?(): void;
    play?(): void;
    revert?(): void;
  }
  ```
  内建:`gsap` / `three` / `waapi` / `lottie` / `css`。外部可注册。
- **image2pipe → FFmpeg**,流式编码,不落盘。
- **音频轨道独立提取 + 混音**(从 `<audio>`、`<video data-has-audio>` 元素)。
- **并行**:由 `@reelforge/parallel` 分帧段多进程,帧重排缓冲写入 ffmpeg。

JSON DSL 和 TS script 两个前端都可以选择 "transpile to HTML" 后走这条后端。

### 6.3 Path B — `@reelforge/engine-canvas`

来自 motion-canvas + revideo。核心:

- **Signal-based 属性**(`@reelforge/canvas-signals`):每个节点属性是可观察的,支持动画、派生、依赖追踪。
- **Generator 驱动的帧循环**:`yield` 推进到下一帧。
- **2D/WebGL 混合渲染**:文字/形状走 2D Canvas,3D 走 WebGL/Three 子视图。
- **Node 类型**:Rect / Image / Video / Text / Layout / Group / Shader / Custom。
- **headless 模式**:Node 侧通过 `node-canvas` + `ffmpeg`;也可以 Puppeteer 里跑同一份代码。
- **音频通过 `@reelforge/mux` 后期混入**,不在 canvas 里播。

### 6.4 Path C — `@reelforge/engine-ffmpeg`(Fast Path)

来自 editly。**PPT→视频、图片轮播、纯媒体拼接**不该起 Puppeteer。

- 把 IR 翻译成 `filter_complex`:`xfade` 转场、`zoompan` ken-burns、`drawtext` 字幕(或烧字幕)。
- 启动时间 <1s,渲染速度接近实时。
- 能力上限:无自定义 JS/HTML/CSS 动画。Router 检测到 IR 里没有就自动走这条。

### 6.5 Path D — `@reelforge/engine-webcodecs`(未来)

浏览器端导出,给 Studio/Twick-like 编辑器用。优先级低于 A/B/C。

### 6.6 `@reelforge/parallel`

共用的 worker 协调层(所有后端共享):

- 按帧段分片(e.g. [0..299], [300..599], ...)。
- 每个 worker 起一个独立渲染上下文(Chrome page / Canvas / ffmpeg 进程)。
- **帧重排缓冲**确保顺序写入最终 ffmpeg stdin。
- 支持本地 worker pool、Docker、Lambda 多调用。

---

## 7. 时间模型

### 7.1 主时钟 = TTS 音频时间

对"slide+讲解"场景:

1. 生成旁白 → 得 `AudioAsset` + `WordTiming[]` 或 `Caption[]`。
2. 按句子边界切分 → 每个句子 → 一个 slide clip。
3. clip 的 `duration = sentence.endMs - sentence.startMs`。
4. 图片切换点自动锚到句号/逗号词位。
5. 字幕高亮按词级 `(frame/fps)*1000 ∈ [token.fromMs, token.toMs)`。

### 7.2 非讲解场景

- 音乐节拍检测(`@reelforge/beat` 可选插件,wrap `essentia.js` / `aubio`)→ clip 切换锚到 beat。
- 或完全由用户指定绝对时间戳。

### 7.3 帧量化

- 所有时间对齐到 `1/fps` 边界(Hyperframes `quantizeTimeToFrame`)。
- `frameIndex = round(timeMs / 1000 * fps)`。

---

## 8. 图片/视频/音频插入规范

核心诉求:"插入图片"在所有前端都是一行。

| 前端 | 语法 |
|---|---|
| HTML | `<img class="clip" src="./a.jpg" data-start="3" data-duration="5" data-effect="ken-burns">` |
| DSL  | `{type:"image", path:"./a.jpg", start:3, duration:5, effect:"ken-burns"}` |
| TS   | `yield* stage.add(image({src:'./a.jpg', effect:'ken-burns'})).play(5);` |
| Agent MCP | `patch_ir({op:'add', track:'overlay', clip:{assetRef:'img-a', startMs:3000, durationMs:5000}})` |

全部编译到同一个 IR Clip:
```json
{
  "id": "clip-3",
  "assetRef": "img-a",
  "startMs": 3000,
  "durationMs": 5000,
  "effects": [{"name": "ken-burns"}]
}
```

视频/音频同理,多一个 `sourceStartMs` 裁剪起点。

---

## 9. 项目结构 (Monorepo)

```
slide_video_gen/
├── DESIGN.md                    (本文档)
├── package.json                 (bun workspaces)
├── bunfig.toml
├── tsconfig.base.json
├── ref/                         (参考仓库,只读)
├── packages/
│   ├── ir/                      @reelforge/ir        —— 类型 + Zod schema
│   ├── core/                    @reelforge/core      —— Provider 协议, pipeline, registry
│   ├── html/                    @reelforge/html      —— HTML-native 前端 parser → IR
│   ├── dsl/                     @reelforge/dsl       —— JSON5 前端 → IR
│   ├── script/                  @reelforge/script    —— TS 生成器前端 → IR
│   ├── agent/                   @reelforge/agent     —— skills 模板 + installer
│   ├── mcp/                     @reelforge/mcp       —— MCP server
│   ├── engine-chrome/           @reelforge/engine-chrome  —— Path A
│   ├── engine-canvas/           @reelforge/engine-canvas  —— Path B
│   ├── engine-ffmpeg/           @reelforge/engine-ffmpeg  —— Path C
│   ├── engine-webcodecs/        (占位, v2+)
│   ├── parallel/                @reelforge/parallel  —— 帧段协调
│   ├── mux/                     @reelforge/mux       —— 音频混音 / 字幕合并
│   ├── captions/                @reelforge/captions  —— Remotion Caption 模型 + TikTok 分页
│   ├── providers-tts/           @reelforge/providers-tts-*  (elevenlabs, openai, azure, f5-local)
│   ├── providers-stt/           (whisper-cpp, whisper-web, openai-whisper, assemblyai)
│   ├── providers-image/         (flux, sdxl, dalle, comfyui)
│   ├── providers-storage/       (s3, gcs, file)
│   ├── transitions/             @reelforge/transitions —— gl-transitions 封装
│   ├── effects/                 @reelforge/effects   —— ken-burns / fade / slide / ...
│   ├── cli/                     @reelforge/cli       —— svg init / preview / render / skills add
│   └── playground/              @reelforge/playground —— 内部 demo / e2e
├── skills/                      (agent skills 源;发布到 skills market)
├── templates/                   (svg init 脚手架模板)
└── docs/                        (docusaurus, 暂不优先)
```

### 依赖关系(关键)

- `ir` 无依赖。
- `core` → `ir`。
- 所有 frontend(`html/dsl/script`)→ `ir`。
- 所有 engine → `ir` + `parallel` + `mux`。
- `agent/mcp` → `core` + `ir`。
- providers → 各自 SDK + `core` 协议。
- CLI → 全部(lazy-loaded)。

### 工具链

- **Runtime**: Node ≥ 22, Bun 作为包管理 + 测试 runner(对齐 hyperframes)。
- **Lint/Format**: `oxlint` + `oxfmt`(同 hyperframes)。
- **Test**: `bun test` + `vitest`(浏览器端);E2E 用 playwright + 真 ffmpeg。
- **Build**: `tsdown` / `tsup`,各包独立 ESM + CJS 双产物。
- **License**: **Apache 2.0**(跟 hyperframes 对齐,商用零摩擦)。

---

## 10. 关键 TS 类型(给实现者参考)

```typescript
// @reelforge/ir 的公开入口
export function validate(project: unknown): VideoProject;
export function planDuration(project: VideoProject): number;
export function collectAssetRefs(project: VideoProject): string[];

// @reelforge/core
export interface Renderer {
  render(ir: VideoProject, opts?: RenderOptions): Promise<RenderResult>;
}
export interface RenderOptions {
  engine?: 'chrome' | 'canvas' | 'ffmpeg' | 'webcodecs' | 'auto';
  out: string;
  format?: 'mp4' | 'webm' | 'gif';
  parallelism?: number;
  onProgress?: (p: { frame: number; total: number }) => void;
}

// @reelforge/core/registry
export const providers: {
  tts:     Registry<TTSProvider>;
  stt:     Registry<STTProvider>;
  image:   Registry<ImageProvider>;
  storage: Registry<StorageProvider>;
  llm:     Registry<ScriptGenerator>;
};

// @reelforge/core/pipeline
export async function scriptToVideo(input: ScriptInput, opts: PipelineOpts): Promise<RenderResult>;
```

---

## 11. 路线图

### M0 — 架构与骨架(1 周)
- [ ] 本 DESIGN.md 定稿。
- [ ] Monorepo 骨架 + 工具链。
- [ ] `@reelforge/ir` 包:完整类型 + Zod schema + 100% 类型测试。

### M1 — 端到端最小可运行(2-3 周)
- [ ] `@reelforge/html` HTML 前端 parser → IR。
- [ ] `@reelforge/engine-chrome` Puppeteer + BeginFrame(Linux)/ fallback(其它平台)+ image2pipe。
- [ ] `@reelforge/mux` 音频 mix + ffmpeg。
- [ ] `@reelforge/providers-tts-elevenlabs` + `@reelforge/providers-stt-whisper-cpp`。
- [ ] `@reelforge/captions`(Caption model + TikTok pagination)。
- [ ] `@reelforge/cli`: `reelforge init / preview / render`(短别名 `rf`)。
- [ ] **Demo: "一句话 → slide+旁白+字幕" 能跑通**。

### M2 — 多前端(2 周)
- [ ] `@reelforge/dsl` JSON5 前端。
- [ ] `@reelforge/agent` skills + `@reelforge/mcp` server。
- [ ] ScriptGenerator + Image provider(至少 SDXL 本地)。

### M3 — 多后端(3 周)
- [ ] `@reelforge/engine-ffmpeg` fast path + RendererRouter。
- [ ] `@reelforge/engine-canvas` + `@reelforge/script` TS 生成器前端。
- [ ] `@reelforge/parallel` 本地多进程。

### M4 — 生态与部署(按需)
- [ ] Lambda / Cloud Run 部署模板。
- [ ] 更多 provider(Azure/OpenAI TTS、F5-TTS、Flux、Comfy)。
- [ ] WebCodecs 后端。
- [ ] 社区 skill marketplace 格式定稿。

---

## 12. 命名

**已定:`Reelforge`**。

- Reel = 视频行业通用词(胶片卷轴 / 短视频 reels)
- Forge = 可编程打造,契合"框架"定位
- npm scope `@reelforge/*`、GitHub `reelforge/*`、CLI 主命令 `reelforge`、短别名 `rf`。
- License:Apache 2.0。

---

## 13. Open Questions(等你拍板)

1. **是不是 Node 单语言?** Python TTS/扩散模型是否作为独立子进程 + 统一 HTTP 协议调用?(我倾向是)
2. **Studio(编辑器)要不要 v1 做?** 还是坚决只做 headless + CLI,让社区/公司自己接?(我倾向后者)
3. **是否做浏览器内渲染 demo(WebCodecs)?** 好看,但工程成本不小,v1 可以延后。
4. **Caption style 要不要支持"带表情动画"**(e.g. 每个词一个 emoji bounce)?—— Remotion TikTok 模板里没做到,但这是短视频爆款刚需。
5. **生成器 TS 前端在浏览器里执行还是 Node 里执行?** 决定 `@reelforge/script` 是否需要 sandbox。
6. **发布名字**(见第 12 节)。
