# GitHub Release 下载说明模板

把下面这段放到 GitHub Release 正文顶部，让用户在看到 Assets 列表前先知道该点哪个。

```markdown
## 推荐下载

### Windows 用户

下载 `CodexMeter-v0.1.1-win-x64-portable.exe`。

双击即可运行，不需要安装。

### macOS 用户

- Apple 芯片：下载 `CodexMeter-v0.1.1-software-mac-arm64.dmg`
- Intel 芯片：下载 `CodexMeter-v0.1.1-software-mac-x64.dmg`

### 不要下载这些

- `Source code (zip)`
- `Source code (tar.gz)`

这两个是源码包，不是普通用户运行的软件。
```

建议 Release 附件只保留：

- `CodexMeter-v0.1.1-win-x64-portable.exe`
- `CodexMeter-v0.1.1-software-mac-arm64.dmg`
- `CodexMeter-v0.1.1-software-mac-x64.dmg`

GitHub 自动生成的 `Source code` 两项不能隐藏，只能在正文里提示普通用户不要下载。
