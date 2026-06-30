import { app, BrowserWindow, ipcMain, Menu, nativeImage, Tray } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NoopDeviceBridge } from './deviceBridge.js'
import { startCodexOAuth } from './oauth.js'
import { getCodexOAuth, getSettings, saveSettings } from './store.js'
import { isRefreshIntervalMinutes } from '../shared/settings.js'
import { sampleQuotaSnapshot } from '../shared/quota.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const devServerUrl = process.env.CODEXMETER_DEV_SERVER_URL

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
const deviceBridge = new NoopDeviceBridge()

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 740,
    height: 680,
    useContentSize: true,
    resizable: false,
    maximizable: false,
    title: 'CodexMeter',
    backgroundColor: '#f5f7fb',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  Menu.setApplicationMenu(null)

  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl)
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })
}

function createTray(): void {
  const image = nativeImage.createEmpty()
  tray = new Tray(image)
  tray.setToolTip('CodexMeter')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '打开 CodexMeter', click: () => mainWindow?.show() },
      {
        label: '退出',
        click: () => {
          isQuitting = true
          app.quit()
        }
      }
    ])
  )
  tray.on('double-click', () => mainWindow?.show())
}

ipcMain.handle('quota:refresh', async () => {
  const snapshot = sampleQuotaSnapshot()
  await deviceBridge.sendSnapshot(snapshot)
  return snapshot
})

ipcMain.handle('settings:get', () => getSettings())

ipcMain.handle('settings:saveRefreshInterval', (_event, minutes: number) => {
  if (!isRefreshIntervalMinutes(minutes)) {
    throw new Error(`Unsupported refresh interval: ${minutes}`)
  }

  return saveSettings({
    ...getSettings(),
    refreshIntervalMinutes: minutes
  })
})

ipcMain.handle('devices:list', () => deviceBridge.listDevices())

ipcMain.handle('oauth:status', () => {
  const token = getCodexOAuth()
  return {
    connected: Boolean(token?.accessToken),
    email: token?.email
  }
})

ipcMain.handle('oauth:connect', async () => startCodexOAuth())

app.whenReady().then(async () => {
  await createWindow()
  createTray()
})

app.on('activate', () => {
  if (mainWindow === null) {
    void createWindow()
  } else {
    mainWindow.show()
  }
})
