import Store from 'electron-store'
import { defaultSettings, type AppSettings } from '../shared/settings.js'

type StoreSchema = {
  settings: AppSettings
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
