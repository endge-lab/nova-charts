import type { NovaSchemaRegistry } from '@endge/nova'
import type { NovaChartComposedChartProps } from '@/model/types/chart-components.types'
import type { ChartComposedChartDescriptor } from '@/ui/composed-chart/composed-chart.config'
import {

  createChartComposedChartDescriptor,
  normalizeChartComposedChartProps,
} from '@/ui/composed-chart/composed-chart.config'
import { ChartComposedChart } from '@/ui/composed-chart/ComposedChart'

export const CHART_COMPOSED_CHART_DESCRIPTOR: ChartComposedChartDescriptor = createChartComposedChartDescriptor((context, schema) => {
  return new ChartComposedChart(
    context.app,
    context.surface,
    normalizeChartComposedChartProps(schema.props as NovaChartComposedChartProps),
    { componentId: schema.id },
    CHART_COMPOSED_CHART_DESCRIPTOR,
  )
})

export function registerChartComposedChart(registry: NovaSchemaRegistry): void {
  registry.register(CHART_COMPOSED_CHART_DESCRIPTOR, { override: true })
}
