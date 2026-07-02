# ESP32-C3 Mini 开发说明

## 硬件目标

当前硬件：

- ESP32-C3 Mini
- OLED 屏幕，当前草稿使用 SSD1306 128x64

当前引脚草稿：

```cpp
#define OLED_SDA 6
#define OLED_SCL 4
#define OLED_RESET -1
```

## Arduino 依赖

建议先使用 Arduino IDE 或 Arduino CLI。

需要库：

- Adafruit GFX Library
- Adafruit SSD1306
- ArduinoJson
- NimBLE-Arduino
- WiFi
- WebServer
- DNSServer
- Preferences

`WiFi`、`WebServer`、`DNSServer` 和 `Preferences` 来自 ESP32 Arduino Core。

## 固件结构建议

```text
esp32/
  sketch_jul1a/
    sketch_jul1a.ino
```

## 主固件职责

- 启动 BLE 广播：`CodexMeter`
- 提供 BLE GATT 写入通道
- 首次启动进入 AP 配网
- 保存 Wi-Fi 到 ESP32 Preferences
- 自动连接已保存 Wi-Fi
- 显示本机 IP
- 提供 `GET /ping`
- 提供 `POST /api/usage`
- 解析 JSON
- 更新 OLED 显示

## 本地测试

首次烧录后：

```text
1. 连接 Wi-Fi 热点：CodexMeter-Setup
2. 密码：12345678
3. 打开：http://192.168.4.1
4. 填写本地 Wi-Fi
5. 保存后等待 ESP32 重启
```

重启后先从串口监视器或 OLED 查看 ESP32-C3 Mini 的 IP 地址，然后在桌面端运行：

```powershell
node scripts/send-esp32-http-test.mjs http://192.168.1.xxx
```

预期结果：

```text
GET /ping 200 {"ok":true,...}
POST /api/usage 200 {"ok":true}
```

OLED 应显示 5H / 7D 两行额度信息。

也可以在 CodexMeter 主界面的“硬件显示”区域填写 ESP32 地址，例如：

```text
192.168.1.120
```

点击“测试”后，桌面端会先检查 `/ping`，连通后立即把当前额度推送到 `/api/usage`。启用后，每次刷新额度也会自动推送到 `/api/usage`。

BLE 模式不需要配网。烧录后桌面端可直接搜索 `CodexMeter` 蓝牙设备。

## OLED 显示建议

128x64 屏幕空间有限，第一版建议显示：

```text
CodexMeter   15:27
5H  96%  OK
[##########]
7D  38%  WATCH
[####------]
```

中文字体后续再做。第一版优先保证稳定显示和数据链路。

## 后续扩展

- mDNS 设备名：`codexmeter.local`
- 屏幕亮度设置
- 多页面轮播
- WebSocket 实时连接
- MQTT 推送
