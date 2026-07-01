import { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, Tray } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NoopDeviceBridge } from './deviceBridge.js'
import { cancelCodexOAuth, startCodexOAuth } from './oauth.js'
import { fetchQuotaSnapshot } from './quotaProvider.js'
import { clearCodexOAuth, getCodexOAuth, getSettings, saveSettings } from './store.js'
import { HttpDeviceBridge, type DeviceBridge } from '../shared/device.js'
import { unavailableQuotaSnapshot, type QuotaSnapshot } from '../shared/quota.js'
import { isRefreshIntervalMinutes, normalizeHardwareEndpoint } from '../shared/settings.js'

const devServerUrl = process.env.CODEXMETER_DEV_SERVER_URL
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const appIconPath = devServerUrl
  ? path.join(__dirname, '../../public/icon.png')
  : path.join(__dirname, '../../dist/icon.png')

let mainWindow: BrowserWindow | null = null
let widgetWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let latestSnapshot: QuotaSnapshot | null = null
let widgetAlwaysOnTop = false
let deviceBridge: DeviceBridge = createDeviceBridge()

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 575,
    useContentSize: true,
    resizable: false,
    maximizable: false,
    title: 'CodexMeter',
    icon: appIconPath,
    backgroundColor: '#f5f7fb',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
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

async function createWidgetWindow(): Promise<BrowserWindow> {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    return widgetWindow
  }

  const { workArea } = screen.getPrimaryDisplay()
  widgetWindow = new BrowserWindow({
    width: 320,
    height: 218,
    useContentSize: true,
    x: workArea.x + workArea.width - 340,
    y: workArea.y + workArea.height - 248,
    resizable: false,
    maximizable: false,
    minimizable: false,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: widgetAlwaysOnTop,
    title: 'CodexMeter Widget',
    icon: appIconPath,
    backgroundColor: '#eef3fb',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  widgetWindow.on('closed', () => {
    widgetWindow = null
  })

  if (devServerUrl) {
    await widgetWindow.loadURL(`${devServerUrl}?view=widget`)
  } else {
    await widgetWindow.loadFile(path.join(__dirname, '../../dist/index.html'), {
      query: { view: 'widget' }
    })
  }

  return widgetWindow
}

function createTray(): void {
  const image = nativeImage.createFromPath(appIconPath).resize({ width: 16, height: 16 })
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

async function refreshQuotaAndBroadcast(): Promise<QuotaSnapshot> {
  const snapshot = await fetchQuotaSnapshot()
  try {
    await deviceBridge.sendSnapshot(snapshot)
  } catch (error) {
    console.warn('Hardware display push failed:', error)
  }
  broadcastQuotaSnapshot(snapshot)
  return snapshot
}

function createDeviceBridge(): DeviceBridge {
  const settings = getSettings()
  if (settings.hardwareDisplayEnabled && settings.hardwareEndpoint) {
    return new HttpDeviceBridge(settings.hardwareEndpoint)
  }

  return new NoopDeviceBridge()
}

function broadcastQuotaSnapshot(snapshot: QuotaSnapshot): void {
  latestSnapshot = snapshot
  mainWindow?.webContents.send('quota:updated', snapshot)
  widgetWindow?.webContents.send('quota:updated', snapshot)
}

ipcMain.handle('quota:refresh', async () => refreshQuotaAndBroadcast())

ipcMain.handle('quota:latest', async () => {
  if (latestSnapshot) {
    return latestSnapshot
  }

  return refreshQuotaAndBroadcast()
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

ipcMain.handle('settings:saveHardwareDisplay', (_event, enabled: boolean, endpoint?: string) => {
  const hardwareEndpoint = normalizeHardwareEndpoint(endpoint)
  const nextSettings = saveSettings({
    ...getSettings(),
    hardwareDisplayEnabled: Boolean(enabled && hardwareEndpoint),
    hardwareEndpoint
  })
  deviceBridge = createDeviceBridge()
  return nextSettings
})

ipcMain.handle('devices:list', () => deviceBridge.listDevices())

ipcMain.handle('oauth:status', () => {
  const token = getCodexOAuth()
  return {
    connected: Boolean(token?.accessToken),
    email: token?.email
  }
})

ipcMain.handle('oauth:connect', async (_event, forceLogin?: boolean) => startCodexOAuth(Boolean(forceLogin)))
ipcMain.handle('oauth:cancel', () => cancelCodexOAuth())

ipcMain.handle('oauth:disconnect', async () => {
  clearCodexOAuth()
  const snapshot = unavailableQuotaSnapshot()
  broadcastQuotaSnapshot(snapshot)
  return { connected: false, snapshot }
})

ipcMain.handle('widget:state', () => ({
  visible: Boolean(widgetWindow && !widgetWindow.isDestroyed() && widgetWindow.isVisible()),
  alwaysOnTop: widgetAlwaysOnTop
}))

ipcMain.handle('widget:setVisible', async (_event, visible: boolean, alwaysOnTop?: boolean) => {
  widgetAlwaysOnTop = Boolean(alwaysOnTop)

  if (visible) {
    const window = await createWidgetWindow()
    window.setAlwaysOnTop(widgetAlwaysOnTop)
    window.show()
  } else if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.hide()
  }

  return {
    visible: Boolean(widgetWindow && !widgetWindow.isDestroyed() && widgetWindow.isVisible()),
    alwaysOnTop: widgetAlwaysOnTop
  }
})

ipcMain.handle('widget:setAlwaysOnTop', (_event, enabled: boolean) => {
  widgetAlwaysOnTop = Boolean(enabled)
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.setAlwaysOnTop(widgetAlwaysOnTop)
  }

  return {
    visible: Boolean(widgetWindow && !widgetWindow.isDestroyed() && widgetWindow.isVisible()),
    alwaysOnTop: widgetAlwaysOnTop
  }
})

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
