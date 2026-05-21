import type {
  NovaChartHitTestInput,
  NovaChartHitTestResult,
  NovaChartScatterLayoutPlan,
  NovaChartScatterLayoutPoint,
  NovaChartSeriesKind,
} from '@/model/types/chart-components.types'

/**
 * Выполняет hit-test ScatterSeries по rendered points.
 */
export function hitTestScatterLayoutPlan<TData>(
  seriesId: string,
  plan: NovaChartScatterLayoutPlan<TData>,
  input: NovaChartHitTestInput,
): NovaChartHitTestResult<TData> | null {
  return hitTestPointLayoutPlan(seriesId, 'scatter', plan.points, input, input.maxDistancePx ?? 12)
}

export function hitTestPointLayoutPlan<TData>(
  seriesId: string,
  seriesKind: NovaChartSeriesKind,
  points: Array<NovaChartScatterLayoutPoint<TData>>,
  input: NovaChartHitTestInput,
  fallbackDistancePx: number,
): NovaChartHitTestResult<TData> | null {
  if (points.length === 0) return null

  let best: { point: NovaChartScatterLayoutPoint<TData>; distance: number } | null = null
  for (const point of points) {
    const maxDistancePx = Math.max(fallbackDistancePx, point.radius)
    const distance = Math.hypot(point.x - input.x, point.y - input.y)
    if (distance > maxDistancePx) continue
    if (!best || distance < best.distance) best = { point, distance }
  }

  return best ? toHitTestResult(seriesId, seriesKind, best.point, best.distance) : null
}

export function toHitTestResult<TData>(
  seriesId: string,
  seriesKind: NovaChartSeriesKind,
  point: NovaChartScatterLayoutPoint<TData>,
  distancePx: number,
): NovaChartHitTestResult<TData> {
  return {
    seriesId,
    seriesKind,
    key: point.key,
    mode: 'datum',
    row: point.row,
    value: point.yValue,
    rawValue: point.rawValue,
    xValue: point.xValue,
    yValue: point.yValue,
    label: point.seriesLabel === '__default' ? String(point.xValue) : point.seriesLabel,
    category: typeof point.xValue === 'string' ? point.xValue : undefined,
    seriesKey: point.seriesKey,
    seriesLabel: point.seriesLabel,
    color: point.color,
    point: {
      x: point.x,
      y: point.y,
    },
    bounds: {
      x: point.x - point.radius,
      y: point.y - point.radius,
      width: point.radius * 2,
      height: point.radius * 2,
    },
    distancePx,
  }
}
