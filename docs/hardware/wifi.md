# Wi-Fi 与配网策略

## 当前方案：AP 配网

主固件不再依赖 `secrets.h` 写死 Wi-Fi。ESP32-C3 会把 Wi-Fi 配置保存到 NVS / Preferences。

首次启动或连接失败时：

```text
1. ESP32 开启热点：CodexMeter-Setup
2. 热点密码：12345678
3. 用户连接该热点
4. 打开 http://192.168.4.1
5. 输入 Wi-Fi 名称和密码
6. 保存后 ESP32 自动重启
7. 重启后连接家庭/办公 Wi-Fi
8. OLED 显示 ESP32 在局域网内的 IP
9. CodexMeter 桌面端 HTTP 模式填写该 IP
```

如果需要重新配网，连接当前 ESP32 地址后打开：

```text
http://<esp32-ip>/reset
```

固件会清除已保存的 Wi-Fi 并重启，随后再次进入 `CodexMeter-Setup` 配网页。

## 设备发现

当前仍需要在桌面端手动填写 ESP32 IP。后续可以继续做自动发现：

- mDNS：`codexmeter.local`
- UDP broadcast
- 桌面端扫描局域网

建议下一步优先做 mDNS，这样用户不需要记 IP。

## 推荐连接逻辑

ESP32 启动：

```text
1. 初始化屏幕
2. 读取 Preferences 中的 Wi-Fi 配置
3. 没有配置则进入 AP 配网
4. 有配置则连接 Wi-Fi
5. 成功后显示 IP 地址
6. 启动 HTTP Server 和 BLE 广播
7. 等待桌面端推送额度数据
```

连接失败：

```text
1. 屏幕显示 WiFi failed
2. 串口输出错误
3. 进入 AP 配网，允许用户重新填写 Wi-Fi
```
