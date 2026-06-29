# README Repositioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the Chinese and English READMEs so CodeOmniVis is positioned as the architecture context layer for AI coding agents, with a stronger growth-oriented hero and a more truthful capability surface.

**Architecture:** Keep the lower README sections largely intact where they already serve onboarding, but rewrite the opening sections to establish sharper category positioning, faster time-to-value, and clearer differentiation from general AI coding agents. Correct capability claims that exceed current runtime behavior while preserving a confident tone.

**Tech Stack:** Markdown, GitHub README conventions, existing CodeOmniVis CLI / MCP / REST surfaces

---

### Task 1: Rewrite Chinese README Opening

**Files:**
- Modify: `README.md`
- Reference: `docs/superpowers/specs/2026-06-29-readme-repositioning-design.md`

- [ ] **Step 1: Replace the current hero and opening sections**

Rewrite the opening README blocks so they lead with:

- the new hero line
- the AI-agent positioning
- a short "why this exists" argument
- a faster Quick Start
- a "Why not just use Cursor / Cline / Claude Code?" section

- [ ] **Step 2: Correct any claims that exceed current runtime behavior**

Update supported-surface language so it does not overstate:

- Kotlin runtime support
- config behavior that the runtime does not consistently honor
- the `/api/ai/chat` feature state

- [ ] **Step 3: Keep the rest of the document usable**

Preserve or lightly adapt:

- CLI section
- MCP section
- config section
- repo layout
- demo and docs links

- [ ] **Step 4: Review the opening flow in plain text**

Run:

```bash
sed -n '1,220p' README.md
```

Expected:

- the first screen reads like a product entry point, not a module catalog
- the first command appears early
- the positioning is sharper without becoming vague or dishonest

### Task 2: Rewrite English README To Match

**Files:**
- Modify: `README.en.md`
- Reference: `README.md`

- [ ] **Step 1: Mirror the new positioning in English**

Rewrite the English hero and opening sections so they match the Chinese README in:

- category positioning
- structure
- proof cadence
- quick start order

- [ ] **Step 2: Preserve factual consistency across both files**

Check that both READMEs align on:

- what works today
- what is framed as planned or evolving
- how CodeOmniVis differs from general coding agents

- [ ] **Step 3: Review the English opening flow**

Run:

```bash
sed -n '1,220p' README.en.md
```

Expected:

- the English README feels native, not mechanically translated
- the hero is direct and growth-oriented
- no capability claims exceed the codebase reality

### Task 3: Verify Markdown Quality And Diff Scope

**Files:**
- Verify: `README.md`
- Verify: `README.en.md`

- [ ] **Step 1: Check markdown whitespace and patch quality**

Run:

```bash
git diff --check
```

Expected:

- no trailing whitespace
- no malformed patch artifacts

- [ ] **Step 2: Review the changed file summary**

Run:

```bash
git diff --stat README.md README.en.md
```

Expected:

- most changes are concentrated in the opening sections
- both files changed in similar proportion

- [ ] **Step 3: Review final branch state**

Run:

```bash
git status --short
```

Expected:

- only the intended README files are modified for this task
