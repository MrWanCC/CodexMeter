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
  saveHardwareDisplay: (enabled, endpoint) => ipcRenderer.invoke('settings:saveHardwareDisplay', enabled, endpoint),
  listDevices: () => ipcRenderer.invoke('devices:list'),
  pingHardwareDisplay: (endpoint) => ipcRenderer.invoke('devices:ping', endpoint),
  pushHardwareTest: (endpoint) => ipcRenderer.invoke('devices:pushTest', endpoint),
  pushLatestToDevice: () => ipcRenderer.invoke('devices:pushLatest'),
  getOAuthStatus: () => ipcRenderer.invoke('oauth:status'),
  connectOAuth: (forceLogin = false) => ipcRenderer.invoke('oauth:connect', forceLogin),
  cancelOAuth: () => ipcRenderer.invoke('oauth:cancel'),
  disconnectOAuth: () => ipcRenderer.invoke('oauth:disconnect'),
  getWidgetState: () => ipcRenderer.invoke('widget:state'),
  setWidgetVisible: (visible, alwaysOnTop) => ipcRenderer.invoke('widget:setVisible', visible, alwaysOnTop),
  setWidgetAlwaysOnTop: (enabled) => ipcRenderer.invoke('widget:setAlwaysOnTop', enabled),
  setWidgetExpanded: (expanded) => ipcRenderer.invoke('widget:setExpanded', expanded),
  sendWidgetPointer: (input) => ipcRenderer.send('widget:pointer', input),
  moveWidgetBy: (deltaX, deltaY) => ipcRenderer.invoke('widget:moveBy', deltaX, deltaY),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  onQuotaUpdated: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot)
    ipcRenderer.on('quota:updated', listener)
    return () => ipcRenderer.removeListener('quota:updated', listener)
  },
  onHardwarePushUpdated: (callback) => {
    const listener = (_event, pushedAt) => callback(pushedAt)
    ipcRenderer.on('hardware:pushUpdated', listener)
    return () => ipcRenderer.removeListener('hardware:pushUpdated', listener)
  },
  onWidgetExpandedChanged: (callback) => {
    const listener = (_event, expanded) => callback(expanded)
    ipcRenderer.on('widget:expandedChanged', listener)
    return () => ipcRenderer.removeListener('widget:expandedChanged', listener)
  }
})
`.trimStart()
)
