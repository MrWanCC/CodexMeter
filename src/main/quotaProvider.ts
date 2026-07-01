import { getCodexOAuth } from './store.js'
import { parseQuotaPayload, parseResetCreditsPayload, unavailableQuotaSnapshot, type QuotaSnapshot } from '../shared/quota.js'

const usageEndpoint = 'https://chatgpt.com/backend-api/wham/usage'
const resetCreditsEndpoint = 'https://chatgpt.com/backend-api/wham/rate-limit-reset-credits'

export async function fetchQuotaSnapshot(): Promise<QuotaSnapshot> {
  const token = getCodexOAuth()
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

  const response = await fetch(usageEndpoint, {
    method: 'GET',
    headers: sharedHeaders
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
}

async function fetchResetCards(headers: Record<string, string>): Promise<QuotaSnapshot['resetCards'] | undefined> {
  try {
    const response = await fetch(resetCreditsEndpoint, {
      method: 'GET',
      headers
    })
    if (!response.ok) {
      return undefined
    }

    return parseResetCreditsPayload(await response.json())
  } catch {
    return undefined
  }
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
