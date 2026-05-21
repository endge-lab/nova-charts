import type { NovaApp, NovaSchema, NovaSurface } from '@endge/nova'
import type { EventList } from '@endge/utils'
import { NovaUiComponentNode } from '@endge/nova-ui-kit'
import {
  createBubbleSeriesLayout,
  resolveBubbleXDomain,
  resolveBubbleYDomain,
} from '@/model/bubble/create-bubble-series-layout'
import { hitTestBubbleLayoutPlan } from '@/model/bubble/hit-test-bubble-layout'
import { renderWithSlot, resolveVisualState } from '@/model/customization/chart-customization'
import { ChartSeriesRuntimeBinding } from '@/ui/shared/chart-series-runtime'
import { publishChartMarkSemantics } from '@/ui/shared/chart-semantic-marks'
import type { NovaChartRuntime } from '@/model/context/nova-chart-runtime'
import type {
  NovaChartBubbleLayoutPoint,
  NovaChartBubbleLayoutPlan,
  NovaChartBubbleSeriesApi,
  NovaChartBubbleSeriesDiagnostics,
  NovaChartBubbleSeriesProps,
  NovaChartBubbleSeriesResolvedProps,
  NovaChartDatumRef,
  NovaChartHitTestInput,
  NovaChartPointSeriesVirtualizationOptions,
  NovaChartResolvedMarkStyle,
  NovaChartStyleContext,
} from '@/model/types/chart-components.types'
import {
  CHART_BUBBLE_SERIES_NODE_DESCRIPTOR,
  normalizeChartBubbleSeriesProps,
  type ChartBubbleSeriesDescriptor,
} from '@/ui/bubble-series/bubble-series.config'

const EMPTY_DIAGNOSTICS: NovaChartBubbleSeriesDiagnostics = {
  kind: 'bubble',
  inputRows: 0,
  visibleRows: 0,
  renderedBubbles: 0,
  skippedRows: 0,
  seriesCount: 0,
  mode: 'direct',
  domainMs: 0,
  layoutMs: 0,
  schemaMs: 0,
  totalMs: 0,
}

const EMPTY_LAYOUT_PLAN: NovaChartBubbleLayoutPlan<any> = {
  points: [],
  series: [],
  sizeDomain: [0, 1],
  diagnostics: EMPTY_DIAGNOSTICS,
}

/**
 * BubbleSeries расширяет scatter semantics sizeField-driven радиусом.
 */
export class ChartBubbleSeries<TData = Record<string, unknown>, E extends EventList = Record<string, any>>
  extends NovaUiComponentNode<NovaChartBubbleSeriesResolvedProps<TData>, NovaChartBubbleSeriesApi<TData>, NovaChartBubbleSeriesProps<TData>, E> {
  private layoutPlan: NovaChartBubbleLayoutPlan<TData> = EMPTY_LAYOUT_PLAN
  private readonly api: NovaChartBubbleSeriesApi<TData>
  private readonly runtimeBinding: ChartSeriesRuntimeBinding<TData>

  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    props: NovaChartBubbleSeriesResolvedProps<TData>,
    options: { componentId?: string } = {},
    descriptor: ChartBubbleSeriesDescriptor<TData> = CHART_BUBBLE_SERIES_NODE_DESCRIPTOR as ChartBubbleSeriesDescriptor<TData>,
  ) {
    super(app, surface, descriptor, props, { componentId: options.componentId })
    this.options({ zIndex: 15 })
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

  override setProps(patch: Partial<NovaChartBubbleSeriesResolvedProps<TData>>): this {
    return super.setProps(normalizeChartBubbleSeriesProps({
      ...this.props,
      ...patch,
    } as NovaChartBubbleSeriesProps<TData>) as Partial<NovaChartBubbleSeriesResolvedProps<TData>>)
  }

  override getApi(): NovaChartBubbleSeriesApi<TData> {
    return this.api
  }

  update(): void {
    this.computeLayout()
  }

  render(): void {
    const schemaStart = now()
    const runtime = this.runtimeBinding.runtime()
    const schema: NovaSchema = [] as unknown as NovaSchema
    for (const point of this.layoutPlan.points) {
      const context = this.createPointStyleContext(point, runtime)
      const style = this.resolveBubbleStyle(point, context, runtime)
      renderWithSlot(
        schema,
        this.props.renderers?.bubble,
        { ...context, style },
        {
        type: 'circle',
        x: point.x,
        y: point.y,
          radius: Math.max(0, style.radius ?? point.radius),
        styles: {
            background: style.background ?? style.fill ?? point.color,
          border: {
              color: style.strokeColor ?? style.stroke ?? point.strokeColor,
              width: style.strokeWidth ?? point.strokeWidth,
          },
            opacity: style.opacity ?? point.opacity,
        },
        },
      )
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

  protected override onPropsChanged(changedKeys: Array<keyof NovaChartBubbleSeriesResolvedProps<TData>>): void {
    this.applyCommonPropsChanged(changedKeys)
    if (changedKeys.includes('chartRef')) this.runtimeBinding.syncInteractive()
    this.refresh()
  }

  private hitTest(input: NovaChartHitTestInput) {
    return hitTestBubbleLayoutPlan(this.componentId, this.layoutPlan, {
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
      this.layoutPlan = EMPTY_LAYOUT_PLAN
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
        domain: resolveBubbleXDomain(input),
      },
      {
        id: `${this.componentId}:y-domain`,
        scaleId: this.props.yScaleId,
        domain: resolveBubbleYDomain(input),
      },
    ])
    this.layoutPlan = createBubbleSeriesLayout(input)
    this.runtimeBinding.publishDiagnostics(runtime, this.layoutPlan.diagnostics)
    this.runtimeBinding.publishMetadata(runtime, this.layoutPlan.series.map(item => ({
      ...item,
      id: item.id === '__default' ? this.componentId : item.id,
      label: item.id === '__default' ? 'Bubble' : item.label,
      kind: 'bubble',
      sourceSeriesId: this.componentId,
      scaleIds: {
        x: this.props.xScaleId,
        y: this.props.yScaleId,
      },
    })))
    publishChartMarkSemantics(runtime, `${this.componentId}:marks`, this.componentId, 'bubble', this.layoutPlan.points.map(point => ({
      key: point.key,
      x: point.x,
      y: point.y,
      radius: point.radius,
      value: point.yValue,
      rawValue: point.rawValue,
      xValue: point.xValue,
      yValue: point.yValue,
      seriesKey: point.seriesKey,
      seriesLabel: point.seriesLabel,
      color: point.color,
    })))
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

  private isPointHighlighted(
    key: string,
    hovered: NovaChartDatumRef<TData> | null | undefined,
  ): boolean {
    return this.props.highlight.enabled
      && hovered?.seriesId === this.componentId
      && hovered.key === key
  }

  private createPointStyleContext(
    point: NovaChartBubbleLayoutPoint<TData>,
    runtime: NovaChartRuntime<TData> | null,
  ): NovaChartStyleContext<TData, NovaChartBubbleLayoutPoint<TData>> {
    return {
      componentId: this.componentId,
      componentName: 'BubbleSeries',
      part: 'bubble',
      datum: {
        seriesId: this.componentId,
        seriesKind: 'bubble',
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
      seriesKind: 'bubble',
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

  private resolveBubbleStyle(
    point: NovaChartBubbleLayoutPoint<TData>,
    context: NovaChartStyleContext<TData>,
    runtime: NovaChartRuntime<TData> | null,
  ): NovaChartResolvedMarkStyle {
    const highlighted = this.isPointHighlighted(point.key, runtime?.getInteractionState().hovered)
    const stateStyle = {
      ...(this.props.states?.[context.state] ?? {}),
      ...(highlighted ? {
        background: this.props.highlight.fill,
        fill: this.props.highlight.fill,
        opacity: this.props.highlight.opacity,
        radius: point.radius + this.props.highlight.radiusDelta,
        strokeColor: this.props.highlight.strokeColor,
        strokeWidth: this.props.highlight.strokeWidth,
      } : {}),
    }
    const datumStyle = this.props.style?.datum?.(context)
    return runtime?.customization.resolveMarkStyle(context, {
      legacy: {
        background: point.color,
        fill: point.color,
        strokeColor: point.strokeColor,
        strokeWidth: point.strokeWidth,
        opacity: point.opacity,
        radius: point.radius,
      },
      series: this.props.style,
      part: this.props.parts?.bubble,
      state: stateStyle,
      datum: datumStyle,
    }) ?? {
      background: highlighted ? this.props.highlight.fill : point.color,
      strokeColor: highlighted ? this.props.highlight.strokeColor : point.strokeColor,
      strokeWidth: highlighted ? this.props.highlight.strokeWidth : point.strokeWidth,
      opacity: highlighted ? this.props.highlight.opacity : point.opacity,
      radius: highlighted ? point.radius + this.props.highlight.radiusDelta : point.radius,
    }
  }
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}
