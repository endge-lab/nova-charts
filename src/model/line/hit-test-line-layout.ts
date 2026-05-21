import type {
  NovaChartHitTestInput,
  NovaChartHitTestResult,
  NovaChartLineLayoutPlan,
} from '@/model/types/chart-components.types'

/**
 * Выполняет hit-test LineSeries по ближайшей rendered point.
 */
export function hitTestLineLayoutPlan<TData>(
  seriesId: string,
  plan: NovaChartLineLayoutPlan<TData>,
  input: NovaChartHitTestInput,
): NovaChartHitTestResult<TData> | null {
  if (plan.points.length === 0) return null

  const maxDistancePx = input.maxDistancePx ?? 12
  let best: { point: NovaChartLineLayoutPlan<TData>['points'][number]; distance: number } | null = null

  for (const point of plan.points) {
    const distance = Math.hypot(point.x - input.x, point.y - input.y)
    if (distance > maxDistancePx) continue
    if (!best || distance < best.distance) best = { point, distance }
  }

  return best ? toHitTestResult(seriesId, best.point, best.distance) : null
}

function toHitTestResult<TData>(
  seriesId: string,
  point: NovaChartLineLayoutPlan<TData>['points'][number],
  distancePx: number,
): NovaChartHitTestResult<TData> {
  return {
    seriesId,
    seriesKind: 'line',
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
      x: point.x,
      y: point.y,
      width: 1,
      height: 1,
    },
    distancePx,
  }
}
