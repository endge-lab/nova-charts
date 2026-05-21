import type { NovaSchemaRegistry } from '@endge/nova'
import { ChartAreaSeries } from '@/ui/area-series/AreaSeries'
import {
  createChartAreaSeriesDescriptor,
  normalizeChartAreaSeriesProps,
  type ChartAreaSeriesDescriptor,
} from '@/ui/area-series/area-series.config'
import type { NovaChartAreaSeriesProps } from '@/model/types/chart-components.types'

export const CHART_AREA_SERIES_DESCRIPTOR: ChartAreaSeriesDescriptor = createChartAreaSeriesDescriptor((context, schema) => {
  return new ChartAreaSeries(
    context.app,
    context.surface,
    normalizeChartAreaSeriesProps(schema.props as NovaChartAreaSeriesProps),
    { componentId: schema.id },
    CHART_AREA_SERIES_DESCRIPTOR,
  )
})

export function registerChartAreaSeries(registry: NovaSchemaRegistry): void {
  registry.register(CHART_AREA_SERIES_DESCRIPTOR, { override: true })
}
