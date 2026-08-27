import type { ChartDataStore } from '@/model/data/ChartDataStore'
import type {
  NovaChartBarColorContext,
  NovaChartBarLabelContext,
  NovaChartBarLayoutItem,
  NovaChartBarLayoutPlan,
  NovaChartBarSeriesDiagnostics,
  NovaChartBarSeriesResolvedProps,
  NovaChartSeriesMetadata,
} from '@/model/types/chart-components.types'
import type {
  ChartScale,
  ChartScaleValue,
} from '@/model/types/chart-scale.types'
import { BandScale } from '@/model/scale/BandScale'

export const DEFAULT_BAR_VIRTUALIZATION = {
  enabled: true,
  overscanPx: 64,
  minBarWidthPx: 1,
  maxRenderedBars: 20_000,
  aggregation: 'auto',
} as const

export interface NovaChartBarLayoutInput<TData = Record<string, unknown>> {
  props: NovaChartBarSeriesResolvedProps<TData>
  dataStore: ChartDataStore<TData>
  xScale: ChartScale<ChartScaleValue>
  yScale: ChartScale<ChartScaleValue>
  width: number
  height: number
}

interface BarLayoutRow<TData> {
  row: TData
  rowIndex: number
  key: string
  category: string
  value: number
  seriesKey: string
  seriesLabel: string
}

interface AggregationBucket {
  count: number
  sum: number
  min: number
  max: number
}

/**
 * Строит geometry bar series и выбирает direct/windowed/aggregated режим.
 */
export function createBarSeriesLayout<TData>(
  input: NovaChartBarLayoutInput<TData>,
): NovaChartBarLayoutPlan<TData> {
  const totalStart = now()
  const domainStart = now()
  const { props, dataStore } = input
  const categoryScale = resolveCategoryScale(input)
  const allRows = dataStore.getData()
  const domain = resolveBandDomain(categoryScale)
  const visibleRange = resolveVisibleRange(categoryScale, resolveCategoryViewportSize(input), props.virtualization.overscanPx)
  const visibleCategoryCount = Math.max(0, visibleRange.endIndex - visibleRange.startIndex + 1)
  const series = createSeriesMetadata(input, allRows)
  const domainMs = now() - domainStart
  const layoutStart = now()

  let mode: NovaChartBarSeriesDiagnostics['mode'] = 'direct'
  let aggregatedBuckets = 0
  let visibleRows = allRows.length
  let items: Array<NovaChartBarLayoutItem<TData>>

  const canAggregate = props.mode === 'single' && !props.seriesField
  if (!props.virtualization.enabled) {
    items = createDirectItems(input, allRows.map((_row, index) => index), series)
  }
  else {
    const bandwidth = categoryScale instanceof BandScale ? categoryScale.bandwidth() : Number.POSITIVE_INFINITY
    const visibleRowUpperBound = Math.min(allRows.length, visibleCategoryCount * Math.max(1, series.length))
    const needsAggregation = canAggregate && (
      bandwidth < props.virtualization.minBarWidthPx
      || visibleRowUpperBound > props.virtualization.maxRenderedBars
    )

    if (needsAggregation) {
      mode = 'aggregated'
      const aggregated = createAggregatedItems(input, domain, visibleRange, series)
      items = aggregated.items
      aggregatedBuckets = aggregated.bucketCount
      visibleRows = aggregated.visibleRows
    }
    else {
      const visibleRowIndices = dataStore.visibleRowsByCategoryRange(
        props.categoryField,
        domain,
        visibleRange.startIndex,
        visibleRange.endIndex,
      )
      mode = visibleRowIndices.length < allRows.length ? 'windowed' : 'direct'
      visibleRows = visibleRowIndices.length
      items = createDirectItems(input, visibleRowIndices, series)
    }
  }

  if (props.virtualization.enabled && items.length > props.virtualization.maxRenderedBars) {
    const sampleStep = Math.ceil(items.length / props.virtualization.maxRenderedBars)
    items = items.filter((_item, index) => index % sampleStep === 0)
    mode = mode === 'direct' ? 'windowed' : mode
  }

  const layoutMs = now() - layoutStart
  const diagnostics: NovaChartBarSeriesDiagnostics = {
    kind: 'bar',
    inputRows: allRows.length,
    visibleRows,
    renderedBars: items.length,
    aggregatedBuckets,
    mode,
    domainMs,
    layoutMs,
    schemaMs: 0,
    totalMs: now() - totalStart,
  }

  return {
    items,
    orientation: props.orientation,
    mode: props.mode,
    categories: [...domain],
    series,
    diagnostics,
  }
}

function createDirectItems<TData>(
  input: NovaChartBarLayoutInput<TData>,
  rowIndices: Array<number>,
  series: Array<NovaChartSeriesMetadata>,
): Array<NovaChartBarLayoutItem<TData>> {
  const rows = normalizeRows(input, rowIndices)
  if (input.props.mode === 'stacked') {
    return createStackedItems(input, rows, series)
  }
  if (input.props.mode === 'grouped') {
    return createGroupedItems(input, rows, series)
  }
  return createSingleItems(input, rows, series)
}

function createSingleItems<TData>(
  input: NovaChartBarLayoutInput<TData>,
  rows: Array<BarLayoutRow<TData>>,
  series: Array<NovaChartSeriesMetadata>,
): Array<NovaChartBarLayoutItem<TData>> {
  const categoryScale = resolveCategoryScale(input)
  const valueScale = resolveValueScale(input)
  const baseline = numericScalePx(valueScale, 0)
  const barSize = categoryScale instanceof BandScale
    ? Math.max(0, categoryScale.bandwidth())
    : Math.max(1, resolveCategoryViewportSize(input) / Math.max(1, rows.length))

  return rows.map((row) => {
    const categoryStart = categoryScale.toPx(row.category) as number
    return createBarItem(input, row, series, categoryStart, barSize, baseline, row.value, 0)
  }).filter(isRenderableItem)
}

function createGroupedItems<TData>(
  input: NovaChartBarLayoutInput<TData>,
  rows: Array<BarLayoutRow<TData>>,
  series: Array<NovaChartSeriesMetadata>,
): Array<NovaChartBarLayoutItem<TData>> {
  const categoryScale = resolveCategoryScale(input)
  const valueScale = resolveValueScale(input)
  const baseline = numericScalePx(valueScale, 0)
  const groupSize = categoryScale instanceof BandScale
    ? Math.max(0, categoryScale.bandwidth())
    : Math.max(1, resolveCategoryViewportSize(input) / Math.max(1, rows.length))
  const gap = Math.min(3, Math.max(0, groupSize * 0.08))
  const barSize = Math.max(1, (groupSize - gap * Math.max(0, series.length - 1)) / Math.max(1, series.length))
  const seriesIndex = new Map(series.map((item, index) => [item.id, index]))

  return rows.map((row) => {
    const index = seriesIndex.get(row.seriesKey) ?? 0
    const categoryStart = (categoryScale.toPx(row.category) as number) + index * (barSize + gap)
    return createBarItem(input, row, series, categoryStart, barSize, baseline, row.value, 0)
  }).filter(isRenderableItem)
}

function createStackedItems<TData>(
  input: NovaChartBarLayoutInput<TData>,
  rows: Array<BarLayoutRow<TData>>,
  series: Array<NovaChartSeriesMetadata>,
): Array<NovaChartBarLayoutItem<TData>> {
  const categoryScale = resolveCategoryScale(input)
  const valueScale = resolveValueScale(input)
  const baseline = numericScalePx(valueScale, 0)
  const barSize = categoryScale instanceof BandScale
    ? Math.max(0, categoryScale.bandwidth())
    : Math.max(1, resolveCategoryViewportSize(input) / Math.max(1, rows.length))
  const offsets = new Map<string, { positive: number, negative: number }>()
  const items: Array<NovaChartBarLayoutItem<TData>> = []

  for (const row of rows) {
    let offset = offsets.get(row.category)
    if (!offset) {
      offset = { positive: 0, negative: 0 }
      offsets.set(row.category, offset)
    }
    const baseValue = row.value >= 0 ? offset.positive : offset.negative
    if (row.value >= 0) {
      offset.positive += row.value
    }
    else { offset.negative += row.value }

    const categoryStart = categoryScale.toPx(row.category) as number
    const item = createBarItem(input, row, series, categoryStart, barSize, baseline, baseValue + row.value, baseValue)
    if (isRenderableItem(item)) {
      items.push(item)
    }
  }

  return items
}

function createBarItem<TData>(
  input: NovaChartBarLayoutInput<TData>,
  row: BarLayoutRow<TData>,
  series: Array<NovaChartSeriesMetadata>,
  categoryStart: number,
  categorySize: number,
  baseline: number,
  valueEnd: number,
  valueStart: number,
): NovaChartBarLayoutItem<TData> {
  const { props } = input
  const valueScale = resolveValueScale(input)
  const startPx = numericScalePx(valueScale, valueStart)
  const endPx = numericScalePx(valueScale, valueEnd)
  const seriesMeta = series.find(item => item.id === row.seriesKey) ?? series[0]
  const color = resolveItemColor(input, row, seriesMeta)
  const valueSize = Math.max(props.minBarSize, Math.abs(startPx - endPx))
  const category = row.category
  const labelText = resolveItemLabel(input, row)

  if (props.orientation === 'horizontal') {
    const x = valueEnd >= valueStart ? Math.min(startPx, endPx) : Math.min(endPx, baseline)
    return {
      key: row.key,
      row: row.row,
      value: valueEnd,
      rawValue: row.value,
      category,
      seriesKey: row.seriesKey,
      seriesLabel: row.seriesLabel,
      color,
      labelText,
      x,
      y: categoryStart,
      width: valueSize,
      height: categorySize,
      label: labelText ?? category,
    }
  }

  const y = valueEnd >= valueStart ? Math.min(startPx, endPx) : Math.min(endPx, baseline)
  return {
    key: row.key,
    row: row.row,
    value: valueEnd,
    rawValue: row.value,
    category,
    seriesKey: row.seriesKey,
    seriesLabel: row.seriesLabel,
    color,
    labelText,
    x: categoryStart,
    y,
    width: categorySize,
    height: valueSize,
    label: labelText ?? category,
  }
}

function createAggregatedItems<TData>(
  input: NovaChartBarLayoutInput<TData>,
  domain: ReadonlyArray<string>,
  visibleRange: { startIndex: number, endIndex: number },
  series: Array<NovaChartSeriesMetadata>,
): { items: Array<NovaChartBarLayoutItem<TData>>, bucketCount: number, visibleRows: number } {
  const { props, dataStore } = input
  const categoryScale = resolveCategoryScale(input)
  const valueScale = resolveValueScale(input)
  const visibleCount = Math.max(0, visibleRange.endIndex - visibleRange.startIndex + 1)
  if (visibleCount === 0) {
    return { items: [], bucketCount: 0, visibleRows: 0 }
  }

  const maxBucketsByPixels = Math.max(1, Math.floor(resolveCategoryViewportSize(input) / Math.max(1, props.virtualization.minBarWidthPx)))
  const bucketCount = Math.min(props.virtualization.maxRenderedBars, maxBucketsByPixels, visibleCount)
  const categoriesPerBucket = Math.max(1, Math.ceil(visibleCount / bucketCount))
  const buckets = createAggregationBuckets(bucketCount)
  const rows = dataStore.getData()
  let visibleRows = 0

  if (categoryScale instanceof BandScale) {
    rows.forEach((row, rowIndex) => {
      const category = String(dataStore.readField(row as TData, rowIndex, props.categoryField) ?? '')
      const categoryIndex = categoryScale.indexOf(category)
      if (categoryIndex < visibleRange.startIndex || categoryIndex > visibleRange.endIndex) {
        return
      }

      const bucketIndex = Math.min(bucketCount - 1, Math.floor((categoryIndex - visibleRange.startIndex) / categoriesPerBucket))
      const value = Number(dataStore.readField(row as TData, rowIndex, props.valueField))
      if (!Number.isFinite(value)) {
        return
      }

      visibleRows += 1
      const bucket = buckets[bucketIndex]
      if (bucket) {
        addBucketValue(bucket, value)
      }
    })
  }

  const baseline = numericScalePx(valueScale, 0)
  const items: Array<NovaChartBarLayoutItem<TData>> = []

  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const startIndex = visibleRange.startIndex + bucket * categoriesPerBucket
    if (startIndex > visibleRange.endIndex) {
      break
    }
    const endIndex = Math.min(visibleRange.endIndex, startIndex + categoriesPerBucket - 1)
    const currentBucket = buckets[bucket]
    const aggregate = currentBucket ? readBucketValue(currentBucket, props.virtualization.aggregation) : null
    if (aggregate === null) {
      continue
    }

    const startCategory = domain[startIndex] ?? ''
    const endCategory = domain[endIndex] ?? startCategory
    const categoryStart = categoryScale.toPx(startCategory) as number
    const categoryEnd = categoryScale instanceof BandScale
      ? (categoryScale.toPx(endCategory) as number) + categoryScale.bandwidth()
      : categoryStart + 1
    const row: BarLayoutRow<TData> = {
      row: undefined as TData,
      rowIndex: -1,
      key: `bucket:${startIndex}:${endIndex}`,
      category: `${startIndex + 1}-${endIndex + 1}`,
      value: aggregate,
      seriesKey: '__default',
      seriesLabel: 'Value',
    }
    const item = createBarItem(input, row, series, categoryStart, Math.max(1, categoryEnd - categoryStart), baseline, aggregate, 0)
    item.row = undefined
    item.label = row.category
    items.push(item)
  }

  return { items, bucketCount: items.length, visibleRows }
}

function normalizeRows<TData>(
  input: NovaChartBarLayoutInput<TData>,
  rowIndices: Array<number>,
): Array<BarLayoutRow<TData>> {
  const { props, dataStore } = input
  const rows = dataStore.getData()
  return rowIndices.flatMap((rowIndex) => {
    const row = rows[rowIndex] as TData
    const value = Number(dataStore.readField(row, rowIndex, props.valueField))
    if (!Number.isFinite(value)) {
      return []
    }
    const category = String(dataStore.readField(row, rowIndex, props.categoryField) ?? '')
    const seriesValue = props.seriesField ? dataStore.readField(row, rowIndex, props.seriesField) : undefined
    const seriesKey = seriesValue === undefined || seriesValue === null ? '__default' : String(seriesValue)
    const labelValue = props.labelField ? dataStore.readField(row, rowIndex, props.labelField) : undefined
    return [{
      row,
      rowIndex,
      key: String(dataStore.getRowKey(row, rowIndex)),
      category,
      value,
      seriesKey,
      seriesLabel: labelValue === undefined ? seriesKey : String(labelValue),
    }]
  })
}

function createSeriesMetadata<TData>(
  input: NovaChartBarLayoutInput<TData>,
  rows: ReadonlyArray<TData>,
): Array<NovaChartSeriesMetadata> {
  const { props, dataStore } = input
  const seen = new Set<string>()
  const result: Array<NovaChartSeriesMetadata> = []

  rows.forEach((row, rowIndex) => {
    const value = props.seriesField ? dataStore.readField(row, rowIndex, props.seriesField) : undefined
    const id = value === undefined || value === null ? '__default' : String(value)
    if (seen.has(id)) {
      return
    }
    seen.add(id)
    result.push({
      id,
      kind: 'bar',
      scaleIds: {
        x: props.xScaleId,
        y: props.yScaleId,
      },
      label: id === '__default' ? 'Value' : id,
      color: props.colors.palette[result.length % props.colors.palette.length] ?? props.fill,
      visible: true,
    })
  })

  return result.length > 0
    ? result
    : [{
        id: '__default',
        kind: 'bar',
        scaleIds: {
          x: props.xScaleId,
          y: props.yScaleId,
        },
        label: 'Value',
        color: props.fill,
        visible: true,
      }]
}

function resolveItemColor<TData>(
  input: NovaChartBarLayoutInput<TData>,
  row: BarLayoutRow<TData>,
  series?: NovaChartSeriesMetadata,
): string {
  const { props, dataStore } = input
  if (typeof props.colors.fill === 'function') {
    const context: NovaChartBarColorContext<TData> = {
      row: row.row,
      key: row.key,
      value: row.value,
      category: row.category,
      seriesKey: row.seriesKey,
    }
    return props.colors.fill(context)
  }
  if (typeof props.colors.fill === 'string') {
    return props.colors.fill
  }
  if (props.colors.colorField && row.row) {
    const color = dataStore.readField(row.row, row.rowIndex, props.colors.colorField)
    if (typeof color === 'string' && color) {
      return color
    }
  }
  return series?.color ?? props.fill
}

function resolveItemLabel<TData>(
  input: NovaChartBarLayoutInput<TData>,
  row: BarLayoutRow<TData>,
): string | undefined {
  const { props } = input
  if (!props.labels.visible) {
    return undefined
  }
  const context: NovaChartBarLabelContext<TData> = {
    row: row.row,
    key: row.key,
    value: row.value,
    category: row.category,
    seriesKey: row.seriesKey,
    seriesLabel: row.seriesLabel,
  }
  return props.labels.formatter?.(context) ?? formatValue(row.value)
}

function createAggregationBuckets(count: number): Array<AggregationBucket> {
  return Array.from({ length: count }, () => ({
    count: 0,
    sum: 0,
    min: Number.POSITIVE_INFINITY,
    max: Number.NEGATIVE_INFINITY,
  }))
}

function addBucketValue(bucket: AggregationBucket, value: number): void {
  bucket.count += 1
  bucket.sum += value
  if (value < bucket.min) {
    bucket.min = value
  }
  if (value > bucket.max) {
    bucket.max = value
  }
}

function readBucketValue(
  bucket: AggregationBucket,
  aggregation: NovaChartBarSeriesResolvedProps['virtualization']['aggregation'],
): number | null {
  if (bucket.count === 0) {
    return null
  }
  if (aggregation === 'min') {
    return bucket.min
  }
  if (aggregation === 'max') {
    return bucket.max
  }
  if (aggregation === 'sum') {
    return bucket.sum
  }
  return bucket.sum / bucket.count
}

function resolveCategoryScale<TData>(input: NovaChartBarLayoutInput<TData>): ChartScale<ChartScaleValue> {
  return input.props.orientation === 'horizontal' ? input.yScale : input.xScale
}

function resolveValueScale<TData>(input: NovaChartBarLayoutInput<TData>): ChartScale<ChartScaleValue> {
  return input.props.orientation === 'horizontal' ? input.xScale : input.yScale
}

function resolveCategoryViewportSize<TData>(input: NovaChartBarLayoutInput<TData>): number {
  return input.props.orientation === 'horizontal' ? input.height : input.width
}

function resolveBandDomain(scale: ChartScale<ChartScaleValue>): ReadonlyArray<string> {
  const domain = scale.getDomain()
  return domain.every(value => typeof value === 'string') ? domain as ReadonlyArray<string> : []
}

function resolveVisibleRange(
  scale: ChartScale<ChartScaleValue>,
  size: number,
  overscanPx: number,
): { startIndex: number, endIndex: number } {
  if (scale instanceof BandScale) {
    return scale.visibleIndexRange(-overscanPx, size + overscanPx)
  }

  const domain = resolveBandDomain(scale)
  return { startIndex: 0, endIndex: domain.length - 1 }
}

function numericScalePx(scale: ChartScale<ChartScaleValue>, value: number): number {
  return scale.toPx(value as ChartScaleValue) as number
}

function isRenderableItem<TData>(item: NovaChartBarLayoutItem<TData>): boolean {
  return Number.isFinite(item.x)
    && Number.isFinite(item.y)
    && item.width > 0
    && item.height > 0
}

function formatValue(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '-'
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}
