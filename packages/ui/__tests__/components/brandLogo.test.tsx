import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BrandLogo } from '../../src/components/BrandLogo'

const readUiFile = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

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
