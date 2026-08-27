import type { NovaApp, NovaSchema, NovaSchemaItem, NovaSurface } from '@endge/nova'
import type { TooltipContent, TooltipProps } from '@endge/nova-ui-kit'
import type { EventList } from '@endge/utils'
import type {
  NovaChartInteractionState,
  NovaChartTooltipApi,
  NovaChartTooltipContext,
  NovaChartTooltipProps,
  NovaChartTooltipResolvedProps,
} from '@/model/types/chart-components.types'
import type { ChartTooltipDescriptor } from '@/ui/tooltip/tooltip.config'
import {
  createTooltipSchema,
  NovaUiComponentNode,

} from '@endge/nova-ui-kit'
import { resolveNovaChartRuntime } from '@/ui/shared/chart-runtime-resolver'
import { CHART_TOOLTIP_NODE_DESCRIPTOR } from '@/ui/tooltip/tooltip.config'

/**
 * Tooltip читает chart interaction state и делегирует визуальный слой Nova UIKit.
 */
export class ChartTooltip<E extends EventList = Record<string, any>>
  extends NovaUiComponentNode<NovaChartTooltipResolvedProps, NovaChartTooltipApi, NovaChartTooltipProps, E> {
  private interactionState: NovaChartInteractionState | null = null
  private unsubscribeInteraction: (() => void) | null = null
  private readonly api: NovaChartTooltipApi

  /**
   * Создает экземпляр ChartTooltip и подготавливает базовое состояние.
   */
  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    props: NovaChartTooltipResolvedProps,
    options: { componentId?: string } = {},
    descriptor: ChartTooltipDescriptor = CHART_TOOLTIP_NODE_DESCRIPTOR,
  ) {
    super(app, surface, descriptor, props, { componentId: options.componentId })
    this.options({ interactive: false, zIndex: 50 })
    this.api = {
      refresh: () => this.dirty({ render: true }),
    }
  }

  /**
   * Обновляет значение состояния ChartTooltip.
   */
  override setProps(patch: Partial<NovaChartTooltipResolvedProps>): this {
    return super.setProps(patch as Partial<NovaChartTooltipResolvedProps>)
  }

  /**
   * Возвращает значение состояния ChartTooltip.
   */
  override getApi(): NovaChartTooltipApi {
    return this.api
  }

  /**
   * Выполняет отрисовку ChartTooltip.
   */
  render(): void {
    const runtime = resolveNovaChartRuntime<Record<string, unknown>>(this, this.props.chartRef)
    const context = this.createContext()
    if (!context) {
      runtime?.clearSemanticRegions(`${this.componentId}:tooltip`)
      return
    }

    const content = this.resolveContent(context)
    if (!content) {
      runtime?.clearSemanticRegions(`${this.componentId}:tooltip`)
      return
    }

    const surfaceStyle = runtime?.customization.resolveMarkStyle({
      componentId: this.componentId,
      componentName: 'Tooltip',
      part: 'tooltipSurface',
      datum: context.datum,
      seriesKind: context.datum.seriesKind,
      state: 'normal',
      tokens: runtime.customization.tokens,
      className: this.props.className,
      attrs: this.props.attrs as Record<string, unknown> | undefined,
    }, {
      legacy: {
        background: this.props.background,
        color: this.props.color,
        strokeColor: this.props.borderColor,
        borderRadius: this.props.border?.radius ?? 7,
      },
    })
    const origin = this.resolveAnchor()
    const anchorBounds = context.datum.bounds ?? {
      x: context.datum.point?.x ?? origin.x,
      y: context.datum.point?.y ?? origin.y,
      width: 1,
      height: 1,
    }
    const schema = createTooltipSchema({
      ...this.props,
      content,
      open: true,
      x: origin.x,
      y: origin.y,
      width: this.props.placement === 'cursor' ? 0 : Math.max(1, anchorBounds.width),
      height: this.props.placement === 'cursor' ? 0 : Math.max(1, anchorBounds.height),
      background: surfaceStyle?.background ?? this.props.background,
      color: surfaceStyle?.color ?? this.props.color,
      border: {
        color: surfaceStyle?.strokeColor ?? surfaceStyle?.stroke ?? this.props.borderColor,
        width: surfaceStyle?.strokeWidth ?? 1,
        radius: surfaceStyle?.borderRadius ?? surfaceStyle?.radius ?? this.props.border?.radius ?? 7,
      },
      collision: this.props.collision,
      animation: this.props.animation,
    } as TooltipProps)

    this.applyCollision(schema)
    if (schema.length > 0) {
      this.renderer.schema(schema)
    }
    if (runtime?.props.accessibility !== false && runtime?.props.accessibility.exposeTooltip) {
      runtime.publishSemanticRegions(`${this.componentId}:tooltip`, [{
        id: `${runtime.id}:${this.componentId}:tooltip`,
        role: 'tooltip',
        label: typeof content === 'string' ? content : context.label,
        bounds: resolveSchemaBounds(schema),
        focusable: false,
        order: 300,
        data: {
          seriesId: context.datum.seriesId,
          key: context.datum.key,
          value: context.value,
        },
        source: {
          type: 'synthetic',
          componentId: this.componentId,
          part: 'tooltip',
        },
      }])
    }
    else {
      runtime?.clearSemanticRegions(`${this.componentId}:tooltip`)
    }
  }

  /**
   * Обрабатывает входящее событие ChartTooltip.
   */
  protected override onMount(): void {
    super.onMount()
    this.subscribeRuntime()
  }

  /**
   * Обрабатывает входящее событие ChartTooltip.
   */
  protected override onUnmount(): void {
    this.unsubscribeInteraction?.()
    this.unsubscribeInteraction = null
    const runtime = resolveNovaChartRuntime<Record<string, unknown>>(this, this.props.chartRef)
    runtime?.clearSemanticRegions(`${this.componentId}:tooltip`)
    super.onUnmount()
  }

  /**
   * Обрабатывает входящее событие ChartTooltip.
   */
  protected override onPropsChanged(changedKeys: Array<keyof NovaChartTooltipResolvedProps>): void {
    this.applyCommonPropsChanged(changedKeys)
    if (changedKeys.includes('chartRef')) {
      this.subscribeRuntime()
    }
    this.dirty({ render: true })
  }

  /**
   * Подписывает обработчик на изменения ChartTooltip.
   */
  private subscribeRuntime(): void {
    this.unsubscribeInteraction?.()
    this.unsubscribeInteraction = null
    const runtime = resolveNovaChartRuntime<Record<string, unknown>>(this, this.props.chartRef)
    if (!runtime) {
      return
    }

    this.interactionState = runtime.getInteractionState()
    this.unsubscribeInteraction = runtime.subscribeInteraction((state) => {
      this.interactionState = state
      this.dirty({ render: true })
    })
  }

  /**
   * Создает formatter context для пользовательского content.
   */
  private createContext(): NovaChartTooltipContext | null {
    if (!this.props.enabled || !this.interactionState?.tooltipVisible || !this.interactionState.hovered) {
      return null
    }
    const datum = this.interactionState.hovered
    const fallbackLabel = datum.mode === 'bucket'
      ? `Bucket ${datum.label ?? datum.key}`
      : datum.label ?? datum.category ?? datum.key
    const formattedValue = this.props.valueFormatter?.({
      state: this.interactionState,
      datum,
      label: fallbackLabel,
      value: datum.rawValue ?? datum.value,
      formattedValue: formatValue(datum.rawValue ?? datum.value),
    }) ?? formatValue(datum.rawValue ?? datum.value)
    const label = this.props.labelFormatter?.({
      state: this.interactionState,
      datum,
      label: fallbackLabel,
      value: datum.rawValue ?? datum.value,
      formattedValue,
    }) ?? fallbackLabel

    return {
      state: this.interactionState,
      datum,
      label,
      value: datum.rawValue ?? datum.value,
      formattedValue,
    }
  }

  /**
   * Возвращает content для UIKit tooltip.
   */
  private resolveContent(context: NovaChartTooltipContext): TooltipContent | null {
    const runtime = resolveNovaChartRuntime<Record<string, unknown>>(this, this.props.chartRef)
    const content = this.props.renderers?.tooltipContent?.(context)
      ?? this.props.contentFormatter?.(context)
      ?? this.props.content
      ?? `${context.label}\nValue: ${context.formattedValue}`
    const decorated = runtime?.customization.decorateTooltip(context, content) as TooltipContent | null | undefined
    return decorated ?? content
  }

  /**
   * Вычисляет anchor tooltip в координатах plot.
   */
  private resolveAnchor(): { x: number, y: number } {
    const hovered = this.interactionState?.hovered
    const pointer = this.interactionState?.pointer
    if (this.props.followCursor && pointer) {
      return { x: pointer.plotX + this.props.offsetX, y: pointer.plotY + this.props.offsetY }
    }
    return {
      x: (hovered?.bounds?.x ?? hovered?.point?.x ?? 0) + this.props.offsetX,
      y: (hovered?.bounds?.y ?? hovered?.point?.y ?? 0) + this.props.offsetY,
    }
  }

  /**
   * Применяет boundary shift к schema, созданной UIKit helper.
   */
  private applyCollision(schema: NovaSchema): void {
    if (schema.length === 0 || !this.props.collision.shift) {
      return
    }

    const bounds = resolveSchemaBounds(schema)
    const padding = this.props.collision.padding
    const dx = Math.min(0, this.width - padding - (bounds.x + bounds.width)) + Math.max(0, padding - bounds.x)
    const dy = Math.min(0, this.height - padding - (bounds.y + bounds.height)) + Math.max(0, padding - bounds.y)
    if (dx === 0 && dy === 0) {
      return
    }

    for (const item of schema) {
      const shape = item as NovaSchemaItem & Record<string, any>
      shape.x = (shape.x ?? 0) + dx
      shape.y = (shape.y ?? 0) + dy
    }
  }
}

function resolveSchemaBounds(schema: NovaSchema): { x: number, y: number, width: number, height: number } {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const item of schema) {
    const shape = item as Record<string, any>
    const x = Number(shape.x ?? 0)
    const y = Number(shape.y ?? 0)
    const width = Number(shape.width ?? 0)
    const height = Number(shape.height ?? 0)
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + width)
    maxY = Math.max(maxY, y + height)
  }

  if (!Number.isFinite(minX)) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function formatValue(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '-'
}
