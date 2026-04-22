# Visual styles — design guide

六个 `@reelforge/cli` 自带的命名视觉风格。每一个都是**一整套决策**:背景、调色、字体、动画节奏、甚至"不会做的事"。

Agent 或人选一个风格 → 配合任一 slide template → 自动得到视觉一致的视频。

风格并不复盖所有场景,**它只覆盖常见场景的 80%**。如果需求在风格的 anti-patterns 列表里,不要强拗 —— 自定义一个 `VisualStyle` 对象直接传给 `renderTemplatedComposition` 就行。

---

## Swiss Pulse

**一句话**:高对比精确网格,瑞士平面设计传统的视频化。Black / white / 单一强调红。

**灵感**:Müller-Brockmann、Vignelli 的网格系统。编辑版式的节奏与权威感。

**调色逻辑**
- 背景 `#000000` — 纯黑,不要用深灰(会失去权威感)
- 主色 `#ffffff` — 纯白 text
- 强调 `#ff2d2d` — 唯一许可的彩色;仅用于 accent-rule / 关键数字
- 辅助 `#f5f5f5`(off-white 区块)、`#1a1a1a`(暗区块)
- 禁用 `#ffe600`(warn 黄)—— 只在列表 palette 作为"极端情况"备选,正片不用

**字体**:Helvetica Neue / Helvetica(+ CJK fallback)。不要 Inter、不要 SF Pro —— 那些是科技气。Swiss Pulse 要的是 lino 印刷气。

**动画签名**
- Easing: `cubic-bezier(.4, 0, .2, 1)` 或 `power2.out` (GSAP)
- 节奏: 快而准,**无 overshoot**。一切元素 in-place 硬切入,不过冲
- 时长: entrance 400-700 ms,不要超过 1s
- **不用 spring**。Spring 的"有机感"破坏 Swiss Pulse 的"工程感"

**适合**
- 财经 / 科技 / 新闻简报
- 数据揭露(配 `data-chart-reveal` 模板)
- 产品性能数字、时间节点

**Anti-patterns**(不会做)
- 渐变背景 — Swiss Pulse 只用纯色
- 圆角 — 一切直角
- 阴影 — 最多 flat-design 的微投影,不做 depth 感
- emoji、手绘、涂鸦元素
- 多于一种强调色(红以外再加橙或蓝会破掉整个系统)
- 衬线字体标题

---

## Dark Premium

**一句话**:深夜蓝黑 + 金色点缀,quiet luxury 氛围。产品发布的"主角光环"。

**灵感**:Apple event、高端腕表广告。让产品在黑暗中自发光。

**调色逻辑**
- 背景:`radial-gradient(ellipse at 20% 10%, #1e2a4a 0%, #0a0a18 55%, #06060c 100%)` — 从左上一点向四周暗下去的 vignette
- 主色 `#f2e8c8`(暖象牙)做正文 text,**不要纯白**(太冷)
- 强调 `#c6a969`(古铜金)— accent-rule、数字强调
- 辅助 `#8b93a8`(冷蓝灰)做次要信息
- **不用**强饱和色 —— 一切都往土色 / 灰色偏

**字体**:Inter / SF Pro Display light weight 300-400。**不要 bold 800+** —— 重量级标题破坏"quiet"气质。

**动画签名**
- Easing: `cubic-bezier(.25, .1, .25, 1)` 或 `power1.inOut`
- 节奏: 慢且从容,entrance 700-1200 ms。不要赶
- **可用 spring-soft**(低 overshoot,感觉像慢慢"浮现")。不用 bouncy
- 交叉淡入淡出 >= 500 ms

**适合**
- 产品宣传片
- 品牌 logo 入场 / 告别(配 `logo-outro`)
- 引用金句(配 `quote-card`)
- 高客单产品的功能介绍

**Anti-patterns**
- 饱和色 accent — 只用土色系
- 快节奏剪辑 — Dark Premium 要"呼吸感"
- 多图拼贴 — 一次一个主体
- 大字报式标题 — 字重控制在 light/regular
- 高频动画(< 300 ms 的微交互)

---

## Neon Electric

**一句话**:赛博朋克渐变 + 霓虹发光,magenta / cyan 撞色。短视频 / TikTok / game trailer。

**灵感**:Cyberpunk 2077、Tron Legacy、音乐 live show visual。

**调色逻辑**
- 背景:`linear-gradient(135deg, #1a0033 0%, #05002a 60%, #000014 100%)` — 深紫到黑的斜向渐变
- 主 cyan `#05d9e8`(亮青)做正文 text
- 强调 magenta `#ff2a6d` — title 和 accent-rule,配 `text-shadow` glow
- 辅助 `#d1f7ff`(冰蓝)做高亮数字
- 禁用 green / orange — 破坏"夜晚霓虹"的统一感

**字体**:Inter bold / heavy weight。**需要视觉重量**支撑 glow 效果。

**动画签名**
- Easing: `cubic-bezier(.34, 1.56, .64, 1)`(标准 back ease)或 `spring-bouncy`
- 节奏: 快且有冲击 —— entrance 400-600 ms,**欢迎 overshoot + bounce**
- 可以配 `flash-white` / `radial-pulse` chrome effect 做节拍切换
- **强烈建议**配 `kinetic-type` 模板 — kinetic typography + 霓虹发光是这个风格的招牌

**适合**
- 游戏宣传、电子音乐、赛博朋克内容
- TikTok / Reels 短视频(9:16)
- 黑客 / 科技 demo(但偏娱乐向)
- 数字艺术作品集

**Anti-patterns**
- 严肃内容 — 财报、新闻、医疗
- 白底 / 亮背景 — 破坏 glow 效果
- 衬线字体 — 霓虹和衬线是两个世界
- 柔和配色 — 必须撞色
- 超过 3 种强调色(magenta + cyan 是 2 种,加 1 种 accent 就够)

---

## Warm Editorial

**一句话**:米白纸感背景 + 暖橙点缀 + 衬线标题。杂志 / 散文美学。

**灵感**:《纽约客》、Brody 的 Ray Gun 时期、手工印刷的暖感。

**调色逻辑**
- 背景 `#faf5ea` — 轻米白,不要纯白(太冷、太像网页)
- 主色 `#1a1a1a` 近黑正文 — 不要纯黑(在米白上太硬)
- 强调 `#d65a31` 暖橙 — accent-rule、引用装饰
- 辅助 `#8b7355` 暖棕 — subtitle / 斜体
- 装饰 `#f1e6d2` 更浅的米色 — 区块背景

**字体**:ui-serif / Songti(CJK)做标题;sans 正文做对比。**title 必须 bold 700+**,衬线在标题上不能弱。

**动画签名**
- Easing: `cubic-bezier(.25, .46, .45, .94)`(sine out)或 `power1.out`
- 节奏: 中等,entrance 600-900 ms。**不激烈、无 overshoot**
- 交叉淡入淡出 400-500 ms
- 可用 `spring-soft`,不用 `spring-bouncy`(破坏优雅)

**适合**
- 长文引用 / 摘录(`quote-card` 模板首选)
- 书籍介绍 / 读书会内容
- 艺术、文化、时事评论
- 播客封面(配 `photo-card`)

**Anti-patterns**
- 霓虹色、鲜艳饱和色
- 无衬线标题 — 破坏"编辑气质"
- 快节奏 / 硬切
- 多图碎片拼贴
- emoji / 网络 meme
- 渐变背景(除非极其微弱的米色渐变)

---

## Mint Fresh

**一句话**:薄荷绿到薄青的渐变 + 圆润感 + 深灰墨字。科技产品解释。

**灵感**:Duolingo、Figma、轻量级 SaaS 产品主页。"友好、不高冷、可信任"。

**调色逻辑**
- 背景:`linear-gradient(135deg, #a8e6cf 0%, #7bcec0 100%)` — 薄荷到青的柔渐变
- 主色 `#1a3a36` 深墨绿 — 正文 text,对薄荷底的天然对比
- 强调 `#f9a826` 暖橙 — accent-rule / CTA(暖色打破全绿的单调)
- 辅助 `#fefae0` 奶白 — 高亮区块
- 深绿变体 `#2d5a52` — 辅助 text

**字体**:Inter medium。**不要 bold 800+** —— 厚重字重和"友好感"冲突。

**动画签名**
- Easing: `cubic-bezier(.34, 1.2, .64, 1)` 或 `spring-soft`
- 节奏: 慢一点,entrance 700-1000 ms
- **可用 spring** — 轻微 overshoot 传达"有机感"、"友好"
- 元素 rounded-corner 视觉隐喻

**适合**
- SaaS 产品功能介绍
- 健康 / 健身 / 环保内容
- 教程 / 教程类视频(配 `bullet-stagger`、`image-left-text`)
- 儿童友好内容(但不幼稚化)

**Anti-patterns**
- 高对比度 / 严肃内容 — 财报、新闻、医疗警示
- 黑底 + 霓虹色
- 过饱和色 — 保持低饱和,洗掉
- 冷蓝 / 冷紫 — 破坏"暖感"(强调橙是例外)
- 尖角 / 硬切 — 视觉隐喻是圆润

---

## Terminal Green

**一句话**:漆黑底 + 磷光绿 monospace 字体 + 扫描线。开发者 demo、黑客风。

**灵感**:CRT 老显示器、Matrix、CTF 竞赛、hacker 电影。

**调色逻辑**
- 背景 `#000000` — 必须纯黑
- 主色 `#00ff41` 磷光绿 — 所有文本、装饰
- 强调 `#00cc33` 深磷绿 — 次要信息
- 辅助 `#00561c` 苔藓绿 — 背景装饰
- 白 `#ffffff` — 只在极少数需要"警报"对比时(比如 error 状态)

**字体**:MONO (JetBrains Mono / SF Mono / Menlo)。**绝对不用** sans/serif —— 破坏一切。

**动画签名**
- Easing: `steps(8)` 或 `linear` — **离散感**,不要 smooth
- 节奏: 快速,entrance 300-500 ms
- 字符级动画像"typing"(steps easing 关键)
- 可配 `kinetic-type`(但用 steps 而非 spring)
- 可配 `scanlines` / `glitch-crack` chrome effect(见 R3)

**适合**
- 开源项目发布
- CTF writeup、安全 demo
- 终端工具教学
- 极客社群内容
- 游戏 mod / retro 致敬

**Anti-patterns**
- 真实人物照片 — 太违和(除非 pixelated 处理)
- 圆角 / 阴影 —— CRT 没有
- 彩色饱和 — 只许单绿色系
- 平滑动画 —— 必须离散 / 像素化
- 衬线字体 / 无衬线字体 —— 只用 monospace
- emoji(除非 ASCII art 级别)

---

## 风格 × 模板 推荐搭配

> 不是硬规则,而是"开箱视觉最和谐"的起点。

| 模板 | 首选风格 | 次选 | 不建议 |
|---|---|---|---|
| hero-fade-up | swiss-pulse / dark-premium | warm-editorial | — |
| ken-burns-zoom | warm-editorial / dark-premium | mint-fresh | terminal-green |
| bullet-stagger | mint-fresh / swiss-pulse | dark-premium | — |
| split-reveal | swiss-pulse / neon-electric | — | warm-editorial |
| image-left-text | mint-fresh / warm-editorial | dark-premium | terminal-green |
| image-right-text | mint-fresh / warm-editorial | dark-premium | terminal-green |
| photo-card | warm-editorial / dark-premium | mint-fresh | terminal-green |
| quote-card | warm-editorial | dark-premium | neon-electric |
| kinetic-type | neon-electric / terminal-green | swiss-pulse | warm-editorial |
| logo-outro | dark-premium / swiss-pulse | neon-electric | — |
| data-chart-reveal | swiss-pulse / mint-fresh | dark-premium | neon-electric |

---

## 如何新增风格

1. 在 `presets.ts` 加一个 `VisualStyle` 条目 —— 最少字段:name、description、background、palette(≥3 色)、color、colorMuted、fontFamilyHeading、fontFamilyBody
2. 可选 `extraCss` —— 能 override `.slide .title` / `.slide .subtitle` / `.slide .accent-rule` 等选择器,这是风格做"独特感"的地方
3. 在本文件加一条 style 段落,至少覆盖:调色逻辑 / 字体 / 动画签名 / 适合 / **Anti-patterns**
4. 更新"风格 × 模板推荐搭配"表

**Anti-patterns 列表是最重要的部分** —— agent 会读这份指南为用户挑风格,知道"**这个风格不会做什么**" 比"这个风格会做什么"更能锁定视觉一致性。

---

## 参考

本文档格式灵感来自 `ref/hyperframes/skills/hyperframes/visual-styles.md`。颜色、字体、命名均为 Reelforge 原创,无直接抄袭。
