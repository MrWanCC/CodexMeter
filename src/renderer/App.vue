<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { NButton, NConfigProvider, NProgress, NSelect, NSwitch, NTag } from 'naive-ui'
import appIcon from './assets/icon.png'
import type { DisplayDevice } from '../shared/device'
import { sampleQuotaSnapshot, type QuotaSnapshot, type QuotaWindow } from '../shared/quota'
import type { AppSettings, RefreshIntervalMinutes } from '../shared/settings'

const isWidgetView = new URLSearchParams(window.location.search).get('view') === 'widget'
const snapshot = ref<QuotaSnapshot | null>(null)
const settings = ref<AppSettings | null>(null)
const devices = ref<DisplayDevice[]>([])
const loading = ref(false)
const status = ref('就绪')
const widgetVisible = ref(false)
const alwaysOnTop = ref(false)
const oauthConnected = ref(false)
const oauthEmail = ref<string | undefined>()
const connecting = ref(false)
let unsubscribeQuota: (() => void) | undefined
let refreshTimer: ReturnType<typeof setInterval> | undefined

const intervalOptions = [
  { label: '手动', value: 0 },
  { label: '1 分钟', value: 1 },
  { label: '3 分钟', value: 3 },
  { label: '5 分钟', value: 5 }
]

const fiveHourWindow = computed(() => findWindow('5h'))
const sevenDayWindow = computed(() => findWindow('7d'))
const displayMode = computed(() => (devices.value.length > 0 ? '已连接' : '待机'))
const refreshSummary = computed(() => {
  if (!snapshot.value) {
    return '尚未刷新'
  }

  return `上次刷新 ${new Date(snapshot.value.refreshedAt).toLocaleTimeString()}`
})
const quotaSourceLabel = computed(() => {
  if (!snapshot.value) {
    return '未刷新'
  }

  if (snapshot.value.source === 'codex') {
    return 'Codex OAuth'
  }

  if (snapshot.value.source === 'sample') {
    return '样例数据'
  }

  return '不可用'
})
const planLabel = computed(() => formatPlan(snapshot.value?.planType))

onMounted(async () => {
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
    devices.value = await window.codexMeter.listDevices()
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
  configureAutoRefresh(settings.value?.refreshIntervalMinutes ?? 0)
})

onUnmounted(() => {
  unsubscribeQuota?.()
  clearAutoRefresh()
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
    status.value = error instanceof Error && error.message.includes('timed out') ? '连接超时，可重试' : '连接失败'
  } finally {
    connecting.value = false
  }
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

function quotaTone(window: QuotaWindow | null): 'danger' | 'healthy' | 'empty' {
  if (!window) {
    return 'empty'
  }

  return remainingPercent(window) <= 10 ? 'danger' : 'healthy'
}

function quotaBadge(window: QuotaWindow | null): string {
  if (!window) {
    return '无数据'
  }

  return remainingPercent(window) <= 10 ? '已耗尽' : '正常'
}

function quotaColor(window: QuotaWindow | null): string {
  const remaining = remainingPercent(window)
  if (remaining === 0) {
    return '#ff4d12'
  }

  if (remaining < 20) {
    return '#f5b51b'
  }

  if (remaining >= 50) {
    return '#16a34a'
  }

  return '#22b8a0'
}

function resetLabel(window: QuotaWindow | null): string {
  if (!window?.resetAt) {
    return window?.code === '5h' ? '重置时间未知' : '本周期'
  }

  const date = new Date(window.resetAt)
  if (Number.isNaN(date.getTime())) {
    return '重置时间未知'
  }

  return window.code === '5h'
    ? `重置 ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : `重置 ${date.toLocaleDateString([], { month: 'numeric', day: 'numeric' })}`
}

function formatPlan(planType: string | undefined): string {
  if (!planType) {
    return '套餐未知'
  }

  const normalized = planType.toLowerCase()
  if (normalized.includes('plus')) {
    return 'Plus 套餐'
  }

  if (normalized.includes('pro')) {
    return 'Pro 套餐'
  }

  if (normalized.includes('team')) {
    return 'Team 套餐'
  }

  if (normalized.includes('enterprise')) {
    return 'Enterprise 套餐'
  }

  if (normalized.includes('free')) {
    return 'Free 套餐'
  }

  return `${planType} 套餐`
}
</script>

<template>
  <NConfigProvider>
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
          <span class="widget-source">{{ quotaSourceLabel }}</span>
          <button class="widget-refresh" :class="{ 'is-loading': loading }" type="button" @click="refreshQuota">
            ↻
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
            color="#22c55e"
            rail-color="rgba(15, 23, 42, 0.12)"
          />
          <p>{{ fiveHourWindow ? `剩余 ${remainingPercent(fiveHourWindow)}% · 已用 ${fiveHourWindow.used}%` : '暂无数据' }}</p>
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
            color="#22c55e"
            rail-color="rgba(15, 23, 42, 0.12)"
          />
          <p>{{ sevenDayWindow ? `剩余 ${remainingPercent(sevenDayWindow)}% · 已用 ${sevenDayWindow.used}%` : '暂无数据' }}</p>
        </article>
      </section>
    </main>

    <main v-else class="desktop-shell">
      <section class="desktop-hero">
        <div class="hero-brand">
          <img class="hero-mark" :src="appIcon" alt="" />
          <div>
            <h1>CodexMeter</h1>
            <p>Codex usage monitor · local secure refresh</p>
            <div class="safe-copy">
              <span class="shield-icon">▣</span>
              <span>安全刷新：仅读取授权后的用量数据，不发起模型请求</span>
            </div>
          </div>
        </div>

        <div class="hero-side">
          <div class="last-refresh">
            <span>◴</span>
            <span>{{ refreshSummary.replace('上次刷新 ', '上次刷新：') }}</span>
          </div>
          <div class="hero-buttons">
            <NTag :type="oauthConnected ? 'success' : 'warning'" round>
              <span class="tag-dot"></span>
              {{ oauthConnected ? '已连接' : '未连接' }}
            </NTag>
            <NButton class="refresh-button" type="primary" size="large" :loading="loading" @click="refreshQuota">
              ↻ 刷新
            </NButton>
            <NButton class="more-button" size="large">...</NButton>
          </div>
        </div>

        <div class="hero-controls">
          <label>
            <span>固定小组件</span>
            <NSwitch :value="widgetVisible" @update:value="updateWidgetVisible" />
          </label>
          <label>
            <span>置顶显示</span>
            <NSwitch :value="alwaysOnTop" @update:value="updateAlwaysOnTop" />
          </label>
          <div class="divider"></div>
          <div class="interval-control">
            <span>刷新策略</span>
            <NSelect
              class="interval-select"
              :value="settings?.refreshIntervalMinutes ?? 0"
              :options="intervalOptions"
              @update:value="updateInterval"
            />
          </div>
        </div>
      </section>

      <section class="usage-section">
        <div class="section-title">
          <h2>使用额度</h2>
          <div class="quota-meta">
            <NTag type="info" round>{{ planLabel }}</NTag>
            <NTag type="success" round>{{ quotaSourceLabel }}</NTag>
          </div>
        </div>

        <div class="quota-cards">
          <article class="usage-card" :class="quotaTone(fiveHourWindow)">
            <div class="usage-head">
              <h3>5 小时额度窗口</h3>
              <div class="card-tags">
                <NTag class="reset-tag" round>{{ resetLabel(fiveHourWindow) }}</NTag>
                <NTag :type="quotaTone(fiveHourWindow) === 'danger' ? 'error' : 'success'" round>
                  {{ quotaBadge(fiveHourWindow) }}
                </NTag>
              </div>
            </div>
            <div class="usage-number">
              <strong>{{ fiveHourWindow ? `${remainingPercent(fiveHourWindow)}%` : '--' }}</strong>
              <span>剩余</span>
            </div>
            <NProgress
              type="line"
              :percentage="remainingPercent(fiveHourWindow)"
              :show-indicator="false"
              :height="8"
              :color="quotaColor(fiveHourWindow)"
              rail-color="rgba(15, 23, 42, 0.12)"
            />
            <p>
              {{
                fiveHourWindow
                  ? `已用 ${fiveHourWindow.percentUsed}%，${remainingPercent(fiveHourWindow) <= 10 ? '短周期额度暂不可用' : '短周期额度可用'}`
                  : '暂无可用数据'
              }}
            </p>
          </article>

          <article class="usage-card" :class="quotaTone(sevenDayWindow)">
            <div class="usage-head">
              <h3>7 天额度窗口</h3>
              <div class="card-tags">
                <NTag class="reset-tag" round>{{ resetLabel(sevenDayWindow) }}</NTag>
                <NTag :type="quotaTone(sevenDayWindow) === 'danger' ? 'error' : 'success'" round>
                  {{ quotaBadge(sevenDayWindow) }}
                </NTag>
              </div>
            </div>
            <div class="usage-number">
              <strong>{{ sevenDayWindow ? `${remainingPercent(sevenDayWindow)}%` : '--' }}</strong>
              <span>剩余</span>
            </div>
            <NProgress
              type="line"
              :percentage="remainingPercent(sevenDayWindow)"
              :show-indicator="false"
              :height="8"
              :color="quotaColor(sevenDayWindow)"
              rail-color="rgba(15, 23, 42, 0.12)"
            />
            <p>
              {{
                sevenDayWindow
                  ? `已用 ${sevenDayWindow.percentUsed}%，本周期额度${remainingPercent(sevenDayWindow) <= 10 ? '偏低' : '充足'}`
                  : '暂无可用数据'
              }}
            </p>
          </article>
        </div>
      </section>

      <section class="lower-grid">
        <div class="info-card">
          <div class="card-heading">
            <h2>Codex OAuth</h2>
            <div class="heading-actions">
              <NTag :type="oauthConnected ? 'success' : 'warning'" round>
                <span class="tag-dot"></span>
                {{ oauthConnected ? '已连接' : '未连接' }}
              </NTag>
              <NButton
                class="oauth-action"
                :type="oauthConnected ? 'default' : 'primary'"
                :loading="connecting"
                @click="oauthConnected ? disconnectOAuth() : connectOAuth()"
              >
                {{ oauthConnected ? '断开连接' : '连接 Codex' }}
              </NButton>
            </div>
          </div>
          <div class="info-list">
            <div>
              <span>当前账户</span>
              <strong>{{ oauthConnected ? oauthEmail ?? '已授权账号' : '未授权' }}</strong>
            </div>
            <div>
              <span>凭据状态</span>
              <strong>{{ oauthConnected ? '已授权' : '待授权' }}</strong>
            </div>
            <div>
              <span>数据存储</span>
              <strong>本地加密</strong>
            </div>
          </div>
        </div>

        <div class="info-card">
          <div class="card-heading">
            <h2>硬件显示</h2>
            <NTag :type="devices.length ? 'success' : 'default'" round>{{ displayMode }}</NTag>
          </div>
          <div class="info-list">
            <div>
              <span>说明</span>
              <strong>后续把桌面端额度状态同步到外部屏幕或设备</strong>
            </div>
            <div>
              <span>串口显示</span>
              <strong>已预留</strong>
            </div>
            <div>
              <span>蓝牙连接</span>
              <strong>规划中</strong>
            </div>
            <div>
              <span>MQTT 推送</span>
              <strong>规划中</strong>
            </div>
          </div>
        </div>
      </section>

      <footer class="app-footer">
        <span>本地安全运行</span>
        <span>仅读取授权数据，不发起模型请求</span>
        <span>数据来源：Codex OAuth</span>
        <span>v1.0.0</span>
        <span>检查更新</span>
      </footer>
    </main>
  </NConfigProvider>
</template>
