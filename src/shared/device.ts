import type { QuotaSnapshot } from './quota.js'

export type DeviceChannel = 'none' | 'serial' | 'bluetooth' | 'mqtt'

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
