# CodexMeter Hardware

这个目录记录 CodexMeter 的硬件显示方案。当前目标是让 ESP32-C3 Mini 连接 Wi-Fi 后接收桌面端推送的额度数据，并显示到 OLED 或其它外部小屏上。

## 当前阶段

第一阶段采用：

```text
CodexMeter Desktop
  -> HTTP POST
  -> ESP32-C3 Mini
  -> OLED / external display
```

暂不做复杂配网。Wi-Fi 信息先在本地固件配置里写死，后续再升级为 AP 配网页。

## 为什么先走 Wi-Fi HTTP

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
- [HTTP 数据协议](protocol.md)
- [ESP32-C3 Mini 开发说明](esp32-c3-mini.md)

## 安全约定

不要把 Wi-Fi 密码、Token、OAuth 数据写进仓库。

建议本地使用：

```text
esp32/**/secrets.h
```

并确保该文件被 `.gitignore` 忽略。仓库只提交 `secrets.example.h` 这类示例文件。
