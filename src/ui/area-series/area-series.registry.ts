import type { NovaSchemaRegistry } from '@endge/nova'
import type { NovaChartAreaSeriesProps } from '@/model/types/chart-components.types'
import type { ChartAreaSeriesDescriptor } from '@/ui/area-series/area-series.config'
import {

  createChartAreaSeriesDescriptor,
  normalizeChartAreaSeriesProps,
} from '@/ui/area-series/area-series.config'
import { ChartAreaSeries } from '@/ui/area-series/AreaSeries'

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
