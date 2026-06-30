<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { NButton, NConfigProvider, NProgress, NSelect, NSwitch, NTag, type GlobalThemeOverrides } from 'naive-ui'
import {
  AlertCircle,
  Bluetooth,
  Calendar,
  Clock,
  Cpu,
  Database,
  CheckCircle2,
  KeyRound,
  Monitor,
  MoreHorizontal,
  Plug,
  Radio,
  RefreshCw,
  ShieldCheck,
  User,
  Wifi
} from 'lucide-vue-next'
import appIcon from './assets/icon.png'
import { sampleQuotaSnapshot, type QuotaSnapshot, type QuotaWindow } from '../shared/quota'
import type { AppSettings, RefreshIntervalMinutes } from '../shared/settings'

const isWidgetView = new URLSearchParams(window.location.search).get('view') === 'widget'
const snapshot = ref<QuotaSnapshot | null>(null)
const settings = ref<AppSettings | null>(null)
const loading = ref(false)
const status = ref('就绪')
const widgetVisible = ref(false)
const alwaysOnTop = ref(false)
const oauthConnected = ref(false)
const oauthEmail = ref<string | undefined>()
const connecting = ref(false)
const noticeVisible = ref(false)
const noticeText = ref('')
let unsubscribeQuota: (() => void) | undefined
let refreshTimer: ReturnType<typeof setInterval> | undefined
let noticeTimer: ReturnType<typeof setTimeout> | undefined
let removeCopyListener: (() => void) | undefined

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
const systemStateIcon = computed(() => (systemState.value === 'connected' ? Wifi : Plug))
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

onMounted(async () => {
  const handleCopy = () => showNotice('已复制到剪贴板')
  document.addEventListener('copy', handleCopy)
  removeCopyListener = () => document.removeEventListener('copy', handleCopy)

  unsubscribeQuota = window.codexMeter?.onQuotaUpdated((nextSnapshot) => {
    snapshot.value = nextSnapshot
    status.value = `已刷新 ${new Date(nextSnapshot.refreshedAt).toLocaleTimeString()}`
  })

  if (isWidgetView) {
    snapshot.value = window.codexMeter ? await window.codexMeter.getLatestQuota() : sampleQuotaSnapshot()
    return
  }

  if (window.codexMeter) {
    settings.value = await window.codexMeter.getSettings()
    const oauth = await window.codexMeter.getOAuthStatus()
    oauthConnected.value = oauth.connected
    oauthEmail.value = oauth.email
    const widgetState = await window.codexMeter.getWidgetState()
    widgetVisible.value = widgetState.visible
    alwaysOnTop.value = widgetState.alwaysOnTop
  } else {
    settings.value = { refreshIntervalMinutes: 5, hardwareDisplayEnabled: false }
  }

  await refreshQuota()
  configureAutoRefresh(settings.value?.refreshIntervalMinutes ?? 5)
})

onUnmounted(() => {
  unsubscribeQuota?.()
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

async function updateInterval(value: number): Promise<void> {
  settings.value = window.codexMeter
    ? await window.codexMeter.saveRefreshInterval(value as RefreshIntervalMinutes)
    : { refreshIntervalMinutes: value as RefreshIntervalMinutes, hardwareDisplayEnabled: false }
  configureAutoRefresh(settings.value.refreshIntervalMinutes)
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
  if (!window.codexMeter) {
    return
  }

  const state = await window.codexMeter.setWidgetVisible(value, alwaysOnTop.value)
  widgetVisible.value = state.visible
  alwaysOnTop.value = state.alwaysOnTop
}

async function updateAlwaysOnTop(value: boolean): Promise<void> {
  alwaysOnTop.value = value
  if (!window.codexMeter) {
    return
  }

  const state = await window.codexMeter.setWidgetAlwaysOnTop(value)
  widgetVisible.value = state.visible
  alwaysOnTop.value = state.alwaysOnTop
}

function findWindow(code: '5h' | '7d'): QuotaWindow | null {
  return snapshot.value?.windows.find((window) => window.code === code) ?? null
}

function remainingPercent(window: QuotaWindow | null): number {
  if (!window) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round((100 - window.percentUsed) * 100) / 100))
}

function usedPercent(window: QuotaWindow | null): number {
  return window ? Math.round(window.percentUsed * 100) / 100 : 0
}

function quotaState(window: QuotaWindow | null): 'empty' | 'exhausted' | 'warning' | 'normal' | 'abundant' {
  if (!window) {
    return 'empty'
  }

  const remaining = remainingPercent(window)
  if (remaining <= 0) {
    return 'exhausted'
  }

  if (remaining <= 30) {
    return 'warning'
  }

  if (remaining <= 70) {
    return 'normal'
  }

  return 'abundant'
}

function quotaBadge(window: QuotaWindow | null, weekly = false): string {
  const state = quotaState(window)
  if (state === 'empty') {
    return '无数据'
  }

  if (state === 'exhausted') {
    return '已耗尽'
  }

  if (state === 'warning') {
    return '紧张'
  }

  return state === 'abundant' ? '充足' : '正常'
}

function quotaColor(window: QuotaWindow | null): string {
  const state = quotaState(window)
  if (state === 'exhausted') {
    return '#ef4444'
  }

  if (state === 'warning') {
    return '#f59e0b'
  }

  return state === 'abundant' ? '#16a34a' : '#22c55e'
}

function quotaTagType(window: QuotaWindow | null): 'default' | 'error' | 'warning' | 'success' {
  const state = quotaState(window)
  if (state === 'empty') {
    return 'default'
  }

  if (state === 'exhausted') {
    return 'error'
  }

  if (state === 'warning') {
    return 'warning'
  }

  return 'success'
}

function quotaIcon(window: QuotaWindow | null, weekly = false) {
  const state = quotaState(window)
  if (state === 'exhausted' || state === 'warning') {
    return AlertCircle
  }

  return weekly ? Calendar : Clock
}

function resetLabel(window: QuotaWindow | null): string {
  if (!window?.resetAt) {
    return '下次重置：未知'
  }

  const date = new Date(window.resetAt)
  if (Number.isNaN(date.getTime())) {
    return '下次重置：未知'
  }

  return window.code === '5h'
    ? `下次重置：${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : `下次重置：${date.toLocaleDateString([], { month: '2-digit', day: '2-digit' })}`
}

function quotaCopy(window: QuotaWindow | null, scope: 'short' | 'weekly'): string {
  if (!window) {
    return '暂无可用数据'
  }

  if (scope === 'short') {
    return `已用 ${usedPercent(window)}%，短周期额度可用`
  }

  return `已用 ${usedPercent(window)}%，本周期额度充足`
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

    <main v-if="isWidgetView" class="widget-shell">
      <header class="widget-header">
        <div class="widget-brand">
          <img class="widget-mark" :src="appIcon" alt="" />
          <div>
            <strong>CodexMeter</strong>
            <span>{{ refreshSummary }}</span>
          </div>
        </div>
        <div class="widget-tools">
          <span class="widget-source">Codex OAuth</span>
          <button class="widget-refresh" :class="{ 'is-loading': loading }" type="button" @click="refreshQuota">
            <RefreshCw :size="13" :stroke-width="2" />
          </button>
        </div>
      </header>

      <section class="widget-quota">
        <article class="widget-quota-row">
          <div class="widget-line">
            <div>
              <span>5 小时额度</span>
              <small>短周期</small>
            </div>
            <strong>{{ fiveHourWindow ? `${remainingPercent(fiveHourWindow)}%` : '--' }}</strong>
          </div>
          <NProgress
            type="line"
            :percentage="remainingPercent(fiveHourWindow)"
            :show-indicator="false"
            :height="5"
            :color="quotaColor(fiveHourWindow)"
            rail-color="rgba(15, 23, 42, 0.12)"
          />
          <p>{{ fiveHourWindow ? `剩余 ${remainingPercent(fiveHourWindow)}% · 已用 ${usedPercent(fiveHourWindow)}%` : '暂无数据' }}</p>
        </article>

        <article class="widget-quota-row">
          <div class="widget-line">
            <div>
              <span>7 天额度</span>
              <small>周周期</small>
            </div>
            <strong>{{ sevenDayWindow ? `${remainingPercent(sevenDayWindow)}%` : '--' }}</strong>
          </div>
          <NProgress
            type="line"
            :percentage="remainingPercent(sevenDayWindow)"
            :show-indicator="false"
            :height="5"
            :color="quotaColor(sevenDayWindow)"
            rail-color="rgba(15, 23, 42, 0.12)"
          />
          <p>{{ sevenDayWindow ? `剩余 ${remainingPercent(sevenDayWindow)}% · 已用 ${usedPercent(sevenDayWindow)}%` : '暂无数据' }}</p>
        </article>
      </section>
    </main>

    <main v-else class="desktop-shell">
      <section class="desktop-hero">
        <div class="hero-main">
          <img class="hero-mark" :src="appIcon" alt="" />
          <div>
            <h1>CodexMeter</h1>
            <p>Codex usage monitor · local secure refresh</p>
            <div class="safe-copy">
              <ShieldCheck :size="15" :stroke-width="2" />
              <span>安全刷新：仅读取授权后的用量数据，不发起模型请求</span>
            </div>
          </div>
        </div>

        <div class="hero-status">
          <div class="last-refresh">
            <Clock :size="16" :stroke-width="2" />
            <span>上次刷新：</span>
            <strong>{{ refreshTime }}</strong>
          </div>
          <NTag :type="systemState === 'error' ? 'error' : systemState === 'connected' ? 'success' : 'warning'" round>
            <component :is="systemStateIcon" :size="14" :stroke-width="2" />
            {{ systemStateLabel }}
          </NTag>
        </div>

        <div class="hero-actions">
          <NButton class="refresh-button" type="primary" size="large" :loading="loading" @click="refreshQuota">
            <template #icon>
              <RefreshCw :size="18" :stroke-width="2" />
            </template>
            刷新数据
          </NButton>
          <NButton class="more-button" size="large">
            <MoreHorizontal :size="20" :stroke-width="2" />
          </NButton>
        </div>

        <div class="control-bar">
          <label>
            <span>固定小组件</span>
            <NSwitch :value="widgetVisible" @update:value="updateWidgetVisible" />
          </label>
          <label>
            <span>置顶显示</span>
            <NSwitch :value="alwaysOnTop" @update:value="updateAlwaysOnTop" />
          </label>
          <div class="interval-control">
            <span>刷新策略</span>
            <NSelect
              class="interval-select"
              :value="settings?.refreshIntervalMinutes ?? 5"
              :options="intervalOptions"
              @update:value="updateInterval"
            />
          </div>
        </div>
      </section>

      <section class="usage-section">
        <div class="section-title">
          <h2>使用额度</h2>
        </div>

        <div class="quota-cards">
          <article class="usage-card" :class="fiveHourState">
            <div class="usage-head">
              <div class="card-title">
                <component :is="quotaIcon(fiveHourWindow)" class="quota-icon" :size="22" :stroke-width="2" />
                <h3>5 小时额度窗口</h3>
              </div>
              <NTag :type="quotaTagType(fiveHourWindow)" round>
                {{ quotaBadge(fiveHourWindow) }}
              </NTag>
            </div>
            <div class="usage-number">
              <strong>{{ fiveHourWindow ? `${remainingPercent(fiveHourWindow)}%` : '--' }}</strong>
              <span>剩余</span>
            </div>
            <NProgress
              type="line"
              :percentage="remainingPercent(fiveHourWindow)"
              :show-indicator="false"
              :height="10"
              :color="quotaColor(fiveHourWindow)"
              rail-color="rgba(15, 23, 42, 0.12)"
            />
            <div class="quota-details">
              <span>状态：{{ quotaBadge(fiveHourWindow) }}</span>
              <span>{{ resetLabel(fiveHourWindow) }}</span>
            </div>
            <p>{{ quotaCopy(fiveHourWindow, 'short') }}</p>
          </article>

          <article class="usage-card" :class="sevenDayState">
            <div class="usage-head">
              <div class="card-title">
                <component :is="quotaIcon(sevenDayWindow, true)" class="quota-icon" :size="22" :stroke-width="2" />
                <h3>7 天额度窗口</h3>
              </div>
              <NTag :type="quotaTagType(sevenDayWindow)" round>
                {{ quotaBadge(sevenDayWindow, true) }}
              </NTag>
            </div>
            <div class="usage-number">
              <strong>{{ sevenDayWindow ? `${remainingPercent(sevenDayWindow)}%` : '--' }}</strong>
              <span>剩余</span>
            </div>
            <NProgress
              type="line"
              :percentage="remainingPercent(sevenDayWindow)"
              :show-indicator="false"
              :height="10"
              :color="quotaColor(sevenDayWindow)"
              rail-color="rgba(15, 23, 42, 0.12)"
            />
            <div class="quota-details">
              <span>状态：{{ quotaBadge(sevenDayWindow, true) }}</span>
              <span>{{ resetLabel(sevenDayWindow) }}</span>
            </div>
            <p>{{ quotaCopy(sevenDayWindow, 'weekly') }}</p>
          </article>
        </div>
      </section>

      <section class="lower-grid">
        <div class="info-card">
          <div class="card-heading">
            <h2>Codex OAuth</h2>
            <NButton
              class="oauth-action"
              :type="oauthConnected ? 'default' : 'primary'"
              :secondary="connecting"
              @click="connecting ? cancelOAuth() : oauthConnected ? disconnectOAuth() : connectOAuth()"
            >
              {{ connecting ? '取消连接' : oauthConnected ? '断开连接' : '连接 Codex' }}
            </NButton>
          </div>

          <div class="info-list soft">
            <div>
              <User :size="17" :stroke-width="2" />
              <span>当前账户</span>
              <strong>{{ oauthConnected ? oauthEmail ?? '已授权账号' : '未授权' }}</strong>
            </div>
            <div>
              <KeyRound :size="17" :stroke-width="2" />
              <span>授权方式</span>
              <strong>Codex OAuth</strong>
            </div>
            <div>
              <ShieldCheck :size="17" :stroke-width="2" />
              <span>请求权限</span>
              <strong>只读用量数据</strong>
            </div>
            <div>
              <Database :size="17" :stroke-width="2" />
              <span>数据存储</span>
              <strong>本地加密</strong>
            </div>
          </div>
        </div>

        <div class="info-card hardware-card">
          <div class="card-heading">
            <div>
              <h2>硬件显示</h2>
              <p>后续支持将额度状态同步至外部设备</p>
            </div>
          </div>

          <div class="hardware-list">
            <div>
              <Cpu :size="17" :stroke-width="2" />
              <span>串口显示</span>
              <strong>已预留</strong>
            </div>
            <div>
              <Bluetooth :size="17" :stroke-width="2" />
              <span>蓝牙连接</span>
              <strong class="muted-state">待扩展</strong>
            </div>
            <div>
              <Radio :size="17" :stroke-width="2" />
              <span>MQTT 推送</span>
              <strong class="muted-state">待扩展</strong>
            </div>
            <div>
              <Monitor :size="17" :stroke-width="2" />
              <span>外部小屏</span>
              <strong class="muted-state">待扩展</strong>
            </div>
          </div>
        </div>
      </section>

      <footer class="app-footer">
        <div>本地安全运行 · 仅读取授权数据 · Codex OAuth</div>
        <div>
          <span>版本：v1.0.0</span>
          <button type="button">检查更新</button>
        </div>
      </footer>
    </main>
  </NConfigProvider>
</template>
