import type { NovaApp, NovaSchema, NovaSurface } from '@endge/nova'
import type { EventList } from '@endge/utils'
import type {
  NovaChartGridApi,
  NovaChartGridProps,
  NovaChartGridResolvedProps,
  NovaChartResolvedMarkStyle,
} from '@/model/types/chart-components.types'
import type { ChartScaleTickOptions } from '@/model/types/chart-scale.types'
import type { ChartGridDescriptor } from '@/ui/grid/grid.config'
import { NovaUiComponentNode } from '@endge/nova-ui-kit'
import { CHART_GRID_NODE_DESCRIPTOR } from '@/ui/grid/grid.config'
import { resolveNovaChartRuntime } from '@/ui/shared/chart-runtime-resolver'

/**
 * Grid использует те же ticks scale API, что Axis.
 */
export class ChartGrid<E extends EventList = Record<string, any>>
  extends NovaUiComponentNode<NovaChartGridResolvedProps, NovaChartGridApi, NovaChartGridProps, E> {
  private lineCount = 0
  private readonly api: NovaChartGridApi

  /**
   * Создает экземпляр ChartGrid и подготавливает базовое состояние.
   */
  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    props: NovaChartGridResolvedProps,
    options: { componentId?: string } = {},
    descriptor: ChartGridDescriptor = CHART_GRID_NODE_DESCRIPTOR,
  ) {
    super(app, surface, descriptor, props, { componentId: options.componentId })
    this.options({ zIndex: 0 })
    this.api = {
      refresh: () => this.dirty({ update: true, render: true }),
      getLineCount: () => this.lineCount,
    }
  }

  /**
   * Обновляет значение состояния ChartGrid.
   */
  override setProps(patch: Partial<NovaChartGridResolvedProps>): this {
    return super.setProps(patch as Partial<NovaChartGridResolvedProps>)
  }

  /**
   * Возвращает значение состояния ChartGrid.
   */
  override getApi(): NovaChartGridApi {
    return this.api
  }

  /**
   * Выполняет отрисовку ChartGrid.
   */
  render(): void {
    const runtime = resolveNovaChartRuntime(this, this.props.chartRef)
    if (!runtime) {
      return
    }

    const schema: NovaSchema = []
    const style: NovaChartResolvedMarkStyle = runtime.customization.resolveMarkStyle({
      componentId: this.componentId,
      componentName: 'Grid',
      part: 'gridLine',
      seriesKind: 'custom',
      state: 'normal',
      tokens: runtime.customization.tokens,
      className: this.props.className,
      attrs: this.props.attrs as Record<string, unknown> | undefined,
    }, {
      legacy: {
        color: this.props.lineColor,
        stroke: this.props.lineColor,
        width: 1,
        strokeWidth: 1,
      },
      part: undefined,
    })
    if (this.props.xScaleId) {
      const scale = runtime.getScale(this.props.xScaleId)
      for (const tick of scale?.ticks(this.props.xTicks as ChartScaleTickOptions | undefined) ?? []) {
        schema.push({
          type: 'line',
          x1: tick.position,
          y1: 0,
          x2: tick.position,
          y2: this.height,
          styles: { color: style.color ?? style.stroke ?? this.props.lineColor, width: style.width ?? style.strokeWidth ?? 1, opacity: style.opacity },
        })
      }
    }

    if (this.props.yScaleId) {
      const scale = runtime.getScale(this.props.yScaleId)
      for (const tick of scale?.ticks(this.props.yTicks as ChartScaleTickOptions | undefined) ?? []) {
        schema.push({
          type: 'line',
          x1: 0,
          y1: tick.position,
          x2: this.width,
          y2: tick.position,
          styles: { color: style.color ?? style.stroke ?? this.props.lineColor, width: style.width ?? style.strokeWidth ?? 1, opacity: style.opacity },
        })
      }
    }

    this.lineCount = schema.length
    if (schema.length > 0) {
      this.renderer.schema(schema)
    }
    runtime.publishSemanticRegions(`${this.componentId}:grid`, [{
      id: `${runtime.id}:${this.componentId}:grid`,
      role: 'grid',
      label: 'Chart grid',
      bounds: this.getWorldBounds(),
      focusable: false,
      order: 40,
      data: {
        xScaleId: this.props.xScaleId,
        yScaleId: this.props.yScaleId,
        lineCount: this.lineCount,
      },
      source: {
        type: 'synthetic',
        componentId: this.componentId,
        part: 'grid',
      },
    }])
  }

  protected override onUnmount(): void {
    const runtime = resolveNovaChartRuntime(this, this.props.chartRef)
    runtime?.clearSemanticRegions(`${this.componentId}:grid`)
    super.onUnmount()
  }

  /**
   * Обрабатывает входящее событие ChartGrid.
   */
  protected override onPropsChanged(changedKeys: Array<keyof NovaChartGridResolvedProps>): void {
    this.applyCommonPropsChanged(changedKeys)
  }
}
