import type { NovaSchemaRegistry } from '@endge/nova'
import type { NovaChartScatterSeriesProps } from '@/model/types/chart-components.types'
import type { ChartScatterSeriesDescriptor } from '@/ui/scatter-series/scatter-series.config'
import {

  createChartScatterSeriesDescriptor,
  normalizeChartScatterSeriesProps,
} from '@/ui/scatter-series/scatter-series.config'
import { ChartScatterSeries } from '@/ui/scatter-series/ScatterSeries'

export const CHART_SCATTER_SERIES_DESCRIPTOR: ChartScatterSeriesDescriptor = createChartScatterSeriesDescriptor((context, schema) => {
  return new ChartScatterSeries(
    context.app,
    context.surface,
    normalizeChartScatterSeriesProps(schema.props as NovaChartScatterSeriesProps),
    { componentId: schema.id },
    CHART_SCATTER_SERIES_DESCRIPTOR,
  )
})

export function registerChartScatterSeries(registry: NovaSchemaRegistry): void {
  registry.register(CHART_SCATTER_SERIES_DESCRIPTOR, { override: true })
}
