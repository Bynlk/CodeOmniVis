#!/usr/bin/env bash
# PEV pev.json 轻量校验 —— 供 /pev 续做与 /pev-status 在读取 pev.json 前调用。
# 目标:JSON 坏了 / 缺必需字段 / version 不兼容时,给出明确提示,而不是让上层默默跑歪。
# 仅做结构存在性 + version 兼容检查,不校验业务语义。相对项目根路径。
#
# 退出码:0 = 校验通过;1 = 有问题(问题详情打到 stderr)。
# 用法:validate-pev-json.sh [pev.json 路径,默认 ./docs/pev/pev.json]
set -uo pipefail

PEV_JSON="${1:-./docs/pev/pev.json}"
# 本脚本支持的 pev.json 最高 schema 版本。读到更高版本 → 提示升级 PEV skill。
SUPPORTED_MAX_VERSION=1

if [ ! -f "$PEV_JSON" ]; then
  echo "PEV 校验:未找到 $PEV_JSON(项目可能尚未初始化,请先运行 /pev)。" >&2
  exit 1
fi

# 无 jq 时降级:只做「能否被 python/grep 解析」的最基本检查,不做字段级校验。
if ! command -v jq >/dev/null 2>&1; then
  if command -v python3 >/dev/null 2>&1; then
    python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$PEV_JSON" 2>/dev/null \
      || { echo "PEV 校验:$PEV_JSON 不是合法 JSON(已用 python3 解析失败),请检查是否被手动改坏。" >&2; exit 1; }
    echo "PEV 校验:环境无 jq,仅完成 JSON 合法性检查(跳过字段级校验)。" >&2
    exit 0
  fi
  echo "PEV 校验:环境既无 jq 也无 python3,无法校验 pev.json 结构,请谨慎续做。" >&2
  exit 0
fi

# 1) JSON 是否合法
if ! jq -e . "$PEV_JSON" >/dev/null 2>&1; then
  echo "PEV 校验:$PEV_JSON 不是合法 JSON,可能被手动改坏。请修复或用 git 恢复后重试。" >&2
  exit 1
fi

PROBLEMS=()

# 2) 必需顶层字段存在性
for field in version features; do
  jq -e "has(\"$field\")" "$PEV_JSON" >/dev/null 2>&1 \
    || PROBLEMS+=("缺少必需字段: .$field")
done

# 3) version 类型与兼容性
VER="$(jq -r '.version // empty' "$PEV_JSON" 2>/dev/null)"
if [ -z "$VER" ]; then
  PROBLEMS+=(".version 缺失或为空")
elif ! printf '%s' "$VER" | grep -Eq '^[0-9]+$'; then
  PROBLEMS+=(".version 不是整数: $VER")
elif [ "$VER" -gt "$SUPPORTED_MAX_VERSION" ]; then
  PROBLEMS+=(".version=$VER 高于当前 PEV skill 支持的最高版本 $SUPPORTED_MAX_VERSION,请升级 PEV skill 后再续做")
fi

# 4) features 必须是数组;每个 feature 需含 id / status
if jq -e '.features | type == "array"' "$PEV_JSON" >/dev/null 2>&1; then
  BAD_FEATURES="$(jq -r '[.features[] | select((has("id")|not) or (has("status")|not))] | length' "$PEV_JSON" 2>/dev/null)"
  [ "${BAD_FEATURES:-0}" != "0" ] && PROBLEMS+=("有 $BAD_FEATURES 个 feature 缺少 id 或 status 字段")
  # status 取值合法性(允许 todo/doing/done/pending)
  BAD_STATUS="$(jq -r '[.features[] | select(has("status")) | .status | select(. as $s | ["todo","doing","done","pending"] | index($s) | not)] | length' "$PEV_JSON" 2>/dev/null)"
  [ "${BAD_STATUS:-0}" != "0" ] && PROBLEMS+=("有 $BAD_STATUS 个 feature 的 status 不在 {todo,doing,done,pending} 内")
else
  PROBLEMS+=(".features 不是数组")
fi

if [ "${#PROBLEMS[@]}" -gt 0 ]; then
  echo "PEV 校验:$PEV_JSON 存在以下问题,请先修复(或用 git 恢复)再续做:" >&2
  for p in "${PROBLEMS[@]}"; do echo "  - $p" >&2; done
  exit 1
fi

exit 0
