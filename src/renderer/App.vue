<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { NButton, NConfigProvider, NProgress, NSelect, NSpace, NTag } from 'naive-ui'
import type { DisplayDevice } from '../shared/device'
import type { QuotaSnapshot, QuotaWindow } from '../shared/quota'
import type { AppSettings, RefreshIntervalMinutes } from '../shared/settings'

const snapshot = ref<QuotaSnapshot | null>(null)
const settings = ref<AppSettings | null>(null)
const devices = ref<DisplayDevice[]>([])
const loading = ref(false)
const status = ref('Ready')

const intervalOptions = [
  { label: 'Manual', value: 0 },
  { label: '1 minute', value: 1 },
  { label: '3 minutes', value: 3 },
  { label: '5 minutes', value: 5 }
]

const fiveHourWindow = computed(() => findWindow('5h'))
const sevenDayWindow = computed(() => findWindow('7d'))
const displayMode = computed(() => (devices.value.length > 0 ? 'Linked' : 'Standby'))

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
            <div class="brand-mark">C</div>
            <div>
              <h1>CodexMeter</h1>
              <p>Codex quota</p>
            </div>
          </div>
          <NTag type="info" round>{{ status }}</NTag>
        </div>

        <div class="meter-grid">
          <article class="meter-card primary-meter">
            <div class="meter-header">
              <span>5 hour window</span>
              <strong>{{ fiveHourWindow ? `${fiveHourWindow.percentUsed}%` : '--' }}</strong>
            </div>
            <NProgress
              type="dashboard"
              :percentage="fiveHourWindow?.percentUsed ?? 0"
              :show-indicator="false"
              :stroke-width="11"
              color="#2563eb"
              rail-color="rgba(37, 99, 235, 0.14)"
            />
            <div class="meter-detail">
              <span>{{ fiveHourWindow ? `${fiveHourWindow.used} used` : 'Unavailable' }}</span>
              <span>{{ fiveHourWindow ? `${fiveHourWindow.limit} limit` : '' }}</span>
            </div>
          </article>

          <article class="meter-card">
            <div class="meter-header">
              <span>7 day window</span>
              <strong>{{ sevenDayWindow ? `${sevenDayWindow.percentUsed}%` : '--' }}</strong>
            </div>
            <NProgress
              type="line"
              :percentage="sevenDayWindow?.percentUsed ?? 0"
              :show-indicator="false"
              :height="12"
              color="#0891b2"
              rail-color="rgba(8, 145, 178, 0.14)"
            />
            <div class="meter-detail">
              <span>{{ sevenDayWindow ? `${sevenDayWindow.used} used` : 'Unavailable' }}</span>
              <span>{{ sevenDayWindow ? `${sevenDayWindow.limit} limit` : '' }}</span>
            </div>
          </article>
        </div>
      </section>

      <section class="lower-grid">
        <div class="control-panel">
          <div>
            <h2>Session</h2>
            <p class="muted">{{ snapshot?.source === 'sample' ? 'Sample' : snapshot?.source ?? 'Loading' }}</p>
          </div>
          <NSpace>
            <NButton type="primary" :loading="loading" @click="refreshQuota">Refresh</NButton>
            <NButton disabled>Connect</NButton>
          </NSpace>
          <div class="interval-control">
            <span>Auto refresh</span>
            <NSelect
              class="interval-select"
              :value="settings?.refreshIntervalMinutes ?? 0"
              :options="intervalOptions"
              @update:value="updateInterval"
            />
          </div>
        </div>

        <div class="device-panel">
          <div class="device-heading">
            <h2>Display output</h2>
            <NTag :type="devices.length ? 'success' : 'default'">{{ displayMode }}</NTag>
          </div>
          <div class="device-row">
            <span>Serial</span>
            <strong>Ready</strong>
          </div>
          <div class="device-row">
            <span>Bluetooth</span>
            <strong>Queued</strong>
          </div>
          <div class="device-row">
            <span>MQTT</span>
            <strong>Queued</strong>
          </div>
        </div>
      </section>
    </main>
  </NConfigProvider>
</template>
