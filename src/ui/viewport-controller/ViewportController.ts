import type { NovaApp, NovaSurface } from '@endge/nova'
import type { EventList } from '@endge/utils'
import type {
  NovaChartHitTestResult,
  NovaChartViewportApi,
  NovaChartViewportControllerApi,
  NovaChartViewportControllerProps,
  NovaChartViewportControllerResolvedProps,
} from '@/model/types/chart-components.types'
import type { ChartViewportControllerDescriptor } from '@/ui/viewport-controller/viewport-controller.config'
import { NovaUiComponentNode } from '@endge/nova-ui-kit'
import {
  chartViewportDeltaToSteps,
  resolveChartViewportWheelIntent,
  shouldPreventChartViewportWheelDefault,
} from '@/model/viewport-controller/viewport-controller'
import { normalizeChartViewportControllerProps } from '@/ui/shared/chart-props'
import { resolveNovaChartRuntime } from '@/ui/shared/chart-runtime-resolver'
import {
  CHART_VIEWPORT_CONTROLLER_NODE_DESCRIPTOR,

} from '@/ui/viewport-controller/viewport-controller.config'

/**
 * ViewportController - input-layer для wheel/trackpad/pan/keyboard над chart plot.
 */
export class ChartViewportController<E extends EventList = Record<string, any>>
  extends NovaUiComponentNode<
    NovaChartViewportControllerResolvedProps,
    NovaChartViewportControllerApi,
    NovaChartViewportControllerProps,
    E
  > {
  private _panning = false
  private readonly _api: NovaChartViewportControllerApi

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    props: NovaChartViewportControllerResolvedProps,
    options: { componentId?: string } = {},
    descriptor: ChartViewportControllerDescriptor = CHART_VIEWPORT_CONTROLLER_NODE_DESCRIPTOR,
  ) {
    super(app, surface, descriptor, props, { componentId: options.componentId })
    this.options({
      interactive: props.enabled,
      zIndex: 41,
      cursor: props.pointerPan.enabled ? { hover: props.pointerPan.cursor } : { hover: 'default' },
    })
    this._api = {
      refresh: () => this.dirty({ update: true, render: true }),
    }
    this._setupEvents()
  }

  override setProps(patch: Partial<NovaChartViewportControllerProps>): this {
    return super.setProps(normalizeChartViewportControllerProps({
      ...this.props,
      ...patch,
    } as NovaChartViewportControllerProps))
  }

  override getApi(): NovaChartViewportControllerApi {
    return this._api
  }

  render(): void {}

  protected override onPropsChanged(changedKeys: Array<keyof NovaChartViewportControllerResolvedProps>): void {
    this.applyCommonPropsChanged(changedKeys)
    this.options({
      interactive: this.props.enabled,
      cursor: this.props.pointerPan.enabled ? { hover: this.props.pointerPan.cursor } : { hover: 'default' },
    })
  }

  private _setupEvents(): void {
    this.on('wheel', event => this._handleWheel(event))
    this.on('mousedown', event => this._handleMouseDown(event))
    this.on('dragmove', (event, dx, dy) => this._handleDragMove(event, dx, dy))
    this.on('dragend', event => this._handleDragEnd(event))
    this.on('dragcancel', event => this._handleDragEnd(event))
    this.on('mousemove', event => this._forwardHover(event))
    this.on('mouseleave', () => this._clearHover())
    this.on('canvasleave', () => this._clearHover())
    this.on('keydown', event => this._handleKeydown(event))
  }

  private _handleWheel(event: WheelEvent): void {
    const viewport = this._viewport()
    if (!this.props.enabled || !viewport) {
      return
    }

    const state = viewport.getViewportState()
    const intent = resolveChartViewportWheelIntent(event, {
      viewport: state,
      orientation: this._resolveOrientation(),
      scaleId: this.props.scaleId,
    }, this.props)
    if (!intent) {
      this._allowWheelDefault(event, true)
      return
    }

    const delta = chartViewportDeltaToSteps(intent, this.props)
    if (delta === 0) {
      this._allowWheelDefault(event, true)
      return
    }

    const consumed = viewport.canScroll(delta)
    const shouldPassThrough = !consumed && this.props.wheel.edgeBehavior === 'pass-through'
    this._allowWheelDefault(event, shouldPassThrough || !shouldPreventChartViewportWheelDefault(consumed, this.props))
    if (consumed || this.props.wheel.edgeBehavior === 'clamp') {
      viewport.scrollBy(delta, event)
    }
    this.props.onInput?.({
      source: intent.source ?? 'wheel',
      value: viewport.getViewportState().value,
      delta,
      consumed,
      axis: intent.axis,
    }, event)
  }

  private _handleMouseDown(event: MouseEvent): void {
    if (!this.props.enabled) {
      return
    }
    this.focus(event)
    if (!this.props.pointerPan.enabled || !matchesButton(event, this.props.pointerPan.button)) {
      return
    }
    this._panning = true
    event.stopPropagation()
  }

  private _handleDragMove(event: MouseEvent, dx: number, dy: number): void {
    if (!this._panning) {
      return
    }
    const viewport = this._viewport()
    if (!viewport) {
      return
    }

    const horizontal = this._resolveOrientation() === 'horizontal'
    const raw = horizontal ? -dx : -dy
    const delta = Math.trunc(raw / 48 * this.props.pointerPan.speed)
    if (delta === 0) {
      return
    }

    const consumed = viewport.canScroll(delta)
    if (consumed || this.props.wheel.edgeBehavior === 'clamp') {
      viewport.scrollBy(delta, event)
    }
    this.props.onInput?.({
      source: 'pointer-pan',
      value: viewport.getViewportState().value,
      delta,
      consumed,
      axis: horizontal ? 'horizontal' : 'vertical',
    }, event)
    event.stopPropagation()
  }

  private _handleDragEnd(event: MouseEvent): void {
    if (!this._panning) {
      return
    }
    this._panning = false
    event.stopPropagation()
  }

  private _handleKeydown(event: KeyboardEvent): void {
    if (!this.props.enabled || !this.props.keyboard.enabled) {
      return
    }
    const viewport = this._viewport()
    if (!viewport) {
      return
    }

    const horizontal = this._resolveOrientation() === 'horizontal'
    const keys = this.props.keyboard.keys
    let delta = 0
    if (event.key === keys.home) {
      delta = -viewport.getViewportState().value
    }
    else if (event.key === keys.end) {
      delta = viewport.getViewportState().max - viewport.getViewportState().value
    }
    else if (horizontal && event.key === keys.left) {
      delta = -this.props.keyboard.step
    }
    else if (horizontal && event.key === keys.right) {
      delta = this.props.keyboard.step
    }
    else if (!horizontal && event.key === keys.up) {
      delta = -this.props.keyboard.step
    }
    else if (!horizontal && event.key === keys.down) {
      delta = this.props.keyboard.step
    }
    else if (event.key === keys.pageLeft || event.key === keys.pageUp) {
      delta = -this.props.keyboard.pageStep
    }
    else if (event.key === keys.pageRight || event.key === keys.pageDown) {
      delta = this.props.keyboard.pageStep
    }
    else { return }

    const consumed = viewport.canScroll(delta)
    if (consumed || this.props.wheel.edgeBehavior === 'clamp') {
      viewport.scrollBy(delta, event)
    }
    this.props.onInput?.({
      source: 'keyboard',
      value: viewport.getViewportState().value,
      delta,
      consumed,
      axis: horizontal ? 'horizontal' : 'vertical',
    }, event)
    event.preventDefault()
    event.stopPropagation()
  }

  private _forwardHover(event: MouseEvent): void {
    const runtime = resolveNovaChartRuntime<Record<string, unknown>>(this, this.props.chartRef)
    if (!runtime) {
      return
    }

    const canvasPoint = this.nova.events.getCanvasMousePosition(event)
    const [plotX, plotY] = this.toLocal(canvasPoint.x, canvasPoint.y)
    let best: NovaChartHitTestResult | null = null
    for (const series of runtime.getInteractiveSeries()) {
      const hit = series.api.hitTest({
        x: plotX,
        y: plotY,
        mode: 'nearest',
        maxDistancePx: 24,
      })
      if (!hit) {
        continue
      }
      if (!best || hit.distancePx < best.distancePx) {
        best = hit
      }
    }

    runtime.setInteractionState({
      pointer: { x: canvasPoint.x, y: canvasPoint.y, plotX, plotY },
      hovered: best,
      tooltipVisible: best !== null,
    })
  }

  private _clearHover(): void {
    const runtime = resolveNovaChartRuntime<Record<string, unknown>>(this, this.props.chartRef)
    runtime?.setInteractionState({ pointer: null, hovered: null, tooltipVisible: false })
  }

  private _viewport(): NovaChartViewportApi | null {
    if (!this.props.viewportRef) {
      return null
    }
    return this.nova.components.api<NovaChartViewportApi>(this.props.viewportRef) ?? null
  }

  private _resolveOrientation(): 'horizontal' | 'vertical' {
    const axis = this.props.wheel.axis
    if (axis === 'horizontal' || axis === 'vertical') {
      return axis
    }
    return this.props.scaleId === 'y' ? 'vertical' : 'horizontal'
  }

  private _allowWheelDefault(event: WheelEvent, allow: boolean): void {
    ;(event as unknown as Record<string, unknown>).__novaAllowDefault = allow
  }
}

function matchesButton(event: MouseEvent, button: 'primary' | 'middle' | 'secondary'): boolean {
  if (button === 'primary') {
    return event.button === 0
  }
  if (button === 'middle') {
    return event.button === 1
  }
  return event.button === 2
}
