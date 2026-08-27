import type { NovaChartBarChartProps } from '@/model/types/chart-components.types'
import type { ChartBarChartDescriptor } from '@/ui/bar-chart/bar-chart.config'
import {

  createChartBarChartDescriptor,
  normalizeChartBarChartProps,
} from '@/ui/bar-chart/bar-chart.config'
import { ChartBarChart } from '@/ui/bar-chart/BarChart'

export const CHART_BAR_CHART_DESCRIPTOR: ChartBarChartDescriptor = createChartBarChartDescriptor((context, schema) => {
  return new ChartBarChart(
    context.app,
    context.surface,
    normalizeChartBarChartProps(schema.props as NovaChartBarChartProps),
    { componentId: schema.id },
    CHART_BAR_CHART_DESCRIPTOR,
  )
})
