import type { NovaSchemaRegistry } from '@endge/nova'
import type { NovaChartPlotProps } from '@/model/types/chart-components.types'
import type { ChartPlotDescriptor } from '@/ui/plot/plot.config'
import { ChartPlot } from '@/ui/plot/Plot'
import {

  createChartPlotDescriptor,
  normalizeChartPlotProps,
} from '@/ui/plot/plot.config'

export const CHART_PLOT_DESCRIPTOR: ChartPlotDescriptor = createChartPlotDescriptor((context, schema) => {
  return new ChartPlot(
    context.app,
    context.surface,
    normalizeChartPlotProps(schema.props as NovaChartPlotProps),
    {
      componentId: schema.id,
      children: schema.children ?? [],
    },
    CHART_PLOT_DESCRIPTOR,
  )
})

export function registerChartPlot(registry: NovaSchemaRegistry): void {
  registry.register(CHART_PLOT_DESCRIPTOR, { override: true })
}
