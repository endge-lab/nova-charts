import { ChartBarChart } from '@/ui/bar-chart/BarChart'
import {
  createChartBarChartDescriptor,
  normalizeChartBarChartProps,
  type ChartBarChartDescriptor,
} from '@/ui/bar-chart/bar-chart.config'
import type { NovaChartBarChartProps } from '@/model/types/chart-components.types'

export const CHART_BAR_CHART_DESCRIPTOR: ChartBarChartDescriptor = createChartBarChartDescriptor((context, schema) => {
  return new ChartBarChart(
    context.app,
    context.surface,
    normalizeChartBarChartProps(schema.props as NovaChartBarChartProps),
    { componentId: schema.id },
    CHART_BAR_CHART_DESCRIPTOR,
  )
})
