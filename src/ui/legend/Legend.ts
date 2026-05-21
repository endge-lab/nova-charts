import type { NovaApp, NovaSchema, NovaSurface } from '@endge/nova'
import type { EventList } from '@endge/utils'
import { NovaUiComponentNode, resolveSpacing } from '@endge/nova-ui-kit'
import { resolveNovaChartRuntime } from '@/ui/shared/chart-runtime-resolver'
import type {
  NovaChartLegendApi,
  NovaChartLegendProps,
  NovaChartLegendResolvedProps,
  NovaChartSeriesMetadata,
} from '@/model/types/chart-components.types'
import { CHART_LEGEND_NODE_DESCRIPTOR, type ChartLegendDescriptor } from '@/ui/legend/legend.config'

/**
 * Legend читает series metadata из chart runtime и рендерит canvas entries.
 */
export class ChartLegend<E extends EventList = Record<string, any>>
  extends NovaUiComponentNode<NovaChartLegendResolvedProps, NovaChartLegendApi, NovaChartLegendProps, E> {
  private readonly api: NovaChartLegendApi

  /**
   * Создает экземпляр ChartLegend и подготавливает базовое состояние.
   */
  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    props: NovaChartLegendResolvedProps,
    options: { componentId?: string } = {},
    descriptor: ChartLegendDescriptor = CHART_LEGEND_NODE_DESCRIPTOR,
  ) {
    super(app, surface, descriptor, props, { componentId: options.componentId })
    this.options({ interactive: false, zIndex: 20 })
    this.api = {
      getSeries: () => this.resolveSeries(),
      refresh: () => this.dirty({ update: true, render: true }),
    }
  }

  /**
   * Обновляет значение состояния ChartLegend.
   */
  override setProps(patch: Partial<NovaChartLegendResolvedProps>): this {
    return super.setProps(patch as Partial<NovaChartLegendResolvedProps>)
  }

  /**
   * Возвращает значение состояния ChartLegend.
   */
  override getApi(): NovaChartLegendApi {
    return this.api
  }

  /**
   * Выполняет отрисовку ChartLegend.
   */
  render(): void {
    const series = this.resolveSeries()
    if (series.length === 0) return
    const runtime = resolveNovaChartRuntime<Record<string, unknown>>(this, this.props.chartRef)

    const padding = resolveSpacing(this.props.padding)
    const fontSize = this.props.fontSize ?? 11
    const lineHeight = this.props.lineHeight ?? 16
    const itemHeight = Math.max(16, lineHeight)
    const gap = this.props.orientation === 'horizontal' ? 12 : 4
    const swatchSize = 8
    const schema: NovaSchema = []
    const semanticRegions = []
    let cursorX = padding.left
    let cursorY = padding.top

    for (const item of series) {
      const label = this.props.labels[item.id] ?? item.label
      const itemX = cursorX
      const itemY = cursorY
      const itemStyle = runtime?.customization.resolveMarkStyle({
        componentId: this.componentId,
        componentName: 'Legend',
        part: 'legendItem',
        series: item,
        seriesKind: item.kind,
        state: item.visible ? 'normal' : 'muted',
        tokens: runtime.customization.tokens,
        className: this.props.className,
        attrs: this.props.attrs as Record<string, unknown> | undefined,
      }, {
        legacy: {
          color: this.props.color,
          background: item.color,
          opacity: item.visible ? 1 : 0.38,
        },
      }) ?? {}
      const labelWidth = Math.min(
        Math.max(44, label.length * Math.max(5, fontSize * 0.58)),
        Math.max(1, this.width - cursorX - padding.right - swatchSize - 6),
      )
      schema.push({
        type: 'rect',
        x: cursorX,
        y: cursorY + (itemHeight - swatchSize) / 2,
        width: swatchSize,
        height: swatchSize,
        styles: {
          background: itemStyle.background ?? itemStyle.fill ?? item.color,
          border: { radius: 2 },
          opacity: itemStyle.opacity ?? (item.visible ? 1 : 0.38),
        },
      })
      this.renderer.text({
        text: label,
        x: cursorX + swatchSize + 6,
        y: cursorY,
        width: labelWidth,
        height: itemHeight,
        styles: {
          color: itemStyle.color ?? this.props.color,
          font: {
            family: itemStyle.fontFamily ?? this.props.fontFamily ?? 'Inter, Arial, sans-serif',
            size: itemStyle.fontSize ?? fontSize,
            weight: String(itemStyle.fontWeight ?? this.props.fontWeight) as any,
          },
          lineHeight: itemStyle.lineHeight ?? lineHeight,
          align: {
            horizontal: 'left',
            vertical: 'middle',
          },
          ellipsis: true,
        },
        meta: {
          textRole: 'ui-label',
          textMode: 'run-atlas',
          textLod: 'always',
        },
      })

      semanticRegions.push({
        id: `${runtime?.id ?? 'chart'}:${this.componentId}:legend:${item.id}`,
        role: 'button' as const,
        label,
        bounds: {
          x: this.x + itemX,
          y: this.y + itemY,
          width: swatchSize + 6 + labelWidth,
          height: itemHeight,
        },
        focusable: runtime?.props.accessibility !== false && runtime?.props.accessibility.keyboardNavigation === true,
        order: 200 + semanticRegions.length,
        state: {
          hidden: item.visible === false,
          muted: item.visible === false,
        },
        data: {
          id: item.id,
          kind: item.kind,
          color: item.color,
        },
        source: {
          type: 'synthetic' as const,
          componentId: this.componentId,
          part: 'legend',
        },
      })

      if (this.props.orientation === 'horizontal') {
        cursorX += swatchSize + 6 + labelWidth + gap
        if (cursorX > this.width - padding.right - 48) {
          cursorX = padding.left
          cursorY += itemHeight + 4
        }
      } else {
        cursorY += itemHeight + gap
      }
    }

    if (schema.length > 0) this.renderer.schema(schema)
    if (runtime && runtime.props.accessibility !== false && runtime.props.accessibility.exposeLegend) {
      runtime.publishSemanticRegions(`${this.componentId}:legend`, [
        {
          id: `${runtime.id}:${this.componentId}:legend`,
          role: 'legend',
          label: 'Chart legend',
          bounds: this.getWorldBounds(),
          focusable: false,
          order: 180,
          data: {
            seriesCount: series.length,
          },
          source: {
            type: 'synthetic',
            componentId: this.componentId,
            part: 'legend',
          },
        },
        ...semanticRegions,
      ])
    } else {
      runtime?.clearSemanticRegions(`${this.componentId}:legend`)
    }
  }

  protected override onUnmount(): void {
    const runtime = resolveNovaChartRuntime<Record<string, unknown>>(this, this.props.chartRef)
    runtime?.clearSemanticRegions(`${this.componentId}:legend`)
    super.onUnmount()
  }

  /**
   * Обрабатывает входящее событие ChartLegend.
   */
  protected override onPropsChanged(changedKeys: Array<keyof NovaChartLegendResolvedProps>): void {
    this.applyCommonPropsChanged(changedKeys)
    this.dirty({ update: true, render: true })
  }

  /**
   * Возвращает series metadata с учетом local props.
   */
  private resolveSeries(): Array<NovaChartSeriesMetadata> {
    const runtime = resolveNovaChartRuntime<Record<string, unknown>>(this, this.props.chartRef)
    if (!runtime) return []
    const hidden = new Set(this.props.hiddenSeriesIds)
    const series = runtime.getSeriesMetadata()
      .filter(item => item.id !== '__default')
      .map(item => ({
        ...item,
        label: this.props.labels[item.id] ?? item.label,
        visible: item.visible && !hidden.has(item.id),
      }))
    return runtime.customization.decorateLegend(series)
  }
}
