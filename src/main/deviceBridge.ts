import type { DeviceBridge, DisplayDevice } from '../shared/device.js'
import type { QuotaSnapshot } from '../shared/quota.js'

export class NoopDeviceBridge implements DeviceBridge {
  async listDevices(): Promise<DisplayDevice[]> {
    return []
  }

  async sendSnapshot(_snapshot: QuotaSnapshot): Promise<void> {
    return
  }
}
