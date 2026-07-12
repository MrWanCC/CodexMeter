import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('quota card footer', () => {
  it('shows compact remaining-quota indicators for both quota windows', () => {
    const component = readFileSync(resolve(process.cwd(), 'src/renderer/App.vue'), 'utf8')
    const footers = component.match(/<div class="quota-card-footer">[\s\S]*?<\/div>\s*<\/div>\s*<strong class="quota-card-footer-value">[\s\S]*?<\/strong>\s*<\/div>/g) ?? []

    expect(footers).toHaveLength(2)
    expect(footers[0]).toContain('5H 剩余')
    expect(footers[1]).toContain('7D 剩余')
    expect(footers.every((footer) => footer.includes('remainingPercent('))).toBe(true)
    expect(footers.every((footer) => !footer.includes('usedPercent('))).toBe(true)
    expect(footers.every((footer) => footer.includes('quota-card-footer-value'))).toBe(true)
  })
})
