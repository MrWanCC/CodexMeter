import { contextBridge, ipcRenderer } from 'electron'
import type { DisplayDevice } from '../shared/device.js'
import type { QuotaSnapshot } from '../shared/quota.js'
import type { AppSettings } from '../shared/settings.js'

const api = {
  refreshQuota: () => ipcRenderer.invoke('quota:refresh') as Promise<QuotaSnapshot>,
  getSettings: () => ipcRenderer.invoke('settings:get') as Promise<AppSettings>,
  saveRefreshInterval: (minutes: number) =>
    ipcRenderer.invoke('settings:saveRefreshInterval', minutes) as Promise<AppSettings>,
  listDevices: () => ipcRenderer.invoke('devices:list') as Promise<DisplayDevice[]>,
  getOAuthStatus: () => ipcRenderer.invoke('oauth:status') as Promise<{ connected: boolean; email?: string }>,
  connectOAuth: () => ipcRenderer.invoke('oauth:connect') as Promise<{ connected: boolean; email?: string; error?: string }>
}

contextBridge.exposeInMainWorld('codexMeter', api)

export type CodexMeterApi = typeof api
