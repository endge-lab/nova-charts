import type { NovaApp, NovaSchema, NovaSurface } from '@endge/nova'
import type { EventList } from '@endge/utils'
import type { NovaChartRuntime } from '@/model/context/nova-chart-runtime'
import type {
  NovaChartHitTestInput,
  NovaChartLineLayoutPlan,
  NovaChartLineLayoutPoint,
  NovaChartLineLayoutSegment,
  NovaChartLinePointContext,
  NovaChartLineSeriesApi,
  NovaChartLineSeriesDiagnostics,
  NovaChartLineSeriesProps,
  NovaChartLineSeriesResolvedProps,
  NovaChartLineVirtualizationOptions,
  NovaChartResolvedMarkStyle,
  NovaChartStyleContext,
} from '@/model/types/chart-components.types'
import type { ChartLineSeriesDescriptor } from '@/ui/line-series/line-series.config'
import { NovaUiComponentNode } from '@endge/nova-ui-kit'
import { renderWithSlot, resolveVisualState } from '@/model/customization/chart-customization'
import {
  createLineSeriesLayout,
  resolveLineXDomain,
  resolveLineYDomain,
} from '@/model/line/create-line-series-layout'
import { hitTestLineLayoutPlan } from '@/model/line/hit-test-line-layout'
import {
  CHART_LINE_SERIES_NODE_DESCRIPTOR,

  normalizeChartLineSeriesProps,
} from '@/ui/line-series/line-series.config'
import { publishChartMarkSemantics } from '@/ui/shared/chart-semantic-marks'
import { ChartSeriesRuntimeBinding } from '@/ui/shared/chart-series-runtime'

const EMPTY_DIAGNOSTICS: NovaChartLineSeriesDiagnostics = {
  kind: 'line',
  inputRows: 0,
  visibleRows: 0,
  renderedPoints: 0,
  renderedSegments: 0,
  skippedRows: 0,
  seriesCount: 0,
  mode: 'direct',
  domainMs: 0,
  layoutMs: 0,
  schemaMs: 0,
  totalMs: 0,
}

const EMPTY_LAYOUT_PLAN: NovaChartLineLayoutPlan<any> = {
  points: [],
  segments: [],
  series: [],
  diagnostics: EMPTY_DIAGNOSTICS,
}

/**
 * LineSeries рендерит line segments и optional markers на shared chart scales.
 */
export class ChartLineSeries<TData = Record<string, unknown>, E extends EventList = Record<string, any>>
  extends NovaUiComponentNode<NovaChartLineSeriesResolvedProps<TData>, NovaChartLineSeriesApi<TData>, NovaChartLineSeriesProps<TData>, E> {
  private _layoutPlan: NovaChartLineLayoutPlan<TData> = EMPTY_LAYOUT_PLAN
  private readonly _api: NovaChartLineSeriesApi<TData>
  private readonly _runtimeBinding: ChartSeriesRuntimeBinding<TData>

  /**
   * Создает экземпляр ChartLineSeries.
   */
  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    props: NovaChartLineSeriesResolvedProps<TData>,
    options: { componentId?: string } = {},
    descriptor: ChartLineSeriesDescriptor<TData> = CHART_LINE_SERIES_NODE_DESCRIPTOR as ChartLineSeriesDescriptor<TData>,
  ) {
    super(app, surface, descriptor, props, { componentId: options.componentId })
    this.options({ zIndex: 12 })
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
   * Обновляет props LineSeries.
   */
  override setProps(patch: Partial<NovaChartLineSeriesResolvedProps<TData>>): this {
    return super.setProps(normalizeChartLineSeriesProps({
      ...this.props,
      ...patch,
    } as NovaChartLineSeriesProps<TData>) as Partial<NovaChartLineSeriesResolvedProps<TData>>)
  }

  /**
   * Возвращает public API LineSeries.
   */
  override getApi(): NovaChartLineSeriesApi<TData> {
    return this._api
  }

  /**
   * Обновляет runtime-состояние LineSeries.
   */
  update(): void {
    this._computeLayout()
  }

  /**
   * Рендерит line segments и optional markers.
   */
  render(): void {
    const schemaStart = now()
    const runtime = this._runtimeBinding.runtime()
    const schema: NovaSchema = [] as unknown as NovaSchema
    for (const segment of this._layoutPlan.segments) {
      const context = this._createSegmentStyleContext(segment, runtime)
      const style = this._resolveLineStyle(context, runtime, segment.color)
      renderWithSlot(
        schema,
        this.props.renderers?.lineSegment,
        { ...context, style },
        {
          type: 'line',
          x1: segment.x1,
          y1: segment.y1,
          x2: segment.x2,
          y2: segment.y2,
          styles: {
            color: style.color ?? style.stroke ?? segment.color,
            width: style.width ?? style.strokeWidth ?? this.props.strokeWidth,
            opacity: style.opacity ?? this.props.opacity,
            dashPattern: style.dashPattern ?? this.props.dashPattern,
          },
        },
      )
    }

    if (this.props.markers.visible) {
      for (const point of this._layoutPlan.points) {
        const context: NovaChartLinePointContext<TData> = {
          row: point.row,
          rowIndex: point.rowIndex,
          key: point.key,
          xValue: point.xValue,
          yValue: point.yValue,
          seriesKey: point.seriesKey,
          seriesLabel: point.seriesLabel,
        }
        const fill = typeof this.props.markers.fill === 'function'
          ? this.props.markers.fill(context)
          : this.props.markers.fill ?? point.color
        const strokeColor = typeof this.props.markers.strokeColor === 'function'
          ? this.props.markers.strokeColor(context)
          : this.props.markers.strokeColor ?? '#ffffff'
        const radius = typeof this.props.markers.radius === 'function'
          ? this.props.markers.radius(context)
          : this.props.markers.radius ?? 3
        const styleContext = this._createPointStyleContext(point, runtime)
        const style = this._resolveMarkerStyle(styleContext, runtime, {
          fill,
          strokeColor,
          radius,
        })
        renderWithSlot(
          schema,
          this.props.renderers?.lineMarker,
          { ...styleContext, style },
          {
            type: 'circle',
            x: point.x,
            y: point.y,
            radius: Math.max(0, style.radius ?? radius),
            styles: {
              background: style.background ?? style.fill ?? fill,
              border: {
                color: style.strokeColor ?? style.stroke ?? strokeColor,
                width: style.strokeWidth ?? this.props.markers.strokeWidth,
              },
              opacity: style.opacity ?? this.props.opacity,
            },
          },
        )
      }
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
    if (runtime) {
      this._runtimeBinding.publishDiagnostics(runtime, this._layoutPlan.diagnostics)
    }
    if (schema.length > 0) {
      this.renderer.schema(schema)
    }
  }

  /**
   * Обновляет virtualization options.
   */
  setVirtualization(options: NovaChartLineVirtualizationOptions): void {
    this.props.virtualization = {
      ...this.props.virtualization,
      ...options,
    }
    this._refresh()
  }

  /**
   * Регистрирует interactive provider.
   */
  protected override onMount(): void {
    super.onMount()
    this._runtimeBinding.syncInteractive()
  }

  /**
   * Чистит runtime регистрации.
   */
  protected override onUnmount(): void {
    this._runtimeBinding.cleanup()
    super.onUnmount()
  }

  /**
   * Реагирует на изменение props.
   */
  protected override onPropsChanged(changedKeys: Array<keyof NovaChartLineSeriesResolvedProps<TData>>): void {
    this.applyCommonPropsChanged(changedKeys)
    if (changedKeys.includes('chartRef')) {
      this._runtimeBinding.syncInteractive()
    }
    this._refresh()
  }

  private _hitTestSeries(input: NovaChartHitTestInput) {
    return hitTestLineLayoutPlan(this.componentId, this._layoutPlan, {
      ...input,
      maxDistancePx: input.maxDistancePx ?? this.props.hitRadiusPx,
    })
  }

  private _refresh(): void {
    this._computeLayout()
    this.dirty({ update: true, render: true })
  }

  private _computeLayout(): void {
    const runtime = this._runtimeBinding.runtime()
    const xScale = runtime?.getScale(this.props.xScaleId)
    const yScale = runtime?.getScale(this.props.yScaleId)
    if (!runtime || !xScale || !yScale) {
      this._layoutPlan = EMPTY_LAYOUT_PLAN
      return
    }

    const input = {
      props: this.props,
      dataStore: runtime.dataStore,
      xScale,
      yScale,
      width: this.width,
      height: this.height,
    }
    this._runtimeBinding.publishContributions(runtime, [
      {
        id: `${this.componentId}:x-domain`,
        scaleId: this.props.xScaleId,
        domain: resolveLineXDomain(input),
      },
      {
        id: `${this.componentId}:y-domain`,
        scaleId: this.props.yScaleId,
        domain: resolveLineYDomain(input),
      },
    ])
    this._layoutPlan = createLineSeriesLayout(input)
    this._runtimeBinding.publishDiagnostics(runtime, this._layoutPlan.diagnostics)
    this._runtimeBinding.publishMetadata(runtime, this._layoutPlan.series.map(item => ({
      ...item,
      id: item.id === '__default' ? this.componentId : item.id,
      label: item.id === '__default' ? 'Line' : item.label,
      kind: 'line',
      sourceSeriesId: this.componentId,
      scaleIds: {
        x: this.props.xScaleId,
        y: this.props.yScaleId,
      },
    })))
    publishChartMarkSemantics(runtime, `${this.componentId}:marks`, this.componentId, 'line', this._layoutPlan.points.map(point => ({
      key: point.key,
      x: point.x,
      y: point.y,
      value: point.yValue,
      rawValue: point.rawValue,
      xValue: point.xValue,
      yValue: point.yValue,
      seriesKey: point.seriesKey,
      seriesLabel: point.seriesLabel,
      color: point.color,
    })))
  }

  private _createSegmentStyleContext(
    segment: NovaChartLineLayoutSegment,
    runtime: NovaChartRuntime<TData> | null,
  ): NovaChartStyleContext<TData, NovaChartLineLayoutSegment> {
    return {
      componentId: this.componentId,
      componentName: 'LineSeries',
      part: 'lineSegment',
      seriesKind: 'line',
      state: resolveVisualState(this.componentId, segment.key, {
        hovered: runtime?.getInteractionState().hovered,
        attrs: this.props.attrs as Record<string, unknown> | undefined,
        disabled: this.props.disabled,
      }),
      geometry: segment,
      tokens: runtime?.customization.tokens ?? {},
      scaleIds: { x: this.props.xScaleId, y: this.props.yScaleId },
      className: this.props.className,
      attrs: this.props.attrs as Record<string, unknown> | undefined,
    }
  }

  private _createPointStyleContext(
    point: NovaChartLineLayoutPoint<TData>,
    runtime: NovaChartRuntime<TData> | null,
  ): NovaChartStyleContext<TData, NovaChartLineLayoutPoint<TData>> {
    return {
      componentId: this.componentId,
      componentName: 'LineSeries',
      part: 'lineMarker',
      datum: {
        seriesId: this.componentId,
        seriesKind: 'line',
        key: point.key,
        mode: 'datum',
        row: point.row,
        value: point.yValue,
        rawValue: point.rawValue,
        xValue: point.xValue,
        yValue: point.yValue,
        seriesKey: point.seriesKey,
        seriesLabel: point.seriesLabel,
        color: point.color,
        point: { x: point.x, y: point.y },
        distancePx: 0,
      },
      row: point.row,
      rowIndex: point.rowIndex,
      seriesKind: 'line',
      state: resolveVisualState(this.componentId, point.key, {
        hovered: runtime?.getInteractionState().hovered,
        attrs: this.props.attrs as Record<string, unknown> | undefined,
        disabled: this.props.disabled,
      }),
      geometry: point,
      tokens: runtime?.customization.tokens ?? {},
      scaleIds: { x: this.props.xScaleId, y: this.props.yScaleId },
      className: this.props.className,
      attrs: this.props.attrs as Record<string, unknown> | undefined,
    }
  }

  private _resolveLineStyle(
    context: NovaChartStyleContext<TData>,
    runtime: NovaChartRuntime<TData> | null,
    color: string,
  ): NovaChartResolvedMarkStyle {
    const datumStyle = this.props.style?.datum?.(context)
    return runtime?.customization.resolveMarkStyle(context, {
      legacy: {
        color,
        stroke: color,
        strokeWidth: this.props.strokeWidth,
        width: this.props.strokeWidth,
        opacity: this.props.opacity,
        dashPattern: this.props.dashPattern,
      },
      series: this.props.style,
      part: this.props.parts?.lineSegment,
      state: this.props.states?.[context.state],
      datum: datumStyle,
    }) ?? {
      color,
      strokeWidth: this.props.strokeWidth,
      opacity: this.props.opacity,
      dashPattern: this.props.dashPattern,
    }
  }

  private _resolveMarkerStyle(
    context: NovaChartStyleContext<TData>,
    runtime: NovaChartRuntime<TData> | null,
    legacy: { fill: string, strokeColor: string, radius: number },
  ): NovaChartResolvedMarkStyle {
    const datumStyle = this.props.style?.datum?.(context)
    return runtime?.customization.resolveMarkStyle(context, {
      legacy: {
        background: legacy.fill,
        fill: legacy.fill,
        strokeColor: legacy.strokeColor,
        strokeWidth: this.props.markers.strokeWidth,
        radius: legacy.radius,
        opacity: this.props.opacity,
      },
      series: this.props.style,
      part: this.props.parts?.lineMarker,
      state: this.props.states?.[context.state],
      datum: datumStyle,
    }) ?? legacy
  }
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}
