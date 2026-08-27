import type {
  NovaChartBubbleLayoutPlan,
  NovaChartHitTestInput,
  NovaChartHitTestResult,
} from '@/model/types/chart-components.types'

/**
 * Выполняет hit-test BubbleSeries по rendered bubbles с учетом фактического радиуса.
 */
export function hitTestBubbleLayoutPlan<TData>(
  seriesId: string,
  plan: NovaChartBubbleLayoutPlan<TData>,
  input: NovaChartHitTestInput,
): NovaChartHitTestResult<TData> | null {
  if (plan.points.length === 0) {
    return null
  }

  const tolerance = input.maxDistancePx ?? 8
  let best: { point: NovaChartBubbleLayoutPlan<TData>['points'][number], distance: number } | null = null
  for (const point of plan.points) {
    const centerDistance = Math.hypot(point.x - input.x, point.y - input.y)
    const edgeDistance = Math.max(0, centerDistance - point.radius)
    if (edgeDistance > tolerance) {
      continue
    }
    if (!best || edgeDistance < best.distance) {
      best = { point, distance: edgeDistance }
    }
  }

  if (!best) {
    return null
  }
  const point = best.point
  return {
    seriesId,
    seriesKind: 'bubble',
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
    distancePx: best.distance,
  }
}
