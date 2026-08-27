import type { NovaApp, NovaSchema, NovaSurface } from '@endge/nova'
import type { NovaScrollbarGeometry, NovaScrollbarVisualOptions } from '@endge/nova-ui-kit'
import type { EventList } from '@endge/utils'
import type { NovaChartRuntime } from '@/model/context/nova-chart-runtime'
import type {
  NovaChartViewportApi,
  NovaChartViewportProps,
  NovaChartViewportResolvedProps,
  NovaChartViewportState,
} from '@/model/types/chart-components.types'
import type { ChartScaleDomain } from '@/model/types/chart-scale.types'
import type { ChartViewportDescriptor } from '@/ui/viewport/viewport.config'
import {
  clamp,
  createNovaScrollbarGeometry,
  createNovaScrollbarSchema,
  hitNovaScrollbarRect,
  mapNovaScrollbarDragValue,

  NovaUiComponentNode,
} from '@endge/nova-ui-kit'
import { normalizeChartViewportProps } from '@/ui/shared/chart-props'
import { resolveNovaChartRuntime } from '@/ui/shared/chart-runtime-resolver'
import { CHART_VIEWPORT_NODE_DESCRIPTOR } from '@/ui/viewport/viewport.config'

/**
 * Viewport управляет видимым band-domain и рисует UIKit scrollbar.
 */
export class ChartViewport<E extends EventList = Record<string, any>>
  extends NovaUiComponentNode<NovaChartViewportResolvedProps, NovaChartViewportApi, NovaChartViewportProps, E> {
  private _geometry: NovaScrollbarGeometry | null = null
  private _dragging = false
  private _hovered = false
  private _dragStartValue = 0
  private _dragStartPoint = 0
  private _value = 0
  private _state: NovaChartViewportState = {
    value: 0,
    max: 0,
    viewportSize: 0,
    contentSize: 0,
  }

  private readonly _api: NovaChartViewportApi

  /**
   * Создает экземпляр ChartViewport и подготавливает базовое состояние.
   */
  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    props: NovaChartViewportResolvedProps,
    options: { componentId?: string } = {},
    descriptor: ChartViewportDescriptor = CHART_VIEWPORT_NODE_DESCRIPTOR,
  ) {
    super(app, surface, descriptor, props, { componentId: options.componentId })
    this._value = props.value
    this.options({ interactive: props.enabled, zIndex: 45, cursor: { hover: 'default' } })
    this._api = {
      scrollTo: (value, event) => this._scrollTo(value, event),
      scrollBy: (delta, event) => this._scrollTo(this._value + delta, event),
      scrollToIndex: (index, event) => this._scrollTo(index, event),
      scrollToDomain: (domain, event) => this._scrollToDomain(domain, event),
      canScroll: delta => this._canScroll(delta),
      getViewportState: () => ({ ...this._state }),
      refresh: () => this.dirty({ update: true, render: true }),
    }
    this._setupEvents()
  }

  /**
   * Обновляет значение состояния ChartViewport.
   */
  override setProps(patch: Partial<NovaChartViewportProps>): this {
    return super.setProps(normalizeChartViewportProps({
      ...this.props,
      ...patch,
    } as NovaChartViewportProps))
  }

  /**
   * Возвращает значение состояния ChartViewport.
   */
  override getApi(): NovaChartViewportApi {
    return this._api
  }

  /**
   * Обновляет runtime-состояние ChartViewport.
   */
  update(): void {
    if (!this.props.enabled) {
      return
    }
    this._syncViewport()
  }

  /**
   * Выполняет отрисовку ChartViewport.
   */
  render(): void {
    if (!this.props.enabled) {
      return
    }
    this._syncViewport()
    if (!this._geometry || this._state.max <= 0) {
      return
    }

    const schema: NovaSchema = createNovaScrollbarSchema(this._geometry, {
      alpha: this.props.opacity,
      hoveredAxis: this._hovered ? this.props.orientation : null,
      draggingAxis: this._dragging ? this.props.orientation : null,
    })
    if (schema.length > 0) {
      this.renderer.schema(schema)
    }
    const runtime = resolveNovaChartRuntime<Record<string, unknown>>(this, this.props.chartRef)
    runtime?.publishSemanticRegions(`${this.componentId}:viewport`, [{
      id: `${runtime.id}:${this.componentId}:viewport`,
      role: 'viewport',
      label: `${this.props.orientation} chart viewport`,
      bounds: this.getWorldBounds(),
      focusable: runtime.props.accessibility !== false && runtime.props.accessibility.keyboardNavigation,
      order: 320,
      state: {
        focused: this.nova.semantics.getFocused(runtime.id)?.id === `${runtime.id}:${this.componentId}:viewport`,
      },
      data: {
        scaleId: this.props.scaleId,
        ...this._state,
      },
      source: {
        type: 'synthetic',
        componentId: this.componentId,
        part: 'viewport',
      },
    }])
  }

  protected override onUnmount(): void {
    const runtime = resolveNovaChartRuntime<Record<string, unknown>>(this, this.props.chartRef)
    runtime?.clearSemanticRegions(`${this.componentId}:viewport`)
    super.onUnmount()
  }

  /**
   * Обрабатывает входящее событие ChartViewport.
   */
  protected override onPropsChanged(changedKeys: Array<keyof NovaChartViewportResolvedProps>): void {
    this.applyCommonPropsChanged(changedKeys)
    this.options({ interactive: this.props.enabled })
    if (changedKeys.includes('value')) {
      this._value = this.props.value
    }
    this.dirty({ update: true, render: true })
  }

  /**
   * Применяет новое scroll-значение.
   */
  private _scrollTo(value: number, event?: Event): void {
    const next = clamp(value, 0, this._state.max)
    if (next === this._value && next === this._state.value) {
      return
    }
    this._value = next
    this._syncViewport(event)
    this.dirty({ update: true, render: true })
  }

  private _scrollToDomain(domain: string | Array<string>, event?: Event): void {
    const runtime = resolveNovaChartRuntime<Record<string, unknown>>(this, this.props.chartRef)
    const sourceDomain = normalizeBandDomain(runtime?.getScaleSourceDomain(this.props.scaleId) ?? [])
    const values = Array.isArray(domain) ? domain : [domain]
    const firstIndex = sourceDomain.findIndex(value => values.includes(value))
    if (firstIndex >= 0) {
      this._scrollTo(firstIndex, event)
    }
  }

  private _canScroll(delta = 0): boolean {
    if (this._state.max <= 0) {
      return false
    }
    if (delta === 0) {
      return this._state.max > 0
    }
    const next = clamp(this._value + delta, 0, this._state.max)
    return next !== this._value
  }

  /**
   * Синхронизирует visible domain шкалы с controlled scrollbar.
   */
  private _syncViewport(event?: Event): void {
    const runtime = resolveNovaChartRuntime<Record<string, unknown>>(this, this.props.chartRef)
    const scale = runtime?.getScale(this.props.scaleId)
    if (!runtime || !scale) {
      return
    }

    const sourceDomain = normalizeBandDomain(runtime.getScaleSourceDomain(this.props.scaleId) ?? scale.getDomain())
    if (sourceDomain.length === 0) {
      return
    }

    const viewportSize = Math.min(sourceDomain.length, this._resolveVisibleCount(sourceDomain.length))
    const max = Math.max(0, sourceDomain.length - viewportSize)
    const nextValue = Math.round(clamp(this._value, 0, max))
    this._value = nextValue
    this._state = {
      value: nextValue,
      max,
      viewportSize,
      contentSize: sourceDomain.length,
    }

    const visibleDomain = sourceDomain.slice(nextValue, nextValue + viewportSize)
    const nextDomainKey = visibleDomain.join('\u0001')
    const currentDomainKey = normalizeBandDomain(scale.getDomain()).join('\u0001')
    if (nextDomainKey !== currentDomainKey) {
      runtime.setScaleDomain(this.props.scaleId, visibleDomain as ChartScaleDomain)
    }

    this._geometry = createNovaScrollbarGeometry({
      axis: this.props.orientation,
      track: this._resolveTrack(),
      value: nextValue,
      viewportSize,
      contentSize: sourceDomain.length,
      options: this._resolveScrollbarOptions(runtime),
    })
    this.props.onChange?.({ ...this._state }, event)
  }

  /**
   * Возвращает видимый размер viewport в категориях.
   */
  private _resolveVisibleCount(contentSize: number): number {
    if (this.props.visibleCount !== undefined) {
      return Math.min(contentSize, Math.max(1, this.props.visibleCount))
    }

    const length = this.props.orientation === 'horizontal' ? this.width : this.height
    return Math.min(contentSize, Math.max(1, Math.floor(Math.max(1, length) / 22)))
  }

  /**
   * Возвращает track в локальных координатах node.
   */
  private _resolveTrack() {
    const horizontal = this.props.orientation === 'horizontal'
    const cross = Math.max(4, horizontal ? this.height : this.width)
    const length = Math.max(1, horizontal ? this.width : this.height)
    const thickness = Math.min(cross, this.props.scrollbar.thickness ?? 8)
    return horizontal
      ? { x: 0, y: (cross - thickness) / 2, width: length, height: thickness }
      : { x: (cross - thickness) / 2, y: 0, width: thickness, height: length }
  }

  /**
   * Применяет Nova Charts part styles к UIKit scrollbar geometry без собственного renderer слоя.
   */
  private _resolveScrollbarOptions(runtime: NovaChartRuntime<Record<string, unknown>>): NovaScrollbarVisualOptions {
    const trackStyle = runtime.customization.resolveMarkStyle({
      componentId: this.componentId,
      componentName: 'Viewport',
      part: 'viewportTrack',
      state: 'normal',
      tokens: runtime.customization.tokens,
      className: this.props.className,
      attrs: this.props.attrs as Record<string, unknown> | undefined,
    })
    const thumbState = this._dragging ? 'selected' : this._hovered ? 'hovered' : 'normal'
    const thumbStyle = runtime.customization.resolveMarkStyle({
      componentId: this.componentId,
      componentName: 'Viewport',
      part: 'viewportThumb',
      state: thumbState,
      tokens: runtime.customization.tokens,
      className: this.props.className,
      attrs: this.props.attrs as Record<string, unknown> | undefined,
    })

    return {
      ...this.props.scrollbar,
      trackColor: trackStyle.background ?? trackStyle.fill ?? this.props.scrollbar.trackColor,
      thumbColor: thumbStyle.background ?? thumbStyle.fill ?? this.props.scrollbar.thumbColor,
      thumbHoverColor: thumbStyle.background ?? thumbStyle.fill ?? this.props.scrollbar.thumbHoverColor,
      borderColor: thumbStyle.strokeColor ?? thumbStyle.stroke ?? this.props.scrollbar.borderColor,
      borderWidth: thumbStyle.strokeWidth ?? this.props.scrollbar.borderWidth,
      radius: thumbStyle.borderRadius ?? thumbStyle.radius ?? this.props.scrollbar.radius,
    }
  }

  /**
   * Подключает pointer/wheel handlers.
   */
  private _setupEvents(): void {
    this.on('mouseenter', () => {
      this._hovered = true
      this.dirty({ render: true })
    })
    this.on('mouseleave', () => {
      this._hovered = false
      if (!this._dragging) {
        this.dirty({ render: true })
      }
    })
    this.on('wheel', (event) => {
      if (!this.props.enabled || this._state.max <= 0) {
        return
      }
      if (this.props.controller && this.props.controller.wheel.enabled) {
        return
      }
      const delta = this.props.orientation === 'horizontal'
        ? Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
        : event.deltaY
      this._scrollTo(this._value + Math.sign(delta || 0) * this.props.wheelStep, event)
      return false
    })
    this.on('mousedown', (event) => {
      if (!this.props.enabled || !this._geometry) {
        return
      }
      if (this.props.controller && !this.props.controller.scrollbar.drag && !this.props.controller.scrollbar.clickTrack) {
        return
      }
      const point = this._localPoint(event)
      if (!hitNovaScrollbarRect(point.x, point.y, this._geometry.track)) {
        return
      }
      const hitThumb = hitNovaScrollbarRect(point.x, point.y, this._geometry.thumb)
      if (!hitThumb && this.props.controller && !this.props.controller.scrollbar.clickTrack) {
        return
      }
      this._dragging = true
      this._dragStartValue = this._value
      this._dragStartPoint = this.props.orientation === 'horizontal' ? point.x : point.y
      if (!hitThumb) {
        const nextValue = this.props.controller && this.props.controller.scrollbar.clickTrack === 'page'
          ? this._value + (this._valueFromPoint(point.x, point.y) > this._value ? this._state.viewportSize : -this._state.viewportSize)
          : this._valueFromPoint(point.x, point.y)
        this._scrollTo(nextValue, event)
        this._dragStartValue = this._value
        this._dragStartPoint = this.props.orientation === 'horizontal' ? point.x : point.y
      }
      this.dirty({ render: true })
      return false
    })
    this.on('dragmove', (event) => {
      if (!this._dragging || !this._geometry) {
        return
      }
      if (this.props.controller && !this.props.controller.scrollbar.drag) {
        return
      }
      const point = this._localPoint(event)
      const current = this.props.orientation === 'horizontal' ? point.x : point.y
      this._scrollTo(mapNovaScrollbarDragValue(this._geometry, this._dragStartValue, current - this._dragStartPoint), event)
      return false
    })
    this.on('dragend', (event) => {
      if (!this._dragging) {
        return
      }
      this._dragging = false
      this.dirty({ render: true })
      this.props.onChange?.({ ...this._state }, event)
      return false
    })
  }

  /**
   * Читает локальную позицию события.
   */
  private _localPoint(event: MouseEvent): { x: number, y: number } {
    const canvasPoint = this.nova.events.getCanvasMousePosition(event)
    const [x, y] = this.toLocal(canvasPoint.x, canvasPoint.y)
    return { x, y }
  }

  /**
   * Конвертирует click по track в scroll value.
   */
  private _valueFromPoint(x: number, y: number): number {
    if (!this._geometry) {
      return this._value
    }
    const horizontal = this.props.orientation === 'horizontal'
    const raw = horizontal
      ? x - this._geometry.thumb.width / 2 - this._geometry.track.x
      : y - this._geometry.thumb.height / 2 - this._geometry.track.y
    const travel = Math.max(1, horizontal
      ? this._geometry.track.width - this._geometry.thumb.width
      : this._geometry.track.height - this._geometry.thumb.height)
    return clamp(raw / travel, 0, 1) * this._geometry.max
  }
}

function normalizeBandDomain(domain: ChartScaleDomain): Array<string> {
  return domain.every(value => typeof value === 'string') ? domain as Array<string> : []
}
