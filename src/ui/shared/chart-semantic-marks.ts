import type { NovaSemanticRegisterOptions } from '@endge/nova'
import type { NovaChartRuntime } from '@/model/context/nova-chart-runtime'
import type { NovaChartSeriesKind } from '@/model/types/chart-components.types'

interface ChartSemanticMark {
  key?: string
  x?: number
  y?: number
  width?: number
  height?: number
  radius?: number
  value?: number
  rawValue?: number
  xValue?: unknown
  yValue?: unknown
  category?: unknown
  seriesKey?: string
  seriesLabel?: string
  color?: string
}

export function publishChartMarkSemantics<TData>(
  runtime: NovaChartRuntime<TData> | null | undefined,
  sourceId: string,
  seriesId: string,
  seriesKind: NovaChartSeriesKind,
  marks: ReadonlyArray<ChartSemanticMark>,
): void {
  if (!runtime) return
  const accessibility = runtime.props.accessibility
  if (accessibility === false || !accessibility.includeVisibleMarks) {
    runtime.clearSemanticRegions(sourceId)
    return
  }

  const maxMarks = accessibility.maxMarks
  const regions: Array<NovaSemanticRegisterOptions> = marks.slice(0, maxMarks).map((mark, index) => ({
    id: `${runtime.id}:${seriesId}:mark:${mark.key ?? index}`,
    role: 'mark',
    label: markLabel(seriesKind, mark, index),
    focusable: accessibility.keyboardNavigation,
    order: 1_000 + index,
    bounds: markBounds(mark),
    data: {
      seriesId,
      seriesKind,
      key: mark.key,
      value: mark.value ?? mark.yValue,
      rawValue: mark.rawValue,
      xValue: mark.xValue,
      yValue: mark.yValue,
      category: mark.category,
      seriesKey: mark.seriesKey,
      seriesLabel: mark.seriesLabel,
      color: mark.color,
    },
    source: {
      type: 'synthetic',
      componentId: seriesId,
      part: 'mark',
    },
  }))

  runtime.publishSemanticRegions(sourceId, regions)
}

function markBounds(mark: ChartSemanticMark) {
  if (
    Number.isFinite(mark.x)
    && Number.isFinite(mark.y)
    && Number.isFinite(mark.width)
    && Number.isFinite(mark.height)
  ) {
    return {
      x: Number(mark.x),
      y: Number(mark.y),
      width: Math.max(0, Number(mark.width)),
      height: Math.max(0, Number(mark.height)),
    }
  }

  if (Number.isFinite(mark.x) && Number.isFinite(mark.y)) {
    const radius = Math.max(4, Number.isFinite(mark.radius) ? Number(mark.radius) : 6)
    return {
      x: Number(mark.x) - radius,
      y: Number(mark.y) - radius,
      width: radius * 2,
      height: radius * 2,
    }
  }

  return undefined
}

function markLabel(kind: NovaChartSeriesKind, mark: ChartSemanticMark, index: number): string {
  const series = mark.seriesLabel ?? mark.seriesKey ?? kind
  const name = mark.category ?? mark.xValue ?? mark.key ?? index + 1
  const value = mark.value ?? mark.yValue
  return `${series}: ${name}${value === undefined ? '' : ` ${value}`}`
}
