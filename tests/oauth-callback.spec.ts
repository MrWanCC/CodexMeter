import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('oauth callback server', () => {
  it('does not pin the localhost callback listener to IPv4 only', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/main/oauth.ts'), 'utf8')

    expect(source).toContain("const redirectUri = 'http://localhost:1455/auth/callback'")
    expect(source).not.toContain("server.listen(1455, '127.0.0.1')")
  })

  it('allows enough time for browser login before timing out', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/main/oauth.ts'), 'utf8')

    expect(source).toContain('const oauthCallbackTimeoutMs = 5 * 60 * 1000')
  })

  it('reports local callback port conflicts clearly', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/main/oauth.ts'), 'utf8')

    expect(source).toContain('OAuth callback port 1455 is already in use.')
  })

  it('refreshes stored OAuth tokens before quota requests', () => {
    const oauthSource = readFileSync(resolve(process.cwd(), 'src/main/oauth.ts'), 'utf8')
    const quotaSource = readFileSync(resolve(process.cwd(), 'src/main/quotaProvider.ts'), 'utf8')

    expect(oauthSource).toContain("grant_type: 'refresh_token'")
    expect(quotaSource).toContain('getUsableCodexOAuth()')
  })

  it('uses Electron networking so OAuth and quota requests honor the system proxy', () => {
    const oauthSource = readFileSync(resolve(process.cwd(), 'src/main/oauth.ts'), 'utf8')
    const quotaSource = readFileSync(resolve(process.cwd(), 'src/main/quotaProvider.ts'), 'utf8')

    expect(oauthSource).toContain("import { net, shell } from 'electron'")
    expect(quotaSource).toContain("import { net } from 'electron'")
    expect(oauthSource).not.toMatch(/(?<!\.)\bfetch\(/)
    expect(quotaSource).not.toMatch(/(?<!\.)\bfetch\(/)
    expect(oauthSource.match(/net\.fetch\(/g)).toHaveLength(2)
    expect(quotaSource.match(/net\.fetch\(/g)).toHaveLength(2)
  })
})
