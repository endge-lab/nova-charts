import type { NovaApp, NovaNode, NovaSurface, NovaTemplateChildSchema } from '@endge/nova'
import type { NovaUiLayoutRect } from '@endge/nova-ui-kit'
import type { EventList } from '@endge/utils'
import type {
  NovaChartBarChartApi,
  NovaChartBarChartProps,
  NovaChartBarChartResolvedProps,
  NovaChartFieldAccessor,
  NovaChartGridProps,
  NovaChartInteractionProps,
  NovaChartLegendProps,
  NovaChartRootApi,
  NovaChartTooltipProps,
  NovaChartViewportProps,
} from '@/model/types/chart-components.types'
import type { ChartScaleDomain } from '@/model/types/chart-scale.types'
import type { ChartBarChartDescriptor } from '@/ui/bar-chart/bar-chart.config'
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
  CHART_BAR_CHART_NODE_DESCRIPTOR,

  normalizeChartBarChartProps,
} from '@/ui/bar-chart/bar-chart.config'

const CATEGORY_SCALE_ID = 'category'
const VALUE_SCALE_ID = 'value'

/**
 * High-level BarChart wrapper собирает chart runtime из low-level DSL компонентов.
 */
export class ChartBarChart<TData = Record<string, unknown>, E extends EventList = Record<string, any>>
  extends NovaUiComponentNode<NovaChartBarChartResolvedProps<TData>, NovaChartBarChartApi<TData>, NovaChartBarChartProps<TData>, E> {
  private readonly managedChildren: Array<NovaNode<E>> = []
  private readonly api: NovaChartBarChartApi<TData>

  /**
   * Создает экземпляр ChartBarChart и подготавливает внутренний DSL tree.
   */
  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    props: NovaChartBarChartResolvedProps<TData>,
    options: { componentId?: string } = {},
    descriptor: ChartBarChartDescriptor<TData> = CHART_BAR_CHART_NODE_DESCRIPTOR as ChartBarChartDescriptor<TData>,
  ) {
    super(app, surface, descriptor, props, { componentId: options.componentId })
    this.api = {
      setData: data => this.setData(data),
      getData: () => this.props.data,
      refresh: () => this.refresh(),
      exportChart: exportOptions => this.rootApi()?.exportChart(exportOptions) ?? this.nova.exportImage({
        ...exportOptions,
        includeSemanticSnapshot: exportOptions?.includeSemanticSnapshot ?? true,
      }),
      getSemanticSnapshot: snapshotOptions => this.rootApi()?.getSemanticSnapshot(snapshotOptions) ?? this.nova.semantics.snapshot(snapshotOptions),
    }
    this.reconcile()
  }

  /**
   * Обновляет значение состояния ChartBarChart.
   */
  override setProps(patch: Partial<NovaChartBarChartResolvedProps<TData>>): this {
    return super.setProps(normalizeChartBarChartProps({
      ...this.props,
      ...patch,
    } as NovaChartBarChartProps<TData>) as Partial<NovaChartBarChartResolvedProps<TData>>)
  }

  /**
   * Возвращает значение состояния ChartBarChart.
   */
  override getApi(): NovaChartBarChartApi<TData> {
    return this.api
  }

  /**
   * Применяет подготовленное состояние ChartBarChart.
   */
  override applyLayoutRect(rect: NovaUiLayoutRect): boolean {
    const changed = super.applyLayoutRect(rect)
    if (changed) {
      this.applyChildrenRect()
    }
    return changed
  }

  /**
   * Обновляет runtime-состояние ChartBarChart.
   */
  update(): void {
    this.applyChildrenRect()
  }

  /**
   * Выполняет отрисовку ChartBarChart.
   */
  render(): void {
    const schema = buildBoxSchema(this.props, this.width, this.height)
    if (schema.length > 0) {
      this.renderer.schema(schema)
    }
  }

  /**
   * Обновляет данные wrapper chart.
   */
  private setData(data: Array<TData>): void {
    this.setProps({ data: [...data] } as Partial<NovaChartBarChartResolvedProps<TData>>)
    this.reconcile()
    this.dirty({ update: true, render: true })
  }

  /**
   * Пересобирает внутренний DSL tree.
   */
  private refresh(): void {
    this.reconcile()
    this.dirtyChildren()
    this.dirty({ update: true, render: true })
  }

  /**
   * Согласует внутренние Nova children.
   */
  private reconcile(): void {
    const children = this.createRootSchema()
    const reconciled = reconcileNovaTemplateChildren(this, this.managedChildren, [children])
    this.managedChildren.length = 0
    this.managedChildren.push(...reconciled.nodes)
    this.applyChildrenRect()
  }

  /**
   * Создает корневой schema high-level chart.
   */
  private createRootSchema(): NovaTemplateChildSchema {
    const categoryDomain = this.resolveCategoryDomain()
    const valueDomain = this.resolveValueDomain()
    const vertical = this.props.orientation === 'vertical'
    const categoryScale = vertical ? CATEGORY_SCALE_ID : VALUE_SCALE_ID
    const valueScale = vertical ? VALUE_SCALE_ID : CATEGORY_SCALE_ID

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
          id: `${this.componentId}:category-scale`,
          props: {
            scaleId: CATEGORY_SCALE_ID,
            scaleType: 'band',
            field: this.props.categoryField,
            domain: categoryDomain,
            paddingInner: this.props.mode === 'grouped' ? 0.18 : 0.12,
            paddingOuter: 0.06,
          },
        },
        {
          type: NovaCharts.Scale,
          id: `${this.componentId}:value-scale`,
          props: {
            scaleId: VALUE_SCALE_ID,
            scaleType: 'linear',
            field: this.props.valueField,
            domain: valueDomain,
            zero: true,
            nice: true,
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
          children: vertical
            ? this.createVerticalLayout(categoryScale, valueScale)
            : this.createHorizontalLayout(categoryScale, valueScale),
        },
      ],
    }
  }

  /**
   * Создает layout для vertical bars.
   */
  private createVerticalLayout(categoryScaleId: string, valueScaleId: string): Array<NovaTemplateChildSchema> {
    const valueAxisWidth = this.props.axes.value.visible ? this.props.axes.value.width : 0
    const categoryAxisHeight = this.props.axes.category.visible ? this.props.axes.category.height : 0
    const viewportHeight = this.props.viewport ? 16 : 0
    const legendWidth = this.props.legend ? 140 : 0

    return [
      {
        type: NovaUIKit.Flex,
        id: `${this.componentId}:main-row`,
        props: {
          direction: 'row',
          gap: 0,
          alignItems: 'stretch',
        },
        layout: { width: '100%', flexBasis: 0, flexGrow: 1, minHeight: 1 },
        children: [
          ...this.createValueAxis(valueScaleId, valueAxisWidth, 'vertical'),
          this.createPlot(categoryScaleId, valueScaleId),
          ...this.createLegend(legendWidth),
        ],
      },
      ...this.createCategoryAxisRow(categoryScaleId, valueAxisWidth, categoryAxisHeight, legendWidth),
      ...this.createViewportRow(categoryScaleId, valueAxisWidth, viewportHeight, legendWidth, 'horizontal'),
    ]
  }

  /**
   * Создает layout для horizontal bars.
   */
  private createHorizontalLayout(categoryScaleId: string, valueScaleId: string): Array<NovaTemplateChildSchema> {
    const categoryAxisWidth = this.props.axes.category.visible ? this.props.axes.category.width : 0
    const valueAxisHeight = this.props.axes.value.visible ? this.props.axes.value.height : 0
    const viewportWidth = this.props.viewport ? 16 : 0
    const legendWidth = this.props.legend ? 140 : 0

    return [
      {
        type: NovaUIKit.Flex,
        id: `${this.componentId}:main-row`,
        props: {
          direction: 'row',
          gap: 0,
          alignItems: 'stretch',
        },
        layout: { width: '100%', flexBasis: 0, flexGrow: 1, minHeight: 1 },
        children: [
          ...this.createCategoryAxis(categoryScaleId, categoryAxisWidth),
          this.createPlot(valueScaleId, categoryScaleId),
          ...this.createViewportColumn(categoryScaleId, viewportWidth),
          ...this.createLegend(legendWidth),
        ],
      },
      ...this.createValueAxisRow(valueScaleId, categoryAxisWidth, valueAxisHeight, viewportWidth, legendWidth),
    ]
  }

  /**
   * Создает Plot с Grid, BarSeries, Interaction и Tooltip.
   */
  private createPlot(xScaleId: string, yScaleId: string): NovaTemplateChildSchema {
    const gridProps = this.resolveObjectOption<NovaChartGridProps>(this.props.grid)
    const interactionProps = this.resolveObjectOption<NovaChartInteractionProps>(this.props.interaction)
    const tooltipProps = this.resolveObjectOption<NovaChartTooltipProps>(this.props.tooltip)
    return {
      type: NovaCharts.Plot,
      id: `${this.componentId}:plot`,
      props: {
        xScaleId,
        yScaleId,
        clip: true,
      },
      layout: { flexBasis: 0, flexGrow: 1, minWidth: 1, height: '100%' },
      children: [
        ...(this.props.grid
          ? [{
              type: NovaCharts.Grid,
              id: `${this.componentId}:grid`,
              props: {
                xScaleId,
                yScaleId,
                ...(gridProps ?? {}),
              },
            }]
          : []),
        {
          type: NovaCharts.BarSeries,
          id: `${this.componentId}:series`,
          props: {
            xScaleId,
            yScaleId,
            categoryField: this.props.categoryField,
            valueField: this.props.valueField,
            seriesField: this.props.seriesField,
            orientation: this.props.orientation,
            mode: this.props.mode,
            colors: this.props.colors,
            labels: this.props.labels,
            highlight: this.props.colors.highlight,
            states: this.props.states,
            parts: this.props.parts,
            renderers: this.props.renderers,
          },
        },
        ...this.props.children,
        ...(this.props.interaction
          ? [{
              type: NovaCharts.Interaction,
              id: `${this.componentId}:interaction`,
              props: {
                tooltip: this.props.tooltip !== false,
                ...(interactionProps ?? {}),
              },
            }]
          : []),
        ...this.createViewportController(xScaleId),
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

  private createViewportController(scaleId: string): Array<NovaTemplateChildSchema> {
    if (!this.props.viewport) {
      return []
    }
    const viewportProps = this.resolveObjectOption<Omit<NovaChartViewportProps, 'scaleId'>>(this.props.viewport)
    if (!viewportProps?.controller) {
      return []
    }
    return [{
      type: NovaCharts.ViewportController,
      id: `${this.componentId}:viewport-controller`,
      props: {
        ...viewportProps.controller,
        scaleId,
        viewportRef: `${this.componentId}:viewport`,
      },
      layout: { width: '100%', height: '100%' },
    }]
  }

  /**
   * Создает vertical value axis.
   */
  private createValueAxis(
    scaleId: string,
    width: number,
    orientation: 'vertical' | 'horizontal',
  ): Array<NovaTemplateChildSchema> {
    if (!this.props.axes.value.visible) {
      return []
    }
    return [{
      type: NovaCharts.Axis,
      id: `${this.componentId}:value-axis`,
      props: {
        scaleId,
        orientation,
        tickSide: 'start',
        labelSide: 'start',
        ticks: this.props.axes.value.ticks,
      },
      layout: orientation === 'vertical'
        ? { width, height: '100%', flexShrink: 0 }
        : { width: '100%', height: this.props.axes.value.height, flexShrink: 0 },
    }]
  }

  /**
   * Создает vertical category axis.
   */
  private createCategoryAxis(scaleId: string, width: number): Array<NovaTemplateChildSchema> {
    if (!this.props.axes.category.visible) {
      return []
    }
    return [{
      type: NovaCharts.Axis,
      id: `${this.componentId}:category-axis`,
      props: {
        scaleId,
        orientation: 'vertical',
        tickSide: 'start',
        labelSide: 'start',
        ticks: this.props.axes.category.ticks,
      },
      layout: { width, height: '100%', flexShrink: 0 },
    }]
  }

  /**
   * Создает bottom category axis row.
   */
  private createCategoryAxisRow(
    scaleId: string,
    spacerWidth: number,
    height: number,
    legendWidth: number,
  ): Array<NovaTemplateChildSchema> {
    if (!this.props.axes.category.visible) {
      return []
    }
    return [{
      type: NovaUIKit.Flex,
      id: `${this.componentId}:category-axis-row`,
      props: {
        direction: 'row',
        gap: 0,
      },
      layout: { width: '100%', height, flexShrink: 0 },
      children: [
        this.createSpacer(`${this.componentId}:category-axis-spacer`, spacerWidth, height),
        {
          type: NovaCharts.Axis,
          id: `${this.componentId}:category-axis`,
          props: {
            scaleId,
            orientation: 'horizontal',
            tickSide: 'end',
            labelSide: 'end',
            ticks: this.props.axes.category.ticks,
          },
          layout: { flexBasis: 0, flexGrow: 1, minWidth: 1, height },
        },
        ...(legendWidth > 0 ? [this.createSpacer(`${this.componentId}:legend-axis-spacer`, legendWidth, height)] : []),
      ],
    }]
  }

  /**
   * Создает bottom value axis row.
   */
  private createValueAxisRow(
    scaleId: string,
    spacerWidth: number,
    height: number,
    viewportWidth: number,
    legendWidth: number,
  ): Array<NovaTemplateChildSchema> {
    if (!this.props.axes.value.visible) {
      return []
    }
    return [{
      type: NovaUIKit.Flex,
      id: `${this.componentId}:value-axis-row`,
      props: {
        direction: 'row',
        gap: 0,
      },
      layout: { width: '100%', height, flexShrink: 0 },
      children: [
        this.createSpacer(`${this.componentId}:value-axis-spacer`, spacerWidth, height),
        {
          type: NovaCharts.Axis,
          id: `${this.componentId}:value-axis`,
          props: {
            scaleId,
            orientation: 'horizontal',
            tickSide: 'end',
            labelSide: 'end',
            ticks: this.props.axes.value.ticks,
          },
          layout: { flexBasis: 0, flexGrow: 1, minWidth: 1, height },
        },
        ...(viewportWidth > 0 ? [this.createSpacer(`${this.componentId}:viewport-axis-spacer`, viewportWidth, height)] : []),
        ...(legendWidth > 0 ? [this.createSpacer(`${this.componentId}:legend-axis-spacer`, legendWidth, height)] : []),
      ],
    }]
  }

  /**
   * Создает horizontal viewport row.
   */
  private createViewportRow(
    scaleId: string,
    spacerWidth: number,
    height: number,
    legendWidth: number,
    orientation: 'horizontal' | 'vertical',
  ): Array<NovaTemplateChildSchema> {
    if (!this.props.viewport) {
      return []
    }
    const viewportProps = this.resolveObjectOption<Omit<NovaChartViewportProps, 'scaleId'>>(this.props.viewport)
    return [{
      type: NovaUIKit.Flex,
      id: `${this.componentId}:viewport-row`,
      props: {
        direction: 'row',
        gap: 0,
      },
      layout: { width: '100%', height, flexShrink: 0 },
      children: [
        this.createSpacer(`${this.componentId}:viewport-spacer`, spacerWidth, height),
        {
          type: NovaCharts.Viewport,
          id: `${this.componentId}:viewport`,
          props: {
            scaleId,
            orientation,
            ...(viewportProps ?? {}),
          },
          layout: { flexBasis: 0, flexGrow: 1, minWidth: 1, height },
        },
        ...(legendWidth > 0 ? [this.createSpacer(`${this.componentId}:legend-viewport-spacer`, legendWidth, height)] : []),
      ],
    }]
  }

  /**
   * Создает vertical viewport column.
   */
  private createViewportColumn(scaleId: string, width: number): Array<NovaTemplateChildSchema> {
    if (!this.props.viewport) {
      return []
    }
    const viewportProps = this.resolveObjectOption<Omit<NovaChartViewportProps, 'scaleId'>>(this.props.viewport)
    return [{
      type: NovaCharts.Viewport,
      id: `${this.componentId}:viewport`,
      props: {
        scaleId,
        orientation: 'vertical',
        ...(viewportProps ?? {}),
      },
      layout: { width, height: '100%', flexShrink: 0 },
    }]
  }

  /**
   * Создает Legend.
   */
  private createLegend(width: number): Array<NovaTemplateChildSchema> {
    if (!this.props.legend) {
      return []
    }
    const legendProps = this.resolveObjectOption<NovaChartLegendProps>(this.props.legend)
    return [{
      type: NovaCharts.Legend,
      id: `${this.componentId}:legend`,
      props: {
        ...(legendProps ?? {}),
      },
      layout: { width, height: '100%', flexShrink: 0 },
    }]
  }

  /**
   * Создает прозрачный layout spacer.
   */
  private createSpacer(id: string, width: number, height: number): NovaTemplateChildSchema {
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

  /**
   * Возвращает object props для boolean | object опций.
   */
  private resolveObjectOption<TOption>(value: boolean | TOption): TOption | null {
    return typeof value === 'object' && value !== null ? value : null
  }

  /**
   * Возвращает полный category domain.
   */
  private resolveCategoryDomain(): ChartScaleDomain {
    const seen = new Set<string>()
    const domain: Array<string> = []
    this.props.data.forEach((row, index) => {
      const category = String(readField(row, index, this.props.categoryField) ?? '')
      if (seen.has(category)) {
        return
      }
      seen.add(category)
      domain.push(category)
    })
    return domain
  }

  /**
   * Возвращает value-domain с учетом stacked mode.
   */
  private resolveValueDomain(): ChartScaleDomain {
    if (this.props.data.length === 0) {
      return [0, 1]
    }

    let min = 0
    let max = 0
    if (this.props.mode === 'stacked' && this.props.seriesField) {
      const totals = new Map<string, { positive: number, negative: number }>()
      this.props.data.forEach((row, index) => {
        const category = String(readField(row, index, this.props.categoryField) ?? '')
        const value = Number(readField(row, index, this.props.valueField))
        if (!Number.isFinite(value)) {
          return
        }
        const total = totals.get(category) ?? { positive: 0, negative: 0 }
        if (value >= 0) {
          total.positive += value
        }
        else { total.negative += value }
        totals.set(category, total)
      })
      for (const total of totals.values()) {
        max = Math.max(max, total.positive)
        min = Math.min(min, total.negative)
      }
    }
    else {
      this.props.data.forEach((row, index) => {
        const value = Number(readField(row, index, this.props.valueField))
        if (!Number.isFinite(value)) {
          return
        }
        max = Math.max(max, value)
        min = Math.min(min, value)
      })
    }

    if (min === max) {
      max = min + 1
    }
    return [min, max]
  }

  /**
   * Применяет layout rect к внутреннему root.
   */
  private applyChildrenRect(): void {
    const rect = {
      x: 0,
      y: 0,
      width: this.width,
      height: this.height,
    }
    for (const child of this.managedChildren) {
      applyChildRect(child, rect)
    }
  }

  /**
   * Dirty для внутреннего subtree.
   */
  private dirtyChildren(): void {
    for (const child of this.managedChildren) {
      dirtySubtree(child)
    }
  }

  private rootApi(): NovaChartRootApi<TData> | null {
    return this.nova.components.api<NovaChartRootApi<TData>>(`${this.componentId}:root`) ?? null
  }

  /**
   * Обрабатывает входящее событие ChartBarChart.
   */
  protected override onPropsChanged(changedKeys: Array<keyof NovaChartBarChartResolvedProps<TData>>): void {
    this.applyCommonPropsChanged(changedKeys)
    this.reconcile()
    this.dirty({ update: true, render: true })
  }
}

function readField<TData>(
  row: TData,
  index: number,
  field: NovaChartFieldAccessor<TData> | undefined,
): unknown {
  if (!field) {
    return undefined
  }
  if (typeof field === 'function') {
    return field(row, index)
  }
  return (row as Record<string, unknown>)[String(field)]
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
