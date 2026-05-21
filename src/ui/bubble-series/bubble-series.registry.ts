import type { NovaSchemaRegistry } from '@endge/nova'
import { ChartBubbleSeries } from '@/ui/bubble-series/BubbleSeries'
import {
  createChartBubbleSeriesDescriptor,
  normalizeChartBubbleSeriesProps,
  type ChartBubbleSeriesDescriptor,
} from '@/ui/bubble-series/bubble-series.config'
import type { NovaChartBubbleSeriesProps } from '@/model/types/chart-components.types'

export const CHART_BUBBLE_SERIES_DESCRIPTOR: ChartBubbleSeriesDescriptor = createChartBubbleSeriesDescriptor((context, schema) => {
  return new ChartBubbleSeries(
    context.app,
    context.surface,
    normalizeChartBubbleSeriesProps(schema.props as NovaChartBubbleSeriesProps),
    { componentId: schema.id },
    CHART_BUBBLE_SERIES_DESCRIPTOR,
  )
})

export function registerChartBubbleSeries(registry: NovaSchemaRegistry): void {
  registry.register(CHART_BUBBLE_SERIES_DESCRIPTOR, { override: true })
}
