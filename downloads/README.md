# 下载成品

这里放面向普通用户的下载说明。不要下载源码包，直接下载对应平台的软件包即可。

## 推荐下载

### Windows 用户

下载这个：

[CodexMeter v0.1.2 Windows 便携版](https://github.com/MrWanCC/CodexMeter/releases/download/v0.1.2/CodexMeter-v0.1.2-win-x64-portable.exe)

双击即可运行，不需要安装。

### macOS 用户

进入 [v0.1.2 软件版 Release](https://github.com/MrWanCC/CodexMeter/releases/tag/v0.1.2) 下载 `.dmg`：

- Apple 芯片：`CodexMeter-v0.1.2-software-mac-arm64.dmg`
- Intel 芯片：`CodexMeter-v0.1.2-software-mac-x64.dmg`

当前 macOS 版本未做 Apple 开发者签名和 notarize。如果系统提示未知开发者，需要在系统设置中允许打开。

## 当前版本

| 版本 | 平台 | 说明 | 下载 |
| --- | --- | --- | --- |
| 软件版 v0.1.2 | Windows / macOS | 不带硬件连接功能，只在电脑本地查看 Codex 额度；支持系统代理登录；默认 1 分钟刷新 | [Windows 便携版](https://github.com/MrWanCC/CodexMeter/releases/download/v0.1.2/CodexMeter-v0.1.2-win-x64-portable.exe) / [macOS Release](https://github.com/MrWanCC/CodexMeter/releases/tag/v0.1.2) |
| 硬件版 v0.1.0 | Windows | 支持蓝牙和 HTTP 连接 ESP32-C3 OLED 小屏 | [CodexMeter v0.1.0 硬件版](https://github.com/MrWanCC/CodexMeter/releases/tag/v0.1.0-hardware) |

## 不要下载这些

GitHub Release 页面会自动显示：

- `Source code (zip)`
- `Source code (tar.gz)`

这两个是源码包，不是普通用户运行的软件。

## 软件版更新说明

- 默认自动刷新间隔调整为 1 分钟。
- 主页面额度进度条右侧百分比字号加大。
- “连接 / 断开”按钮表示连接或断开 Codex 账号授权，不是连接硬件设备。
