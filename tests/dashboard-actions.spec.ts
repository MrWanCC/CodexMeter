import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('software dashboard actions', () => {
  it('uses a crown for the plan and toggles the connection control', () => {
    const component = readFileSync(resolve(process.cwd(), 'src/renderer/App.vue'), 'utf8')

    expect(component).toContain('Crown,')
    expect(component).toContain('<Crown :size="13" :stroke-width="2" />')
    expect(component).toContain('function toggleHardwareConnection(): void')
    expect(component).toContain('void disconnectHardwareDisplay()')
    expect(component).toContain('@click="toggleHardwareConnection"')
    expect(component).toContain('<span>连接</span>')
    expect(component).not.toContain('<span>外接屏</span>')
  })
})
