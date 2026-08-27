import type { NovaApp, NovaSchema, NovaSurface } from '@endge/nova'
import type { EventList } from '@endge/utils'
import type {
  NovaChartAxisApi,
  NovaChartAxisProps,
  NovaChartAxisResolvedProps,
  NovaChartResolvedMarkStyle,
} from '@/model/types/chart-components.types'
import type { ChartScale, ChartScaleTickOptions, ChartScaleValue } from '@/model/types/chart-scale.types'
import type { ChartAxisDescriptor } from '@/ui/axis/axis.config'
import { NovaUiComponentNode } from '@endge/nova-ui-kit'
import { mat3 } from 'gl-matrix'
import { CHART_AXIS_NODE_DESCRIPTOR } from '@/ui/axis/axis.config'
import { resolveNovaChartRuntime } from '@/ui/shared/chart-runtime-resolver'

/**
 * Ось строится как обычный Nova-компонент и не владеет position.
 */
export class ChartAxis<E extends EventList = Record<string, any>>
  extends NovaUiComponentNode<NovaChartAxisResolvedProps, NovaChartAxisApi, NovaChartAxisProps, E> {
  private readonly _api: NovaChartAxisApi

  /**
   * Создает экземпляр ChartAxis и подготавливает базовое состояние.
   */
  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    props: NovaChartAxisResolvedProps,
    options: { componentId?: string } = {},
    descriptor: ChartAxisDescriptor = CHART_AXIS_NODE_DESCRIPTOR,
  ) {
    super(app, surface, descriptor, props, { componentId: options.componentId })
    this.options({ zIndex: 20 })
    this._api = {
      refresh: () => this.dirty({ update: true, render: true }),
      getTickCount: () => this._readTicks().length,
    }
  }

  /**
   * Обновляет значение состояния ChartAxis.
   */
  override setProps(patch: Partial<NovaChartAxisResolvedProps>): this {
    return super.setProps(patch as Partial<NovaChartAxisResolvedProps>)
  }

  /**
   * Возвращает значение состояния ChartAxis.
   */
  override getApi(): NovaChartAxisApi {
    return this._api
  }

  /**
   * Выполняет отрисовку ChartAxis.
   */
  render(): void {
    const ticks = this._readTicks()
    const runtime = resolveNovaChartRuntime(this, this.props.chartRef)
    const lineStyle = this._resolvePartStyle('axisTick', {
      color: this.props.lineColor,
      stroke: this.props.lineColor,
      width: 1,
      strokeWidth: 1,
    }, runtime)
    const tickStyle = this._resolvePartStyle('axisTick', {
      color: this.props.tickColor,
      stroke: this.props.tickColor,
      width: 1,
      strokeWidth: 1,
    }, runtime)
    const labelStyle = this._resolvePartStyle('axisLabel', {
      color: this.props.labelColor,
      fontFamily: this.props.fontFamily,
      fontSize: this.props.fontSize,
      fontWeight: String(this.props.fontWeight ?? '500'),
    }, runtime)
    const schema: NovaSchema = []
    const labels: Array<ReturnType<typeof createAxisLabel>> = []

    if (this.props.orientation === 'horizontal') {
      const baselineY = this.props.tickSide === 'start' ? this.height - 1 : 0.5
      const tickDirection = this.props.tickSide === 'start' ? -1 : 1
      const labelRotation = this._resolveHorizontalLabelRotation(ticks)
      const labelY = this.props.labelSide === 'start'
        ? Math.max(0, baselineY - this.props.tickSize - this.props.labelPadding - 14)
        : baselineY + this.props.tickSize + this.props.labelPadding

      schema.push({
        type: 'line',
        x1: 0,
        y1: baselineY,
        x2: this.width,
        y2: baselineY,
        styles: { color: lineStyle.color ?? lineStyle.stroke ?? this.props.lineColor, width: lineStyle.width ?? lineStyle.strokeWidth ?? 1, opacity: lineStyle.opacity },
      })

      for (const tick of ticks) {
        const x = tick.position
        schema.push({
          type: 'line',
          x1: x,
          y1: baselineY,
          x2: x,
          y2: baselineY + this.props.tickSize * tickDirection,
          styles: { color: tickStyle.color ?? tickStyle.stroke ?? this.props.tickColor, width: tickStyle.width ?? tickStyle.strokeWidth ?? 1, opacity: tickStyle.opacity },
        })
        if (labelRotation === 0) {
          labels.push(createAxisLabel(tick.label, x - 40, labelY, 80, 14, labelStyle.color ?? this.props.labelColor, 'center', labelStyle))
        }
      }

      if (schema.length > 0) {
        this.renderSchema(schema)
      }

      if (labelRotation !== 0) {
        for (const tick of ticks) {
          this._renderRotatedLabel(tick.label, tick.position, labelY, labelRotation)
        }
      }
      else {
        for (const label of labels) {
          this.renderer.text(label)
        }
      }
      this._publishSemantics(runtime, ticks.length)
      return
    }
    else {
      const baselineX = this.props.tickSide === 'start' ? this.width - 0.5 : 0.5
      const tickDirection = this.props.tickSide === 'start' ? -1 : 1
      const labelX = this.props.labelSide === 'start'
        ? 0
        : baselineX + this.props.tickSize + this.props.labelPadding
      const labelWidth = this.props.labelSide === 'start'
        ? Math.max(1, baselineX - this.props.tickSize - this.props.labelPadding)
        : Math.max(1, this.width - labelX)

      schema.push({
        type: 'line',
        x1: baselineX,
        y1: 0,
        x2: baselineX,
        y2: this.height,
        styles: { color: lineStyle.color ?? lineStyle.stroke ?? this.props.lineColor, width: lineStyle.width ?? lineStyle.strokeWidth ?? 1, opacity: lineStyle.opacity },
      })

      for (const tick of ticks) {
        const y = tick.position
        const labelMetrics = {
          x: this.props.labelSide === 'start' ? labelX + 2 : labelX,
          width: Math.max(1, labelWidth - 2),
        }
        schema.push({
          type: 'line',
          x1: baselineX,
          y1: y,
          x2: baselineX + this.props.tickSize * tickDirection,
          y2: y,
          styles: { color: tickStyle.color ?? tickStyle.stroke ?? this.props.tickColor, width: tickStyle.width ?? tickStyle.strokeWidth ?? 1, opacity: tickStyle.opacity },
        })
        const label = createAxisLabel(
          tick.label,
          labelMetrics.x,
          y - 7,
          labelMetrics.width,
          14,
          labelStyle.color ?? this.props.labelColor,
          'left',
          labelStyle,
        )
        schema.push(label)
        labels.push(label)
      }
    }

    if (schema.length > 0) {
      this.renderSchema(schema)
    }
    for (const label of labels) {
      this.renderer.text(label)
    }
    this._publishSemantics(runtime, ticks.length)
  }

  protected override onUnmount(): void {
    const runtime = resolveNovaChartRuntime(this, this.props.chartRef)
    runtime?.clearSemanticRegions(`${this.componentId}:axis`)
    super.onUnmount()
  }

  /**
   * Обрабатывает входящее событие ChartAxis.
   */
  protected override onPropsChanged(changedKeys: Array<keyof NovaChartAxisResolvedProps>): void {
    this.applyCommonPropsChanged(changedKeys)
  }

  /**
   * Выполняет внутренний шаг readTicks для ChartAxis.
   */
  private _readTicks() {
    const runtime = resolveNovaChartRuntime(this, this.props.chartRef)
    const scale = runtime?.getScale(this.props.scaleId)
    if (scale) {
      this._ensureRenderableScaleRange(scale)
    }
    return scale?.ticks(this.props.ticks as ChartScaleTickOptions | undefined) ?? []
  }

  private _publishSemantics(runtime: ReturnType<typeof resolveNovaChartRuntime> | null | undefined, tickCount: number): void {
    runtime?.publishSemanticRegions(`${this.componentId}:axis`, [{
      id: `${runtime.id}:${this.componentId}:axis`,
      role: 'axis',
      label: `${this.props.orientation} axis ${this.props.scaleId}`,
      bounds: this.getWorldBounds(),
      focusable: false,
      order: 30,
      data: {
        scaleId: this.props.scaleId,
        orientation: this.props.orientation,
        tickCount,
      },
      source: {
        type: 'synthetic',
        componentId: this.componentId,
        part: 'axis',
      },
    }])
  }

  /**
   * Выполняет внутренний шаг ensureRenderableScaleRange для ChartAxis.
   */
  private _ensureRenderableScaleRange(scale: ChartScale<ChartScaleValue>): void {
    const current = scale.getRange()
    if (current[0] !== 0 || current[1] !== 1) {
      return
    }

    if (this.props.orientation === 'horizontal' && this.width > 1) {
      scale.setRange([0, this.width])
      return
    }

    if (this.props.orientation === 'vertical' && this.height > 1) {
      scale.setRange([this.height, 0])
    }
  }

  /**
   * Нормализует и возвращает итоговое значение ChartAxis.
   */
  private _resolveHorizontalLabelRotation(ticks: Array<{ label: string, position: number }>): number {
    if (this.props.labelRotation !== 'auto') {
      return degreesToRadians(this.props.labelRotation)
    }
    if (ticks.length <= 1) {
      return 0
    }

    const first = ticks[0]!
    const last = ticks[ticks.length - 1]!
    const span = Math.max(1, Math.abs(last.position - first.position))
    const available = span / Math.max(1, ticks.length - 1)
    const longestLabelPx = ticks.reduce((max, tick) => Math.max(max, tick.label.length * 6.6), 0)

    if (available >= longestLabelPx + 10) {
      return 0
    }
    if (available >= longestLabelPx * 0.68) {
      return Math.PI / 6
    }
    if (available >= longestLabelPx * 0.42) {
      return Math.PI / 4
    }
    return Math.PI / 2
  }

  /**
   * Выполняет отрисовку ChartAxis.
   */
  private _renderRotatedLabel(text: string, x: number, y: number, angle: number): void {
    const transform = mat3.clone(this.matrix)
    mat3.translate(transform, transform, [x, y])
    mat3.rotate(transform, transform, angle)

    this.renderer.save()
    this.renderer.setTransform(transform)
    this.renderer.text(createAxisLabel(text, 4, -7, 86, 14, this.props.labelColor, 'left'))
    this.renderer.restore()
  }

  private _resolvePartStyle(
    part: 'axisTick' | 'axisLabel',
    legacy: NovaChartResolvedMarkStyle,
    runtime: ReturnType<typeof resolveNovaChartRuntime>,
  ): NovaChartResolvedMarkStyle {
    return runtime?.customization.resolveMarkStyle({
      componentId: this.componentId,
      componentName: 'Axis',
      part,
      seriesKind: 'custom',
      state: 'normal',
      tokens: runtime.customization.tokens,
      className: this.props.className,
      attrs: this.props.attrs as Record<string, unknown> | undefined,
    }, { legacy }) ?? legacy
  }
}

function degreesToRadians(value: number): number {
  if (!Number.isFinite(value) || value === 0) {
    return 0
  }
  return (value * Math.PI) / 180
}

function createAxisLabel(
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  align: 'left' | 'center' | 'right',
  style: NovaChartResolvedMarkStyle = {},
) {
  return {
    type: 'text' as const,
    text,
    x,
    y,
    width,
    height,
    styles: {
      color,
      font: {
        family: style.fontFamily ?? 'Inter, Arial, sans-serif',
        size: style.fontSize ?? 11,
        weight: String(style.fontWeight ?? '500') as any,
      },
      lineHeight: style.lineHeight ?? 14,
      opacity: style.opacity,
      align: {
        horizontal: align,
        vertical: 'middle' as const,
      },
      ellipsis: true,
    },
    meta: {
      textRole: 'ui-label' as const,
      textMode: 'run-atlas' as const,
      textLod: 'always' as const,
    },
  }
}
