import { contextBridge, ipcRenderer } from 'electron'
import type { DisplayDevice } from '../shared/device.js'
import type { QuotaSnapshot } from '../shared/quota.js'
import type { AppSettings } from '../shared/settings.js'

const api = {
  refreshQuota: () => ipcRenderer.invoke('quota:refresh') as Promise<QuotaSnapshot>,
  getLatestQuota: () => ipcRenderer.invoke('quota:latest') as Promise<QuotaSnapshot>,
  getSettings: () => ipcRenderer.invoke('settings:get') as Promise<AppSettings>,
  saveRefreshInterval: (minutes: number) =>
    ipcRenderer.invoke('settings:saveRefreshInterval', minutes) as Promise<AppSettings>,
  listDevices: () => ipcRenderer.invoke('devices:list') as Promise<DisplayDevice[]>,
  getOAuthStatus: () => ipcRenderer.invoke('oauth:status') as Promise<{ connected: boolean; email?: string }>,
  connectOAuth: (forceLogin = false) =>
    ipcRenderer.invoke('oauth:connect', forceLogin) as Promise<{ connected: boolean; email?: string; error?: string }>,
  disconnectOAuth: () =>
    ipcRenderer.invoke('oauth:disconnect') as Promise<{ connected: boolean; snapshot: QuotaSnapshot }>,
  getWidgetState: () =>
    ipcRenderer.invoke('widget:state') as Promise<{ visible: boolean; alwaysOnTop: boolean }>,
  setWidgetVisible: (visible: boolean, alwaysOnTop: boolean) =>
    ipcRenderer.invoke('widget:setVisible', visible, alwaysOnTop) as Promise<{
      visible: boolean
      alwaysOnTop: boolean
    }>,
  setWidgetAlwaysOnTop: (enabled: boolean) =>
    ipcRenderer.invoke('widget:setAlwaysOnTop', enabled) as Promise<{
      visible: boolean
      alwaysOnTop: boolean
    }>,
  onQuotaUpdated: (callback: (snapshot: QuotaSnapshot) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: QuotaSnapshot) => callback(snapshot)
    ipcRenderer.on('quota:updated', listener)
    return () => ipcRenderer.removeListener('quota:updated', listener)
  }
}

contextBridge.exposeInMainWorld('codexMeter', api)

export type CodexMeterApi = typeof api
