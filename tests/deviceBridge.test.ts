import { describe, expect, it, vi } from 'vitest'
import { HttpDeviceBridge } from '../src/shared/device'
import { sampleQuotaSnapshot } from '../src/shared/quota'

describe('HttpDeviceBridge', () => {
  it('returns an offline HTTP device when health check fails', async () => {
    const bridge = new HttpDeviceBridge('http://192.168.1.120', async () => {
      throw new Error('offline')
    })

    await expect(bridge.listDevices()).resolves.toEqual([
      {
        id: 'http://192.168.1.120',
        name: 'ESP32-C3 HTTP Display',
        channel: 'http',
        connected: false
      }
    ])
  })

  it('checks health and posts quota snapshots', async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/ping')) {
        return new Response('{"ok":true}', { status: 200 })
      }

      if (url.endsWith('/api/usage') && init?.method === 'POST') {
        return new Response('{"ok":true}', { status: 200 })
      }

      return new Response('not found', { status: 404 })
    })
    const bridge = new HttpDeviceBridge('http://192.168.1.120/', fetcher)

    await expect(bridge.listDevices()).resolves.toEqual([
      {
        id: 'http://192.168.1.120',
        name: 'ESP32-C3 HTTP Display',
        channel: 'http',
        connected: true
      }
    ])

    await bridge.sendSnapshot(sampleQuotaSnapshot(new Date('2026-07-01T07:30:00.000Z')))

    expect(fetcher).toHaveBeenCalledWith('http://192.168.1.120/api/usage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: expect.stringContaining('"type":"quota"'),
      signal: expect.any(AbortSignal)
    })
  })

  it('adds http protocol for bare IP endpoints', async () => {
    const bridge = new HttpDeviceBridge('192.168.1.120', async () => {
      return new Response('{"ok":true}', { status: 200 })
    })

    await expect(bridge.listDevices()).resolves.toMatchObject([
      {
        id: 'http://192.168.1.120',
        connected: true
      }
    ])
  })
})
