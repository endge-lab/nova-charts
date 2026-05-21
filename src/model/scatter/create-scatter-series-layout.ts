import type { ChartDataStore } from '@/model/data/ChartDataStore'
import type {
  ChartScale,
  ChartScaleDomain,
  ChartScaleValue,
} from '@/model/types/chart-scale.types'
import {
  createCartesianPointCandidates,
  createCartesianSeriesMetadata,
  resolveCartesianXDomain,
  resolveCartesianYDomain,
  windowCartesianPointCandidates,
} from '@/model/cartesian/point-series'
import type {
  NovaChartPointContext,
  NovaChartScatterLayoutPlan,
  NovaChartScatterLayoutPoint,
  NovaChartScatterSeriesDiagnostics,
  NovaChartScatterSeriesResolvedProps,
} from '@/model/types/chart-components.types'

export interface NovaChartScatterLayoutInput<TData = Record<string, unknown>> {
  props: NovaChartScatterSeriesResolvedProps<TData>
  dataStore: ChartDataStore<TData>
  xScale: ChartScale<ChartScaleValue>
  yScale: ChartScale<ChartScaleValue>
  width: number
  height: number
}

/**
 * Строит bounded point geometry для ScatterSeries.
 */
export function createScatterSeriesLayout<TData>(
  input: NovaChartScatterLayoutInput<TData>,
): NovaChartScatterLayoutPlan<TData> {
  const totalStart = now()
  const domainStart = now()
  const rows = input.dataStore.getData()
  const pointInput = createPointInput(input)
  const series = createCartesianSeriesMetadata(pointInput, rows)
  const domainMs = now() - domainStart
  const layoutStart = now()

  const candidates = createCartesianPointCandidates(pointInput, rows)
  const { visibleCandidates, renderedCandidates, mode } = windowCartesianPointCandidates(pointInput, candidates)
  const points = renderedCandidates.map(candidate => toLayoutPoint(input, candidate)).filter(isRenderablePoint)
  const layoutMs = now() - layoutStart

  const diagnostics: NovaChartScatterSeriesDiagnostics = {
    kind: 'scatter',
    inputRows: rows.length,
    visibleRows: visibleCandidates.length,
    renderedPoints: points.length,
    skippedRows: rows.length - candidates.length,
    seriesCount: series.length,
    mode,
    domainMs,
    layoutMs,
    schemaMs: 0,
    totalMs: now() - totalStart,
  }

  return {
    points,
    series,
    diagnostics,
  }
}

export function resolveScatterXDomain<TData>(input: NovaChartScatterLayoutInput<TData>): ChartScaleDomain {
  return resolveCartesianXDomain(createPointInput(input))
}

export function resolveScatterYDomain<TData>(input: NovaChartScatterLayoutInput<TData>): ChartScaleDomain {
  return resolveCartesianYDomain(createPointInput(input))
}

function createPointInput<TData>(input: NovaChartScatterLayoutInput<TData>) {
  return {
    dataStore: input.dataStore,
    xScale: input.xScale,
    yScale: input.yScale,
    width: input.width,
    height: input.height,
    xScaleId: input.props.xScaleId,
    yScaleId: input.props.yScaleId,
    xField: input.props.xField,
    yField: input.props.yField,
    seriesField: input.props.seriesField,
    labelField: input.props.labelField,
    kind: 'scatter' as const,
    fallbackLabel: 'Scatter',
    palette: input.props.colors.palette,
    defaultColor: typeof input.props.fill === 'string' ? input.props.fill : '#2563eb',
    colorField: input.props.colors.colorField,
    virtualization: input.props.virtualization,
    resolveColor: (context: NovaChartPointContext<TData>, series?: { color: string }) => {
      if (typeof input.props.fill === 'function') return input.props.fill(context)
      if (typeof input.props.colors.fill === 'function') return input.props.colors.fill(context)
      if (typeof input.props.colors.fill === 'string') return input.props.colors.fill
      if (typeof input.props.fill === 'string') return input.props.fill
      return series?.color
    },
  }
}

function toLayoutPoint<TData>(
  input: NovaChartScatterLayoutInput<TData>,
  candidate: ReturnType<typeof createCartesianPointCandidates<TData>>[number],
): NovaChartScatterLayoutPoint<TData> {
  const context = toPointContext(candidate)
  return {
    key: candidate.key,
    row: candidate.row,
    rowIndex: candidate.rowIndex,
    xValue: candidate.xValue,
    yValue: candidate.yValue,
    rawValue: candidate.rawValue,
    seriesKey: candidate.seriesKey,
    seriesLabel: candidate.seriesLabel,
    color: candidate.color,
    strokeColor: resolveStringOption(input.props.strokeColor, context),
    strokeWidth: input.props.strokeWidth,
    opacity: input.props.opacity,
    x: candidate.x,
    y: candidate.y,
    radius: Math.max(0, resolveNumberOption(input.props.radius, context, 4)),
  }
}

function toPointContext<TData>(
  candidate: ReturnType<typeof createCartesianPointCandidates<TData>>[number],
): NovaChartPointContext<TData> {
  return {
    row: candidate.row,
    rowIndex: candidate.rowIndex,
    key: candidate.key,
    xValue: candidate.xValue,
    yValue: candidate.yValue,
    seriesKey: candidate.seriesKey,
    seriesLabel: candidate.seriesLabel,
  }
}

function resolveStringOption<TData>(
  value: string | ((context: NovaChartPointContext<TData>) => string) | undefined,
  context: NovaChartPointContext<TData>,
): string | undefined {
  return typeof value === 'function' ? value(context) : value
}

function resolveNumberOption<TData>(
  value: number | ((context: NovaChartPointContext<TData>) => number),
  context: NovaChartPointContext<TData>,
  fallback: number,
): number {
  if (typeof value === 'function') {
    const resolved = Number(value(context))
    return Number.isFinite(resolved) ? resolved : fallback
  }
  return Number.isFinite(value) ? value : fallback
}

function isRenderablePoint<TData>(point: NovaChartScatterLayoutPoint<TData>): boolean {
  return Number.isFinite(point.x)
    && Number.isFinite(point.y)
    && Number.isFinite(point.radius)
    && point.radius >= 0
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}
