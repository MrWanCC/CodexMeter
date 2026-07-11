import { describe, expect, it } from 'vitest'
import { WidgetInteractionController } from '../src/main/widgetInteraction'

describe('WidgetInteractionController', () => {
  it('emits one toggle for a short stationary native click', () => {
    const controller = new WidgetInteractionController()
    expect(controller.handle({ type: 'down', x: 40, y: 40, at: 1000 })).toEqual({ type: 'none' })
    expect(controller.handle({ type: 'up', x: 43, y: 43, at: 1200 })).toEqual({ type: 'toggle' })
  })

  it('drags after 180 ms without toggling on release', () => {
    const controller = new WidgetInteractionController()
    controller.handle({ type: 'down', x: 40, y: 40, at: 1000 })
    expect(controller.handle({ type: 'move', x: 40, y: 40, at: 1180 })).toEqual({ type: 'drag-start' })
    expect(controller.handle({ type: 'move', x: 52, y: 46, at: 1200 })).toEqual({ type: 'drag-move', deltaX: 12, deltaY: 6 })
    expect(controller.handle({ type: 'up', x: 52, y: 46, at: 1250 })).toEqual({ type: 'drag-end' })
  })

  it('clears pending state without toggling', () => {
    const controller = new WidgetInteractionController()
    controller.handle({ type: 'down', x: 40, y: 40, at: 1000 })
    expect(controller.handle({ type: 'cancel', x: 40, y: 40, at: 1100 })).toEqual({ type: 'none' })
  })
})
