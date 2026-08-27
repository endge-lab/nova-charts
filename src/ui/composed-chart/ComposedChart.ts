import type { NovaApp, NovaNode, NovaSurface, NovaTemplateChildSchema } from '@endge/nova'
import type { NovaUiLayoutRect } from '@endge/nova-ui-kit'
import type { EventList } from '@endge/utils'
import type {
  NovaChartAxisProps,
  NovaChartComposedChartApi,
  NovaChartComposedChartProps,
  NovaChartComposedChartResolvedProps,
  NovaChartComposedSeriesConfig,
  NovaChartGridProps,
  NovaChartInteractionProps,
  NovaChartLegendProps,
  NovaChartRootApi,
  NovaChartTooltipProps,
  NovaChartViewportProps,
} from '@/model/types/chart-components.types'
import type { ChartComposedChartDescriptor } from '@/ui/composed-chart/composed-chart.config'
import {

  reconcileNovaTemplateChildren,
} from '@endge/nova'
import {
  buildBoxSchema,
  NovaUiComponentNode,
  NovaUIKit,

} from '@endge/nova-ui-kit'
import { NovaCharts } from '@/nova-charts'
import {
  CHART_COMPOSED_CHART_NODE_DESCRIPTOR,

  normalizeChartComposedChartProps,
} from '@/ui/composed-chart/composed-chart.config'

/**
 * High-level cartesian wrapper для mixed series на shared scales.
 */
export class ChartComposedChart<TData = Record<string, unknown>, E extends EventList = Record<string, any>>
  extends NovaUiComponentNode<NovaChartComposedChartResolvedProps<TData>, NovaChartComposedChartApi<TData>, NovaChartComposedChartProps<TData>, E> {
  private readonly _managedChildren: Array<NovaNode<E>> = []
  private readonly _api: NovaChartComposedChartApi<TData>

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    props: NovaChartComposedChartResolvedProps<TData>,
    options: { componentId?: string } = {},
    descriptor: ChartComposedChartDescriptor<TData> = CHART_COMPOSED_CHART_NODE_DESCRIPTOR as ChartComposedChartDescriptor<TData>,
  ) {
    super(app, surface, descriptor, props, { componentId: options.componentId })
    this._api = {
      setData: data => this._setData(data),
      getData: () => this.props.data,
      refresh: () => this._refresh(),
      exportChart: exportOptions => this._rootApi()?.exportChart(exportOptions) ?? this.nova.exportImage({
        ...exportOptions,
        includeSemanticSnapshot: exportOptions?.includeSemanticSnapshot ?? true,
      }),
      getSemanticSnapshot: snapshotOptions => this._rootApi()?.getSemanticSnapshot(snapshotOptions) ?? this.nova.semantics.snapshot(snapshotOptions),
    }
    this._reconcile()
  }

  override setProps(patch: Partial<NovaChartComposedChartResolvedProps<TData>>): this {
    return super.setProps(normalizeChartComposedChartProps({
      ...this.props,
      ...patch,
    } as NovaChartComposedChartProps<TData>) as Partial<NovaChartComposedChartResolvedProps<TData>>)
  }

  override getApi(): NovaChartComposedChartApi<TData> {
    return this._api
  }

  override applyLayoutRect(rect: NovaUiLayoutRect): boolean {
    const changed = super.applyLayoutRect(rect)
    if (changed) {
      this._applyChildrenRect()
    }
    return changed
  }

  update(): void {
    this._applyChildrenRect()
  }

  render(): void {
    const schema = buildBoxSchema(this.props, this.width, this.height)
    if (schema.length > 0) {
      this.renderer.schema(schema)
    }
  }

  private _setData(data: Array<TData>): void {
    this.setProps({ data: [...data] } as Partial<NovaChartComposedChartResolvedProps<TData>>)
    this._reconcile()
    this.dirty({ update: true, render: true })
  }

  private _refresh(): void {
    this._reconcile()
    this._dirtyChildren()
    this.dirty({ update: true, render: true })
  }

  private _reconcile(): void {
    const reconciled = reconcileNovaTemplateChildren(this, this._managedChildren, [this._createRootSchema()])
    this._managedChildren.length = 0
    this._managedChildren.push(...reconciled.nodes)
    this._applyChildrenRect()
  }

  private _createRootSchema(): NovaTemplateChildSchema {
    return {
      type: NovaCharts.Root,
      id: `${this.componentId}:root`,
      props: {
        width: this.width,
        height: this.height,
        data: this.props.data,
        keyField: this.props.keyField,
        background: 'transparent',
        clip: false,
        styleSheet: this.props.styleSheet,
        visualPreset: this.props.visualPreset,
        plugins: this.props.plugins,
        accessibility: this.props.accessibility,
      },
      children: [
        {
          type: NovaCharts.Scale,
          id: `${this.componentId}:x-scale`,
          props: {
            scaleId: this.props.xAxis.scaleId,
            scaleType: this.props.xAxis.scaleType,
            field: this.props.xAxis.field,
            domain: this.props.xAxis.domain,
            zero: this.props.xAxis.zero,
            nice: this.props.xAxis.nice,
            paddingInner: this.props.xAxis.paddingInner,
            paddingOuter: this.props.xAxis.paddingOuter,
          },
        },
        {
          type: NovaCharts.Scale,
          id: `${this.componentId}:y-scale`,
          props: {
            scaleId: this.props.yAxis.scaleId,
            scaleType: this.props.yAxis.scaleType,
            field: this.props.yAxis.field,
            domain: this.props.yAxis.domain,
            zero: this.props.yAxis.zero,
            nice: this.props.yAxis.nice,
            paddingInner: this.props.yAxis.paddingInner,
            paddingOuter: this.props.yAxis.paddingOuter,
          },
        },
        {
          type: NovaUIKit.Flex,
          id: `${this.componentId}:layout`,
          props: {
            direction: 'column',
            gap: 0,
            alignItems: 'stretch',
          },
          children: [
            this._createMainRow(),
            ...this._createXAxisRow(),
            ...this._createViewportRow(),
          ],
        },
      ],
    }
  }

  private _createMainRow(): NovaTemplateChildSchema {
    const yAxisWidth = this._isYAxisVisible() ? this.props.yAxis.width : 0
    const legendWidth = this.props.legend ? 140 : 0
    return {
      type: NovaUIKit.Flex,
      id: `${this.componentId}:main-row`,
      props: {
        direction: 'row',
        gap: 0,
        alignItems: 'stretch',
      },
      layout: { width: '100%', flexBasis: 0, flexGrow: 1, minHeight: 1 },
      children: [
        ...this._createYAxis(yAxisWidth),
        this._createPlot(),
        ...this._createLegend(legendWidth),
      ],
    }
  }

  private _createPlot(): NovaTemplateChildSchema {
    const gridProps = this._resolveObjectOption<NovaChartGridProps>(this.props.grid)
    const interactionProps = this._resolveObjectOption<NovaChartInteractionProps>(this.props.interaction)
    const tooltipProps = this._resolveObjectOption<NovaChartTooltipProps>(this.props.tooltip)

    return {
      type: NovaCharts.Plot,
      id: `${this.componentId}:plot`,
      props: {
        xScaleId: this.props.xAxis.scaleId,
        yScaleId: this.props.yAxis.scaleId,
        clip: true,
      },
      layout: { flexBasis: 0, flexGrow: 1, minWidth: 1, height: '100%' },
      children: [
        ...(this.props.grid
          ? [{
              type: NovaCharts.Grid,
              id: `${this.componentId}:grid`,
              props: {
                xScaleId: this.props.xAxis.scaleId,
                yScaleId: this.props.yAxis.scaleId,
                ...(gridProps ?? {}),
              },
            }]
          : []),
        ...this.props.series.map((series, index) => this._createSeriesSchema(series, index)),
        ...this.props.children,
        ...(this.props.interaction
          ? [{
              type: NovaCharts.Interaction,
              id: `${this.componentId}:interaction`,
              props: {
                tooltip: this.props.tooltip !== false,
                mode: 'nearest',
                ...(interactionProps ?? {}),
              },
            }]
          : []),
        ...this._createViewportController(),
        ...(this.props.tooltip
          ? [{
              type: NovaCharts.Tooltip,
              id: `${this.componentId}:tooltip`,
              props: {
                ...(tooltipProps ?? {}),
                renderers: this.props.renderers,
              },
            }]
          : []),
      ],
    }
  }

  private _createViewportController(): Array<NovaTemplateChildSchema> {
    if (!this.props.viewport) {
      return []
    }
    const viewportProps = this._resolveObjectOption<Omit<NovaChartViewportProps, 'scaleId'>>(this.props.viewport)
    if (!viewportProps?.controller) {
      return []
    }
    return [{
      type: NovaCharts.ViewportController,
      id: `${this.componentId}:viewport-controller`,
      props: {
        ...viewportProps.controller,
        scaleId: this.props.xAxis.scaleId,
        viewportRef: `${this.componentId}:viewport`,
      },
      layout: { width: '100%', height: '100%' },
    }]
  }

  private _createSeriesSchema(series: NovaChartComposedSeriesConfig<TData>, index: number): NovaTemplateChildSchema {
    const id = `${this.componentId}:series:${series.id ?? index}`
    const props = { ...(series as Record<string, unknown>) }
    delete props.type
    delete props.id
    return {
      type: resolveSeriesSchemaType(series.type),
      id,
      props: {
        states: this.props.states,
        parts: this.props.parts,
        renderers: this.props.renderers,
        ...props,
        xScaleId: series.xScaleId ?? this.props.xAxis.scaleId,
        yScaleId: series.yScaleId ?? this.props.yAxis.scaleId,
      },
    }
  }

  private _createYAxis(width: number): Array<NovaTemplateChildSchema> {
    if (!this._isYAxisVisible()) {
      return []
    }
    const axisProps = this._resolveAxisObjectOption('y')
    return [{
      type: NovaCharts.Axis,
      id: `${this.componentId}:y-axis`,
      props: {
        scaleId: this.props.yAxis.scaleId,
        orientation: 'vertical',
        tickSide: 'start',
        labelSide: 'start',
        ticks: this.props.yAxis.ticks,
        ...(axisProps ?? {}),
      },
      layout: { width, height: '100%', flexShrink: 0 },
    }]
  }

  private _createXAxisRow(): Array<NovaTemplateChildSchema> {
    if (!this._isXAxisVisible()) {
      return []
    }
    const yAxisWidth = this._isYAxisVisible() ? this.props.yAxis.width : 0
    const legendWidth = this.props.legend ? 140 : 0
    const axisProps = this._resolveAxisObjectOption('x')
    return [{
      type: NovaUIKit.Flex,
      id: `${this.componentId}:x-axis-row`,
      props: {
        direction: 'row',
        gap: 0,
      },
      layout: { width: '100%', height: this.props.xAxis.height, flexShrink: 0 },
      children: [
        this._createSpacer(`${this.componentId}:x-axis-spacer`, yAxisWidth, this.props.xAxis.height),
        {
          type: NovaCharts.Axis,
          id: `${this.componentId}:x-axis`,
          props: {
            scaleId: this.props.xAxis.scaleId,
            orientation: 'horizontal',
            tickSide: 'end',
            labelSide: 'end',
            ticks: this.props.xAxis.ticks,
            ...(axisProps ?? {}),
          },
          layout: { flexBasis: 0, flexGrow: 1, minWidth: 1, height: this.props.xAxis.height },
        },
        ...(legendWidth > 0 ? [this._createSpacer(`${this.componentId}:legend-axis-spacer`, legendWidth, this.props.xAxis.height)] : []),
      ],
    }]
  }

  private _createViewportRow(): Array<NovaTemplateChildSchema> {
    if (!this.props.viewport) {
      return []
    }
    const yAxisWidth = this._isYAxisVisible() ? this.props.yAxis.width : 0
    const legendWidth = this.props.legend ? 140 : 0
    const height = 16
    const viewportProps = this._resolveObjectOption<Omit<NovaChartViewportProps, 'scaleId'>>(this.props.viewport)
    return [{
      type: NovaUIKit.Flex,
      id: `${this.componentId}:viewport-row`,
      props: {
        direction: 'row',
        gap: 0,
      },
      layout: { width: '100%', height, flexShrink: 0 },
      children: [
        this._createSpacer(`${this.componentId}:viewport-spacer`, yAxisWidth, height),
        {
          type: NovaCharts.Viewport,
          id: `${this.componentId}:viewport`,
          props: {
            scaleId: this.props.xAxis.scaleId,
            orientation: 'horizontal',
            ...(viewportProps ?? {}),
          },
          layout: { flexBasis: 0, flexGrow: 1, minWidth: 1, height },
        },
        ...(legendWidth > 0 ? [this._createSpacer(`${this.componentId}:legend-viewport-spacer`, legendWidth, height)] : []),
      ],
    }]
  }

  private _createLegend(width: number): Array<NovaTemplateChildSchema> {
    if (!this.props.legend) {
      return []
    }
    const legendProps = this._resolveObjectOption<NovaChartLegendProps>(this.props.legend)
    return [{
      type: NovaCharts.Legend,
      id: `${this.componentId}:legend`,
      props: legendProps ?? {},
      layout: { width, height: '100%', flexShrink: 0 },
    }]
  }

  private _createSpacer(id: string, width: number, height: number): NovaTemplateChildSchema {
    return {
      type: NovaUIKit.Surface,
      id,
      props: {
        background: 'transparent',
        border: { width: 0 },
      },
      layout: { width, height, flexShrink: 0 },
    }
  }

  private _isXAxisVisible(): boolean {
    if (this.props.axes === false) {
      return false
    }
    if (typeof this.props.axes === 'object' && this.props.axes?.x === false) {
      return false
    }
    return this.props.xAxis.visible
  }

  private _isYAxisVisible(): boolean {
    if (this.props.axes === false) {
      return false
    }
    if (typeof this.props.axes === 'object' && this.props.axes?.y === false) {
      return false
    }
    return this.props.yAxis.visible
  }

  private _resolveAxisObjectOption(axis: 'x' | 'y'): NovaChartAxisProps | null {
    if (typeof this.props.axes !== 'object' || this.props.axes === null) {
      return null
    }
    const option = axis === 'x' ? this.props.axes.x : this.props.axes.y
    return typeof option === 'object' && option !== null ? option : null
  }

  private _resolveObjectOption<TOption>(value: boolean | TOption): TOption | null {
    return typeof value === 'object' && value !== null ? value : null
  }

  private _applyChildrenRect(): void {
    const rect = {
      x: 0,
      y: 0,
      width: this.width,
      height: this.height,
    }
    for (const child of this._managedChildren) {
      applyChildRect(child, rect)
    }
  }

  private _dirtyChildren(): void {
    for (const child of this._managedChildren) {
      dirtySubtree(child)
    }
  }

  private _rootApi(): NovaChartRootApi<TData> | null {
    return this.nova.components.api<NovaChartRootApi<TData>>(`${this.componentId}:root`) ?? null
  }

  protected override onPropsChanged(changedKeys: Array<keyof NovaChartComposedChartResolvedProps<TData>>): void {
    this.applyCommonPropsChanged(changedKeys)
    this._reconcile()
    this.dirty({ update: true, render: true })
  }
}

function resolveSeriesSchemaType(type: NovaChartComposedSeriesConfig['type']): string {
  if (type === 'bar') {
    return NovaCharts.BarSeries
  }
  if (type === 'line') {
    return NovaCharts.LineSeries
  }
  if (type === 'area') {
    return NovaCharts.AreaSeries
  }
  if (type === 'scatter') {
    return NovaCharts.ScatterSeries
  }
  return NovaCharts.BubbleSeries
}

function applyChildRect(child: NovaNode<any>, rect: NovaUiLayoutRect): void {
  if (typeof (child as { applyLayoutRect?: (next: NovaUiLayoutRect) => boolean }).applyLayoutRect === 'function') {
    ;(child as unknown as { applyLayoutRect: (next: NovaUiLayoutRect) => boolean }).applyLayoutRect(rect)
  }
}

function dirtySubtree(node: { dirty?: (flags: { update?: boolean, render?: boolean }) => void, children?: ReadonlyArray<unknown> }): void {
  node.dirty?.({ update: true, render: true })
  for (const child of node.children ?? []) {
    if (!child || typeof child !== 'object') {
      continue
    }
    dirtySubtree(child)
  }
}
