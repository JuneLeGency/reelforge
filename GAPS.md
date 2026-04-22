# GAPS — Reelforge vs peers

> 客观列出 Reelforge 当前相较 Hyperframes / Remotion / Revideo / editly 的具体差距。
> 维护原则:**能力差距** 和 **模板差距** 分开记 — 框架缺一个能力,和框架能做但我们没给模板是两回事。

---

## 1. 能力差距 Capability gaps

### 1.1 已验证能力(不是差距,只是未宣传)

| 能力 | Reelforge | Hyperframes | 备注 |
|---|---|---|---|
| WAAPI library-clock seek | ✅ | ✅ | `engine-chrome` 的 WAAPI adapter 每帧 `currentTime = frameMs` |
| GSAP library-clock seek | ✅ | ✅ | `engine-chrome` 的 GSAP adapter |
| Three.js adapter | ✅ | ✅ | `rf-seek` CustomEvent + `window.__rf.threeTime` |
| Lottie adapter | ✅ | ✅ | `window.__rf.lottie` 注册表,自动 `goToAndStop` |
| 确定性帧捕获 (BeginFrame CDP) | ✅ (opt-in) | ✅ | `--use-begin-frame` |
| Chrome 全 HTML 合成 | ✅ | ✅ | 一样 |
| FFmpeg fast path | ✅ | ❌ | Reelforge 独有,13× 加速 |
| 字幕 DOM 渲染 | ✅ | ✅ | 两家都不用 libass |
| TikTok 词级高亮 | ✅ | ✅ | 能力对等 |

### 1.2 真能力差距(持续更新)

| 能力 | Reelforge | Hyperframes | Remotion | 补齐成本 |
|---|---|---|---|---|
| Shader transitions(自带 gl-transitions) | ⚠ CSS/WAAPI 近似 (`CHROME_EFFECTS`) | ✅ (`shader-transitions` 包) | ❌ | 真 GL 路径放弃 — 见 §4.4 |
| Audio-reactive 特效(beat detection) | ❌ | ✅ (registry blocks) | 第三方 | 中 — web audio + FFT + event hooks |
| **每元素独立 entrance 动画 DSL 描述** | ✅ (slide templates + visual styles) | ✅ | ✅ (React props) | 完成 — `@reelforge/cli/slide-templates/` |
| 多场景 sub-composition | ✅ `rf compose`(concat-based,无过渡) | ✅ (`data-composition-id`) | ✅ (`<Composition>`) | 完成 — `@reelforge/cli` compose 命令 |
| 帧对帧声音反应(audio-visualizer) | ❌ | ✅ | ✅ | 中 |
| 远端渲染(Lambda / Cloud Run 一键部署) | ❌ | ❌ (单机) | ✅ (商业) | 高 |

### 1.3 架构差距

| 点 | Reelforge | Hyperframes | 影响 |
|---|---|---|---|
| **前端 DSL 表达力** | 薄(image + title + audio) | — (直接 HTML) | Hyperframes 鼓励直接写 HTML,我们提供 DSL 但 DSL 没覆盖复杂动画 |
| **模板生态(skill + block)** | 3 skills | 9 blocks + 8 examples + visual-styles 调色板 | 直接影响 agent 产出的视觉质量 |
| **Studio UI** | ❌ | ✅(`packages/studio` 浏览器内编辑器) | 用户反馈循环 — 但目标是非 GUI,这是刻意取舍 |
| **注册表(registry.json)发现机制** | ❌ | ✅ | 让 `npx skills add` 能发现 block/示例 |

---

## 2. 模板 / 生态差距(我们**能做**,只是还没做)

这些都是 `buildGenerateHtml` 或 DSL 可以扩展的,不改 runtime。

### 2.1 Slide 级动画模板

Hyperframes 的 `product-promo/scene1-logo-intro.html` 示范了一个 1.5 秒的 scene 里 5 个 logo 碎片 stagger 收拢 + 环形扩散 + 脉冲 + 缩回,约 190 行 HTML+GSAP。

Reelforge 的 `generate` 目前支持**每元素独立的 entrance/exit 动画**,通过 `@reelforge/cli/slide-templates/` 里的模板库实现。

**已完成模板(11 个,§2.1 清零)**:

- [x] **hero-fade-up** — 大标题 40px 下→上 fade-up,副标题延迟 480ms,装饰线 scale-x 0→1。**支持可选背景图**(有图时渲染 `<img.bg-image>` 作底,自带 scrim 暗角保证文字对比度,图片 1.0→1.05 缓慢 zoom)
- [x] **split-reveal** — 标题水平切成两半,各向上下分开,同时出现 + 中央分隔线 scale-x 扩展
- [x] **bullet-stagger** — 3-5 个列表项,每 150 ms 依次 slide-in-left
- [x] **ken-burns-zoom** — 全屏图片 1.0→1.08 缓慢推拉,底部标题/副标题 fade-up
- [x] **image-left-text** — 左图右文 50/50 分栏,图片从左侧 translateX(-40px)+scale(0.95) 入场,文字 stagger fade-up
- [x] **image-right-text** — 镜像版本(右图左文),共享 CSS
- [x] **photo-card** — 全屏大图 + 底部浮层卡片(Instagram / 小红书 / 播客封面风格),卡片 translateY(60px)→0 滑入
- [x] **quote-card** — 大引号字符 scale-pop + blockquote fade-up + 分隔线 scale-x + 作者署名 slide-in
- [x] **kinetic-type** — 标题按字符拆分(Unicode-aware `Array.from`),每字符 40 ms stagger,translateY + rotate(12deg) 入场
- [x] **logo-outro** — 中心 logo(image 或文字 wordmark)bounce-pop 入场,末段 shrink 到右下角 + 淡出(短 slide 自动压缩 shrink 阶段)
- [x] **data-chart-reveal** — "Label: value" bullets 解析为柱状图,自动按 max 归一化,每根柱子 scaleY 0→1(180 ms stagger)+ 值标签 pop + 标签 fade

### 2.2 可视风格调色板

Hyperframes 的 `skills/hyperframes/visual-styles.md` 有 8 个命名 preset(Swiss Pulse, Dark Premium, Neon Electric, …),每个含:字体栈、3-5 个主色、动画风格语、"What NOT to do" 列表。

Reelforge 当前只有 `@reelforge/cli/src/templates/hello.ts` 一个单一模板。

- [ ] 整理 5-8 个 **命名视觉风格**,像 Hyperframes 那样有 DESIGN.md-style frontmatter
- [ ] DSL 支持 `style: 'swiss-pulse'` 引用,自动 import 对应 CSS + 动画 preset
- [ ] Skills 文档告诉 agent 如何为用户选/生成风格

### 2.3 过渡模板

✅ FFmpeg fast path 已接入 xfade 46 个内建 + 20 别名
✅ Chrome path WAAPI cross-fade 已支持
✅ Chrome path 命名 **effects 库**(`@reelforge/transitions` 的 `CHROME_EFFECTS`):`flash-white` / `flash-black` / `wipe-sweep` / `radial-pulse`,基于 CSS + WAAPI overlay,DSL 通过 `slide.transition: 'flash-white'` 声明

**设计权衡**:真正的 gl-transitions(ripple、displace、pixelate-dissolve 等)需要两帧 texture 做 GPU 合成,不适合"动态 DOM composition"的 Chrome path —— 只在 `<img>`-only slide 之间有意义。放弃 WebGL pipeline,改走 CSS + WAAPI overlay 覆盖 80% 的"视觉分隔节点"诉求。如果未来需要真 GL 过渡,做一条专用路径(预先把两个 slide 渲染成静帧,再用 shader 合成)。

- [ ] 后续:可选加更多 effect —— `scanline-sweep`、`glitch-rgb`、`circle-reveal`(mask-image 实现)等

---

## 3. 性能差距

| 工作负载 | Reelforge | Remotion | 差距 |
|---|---|---|---|
| 纯 image/video slideshow | **0.6 s** for 6s video(13× realtime)— FFmpeg fast path | 未测 | 领先 |
| 复杂 DOM 合成(长视频) | **12 fps 渲染速度**(~83 ms/帧,macOS laptop) | Remotion Lambda: 按核数近线性 | Remotion 在云上碾压 |
| 并行渲染 | `--parallelism N` 但 laptop 上反效果 | Lambda 分片、线性加速 | 架构差距 |

**真正的性能追赶在云上**,不在本地。看 §4.5。

---

## 4. 接下来最值得做的(按 ROI)

### 4.1 Slide 动画模板集合(低成本高回报)
**问题**:当前 `generate` 的视频看上去很静态,是"PowerPoint 导出"级别,不是"电影感 promo"。
**方案**:
1. 扩 DSL schema:`clip.template: 'hero-fade-up' | 'bullet-stagger' | ... `
2. `buildGenerateHtml` 根据 template 生成不同的子 HTML + WAAPI 动画
3. `--template hero-fade-up` CLI flag

**成本**:~1 天,每个模板 50-100 行 HTML + WAAPI
**价值**:把 intro-demo 从"展示框架"升到"展示可发布的视频"

### 4.2 Three.js / Lottie Adapter
**问题**:Hyperframes 可以直接嵌 Three.js 场景,我们要手动处理 `requestAnimationFrame`(seek 会失败)
**方案**:抄 hyperframes 的 adapter 设计,监听 `hf-seek` 事件
**成本**:~半天
**价值**:打开 3D 和 Lottie 动画资产库

### 4.3 命名视觉风格 + Skills 补齐
**问题**:agent 给用户写 composition 时没设计基准,往往选色很糟
**方案**:抄 hyperframes 的 visual-styles.md,做 5-8 个 preset
**成本**:~半天(主要是色彩/字体搭配的设计活)
**价值**:agent 产出质量直接上一个台阶

### 4.4 ~~Shader transitions / GLSL effects~~ ✅ 改走 Chrome effects(CSS + WAAPI)
**做完的**:`@reelforge/transitions` 新增 `CHROME_EFFECTS` 注册表(flash-white / flash-black / wipe-sweep / radial-pulse),CSS + WAAPI overlay,DSL 层在 slide 上声明 `transition: 'flash-white'` 即可触发。
**没做的**(主动放弃):真 WebGL 多纹理 pipeline —— 对动态 DOM composition 收益 <<< 成本,除非将来出现"纯 `<img>` slideshow 需要 GL 过渡"的具体场景。

### 4.5 云渲染(Lambda / Cloud Run)
**问题**:长视频本地慢,Remotion 商业模式就是 Lambda 分片
**方案**:把 `renderChromeParallel` 的 shard 机制拓展到 Lambda/Cloud Run
**成本**:~1 周(Lambda 层 + Docker image + 分发协议 + 测试)
**价值**:对 SaaS / 生产部署是 blocker,对 local-first 工具可后置

### 4.6 `@reelforge/engine-canvas` — motion-canvas 前端
**问题**:架构拼图最后一块
**成本**:~1-2 周
**价值**:低 — HTML + DSL + MCP 覆盖 95% 场景,动画师的场景已经能通过 GSAP 合成覆盖

---

## 5. 记录在案的小修

- [ ] engine-chrome 长视频 `--parallelism` 在 laptop 上性能负回退 — 改进方向:frame-range work-stealing,共享 Chrome instance
- [ ] WAAPI 字幕 TikTok 模式色彩过渡在 low-power 设备有 1-2 帧抖动
- [ ] `reelforge stt` whisper.cpp 未装时错误信息应给出 `brew install whisper-cpp` 等平台相关建议
- [ ] `reelforge captions --to tiktok --threshold` 语义在 README 没提
- [ ] `buildGenerateHtml` 单一 title layer,多个 title 需要自己写 HTML
- [ ] DSL `clip.layers` 内的 title / image / audio 顺序没影响(layers 顺序被忽略),不符合直觉

---

## 6. 结论(初版 — 2026-04 以前)

Reelforge 已有的**核心能力不比 Hyperframes 少**(甚至在 FFmpeg fast path 上领先),差距主要在:

1. **没有 block/template registry** — 所以 `generate` 产出视觉质量不稳定
2. **没有命名视觉风格 preset** — agent 需要自己设计,效果不可复现
3. **没有 Three.js / Lottie adapter** — 3D 和矢量动画要用户自行处理
4. **没有云部署路径** — 本地长视频慢,这是用户体验硬伤

前三项都是**低成本补齐**(~3 天),第四项是**战略投入**(~1 周)。

---

## 7. 近期实施计划(Near-term roadmap — 2026-04-22)

> 基于对 `ref/` 下 7 个参考仓库(Hyperframes / Remotion / Revideo / Motion-canvas / Twick / Editly / Mosaico)的代码级对比调研得出。
> 每条都能独立实施 + 单独提交。排序 = ROI(价值 / 成本)。

### 7.1 现在的能力快照

- **模板**(11): hero-fade-up、ken-burns-zoom、bullet-stagger、split-reveal、image-left-text、image-right-text、photo-card、quote-card、kinetic-type、logo-outro、data-chart-reveal
- **视觉风格**(6 named styles): swiss-pulse、dark-premium、neon-electric、warm-editorial、mint-fresh、terminal-green
- **Chrome transitions**(4 overlay effects): flash-white、flash-black、wipe-sweep、radial-pulse
- **xfade**(66 个 ffmpeg 内建 + 别名): FFmpeg fast path only
- **engine-chrome adapters**: GSAP / WAAPI / video / image / Three.js(rf-seek) / Lottie
- **命令**: init / preview / render / tts / stt / captions / generate / compose / mcp
- **音频**: ElevenLabs TTS + whisper.cpp STT + TikTok per-word highlight

### 7.2 已经明确不做(方向性而非短板)

- **可视化 Studio UI** — Reelforge 定位 agent-first / headless;GUI 交给外部或未来独立 `@reelforge/studio`
- **真云渲染** — 需 Docker + cloud infra + 部署测试,~1 周;除非有明确 SaaS 部署信号,不投入
- **motion-canvas 风格 signal 系统** — 架构重写;GSAP/WAAPI 覆盖 95% 动画需求
- **Block marketplace / plugin registry** — 先要模板基数 (>20),现在 11 个不到规模

### 7.3 待办清单(按 ROI 排序,每条有 task 编号可恢复)

每条都是 **1 个 commit 级别** 的工作,可独立中断、可独立提交。

---

**[x] #R1 Spring easing 暴露到 DSL + 模板** → 完成
- `packages/cli/src/slide-templates/spring.ts`:3 个预置 `spring-soft` / `spring-bouncy` / `spring-stiff`,damped harmonic oscillator 物理模拟(semi-implicit Euler,`sampleSpring` 可 overshoot)
- `parseTransform` / `serializeTransform` 处理 `translateY(22px) rotate(12deg)` 多函数单参数(多参数 comma 场景 fall back linear,不破坏)
- `expandSpringAnimation` 展开为 ~16 帧 linear per segment,WAAPI 可直接消费
- `render-composition.ts` 自动探测 `spring-*` easing 并展开 —— 模板作者直接写 `easing: 'spring-bouncy'` 就行
- `kinetic-type` 默认启用 spring-bouncy:每个字符 cascade 入场时 overshoot,kinetic typography 的标志效果
- 其他模板未强改 easing,留给后续按 visual-style 或 extras 选择性启用
- 测试:24 新单测(physics / transform parse / expand)+ 1 端到端(HTML 里 plans JSON 验证 spring-bouncy → linear + >30 keyframes)

**[ ] #R2 visual-styles.md 设计指引文档(半天)**
- 为 6 个 named styles 各写一段 500-700 字的风格描述
- 每个 style 绑定:调色板、字体栈、**GSAP/WAAPI easing 签名**、动画节奏(slow & confident / fast & snappy / ...)、**anti-patterns**(什么是这个风格不会做的)
- 文件: `packages/cli/src/visual-styles/DESIGN.md`(或者独立 `docs/visual-styles.md`)
- agent 按这个文档能给用户产出可复现的视觉质量
- **参考**: `ref/hyperframes/skills/hyperframes/visual-styles.md` (1.2k 行,Müller-Brockmann / Vignelli / Brody 等设计师风格与 GSAP easing 的映射)
- **价值**: agent 产出质量直接上一档,不需要 agent 自己设计风格

**[ ] #R3 6 个新 CSS overlay effects(1 天,chrome-effects 从 4 扩到 10)**
- `rgb-split` — 多层 text-shadow + transform 错位做 chromatic aberration
- `film-grain` — CSS `noise` background + mix-blend-mode overlay,opacity 脉冲
- `scanlines` — repeating-linear-gradient + opacity sweep
- `glitch-crack` — 短时 transform: skew + translate 抖动
- `shake` — transform 快速随机 translate
- `zoom-blur` — filter: blur() 瞬态抖动(作用于 #stage)
- 加入 `@reelforge/transitions` CHROME_EFFECTS
- 注意 zoom-blur 作用于 #stage 会模糊所有 slide,需要单独 selector 处理
- **参考**: `ref/hyperframes/packages/shader-transitions/`、`ref/editly` Canvas 代码示例
- **价值**: chrome effects 从 4 扩到 10,覆盖面追 Hyperframes 水平

**[ ] #R4 5 个企业模板(1 天,模板从 11 扩到 16)**
- `testimonial` — 半身像 + 语录 + 姓名/title;图右文左,引号装饰
- `lower-third` — 新闻条,bottom 条状卡片,名称 + 职位 + logo
- `picture-in-picture` — 主内容 + 小窗口(另一个 slide 或 image 循环)
- `timeline-roadmap` — 水平/垂直时间轴,节点 stagger
- `end-card` — 订阅/关注提示,末尾 slide,有 "like + subscribe + bell" icon 占位或自定义 text
- 每个 ~80-120 行,参考现有模板结构
- **价值**: 覆盖更多常用场景,特别是 b-roll / 播客 / 企业宣传

**[ ] #R5 SVG path draw-in / morph 支持(1.5 天)**
- 新增 SlideTemplate `svg-draw-in` 或者扩展现有模板支持 `<svg>` inline asset
- 核心技术: `stroke-dasharray` + `stroke-dashoffset` WAAPI 动画实现 "笔画绘制"
- 可选: 引入 flubber.js 做 path morphing(path A → path B)
- 适用: logo 勾线入场、icon 形变、路径 reveal
- **参考**: motion-canvas 的 SVG 库
- **价值**: 打开 logo / icon 动画空间

**[ ] #R6 Audio-reactive 能力(2-3 天)**
- `@reelforge/audio-analysis` 新包: Web Audio API + FFT,离线分析音频得到 beat 时间点 + 频谱序列
- runtime 发射 `rf-audio-beat` CustomEvent(beat 时间点)+ 维护 `window.__rf.spectrum` 数组
- 新模板 `audio-bar-spectrum`: N 条柱子,height 绑定频谱 bin
- 可选:所有模板的 entrance 动画支持 `trigger: 'beat'`,beat 时 replay 短动画
- **参考**: Hyperframes registry 有 audio-reactive blocks(但不同实现)
- **价值**: 音乐视频 / 播客封面 / TikTok 风格短视频

**[ ] #R7 PNG sequence 输出(2 小时,小功能)**
- `generate --format png-seq` / `compose --format png-seq`
- ffmpeg 命令切换: `-vcodec png %06d.png`
- 给 AE / DaVinci 用户用
- **价值**: 小功能但 blocker-free

**[ ] #R8 WebM 输出 + codec 参数暴露(半天)**
- `--codec h264/h265/vp9`
- `--preset ultrafast/medium/slow`
- 当前只输出 H.264 MP4

**[ ] #R9 Compose 命令加 inter-scene transitions(1 天)**
- 当前 compose 是无 transition 的 concat demuxer
- 加 xfade chain 模式:scene 之间声明 `transition: 'fade' | 'wipeleft' | ...`
- 用 `@reelforge/transitions` 已有的 xfade resolver + `@reelforge/engine-ffmpeg` 的 xfade filter builder
- **依赖**: 已有基础设施,只是粘接

### 7.4 推荐实施顺序

**第一批(2 天,立刻升级视觉质量)**:R1 Spring → R2 Design Doc

**第二批(2 天,扩 effect + 模板库)**:R3 Effects → R4 Enterprise templates

**第三批(1.5-3 天,视需求选)**:R5 SVG / R6 Audio-reactive / R9 Compose transitions

**零碎(~半天,零散 slot)**:R7 PNG seq / R8 codec flags

### 7.5 进度记录规约

每做完一条,把 `[ ]` 改成 `[x]`,并在其描述后加一行 `→ <commit hash> <一句话总结>`。这样下次 session 能直接看到剩余进度。
