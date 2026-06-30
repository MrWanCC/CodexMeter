import { describe, expect, it } from 'vitest'
import { defaultSettings, isRefreshIntervalMinutes } from '../src/shared/settings'

describe('isRefreshIntervalMinutes', () => {
  it('defaults to refreshing every 5 minutes', () => {
    expect(defaultSettings.refreshIntervalMinutes).toBe(5)
  })

  it.each([0, 5, 10])('accepts %s minutes', (minutes) => {
    expect(isRefreshIntervalMinutes(minutes)).toBe(true)
  })

  it.each([1, 2, 3, 4])('rejects %s minutes', (minutes) => {
    expect(isRefreshIntervalMinutes(minutes)).toBe(false)
  })
})
