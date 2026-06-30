import { describe, expect, it } from 'vitest'
import { parseQuotaPayload } from '../src/shared/quota'

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
      { code: '5h', label: '5 hour window', used: 42, limit: 100, percentUsed: 42 },
      { code: '7d', label: '7 day window', used: 70, limit: 200, percentUsed: 35 }
    ])
  })
})

