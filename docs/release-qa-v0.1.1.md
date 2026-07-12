# CodexMeter v0.1.1 发布验收

## Release

- Release 地址：https://github.com/MrWanCC/CodexMeter/releases/tag/v0.1.1
- Release 名称：CodexMeter v0.1.1 - Software Edition

## 资产验收

GitHub Release 当前包含 3 个面向用户的成品包：

| 文件 | 平台 | 大小 | SHA256 |
| --- | --- | ---: | --- |
| `CodexMeter-v0.1.1-win-x64-portable.exe` | Windows x64 | 78,291,951 bytes | `878899f8777c2f268057b2df0db3e6a062c2effe21f3315dcd0e9efec661ff7b` |
| `CodexMeter-v0.1.1-software-mac-arm64.dmg` | macOS Apple 芯片 | 111,698,644 bytes | `df870b7edae15c0aabe23e2819b6622bc6d891230d5b939f57bb814ee3651eed` |
| `CodexMeter-v0.1.1-software-mac-x64.dmg` | macOS Intel 芯片 | 116,121,066 bytes | `5df206b8df4f361e921fb6245a02430891d8ffe3d62aa95dad0f788fba2cfbe2` |

## 本地验收

- `npm test`：15 个测试文件，43 个测试通过。
- `npm run build`：通过。
- `npm run dist:portable`：通过，确认 Windows 产物为 `release/CodexMeter 0.1.1.exe`。
- 从 GitHub Release 下载 Windows exe 后重新计算 SHA256，结果与 Release API digest 一致。

## 已知限制

- Windows exe 当前未签名，系统可能提示未知发布者。
- macOS dmg 当前未做 Apple 开发者签名和 notarize，系统可能提示未知开发者。
- GitHub Release 会自动显示 `Source code (zip)` 和 `Source code (tar.gz)`，无法隐藏，只能在正文中提示普通用户不要下载。
