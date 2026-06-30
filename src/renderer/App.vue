<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { NButton, NConfigProvider, NProgress, NSelect, NSwitch, NTag } from 'naive-ui'
import type { DisplayDevice } from '../shared/device'
import { sampleQuotaSnapshot, type QuotaSnapshot, type QuotaWindow } from '../shared/quota'
import type { AppSettings, RefreshIntervalMinutes } from '../shared/settings'

const snapshot = ref<QuotaSnapshot | null>(null)
const settings = ref<AppSettings | null>(null)
const devices = ref<DisplayDevice[]>([])
const loading = ref(false)
const status = ref('就绪')
const widgetVisible = ref(true)
const alwaysOnTop = ref(false)

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

onMounted(async () => {
  if (window.codexMeter) {
    settings.value = await window.codexMeter.getSettings()
    devices.value = await window.codexMeter.listDevices()
  } else {
    settings.value = { refreshIntervalMinutes: 0, hardwareDisplayEnabled: false }
  }
  await refreshQuota()
})

async function refreshQuota(): Promise<void> {
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
}

function findWindow(code: '5h' | '7d'): QuotaWindow | null {
  return snapshot.value?.windows.find((window) => window.code === code) ?? null
}
</script>

<template>
  <NConfigProvider>
    <main class="app-shell">
      <section class="hero-panel">
        <div class="hero-topline">
          <div class="brand-lockup">
            <div class="brand-mark">⌁</div>
            <div>
              <h1>CodexMeter</h1>
              <p>{{ refreshSummary }}</p>
            </div>
          </div>
          <NTag type="success" round>{{ status }}</NTag>
        </div>

        <div class="hero-actions">
          <div class="refresh-status">
            <span class="status-dot"></span>
            <div>
              <strong>{{ loading ? '正在刷新' : '安全刷新' }}</strong>
              <p>只读取授权后的用量数据，不发起模型请求</p>
            </div>
          </div>

          <div class="button-row">
            <NButton type="primary" size="small" :loading="loading" @click="refreshQuota">刷新</NButton>
            <NButton size="small" disabled>连接</NButton>
          </div>
        </div>

        <div class="widget-controls">
          <label>
            <span>固定小组件</span>
            <NSwitch v-model:value="widgetVisible" size="small" />
          </label>
          <label>
            <span>置顶</span>
            <NSwitch v-model:value="alwaysOnTop" size="small" />
          </label>
          <div class="interval-control">
            <span>自动刷新</span>
            <NSelect
              class="interval-select"
              size="small"
              :value="settings?.refreshIntervalMinutes ?? 0"
              :options="intervalOptions"
              @update:value="updateInterval"
            />
          </div>
        </div>
      </section>

      <section class="quota-panel glass-panel">
        <div class="panel-title">
          <NTag type="info" round>Codex</NTag>
          <span>可用</span>
        </div>

        <div class="quota-rows">
          <article class="quota-row">
            <div class="quota-line">
              <strong>5 小时额度窗口</strong>
              <div class="quota-value">
                <span>{{ fiveHourWindow ? `${fiveHourWindow.percentUsed}%` : '—' }}</span>
                <small>短周期</small>
              </div>
            </div>
            <NProgress
              type="line"
              :percentage="fiveHourWindow?.percentUsed ?? 0"
              :show-indicator="false"
              :height="7"
              color="#22c55e"
              rail-color="rgba(15, 23, 42, 0.12)"
            />
            <p>{{ fiveHourWindow ? `已用 ${fiveHourWindow.used} · 上限 ${fiveHourWindow.limit}` : '暂无可用数据' }}</p>
          </article>

          <article class="quota-row">
            <div class="quota-line">
              <strong>7 天额度窗口</strong>
              <div class="quota-value">
                <span>{{ sevenDayWindow ? `${sevenDayWindow.percentUsed}%` : '—' }}</span>
                <small>周周期</small>
              </div>
            </div>
            <NProgress
              type="line"
              :percentage="sevenDayWindow?.percentUsed ?? 0"
              :show-indicator="false"
              :height="7"
              color="#22c55e"
              rail-color="rgba(15, 23, 42, 0.12)"
            />
            <p>{{ sevenDayWindow ? `已用 ${sevenDayWindow.used} · 上限 ${sevenDayWindow.limit}` : '暂无可用数据' }}</p>
          </article>
        </div>
      </section>

      <section class="settings-grid">
        <div class="glass-panel provider-panel">
          <div class="section-heading">
            <h2>Codex OAuth</h2>
            <NTag type="warning" round>未连接</NTag>
          </div>
          <p class="muted">下一步接入 OAuth 授权和本地 token 存储。</p>
          <div class="brief-list">
            <span>安全刷新</span>
            <span>本地凭据存储</span>
            <span>不发送 prompt</span>
          </div>
        </div>

        <div class="glass-panel provider-panel">
          <div class="section-heading">
            <h2>硬件显示</h2>
            <NTag :type="devices.length ? 'success' : 'default'" round>{{ displayMode }}</NTag>
          </div>
          <div class="device-row">
            <span>串口</span>
            <strong>已预留</strong>
          </div>
          <div class="device-row">
            <span>蓝牙</span>
            <strong>下一步</strong>
          </div>
          <div class="device-row">
            <span>MQTT</span>
            <strong>下一步</strong>
          </div>
        </div>
      </section>
    </main>
  </NConfigProvider>
</template>
