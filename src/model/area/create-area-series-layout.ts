import type { NovaChartCartesianPointCandidate } from '@/model/cartesian/point-series'
import type { ChartDataStore } from '@/model/data/ChartDataStore'
import type {
  NovaChartAreaLayoutArea,
  NovaChartAreaLayoutPlan,
  NovaChartAreaLayoutPoint,
  NovaChartAreaSeriesDiagnostics,
  NovaChartAreaSeriesResolvedProps,
  NovaChartLineLayoutSegment,
  NovaChartPointContext,
} from '@/model/types/chart-components.types'
import type {
  ChartScale,
  ChartScaleDomain,
  ChartScaleValue,
} from '@/model/types/chart-scale.types'
import {
  createCartesianLineSegments,
  createCartesianPointCandidates,
  createCartesianSeriesMetadata,
  extentDomain,

  resolveCartesianXDomain,
  windowCartesianPointCandidates,
} from '@/model/cartesian/point-series'

export interface NovaChartAreaLayoutInput<TData = Record<string, unknown>> {
  props: NovaChartAreaSeriesResolvedProps<TData>
  dataStore: ChartDataStore<TData>
  xScale: ChartScale<ChartScaleValue>
  yScale: ChartScale<ChartScaleValue>
  width: number
  height: number
}

/**
 * Строит area polygons, outline segments и optional marker points.
 */
export function createAreaSeriesLayout<TData>(
  input: NovaChartAreaLayoutInput<TData>,
): NovaChartAreaLayoutPlan<TData> {
  const totalStart = now()
  const domainStart = now()
  const rows = input.dataStore.getData()
  const pointInput = createPointInput(input)
  const series = createCartesianSeriesMetadata(pointInput, rows)
  const domainMs = now() - domainStart
  const layoutStart = now()

  const candidates = createCartesianPointCandidates(pointInput, rows)
  const { visibleCandidates, renderedCandidates, mode } = windowCartesianPointCandidates(pointInput, candidates)
  const points = createAreaPoints(input, renderedCandidates)
  const segments = createCartesianLineSegments(points as Array<NovaChartCartesianPointCandidate<TData>>, input.props.curve)
  const areas = createAreas(points)
  const layoutMs = now() - layoutStart

  const diagnostics: NovaChartAreaSeriesDiagnostics = {
    kind: 'area',
    inputRows: rows.length,
    visibleRows: visibleCandidates.length,
    renderedPoints: points.length,
    renderedSegments: segments.length,
    renderedAreas: areas.length,
    skippedRows: rows.length - candidates.length,
    seriesCount: series.length,
    mode,
    areaMode: input.props.mode,
    domainMs,
    layoutMs,
    schemaMs: 0,
    totalMs: now() - totalStart,
  }

  return {
    points,
    segments,
    areas,
    series,
    diagnostics,
  }
}

export function resolveAreaXDomain<TData>(input: NovaChartAreaLayoutInput<TData>): ChartScaleDomain {
  return resolveCartesianXDomain(createPointInput(input))
}

export function resolveAreaYDomain<TData>(input: NovaChartAreaLayoutInput<TData>): ChartScaleDomain {
  const rows = input.dataStore.getData()
  const values: Array<number> = [input.props.baselineValue]

  if (input.props.mode === 'stacked') {
    const totals = new Map<string, { positive: number, negative: number }>()
    rows.forEach((row, rowIndex) => {
      const xValue = input.dataStore.readField(row, rowIndex, input.props.xField)
      const key = String(xValue ?? '')
      const value = Number(input.dataStore.readField(row, rowIndex, input.props.yField))
      if (!Number.isFinite(value)) {
        return
      }
      let total = totals.get(key)
      if (!total) {
        total = { positive: input.props.baselineValue, negative: input.props.baselineValue }
        totals.set(key, total)
      }
      if (value >= 0) {
        total.positive += value
      }
      else { total.negative += value }
    })
    for (const total of totals.values()) {
      values.push(total.negative, total.positive)
    }
    return extentDomain(values)
  }

  rows.forEach((row, rowIndex) => {
    const value = Number(input.dataStore.readField(row, rowIndex, input.props.yField))
    const baseline = readBaseline(input, row, rowIndex)
    if (Number.isFinite(value)) {
      values.push(value)
    }
    if (Number.isFinite(baseline)) {
      values.push(baseline)
    }
  })
  return extentDomain(values)
}

function createPointInput<TData>(input: NovaChartAreaLayoutInput<TData>) {
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
    kind: 'area' as const,
    fallbackLabel: 'Area',
    palette: input.props.colors.palette,
    defaultColor: input.props.stroke,
    colorField: input.props.colors.colorField,
    virtualization: input.props.virtualization,
    connectNulls: input.props.connectNulls,
    defined: input.props.defined,
    resolveColor: (context: NovaChartPointContext<TData>, series?: { color: string }) => {
      if (typeof input.props.colors.stroke === 'function') {
        return input.props.colors.stroke(context)
      }
      if (typeof input.props.colors.stroke === 'string') {
        return input.props.colors.stroke
      }
      return series?.color ?? input.props.stroke
    },
  }
}

function createAreaPoints<TData>(
  input: NovaChartAreaLayoutInput<TData>,
  candidates: Array<NovaChartCartesianPointCandidate<TData>>,
): Array<NovaChartAreaLayoutPoint<TData>> {
  if (input.props.mode === 'stacked') {
    return createStackedAreaPoints(input, candidates)
  }
  return candidates.map((candidate) => {
    const baselineValue = readBaseline(input, candidate.row as TData, candidate.rowIndex)
    const baselineY = Number(input.yScale.toPx(baselineValue as ChartScaleValue))
    return {
      ...candidate,
      baselineValue,
      baselineY,
    }
  }).filter(isRenderableAreaPoint)
}

function createStackedAreaPoints<TData>(
  input: NovaChartAreaLayoutInput<TData>,
  candidates: Array<NovaChartCartesianPointCandidate<TData>>,
): Array<NovaChartAreaLayoutPoint<TData>> {
  const offsets = new Map<string, { positive: number, negative: number }>()
  const points: Array<NovaChartAreaLayoutPoint<TData>> = []

  for (const candidate of candidates) {
    const stackKey = String(candidate.xValue)
    let offset = offsets.get(stackKey)
    if (!offset) {
      offset = { positive: input.props.baselineValue, negative: input.props.baselineValue }
      offsets.set(stackKey, offset)
    }
    const value = candidate.yValue
    const baseValue = value >= 0 ? offset.positive : offset.negative
    const endValue = baseValue + value
    if (value >= 0) {
      offset.positive = endValue
    }
    else { offset.negative = endValue }

    points.push({
      ...candidate,
      y: Number(input.yScale.toPx(endValue as ChartScaleValue)),
      baselineValue: baseValue,
      baselineY: Number(input.yScale.toPx(baseValue as ChartScaleValue)),
      stackedBaseValue: baseValue,
      stackedEndValue: endValue,
    })
  }

  return points.filter(isRenderableAreaPoint)
}

function createAreas<TData>(points: Array<NovaChartAreaLayoutPoint<TData>>): Array<NovaChartAreaLayoutArea> {
  const groups = new Map<string, Array<NovaChartAreaLayoutPoint<TData>>>()
  for (const point of points) {
    const key = `${point.seriesKey}:${point.segmentGroup}`
    const group = groups.get(key) ?? []
    group.push(point)
    groups.set(key, group)
  }

  const areas: Array<NovaChartAreaLayoutArea> = []
  for (const [key, group] of groups) {
    if (group.length < 2) {
      continue
    }
    const first = group[0]
    if (!first) {
      continue
    }
    areas.push({
      key,
      seriesKey: first.seriesKey,
      color: first.color,
      strokeColor: first.color,
      points: [
        ...group.map(point => ({ x: point.x, y: point.y })),
        ...[...group].reverse().map(point => ({ x: point.x, y: point.baselineY })),
      ],
    })
  }
  return areas
}

function readBaseline<TData>(
  input: NovaChartAreaLayoutInput<TData>,
  row: TData | undefined,
  rowIndex: number,
): number {
  if (input.props.baselineField && row) {
    const value = Number(input.dataStore.readField(row, rowIndex, input.props.baselineField))
    if (Number.isFinite(value)) {
      return value
    }
  }
  return input.props.baselineValue
}

function isRenderableAreaPoint<TData>(point: NovaChartAreaLayoutPoint<TData>): boolean {
  return Number.isFinite(point.x)
    && Number.isFinite(point.y)
    && Number.isFinite(point.baselineY)
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

export type { NovaChartLineLayoutSegment }
