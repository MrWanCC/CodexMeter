import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('dashboard information hierarchy', () => {
  it('uses consistent quota tiers and restrained supporting typography', () => {
    const component = readFileSync(resolve(process.cwd(), 'src/renderer/App.vue'), 'utf8')
    const css = readFileSync(resolve(process.cwd(), 'src/renderer/styles.css'), 'utf8')
    const footerValue = css.match(/body:not\(:has\(\.widget-shell\)\) \.quota-card-footer-value \{[\s\S]*?\}/g)?.at(-1)
    const resetMeta = css.match(/body:not\(:has\(\.widget-shell\)\) \.reset-card-meta div \{[\s\S]*?\}/g)?.at(-1)

    expect(component).toContain('const thresholds = [60, 30, 20, 10]')
    expect(component).toContain("attention: '注意'")
    expect(component).toContain("critical: '严重'")
    expect(footerValue).toContain('font-size: 9.5px')
    expect(footerValue).toContain('font-weight: 650')
    expect(resetMeta).toContain('font-size: 11.5px')
    expect(css).toContain('font-weight: 700;')
  })
})
