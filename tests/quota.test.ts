import { describe, expect, it } from 'vitest'
import { parseQuotaPayload, parseResetCreditsPayload } from '../src/shared/quota'

describe('parseQuotaPayload', () => {
  it('returns unavailable state for invalid payloads', () => {
    const snapshot = parseQuotaPayload(null, new Date('2026-06-30T00:00:00Z'))

    expect(snapshot.available).toBe(false)
    expect(snapshot.windows).toEqual([])
    expect(snapshot.source).toBe('unavailable')
  })

  it('extracts verified quota windows', () => {
    const snapshot = parseQuotaPayload(
      {
        usage: {
          limits: [
            { window: '5h', used: 42, limit: 100 },
            { window: '7d', used: 70, limit: 200 }
          ]
        }
      },
      new Date('2026-06-30T00:00:00Z')
    )

    expect(snapshot.available).toBe(true)
    expect(snapshot.windows).toEqual([
      { code: '5h', label: '5 hour window', used: 42, limit: 100, percentUsed: 42, resetAt: undefined },
      { code: '7d', label: '7 day window', used: 70, limit: 200, percentUsed: 35, resetAt: undefined }
    ])
  })

  it('extracts Codex wham usage rate limit windows', () => {
    const snapshot = parseQuotaPayload(
      {
        rate_limit: {
          primary_window: {
            used_percent: 18.5,
            limit_window_seconds: 18000,
            reset_at: 1_798_750_800
          },
          secondary_window: {
            used_percent: 44,
            limit_window_seconds: 604800,
            reset_at: '2027-01-07T08:00:00.000Z'
          }
        },
        plan_type: 'plus'
      },
      new Date('2026-06-30T00:00:00Z')
    )

    expect(snapshot.available).toBe(true)
    expect(snapshot.planType).toBe('plus')
    expect(snapshot.windows).toEqual([
      {
        code: '5h',
        label: '5 hour window',
        used: 18.5,
        limit: 100,
        percentUsed: 18.5,
        resetAt: '2026-12-31T21:00:00.000Z'
      },
      {
        code: '7d',
        label: '7 day window',
        used: 44,
        limit: 100,
        percentUsed: 44,
        resetAt: '2027-01-07T08:00:00.000Z'
      }
    ])
  })

  it('keeps weekly remaining percentages available for UI state thresholds', () => {
    const snapshot = parseQuotaPayload(
      {
        rate_limit: {
          secondary_window: {
            used_percent: 61,
            limit_window_seconds: 604800
          }
        }
      },
      new Date('2026-07-01T00:00:00Z')
    )

    expect(snapshot.windows).toEqual([
      {
        code: '7d',
        label: '7 day window',
        used: 61,
        limit: 100,
        percentUsed: 61,
        resetAt: undefined
      }
    ])
  })
})

describe('parseResetCreditsPayload', () => {
  it('extracts available reset credits from the dedicated endpoint payload', () => {
    const cards = parseResetCreditsPayload(
      {
        available_count: 2,
        credits: [
          {
            id: 'credit-a',
            granted_at: '2026-06-17T00:00:00.000Z',
            expires_at: '2026-07-17T00:00:00.000Z',
            status: 'available'
          },
          {
            id: 'credit-b',
            expires_at: '2026-07-18T00:00:00.000Z'
          }
        ]
      },
      new Date('2026-07-01T00:00:00.000Z')
    )

    expect(cards).toEqual([
      {
        id: 'credit-a',
        grantedAt: '2026-06-17T00:00:00.000Z',
        expiresAt: '2026-07-17T00:00:00.000Z',
        status: 'available'
      },
      {
        id: 'credit-b',
        expiresAt: '2026-07-18T00:00:00.000Z',
        grantedAt: undefined,
        status: undefined
      }
    ])
  })

  it('filters expired and redeemed reset credits', () => {
    const cards = parseResetCreditsPayload(
      {
        credits: [
          { id: 'expired', expires_at: '2026-06-30T00:00:00.000Z' },
          { id: 'used', expires_at: '2026-07-20T00:00:00.000Z', status: 'redeemed' },
          { id: 'valid', expires_at: '2026-07-21T00:00:00.000Z', status: 'available' }
        ]
      },
      new Date('2026-07-01T00:00:00.000Z')
    )

    expect(cards.map((card) => card.id)).toEqual(['valid'])
  })
})
