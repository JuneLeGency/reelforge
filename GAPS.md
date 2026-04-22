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
| Shader transitions(自带 gl-transitions) | ❌ | ✅ (`shader-transitions` 包) | ❌ | 中 — WebGL + 47 个 shader |
| Audio-reactive 特效(beat detection) | ❌ | ✅ (registry blocks) | 第三方 | 中 — web audio + FFT + event hooks |
| **每元素独立 entrance 动画 DSL 描述** | ✅ (slide templates + visual styles) | ✅ | ✅ (React props) | 完成 — `@reelforge/cli/slide-templates/` |
| 多场景 sub-composition | ❌ | ✅ (`data-composition-id`) | ✅ (`<Composition>`) | 中 — IR 支持嵌套 Timeline |
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

Reelforge 的 `generate` 目前产出的"scene"是一张 `<img>` + 一个可选 `<div class="caption">`,**没有** per-element entrance/exit 动画。

**缺失模板清单(按频率)**:

- [ ] **hero-fade-up** — 大标题 40px 下→上 fade-up,副标题延迟 400ms,装饰线 scale-x 0→1
- [ ] **split-reveal** — 标题水平切成两半,各向左右分开,同时出现
- [ ] **bullet-stagger** — 3-5 个列表项,每 150ms 依次 slide-in-left
- [ ] **kinetic-type** — 每个字符独立 fade + rotate,cascading
- [ ] **ken-burns-zoom** — 图片缓慢推拉,给视频一个 "活的" 感觉
- [ ] **quote-card** — 大引号字符 fade-in → 文本打字机效果 → 作者名称
- [ ] **data-chart-reveal** — 柱状图 scale-y 0→N,从左到右 stagger
- [ ] **logo-outro** — 全屏 logo 收缩到角标,淡出

### 2.2 可视风格调色板

Hyperframes 的 `skills/hyperframes/visual-styles.md` 有 8 个命名 preset(Swiss Pulse, Dark Premium, Neon Electric, …),每个含:字体栈、3-5 个主色、动画风格语、"What NOT to do" 列表。

Reelforge 当前只有 `@reelforge/cli/src/templates/hello.ts` 一个单一模板。

- [ ] 整理 5-8 个 **命名视觉风格**,像 Hyperframes 那样有 DESIGN.md-style frontmatter
- [ ] DSL 支持 `style: 'swiss-pulse'` 引用,自动 import 对应 CSS + 动画 preset
- [ ] Skills 文档告诉 agent 如何为用户选/生成风格

### 2.3 过渡模板

✅ FFmpeg fast path 已接入 xfade 46 个内建 + 20 别名
✅ Chrome path WAAPI cross-fade 已支持

- [ ] Chrome path **自定义 GLSL transition** — Hyperframes `shader-transitions` 的 ~10 个精选
- [ ] DSL `transition: 'glitch-displace'` 等 shader-based 选项

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

### 4.4 Shader transitions / GLSL effects
**问题**:Chrome path 只有 CSS 级别过渡,视觉上不如 editly 的 GL 过渡
**方案**:HTML 里嵌 WebGL canvas,每帧 uniform 从 WAAPI 驱动
**成本**:~1 天
**价值**:FFmpeg fast path 已有 xfade,Chrome path 同步

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

## 6. 结论

Reelforge 已有的**核心能力不比 Hyperframes 少**(甚至在 FFmpeg fast path 上领先),差距主要在:

1. **没有 block/template registry** — 所以 `generate` 产出视觉质量不稳定
2. **没有命名视觉风格 preset** — agent 需要自己设计,效果不可复现
3. **没有 Three.js / Lottie adapter** — 3D 和矢量动画要用户自行处理
4. **没有云部署路径** — 本地长视频慢,这是用户体验硬伤

前三项都是**低成本补齐**(~3 天),第四项是**战略投入**(~1 周)。
