import { BandScale } from '@/model/scale/BandScale'
import type { ChartDataStore } from '@/model/data/ChartDataStore'
import type {
  ChartScale,
  ChartScaleDomain,
  ChartScaleValue,
} from '@/model/types/chart-scale.types'
import type {
  NovaChartFieldAccessor,
  NovaChartLineLayoutSegment,
  NovaChartPointContext,
  NovaChartPointRenderMode,
  NovaChartPointSeriesResolvedVirtualizationOptions,
  NovaChartSeriesKind,
  NovaChartSeriesMetadata,
} from '@/model/types/chart-components.types'

export const DEFAULT_POINT_SERIES_VIRTUALIZATION: NovaChartPointSeriesResolvedVirtualizationOptions = {
  enabled: true,
  overscanPx: 64,
  maxRenderedPoints: 50_000,
}

export interface NovaChartCartesianPointInput<TData = Record<string, unknown>> {
  dataStore: ChartDataStore<TData>
  xScale: ChartScale<ChartScaleValue>
  yScale: ChartScale<ChartScaleValue>
  width: number
  height: number
  xScaleId: string
  yScaleId: string
  xField: NovaChartFieldAccessor<TData>
  yField: NovaChartFieldAccessor<TData, number>
  seriesField?: NovaChartFieldAccessor<TData>
  labelField?: NovaChartFieldAccessor<TData>
  kind: NovaChartSeriesKind
  fallbackLabel: string
  palette: Array<string>
  defaultColor: string
  colorField?: NovaChartFieldAccessor<TData>
  virtualization: NovaChartPointSeriesResolvedVirtualizationOptions
  connectNulls?: boolean
  defined?: (context: NovaChartPointContext<TData>) => boolean
  resolveColor?: (context: NovaChartPointContext<TData>, series?: NovaChartSeriesMetadata) => string | undefined
}

export interface NovaChartCartesianPointCandidate<TData = Record<string, unknown>> {
  key: string
  row?: TData
  rowIndex: number
  xValue: ChartScaleValue
  yValue: number
  rawValue?: number
  seriesKey: string
  seriesLabel: string
  color: string
  x: number
  y: number
  order: number
  visible: boolean
  segmentGroup: number
}

/**
 * Создает generic metadata для cartesian point-like series.
 */
export function createCartesianSeriesMetadata<TData>(
  input: NovaChartCartesianPointInput<TData>,
  rows: ReadonlyArray<TData> = input.dataStore.getData(),
): Array<NovaChartSeriesMetadata> {
  const seen = new Set<string>()
  const result: Array<NovaChartSeriesMetadata> = []

  rows.forEach((row, rowIndex) => {
    const value = input.seriesField ? input.dataStore.readField(row, rowIndex, input.seriesField) : undefined
    const id = value === undefined || value === null ? '__default' : String(value)
    if (seen.has(id)) return
    seen.add(id)
    result.push({
      id,
      kind: input.kind,
      scaleIds: {
        x: input.xScaleId,
        y: input.yScaleId,
      },
      label: id === '__default' ? input.fallbackLabel : id,
      color: input.palette[result.length % input.palette.length] ?? input.defaultColor,
      visible: true,
    })
  })

  return result.length > 0 ? result : [{
    id: '__default',
    kind: input.kind,
    scaleIds: {
      x: input.xScaleId,
      y: input.yScaleId,
    },
    label: input.fallbackLabel,
    color: input.defaultColor,
    visible: true,
  }]
}

/**
 * Возвращает x-domain для shared cartesian scale.
 */
export function resolveCartesianXDomain<TData>(input: NovaChartCartesianPointInput<TData>): ChartScaleDomain {
  const rows = input.dataStore.getData()
  if (input.xScale instanceof BandScale) {
    const seen = new Set<string>()
    const domain: Array<string> = []
    rows.forEach((row, rowIndex) => {
      const value = String(input.dataStore.readField(row, rowIndex, input.xField) ?? '')
      if (seen.has(value)) return
      seen.add(value)
      domain.push(value)
    })
    return domain
  }

  return extentDomain(rows.map((row, rowIndex) => Number(input.dataStore.readField(row, rowIndex, input.xField))))
}

/**
 * Возвращает y-domain для shared numeric scale.
 */
export function resolveCartesianYDomain<TData>(input: NovaChartCartesianPointInput<TData>): ChartScaleDomain {
  const rows = input.dataStore.getData()
  return extentDomain(rows.map((row, rowIndex) => Number(input.dataStore.readField(row, rowIndex, input.yField))))
}

/**
 * Нормализует rows в rendered point candidates с учетом visible domain.
 */
export function createCartesianPointCandidates<TData>(
  input: NovaChartCartesianPointInput<TData>,
  rows: ReadonlyArray<TData> = input.dataStore.getData(),
): Array<NovaChartCartesianPointCandidate<TData>> {
  const result: Array<NovaChartCartesianPointCandidate<TData>> = []
  const series = createCartesianSeriesMetadata(input, rows)
  const seriesIndex = new Map(series.map(item => [item.id, item]))
  const segmentGroups = new Map<string, number>()

  rows.forEach((row, rowIndex) => {
    const yValue = Number(input.dataStore.readField(row, rowIndex, input.yField))
    const xValue = resolveXValue(input, row, rowIndex)
    const seriesValue = input.seriesField ? input.dataStore.readField(row, rowIndex, input.seriesField) : undefined
    const seriesKey = seriesValue === undefined || seriesValue === null ? '__default' : String(seriesValue)
    const labelValue = input.labelField ? input.dataStore.readField(row, rowIndex, input.labelField) : undefined
    const seriesLabel = labelValue === undefined || labelValue === null ? seriesKey : String(labelValue)
    const context: NovaChartPointContext<TData> = {
      row,
      rowIndex,
      key: String(input.dataStore.getRowKey(row, rowIndex)),
      xValue,
      yValue,
      seriesKey,
      seriesLabel,
    }

    if (!isDefinedPoint(input, context)) {
      if (!input.connectNulls) segmentGroups.set(seriesKey, (segmentGroups.get(seriesKey) ?? 0) + 1)
      return
    }

    const x = resolveXPosition(input.xScale, xValue)
    const y = Number(input.yScale.toPx(yValue as ChartScaleValue))
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      if (!input.connectNulls) segmentGroups.set(seriesKey, (segmentGroups.get(seriesKey) ?? 0) + 1)
      return
    }

    const metadata = seriesIndex.get(seriesKey)
    result.push({
      key: context.key,
      row,
      rowIndex,
      xValue,
      yValue,
      rawValue: yValue,
      seriesKey,
      seriesLabel,
      color: resolvePointColor(input, context, metadata),
      x,
      y,
      order: resolveSortOrder(input.xScale, xValue, rowIndex),
      visible: isVisible(input, x, y),
      segmentGroup: segmentGroups.get(seriesKey) ?? 0,
    })
  })

  return result.sort(comparePointCandidates)
}

/**
 * Возвращает visible candidates и sampling mode.
 */
export function windowCartesianPointCandidates<TData>(
  input: NovaChartCartesianPointInput<TData>,
  candidates: Array<NovaChartCartesianPointCandidate<TData>>,
): {
  visibleCandidates: Array<NovaChartCartesianPointCandidate<TData>>
  renderedCandidates: Array<NovaChartCartesianPointCandidate<TData>>
  mode: NovaChartPointRenderMode
} {
  const visibleCandidates = input.virtualization.enabled
    ? candidates.filter(point => point.visible)
    : candidates
  const renderedCandidates = sampleCandidates(visibleCandidates, input.virtualization.maxRenderedPoints)
  return {
    visibleCandidates,
    renderedCandidates,
    mode: resolveRenderMode(input, visibleCandidates.length, renderedCandidates.length),
  }
}

/**
 * Создает line segments между rendered points.
 */
export function createCartesianLineSegments<TData>(
  points: Array<NovaChartCartesianPointCandidate<TData>>,
  curve: 'linear' | 'step',
): Array<NovaChartLineLayoutSegment> {
  const segments: Array<NovaChartLineLayoutSegment> = []
  const bySeries = new Map<string, Array<NovaChartCartesianPointCandidate<TData>>>()
  for (const point of points) {
    const bucket = bySeries.get(point.seriesKey) ?? []
    bucket.push(point)
    bySeries.set(point.seriesKey, bucket)
  }

  for (const [seriesKey, seriesPoints] of bySeries) {
    for (let index = 1; index < seriesPoints.length; index += 1) {
      const previous = seriesPoints[index - 1]
      const current = seriesPoints[index]
      if (!previous || !current) continue
      if (previous.segmentGroup !== current.segmentGroup) continue
      if (curve === 'step') {
        const midKey = `${previous.key}:${current.key}:step`
        segments.push({
          key: `${midKey}:h`,
          seriesKey,
          color: previous.color,
          x1: previous.x,
          y1: previous.y,
          x2: current.x,
          y2: previous.y,
        })
        segments.push({
          key: `${midKey}:v`,
          seriesKey,
          color: current.color,
          x1: current.x,
          y1: previous.y,
          x2: current.x,
          y2: current.y,
        })
        continue
      }
      segments.push({
        key: `${previous.key}:${current.key}`,
        seriesKey,
        color: previous.color,
        x1: previous.x,
        y1: previous.y,
        x2: current.x,
        y2: current.y,
      })
    }
  }

  return segments.filter(segment => Number.isFinite(segment.x1)
    && Number.isFinite(segment.y1)
    && Number.isFinite(segment.x2)
    && Number.isFinite(segment.y2))
}

export function resolveCartesianXPosition(scale: ChartScale<ChartScaleValue>, xValue: ChartScaleValue): number {
  if (scale instanceof BandScale) return scale.center(String(xValue))
  return Number(scale.toPx(xValue))
}

export function extentDomain(values: Array<number>): ChartScaleDomain {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const value of values) {
    if (!Number.isFinite(value)) continue
    if (value < min) min = value
    if (value > max) max = value
  }
  return min === Number.POSITIVE_INFINITY ? [0, 1] : [min, max]
}

function resolveXValue<TData>(
  input: NovaChartCartesianPointInput<TData>,
  row: TData,
  rowIndex: number,
): ChartScaleValue {
  const value = input.dataStore.readField(row, rowIndex, input.xField)
  return input.xScale instanceof BandScale ? String(value ?? '') : Number(value)
}

function resolveXPosition(scale: ChartScale<ChartScaleValue>, xValue: ChartScaleValue): number {
  return resolveCartesianXPosition(scale, xValue)
}

function resolveSortOrder(scale: ChartScale<ChartScaleValue>, xValue: ChartScaleValue, fallback: number): number {
  if (scale instanceof BandScale) {
    const index = scale.indexOf(String(xValue))
    return index >= 0 ? index : fallback
  }
  const numeric = Number(xValue)
  return Number.isFinite(numeric) ? numeric : fallback
}

function isDefinedPoint<TData>(
  input: NovaChartCartesianPointInput<TData>,
  context: NovaChartPointContext<TData>,
): boolean {
  if (!Number.isFinite(context.yValue)) return false
  if (typeof context.xValue === 'number' && !Number.isFinite(context.xValue)) return false
  return input.defined?.(context) ?? true
}

function resolvePointColor<TData>(
  input: NovaChartCartesianPointInput<TData>,
  context: NovaChartPointContext<TData>,
  series?: NovaChartSeriesMetadata,
): string {
  const resolved = input.resolveColor?.(context, series)
  if (resolved) return resolved
  if (input.colorField && context.row) {
    const color = input.dataStore.readField(context.row, context.rowIndex ?? -1, input.colorField)
    if (typeof color === 'string' && color) return color
  }
  return series?.color ?? input.defaultColor
}

function isVisible<TData>(input: NovaChartCartesianPointInput<TData>, x: number, y: number): boolean {
  const overscan = input.virtualization.overscanPx
  return x >= -overscan
    && x <= input.width + overscan
    && y >= -overscan
    && y <= input.height + overscan
}

function sampleCandidates<TData>(
  points: Array<NovaChartCartesianPointCandidate<TData>>,
  maxRenderedPoints: number,
): Array<NovaChartCartesianPointCandidate<TData>> {
  if (points.length <= maxRenderedPoints) return points
  const sampleStep = Math.ceil(points.length / maxRenderedPoints)
  return points.filter((_point, index) => index % sampleStep === 0)
}

function resolveRenderMode<TData>(
  input: NovaChartCartesianPointInput<TData>,
  visibleRows: number,
  renderedPoints: number,
): NovaChartPointRenderMode {
  if (!input.virtualization.enabled) return 'direct'
  if (renderedPoints < visibleRows) return 'sampled'
  return visibleRows < input.dataStore.rowCount ? 'windowed' : 'direct'
}

function comparePointCandidates<TData>(
  a: NovaChartCartesianPointCandidate<TData>,
  b: NovaChartCartesianPointCandidate<TData>,
): number {
  if (a.seriesKey !== b.seriesKey) return a.seriesKey.localeCompare(b.seriesKey)
  if (a.segmentGroup !== b.segmentGroup) return a.segmentGroup - b.segmentGroup
  return a.order - b.order || a.rowIndex - b.rowIndex
}
