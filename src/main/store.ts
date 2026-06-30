import Store from 'electron-store'
import { defaultSettings, type AppSettings } from '../shared/settings.js'

type StoreSchema = {
  settings: AppSettings
  codexOAuth?: {
    accessToken: string
    refreshToken: string
    idToken?: string
    expiresAt: string
    email?: string
  }
}

const store = new Store<StoreSchema>({
  name: 'codexmeter',
  defaults: {
    settings: defaultSettings
  }
})

export function getSettings(): AppSettings {
  return store.get('settings', defaultSettings)
}

export function saveSettings(settings: AppSettings): AppSettings {
  store.set('settings', settings)
  return settings
}

export function getCodexOAuth() {
  return store.get('codexOAuth')
}

export function saveCodexOAuth(token: NonNullable<StoreSchema['codexOAuth']>) {
  store.set('codexOAuth', token)
  return token
}

export function clearCodexOAuth(): void {
  store.delete('codexOAuth')
}
