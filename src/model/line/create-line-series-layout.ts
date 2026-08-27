import type { ChartDataStore } from '@/model/data/ChartDataStore'
import type {
  NovaChartLineColorContext,
  NovaChartLineLayoutPlan,
  NovaChartLineLayoutPoint,
  NovaChartLineLayoutSegment,
  NovaChartLinePointContext,
  NovaChartLineSeriesDiagnostics,
  NovaChartLineSeriesResolvedProps,
  NovaChartLineVirtualizationOptions,
  NovaChartSeriesMetadata,
} from '@/model/types/chart-components.types'
import type {
  ChartScale,
  ChartScaleDomain,
  ChartScaleValue,
} from '@/model/types/chart-scale.types'
import { BandScale } from '@/model/scale/BandScale'

export const DEFAULT_LINE_VIRTUALIZATION: Required<NovaChartLineVirtualizationOptions> = {
  enabled: true,
  overscanPx: 64,
  maxRenderedPoints: 50_000,
}

export interface NovaChartLineLayoutInput<TData = Record<string, unknown>> {
  props: NovaChartLineSeriesResolvedProps<TData>
  dataStore: ChartDataStore<TData>
  xScale: ChartScale<ChartScaleValue>
  yScale: ChartScale<ChartScaleValue>
  width: number
  height: number
}

interface LineCandidate<TData> extends NovaChartLineLayoutPoint<TData> {
  order: number
  visible: boolean
  segmentGroup: number
}

/**
 * Строит segment/point geometry для LineSeries на общих chart scales.
 */
export function createLineSeriesLayout<TData>(
  input: NovaChartLineLayoutInput<TData>,
): NovaChartLineLayoutPlan<TData> {
  const totalStart = now()
  const domainStart = now()
  const rows = input.dataStore.getData()
  const series = createSeriesMetadata(input, rows)
  const domainMs = now() - domainStart
  const layoutStart = now()

  const candidates = normalizeRows(input, rows)
  const visibleCandidates = input.props.virtualization.enabled
    ? candidates.filter(point => point.visible)
    : candidates
  const sampled = sampleCandidates(visibleCandidates, input.props.virtualization.maxRenderedPoints)
  const points = sampled.filter(isRenderablePoint)
  const segments = createSegments(input, points)
  const layoutMs = now() - layoutStart

  const diagnostics: NovaChartLineSeriesDiagnostics = {
    kind: 'line',
    inputRows: rows.length,
    visibleRows: visibleCandidates.length,
    renderedPoints: points.length,
    renderedSegments: segments.length,
    skippedRows: rows.length - candidates.length,
    seriesCount: series.length,
    mode: resolveRenderMode(input, visibleCandidates.length, points.length),
    domainMs,
    layoutMs,
    schemaMs: 0,
    totalMs: now() - totalStart,
  }

  return {
    points,
    segments,
    series,
    diagnostics,
  }
}

export function resolveLineXDomain<TData>(input: NovaChartLineLayoutInput<TData>): ChartScaleDomain {
  const rows = input.dataStore.getData()
  if (input.xScale instanceof BandScale) {
    const seen = new Set<string>()
    const domain: Array<string> = []
    rows.forEach((row, rowIndex) => {
      const value = String(input.dataStore.readField(row, rowIndex, input.props.xField) ?? '')
      if (seen.has(value)) {
        return
      }
      seen.add(value)
      domain.push(value)
    })
    return domain
  }

  return extentDomain(rows.map((row, rowIndex) => Number(input.dataStore.readField(row, rowIndex, input.props.xField))))
}

export function resolveLineYDomain<TData>(input: NovaChartLineLayoutInput<TData>): ChartScaleDomain {
  const rows = input.dataStore.getData()
  return extentDomain(rows.map((row, rowIndex) => Number(input.dataStore.readField(row, rowIndex, input.props.yField))))
}

function normalizeRows<TData>(
  input: NovaChartLineLayoutInput<TData>,
  rows: ReadonlyArray<TData>,
): Array<LineCandidate<TData>> {
  const result: Array<LineCandidate<TData>> = []
  const seriesIndex = createSeriesIndex(createSeriesMetadata(input, rows))
  const segmentGroups = new Map<string, number>()

  rows.forEach((row, rowIndex) => {
    const yValue = Number(input.dataStore.readField(row, rowIndex, input.props.yField))
    const xValue = resolveXValue(input, row, rowIndex)
    const seriesValue = input.props.seriesField ? input.dataStore.readField(row, rowIndex, input.props.seriesField) : undefined
    const seriesKey = seriesValue === undefined || seriesValue === null ? '__default' : String(seriesValue)
    const labelValue = input.props.labelField ? input.dataStore.readField(row, rowIndex, input.props.labelField) : undefined
    const seriesLabel = labelValue === undefined || labelValue === null ? seriesKey : String(labelValue)
    const context: NovaChartLinePointContext<TData> = {
      row,
      rowIndex,
      key: String(input.dataStore.getRowKey(row, rowIndex)),
      xValue,
      yValue,
      seriesKey,
      seriesLabel,
    }
    if (!isDefinedPoint(input, context)) {
      if (!input.props.connectNulls) {
        segmentGroups.set(seriesKey, (segmentGroups.get(seriesKey) ?? 0) + 1)
      }
      return
    }

    const x = resolveXPosition(input.xScale, xValue)
    const y = Number(input.yScale.toPx(yValue as ChartScaleValue))
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      if (!input.props.connectNulls) {
        segmentGroups.set(seriesKey, (segmentGroups.get(seriesKey) ?? 0) + 1)
      }
      return
    }

    result.push({
      key: context.key,
      row,
      rowIndex,
      xValue,
      yValue,
      rawValue: yValue,
      seriesKey,
      seriesLabel,
      color: resolvePointColor(input, context, seriesIndex.get(seriesKey)),
      x,
      y,
      order: resolveSortOrder(input.xScale, xValue, rowIndex),
      visible: isVisible(input, x, y),
      segmentGroup: segmentGroups.get(seriesKey) ?? 0,
    })
  })

  return result.sort((a, b) => {
    if (a.seriesKey !== b.seriesKey) {
      return a.seriesKey.localeCompare(b.seriesKey)
    }
    if (a.segmentGroup !== b.segmentGroup) {
      return a.segmentGroup - b.segmentGroup
    }
    return a.order - b.order || a.rowIndex - b.rowIndex
  })
}

function createSegments<TData>(
  input: NovaChartLineLayoutInput<TData>,
  points: Array<NovaChartLineLayoutPoint<TData>>,
): Array<NovaChartLineLayoutSegment> {
  const segments: Array<NovaChartLineLayoutSegment> = []
  const bySeries = new Map<string, Array<NovaChartLineLayoutPoint<TData>>>()
  for (const point of points) {
    const bucket = bySeries.get(point.seriesKey) ?? []
    bucket.push(point)
    bySeries.set(point.seriesKey, bucket)
  }

  for (const [seriesKey, seriesPoints] of bySeries) {
    for (let index = 1; index < seriesPoints.length; index += 1) {
      const previous = seriesPoints[index - 1]
      const current = seriesPoints[index]
      if (!previous || !current) {
        continue
      }
      if (readSegmentGroup(previous) !== readSegmentGroup(current)) {
        continue
      }
      if (input.props.curve === 'step') {
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

  return segments.filter(isRenderableSegment)
}

function createSeriesMetadata<TData>(
  input: NovaChartLineLayoutInput<TData>,
  rows: ReadonlyArray<TData>,
): Array<NovaChartSeriesMetadata> {
  const seen = new Set<string>()
  const result: Array<NovaChartSeriesMetadata> = []

  rows.forEach((row, rowIndex) => {
    const value = input.props.seriesField ? input.dataStore.readField(row, rowIndex, input.props.seriesField) : undefined
    const id = value === undefined || value === null ? '__default' : String(value)
    if (seen.has(id)) {
      return
    }
    seen.add(id)
    result.push({
      id,
      kind: 'line',
      scaleIds: {
        x: input.props.xScaleId,
        y: input.props.yScaleId,
      },
      label: id === '__default' ? 'Line' : id,
      color: input.props.colors.palette[result.length % input.props.colors.palette.length] ?? input.props.stroke,
      visible: true,
    })
  })

  return result.length > 0
    ? result
    : [{
        id: '__default',
        kind: 'line',
        scaleIds: {
          x: input.props.xScaleId,
          y: input.props.yScaleId,
        },
        label: 'Line',
        color: input.props.stroke,
        visible: true,
      }]
}

function createSeriesIndex(series: Array<NovaChartSeriesMetadata>): Map<string, NovaChartSeriesMetadata> {
  return new Map(series.map(item => [item.id, item]))
}

function resolveXValue<TData>(
  input: NovaChartLineLayoutInput<TData>,
  row: TData,
  rowIndex: number,
): ChartScaleValue {
  const value = input.dataStore.readField(row, rowIndex, input.props.xField)
  return input.xScale instanceof BandScale ? String(value ?? '') : Number(value)
}

function resolveXPosition(scale: ChartScale<ChartScaleValue>, xValue: ChartScaleValue): number {
  if (scale instanceof BandScale) {
    return scale.center(String(xValue))
  }
  return Number(scale.toPx(xValue))
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
  input: NovaChartLineLayoutInput<TData>,
  context: NovaChartLinePointContext<TData>,
): boolean {
  if (!Number.isFinite(context.yValue)) {
    return false
  }
  if (typeof context.xValue === 'number' && !Number.isFinite(context.xValue)) {
    return false
  }
  return input.props.defined?.(context) ?? true
}

function resolvePointColor<TData>(
  input: NovaChartLineLayoutInput<TData>,
  context: NovaChartLineColorContext<TData>,
  series?: NovaChartSeriesMetadata,
): string {
  if (typeof input.props.colors.stroke === 'function') {
    return input.props.colors.stroke(context)
  }
  if (typeof input.props.colors.stroke === 'string') {
    return input.props.colors.stroke
  }
  if (input.props.colors.colorField && context.row) {
    const color = input.dataStore.readField(context.row, context.rowIndex ?? -1, input.props.colors.colorField)
    if (typeof color === 'string' && color) {
      return color
    }
  }
  return series?.color ?? input.props.stroke
}

function readSegmentGroup(point: NovaChartLineLayoutPoint<any>): number {
  return (point as NovaChartLineLayoutPoint<any> & { segmentGroup?: number }).segmentGroup ?? 0
}

function isVisible<TData>(input: NovaChartLineLayoutInput<TData>, x: number, y: number): boolean {
  const overscan = input.props.virtualization.overscanPx
  return x >= -overscan
    && x <= input.width + overscan
    && y >= -overscan
    && y <= input.height + overscan
}

function sampleCandidates<TData>(
  points: Array<LineCandidate<TData>>,
  maxRenderedPoints: number,
): Array<LineCandidate<TData>> {
  if (points.length <= maxRenderedPoints) {
    return points
  }
  const sampleStep = Math.ceil(points.length / maxRenderedPoints)
  return points.filter((_point, index) => index % sampleStep === 0)
}

function resolveRenderMode<TData>(
  input: NovaChartLineLayoutInput<TData>,
  visibleRows: number,
  renderedPoints: number,
): NovaChartLineSeriesDiagnostics['mode'] {
  if (!input.props.virtualization.enabled) {
    return 'direct'
  }
  if (renderedPoints < visibleRows) {
    return 'sampled'
  }
  return visibleRows < input.dataStore.rowCount ? 'windowed' : 'direct'
}

function isRenderablePoint<TData>(point: NovaChartLineLayoutPoint<TData>): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}

function isRenderableSegment(segment: NovaChartLineLayoutSegment): boolean {
  return Number.isFinite(segment.x1)
    && Number.isFinite(segment.y1)
    && Number.isFinite(segment.x2)
    && Number.isFinite(segment.y2)
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

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}
