import type { NovaApp, NovaSchema, NovaSurface } from '@endge/nova'
import type { EventList } from '@endge/utils'
import {
  NovaUiComponentNode,
  clamp,
  createNovaScrollbarGeometry,
  createNovaScrollbarSchema,
  hitNovaScrollbarRect,
  mapNovaScrollbarDragValue,
  type NovaScrollbarGeometry,
  type NovaScrollbarVisualOptions,
} from '@endge/nova-ui-kit'
import type { NovaChartRuntime } from '@/model/context/nova-chart-runtime'
import { resolveNovaChartRuntime } from '@/ui/shared/chart-runtime-resolver'
import type {
  NovaChartViewportApi,
  NovaChartViewportProps,
  NovaChartViewportResolvedProps,
  NovaChartViewportState,
} from '@/model/types/chart-components.types'
import type { ChartScaleDomain } from '@/model/types/chart-scale.types'
import { CHART_VIEWPORT_NODE_DESCRIPTOR, type ChartViewportDescriptor } from '@/ui/viewport/viewport.config'

/**
 * Viewport управляет видимым band-domain и рисует UIKit scrollbar.
 */
export class ChartViewport<E extends EventList = Record<string, any>>
  extends NovaUiComponentNode<NovaChartViewportResolvedProps, NovaChartViewportApi, NovaChartViewportProps, E> {
  private geometry: NovaScrollbarGeometry | null = null
  private dragging = false
  private hovered = false
  private dragStartValue = 0
  private dragStartPoint = 0
  private value = 0
  private state: NovaChartViewportState = {
    value: 0,
    max: 0,
    viewportSize: 0,
    contentSize: 0,
  }
  private readonly api: NovaChartViewportApi

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
    this.value = props.value
    this.options({ interactive: props.enabled, zIndex: 45, cursor: { hover: 'default' } })
    this.api = {
      scrollTo: (value, event) => this.scrollTo(value, event),
      scrollBy: (delta, event) => this.scrollTo(this.value + delta, event),
      getViewportState: () => ({ ...this.state }),
      refresh: () => this.dirty({ update: true, render: true }),
    }
    this.setupEvents()
  }

  /**
   * Обновляет значение состояния ChartViewport.
   */
  override setProps(patch: Partial<NovaChartViewportResolvedProps>): this {
    return super.setProps(patch as Partial<NovaChartViewportResolvedProps>)
  }

  /**
   * Возвращает значение состояния ChartViewport.
   */
  override getApi(): NovaChartViewportApi {
    return this.api
  }

  /**
   * Обновляет runtime-состояние ChartViewport.
   */
  update(): void {
    if (!this.props.enabled) return
    this.syncViewport()
  }

  /**
   * Выполняет отрисовку ChartViewport.
   */
  render(): void {
    if (!this.props.enabled) return
    this.syncViewport()
    if (!this.geometry || this.state.max <= 0) return

    const schema: NovaSchema = createNovaScrollbarSchema(this.geometry, {
      alpha: this.props.opacity,
      hoveredAxis: this.hovered ? this.props.orientation : null,
      draggingAxis: this.dragging ? this.props.orientation : null,
    })
    if (schema.length > 0) this.renderer.schema(schema)
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
        ...this.state,
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
    if (changedKeys.includes('value')) this.value = this.props.value
    this.dirty({ update: true, render: true })
  }

  /**
   * Применяет новое scroll-значение.
   */
  private scrollTo(value: number, event?: Event): void {
    const next = clamp(value, 0, this.state.max)
    if (next === this.value && next === this.state.value) return
    this.value = next
    this.syncViewport(event)
    this.dirty({ update: true, render: true })
  }

  /**
   * Синхронизирует visible domain шкалы с controlled scrollbar.
   */
  private syncViewport(event?: Event): void {
    const runtime = resolveNovaChartRuntime<Record<string, unknown>>(this, this.props.chartRef)
    const scale = runtime?.getScale(this.props.scaleId)
    if (!runtime || !scale) return

    const sourceDomain = normalizeBandDomain(runtime.getScaleSourceDomain(this.props.scaleId) ?? scale.getDomain())
    if (sourceDomain.length === 0) return

    const viewportSize = Math.min(sourceDomain.length, this.resolveVisibleCount(sourceDomain.length))
    const max = Math.max(0, sourceDomain.length - viewportSize)
    const nextValue = Math.round(clamp(this.value, 0, max))
    this.value = nextValue
    this.state = {
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

    this.geometry = createNovaScrollbarGeometry({
      axis: this.props.orientation,
      track: this.resolveTrack(),
      value: nextValue,
      viewportSize,
      contentSize: sourceDomain.length,
      options: this.resolveScrollbarOptions(runtime),
    })
    this.props.onChange?.({ ...this.state }, event)
  }

  /**
   * Возвращает видимый размер viewport в категориях.
   */
  private resolveVisibleCount(contentSize: number): number {
    if (this.props.visibleCount !== undefined) return Math.min(contentSize, Math.max(1, this.props.visibleCount))

    const length = this.props.orientation === 'horizontal' ? this.width : this.height
    return Math.min(contentSize, Math.max(1, Math.floor(Math.max(1, length) / 22)))
  }

  /**
   * Возвращает track в локальных координатах node.
   */
  private resolveTrack() {
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
  private resolveScrollbarOptions(runtime: NovaChartRuntime<Record<string, unknown>>): NovaScrollbarVisualOptions {
    const trackStyle = runtime.customization.resolveMarkStyle({
      componentId: this.componentId,
      componentName: 'Viewport',
      part: 'viewportTrack',
      state: 'normal',
      tokens: runtime.customization.tokens,
      className: this.props.className,
      attrs: this.props.attrs as Record<string, unknown> | undefined,
    })
    const thumbState = this.dragging ? 'selected' : this.hovered ? 'hovered' : 'normal'
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
  private setupEvents(): void {
    this.on('mouseenter', () => {
      this.hovered = true
      this.dirty({ render: true })
    })
    this.on('mouseleave', () => {
      this.hovered = false
      if (!this.dragging) this.dirty({ render: true })
    })
    this.on('wheel', event => {
      if (!this.props.enabled || this.state.max <= 0) return
      const delta = this.props.orientation === 'horizontal'
        ? Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
        : event.deltaY
      this.scrollTo(this.value + Math.sign(delta || 0) * this.props.wheelStep, event)
      return false
    })
    this.on('mousedown', event => {
      if (!this.props.enabled || !this.geometry) return
      const point = this.localPoint(event)
      if (!hitNovaScrollbarRect(point.x, point.y, this.geometry.track)) return
      this.dragging = true
      this.dragStartValue = this.value
      this.dragStartPoint = this.props.orientation === 'horizontal' ? point.x : point.y
      if (!hitNovaScrollbarRect(point.x, point.y, this.geometry.thumb)) {
        this.scrollTo(this.valueFromPoint(point.x, point.y), event)
        this.dragStartValue = this.value
        this.dragStartPoint = this.props.orientation === 'horizontal' ? point.x : point.y
      }
      this.dirty({ render: true })
      return false
    })
    this.on('dragmove', event => {
      if (!this.dragging || !this.geometry) return
      const point = this.localPoint(event)
      const current = this.props.orientation === 'horizontal' ? point.x : point.y
      this.scrollTo(mapNovaScrollbarDragValue(this.geometry, this.dragStartValue, current - this.dragStartPoint), event)
      return false
    })
    this.on('dragend', event => {
      if (!this.dragging) return
      this.dragging = false
      this.dirty({ render: true })
      this.props.onChange?.({ ...this.state }, event)
      return false
    })
  }

  /**
   * Читает локальную позицию события.
   */
  private localPoint(event: MouseEvent): { x: number; y: number } {
    const canvasPoint = this.nova.events.getCanvasMousePosition(event)
    const [x, y] = this.toLocal(canvasPoint.x, canvasPoint.y)
    return { x, y }
  }

  /**
   * Конвертирует click по track в scroll value.
   */
  private valueFromPoint(x: number, y: number): number {
    if (!this.geometry) return this.value
    const horizontal = this.props.orientation === 'horizontal'
    const raw = horizontal
      ? x - this.geometry.thumb.width / 2 - this.geometry.track.x
      : y - this.geometry.thumb.height / 2 - this.geometry.track.y
    const travel = Math.max(1, horizontal
      ? this.geometry.track.width - this.geometry.thumb.width
      : this.geometry.track.height - this.geometry.thumb.height)
    return clamp(raw / travel, 0, 1) * this.geometry.max
  }
}

function normalizeBandDomain(domain: ChartScaleDomain): Array<string> {
  return domain.every(value => typeof value === 'string') ? domain as Array<string> : []
}
