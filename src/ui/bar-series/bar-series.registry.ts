import type { NovaSchemaRegistry } from '@endge/nova'
import type { NovaChartBarSeriesProps } from '@/model/types/chart-components.types'
import type { ChartBarSeriesDescriptor } from '@/ui/bar-series/bar-series.config'
import {

  createChartBarSeriesDescriptor,
  normalizeChartBarSeriesProps,
} from '@/ui/bar-series/bar-series.config'
import { ChartBarSeries } from '@/ui/bar-series/BarSeries'

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
