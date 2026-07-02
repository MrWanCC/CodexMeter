# BLE Beacon Test

这是 ESP32-C3 的最小 BLE 广播测试固件，用来排除 CodexMeter 业务逻辑影响。

## 使用方法

1. Arduino IDE 打开：

```text
esp32/sketch_ble_beacon_test/sketch_ble_beacon_test.ino
```

2. 上传到 ESP32-C3。
3. 打开串口监视器，确认输出：

```text
BLE beacon test start
BLETEST advertising
```

4. 用手机 BLE Scanner / nRF Connect 搜：

```text
BLETEST
```

## 判断

- 能搜到 `BLETEST`：板子 BLE 广播正常，再回到 `sketch_jul1a` 主固件调业务逻辑。
- 搜不到 `BLETEST`：先检查 Arduino IDE 板卡是否选的是 ESP32C3 Dev Module，并确认手机使用的是 BLE Scanner / nRF Connect，不是系统蓝牙配对页。
