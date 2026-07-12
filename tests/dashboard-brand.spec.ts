import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('dashboard brand', () => {
  it('keeps the product title secondary to the quota content', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/renderer/styles.css'), 'utf8')
    const titleRule = css.match(/body:not\(:has\(\.widget-shell\)\) \.dashboard-brand strong \{[\s\S]*?\}/g)?.at(-1)

    expect(titleRule).toContain('font-size: 22px')
  })
})
