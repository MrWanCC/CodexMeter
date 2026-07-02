export type RefreshIntervalMinutes = 0 | 5 | 10

export interface AppSettings {
  refreshIntervalMinutes: RefreshIntervalMinutes
  hardwareDisplayEnabled: boolean
  hardwareEndpoint?: string
}

export const defaultSettings: AppSettings = {
  refreshIntervalMinutes: 5,
  hardwareDisplayEnabled: true
}

export function isRefreshIntervalMinutes(value: number): value is RefreshIntervalMinutes {
  return value === 0 || value === 5 || value === 10
}

export function normalizeHardwareEndpoint(input: string | undefined): string | undefined {
  const value = input?.trim()
  if (!value) {
    return undefined
  }

  const withProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(value) ? value : `http://${value}`
  const url = new URL(withProtocol)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsupported hardware endpoint: ${input}`)
  }

  url.pathname = url.pathname.replace(/\/+$/, '')
  url.search = ''
  url.hash = ''

  return url.toString().replace(/\/$/, '')
}
