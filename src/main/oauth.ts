import { shell } from 'electron'
import crypto from 'node:crypto'
import http from 'node:http'
import { saveCodexOAuth } from './store.js'

const authorizationUrl = 'https://auth.openai.com/oauth/authorize'
const tokenUrl = 'https://auth.openai.com/oauth/token'
const clientId = 'app_EMoamEEZ73f0CkXaXp7hrann'
const redirectUri = 'http://localhost:1455/auth/callback'
const scopes = ['openid', 'email', 'profile', 'offline_access']

export interface OAuthConnectionResult {
  connected: boolean
  email?: string
  error?: string
}

export async function startCodexOAuth(): Promise<OAuthConnectionResult> {
  const state = randomBase64Url(24)
  const verifier = randomBase64Url(32)
  const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest())
  const callbackPromise = waitForCallback(state)

  const url = new URL(authorizationUrl)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', scopes.join(' '))
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')

  await shell.openExternal(url.toString())
  const code = await callbackPromise
  const token = await exchangeCodeForToken(code, verifier)
  const email = readJwtClaim(token.id_token, 'https://api.openai.com/profile', 'email')

  saveCodexOAuth({
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    idToken: token.id_token,
    expiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    email
  })

  return { connected: true, email }
}

function waitForCallback(expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const requestUrl = new URL(request.url ?? '/', redirectUri)

      if (requestUrl.pathname !== '/auth/callback') {
        response.writeHead(404)
        response.end('Not found')
        return
      }

      const error = requestUrl.searchParams.get('error')
      const code = requestUrl.searchParams.get('code')
      const state = requestUrl.searchParams.get('state')

      if (error) {
        finish(response, server, reject, new Error(error))
        return
      }

      if (!code || state !== expectedState) {
        finish(response, server, reject, new Error('OAuth callback is invalid.'))
        return
      }

      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      response.end('<p>CodexMeter 已连接，可以关闭此页面。</p>')
      server.close()
      resolve(code)
    })

    server.on('error', reject)
    server.listen(1455, '127.0.0.1')
  })
}

function finish(
  response: http.ServerResponse,
  server: http.Server,
  reject: (reason?: unknown) => void,
  error: Error
): void {
  response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
  response.end(error.message)
  server.close()
  reject(error)
}

async function exchangeCodeForToken(code: string, verifier: string) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier
  })

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status}`)
  }

  return (await response.json()) as {
    access_token: string
    refresh_token: string
    id_token?: string
    expires_in: number
  }
}

function randomBase64Url(byteCount: number): string {
  return base64Url(crypto.randomBytes(byteCount))
}

function base64Url(buffer: Buffer): string {
  return buffer.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function readJwtClaim(token: string | undefined, namespace: string, claim: string): string | undefined {
  if (!token) {
    return undefined
  }

  const payload = token.split('.')[1]
  if (!payload) {
    return undefined
  }

  try {
    const normalized = payload.replaceAll('-', '+').replaceAll('_', '/')
    const json = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8')) as Record<string, unknown>
    const group = json[namespace] as Record<string, unknown> | undefined
    const value = group?.[claim]
    return typeof value === 'string' ? value : undefined
  } catch {
    return undefined
  }
}
