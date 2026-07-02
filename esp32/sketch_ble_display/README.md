# CodexMeter BLE Display

这是 CodexMeter 的蓝牙小屏固件预览版，用于 ESP32-C3 + SSD1306 OLED。

## 刷写文件

用 Arduino IDE 打开：

```text
esp32/sketch_ble_display/sketch_ble_display.ino
```

## 依赖库

- Adafruit SSD1306
- Adafruit GFX Library
- ArduinoJson
- NimBLE-Arduino

## OLED 引脚

```text
SDA: GPIO 6
SCL: GPIO 4
I2C 地址: 0x3C
```

## 蓝牙信息

```text
设备名: CMeter
Service UUID: 6f4d0001-9c8f-4c2a-9f12-000000000001
Usage Characteristic UUID: 6f4d0002-9c8f-4c2a-9f12-000000000002
```

桌面端连接后会写入紧凑 JSON：

```json
{"t":"15:27","p":"Plus","h":96,"hr":"18:59","w":38,"wr":"07/07 10:18"}
```

## 搜不到蓝牙时

1. 确认 Arduino IDE 打开的是 `sketch_ble_display.ino`，不是 `sketch_jul1a.ino`。
2. 重新上电后，OLED 应显示 `BLE advertising`，串口应输出 `BLE advertising`。
3. 先用手机 BLE Scanner / nRF Connect 搜 `CMeter`，确认 ESP32 真实广播。
4. 如果 Windows 曾经连接过但现在搜不到，先在系统蓝牙设置里删除旧的 `CMeter`、`CodexMeter` 或 `CodexMeter Display`，再重新连接。
5. 断开连接后，固件会自动重新开始广播。
