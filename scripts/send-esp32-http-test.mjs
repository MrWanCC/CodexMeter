const target = process.argv[2]

if (!target) {
  console.error('Usage: node scripts/send-esp32-http-test.mjs http://192.168.1.xxx')
  process.exit(1)
}

const baseUrl = target.replace(/\/$/, '')

const payload = {
  type: 'quota',
  version: 1,
  plan: 'Codex Plus',
  lastRefresh: new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }),
  fiveHour: {
    remaining: 96,
    used: 4,
    reset: '18:59',
    status: 'enough',
    label: '充足'
  },
  weekly: {
    remaining: 38,
    used: 62,
    reset: '07/07 10:18',
    status: 'watch',
    label: '关注'
  }
}

const health = await fetch(`${baseUrl}/ping`)
console.log('GET /ping', health.status, await health.text())

const quota = await fetch(`${baseUrl}/api/usage`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
})

console.log('POST /api/usage', quota.status, await quota.text())
