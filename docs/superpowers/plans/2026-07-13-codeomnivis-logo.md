# CodeOmniVis Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved Clean V brand mark as tested SVG assets and a reusable React component, then replace the legacy `CO` badges and Vite favicon across the workbench.

**Architecture:** Keep brand geometry in one small React component for theme-aware product UI and in four standalone SVG files for external/static use. The component owns accessibility and the `CodeOmniVis` lockup, while Header and ViewRail only choose mark size and whether the wordmark is visible.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, SVG, Vitest, React server rendering

---

### Task 1: Lock the brand component contract with failing tests

**Files:**
- Create: `packages/ui/__tests__/components/brandLogo.test.tsx`
- Create later: `packages/ui/src/components/BrandLogo.tsx`

- [ ] **Step 1: Write the failing component tests**

```tsx
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BrandLogo } from '../../src/components/BrandLogo'

describe('BrandLogo', () => {
  it('renders the approved C/O/V geometry without decorative effects', () => {
    const html = renderToStaticMarkup(<BrandLogo />)

    expect(html).toContain('viewBox="0 0 64 64"')
    expect(html.match(/<path\b/g)).toHaveLength(2)
    expect(html.match(/<circle\b/g)).toHaveLength(1)
    expect(html).toContain('d="M48 15A22 22 0 1 0 48 49"')
    expect(html).toContain('cx="33" cy="32" r="11"')
    expect(html).toContain('d="M26 26.5L33 38L40 26.5"')
    expect(html).not.toMatch(/linearGradient|filter|<text/i)
  })

  it('gives the mark-only variant an accessible product name', () => {
    const html = renderToStaticMarkup(<BrandLogo markClassName="h-8 w-8" />)

    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="CodeOmniVis"')
    expect(html).toContain('class="shrink-0 h-8 w-8"')
  })

  it('uses decorative geometry and colors only the capital O in the lockup', () => {
    const html = renderToStaticMarkup(<BrandLogo showWordmark />)

    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('data-brand-wordmark="true"')
    expect(html).toContain('Code<span class="text-[#6F83FF]">O</span>mniVis')
    expect(html).not.toContain('Code<span class="text-[#6F83FF]">o</span>')
  })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @codeomnivis/ui test -- __tests__/components/brandLogo.test.tsx`

Expected: FAIL because `../../src/components/BrandLogo` does not exist.

- [ ] **Step 3: Record the red-state evidence in the task output**

Expected evidence: Vitest reports one failed suite with a module resolution error for `BrandLogo`.

### Task 2: Implement the reusable BrandLogo component

**Files:**
- Create: `packages/ui/src/components/BrandLogo.tsx`
- Test: `packages/ui/__tests__/components/brandLogo.test.tsx`

- [ ] **Step 1: Add the minimal component implementation**

```tsx
interface BrandLogoProps {
  showWordmark?: boolean
  className?: string
  markClassName?: string
}

function BrandMark({ decorative, className }: { decorative: boolean; className: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'CodeOmniVis'}
      aria-hidden={decorative ? true : undefined}
      className={`shrink-0 ${className}`}
    >
      <path d="M48 15A22 22 0 1 0 48 49" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" />
      <circle cx="33" cy="32" r="11" stroke="#6F83FF" strokeWidth="3.5" />
      <path d="M26 26.5L33 38L40 26.5" stroke="currentColor" strokeWidth="3.2" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  )
}

export function BrandLogo({
  showWordmark = false,
  className = '',
  markClassName = 'h-6 w-6',
}: BrandLogoProps) {
  if (!showWordmark) {
    return (
      <span className={`inline-flex ${className}`.trim()}>
        <BrandMark decorative={false} className={markClassName} />
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`.trim()}>
      <BrandMark decorative className={markClassName} />
      <span data-brand-wordmark="true" className="font-[650] tracking-[-0.025em] text-content">
        Code<span className="text-[#6F83FF]">O</span>mniVis
      </span>
    </span>
  )
}
```

- [ ] **Step 2: Run the focused component test and verify GREEN**

Run: `pnpm --filter @codeomnivis/ui test -- __tests__/components/brandLogo.test.tsx`

Expected: PASS, 3 tests passed.

- [ ] **Step 3: Run TypeScript validation for the component API**

Run: `pnpm --filter @codeomnivis/ui typecheck`

Expected: exit code 0 with no TypeScript errors.

### Task 3: Create standalone SVG assets with structural tests

**Files:**
- Create: `packages/ui/public/brand/logo-mark-dark.svg`
- Create: `packages/ui/public/brand/logo-mark-light.svg`
- Create: `packages/ui/public/brand/logo-mark-mono.svg`
- Create: `packages/ui/public/brand/favicon.svg`
- Modify: `packages/ui/__tests__/components/brandLogo.test.tsx`

- [ ] **Step 1: Add failing asset validation tests**

Add the import and asset tests below:

```tsx
import { readFileSync } from 'node:fs'

const readUiFile = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

describe('brand SVG assets', () => {
  const dark = readUiFile('../../public/brand/logo-mark-dark.svg')
  const light = readUiFile('../../public/brand/logo-mark-light.svg')
  const mono = readUiFile('../../public/brand/logo-mark-mono.svg')
  const favicon = readUiFile('../../public/brand/favicon.svg')

  it('keeps all assets portable and free of decorative effects', () => {
    for (const asset of [dark, light, mono, favicon]) {
      expect(asset).toContain('viewBox="0 0 64 64"')
      expect(asset).not.toMatch(/linearGradient|filter|<image|<text/i)
    }
  })

  it('uses the approved theme colors and a true monochrome variant', () => {
    expect(dark).toContain('#F4F7FB')
    expect(dark).toContain('#6F83FF')
    expect(light).toContain('#141922')
    expect(light).toContain('#566BE8')
    expect(mono).toContain('currentColor')
    expect(mono).not.toMatch(/#6F83FF|#566BE8/i)
  })

  it('simplifies the favicon to C and V only', () => {
    expect(favicon.match(/<path\b/g)).toHaveLength(2)
    expect(favicon).not.toContain('<circle')
  })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @codeomnivis/ui test -- __tests__/components/brandLogo.test.tsx`

Expected: FAIL with `ENOENT` because the SVG assets do not exist.

- [ ] **Step 3: Add the approved static SVGs**

Create `logo-mark-dark.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <path d="M48 15A22 22 0 1 0 48 49" stroke="#F4F7FB" stroke-width="5.5" stroke-linecap="round"/>
  <circle cx="33" cy="32" r="11" stroke="#6F83FF" stroke-width="3.5"/>
  <path d="M26 26.5L33 38L40 26.5" stroke="#F4F7FB" stroke-width="3.2" stroke-linecap="square" stroke-linejoin="miter"/>
</svg>
```

Create `logo-mark-light.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <path d="M48 15A22 22 0 1 0 48 49" stroke="#141922" stroke-width="5.5" stroke-linecap="round"/>
  <circle cx="33" cy="32" r="11" stroke="#566BE8" stroke-width="3.5"/>
  <path d="M26 26.5L33 38L40 26.5" stroke="#141922" stroke-width="3.2" stroke-linecap="square" stroke-linejoin="miter"/>
</svg>
```

Create `logo-mark-mono.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <path d="M48 15A22 22 0 1 0 48 49" stroke="currentColor" stroke-width="5.5" stroke-linecap="round"/>
  <circle cx="33" cy="32" r="11" stroke="currentColor" stroke-width="3.5"/>
  <path d="M26 26.5L33 38L40 26.5" stroke="currentColor" stroke-width="3.2" stroke-linecap="square" stroke-linejoin="miter"/>
</svg>
```

Create `favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <path d="M48 15A22 22 0 1 0 48 49" stroke="#6F83FF" stroke-width="7" stroke-linecap="round"/>
  <path d="M25 25L33 39L41 25" stroke="#6F83FF" stroke-width="5.5" stroke-linecap="square" stroke-linejoin="miter"/>
</svg>
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm --filter @codeomnivis/ui test -- __tests__/components/brandLogo.test.tsx`

Expected: PASS, all component and asset tests passed.

### Task 4: Replace legacy branding in the workbench

**Files:**
- Modify: `packages/ui/src/components/Header.tsx:7-8,58-61`
- Modify: `packages/ui/src/components/Workbench/ViewRail.tsx:1-4,21-23`
- Modify: `packages/ui/index.html:5`
- Modify: `packages/ui/__tests__/components/brandLogo.test.tsx`

- [ ] **Step 1: Add failing integration assertions**

Add these source-level assertions to the test file:

```tsx
describe('workbench brand integration', () => {
  const headerSource = readUiFile('../../src/components/Header.tsx')
  const viewRailSource = readUiFile('../../src/components/Workbench/ViewRail.tsx')
  const indexHtml = readUiFile('../../index.html')

  it('replaces both legacy CO badges with BrandLogo', () => {
    expect(headerSource).toContain("import { BrandLogo } from './BrandLogo'")
    expect(headerSource).toContain('<BrandLogo showWordmark')
    expect(viewRailSource).toContain("import { BrandLogo } from '../BrandLogo'")
    expect(viewRailSource).toContain('<BrandLogo')
    expect(headerSource).not.toContain('>CO<')
    expect(viewRailSource).not.toContain('>CO<')
  })

  it('uses the simplified brand favicon', () => {
    expect(indexHtml).toContain('href="/brand/favicon.svg"')
    expect(indexHtml).not.toContain('/vite.svg')
  })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @codeomnivis/ui test -- __tests__/components/brandLogo.test.tsx`

Expected: FAIL because Header, ViewRail, and `index.html` still use the legacy assets.

- [ ] **Step 3: Integrate BrandLogo**

In Header, render the horizontal lockup inside the existing heading:

```tsx
<h1 className="truncate text-xs text-content">
  <BrandLogo showWordmark markClassName="h-6 w-6" />
</h1>
```

In ViewRail, render the mark-only logo:

```tsx
<BrandLogo className="mb-3" markClassName="h-8 w-8" />
```

Update the document head:

```html
<link rel="icon" type="image/svg+xml" href="/brand/favicon.svg" />
```

- [ ] **Step 4: Run focused and full UI checks**

Run: `pnpm --filter @codeomnivis/ui test -- __tests__/components/brandLogo.test.tsx`

Expected: PASS.

Run: `pnpm --filter @codeomnivis/ui test`

Expected: all UI test files pass.

### Task 5: Validate the shipped experience

**Files:**
- Verify: `packages/ui/src/components/BrandLogo.tsx`
- Verify: `packages/ui/public/brand/*.svg`
- Verify: `packages/ui/src/components/Header.tsx`
- Verify: `packages/ui/src/components/Workbench/ViewRail.tsx`
- Verify: `packages/ui/index.html`

- [ ] **Step 1: Run static checks and production build**

Run:

```bash
pnpm --filter @codeomnivis/ui typecheck
pnpm --filter @codeomnivis/ui lint
pnpm --filter @codeomnivis/ui build
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 2: Inspect the running workbench in the browser**

At the current local UI URL, verify the Header lockup, the 32px ViewRail mark, the colored capital O, and the absence of legacy `CO` badges at desktop and narrow widths.

- [ ] **Step 3: Inspect runtime diagnostics**

Verify the browser console has no new error or warning caused by BrandLogo, favicon loading, theme changes, or language switching.

- [ ] **Step 4: Preserve the uncommitted handoff**

Run: `git status --short` and `git diff -- packages/ui/src/components/BrandLogo.tsx packages/ui/src/components/Header.tsx packages/ui/src/components/Workbench/ViewRail.tsx packages/ui/index.html packages/ui/__tests__/components/brandLogo.test.tsx packages/ui/public/brand`

Expected: only the intended brand changes appear in this scope. Do not create a commit unless the user explicitly asks for one.
