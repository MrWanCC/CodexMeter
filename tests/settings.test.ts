import { describe, expect, it } from 'vitest'
import { isRefreshIntervalMinutes } from '../src/shared/settings'

describe('isRefreshIntervalMinutes', () => {
  it.each([0, 1, 3, 5])('accepts %s minutes', (minutes) => {
    expect(isRefreshIntervalMinutes(minutes)).toBe(true)
  })

  it.each([2, 4, 10])('rejects %s minutes', (minutes) => {
    expect(isRefreshIntervalMinutes(minutes)).toBe(false)
  })
})

