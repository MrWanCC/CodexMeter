# 下载成品

这里放可直接运行的 CodexMeter 成品，适合不想研究源码、只想直接使用的人。

## 当前版本

| 版本 | 平台 | 说明 | 下载 |
| --- | --- | --- | --- |
| 软件版 | Windows / macOS | 不带硬件连接功能，只在电脑本地查看 Codex 额度；当前 Windows 成品默认 1 分钟刷新，额度条右侧百分比已放大 | [CodexMeter v0.1.0 软件版](https://github.com/MrWanCC/CodexMeter/releases/tag/v0.1.0) / [本仓库 Windows 便携版](CodexMeter-v0.1.0-win-x64/CodexMeter-v0.1.0-win-x64-portable.exe) |
| 硬件版 | Windows | 支持蓝牙和 HTTP 连接 ESP32-C3 OLED 小屏 | [CodexMeter v0.1.0 硬件版](https://github.com/MrWanCC/CodexMeter/releases/tag/v0.1.0-hardware) |

## 使用方式

Windows 双击 `.exe` 即可运行，不需要先安装开发环境。

macOS 下载 `.dmg` 后打开运行。当前未做 Apple 开发者签名和 notarize，如系统提示未知开发者，需要在系统设置中允许打开。

如果只想看额度，下载软件版。需要外接小屏时，下载硬件版。

如果 Windows 提示未知发布者，这是因为当前版本还没有代码签名证书。确认文件来自本仓库后再运行。

## 软件版更新说明

- 默认自动刷新间隔调整为 1 分钟。
- 主页面额度进度条右侧百分比字号加大，方便快速查看。
- 账号连接按钮用于连接或断开 Codex 账号授权，不连接硬件设备。

## 许可限制

本项目允许：

- 学习
- 个人使用
- 非商业二次开发
- 非商业分发

本项目不允许：

- 商业使用
- 售卖本软件或修改版
- 集成到付费产品或商业服务
- 用作商业运营的一部分

商业使用需要先获得作者书面授权。
