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
})
