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
  saveHardwareDisplay: (enabled: boolean, endpoint?: string) =>
    ipcRenderer.invoke('settings:saveHardwareDisplay', enabled, endpoint) as Promise<AppSettings>,
  listDevices: () => ipcRenderer.invoke('devices:list') as Promise<DisplayDevice[]>,
  pingHardwareDisplay: (endpoint: string) =>
    ipcRenderer.invoke('devices:ping', endpoint) as Promise<{ connected: boolean }>,
  pushHardwareTest: (endpoint: string) =>
    ipcRenderer.invoke('devices:pushTest', endpoint) as Promise<{ pushed: boolean; pushedAt: string }>,
  pushLatestToDevice: () => ipcRenderer.invoke('devices:pushLatest') as Promise<{ pushed: boolean; pushedAt: string }>,
  getOAuthStatus: () => ipcRenderer.invoke('oauth:status') as Promise<{ connected: boolean; email?: string }>,
  connectOAuth: (forceLogin = false) =>
    ipcRenderer.invoke('oauth:connect', forceLogin) as Promise<{ connected: boolean; email?: string; error?: string }>,
  cancelOAuth: () => ipcRenderer.invoke('oauth:cancel') as Promise<{ connected: boolean; error?: string }>,
  disconnectOAuth: () =>
    ipcRenderer.invoke('oauth:disconnect') as Promise<{ connected: boolean; snapshot: QuotaSnapshot }>,
  getWidgetState: () =>
    ipcRenderer.invoke('widget:state') as Promise<{ visible: boolean; alwaysOnTop: boolean; expanded: boolean }>,
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
  setWidgetExpanded: (expanded: boolean) =>
    ipcRenderer.invoke('widget:setExpanded', expanded) as Promise<{ expanded: boolean }>,
  sendWidgetPointer: (input: {
    type: 'down' | 'move' | 'up' | 'cancel'
    x: number
    y: number
    localX: number
    localY: number
    at: number
  }) => ipcRenderer.send('widget:pointer', input),
  moveWidgetBy: (deltaX: number, deltaY: number) =>
    ipcRenderer.invoke('widget:moveBy', deltaX, deltaY) as Promise<void>,
  minimizeWindow: () => ipcRenderer.invoke('window:minimize') as Promise<void>,
  closeWindow: () => ipcRenderer.invoke('window:close') as Promise<void>,
  onQuotaUpdated: (callback: (snapshot: QuotaSnapshot) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: QuotaSnapshot) => callback(snapshot)
    ipcRenderer.on('quota:updated', listener)
    return () => ipcRenderer.removeListener('quota:updated', listener)
  },
  onHardwarePushUpdated: (callback: (pushedAt: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, pushedAt: string) => callback(pushedAt)
    ipcRenderer.on('hardware:pushUpdated', listener)
    return () => ipcRenderer.removeListener('hardware:pushUpdated', listener)
  },
  onWidgetExpandedChanged: (callback: (expanded: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, expanded: boolean) => callback(expanded)
    ipcRenderer.on('widget:expandedChanged', listener)
    return () => ipcRenderer.removeListener('widget:expandedChanged', listener)
  }
}

contextBridge.exposeInMainWorld('codexMeter', api)

export type CodexMeterApi = typeof api
