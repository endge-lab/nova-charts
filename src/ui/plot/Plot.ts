import type { NovaApp, NovaNode, NovaSurface, NovaTemplateChildSchema } from '@endge/nova'
import type { NovaUiLayoutRect } from '@endge/nova-ui-kit'
import type { EventList } from '@endge/utils'
import type {
  NovaChartPlotApi,
  NovaChartPlotProps,
  NovaChartPlotResolvedProps,
} from '@/model/types/chart-components.types'
import type { ChartPlotDescriptor } from '@/ui/plot/plot.config'
import {

  reconcileNovaTemplateChildren,
} from '@endge/nova'
import {
  buildBoxSchema,
  NovaUiComponentNode,

} from '@endge/nova-ui-kit'
import { CHART_PLOT_NODE_DESCRIPTOR } from '@/ui/plot/plot.config'
import { resolveNovaChartRuntime } from '@/ui/shared/chart-runtime-resolver'

/**
 * Plot area назначает pixel ranges шкалам и держит содержимое графика.
 */
export class ChartPlot<E extends EventList = Record<string, any>>
  extends NovaUiComponentNode<NovaChartPlotResolvedProps, NovaChartPlotApi, NovaChartPlotProps, E> {
  private readonly _managedChildren: Array<NovaNode<E>> = []
  private readonly _api: NovaChartPlotApi

  /**
   * Создает экземпляр ChartPlot и подготавливает базовое состояние.
   */
  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    props: NovaChartPlotResolvedProps,
    options: { componentId?: string, children?: Array<NovaTemplateChildSchema> } = {},
    descriptor: ChartPlotDescriptor = CHART_PLOT_NODE_DESCRIPTOR,
  ) {
    super(app, surface, descriptor, props, { componentId: options.componentId })
    this._api = {
      refresh: () => this._refresh(),
      setChildren: children => this.setChildren(children),
      getRect: () => ({ x: this.x, y: this.y, width: this.width, height: this.height }),
    }
    this.setChildren(options.children ?? [])
  }

  /**
   * Обновляет значение состояния ChartPlot.
   */
  override setProps(patch: Partial<NovaChartPlotResolvedProps>): this {
    return super.setProps(patch as Partial<NovaChartPlotResolvedProps>)
  }

  /**
   * Возвращает значение состояния ChartPlot.
   */
  override getApi(): NovaChartPlotApi {
    return this._api
  }

  /**
   * Применяет подготовленное состояние ChartPlot.
   */
  override applyLayoutRect(rect: NovaUiLayoutRect): boolean {
    const changed = super.applyLayoutRect(rect)
    if (changed) {
      this._refresh()
    }
    return changed
  }

  /**
   * Обновляет runtime-состояние ChartPlot.
   */
  update(): void {
    this._updateScaleRanges()
    this._applyChildrenRect()
  }

  /**
   * Выполняет отрисовку ChartPlot.
   */
  render(): void {
    const schema = buildBoxSchema(this.props, this.width, this.height)
    if (schema.length > 0) {
      this.renderSchema(schema)
    }
  }

  /**
   * Обновляет значение состояния ChartPlot.
   */
  setChildren(children: Array<NovaTemplateChildSchema>): void {
    const runtime = resolveNovaChartRuntime(this, this.props.chartRef)
    const reconciled = reconcileNovaTemplateChildren(this, this._managedChildren, children, runtime?.refScope)
    this._managedChildren.length = 0
    this._managedChildren.push(...reconciled.nodes)
    this._applyChildrenRect()
    this._refresh()
  }

  /**
   * Обрабатывает входящее событие ChartPlot.
   */
  protected override onPropsChanged(changedKeys: Array<keyof NovaChartPlotResolvedProps>): void {
    this.applyCommonPropsChanged(changedKeys)
    this._refresh()
  }

  /**
   * Выполняет отрисовку ChartPlot.
   */
  protected override renderChildren(): void {
    const runtime = resolveNovaChartRuntime<Record<string, unknown>>(this, this.props.chartRef)
    if (!this.props.clip) {
      this._renderPluginLayer('underlay', runtime)
      super.renderChildren()
      this._renderPluginLayer('overlay', runtime)
      return
    }

    this.renderer.clip(0, 0, this.width, this.height)
    try {
      this._renderPluginLayer('underlay', runtime)
      super.renderChildren()
      this._renderPluginLayer('overlay', runtime)
    }
    finally {
      this.renderer.clearClip()
    }
  }

  /**
   * Синхронизирует актуальное состояние ChartPlot.
   */
  private _refresh(): void {
    this._updateScaleRanges()
    this._applyChildrenRect()
    this.dirty({ update: true, render: true })
    for (const child of this._managedChildren) {
      child.dirty({ update: true, render: true })
    }
  }

  /**
   * Обновляет runtime-состояние ChartPlot.
   */
  private _updateScaleRanges(): void {
    const runtime = resolveNovaChartRuntime(this, this.props.chartRef)
    if (!runtime) {
      return
    }

    if (this.props.xScaleId) {
      setScaleRangeIfChanged(runtime, this.props.xScaleId, [0, this.width])
    }
    if (this.props.yScaleId) {
      const yScale = runtime.getScale(this.props.yScaleId)
      setScaleRangeIfChanged(runtime, this.props.yScaleId, yScale?.type === 'band' ? [0, this.height] : [this.height, 0])
    }
  }

  /**
   * Применяет подготовленное состояние ChartPlot.
   */
  private _applyChildrenRect(): void {
    const rect = { x: 0, y: 0, width: this.width, height: this.height }
    for (const child of this._managedChildren) {
      if (typeof (child as { applyLayoutRect?: (next: NovaUiLayoutRect) => boolean }).applyLayoutRect === 'function') {
        ;(child as unknown as { applyLayoutRect: (next: NovaUiLayoutRect) => boolean }).applyLayoutRect(rect)
      }
    }
  }

  private _renderPluginLayer(
    layer: 'underlay' | 'overlay',
    runtime: ReturnType<typeof resolveNovaChartRuntime<Record<string, unknown>>>,
  ): void {
    if (!runtime) {
      return
    }
    const schema = runtime.customization.renderPluginLayer(layer, {
      componentId: this.componentId,
      componentName: 'Plot',
      width: this.width,
      height: this.height,
      runtime: {
        id: runtime.id,
        getData: () => runtime.dataStore.getData(),
        getScale: id => runtime.getScale(id),
        getSeriesMetadata: () => runtime.getSeriesMetadata(),
        getInteractionState: () => runtime.getInteractionState(),
      },
      tokens: runtime.customization.tokens,
    })
    if (schema.length > 0) {
      this.renderer.schema(schema)
    }
  }
}

function setScaleRangeIfChanged(
  runtime: { getScale: (id: string) => { getRange: () => readonly [number, number] } | undefined, setScaleRange: (id: string, range: readonly [number, number]) => void },
  id: string,
  range: readonly [number, number],
): void {
  const current = runtime.getScale(id)?.getRange()
  if (!current) {
    return
  }
  if (current[0] === range[0] && current[1] === range[1]) {
    return
  }
  runtime.setScaleRange(id, range)
}
