#!/usr/bin/env bash
# PEV Stop hook
# 作用:本轮若改动了代码(git 工作区有 src/ 等代码变更),但没有同步更新
#       docs/pev/pev.json 或 docs/pev/progress-log.md,则拦下这一轮,
#       提示先补一行进度记录再收尾。把「记得更新文档」从概率性变确定性。
# 仅项目级安装。相对项目根路径。
#
# Stop hook 约定:输出 JSON 到 stdout。{"decision":"block","reason":"..."} 表示拦截。
set -uo pipefail

PEV_JSON="./docs/pev/pev.json"

# 未初始化 PEV:放行。
[ -f "$PEV_JSON" ] || { echo '{}'; exit 0; }
command -v git >/dev/null 2>&1 || { echo '{}'; exit 0; }
[ -d "./.git" ] || { echo '{}'; exit 0; }

# 本轮是否有代码改动(已暂存 + 未暂存),排除 docs/pev 本身。
# 判定为「代码」的两类:
#   (a) 常见源码/基础设施后缀(在原有基础上补全:proto/tf/gradle/scala/dart/cs/ex/clj/lua/swift 等);
#   (b) 无后缀但典型的构建/容器关键文件(Dockerfile / Makefile / CMakeLists 等)。
# 注:配置类小改(README / .gitignore / 纯 json/yaml 配置)不计入,避免误拦。
# 用 -uall 展开未跟踪目录,否则新建目录会被折叠成 "?? dir/" 导致内部代码文件漏检。
STATUS="$(git status --porcelain -uall 2>/dev/null | grep -vE '(^..? *docs/pev/)' || true)"
CODE_BY_EXT="$(printf '%s\n' "$STATUS" | grep -E '\.(js|jsx|ts|tsx|mjs|cjs|py|go|rs|java|kt|kts|scala|c|h|hpp|cpp|cc|cxx|rb|php|vue|svelte|sql|sh|bash|zsh|proto|tf|tfvars|gradle|dart|cs|ex|exs|clj|cljs|lua|m|mm|swift|r)$' || true)"
CODE_BY_NAME="$(printf '%s\n' "$STATUS" | grep -E '[ /](Dockerfile|Makefile|CMakeLists\.txt|Rakefile|Gemfile|build\.gradle|build\.gradle\.kts|settings\.gradle)([^/]*)?$' || true)"
CODE_CHANGED="$(printf '%s\n%s\n' "$CODE_BY_EXT" "$CODE_BY_NAME" | grep -vE '^$' || true)"

# 本轮 pev 文档是否有改动
PEV_CHANGED="$(git status --porcelain 2>/dev/null | grep -E 'docs/pev/(pev\.json|progress-log\.md)' || true)"

if [ -n "$CODE_CHANGED" ] && [ -z "$PEV_CHANGED" ]; then
  cat <<'JSON'
{"decision":"block","reason":"检测到本轮修改了代码,但未更新 docs/pev/progress-log.md 或 docs/pev/pev.json。请先在 progress-log.md 追加一行(做了什么、对应哪个 spec、有无遗留问题),并同步 pev.json 中相应 feature 的状态与 commit,然后再结束本轮。"}
JSON
  exit 0
fi

echo '{}'
exit 0
