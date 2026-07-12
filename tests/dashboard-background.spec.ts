import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('dashboard background', () => {
  it('uses a neutral cool surface without semantic green tinting', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/renderer/styles.css'), 'utf8')
    const appRule = css.match(/body:not\(:has\(\.widget-shell\)\) #app \{[\s\S]*?\}/g)?.at(-1)
    const quotaRule = css.match(/body:not\(:has\(\.widget-shell\)\) \.quota-glass-card \{[\s\S]*?\}/g)?.at(-1)
    const planBadgeRule = css.match(/body:not\(:has\(\.widget-shell\)\) \.dashboard-refresh \.plan-badge \{[\s\S]*?\}/g)?.at(-1)
    const resetCardRule = css.match(/body:not\(:has\(\.widget-shell\)\) \.dashboard-reset-card \{[\s\S]*?\}/g)?.at(-1)
    const resetDecorationRule = css.match(/body:not\(:has\(\.widget-shell\)\) \.reset-card-decoration \{[\s\S]*?\}/g)?.at(-1)

    expect(appRule).toContain('#f7fbff')
    expect(appRule).toContain('#edf4fb')
    expect(appRule).not.toContain('220, 252, 245')
    expect(quotaRule).not.toContain('var(--quota-color) 8%')
    expect(planBadgeRule).toContain('rgba(239, 246, 255, 0.82)')
    expect(planBadgeRule).not.toContain('255, 247, 214')
    expect(planBadgeRule).toContain('box-shadow: none')
    expect(resetCardRule).not.toContain('linear-gradient(115deg')
    expect(resetCardRule).not.toContain('radial-gradient(circle at 72%')
    expect(resetDecorationRule).toContain('display: none')
  })
})
