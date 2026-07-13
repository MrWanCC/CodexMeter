import { net, shell } from 'electron'
import crypto from 'node:crypto'
import http from 'node:http'
import { getCodexOAuth, saveCodexOAuth, type CodexOAuthToken } from './store.js'

const authorizationUrl = 'https://auth.openai.com/oauth/authorize'
const tokenUrl = 'https://auth.openai.com/oauth/token'
const clientId = 'app_EMoamEEZ73f0CkXaXp7hrann'
const redirectUri = 'http://localhost:1455/auth/callback'
const scopes = ['openid', 'email', 'profile', 'offline_access']
const oauthCallbackTimeoutMs = 5 * 60 * 1000
const tokenRefreshSkewMs = 60 * 1000

type CallbackWaiter = {
  promise: Promise<string>
  cancel: () => void
}

let activeCallbackWaiter: CallbackWaiter | undefined

export interface OAuthConnectionResult {
  connected: boolean
  email?: string
  error?: string
}

export async function startCodexOAuth(forceLogin = false): Promise<OAuthConnectionResult> {
  cancelCodexOAuth()
  const state = randomBase64Url(24)
  const verifier = randomBase64Url(32)
  const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest())
  const callbackWaiter = waitForCallback(state)
  activeCallbackWaiter = callbackWaiter

  const url = new URL(authorizationUrl)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', scopes.join(' '))
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  if (forceLogin) {
    url.searchParams.set('prompt', 'login')
  }

  await shell.openExternal(url.toString())
  try {
    const code = await callbackWaiter.promise
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
  } finally {
    if (activeCallbackWaiter === callbackWaiter) {
      activeCallbackWaiter = undefined
    }
  }
}

export function cancelCodexOAuth(): OAuthConnectionResult {
  activeCallbackWaiter?.cancel()
  activeCallbackWaiter = undefined
  return { connected: false, error: 'cancelled' }
}

export async function getUsableCodexOAuth(): Promise<CodexOAuthToken | undefined> {
  const token = getCodexOAuth()
  if (!token?.accessToken) {
    return undefined
  }

  const expiresAt = Date.parse(token.expiresAt)
  const hasKnownExpiry = Number.isFinite(expiresAt)
  if (hasKnownExpiry && Date.now() + tokenRefreshSkewMs < expiresAt) {
    return token
  }

  if (!token.refreshToken) {
    return hasKnownExpiry && Date.now() >= expiresAt ? undefined : token
  }

  try {
    return await refreshCodexOAuth(token)
  } catch (error) {
    console.warn('[oauth] refresh failed:', (error as Error).message)
    return hasKnownExpiry && Date.now() >= expiresAt ? undefined : token
  }
}

function waitForCallback(expectedState: string): CallbackWaiter {
  let cancel = () => {}
  const promise = new Promise<string>((resolve, reject) => {
    let settled = false
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
        finish(response, cleanup, reject, new Error(error))
        return
      }

      if (!code || state !== expectedState) {
        finish(response, cleanup, reject, new Error('OAuth callback is invalid.'))
        return
      }

      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      response.end('<p>CodexMeter 已连接，可以关闭此页面。</p>')
      cleanup(() => resolve(code))
    })

    const timeout = setTimeout(() => {
      cleanup(() => reject(new Error('OAuth authorization timed out.')))
    }, oauthCallbackTimeoutMs)

    cancel = () => {
      cleanup(() => reject(new Error('OAuth authorization cancelled.')))
    }

    function cleanup(callback: () => void): void {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timeout)
      if (server.listening) {
        server.close(() => callback())
      } else {
        callback()
      }
    }

    server.on('error', (error: NodeJS.ErrnoException) => {
      const message = error.code === 'EADDRINUSE'
        ? 'OAuth callback port 1455 is already in use.'
        : error.message
      cleanup(() => reject(new Error(message)))
    })
    // Keep the redirect URI as localhost, and accept whichever loopback address
    // the browser resolves it to on Windows.
    server.listen(1455)
  })

  return { promise, cancel }
}

async function refreshCodexOAuth(token: CodexOAuthToken): Promise<CodexOAuthToken> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: token.refreshToken
  })

  const response = await net.fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`)
  }

  const refreshed = (await response.json()) as {
    access_token: string
    refresh_token?: string
    id_token?: string
    expires_in: number
  }

  return saveCodexOAuth({
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? token.refreshToken,
    idToken: refreshed.id_token ?? token.idToken,
    expiresAt: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    email: readJwtClaim(refreshed.id_token ?? token.idToken, 'https://api.openai.com/profile', 'email') ?? token.email
  })
}

function finish(
  response: http.ServerResponse,
  cleanup: (callback: () => void) => void,
  reject: (reason?: unknown) => void,
  error: Error
): void {
  response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
  response.end(error.message)
  cleanup(() => reject(error))
}

async function exchangeCodeForToken(code: string, verifier: string) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier
  })

  const response = await net.fetch(tokenUrl, {
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
