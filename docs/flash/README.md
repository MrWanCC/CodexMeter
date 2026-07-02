# CodexMeter ESP32-C3 Web Flasher

这个目录用于 GitHub Pages 网页刷机。

页面地址规划：

```text
https://mrwancc.github.io/CodexMeter/flash/
```

如果页面未打开，需要在 GitHub 仓库设置中启用 Pages：

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/docs`

## 固件文件

当前固件：

```text
firmware/codexmeter-esp32c3-v0.1.0.bin
```

这是 ESP32-C3 的 merged binary，manifest 从 offset `0` 写入。

## 重新生成固件

在 Arduino IDE 中选择 ESP32-C3 Dev Module 编译导出，或用 Arduino CLI 编译后使用生成的 merged bin。

当前固件来源：

```text
esp32/sketch_jul1a/sketch_jul1a.ino
```
