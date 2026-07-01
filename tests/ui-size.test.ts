import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const mainSource = readFileSync('src/main/index.ts', 'utf8')
const stylesSource = readFileSync('src/renderer/styles.css', 'utf8')

function numericProperty(source: string, property: string): number {
  const match = source.match(new RegExp(`${property}:\\s*(\\d+)`))
  if (!match) {
    throw new Error(`Missing numeric property: ${property}`)
  }

  return Number(match[1])
}

function selectorNumericProperty(source: string, selector: string, property: string): number {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{[^}]*${property}:\\s*(\\d+)`, 's'))
  if (!match) {
    throw new Error(`Missing ${property} for selector: ${selector}`)
  }

  return Number(match[1])
}

describe('desktop sizing', () => {
  it('keeps the main window at tool-window scale', () => {
    expect(numericProperty(mainSource, 'width')).toBeLessThanOrEqual(920)
    expect(numericProperty(mainSource, 'height')).toBeLessThanOrEqual(580)
  })

  it('keeps the desktop composition compact', () => {
    expect(selectorNumericProperty(stylesSource, 'body:not(:has(.widget-shell)) .hero-mark', 'width')).toBeLessThanOrEqual(64)
    expect(selectorNumericProperty(stylesSource, 'body:not(:has(.widget-shell)) .hero-main h1', 'font-size')).toBeLessThanOrEqual(28)
    expect(selectorNumericProperty(stylesSource, '.usage-card', 'padding')).toBeLessThanOrEqual(10)
  })

  it('keeps the reset card menu above the quota section', () => {
    expect(selectorNumericProperty(stylesSource, '.desktop-hero', 'z-index')).toBeGreaterThanOrEqual(10)
    expect(selectorNumericProperty(stylesSource, '.reset-card-panel', 'z-index')).toBeGreaterThanOrEqual(30)
    expect(stylesSource).toContain('overflow: visible;')
  })
})
