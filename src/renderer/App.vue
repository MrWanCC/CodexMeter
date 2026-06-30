<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { NButton, NConfigProvider, NProgress, NSelect, NSwitch, NTag } from 'naive-ui'
import type { DisplayDevice } from '../shared/device'
import type { QuotaSnapshot, QuotaWindow } from '../shared/quota'
import type { AppSettings, RefreshIntervalMinutes } from '../shared/settings'

const snapshot = ref<QuotaSnapshot | null>(null)
const settings = ref<AppSettings | null>(null)
const devices = ref<DisplayDevice[]>([])
const loading = ref(false)
const status = ref('Ready')
const widgetVisible = ref(true)
const alwaysOnTop = ref(false)

const intervalOptions = [
  { label: 'Manual', value: 0 },
  { label: '1 minute', value: 1 },
  { label: '3 minutes', value: 3 },
  { label: '5 minutes', value: 5 }
]

const fiveHourWindow = computed(() => findWindow('5h'))
const sevenDayWindow = computed(() => findWindow('7d'))
const displayMode = computed(() => (devices.value.length > 0 ? 'Linked' : 'Standby'))
const refreshSummary = computed(() => {
  if (!snapshot.value) {
    return 'Not updated yet'
  }

  return `Last updated ${new Date(snapshot.value.refreshedAt).toLocaleTimeString()}`
})

onMounted(async () => {
  settings.value = await window.codexMeter.getSettings()
  devices.value = await window.codexMeter.listDevices()
  await refreshQuota()
})

async function refreshQuota(): Promise<void> {
  loading.value = true
  status.value = 'Refreshing'
  try {
    snapshot.value = await window.codexMeter.refreshQuota()
    status.value = `Updated ${new Date(snapshot.value.refreshedAt).toLocaleTimeString()}`
  } finally {
    loading.value = false
  }
}

async function updateInterval(value: number): Promise<void> {
  settings.value = await window.codexMeter.saveRefreshInterval(value as RefreshIntervalMinutes)
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
              <strong>{{ loading ? 'Refreshing' : 'Safe refresh' }}</strong>
              <p>Reads usage data only, no model request</p>
            </div>
          </div>

          <div class="button-row">
            <NButton type="primary" size="small" :loading="loading" @click="refreshQuota">Refresh</NButton>
            <NButton size="small" disabled>Connect</NButton>
          </div>
        </div>

        <div class="widget-controls">
          <label>
            <span>Pin widget</span>
            <NSwitch v-model:value="widgetVisible" size="small" />
          </label>
          <label>
            <span>Always on top</span>
            <NSwitch v-model:value="alwaysOnTop" size="small" />
          </label>
          <div class="interval-control">
            <span>Refresh</span>
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
          <span>Available</span>
        </div>

        <div class="quota-rows">
          <article class="quota-row">
            <div class="quota-line">
              <strong>5 hour window</strong>
              <div class="quota-value">
                <span>{{ fiveHourWindow ? `${fiveHourWindow.percentUsed}%` : '—' }}</span>
                <small>resets soon</small>
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
            <p>{{ fiveHourWindow ? `${fiveHourWindow.used} used · ${fiveHourWindow.limit} limit` : 'Unavailable' }}</p>
          </article>

          <article class="quota-row">
            <div class="quota-line">
              <strong>7 day window</strong>
              <div class="quota-value">
                <span>{{ sevenDayWindow ? `${sevenDayWindow.percentUsed}%` : '—' }}</span>
                <small>weekly</small>
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
            <p>{{ sevenDayWindow ? `${sevenDayWindow.used} used · ${sevenDayWindow.limit} limit` : 'Unavailable' }}</p>
          </article>
        </div>
      </section>

      <section class="settings-grid">
        <div class="glass-panel provider-panel">
          <div class="section-heading">
            <h2>Codex OAuth</h2>
            <NTag type="warning" round>Not connected</NTag>
          </div>
          <p class="muted">OAuth and token storage are reserved for the next implementation step.</p>
          <div class="brief-list">
            <span>Safe refresh</span>
            <span>Local token storage</span>
            <span>No prompt requests</span>
          </div>
        </div>

        <div class="glass-panel provider-panel">
          <div class="section-heading">
            <h2>Display output</h2>
            <NTag :type="devices.length ? 'success' : 'default'" round>{{ displayMode }}</NTag>
          </div>
          <div class="device-row">
            <span>Serial</span>
            <strong>Ready</strong>
          </div>
          <div class="device-row">
            <span>Bluetooth</span>
            <strong>Next</strong>
          </div>
          <div class="device-row">
            <span>MQTT</span>
            <strong>Next</strong>
          </div>
        </div>
      </section>
    </main>
  </NConfigProvider>
</template>
