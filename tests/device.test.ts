import { describe, expect, it } from 'vitest'
import { buildBleUsagePayload, buildEsp32QuotaPayload } from '../src/shared/device'
import type { QuotaSnapshot } from '../src/shared/quota'

describe('buildEsp32QuotaPayload', () => {
  it('maps quota snapshot into ESP32 HTTP payload', () => {
    const snapshot: QuotaSnapshot = {
      available: true,
      refreshedAt: '2026-07-01T07:27:08.000Z',
      source: 'codex',
      planType: 'plus',
      windows: [
        {
          code: '5h',
          label: '5 hour window',
          used: 4,
          limit: 100,
          percentUsed: 4,
          resetAt: '2026-07-01T10:59:00.000Z'
        },
        {
          code: '7d',
          label: '7 day window',
          used: 62,
          limit: 100,
          percentUsed: 62,
          resetAt: '2026-07-07T02:18:00.000Z'
        }
      ]
    }

    expect(buildEsp32QuotaPayload(snapshot, new Date('2026-07-01T07:30:00.000Z'))).toEqual({
      type: 'quota',
      version: 1,
      plan: 'Codex Plus',
      lastRefresh: '15:27',
      fiveHour: {
        remaining: 96,
        used: 4,
        reset: '18:59',
        status: 'enough',
        label: '充足'
      },
      weekly: {
        remaining: 38,
        used: 62,
        reset: '07/07 10:18',
        status: 'watch',
        label: '关注'
      }
    })
  })

  it('uses empty defaults when a quota window is unavailable', () => {
    const snapshot: QuotaSnapshot = {
      available: false,
      refreshedAt: '2026-07-01T07:27:08.000Z',
      source: 'unavailable',
      windows: []
    }

    expect(buildEsp32QuotaPayload(snapshot, new Date('2026-07-01T07:30:00.000Z'))).toMatchObject({
      plan: 'Codex',
      fiveHour: {
        remaining: 0,
        used: 0,
        reset: '--',
        status: 'empty',
        label: '已耗尽'
      },
      weekly: {
        remaining: 0,
        used: 0,
        reset: '--',
        status: 'empty',
        label: '已耗尽'
      }
    })
  })

  it('maps quota snapshot into compact BLE payload', () => {
    const snapshot: QuotaSnapshot = {
      available: true,
      refreshedAt: '2026-07-01T07:27:08.000Z',
      source: 'codex',
      planType: 'plus',
      windows: [
        {
          code: '5h',
          label: '5 hour window',
          used: 4,
          limit: 100,
          percentUsed: 4,
          resetAt: '2026-07-01T10:59:00.000Z'
        },
        {
          code: '7d',
          label: '7 day window',
          used: 62,
          limit: 100,
          percentUsed: 62,
          resetAt: '2026-07-07T02:18:00.000Z'
        }
      ]
    }

    expect(buildBleUsagePayload(snapshot, new Date('2026-07-01T07:30:00.000Z'))).toEqual({
      t: '15:30',
      p: 'Plus',
      h: 96,
      hr: '18:59',
      w: 38,
      wr: '07/07 10:18'
    })
  })
})
