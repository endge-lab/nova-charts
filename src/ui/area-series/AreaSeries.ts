import type { NovaApp, NovaSchema, NovaSurface } from '@endge/nova'
import type { EventList } from '@endge/utils'
import type { NovaChartRuntime } from '@/model/context/nova-chart-runtime'
import type {
  NovaChartAreaLayoutArea,
  NovaChartAreaLayoutPlan,
  NovaChartAreaLayoutPoint,
  NovaChartAreaSeriesApi,
  NovaChartAreaSeriesDiagnostics,
  NovaChartAreaSeriesProps,
  NovaChartAreaSeriesResolvedProps,
  NovaChartHitTestInput,
  NovaChartLineLayoutSegment,
  NovaChartPointContext,
  NovaChartPointSeriesVirtualizationOptions,
  NovaChartResolvedMarkStyle,
  NovaChartStyleContext,
} from '@/model/types/chart-components.types'
import type { ChartAreaSeriesDescriptor } from '@/ui/area-series/area-series.config'
import { NovaUiComponentNode } from '@endge/nova-ui-kit'
import {
  createAreaSeriesLayout,
  resolveAreaXDomain,
  resolveAreaYDomain,
} from '@/model/area/create-area-series-layout'
import { hitTestAreaLayoutPlan } from '@/model/area/hit-test-area-layout'
import { renderWithSlot, resolveVisualState } from '@/model/customization/chart-customization'
import {
  CHART_AREA_SERIES_NODE_DESCRIPTOR,

  normalizeChartAreaSeriesProps,
} from '@/ui/area-series/area-series.config'
import { publishChartMarkSemantics } from '@/ui/shared/chart-semantic-marks'
import { ChartSeriesRuntimeBinding } from '@/ui/shared/chart-series-runtime'

const EMPTY_DIAGNOSTICS: NovaChartAreaSeriesDiagnostics = {
  kind: 'area',
  inputRows: 0,
  visibleRows: 0,
  renderedPoints: 0,
  renderedSegments: 0,
  renderedAreas: 0,
  skippedRows: 0,
  seriesCount: 0,
  mode: 'direct',
  areaMode: 'single',
  domainMs: 0,
  layoutMs: 0,
  schemaMs: 0,
  totalMs: 0,
}

const EMPTY_LAYOUT_PLAN: NovaChartAreaLayoutPlan<any> = {
  points: [],
  segments: [],
  areas: [],
  series: [],
  diagnostics: EMPTY_DIAGNOSTICS,
}

/**
 * AreaSeries рендерит polygon fill и outline на shared cartesian scales.
 */
export class ChartAreaSeries<TData = Record<string, unknown>, E extends EventList = Record<string, any>>
  extends NovaUiComponentNode<NovaChartAreaSeriesResolvedProps<TData>, NovaChartAreaSeriesApi<TData>, NovaChartAreaSeriesProps<TData>, E> {
  private _layoutPlan: NovaChartAreaLayoutPlan<TData> = EMPTY_LAYOUT_PLAN
  private readonly _api: NovaChartAreaSeriesApi<TData>
  private readonly _runtimeBinding: ChartSeriesRuntimeBinding<TData>

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    props: NovaChartAreaSeriesResolvedProps<TData>,
    options: { componentId?: string } = {},
    descriptor: ChartAreaSeriesDescriptor<TData> = CHART_AREA_SERIES_NODE_DESCRIPTOR as ChartAreaSeriesDescriptor<TData>,
  ) {
    super(app, surface, descriptor, props, { componentId: options.componentId })
    this.options({ zIndex: 8 })
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

  override setProps(patch: Partial<NovaChartAreaSeriesResolvedProps<TData>>): this {
    return super.setProps(normalizeChartAreaSeriesProps({
      ...this.props,
      ...patch,
    } as NovaChartAreaSeriesProps<TData>) as Partial<NovaChartAreaSeriesResolvedProps<TData>>)
  }

  override getApi(): NovaChartAreaSeriesApi<TData> {
    return this._api
  }

  update(): void {
    this._computeLayout()
  }

  render(): void {
    const schemaStart = now()
    const runtime = this._runtimeBinding.runtime()
    const schema: NovaSchema = [] as unknown as NovaSchema
    for (const area of this._layoutPlan.areas) {
      const context = this._createAreaStyleContext(area, runtime)
      const style = this._resolveAreaStyle(area, context, runtime)
      renderWithSlot(
        schema,
        this.props.renderers?.areaFill,
        { ...context, style },
        {
          type: 'polygon',
          points: area.points,
          styles: {
            background: style.background ?? style.fill ?? this._resolveAreaFill(area.color),
            stroke: style.stroke ?? style.strokeColor ?? area.strokeColor,
            lineWidth: style.lineWidth ?? 0,
            opacity: style.opacity ?? this.props.opacity,
          },
        },
      )
    }

    for (const segment of this._layoutPlan.segments) {
      const context = this._createOutlineStyleContext(segment, runtime)
      const style = this._resolveOutlineStyle(segment, context, runtime)
      renderWithSlot(
        schema,
        this.props.renderers?.areaOutline,
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
            opacity: style.opacity ?? 1,
          },
        },
      )
    }

    if (this.props.markers.visible) {
      for (const point of this._layoutPlan.points) {
        const context = toPointContext(point)
        const styleContext = this._createMarkerStyleContext(point, runtime)
        const radius = Math.max(0, resolveNumberOption(this.props.markers.radius, context, 3))
        const fill = resolveStringOption(this.props.markers.fill, context) ?? point.color
        const strokeColor = resolveStringOption(this.props.markers.strokeColor, context) ?? '#ffffff'
        const style = this._resolveMarkerStyle(styleContext, runtime, {
          radius,
          fill,
          strokeColor,
        })
        renderWithSlot(
          schema,
          this.props.renderers?.areaMarker,
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
              opacity: style.opacity,
            },
          },
        )
      }
    }

    this._publishSchemaDiagnostics(schemaStart)
    if (schema.length > 0) {
      this.renderer.schema(schema)
    }
  }

  setVirtualization(options: NovaChartPointSeriesVirtualizationOptions): void {
    this.props.virtualization = {
      ...this.props.virtualization,
      ...options,
    }
    this._refresh()
  }

  protected override onMount(): void {
    super.onMount()
    this._runtimeBinding.syncInteractive()
  }

  protected override onUnmount(): void {
    this._runtimeBinding.cleanup()
    super.onUnmount()
  }

  protected override onPropsChanged(changedKeys: Array<keyof NovaChartAreaSeriesResolvedProps<TData>>): void {
    this.applyCommonPropsChanged(changedKeys)
    if (changedKeys.includes('chartRef')) {
      this._runtimeBinding.syncInteractive()
    }
    this._refresh()
  }

  private _hitTestSeries(input: NovaChartHitTestInput) {
    return hitTestAreaLayoutPlan(this.componentId, this._layoutPlan, {
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
      this._layoutPlan = {
        ...EMPTY_LAYOUT_PLAN,
        diagnostics: {
          ...EMPTY_DIAGNOSTICS,
          areaMode: this.props.mode,
        },
      }
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
        domain: resolveAreaXDomain(input),
      },
      {
        id: `${this.componentId}:y-domain`,
        scaleId: this.props.yScaleId,
        domain: resolveAreaYDomain(input),
      },
    ])
    this._layoutPlan = createAreaSeriesLayout(input)
    this._runtimeBinding.publishDiagnostics(runtime, this._layoutPlan.diagnostics)
    this._runtimeBinding.publishMetadata(runtime, this._layoutPlan.series.map(item => ({
      ...item,
      id: item.id === '__default' ? this.componentId : item.id,
      label: item.id === '__default' ? 'Area' : item.label,
      kind: 'area',
      sourceSeriesId: this.componentId,
      scaleIds: {
        x: this.props.xScaleId,
        y: this.props.yScaleId,
      },
    })))
    publishChartMarkSemantics(runtime, `${this.componentId}:marks`, this.componentId, 'area', this._layoutPlan.points.map(point => ({
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

  private _resolveAreaFill(seriesColor: string): string {
    if (typeof this.props.colors.fill === 'string') {
      return this.props.colors.fill
    }
    return this.props.fill === '#bfdbfe' ? seriesColor : this.props.fill
  }

  private _publishSchemaDiagnostics(schemaStart: number): void {
    const schemaMs = now() - schemaStart
    this._layoutPlan = {
      ...this._layoutPlan,
      diagnostics: {
        ...this._layoutPlan.diagnostics,
        schemaMs,
        totalMs: this._layoutPlan.diagnostics.domainMs + this._layoutPlan.diagnostics.layoutMs + schemaMs,
      },
    }
    const runtime = this._runtimeBinding.runtime()
    if (runtime) {
      this._runtimeBinding.publishDiagnostics(runtime, this._layoutPlan.diagnostics)
    }
  }

  private _createAreaStyleContext(
    area: NovaChartAreaLayoutArea,
    runtime: NovaChartRuntime<TData> | null,
  ): NovaChartStyleContext<TData, NovaChartAreaLayoutArea> {
    return {
      componentId: this.componentId,
      componentName: 'AreaSeries',
      part: 'areaFill',
      seriesKind: 'area',
      state: resolveVisualState(this.componentId, area.key, {
        hovered: runtime?.getInteractionState().hovered,
        attrs: this.props.attrs as Record<string, unknown> | undefined,
        disabled: this.props.disabled,
      }),
      geometry: area,
      tokens: runtime?.customization.tokens ?? {},
      scaleIds: { x: this.props.xScaleId, y: this.props.yScaleId },
      className: this.props.className,
      attrs: this.props.attrs as Record<string, unknown> | undefined,
    }
  }

  private _createOutlineStyleContext(
    segment: NovaChartLineLayoutSegment,
    runtime: NovaChartRuntime<TData> | null,
  ): NovaChartStyleContext<TData, NovaChartLineLayoutSegment> {
    return {
      componentId: this.componentId,
      componentName: 'AreaSeries',
      part: 'areaOutline',
      seriesKind: 'area',
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

  private _createMarkerStyleContext(
    point: NovaChartAreaLayoutPoint<TData>,
    runtime: NovaChartRuntime<TData> | null,
  ): NovaChartStyleContext<TData, NovaChartAreaLayoutPoint<TData>> {
    return {
      componentId: this.componentId,
      componentName: 'AreaSeries',
      part: 'areaMarker',
      datum: {
        seriesId: this.componentId,
        seriesKind: 'area',
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
      seriesKind: 'area',
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

  private _resolveAreaStyle(
    area: NovaChartAreaLayoutArea,
    context: NovaChartStyleContext<TData>,
    runtime: NovaChartRuntime<TData> | null,
  ): NovaChartResolvedMarkStyle {
    return runtime?.customization.resolveMarkStyle(context, {
      legacy: {
        background: this._resolveAreaFill(area.color),
        fill: this._resolveAreaFill(area.color),
        stroke: area.strokeColor,
        strokeColor: area.strokeColor,
        lineWidth: 0,
        opacity: this.props.opacity,
      },
      series: this.props.style,
      part: this.props.parts?.areaFill,
      state: this.props.states?.[context.state],
      datum: this.props.style?.datum?.(context),
    }) ?? {
      background: this._resolveAreaFill(area.color),
      stroke: area.strokeColor,
      opacity: this.props.opacity,
    }
  }

  private _resolveOutlineStyle(
    segment: NovaChartLineLayoutSegment,
    context: NovaChartStyleContext<TData>,
    runtime: NovaChartRuntime<TData> | null,
  ): NovaChartResolvedMarkStyle {
    return runtime?.customization.resolveMarkStyle(context, {
      legacy: {
        color: segment.color,
        stroke: segment.color,
        strokeWidth: this.props.strokeWidth,
        width: this.props.strokeWidth,
        opacity: 1,
      },
      series: this.props.style,
      part: this.props.parts?.areaOutline,
      state: this.props.states?.[context.state],
      datum: this.props.style?.datum?.(context),
    }) ?? {
      color: segment.color,
      strokeWidth: this.props.strokeWidth,
      opacity: 1,
    }
  }

  private _resolveMarkerStyle(
    context: NovaChartStyleContext<TData>,
    runtime: NovaChartRuntime<TData> | null,
    legacy: { radius: number, fill: string, strokeColor: string },
  ): NovaChartResolvedMarkStyle {
    return runtime?.customization.resolveMarkStyle(context, {
      legacy: {
        background: legacy.fill,
        fill: legacy.fill,
        strokeColor: legacy.strokeColor,
        strokeWidth: this.props.markers.strokeWidth,
        radius: legacy.radius,
      },
      series: this.props.style,
      part: this.props.parts?.areaMarker,
      state: this.props.states?.[context.state],
      datum: this.props.style?.datum?.(context),
    }) ?? legacy
  }
}

function toPointContext<TData>(
  point: NovaChartAreaLayoutPlan<TData>['points'][number],
): NovaChartPointContext<TData> {
  return {
    row: point.row,
    rowIndex: point.rowIndex,
    key: point.key,
    xValue: point.xValue,
    yValue: point.yValue,
    seriesKey: point.seriesKey,
    seriesLabel: point.seriesLabel,
  }
}

function resolveStringOption<TData>(
  value: string | ((context: any) => string) | undefined,
  context: NovaChartPointContext<TData>,
): string | undefined {
  return typeof value === 'function' ? value(context) : value
}

function resolveNumberOption<TData>(
  value: number | ((context: any) => number) | undefined,
  context: NovaChartPointContext<TData>,
  fallback: number,
): number {
  if (typeof value === 'function') {
    const resolved = Number(value(context))
    return Number.isFinite(resolved) ? resolved : fallback
  }
  return Number.isFinite(value) ? Number(value) : fallback
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}
