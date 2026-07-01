import type { QuotaSnapshot } from './quota.js'

export type DeviceChannel = 'none' | 'serial' | 'http' | 'bluetooth' | 'mqtt'

export type HardwareQuotaStatus = 'enough' | 'normal' | 'watch' | 'tight' | 'warning' | 'empty'

export interface Esp32QuotaWindowPayload {
  remaining: number
  used: number
  reset: string
  status: HardwareQuotaStatus
  label: string
}

export interface Esp32QuotaPayload {
  type: 'quota'
  version: 1
  plan: string
  lastRefresh: string
  fiveHour: Esp32QuotaWindowPayload
  weekly: Esp32QuotaWindowPayload
}

export interface DisplayDevice {
  id: string
  name: string
  channel: DeviceChannel
  connected: boolean
}

export interface DeviceBridge {
  listDevices(): Promise<DisplayDevice[]>
  sendSnapshot(snapshot: QuotaSnapshot): Promise<void>
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

export class HttpDeviceBridge implements DeviceBridge {
  private readonly endpoint: string
  private readonly fetcher: Fetcher

  constructor(endpoint: string, fetcher: Fetcher = fetch) {
    this.endpoint = normalizeHttpEndpoint(endpoint)
    this.fetcher = fetcher
  }

  async listDevices(): Promise<DisplayDevice[]> {
    return [
      {
        id: this.endpoint,
        name: 'ESP32-C3 HTTP Display',
        channel: 'http',
        connected: await this.isOnline()
      }
    ]
  }

  async sendSnapshot(snapshot: QuotaSnapshot): Promise<void> {
    const response = await this.fetcher(`${this.endpoint}/quota`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(buildEsp32QuotaPayload(snapshot)),
      signal: AbortSignal.timeout(3000)
    })

    if (!response.ok) {
      throw new Error(`ESP32 quota push failed: ${response.status}`)
    }
  }

  private async isOnline(): Promise<boolean> {
    try {
      const response = await this.fetcher(`${this.endpoint}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(1500)
      })

      return response.ok
    } catch {
      return false
    }
  }
}

export function buildEsp32QuotaPayload(snapshot: QuotaSnapshot, now = new Date()): Esp32QuotaPayload {
  const fiveHour = snapshot.windows.find((window) => window.code === '5h')
  const weekly = snapshot.windows.find((window) => window.code === '7d')

  return {
    type: 'quota',
    version: 1,
    plan: displayPlan(snapshot.planType),
    lastRefresh: formatTime(snapshot.refreshedAt, now),
    fiveHour: buildWindowPayload(fiveHour, '5h', now),
    weekly: buildWindowPayload(weekly, '7d', now)
  }
}

function buildWindowPayload(
  window: QuotaSnapshot['windows'][number] | undefined,
  code: '5h' | '7d',
  now: Date
): Esp32QuotaWindowPayload {
  if (!window) {
    return {
      remaining: 0,
      used: 0,
      reset: '--',
      status: 'empty',
      label: statusLabel('empty')
    }
  }

  const used = clampPercent(Math.round(window.percentUsed))
  const remaining = clampPercent(100 - used)
  const status = quotaStatus(remaining, code)

  return {
    remaining,
    used,
    reset: formatReset(window.resetAt, code, now),
    status,
    label: statusLabel(status)
  }
}

function quotaStatus(remaining: number, code: '5h' | '7d'): HardwareQuotaStatus {
  if (remaining <= 0) {
    return 'empty'
  }

  if (remaining <= 10) {
    return 'warning'
  }

  if (remaining <= 20) {
    return 'tight'
  }

  if (code === '7d') {
    if (remaining <= 40) {
      return 'watch'
    }

    if (remaining <= 60) {
      return 'normal'
    }

    return 'enough'
  }

  if (remaining <= 30) {
    return 'watch'
  }

  if (remaining <= 60) {
    return 'normal'
  }

  return 'enough'
}

function statusLabel(status: HardwareQuotaStatus): string {
  const labels: Record<HardwareQuotaStatus, string> = {
    enough: '充足',
    normal: '正常',
    watch: '关注',
    tight: '紧张',
    warning: '预警',
    empty: '已耗尽'
  }

  return labels[status]
}

function displayPlan(planType: string | undefined): string {
  if (!planType) {
    return 'Codex'
  }

  return `Codex ${planType.charAt(0).toUpperCase()}${planType.slice(1)}`
}

function formatTime(input: string | undefined, now: Date): string {
  const date = input ? new Date(input) : now
  if (Number.isNaN(date.getTime())) {
    return formatLocalTime(now)
  }

  return formatLocalTime(date)
}

function formatReset(input: string | undefined, code: '5h' | '7d', now: Date): string {
  if (!input) {
    return '--'
  }

  const date = new Date(input)
  if (Number.isNaN(date.getTime())) {
    return '--'
  }

  return code === '7d' ? formatMonthDayTime(date) : formatLocalTime(date)
}

function formatLocalTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai'
  })
}

function formatMonthDayTime(date: Date): string {
  const monthDay = date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Shanghai'
  })
  return `${monthDay.replace(/\//g, '/')} ${formatLocalTime(date)}`
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value))
}

function normalizeHttpEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, '')
}
