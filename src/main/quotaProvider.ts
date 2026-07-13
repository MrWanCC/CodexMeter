import { net } from 'electron'
import { getUsableCodexOAuth } from './oauth.js'
import { parseQuotaPayload, parseResetCreditsPayload, unavailableQuotaSnapshot, type QuotaSnapshot } from '../shared/quota.js'

const usageEndpoint = 'https://chatgpt.com/backend-api/wham/usage'
const resetCreditsEndpoint = 'https://chatgpt.com/backend-api/wham/rate-limit-reset-credits'

export async function fetchQuotaSnapshot(): Promise<QuotaSnapshot> {
  const token = await getUsableCodexOAuth()
  if (!token?.accessToken) {
    return unavailableQuotaSnapshot()
  }

  const accountId = readJwtClaim(token.accessToken, 'https://api.openai.com/auth', 'chatgpt_account_id')
  const sharedHeaders = {
    Authorization: `Bearer ${token.accessToken}`,
    Accept: 'application/json',
    'User-Agent': 'CodexMeter/0.1',
    'OpenAI-Beta': 'codex-1',
    originator: 'Codex Desktop',
    ...(accountId ? { 'ChatGPT-Account-Id': accountId } : {})
  }

  return await fetchWithRetry(async () => {
    const response = await net.fetch(usageEndpoint, {
      method: 'GET',
      headers: sharedHeaders,
      signal: AbortSignal.timeout(15_000)
    })

    if (!response.ok) {
      return {
        available: false,
        refreshedAt: new Date().toISOString(),
        windows: [],
        source: 'unavailable'
      }
    }

    const payload = await response.json()
    const snapshot = parseQuotaPayload(payload)
    const resetCards = await fetchResetCards(sharedHeaders)

    return {
      ...snapshot,
      resetCards: resetCards ?? snapshot.resetCards
    }
  }) ?? unavailableQuotaSnapshot()
}

async function fetchResetCards(headers: Record<string, string>): Promise<QuotaSnapshot['resetCards'] | undefined> {
  try {
    const response = await net.fetch(resetCreditsEndpoint, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10_000)
    })
    if (!response.ok) {
      return undefined
    }

    return parseResetCreditsPayload(await response.json())
  } catch {
    return undefined
  }
}

async function fetchWithRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 1000): Promise<T | undefined> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === retries) {
        console.warn(`[quota] fetch failed after ${retries + 1} attempts:`, (err as Error).message)
        return undefined
      }
      await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)))
    }
  }
  return undefined
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
