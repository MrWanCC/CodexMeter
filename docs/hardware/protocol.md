# HTTP / BLE 数据协议

## 总体设计

ESP32-C3 Mini 作为局域网 HTTP Server，CodexMeter 桌面端主动推送额度数据。

```text
POST http://<esp32-ip>/api/usage
Content-Type: application/json
```

## 接口列表

### GET /ping

用于检查设备是否在线。

响应：

```json
{
  "ok": true,
  "device": "CodexMeter ESP32-C3",
  "version": "0.1.0",
  "ip": "192.168.1.120",
  "mode": "station"
}
```

`mode` 为 `setup` 时表示设备仍在 AP 配网模式。

### POST /api/usage

桌面端推送额度数据。

请求：

```json
{
  "type": "quota",
  "version": 1,
  "plan": "Codex Plus",
  "lastRefresh": "15:27:08",
  "fiveHour": {
    "remaining": 96,
    "used": 4,
    "reset": "18:59",
    "status": "enough",
    "label": "充足"
  },
  "weekly": {
    "remaining": 38,
    "used": 62,
    "reset": "07/07 10:18",
    "status": "watch",
    "label": "关注"
  }
}
```

响应：

```json
{
  "ok": true
}
```

## 状态枚举

桌面端发送英文状态，ESP32 端根据屏幕能力决定显示英文、缩写或中文。

| status | 中文 | 建议缩写 |
| --- | --- | --- |
| enough | 充足 | OK |
| normal | 正常 | NORM |
| watch | 关注 | WATCH |
| tight | 紧张 | TIGHT |
| warning | 预警 | WARN |
| empty | 已耗尽 | EMPTY |

## 字段规则

- `remaining`：剩余额度百分比，0-100
- `used`：已用额度百分比，0-100
- `reset`：重置时间，按桌面端当前显示格式传入
- `lastRefresh`：桌面端最后刷新时间
- `plan`：套餐名称，例如 `Codex Plus`

## 失败处理

桌面端：

- `/ping` 不通：显示硬件离线
- `/api/usage` 超时：保留上次状态，提示推送失败
- 连续失败：降低推送频率，避免刷屏

ESP32：

- JSON 解析失败：返回 `400`
- 字段缺失：使用上次有效值或默认值
- 数据合法：刷新屏幕并返回 `200`

## BLE

BLE 设备名：

```text
CodexMeter
```

Service UUID：

```text
6f4d0001-9c8f-4c2a-9f12-000000000001
```

Usage Characteristic UUID：

```text
6f4d0002-9c8f-4c2a-9f12-000000000002
```

桌面端写入紧凑 JSON：

```json
{
  "t": "15:30",
  "p": "Plus",
  "h": 96,
  "hr": "18:59",
  "w": 38,
  "wr": "07/07 10:18"
}
```

字段含义：

- `t`：推送时间
- `p`：套餐
- `h`：5 小时剩余额度百分比
- `hr`：5 小时重置时间
- `w`：7 天剩余额度百分比
- `wr`：7 天重置时间
