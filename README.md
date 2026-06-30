# CodexMeter

CodexMeter is a Windows desktop app for checking Codex quota status. It is built as an original Electron + Vue 3 application and keeps a device-communication layer ready for future hardware display support.

## Stack

- Electron
- Vue 3
- TypeScript
- Vite
- Naive UI
- electron-store
- electron-builder

Future device channels:

- Serial: `node-serialport`
- Bluetooth: Web Bluetooth or `@abandonware/noble`
- Network display: MQTT.js

## Development

```powershell
npm install
npm run build
npm run test
```

Run the desktop app during development:

```powershell
npm run dev
```

Run the built desktop app:

```powershell
npm run start
```

## Notes

Do not commit API keys, OAuth tokens, `.env` files, or local user data.
