# 踩坑与错误簿（Pitfalls）

> 追加式：一旦写下不修改旧条目。若某个坑后来有更好解法，新追加一条并引用旧编号。
> SessionStart hook 会注入本文件近期记录，让新会话/新模型开发时先看到已知的坑，避免重复踩。

---

## [0001] 本地 .claude/commands 目录被安全策略禁止写入
- **日期**：2026-07-07
- **关联 feature**：通用（PEV 安装）
- **现象**：向 `/Users/new/CodeOmniVis/.claude/commands/` 写文件报 `Operation not permitted`，而同级 `.claude/hooks/` 可正常写。
- **根因**：本地执行工具的安全策略专门拦截 `.claude/commands` 路径（防 slash-command 注入），非文件系统权限问题。
- **解法**：hooks 与 settings.json 已正常安装；command .md 文件无法落地，但工作流可由助手直接按命令逻辑驱动，不阻塞开发。用户若需本机 /pev 斜杠命令，需手动放置 command 文件。
- **教训 / 规避**：不要试图绕过该拦截；PEV 命令逻辑已在助手上下文中，可直接执行。
