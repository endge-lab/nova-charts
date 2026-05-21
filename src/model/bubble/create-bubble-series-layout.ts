import type { ChartDataStore } from '@/model/data/ChartDataStore'
import type {
  ChartScale,
  ChartScaleDomain,
  ChartScaleValue,
} from '@/model/types/chart-scale.types'
import {
  createCartesianPointCandidates,
  createCartesianSeriesMetadata,
  extentDomain,
  resolveCartesianXDomain,
  resolveCartesianYDomain,
  windowCartesianPointCandidates,
} from '@/model/cartesian/point-series'
import type {
  NovaChartBubbleLayoutPlan,
  NovaChartBubbleLayoutPoint,
  NovaChartBubbleSeriesDiagnostics,
  NovaChartBubbleSeriesResolvedProps,
  NovaChartPointContext,
} from '@/model/types/chart-components.types'

export interface NovaChartBubbleLayoutInput<TData = Record<string, unknown>> {
  props: NovaChartBubbleSeriesResolvedProps<TData>
  dataStore: ChartDataStore<TData>
  xScale: ChartScale<ChartScaleValue>
  yScale: ChartScale<ChartScaleValue>
  width: number
  height: number
}

/**
 * Строит bounded bubble geometry. Radius не влияет на x/y domain contributions.
 */
export function createBubbleSeriesLayout<TData>(
  input: NovaChartBubbleLayoutInput<TData>,
): NovaChartBubbleLayoutPlan<TData> {
  const totalStart = now()
  const domainStart = now()
  const rows = input.dataStore.getData()
  const pointInput = createPointInput(input)
  const series = createCartesianSeriesMetadata(pointInput, rows)
  const sizeDomain = resolveBubbleSizeDomain(input)
  const domainMs = now() - domainStart
  const layoutStart = now()

  const candidates = createCartesianPointCandidates(pointInput, rows)
  const { visibleCandidates, renderedCandidates, mode } = windowCartesianPointCandidates(pointInput, candidates)
  const points = renderedCandidates.map(candidate => {
    const sizeValue = Number(input.dataStore.readField(candidate.row as TData, candidate.rowIndex, input.props.sizeField))
    const radius = resolveRadius(input, sizeValue, sizeDomain)
    return {
      ...candidate,
      sizeValue: Number.isFinite(sizeValue) ? sizeValue : sizeDomain[0],
      radius,
      strokeColor: resolveStringOption(input.props.strokeColor, toPointContext(candidate)),
      strokeWidth: input.props.strokeWidth,
      opacity: input.props.opacity,
    }
  }).filter(isRenderableBubble)
  const layoutMs = now() - layoutStart

  const diagnostics: NovaChartBubbleSeriesDiagnostics = {
    kind: 'bubble',
    inputRows: rows.length,
    visibleRows: visibleCandidates.length,
    renderedBubbles: points.length,
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
    sizeDomain,
    diagnostics,
  }
}

export function resolveBubbleXDomain<TData>(input: NovaChartBubbleLayoutInput<TData>): ChartScaleDomain {
  return resolveCartesianXDomain(createPointInput(input))
}

export function resolveBubbleYDomain<TData>(input: NovaChartBubbleLayoutInput<TData>): ChartScaleDomain {
  return resolveCartesianYDomain(createPointInput(input))
}

export function resolveBubbleSizeDomain<TData>(input: NovaChartBubbleLayoutInput<TData>): [number, number] {
  const domain = extentDomain(input.dataStore.getData().map((row, rowIndex) => Number(input.dataStore.readField(
    row,
    rowIndex,
    input.props.sizeField,
  ))))
  const min = Number(domain[0])
  const max = Number(domain[domain.length - 1])
  return Number.isFinite(min) && Number.isFinite(max) ? [min, max] : [0, 1]
}

function createPointInput<TData>(input: NovaChartBubbleLayoutInput<TData>) {
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
    kind: 'bubble' as const,
    fallbackLabel: 'Bubble',
    palette: input.props.colors.palette,
    defaultColor: typeof input.props.fill === 'string' ? input.props.fill : '#0ea5e9',
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

function resolveRadius<TData>(
  input: NovaChartBubbleLayoutInput<TData>,
  rawValue: number,
  domain: [number, number],
): number {
  if (!Number.isFinite(rawValue)) return input.props.minRadius
  const [min, max] = domain
  const span = max - min
  const normalized = span <= 0 ? 0.5 : Math.max(0, Math.min(1, (rawValue - min) / span))
  const scaled = input.props.sizeScale === 'sqrt' ? Math.sqrt(normalized) : normalized
  return input.props.minRadius + (input.props.maxRadius - input.props.minRadius) * scaled
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

function isRenderableBubble<TData>(point: NovaChartBubbleLayoutPoint<TData>): boolean {
  return Number.isFinite(point.x)
    && Number.isFinite(point.y)
    && Number.isFinite(point.radius)
    && point.radius >= 0
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}
