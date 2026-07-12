# GitHub Release 下载说明模板

把下面这段放到 GitHub Release 正文最顶部，让用户在看到 Assets 列表前先知道该点哪个。

```markdown
## 推荐下载

### Windows 用户

下载这个：

[CodexMeter-v0.1.0-win-x64-portable.exe](https://github.com/MrWanCC/CodexMeter/raw/software-edition/downloads/CodexMeter-v0.1.0-win-x64/CodexMeter-v0.1.0-win-x64-portable.exe)

双击即可运行，不需要安装。

### macOS 用户

- Apple 芯片：下载 `CodexMeter-0.1.0-software-mac-arm64.dmg`
- Intel 芯片：下载 `CodexMeter-0.1.0-software-mac-x64.dmg`

### 不要下载这些

- `Source code (zip)`
- `Source code (tar.gz)`
- `.zip` 包，除非你明确知道自己需要压缩包
```

建议 Release 附件只保留：

- `CodexMeter-v0.1.0-win-x64-portable.exe`
- `CodexMeter-0.1.0-software-mac-arm64.dmg`
- `CodexMeter-0.1.0-software-mac-x64.dmg`

GitHub 自动生成的 `Source code` 两项不能隐藏，只能在正文里提示普通用户不要下载。
