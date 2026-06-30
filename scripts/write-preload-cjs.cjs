const fs = require('node:fs')
const path = require('node:path')

const outDir = path.join(__dirname, '..', 'dist-electron', 'preload')
fs.mkdirSync(outDir, { recursive: true })

fs.writeFileSync(
  path.join(outDir, 'index.cjs'),
  `
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('codexMeter', {
  refreshQuota: () => ipcRenderer.invoke('quota:refresh'),
  getLatestQuota: () => ipcRenderer.invoke('quota:latest'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveRefreshInterval: (minutes) => ipcRenderer.invoke('settings:saveRefreshInterval', minutes),
  listDevices: () => ipcRenderer.invoke('devices:list'),
  getOAuthStatus: () => ipcRenderer.invoke('oauth:status'),
  connectOAuth: (forceLogin = false) => ipcRenderer.invoke('oauth:connect', forceLogin),
  cancelOAuth: () => ipcRenderer.invoke('oauth:cancel'),
  disconnectOAuth: () => ipcRenderer.invoke('oauth:disconnect'),
  getWidgetState: () => ipcRenderer.invoke('widget:state'),
  setWidgetVisible: (visible, alwaysOnTop) => ipcRenderer.invoke('widget:setVisible', visible, alwaysOnTop),
  setWidgetAlwaysOnTop: (enabled) => ipcRenderer.invoke('widget:setAlwaysOnTop', enabled),
  onQuotaUpdated: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot)
    ipcRenderer.on('quota:updated', listener)
    return () => ipcRenderer.removeListener('quota:updated', listener)
  }
})
`.trimStart()
)
