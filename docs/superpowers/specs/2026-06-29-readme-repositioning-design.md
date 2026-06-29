# CodeOmniVis README Repositioning Design

> Date: 2026-06-29
> Status: Draft approved in conversation, awaiting file-review confirmation before README implementation

## 1. Goal

Rewrite the project README so it reads like a high-growth AI developer tool entry point instead of a conventional engineering manual.

The new README should:

- create stronger category positioning in the first screen
- make CodeOmniVis feel relevant in the current AI coding workflow
- keep technical trust intact
- avoid claiming runtime capabilities that the code does not actually expose today

## 2. Current Problem

The current README is accurate enough to onboard a careful reader, but it is weak as a growth surface:

- the first screen explains instead of positioning
- the value to users of Claude / Cline / Cursor / MCP clients is implied, not explicit
- the command path appears too late relative to the amount of explanation
- the structure is module-oriented instead of outcome-oriented
- several legacy claims in prior README versions were stronger than the runtime reality, which creates a trust penalty if repeated

## 3. Approved Direction

The README should position CodeOmniVis as:

**The architecture context layer for AI coding agents**

Working Chinese framing:

**别再让 AI 猜你的架构**

Working English framing:

**Stop Letting AI Guess Your Architecture**

This framing is intentionally sharper than "full-stack architecture visualizer". It turns the project from a passive diagram tool into infrastructure for AI-assisted development workflows.

## 4. Strategic Message

The README should make this argument quickly:

1. modern AI coding tools can edit files and run commands
2. they still often guess at system boundaries and downstream impact
3. CodeOmniVis turns a repo into an AI-queryable architecture graph
4. that graph can be consumed through UI, REST, and MCP

This is the central contrast:

**Not another coding agent. The missing context layer for coding agents.**

## 5. Reference Patterns To Borrow

The rewrite should borrow specific patterns from recent high-growth AI tool READMEs / landing pages without copying their voice.

### Aider

Borrow:

- one-line category definition
- proof markers near the top
- fast path to first command

Do not borrow:

- testimonial-heavy social proof unless CodeOmniVis has real quotes to support it

### Cline

Borrow:

- category ownership language
- capability clusters organized by user outcome
- explicit contrast against lock-in and opaque workflows

Do not borrow:

- ecosystem-scale claims that CodeOmniVis cannot substantiate yet

### OpenHands

Borrow:

- early Quick Start placement
- ambition stated in plain language

Do not borrow:

- broad "can do anything" language that does not match CodeOmniVis

### Continue

Borrow:

- feature grouping by user action rather than internal modules

Do not borrow:

- UI-card style sections that need media assets we do not have yet

## 6. Information Architecture

The top half of the README should be reordered like this:

1. Hero
2. sharp subhead
3. 3 to 5 proof bullets
4. minimal Quick Start
5. "Why this exists" section
6. "Why not just use Cursor / Cline / Claude Code?" section
7. "What you can do with it" section
8. CLI / MCP / REST surfaces

The lower half can then move into:

1. supported stack
2. config
3. repo layout
4. demo
5. docs
6. development
7. roadmap

## 7. Hero Copy Direction

### Recommended title

**Stop Letting AI Guess Your Architecture**

### Recommended subhead

**CodeOmniVis turns your repo into an AI-queryable architecture graph across pages, components, APIs, RPC, and databases.**

### Recommended support lines

- Not another coding agent. The missing context layer for coding agents.
- Use it with Claude, Cline, Cursor, or any MCP client.
- One command to map your system. One protocol to let AI query it.

## 8. Guardrails

The rewrite must not:

- claim Kotlin support as fully available in the runtime paths if the active parser registration does not support it end-to-end
- claim config behavior that the runtime does not actually honor
- imply that `/api/ai/chat` is functional when it currently returns `501`
- invent benchmarks, installs, user counts, adoption, or testimonials
- position the project as a replacement for coding agents

The rewrite should:

- clearly state what works today
- separate "available now" from "planned / evolving"
- use sharper language without making unverifiable product claims

## 9. Deliverables

After spec approval, implementation should update:

- `README.md`
- `README.en.md`

The rewrite should substantially change the opening 80 to 120 lines of both files, not just reword existing sections.
