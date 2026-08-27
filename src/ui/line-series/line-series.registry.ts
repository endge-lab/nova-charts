import type { NovaSchemaRegistry } from '@endge/nova'
import type { NovaChartLineSeriesProps } from '@/model/types/chart-components.types'
import type { ChartLineSeriesDescriptor } from '@/ui/line-series/line-series.config'
import {

  createChartLineSeriesDescriptor,
  normalizeChartLineSeriesProps,
} from '@/ui/line-series/line-series.config'
import { ChartLineSeries } from '@/ui/line-series/LineSeries'

export const CHART_LINE_SERIES_DESCRIPTOR: ChartLineSeriesDescriptor = createChartLineSeriesDescriptor((context, schema) => {
  return new ChartLineSeries(
    context.app,
    context.surface,
    normalizeChartLineSeriesProps(schema.props as NovaChartLineSeriesProps),
    { componentId: schema.id },
    CHART_LINE_SERIES_DESCRIPTOR,
  )
})

export function registerChartLineSeries(registry: NovaSchemaRegistry): void {
  registry.register(CHART_LINE_SERIES_DESCRIPTOR, { override: true })
}
