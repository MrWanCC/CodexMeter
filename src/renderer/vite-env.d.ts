/// <reference types="vite/client" />

import type { CodexMeterApi } from '../preload'

declare global {
  interface Window {
    codexMeter: CodexMeterApi
  }
}

