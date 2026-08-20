#!/bin/bash
# 同步外刊精炼 SKILL：仓库版 → 本地系统版
# 用法: bash devext/sync_skill.sh
# 说明: GitHub 仓库更新 skills/siele-daily-refine-pack/SKILL.md 后，
#       本地 ~/.codebuddy/skills/ 不会自动跟随，必须运行本脚本同步。
#       （系统只加载 ~/.codebuddy/skills/ 下的 skill，仓库 skills/ 仅为存档）

set -e
SRC="/workspace/siele-workbench/skills/siele-daily-refine-pack/SKILL.md"
DST_DIR="/root/.codebuddy/skills/siele-daily-refine-pack"
DST="$DST_DIR/SKILL.md"

if [ ! -f "$SRC" ]; then
    echo "❌ 未找到仓库版 SKILL: $SRC"
    echo "   请先在仓库内更新 skills/siele-daily-refine-pack/SKILL.md"
    exit 1
fi

mkdir -p "$DST_DIR"
cp "$SRC" "$DST"
echo "✅ 已同步:"
echo "   仓库: $SRC"
echo "   本地: $DST"
echo ""
echo "校验 frontmatter:"
head -3 "$DST"
echo ""
echo "本机 skill 目录可识别列表:"
ls "$DST_DIR" | head -5
