import { describe, expect, it } from 'vitest'
import { defaultSettings, isRefreshIntervalMinutes, normalizeHardwareEndpoint } from '../src/shared/settings'

describe('isRefreshIntervalMinutes', () => {
  it('defaults to refreshing every 5 minutes', () => {
    expect(defaultSettings.refreshIntervalMinutes).toBe(5)
  })

  it('enables hardware auto sync by default', () => {
    expect(defaultSettings.hardwareDisplayEnabled).toBe(true)
  })

  it.each([0, 5, 10])('accepts %s minutes', (minutes) => {
    expect(isRefreshIntervalMinutes(minutes)).toBe(true)
  })

  it.each([1, 2, 3, 4])('rejects %s minutes', (minutes) => {
    expect(isRefreshIntervalMinutes(minutes)).toBe(false)
  })
})

describe('normalizeHardwareEndpoint', () => {
  it('keeps empty endpoint disabled', () => {
    expect(normalizeHardwareEndpoint('')).toBeUndefined()
    expect(normalizeHardwareEndpoint('   ')).toBeUndefined()
  })

  it('adds http protocol when the user enters an IP address', () => {
    expect(normalizeHardwareEndpoint('192.168.1.120')).toBe('http://192.168.1.120')
  })

  it('removes trailing slashes', () => {
    expect(normalizeHardwareEndpoint('http://192.168.1.120/')).toBe('http://192.168.1.120')
  })

  it('rejects unsupported protocols', () => {
    expect(() => normalizeHardwareEndpoint('ftp://192.168.1.120')).toThrow('Unsupported hardware endpoint')
  })
})
