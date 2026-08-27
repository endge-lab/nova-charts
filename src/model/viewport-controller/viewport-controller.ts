import type {
  NovaChartViewportControllerContext,
  NovaChartViewportControllerOptions,
  NovaChartViewportControllerResolvedOptions,
  NovaChartViewportControllerWheelIntent,
} from '@/model/types/chart-components.types'

export function normalizeChartViewportControllerOptions(
  options: false | NovaChartViewportControllerOptions | undefined,
): false | NovaChartViewportControllerResolvedOptions {
  if (options === false) {
    return false
  }
  const wheel = typeof options?.wheel === 'object' ? options.wheel : {}
  const trackpad = typeof options?.trackpad === 'object' ? options.trackpad : {}
  const pointerPan = typeof options?.pointerPan === 'object' ? options.pointerPan : {}
  const keyboard = typeof options?.keyboard === 'object' ? options.keyboard : {}
  const scrollbar = options?.scrollbar ?? {}

  return {
    enabled: options?.enabled ?? true,
    viewportRef: options?.viewportRef,
    wheel: {
      enabled: typeof options?.wheel === 'boolean' ? options.wheel : wheel.enabled ?? true,
      axis: wheel.axis ?? 'auto',
      useDeltaX: wheel.useDeltaX ?? true,
      shiftYToX: wheel.shiftYToX ?? true,
      speed: finiteNumber(wheel.speed, 1),
      thresholdPx: Math.max(0, finiteNumber(wheel.thresholdPx, 2)),
      preventDefault: wheel.preventDefault ?? 'when-scrollable',
      edgeBehavior: wheel.edgeBehavior ?? 'clamp',
    },
    trackpad: {
      enabled: typeof options?.trackpad === 'boolean' ? options.trackpad : trackpad.enabled ?? true,
      preferDeltaX: trackpad.preferDeltaX ?? true,
      inertia: trackpad.inertia ?? true,
    },
    pointerPan: {
      enabled: typeof options?.pointerPan === 'boolean' ? options.pointerPan : pointerPan.enabled ?? false,
      button: pointerPan.button ?? 'primary',
      speed: finiteNumber(pointerPan.speed, 1),
      cursor: pointerPan.cursor ?? 'grab',
    },
    keyboard: {
      enabled: typeof options?.keyboard === 'boolean' ? options.keyboard : keyboard.enabled ?? false,
      step: Math.max(1, finiteNumber(keyboard.step, 1)),
      pageStep: Math.max(1, finiteNumber(keyboard.pageStep, 10)),
      keys: {
        left: keyboard.keys?.left ?? 'ArrowLeft',
        right: keyboard.keys?.right ?? 'ArrowRight',
        up: keyboard.keys?.up ?? 'ArrowUp',
        down: keyboard.keys?.down ?? 'ArrowDown',
        pageLeft: keyboard.keys?.pageLeft ?? 'PageUp',
        pageRight: keyboard.keys?.pageRight ?? 'PageDown',
        pageUp: keyboard.keys?.pageUp ?? 'PageUp',
        pageDown: keyboard.keys?.pageDown ?? 'PageDown',
        home: keyboard.keys?.home ?? 'Home',
        end: keyboard.keys?.end ?? 'End',
      },
    },
    scrollbar: {
      drag: scrollbar.drag ?? true,
      clickTrack: scrollbar.clickTrack ?? 'jump',
    },
    mapWheel: options?.mapWheel,
    onInput: options?.onInput,
  }
}

export function resolveChartViewportWheelIntent(
  event: WheelEvent,
  context: NovaChartViewportControllerContext,
  options: NovaChartViewportControllerResolvedOptions,
): NovaChartViewportControllerWheelIntent | null {
  const custom = options.mapWheel?.(event, context)
  if (custom) {
    return custom
  }
  if (!options.wheel.enabled) {
    return null
  }

  const horizontal = context.orientation === 'horizontal'
  const absX = Math.abs(event.deltaX)
  const absY = Math.abs(event.deltaY)
  let axis: 'horizontal' | 'vertical' = horizontal ? 'horizontal' : 'vertical'
  let delta = horizontal ? event.deltaY : event.deltaY

  if (options.wheel.axis === 'horizontal') {
    axis = 'horizontal'
    delta = resolveHorizontalWheelDelta(event, options)
  }
  else if (options.wheel.axis === 'vertical') {
    axis = 'vertical'
    delta = event.deltaY
  }
  else if (options.wheel.useDeltaX && absX > absY) {
    axis = 'horizontal'
    delta = event.deltaX
  }
  else if (horizontal && options.wheel.shiftYToX && event.shiftKey) {
    axis = 'horizontal'
    delta = event.deltaY
  }
  else if (horizontal) {
    axis = 'horizontal'
    delta = options.trackpad.preferDeltaX && absX > 0 ? event.deltaX : event.deltaY
  }

  if (Math.abs(delta) < options.wheel.thresholdPx) {
    return null
  }
  return {
    axis,
    delta,
    mode: event.deltaMode === 1 ? 'line' : 'pixel',
    source: options.mapWheel ? 'custom' : absX > absY ? 'trackpad' : 'wheel',
  }
}

export function chartViewportDeltaToSteps(
  intent: NovaChartViewportControllerWheelIntent,
  options: NovaChartViewportControllerResolvedOptions,
): number {
  const base = intent.mode === 'domain'
    ? intent.delta
    : intent.mode === 'line'
      ? intent.delta
      : intent.delta / 48
  const signed = Math.sign(base)
  if (signed === 0) {
    return 0
  }
  return signed * Math.max(1, Math.round(Math.abs(base) * options.wheel.speed))
}

export function shouldPreventChartViewportWheelDefault(
  consumed: boolean,
  options: NovaChartViewportControllerResolvedOptions,
): boolean {
  if (options.wheel.preventDefault === 'always') {
    return true
  }
  if (options.wheel.preventDefault === 'never') {
    return false
  }
  return consumed
}

function resolveHorizontalWheelDelta(
  event: WheelEvent,
  options: NovaChartViewportControllerResolvedOptions,
): number {
  if (options.wheel.useDeltaX && Math.abs(event.deltaX) > 0) {
    return event.deltaX
  }
  if (options.wheel.shiftYToX && event.shiftKey) {
    return event.deltaY
  }
  return event.deltaY
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
