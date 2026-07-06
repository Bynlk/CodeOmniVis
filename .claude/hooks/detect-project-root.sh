#!/usr/bin/env bash
# PEV 项目根检测 —— 供 /pev 系列命令与 SessionStart hook 调用。
# 策略:向上兼容检测项目标志。当前目录既无 .git 又无 docs/pev/ 视为非项目环境。
# (更智能的「派最低阶子代理判断是否项目根」由命令层的 LLM 逻辑执行,此脚本是失效兜底。)
#
# 退出码:0 = 在项目环境;1 = 非项目环境。
set -euo pipefail

is_project_root() {
  # 已初始化过 PEV
  [ -f "./docs/pev/pev.json" ] && return 0
  # 版本库根(git / mercurial / svn)。.git 也可能是文件(worktree / submodule)。
  if [ -d "./.git" ] || [ -f "./.git" ]; then return 0; fi
  [ -d "./.hg" ] && return 0
  [ -d "./.svn" ] && return 0
  # 常见项目标志文件(含无后缀的构建/容器文件)
  for marker in \
    package.json pyproject.toml setup.py requirements.txt \
    go.mod Cargo.toml pom.xml build.gradle build.gradle.kts settings.gradle \
    Makefile CMakeLists.txt Dockerfile composer.json Gemfile \
    build.sbt deno.json .project-root; do
    [ -e "./$marker" ] && return 0
  done
  return 1
}

# monorepo / 子目录兜底:当前目录不是根,则向上逐级查找 .git(最多 6 层),
# 找到则认为处于某个 git 项目内,允许运行(命令层仍可用 LLM 进一步判断真实根)。
in_git_worktree() {
  local dir="$PWD" i=0
  while [ "$dir" != "/" ] && [ "$i" -lt 6 ]; do
    { [ -d "$dir/.git" ] || [ -f "$dir/.git" ]; } && return 0
    dir="$(dirname "$dir")"
    i=$((i + 1))
  done
  return 1
}

if is_project_root || in_git_worktree; then
  exit 0
else
  echo "PEV 需在项目根目录使用。当前目录未检测到项目标志(.git / .hg / .svn / docs/pev / package.json / go.mod / Makefile 等)。" >&2
  echo "请在项目根目录打开 Claude Code 后重试。禁止在全局目录(如家木目录)使用 PEV。" >&2
  exit 1
fi
