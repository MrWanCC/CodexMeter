import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('ESP32 combined firmware', () => {
  it('keeps HTTP and BLE support in the main sketch', () => {
    const sketch = readFileSync('esp32/sketch_jul1a/sketch_jul1a.ino', 'utf8')

    expect(sketch).toContain('#include <WebServer.h>')
    expect(sketch).toContain('#include <NimBLEDevice.h>')
    expect(sketch).toContain('server.on("/api/usage", HTTP_POST, handleQuota)')
    expect(sketch).toContain('NimBLEDevice::init(BLE_DEVICE_NAME)')
  })

  it('starts Wi-Fi or setup AP before BLE advertising', () => {
    const sketch = readFileSync('esp32/sketch_jul1a/sketch_jul1a.ino', 'utf8')
    const setupBody = sketch.slice(sketch.indexOf('void setup()'))

    expect(setupBody.indexOf('connectWiFi()')).toBeLessThan(setupBody.indexOf('setupBle()'))
    expect(setupBody.indexOf('setupRoutes()')).toBeLessThan(setupBody.indexOf('setupBle()'))
  })

  it('serves a guided Wi-Fi setup page', () => {
    const sketch = readFileSync('esp32/sketch_jul1a/sketch_jul1a.ino', 'utf8')

    expect(sketch).toContain('CodexMeter Setup')
    expect(sketch).toContain('Connect to your Wi-Fi')
    expect(sketch).toContain('AP: CodexMeter-Setup')
  })
})
