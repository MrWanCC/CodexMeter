<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { NButton, NConfigProvider, NInput, NProgress, NSelect, NSwitch, NTag, type GlobalThemeOverrides } from 'naive-ui'
import {
  AlertCircle,
  Bluetooth,
  Calendar,
  CheckCircle2,
  Clock,
  Cpu,
  Lock,
  Monitor,
  MoreHorizontal,
  Plug,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Ticket,
  User
} from 'lucide-vue-next'
import appIcon from './assets/icon.png'
import { sampleQuotaSnapshot, type QuotaSnapshot, type QuotaWindow, type ResetCard } from '../shared/quota'
import type { AppSettings, RefreshIntervalMinutes } from '../shared/settings'

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
const oauthConnected = ref(false)
const oauthEmail = ref<string | undefined>()
const connecting = ref(false)
const moreOpen = ref(false)
const cardDetailOpen = ref(false)
const noticeVisible = ref(false)
const noticeText = ref('')
const aboutVisible = ref(false)
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
const resetCards = computed<ResetCard[]>(() => snapshot.value?.resetCards ?? [])
const codexPlanLabel = computed(() => {
  const planType = formattedPlanType.value
  if (!planType) {
    return 'Codex OAuth'
  }

  return `Codex ${planType}`
})
const formattedPlanType = computed(() => formatPlanType(snapshot.value?.planType))

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
    hardwareEndpointInput.value = settings.value.hardwareEndpoint ?? ''
    const oauth = await window.codexMeter.getOAuthStatus()
    oauthConnected.value = oauth.connected
    oauthEmail.value = oauth.email
    const widgetState = await window.codexMeter.getWidgetState()
    widgetVisible.value = widgetState.visible
    alwaysOnTop.value = widgetState.visible ? widgetState.alwaysOnTop : false
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

function showAbout(): void {
  aboutVisible.value = true
}

async function updateInterval(value: number): Promise<void> {
  settings.value = window.codexMeter
    ? await window.codexMeter.saveRefreshInterval(value as RefreshIntervalMinutes)
    : { refreshIntervalMinutes: value as RefreshIntervalMinutes, hardwareDisplayEnabled: false }
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
    hardwareStatusText.value = settings.value.hardwareDisplayEnabled ? '硬件推送已启用' : '硬件推送已关闭'
    showNotice(hardwareStatusText.value)
  } catch (error) {
    hardwareStatusText.value = error instanceof Error ? error.message : '硬件设置保存失败'
  } finally {
    hardwareSaving.value = false
  }
}

async function testHardwareDisplay(): Promise<void> {
  if (!window.codexMeter) {
    hardwareStatusText.value = '当前环境无法测试硬件'
    return
  }

  hardwareSaving.value = true
  try {
    settings.value = await window.codexMeter.saveHardwareDisplay(true, hardwareEndpointInput.value)
    hardwareEndpointInput.value = settings.value.hardwareEndpoint ?? hardwareEndpointInput.value.trim()
    const devices = await window.codexMeter.listDevices()
    const device = devices[0]
    if (device?.connected) {
      await window.codexMeter.pushLatestToDevice()
      hardwareStatusText.value = 'ESP32 已连接并已推送'
    } else {
      hardwareStatusText.value = 'ESP32 未响应'
    }
    showNotice(hardwareStatusText.value)
  } catch (error) {
    hardwareStatusText.value = error instanceof Error ? error.message : 'ESP32 测试失败'
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

function remainingPercent(window: QuotaWindow | null): number {
  if (!window) {
    return 0
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

  const remaining = remainingPercent(window)
  if (remaining <= 0) {
    return 'exhausted'
  }

  const thresholds = window.code === '5h'
    ? [60, 30, 20, 10] // 5h: >60 abundant, 30-60 normal, 20-30 attention, 10-20 tight, 1-10 critical
    : [60, 40, 25, 10] // 7d: >60 abundant, 40-60 normal, 25-40 attention, 10-25 tight, 1-10 critical

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
    attention: '关注',
    tight: '紧张',
    critical: '预警',
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
          <span class="widget-source">{{ codexPlanLabel }}</span>
          <button class="widget-refresh" :class="{ 'is-loading': loading }" type="button" @click="refreshQuota">
            <RefreshCw :size="13" :stroke-width="2" />
          </button>
        </div>
      </header>

      <section class="widget-quota">
        <article class="widget-quota-row" :class="fiveHourState">
          <div class="widget-line">
            <div>
              <span>5 小时</span>
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
          <p>
            <span>{{ fiveHourWindow ? `剩余 ${remainingPercent(fiveHourWindow)}% · 已用 ${usedPercent(fiveHourWindow)}%` : '暂无数据' }}</span>
            <span class="widget-reset">
              <Clock :size="10" :stroke-width="2" />
              {{ fiveHourWindow ? resetLabel(fiveHourWindow).replace('重置 ', '') : '--' }}
            </span>
          </p>
        </article>

        <article class="widget-quota-row" :class="sevenDayState">
          <div class="widget-line">
            <div>
              <span>1 周</span>
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
          <p>
            <span>{{ sevenDayWindow ? `剩余 ${remainingPercent(sevenDayWindow)}% · 已用 ${usedPercent(sevenDayWindow)}%` : '暂无数据' }}</span>
            <span class="widget-reset">
              <Calendar :size="10" :stroke-width="2" />
              {{ sevenDayWindow ? widgetResetDateTime(sevenDayWindow) : '--' }}
            </span>
          </p>
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

        <div class="hero-ops">
          <div class="hero-meta-row">
            <div class="last-refresh">
              <Clock :size="16" :stroke-width="2" />
              <span>上次刷新：</span>
              <strong>{{ refreshTime }}</strong>
            </div>
            <NTag
              class="state-tag"
              :type="systemState === 'error' ? 'error' : systemState === 'connected' ? 'success' : 'warning'"
              round
            >
              <span class="state-tag-inner">
                <CheckCircle2 v-if="systemState === 'connected'" :size="13" :stroke-width="2" />
                <Plug v-else :size="13" :stroke-width="2" />
                <span>{{ systemStateLabel }}</span>
              </span>
            </NTag>
          </div>
          <div class="hero-action-row">
            <NButton class="refresh-button" type="primary" size="medium" :loading="loading" @click="refreshQuota">
              <template #icon>
                <RefreshCw :size="16" :stroke-width="2" />
              </template>
              刷新
            </NButton>
            <div class="reset-card-wrap">
              <NButton
                class="more-button"
                :class="{ 'is-open': moreOpen }"
                size="large"
                @click="moreOpen = !moreOpen; cardDetailOpen = false"
              >
                <template #icon>
                  <MoreHorizontal :size="20" :stroke-width="2" />
                </template>
              </NButton>
              <div v-if="moreOpen" class="reset-card-panel">
                <!-- 菜单：重置卡入口 -->
                <div v-if="!cardDetailOpen" class="reset-card-menu-item" @click="cardDetailOpen = true">
                  <Ticket :size="16" :stroke-width="2" />
                  <span>重置卡</span>
                  <span v-if="resetCards.length" class="reset-card-count">{{ resetCards.length }}</span>
                </div>
                <!-- 详情：重置卡列表 -->
                <template v-else>
                  <div class="reset-card-panel-head">
                    <strong>重置卡 · {{ resetCards.length }} 张</strong>
                    <span>可提前重置额度窗口</span>
                  </div>
                  <div v-if="resetCards.length" class="reset-card-list">
                    <div v-for="(card, i) in resetCards" :key="card.id" class="reset-card-item">
                      <Ticket :size="14" :stroke-width="2" />
                      <span>第 {{ i + 1 }} 张</span>
                      <strong>{{ resetCardExpiryText(card) }}</strong>
                    </div>
                  </div>
                  <p v-else class="reset-card-empty">暂无可用重置卡</p>
                </template>
              </div>
            </div>
          </div>
        </div>

        <div class="control-bar">
          <label>
            <span>固定小组件</span>
            <NSwitch :value="widgetVisible" @update:value="updateWidgetVisible" />
          </label>
          <label>
            <span>置顶显示</span>
            <NSwitch :value="alwaysOnTop" :disabled="!widgetVisible" @update:value="updateAlwaysOnTop" />
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
          <NTag class="source-tag" type="success" round>
            <span class="source-tag-inner">
              <ShieldCheck :size="15" :stroke-width="2" />
              <span>OAuth 授权数据</span>
            </span>
          </NTag>
        </div>

        <div class="quota-cards">
          <article class="usage-card" :class="fiveHourState">
            <div class="usage-head">
              <div class="card-title">
                <!-- <component :is="quotaIcon(fiveHourWindow)" class="quota-icon" :size="20" :stroke-width="2" /> -->
                <h3>5 小时额度</h3>
              </div>
            </div>
            <div class="usage-value-row">
              <div class="usage-number">
                <strong>{{ fiveHourWindow ? `${remainingPercent(fiveHourWindow)}%` : '--' }}</strong>
                <span>剩余</span>
              </div>
              <NTag :type="quotaTagType(fiveHourWindow)" round>
                {{ quotaBadge(fiveHourWindow) }}
              </NTag>
            </div>
            <NProgress
              type="line"
              :percentage="remainingPercent(fiveHourWindow)"
              :show-indicator="false"
              :height="8"
              :color="quotaColor(fiveHourWindow)"
              rail-color="#e5e7eb"
            />
            <div class="quota-details">
              <span>已用 {{ usedPercent(fiveHourWindow) }}%</span>
              <span class="quota-reset-time">
                <Clock :size="12" :stroke-width="2" />
                {{ quotaPeriodDisplay(fiveHourWindow) }}
              </span>
            </div>
          </article>

          <article class="usage-card" :class="sevenDayState">
            <div class="usage-head">
              <div class="card-title">
                <!-- <component :is="quotaIcon(sevenDayWindow, true)" class="quota-icon" :size="20" :stroke-width="2" /> -->
                <h3>7 天额度</h3>
              </div>
            </div>
            <div class="usage-value-row">
              <div class="usage-number">
                <strong>{{ sevenDayWindow ? `${remainingPercent(sevenDayWindow)}%` : '--' }}</strong>
                <span>剩余</span>
              </div>
              <NTag :type="quotaTagType(sevenDayWindow)" round>
                {{ quotaBadge(sevenDayWindow) }}
              </NTag>
            </div>
            <NProgress
              type="line"
              :percentage="remainingPercent(sevenDayWindow)"
              :show-indicator="false"
              :height="8"
              :color="quotaColor(sevenDayWindow)"
              rail-color="#e5e7eb"
            />
            <div class="quota-details">
              <span>已用 {{ usedPercent(sevenDayWindow) }}%</span>
              <span class="quota-reset-time">
                <Calendar :size="12" :stroke-width="2" />
                {{ quotaPeriodDisplay(sevenDayWindow) }}
              </span>
            </div>
          </article>
        </div>
      </section>

      <section class="lower-grid">
        <div class="info-card">
          <div class="card-heading">
            <h2>Codex OAuth</h2>
            <div class="oauth-header-ops">
              <span class="oauth-status-badge" :class="oauthConnected ? 'connected' : 'disconnected'">
                <span class="oauth-status-dot" />
                {{ oauthConnected ? '已连接' : '未连接' }}
              </span>
              <NButton
                class="oauth-action"
                :type="oauthConnected ? 'default' : 'primary'"
                :secondary="connecting"
                @click="connecting ? cancelOAuth() : oauthConnected ? disconnectOAuth() : connectOAuth()"
              >
                {{ connecting ? '取消连接' : oauthConnected ? '断开连接' : '连接 Codex' }}
              </NButton>
            </div>
          </div>

          <div class="info-list soft">
            <div>
              <User :size="17" :stroke-width="2" />
              <span>当前账户</span>
              <strong>{{ oauthConnected ? oauthEmail ?? '已授权' : '未授权' }}</strong>
            </div>
            <div>
              <Sparkles :size="17" :stroke-width="2" />
              <span>当前套餐</span>
              <strong>{{ oauthConnected && snapshot ? (formattedPlanType || '标准版') : '--' }}</strong>
            </div>
            <div>
              <ShieldCheck :size="17" :stroke-width="2" />
              <span>凭据状态</span>
              <strong class="oauth-credential-status">
                <template v-if="oauthConnected">
                  已授权
                </template>
                <template v-else>未授权</template>
              </strong>
            </div>
            <div>
              <Lock :size="17" :stroke-width="2" />
              <span>数据存储</span>
              <strong>本地加密</strong>
            </div>
          </div>
        </div>

        <div class="info-card hardware-card">
          <div class="card-heading">
            <div>
              <h2>硬件显示</h2>
            </div>
          </div>

          <div class="hardware-http-panel">
            <div class="hardware-http-row">
              <NInput
                v-model:value="hardwareEndpointInput"
                size="small"
                placeholder="ESP32 地址，例如 192.168.1.120"
                @keyup.enter="testHardwareDisplay"
              />
              <NButton size="small" :loading="hardwareSaving" @click="saveHardwareDisplay(false)">关闭</NButton>
              <NButton size="small" type="primary" :loading="hardwareSaving" @click="testHardwareDisplay">测试</NButton>
            </div>
            <p>{{ hardwareStatusText || (settings?.hardwareDisplayEnabled ? 'HTTP 推送已启用' : '填写 ESP32 IP 后测试连接') }}</p>
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
        <div>本地安全运行 · 仅读取授权数据 · Codex 授权</div>
        <div>
          <span>版本：v1.0.0</span>
          <button type="button" @click="showAbout">关于</button>
        </div>
      </footer>
    </main>
  </NConfigProvider>
</template>
