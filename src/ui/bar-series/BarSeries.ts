import type { NovaApp, NovaSchema, NovaSchemaItem, NovaSurface } from '@endge/nova'
import type { EventList } from '@endge/utils'
import type { NovaChartRuntime } from '@/model/context/nova-chart-runtime'
import type {
  NovaChartBarLayoutPlan,
  NovaChartBarSeriesApi,
  NovaChartBarSeriesDiagnostics,
  NovaChartBarSeriesProps,
  NovaChartBarSeriesResolvedProps,
  NovaChartBarVirtualizationOptions,
  NovaChartDatumRef,
  NovaChartHitTestInput,
  NovaChartResolvedMarkStyle,
  NovaChartStyleContext,
} from '@/model/types/chart-components.types'
import type { ChartScaleDomain } from '@/model/types/chart-scale.types'
import type { ChartBarSeriesDescriptor } from '@/ui/bar-series/bar-series.config'
import { NovaUiComponentNode } from '@endge/nova-ui-kit'
import { createBarSeriesLayout } from '@/model/bar/create-bar-series-layout'
import { hitTestBarLayoutPlan } from '@/model/bar/hit-test-bar-layout'
import { appendSchema, renderWithSlot, resolveVisualState } from '@/model/customization/chart-customization'
import {
  CHART_BAR_SERIES_NODE_DESCRIPTOR,

  normalizeChartBarSeriesProps,
} from '@/ui/bar-series/bar-series.config'
import { resolveNovaChartRuntime } from '@/ui/shared/chart-runtime-resolver'
import { publishChartMarkSemantics } from '@/ui/shared/chart-semantic-marks'
import { ChartSeriesRuntimeBinding } from '@/ui/shared/chart-series-runtime'

const EMPTY_DIAGNOSTICS: NovaChartBarSeriesDiagnostics = {
  kind: 'bar',
  inputRows: 0,
  visibleRows: 0,
  renderedBars: 0,
  aggregatedBuckets: 0,
  mode: 'direct',
  domainMs: 0,
  layoutMs: 0,
  schemaMs: 0,
  totalMs: 0,
}

const EMPTY_LAYOUT_PLAN: NovaChartBarLayoutPlan<any> = {
  items: [],
  orientation: 'vertical',
  mode: 'single',
  categories: [],
  series: [],
  diagnostics: EMPTY_DIAGNOSTICS,
}

/**
 * Bar series строит bounded render schema и не рендерит весь миллион строк.
 */
export class ChartBarSeries<TData = Record<string, unknown>, E extends EventList = Record<string, any>>
  extends NovaUiComponentNode<NovaChartBarSeriesResolvedProps<TData>, NovaChartBarSeriesApi<TData>, NovaChartBarSeriesProps<TData>, E> {
  private _layoutPlan: NovaChartBarLayoutPlan<TData> = EMPTY_LAYOUT_PLAN
  private readonly _api: NovaChartBarSeriesApi<TData>
  private readonly _runtimeBinding: ChartSeriesRuntimeBinding<TData>

  /**
   * Создает экземпляр ChartBarSeries и подготавливает базовое состояние.
   */
  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    props: NovaChartBarSeriesResolvedProps<TData>,
    options: { componentId?: string } = {},
    descriptor: ChartBarSeriesDescriptor<TData> = CHART_BAR_SERIES_NODE_DESCRIPTOR as ChartBarSeriesDescriptor<TData>,
  ) {
    super(app, surface, descriptor, props, { componentId: options.componentId })
    this.options({ zIndex: 10 })
    this._api = {
      getLayoutPlan: () => this._layoutPlan,
      getDiagnostics: () => this._layoutPlan.diagnostics,
      hitTest: input => this._hitTestSeries(input),
      refresh: () => this._refresh(),
      setVirtualization: patch => this.setVirtualization(patch),
    }
    this._runtimeBinding = new ChartSeriesRuntimeBinding(this as any, {
      hitTest: input => this._hitTestSeries(input),
    })
  }

  /**
   * Обновляет значение состояния ChartBarSeries.
   */
  override setProps(patch: Partial<NovaChartBarSeriesResolvedProps<TData>>): this {
    return super.setProps(normalizeChartBarSeriesProps({
      ...this.props,
      ...patch,
    } as NovaChartBarSeriesProps<TData>) as Partial<NovaChartBarSeriesResolvedProps<TData>>)
  }

  /**
   * Возвращает значение состояния ChartBarSeries.
   */
  override getApi(): NovaChartBarSeriesApi<TData> {
    return this._api
  }

  /**
   * Обновляет runtime-состояние ChartBarSeries.
   */
  update(): void {
    this._computeLayout()
  }

  /**
   * Выполняет отрисовку ChartBarSeries.
   */
  render(): void {
    const schemaStart = now()
    const runtime = resolveNovaChartRuntime<TData>(this, this.props.chartRef)
    const schema: NovaSchema = [] as unknown as NovaSchema
    for (const item of this._layoutPlan.items) {
      const context = this._createStyleContext('bar', item, runtime)
      const style = this._resolveBarStyle(item, context, runtime)
      renderWithSlot(
        schema,
        this.props.renderers?.bar,
        { ...context, style },
        {
          type: 'rect',
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          styles: {
            background: style.background ?? style.fill ?? item.color ?? this.props.fill,
            opacity: style.opacity ?? this.props.opacity,
            border: style.strokeWidth && style.strokeWidth > 0
              ? {
                  color: style.strokeColor ?? style.stroke,
                  width: style.strokeWidth,
                  radius: style.borderRadius ?? style.radius ?? this.props.radius,
                }
              : style.borderRadius !== undefined || style.radius !== undefined
                ? { radius: style.borderRadius ?? style.radius }
                : undefined,
          },
        },
      )
    }

    const schemaMs = now() - schemaStart
    this._layoutPlan = {
      ...this._layoutPlan,
      diagnostics: {
        ...this._layoutPlan.diagnostics,
        schemaMs,
        totalMs: this._layoutPlan.diagnostics.domainMs + this._layoutPlan.diagnostics.layoutMs + schemaMs,
      },
    }
    this._publishDiagnostics()
    if (schema.length > 0) {
      this.renderer.schema(schema)
    }
    this._renderLabels(runtime)
  }

  /**
   * Обновляет значение состояния ChartBarSeries.
   */
  setVirtualization(options: NovaChartBarVirtualizationOptions): void {
    this.props.virtualization = {
      ...this.props.virtualization,
      ...options,
    }
    this._refresh()
  }

  /**
   * Обрабатывает входящее событие ChartBarSeries.
   */
  protected override onMount(): void {
    super.onMount()
    this._runtimeBinding.syncInteractive()
  }

  /**
   * Обрабатывает входящее событие ChartBarSeries.
   */
  protected override onUnmount(): void {
    this._runtimeBinding.cleanup()
    super.onUnmount()
  }

  /**
   * Обрабатывает входящее событие ChartBarSeries.
   */
  protected override onPropsChanged(changedKeys: Array<keyof NovaChartBarSeriesResolvedProps<TData>>): void {
    this.applyCommonPropsChanged(changedKeys)
    if (changedKeys.includes('chartRef')) {
      this._runtimeBinding.syncInteractive()
    }
    this._refresh()
  }

  /**
   * Выполняет hit-test для runtime-геометрии ChartBarSeries.
   */
  private _hitTestSeries(input: NovaChartHitTestInput) {
    return hitTestBarLayoutPlan(this.componentId, this._layoutPlan, input)
  }

  /**
   * Синхронизирует актуальное состояние ChartBarSeries.
   */
  private _refresh(): void {
    this._computeLayout()
    this.dirty({ update: true, render: true })
  }

  /**
   * Вычисляет производное значение ChartBarSeries.
   */
  private _computeLayout(): void {
    const runtime = resolveNovaChartRuntime<TData>(this, this.props.chartRef)
    const xScale = runtime?.getScale(this.props.xScaleId)
    const yScale = runtime?.getScale(this.props.yScaleId)
    if (!runtime || !xScale || !yScale) {
      this._layoutPlan = {
        ...EMPTY_LAYOUT_PLAN,
        orientation: this.props.orientation,
        mode: this.props.mode,
      }
      return
    }

    this._publishDomainContributions(runtime)
    this._layoutPlan = createBarSeriesLayout({
      props: this.props,
      dataStore: runtime.dataStore,
      xScale,
      yScale,
      width: this.width,
      height: this.height,
    })
    this._publishDiagnostics()
    runtime.setSeriesMetadata(this.componentId, this._layoutPlan.series.map(item => ({
      ...item,
      kind: 'bar',
      sourceSeriesId: this.componentId,
      scaleIds: {
        x: this.props.xScaleId,
        y: this.props.yScaleId,
      },
    })))
    publishChartMarkSemantics(runtime, `${this.componentId}:marks`, this.componentId, 'bar', this._layoutPlan.items.map(item => ({
      key: item.key,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      value: item.value,
      rawValue: item.rawValue,
      category: item.category,
      seriesKey: item.seriesKey,
      seriesLabel: item.seriesLabel,
      color: item.color,
    })))
  }

  /**
   * Публикует вклад BarSeries в shared scale source domains.
   */
  private _publishDomainContributions(runtime: NovaChartRuntime<TData>): void {
    this._runtimeBinding.publishContributions(runtime, [
      {
        id: this._categoryContributionId,
        scaleId: this._categoryScaleId,
        domain: this._resolveCategoryDomain(runtime),
      },
      {
        id: this._valueContributionId,
        scaleId: this._valueScaleId,
        domain: this._resolveValueDomain(runtime),
      },
    ])
  }

  /**
   * Возвращает полный category domain этой series.
   */
  private _resolveCategoryDomain(runtime: NovaChartRuntime<TData>): ChartScaleDomain {
    return [...runtime.dataStore.categoryDomain(this.props.categoryField)] as ChartScaleDomain
  }

  /**
   * Возвращает полный value domain этой series с учетом stacked totals.
   */
  private _resolveValueDomain(runtime: NovaChartRuntime<TData>): ChartScaleDomain {
    const rows = runtime.dataStore.getData()
    if (rows.length === 0) {
      return [0, 1]
    }

    if (this.props.mode === 'stacked') {
      const totals = new Map<string, { positive: number, negative: number }>()
      rows.forEach((row, rowIndex) => {
        const category = String(runtime.dataStore.readField(row, rowIndex, this.props.categoryField) ?? '')
        const value = Number(runtime.dataStore.readField(row, rowIndex, this.props.valueField))
        if (!Number.isFinite(value)) {
          return
        }
        let total = totals.get(category)
        if (!total) {
          total = { positive: 0, negative: 0 }
          totals.set(category, total)
        }
        if (value >= 0) {
          total.positive += value
        }
        else { total.negative += value }
      })
      const values = Array.from(totals.values()).flatMap(total => [total.negative, total.positive])
      return extentDomain(values)
    }

    const values = rows.map((row, rowIndex) => Number(runtime.dataStore.readField(row, rowIndex, this.props.valueField)))
    return extentDomain(values)
  }

  /**
   * Возвращает scale id, на котором лежит category axis.
   */
  private get _categoryScaleId(): string {
    return this.props.orientation === 'horizontal' ? this.props.yScaleId : this.props.xScaleId
  }

  /**
   * Возвращает scale id, на котором лежит value axis.
   */
  private get _valueScaleId(): string {
    return this.props.orientation === 'horizontal' ? this.props.xScaleId : this.props.yScaleId
  }

  private get _categoryContributionId(): string {
    return `${this.componentId}:category-domain`
  }

  private get _valueContributionId(): string {
    return `${this.componentId}:value-domain`
  }

  /**
   * Выполняет внутренний шаг publishDiagnostics для ChartBarSeries.
   */
  private _publishDiagnostics(): void {
    const runtime = resolveNovaChartRuntime<TData>(this, this.props.chartRef)
    if (runtime) {
      this._runtimeBinding.publishDiagnostics(runtime, this._layoutPlan.diagnostics)
    }
  }

  /**
   * Выполняет внутренний шаг isItemHighlighted для ChartBarSeries.
   */
  private _isItemHighlighted(
    key: string,
    hovered: NovaChartDatumRef<TData> | null | undefined,
  ): boolean {
    return this.props.highlight.enabled
      && hovered?.seriesId === this.componentId
      && hovered.key === key
  }

  /**
   * Рисует подписи баров поверх bounded schema.
   */
  private _renderLabels(runtime: NovaChartRuntime<TData> | null | undefined): void {
    if (!this.props.labels.visible) {
      return
    }

    for (const item of this._layoutPlan.items) {
      if (!item.labelText) {
        continue
      }
      const rect = resolveLabelRect(this.props.orientation, this.props.labels.position, item)
      const context = this._createStyleContext('barLabel', item, runtime)
      const style = this._resolveLabelStyle(context, runtime)
      const defaultSchema: NovaSchemaItem = {
        type: 'text' as const,
        text: item.labelText,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        styles: {
          color: style.color ?? this.props.labels.color,
          font: {
            family: style.fontFamily ?? this.props.fontFamily ?? 'Inter, Arial, sans-serif',
            size: style.fontSize ?? this.props.labels.fontSize,
            weight: String(style.fontWeight ?? this.props.labels.fontWeight) as any,
          },
          lineHeight: style.lineHeight,
          opacity: style.opacity,
          align: {
            horizontal: rect.align,
            vertical: 'middle' as const,
          },
          ellipsis: true,
        },
        meta: {
          textRole: 'ui-label',
          textMode: 'run-atlas',
          textLod: 'always',
        },
      }

      if (this.props.renderers?.barLabel) {
        const schema: NovaSchema = [] as unknown as NovaSchema
        const output = this.props.renderers.barLabel({ ...context, style, defaultSchema })
        if (output !== null) {
          appendSchema(schema, output ?? defaultSchema)
        }
        if (schema.length > 0) {
          this.renderer.schema(schema)
        }
      }
      else {
        this.renderer.text(defaultSchema)
      }
    }
  }

  private _createStyleContext(
    part: string,
    item: NovaChartBarLayoutPlan<TData>['items'][number],
    runtime: NovaChartRuntime<TData> | null | undefined,
  ): NovaChartStyleContext<TData, typeof item> {
    const hovered = runtime?.getInteractionState().hovered
    const state = resolveVisualState(this.componentId, item.key, {
      hovered,
      attrs: this.props.attrs as Record<string, unknown> | undefined,
      disabled: this.props.disabled,
    })
    return {
      componentId: this.componentId,
      componentName: 'BarSeries',
      part,
      datum: {
        seriesId: this.componentId,
        seriesKind: 'bar',
        key: item.key,
        mode: 'datum',
        row: item.row,
        value: item.value,
        rawValue: item.rawValue,
        category: item.category,
        seriesKey: item.seriesKey,
        seriesLabel: item.seriesLabel,
        color: item.color,
        bounds: { x: item.x, y: item.y, width: item.width, height: item.height },
        distancePx: 0,
      },
      row: item.row,
      seriesKind: 'bar',
      state,
      geometry: item,
      tokens: runtime?.customization.tokens ?? {},
      scaleIds: { x: this.props.xScaleId, y: this.props.yScaleId },
      className: this.props.className,
      attrs: this.props.attrs as Record<string, unknown> | undefined,
    }
  }

  private _resolveBarStyle(
    item: NovaChartBarLayoutPlan<TData>['items'][number],
    context: NovaChartStyleContext<TData, typeof item>,
    runtime: NovaChartRuntime<TData> | null | undefined,
  ): NovaChartResolvedMarkStyle {
    const highlighted = this._isItemHighlighted(item.key, runtime?.getInteractionState().hovered)
    const stateStyle = {
      ...(this.props.states?.[context.state] ?? {}),
      ...(highlighted
        ? {
            background: this.props.highlight.fill,
            fill: this.props.highlight.fill,
            opacity: this.props.highlight.opacity,
            strokeColor: this.props.highlight.strokeColor,
            strokeWidth: this.props.highlight.strokeWidth,
          }
        : {}),
    }
    const datumStyle = this.props.style?.datum?.(context as NovaChartStyleContext<TData>)
    return runtime?.customization.resolveMarkStyle(context, {
      legacy: {
        background: item.color ?? this.props.fill,
        fill: item.color ?? this.props.fill,
        opacity: this.props.opacity,
        radius: this.props.radius,
        borderRadius: this.props.radius,
      },
      series: this.props.style,
      part: this.props.parts?.bar,
      state: stateStyle,
      datum: datumStyle,
    }) ?? {
      background: highlighted ? this.props.highlight.fill : item.color ?? this.props.fill,
      opacity: highlighted ? this.props.highlight.opacity : this.props.opacity,
      strokeColor: highlighted ? this.props.highlight.strokeColor : undefined,
      strokeWidth: highlighted ? this.props.highlight.strokeWidth : 0,
      borderRadius: this.props.radius,
    }
  }

  private _resolveLabelStyle(
    context: NovaChartStyleContext<TData>,
    runtime: NovaChartRuntime<TData> | null | undefined,
  ): NovaChartResolvedMarkStyle {
    return runtime?.customization.resolveMarkStyle(context, {
      legacy: {
        color: this.props.labels.color,
        fontFamily: this.props.fontFamily,
        fontSize: this.props.labels.fontSize,
        fontWeight: String(this.props.labels.fontWeight),
      },
      part: this.props.parts?.barLabel,
      state: this.props.states?.[context.state],
    }) ?? {
      color: this.props.labels.color,
      fontSize: this.props.labels.fontSize,
      fontWeight: String(this.props.labels.fontWeight),
    }
  }
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function extentDomain(values: Array<number>): ChartScaleDomain {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const value of values) {
    if (!Number.isFinite(value)) {
      continue
    }
    if (value < min) {
      min = value
    }
    if (value > max) {
      max = value
    }
  }
  return min === Number.POSITIVE_INFINITY ? [0, 1] : [min, max]
}

function resolveLabelRect(
  orientation: NovaChartBarSeriesResolvedProps['orientation'],
  position: NovaChartBarSeriesResolvedProps['labels']['position'],
  item: NovaChartBarLayoutPlan<any>['items'][number],
): { x: number, y: number, width: number, height: number, align: 'left' | 'center' | 'right' } {
  const height = 16
  if (orientation === 'horizontal') {
    if (position === 'inside' || position === 'end') {
      return {
        x: item.x + 4,
        y: item.y + (item.height - height) / 2,
        width: Math.max(1, item.width - 8),
        height,
        align: 'right',
      }
    }
    if (position === 'center') {
      return {
        x: item.x,
        y: item.y + (item.height - height) / 2,
        width: Math.max(1, item.width),
        height,
        align: 'center',
      }
    }
    return {
      x: item.x + item.width + 4,
      y: item.y + (item.height - height) / 2,
      width: 72,
      height,
      align: 'left',
    }
  }

  if (position === 'inside' || position === 'end') {
    return {
      x: item.x,
      y: item.y + 2,
      width: item.width,
      height,
      align: 'center',
    }
  }
  if (position === 'center') {
    return {
      x: item.x,
      y: item.y + item.height / 2 - height / 2,
      width: item.width,
      height,
      align: 'center',
    }
  }
  return {
    x: item.x - 12,
    y: item.y - height - 2,
    width: item.width + 24,
    height,
    align: 'center',
  }
}
