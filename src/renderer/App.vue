<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { NButton, NConfigProvider, NInput, NProgress, NSelect, NSwitch, NTag, type GlobalThemeOverrides } from 'naive-ui'
import {
  AlertCircle,
  Bluetooth,
  Calendar,
  CheckCircle2,
  CircleGauge,
  ChevronRight,
  Clock,
  Crown,
  Lock,
  Monitor,
  MoreHorizontal,
  Minus,
  Pin,
  RefreshCw,
  Ticket,
  User,
  Wifi,
  X
} from 'lucide-vue-next'
import appIcon from './assets/icon.png'
import { buildBleUsagePayload } from '../shared/device'
import { sampleQuotaSnapshot, type QuotaSnapshot, type QuotaWindow, type ResetCard } from '../shared/quota'
import type { AppSettings, RefreshIntervalMinutes } from '../shared/settings'

const BLE_SERVICE_UUID = '6f4d0001-9c8f-4c2a-9f12-000000000001'
const BLE_USAGE_UUID = '6f4d0002-9c8f-4c2a-9f12-000000000002'

const isWidgetView = new URLSearchParams(window.location.search).get('view') === 'widget'
const snapshot = ref<QuotaSnapshot | null>(null)
const settings = ref<AppSettings | null>(null)
const loading = ref(false)
const status = ref('就绪')
const widgetVisible = ref(false)
const alwaysOnTop = ref(false)
const hardwareEndpointInput = ref('')
const hardwareSaving = ref(false)
const hardwareStatusText = ref('')
const hardwareConnectionState = ref<'未连接' | '连接中' | '已连接' | '连接失败' | '推送成功' | '推送失败'>('未连接')
const hardwareAutoSync = ref(true)
const hardwareLastPushedAt = ref<string | undefined>()
const hardwareDialogVisible = ref(false)
const bleConnected = ref(false)
const bleDeviceName = ref('')
let bleCharacteristic: BluetoothRemoteGATTCharacteristic | undefined
const oauthConnected = ref(false)
const oauthEmail = ref<string | undefined>()
const connecting = ref(false)
const cardDetailOpen = ref(false)
const widgetExpanded = ref(false)
const noticeVisible = ref(false)
const noticeText = ref('')
const aboutVisible = ref(false)
let unsubscribeQuota: (() => void) | undefined
let refreshTimer: ReturnType<typeof setInterval> | undefined
let noticeTimer: ReturnType<typeof setTimeout> | undefined
let removeCopyListener: (() => void) | undefined
let unsubscribeHardwarePush: (() => void) | undefined
let unsubscribeWidgetExpanded: (() => void) | undefined

const intervalOptions = [
  { label: '手动刷新', value: 0 },
  { label: '5 分钟', value: 5 },
  { label: '10 分钟', value: 10 }
]
const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#2563eb',
    primaryColorHover: '#1d4ed8',
    primaryColorPressed: '#1e40af',
    primaryColorSuppl: '#3b82f6'
  },
  Button: {
    borderRadiusLarge: '12px'
  }
}

const fiveHourWindow = computed(() => findWindow('5h'))
const sevenDayWindow = computed(() => findWindow('7d'))
const resetCards = computed<ResetCard[]>(() => snapshot.value?.resetCards ?? [])
const codexPlanLabel = computed(() => {
  const planType = formattedPlanType.value
  if (!planType) {
    return 'Codex OAuth'
  }

  return `Codex ${planType}`
})
const formattedPlanType = computed(() => formatPlanType(snapshot.value?.planType))
const nearestResetCardDate = computed(() => {
  const card = resetCards.value[0]
  if (!card) return ''
  const date = new Date(card.expiresAt)
  if (Number.isNaN(date.getTime())) return ''
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
})
const widgetRingStyle = computed<Record<string, string>>(() => ({
  '--five-ring': `${(remainingPercent(fiveHourWindow.value) ?? 0) * 3.6}deg`,
  '--week-ring': `${(remainingPercent(sevenDayWindow.value) ?? 0) * 3.6}deg`
}))
const widgetPrimaryPercent = computed(() => remainingPercent(fiveHourWindow.value) ?? remainingPercent(sevenDayWindow.value) ?? null)
const widgetSecondaryPercent = computed(() => remainingPercent(sevenDayWindow.value) ?? null)
const widgetRefreshRecency = computed(() => {
  if (!snapshot.value?.refreshedAt) return '尚未刷新'
  const refreshedAt = new Date(snapshot.value.refreshedAt).getTime()
  if (Number.isNaN(refreshedAt)) return '尚未刷新'
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - refreshedAt) / 60000))
  return elapsedMinutes < 1 ? '刚刚刷新' : `${elapsedMinutes}分钟前刷新`
})

function quotaRingStyle(window: QuotaWindow | null): Record<string, string> {
  const remaining = remainingPercent(window) ?? 0
  return {
    '--quota-ring': `${remaining * 3.6}deg`,
    '--quota-percent': `${remaining}`,
    '--quota-color': quotaColor(window)
  }
}

function widgetArc(window: QuotaWindow | null, maxLength = 150): string {
  const pct = remainingPercent(window)
  if (pct === null) {
    return `0 ${maxLength}`
  }
  const length = Math.max(8, Math.round((pct / 100) * maxLength))
  return `${length} ${maxLength}`
}

function resetAtDisplay(window: QuotaWindow | null): string {
  if (!window?.resetAt) {
    return '--'
  }

  const date = new Date(window.resetAt)
  if (Number.isNaN(date.getTime())) {
    return '--'
  }

  return `${date.toLocaleDateString([], { month: '2-digit', day: '2-digit' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function remainingUntilReset(window: QuotaWindow | null): string {
  if (!window?.resetAt) {
    return '--'
  }

  const resetAt = new Date(window.resetAt).getTime()
  if (Number.isNaN(resetAt)) {
    return '--'
  }

  const diff = Math.max(0, resetAt - Date.now())
  if (window.code === '7d') {
    return `${Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)))} 天`
  }

  const totalMinutes = Math.ceil(diff / (1000 * 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function resetCardExpiryText(card: ResetCard): string {
  const date = new Date(card.expiresAt)
  if (Number.isNaN(date.getTime())) {
    return '未知'
  }
  const now = Date.now()
  const daysLeft = Math.ceil((date.getTime() - now) / (1000 * 60 * 60 * 24))
  const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
  if (daysLeft <= 0) {
    return `已过期 · ${dateStr}`
  }
  return `剩余 ${daysLeft} 天 · ${dateStr}`
}
const systemState = computed<'connected' | 'disconnected' | 'error'>(() => {
  if (snapshot.value && !snapshot.value.available && oauthConnected.value) {
    return 'error'
  }

  return oauthConnected.value ? 'connected' : 'disconnected'
})
const systemStateLabel = computed(() => {
  if (systemState.value === 'error') {
    return '异常'
  }

  return systemState.value === 'connected' ? '已连接' : '未连接'
})
const refreshTime = computed(() => {
  if (!snapshot.value) {
    return '--:--:--'
  }

  return new Date(snapshot.value.refreshedAt).toLocaleTimeString()
})
const refreshSummary = computed(() => {
  if (!snapshot.value) {
    return '尚未刷新'
  }

  return `上次刷新 ${refreshTime.value}`
})
const fiveHourState = computed(() => quotaState(fiveHourWindow.value))
const sevenDayState = computed(() => quotaState(sevenDayWindow.value))
const httpConnected = computed(() => Boolean(settings.value?.hardwareEndpoint))
const hardwareConnected = computed(() => bleConnected.value || httpConnected.value)
const hardwareAutoSyncLabel = computed(() => hardwareAutoSync.value ? '开启' : '关闭')
const hardwareStatusTone = computed(() => {
  if (hardwareConnectionState.value === '连接失败' || hardwareConnectionState.value === '推送失败') {
    return 'is-error'
  }

  if (hardwareConnectionState.value === '连接中') {
    return 'is-pending'
  }

  if (hardwareConnectionState.value === '已连接' || hardwareConnectionState.value === '推送成功') {
    return 'is-success'
  }

  return 'is-idle'
})
const hardwareLastPushLabel = computed(() => {
  if (!hardwareLastPushedAt.value) {
    return '--'
  }

  const date = new Date(hardwareLastPushedAt.value)
  if (Number.isNaN(date.getTime())) {
    return '--'
  }

  return date.toLocaleTimeString()
})
const bleDisplayName = computed(() => bleConnected.value ? bleDeviceName.value || 'CodexMeter' : '未连接')
const httpDisplayAddress = computed(() => {
  if (!settings.value?.hardwareEndpoint) {
    return '未配置'
  }

  return settings.value.hardwareEndpoint.replace(/^https?:\/\//, '').replace(/\/$/, '')
})
const hardwareConnectionSummary = computed(() => {
  if (bleConnected.value && httpConnected.value) {
    return '蓝牙 + 网络'
  }
  if (bleConnected.value) {
    return '蓝牙已连接'
  }
  if (httpConnected.value) {
    return '网络已配置'
  }
  return '未连接'
})

onMounted(async () => {
  const handleCopy = () => showNotice('已复制到剪贴板')
  document.addEventListener('copy', handleCopy)
  removeCopyListener = () => document.removeEventListener('copy', handleCopy)

  if (isWidgetView) {
    document.addEventListener('pointerdown', handleWidgetPointer, true)
    document.addEventListener('pointermove', handleWidgetPointer, true)
    document.addEventListener('pointerup', handleWidgetPointer, true)
    document.addEventListener('pointercancel', handleWidgetPointer, true)
    window.addEventListener('resize', syncWidgetExpanded)
  }

  unsubscribeQuota = window.codexMeter?.onQuotaUpdated((nextSnapshot) => {
    snapshot.value = nextSnapshot
    status.value = `已刷新 ${new Date(nextSnapshot.refreshedAt).toLocaleTimeString()}`
    if (hardwareAutoSync.value && bleConnected.value) {
      void sendBleSnapshot(nextSnapshot)
    }
  })
  unsubscribeHardwarePush = window.codexMeter?.onHardwarePushUpdated((pushedAt) => {
    hardwareLastPushedAt.value = pushedAt
    hardwareConnectionState.value = '推送成功'
  })
  unsubscribeWidgetExpanded = window.codexMeter?.onWidgetExpandedChanged((expanded) => {
    if (isWidgetView) widgetExpanded.value = expanded
  })
  if (isWidgetView) {
    snapshot.value = window.codexMeter ? await window.codexMeter.getLatestQuota() : sampleQuotaSnapshot()
    return
  }

  if (window.codexMeter) {
    settings.value = await window.codexMeter.getSettings()
    hardwareEndpointInput.value = settings.value.hardwareEndpoint ?? ''
    hardwareAutoSync.value = settings.value.hardwareDisplayEnabled
    hardwareConnectionState.value = settings.value.hardwareEndpoint ? '已连接' : '未连接'
    const oauth = await window.codexMeter.getOAuthStatus()
    oauthConnected.value = oauth.connected
    oauthEmail.value = oauth.email
    const widgetState = await window.codexMeter.getWidgetState()
    widgetVisible.value = widgetState.visible
    alwaysOnTop.value = widgetState.visible ? widgetState.alwaysOnTop : false
  } else {
    settings.value = { refreshIntervalMinutes: 5, hardwareDisplayEnabled: true }
    hardwareAutoSync.value = true
  }

  await refreshQuota()
  configureAutoRefresh(settings.value?.refreshIntervalMinutes ?? 5)
})

onUnmounted(() => {
  unsubscribeQuota?.()
  unsubscribeHardwarePush?.()
  unsubscribeWidgetExpanded?.()
  document.removeEventListener('pointerdown', handleWidgetPointer, true)
  document.removeEventListener('pointermove', handleWidgetPointer, true)
  document.removeEventListener('pointerup', handleWidgetPointer, true)
  document.removeEventListener('pointercancel', handleWidgetPointer, true)
  window.removeEventListener('resize', syncWidgetExpanded)
  removeCopyListener?.()
  clearAutoRefresh()
  clearNotice()
})

async function refreshQuota(): Promise<void> {
  if (loading.value) {
    return
  }

  loading.value = true
  status.value = '刷新中'
  try {
    snapshot.value = window.codexMeter ? await window.codexMeter.refreshQuota() : sampleQuotaSnapshot()
    status.value = `已刷新 ${new Date(snapshot.value.refreshedAt).toLocaleTimeString()}`
  } finally {
    loading.value = false
  }
}

function showNotice(text: string): void {
  clearNotice()
  noticeText.value = text
  noticeVisible.value = true
  noticeTimer = setTimeout(() => {
    noticeVisible.value = false
    noticeTimer = undefined
  }, 2000)
}

function clearNotice(): void {
  if (noticeTimer) {
    clearTimeout(noticeTimer)
    noticeTimer = undefined
  }
}

function showAbout(): void {
  aboutVisible.value = true
}

function openHardwareDialog(): void {
  hardwareEndpointInput.value = settings.value?.hardwareEndpoint ?? hardwareEndpointInput.value
  hardwareAutoSync.value = settings.value?.hardwareEndpoint ? settings.value.hardwareDisplayEnabled : true
  hardwareDialogVisible.value = true
  hardwareConnectionState.value = hardwareConnected.value ? '已连接' : '未连接'
  hardwareStatusText.value = ''
}

function toggleHardwareConnection(): void {
  if (hardwareConnected.value) {
    void disconnectHardwareDisplay()
    return
  }

  openHardwareDialog()
}

async function updateInterval(value: number): Promise<void> {
  settings.value = window.codexMeter
    ? await window.codexMeter.saveRefreshInterval(value as RefreshIntervalMinutes)
    : { refreshIntervalMinutes: value as RefreshIntervalMinutes, hardwareDisplayEnabled: true }
  configureAutoRefresh(settings.value.refreshIntervalMinutes)
}

async function saveHardwareDisplay(enabled = true): Promise<void> {
  hardwareSaving.value = true
  try {
    settings.value = window.codexMeter
      ? await window.codexMeter.saveHardwareDisplay(enabled, hardwareEndpointInput.value)
      : {
          refreshIntervalMinutes: settings.value?.refreshIntervalMinutes ?? 5,
          hardwareDisplayEnabled: Boolean(enabled && hardwareEndpointInput.value),
          hardwareEndpoint: hardwareEndpointInput.value
        }
    hardwareEndpointInput.value = settings.value.hardwareEndpoint ?? hardwareEndpointInput.value.trim()
    hardwareAutoSync.value = settings.value.hardwareDisplayEnabled
    hardwareConnectionState.value = settings.value.hardwareEndpoint ? '已连接' : '未连接'
    hardwareStatusText.value = settings.value.hardwareDisplayEnabled ? '刷新额度后会自动推送到小屏' : '自动同步已关闭'
    showNotice(hardwareStatusText.value)
    if (!settings.value.hardwareEndpoint) {
      hardwareDialogVisible.value = false
    }
  } catch (error) {
    hardwareConnectionState.value = '连接失败'
    hardwareStatusText.value = error instanceof Error ? error.message : '硬件设置保存失败'
  } finally {
    hardwareSaving.value = false
  }
}

async function disconnectHardwareDisplay(): Promise<void> {
  bleCharacteristic = undefined
  bleConnected.value = false
  bleDeviceName.value = ''
  hardwareEndpointInput.value = ''
  await saveHardwareDisplay(false)
  hardwareConnectionState.value = '未连接'
  hardwareStatusText.value = '已断开所有小屏连接'
  showNotice(hardwareStatusText.value)
}

async function connectHttpDisplay(): Promise<void> {
  if (!window.codexMeter) {
    hardwareConnectionState.value = '连接失败'
    hardwareStatusText.value = '当前环境无法连接网络小屏'
    return
  }

  hardwareSaving.value = true
  hardwareConnectionState.value = '连接中'
  hardwareStatusText.value = '正在连接网络小屏...'
  try {
    await window.codexMeter.pingHardwareDisplay(hardwareEndpointInput.value)
    settings.value = await window.codexMeter.saveHardwareDisplay(hardwareAutoSync.value, hardwareEndpointInput.value)
    hardwareEndpointInput.value = settings.value.hardwareEndpoint ?? hardwareEndpointInput.value.trim()
    hardwareAutoSync.value = settings.value.hardwareDisplayEnabled
    hardwareConnectionState.value = '已连接'
    hardwareStatusText.value = '网络小屏已连接'
    const result = await window.codexMeter.pushLatestToDevice()
    hardwareLastPushedAt.value = result.pushedAt
    hardwareConnectionState.value = '推送成功'
    hardwareStatusText.value = '当前额度已同步到小屏'
    showNotice(hardwareStatusText.value)
  } catch {
    hardwareConnectionState.value = '连接失败'
    hardwareStatusText.value = '无法连接网络小屏，请确认 ESP32-C3 已连接 Wi-Fi，且电脑与设备在同一局域网。'
  } finally {
    hardwareSaving.value = false
  }
}

async function connectBluetoothDisplay(pushAfterConnect: boolean): Promise<void> {
  if (!navigator.bluetooth) {
    hardwareConnectionState.value = '连接失败'
    hardwareStatusText.value = '当前环境不支持蓝牙连接'
    return
  }

  hardwareSaving.value = true
  hardwareConnectionState.value = '连接中'
  hardwareStatusText.value = '正在连接蓝牙小屏...'
  try {
    const characteristic = await requestBleCharacteristic()
    bleCharacteristic = characteristic
    bleConnected.value = true
    hardwareConnectionState.value = '已连接'
    hardwareStatusText.value = '蓝牙小屏已连接'

    if (pushAfterConnect) {
      const currentSnapshot = snapshot.value ?? (window.codexMeter ? await window.codexMeter.getLatestQuota() : sampleQuotaSnapshot())
      await sendBleSnapshot(currentSnapshot)
      hardwareDialogVisible.value = false
    }

    showNotice(hardwareStatusText.value)
  } catch {
    bleCharacteristic = undefined
    bleConnected.value = false
    hardwareConnectionState.value = '连接失败'
    hardwareStatusText.value = '无法连接蓝牙小屏，请确认设备已上电并处于附近。'
  } finally {
    hardwareSaving.value = false
  }
}

async function requestBleCharacteristic(): Promise<BluetoothRemoteGATTCharacteristic> {
  const device = await navigator.bluetooth!.requestDevice({
    acceptAllDevices: true,
    optionalServices: [BLE_SERVICE_UUID]
  })
  bleDeviceName.value = device.name ?? 'CodexMeter'
  device.addEventListener('gattserverdisconnected', () => {
    bleCharacteristic = undefined
    bleConnected.value = false
    hardwareConnectionState.value = '未连接'
    hardwareStatusText.value = '蓝牙已断开'
  })
  const server = await device.gatt?.connect()
  if (!server) {
    throw new Error('BLE GATT unavailable')
  }

  const service = await server.getPrimaryService(BLE_SERVICE_UUID)
  return service.getCharacteristic(BLE_USAGE_UUID)
}

async function sendBleSnapshot(nextSnapshot: QuotaSnapshot): Promise<void> {
  await sendBlePayload(buildBleUsagePayload(nextSnapshot), '当前额度已同步到小屏')
}

async function sendBlePayload(payload: unknown, successText: string): Promise<void> {
  if (!bleCharacteristic) {
    await connectBluetoothDisplay(false)
  }

  if (!bleCharacteristic) {
    return
  }

  hardwareSaving.value = true
  hardwareConnectionState.value = '连接中'
  hardwareStatusText.value = '正在发送数据...'
  try {
    await bleCharacteristic.writeValue(new TextEncoder().encode(JSON.stringify(payload)))
    hardwareLastPushedAt.value = new Date().toISOString()
    hardwareConnectionState.value = '推送成功'
    hardwareStatusText.value = successText
    showNotice(successText)
  } catch {
    hardwareConnectionState.value = '推送失败'
    hardwareStatusText.value = '蓝牙数据发送失败，请重新连接小屏。'
  } finally {
    hardwareSaving.value = false
  }
}

function configureAutoRefresh(minutes: RefreshIntervalMinutes): void {
  clearAutoRefresh()
  if (minutes === 0 || isWidgetView) {
    return
  }

  refreshTimer = setInterval(() => {
    void refreshQuota()
  }, minutes * 60 * 1000)
}

function clearAutoRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = undefined
  }
}

async function connectOAuth(forceLogin = false): Promise<void> {
  if (!window.codexMeter || connecting.value) {
    return
  }

  connecting.value = true
  status.value = '等待授权'
  try {
    const result = await window.codexMeter.connectOAuth(forceLogin)
    oauthConnected.value = result.connected
    oauthEmail.value = result.email
    status.value = result.connected ? '已连接' : '连接失败'
    if (result.connected) {
      await refreshQuota()
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('cancelled')) {
      status.value = '已取消连接'
    } else {
      status.value = error instanceof Error && error.message.includes('timed out') ? '连接超时，可重试' : '连接失败'
    }
  } finally {
    connecting.value = false
  }
}

async function cancelOAuth(): Promise<void> {
  if (!window.codexMeter || !connecting.value) {
    return
  }

  await window.codexMeter.cancelOAuth()
  connecting.value = false
  status.value = '已取消连接'
}

async function disconnectOAuth(): Promise<void> {
  if (!window.codexMeter || connecting.value) {
    return
  }

  connecting.value = true
  try {
    const result = await window.codexMeter.disconnectOAuth()
    oauthConnected.value = result.connected
    oauthEmail.value = undefined
    snapshot.value = result.snapshot
    status.value = '已断开'
  } finally {
    connecting.value = false
  }
}

async function updateWidgetVisible(value: boolean): Promise<void> {
  widgetVisible.value = value
  if (!value) {
    alwaysOnTop.value = false
  }
  if (!window.codexMeter) {
    return
  }

  const state = await window.codexMeter.setWidgetVisible(value, value ? alwaysOnTop.value : false)
  widgetVisible.value = state.visible
  alwaysOnTop.value = state.alwaysOnTop
}

async function updateAlwaysOnTop(value: boolean): Promise<void> {
  if (!widgetVisible.value) {
    alwaysOnTop.value = false
    return
  }

  alwaysOnTop.value = value
  if (!window.codexMeter) {
    return
  }

  const state = await window.codexMeter.setWidgetAlwaysOnTop(value)
  widgetVisible.value = state.visible
  alwaysOnTop.value = state.alwaysOnTop
}

async function setWidgetExpanded(expanded: boolean): Promise<void> {
  if (widgetExpanded.value === expanded) {
    return
  }

  widgetExpanded.value = expanded
  await window.codexMeter?.setWidgetExpanded(expanded)
}

function widgetResetCopy(window: QuotaWindow | null): string {
  if (!window?.resetAt) return '暂无重置时间'
  const resetAt = new Date(window.resetAt)
  if (Number.isNaN(resetAt.getTime())) return '暂无重置时间'
  if (window.code === '5h') return `距重置 ${remainingUntilReset(window)}`
  return `${resetAt.toLocaleDateString([], { month: '2-digit', day: '2-digit' })} ${resetAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 重置`
}

async function syncWidgetExpanded(): Promise<void> {
  if (!isWidgetView || !window.codexMeter) return
  const state = await window.codexMeter.getWidgetState()
  widgetExpanded.value = state.expanded
}

function handleWidgetPointer(event: PointerEvent): void {
  if (event.pointerType === 'mouse' && event.button !== 0 && event.type !== 'pointermove') return
  const type = event.type === 'pointerdown'
    ? 'down'
    : event.type === 'pointermove'
      ? 'move'
      : event.type === 'pointerup'
        ? 'up'
        : 'cancel'
  window.codexMeter?.sendWidgetPointer({
    type,
    x: event.screenX,
    y: event.screenY,
    localX: event.clientX,
    localY: event.clientY,
    at: Date.now()
  })
}

function minimizeWindow(): void {
  void window.codexMeter?.minimizeWindow()
}

function closeWindow(): void {
  void window.codexMeter?.closeWindow()
}

function findWindow(code: '5h' | '7d'): QuotaWindow | null {
  return snapshot.value?.windows.find((window) => window.code === code) ?? null
}

function formatPlanType(planType: string | undefined): string | undefined {
  const value = planType?.trim()
  if (!value) {
    return undefined
  }

  return value.charAt(0).toUpperCase() + value.slice(1)
}

function remainingPercent(window: QuotaWindow | null): number | null {
  if (!window) {
    return null
  }

  return Math.max(0, Math.min(100, Math.round((100 - window.percentUsed) * 100) / 100))
}

function usedPercent(window: QuotaWindow | null): number {
  return window ? Math.round(window.percentUsed * 100) / 100 : 0
}

type QuotaState = 'empty' | 'abundant' | 'normal' | 'attention' | 'tight' | 'critical' | 'exhausted'

function quotaState(window: QuotaWindow | null): QuotaState {
  if (!window) {
    return 'empty'
  }

  const remaining = remainingPercent(window) ?? 0
  if (remaining <= 0) {
    return 'exhausted'
  }


  const thresholds = [60, 30, 20, 10]

  if (remaining > thresholds[0]) return 'abundant'
  if (remaining > thresholds[1]) return 'normal'
  if (remaining > thresholds[2]) return 'attention'
  if (remaining > thresholds[3]) return 'tight'
  return 'critical'
}

function quotaBadge(window: QuotaWindow | null): string {
  const labels: Record<QuotaState, string> = {
    empty: '无数据',
    abundant: '充足',
    normal: '正常',
    attention: '注意',
    tight: '紧张',
    critical: '严重',
    exhausted: '已耗尽'
  }
  return labels[quotaState(window)]
}



function quotaColor(window: QuotaWindow | null): string {
  const colors: Record<QuotaState, string> = {
    empty: '#94a3b8',
    abundant: '#22c55e',
    normal: '#16a34a',
    attention: '#eab308',
    tight: '#f97316',
    critical: '#ea580c',
    exhausted: '#ef4444'
  }
  return colors[quotaState(window)]
}

function quotaTagType(window: QuotaWindow | null): 'default' | 'error' | 'warning' | 'success' | 'info' {
  const types: Record<QuotaState, 'default' | 'error' | 'warning' | 'success' | 'info'> = {
    empty: 'default',
    abundant: 'success',
    normal: 'success',
    attention: 'warning',
    tight: 'warning',
    critical: 'error',
    exhausted: 'error'
  }
  return types[quotaState(window)]
}

function quotaIcon(window: QuotaWindow | null, weekly = false) {
  const state = quotaState(window)
  if (state === 'exhausted' || state === 'critical') {
    return AlertCircle
  }
  if (state === 'attention' || state === 'tight') {
    return AlertCircle
  }
  return weekly ? Calendar : Clock
}

function resetLabel(window: QuotaWindow | null): string {
  if (!window?.resetAt) {
    return '重置 未知'
  }

  const date = new Date(window.resetAt)
  if (Number.isNaN(date.getTime())) {
    return '重置 未知'
  }

  return window.code === '5h'
    ? `重置 ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : `重置 ${date.toLocaleDateString([], { month: '2-digit', day: '2-digit' })}`
}

function widgetResetDateTime(window: QuotaWindow | null): string {
  if (!window?.resetAt) {
    return '--'
  }

  const date = new Date(window.resetAt)
  if (Number.isNaN(date.getTime())) {
    return '--'
  }

  return `${date.toLocaleDateString([], { month: '2-digit', day: '2-digit' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function quotaPeriodDisplay(window: QuotaWindow | null): string {
  if (!window?.resetAt) {
    return '--'
  }

  const date = new Date(window.resetAt)
  if (Number.isNaN(date.getTime())) {
    return '--'
  }

  return window.code === '5h'
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : widgetResetDateTime(window)
}

</script>

<template>
  <NConfigProvider :theme-overrides="themeOverrides">
    <Transition name="notice">
      <div v-if="noticeVisible" class="app-notice">
        <CheckCircle2 :size="16" :stroke-width="2" />
        <span>{{ noticeText }}</span>
      </div>
    </Transition>

    <Transition name="notice">
      <div v-if="aboutVisible" class="about-popover">
        <div>
          <strong>CodexMeter</strong>
          <span>版本 v1.0.0</span>
        </div>
        <p>本地运行 · 不联网自动更新 · 仅读取授权后的用量数据</p>
        <button type="button" @click="aboutVisible = false">知道了</button>
      </div>
    </Transition>

    <Transition name="notice">
      <div v-if="hardwareDialogVisible" class="hardware-connect-backdrop" @click.self="hardwareDialogVisible = false">
        <section class="hardware-connect-popover">
          <div class="hardware-connect-head">
            <div>
              <strong>连接外部小屏</strong>
              <span>蓝牙和网络可同时启用，刷新额度后会按已连接通道推送到 ESP32-C3 OLED 小屏</span>
            </div>
            <button type="button" aria-label="关闭" @click="hardwareDialogVisible = false">×</button>
          </div>

          <div class="hardware-channel-list">
            <section class="hardware-channel">
              <div class="hardware-channel-icon">
                <Bluetooth :size="17" :stroke-width="2" />
              </div>
              <div class="hardware-channel-main">
                <div class="hardware-channel-title">
                  <strong>蓝牙连接</strong>
                  <span :class="bleConnected ? 'is-success' : 'is-idle'">{{ bleConnected ? '已连接' : '未连接' }}</span>
                </div>
                <p>{{ bleConnected ? bleDisplayName : '搜索 CodexMeter 屏幕' }}</p>
              </div>
              <NButton size="small" type="primary" ghost :loading="hardwareSaving" @click="connectBluetoothDisplay(true)">
                {{ bleConnected ? '重新连接' : '连接蓝牙' }}
              </NButton>
            </section>

            <section class="hardware-channel">
              <div class="hardware-channel-icon">
                <Monitor :size="17" :stroke-width="2" />
              </div>
              <div class="hardware-channel-main">
                <div class="hardware-channel-title">
                  <strong>网络连接</strong>
                  <span :class="httpConnected ? 'is-success' : 'is-idle'">{{ httpConnected ? '已配置' : '未配置' }}</span>
                </div>
                <p>{{ httpConnected ? httpDisplayAddress : '使用设备 IP 地址连接' }}</p>
              </div>
              <label class="hardware-connect-field">
                <span>设备地址</span>
                <div class="hardware-address-input">
                  <Wifi :size="14" :stroke-width="2" />
                  <NInput
                    v-model:value="hardwareEndpointInput"
                    size="small"
                    placeholder="192.168.1.114"
                    @keyup.enter="connectHttpDisplay"
                  />
                </div>
                <NButton size="small" type="primary" ghost :loading="hardwareSaving" @click="connectHttpDisplay">
                  连接网络
                </NButton>
              </label>
            </section>
          </div>

          <div class="hardware-control-panel">
            <div class="hardware-sync-row">
              <div>
                <strong>自动同步</strong>
                <span>刷新额度后自动推送到小屏</span>
              </div>
              <b>[{{ hardwareAutoSync ? '开启' : '关闭' }}]</b>
              <NSwitch v-model:value="hardwareAutoSync" size="small" />
            </div>
            <div class="hardware-connect-status" :class="hardwareStatusTone">
              <div class="hardware-status-icon">
                <span class="oauth-status-dot" />
              </div>
              <div class="hardware-status-copy">
                <strong>屏幕状态</strong>
                <em>{{ hardwareStatusText || hardwareConnectionSummary }}</em>
              </div>
              <b class="hardware-status-badge">{{ hardwareConnectionState }}</b>
            </div>
          </div>

          <div class="hardware-connect-actions">
            <NButton size="small" :loading="hardwareSaving" @click="hardwareDialogVisible = false">取消</NButton>
          </div>
        </section>
      </div>
    </Transition>

    <main
      v-if="isWidgetView"
      class="widget-shell"
      :class="{ 'is-expanded': widgetExpanded }"
    >
      <div
        class="widget-orb"
        :class="{
          'is-warning': widgetPrimaryPercent !== null && widgetPrimaryPercent < 20,
          'is-disconnected': widgetPrimaryPercent === null
        }"
        :style="widgetRingStyle"
      >
        <span class="widget-orb-halo" />
        <svg class="widget-orb-radial" viewBox="0 0 112 112" aria-hidden="true">
          <circle class="widget-orb-track is-outer" cx="56" cy="56" r="45" pathLength="100" />
          <circle
            class="widget-orb-arc is-five"
            cx="56"
            cy="56"
            r="45"
            pathLength="100"
            :stroke-dasharray="widgetArc(fiveHourWindow, 100)"
          />
          <circle class="widget-orb-track is-inner" cx="56" cy="56" r="37" pathLength="100" />
          <circle
            class="widget-orb-arc is-week"
            cx="56"
            cy="56"
            r="37"
            pathLength="100"
            :stroke-dasharray="widgetArc(sevenDayWindow, 100)"
          />
        </svg>
        <button
          class="widget-orb-action"
          type="button"
          aria-label="展开额度悬浮面板"
          @pointerdown.stop
          @pointerup.stop
          @pointercancel.stop
        >
          <strong>{{ widgetPrimaryPercent ?? '--' }}%</strong>
          <em>5H</em>
        </button>
      </div>

      <section class="widget-panel">
        <div class="widget-flyout-card">
          <div class="widget-target-layout">
            <div class="widget-target-quotas">
              <div
                class="widget-quota-block is-five"
                :class="{ 'is-low': remainingPercent(fiveHourWindow) !== null && remainingPercent(fiveHourWindow)! < 20, 'is-empty': remainingPercent(fiveHourWindow) === null }"
              >
                <div class="widget-quota-head">
                  <span><Clock :size="13" :stroke-width="2" />5小时额度</span>
                  <em>{{ quotaBadge(fiveHourWindow) }}</em>
                  <strong>{{ remainingPercent(fiveHourWindow) ?? '--' }}%</strong>
                </div>
                <div class="widget-quota-progress" role="progressbar" aria-label="5小时剩余额度" :aria-valuenow="remainingPercent(fiveHourWindow) ?? 0" aria-valuemin="0" aria-valuemax="100">
                  <span class="widget-quota-progress-fill" :style="{ width: `${remainingPercent(fiveHourWindow) ?? 0}%` }" />
                </div>
              </div>
              <div
                class="widget-quota-block is-seven"
                :class="{ 'is-low': remainingPercent(sevenDayWindow) !== null && remainingPercent(sevenDayWindow)! < 20, 'is-empty': remainingPercent(sevenDayWindow) === null }"
              >
                <div class="widget-quota-head">
                  <span><Calendar :size="13" :stroke-width="2" />7天额度</span>
                  <em>{{ quotaBadge(sevenDayWindow) }}</em>
                  <strong>{{ remainingPercent(sevenDayWindow) ?? '--' }}%</strong>
                </div>
                <div class="widget-quota-progress" role="progressbar" aria-label="7天剩余额度" :aria-valuenow="remainingPercent(sevenDayWindow) ?? 0" aria-valuemin="0" aria-valuemax="100">
                  <span class="widget-quota-progress-fill" :style="{ width: `${remainingPercent(sevenDayWindow) ?? 0}%` }" />
                </div>
              </div>
            </div>
            <div class="widget-target-footer">
              <small><Clock :size="12" :stroke-width="2" />重置时间：{{ resetAtDisplay(fiveHourWindow) }}</small>
              <button class="widget-reset-card-button" type="button" @click.stop="cardDetailOpen = !cardDetailOpen">
                <Ticket :size="12" :stroke-width="2" />重置卡：{{ resetCards.length }}张
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>

    <header v-if="!isWidgetView" class="app-titlebar">
      <div class="app-titlebar-brand">
        <img :src="appIcon" alt="" />
        <span>CodexMeter</span>
      </div>
      <div class="app-titlebar-actions">
        <button type="button" aria-label="最小化" @pointerdown.stop @mousedown.stop @click.stop="minimizeWindow">
          <Minus :size="18" :stroke-width="2" />
        </button>
        <button type="button" aria-label="关闭" @pointerdown.stop @mousedown.stop @click.stop="closeWindow">
          <X :size="18" :stroke-width="2" />
        </button>
      </div>
    </header>

    <main v-if="!isWidgetView" class="desktop-shell">
      <section class="software-dashboard">
        <header class="dashboard-header">
          <div class="dashboard-brand">
            <img class="dashboard-logo" :src="appIcon" alt="" />
            <div>
              <strong>CodexMeter</strong>
              <span>额度状态面板</span>
            </div>
          </div>
          <div class="dashboard-refresh">
            <span class="plan-badge">
              <Crown :size="13" :stroke-width="2" />
              {{ codexPlanLabel }}
            </span>
            <button class="icon-action" :class="{ 'is-loading': loading }" type="button" @click="refreshQuota">
              <RefreshCw :size="17" :stroke-width="2" />
            </button>
          </div>
        </header>

        <section class="dashboard-control-row">
          <button class="widget-control" type="button" :class="{ active: widgetVisible }" @click="updateWidgetVisible(!widgetVisible)">
            <CircleGauge :size="17" :stroke-width="2" />
            <span>悬浮球</span>
            <div class="control-status" :class="{ active: widgetVisible }">
              <CheckCircle2 :size="14" :stroke-width="2" />
              {{ widgetVisible ? '已开启' : '未开启' }}
            </div>
          </button>
          <button type="button" :class="{ active: alwaysOnTop }" @click="updateWidgetVisible(true); updateAlwaysOnTop(!alwaysOnTop)">
            <Pin :size="18" :stroke-width="2" />
            <span>置顶</span>
            <div class="control-status" :class="{ active: alwaysOnTop }">
              <CheckCircle2 :size="14" :stroke-width="2" />
              {{ alwaysOnTop ? '已置顶' : '未置顶' }}
            </div>
          </button>
          <button type="button" :class="{ active: hardwareConnected }" @click="toggleHardwareConnection">
            <Monitor :size="18" :stroke-width="2" />
            <span>连接</span>
            <div class="control-status" :class="{ active: hardwareConnected }">
              <CheckCircle2 :size="14" :stroke-width="2" />
              {{ hardwareConnected ? '断开' : '连接' }}
            </div>
          </button>
        </section>

        <section class="dashboard-quota-grid">
          <article class="quota-glass-card" :class="fiveHourState">
            <div class="quota-card-head">
              <h3>5 小时额度</h3>
              <span>{{ quotaBadge(fiveHourWindow) }}</span>
            </div>
            <div class="quota-card-body">
              <div class="quota-donut" :style="quotaRingStyle(fiveHourWindow)">
                <svg class="quota-donut-ring" viewBox="0 0 120 120" aria-hidden="true">
                  <circle class="quota-donut-center" cx="60" cy="60" r="43" />
                  <circle class="quota-donut-track" cx="60" cy="60" r="48" pathLength="100" />
                  <circle class="quota-donut-progress" cx="60" cy="60" r="48" pathLength="100" />
                </svg>
                <div class="quota-donut-text">
                  <strong>{{ remainingPercent(fiveHourWindow) ?? '--' }}%</strong>
                </div>
              </div>
              <dl>
                <div>
                  <dt><Clock :size="16" :stroke-width="2" />已用</dt>
                  <dd>{{ usedPercent(fiveHourWindow) }}%</dd>
                </div>
                <div>
                  <dt><Clock :size="16" :stroke-width="2" />剩余</dt>
                  <dd>{{ remainingUntilReset(fiveHourWindow) }}</dd>
                </div>
                <div>
                  <dt><RefreshCw :size="16" :stroke-width="2" />重置于</dt>
                  <dd>{{ resetAtDisplay(fiveHourWindow) }}</dd>
                </div>
              </dl>
            </div>
            <div class="quota-card-footer">
              <span class="quota-card-footer-label">5H 剩余</span>
              <div class="quota-bar">
                <div class="quota-bar-fill" :style="{ width: `${remainingPercent(fiveHourWindow) ?? 0}%`, background: quotaColor(fiveHourWindow) }"></div>
              </div>
              <strong class="quota-card-footer-value">{{ remainingPercent(fiveHourWindow) ?? '--' }}%</strong>
            </div>
          </article>

          <article class="quota-glass-card" :class="sevenDayState">
            <div class="quota-card-head">
              <h3>7 天额度</h3>
              <span>{{ quotaBadge(sevenDayWindow) }}</span>
            </div>
            <div class="quota-card-body">
              <div class="quota-donut" :style="quotaRingStyle(sevenDayWindow)">
                <svg class="quota-donut-ring" viewBox="0 0 120 120" aria-hidden="true">
                  <circle class="quota-donut-center" cx="60" cy="60" r="43" />
                  <circle class="quota-donut-track" cx="60" cy="60" r="48" pathLength="100" />
                  <circle class="quota-donut-progress" cx="60" cy="60" r="48" pathLength="100" />
                </svg>
                <div class="quota-donut-text">
                  <strong>{{ remainingPercent(sevenDayWindow) ?? '--' }}%</strong>
                </div>
              </div>
              <dl>
                <div>
                  <dt><Clock :size="16" :stroke-width="2" />已用</dt>
                  <dd>{{ usedPercent(sevenDayWindow) }}%</dd>
                </div>
                <div>
                  <dt><Clock :size="16" :stroke-width="2" />剩余</dt>
                  <dd>{{ remainingUntilReset(sevenDayWindow) }}</dd>
                </div>
                <div>
                  <dt><RefreshCw :size="16" :stroke-width="2" />重置于</dt>
                  <dd>{{ resetAtDisplay(sevenDayWindow) }}</dd>
                </div>
              </dl>
            </div>
            <div class="quota-card-footer">
              <span class="quota-card-footer-label">7D 剩余</span>
              <div class="quota-bar">
                <div class="quota-bar-fill" :style="{ width: `${remainingPercent(sevenDayWindow) ?? 0}%`, background: quotaColor(sevenDayWindow) }"></div>
              </div>
              <strong class="quota-card-footer-value">{{ remainingPercent(sevenDayWindow) ?? '--' }}%</strong>
            </div>
          </article>
        </section>

        <section class="dashboard-reset-card">
          <div class="reset-card-summary">
            <span class="reset-card-icon">
              <Ticket :size="18" :stroke-width="2" />
            </span>
            <div>
              <strong>额度重置卡</strong>
              <span>{{ resetCards.length }} 张可用</span>
            </div>
          </div>
          <div class="reset-card-decoration">
            <div class="reset-card-deco-card">
              <div class="reset-card-deco-star"></div>
            </div>
          </div>
          <div class="reset-card-meta">
            <div>
              <Clock :size="13" :stroke-width="2" />
              <span>最近到期</span>
              <strong>{{ nearestResetCardDate || '--' }}</strong>
            </div>
            <div>
              <span>剩余</span>
              <strong>{{ resetCards[0] ? resetCardExpiryText(resetCards[0]).split(' · ')[0].replace('剩余 ', '') : '--' }}</strong>
            </div>
          </div>
          <button class="reset-card-detail-link" type="button" @click="cardDetailOpen = !cardDetailOpen">
            查看详情
            <ChevronRight :size="16" :stroke-width="2" />
          </button>
          <div v-if="cardDetailOpen" class="reset-card-popover">
            <div class="reset-card-popover-head">
              <strong>重置卡详情 <em>{{ resetCards.length }} 张可用</em></strong>
              <button type="button" aria-label="关闭" @click="cardDetailOpen = false">
                <X :size="14" :stroke-width="2" />
              </button>
            </div>
            <div v-if="resetCards.length" class="reset-card-popover-list">
              <div v-for="card in resetCards" :key="card.id" class="reset-card-popover-item">
                <span class="reset-card-popover-days">{{ resetCardExpiryText(card).split(' · ')[0].replace('剩余 ', '') }}</span>
                <span class="reset-card-popover-copy">
                  <span>额度重置卡</span>
                  <strong>{{ resetCardExpiryText(card).split(' · ')[1] || resetCardExpiryText(card) }} 到期</strong>
                </span>
              </div>
            </div>
            <div v-else class="reset-card-popover-empty">暂无可用重置卡</div>
          </div>
        </section>
      </section>
    </main>
  </NConfigProvider>
</template>
