# Wi-Fi 与配网策略

## 第一版：写死 Wi-Fi

第一版目标是先跑通硬件显示链路，不做复杂配网。

ESP32-C3 Mini 固件中使用本地私有配置：

```cpp
// secrets.h，不提交到仓库
#pragma once

const char* WIFI_SSID = "your-wifi-name";
const char* WIFI_PASSWORD = "your-wifi-password";
```

固件中引用：

```cpp
#include "secrets.h"
```

注意：真实 Wi-Fi 名称和密码只放在本地 `secrets.h`，不要提交到 GitHub。

## 第二版：AP 配网

后续做成用户可配置：

```text
1. ESP32 第一次启动，没有 Wi-Fi 配置
2. 开启热点：CodexMeter-Setup
3. 用户连接热点
4. 打开 http://192.168.4.1
5. 输入 Wi-Fi 名称和密码
6. 保存到 ESP32 NVS / Preferences
7. 重启后自动连接家庭 Wi-Fi
```

## 第三版：设备发现

跑通 HTTP 后再考虑自动发现：

- mDNS：`codexmeter.local`
- UDP broadcast
- 桌面端扫描局域网

第一版建议先手动填写 ESP32 IP，降低复杂度。

## 推荐连接逻辑

ESP32 启动：

```text
1. 初始化屏幕
2. 显示 Wi-Fi connecting
3. 连接写死的 Wi-Fi
4. 成功后显示 IP 地址
5. 启动 HTTP Server
6. 等待桌面端推送额度数据
```

连接失败：

```text
1. 屏幕显示 Wi-Fi failed
2. 串口输出错误
3. 每隔 5 秒重试
```
