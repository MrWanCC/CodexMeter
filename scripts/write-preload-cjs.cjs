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
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveRefreshInterval: (minutes) => ipcRenderer.invoke('settings:saveRefreshInterval', minutes),
  listDevices: () => ipcRenderer.invoke('devices:list'),
  getOAuthStatus: () => ipcRenderer.invoke('oauth:status'),
  connectOAuth: () => ipcRenderer.invoke('oauth:connect')
})
`.trimStart()
)

