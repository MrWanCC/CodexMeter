<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { NButton, NCard, NConfigProvider, NProgress, NSelect, NSpace, NTag } from 'naive-ui'
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
      <header class="topbar">
        <div>
          <h1>CodexMeter</h1>
          <p>Windows desktop quota monitor with future hardware display support.</p>
        </div>
        <NTag type="info" round>{{ status }}</NTag>
      </header>

      <section class="quota-grid">
        <NCard class="quota-card" :bordered="false">
          <template #header>5 hour window</template>
          <div class="percent">{{ fiveHourWindow ? `${fiveHourWindow.percentUsed}%` : '--' }}</div>
          <NProgress
            type="line"
            :percentage="fiveHourWindow?.percentUsed ?? 0"
            :show-indicator="false"
            :height="12"
          />
          <p class="muted">
            {{ fiveHourWindow ? `${fiveHourWindow.used} used / ${fiveHourWindow.limit} limit` : 'Unavailable' }}
          </p>
        </NCard>

        <NCard class="quota-card" :bordered="false">
          <template #header>7 day window</template>
          <div class="percent">{{ sevenDayWindow ? `${sevenDayWindow.percentUsed}%` : '--' }}</div>
          <NProgress
            type="line"
            :percentage="sevenDayWindow?.percentUsed ?? 0"
            :show-indicator="false"
            :height="12"
          />
          <p class="muted">
            {{ sevenDayWindow ? `${sevenDayWindow.used} used / ${sevenDayWindow.limit} limit` : 'Unavailable' }}
          </p>
        </NCard>
      </section>

      <section class="control-row">
        <NSpace>
          <NButton type="primary" :loading="loading" @click="refreshQuota">Refresh</NButton>
          <NButton disabled>Connect OAuth</NButton>
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
      </section>

      <section class="device-panel">
        <div>
          <h2>Hardware display</h2>
          <p class="muted">Device bridge is ready. Serial, Bluetooth, and MQTT adapters can be added when hardware is defined.</p>
        </div>
        <NTag :type="devices.length ? 'success' : 'default'">
          {{ devices.length ? `${devices.length} device(s)` : 'No devices connected' }}
        </NTag>
      </section>
    </main>
  </NConfigProvider>
</template>

