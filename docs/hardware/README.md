# CodexMeter Hardware

这个目录记录 CodexMeter 的硬件显示方案。当前目标是让 ESP32-C3 Mini 同时支持 BLE 和 HTTP 两种推送方式，并显示到 OLED 或其它外部小屏上。

## 当前阶段

当前主固件：

```text
esp32/sketch_jul1a/sketch_jul1a.ino
```

它同时支持：

- BLE：桌面端直接连接 `CodexMeter` 设备并写入 GATT characteristic
- HTTP：ESP32-C3 接入 Wi-Fi 后，桌面端通过 `/api/usage` 推送
- AP 配网：首次启动时开启 `CodexMeter-Setup` 热点，用户通过 `http://192.168.4.1` 填写 Wi-Fi

## 为什么保留 Wi-Fi HTTP

USB 串口适合快速验证，但正式使用有明显限制：

- 设备必须插在电脑上
- 摆放位置受 USB 线限制
- 多设备扩展不方便
- 用户体验不如无线设备自然

Wi-Fi + HTTP 更适合这个项目：

- ESP32-C3 Mini 可以独立摆放
- 桌面端用 `fetch` 推送即可
- 局域网内调试简单
- 不依赖 MQTT Broker
- 后续可以扩展 WebSocket、MQTT 或设备发现

## 文档

- [Wi-Fi 与配网策略](wifi.md)
- [HTTP / BLE 数据协议](protocol.md)
- [ESP32-C3 Mini 开发说明](esp32-c3-mini.md)

## 安全约定

不要把 Wi-Fi 密码、Token、OAuth 数据写进仓库。

主固件不再需要提交或维护 `secrets.h`。如果后续新增其它私有配置文件，仍需确保被 `.gitignore` 忽略。
