export type WidgetPointerInput = {
  type: 'down' | 'move' | 'up' | 'cancel'
  x: number
  y: number
  at: number
}

export type WidgetInteractionAction =
  | { type: 'none' }
  | { type: 'toggle' }
  | { type: 'drag-start' }
  | { type: 'drag-move'; deltaX: number; deltaY: number }
  | { type: 'drag-end' }

export class WidgetInteractionController {
  private down?: { x: number; y: number; at: number }
  private last?: { x: number; y: number }
  private dragging = false

  handle(input: WidgetPointerInput): WidgetInteractionAction {
    if (input.type === 'down') {
      this.down = { x: input.x, y: input.y, at: input.at }
      this.last = { x: input.x, y: input.y }
      this.dragging = false
      return { type: 'none' }
    }

    if (input.type === 'cancel') {
      this.reset()
      return { type: 'none' }
    }

    if (!this.down || !this.last) return { type: 'none' }

    if (input.type === 'move' && !this.dragging && input.at - this.down.at >= 180) {
      this.dragging = true
      this.last = { x: input.x, y: input.y }
      return { type: 'drag-start' }
    }

    if (input.type === 'move' && this.dragging) {
      const action = {
        type: 'drag-move' as const,
        deltaX: input.x - this.last.x,
        deltaY: input.y - this.last.y
      }
      this.last = { x: input.x, y: input.y }
      return action
    }

    if (input.type === 'up') {
      const distance = Math.hypot(input.x - this.down.x, input.y - this.down.y)
      const elapsed = input.at - this.down.at
      const action: WidgetInteractionAction = this.dragging
        ? { type: 'drag-end' }
        : distance < 8 && elapsed < 800
          ? { type: 'toggle' }
          : { type: 'none' }
      this.reset()
      return action
    }

    return { type: 'none' }
  }

  private reset(): void {
    this.down = undefined
    this.last = undefined
    this.dragging = false
  }
}
