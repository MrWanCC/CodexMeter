export type QuotaWindowCode = '5h' | '7d'

export interface QuotaWindow {
  code: QuotaWindowCode
  label: string
  used: number
  limit: number
  percentUsed: number
  resetAt?: string
}

export interface QuotaSnapshot {
  available: boolean
  refreshedAt: string
  windows: QuotaWindow[]
  source: 'sample' | 'codex' | 'unavailable'
  planType?: string
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
        planType: readPlanType(root)
      }
    : unavailableQuotaSnapshot(now)
}

export function sampleQuotaSnapshot(now = new Date()): QuotaSnapshot {
  const snapshot = parseQuotaPayload(
    {
      usage: {
        limits: [
          { window: '5h', used: 42, limit: 100 },
          { window: '7d', used: 70, limit: 200 }
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
