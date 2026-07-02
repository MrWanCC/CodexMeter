/// <reference types="vite/client" />

import type { CodexMeterApi } from '../preload'

declare global {
  interface Window {
    codexMeter?: CodexMeterApi
  }

  interface Navigator {
    bluetooth?: Bluetooth
  }

  interface Bluetooth {
    requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>
  }

  interface RequestDeviceOptions {
    filters?: Array<{ name?: string; namePrefix?: string; services?: string[] }>
    optionalServices?: string[]
    acceptAllDevices?: boolean
  }

  interface BluetoothDevice {
    id: string
    name?: string
    gatt?: BluetoothRemoteGATTServer
    addEventListener(type: 'gattserverdisconnected', listener: () => void): void
  }

  interface BluetoothRemoteGATTServer {
    connected: boolean
    connect(): Promise<BluetoothRemoteGATTServer>
    getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>
  }

  interface BluetoothRemoteGATTService {
    getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>
  }

  interface BluetoothRemoteGATTCharacteristic {
    writeValue(value: BufferSource): Promise<void>
  }
}
