#!/usr/bin/env bash
# Generate 8 intro slides as 1280x720 SVGs. SVG ships text as XML — Chrome
# uses system CJK fallback on its own, no libfreetype/drawtext needed.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
out="$here/slides"
mkdir -p "$out"

render() {
  local idx=$1
  local c0=$2
  local c1=$3
  local title=$4
  local subtitle=$5
  local file="$out/slide-$(printf '%02d' "$idx").svg"
  cat > "$file" <<EOF
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
  <defs>
    <linearGradient id="g${idx}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c0}"/>
      <stop offset="100%" stop-color="${c1}"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g${idx})"/>
  <text x="640" y="320" text-anchor="middle" font-family="-apple-system, 'PingFang SC', 'Heiti SC', 'Microsoft YaHei', sans-serif" font-size="104" font-weight="800" fill="white" style="letter-spacing:-2px; text-shadow: 0 4px 24px rgba(0,0,0,0.4)">${title}</text>
  <text x="640" y="430" text-anchor="middle" font-family="-apple-system, 'PingFang SC', 'Heiti SC', 'Microsoft YaHei', sans-serif" font-size="42" font-weight="500" fill="rgba(255,255,255,0.9)">${subtitle}</text>
  <text x="640" y="650" text-anchor="middle" font-family="-apple-system, 'PingFang SC', 'Heiti SC', sans-serif" font-size="20" fill="rgba(255,255,255,0.4)" style="letter-spacing:8px">REELFORGE</text>
</svg>
EOF
}

render 1 "#667eea" "#764ba2" "Reelforge" "程序化视频生成框架"
render 2 "#1e3c72" "#2a5298" "三个核心设计" "IR · 多前端 · 多后端"
render 3 "#00b894" "#0984e3" "多种创作方式" "HTML · JSON · 代码 · Agent"
render 4 "#6c5ce7" "#a29bfe" "VideoProject IR" "统一中间表示"
render 5 "#d63031" "#e17055" "智能后端路由" "FFmpeg · Chrome · WebCodecs"
render 6 "#00cec9" "#55efc4" "消费 TTS 产物" "BYO 音频 · Whisper 自动转录"
render 7 "#fd79a8" "#e84393" "WAAPI 字幕" "无需 libass · 全 ffmpeg 可用"
render 8 "#667eea" "#764ba2" "流水线闭环" "从脚本到成片"

echo "rendered 8 SVG slides in $out"
