#!/usr/bin/env bash
# PEV SessionStart hook
# 作用:
#   1) 把 docs/pev/progress-log.md 末尾几十行注入 context,新会话自动知道「上次做到哪」。
#   2) 校验 pev.json 记录的 git commit 与当前 HEAD 是否一致(回滚兜底),不一致则提示。
# 仅项目级安装。全部使用相对项目根路径,不跨项目。
set -uo pipefail

PEV_DIR="./docs/pev"
PEV_JSON="$PEV_DIR/pev.json"
LOG="$PEV_DIR/progress-log.md"
PITFALLS="$PEV_DIR/pitfalls.md"

# 未初始化 PEV 的项目:静默退出,不干扰。
[ -f "$PEV_JSON" ] || exit 0

echo "===== PEV 进度上下文 ====="

# 注入进度日志末尾
if [ -f "$LOG" ]; then
  echo "--- progress-log.md(最近 40 行)---"
  tail -n 40 "$LOG"
else
  echo "(尚无 progress-log.md)"
fi

# 注入踩坑簿近期记录,避免新会话/新模型重复踩坑
if [ -f "$PITFALLS" ]; then
  echo "--- pitfalls.md 已知踩坑(最近 60 行)---"
  tail -n 60 "$PITFALLS"
fi

# git 一致性校验
if command -v git >/dev/null 2>&1 && [ -d "./.git" ]; then
  CUR_HEAD="$(git rev-parse HEAD 2>/dev/null || echo '')"
  # 从 pev.json 读取记录的 head_commit:优先 jq(准确),无 jq 再回退纯文本 grep。
  REC_HEAD=""
  if command -v jq >/dev/null 2>&1; then
    REC_HEAD="$(jq -r '.head_commit // empty' "$PEV_JSON" 2>/dev/null)"
  fi
  if [ -z "$REC_HEAD" ]; then
    REC_HEAD="$(grep -o '"head_commit"[[:space:]]*:[[:space:]]*"[^"]*"' "$PEV_JSON" 2>/dev/null | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"
    # 回退路径也抓不到:大概率 pev.json 缺字段/格式异常,不能静默——给出告警。
    if [ -z "$REC_HEAD" ]; then
      echo "--- ⚠️ 一致性校验被跳过 ---"
      echo "未能从 pev.json 读取 head_commit(可能字段缺失/格式异常,且环境无 jq)。"
      echo "建议在 /pev 续做时检查 pev.json 是否完好。"
    fi
  fi
  if [ -n "$REC_HEAD" ] && [ -n "$CUR_HEAD" ] && [ "$REC_HEAD" != "$CUR_HEAD" ]; then
    echo "--- ⚠️ 一致性警告 ---"
    echo "pev.json 记录的 commit ($REC_HEAD) 与当前 HEAD ($CUR_HEAD) 不一致。"
    echo "可能发生过代码回滚。请在 /pev 续做时确认是否同步 PEV 文档状态。"
  fi
fi

echo "=========================="
exit 0
