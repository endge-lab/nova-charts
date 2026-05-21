import type {
  NovaChartBarLayoutPlan,
  NovaChartHitTestInput,
  NovaChartHitTestResult,
} from '@/model/types/chart-components.types'

/**
 * Выполняет bounded hit-test по уже отрендеренному bar layout plan.
 */
export function hitTestBarLayoutPlan<TData>(
  seriesId: string,
  plan: NovaChartBarLayoutPlan<TData>,
  input: NovaChartHitTestInput,
): NovaChartHitTestResult<TData> | null {
  const items = plan.items
  if (items.length === 0) return null

  const mode = input.mode ?? 'exact'
  const exact = findExactItem(items, input.x, input.y)
  if (exact) return toHitTestResult(seriesId, plan, exact, input.x, input.y, 0)
  if (mode !== 'nearest') return null

  const maxDistancePx = input.maxDistancePx ?? 16
  const nearest = findNearestItem(items, input.x, input.y, maxDistancePx)
  return nearest ? toHitTestResult(seriesId, plan, nearest.item, input.x, input.y, nearest.distance) : null
}

function findExactItem<TItem extends { x: number; y: number; width: number; height: number }>(
  items: Array<TItem>,
  x: number,
  y: number,
): TItem | null {
  for (const item of items) {
    if (x >= item.x && x <= item.x + item.width && y >= item.y && y <= item.y + item.height) return item
  }

  return null
}

function findNearestItem<TItem extends { x: number; y: number; width: number; height: number }>(
  items: Array<TItem>,
  x: number,
  y: number,
  maxDistancePx: number,
): { item: TItem; distance: number } | null {
  let best: { item: TItem; distance: number } | null = null
  for (const item of items) {
    const centerX = item.x + item.width / 2
    const centerY = item.y + item.height / 2
    const distance = Math.hypot(centerX - x, centerY - y)
    if (distance > maxDistancePx) continue
    if (!best || distance < best.distance) best = { item, distance }
  }
  return best
}

function toHitTestResult<TData>(
  seriesId: string,
  plan: NovaChartBarLayoutPlan<TData>,
  item: NovaChartBarLayoutPlan<TData>['items'][number],
  x: number,
  y: number,
  distancePx: number,
): NovaChartHitTestResult<TData> {
  return {
    seriesId,
    seriesKind: 'bar',
    key: item.key,
    mode: item.row ? 'datum' : 'bucket',
    row: item.row,
    value: item.value,
    rawValue: item.rawValue,
    xValue: plan.orientation === 'horizontal' ? item.value : item.category,
    yValue: plan.orientation === 'horizontal' ? item.category : item.value,
    label: item.label,
    category: item.category,
    seriesKey: item.seriesKey,
    seriesLabel: item.seriesLabel,
    color: item.color,
    point: {
      x: item.x + item.width / 2,
      y: item.y + item.height / 2,
    },
    bounds: {
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
    },
    distancePx: distancePx || distanceToRect(item, x, y),
  }
}

function distanceToRect(
  item: { x: number; y: number; width: number; height: number },
  x: number,
  y: number,
): number {
  const dx = Math.max(item.x - x, 0, x - (item.x + item.width))
  const dy = Math.max(item.y - y, 0, y - (item.y + item.height))
  return Math.hypot(dx, dy)
}
