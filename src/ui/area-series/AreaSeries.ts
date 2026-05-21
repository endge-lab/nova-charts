import type { NovaApp, NovaSchema, NovaSurface } from '@endge/nova'
import type { EventList } from '@endge/utils'
import { NovaUiComponentNode } from '@endge/nova-ui-kit'
import {
  createAreaSeriesLayout,
  resolveAreaXDomain,
  resolveAreaYDomain,
} from '@/model/area/create-area-series-layout'
import { hitTestAreaLayoutPlan } from '@/model/area/hit-test-area-layout'
import { renderWithSlot, resolveVisualState } from '@/model/customization/chart-customization'
import { ChartSeriesRuntimeBinding } from '@/ui/shared/chart-series-runtime'
import { publishChartMarkSemantics } from '@/ui/shared/chart-semantic-marks'
import type { NovaChartRuntime } from '@/model/context/nova-chart-runtime'
import type {
  NovaChartAreaLayoutArea,
  NovaChartAreaLayoutPoint,
  NovaChartAreaLayoutPlan,
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
import {
  CHART_AREA_SERIES_NODE_DESCRIPTOR,
  normalizeChartAreaSeriesProps,
  type ChartAreaSeriesDescriptor,
} from '@/ui/area-series/area-series.config'

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
  private layoutPlan: NovaChartAreaLayoutPlan<TData> = EMPTY_LAYOUT_PLAN
  private readonly api: NovaChartAreaSeriesApi<TData>
  private readonly runtimeBinding: ChartSeriesRuntimeBinding<TData>

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    props: NovaChartAreaSeriesResolvedProps<TData>,
    options: { componentId?: string } = {},
    descriptor: ChartAreaSeriesDescriptor<TData> = CHART_AREA_SERIES_NODE_DESCRIPTOR as ChartAreaSeriesDescriptor<TData>,
  ) {
    super(app, surface, descriptor, props, { componentId: options.componentId })
    this.options({ zIndex: 8 })
    this.api = {
      getLayoutPlan: () => this.layoutPlan,
      getDiagnostics: () => this.layoutPlan.diagnostics,
      hitTest: input => this.hitTest(input),
      refresh: () => this.refresh(),
      setVirtualization: patch => this.setVirtualization(patch),
    }
    this.runtimeBinding = new ChartSeriesRuntimeBinding(this as any, {
      hitTest: input => this.hitTest(input),
    })
  }

  override setProps(patch: Partial<NovaChartAreaSeriesResolvedProps<TData>>): this {
    return super.setProps(normalizeChartAreaSeriesProps({
      ...this.props,
      ...patch,
    } as NovaChartAreaSeriesProps<TData>) as Partial<NovaChartAreaSeriesResolvedProps<TData>>)
  }

  override getApi(): NovaChartAreaSeriesApi<TData> {
    return this.api
  }

  update(): void {
    this.computeLayout()
  }

  render(): void {
    const schemaStart = now()
    const runtime = this.runtimeBinding.runtime()
    const schema: NovaSchema = [] as unknown as NovaSchema
    for (const area of this.layoutPlan.areas) {
      const context = this.createAreaStyleContext(area, runtime)
      const style = this.resolveAreaStyle(area, context, runtime)
      renderWithSlot(
        schema,
        this.props.renderers?.areaFill,
        { ...context, style },
        {
          type: 'polygon',
          points: area.points,
          styles: {
            background: style.background ?? style.fill ?? this.resolveAreaFill(area.color),
            stroke: style.stroke ?? style.strokeColor ?? area.strokeColor,
            lineWidth: style.lineWidth ?? 0,
            opacity: style.opacity ?? this.props.opacity,
          },
        },
      )
    }

    for (const segment of this.layoutPlan.segments) {
      const context = this.createOutlineStyleContext(segment, runtime)
      const style = this.resolveOutlineStyle(segment, context, runtime)
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
      for (const point of this.layoutPlan.points) {
        const context = toPointContext(point)
        const styleContext = this.createMarkerStyleContext(point, runtime)
        const radius = Math.max(0, resolveNumberOption(this.props.markers.radius, context, 3))
        const fill = resolveStringOption(this.props.markers.fill, context) ?? point.color
        const strokeColor = resolveStringOption(this.props.markers.strokeColor, context) ?? '#ffffff'
        const style = this.resolveMarkerStyle(styleContext, runtime, {
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

    this.publishSchemaDiagnostics(schemaStart)
    if (schema.length > 0) this.renderer.schema(schema)
  }

  setVirtualization(options: NovaChartPointSeriesVirtualizationOptions): void {
    this.props.virtualization = {
      ...this.props.virtualization,
      ...options,
    }
    this.refresh()
  }

  protected override onMount(): void {
    super.onMount()
    this.runtimeBinding.syncInteractive()
  }

  protected override onUnmount(): void {
    this.runtimeBinding.cleanup()
    super.onUnmount()
  }

  protected override onPropsChanged(changedKeys: Array<keyof NovaChartAreaSeriesResolvedProps<TData>>): void {
    this.applyCommonPropsChanged(changedKeys)
    if (changedKeys.includes('chartRef')) this.runtimeBinding.syncInteractive()
    this.refresh()
  }

  private hitTest(input: NovaChartHitTestInput) {
    return hitTestAreaLayoutPlan(this.componentId, this.layoutPlan, {
      ...input,
      maxDistancePx: input.maxDistancePx ?? this.props.hitRadiusPx,
    })
  }

  private refresh(): void {
    this.computeLayout()
    this.dirty({ update: true, render: true })
  }

  private computeLayout(): void {
    const runtime = this.runtimeBinding.runtime()
    const xScale = runtime?.getScale(this.props.xScaleId)
    const yScale = runtime?.getScale(this.props.yScaleId)
    if (!runtime || !xScale || !yScale) {
      this.layoutPlan = {
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
    this.runtimeBinding.publishContributions(runtime, [
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
    this.layoutPlan = createAreaSeriesLayout(input)
    this.runtimeBinding.publishDiagnostics(runtime, this.layoutPlan.diagnostics)
    this.runtimeBinding.publishMetadata(runtime, this.layoutPlan.series.map(item => ({
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
    publishChartMarkSemantics(runtime, `${this.componentId}:marks`, this.componentId, 'area', this.layoutPlan.points.map(point => ({
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

  private resolveAreaFill(seriesColor: string): string {
    if (typeof this.props.colors.fill === 'string') return this.props.colors.fill
    return this.props.fill === '#bfdbfe' ? seriesColor : this.props.fill
  }

  private publishSchemaDiagnostics(schemaStart: number): void {
    const schemaMs = now() - schemaStart
    this.layoutPlan = {
      ...this.layoutPlan,
      diagnostics: {
        ...this.layoutPlan.diagnostics,
        schemaMs,
        totalMs: this.layoutPlan.diagnostics.domainMs + this.layoutPlan.diagnostics.layoutMs + schemaMs,
      },
    }
    const runtime = this.runtimeBinding.runtime()
    if (runtime) this.runtimeBinding.publishDiagnostics(runtime, this.layoutPlan.diagnostics)
  }

  private createAreaStyleContext(
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

  private createOutlineStyleContext(
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

  private createMarkerStyleContext(
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

  private resolveAreaStyle(
    area: NovaChartAreaLayoutArea,
    context: NovaChartStyleContext<TData>,
    runtime: NovaChartRuntime<TData> | null,
  ): NovaChartResolvedMarkStyle {
    return runtime?.customization.resolveMarkStyle(context, {
      legacy: {
        background: this.resolveAreaFill(area.color),
        fill: this.resolveAreaFill(area.color),
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
      background: this.resolveAreaFill(area.color),
      stroke: area.strokeColor,
      opacity: this.props.opacity,
    }
  }

  private resolveOutlineStyle(
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

  private resolveMarkerStyle(
    context: NovaChartStyleContext<TData>,
    runtime: NovaChartRuntime<TData> | null,
    legacy: { radius: number; fill: string; strokeColor: string },
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
