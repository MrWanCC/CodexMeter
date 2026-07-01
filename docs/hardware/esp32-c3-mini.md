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
- WiFi
- WebServer

`WiFi` 和 `WebServer` 来自 ESP32 Arduino Core。

## 固件结构建议

```text
esp32/
  sketch_jul1a/
    sketch_jul1a.ino
    secrets.example.h
    secrets.h          # 本地私有，不提交
```

## 第一版固件职责

- 连接写死 Wi-Fi
- 显示本机 IP
- 提供 `GET /health`
- 提供 `POST /quota`
- 解析 JSON
- 更新 OLED 显示

## 本地测试

烧录后先从串口监视器查看 ESP32-C3 Mini 的 IP 地址，然后在桌面端运行：

```powershell
node scripts/send-esp32-http-test.mjs http://192.168.1.xxx
```

预期结果：

```text
GET /health 200 {"ok":true,...}
POST /quota 200 {"ok":true}
```

OLED 应显示 5H / 7D 两行额度信息。

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

- AP 配网
- mDNS 设备名：`codexmeter.local`
- 屏幕亮度设置
- 多页面轮播
- WebSocket 实时连接
- MQTT 推送
