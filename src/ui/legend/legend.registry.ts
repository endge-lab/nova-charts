import type { NovaChartLegendProps } from '@/model/types/chart-components.types'
import type { ChartLegendDescriptor } from '@/ui/legend/legend.config'
import { ChartLegend } from '@/ui/legend/Legend'
import {

  createChartLegendDescriptor,
  normalizeChartLegendProps,
} from '@/ui/legend/legend.config'

export const CHART_LEGEND_DESCRIPTOR: ChartLegendDescriptor = createChartLegendDescriptor((context, schema) => {
  return new ChartLegend(
    context.app,
    context.surface,
    normalizeChartLegendProps(schema.props as NovaChartLegendProps),
    { componentId: schema.id },
    CHART_LEGEND_DESCRIPTOR,
  )
})
