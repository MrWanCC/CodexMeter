import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('software dashboard actions', () => {
  it('uses a crown for the plan and toggles the account connection', () => {
    const component = readFileSync(resolve(process.cwd(), 'src/renderer/App.vue'), 'utf8')

    expect(component).toContain('Crown,')
    expect(component).toContain('<Crown :size="13" :stroke-width="2" />')
    expect(component).toContain('function toggleAccountConnection(): void')
    expect(component).toContain('void connectOAuth()')
    expect(component).toContain('void disconnectOAuth()')
    expect(component).toContain('@click="toggleAccountConnection"')
    expect(component).toContain(':class="{ active: oauthConnected }"')
    expect(component).toContain('<span>连接</span>')
    expect(component).toContain("oauthConnected ? '断开' : '连接'")
    expect(component).not.toContain('@click="toggleHardwareConnection"')
  })
})
