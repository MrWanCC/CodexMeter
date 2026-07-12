import { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, session, Tray } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NoopDeviceBridge } from './deviceBridge.js'
import { cancelCodexOAuth, startCodexOAuth } from './oauth.js'
import { fetchQuotaSnapshot } from './quotaProvider.js'
import { clearCodexOAuth, getCodexOAuth, getSettings, saveSettings } from './store.js'
import { WidgetInteractionController } from './widgetInteraction.js'
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
let widgetExpanded = false
let deviceBridge: DeviceBridge = createDeviceBridge()
let bluetoothSelectTimer: NodeJS.Timeout | undefined

const widgetCompactSize = { width: 104, height: 104 }
const widgetExpandedSize = { width: 337, height: 132 }
const widgetInteraction = new WidgetInteractionController()
let widgetPointerStartedOnOrb = false

function isWidgetOrbPoint(x: number, y: number): boolean {
  const left = widgetExpanded ? 8 : 16
  const top = widgetExpanded ? 20 : 16
  const size = widgetExpanded ? 88 : 72
  return x >= left && x <= left + size && y >= top && y <= top + size
}

function cancelWidgetInteraction(): void {
  widgetInteraction.handle({ type: 'cancel', x: 0, y: 0, at: Date.now() })
  widgetPointerStartedOnOrb = false
}

function moveWidgetBy(deltaX: number, deltaY: number): void {
  if (!widgetWindow || widgetWindow.isDestroyed() || !Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return
  const bounds = widgetWindow.getBounds()
  const workArea = screen.getDisplayMatching(bounds).workArea
  const x = Math.max(workArea.x, Math.min(workArea.x + workArea.width - bounds.width, bounds.x + Math.round(deltaX)))
  const y = Math.max(workArea.y, Math.min(workArea.y + workArea.height - bounds.height, bounds.y + Math.round(deltaY)))
  widgetWindow.setPosition(x, y)
}

function setWidgetExpanded(expanded: boolean): { expanded: boolean } {
  if (!widgetWindow || widgetWindow.isDestroyed()) return { expanded: widgetExpanded }

  const bounds = widgetWindow.getBounds()
  const nextSize = expanded ? widgetExpandedSize : widgetCompactSize
  const workArea = screen.getDisplayMatching(bounds).workArea
  const anchorRight = bounds.x + bounds.width
  const anchorBottom = bounds.y + bounds.height
  const x = Math.max(workArea.x, Math.min(workArea.x + workArea.width - nextSize.width, anchorRight - nextSize.width))
  const y = Math.max(workArea.y, Math.min(workArea.y + workArea.height - nextSize.height, anchorBottom - nextSize.height))

  widgetExpanded = expanded
  widgetWindow.setBounds({ x, y, width: nextSize.width, height: nextSize.height })
  widgetWindow.webContents.send('widget:expandedChanged', widgetExpanded)
  return { expanded: widgetExpanded }
}

function hardwareConnectionError(): Error {
  return new Error('无法连接外部小屏，请确认 ESP32-C3 已连接 Wi-Fi，且电脑与设备在同一局域网。')
}

function configureBluetoothPermissions(): void {
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    const requestedPermission = String(permission)
    return requestedPermission === 'bluetooth' || requestedPermission === 'bluetoothScanning'
  })
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const requestedPermission = String(permission)
    callback(requestedPermission === 'bluetooth' || requestedPermission === 'bluetoothScanning')
  })
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 720,
    height: 490,
    useContentSize: true,
    resizable: false,
    maximizable: false,
    frame: false,
    transparent: true,
    title: 'CodexMeter',
    icon: appIconPath,
    backgroundColor: '#00000000',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      experimentalFeatures: true,
      sandbox: false
    }
  })
  Menu.setApplicationMenu(null)
  mainWindow.webContents.on('select-bluetooth-device', (event, devices, callback) => {
    event.preventDefault()
    if (bluetoothSelectTimer) {
      clearTimeout(bluetoothSelectTimer)
      bluetoothSelectTimer = undefined
    }

    console.info(
      'Bluetooth scan devices:',
      devices.map((device) => `${device.deviceName || '(no name)'}:${device.deviceId}`).join(', ') || '(none)'
    )

    const device =
      devices.find((item) => item.deviceName?.includes('CodexMeter')) ??
      devices.find((item) => item.deviceName?.includes('ESP32'))
    if (device) {
      callback(device.deviceId)
      return
    }

    bluetoothSelectTimer = setTimeout(() => {
      callback(devices[0]?.deviceId ?? '')
      bluetoothSelectTimer = undefined
    }, 8000)
  })

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
    width: widgetCompactSize.width,
    height: widgetCompactSize.height,
    useContentSize: true,
    x: workArea.x + workArea.width - widgetCompactSize.width - 24,
    y: workArea.y + workArea.height - widgetCompactSize.height - 44,
    resizable: false,
    maximizable: false,
    minimizable: false,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    title: 'CodexMeter Widget',
    icon: appIconPath,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      experimentalFeatures: true,
      sandbox: false
    }
  })
  widgetWindow.setIgnoreMouseEvents(false)

  widgetWindow.on('closed', () => {
    cancelWidgetInteraction()
    widgetExpanded = false
    widgetWindow = null
  })
  widgetWindow.on('blur', cancelWidgetInteraction)
  widgetWindow.on('hide', cancelWidgetInteraction)

  if (devServerUrl) {
    await widgetWindow.loadURL(`${devServerUrl}?view=widget`)
  } else {
    await widgetWindow.loadFile(path.join(__dirname, '../../dist/index.html'), {
      query: { view: 'widget' }
    })
  }

  widgetWindow.setIgnoreMouseEvents(false)

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
  broadcastQuotaSnapshot(snapshot)
  return snapshot
}

async function pushLatestSnapshotToDevice(): Promise<{ pushed: boolean; pushedAt: string }> {
  const snapshot = latestSnapshot ?? await fetchQuotaSnapshot()
  await deviceBridge.sendSnapshot(snapshot)
  const pushedAt = broadcastHardwarePush()
  if (!latestSnapshot) {
    broadcastQuotaSnapshot(snapshot)
  }

  return { pushed: true, pushedAt }
}

function broadcastHardwarePush(): string {
  const pushedAt = new Date().toISOString()
  mainWindow?.webContents.send('hardware:pushUpdated', pushedAt)
  widgetWindow?.webContents.send('hardware:pushUpdated', pushedAt)
  return pushedAt
}

function createDeviceBridge(): DeviceBridge {
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
ipcMain.handle('devices:pushLatest', () => pushLatestSnapshotToDevice())
ipcMain.handle('devices:ping', async (_event, endpoint: string) => {
  const bridge = new HttpDeviceBridge(endpoint)
  if (!(await bridge.ping())) {
    throw hardwareConnectionError()
  }

  return { connected: true }
})
ipcMain.handle('devices:pushTest', async (_event, endpoint: string) => {
  const bridge = new HttpDeviceBridge(endpoint)
  await bridge.sendTestPayload()
  const pushedAt = broadcastHardwarePush()
  return { pushed: true, pushedAt }
})

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
  alwaysOnTop: widgetAlwaysOnTop,
  expanded: widgetExpanded
}))

ipcMain.handle('widget:setVisible', async (_event, visible: boolean, alwaysOnTop?: boolean) => {
  if (visible) {
    // An interactive floating widget must stay above the window beneath it;
    // otherwise Windows sends the click to that underlying window.
    widgetAlwaysOnTop = true
    const window = await createWidgetWindow()
    window.setAlwaysOnTop(true, 'floating')
    window.setIgnoreMouseEvents(false)
    window.show()
    window.focus()
    window.moveTop()
  } else if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetAlwaysOnTop = false
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

ipcMain.handle('widget:setExpanded', (_event, expanded: boolean) => setWidgetExpanded(Boolean(expanded)))

ipcMain.on('widget:pointer', (event, input: {
  type: 'down' | 'move' | 'up' | 'cancel'
  x: number
  y: number
  localX: number
  localY: number
  at: number
}) => {
  if (!widgetWindow || widgetWindow.isDestroyed() || event.sender !== widgetWindow.webContents) return
  if (!input || !['down', 'move', 'up', 'cancel'].includes(input.type)) return
  if (![input.x, input.y, input.localX, input.localY, input.at].every(Number.isFinite)) return

  if (input.type === 'down') widgetPointerStartedOnOrb = isWidgetOrbPoint(input.localX, input.localY)
  if (!widgetPointerStartedOnOrb && input.type !== 'cancel') return

  const action = widgetInteraction.handle({ type: input.type, x: input.x, y: input.y, at: input.at })
  if (action.type === 'toggle') setWidgetExpanded(!widgetExpanded)
  if (action.type === 'drag-move') moveWidgetBy(action.deltaX, action.deltaY)
  if (input.type === 'up' || input.type === 'cancel') widgetPointerStartedOnOrb = false
})

ipcMain.handle('widget:moveBy', (_event, deltaX: number, deltaY: number) => {
  moveWidgetBy(deltaX, deltaY)
})

ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize()
})

ipcMain.handle('window:close', () => {
  mainWindow?.close()
})

app.whenReady().then(async () => {
  configureBluetoothPermissions()
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
