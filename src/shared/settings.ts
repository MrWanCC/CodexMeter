export type RefreshIntervalMinutes = 0 | 5 | 10

export interface AppSettings {
  refreshIntervalMinutes: RefreshIntervalMinutes
  hardwareDisplayEnabled: boolean
}

export const defaultSettings: AppSettings = {
  refreshIntervalMinutes: 5,
  hardwareDisplayEnabled: false
}

export function isRefreshIntervalMinutes(value: number): value is RefreshIntervalMinutes {
  return value === 0 || value === 5 || value === 10
}
