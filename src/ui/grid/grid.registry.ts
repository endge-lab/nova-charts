import type { NovaSchemaRegistry } from '@endge/nova'
import type { NovaChartGridProps } from '@/model/types/chart-components.types'
import type { ChartGridDescriptor } from '@/ui/grid/grid.config'
import { ChartGrid } from '@/ui/grid/Grid'
import {

  createChartGridDescriptor,
  normalizeChartGridProps,
} from '@/ui/grid/grid.config'

export const CHART_GRID_DESCRIPTOR: ChartGridDescriptor = createChartGridDescriptor((context, schema) => {
  return new ChartGrid(
    context.app,
    context.surface,
    normalizeChartGridProps(schema.props as NovaChartGridProps),
    { componentId: schema.id },
    CHART_GRID_DESCRIPTOR,
  )
})

export function registerChartGrid(registry: NovaSchemaRegistry): void {
  registry.register(CHART_GRID_DESCRIPTOR, { override: true })
}
