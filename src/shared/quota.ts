export type QuotaWindowCode = '5h' | '7d'

export interface QuotaWindow {
  code: QuotaWindowCode
  label: string
  used: number
  limit: number
  percentUsed: number
}

export interface QuotaSnapshot {
  available: boolean
  refreshedAt: string
  windows: QuotaWindow[]
  source: 'sample' | 'codex' | 'unavailable'
}

export function parseQuotaPayload(payload: unknown, now = new Date()): QuotaSnapshot {
  if (!payload || typeof payload !== 'object') {
    return unavailableSnapshot(now)
  }

  const root = payload as Record<string, unknown>
  const usage = isRecord(root.usage) ? root.usage : root
  const limits = Array.isArray(usage.limits) ? usage.limits : []
  const windows = limits
    .map(readQuotaWindow)
    .filter((window): window is QuotaWindow => window !== null)

  return windows.length > 0
    ? {
        available: true,
        refreshedAt: now.toISOString(),
        windows,
        source: 'codex'
      }
    : unavailableSnapshot(now)
}

export function sampleQuotaSnapshot(now = new Date()): QuotaSnapshot {
  return parseQuotaPayload(
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
}

function unavailableSnapshot(now: Date): QuotaSnapshot {
  return {
    available: false,
    refreshedAt: now.toISOString(),
    windows: [],
    source: 'unavailable'
  }
}

function readQuotaWindow(input: unknown): QuotaWindow | null {
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
    percentUsed: Math.round((used / limit) * 10000) / 100
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

