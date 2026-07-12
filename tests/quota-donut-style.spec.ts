import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('dashboard quota donut', () => {
  it('draws the white center in the same SVG coordinate system as the ring', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/renderer/styles.css'), 'utf8')
    const component = readFileSync(resolve(process.cwd(), 'src/renderer/App.vue'), 'utf8')
    const finalDonutRule = css.match(/body:not\(:has\(\.widget-shell\)\) \.quota-donut \{[\s\S]*?\}/g)?.at(-1)
    const finalOverlayRule = css.match(/body:not\(:has\(\.widget-shell\)\) \.quota-donut::after \{[\s\S]*?\}/g)?.at(-1)

    expect(component.match(/class="quota-donut-center"/g)).toHaveLength(2)
    expect(css).toContain('.quota-donut-center')
    expect(finalDonutRule).toContain('background: transparent')
    expect(finalDonutRule).toContain('overflow: visible')
    expect(finalOverlayRule).toContain('display: none')
  })
})
