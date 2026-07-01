export type QuotaWindowCode = '5h' | '7d'

export interface QuotaWindow {
  code: QuotaWindowCode
  label: string
  used: number
  limit: number
  percentUsed: number
  resetAt?: string
}

export interface ResetCard {
  id: string
  expiresAt: string
  grantedAt?: string
  status?: string
}

export interface QuotaSnapshot {
  available: boolean
  refreshedAt: string
  windows: QuotaWindow[]
  source: 'sample' | 'codex' | 'unavailable'
  planType?: string
  resetCards?: ResetCard[]
}

export function parseQuotaPayload(payload: unknown, now = new Date()): QuotaSnapshot {
  if (!payload || typeof payload !== 'object') {
    return unavailableSnapshot(now)
  }

  const root = payload as Record<string, unknown>
  const usage = isRecord(root.usage) ? root.usage : root
  const limits = Array.isArray(usage.limits) ? usage.limits : []
  const windows = [
    ...limits.map((limit) => readQuotaWindow(limit, now)),
    ...readRateLimitWindows(root).map((limit) => readQuotaWindow(limit, now))
  ].filter((window): window is QuotaWindow => window !== null)

  return windows.length > 0
    ? {
        available: true,
        refreshedAt: now.toISOString(),
        windows,
        source: 'codex',
        planType: readPlanType(root),
        resetCards: readResetCards(root, now)
      }
    : unavailableQuotaSnapshot(now)
}

export function sampleQuotaSnapshot(now = new Date()): QuotaSnapshot {
  const fiveHourReset = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString()
  const sevenDayReset = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString()

  const snapshot = parseQuotaPayload(
    {
      plan_type: 'plus',
      usage: {
        limits: [
          { window: '5h', used: 42, limit: 100, reset_at: fiveHourReset },
          { window: '7d', used: 70, limit: 200, reset_at: sevenDayReset }
        ],
        renewal_credits: [
          { expires_at: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString() },
          { expires_at: new Date(now.getTime() + 32 * 24 * 60 * 60 * 1000).toISOString() },
          { expires_at: new Date(now.getTime() + 58 * 24 * 60 * 60 * 1000).toISOString() }
        ]
      }
    },
    now
  )

  return {
    ...snapshot,
    source: snapshot.available ? 'sample' : snapshot.source
  }
}

export function parseResetCreditsPayload(payload: unknown, now = new Date()): ResetCard[] {
  if (!payload || typeof payload !== 'object') {
    return []
  }

  const root = payload as Record<string, unknown>
  const raw = root.credits ?? root.reset_credits ?? root.resetCredits ?? root.data
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .map((item, index) => readResetCard(item, index, now))
    .filter((card): card is ResetCard => card !== null)
    .filter((card) => isAvailableResetCard(card, now))
}

function unavailableSnapshot(now: Date): QuotaSnapshot {
  return unavailableQuotaSnapshot(now)
}

export function unavailableQuotaSnapshot(now = new Date()): QuotaSnapshot {
  return {
    available: false,
    refreshedAt: now.toISOString(),
    windows: [],
    source: 'unavailable'
  }
}

function readQuotaWindow(input: unknown, now: Date): QuotaWindow | null {
  if (!isRecord(input)) {
    return null
  }

  const code = input.window
  const used = Number(input.used)
  const limit = Number(input.limit)

  if ((code !== '5h' && code !== '7d') || !Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) {
    return null
  }

  return {
    code,
    label: code === '5h' ? '5 hour window' : '7 day window',
    used,
    limit,
    percentUsed: Math.round((used / limit) * 10000) / 100,
    resetAt: readResetAt(input, now)
  }
}

function readRateLimitWindows(root: Record<string, unknown>): unknown[] {
  const rateLimit = root.rate_limit
  if (!isRecord(rateLimit)) {
    return []
  }

  return [
    readRateLimitWindow(rateLimit.primary_window, '5h'),
    readRateLimitWindow(rateLimit.secondary_window, '7d')
  ].filter((window): window is Record<string, unknown> => window !== null)
}

function readRateLimitWindow(input: unknown, fallbackCode: QuotaWindowCode): Record<string, unknown> | null {
  if (!isRecord(input)) {
    return null
  }

  const seconds = Number(input.limit_window_seconds)
  const code = Math.abs(seconds - 18000) <= 60 ? '5h' : Math.abs(seconds - 604800) <= 3600 ? '7d' : fallbackCode

  return {
    window: code,
    used: input.used_percent,
    limit: 100,
    reset_at: input.reset_at ?? input.resets_at,
    reset_after_seconds: input.reset_after_seconds ?? input.reset_after
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readPlanType(root: Record<string, unknown>): string | undefined {
  const planType = root.plan_type ?? root.planType
  return typeof planType === 'string' && planType.trim() ? planType : undefined
}

function readResetCards(root: Record<string, unknown>, now: Date): ResetCard[] {
  // 在 root 和 usage 两个层级查找
  const sources = [root, isRecord(root.usage) ? root.usage : null].filter(Boolean) as Record<string, unknown>[]

  for (const src of sources) {
    const raw = src.renewal_credits ?? src.renewalCredits
      ?? src.reset_credits ?? src.resetCredits
      ?? src.bonus_credits ?? src.bonusCredits
      ?? src.gift_credits ?? src.giftCredits

    if (Array.isArray(raw)) {
      return raw
        .map((item, index) => readResetCard(item, index, now))
        .filter((card): card is ResetCard => card !== null)
        .filter((card) => isAvailableResetCard(card, now))
    }
  }

  return []
}

function readResetCard(input: unknown, index: number, now: Date): ResetCard | null {
  if (!isRecord(input)) {
    return null
  }

  const expiresAt = readResetCardExpiry(input, now)
  if (!expiresAt) {
    return null
  }

  const idValue = input.id ?? input.credit_id ?? input.creditId ?? input.reset_credit_id ?? input.resetCreditId
  const id = typeof idValue === 'string' && idValue.trim() ? idValue : `card-${index}`
  const grantedAt = readDateValue(input.granted_at ?? input.grantedAt)
  const statusValue = input.status ?? input.state
  const status = typeof statusValue === 'string' && statusValue.trim() ? statusValue : undefined
  return { id, expiresAt, grantedAt, status }
}

function readResetCardExpiry(input: Record<string, unknown>, now: Date): string | undefined {
  const direct = input.expires_at ?? input.expiresAt ?? input.expires ?? input.expiry
  return readDateValue(direct)
}

function readDateValue(input: unknown): string | undefined {
  const directNumber = Number(input)
  if (Number.isFinite(directNumber) && directNumber > 0) {
    const milliseconds = directNumber > 10_000_000_000 ? directNumber : directNumber * 1000
    return new Date(milliseconds).toISOString()
  }

  if (typeof input === 'string') {
    const date = new Date(input)
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString()
    }
  }

  return undefined
}

function isAvailableResetCard(card: ResetCard, now: Date): boolean {
  const expiresAt = new Date(card.expiresAt)
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) {
    return false
  }

  const status = card.status?.toLowerCase()
  return !status || !['redeemed', 'used', 'consumed', 'expired', 'unavailable'].includes(status)
}
function readResetAt(input: Record<string, unknown>, now: Date): string | undefined {
  const direct = input.resetAt ?? input.reset_at ?? input.resets_at
  const directNumber = Number(direct)
  if (Number.isFinite(directNumber) && directNumber > 0) {
    const milliseconds = directNumber > 10_000_000_000 ? directNumber : directNumber * 1000
    return new Date(milliseconds).toISOString()
  }

  if (typeof direct === 'string') {
    const date = new Date(direct)
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString()
    }
  }

  const resetAfter = Number(input.reset_after_seconds ?? input.reset_after)
  if (Number.isFinite(resetAfter) && resetAfter > 0) {
    return new Date(now.getTime() + resetAfter * 1000).toISOString()
  }

  return undefined
}
