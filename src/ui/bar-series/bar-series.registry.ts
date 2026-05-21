import type { NovaSchemaRegistry } from '@endge/nova'
import { ChartBarSeries } from '@/ui/bar-series/BarSeries'
import {
  createChartBarSeriesDescriptor,
  normalizeChartBarSeriesProps,
  type ChartBarSeriesDescriptor,
} from '@/ui/bar-series/bar-series.config'
import type { NovaChartBarSeriesProps } from '@/model/types/chart-components.types'

export const CHART_BAR_SERIES_DESCRIPTOR: ChartBarSeriesDescriptor = createChartBarSeriesDescriptor((context, schema) => {
  return new ChartBarSeries(
    context.app,
    context.surface,
    normalizeChartBarSeriesProps(schema.props as NovaChartBarSeriesProps),
    { componentId: schema.id },
    CHART_BAR_SERIES_DESCRIPTOR,
  )
})

export function registerChartBarSeries(registry: NovaSchemaRegistry): void {
  registry.register(CHART_BAR_SERIES_DESCRIPTOR, { override: true })
}
