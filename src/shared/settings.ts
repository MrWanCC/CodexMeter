export type RefreshIntervalMinutes = 0 | 1 | 3 | 5

export interface AppSettings {
  refreshIntervalMinutes: RefreshIntervalMinutes
  hardwareDisplayEnabled: boolean
}

export const defaultSettings: AppSettings = {
  refreshIntervalMinutes: 0,
  hardwareDisplayEnabled: false
}

export function isRefreshIntervalMinutes(value: number): value is RefreshIntervalMinutes {
  return value === 0 || value === 1 || value === 3 || value === 5
}

